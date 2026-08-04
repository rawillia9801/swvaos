export type BuyerMilestoneRule = {
  id: string;
  title: string;
  body: string;
  day: number;
  enabled: boolean;
  excludedBuyerIds: number[];
};

export type BuyerMilestoneConfig = {
  version: 2;
  updatedAt: string;
  excludePastAdoptions: boolean;
  excludedBuyerIds: number[];
  milestones: BuyerMilestoneRule[];
};

const pastAdoptionStatuses = new Set([
  "gone home",
  "adopted",
  "delivered",
  "complete",
  "completed",
  "archived",
  "closed",
]);

export function isPastAdoptionPuppyStatus(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return pastAdoptionStatuses.has(normalized);
}

const milestone = (id: string, day: number, title: string, body: string): BuyerMilestoneRule => ({
  id,
  day,
  title,
  body,
  enabled: true,
  excludedBuyerIds: [],
});

export const defaultBuyerMilestones: BuyerMilestoneRule[] = [
  milestone(
    "day-3-peaceful-start",
    3,
    "A peaceful beginning for {{puppy_name}}",
    "At about three days old, {{puppy_name}} spends most of the day sleeping, nursing, and staying close to Mom and the litter. Touch, warmth, scent, and quiet maternal care are the center of {{puppy_name}}'s world right now.",
  ),
  milestone(
    "day-6-growing-stronger",
    6,
    "{{puppy_name}} is growing a little stronger each day",
    "Tiny stretches, crawling movements, and steady nursing are helping {{puppy_name}} build strength. The days are still mostly peaceful, with growth and rest doing nearly all of the work.",
  ),
  milestone(
    "day-9-senses-changing",
    9,
    "Little senses are beginning to change",
    "{{puppy_name}} still depends heavily on scent and touch, but the nervous system is developing quickly. Small reactions to handling, temperature, movement, and familiar smells may become easier to notice.",
  ),
  milestone(
    "eyes-beginning-week-2",
    12,
    "{{puppy_name}} is beginning to see the world",
    "Around this age, the eyes may begin opening gradually. Vision is still very immature, so {{puppy_name}} is adjusting to light and shapes while remaining safest in a calm, protected space.",
  ),
  milestone("dewormed-week-2", 14, "Dewormed", ""),
  milestone(
    "eyes-open-week-2",
    15,
    "New sights and sounds for {{puppy_name}}",
    "The transitional stage is underway. Eyes and ears are opening, balance is improving, and {{puppy_name}} may be more alert to movement, voices, littermates, and gentle handling.",
  ),
  milestone(
    "day-18-finding-feet",
    18,
    "{{puppy_name}} is finding those tiny feet",
    "Wobbly standing and early steps are becoming part of the day. {{puppy_name}} may begin moving with more purpose, changing sleeping positions independently, and interacting more with the litter.",
  ),
  milestone(
    "early-socialization-week-3",
    21,
    "Curiosity is waking up in {{puppy_name}}",
    "At about three weeks, awareness expands quickly. {{puppy_name}} may notice people more, respond to sounds, investigate nearby movement, and begin participating in simple social exchanges with littermates.",
  ),
  milestone(
    "day-24-play-begins",
    24,
    "Play is becoming part of {{puppy_name}}'s day",
    "Gentle pawing, mouthing, tumbling, and brief bursts of play help {{puppy_name}} practice movement and communication. These early interactions are the beginning of important social learning.",
  ),
  milestone(
    "day-27-sounds-handling",
    27,
    "Familiar voices and gentle handling",
    "{{puppy_name}} is becoming more aware of everyday sounds and human touch. Calm handling, soft voices, and safe exposure to normal household activity help new experiences feel familiar rather than overwhelming.",
  ),
  milestone("dewormed-week-4", 28, "Dewormed", ""),
  milestone(
    "exploration-week-4",
    30,
    "{{puppy_name}} is ready to explore a little more",
    "Walking, running, and play are becoming more coordinated. Supervised exploration of safe textures, toys, spaces, and gentle movement gives {{puppy_name}} opportunities to build confidence.",
  ),
  milestone(
    "day-33-learning-from-littermates",
    33,
    "Learning from littermates",
    "Play with littermates is teaching {{puppy_name}} about body language, boundaries, frustration, and how hard is too hard during mouthing. These small lessons are an important part of becoming socially skilled.",
  ),
  milestone(
    "social-skills-week-5",
    36,
    "{{puppy_name}}'s personality is beginning to shine",
    "Preferences and individual reactions are becoming easier to recognize. {{puppy_name}} may show favorite ways to play, seek attention, approach something new, or settle after activity.",
  ),
  milestone(
    "day-39-routines-familiar",
    39,
    "Everyday routines are becoming familiar",
    "Repeated experiences help {{puppy_name}} understand the rhythm of meals, rest, handling, play, and quiet time. Predictable routines support security while confidence continues to grow.",
  ),
  milestone("dewormed-week-6", 42, "Dewormed", ""),
  milestone(
    "day-42-trust-resilience",
    42,
    "Building trust and resilience",
    "Positive introductions to safe sounds, surfaces, objects, and people help {{puppy_name}} recover comfortably from small surprises. Experiences remain brief, gentle, and appropriate for a young puppy.",
  ),
  milestone(
    "day-45-thinking-solving",
    45,
    "Thinking, exploring, and solving little problems",
    "{{puppy_name}} is learning during every waking moment. Simple choices, easy food puzzles, following a person, and discovering how toys work encourage curiosity without creating frustration.",
  ),
  milestone(
    "day-48-family-life",
    48,
    "Practicing the rhythm of family life",
    "Short periods in a safe pen or crate, individual attention, handling, and familiar household routines help {{puppy_name}} prepare for life beyond the litter while still receiving plenty of rest and reassurance.",
  ),
  milestone(
    "go-home-foundation-week-7",
    51,
    "More independence, with plenty of rest",
    "{{puppy_name}} may seem increasingly adventurous, but young puppies still need frequent quiet sleep. Short active periods followed by protected rest help prevent an overtired, overstimulated puppy.",
  ),
  milestone(
    "day-54-go-home-skills",
    54,
    "Go-home skills are coming together",
    "Feeding routines, gentle confinement, handling, name recognition, household sounds, and brief individual experiences are helping {{puppy_name}} build a foundation for the transition to the new family.",
  ),
  milestone("dewormed-week-8", 56, "Dewormed", ""),
  milestone(
    "day-56-new-chapter",
    56,
    "A new chapter is getting closer for {{puppy_name}}",
    "At about eight weeks, {{puppy_name}} is more socially engaged, physically coordinated, and ready for continued learning. The next stage is built around a gentle transition, predictable care, and a strong bond with the family.",
  ),
  milestone(
    "day-60-calm-independence",
    60,
    "Practicing calm independence",
    "Brief, comfortable periods away from littermates help {{puppy_name}} practice settling without feeling abandoned. The goal is confidence through short successful experiences, never prolonged distress.",
  ),
  milestone(
    "day-64-learning-routines",
    64,
    "{{puppy_name}} is learning what comes next",
    "Consistent cues around meals, sleep, bathroom opportunities, handling, and quiet time make the day easier to understand. Repetition helps {{puppy_name}} feel secure and prepared for household routines.",
  ),
  milestone(
    "day-68-confidence-changes",
    68,
    "Confidence through gentle changes",
    "Small changes in location, sounds, surfaces, toys, and people give {{puppy_name}} a chance to investigate safely. New experiences are kept positive and paced according to the puppy's comfort.",
  ),
  milestone(
    "day-72-growing-relationship",
    72,
    "The bond with people is growing",
    "{{puppy_name}} is increasingly interested in human attention, play, and guidance. Warm, consistent interactions help build trust and make early training feel like a natural part of the relationship.",
  ),
  milestone(
    "day-77-individual-needs",
    77,
    "Following {{puppy_name}}'s individual pace",
    "Puppies do not all mature on the same schedule. Appetite, size, confidence, stamina, and readiness are considered individually so {{puppy_name}} can continue developing without being rushed.",
  ),
  milestone(
    "day-84-twelve-week",
    84,
    "Twelve weeks of growing, learning, and becoming {{puppy_name}}",
    "By twelve weeks, personality and learning style are becoming much clearer. Positive social experiences, gentle training, regular rest, careful feeding, and close supervision remain important as {{puppy_name}} enters the next stage of puppyhood.",
  ),
];

export const defaultBuyerMilestoneConfig: BuyerMilestoneConfig = {
  version: 2,
  updatedAt: "",
  excludePastAdoptions: true,
  excludedBuyerIds: [],
  milestones: defaultBuyerMilestones,
};

const legacyDefaultIds = new Set([
  "eyes-beginning-week-2",
  "eyes-open-week-2",
  "dewormed-week-2",
  "early-socialization-week-3",
  "exploration-week-4",
  "dewormed-week-4",
  "social-skills-week-5",
  "dewormed-week-6",
  "go-home-foundation-week-7",
  "dewormed-week-8",
]);

const cleanId = (value: unknown, fallback: string) => {
  const cleaned = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || fallback;
};

const cleanBuyerIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((buyerId) => Number.isInteger(buyerId) && buyerId > 0))].slice(0, 1_000)
  : [];

const cleanBuyerFacingText = (value: unknown) => String(value ?? "")
  .replace(/\bautomatically\b/gi, "on schedule")
  .replace(/\bautomated\b/gi, "scheduled")
  .replace(/\bautomatic\b/gi, "scheduled")
  .replace(/\bautomation\b/gi, "schedule")
  .trim();

function normalizeRule(raw: unknown, index: number): BuyerMilestoneRule {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const legacyWeek = Math.max(1, Math.min(52, Math.round(Number(item.week) || 1)));
  const day = Math.max(1, Math.min(365, Math.round(Number(item.day) || legacyWeek * 7)));
  return {
    id: cleanId(item.id, `milestone-${index + 1}`),
    title: cleanBuyerFacingText(item.title || "Puppy development update").slice(0, 160) || "Puppy development update",
    body: cleanBuyerFacingText(item.body).slice(0, 5_000),
    day,
    enabled: item.enabled !== false,
    excludedBuyerIds: cleanBuyerIds(item.excludedBuyerIds),
  };
}

export function mergeBuyerMilestoneConfig(value: unknown): BuyerMilestoneConfig {
  const incoming = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const incomingVersion = Number(incoming.version) || 1;
  const incomingRules = Array.isArray(incoming.milestones) ? incoming.milestones : [];
  let source: BuyerMilestoneRule[];

  if (incomingVersion >= 2) {
    source = (incomingRules.length ? incomingRules : defaultBuyerMilestones).slice(0, 200).map(normalizeRule);
  } else {
    const legacyById = new Map<string, Record<string, unknown>>();
    incomingRules.forEach((raw) => {
      if (raw && typeof raw === "object") {
        const item = raw as Record<string, unknown>;
        legacyById.set(cleanId(item.id, ""), item);
      }
    });

    source = defaultBuyerMilestones.map((defaultRule) => {
      const legacy = legacyById.get(defaultRule.id);
      return legacy ? {
        ...defaultRule,
        enabled: legacy.enabled !== false,
        excludedBuyerIds: cleanBuyerIds(legacy.excludedBuyerIds),
      } : { ...defaultRule };
    });

    incomingRules.forEach((raw, index) => {
      const normalized = normalizeRule(raw, index);
      if (!legacyDefaultIds.has(normalized.id) && !source.some((rule) => rule.id === normalized.id)) source.push(normalized);
    });
  }

  const seen = new Set<string>();
  const milestones = source.map((rule, index) => {
    let id = cleanId(rule.id, `milestone-${index + 1}`);
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return { ...rule, id };
  });

  return {
    version: 2,
    updatedAt: String(incoming.updatedAt ?? ""),
    excludePastAdoptions: incoming.excludePastAdoptions !== false,
    excludedBuyerIds: cleanBuyerIds(incoming.excludedBuyerIds),
    milestones,
  };
}
