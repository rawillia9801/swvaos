import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseContractTerm } from "./contract-format.ts";
import type { CombinedAgreementDetails } from "./combined-agreement.ts";

export type ContractKind = "bill_of_sale" | "health_guarantee";

export type ContractSignature = {
  signerName: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  auditHash: string;
  electronicConsent: true;
  healthAcknowledged?: true;
};

export type ContractSnapshot = {
  version: 1;
  groupId: string;
  kind: ContractKind;
  status: "pending" | "signed";
  createdAt: string;
  buyerId: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerLocation: string;
  puppyId: number;
  puppyName: string;
  puppySex: string;
  puppyColor: string;
  puppyBirthDate: string;
  litterName: string;
  damName: string;
  sireName: string;
  salePriceCents: number;
  depositCents: number;
  balanceCents: number;
  balanceDueDate: string;
  transferDate: string;
  sellerName: string;
  sellerLocation: string;
  microToy?: boolean;
  title: string;
  introduction: string;
  terms: string[];
  agreementDetails?: CombinedAgreementDetails;
  signature?: ContractSignature;
};

export const CONTRACT_NOTES_PREFIX = "SWVAOS_CONTRACT_V1\n";

export function contractNotes(snapshot: ContractSnapshot) {
  return `${CONTRACT_NOTES_PREFIX}${JSON.stringify(snapshot)}`;
}

export function parseContractNotes(notes: unknown) {
  if (typeof notes !== "string" || !notes.startsWith(CONTRACT_NOTES_PREFIX)) return null;
  try {
    const snapshot = JSON.parse(notes.slice(CONTRACT_NOTES_PREFIX.length)) as ContractSnapshot;
    if (snapshot.version !== 1 || !snapshot.kind || !snapshot.buyerId || !snapshot.puppyId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : "Not specified";
const clean = (value: unknown) => String(value ?? "").trim();
const yesNo = (value: boolean | undefined) => value === true ? "Yes" : value === false ? "No" : "";

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }

    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const candidate = `${fragment}${character}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) fragment = candidate;
      else {
        if (fragment) lines.push(fragment);
        fragment = character;
      }
    }
    line = fragment;
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type PageState = { page: PDFPage; y: number; pageNumber: number };

export async function renderContractPdf(snapshot: ContractSnapshot) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(snapshot.title);
  pdf.setAuthor(snapshot.sellerName);
  pdf.setSubject(`${snapshot.puppyName} - ${snapshot.buyerName}`);
  pdf.setCreator("SWVAOS");
  pdf.setCreationDate(new Date(snapshot.createdAt));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  const ink = rgb(0.055, 0.19, 0.25);
  const muted = rgb(0.34, 0.44, 0.47);
  const accent = rgb(0.02, 0.62, 0.7);
  const line = rgb(0.79, 0.87, 0.87);
  const soft = rgb(0.95, 0.98, 0.98);

  function newPage(pageNumber: number): PageState {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 15, width: pageWidth, height: 15, color: accent });
    page.drawText(snapshot.sellerName, { x: margin, y: pageHeight - 39, size: 8, font: bold, color: ink });

    const runningTitle = wrapText(snapshot.title.toUpperCase(), regular, 6.6, contentWidth).slice(0, 2);
    runningTitle.forEach((titleLine, index) => {
      page.drawText(titleLine, { x: margin, y: pageHeight - 51 - index * 8, size: 6.6, font: regular, color: muted });
    });

    page.drawLine({ start: { x: margin, y: 61 }, end: { x: pageWidth - margin, y: 61 }, thickness: 0.6, color: line });
    page.drawText(`Document ${snapshot.groupId.slice(0, 8).toUpperCase()} | Page ${pageNumber}`, { x: margin, y: 44, size: 7, font: regular, color: muted });
    const statusText = snapshot.status === "signed" ? "SIGNED COPY" : "AWAITING SIGNATURE";
    const statusWidth = bold.widthOfTextAtSize(statusText, 7);
    page.drawText(statusText, { x: pageWidth - margin - statusWidth, y: 44, size: 7, font: bold, color: snapshot.status === "signed" ? rgb(0.08, 0.5, 0.35) : muted });
    return { page, y: pageHeight - 91, pageNumber };
  }

  let state = newPage(1);
  const ensure = (height: number) => { if (state.y - height < 78) state = newPage(state.pageNumber + 1); };
  const textBlock = (text: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) => {
    const size = options.size ?? 9.5;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const lines = wrapText(text, font, size, contentWidth - indent);
    const height = lines.length * (size + 4) + (options.gap ?? 6);
    ensure(height);
    for (const value of lines) {
      state.page.drawText(value, { x: margin + indent, y: state.y, size, font, color: options.color ?? ink });
      state.y -= size + 4;
    }
    state.y -= options.gap ?? 6;
  };
  const section = (title: string) => {
    const titleLines = wrapText(title.toUpperCase(), bold, 8, contentWidth);
    const height = titleLines.length * 10 + 8;
    ensure(height);
    titleLines.forEach((titleLine, index) => {
      state.page.drawText(titleLine, { x: margin, y: state.y - index * 10, size: 8, font: bold, color: accent });
    });
    state.y -= height;
  };
  const fact = (label: string, value: string, column: 0 | 1, rowY: number) => {
    const columnGap = 16;
    const columnWidth = (contentWidth - columnGap) / 2;
    const x = margin + column * (columnWidth + columnGap);
    const labelLines = wrapText(label.toUpperCase(), bold, 6.5, columnWidth).slice(0, 2);
    labelLines.forEach((item, index) => state.page.drawText(item, { x, y: rowY - index * 8, size: 6.5, font: bold, color: muted }));
    const valueY = rowY - labelLines.length * 8 - 5;
    const lines = wrapText(value || "Not recorded", regular, 8.6, columnWidth).slice(0, 3);
    lines.forEach((item, index) => state.page.drawText(item, { x, y: valueY - index * 11, size: 8.6, font: regular, color: ink }));
  };
  const detailSection = (title: string, entries: Array<[string, unknown]>) => {
    const visible = entries.map(([label, value]) => [label, clean(value)] as const).filter(([, value]) => value);
    if (!visible.length) return;
    section(title);

    const horizontalPadding = 12;
    const usableWidth = contentWidth - horizontalPadding * 2;
    const labelSize = 6.6;
    const valueSize = 8.8;
    const labelLineHeight = 8.5;
    const valueLineHeight = 11;
    const labelValueGap = 5;
    const verticalPadding = 10;

    for (const [label, value] of visible) {
      const labelLines = wrapText(label.toUpperCase(), bold, labelSize, usableWidth);
      const valueLines = wrapText(value, regular, valueSize, usableWidth);
      const labelHeight = Math.max(1, labelLines.length) * labelLineHeight;
      const valueHeight = Math.max(1, valueLines.length) * valueLineHeight;
      const rowHeight = verticalPadding * 2 + labelHeight + labelValueGap + valueHeight;
      ensure(rowHeight + 3);

      const rowTop = state.y + 7;
      const rowBottom = rowTop - rowHeight;
      state.page.drawRectangle({ x: margin, y: rowBottom, width: contentWidth, height: rowHeight, color: soft });

      let cursorY = rowTop - verticalPadding - labelSize;
      labelLines.forEach((item) => {
        state.page.drawText(item, { x: margin + horizontalPadding, y: cursorY, size: labelSize, font: bold, color: muted });
        cursorY -= labelLineHeight;
      });

      cursorY -= labelValueGap;
      valueLines.forEach((item) => {
        state.page.drawText(item, { x: margin + horizontalPadding, y: cursorY, size: valueSize, font: regular, color: ink });
        cursorY -= valueLineHeight;
      });

      state.y = rowBottom - 3;
    }
    state.y -= 5;
  };

  const titleLines = wrapText(snapshot.title, bold, 20, contentWidth);
  const titleHeight = titleLines.length * 24 + 8;
  ensure(titleHeight);
  titleLines.forEach((titleLine, index) => {
    state.page.drawText(titleLine, { x: margin, y: state.y - index * 24, size: 20, font: bold, color: ink });
  });
  state.y -= titleHeight;
  textBlock(snapshot.introduction, { size: 10, color: muted, gap: 14 });
  const details = snapshot.agreementDetails;
  const combinedAgreement = Boolean(details) || /bill of sale.*health guarantee/i.test(snapshot.title);

  if (combinedAgreement && details) {
    detailSection("Transaction summary", [
      ["Agreement number", details.agreementNumber || snapshot.groupId],
      ["Agreement date", details.agreementDate || snapshot.createdAt.slice(0, 10)],
      ["Scheduled transfer date", snapshot.transferDate ? date(snapshot.transferDate) : ""],
      ["Puppy name / litter ID", [snapshot.puppyName, details.litterInternalId || snapshot.litterName].filter(Boolean).join(" / ")],
      ["Buyer legal name", snapshot.buyerName], ["Co-Buyer", details.coBuyerName], ["Total puppy purchase price", money(snapshot.salePriceCents)],
    ]);
    detailSection("Buyer information", [
      ["Buyer legal name", snapshot.buyerName], ["Co-Buyer legal name", details.coBuyerName], ["Street address", details.buyerStreetAddress],
      ["City / State / ZIP", details.buyerCityStateZip || snapshot.buyerLocation], ["Primary phone", snapshot.buyerPhone], ["Email", snapshot.buyerEmail], ["Emergency contact", details.buyerEmergencyContact],
    ]);
    detailSection("Puppy description and animal history", [
      ["Registered / call name", snapshot.puppyName], ["Breed", "Chihuahua"], ["Sex", snapshot.puppySex], ["Date of birth", date(snapshot.puppyBirthDate)],
      ["Age at transfer", details.puppyAgeAtTransfer], ["Color / markings", snapshot.puppyColor], ["Coat type", details.puppyCoatType], ["Current weight", details.puppyCurrentWeight],
      ["Estimated adult size (not guaranteed)", details.estimatedAdultSize], ["Microchip number", details.microchipNumber], ["Registry", details.registry],
      ["Registration number / pending status", details.registrationNumber], ["Litter number / internal ID", details.litterInternalId || snapshot.litterName],
      ["Very small / Micro-Toy designation", yesNo(snapshot.microToy)], ["Known conditions, medications, feeding needs, or disclosures", details.knownConditions || details.specialFeedingInstructions],
    ]);
    detailSection("Breeder and parent information", [
      ["Breeder", `${snapshot.sellerName}, ${snapshot.sellerLocation}`], ["Bred by Seller", yesNo(details.bredBySeller)], ["Person from whom Seller obtained puppy", details.acquiredFrom],
      ["Sire", snapshot.sireName], ["Sire registration number", details.sireRegistrationNumber], ["Dam", snapshot.damName], ["Dam registration number", details.damRegistrationNumber],
    ]);
    detailSection("Documents and disclosures provided at transfer", [
      ["Health record / vaccine labels", details.healthRecordStatus], ["Puppy care and feeding guide", details.careGuideStatus], ["Registration documents", details.registrationDocumentsStatus],
      ["Microchip registration instructions", details.microchipInstructionsStatus], ["Complimentary insurance information", details.insuranceInformationStatus],
      ["Known-condition disclosure", details.knownConditionDisclosureStatus], ["Transport / transfer instructions", details.transportInstructionsStatus], ["Attachments included", details.attachments],
    ]);
  } else {
    section("Buyer and puppy");
    ensure(138);
    const facts = [
      ["Buyer", snapshot.buyerName], ["Puppy", snapshot.puppyName], ["Buyer contact", [snapshot.buyerPhone, snapshot.buyerEmail].filter(Boolean).join(" / ")],
      ["Sex and color", [snapshot.puppySex, snapshot.puppyColor].filter(Boolean).join(" / ")], ["Buyer location", snapshot.buyerLocation], ["Birth date", date(snapshot.puppyBirthDate)],
      ["Litter", snapshot.litterName], ["Parents", [snapshot.damName && `Dam: ${snapshot.damName}`, snapshot.sireName && `Sire: ${snapshot.sireName}`].filter(Boolean).join(" / ")],
    ];
    facts.forEach(([label, value], index) => fact(label, value, index % 2 as 0 | 1, state.y - Math.floor(index / 2) * 34));
    state.y -= 138;
  }

  if (snapshot.kind === "bill_of_sale" || combinedAgreement) {
    if (details) {
      const salesTax = Number(details.salesTaxCents ?? 0), transport = Number(details.transportCents ?? 0), other = Number(details.otherChargesCents ?? 0);
      const reservation = Number(details.reservationCreditCents ?? 0), additional = Number(details.additionalPaymentsCents ?? 0);
      detailSection("Sale and payment summary", [
        ["Cash price of puppy", money(snapshot.salePriceCents)], ["Virginia sales tax, if applicable", money(salesTax)], ["Transport / delivery", money(transport)],
        ["Other disclosed purchase charges", money(other)], ["Total sale price", money(snapshot.salePriceCents + salesTax + transport + other)],
        ["Deposit / reservation credit", money(reservation)], ["Additional payments received", money(additional)], ["Total payments recorded", money(snapshot.depositCents)],
        ["Balance due before transfer", money(snapshot.balanceCents)], ["Balance due date", date(snapshot.balanceDueDate)], ["Payment method", details.paymentMethod],
      ]);
    } else {
      section("Sale and payment summary"); ensure(102);
      const saleFacts = [["Purchase price", money(snapshot.salePriceCents)], ["Deposit recorded", money(snapshot.depositCents)], ["Balance", money(snapshot.balanceCents)], ["Balance due", date(snapshot.balanceDueDate)], ["Transfer date", date(snapshot.transferDate)], ["Seller", snapshot.sellerName]];
      saleFacts.forEach(([label, value], index) => fact(label, value, index % 2 as 0 | 1, state.y - Math.floor(index / 2) * 34));
      state.y -= 102;
    }
  }

  if (details) {
    detailSection("Transfer record", [["Transfer method", details.transferMethod], ["Transfer location", details.transferLocation], ["Transfer date", date(snapshot.transferDate)], ["Transfer time", details.transferTime], ["Person receiving puppy", details.recipientName]]);
    detailSection("Transfer-date health disclosure checklist", [
      ["Appetite and feeding at transfer", details.appetiteAtTransfer], ["Stool / parasite history", details.stoolParasiteHistory], ["Respiratory findings", details.respiratoryFindings],
      ["Skin / coat findings", details.skinCoatFindings], ["Bite / teeth / hernia findings", details.biteTeethHerniaFindings], ["Patella / gait findings", details.patellaGaitFindings],
      ["Medication or supplement", details.medicationSupplement], ["Other material health disclosure", details.otherHealthDisclosure], ["Special feeding instructions", details.specialFeedingInstructions],
    ]);
    detailSection("Buyer's first veterinary examination", [["Veterinary clinic", details.firstVetClinic], ["Veterinarian", details.firstVetName], ["Appointment date / time", details.firstVetAppointment], ["Clinic phone", details.firstVetPhone], ["Exam findings attached / reported", details.firstVetFindingsStatus]]);
    detailSection("Registration, breeding rights, insurance, and notices", [
      ["Registration status", details.registrationStatus], ["Registration type", details.registrationType], ["Registry promised", details.registryPromised], ["Documents expected by", details.registrationDueDate],
      ["Spay / neuter term", details.spayNeuterTerm], ["Separate breeding addendum", details.breedingAddendum], ["Complimentary insurance", details.insuranceSelection],
      ["Buyer's preferred written-notice method", details.buyerNoticeMethod], ["Seller's authorized representative", details.sellerRepresentative],
    ]);
  }

  section("Agreement terms");
  let clauseNumber = 0;
  snapshot.terms.forEach((term) => {
    const parsed = parseContractTerm(term);
    if (parsed.kind === "section") { section(parsed.text); return; }
    if (parsed.kind === "notice") { parsed.text.split(/\n\s*\n/).filter(Boolean).forEach((paragraph) => textBlock(paragraph, { size: 10, font: bold, indent: 2, gap: 9 })); return; }
    clauseNumber += 1;
    textBlock(`${clauseNumber}. ${parsed.text}`, { size: 9.2, indent: 2, gap: 7 });
  });

  ensure(snapshot.signature ? 160 : 78);
  section("Electronic signature");
  if (snapshot.signature) {
    textBlock(`Signed electronically by ${snapshot.signature.signerName} on ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(snapshot.signature.signedAt))}.`, { font: bold, size: 10, gap: 4 });
    textBlock("The signer separately consented to conduct this transaction electronically and confirmed that the typed legal name represents the signer's signature on this exact document.", { size: 8.5, color: muted, gap: 5 });
    if (snapshot.kind === "health_guarantee" && snapshot.signature.healthAcknowledged) textBlock("The signer specifically acknowledged the one-year health terms, care responsibilities, voluntary limitations, applicable toy-size provisions, and Virginia Consumer Notice.", { size: 8.5, color: muted, gap: 5 });
    if (details?.sellerRepresentative) textBlock(`Seller issuance: ${details.sellerRepresentative} prepared and issued this Agreement through the authenticated SWVAOS document workflow.`, { size: 8.5, color: muted, gap: 5 });
    textBlock(`Audit record: ${snapshot.signature.auditHash} | Network: ${snapshot.signature.ipAddress || "Unavailable"}`, { font: italic, size: 7, color: muted, gap: 2 });
  } else {
    textBlock("This document is awaiting the Buyer's electronic signature in the secure puppy portal.", { font: italic, size: 9.5, color: muted });
    if (details?.sellerRepresentative) textBlock(`Prepared and issued through SWVAOS by ${details.sellerRepresentative}.`, { size: 8.5, color: muted });
  }

  return pdf.save();
}
