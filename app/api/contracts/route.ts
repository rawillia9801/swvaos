import { prepareContractPackage } from "../../../db/contracts";
import { requireAdminSession } from "../../../lib/admin-session";
import { sendBuyerAutomation } from "../../../lib/automation-email";
import { getTemplatesConfig } from "../../../lib/templates-config";

const cents = (value: unknown) => Math.round(Math.max(0, Number(value) || 0) * 100);
const terms = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const clauses = value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  return clauses.length ? clauses : undefined;
};

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const config = await getTemplatesConfig();
    const result = await prepareContractPackage({
      buyerId: Number(body.buyer_id),
      puppyId: Number(body.puppy_id),
      salePriceCents: cents(body.sale_price),
      depositCents: cents(body.deposit_amount),
      depositMethod: String(body.deposit_method ?? ""),
      depositPaidDate: String(body.deposit_paid_date ?? ""),
      balanceDueDate: String(body.balance_due_date ?? ""),
      transferDate: String(body.transfer_date ?? ""),
      examHours: Number(body.exam_days ?? 10) * 24,
      guaranteeMonths: Number(body.guarantee_months ?? 12),
      microToy: body.micro_toy === true || body.micro_toy === "on",
      billTerms: terms(body.bill_terms) ?? (config.documents.bill_of_sale.enabled ? terms(config.documents.bill_of_sale.content) : undefined),
      healthTerms: terms(body.health_terms) ?? (config.documents.health_guarantee.enabled ? terms(config.documents.health_guarantee.content) : undefined),
    });
    const origin = new URL(request.url).origin;
    const portalUrl = `${origin}/portal/${result.token}`;
    try {
      await sendBuyerAutomation("contract_ready", result.buyerId, { puppyId: result.puppyId, dedupeKey: `contract-${result.contracts[0]?.snapshot.groupId ?? result.token.slice(0, 12)}`, variables: { portal_url: portalUrl } });
    } catch (emailError) {
      console.error("Contract-ready email failed", emailError instanceof Error ? emailError.message : emailError);
    }
    return Response.json({ ...result, portalUrl }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the contract package." }, { status: 400 });
  }
}
