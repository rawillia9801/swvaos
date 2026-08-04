import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type VoiceSessionPayload = {
  buyerId: number;
  phone: string;
  callSid: string;
  exp: number;
};

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function sessionSecret() {
  const secret = process.env.SWVAOS_VOICE_SESSION_SECRET?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!secret) throw new Error("Voice session signing is not configured.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function issueVoiceSession(input: { buyerId: number; phone: string; callSid: string; ttlSeconds?: number }) {
  const payload: VoiceSessionPayload = {
    buyerId: input.buyerId,
    phone: input.phone,
    callSid: input.callSid,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, Math.min(1800, input.ttlSeconds ?? 900)),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyVoiceSession(token: string | null | undefined) {
  const [encoded, suppliedSignature] = String(token ?? "").split(".");
  if (!encoded || !suppliedSignature) return null;
  const expected = signature(encoded);
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VoiceSessionPayload;
    if (!Number.isInteger(payload.buyerId) || payload.buyerId <= 0) return null;
    if (!payload.phone || !payload.callSid || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
