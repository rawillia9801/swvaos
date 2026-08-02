import "server-only";

import { supabaseRequest } from "../db/supabase";

type Row = Record<string, unknown>;

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const number = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;

export async function recordWeeklyPuppyWeight(puppy: Row) {
  const puppyId = Number(puppy.id);
  const recordedWeight = number(puppy, "current_weight");
  if (!Number.isInteger(puppyId) || puppyId <= 0 || recordedWeight <= 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const title = `[Weekly weight:${today}] ${text(puppy, "name") || `Puppy #${puppyId}`}`;
  const query = new URLSearchParams({ select: "id", puppy_id: `eq.${puppyId}`, title: `eq.${title}`, limit: "1" });
  const existingResponse = await supabaseRequest(`rest/v1/puppy_updates?${query}`, { cache: "no-store" });
  if (existingResponse.ok && ((await existingResponse.json()) as Row[]).length) return null;

  const birthDate = text(puppy, "birth_date");
  const birth = birthDate ? new Date(`${birthDate.slice(0, 10)}T12:00:00`) : null;
  const ageWeeks = birth && !Number.isNaN(birth.getTime())
    ? Math.max(1, Math.round(((Date.now() - birth.getTime()) / 604_800_000) * 10) / 10)
    : null;
  const now = new Date().toISOString();
  const response = await supabaseRequest("rest/v1/puppy_updates", {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({
      puppy_id: puppyId,
      title,
      body: `${text(puppy, "name") || "The puppy"}'s weekly weight was recorded as ${recordedWeight.toFixed(recordedWeight < 2 ? 2 : 1)} lb${ageWeeks ? ` at approximately ${ageWeeks} weeks old` : ""}. The Puppy Portal growth estimate will update from the newest recorded weight.`,
      week_number: ageWeeks ? Math.max(1, Math.round(ageWeeks)) : null,
      weight: recordedWeight,
      published: true,
      created_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to preserve the weekly puppy weight.");
  return ((await response.json()) as Row[])[0] ?? null;
}
