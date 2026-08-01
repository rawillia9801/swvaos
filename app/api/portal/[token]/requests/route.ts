import { createPortalRequest, getPuppyPortal, type PortalRequestInput } from "../../../../../db/contracts";
import { sendOwnerNotification } from "../../../../../lib/email-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const input = await request.json() as Partial<PortalRequestInput>;
    if (input.kind !== "support" && input.kind !== "transportation") {
      return Response.json({ error: "Choose a valid request type." }, { status: 400 });
    }
    const created = await createPortalRequest(token, {
      kind: input.kind,
      subject: String(input.subject ?? ""),
      message: String(input.message ?? ""),
      requestedDate: String(input.requestedDate ?? ""),
    });

    try {
      const portal = await getPuppyPortal(token);
      await sendOwnerNotification({
        category: "Message",
        subject: `${input.kind === "transportation" ? "Transportation request" : "Portal message"} from ${portal?.buyer?.name || "a buyer"}`,
        buyerId: portal?.buyer?.id || null,
        body: [
          input.kind === "transportation" ? "A family submitted a transportation request." : "A family sent a message through the Puppy Portal.",
          "",
          `Family: ${portal?.buyer?.name || "Not available"}`,
          `Email: ${portal?.buyer?.email || "Not available"}`,
          `Subject: ${String(input.subject ?? "")}`,
          input.kind === "transportation" ? `Requested date: ${String(input.requestedDate || "Not specified")}` : "",
          "Message:",
          String(input.message ?? ""),
          "",
          "Review it in SWVAOS:",
          input.kind === "transportation" ? "https://swvaos.site/?view=Delivery" : "https://swvaos.site/?view=Comms",
        ].filter(Boolean).join("\n"),
      });
    } catch (emailError) {
      console.error("Owner portal-message notification failed", emailError instanceof Error ? emailError.message : emailError);
    }

    return Response.json({ id: Number(created.id), status: String(created.status ?? "New") }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to send the request." }, { status: 500 });
  }
}
