import "server-only";

import nodemailer from "nodemailer";
import { supabaseRequest } from "../db/supabase";

type PuppyPacketEmailInput = {
  to: string;
  buyerId?: number | null;
  buyerName: string;
  puppyName: string;
  pdf: Uint8Array;
  testCopy?: boolean;
};

const smtpUser = () => process.env.SMTP_USER?.trim() || "support@swvachihuahua.com";
const fromEmail = () => process.env.SMTP_FROM_EMAIL?.trim() || smtpUser();
const fromName = () => process.env.SMTP_FROM_NAME?.trim() || "Southwest Virginia Chihuahua";
const configured = () => Boolean(process.env.SMTP_PASSWORD?.trim());

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function transport() {
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.hostinger.com",
    port,
    secure: port === 465,
    auth: { user: smtpUser(), pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 25_000,
  });
}

async function logEmail(input: PuppyPacketEmailInput, status: "Completed" | "Failed", notes: string) {
  const now = new Date().toISOString();
  const title = `${input.testCopy ? "Test email" : "Email"}: ${input.puppyName} Puppy Care Packet`.slice(0, 240);
  const response = await supabaseRequest("rest/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      event_type: "Email",
      event_date: now.slice(0, 10),
      event_time: now.slice(11, 16),
      related_type: input.buyerId ? "buyers" : null,
      related_id: input.buyerId || null,
      location: "Hostinger SMTP",
      status,
      notes: notes.slice(0, 2000),
      created_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) console.error("Unable to record puppy packet email activity", response.status);
}

export async function sendPuppyPacketEmail(input: PuppyPacketEmailInput) {
  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid email address.");
  if (!configured()) throw new Error("Hostinger SMTP is not configured.");

  const subject = `${input.testCopy ? "[TEST] " : ""}${input.puppyName}'s Personalized Puppy Care Packet`;
  const greeting = input.testCopy ? "This is a test copy of the complete personalized puppy packet." : `Your complete personalized puppy packet for ${input.puppyName} is attached.`;
  const body = [
    `Hello ${input.buyerName || "there"},`,
    "",
    greeting,
    "",
    "The attached PDF includes the personalized cover, puppy and family record, care guidance, Pup-Lift information, emergency preparation, training and safety resources, health logs, and notes pages.",
    "",
    "Please save the packet with your puppy's agreements, health records, registration documents, and veterinary information.",
    "",
    "Southwest Virginia Chihuahua",
    "swvachihuahua.com",
    "Pup-Lift: pup-lift.com · 1-715-888-9526",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#17383d;max-width:680px"><div style="padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,#063b44,#0d7278);color:white"><div style="font-size:10px;font-weight:800;letter-spacing:.14em;color:#9de9e1">SOUTHWEST VIRGINIA CHIHUAHUA</div><h1 style="margin:10px 0 0;font-family:Georgia,serif;font-size:29px;font-weight:500">${escapeHtml(input.puppyName)}'s Puppy Care Packet</h1></div><div style="padding:24px"><p>Hello ${escapeHtml(input.buyerName || "there")},</p><p>${escapeHtml(greeting)}</p><p>The attached PDF includes the personalized cover, puppy and family record, care guidance, Pup-Lift information, emergency preparation, training and safety resources, health logs, and notes pages.</p><p>Please save the packet with your puppy's agreements, health records, registration documents, and veterinary information.</p><div style="margin-top:22px;padding:14px 16px;border-radius:12px;background:#eef8f6;color:#42666a;font-size:13px"><b style="color:#0b777d">Attached:</b> ${escapeHtml(input.puppyName)}-Puppy-Care-Packet.pdf${input.testCopy ? " · TEST COPY" : ""}</div><hr style="border:0;border-top:1px solid #dbe8e6;margin:24px 0"><p style="font-size:12px;color:#687f82">Southwest Virginia Chihuahua<br>swvachihuahua.com<br>Pup-Lift: pup-lift.com · 1-715-888-9526</p></div></div>`;
  const filename = `${input.puppyName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "Puppy"}-Puppy-Care-Packet${input.testCopy ? "-TEST" : ""}.pdf`;

  try {
    const result = await transport().sendMail({
      from: { name: fromName(), address: fromEmail() },
      replyTo: process.env.SMTP_REPLY_TO?.trim() || fromEmail(),
      to,
      subject,
      text: body,
      html,
      attachments: [{ filename, content: Buffer.from(input.pdf), contentType: "application/pdf" }],
    });
    await logEmail(input, "Completed", `Recipient: ${to}\nSubject: ${subject}\nAttachment: ${filename}\nProvider message: ${result.messageId}`);
    return { sent: true, messageId: result.messageId, recipient: to, filename };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP delivery failed.";
    await logEmail(input, "Failed", `Recipient: ${to}\nSubject: ${subject}\nError: ${message}`);
    throw new Error(`Puppy packet email failed: ${message}`);
  }
}
