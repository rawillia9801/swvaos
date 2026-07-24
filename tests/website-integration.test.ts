import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationBuyerInput,
  isAllowedWebsiteOrigin,
  normalizeWebsiteApplication,
  publicPuppy,
  websiteCorsHeaders,
} from "../lib/website-integration.ts";

const validApplication = {
  full_name: "Jane Applicant",
  email: "JANE@EXAMPLE.COM",
  phone: "(276) 555-0199",
  city_state: "Marion, VA",
  age_confirm: "Yes",
  sex_pref: "Female",
  color_pref: "Cream",
  home_type: "House",
  current_pets: "One calm adult dog",
  ack_policies: true,
  ack_financial: true,
  ack_truth: true,
  ack_contact: true,
};

test("accepts only the production website origins", () => {
  assert.equal(isAllowedWebsiteOrigin("https://swvachihuahua.com"), true);
  assert.equal(isAllowedWebsiteOrigin("https://www.swvachihuahua.com"), true);
  assert.equal(isAllowedWebsiteOrigin("https://example.com"), false);
  assert.equal(websiteCorsHeaders("https://swvachihuahua.com").get("access-control-allow-origin"), "https://swvachihuahua.com");
  assert.equal(websiteCorsHeaders("https://example.com").has("access-control-allow-origin"), false);
});

test("normalizes the website application into a SWVAOS buyer", () => {
  const normalized = normalizeWebsiteApplication({ application: validApplication });
  const buyer = applicationBuyerInput(normalized, "2026-07-24T12:00:00.000Z");
  assert.equal(normalized.email, "jane@example.com");
  assert.equal(buyer.first_name, "Jane");
  assert.equal(buyer.last_name, "Applicant");
  assert.equal(buyer.city, "Marion");
  assert.equal(buyer.state, "VA");
  assert.equal(buyer.application_status, "Applied");
  assert.equal(buyer.preferred_sex, "Female");
  assert.match(String(buyer.notes), /Tiny-puppy safety plan|Website puppy application/);
});

test("rejects incomplete acknowledgements and honeypot submissions", () => {
  assert.throws(() => normalizeWebsiteApplication({ ...validApplication, ack_truth: false }), /acknowledgements/);
  assert.throws(() => normalizeWebsiteApplication({ ...validApplication, company: "Spam LLC" }), /Unable to accept/);
});

test("publishes only available, unassigned puppy fields", () => {
  assert.deepEqual(publicPuppy({
    id: 7,
    name: "Honey",
    sex: "Female",
    color: "Cream",
    birth_date: "2026-06-01",
    status: "Available",
    price_cents: 420000,
    buyer_id: null,
    notes: "private staff note",
  }), {
    id: 7,
    name: "Honey",
    sex: "Female",
    color: "Cream",
    birth_date: "2026-06-01",
    status: "Available",
    price: 4200,
    photo_url: null,
  });
  assert.equal(publicPuppy({ id: 8, status: "Reserved", buyer_id: null }), null);
  assert.equal(publicPuppy({ id: 9, status: "Available", buyer_id: 3 }), null);
});
