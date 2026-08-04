import "server-only";

import { supabaseRequest } from "../db/supabase";

type Row = Record<string, unknown>;

type RepairSummary = {
  groups: number;
  merged: number;
  retained: number;
  warnings: string[];
};

const text = (row: Row, key: string) => String(row[key] ?? "").trim();
const id = (row: Row) => Number(row.id) || 0;
const email = (row: Row) => text(row, "email").toLowerCase();
const phone = (row: Row) => text(row, "phone").replace(/\D/g, "").slice(-10);
const name = (row: Row) => `${text(row, "first_name")} ${text(row, "last_name")}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const postal = (row: Row) => text(row, "postal_code").replace(/\D/g, "").slice(0, 5);
const cityState = (row: Row) => `${text(row, "city")}|${text(row, "state")}`.toLowerCase().replace(/[^a-z0-9|]+/g, "").trim();
const missingTable = /does not exist|schema cache|could not find the table|relation .* not found/i;

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(payload?.message || payload?.error || raw || `Data request failed (${response.status}).`);
  return payload as T;
}

async function safePatch(table: string, query: string, values: Row, warnings: string[]) {
  try {
    await request(`rest/v1/${table}?${query}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(values) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!missingTable.test(message)) warnings.push(`${table}: ${message}`);
  }
}

async function deleteBuyer(buyerId: number) {
  await request(`rest/v1/buyers?id=eq.${buyerId}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
}

function identityKeys(row: Row) {
  const normalizedEmail = email(row);
  const normalizedPhone = phone(row);
  const normalizedName = name(row);
  const normalizedPostal = postal(row);
  const normalizedCityState = cityState(row);
  return [
    normalizedName ? `name:${normalizedName}` : "",
    normalizedEmail ? `email:${normalizedEmail}` : "",
    normalizedName && normalizedPhone ? `name-phone:${normalizedName}|${normalizedPhone}` : "",
    normalizedName && normalizedPostal ? `name-zip:${normalizedName}|${normalizedPostal}` : "",
    normalizedName && normalizedCityState ? `name-location:${normalizedName}|${normalizedCityState}` : "",
  ].filter(Boolean);
}

function groups(rows: Row[]) {
  const parent = new Map<number, number>();
  const byKey = new Map<string, number>();
  const find = (value: number): number => {
    const current = parent.get(value) ?? value;
    if (current === value) return value;
    const root = find(current);
    parent.set(value, root);
    return root;
  };
  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent.set(Math.max(rootLeft, rootRight), Math.min(rootLeft, rootRight));
  };
  rows.forEach((row) => parent.set(id(row), id(row)));
  for (const row of rows) {
    for (const key of identityKeys(row)) {
      const existing = byKey.get(key);
      if (existing) union(existing, id(row));
      else byKey.set(key, id(row));
    }
  }
  const grouped = new Map<number, Row[]>();
  for (const row of rows) {
    const root = find(id(row));
    grouped.set(root, [...(grouped.get(root) || []), row]);
  }
  return [...grouped.values()].filter((group) => group.length > 1);
}

function score(row: Row) {
  const fields = ["first_name", "last_name", "email", "phone", "city", "state", "postal_code", "application_status", "preferred_sex", "preferred_color", "notes"];
  const complete = fields.reduce((total, key) => total + (text(row, key) ? 1 : 0), 0);
  const imported = /\[SWVAOS import:/i.test(text(row, "notes")) ? -5 : 0;
  const active = ["declined", "archived", "closed"].includes(text(row, "application_status").toLowerCase()) ? -2 : 0;
  return complete + imported + active;
}

function primaryFor(group: Row[]) {
  return [...group].sort((left, right) => score(right) - score(left) || id(left) - id(right))[0];
}

function mergedValues(primary: Row, duplicates: Row[]) {
  const fields = ["first_name", "last_name", "email", "phone", "city", "state", "postal_code", "application_status", "preferred_sex", "preferred_color", "household_notes"];
  const values: Row = {};
  for (const key of fields) {
    if (text(primary, key)) continue;
    const replacement = duplicates.map((row) => row[key]).find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim());
    if (replacement !== undefined) values[key] = replacement;
  }
  const notes = [text(primary, "notes"), ...duplicates.map((row) => text(row, "notes"))]
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join("\n");
  if (notes && notes !== text(primary, "notes")) values.notes = notes;
  values.updated_at = new Date().toISOString();
  return values;
}

export async function repairStrictBuyerDuplicates(): Promise<RepairSummary> {
  const warnings: string[] = [];
  const buyers = await request<Row[]>("rest/v1/buyers?select=*&order=id.asc&limit=10000");
  const duplicateGroups = groups(buyers);
  let merged = 0;

  for (const group of duplicateGroups) {
    const primary = primaryFor(group);
    const duplicates = group.filter((row) => id(row) !== id(primary));
    const changes = mergedValues(primary, duplicates);
    if (Object.keys(changes).length > 1) {
      await request(`rest/v1/buyers?id=eq.${id(primary)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(changes) });
    }

    for (const duplicate of duplicates) {
      const duplicateId = id(duplicate);
      const primaryId = id(primary);
      await safePatch("puppies", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("transactions", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("payment_plans", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("buyer_documents", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("events", `related_type=eq.buyers&related_id=eq.${duplicateId}`, { related_id: primaryId }, warnings);
      await safePatch("portal_messages", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("portal_requests", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      await safePatch("portal_accounts", `buyer_id=eq.${duplicateId}`, { buyer_id: primaryId }, warnings);
      try {
        await deleteBuyer(duplicateId);
        merged += 1;
      } catch (error) {
        warnings.push(`Buyer #${duplicateId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { groups: duplicateGroups.length, merged, retained: duplicateGroups.length, warnings };
}

let recent: { at: number; promise: Promise<RepairSummary> } | null = null;
export function repairStrictBuyerDuplicatesOnce() {
  const now = Date.now();
  if (recent && now - recent.at < 5 * 60 * 1000) return recent.promise;
  const promise = repairStrictBuyerDuplicates().catch((error) => ({ groups: 0, merged: 0, retained: 0, warnings: [error instanceof Error ? error.message : String(error)] }));
  recent = { at: now, promise };
  return promise;
}
