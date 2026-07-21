import "server-only";

import nodemailer from "nodemailer";
import { supabaseRequest } from "../db/supabase";
import { getTemplatesConfig } from "./templates-config";
import type { EmailTemplateKey } from "./template-defaults";

type Variables = Record<string, string | number | null | undefined>;
type SendInput = {
  templateKey: EmailTemplateKey;
  to: string;
  buyerId?: number | null;
  variables?: Variables;
  dedupeKey?: string;
};

const businessDefaults: Variables = {
  business_name: "Southwest Virginia Chihuahua",
  support_email: "support@swvachihuahua.com",
  support_phone: "855-506-5425",
};

const smtpUser = () => process.env.SMTP_USER?.trim() || "support@swvachihuahua.com";
const configured = () => Boolean(process.env.SMTP_PASSWORD?.trim());
const fromEmail = () => process.env.SMTP_FROM_EMAIL?.trim() || smtpUser();

export function getEmailStatus() {
  return {
    configured: configured(),
    host: process.env.SMTP_HOST?.trim() || "smtp.hostinger.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    fromEmail: fromEmail(),
    fromName: process.env.SMTP_FROM_NAME?.trim() || "Southwest Virginia Chihuahua",
  };
}

function render(value: string, variables: Variables) {
  const all = { ...businessDefaults, ...variables };
  return value.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_match, key: string) => String(all[key] ?? ""));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function eventExists(title: string, buyerId?: number | null) {
  const filters = [`select=id`, `title=eq.${encodeURIComponent(title)}`, `limit=1`];
  if (buyerId) filters.push(`related_id=eq.${buyerId}`);
  const response = await supabaseRequest(`rest/v1/events?${filters.join("&")}`, { cache: "no-store" });
  if (!response.ok) return false;
  const rows = await response.json() as unknown[];
  return rows.length > 0;
}

async function logEmail(title: string, buyerId: number | null | undefined, status: "Completed" | "Failed", notes: string) {
  const now = new Date().toISOString();
  const response = await supabaseRequest("rest/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      event_type: "Email",
      event_date: now.slice(0, 10),
      event_time: now.slice(11, 16),
      related_type: buyerId ? "buyers" : null,
      related_id: buyerId || null,
      location: "Hostinger SMTP",
      status,
      notes: notes.slice(0, 2000),
      created_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) console.error("Unable to record email activity", response.status);
}

export async function sendTemplateEmail(input: SendInput) {
  const to = input.to.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { sent: false, skipped: "No valid recipient email." };
  if (!configured()) return { sent: false, skipped: "SMTP is not configured." };
  const config = await getTemplatesConfig();
  const template = config.emails[input.templateKey];
  if (!template.enabled) return { sent: false, skipped: "This email template is disabled." };
  const eventTitle = `Email: ${template.name}${input.dedupeKey ? ` [${input.dedupeKey}]` : ""}`.slice(0, 240);
  if (input.dedupeKey && await eventExists(eventTitle, input.buyerId)) return { sent: false, skipped: "Already sent." };

  const subject = render(template.subject, input.variables ?? {}).replace(/[\r\n]+/g, " ").trim();
  const body = render(template.body, input.variables ?? {}).trim();
  const status = getEmailStatus();
  const transporter = nodemailer.createTransport({
    host: status.host,
    port: status.port,
    secure: status.secure,
    auth: { user: smtpUser(), pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });

  try {
    const result = await transporter.sendMail({
      from: { name: status.fromName, address: status.fromEmail },
      replyTo: process.env.SMTP_REPLY_TO?.trim() || status.fromEmail,
      to,
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173536;max-width:660px">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`,
    });
    await logEmail(eventTitle, input.buyerId, "Completed", `Template: ${input.templateKey}\nRecipient: ${to}\nSubject: ${subject}\nProvider message: ${result.messageId}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP delivery failed.";
    await logEmail(eventTitle, input.buyerId, "Failed", `Template: ${input.templateKey}\nRecipient: ${to}\nSubject: ${subject}\nError: ${message}`);
    throw new Error(`Email delivery failed: ${message}`);
  }
}
