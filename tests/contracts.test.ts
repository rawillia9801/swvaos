import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { combinedAgreementTerms, parseCombinedAgreementContent } from "../lib/combined-agreement.ts";
import { billOfSaleTerms, healthGuaranteeTerms, virginiaConsumerNotice } from "../lib/contract-templates.ts";
import { parseContractTerm } from "../lib/contract-format.ts";
import { contractNotes, parseContractNotes, renderContractPdf, type ContractSnapshot } from "../lib/contract-pdf.ts";
import { createPortalToken, verifyPortalToken } from "../lib/portal-token.ts";

process.env.SWVAOS_PORTAL_SECRET = "test-only-portal-secret-with-sufficient-entropy";

const snapshot: ContractSnapshot = {
  version: 1,
  groupId: "9e3b69de-12a9-471d-9b0d-5186fc7a08ed",
  kind: "bill_of_sale",
  status: "signed",
  createdAt: "2026-07-19T13:45:00.000Z",
  buyerId: 7,
  buyerName: "Test Buyer",
  buyerEmail: "",
  buyerPhone: "276-555-0100",
  buyerLocation: "Abingdon, Virginia",
  puppyId: 11,
  puppyName: "Bubba",
  puppySex: "Male",
  puppyColor: "Black and white",
  puppyBirthDate: "2026-05-12",
  litterName: "Spring Litter",
  damName: "Love",
  sireName: "Blue Ridge",
  salePriceCents: 250000,
  depositCents: 50000,
  balanceCents: 200000,
  balanceDueDate: "2026-08-02",
  transferDate: "2026-08-03",
  sellerName: "Southwest Virginia Chihuahua",
  sellerLocation: "Southwest Virginia",
  title: "Bill of Sale - Bubba",
  introduction: "A retained agreement generated from the CRM.",
  terms: billOfSaleTerms,
  signature: {
    signerName: "Test Buyer",
    signedAt: "2026-07-19T14:06:00.000Z",
    ipAddress: "203.0.113.42",
    userAgent: "Test browser",
    auditHash: "64c853aa5922525b41b1fbbcc6eec5cff1c88dc6ccff828909f8c3bd4c8b79ec",
    electronicConsent: true,
  },
};

test("creates and verifies tamper-resistant puppy portal tokens", async () => {
  const token = await createPortalToken(7, 1);
  assert.equal((await verifyPortalToken(token))?.buyerId, 7);
  const [payload, signature] = token.split(".");
  const tamperedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(await verifyPortalToken(`${payload}.${tamperedSignature}`), null);
});

test("freezes contract data in buyer document metadata", () => {
  const encoded = contractNotes(snapshot);
  assert.equal(parseContractNotes(encoded)?.signature?.signerName, "Test Buyer");
  assert.equal(parseContractNotes("ordinary upload notes"), null);
});

test("renders a signed letter-size PDF with document metadata", async () => {
  const bytes = await renderContractPdf(snapshot);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1 && pdf.getPageCount() <= 2);
  assert.equal(pdf.getTitle(), "Bill of Sale - Bubba");
  for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), { width: 612, height: 792 });
});

test("builds a sectioned Virginia health guarantee with Micro-Toy safeguards", async () => {
  const terms = healthGuaranteeTerms(240, 12, true);
  assert.equal(parseContractTerm(terms[0]).kind, "section");
  assert.match(terms.join("\n"), /10 calendar days/);
  assert.match(terms.join("\n"), /Micro-Toy Puppy/);
  assert.match(terms.join("\n"), /does not eliminate or restrict a right or remedy that cannot legally be waived/);
  assert.match(virginiaConsumerNotice, /Virginia Consumer Protection Act/);
  assert.match(virginiaConsumerNotice, /within 14 days following receipt if the animal is infected with parvovirus/);

  const healthSnapshot: ContractSnapshot = { ...snapshot, kind: "health_guarantee", title: "Health Guarantee - Bubba", terms, microToy: true, signature: { ...snapshot.signature!, healthAcknowledged: true } };
  const bytes = await renderContractPdf(healthSnapshot);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 4);
});

test("renders the combined production agreement as one signable retained PDF", async () => {
  const parsedTerms = parseCombinedAgreementContent(combinedAgreementTerms.join("\n\n"));
  assert.ok(parsedTerms);
  const noticeIndex = parsedTerms!.findIndex((term) => parseContractTerm(term).kind === "notice");
  assert.ok(noticeIndex > 0);
  assert.equal(parseContractTerm(parsedTerms![noticeIndex + 1]).kind, "clause");
  assert.match(parsedTerms!.join("\n"), /One-year limited congenital and hereditary health guarantee/i);
  assert.match(parsedTerms!.join("\n"), /three business days/i);

  const combinedSnapshot: ContractSnapshot = {
    ...snapshot,
    kind: "health_guarantee",
    title: "Bill of Sale, Animal History Certificate and One-Year Health Guarantee - Bubba",
    introduction: "A production agreement generated and retained by SWVAOS.",
    terms: parsedTerms!,
    microToy: false,
    agreementDetails: {
      agreementNumber: "SWVA-TEST-001",
      agreementDate: "2026-07-19",
      coBuyerName: "Second Buyer",
      buyerStreetAddress: "100 Main Street",
      buyerCityStateZip: "Abingdon, Virginia 24210",
      buyerEmergencyContact: "Emergency Contact / 276-555-0199",
      puppyAgeAtTransfer: "11 weeks, 6 days",
      puppyCoatType: "Long coat",
      puppyCurrentWeight: "2.1 lb",
      estimatedAdultSize: "Approximately 4 lb; estimate only",
      registry: "AKC",
      registrationNumber: "Pending",
      litterInternalId: "Spring Litter",
      bredBySeller: true,
      sireRegistrationNumber: "AKC-SIRE-1",
      damRegistrationNumber: "AKC-DAM-1",
      knownConditions: "No known material condition other than the attached record.",
      healthRecordStatus: "Attached",
      careGuideStatus: "Provided",
      registrationDocumentsStatus: "Pending",
      insuranceInformationStatus: "Provided",
      salesTaxCents: 0,
      transportCents: 10000,
      otherChargesCents: 0,
      reservationCreditCents: 50000,
      additionalPaymentsCents: 0,
      paymentMethod: "Good Dog",
      transferMethod: "Buyer pickup",
      transferLocation: "Marion, Virginia",
      recipientName: "Test Buyer",
      appetiteAtTransfer: "Eating normally",
      specialFeedingInstructions: "Feed on the written small-puppy schedule.",
      firstVetFindingsStatus: "Buyer will provide findings after examination",
      registrationStatus: "Pending after transfer",
      registrationType: "Limited / pet only",
      insuranceSelection: "30-day Trupanion offer provided when eligible",
      sellerRepresentative: "Southwest Virginia Chihuahua LLC",
    },
    signature: { ...snapshot.signature!, healthAcknowledged: true },
  };

  const bytes = await renderContractPdf(combinedSnapshot);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), combinedSnapshot.title);
  assert.ok(pdf.getPageCount() >= 10);
  assert.equal(parseContractNotes(contractNotes(combinedSnapshot))?.agreementDetails?.agreementNumber, "SWVA-TEST-001");
});
