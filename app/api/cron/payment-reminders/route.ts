import { getKennelDataFromSupabase } from "../../../../db/supabase-kennel";
import { sendPaymentReminder } from "../../../../lib/automation-email";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return request.headers.get("user-agent")?.startsWith("vercel-cron/") === true && request.headers.has("x-vercel-cron-schedule");
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const data = await getKennelDataFromSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const due = data.transactions.filter((item) =>
      ["Payment", "Deposit"].includes(String(item.type ?? ""))
      && !["Paid", "Complete", "Refunded", "Voided"].includes(String(item.status ?? ""))
      && Boolean(item.buyer_id)
      && Boolean(item.due_date)
      && String(item.due_date) <= today,
    );
    let sent = 0;
    let skipped = 0;
    for (const transaction of due.slice(0, 100)) {
      try {
        const result = await sendPaymentReminder(transaction);
        if (result?.sent) sent += 1;
        else skipped += 1;
      } catch (error) {
        skipped += 1;
        console.error("Payment reminder failed", error instanceof Error ? error.message : error);
      }
    }
    return Response.json({ checked: due.length, sent, skipped });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process payment reminders." }, { status: 500 });
  }
}
