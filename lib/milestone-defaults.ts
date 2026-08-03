export type BuyerMilestoneRule = {
  id: string;
  title: string;
  body: string;
  week: number;
  enabled: boolean;
  excludedBuyerIds: number[];
};

export type BuyerMilestoneConfig = {
  version: 1;
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

export const defaultBuyerMilestones: BuyerMilestoneRule[] = [
  {
    id: "eyes-beginning-week-2",
    title: "Eyes beginning to open",
    body: "At this stage, puppies commonly begin opening their eyes. Vision is still developing, and the litter remains closely monitored in a calm, protected environment.",
    week: 2,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "eyes-open-week-2",
    title: "Eyes open and adjusting",
    body: "The eyes are generally open by this stage, although vision is still immature. Gentle handling and careful environmental monitoring continue.",
    week: 2,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "dewormed-week-2",
    title: "Dewormed",
    body: "",
    week: 2,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "early-socialization-week-3",
    title: "Early socialization begins",
    body: "Age-appropriate handling and calm exposure to normal household sounds begin as the puppy becomes more aware of people, movement, and the surrounding environment.",
    week: 3,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "exploration-week-4",
    title: "Exploration and confidence milestone",
    body: "The puppy is entering a more active learning period with supervised exploration, gentle handling, new textures, and carefully managed social experiences.",
    week: 4,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "dewormed-week-4",
    title: "Dewormed",
    body: "",
    week: 4,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "social-skills-week-5",
    title: "Social skills are developing",
    body: "Play, communication with littermates, handling tolerance, and confidence-building experiences continue under close supervision.",
    week: 5,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "dewormed-week-6",
    title: "Dewormed",
    body: "",
    week: 6,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "go-home-foundation-week-7",
    title: "Go-home foundation work",
    body: "Routine development now includes age-appropriate preparation for household life, handling, feeding transitions, early confinement skills, and individual observation.",
    week: 7,
    enabled: true,
    excludedBuyerIds: [],
  },
  {
    id: "dewormed-week-8",
    title: "Dewormed",
    body: "",
    week: 8,
    enabled: true,
    excludedBuyerIds: [],
  },
];

export const defaultBuyerMilestoneConfig: BuyerMilestoneConfig = {
  version: 1,
  updatedAt: "",
  excludePastAdoptions: true,
  excludedBuyerIds: [],
  milestones: defaultBuyerMilestones,
};

const cleanId = (value: unknown, fallback: string) => {
  const cleaned = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || fallback;
};

const cleanBuyerIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((buyerId) => Number.isInteger(buyerId) && buyerId > 0))].slice(0, 1_000)
  : [];

export function mergeBuyerMilestoneConfig(value: unknown): BuyerMilestoneConfig {
  const incoming = value && typeof value === "object" ? value as Partial<BuyerMilestoneConfig> : {};
  const source = Array.isArray(incoming.milestones) ? incoming.milestones : defaultBuyerMilestones;
  const seen = new Set<string>();
  const milestones = source.slice(0, 100).map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Partial<BuyerMilestoneRule> : {};
    let id = cleanId(item.id, `milestone-${index + 1}`);
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return {
      id,
      title: String(item.title ?? "Puppy milestone").trim().slice(0, 160) || "Puppy milestone",
      body: String(item.body ?? "").trim().slice(0, 5_000),
      week: Math.max(1, Math.min(52, Math.round(Number(item.week) || 1))),
      enabled: item.enabled !== false,
      excludedBuyerIds: cleanBuyerIds(item.excludedBuyerIds),
    };
  });
  return {
    version: 1,
    updatedAt: String(incoming.updatedAt ?? ""),
    excludePastAdoptions: incoming.excludePastAdoptions !== false,
    excludedBuyerIds: cleanBuyerIds(incoming.excludedBuyerIds),
    milestones,
  };
}
