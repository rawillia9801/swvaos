import { signPortalContract } from "../../../../../../../db/contracts";
import { sendBuyerAutomation } from "../../../../../../../lib/automation-email";

export async function POST(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    const documentId = Number(id);
    const body = await request.json() as { signer_name?: unknown; agreed?: unknown; electronic_consent?: unknown; health_acknowledged?: unknown };
    if (!Number.isInteger(documentId) || documentId <= 0) throw new Error("A valid contract is required.");
    if (body.agreed !== true) throw new Error("Confirm that you reviewed and agree to this contract.");
    if (body.electronic_consent !== true) throw new Error("Separately consent to use electronic records and an electronic signature.");
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const result = await signPortalContract(
      token,
      documentId,
      String(body.signer_name ?? ""),
      forwarded || request.headers.get("x-real-ip") || "Unavailable",
      request.headers.get("user-agent") || "Unavailable",
      { electronicConsent: true, healthAcknowledged: body.health_acknowledged === true },
    );
    if (result?.snapshot?.buyerId) {
      try {
        await sendBuyerAutomation("contract_signed", Number(result.snapshot.buyerId), {
          puppyId: Number(result.snapshot.puppyId) || null,
          dedupeKey: `document-${documentId}`,
          variables: { portal_url: `${new URL(request.url).origin}/portal/${token}` },
        });
      } catch (emailError) {
        console.error("Contract-signed email failed", emailError instanceof Error ? emailError.message : emailError);
      }
    }
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to sign the contract." }, { status: 400 });
  }
}
