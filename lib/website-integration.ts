import type { ResourceInput } from "../db/resources";

const WEBSITE_ORIGINS = new Set([
  "https://swvachihuahua.com",
  "https://www.swvachihuahua.com",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const APPLICATION_FIELDS = [
  ["co_applicant", "Co-applicant"],
  ["age_confirm", "Applicant is 18+"],
  ["preferred_contact", "Preferred contact"],
  ["best_time", "Best time to reach"],
  ["how_hear", "How they heard about us"],
  ["street_address", "Street address"],
  ["home_type", "Home type"],
  ["own_or_rent", "Own or rent"],
  ["housing_permission", "Pets permitted confirmation"],
  ["household_details", "Household and primary caregiver"],
  ["children_ages", "Children / ages"],
  ["frequent_young_visitors", "Frequent young visitors"],
  ["yard_type", "Outdoor setup"],
  ["move_travel", "Upcoming move or travel"],
  ["work_schedule", "Work / school schedule"],
  ["hours_alone", "Hours puppy will be alone"],
  ["backup_caregiver", "Backup caregiver"],
  ["current_pets", "Current pets"],
  ["vaccinated_pets", "Current pets vaccinated"],
  ["altered_pets", "Current pets altered"],
  ["chihuahua_exp", "Chihuahua experience"],
  ["toy_breed_exp", "Toy breed experience"],
  ["rehomed_history", "Rehoming / surrender history"],
  ["animal_incident_history", "Animal safety history"],
  ["planned_vet", "Planned routine veterinary practice"],
  ["emergency_vet", "Planned emergency veterinary hospital"],
  ["sex_pref", "Sex preference"],
  ["coat_pref", "Coat preference"],
  ["registry_pref", "Registry preference"],
  ["placement_pref", "Placement size preference"],
  ["color_pref", "Color / markings preference"],
  ["purpose", "Purpose"],
  ["timeline", "Ideal timeframe"],
  ["budget", "Budget range"],
  ["specific_puppy", "Specific puppy or litter"],
  ["temperament", "Temperament / lifestyle match"],
  ["essential_preferences", "Essential versus flexible preferences"],
  ["tiny_interest", "Interested in exceptionally small puppy"],
  ["tiny_feedings", "Every-two-hour feeding readiness"],
  ["tiny_overnight", "Overnight monitoring readiness"],
  ["tiny_care_plan", "Small-puppy care and emergency plan"],
  ["where_day", "Where puppy will stay during the day"],
  ["where_sleep", "Where puppy will sleep"],
  ["training_plan", "Training plan"],
  ["travel_restraint", "Travel restraint"],
  ["tiny_safety", "Tiny-puppy safety plan"],
  ["socialization_plan", "Pre-vaccination socialization plan"],
  ["breeding_intent", "Breeding intention"],
  ["breeding_experience", "Breeding experience"],
  ["breeding_plan", "Breeding and health-testing plan"],
  ["payment_method", "Expected payment method"],
  ["deposit_readiness", "Deposit readiness"],
  ["payment_plan_review", "Payment-plan review requested"],
  ["transfer_method", "Preferred pickup or delivery"],
  ["starting_location", "Starting city / state"],
  ["transport_assistance", "Transportation assistance"],
  ["scheduling_limits", "Scheduling limitations"],
  ["ref1_name", "Reference 1"],
  ["ref1_phone", "Reference 1 phone / email"],
  ["ref2_name", "Reference 2"],
  ["ref2_phone", "Reference 2 phone / email"],
  ["why_us", "Why Southwest Virginia Chihuahua"],
  ["notes", "Additional notes"],
  ["communication_preferences", "Communication preferences"],
] as const;

const REQUIRED_ACKNOWLEDGEMENTS = [
  "ack_policies",
  "ack_financial",
  "ack_truth",
  "ack_records",
  "ack_small_puppy",
] as const;

export type WebsiteApplication = Record<string, string | boolean>;

function cleanString(value: unknown, maximum = 2_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maximum)
    : "";
}

function cleanBoolean(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "yes";
}

export function isAllowedWebsiteOrigin(origin: string | null) {
  return Boolean(origin && WEBSITE_ORIGINS.has(origin));
}

export function websiteCorsHeaders(origin: string | null) {
  const headers = new Headers({
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  });
  if (isAllowedWebsiteOrigin(origin)) headers.set("access-control-allow-origin", origin!);
  return headers;
}

export function normalizeWebsiteApplication(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("The application payload is invalid.");
  }

  const record = body as Record<string, unknown>;
  const nested = record.application;
  const source = nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : record;
  const application: WebsiteApplication = {};

  for (const [key] of APPLICATION_FIELDS) application[key] = cleanString(source[key]);
  for (const key of ["full_name", "email", "phone", "city_state", "company"]) {
    application[key] = cleanString(source[key], key === "email" ? 254 : 200);
  }
  for (const key of REQUIRED_ACKNOWLEDGEMENTS) application[key] = cleanBoolean(source[key]);

  const fullName = String(application.full_name);
  const email = String(application.email).toLowerCase();
  const phone = String(application.phone);
  if (application.company) throw new Error("Unable to accept this application.");
  if (fullName.length < 2) throw new Error("Enter the applicant's full name.");
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address.");
  if (phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number.");
  if (application.age_confirm !== "Yes") throw new Error("The applicant must be 18 or older.");
  if (!REQUIRED_ACKNOWLEDGEMENTS.every((key) => application[key] === true)) {
    throw new Error("All required acknowledgements must be accepted, including the small-puppy policy.");
  }

  application.email = email;
  return application;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Applicant",
    lastName: parts.slice(1).join(" ") || "Not provided",
  };
}

function splitCityState(value: string) {
  const [city, ...stateParts] = value.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: city || null,
    state: stateParts.join(", ") || null,
  };
}

export function formatApplicationNotes(application: WebsiteApplication, receivedAt: string) {
  const lines = APPLICATION_FIELDS.flatMap(([key, label]) => {
    const value = application[key];
    return value === "" || value == null ? [] : [`${label}: ${String(value)}`];
  });
  return [
    `Website puppy application received ${receivedAt}`,
    "Source: swvachihuahua.com/application",
    "Small-puppy policy acknowledged: Yes",
    "Applicant record-use authorization acknowledged: Yes",
    "",
    ...lines,
  ].join("\n").slice(0, 30_000);
}

export function applicationBuyerInput(application: WebsiteApplication, receivedAt: string): ResourceInput {
  const { firstName, lastName } = splitName(String(application.full_name));
  const { city, state } = splitCityState(String(application.city_state));
  return {
    first_name: firstName,
    last_name: lastName,
    email: String(application.email),
    phone: String(application.phone),
    city,
    state,
    application_status: "Applied",
    preferred_sex: cleanString(application.sex_pref, 80) || null,
    preferred_color: cleanString(application.color_pref, 160) || null,
    household_notes: [
      cleanString(application.street_address, 300),
      cleanString(application.home_type, 120),
      cleanString(application.own_or_rent, 120),
      cleanString(application.housing_permission, 200),
      cleanString(application.household_details, 1_000),
      cleanString(application.children_ages, 500),
      cleanString(application.current_pets, 1_000),
    ].filter(Boolean).join(" | ") || null,
    notes: formatApplicationNotes(application, receivedAt),
  };
}

function publicUrl(value: unknown) {
  const raw = cleanString(value, 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function publicPuppy(row: Record<string, unknown>) {
  const status = cleanString(row.status, 80);
  if (!status.toLowerCase().includes("avail") || row.buyer_id != null) return null;
  const priceCents = Number(row.price_cents);
  return {
    id: Number(row.id),
    name: cleanString(row.name, 160) || "Unnamed puppy",
    sex: cleanString(row.sex, 80) || null,
    color: cleanString(row.color, 160) || null,
    birth_date: cleanString(row.birth_date, 40) || null,
    status: "Available",
    price: Number.isFinite(priceCents) && priceCents >= 0 ? priceCents / 100 : null,
    photo_url: publicUrl(row.photo_url ?? row.image_url),
  };
}
