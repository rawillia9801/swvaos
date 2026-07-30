import { renderContractPdf, type ContractSnapshot } from "../../../../lib/contract-pdf";
import { parseCombinedAgreementContent } from "../../../../lib/combined-agreement";
import { getTemplatesConfig } from "../../../../lib/templates-config";

export async function GET() {
  const config = await getTemplatesConfig();
  const createdAt = new Date().toISOString();
  const snapshot: ContractSnapshot = {
    version: 1,
    groupId: "preview-bill-of-sale-health-guarantee",
    kind: "health_guarantee",
    status: "pending",
    createdAt,
    buyerId: 1,
    buyerName: "Buyer information auto-populates from SWVAOS",
    buyerEmail: "buyer@example.com",
    buyerPhone: "(276) 555-0100",
    buyerLocation: "City, Virginia 00000",
    puppyId: 1,
    puppyName: "Puppy name",
    puppySex: "Female",
    puppyColor: "Color and markings",
    puppyBirthDate: createdAt.slice(0, 10),
    litterName: "Litter record",
    damName: "Dam record",
    sireName: "Sire record",
    salePriceCents: 250000,
    depositCents: 50000,
    balanceCents: 200000,
    balanceDueDate: "",
    transferDate: "",
    sellerName: "Southwest Virginia Chihuahua LLC",
    sellerLocation: "Marion, Virginia",
    title: "Bill of Sale, Animal History Certificate and One-Year Health Guarantee - Preview",
    introduction: "This preview shows the production document structure. Buyer, puppy, payment, transfer, registration, health, and signature information is filled from SWVAOS and the preparation form.",
    terms: parseCombinedAgreementContent(config.documents.bill_of_sale_health_guarantee.content) ?? [],
    agreementDetails: {
      agreementNumber: "PREVIEW",
      agreementDate: createdAt.slice(0, 10),
      coBuyerName: "Optional",
      buyerStreetAddress: "Street address",
      buyerCityStateZip: "City, Virginia 00000",
      buyerEmergencyContact: "Optional emergency contact",
      puppyAgeAtTransfer: "Calculated from birth and transfer dates",
      puppyCoatType: "Smooth or long coat",
      puppyCurrentWeight: "Current recorded weight",
      estimatedAdultSize: "Estimate only - not guaranteed",
      registry: "AKC / CKC / ACA / Other",
      registrationNumber: "Recorded or pending",
      litterInternalId: "Litter record",
      bredBySeller: true,
      acquiredFrom: "Bred by Seller",
      knownConditions: "Known conditions and disclosures appear here.",
      healthRecordStatus: "Attached or available in the portal",
      careGuideStatus: "Portal access provided",
      registrationDocumentsStatus: "Delivered, pending, or not included",
      insuranceInformationStatus: "30-day Trupanion information provided when applicable",
      transportInstructionsStatus: "Delivered when applicable",
      paymentMethod: "Recorded payment method",
      transferMethod: "Pickup, delivery, or transporter",
      transferLocation: "Transfer location",
      appetiteAtTransfer: "Normal or special instructions attached",
      firstVetFindingsStatus: "Completed after the Buyer's examination",
      insuranceSelection: "30-day Trupanion offer provided when applicable",
      registrationStatus: "Pending or delivered",
      registrationType: "Limited / pet only or full / breeding",
      sellerRepresentative: "Southwest Virginia Chihuahua LLC",
      attachments: "Animal history, health record, care guide, registration documents, insurance information",
    },
  };

  const pdf = await renderContractPdf(snapshot);
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="bill-of-sale-health-guarantee-preview.pdf"',
      "cache-control": "no-store",
    },
  });
}
