import "server-only";

import { supabaseRequest } from "../db/supabase";
import { createPortalToken } from "./portal-token";
import { sendTemplateEmail } from "./email-service";
import type { EmailTemplateKey } from "./template-defaults";

type Row = Record<string, unknown>;

async function rows(path: string) {
  const response = await supabaseRequest(path, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Unable to load email recipient.");
  return response.json() as Promise<Row[]>;
}

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const name = (buyer: Row) => [text(buyer, "first_name"), text(buyer, "last_name")].filter(Boolean).join(" ") || text(buyer, "email");
const money = (cents: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
const displayDate = (value: unknown) => {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || "soon";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(`${raw}T12:00:00`));
};

export async function sendBuyerAutomation(templateKey: EmailTemplateKey, buyerId: number, options: {
  origin?: string;
  puppyId?: number | null;
  variables?: Record<string, string | number | null | undefined>;
  dedupeKey?: string;
} = {}) {
  const buyer = (await rows(`rest/v1/buyers?select=*&id=eq.${buyerId}&limit=1`))[0];
  if (!buyer || !text(buyer, "email")) return { sent: false, skipped: "Buyer has no email address." };
  const puppy = options.puppyId ? (await rows(`rest/v1/puppies?select=*&id=eq.${options.puppyId}&limit=1`))[0] : null;
  let portalUrl = String(options.variables?.portal_url ?? "");
  if (!portalUrl && options.origin) {
    const token = await createPortalToken(buyerId);
    portalUrl = `${options.origin}/portal/${token}`;
  }
  const puppyName = text(puppy, "name");
  return sendTemplateEmail({
    templateKey,
    to: text(buyer, "email"),
    buyerId,
    dedupeKey: options.dedupeKey,
    variables: {
      first_name: text(buyer, "first_name") || name(buyer),
      buyer_name: name(buyer),
      puppy_name: puppyName,
      puppy_context: puppyName ? ` for ${puppyName}` : "",
      portal_url: portalUrl,
      ...options.variables,
    },
  });
}

export async function sendTransactionReceipt(transaction: Row) {
  const buyerId = Number(transaction.buyer_id);
  const id = Number(transaction.id);
  if (!Number.isInteger(buyerId) || buyerId <= 0 || !["Payment", "Deposit"].includes(text(transaction, "type")) || !["Paid", "Complete"].includes(text(transaction, "status"))) return;
  await sendBuyerAutomation("payment_receipt", buyerId, {
    puppyId: Number(transaction.puppy_id) || null,
    dedupeKey: `transaction-${id}`,
    variables: { amount: money(transaction.amount_cents) },
  });
}

export async function sendPublishedUpdate(update: Row, origin: string) {
  if (!update.published) return;
  const puppyId = Number(update.puppy_id);
  const puppy = (await rows(`rest/v1/puppies?select=*&id=eq.${puppyId}&limit=1`))[0];
  const buyerId = Number(puppy?.buyer_id);
  if (!buyerId) return;
  await sendBuyerAutomation("puppy_update", buyerId, {
    origin,
    puppyId,
    dedupeKey: `update-${Number(update.id)}`,
    variables: { update_title: text(update, "title") },
  });
}

export async function sendPaymentReminder(transaction: Row) {
  const buyerId = Number(transaction.buyer_id);
  if (!buyerId) return { sent: false, skipped: "No buyer." };
  const today = new Date().toISOString().slice(0, 10);
  return sendBuyerAutomation("payment_reminder", buyerId, {
    puppyId: Number(transaction.puppy_id) || null,
    dedupeKey: `transaction-${Number(transaction.id)}-${today}`,
    variables: { amount: money(transaction.amount_cents), due_date: displayDate(transaction.due_date) },
  });
}
