import { getSupabaseConfig, supabaseRequest } from "../../../db/supabase";
import { renderPaymentAgreementPdf, type PaymentAgreementInput } from "../../../lib/payment-agreement";
import { getTemplatesConfig } from "../../../lib/templates-config";

const cents = (value: unknown) => Math.max(0, Math.round((Number(value) || 0) * 100));
const text = (value: unknown) => String(value ?? "").trim();
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const payload = await response.text();
  const json = payload ? JSON.parse(payload) : null;
  if (!response.ok) throw new Error(json?.message ?? json?.error ?? "Payment agreement request failed.");
  return json as T;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const buyerId = positiveId(body.buyer_id);
    if (!buyerId) return Response.json({ error: "Choose a buyer." }, { status: 400 });

    const buyers = await jsonRequest<Record<string, unknown>[]>(`rest/v1/buyers?select=*&id=eq.${buyerId}&limit=1`);
    const buyer = buyers[0];
    if (!buyer) return Response.json({ error: "The buyer was not found." }, { status: 404 });

    const puppyId = positiveId(body.puppy_id);
    const puppy = puppyId ? (await jsonRequest<Record<string, unknown>[]>(`rest/v1/puppies?select=*&id=eq.${puppyId}&limit=1`))[0] : null;
    const firstName = text(buyer.first_name);
    const lastName = text(buyer.last_name);
    const buyerName = [firstName, lastName].filter(Boolean).join(" ") || text(buyer.email) || `Buyer #${buyerId}`;
    const installmentCount = Math.max(1, Math.min(60, Number(body.installment_count) || 1));
    const paymentAmountCents = cents(body.installment_amount);
    const totalAmountCents = paymentAmountCents * installmentCount;
    const now = new Date().toISOString();

    const planRows = await jsonRequest<Record<string, unknown>[]>("rest/v1/payment_plans", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        buyer_id: buyerId,
        name: text(body.plan_name) || `Payment Agreement - ${buyerName}`,
        total_amount_cents: totalAmountCents,
        payment_amount_cents: paymentAmountCents,
        term_count: installmentCount,
        frequency: text(body.frequency) || "Monthly",
        next_due_date: text(body.first_due_date) || null,
        status: "Active",
        created_at: now,
        updated_at: now,
      }),
    });
    const paymentPlanId = Number(planRows[0]?.id);
    if (!paymentPlanId) throw new Error("The payment plan could not be created.");

    const templateConfig = await getTemplatesConfig();
    const input: PaymentAgreementInput = {
      buyerName,
      coBuyerName: text(body.co_buyer_name),
      billingAddress: text(body.billing_address),
      phone: text(buyer.phone),
      email: text(buyer.email),
      puppyName: text(puppy?.name),
      puppyRegistrySex: [text(body.registry), text(puppy?.sex)].filter(Boolean).join(" / "),
      puppyBirthDate: text(puppy?.birth_date),
      planType: body.plan_type === "Post-transfer financing" ? "Post-transfer financing" : "Pre-transfer purchase plan",
      plannedTransferDate: text(body.planned_transfer_date),
      processor: text(body.processor) || "Good Dog",
      cashPriceCents: cents(body.cash_price),
      taxCents: cents(body.sales_tax),
      transportCents: cents(body.transport),
      otherChargesCents: cents(body.other_charges),
      depositCreditCents: cents(body.deposit_credit),
      downPaymentCents: cents(body.down_payment),
      otherCreditCents: cents(body.other_credit),
      apr: Math.max(0, Number(body.apr) || 0),
      financeChargeCents: cents(body.finance_charge),
      installmentCount,
      installmentAmountCents: paymentAmountCents,
      frequency: text(body.frequency) || "Monthly",
      firstDueDate: text(body.first_due_date),
      finalDueDate: text(body.final_due_date),
      monthlyAdminFeeCents: cents(body.monthly_admin_fee),
      lateFeeCents: cents(body.late_fee),
      graceDays: Math.max(0, Number(body.grace_days) || 0),
      returnedPaymentFeeCents: cents(body.returned_payment_fee),
      onTimeCreditCents: cents(body.on_time_credit),
      autopayRequired: body.autopay_required === true,
      standardTerms: templateConfig.documents.payment_agreement.enabled ? templateConfig.documents.payment_agreement.content : "",
      notes: text(body.notes),
    };

    const pdf = await renderPaymentAgreementPdf(input);
    const fileName = `payment-agreement-${buyerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    const objectKey = `buyers/${buyerId}/payment-agreements/${crypto.randomUUID()}-${fileName}`;
    const { storageBucket } = getSupabaseConfig();
    const upload = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, {
      method: "POST",
      headers: { "content-type": "application/pdf", "x-upsert": "false" },
      body: new Blob([pdf as BlobPart], { type: "application/pdf" }),
    });
    if (!upload.ok) throw new Error((await upload.text()) || "Unable to store the payment agreement.");

    const docs = await jsonRequest<Record<string, unknown>[]>("rest/v1/buyer_documents", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        buyer_id: buyerId,
        payment_plan_id: paymentPlanId,
        document_type: "Payment Plan Agreement",
        title: `Puppy Payment Plan & Financing Agreement - ${buyerName}`,
        object_key: objectKey,
        file_name: fileName,
        content_type: "application/pdf",
        size_bytes: pdf.length,
        notes: `Generated by SWVAOS on ${now}.`,
        created_at: now,
        updated_at: now,
      }),
    });
    const documentId = Number(docs[0]?.id);
    if (documentId && puppyId) {
      await jsonRequest("rest/v1/buyer_document_puppies", { method: "POST", body: JSON.stringify({ document_id: documentId, puppy_id: puppyId }) });
    }

    return Response.json({ paymentPlanId, documentId, fileName }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the payment agreement." }, { status: 500 });
  }
}
