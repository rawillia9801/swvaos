import "server-only";

import { supabaseRequest } from "../db/supabase";

type Row = Record<string, unknown>;

type DevelopmentMilestone = {
  key: string;
  day: number;
  title: string;
  body: string;
};

const developmentalMilestones: DevelopmentMilestone[] = [
  {
    key: "eyes-opening",
    day: 10,
    title: "Eyes beginning to open",
    body: "At this stage, puppies commonly begin opening their eyes. Vision is still developing, and the litter remains closely monitored in a calm, protected environment.",
  },
  {
    key: "eyes-open",
    day: 14,
    title: "Eyes open and adjusting",
    body: "The eyes are generally open by this stage, although vision is still immature. Gentle handling and careful environmental monitoring continue.",
  },
  {
    key: "early-socialization",
    day: 21,
    title: "Early socialization begins",
    body: "Age-appropriate handling and calm exposure to normal household sounds begin as the puppy becomes more aware of people, movement, and the surrounding environment.",
  },
  {
    key: "exploration",
    day: 28,
    title: "Exploration and confidence milestone",
    body: "The puppy is entering a more active learning period with supervised exploration, gentle handling, new textures, and carefully managed social experiences.",
  },
  {
    key: "social-skills",
    day: 35,
    title: "Social skills are developing",
    body: "Play, communication with littermates, handling tolerance, and confidence-building experiences continue under close supervision.",
  },
  {
    key: "go-home-foundation",
    day: 49,
    title: "Go-home foundation work",
    body: "Routine development now includes age-appropriate preparation for household life, handling, feeding transitions, early confinement skills, and individual observation.",
  },
];

const dewormingDays = [14, 28, 42, 56];

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

function legacyAutomatedTitle(key: string, puppyName: string) {
  return `[Automatic milestone:${key}] ${puppyName}`;
}

function milestoneUpdateTitle(milestoneTitle: string, puppyName: string) {
  return `${milestoneTitle} — ${puppyName}`;
}

function dewormingEventTitle(puppyName: string, week: number) {
  return `Deworming check — ${puppyName} — Week ${week}`;
}

function dewormingUpdateMatch(existingUpdate: Row, week: number, puppyName: string) {
  const title = text(existingUpdate, "title");
  const recordedWeek = Number(existingUpdate.week_number) || 0;
  return (
    (title === "Dewormed" && recordedWeek === week) ||
    title === legacyAutomatedTitle(`deworming-week-${week}`, puppyName) ||
    title === `Deworming recorded — Week ${week} — ${puppyName}` ||
    title === `Deworming confirmation — Week ${week}` ||
    title === `Dewormed — Week ${week}`
  );
}

export async function syncPuppyJourneyMilestones(buyerId?: number | null) {
  const buyerFilter = buyerId && buyerId > 0 ? `&buyer_id=eq.${buyerId}` : "";
  const puppies = await rows(`rest/v1/puppies?select=*&birth_date=not.is.null${buyerFilter}`);
  if (!puppies.length) return { puppies: 0, updatesCreated: 0, careItemsCreated: 0 };

  const puppyIds = puppies.map((puppy) => Number(puppy.id)).filter((id) => Number.isInteger(id) && id > 0);
  const [updates, events] = await Promise.all([
    puppyIds.length ? rows(`rest/v1/puppy_updates?select=*&puppy_id=in.(${puppyIds.join(",")})`) : Promise.resolve([]),
    puppyIds.length ? rows(`rest/v1/events?select=*&related_type=eq.puppies&related_id=in.(${puppyIds.join(",")})`) : Promise.resolve([]),
  ]);

  const now = new Date();
  const createdAt = now.toISOString();
  let updatesCreated = 0;
  let careItemsCreated = 0;

  for (const puppy of puppies) {
    const puppyId = Number(puppy.id);
    const puppyName = text(puppy, "name") || `Puppy #${puppyId}`;
    const birthDate = text(puppy, "birth_date");
    if (!puppyId || !birthDate) continue;
    const daysOld = ageDays(birthDate, now);
    const existingUpdates = updates.filter((existingUpdate) => Number(existingUpdate.puppy_id) === puppyId);
    const existingEvents = events.filter((event) => Number(event.related_id) === puppyId);

    for (const milestone of developmentalMilestones) {
      if (daysOld < milestone.day) continue;
      const legacyTitle = legacyAutomatedTitle(milestone.key, puppyName);
      const title = milestoneUpdateTitle(milestone.title, puppyName);
      const existing = existingUpdates.find((existingUpdate) => [legacyTitle, title].includes(text(existingUpdate, "title")));

      if (existing) {
        if (text(existing, "title") === legacyTitle) {
          await update("puppy_updates", Number(existing.id), {
            title,
            created_at: createdAt,
            updated_at: createdAt,
          });
        }
        continue;
      }

      await insert("puppy_updates", {
        puppy_id: puppyId,
        title,
        body: milestone.body,
        week_number: Math.max(1, Math.ceil(milestone.day / 7)),
        weight: null,
        published: true,
        created_at: createdAt,
        updated_at: createdAt,
      });
      updatesCreated += 1;
    }

    for (const day of dewormingDays) {
      const week = Math.ceil(day / 7);
      const milestoneDate = addDays(birthDate, day);
      const eventTitle = dewormingEventTitle(puppyName, week);

      if (!existingEvents.some((event) => text(event, "title") === eventTitle)) {
        await insert("events", {
          title: eventTitle,
          event_type: "Health & Care",
          event_date: milestoneDate,
          event_time: null,
          related_type: "puppies",
          related_id: puppyId,
          location: "Breeder care schedule",
          status: daysOld >= day ? "Completed" : "Scheduled",
          notes: `Automatic ${week}-week deworming milestone.`,
          created_at: createdAt,
          updated_at: createdAt,
        });
        careItemsCreated += 1;
      }

      if (daysOld < day) continue;

      const existing = existingUpdates.find((existingUpdate) => dewormingUpdateMatch(existingUpdate, week, puppyName));
      const dewormedAt = `${milestoneDate}T12:00:00.000Z`;
      if (existing) {
        if (
          text(existing, "title") !== "Dewormed" ||
          text(existing, "body") !== "" ||
          Number(existing.week_number) !== week ||
          text(existing, "created_at") !== dewormedAt
        ) {
          await update("puppy_updates", Number(existing.id), {
            title: "Dewormed",
            body: "",
            week_number: week,
            published: true,
            created_at: dewormedAt,
            updated_at: createdAt,
          });
        }
        continue;
      }

      await insert("puppy_updates", {
        puppy_id: puppyId,
        title: "Dewormed",
        body: "",
        week_number: week,
        weight: null,
        published: true,
        created_at: dewormedAt,
        updated_at: createdAt,
      });
      updatesCreated += 1;
    }
  }

  return { puppies: puppies.length, updatesCreated, careItemsCreated };
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

export function journeyMilestonesForPuppy(puppy: Row, updates: Row[], _events: Row[]) {
  const birthDate = text(puppy, "birthDate") || text(puppy, "birth_date");
  if (!birthDate) return [];
  const puppyId = Number(puppy.id);
  const daysOld = ageDays(birthDate);
  const relatedUpdates = updates.filter((update) => Number(update.puppyId ?? update.puppy_id) === puppyId);

  const development = developmentalMilestones.map((milestone) => ({
    key: milestone.key,
    title: milestone.title,
    date: addDays(birthDate, milestone.day),
    status: daysOld >= milestone.day ? "Reached" : "Upcoming",
    detail: milestone.body,
  }));

  const deworming = dewormingDays.flatMap((day) => {
    if (daysOld < day) return [];
    const week = Math.ceil(day / 7);
    return [{
      key: `deworming-week-${week}`,
      title: "Dewormed",
      date: addDays(birthDate, day),
      status: "Completed",
      detail: "",
    }];
  });

  return [...development, ...deworming]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item) => ({ ...item, visibleUpdate: relatedUpdates.some((update) => text(update, "title").toLowerCase().includes(item.title.toLowerCase().split(" — ")[0])) }));
}
