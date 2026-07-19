import { createPortalToken } from "../../../../lib/portal-token";
import { reconcileContractDeposits } from "../../../../db/contracts";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { buyer_id?: unknown };
    const buyerId = Number(body.buyer_id);
    await reconcileContractDeposits(buyerId);
    const token = await createPortalToken(buyerId);
    return Response.json({ token, portalUrl: `${new URL(request.url).origin}/portal/${token}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the portal link." }, { status: 400 });
  }
}
