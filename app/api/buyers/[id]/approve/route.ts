import { supabaseRequest } from "../../../../../db/supabase";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const buyerId = Number(id);

    if (!Number.isInteger(buyerId) || buyerId <= 0) {
      return Response.json(
        { error: "A valid buyer is required." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const response = await supabaseRequest(
      `rest/v1/buyers?id=eq.${buyerId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          prefer: "return=representation",
        },
        body: JSON.stringify({
          application_status: "Approved",
          updated_at: now,
        }),
        cache: "no-store",
      },
    );

    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = responseText;
      }
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : "Unable to approve the application.";

      return Response.json({ error: message }, { status: response.status });
    }

    const buyers = Array.isArray(payload) ? payload : [];
    if (buyers.length === 0) {
      return Response.json(
        { error: "The buyer was not found." },
        { status: 404 },
      );
    }

    return Response.json({ buyer: buyers[0] });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to approve the application.",
      },
      { status: 500 },
    );
  }
}
