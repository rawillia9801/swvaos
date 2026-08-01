"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  ListTree,
  MessagesSquare,
  PhoneCall,
  UsersRound,
  WalletCards,
} from "lucide-react";

type Buyer = { id: number; application_status: string; created_at: string };
type Litter = { id: number; status: string; due_date: string | null; birth_date: string | null };
type PaymentPlan = { id: number; status: string; total_amount_cents: number; payment_amount_cents: number; next_due_date: string | null };
type Transaction = { id: number; type: string; amount_cents: number; status: string; paid_date: string | null; due_date: string | null };
type Event = { id: number; title: string; event_type: string; event_date: string; event_time: string | null; status: string };
type PuppyUpdate = { id: number; published: number | boolean; created_at: string };
type BuyerDocument = { id: number; title: string; notes?: string | null; created_at: string };
type DogDocument = { id: number; title: string; created_at: string };
type DashboardData = {
  buyers: Buyer[];
  litters: Litter[];
  payment_plans: PaymentPlan[];
  transactions: Transaction[];
  events: Event[];
  updates: PuppyUpdate[];
  buyer_documents: BuyerDocument[];
  dog_documents: DogDocument[];
};

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(value / 100);

const shortDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : "Not scheduled";

const isPaid = (status: string) => /paid|complete|completed|cleared/i.test(status || "");
const isOpen = (status: string) => !/complete|completed|cancel|cancelled|archived|closed/i.test(status || "");
const isPendingApplication = (status: string) => !/approved|matched|placed|declined|not moving forward/i.test(status || "");

function monthCells(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  return { cells, label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now) };
}

function DashboardCard({
  href,
  icon,
  eyebrow,
  value,
  label,
  detail,
  children,
  className = "",
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  label: string;
  detail: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return <a className={`command-dashboard-card ${className}`} href={href}>
    <header><span className="command-card-icon">{icon}</span><span className="command-card-arrow"><ChevronRight size={16} /></span></header>
    <small>{eyebrow}</small>
    <strong>{value}</strong>
    <h3>{label}</h3>
    <p>{detail}</p>
    {children}
  </a>;
}

export function CommandDashboardEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const attach = () => {
      const todayView = document.querySelector<HTMLElement>(".bos-today");
      if (!todayView) {
        setHost(null);
        return;
      }
      let target = todayView.querySelector<HTMLElement>(":scope > .command-dashboard-host");
      if (!target) {
        target = document.createElement("div");
        target.className = "command-dashboard-host";
        const priority = todayView.querySelector(":scope > .bos-priority");
        todayView.insertBefore(target, priority ?? todayView.firstChild);
      }
      setHost(target);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as DashboardData & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load dashboard information.");
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load dashboard information.");
      });
    return () => { cancelled = true; };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const todayString = today.toISOString().slice(0, 10);
    const monthStart = `${todayString.slice(0, 7)}-01`;
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
    const calendar = monthCells(today);
    const upcoming = data.events
      .filter((event) => event.event_date >= todayString && isOpen(event.status))
      .sort((left, right) => `${left.event_date}${left.event_time || ""}`.localeCompare(`${right.event_date}${right.event_time || ""}`));
    const paidThisMonth = data.transactions
      .filter((transaction) => transaction.type !== "Cost" && isPaid(transaction.status) && (transaction.paid_date || "") >= monthStart && (transaction.paid_date || "") < nextMonth)
      .reduce((total, transaction) => total + transaction.amount_cents, 0);
    const duePayments = data.transactions.filter((transaction) => transaction.type !== "Cost" && !isPaid(transaction.status) && Boolean(transaction.due_date)).length;
    const activePlans = data.payment_plans.filter((plan) => isOpen(plan.status));
    const activeLitters = data.litters.filter((litter) => isOpen(litter.status));
    const pendingApplications = data.buyers.filter((buyer) => isPendingApplication(buyer.application_status));
    const approvedBuyers = data.buyers.filter((buyer) => /approved|matched|placed|waitlist/i.test(buyer.application_status || ""));
    const draftUpdates = data.updates.filter((update) => !Boolean(update.published));
    const documents = [...data.buyer_documents, ...data.dog_documents];
    const signedDocuments = data.buyer_documents.filter((document) => /^signed\s/i.test(document.title || "") || /"status":"signed"/.test(document.notes || ""));
    const calls = data.events.filter((event) => event.event_type === "Call");
    const openCalls = calls.filter((event) => isOpen(event.status));
    return {
      calendar,
      upcoming,
      paidThisMonth,
      duePayments,
      activePlans,
      activeLitters,
      pendingApplications,
      approvedBuyers,
      draftUpdates,
      documents,
      signedDocuments,
      calls,
      openCalls,
      today: today.getDate(),
    };
  }, [data]);

  if (!host) return null;

  return createPortal(<section className="command-dashboard-shell" aria-label="SWVAOS operational dashboard">
    <div className="command-dashboard-heading">
      <div><span>COMMAND CENTER</span><h1>Today at a glance</h1></div>
      <p>Live operational cards for the records that need attention across the breeding program.</p>
    </div>
    {error && <div className="command-dashboard-error">{error}</div>}
    {!view ? <div className="command-dashboard-loading">Loading dashboard cards...</div> : <div className="command-dashboard-grid">
      <DashboardCard href="/?view=Calendar" icon={<CalendarDays size={21} />} eyebrow="CALENDAR" value={String(view.upcoming.length)} label="Upcoming items" detail={view.upcoming[0] ? `${view.upcoming[0].title} · ${shortDate(view.upcoming[0].event_date)}` : "No upcoming work is recorded."} className="calendar-card">
        <div className="mini-calendar">
          <b>{view.calendar.label}</b>
          <div className="calendar-weekdays">{"SMTWTFS".split("").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="calendar-days">{view.calendar.cells.map((day, index) => <span key={index} className={day === view.today ? "today" : ""}>{day ?? ""}</span>)}</div>
        </div>
      </DashboardCard>

      <DashboardCard href="/?view=Finance" icon={<WalletCards size={21} />} eyebrow="PAYMENTS" value={money(view.paidThisMonth)} label="Received this month" detail={`${view.duePayments} payment${view.duePayments === 1 ? "" : "s"} currently due or scheduled.`} />
      <DashboardCard href="/?view=Finance" icon={<FileText size={21} />} eyebrow="PAYMENT PLANS" value={String(view.activePlans.length)} label="Active plans" detail={view.activePlans[0]?.next_due_date ? `Next due ${shortDate(view.activePlans[0].next_due_date)}` : "No next payment date is recorded."} />
      <DashboardCard href="/?view=Litters" icon={<ListTree size={21} />} eyebrow="LITTERS" value={String(view.activeLitters.length)} label="Active litters" detail={`${data?.litters.length ?? 0} total litter records in SWVAOS.`} />
      <DashboardCard href="/?view=Families" icon={<UsersRound size={21} />} eyebrow="BUYERS" value={String(data?.buyers.length ?? 0)} label="Buyer records" detail={`${view.approvedBuyers.length} approved, matched, placed, or waitlisted.`} />
      <DashboardCard href="/?view=Applications" icon={<ClipboardCheck size={21} />} eyebrow="APPLICATIONS" value={String(view.pendingApplications.length)} label="New applications" detail="Families currently waiting for an application decision." className={view.pendingApplications.length ? "attention-card" : ""} />
      <DashboardCard href="/?view=Comms" icon={<MessagesSquare size={21} />} eyebrow="UPDATES" value={String(view.draftUpdates.length)} label="Draft updates" detail={`${(data?.updates.length ?? 0) - view.draftUpdates.length} updates have been published.`} />
      <DashboardCard href="/?view=Vault" icon={<FileCheck2 size={21} />} eyebrow="DOCUMENTS" value={String(view.documents.length)} label="Stored documents" detail={`${view.signedDocuments.length} signed document${view.signedDocuments.length === 1 ? "" : "s"} identified.`} />
      <DashboardCard href="/?view=CRM" icon={<PhoneCall size={21} />} eyebrow="CALLS" value={String(view.openCalls.length)} label="Open call items" detail={`${view.calls.length} total call records in the communication history.`} />
    </div>}
  </section>, host);
}
