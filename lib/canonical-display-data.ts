import "server-only";

type Row = Record<string, unknown>;
type Data = Record<string, unknown>;

const id = (row: Row) => Number(row.id) || 0;
const text = (row: Row, key: string) => String(row[key] ?? "").trim();
const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const email = (row: Row) => text(row, "email").toLowerCase();
const phone = (row: Row) => text(row, "phone").replace(/\D/g, "").slice(-10);
const name = (row: Row) => normalize(`${text(row, "first_name")} ${text(row, "last_name")}`);
const zip = (row: Row) => String(row.postal_code ?? row.zip ?? row.zipcode ?? "").replace(/\D/g, "").slice(0, 5);
const location = (row: Row) => normalize(`${text(row, "city")} ${text(row, "state")}`);
const imported = (row: Row) => /\[SWVAOS import:/i.test(text(row, "notes"));

function buyerKeys(row: Row) {
  const normalizedName = name(row);
  const normalizedPhone = phone(row);
  const normalizedZip = zip(row);
  const normalizedLocation = location(row);
  return [
    normalizedName ? `name:${normalizedName}` : "",
    email(row) ? `email:${email(row)}` : "",
    normalizedName && normalizedPhone ? `name-phone:${normalizedName}|${normalizedPhone}` : "",
    normalizedName && normalizedZip ? `name-zip:${normalizedName}|${normalizedZip}` : "",
    normalizedName && normalizedLocation ? `name-location:${normalizedName}|${normalizedLocation}` : "",
  ].filter(Boolean);
}

function buyerGroups(rows: Row[]) {
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
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
  };

  for (const row of rows) parent.set(id(row), id(row));
  for (const row of rows) {
    for (const key of buyerKeys(row)) {
      const prior = byKey.get(key);
      if (prior) union(prior, id(row));
      else byKey.set(key, id(row));
    }
  }

  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const root = find(id(row));
    groups.set(root, [...(groups.get(root) || []), row]);
  }
  return [...groups.values()];
}

function relationshipCount(buyerId: number, data: Data) {
  const puppies = (data.puppies as Row[] | undefined) || [];
  const transactions = (data.transactions as Row[] | undefined) || [];
  const plans = (data.payment_plans as Row[] | undefined) || [];
  const documents = (data.buyer_documents as Row[] | undefined) || [];
  return puppies.filter((row) => Number(row.buyer_id) === buyerId).length * 8
    + transactions.filter((row) => Number(row.buyer_id) === buyerId).length * 4
    + plans.filter((row) => Number(row.buyer_id) === buyerId).length * 5
    + documents.filter((row) => Number(row.buyer_id) === buyerId).length * 3;
}

function buyerScore(row: Row, data: Data) {
  const fields = ["first_name", "last_name", "email", "phone", "city", "state", "postal_code", "application_status", "preferred_sex", "preferred_color", "household_notes", "notes"];
  const completeness = fields.reduce((total, key) => total + (text(row, key) ? 1 : 0), 0);
  const active = ["declined", "archived", "closed"].includes(text(row, "application_status").toLowerCase()) ? -5 : 2;
  return relationshipCount(id(row), data) + completeness + active + (imported(row) ? -12 : 0);
}

function statusPriority(value: string) {
  const priorities: Record<string, number> = {
    placed: 90,
    matched: 80,
    approved: 70,
    waitlist: 65,
    "wait list": 65,
    applied: 50,
    review: 45,
    inquiry: 40,
    new: 35,
    declined: 10,
    archived: 5,
    closed: 5,
  };
  return priorities[value.toLowerCase()] ?? 30;
}

function mergeBuyer(primary: Row, group: Row[]) {
  const merged: Row = { ...primary };
  const fields = ["first_name", "last_name", "email", "phone", "city", "state", "postal_code", "preferred_sex", "preferred_color", "household_notes"];
  for (const key of fields) {
    if (text(merged, key)) continue;
    const replacement = group.map((row) => row[key]).find((value) => value !== null && value !== undefined && String(value).trim());
    if (replacement !== undefined) merged[key] = replacement;
  }
  const bestStatus = group
    .map((row) => text(row, "application_status"))
    .filter(Boolean)
    .sort((left, right) => statusPriority(right) - statusPriority(left))[0];
  if (bestStatus) merged.application_status = bestStatus;
  return merged;
}

function remapRows(rows: Row[] | undefined, field: string, mapping: Map<number, number>) {
  return (rows || []).map((row) => {
    const current = Number(row[field]) || 0;
    const replacement = mapping.get(current);
    return replacement && replacement !== current ? { ...row, [field]: replacement } : row;
  });
}

export function canonicalizeKennelData<T extends Data>(data: T): T {
  const buyers = ((data.buyers as Row[] | undefined) || []).filter((row) => id(row) > 0);
  if (buyers.length < 2) return data;

  const mapping = new Map<number, number>();
  const canonicalBuyers: Row[] = [];
  for (const group of buyerGroups(buyers)) {
    const primary = [...group].sort((left, right) => buyerScore(right, data) - buyerScore(left, data) || id(left) - id(right))[0];
    const primaryId = id(primary);
    group.forEach((row) => mapping.set(id(row), primaryId));
    canonicalBuyers.push(mergeBuyer(primary, group));
  }

  const puppies = remapRows(data.puppies as Row[] | undefined, "buyer_id", mapping);
  const transactions = remapRows(data.transactions as Row[] | undefined, "buyer_id", mapping);
  const plans = remapRows(data.payment_plans as Row[] | undefined, "buyer_id", mapping);
  const documents = remapRows(data.buyer_documents as Row[] | undefined, "buyer_id", mapping);
  const portalMessages = remapRows(data.portal_messages as Row[] | undefined, "buyer_id", mapping);
  const portalRequests = remapRows(data.portal_requests as Row[] | undefined, "buyer_id", mapping);
  const portalAccounts = remapRows(data.portal_accounts as Row[] | undefined, "buyer_id", mapping);
  const events = ((data.events as Row[] | undefined) || []).map((row) => {
    if (text(row, "related_type") !== "buyers") return row;
    const current = Number(row.related_id) || 0;
    const replacement = mapping.get(current);
    return replacement && replacement !== current ? { ...row, related_id: replacement } : row;
  });

  const assignedBuyerIds = new Set(puppies.map((row) => Number(row.buyer_id) || 0).filter(Boolean));
  const finalBuyers = canonicalBuyers.map((buyer) => {
    const status = text(buyer, "application_status").toLowerCase();
    if (assignedBuyerIds.has(id(buyer)) && !["placed", "declined", "archived", "closed"].includes(status)) {
      return { ...buyer, application_status: "Matched" };
    }
    return buyer;
  });

  return {
    ...data,
    buyers: finalBuyers,
    puppies,
    transactions,
    payment_plans: plans,
    buyer_documents: documents,
    portal_messages: portalMessages,
    portal_requests: portalRequests,
    portal_accounts: portalAccounts,
    events,
  } as T;
}
