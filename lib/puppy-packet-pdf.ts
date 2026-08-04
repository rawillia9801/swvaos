import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TemplatesConfig } from "./template-defaults";

type Row = Record<string, unknown>;

type PacketInput = {
  puppy: Row;
  buyer: Row | null;
  litter: Row | null;
  dam: Row | null;
  sire: Row | null;
  updates: Row[];
  events: Row[];
  templates: TemplatesConfig;
  testCopy?: boolean;
};

type PacketSection = { title: string; lines: string[] };

type SectionGuide = {
  label: string;
  summary: string;
  points: string[];
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 48;
const contentWidth = pageWidth - margin * 2;
const teal = rgb(0.035, 0.45, 0.49);
const deepTeal = rgb(0.025, 0.19, 0.23);
const sea = rgb(0.09, 0.67, 0.63);
const ink = rgb(0.07, 0.2, 0.24);
const muted = rgb(0.36, 0.47, 0.49);
const line = rgb(0.81, 0.89, 0.88);
const soft = rgb(0.95, 0.98, 0.97);
const warm = rgb(0.98, 0.95, 0.87);

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const number = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;
const buyerName = (buyer: Row | null) => [text(buyer, "first_name"), text(buyer, "last_name")].filter(Boolean).join(" ") || text(buyer, "email") || "Not assigned";
const formatDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${raw.slice(0, 10)}T12:00:00Z`));
  } catch {
    return raw;
  }
};
const weight = (value: unknown) => Number(value) > 0 ? `${Number(value).toFixed(Number(value) % 1 ? 2 : 0)} lb` : "Not recorded";

function replaceVariables(content: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value || "Not recorded"), content);
}

function splitSections(content: string): PacketSection[] {
  const sections: PacketSection[] = [];
  let current: PacketSection | null = null;
  for (const raw of content.replaceAll("\r", "").split("\n")) {
    const value = raw.trimEnd();
    if (value.startsWith("# ")) {
      if (current) sections.push(current);
      current = { title: value.slice(2).trim(), lines: [] };
      continue;
    }
    if (!current) current = { title: "Important Puppy Information", lines: [] };
    current.lines.push(value);
  }
  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.lines.some((value) => value.trim()));
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(value ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function guideFor(title: string): SectionGuide {
  const normalized = title.toLowerCase();
  if (/welcome home/.test(normalized)) return { label: "WELCOME HOME", summary: "A personal introduction to the care plan, records, and support prepared for this family.", points: ["Review the binder before go-home day.", "Save breeder and emergency contacts.", "Bring the packet to the first veterinary visit."] };
  if (/first 72 hours/.test(normalized)) return { label: "FIRST DAYS TOGETHER", summary: "A calm and predictable beginning supports eating, sleeping, bathroom routines, and secure bonding.", points: ["Keep the first days quiet.", "Observe every meal.", "Limit unnecessary travel and visitors."] };
  if (/feeding/.test(normalized)) return { label: "DAILY NUTRITION", summary: "Small, measured meals and direct observation help protect a young Chihuahua's energy and growth.", points: ["Follow the provided food schedule.", "Record appetite changes.", "Make food changes gradually."] };
  if (/pup-lift|hypoglycemia/.test(normalized)) return { label: "EMERGENCY READINESS", summary: "Toy-breed puppies can decline quickly when blood sugar drops, so preparation and prompt action matter.", points: ["Know the warning signs.", "Keep Pup-Lift accessible.", "Contact veterinary care promptly."] };
  if (/veterinarian/.test(normalized)) return { label: "WHEN TO SEEK CARE", summary: "Use this section to distinguish emergency warning signs from concerns requiring a same-day veterinary call.", points: ["Trust major behavior changes.", "Know the puppy's current weight.", "Do not delay care for collapse or breathing trouble."] };
  if (/vaccines|parasites|fleas|ticks|heartworms/.test(normalized)) return { label: "PREVENTIVE HEALTH", summary: "Veterinary guidance, accurate records, and age-appropriate prevention help protect a developing puppy.", points: ["Keep all records together.", "Avoid high-risk public ground.", "Never estimate medication doses."] };
  if (/socialization|training|potty|crate|sleep/.test(normalized)) return { label: "CONFIDENCE & ROUTINE", summary: "Brief positive practice and consistent routines help a Chihuahua become secure, responsive, and comfortable at home.", points: ["Keep sessions short.", "Reward desired behavior.", "Protect rest and bathroom routines."] };
  if (/children|visitors|other pets/.test(normalized)) return { label: "SAFE INTERACTIONS", summary: "Tiny puppies require direct supervision around children, guests, and larger animals.", points: ["Use controlled introductions.", "Prevent rough handling.", "Provide a protected rest area."] };
  if (/grooming|dental/.test(normalized)) return { label: "LIFELONG CARE", summary: "Gentle early handling helps make grooming, nail care, dental care, and routine examinations easier throughout life.", points: ["Keep sessions calm and brief.", "Use puppy-safe products.", "Monitor teeth, ears, skin, and nails."] };
  if (/safety|poison|harness|travel/.test(normalized)) return { label: "SAFETY FIRST", summary: "A Chihuahua's size creates special risks from falls, escape, household hazards, and unsecured travel.", points: ["Block falls and escape routes.", "Secure toxins and medications.", "Use a properly fitted restraint."] };
  if (/growth|insurance|financial/.test(normalized)) return { label: "PLANNING AHEAD", summary: "Weight records, insurance details, and financial preparation support timely decisions as the puppy grows.", points: ["Track trends, not one measurement.", "Understand policy exclusions.", "Maintain emergency funds."] };
  if (/emergency plan|go-home checklist/.test(normalized)) return { label: "READY BEFORE NEEDED", summary: "A written plan helps every caregiver respond consistently and confidently when something changes.", points: ["Save clinic numbers.", "Keep a carrier ready.", "Review supplies and records."] };
  return { label: "PERSONALIZED REFERENCE", summary: "A practical reference page prepared specifically for this puppy and family.", points: ["Keep this page with the puppy's records.", "Add family notes as routines develop.", "Share relevant details with the veterinarian."] };
}

function categoryFor(title: string) {
  if (/welcome|first 72|feeding|pup-lift|veterinarian|vaccines|parasites/i.test(title)) return "Getting Started & Health";
  if (/socialization|potty|crate|sleep|training|children|grooming|dental/i.test(title)) return "Daily Life & Training";
  return "Safety, Planning & Records";
}

export async function renderPuppyPacketPdf(input: PacketInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const puppyName = text(input.puppy, "name") || "Your Puppy";
  const family = buyerName(input.buyer);
  const litter = text(input.litter, "name") || "Not recorded";
  const dam = text(input.dam, "registered_name") || text(input.dam, "name") || "Not recorded";
  const sire = text(input.sire, "registered_name") || text(input.sire, "name") || "Not recorded";
  const location = [text(input.buyer, "city"), text(input.buyer, "state"), text(input.buyer, "postal_code")].filter(Boolean).join(", ") || "Not recorded";
  const packetDate = formatDate(new Date().toISOString());
  const variables: Record<string, string> = {
    puppy_name: puppyName,
    buyer_name: family,
    family_name: family,
    birth_date: formatDate(input.puppy.birth_date),
    sex: text(input.puppy, "sex") || "Not recorded",
    color: text(input.puppy, "color") || "Not recorded",
    litter_name: litter,
    dam_name: dam,
    sire_name: sire,
    birth_weight: weight(input.puppy.birth_weight),
    current_weight: weight(input.puppy.current_weight),
    buyer_phone: text(input.buyer, "phone") || "Not recorded",
    buyer_email: text(input.buyer, "email") || "Not recorded",
    buyer_location: location,
    packet_date: packetDate,
    business_name: "Southwest Virginia Chihuahua",
    business_website: "swvachihuahua.com",
    pup_lift_website: "pup-lift.com",
    pup_lift_phone: "1-715-888-9526",
  };
  const sections = splitSections(replaceVariables(input.templates.documents.puppy_packet.content, variables));
  const tocItems = ["Personalized Puppy and Family Record", ...sections.map((section) => section.title), "Health and Care Logs", `Notes and Records for ${puppyName}`];

  pdf.setTitle(`${puppyName}'s Personalized Puppy Care Packet`);
  pdf.setAuthor("Southwest Virginia Chihuahua");
  pdf.setSubject(`${puppyName} - ${family}`);
  pdf.setCreator("SWVAOS");
  pdf.setCreationDate(new Date());

  let pageNumber = 0;
  function basePage(title = "") {
    pageNumber += 1;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 14, width: pageWidth, height: 14, color: teal });
    page.drawText("SOUTHWEST VIRGINIA CHIHUAHUA", { x: margin, y: pageHeight - 36, size: 7, font: bold, color: deepTeal, characterSpacing: 1.1 });
    if (title) page.drawText(title.toUpperCase().slice(0, 74), { x: margin, y: pageHeight - 49, size: 6.5, font: regular, color: muted });
    page.drawLine({ start: { x: margin, y: 45 }, end: { x: pageWidth - margin, y: 45 }, thickness: 0.6, color: line });
    page.drawText(`Personalized for ${family} and ${puppyName}`, { x: margin, y: 29, size: 6.8, font: regular, color: muted });
    const footer = `Page ${pageNumber}`;
    page.drawText(footer, { x: pageWidth - margin - regular.widthOfTextAtSize(footer, 6.8), y: 29, size: 6.8, font: regular, color: muted });
    if (input.testCopy) {
      page.drawText("TEST COPY", { x: pageWidth - margin - bold.widthOfTextAtSize("TEST COPY", 8), y: pageHeight - 36, size: 8, font: bold, color: rgb(0.72, 0.2, 0.18) });
    }
    return page;
  }

  function drawWrapped(page: PDFPage, value: string, x: number, y: number, options: { font?: PDFFont; size?: number; maxWidth?: number; color?: ReturnType<typeof rgb>; lineHeight?: number } = {}) {
    const font = options.font || regular;
    const size = options.size || 10;
    const maxWidth = options.maxWidth || contentWidth;
    const lineHeight = options.lineHeight || size + 4;
    const lines = wrapText(value, font, size, maxWidth);
    lines.forEach((item, index) => page.drawText(item, { x, y: y - index * lineHeight, size, font, color: options.color || ink }));
    return y - lines.length * lineHeight;
  }

  // Cover
  pageNumber += 1;
  const cover = pdf.addPage([pageWidth, pageHeight]);
  cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: deepTeal });
  cover.drawRectangle({ x: 24, y: 24, width: pageWidth - 48, height: pageHeight - 48, borderColor: rgb(0.32, 0.72, 0.7), borderWidth: 1 });
  cover.drawCircle({ x: pageWidth - 70, y: pageHeight - 70, size: 120, color: rgb(0.04, 0.34, 0.38), opacity: 0.7 });
  cover.drawCircle({ x: 40, y: 90, size: 95, color: rgb(0.44, 0.36, 0.18), opacity: 0.35 });
  cover.drawText("SOUTHWEST VIRGINIA CHIHUAHUA", { x: 52, y: 742, size: 8, font: bold, color: rgb(0.7, 0.95, 0.92), characterSpacing: 1.5 });
  cover.drawText("PERSONALIZED GO-HOME COLLECTION", { x: 52, y: 728, size: 6.7, font: regular, color: rgb(0.72, 0.83, 0.83), characterSpacing: 1 });
  cover.drawRectangle({ x: 52, y: 588, width: 72, height: 72, color: rgb(1, 1, 1), opacity: 0.1, borderColor: rgb(0.45, 0.8, 0.77), borderWidth: 1 });
  const initials = puppyName.split(/\s+/).filter(Boolean).slice(0, 2).map((value) => value[0]?.toUpperCase()).join("") || "SW";
  cover.drawText(initials, { x: 88 - serifBold.widthOfTextAtSize(initials, 25) / 2, y: 611, size: 25, font: serifBold, color: rgb(1, 1, 1) });
  cover.drawText(`CREATED ESPECIALLY FOR ${family.toUpperCase()}`, { x: 52, y: 554, size: 7, font: bold, color: rgb(0.55, 0.9, 0.86), characterSpacing: 1 });
  cover.drawText(puppyName, { x: 52, y: 496, size: 42, font: serifBold, color: rgb(1, 1, 1) });
  cover.drawText("Puppy Care Binder", { x: 52, y: 458, size: 27, font: serif, color: rgb(0.82, 0.96, 0.94) });
  drawWrapped(cover, "A personal collection of care guidance, emergency preparation, puppy records, family resources, and practical support for the first days home and the years ahead.", 52, 422, { size: 11, maxWidth: 330, color: rgb(0.78, 0.87, 0.87), lineHeight: 16 });
  const coverFields: Array<[string, string]> = [["PUPPY", puppyName], ["FAMILY", family], ["DATE OF BIRTH", formatDate(input.puppy.birth_date)], ["PACKET DATE", packetDate]];
  coverFields.forEach(([label, value], index) => {
    const x = 390;
    const y = 570 - index * 74;
    cover.drawRectangle({ x, y, width: 165, height: 57, color: rgb(1, 1, 1), opacity: 0.08, borderColor: rgb(0.35, 0.66, 0.65), borderWidth: 0.7 });
    cover.drawText(label, { x: x + 12, y: y + 39, size: 6.5, font: bold, color: rgb(0.55, 0.9, 0.86) });
    drawWrapped(cover, value, x + 12, y + 22, { size: 10, font: bold, maxWidth: 141, color: rgb(1, 1, 1), lineHeight: 11 });
  });
  const featureBoxes = [["01", "EVERYDAY CARE", "Feeding, routines, training, grooming, and settling in."], ["02", "HEALTH & SAFETY", "Pup-Lift readiness, prevention, warning signs, and emergencies."], ["03", "PERSONAL RECORDS", "Weights, care history, important documents, and family notes."]];
  featureBoxes.forEach(([num, label, copy], index) => {
    const x = 52 + index * 170;
    cover.drawRectangle({ x, y: 120, width: 155, height: 96, color: rgb(1, 1, 1), opacity: 0.07, borderColor: rgb(0.35, 0.66, 0.65), borderWidth: 0.6 });
    cover.drawText(num, { x: x + 12, y: 190, size: 8, font: bold, color: rgb(0.55, 0.9, 0.86) });
    cover.drawText(label, { x: x + 12, y: 170, size: 7.5, font: bold, color: rgb(1, 1, 1) });
    drawWrapped(cover, copy, x + 12, 151, { size: 7.3, maxWidth: 131, color: rgb(0.75, 0.85, 0.85), lineHeight: 10 });
  });
  cover.drawText("Marion, Virginia  |  swvachihuahua.com  |  Pup-Lift: pup-lift.com  |  1-715-888-9526", { x: 52, y: 62, size: 7, font: regular, color: rgb(0.72, 0.83, 0.83) });
  if (input.testCopy) cover.drawText("TEST COPY", { x: pageWidth - 52 - bold.widthOfTextAtSize("TEST COPY", 11), y: 742, size: 11, font: bold, color: rgb(1, 0.68, 0.62) });

  // Contents
  const tocPage = basePage("Table of Contents");
  tocPage.drawRectangle({ x: margin, y: 620, width: contentWidth, height: 102, color: deepTeal });
  tocPage.drawText("YOUR PERSONALIZED GUIDE", { x: margin + 20, y: 693, size: 7, font: bold, color: rgb(0.58, 0.92, 0.88), characterSpacing: 1 });
  tocPage.drawText(`Inside ${puppyName}'s Binder`, { x: margin + 20, y: 659, size: 25, font: serifBold, color: rgb(1, 1, 1) });
  drawWrapped(tocPage, `Everything is organized so ${family} can quickly find care instructions, safety information, and records.`, margin + 20, 637, { size: 8.5, maxWidth: 375, color: rgb(0.78, 0.88, 0.88), lineHeight: 11 });
  tocPage.drawText(String(tocItems.length), { x: 500, y: 665, size: 28, font: serifBold, color: rgb(1, 1, 1) });
  tocPage.drawText("SECTIONS", { x: 494, y: 649, size: 6.5, font: bold, color: rgb(0.58, 0.92, 0.88) });
  const groups = new Map<string, string[]>();
  tocItems.forEach((item) => { const category = categoryFor(item); groups.set(category, [...(groups.get(category) || []), item]); });
  let groupIndex = 0;
  for (const [category, items] of groups.entries()) {
    const column = groupIndex % 2;
    const row = Math.floor(groupIndex / 2);
    const x = margin + column * 264;
    const yTop = 590 - row * 238;
    tocPage.drawRectangle({ x, y: yTop - 214, width: 250, height: 214, color: soft, borderColor: line, borderWidth: 0.7 });
    tocPage.drawRectangle({ x: x + 12, y: yTop - 37, width: 30, height: 30, color: teal });
    tocPage.drawText(`0${groupIndex + 1}`, { x: x + 20, y: yTop - 27, size: 8, font: bold, color: rgb(1, 1, 1) });
    tocPage.drawText(category, { x: x + 52, y: yTop - 26, size: 10.5, font: bold, color: deepTeal });
    items.slice(0, 12).forEach((item, index) => {
      const y = yTop - 62 - index * 14;
      tocPage.drawText(String(index + 1).padStart(2, "0"), { x: x + 14, y, size: 6.8, font: bold, color: teal });
      drawWrapped(tocPage, item, x + 42, y, { size: 7.5, font: regular, maxWidth: 192, color: ink, lineHeight: 9 });
    });
    groupIndex += 1;
  }

  // Personalized record
  const recordPage = basePage("Personalized Puppy and Family Record");
  recordPage.drawText("Personalized Puppy and Family Record", { x: margin, y: 690, size: 24, font: serifBold, color: deepTeal });
  recordPage.drawText("AT-A-GLANCE PROFILE", { x: margin, y: 669, size: 7, font: bold, color: teal, characterSpacing: 1 });
  const recordFields: Array<[string, string]> = [
    ["Puppy name", puppyName], ["Family", family], ["Date of birth", formatDate(input.puppy.birth_date)], ["Sex", text(input.puppy, "sex") || "Not recorded"],
    ["Color", text(input.puppy, "color") || "Not recorded"], ["Status", text(input.puppy, "status") || "Not recorded"], ["Litter", litter], ["Birth weight", weight(input.puppy.birth_weight)],
    ["Dam", dam], ["Sire", sire], ["Current weight", weight(input.puppy.current_weight)], ["Buyer phone", text(input.buyer, "phone") || "Not recorded"],
    ["Buyer email", text(input.buyer, "email") || "Not recorded"], ["Buyer location", location],
  ];
  recordFields.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * 264;
    const y = 620 - row * 61;
    recordPage.drawRectangle({ x, y, width: 250, height: 49, color: soft, borderColor: line, borderWidth: 0.6 });
    recordPage.drawText(label.toUpperCase(), { x: x + 11, y: y + 32, size: 6, font: bold, color: muted });
    drawWrapped(recordPage, value, x + 11, y + 17, { size: 8.5, font: bold, maxWidth: 228, color: ink, lineHeight: 9.5 });
  });

  function addSectionPages(section: PacketSection) {
    const guide = guideFor(section.title);
    let page = basePage(section.title);
    let y = 690;
    const drawHeading = (continuation = false) => {
      page.drawText(continuation ? `${section.title} — continued` : section.title, { x: margin, y, size: continuation ? 19 : 24, font: serifBold, color: deepTeal });
      y -= continuation ? 32 : 42;
      if (!continuation) {
        page.drawRectangle({ x: margin, y: y - 114, width: contentWidth, height: 114, color: soft, borderColor: line, borderWidth: 0.7 });
        page.drawRectangle({ x: margin + 15, y: y - 55, width: 44, height: 44, color: teal });
        page.drawText(guide.label.slice(0, 2), { x: margin + 29, y: y - 39, size: 9, font: bold, color: rgb(1, 1, 1) });
        page.drawText(guide.label, { x: margin + 72, y: y - 28, size: 7, font: bold, color: teal, characterSpacing: 0.7 });
        y = drawWrapped(page, guide.summary, margin + 72, y - 45, { size: 9.2, maxWidth: 270, color: ink, lineHeight: 12 });
        guide.points.forEach((point, index) => {
          page.drawCircle({ x: 405, y: y + 35 - index * 20, size: 3, color: sea });
          drawWrapped(page, point, 416, y + 38 - index * 20, { size: 7.6, maxWidth: 130, color: muted, lineHeight: 9 });
        });
        y -= 36;
      }
    };
    drawHeading();

    const ensure = (height: number) => {
      if (y - height >= 70) return;
      page = basePage(section.title);
      y = 690;
      drawHeading(true);
    };
    let paragraph: string[] = [];
    const flushParagraph = () => {
      const value = paragraph.join(" ").trim();
      paragraph = [];
      if (!value) return;
      const lines = wrapText(value, regular, 9.6, contentWidth);
      ensure(lines.length * 14 + 12);
      lines.forEach((item) => { page.drawText(item, { x: margin, y, size: 9.6, font: regular, color: ink }); y -= 14; });
      y -= 8;
    };

    for (const raw of section.lines) {
      const value = raw.trim();
      if (!value) { flushParagraph(); continue; }
      if (value.startsWith("## ")) {
        flushParagraph();
        const heading = value.slice(3).trim();
        const headingLines = wrapText(heading, bold, 12.5, contentWidth);
        ensure(headingLines.length * 16 + 14);
        headingLines.forEach((item) => { page.drawText(item, { x: margin, y, size: 12.5, font: bold, color: teal }); y -= 16; });
        y -= 5;
        continue;
      }
      if (value.startsWith("- ") || /^\d+\.\s/.test(value)) {
        flushParagraph();
        const item = value.replace(/^(-|\d+\.)\s*/, "");
        const itemLines = wrapText(item, regular, 9.2, contentWidth - 22);
        ensure(itemLines.length * 13 + 8);
        page.drawCircle({ x: margin + 5, y: y + 3, size: 2.4, color: sea });
        itemLines.forEach((lineValue, index) => page.drawText(lineValue, { x: margin + 18, y: y - index * 13, size: 9.2, font: regular, color: ink }));
        y -= itemLines.length * 13 + 6;
        continue;
      }
      paragraph.push(value);
    }
    flushParagraph();
  }

  sections.forEach(addSectionPages);

  // Logs
  const logs = basePage("Health and Care Logs");
  logs.drawText("Health and Care Logs", { x: margin, y: 690, size: 24, font: serifBold, color: deepTeal });
  logs.drawText("FAMILY RECORDKEEPING", { x: margin, y: 668, size: 7, font: bold, color: teal, characterSpacing: 1 });
  drawWrapped(logs, `Use these pages to preserve an accurate history of ${puppyName}'s weights, medications, preventive care, and veterinary instructions.`, margin, 645, { size: 9.5, maxWidth: contentWidth, color: muted, lineHeight: 13 });
  function drawTable(page: PDFPage, title: string, headers: string[], top: number, rows: number) {
    page.drawText(title, { x: margin, y: top, size: 12, font: bold, color: teal });
    const yTop = top - 18;
    const tableHeight = 31 + rows * 28;
    const widths = [85, 130, 100, contentWidth - 315];
    page.drawRectangle({ x: margin, y: yTop - tableHeight, width: contentWidth, height: tableHeight, borderColor: line, borderWidth: 0.8 });
    page.drawRectangle({ x: margin, y: yTop - 31, width: contentWidth, height: 31, color: soft });
    let x = margin;
    headers.forEach((header, index) => {
      page.drawText(header.toUpperCase(), { x: x + 7, y: yTop - 19, size: 6.5, font: bold, color: deepTeal });
      x += widths[index];
      if (index < headers.length - 1) page.drawLine({ start: { x, y: yTop }, end: { x, y: yTop - tableHeight }, thickness: 0.6, color: line });
    });
    for (let row = 0; row <= rows; row += 1) {
      const y = yTop - 31 - row * 28;
      page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 0.6, color: line });
    }
  }
  drawTable(logs, "Weight Log", ["Date", "Weight", "Time / Scale", "Notes"], 605, 8);
  drawTable(logs, "Medication and Prevention Log", ["Date", "Product / Medication", "Dose", "Next Due / Notes"], 320, 7);

  const notes = basePage(`Notes and Records for ${puppyName}`);
  notes.drawText(`Notes and Records for ${puppyName}`, { x: margin, y: 690, size: 24, font: serifBold, color: deepTeal });
  notes.drawText("YOUR FAMILY NOTES", { x: margin, y: 668, size: 7, font: bold, color: teal, characterSpacing: 1 });
  drawWrapped(notes, "Use this page for veterinary instructions, insurance details, registration information, feeding observations, questions, receipts, and important reminders.", margin, 645, { size: 9.5, maxWidth: contentWidth, color: muted, lineHeight: 13 });
  for (let index = 0; index < 22; index += 1) {
    const y = 590 - index * 23;
    notes.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.55, color: line });
  }

  return pdf.save();
}
