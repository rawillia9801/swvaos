"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null };
type Puppy = { id: number; litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null };
type Litter = { id: number; name: string; dam_id: number | null; sire_id: number | null; birth_date: string | null };
type Dog = { id: number; name: string; registered_name: string | null; registration_number: string | null };
type PuppyUpdate = { id: number; puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; created_at: string };
type KennelEvent = { id: number; title: string; event_type: string; event_date: string; related_type: string | null; related_id: number | null; status: string; notes: string | null };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; litters: Litter[]; dogs: Dog[]; updates: PuppyUpdate[]; events: KennelEvent[] };

const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const buyerName = (buyer: Buyer | null) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email : "Not assigned";

function Section({ title, children, page = false }: { title: string; children: React.ReactNode; page?: boolean }) {
  return <section className={`packet-section${page ? " page-start" : ""}`}><h2>{title}</h2>{children}</section>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="field"><span>{label}</span><strong>{value || "Not recorded"}</strong></div>;
}

export default function PuppyPacketPage() {
  const [data, setData] = useState<DataSet | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load puppy records.");
      setData(payload);
      setSelectedId((current) => current ?? payload.puppies.find((puppy) => puppy.buyer_id)?.id ?? payload.puppies[0]?.id ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load puppy records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const packet = useMemo(() => {
    if (!data || !selectedId) return null;
    const puppy = data.puppies.find((item) => item.id === selectedId) ?? null;
    if (!puppy) return null;
    const buyer = puppy.buyer_id ? data.buyers.find((item) => item.id === puppy.buyer_id) ?? null : null;
    const litter = data.litters.find((item) => item.id === puppy.litter_id) ?? null;
    const dam = litter?.dam_id ? data.dogs.find((item) => item.id === litter.dam_id) ?? null : null;
    const sire = litter?.sire_id ? data.dogs.find((item) => item.id === litter.sire_id) ?? null : null;
    const updates = data.updates.filter((item) => item.puppy_id === puppy.id).sort((a, b) => b.id - a.id);
    const events = data.events.filter((item) => item.related_id === puppy.id && String(item.related_type || "").toLowerCase().includes("puppy")).sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
    return { puppy, buyer, litter, dam, sire, updates, events };
  }, [data, selectedId]);

  if (loading) return <main className="screen-state">Loading puppy packet...</main>;
  if (error || !data) return <main className="screen-state"><b>Unable to load the packet</b><p>{error}</p></main>;

  return <main className="packet-page">
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #eaf3f1; color: #173941; font-family: Arial, sans-serif; }
      .toolbar { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #bdd5d1; background: rgba(255,255,255,.97); box-shadow: 0 5px 22px rgba(18,66,68,.08); }
      .toolbar a { display: inline-flex; align-items: center; gap: 7px; color: #155f69; font-weight: 750; text-decoration: none; }
      .toolbar select { min-width: 260px; padding: 10px 12px; border: 1px solid #9dbfba; border-radius: 8px; background: white; color: #173941; }
      .toolbar button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 8px; background: #087f8c; color: white; font-weight: 800; cursor: pointer; }
      .packet { width: 8.5in; min-height: 11in; margin: 24px auto; padding: .58in .62in; background: white; box-shadow: 0 18px 55px rgba(15,55,58,.14); }
      .cover { min-height: 9.75in; display: flex; flex-direction: column; justify-content: center; text-align: center; border-top: 12px solid #0794a3; }
      .brand { color: #087885; font-size: 12px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 28px 0 12px; color: #103a44; font-size: 38px; line-height: 1.06; }
      .subtitle { margin: 0 auto 28px; max-width: 6.2in; color: #59767b; font-size: 16px; line-height: 1.55; }
      .identity { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 24px auto; max-width: 6.7in; text-align: left; }
      .field { padding: 10px 12px; border: 1px solid #d2e2df; border-radius: 7px; background: #f6faf9; }
      .field span { display: block; margin-bottom: 4px; color: #638083; font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      .field strong { display: block; overflow-wrap: anywhere; font-size: 12px; }
      .packet-section { margin: 22px 0; }
      .packet-section h2 { margin: 0 0 12px; padding: 8px 0; border-top: 5px solid #0794a3; color: #103a44; font-size: 22px; }
      .packet-section h3 { margin: 16px 0 7px; color: #076d78; font-size: 15px; }
      p, li { font-size: 11px; line-height: 1.5; }
      ul, ol { margin: 7px 0 12px; padding-left: 22px; }
      li { margin: 4px 0; }
      .notice { margin: 12px 0; padding: 12px 14px; border-left: 5px solid #c68b24; background: #fff7e8; }
      .urgent { border-left-color: #b33b3b; background: #fff0f0; }
      .contact-box { padding: 16px; border: 2px solid #0794a3; border-radius: 10px; background: #edf8f8; text-align: center; }
      .contact-box strong { display: block; color: #075f69; font-size: 18px; }
      .toc { columns: 2; column-gap: 36px; }
      .toc li { break-inside: avoid; }
      .log { width: 100%; border-collapse: collapse; }
      .log th, .log td { height: 28px; padding: 6px; border: 1px solid #bad0cd; text-align: left; font-size: 10px; }
      .log th { background: #e8f3f2; color: #075f69; }
      .page-start { break-before: page; page-break-before: always; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      .footer-note { margin-top: 28px; color: #627b7e; font-size: 9px; text-align: center; }
      .screen-state { padding: 60px 20px; text-align: center; }
      @page { size: Letter; margin: .5in; }
      @media print {
        body { background: white; }
        .toolbar { display: none !important; }
        .packet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
        .cover { min-height: 9.6in; }
        a { color: inherit; text-decoration: none; }
      }
      @media (max-width: 900px) { .packet { width: calc(100% - 24px); padding: 24px; } .identity { grid-template-columns: 1fr; } }
    `}</style>

    <div className="toolbar">
      <Link href="/"><ArrowLeft size={17} /> Back to SWVAOS</Link>
      <select value={selectedId ?? ""} onChange={(event) => setSelectedId(Number(event.target.value))} aria-label="Select puppy">
        {data.puppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name} — {puppy.buyer_id ? buyerName(data.buyers.find((buyer) => buyer.id === puppy.buyer_id) ?? null) : "No family assigned"}</option>)}
      </select>
      <button type="button" onClick={() => window.print()}><Printer size={18} /> Print Puppy Packet</button>
    </div>

    {packet && <article className="packet">
      <section className="cover">
        <div className="brand">Southwest Virginia Chihuahua</div>
        <h1>{packet.puppy.name}&apos;s<br />Puppy Care Packet</h1>
        <p className="subtitle">A personalized guide for the first days at home, lifelong Chihuahua care, emergency readiness, training, safety, and Pup-Lift support.</p>
        <div className="identity">
          <Field label="Puppy" value={packet.puppy.name} />
          <Field label="Family" value={buyerName(packet.buyer)} />
          <Field label="Date of birth" value={formatDate(packet.puppy.birth_date)} />
          <Field label="Sex / color" value={[packet.puppy.sex, packet.puppy.color].filter(Boolean).join(" / ")} />
          <Field label="Litter" value={packet.litter?.name || "Not recorded"} />
          <Field label="Current weight" value={packet.puppy.current_weight ? `${packet.puppy.current_weight} lb` : "Not recorded"} />
          <Field label="Dam" value={packet.dam?.registered_name || packet.dam?.name || "Not recorded"} />
          <Field label="Sire" value={packet.sire?.registered_name || packet.sire?.name || "Not recorded"} />
        </div>
        <div className="footer-note">Marion, Virginia · swvachihuahua.com</div>
      </section>

      <Section title="Table of Contents" page>
        <ol className="toc">
          <li>Puppy and family record</li><li>First 72 hours at home</li><li>Feeding and water</li><li>Pup-Lift and hypoglycemia</li><li>When to call a veterinarian</li><li>Vaccines and disease prevention</li><li>Parasites and preventives</li><li>Safe socialization</li><li>Potty and crate training</li><li>Sleep and routine</li><li>Training and behavior</li><li>Children and other pets</li><li>Grooming and dental care</li><li>Home and poison safety</li><li>Harnesses and identification</li><li>Travel and car safety</li><li>Growth and development</li><li>Pet insurance</li><li>Emergency plan</li><li>Care logs and go-home checklist</li>
        </ol>
        <div className="notice">This packet is buyer-facing educational material. The signed Bill of Sale, Animal History, Health Guarantee, puppy-specific medical record, and veterinarian&apos;s instructions control whenever they differ from general guidance.</div>
      </Section>

      <Section title="Puppy and Family Record" page>
        <div className="identity">
          <Field label="Puppy name" value={packet.puppy.name} /><Field label="Family" value={buyerName(packet.buyer)} />
          <Field label="Date of birth" value={formatDate(packet.puppy.birth_date)} /><Field label="Sex" value={packet.puppy.sex || "Not recorded"} />
          <Field label="Color" value={packet.puppy.color || "Not recorded"} /><Field label="Litter" value={packet.litter?.name || "Not recorded"} />
          <Field label="Dam" value={packet.dam?.registered_name || packet.dam?.name || "Not recorded"} /><Field label="Sire" value={packet.sire?.registered_name || packet.sire?.name || "Not recorded"} />
          <Field label="Birth weight" value={packet.puppy.birth_weight ? `${packet.puppy.birth_weight} lb` : "Not recorded"} /><Field label="Current weight" value={packet.puppy.current_weight ? `${packet.puppy.current_weight} lb` : "Not recorded"} />
          <Field label="Buyer phone" value={packet.buyer?.phone || "Not recorded"} /><Field label="Buyer email" value={packet.buyer?.email || "Not recorded"} />
          <Field label="Buyer location" value={packet.buyer ? [packet.buyer.city, packet.buyer.state, packet.buyer.postal_code].filter(Boolean).join(", ") : "Not recorded"} /><Field label="Packet date" value={formatDate(new Date().toISOString())} />
        </div>
        {packet.events.length > 0 && <div className="avoid-break"><h3>Recent puppy care records</h3><ul>{packet.events.slice(0, 8).map((event) => <li key={event.id}><strong>{event.title}</strong> — {formatDate(event.event_date)} — {event.status}</li>)}</ul></div>}
      </Section>

      <Section title="The First 72 Hours at Home" page>
        <p>The first few days should focus on food, water, warmth, rest, bathroom routines, and calm bonding. Keep visitors and excitement limited while the puppy adjusts.</p>
        <h3>Do</h3><ul><li>Use the same food and schedule provided at pickup.</li><li>Watch the puppy actually eat each meal.</li><li>Provide frequent potty opportunities in a low-risk area.</li><li>Use a small, warm, puppy-proofed space.</li><li>Allow generous sleep and quiet time.</li></ul>
        <h3>Avoid</h3><ul><li>Large gatherings, repeated handling, or exhausting play.</li><li>Dog parks, pet-store floors, and unknown dogs.</li><li>Sudden food changes, long periods alone, stairs, and jumping from furniture.</li><li>Bathing a weak, chilled, or unwell puppy.</li></ul>
        <div className="notice urgent"><strong>Seek veterinary help immediately</strong> for repeated vomiting or diarrhea, refusal to eat, weakness, wobbliness, collapse, trouble breathing, pale or blue gums, seizures, trauma, or unusual unresponsiveness.</div>
      </Section>

      <Section title="Feeding and Water" page>
        <p>Feed the exact food, texture, amount, and frequency provided at go-home unless your veterinarian directs otherwise. Very small puppies may require several small meals and close observation.</p>
        <ul><li>Measure meals so you know how much was offered and eaten.</li><li>Do not assume a puppy ate because food was left available.</li><li>Keep clean water available unless a veterinarian gives a temporary restriction.</li><li>Change foods gradually over several days.</li><li>Use tiny training treats and avoid table scraps, cooked bones, and xylitol-containing products.</li></ul>
        <div className="notice"><strong>For young or very small puppies:</strong> skipped meals, unusual sleepiness, chilling, or weakness can become urgent quickly.</div>
      </Section>

      <Section title="Pup-Lift and Toy-Breed Hypoglycemia" page>
        <div className="contact-box"><strong>Pup-Lift Support</strong><p>Website: pup-lift.com<br />Phone: 1-715-888-9526</p></div>
        <p>Young and very small toy-breed puppies can be vulnerable to low blood sugar when they do not eat enough, become chilled, experience prolonged stress or activity, or have an underlying illness.</p>
        <h3>Possible warning signs</h3><ul><li>Sudden sleepiness, weakness, or unusual quietness.</li><li>Wobbling, trembling, glassy eyes, disorientation, or difficulty standing.</li><li>Refusing food, appearing cold, or becoming difficult to wake.</li><li>Collapse, seizures, or loss of consciousness.</li></ul>
        <div className="notice urgent"><strong>Treat suspected hypoglycemia as urgent.</strong> Call a veterinarian or emergency hospital immediately and follow the puppy-specific Pup-Lift instructions provided at pickup while arranging care. Do not force food, liquid, or gel into the mouth of a puppy that cannot swallow normally, is unconscious, or is actively seizing.</div>
        <h3>Prevention</h3><ul><li>Maintain the puppy&apos;s assigned feeding frequency.</li><li>Confirm meals are eaten after travel, visitors, bathing, or intense activity.</li><li>Keep the puppy comfortably warm and dry.</li><li>Limit exhausting activity and overstimulation.</li><li>Keep the Pup-Lift kit available at home and during travel.</li></ul>
      </Section>

      <Section title="Veterinary Care, Vaccines, and Parasites" page>
        <h3>Call now</h3><ul><li>Difficulty breathing, choking, facial swelling, collapse, seizure, or severe weakness.</li><li>Repeated vomiting or diarrhea, blood, abdominal pain, or suspected toxin exposure.</li><li>Trauma from a fall, being stepped on, a bite, or a vehicle.</li></ul>
        <h3>Vaccines</h3><p>Puppy vaccines are a series. Avoid high-risk exposure until your veterinarian confirms the appropriate series is complete. Rabies and other vaccines should follow veterinary guidance and applicable law.</p>
        <h3>Parasites</h3><p>Discuss fecal testing, deworming history, heartworm prevention, and flea/tick products with the veterinarian. Use only products appropriate for the puppy&apos;s current age and weight.</p>
      </Section>

      <Section title="Safe Socialization, Potty Training, and Crate Training" page>
        <h3>Safe socialization</h3><p>Carry the puppy in public, introduce healthy vaccinated dogs you know, use short positive car rides, and provide controlled exposure to household sounds and surfaces. Avoid communal dog areas and unknown dogs before veterinary clearance.</p>
        <h3>Potty training</h3><ol><li>Go out after waking, eating, drinking, playing, and leaving the crate.</li><li>Use the same location and a short cue.</li><li>Reward immediately after success.</li><li>Supervise indoors and clean accidents with an enzymatic cleaner.</li><li>Never punish an accident after the fact.</li></ol>
        <h3>Crate training</h3><p>Make the crate a safe resting area, not punishment. Practice short sessions, provide frequent potty breaks, and build alone time gradually.</p>
      </Section>

      <Section title="Training, Children, and Other Pets" page>
        <p>Chihuahuas are intelligent dogs that need structure, training, exercise, and respectful boundaries despite their small size.</p>
        <ul><li>Teach name response, recall, sit, wait, leave it, drop it, calm handling, and harness walking.</li><li>Use rewards and short sessions. Avoid intimidation, leash jerks, or punishment-based techniques.</li><li>Supervise all child interactions. Children should sit on the floor and should not carry, chase, squeeze, or wake the puppy.</li><li>Use barriers and controlled introductions with larger dogs. Even friendly play can injure a Chihuahua.</li></ul>
      </Section>

      <Section title="Grooming, Dental Care, and Home Safety" page>
        <h3>Grooming</h3><ul><li>Brush regularly, trim nails in small amounts, check ears, and use dog-safe shampoo.</li><li>Dry the puppy thoroughly and avoid bathing when the puppy is weak, chilled, or ill.</li></ul>
        <h3>Dental care</h3><ul><li>Introduce a soft toothbrush and dog toothpaste early.</li><li>Aim for daily brushing and ask the veterinarian about retained baby teeth.</li><li>Avoid extremely hard chews that can fracture teeth.</li></ul>
        <h3>Home safety</h3><ul><li>Protect against falls, recliners, doors, cords, tiny objects, medications, nicotine, cannabis, cleaning products, and rodent poison.</li><li>Keep chocolate, xylitol, grapes/raisins, onions/garlic, alcohol, and caffeine inaccessible.</li><li>Do not induce vomiting unless a veterinarian or poison professional specifically directs you.</li></ul>
      </Section>

      <Section title="Harnesses, Identification, Travel, and Growth" page>
        <ul><li>Use a lightweight, well-fitted harness for walking and check fit as the puppy grows.</li><li>Use a current identification tag.</li><li>Secure the puppy in a carrier or rated restraint in the vehicle, away from front-seat airbags.</li><li>Bring food, water, records, waste supplies, and the Pup-Lift kit.</li><li>Never leave the puppy unattended in a vehicle.</li><li>Track weight trends and discuss poor weight gain, weight loss, or delayed development with the veterinarian.</li><li>Follow the signed agreement and veterinary advice regarding spay/neuter and breeding rights.</li></ul>
      </Section>

      <Section title="Pet Insurance and Emergency Plan" page>
        <p>Activate complimentary coverage before its deadline. Read waiting periods, exclusions, deductibles, reimbursement terms, hereditary-condition provisions, and whether the clinic must be paid first.</p>
        <div className="identity">
          <Field label="Primary veterinarian" value="________________________________" /><Field label="Phone" value="________________________________" />
          <Field label="Emergency hospital" value="________________________________" /><Field label="Phone / address" value="________________________________" />
          <Field label="Insurance company" value="________________________________" /><Field label="Policy number" value="________________________________" />
        </div>
        <h3>Emergency grab list</h3><ul><li>Puppy and secure carrier.</li><li>Medication or product packaging.</li><li>Medical records and signed documents.</li><li>Insurance information and payment method.</li><li>Pup-Lift kit, food, towel, and blanket.</li></ul>
      </Section>

      <Section title="Health and Care Logs" page>
        <h3>Weight log</h3><table className="log"><thead><tr><th>Date</th><th>Weight</th><th>Time / scale</th><th>Notes</th></tr></thead><tbody>{Array.from({ length: 8 }).map((_, index) => <tr key={index}><td></td><td></td><td></td><td></td></tr>)}</tbody></table>
        <h3>Medication / prevention log</h3><table className="log"><thead><tr><th>Date</th><th>Product / medication</th><th>Dose</th><th>Next due / notes</th></tr></thead><tbody>{Array.from({ length: 8 }).map((_, index) => <tr key={index}><td></td><td></td><td></td><td></td></tr>)}</tbody></table>
      </Section>

      <Section title="Go-Home Checklist" page>
        <ul><li>Bill of Sale, Animal History, and Health Guarantee.</li><li>Vaccine and deworming record.</li><li>Food and feeding instructions.</li><li>Pup-Lift kit and puppy-specific instructions.</li><li>Complimentary insurance activation information.</li><li>Harness, leash, carrier, bed, and crate.</li><li>Veterinary examination scheduled within the agreement&apos;s required timeframe.</li><li>Breeder, Pup-Lift, primary veterinarian, and emergency-hospital contacts saved.</li></ul>
        <div className="contact-box"><strong>Pup-Lift</strong><p>pup-lift.com · 1-715-888-9526</p></div>
        <p className="footer-note">Prepared for {buyerName(packet.buyer)} and {packet.puppy.name} by Southwest Virginia Chihuahua, Marion, Virginia.</p>
      </Section>
    </article>}
  </main>;
}
