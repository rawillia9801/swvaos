import { createPortalRequest, type PortalRequestInput } from "../../../../../db/contracts";

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
    return Response.json({ id: Number(created.id), status: String(created.status ?? "New") }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to send the request." }, { status: 500 });
  }
}
