"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  Dog,
  FolderOpen,
  HeartPulse,
  Headphones,
  LayoutDashboard,
  ListTree,
  MessagesSquare,
  MonitorSmartphone,
  PackageSearch,
  PawPrint,
  Route,
  UserRound,
  UsersRound,
  WalletCards,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

type GroupKey = "Today" | "Breeding" | "Families" | "Business" | "Office";
type NavItem = { label: string; view: string; icon: LucideIcon };
type NavGroup = { label: GroupKey; description: string; icon: LucideIcon; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Today",
    description: "Run sheet and schedule",
    icon: LayoutDashboard,
    items: [
      { label: "Today", view: "Command", icon: LayoutDashboard },
      { label: "Schedule", view: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Breeding",
    description: "Dogs, litters, puppies, and care",
    icon: Dog,
    items: [
      { label: "Dogs & breeding", view: "Breeding", icon: Dog },
      { label: "Litters", view: "Litters", icon: ListTree },
      { label: "Puppies", view: "Puppies", icon: PawPrint },
      { label: "Health & care", view: "Care", icon: HeartPulse },
    ],
  },
  {
    label: "Families",
    description: "Application through go-home",
    icon: UsersRound,
    items: [
      { label: "Applications", view: "Applications", icon: ClipboardCheck },
      { label: "Buyers & waitlist", view: "Families", icon: UsersRound },
      { label: "Puppy placement", view: "Placement", icon: UserRound },
      { label: "Pickup & delivery", view: "Delivery", icon: Route },
    ],
  },
  {
    label: "Business",
    description: "Money, communication, and reporting",
    icon: WalletCards,
    items: [
      { label: "Payments & sales", view: "Finance", icon: WalletCards },
      { label: "Costs", view: "Inventory", icon: PackageSearch },
      { label: "Communications", view: "Comms", icon: MessagesSquare },
      { label: "Automations & templates", view: "Templates", icon: MessageSquareText },
      { label: "Reports", view: "Reports", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Office",
    description: "Portal, phone, and documents",
    icon: FolderOpen,
    items: [
      { label: "Family portal", view: "Portal", icon: MonitorSmartphone },
      { label: "Phone center", view: "CRM", icon: Headphones },
      { label: "Documents", view: "Vault", icon: FolderOpen },
    ],
  },
];

const groupForView = (view: string): GroupKey => {
  const match = groups.find((group) => group.items.some((item) => item.view === view));
  return match?.label ?? "Today";
};

export function NavigationGroupEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>("Today");

  useEffect(() => {
    const currentView = new URLSearchParams(window.location.search).get("view") || "Command";
    setSelectedGroup(groupForView(currentView));
  }, []);

  useEffect(() => {
    const attach = () => {
      const workspaceNav = document.querySelector<HTMLElement>(".bos-workspaces");
      const contextBar = document.querySelector<HTMLElement>(".bos-context-bar");
      if (!workspaceNav || !contextBar) {
        setHost(null);
        return;
      }

      let target = contextBar.querySelector<HTMLElement>(":scope > .navigation-group-host");
      if (!target) {
        target = document.createElement("div");
        target.className = "navigation-group-host";
        contextBar.append(target);
      }
      contextBar.classList.add("navigation-group-enhanced");
      setHost(target);

      const buttons = Array.from(workspaceNav.querySelectorAll<HTMLButtonElement>(":scope > button"));
      buttons.forEach((button) => {
        const label = button.querySelector("b")?.textContent?.trim() as GroupKey | undefined;
        button.classList.toggle("nav-group-selected", label === selectedGroup);
      });
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selectedGroup]);

  useEffect(() => {
    const handler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".bos-workspaces > button");
      if (!button) return;
      const label = button.querySelector("b")?.textContent?.trim() as GroupKey | undefined;
      if (!label || !groups.some((group) => group.label === label)) return;
      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      setSelectedGroup(label);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  const selected = useMemo(() => groups.find((group) => group.label === selectedGroup) ?? groups[0], [selectedGroup]);
  const currentView = typeof window === "undefined" ? "Command" : new URLSearchParams(window.location.search).get("view") || "Command";

  if (!host) return null;
  const GroupIcon = selected.icon;

  return createPortal(<div className="navigation-group-panel">
    <header>
      <span><GroupIcon size={18} /></span>
      <div><b>{selected.label}</b><small>{selected.description}</small></div>
    </header>
    <nav aria-label={`${selected.label} pages`}>
      {selected.items.map((item) => {
        const Icon = item.icon;
        return <a key={item.view} className={currentView === item.view ? "active" : ""} href={`/?view=${encodeURIComponent(item.view)}`}>
          <Icon size={15} />
          <b>{item.label}</b>
        </a>;
      })}
    </nav>
    <footer><i /><span><b>Connected</b><small>Select a page above to open it.</small></span></footer>
  </div>, host);
}
