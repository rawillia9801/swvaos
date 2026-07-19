import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ContractKind = "bill_of_sale" | "health_guarantee";

export type ContractSignature = {
  signerName: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  auditHash: string;
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
  title: string;
  introduction: string;
  terms: string[];
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
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

  function newPage(pageNumber: number): PageState {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 15, width: pageWidth, height: 15, color: accent });
    page.drawText(snapshot.sellerName, { x: margin, y: pageHeight - 39, size: 8, font: bold, color: ink });
    page.drawText(snapshot.title.toUpperCase(), { x: margin, y: pageHeight - 51, size: 7, font: regular, color: muted });
    page.drawLine({ start: { x: margin, y: 61 }, end: { x: pageWidth - margin, y: 61 }, thickness: 0.6, color: line });
    page.drawText(`Document ${snapshot.groupId.slice(0, 8).toUpperCase()} | Page ${pageNumber}`, { x: margin, y: 44, size: 7, font: regular, color: muted });
    page.drawText(snapshot.status === "signed" ? "SIGNED COPY" : "AWAITING SIGNATURE", { x: pageWidth - margin - 76, y: 44, size: 7, font: bold, color: snapshot.status === "signed" ? rgb(0.08, 0.5, 0.35) : muted });
    return { page, y: pageHeight - 86, pageNumber };
  }

  let state = newPage(1);
  const ensure = (height: number) => {
    if (state.y - height < 78) state = newPage(state.pageNumber + 1);
  };
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
    ensure(30);
    state.page.drawText(title.toUpperCase(), { x: margin, y: state.y, size: 8, font: bold, color: accent });
    state.y -= 18;
  };
  const fact = (label: string, value: string, column: 0 | 1, rowY: number) => {
    const x = margin + column * (contentWidth / 2 + 8);
    state.page.drawText(label.toUpperCase(), { x, y: rowY, size: 6.5, font: bold, color: muted });
    state.page.drawText(value || "Not recorded", { x, y: rowY - 13, size: 9, font: regular, color: ink });
  };

  state.page.drawText(snapshot.title, { x: margin, y: state.y, size: 22, font: bold, color: ink });
  state.y -= 30;
  textBlock(snapshot.introduction, { size: 10, color: muted, gap: 14 });

  section("Buyer and puppy");
  ensure(118);
  const facts = [
    ["Buyer", snapshot.buyerName], ["Puppy", snapshot.puppyName],
    ["Buyer contact", [snapshot.buyerPhone, snapshot.buyerEmail].filter(Boolean).join(" / ")], ["Sex and color", [snapshot.puppySex, snapshot.puppyColor].filter(Boolean).join(" / ")],
    ["Buyer location", snapshot.buyerLocation], ["Birth date", date(snapshot.puppyBirthDate)],
    ["Litter", snapshot.litterName], ["Parents", [snapshot.damName && `Dam: ${snapshot.damName}`, snapshot.sireName && `Sire: ${snapshot.sireName}`].filter(Boolean).join(" / ")],
  ];
  facts.forEach(([label, value], index) => fact(label, value, index % 2 as 0 | 1, state.y - Math.floor(index / 2) * 29));
  state.y -= 120;

  if (snapshot.kind === "bill_of_sale") {
    section("Sale summary");
    ensure(72);
    const saleFacts = [
      ["Purchase price", money(snapshot.salePriceCents)], ["Deposit recorded", money(snapshot.depositCents)],
      ["Balance", money(snapshot.balanceCents)], ["Balance due", date(snapshot.balanceDueDate)],
      ["Transfer date", date(snapshot.transferDate)], ["Seller", snapshot.sellerName],
    ];
    saleFacts.forEach(([label, value], index) => fact(label, value, index % 2 as 0 | 1, state.y - Math.floor(index / 2) * 29));
    state.y -= 92;
  }

  section("Agreement terms");
  snapshot.terms.forEach((term, index) => textBlock(`${index + 1}. ${term}`, { size: 9.2, indent: 2, gap: 7 }));

  section("Electronic signature");
  if (snapshot.signature) {
    textBlock(`Signed electronically by ${snapshot.signature.signerName} on ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(snapshot.signature.signedAt))}.`, { font: bold, size: 10, gap: 4 });
    textBlock("The signer affirmatively agreed to use an electronic signature and confirmed that the typed name represents their signature on this exact document.", { size: 8.5, color: muted, gap: 5 });
    textBlock(`Audit record: ${snapshot.signature.auditHash} | Network: ${snapshot.signature.ipAddress || "Unavailable"}`, { font: italic, size: 7, color: muted, gap: 2 });
  } else {
    textBlock("This document is awaiting the buyer's electronic signature in the secure puppy portal.", { font: italic, size: 9.5, color: muted });
  }

  return pdf.save();
}
