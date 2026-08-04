import { getKennelDataFromSupabase } from "../../../../db/supabase-kennel";
import { requireAdminSession } from "../../../../lib/admin-session";
import { sendPuppyPacketEmail } from "../../../../lib/puppy-packet-email";
import { renderPuppyPacketPdf } from "../../../../lib/puppy-packet-pdf";
import { getTemplatesConfig } from "../../../../lib/templates-config";

type Row = Record<string, unknown>;

type PacketEmailBody = {
  puppyId?: unknown;
  recipient?: unknown;
  testCopy?: unknown;
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as PacketEmailBody;
    const puppyId = Number(body.puppyId);
    const testCopy = body.testCopy === true;
    if (!Number.isInteger(puppyId) || puppyId <= 0) return Response.json({ error: "Select a valid puppy before sending the packet." }, { status: 400 });

    const [data, templates] = await Promise.all([getKennelDataFromSupabase(), getTemplatesConfig()]);
    const rows = data as unknown as {
      puppies?: Row[];
      buyers?: Row[];
      litters?: Row[];
      dogs?: Row[];
      updates?: Row[];
      events?: Row[];
    };
    const puppy = (rows.puppies || []).find((item) => Number(item.id) === puppyId) || null;
    if (!puppy) return Response.json({ error: "The selected puppy could not be found." }, { status: 404 });

    const buyerId = Number(puppy.buyer_id) || 0;
    const buyer = buyerId ? (rows.buyers || []).find((item) => Number(item.id) === buyerId) || null : null;
    const litterId = Number(puppy.litter_id) || 0;
    const litter = litterId ? (rows.litters || []).find((item) => Number(item.id) === litterId) || null : null;
    const damId = Number(litter?.dam_id) || 0;
    const sireId = Number(litter?.sire_id) || 0;
    const dam = damId ? (rows.dogs || []).find((item) => Number(item.id) === damId) || null : null;
    const sire = sireId ? (rows.dogs || []).find((item) => Number(item.id) === sireId) || null : null;
    const updates = (rows.updates || []).filter((item) => Number(item.puppy_id) === puppyId);
    const events = (rows.events || []).filter((item) => Number(item.related_id) === puppyId && String(item.related_type || "").toLowerCase().includes("puppy"));

    const requestedRecipient = String(body.recipient ?? "").trim().toLowerCase();
    const buyerEmail = text(buyer, "email").toLowerCase();
    const recipient = requestedRecipient || buyerEmail;
    if (!recipient) return Response.json({ error: testCopy ? "Enter a test email address." : "This buyer does not have an email address on file." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

    const family = [text(buyer, "first_name"), text(buyer, "last_name")].filter(Boolean).join(" ") || (testCopy ? "Test Recipient" : buyerEmail || "Family");
    const puppyName = text(puppy, "name") || "Puppy";
    const pdf = await renderPuppyPacketPdf({ puppy, buyer, litter, dam, sire, updates, events, templates, testCopy });
    const result = await sendPuppyPacketEmail({
      to: recipient,
      buyerId: buyerId || null,
      buyerName: family,
      puppyName,
      pdf,
      testCopy,
    });

    return Response.json({
      ok: true,
      sent: true,
      recipient: result.recipient,
      filename: result.filename,
      testCopy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to email the puppy packet.";
    console.error("Puppy packet email failed", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
