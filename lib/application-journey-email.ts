import "server-only";

import nodemailer from "nodemailer";
import { supabaseRequest } from "../db/supabase";
import { getEmailStatus } from "./email-service";

type ApplicationJourneyEmailInput = {
  buyerId: number;
  to: string;
  firstName: string;
  setupLink: string;
  dedupeKey: string;
};

const smtpUser = () => process.env.SMTP_USER?.trim() || "support@swvachihuahua.com";
const configured = () => Boolean(process.env.SMTP_PASSWORD?.trim());

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function eventExists(title: string, buyerId: number) {
  const query = new URLSearchParams({ select: "id", title: `eq.${title}`, related_id: `eq.${buyerId}`, limit: "1" });
  const response = await supabaseRequest(`rest/v1/events?${query}`, { cache: "no-store" });
  if (!response.ok) return false;
  return ((await response.json()) as unknown[]).length > 0;
}

async function logEmail(title: string, buyerId: number, status: "Completed" | "Failed", notes: string) {
  const now = new Date().toISOString();
  const response = await supabaseRequest("rest/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      event_type: "Email",
      event_date: now.slice(0, 10),
      event_time: now.slice(11, 16),
      related_type: "buyers",
      related_id: buyerId,
      location: "Hostinger SMTP",
      status,
      notes: notes.slice(0, 2000),
      created_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) console.error("Unable to record application email activity", response.status);
}

export async function sendApplicationJourneyEmail(input: ApplicationJourneyEmailInput) {
  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { sent: false, skipped: "No valid recipient email." };
  if (!configured()) return { sent: false, skipped: "SMTP is not configured." };

  const eventTitle = `Email: Application received and portal setup [${input.dedupeKey}]`.slice(0, 240);
  if (await eventExists(eventTitle, input.buyerId)) return { sent: false, skipped: "Already sent." };

  const firstName = input.firstName.trim() || "there";
  const subject = "We received your puppy application — create your Puppy Portal password";
  const text = [
    `Hi ${firstName},`,
    "",
    "Thank you for submitting your puppy application to Southwest Virginia Chihuahua. We have received it and your application is now in review.",
    "",
    "Please allow up to 48 business hours for the review to be completed. We will contact you if clarification or additional information is needed.",
    "",
    "Your application also begins your private Puppy Portal account. Use the secure link below to create your password:",
    "",
    input.setupLink,
    "",
    "Inside your Puppy Portal, you can follow your application status, review required policies and agreements, see puppy updates after a puppy is assigned, review payment records, and plan pickup or delivery.",
    "",
    "The setup link expires after 7 days. After creating your password, you can return to https://portal.swvachihuahua.com to sign in.",
    "",
    "Southwest Virginia Chihuahua",
    "support@swvachihuahua.com · 855-506-5425",
  ].join("\n");

  const status = getEmailStatus();
  const safeLink = escapeHtml(input.setupLink);
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#173536;max-width:680px;margin:auto">
    <div style="font-size:11px;font-weight:800;letter-spacing:.13em;color:#087f84;margin-bottom:12px">SOUTHWEST VIRGINIA CHIHUAHUA</div>
    <h1 style="font-family:Georgia,serif;font-size:31px;font-weight:500;line-height:1.15;margin:0 0 16px;color:#153a40">We received your puppy application</h1>
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Thank you for submitting your puppy application. Your application is now <strong>in review</strong>.</p>
    <div style="margin:20px 0;padding:15px 17px;border-left:5px solid #c49338;border-radius:10px;background:#fff8e9;color:#5f4922"><strong>Please allow up to 48 business hours for review.</strong><br><span style="font-size:13px">We will contact you when a decision is made or when additional information is needed.</span></div>
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:#153a40;margin:25px 0 8px">Create your Puppy Portal password</h2>
    <p>Your application begins your private account. Use the button below to choose a password and open your Puppy Portal.</p>
    <p style="margin:24px 0"><a href="${safeLink}" style="display:inline-block;padding:14px 20px;border-radius:12px;background:#0b8d91;color:#fff;text-decoration:none;font-weight:800">Create my Puppy Portal password</a></p>
    <p style="font-size:13px;color:#627d80">The setup link expires after 7 days. After setup, return to <a href="https://portal.swvachihuahua.com" style="color:#087f84;font-weight:700">portal.swvachihuahua.com</a> whenever you need to sign in.</p>
    <div style="margin-top:24px;padding:17px;border-radius:14px;background:#eef7f5">
      <strong style="color:#17484c">Your portal will help you:</strong>
      <ul style="padding-left:20px;margin:9px 0 0">
        <li>Follow your application and placement status</li>
        <li>Review policies and agreements assigned to your account</li>
        <li>See puppy milestones and weekly weights after a puppy is assigned</li>
        <li>Review payments, documents, transportation plans, and messages</li>
      </ul>
    </div>
    <hr style="border:0;border-top:1px solid #dbe8e6;margin:27px 0">
    <p style="font-size:12px;color:#687f82">Southwest Virginia Chihuahua<br>support@swvachihuahua.com · 855-506-5425</p>
  </div>`;

  const mailer = nodemailer.createTransport({
    host: status.host,
    port: status.port,
    secure: status.secure,
    auth: { user: smtpUser(), pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });

  try {
    const result = await mailer.sendMail({
      from: { name: status.fromName, address: status.fromEmail },
      replyTo: process.env.SMTP_REPLY_TO?.trim() || status.fromEmail,
      to,
      subject,
      text,
      html,
    });
    await logEmail(eventTitle, input.buyerId, "Completed", `Recipient: ${to}\nSubject: ${subject}\nProvider message: ${result.messageId}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP delivery failed.";
    await logEmail(eventTitle, input.buyerId, "Failed", `Recipient: ${to}\nSubject: ${subject}\nError: ${message}`);
    throw new Error(`Application confirmation email failed: ${message}`);
  }
}
