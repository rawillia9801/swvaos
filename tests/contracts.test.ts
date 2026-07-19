import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { billOfSaleTerms } from "../lib/contract-templates.ts";
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
  },
};

test("creates and verifies tamper-resistant puppy portal tokens", async () => {
  const token = await createPortalToken(7, 1);
  assert.equal((await verifyPortalToken(token))?.buyerId, 7);
  assert.equal(await verifyPortalToken(`${token.slice(0, -1)}x`), null);
});

test("freezes contract data in buyer document metadata", () => {
  const encoded = contractNotes(snapshot);
  assert.equal(parseContractNotes(encoded)?.signature?.signerName, "Test Buyer");
  assert.equal(parseContractNotes("ordinary upload notes"), null);
});

test("renders a signed letter-size PDF with document metadata", async () => {
  const bytes = await renderContractPdf(snapshot);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), "Bill of Sale - Bubba");
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
});
