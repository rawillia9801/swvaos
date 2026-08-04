import "server-only";

import { supabaseRequest } from "../db/supabase";
import { getBuyerMilestoneConfig } from "./milestone-config";
import { isPastAdoptionPuppyStatus, type BuyerMilestoneConfig, type BuyerMilestoneRule } from "./milestone-defaults";

type Row = Record<string, unknown>;

const MANAGED_SEPARATOR = "\u2063";
const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();

async function rows(path: string) {
  const response = await supabaseRequest(path, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Unable to load puppy journey records.");
  return response.json() as Promise<Row[]>;
}

async function insert(table: string, data: Row) {
  const response = await supabaseRequest(`rest/v1/${table}`, {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error((await response.text()) || `Unable to add ${table} record.`);
  return ((await response.json()) as Row[])[0] ?? null;
}

async function update(table: string, id: number, data: Row) {
  const response = await supabaseRequest(`rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error((await response.text()) || `Unable to update ${table} record.`);
  return ((await response.json()) as Row[])[0] ?? null;
}

async function remove(table: string, id: number) {
  const response = await supabaseRequest(`rest/v1/${table}?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || `Unable to delete ${table} record.`);
}

function dateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${dateOnly(value)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function ageDays(birthDate: string, now = new Date()) {
  const birth = new Date(`${dateOnly(birthDate)}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86_400_000));
}

function ruleDay(rule: BuyerMilestoneRule) {
  return Math.max(1, Math.round(Number(rule.day) || 1));
}

function cleanBuyerWording(value: string) {
  return value
    .replace(/\bautomatically\b/gi, "on schedule")
    .replace(/\bautomated\b/gi, "scheduled")
    .replace(/\bautomatic\b/gi, "scheduled")
    .replace(/\bautomation\b/gi, "schedule")
    .trim();
}

function personalized(value: string, puppyName: string) {
  return cleanBuyerWording(value.replace(/{{\s*puppy_name\s*}}/gi, puppyName));
}

function visibleMilestoneTitle(rule: BuyerMilestoneRule, puppyName: string) {
  const title = personalized(rule.title, puppyName) || "Puppy development update";
  if (title.toLowerCase() === "dewormed") return "Dewormed";
  if (title.toLowerCase().includes(puppyName.toLowerCase())) return title;
  return `${title} — ${puppyName}`;
}

function visibleMilestoneBody(rule: BuyerMilestoneRule, puppyName: string) {
  return personalized(rule.body, puppyName);
}

function storedMilestoneTitle(rule: BuyerMilestoneRule, puppyName: string) {
  return `${visibleMilestoneTitle(rule, puppyName)}${MANAGED_SEPARATOR}${rule.id}`;
}

function managedRuleId(title: string) {
  const marker = title.lastIndexOf(MANAGED_SEPARATOR);
  return marker >= 0 ? title.slice(marker + MANAGED_SEPARATOR.length).trim() : "";
}

function legacyRuleId(title: string) {
  const match = title.match(/^\[Automatic milestone:([^\]]+)\]/i);
  if (!match) return "";
  const key = match[1].trim().toLowerCase();
  const aliases: Record<string, string> = {
    "eyes-opening": "eyes-beginning-week-2",
    "eyes-open": "eyes-open-week-2",
    "early-socialization": "early-socialization-week-3",
    exploration: "exploration-week-4",
    "social-skills": "social-skills-week-5",
    "go-home-foundation": "go-home-foundation-week-7",
    "deworming-week-2": "dewormed-week-2",
    "deworming-week-4": "dewormed-week-4",
    "deworming-week-6": "dewormed-week-6",
    "deworming-week-8": "dewormed-week-8",
  };
  if (aliases[key]) return aliases[key];
  if (key.startsWith("deworming-confirmed")) return "";
  return "";
}

function matchesRule(updateRow: Row, rule: BuyerMilestoneRule, puppyName: string) {
  const title = text(updateRow, "title");
  const markerId = managedRuleId(title) || legacyRuleId(title);
  if (markerId) return markerId === rule.id;
  const visibleTitle = visibleMilestoneTitle(rule, puppyName);
  if (title === visibleTitle) return true;
  const legacyWeek = Math.max(1, Math.ceil(ruleDay(rule) / 7));
  const updateWeek = Number(updateRow.week_number) || 0;
  if (rule.title.toLowerCase() === "dewormed" && /^(Dewormed|Deworming recorded|Deworming confirmation)/i.test(title) && (!updateWeek || updateWeek === legacyWeek)) return true;
  return false;
}

export function cleanManagedMilestoneTitle(value: string) {
  const marker = value.lastIndexOf(MANAGED_SEPARATOR);
  const withoutMarker = marker >= 0 ? value.slice(0, marker) : value;
  const legacy = withoutMarker.match(/^\[Automatic milestone:([^\]]+)\]\s*(.*)$/i);
  if (!legacy) return cleanBuyerWording(withoutMarker);
  const key = legacy[1].trim().toLowerCase();
  const puppyName = legacy[2].trim();
  const names: Record<string, string> = {
    "eyes-opening": "Eyes beginning to open",
    "eyes-open": "Eyes open and adjusting",
    "early-socialization": "Early socialization begins",
    exploration: "Exploration and confidence milestone",
    "social-skills": "Social skills are developing",
    "go-home-foundation": "Go-home foundation work",
  };
  if (key.startsWith("deworm")) return "Dewormed";
  const friendly = names[key] || "Puppy development update";
  return cleanBuyerWording(puppyName ? `${friendly} — ${puppyName}` : friendly);
}

export async function syncPuppyJourneyMilestones(buyerId?: number | null) {
  const config = await getBuyerMilestoneConfig();
  const rules = config.milestones;
  const buyerFilter = buyerId && buyerId > 0 ? `&buyer_id=eq.${buyerId}` : "";
  const puppies = await rows(`rest/v1/puppies?select=*&birth_date=not.is.null${buyerFilter}`);
  if (!puppies.length) return { puppies: 0, updatesCreated: 0, updatesChanged: 0, updatesRemoved: 0 };

  const puppyIds = puppies.map((puppy) => Number(puppy.id)).filter((id) => Number.isInteger(id) && id > 0);
  const updates = puppyIds.length ? await rows(`rest/v1/puppy_updates?select=*&puppy_id=in.(${puppyIds.join(",")})`) : [];
  const now = new Date();
  const updatedAt = now.toISOString();
  const configuredIds = new Set(rules.map((rule) => rule.id));
  let updatesCreated = 0;
  let updatesChanged = 0;
  let updatesRemoved = 0;

  for (const puppy of puppies) {
    const puppyId = Number(puppy.id);
    const puppyName = text(puppy, "name") || `Puppy #${puppyId}`;
    const birthDate = text(puppy, "birth_date");
    const assignedBuyerId = Number(puppy.buyer_id) || 0;
    if (!puppyId || !birthDate) continue;

    const daysOld = ageDays(birthDate, now);
    const existingUpdates = updates.filter((existingUpdate) => Number(existingUpdate.puppy_id) === puppyId);
    const removedIds = new Set<number>();
    const pastAdoption = config.excludePastAdoptions && isPastAdoptionPuppyStatus(puppy.status);
    const globallyExcluded = Boolean(assignedBuyerId && config.excludedBuyerIds.includes(assignedBuyerId));

    for (const existing of existingUpdates) {
      const ruleId = managedRuleId(text(existing, "title"));
      if (!ruleId) continue;
      const rule = rules.find((candidate) => candidate.id === ruleId);
      const shouldExist = Boolean(
        rule
        && configuredIds.has(ruleId)
        && rule.enabled
        && daysOld >= ruleDay(rule)
        && !pastAdoption
        && !globallyExcluded
        && (!assignedBuyerId || !rule.excludedBuyerIds.includes(assignedBuyerId)),
      );
      if (!shouldExist) {
        const existingId = Number(existing.id);
        await remove("puppy_updates", existingId);
        removedIds.add(existingId);
        updatesRemoved += 1;
      }
    }

    if (pastAdoption || globallyExcluded) continue;

    for (const rule of rules) {
      const due = daysOld >= ruleDay(rule);
      const ruleExcluded = Boolean(assignedBuyerId && rule.excludedBuyerIds.includes(assignedBuyerId));
      const existing = existingUpdates.find((candidate) => !removedIds.has(Number(candidate.id)) && matchesRule(candidate, rule, puppyName));

      if (!rule.enabled || !due || ruleExcluded) {
        if (existing && (managedRuleId(text(existing, "title")) || legacyRuleId(text(existing, "title")))) {
          const existingId = Number(existing.id);
          await remove("puppy_updates", existingId);
          removedIds.add(existingId);
          updatesRemoved += 1;
        }
        continue;
      }

      const milestoneDate = addDays(birthDate, ruleDay(rule));
      const createdAt = `${milestoneDate}T12:00:00.000Z`;
      const title = storedMilestoneTitle(rule, puppyName);
      const body = visibleMilestoneBody(rule, puppyName);
      const payload = {
        title,
        body,
        week_number: null,
        weight: null,
        published: true,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      if (existing) {
        const needsUpdate = text(existing, "title") !== title
          || text(existing, "body") !== body
          || existing.week_number !== null
          || existing.published !== true
          || text(existing, "created_at") !== createdAt;
        if (needsUpdate) {
          await update("puppy_updates", Number(existing.id), payload);
          updatesChanged += 1;
        }
        continue;
      }

      await insert("puppy_updates", { puppy_id: puppyId, ...payload });
      updatesCreated += 1;
    }
  }

  return { puppies: puppies.length, updatesCreated, updatesChanged, updatesRemoved };
}

function projectionMultiplier(ageWeeks: number) {
  if (ageWeeks <= 8) return 3;
  if (ageWeeks <= 10) return 2.6;
  if (ageWeeks <= 12) return 2.2;
  if (ageWeeks <= 14) return 1.9;
  if (ageWeeks <= 16) return 1.65;
  if (ageWeeks <= 20) return 1.4;
  if (ageWeeks <= 24) return 1.2;
  if (ageWeeks <= 32) return 1.1;
  return 1.03;
}

export function projectAdultWeight(input: { birthDate: string; currentWeight: number; weightEntries?: Array<{ weight: number; createdAt: string }> }) {
  const currentWeight = Number(input.currentWeight) || 0;
  const birthDate = input.birthDate;
  if (!birthDate || currentWeight <= 0) return null;
  const days = ageDays(birthDate);
  const ageWeeks = Math.max(1, Math.round((days / 7) * 10) / 10);
  const point = currentWeight * projectionMultiplier(ageWeeks);
  const recentEntries = (input.weightEntries || []).filter((entry) => entry.weight > 0).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const lastTwo = recentEntries.slice(-2);
  let trend = "A weekly trend will become more useful after additional weights are recorded.";
  if (lastTwo.length === 2) {
    const change = lastTwo[1].weight - lastTwo[0].weight;
    trend = change > 0 ? `The two latest recorded weights show a gain of ${change.toFixed(2)} lb.` : change < 0 ? `The two latest recorded weights show a decrease of ${Math.abs(change).toFixed(2)} lb; the breeder should review the entry and puppy's condition.` : "The two latest recorded weights are unchanged.";
  }
  return {
    ageWeeks,
    latestWeight: currentWeight,
    projectedLow: Math.max(currentWeight, point * 0.85),
    projectedHigh: Math.max(currentWeight, point * 1.15),
    trend,
    entryCount: recentEntries.length,
    disclaimer: "This is a developmental estimate based on age and recorded weight. It is not a guarantee of adult size, and growth may differ because of genetics, health, nutrition, and individual development.",
  };
}

export function journeyMilestonesForPuppy(puppy: Row, updates: Row[], config: BuyerMilestoneConfig) {
  const birthDate = text(puppy, "birthDate") || text(puppy, "birth_date");
  if (!birthDate) return [];
  const puppyId = Number(puppy.id);
  const buyerId = Number(puppy.buyerId ?? puppy.buyer_id) || 0;
  const puppyName = text(puppy, "name") || `Puppy #${puppyId}`;
  const puppyStatus = text(puppy, "status");
  if (config.excludePastAdoptions && isPastAdoptionPuppyStatus(puppyStatus)) return [];
  if (buyerId && config.excludedBuyerIds.includes(buyerId)) return [];

  const daysOld = ageDays(birthDate);
  const relatedUpdates = updates.filter((update) => Number(update.puppyId ?? update.puppy_id) === puppyId);

  return config.milestones
    .filter((rule) => rule.enabled && (!buyerId || !rule.excludedBuyerIds.includes(buyerId)))
    .map((rule) => ({
      key: rule.id,
      title: visibleMilestoneTitle(rule, puppyName),
      date: addDays(birthDate, ruleDay(rule)),
      status: daysOld >= ruleDay(rule) ? "Reached" : "Upcoming",
      detail: visibleMilestoneBody(rule, puppyName),
      visibleUpdate: relatedUpdates.some((update) => managedRuleId(text(update, "title")) === rule.id || matchesRule(update, rule, puppyName)),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
