import { renderPaymentAgreementPdf } from "../../../../lib/payment-agreement";
import { getTemplatesConfig } from "../../../../lib/templates-config";

export async function GET() {
  const config = await getTemplatesConfig();
  const pdf = await renderPaymentAgreementPdf({
    buyerName: "____________________________________________",
    planType: "Pre-transfer purchase plan",
    processor: "____________________________________________",
    cashPriceCents: 0,
    taxCents: 0,
    transportCents: 0,
    otherChargesCents: 0,
    depositCreditCents: 0,
    downPaymentCents: 0,
    otherCreditCents: 0,
    apr: 0,
    financeChargeCents: 0,
    installmentCount: 12,
    installmentAmountCents: 0,
    frequency: "____________________________________________",
    firstDueDate: "",
    finalDueDate: "",
    monthlyAdminFeeCents: 0,
    lateFeeCents: 0,
    graceDays: 0,
    returnedPaymentFeeCents: 0,
    onTimeCreditCents: 0,
    autopayRequired: false,
    standardTerms: config.documents.payment_agreement.content,
  });
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "content-disposition": 'attachment; filename="swva-chihuahua-payment-plan-agreement.pdf"',
      "content-type": "application/pdf",
      "cache-control": "no-store",
    },
  });
}
