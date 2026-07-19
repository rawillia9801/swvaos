import { prepareContractPackage } from "../../../db/contracts";

const cents = (value: unknown) => Math.round(Math.max(0, Number(value) || 0) * 100);
const terms = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const clauses = value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  return clauses.length ? clauses : undefined;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const result = await prepareContractPackage({
      buyerId: Number(body.buyer_id),
      puppyId: Number(body.puppy_id),
      salePriceCents: cents(body.sale_price),
      depositCents: cents(body.deposit_amount),
      balanceDueDate: String(body.balance_due_date ?? ""),
      transferDate: String(body.transfer_date ?? ""),
      examHours: Number(body.exam_hours ?? 72),
      guaranteeMonths: Number(body.guarantee_months ?? 12),
      billTerms: terms(body.bill_terms),
      healthTerms: terms(body.health_terms),
    });
    const origin = new URL(request.url).origin;
    return Response.json({ ...result, portalUrl: `${origin}/portal/${result.token}` }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the contract package." }, { status: 400 });
  }
}
