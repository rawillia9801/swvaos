"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, CircleDollarSign, Dog, Eye, EyeOff, ReceiptText } from "lucide-react";

type DogRow = { id: number; name?: string; status?: string; purchase_price_cents?: number | null };
type LitterRow = { id: number; dam_id?: number | null; sire_id?: number | null };
type PuppyRow = { id: number; litter_id?: number | null; buyer_id?: number | null; status?: string };
type TransactionRow = { id: number; type?: string; dog_id?: number | null; litter_id?: number | null; puppy_id?: number | null; amount_cents?: number | null; status?: string };
type MedicalRow = { id: number; dog_id?: number | null; cost_cents?: number | null };
type DataSet = { dogs?: DogRow[]; litters?: LitterRow[]; puppies?: PuppyRow[]; transactions?: TransactionRow[]; dog_medical_records?: MedicalRow[] };
type RosterMode = "active" | "all";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const normalizedStatus = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const inactiveTerms = ["retired", "deceased", "dead", "passed away", "passed", "archived", "inactive", "memorial", "no longer breeding", "not breeding", "removed from program"];
const isActiveDog = (dog: DogRow) => !inactiveTerms.some((term) => normalizedStatus(dog.status).includes(term));
const countsAsRevenue = (transaction: TransactionRow) => ["payment", "deposit"].includes(normalizedStatus(transaction.type)) && ["paid", "complete", "completed", "cleared"].includes(normalizedStatus(transaction.status));

export function BreedingDogRosterEnhancer() {
  const [data, setData] = useState<DataSet>({});
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<RosterMode>("active");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet;
      if (response.ok) setData(payload);
    } catch {
      // The normal SWVAOS page handles connection errors.
    }
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("swvaos-breeding-dog-roster");
    setMode(saved === "all" ? "all" : "active");
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const dogs = data.dogs || [];
    const active = dogs.filter(isActiveDog);
    const inactive = dogs.filter((dog) => !isActiveDog(dog));
    const allLitters = data.litters || [];
    const allPuppies = data.puppies || [];
    const allTransactions = data.transactions || [];
    const allMedical = data.dog_medical_records || [];
    const byDog = new Map<number, { litters: number; puppies: number; placed: number; revenue: number; costs: number; net: number }>();

    for (const dog of dogs) {
      const litters = allLitters.filter((litter) => Number(litter.dam_id) === dog.id || Number(litter.sire_id) === dog.id);
      const litterIds = new Set(litters.map((litter) => litter.id));
      const puppies = allPuppies.filter((puppy) => litterIds.has(Number(puppy.litter_id)));
      const puppyIds = new Set(puppies.map((puppy) => puppy.id));
      const related = allTransactions.filter((transaction) => Number(transaction.dog_id) === dog.id || litterIds.has(Number(transaction.litter_id)) || puppyIds.has(Number(transaction.puppy_id)));
      const revenue = related.filter(countsAsRevenue).reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount_cents || 0)), 0);
      const transactionCosts = related.filter((transaction) => normalizedStatus(transaction.type) === "cost").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount_cents || 0)), 0);
      const medicalCosts = allMedical.filter((record) => Number(record.dog_id) === dog.id).reduce((sum, record) => sum + Math.abs(Number(record.cost_cents || 0)), 0);
      const costs = Math.abs(Number(dog.purchase_price_cents || 0)) + transactionCosts + medicalCosts;
      byDog.set(dog.id, { litters: litters.length, puppies: puppies.length, placed: puppies.filter((puppy) => Boolean(puppy.buyer_id)).length, revenue, costs, net: revenue - costs });
    }

    const visible = mode === "active" ? active : dogs;
    const totals = visible.reduce((result, dog) => {
      const values = byDog.get(dog.id);
      return { revenue: result.revenue + (values?.revenue || 0), costs: result.costs + (values?.costs || 0) };
    }, { revenue: 0, costs: 0 });
    return { dogs, active, inactive, byDog, totals };
  }, [data, mode]);

  useEffect(() => {
    const apply = () => {
      const breedingHeading = [...document.querySelectorAll<HTMLElement>(".panel-head h2")].find((heading) => heading.textContent?.trim().toLowerCase() === "breeding dogs");
      const section = breedingHeading?.closest<HTMLElement>("section.panel");
      const grid = section?.querySelector<HTMLElement>(".card-grid");
      if (!section || !grid) {
        setHost(null);
        return;
      }
      let target = section.querySelector<HTMLElement>(":scope > .breeding-roster-host");
      if (!target) {
        target = document.createElement("div");
        target.className = "breeding-roster-host";
        grid.parentElement?.insertBefore(target, grid);
      }
      setHost(target);

      grid.querySelectorAll<HTMLElement>("article.record-card").forEach((card) => {
        const link = card.querySelector<HTMLAnchorElement>('a[href^="/dogs/"]');
        const dogId = Number(link?.getAttribute("href")?.match(/^\/dogs\/(\d+)/)?.[1] || 0);
        if (!dogId) return;
        const dog = stats.dogs.find((candidate) => candidate.id === dogId);
        const values = stats.byDog.get(dogId);
        const inactive = Boolean(dog && !isActiveDog(dog));
        card.hidden = mode === "active" && inactive;
        card.classList.toggle("breeding-dog-inactive", inactive);
        let strip = card.querySelector<HTMLElement>(".dog-financial-strip");
        if (!strip) {
          strip = document.createElement("div");
          strip.className = "dog-financial-strip";
          const footer = card.querySelector("footer");
          if (footer) card.insertBefore(strip, footer);
          else card.append(strip);
        }
        const summary = `${values?.litters || 0}|${values?.placed || 0}|${values?.puppies || 0}|${values?.revenue || 0}|${values?.costs || 0}|${values?.net || 0}`;
        if (strip.dataset.summary !== summary) {
          strip.dataset.summary = summary;
          strip.innerHTML = `<span><b>${values?.litters || 0}</b><small>litters</small></span><span><b>${values?.placed || 0}/${values?.puppies || 0}</b><small>placed</small></span><span><b>${money(values?.revenue || 0)}</b><small>sales</small></span><span><b>${money(values?.costs || 0)}</b><small>costs</small></span><span class="${(values?.net || 0) >= 0 ? "positive" : "negative"}"><b>${money(values?.net || 0)}</b><small>net</small></span>`;
        }
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mode, stats]);

  function chooseMode(next: RosterMode) {
    setMode(next);
    window.sessionStorage.setItem("swvaos-breeding-dog-roster", next);
  }

  if (!host) return null;

  return createPortal(<div className="breeding-roster-toolbar">
    <div className="breeding-roster-intro"><span><Dog size={20}/></span><div><b>Breeding dog roster</b><small>The roster opens with active dogs only. Retired and deceased dogs remain preserved with their complete financial and breeding history.</small></div></div>
    <div className="breeding-roster-metrics">
      <span><b>{stats.active.length}</b><small>active dogs</small></span>
      <span><b>{stats.inactive.length}</b><small>historical dogs</small></span>
      <span><b>{money(stats.totals.revenue)}</b><small>sales shown</small></span>
      <span><b>{money(stats.totals.costs)}</b><small>costs shown</small></span>
    </div>
    <div className="breeding-roster-toggle" role="group" aria-label="Breeding dog visibility">
      <button type="button" className={mode === "active" ? "active" : ""} onClick={() => chooseMode("active")}><Eye size={15}/> Active dogs only</button>
      <button type="button" className={mode === "all" ? "active" : ""} onClick={() => chooseMode("all")}><Archive size={15}/> Include retired and deceased</button>
    </div>
    <div className="breeding-roster-key"><span><CircleDollarSign size={14}/> Sales include paid deposits and payments connected to the dog, its litters, or its puppies.</span><span><ReceiptText size={14}/> Costs include purchase price, medical care, and recorded expenses.</span>{mode === "active" && stats.inactive.length > 0 && <span><EyeOff size={14}/> {stats.inactive.length} historical dog{stats.inactive.length === 1 ? " is" : "s are"} hidden.</span>}</div>
  </div>, host);
}
