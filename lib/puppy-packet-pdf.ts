import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TemplatesConfig } from "./template-defaults";

type Row = Record<string, unknown>;
type PacketInput = { puppy: Row; buyer: Row | null; litter: Row | null; dam: Row | null; sire: Row | null; updates: Row[]; events: Row[]; templates: TemplatesConfig; testCopy?: boolean };
type PacketSection = { title: string; lines: string[] };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const WIDTH = PAGE_W - MARGIN * 2;
const deep = rgb(0.025, 0.19, 0.23);
const teal = rgb(0.035, 0.45, 0.49);
const sea = rgb(0.09, 0.67, 0.63);
const ink = rgb(0.07, 0.2, 0.24);
const muted = rgb(0.36, 0.47, 0.49);
const line = rgb(0.81, 0.89, 0.88);
const soft = rgb(0.95, 0.98, 0.97);

const value = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const familyName = (buyer: Row | null) => [value(buyer, "first_name"), value(buyer, "last_name")].filter(Boolean).join(" ") || value(buyer, "email") || "Not assigned";
const clean = (input: unknown) => String(input ?? "")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, "-")
  .replace(/[\u2022]/g, "-")
  .replace(/[\u00A0]/g, " ")
  .replace(/[^\x20-\x7E\n]/g, "")
  .trim();
const formatDate = (input: unknown) => {
  const raw = String(input ?? "").trim();
  if (!raw) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${raw.slice(0, 10)}T12:00:00Z`));
  } catch {
    return clean(raw);
  }
};
const formatWeight = (input: unknown) => Number(input) > 0 ? `${Number(input).toFixed(Number(input) % 1 ? 2 : 0)} lb` : "Not recorded";

function replaceVariables(content: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((output, [key, replacement]) => output.replaceAll(`{{${key}}}`, replacement || "Not recorded"), content);
}

function splitSections(content: string) {
  const sections: PacketSection[] = [];
  let current: PacketSection | null = null;
  for (const raw of content.replaceAll("\r", "").split("\n")) {
    const lineValue = raw.trimEnd();
    if (lineValue.startsWith("# ")) {
      if (current) sections.push(current);
      current = { title: lineValue.slice(2).trim(), lines: [] };
      continue;
    }
    if (!current) current = { title: "Important Puppy Information", lines: [] };
    current.lines.push(lineValue);
  }
  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.lines.some((lineValue) => lineValue.trim()));
}

function wrap(input: string, font: PDFFont, size: number, maxWidth: number) {
  const words = clean(input).replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let active = "";
  for (const word of words) {
    const candidate = active ? `${active} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) active = candidate;
    else {
      if (active) lines.push(active);
      active = word;
    }
  }
  if (active) lines.push(active);
  return lines.length ? lines : [""];
}

function category(title: string) {
  if (/welcome|first 72|feeding|pup-lift|veterinarian|vaccines|parasites/i.test(title)) return "Getting Started & Health";
  if (/socialization|potty|crate|sleep|training|children|grooming|dental/i.test(title)) return "Daily Life & Training";
  return "Safety, Planning & Records";
}

function sectionSummary(title: string) {
  const lower = title.toLowerCase();
  if (/first 72/.test(lower)) return ["FIRST DAYS TOGETHER", "A calm and predictable beginning supports eating, sleep, bathroom routines, and bonding."];
  if (/feeding/.test(lower)) return ["DAILY NUTRITION", "Small measured meals and direct observation help protect a young Chihuahua's energy and growth."];
  if (/pup-lift|hypoglycemia/.test(lower)) return ["EMERGENCY READINESS", "Toy-breed puppies can decline quickly when blood sugar drops, so preparation and prompt action matter."];
  if (/veterinarian/.test(lower)) return ["WHEN TO SEEK CARE", "Use this page to distinguish emergency warning signs from concerns requiring a same-day veterinary call."];
  if (/vaccines|parasites|fleas|ticks|heartworms/.test(lower)) return ["PREVENTIVE HEALTH", "Accurate records and age-appropriate veterinary prevention help protect a developing puppy."];
  if (/socialization|potty|crate|sleep|training/.test(lower)) return ["CONFIDENCE & ROUTINE", "Positive practice and consistent routines help a Chihuahua become secure, responsive, and comfortable at home."];
  if (/children|visitors|other pets/.test(lower)) return ["SAFE INTERACTIONS", "Tiny puppies require direct adult supervision around children, guests, and larger animals."];
  if (/grooming|dental/.test(lower)) return ["LIFELONG CARE", "Gentle early handling makes grooming, nail care, dental care, and routine examinations easier throughout life."];
  if (/safety|poison|harness|travel/.test(lower)) return ["SAFETY FIRST", "A Chihuahua's size creates special risks from falls, escape, household hazards, and unsecured travel."];
  if (/growth|insurance|financial/.test(lower)) return ["PLANNING AHEAD", "Weight records, insurance information, and financial preparation support timely care decisions."];
  if (/emergency plan|go-home checklist/.test(lower)) return ["READY BEFORE NEEDED", "A written plan helps every caregiver respond consistently when something changes."];
  if (/welcome home/.test(lower)) return ["WELCOME HOME", "A personal introduction to the care plan, records, and support prepared for this family."];
  return ["PERSONALIZED REFERENCE", "A practical reference page prepared specifically for this puppy and family."];
}

export async function renderPuppyPacketPdf(input: PacketInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const puppy = value(input.puppy, "name") || "Your Puppy";
  const family = familyName(input.buyer);
  const litter = value(input.litter, "name") || "Not recorded";
  const dam = value(input.dam, "registered_name") || value(input.dam, "name") || "Not recorded";
  const sire = value(input.sire, "registered_name") || value(input.sire, "name") || "Not recorded";
  const location = [value(input.buyer, "city"), value(input.buyer, "state"), value(input.buyer, "postal_code")].filter(Boolean).join(", ") || "Not recorded";
  const packetDate = formatDate(new Date().toISOString());
  const variables: Record<string, string> = {
    puppy_name: puppy,
    buyer_name: family,
    family_name: family,
    birth_date: formatDate(input.puppy.birth_date),
    sex: value(input.puppy, "sex") || "Not recorded",
    color: value(input.puppy, "color") || "Not recorded",
    litter_name: litter,
    dam_name: dam,
    sire_name: sire,
    birth_weight: formatWeight(input.puppy.birth_weight),
    current_weight: formatWeight(input.puppy.current_weight),
    buyer_phone: value(input.buyer, "phone") || "Not recorded",
    buyer_email: value(input.buyer, "email") || "Not recorded",
    buyer_location: location,
    packet_date: packetDate,
    business_name: "Southwest Virginia Chihuahua",
    business_website: "swvachihuahua.com",
    pup_lift_website: "pup-lift.com",
    pup_lift_phone: "1-715-888-9526",
  };
  const sections = splitSections(replaceVariables(input.templates.documents.puppy_packet.content, variables));
  const tocItems = ["Personalized Puppy and Family Record", ...sections.map((section) => section.title), "Health and Care Logs", `Notes and Records for ${puppy}`];

  pdf.setTitle(`${puppy}'s Personalized Puppy Care Packet`);
  pdf.setAuthor("Southwest Virginia Chihuahua");
  pdf.setSubject(`${puppy} - ${family}`);
  pdf.setCreator("SWVAOS");
  pdf.setCreationDate(new Date());

  let pageNo = 0;
  function addBasePage(runningTitle: string) {
    pageNo += 1;
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: PAGE_H - 14, width: PAGE_W, height: 14, color: teal });
    page.drawText("SOUTHWEST VIRGINIA CHIHUAHUA", { x: MARGIN, y: PAGE_H - 36, size: 7, font: bold, color: deep });
    page.drawText(clean(runningTitle).toUpperCase().slice(0, 76), { x: MARGIN, y: PAGE_H - 49, size: 6.5, font: regular, color: muted });
    page.drawLine({ start: { x: MARGIN, y: 45 }, end: { x: PAGE_W - MARGIN, y: 45 }, thickness: 0.6, color: line });
    page.drawText(clean(`Personalized for ${family} and ${puppy}`), { x: MARGIN, y: 29, size: 6.8, font: regular, color: muted });
    const footer = `Page ${pageNo}`;
    page.drawText(footer, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(footer, 6.8), y: 29, size: 6.8, font: regular, color: muted });
    if (input.testCopy) page.drawText("TEST COPY", { x: PAGE_W - MARGIN - bold.widthOfTextAtSize("TEST COPY", 8), y: PAGE_H - 36, size: 8, font: bold, color: rgb(0.72, 0.2, 0.18) });
    return page;
  }

  function drawWrapped(page: PDFPage, inputText: string, x: number, y: number, options: { font?: PDFFont; size?: number; maxWidth?: number; color?: ReturnType<typeof rgb>; lineHeight?: number } = {}) {
    const font = options.font || regular;
    const size = options.size || 10;
    const maxWidth = options.maxWidth || WIDTH;
    const lineHeight = options.lineHeight || size + 4;
    const lines = wrap(inputText, font, size, maxWidth);
    lines.forEach((lineText, index) => page.drawText(lineText, { x, y: y - index * lineHeight, size, font, color: options.color || ink }));
    return y - lines.length * lineHeight;
  }

  pageNo += 1;
  const cover = pdf.addPage([PAGE_W, PAGE_H]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: deep });
  cover.drawRectangle({ x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48, borderColor: rgb(0.32, 0.72, 0.7), borderWidth: 1 });
  cover.drawCircle({ x: PAGE_W - 70, y: PAGE_H - 70, size: 120, color: rgb(0.04, 0.34, 0.38), opacity: 0.7 });
  cover.drawCircle({ x: 40, y: 90, size: 95, color: rgb(0.44, 0.36, 0.18), opacity: 0.35 });
  cover.drawText("SOUTHWEST VIRGINIA CHIHUAHUA", { x: 52, y: 742, size: 8, font: bold, color: rgb(0.7, 0.95, 0.92) });
  cover.drawText("PERSONALIZED GO-HOME COLLECTION", { x: 52, y: 728, size: 6.7, font: regular, color: rgb(0.72, 0.83, 0.83) });
  cover.drawRectangle({ x: 52, y: 588, width: 72, height: 72, color: rgb(1, 1, 1), opacity: 0.1, borderColor: rgb(0.45, 0.8, 0.77), borderWidth: 1 });
  const initials = puppy.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SW";
  cover.drawText(initials, { x: 88 - serifBold.widthOfTextAtSize(initials, 25) / 2, y: 611, size: 25, font: serifBold, color: rgb(1, 1, 1) });
  cover.drawText(clean(`CREATED ESPECIALLY FOR ${family.toUpperCase()}`), { x: 52, y: 554, size: 7, font: bold, color: rgb(0.55, 0.9, 0.86) });
  cover.drawText(clean(puppy), { x: 52, y: 496, size: 42, font: serifBold, color: rgb(1, 1, 1) });
  cover.drawText("Puppy Care Binder", { x: 52, y: 458, size: 27, font: serif, color: rgb(0.82, 0.96, 0.94) });
  drawWrapped(cover, "A personal collection of care guidance, emergency preparation, puppy records, family resources, and practical support for the first days home and the years ahead.", 52, 422, { size: 11, maxWidth: 330, color: rgb(0.78, 0.87, 0.87), lineHeight: 16 });
  const coverFields: Array<[string, string]> = [["PUPPY", puppy], ["FAMILY", family], ["DATE OF BIRTH", formatDate(input.puppy.birth_date)], ["PACKET DATE", packetDate]];
  coverFields.forEach(([label, fieldValue], index) => {
    const x = 390;
    const y = 570 - index * 74;
    cover.drawRectangle({ x, y, width: 165, height: 57, color: rgb(1, 1, 1), opacity: 0.08, borderColor: rgb(0.35, 0.66, 0.65), borderWidth: 0.7 });
    cover.drawText(label, { x: x + 12, y: y + 39, size: 6.5, font: bold, color: rgb(0.55, 0.9, 0.86) });
    drawWrapped(cover, fieldValue, x + 12, y + 22, { size: 10, font: bold, maxWidth: 141, color: rgb(1, 1, 1), lineHeight: 11 });
  });
  const features = [["01", "EVERYDAY CARE", "Feeding, routines, training, grooming, and settling in."], ["02", "HEALTH & SAFETY", "Pup-Lift readiness, prevention, warning signs, and emergencies."], ["03", "PERSONAL RECORDS", "Weights, care history, important documents, and family notes."]];
  features.forEach(([num, label, description], index) => {
    const x = 52 + index * 170;
    cover.drawRectangle({ x, y: 120, width: 155, height: 96, color: rgb(1, 1, 1), opacity: 0.07, borderColor: rgb(0.35, 0.66, 0.65), borderWidth: 0.6 });
    cover.drawText(num, { x: x + 12, y: 190, size: 8, font: bold, color: rgb(0.55, 0.9, 0.86) });
    cover.drawText(label, { x: x + 12, y: 170, size: 7.5, font: bold, color: rgb(1, 1, 1) });
    drawWrapped(cover, description, x + 12, 151, { size: 7.3, maxWidth: 131, color: rgb(0.75, 0.85, 0.85), lineHeight: 10 });
  });
  cover.drawText("Marion, Virginia | swvachihuahua.com | Pup-Lift: pup-lift.com | 1-715-888-9526", { x: 52, y: 62, size: 7, font: regular, color: rgb(0.72, 0.83, 0.83) });
  if (input.testCopy) cover.drawText("TEST COPY", { x: PAGE_W - 52 - bold.widthOfTextAtSize("TEST COPY", 11), y: 742, size: 11, font: bold, color: rgb(1, 0.68, 0.62) });

  const toc = addBasePage("Table of Contents");
  toc.drawRectangle({ x: MARGIN, y: 620, width: WIDTH, height: 102, color: deep });
  toc.drawText("YOUR PERSONALIZED GUIDE", { x: MARGIN + 20, y: 693, size: 7, font: bold, color: rgb(0.58, 0.92, 0.88) });
  toc.drawText(clean(`Inside ${puppy}'s Binder`), { x: MARGIN + 20, y: 659, size: 25, font: serifBold, color: rgb(1, 1, 1) });
  drawWrapped(toc, `Everything is organized so ${family} can quickly find care instructions, safety information, and records.`, MARGIN + 20, 637, { size: 8.5, maxWidth: 375, color: rgb(0.78, 0.88, 0.88), lineHeight: 11 });
  toc.drawText(String(tocItems.length), { x: 500, y: 665, size: 28, font: serifBold, color: rgb(1, 1, 1) });
  toc.drawText("SECTIONS", { x: 494, y: 649, size: 6.5, font: bold, color: rgb(0.58, 0.92, 0.88) });
  const grouped = new Map<string, string[]>();
  tocItems.forEach((item) => { const groupName = category(item); grouped.set(groupName, [...(grouped.get(groupName) || []), item]); });
  let groupIndex = 0;
  for (const [groupName, items] of grouped.entries()) {
    const column = groupIndex % 2;
    const row = Math.floor(groupIndex / 2);
    const x = MARGIN + column * 264;
    const top = 590 - row * 238;
    toc.drawRectangle({ x, y: top - 214, width: 250, height: 214, color: soft, borderColor: line, borderWidth: 0.7 });
    toc.drawRectangle({ x: x + 12, y: top - 37, width: 30, height: 30, color: teal });
    toc.drawText(`0${groupIndex + 1}`, { x: x + 20, y: top - 27, size: 8, font: bold, color: rgb(1, 1, 1) });
    toc.drawText(clean(groupName), { x: x + 52, y: top - 26, size: 10.5, font: bold, color: deep });
    items.slice(0, 12).forEach((item, index) => {
      const y = top - 62 - index * 14;
      toc.drawText(String(index + 1).padStart(2, "0"), { x: x + 14, y, size: 6.8, font: bold, color: teal });
      drawWrapped(toc, item, x + 42, y, { size: 7.5, maxWidth: 192, color: ink, lineHeight: 9 });
    });
    groupIndex += 1;
  }

  const record = addBasePage("Personalized Puppy and Family Record");
  record.drawText("Personalized Puppy and Family Record", { x: MARGIN, y: 690, size: 24, font: serifBold, color: deep });
  record.drawText("AT-A-GLANCE PROFILE", { x: MARGIN, y: 669, size: 7, font: bold, color: teal });
  const fields: Array<[string, string]> = [
    ["Puppy name", puppy], ["Family", family], ["Date of birth", formatDate(input.puppy.birth_date)], ["Sex", value(input.puppy, "sex") || "Not recorded"],
    ["Color", value(input.puppy, "color") || "Not recorded"], ["Status", value(input.puppy, "status") || "Not recorded"], ["Litter", litter], ["Birth weight", formatWeight(input.puppy.birth_weight)],
    ["Dam", dam], ["Sire", sire], ["Current weight", formatWeight(input.puppy.current_weight)], ["Buyer phone", value(input.buyer, "phone") || "Not recorded"],
    ["Buyer email", value(input.buyer, "email") || "Not recorded"], ["Buyer location", location],
  ];
  fields.forEach(([label, fieldValue], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + column * 264;
    const y = 620 - row * 61;
    record.drawRectangle({ x, y, width: 250, height: 49, color: soft, borderColor: line, borderWidth: 0.6 });
    record.drawText(label.toUpperCase(), { x: x + 11, y: y + 32, size: 6, font: bold, color: muted });
    drawWrapped(record, fieldValue, x + 11, y + 17, { size: 8.5, font: bold, maxWidth: 228, color: ink, lineHeight: 9.5 });
  });

  function renderSection(section: PacketSection) {
    let page = addBasePage(section.title);
    let y = 690;
    const [label, summary] = sectionSummary(section.title);
    const heading = (continued = false) => {
      page.drawText(clean(continued ? `${section.title} - continued` : section.title), { x: MARGIN, y, size: continued ? 19 : 24, font: serifBold, color: deep });
      y -= continued ? 32 : 42;
      if (!continued) {
        page.drawRectangle({ x: MARGIN, y: y - 92, width: WIDTH, height: 92, color: soft, borderColor: line, borderWidth: 0.7 });
        page.drawRectangle({ x: MARGIN + 15, y: y - 56, width: 44, height: 44, color: teal });
        page.drawText(label.slice(0, 2), { x: MARGIN + 29, y: y - 40, size: 9, font: bold, color: rgb(1, 1, 1) });
        page.drawText(label, { x: MARGIN + 72, y: y - 28, size: 7, font: bold, color: teal });
        drawWrapped(page, summary, MARGIN + 72, y - 46, { size: 9.2, maxWidth: 405, color: ink, lineHeight: 12 });
        y -= 112;
      }
    };
    heading();
    const ensure = (height: number) => {
      if (y - height >= 70) return;
      page = addBasePage(section.title);
      y = 690;
      heading(true);
    };
    let paragraph: string[] = [];
    const flushParagraph = () => {
      const paragraphText = paragraph.join(" ").trim();
      paragraph = [];
      if (!paragraphText) return;
      const lines = wrap(paragraphText, regular, 9.6, WIDTH);
      ensure(lines.length * 14 + 10);
      lines.forEach((lineText) => { page.drawText(lineText, { x: MARGIN, y, size: 9.6, font: regular, color: ink }); y -= 14; });
      y -= 8;
    };
    for (const rawLine of section.lines) {
      const lineText = rawLine.trim();
      if (!lineText) { flushParagraph(); continue; }
      if (lineText.startsWith("## ")) {
        flushParagraph();
        const subheading = clean(lineText.slice(3));
        const lines = wrap(subheading, bold, 12.5, WIDTH);
        ensure(lines.length * 16 + 12);
        lines.forEach((subLine) => { page.drawText(subLine, { x: MARGIN, y, size: 12.5, font: bold, color: teal }); y -= 16; });
        y -= 5;
        continue;
      }
      if (lineText.startsWith("- ") || /^\d+\.\s/.test(lineText)) {
        flushParagraph();
        const item = lineText.replace(/^(-|\d+\.)\s*/, "");
        const lines = wrap(item, regular, 9.2, WIDTH - 22);
        ensure(lines.length * 13 + 8);
        page.drawCircle({ x: MARGIN + 5, y: y + 3, size: 2.4, color: sea });
        lines.forEach((itemLine, index) => page.drawText(itemLine, { x: MARGIN + 18, y: y - index * 13, size: 9.2, font: regular, color: ink }));
        y -= lines.length * 13 + 6;
        continue;
      }
      paragraph.push(lineText);
    }
    flushParagraph();
  }

  sections.forEach(renderSection);

  const logs = addBasePage("Health and Care Logs");
  logs.drawText("Health and Care Logs", { x: MARGIN, y: 690, size: 24, font: serifBold, color: deep });
  logs.drawText("FAMILY RECORDKEEPING", { x: MARGIN, y: 668, size: 7, font: bold, color: teal });
  drawWrapped(logs, `Use these pages to preserve an accurate history of ${puppy}'s weights, medications, preventive care, and veterinary instructions.`, MARGIN, 645, { size: 9.5, color: muted, lineHeight: 13 });
  function table(page: PDFPage, title: string, headers: string[], top: number, rows: number) {
    page.drawText(title, { x: MARGIN, y: top, size: 12, font: bold, color: teal });
    const tableTop = top - 18;
    const tableHeight = 31 + rows * 28;
    const widths = [85, 130, 100, WIDTH - 315];
    page.drawRectangle({ x: MARGIN, y: tableTop - tableHeight, width: WIDTH, height: tableHeight, borderColor: line, borderWidth: 0.8 });
    page.drawRectangle({ x: MARGIN, y: tableTop - 31, width: WIDTH, height: 31, color: soft });
    let x = MARGIN;
    headers.forEach((header, index) => {
      page.drawText(header.toUpperCase(), { x: x + 7, y: tableTop - 19, size: 6.5, font: bold, color: deep });
      x += widths[index];
      if (index < headers.length - 1) page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableTop - tableHeight }, thickness: 0.6, color: line });
    });
    for (let row = 0; row <= rows; row += 1) {
      const lineY = tableTop - 31 - row * 28;
      page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + WIDTH, y: lineY }, thickness: 0.6, color: line });
    }
  }
  table(logs, "Weight Log", ["Date", "Weight", "Time / Scale", "Notes"], 605, 8);
  table(logs, "Medication and Prevention Log", ["Date", "Product / Medication", "Dose", "Next Due / Notes"], 320, 7);

  const notes = addBasePage(`Notes and Records for ${puppy}`);
  notes.drawText(clean(`Notes and Records for ${puppy}`), { x: MARGIN, y: 690, size: 24, font: serifBold, color: deep });
  notes.drawText("YOUR FAMILY NOTES", { x: MARGIN, y: 668, size: 7, font: bold, color: teal });
  drawWrapped(notes, "Use this page for veterinary instructions, insurance details, registration information, feeding observations, questions, receipts, and important reminders.", MARGIN, 645, { size: 9.5, color: muted, lineHeight: 13 });
  for (let index = 0; index < 22; index += 1) {
    const y = 590 - index * 23;
    notes.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.55, color: line });
  }

  return pdf.save();
}
