import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PaymentAgreementInput = {
  buyerName: string;
  coBuyerName?: string;
  billingAddress?: string;
  phone?: string;
  email?: string;
  puppyName?: string;
  puppyRegistrySex?: string;
  puppyBirthDate?: string;
  planType: "Pre-transfer purchase plan" | "Post-transfer financing";
  plannedTransferDate?: string;
  processor: string;
  cashPriceCents: number;
  taxCents: number;
  transportCents: number;
  otherChargesCents: number;
  depositCreditCents: number;
  downPaymentCents: number;
  otherCreditCents: number;
  apr: number;
  financeChargeCents: number;
  installmentCount: number;
  installmentAmountCents: number;
  frequency: string;
  firstDueDate: string;
  finalDueDate: string;
  monthlyAdminFeeCents: number;
  lateFeeCents: number;
  graceDays: number;
  returnedPaymentFeeCents: number;
  onTimeCreditCents: number;
  autopayRequired: boolean;
  notes?: string;
  standardTerms?: string;
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`)) : "Not specified";

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPaymentAgreementPdf(input: PaymentAgreementInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.16, 0.35, 0.31);
  const pale = rgb(0.92, 0.96, 0.94);
  const warning = rgb(1, 0.96, 0.86);
  const warningInk = rgb(0.47, 0.29, 0.05);
  const ink = rgb(0.12, 0.18, 0.17);
  const margin = 44;
  const width = 612;
  const height = 792;
  let page!: PDFPage;
  let y!: number;

  const newPage = () => {
    page = pdf.addPage([width, height]);
    y = height - 42;
    page.drawText("SOUTHWEST VIRGINIA CHIHUAHUA | PAYMENT PLAN & FINANCING", { x: margin, y, size: 8, font: bold, color: green });
    y -= 24;
  };
  const ensure = (space: number) => { if (y - space < 44) newPage(); };
  const heading = (title: string) => {
    ensure(34);
    page.drawRectangle({ x: margin, y: y - 21, width: width - margin * 2, height: 25, color: pale });
    page.drawText(title, { x: margin + 8, y: y - 14, size: 12, font: bold, color: green });
    y -= 34;
  };
  const paragraph = (text: string, size = 9.3, font: PDFFont = regular) => {
    const lines = wrap(font, text, size, width - margin * 2);
    ensure(lines.length * 13 + 8);
    for (const line of lines) { page.drawText(line, { x: margin, y, size, font, color: ink }); y -= 13; }
    y -= 6;
  };
  const notice = (title: string, text: string) => {
    const titleLines = wrap(bold, title, 9.4, width - margin * 2 - 20);
    const bodyLines = wrap(regular, text, 8.5, width - margin * 2 - 20);
    const boxHeight = 14 + titleLines.length * 12 + bodyLines.length * 11 + 12;
    ensure(boxHeight + 8);
    page.drawRectangle({ x: margin, y: y - boxHeight + 5, width: width - margin * 2, height: boxHeight, color: warning });
    let boxY = y - 10;
    for (const line of titleLines) {
      page.drawText(line, { x: margin + 10, y: boxY, size: 9.4, font: bold, color: warningInk });
      boxY -= 12;
    }
    boxY -= 2;
    for (const line of bodyLines) {
      page.drawText(line, { x: margin + 10, y: boxY, size: 8.5, font: regular, color: ink });
      boxY -= 11;
    }
    y -= boxHeight + 6;
  };
  const row = (label: string, value: string) => {
    ensure(22);
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: ink });
    page.drawText(value || "Not specified", { x: 250, y, size: 9, font: regular, color: ink });
    y -= 18;
  };

  const totalBeforeCredit = input.cashPriceCents + input.taxCents + input.transportCents + input.otherChargesCents;
  const amountFinanced = Math.max(0, totalBeforeCredit - input.depositCreditCents - input.downPaymentCents - input.otherCreditCents);
  const requiredAdminFees = input.monthlyAdminFeeCents * input.installmentCount;
  const disclosedFinanceCharge = input.financeChargeCents + requiredAdminFees;
  const totalPayments = amountFinanced + disclosedFinanceCharge;
  const totalSalePrice = input.depositCreditCents + input.downPaymentCents + input.otherCreditCents + totalPayments;

  newPage();
  page.drawText("PUPPY PAYMENT PLAN & FINANCING AGREEMENT", { x: margin, y, size: 18, font: bold, color: green });
  y -= 22;
  paragraph("Complete financial terms must be entered before either party signs. Do not sign a blank or incomplete agreement. This agreement supplements the Deposit & Reservation Agreement and the final Bill of Sale & Health Guarantee.");

  heading("1. Parties and Related Puppy Sale");
  row("Agreement date", date(new Date().toISOString().slice(0, 10)));
  row("Buyer / borrower", input.buyerName);
  row("Co-buyer / borrower", input.coBuyerName || "None");
  row("Billing address", input.billingAddress || "Not specified");
  row("Phone", input.phone || "Not specified");
  row("Email", input.email || "Not specified");
  row("Puppy name / ID", input.puppyName || "Not yet assigned");
  row("Registry / sex", input.puppyRegistrySex || "Not specified");
  row("Date of birth", date(input.puppyBirthDate));

  heading("2. Type of Plan and Eligibility");
  row("Selected plan", input.planType);
  row("Planned transfer date", date(input.plannedTransferDate));
  row("Payment processor", input.processor);
  paragraph(input.planType === "Pre-transfer purchase plan" ? "The puppy remains with the Seller and no ownership or right to possession transfers until all required amounts have been paid and cleared and final transfer documents are completed." : "The puppy may go home before the financed balance is fully paid. The Buyer remains obligated to pay according to this Agreement. Default does not authorize unlawful self-help repossession or automatically transfer ownership back to the Seller.");
  notice("NO FINANCING FOR NATURALLY SMALL, MICRO, OR MICRO-TOY PUPPIES", "Southwest Virginia Chihuahua does not intentionally breed for extreme small size. A puppy later designated by the Seller as naturally small, Micro, Micro-Toy, or exceptionally small is not eligible for financing or a structured payment plan. The related $2,500.00 additional small-puppy care charge is also not financeable. Before transfer, the Buyer must either pay the complete approved price in cleared funds or select another eligible puppy, subject to the written Deposit & Reservation Agreement. This policy does not limit rights that cannot legally be waived.");

  heading("3. Itemization of Amount Financed");
  row("Cash price of puppy", money(input.cashPriceCents));
  row("Sales tax, if applicable", money(input.taxCents));
  row("Transport / delivery", money(input.transportCents));
  row("Other purchase charges", money(input.otherChargesCents));
  row("Total sale price before credit", money(totalBeforeCredit));
  row("Reservation deposit credit", `- ${money(input.depositCreditCents)}`);
  row("Additional down payment", `- ${money(input.downPaymentCents)}`);
  row("Other credit", `- ${money(input.otherCreditCents)}`);
  row("Amount financed", money(amountFinanced));

  heading("4. Financing Disclosure Summary");
  row("Annual percentage rate", `${input.apr.toFixed(2)}% APR`);
  row("Finance charge", money(disclosedFinanceCharge));
  row("Amount financed", money(amountFinanced));
  row("Total of payments", money(totalPayments));
  row("Total sale price", money(totalSalePrice));
  row("Number of installments", String(input.installmentCount));
  row("Installment amount", money(input.installmentAmountCents));
  row("Payment frequency", input.frequency);
  row("First payment due", date(input.firstDueDate));
  row("Final payment due", date(input.finalDueDate));
  paragraph("The APR, finance charge, amount financed, total of payments, and payment schedule must be calculated from the final agreed terms. Any required monthly administrative fee is included in the disclosed finance charge and total of payments. Any mathematical inconsistency must be corrected in writing before signing.");

  heading("5. Fees and Credits");
  row("Monthly administrative fee", `${money(input.monthlyAdminFeeCents)} per installment`);
  row("Total required administrative fees", money(requiredAdminFees));
  row("Late fee", `${money(input.lateFeeCents)} after ${input.graceDays} day(s)`);
  row("Returned-payment fee", money(input.returnedPaymentFeeCents));
  row("On-time payment credit", money(input.onTimeCreditCents));
  row("Prepayment penalty", "None");
  paragraph("No fee will be charged in an amount or manner prohibited by applicable law. A required administrative fee is treated as part of the cost of credit for this disclosure. An on-time credit applies only when the complete scheduled payment clears by its due date and may not reduce the required final payment below zero.");

  heading("6. Payment Schedule");
  for (let index = 1; index <= input.installmentCount; index += 1) {
    const dueText = index === 1 && input.firstDueDate ? date(input.firstDueDate) : index === input.installmentCount && input.finalDueDate ? date(input.finalDueDate) : "____________________________";
    row(`Installment ${index}`, `${money(input.installmentAmountCents)} — Due: ${dueText}`);
  }
  paragraph(`Payment frequency: ${input.frequency || "Not specified"}. Every due date must be completed before signing, either in this schedule or in an attached schedule incorporated into this Agreement.`);

  const clauses = [
    ["7. Method and Timing of Payment", "Payments must be made through the designated processor unless the Seller approves another method in writing. When Good Dog is designated, all required payments must be made through Good Dog. Payment is made when cleared funds are received and correctly credited."],
    ["8. Recurring Payment Authorization", `${input.autopayRequired ? "Autopay is required." : "Autopay is not required."} Bank or card details must be entered directly through the secure processor and must not be written in this agreement. Revoking autopay does not cancel the debt or change due dates.`],
    ["9. Early Payment", "The Buyer may pay part or all of the unpaid balance early without a prepayment penalty. Unearned future finance charges will not be collected when prohibited by law."],
    ["10. Late and Returned Payments", "A payment is late when the full scheduled amount has not cleared by the end of the stated grace period. Returned, reversed, disputed, stopped, or rejected payments remain unpaid and must be replaced promptly. Fees will be assessed only when permitted by applicable law and the completed agreement."],
    ["11. Default and Opportunity to Cure", "Default includes failure to make a required payment after any grace period, materially false identity or financial information, an improper chargeback, or a material breach. The Seller will provide any notice and opportunity to cure required by law before acceleration or non-emergency remedies."],
    ["12. Puppy Possession and Default", "For a pre-transfer plan, the puppy remains with the Seller until all transfer requirements are satisfied. For post-transfer financing, the payment obligation continues after the puppy goes home. Any return or surrender must be voluntary and documented in writing or ordered through lawful process."],
    ["13. Registration Documents", "Registration eligibility is governed by the Bill of Sale and Health Guarantee. Registration papers do not prove that the financed balance has been paid, and delivery of registration papers does not release the Buyer from the debt."],
    ["14. Health, Insurance, and Continuing Payment", "Except where the parties agree otherwise in writing or applicable law provides a remedy, illness, injury, veterinary expense, insurance denial, loss, theft, rehoming, surrender, or death of the puppy does not automatically cancel the unpaid financial obligation."],
    ["15. Hardship Requests and Modifications", "The Buyer may request a temporary arrangement before delinquency. Any extension, deferment, waiver, settlement, revised due date, or other modification must be documented in writing and accepted by both parties."],
    ["16. Communications and Records", "The Buyer must keep current contact information on file. Account notices may be delivered by email, client portal, postal mail, or telephone as permitted by law. Marketing consent is not required as a condition of financing."],
    ["17. Joint Responsibility", "If more than one Buyer signs, each is jointly and individually responsible for the complete unpaid obligation unless the Seller expressly agrees otherwise in writing."],
    ["18. Assignment", "The Buyer may not assign this Agreement without written consent. The Seller may assign the right to receive payment only as permitted by law."],
    ["19. General Terms", "This Agreement, its completed payment schedule, and the identified related sale documents contain the complete payment-plan agreement. Virginia law governs except where controlling federal law applies. Electronic signatures and counterparts are intended to have the same effect as originals to the extent permitted by law. No provision waives a right or remedy that cannot lawfully be waived."],
    ["20. Final Acknowledgments", "The Buyer acknowledges reviewing the amount financed, APR, finance charge, total of payments, fees, due dates, payment schedule, plan type, default and cure provisions, early-payment terms, and the exclusion of naturally small, Micro, and Micro-Toy puppies from financing. The Buyer enters this Agreement voluntarily and believes the scheduled payments can be met."],
  ];
  for (const [title, text] of clauses) { heading(title); paragraph(text); }
  if (input.standardTerms?.trim()) { heading("STANDARD BUSINESS TERMS"); paragraph(input.standardTerms.trim()); }
  if (input.notes?.trim()) { heading("Additional Written Terms"); paragraph(input.notes.trim()); }

  heading("FINANCING ACKNOWLEDGMENT");
  paragraph("I understand that this is a binding payment obligation. I reviewed the completed financial terms and payment schedule and agree to pay the total obligation when due. I also understand that naturally small, Micro, Micro-Toy, and exceptionally small puppies, including the additional $2,500.00 small-puppy care charge, are not eligible for financing or a payment plan.", 10);
  y -= 8;
  row("Buyer printed name", input.buyerName);
  row("Buyer signature", "________________________________________");
  row("Date and time", "________________________________________");
  row("Co-buyer signature", "________________________________________");
  row("Seller representative", "________________________________________");
  row("Seller signature", "________________________________________");
  row("Date and time", "________________________________________");

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawText("swvachihuahua.com • 855-506-5425 • info@swvchihuahua.com", { x: margin, y: 24, size: 7, font: regular, color: green });
    item.drawText(`Page ${index + 1} of ${pages.length}`, { x: width - margin - 55, y: 24, size: 7, font: regular, color: green });
  });
  return pdf.save();
}
