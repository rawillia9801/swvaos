"use client";

import { useEffect } from "react";

type SectionGuide = { label: string; summary: string; points: string[]; symbol: string };

const defaultGuide: SectionGuide = {
  label: "PERSONALIZED REFERENCE",
  summary: "A practical reference page prepared specifically for this puppy and family.",
  points: ["Keep this page with the puppy's records.", "Add family notes as routines develop.", "Share relevant information with the family veterinarian."],
  symbol: "✦",
};

const guides: Array<{ match: RegExp; guide: SectionGuide }> = [
  { match: /welcome home/i, guide: { label: "WELCOME HOME", summary: "A warm introduction to the care plan, records, and support prepared for the family.", points: ["Review the entire binder before go-home day.", "Keep emergency contacts easy to reach.", "Bring the binder to the first veterinary appointment."], symbol: "♥" } },
  { match: /first 72 hours/i, guide: { label: "FIRST DAYS TOGETHER", summary: "A calm, predictable start helps a young Chihuahua feel secure, eat reliably, rest, and begin bonding.", points: ["Keep the first days quiet and consistent.", "Observe every meal and bathroom break.", "Limit visitors and unnecessary travel."], symbol: "⌂" } },
  { match: /feeding and water/i, guide: { label: "DAILY NUTRITION", summary: "Small, measured meals and close observation help protect a young puppy's energy and growth.", points: ["Follow the provided food and schedule.", "Record intake when appetite changes.", "Make food changes gradually."], symbol: "◌" } },
  { match: /pup-lift|hypoglycemia/i, guide: { label: "EMERGENCY READINESS", summary: "Toy-breed puppies can decline quickly when blood sugar drops. Preparation and fast action matter.", points: ["Know the early warning signs.", "Keep Pup-Lift supplies accessible.", "Contact a veterinarian immediately during an emergency."], symbol: "+" } },
  { match: /call a veterinarian/i, guide: { label: "WHEN TO SEEK CARE", summary: "This page separates urgent warning signs from concerns that require a same-day veterinary call.", points: ["Trust significant behavior changes.", "Give the clinic the puppy's current weight.", "Do not delay care for collapse, seizures, or breathing trouble."], symbol: "!" } },
  { match: /vaccines|disease prevention/i, guide: { label: "DISEASE PREVENTION", summary: "Protection develops through a veterinary vaccine series and careful management of exposure risk.", points: ["Bring all records to the first appointment.", "Avoid high-risk public ground.", "Follow the veterinarian's schedule."], symbol: "◇" } },
  { match: /parasites|fleas|ticks|heartworms/i, guide: { label: "PREVENTIVE CARE", summary: "Age- and weight-appropriate prevention should always be selected with veterinary guidance.", points: ["Keep the deworming history together.", "Ask about fecal testing.", "Never estimate medication doses."], symbol: "◎" } },
  { match: /socialization/i, guide: { label: "CONFIDENCE BUILDING", summary: "Positive, controlled experiences help a puppy become confident without unnecessary disease exposure.", points: ["Keep experiences short and positive.", "Use healthy, known dogs for introductions.", "Give the puppy space when overwhelmed."], symbol: "✧" } },
  { match: /potty training/i, guide: { label: "CONSISTENT ROUTINES", summary: "Frequent opportunities, close supervision, and immediate rewards are the foundation of potty training.", points: ["Use the same bathroom area.", "Reward immediately after success.", "Clean accidents with an enzymatic cleaner."], symbol: "✓" } },
  { match: /crate training|alone-time/i, guide: { label: "SAFE INDEPENDENCE", summary: "Short, positive practice teaches calm rest and healthy alone-time skills without prolonged isolation.", points: ["Begin with very short sessions.", "Pair the crate with meals and rest.", "Plan frequent bathroom breaks."], symbol: "□" } },
  { match: /sleep|routine|settling/i, guide: { label: "REST & RHYTHM", summary: "Young puppies need substantial sleep and a predictable cycle of meals, play, bathroom breaks, and rest.", points: ["Protect quiet sleep periods.", "Avoid elevated sleeping surfaces.", "Use a consistent daily rhythm."], symbol: "☾" } },
  { match: /training and chihuahua behavior/i, guide: { label: "LIFELONG SKILLS", summary: "Kind, consistent training helps a Chihuahua become confident, responsive, and safe in everyday life.", points: ["Keep sessions brief.", "Reward the behavior you want repeated.", "Address guarding or fear early."], symbol: "★" } },
  { match: /children|visitors|other pets/i, guide: { label: "SAFE INTERACTIONS", summary: "Tiny puppies need direct adult supervision around children, visitors, and larger animals.", points: ["Use barriers and controlled introductions.", "Never allow chasing or rough carrying.", "Give the puppy a protected rest area."], symbol: "♢" } },
  { match: /grooming|nails|ears|coat/i, guide: { label: "ROUTINE GROOMING", summary: "Gentle handling from an early age makes coat, nail, ear, and skin care easier throughout life.", points: ["Keep sessions short and calm.", "Trim nails in small amounts.", "Dry the puppy thoroughly after bathing."], symbol: "✂" } },
  { match: /dental care/i, guide: { label: "DENTAL HEALTH", summary: "Toy breeds benefit from early dental handling and consistent home care.", points: ["Use dog-safe toothpaste only.", "Work toward daily brushing.", "Ask about retained baby teeth."], symbol: "◈" } },
  { match: /home safety|poison prevention/i, guide: { label: "PUPPY-PROOFING", summary: "A Chihuahua can fit into small spaces and be injured by hazards that may not threaten a larger dog.", points: ["Block falls and escape routes.", "Secure medications and toxins.", "Check recliners and doors before moving them."], symbol: "⚑" } },
  { match: /harnesses|identification/i, guide: { label: "SECURE & IDENTIFIED", summary: "Lightweight, properly fitted equipment helps protect the puppy during walks and travel.", points: ["Recheck fit while the puppy grows.", "Keep identification current.", "Avoid pressure concentrated on the neck."], symbol: "⌁" } },
  { match: /travel and car safety/i, guide: { label: "SAFE TRAVEL", summary: "A secure carrier, planned meals, and clean low-risk stops make travel safer and less stressful.", points: ["Use a secured carrier or rated restraint.", "Keep food, water, records, and Pup-Lift together.", "Never leave the puppy in a vehicle."], symbol: "➜" } },
  { match: /growth and development/i, guide: { label: "GROWTH TRACKING", summary: "Regular weights and observations reveal more than a single measurement and help identify changes early.", points: ["Use the same scale when possible.", "Record dates with every weight.", "Report weight loss or poor gain promptly."], symbol: "↗" } },
  { match: /pet insurance|financial readiness/i, guide: { label: "PREPARED FOR CARE", summary: "Insurance, accessible records, and an emergency fund help families make timely care decisions.", points: ["Activate coverage before the deadline.", "Understand waiting periods and exclusions.", "Keep receipts and medical records together."], symbol: "$" } },
  { match: /emergency plan/i, guide: { label: "READY BEFORE NEEDED", summary: "An emergency plan should be written, easy to find, and understood by every caregiver.", points: ["Save the primary and emergency clinic numbers.", "Keep a secure carrier ready.", "Know who can transport the puppy."], symbol: "✚" } },
  { match: /go-home checklist/i, guide: { label: "FINAL PREPARATION", summary: "A final review helps make sure the home, records, supplies, and care plan are ready before transfer.", points: ["Confirm food and feeding instructions.", "Schedule the required veterinary visit.", "Save breeder and emergency contacts."], symbol: "✓" } },
  { match: /health and care logs/i, guide: { label: "FAMILY RECORDKEEPING", summary: "Use these logs to preserve an accurate history of weights, medications, prevention, and veterinary care.", points: ["Date every entry.", "Record exact product and dose information.", "Bring the logs to veterinary appointments."], symbol: "≡" } },
  { match: /notes and records/i, guide: { label: "YOUR FAMILY NOTES", summary: "A dedicated place for questions, instructions, registration details, insurance information, and important observations.", points: ["Write down questions before appointments.", "File receipts and reports behind this page.", "Record changes in routine or behavior."], symbol: "✎" } },
];

function guideFor(title: string) { return guides.find((entry) => entry.match.test(title))?.guide ?? defaultGuide; }
function textOf(element: Element | null) { return element?.textContent?.trim() || ""; }
function fieldValue(cover: Element, label: string) {
  const fields = Array.from(cover.querySelectorAll(".field"));
  const found = fields.find((field) => textOf(field.querySelector("span")).toLowerCase() === label.toLowerCase());
  return textOf(found?.querySelector("strong"));
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "SW"; }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function categoryFor(title: string) {
  if (/welcome|first 72|feeding|pup-lift|veterinarian|vaccines|parasites/i.test(title)) return "Getting Started & Health";
  if (/socialization|potty|crate|sleep|training|children|grooming|dental/i.test(title)) return "Daily Life & Training";
  if (/safety|harness|travel|growth|insurance|emergency|checklist|logs|notes/i.test(title)) return "Safety, Planning & Records";
  return "Personalized Puppy Care";
}

function applyDesign() {
  if (!window.location.pathname.startsWith("/puppy-packet")) return;
  const packet = document.querySelector<HTMLElement>("article.packet");
  if (!packet) return;
  const cover = packet.querySelector<HTMLElement>(".binder-cover");

  if (cover && cover.dataset.redesigned !== "true") {
    const puppy = fieldValue(cover, "Puppy") || textOf(cover.querySelector("h1")).replace(/'s.*$/s, "").trim() || "Your Puppy";
    const family = fieldValue(cover, "Family") || "Your Family";
    const birthDate = fieldValue(cover, "Date of birth") || "Not recorded";
    const packetDate = fieldValue(cover, "Go-home packet date") || "Prepared for go-home";
    cover.dataset.redesigned = "true";
    cover.innerHTML = `
      <div class="designer-cover-art" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="designer-cover-topline"><b>Southwest Virginia Chihuahua</b><em>Personalized Go-Home Collection</em></div>
      <div class="designer-cover-main">
        <div class="designer-cover-copy">
          <div class="designer-cover-mark">${escapeHtml(initials(puppy))}</div>
          <p class="designer-cover-kicker">Created especially for ${escapeHtml(family)}</p>
          <h1>${escapeHtml(puppy)}<span>Puppy Care Binder</span></h1>
          <p class="designer-cover-intro">A personal collection of care guidance, emergency preparation, puppy records, family resources, and practical support for the first days home and the years ahead.</p>
        </div>
        <div class="designer-cover-profile">
          <div><span>PUPPY</span><strong>${escapeHtml(puppy)}</strong></div>
          <div><span>FAMILY</span><strong>${escapeHtml(family)}</strong></div>
          <div><span>DATE OF BIRTH</span><strong>${escapeHtml(birthDate)}</strong></div>
          <div><span>PACKET DATE</span><strong>${escapeHtml(packetDate)}</strong></div>
        </div>
      </div>
      <div class="designer-cover-features">
        <div><i>01</i><span><b>Everyday Care</b><small>Feeding, routines, training, grooming, and settling in.</small></span></div>
        <div><i>02</i><span><b>Health & Safety</b><small>Pup-Lift readiness, prevention, warning signs, and emergencies.</small></span></div>
        <div><i>03</i><span><b>Personal Records</b><small>Weights, care history, important documents, and family notes.</small></span></div>
      </div>
      <div class="designer-cover-footer"><span>Marion, Virginia</span><span>swvachihuahua.com</span><span>Pup-Lift · pup-lift.com · 1-715-888-9526</span></div>`;
  }

  const sections = Array.from(packet.querySelectorAll<HTMLElement>(".packet-section"));
  const tocSection = sections.find((section) => textOf(section.querySelector("h2")).toLowerCase() === "table of contents");
  if (tocSection && tocSection.dataset.redesigned !== "true") {
    const puppy = fieldValue(cover || packet, "Puppy") || textOf(cover?.querySelector("h1")).split("Puppy Care Binder")[0].trim() || "Your Puppy";
    const family = fieldValue(cover || packet, "Family") || "Your Family";
    const originalItems = Array.from(tocSection.querySelectorAll("ol.toc li")).map((item) => textOf(item)).filter(Boolean);
    const grouped = new Map<string, string[]>();
    for (const item of originalItems) { const category = categoryFor(item); grouped.set(category, [...(grouped.get(category) || []), item]); }
    tocSection.dataset.redesigned = "true";
    tocSection.innerHTML = `
      <div class="designer-toc-heading"><div><span>YOUR PERSONALIZED GUIDE</span><h2>Inside ${escapeHtml(puppy)}'s Binder</h2><p>Everything in this packet is organized so ${escapeHtml(family)} can quickly find care instructions, safety information, and records when they are needed.</p></div><div class="designer-toc-count"><b>${originalItems.length}</b><small>care and reference sections</small></div></div>
      <div class="designer-toc-groups">${Array.from(grouped.entries()).map(([category, items], groupIndex) => `<section><header><i>0${groupIndex + 1}</i><h3>${escapeHtml(category)}</h3></header><ol>${items.map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(item)}</b></li>`).join("")}</ol></section>`).join("")}</div>`;
  }

  for (const section of sections) {
    if (section === tocSection || section.dataset.expanded === "true") continue;
    const heading = section.querySelector<HTMLHeadingElement>(":scope > h2");
    if (!heading) continue;
    const guide = guideFor(textOf(heading));
    const puppy = fieldValue(cover || packet, "Puppy") || "your puppy";
    const family = fieldValue(cover || packet, "Family") || "your family";
    const hero = document.createElement("div");
    hero.className = "designer-section-hero avoid-break";
    hero.innerHTML = `<div class="designer-section-symbol">${escapeHtml(guide.symbol)}</div><div class="designer-section-copy"><span>${escapeHtml(guide.label)}</span><p>${escapeHtml(guide.summary)}</p><small>Prepared specifically for ${escapeHtml(family)} and ${escapeHtml(puppy)}.</small></div><ul>${guide.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`;
    heading.insertAdjacentElement("afterend", hero);
    section.dataset.expanded = "true";
  }
}

export function PuppyPacketDesignEnhancer() {
  useEffect(() => {
    if (!window.location.pathname.startsWith("/puppy-packet")) return;
    applyDesign();
    const observer = new MutationObserver(() => applyDesign());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
