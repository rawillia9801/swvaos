"use client";

import { useEffect } from "react";

const APPLICATION_STATUSES = [
  { value: "Complete", label: "Needs Review" },
  { value: "Approved", label: "Approved / Waitlist" },
  { value: "Matched", label: "Matched" },
  { value: "Declined", label: "Not Moving Forward" },
];

function enhanceApplicationStatusField() {
  const input = document.querySelector<HTMLInputElement>('input[name="application_status"]');
  if (!input || input.dataset.statusEnhanced === "true") return;

  const select = document.createElement("select");
  select.name = input.name;
  select.required = input.required;
  select.className = input.className;
  select.setAttribute("aria-label", "Application status");
  select.dataset.statusEnhanced = "true";

  const currentValue = input.value.trim();
  if (currentValue && !APPLICATION_STATUSES.some((status) => status.value === currentValue)) {
    const currentOption = document.createElement("option");
    currentOption.value = currentValue;
    currentOption.textContent = `Current: ${currentValue}`;
    select.append(currentOption);
  }

  for (const status of APPLICATION_STATUSES) {
    const option = document.createElement("option");
    option.value = status.value;
    option.textContent = status.label;
    option.selected = status.value === currentValue;
    select.append(option);
  }

  if (!currentValue) select.value = "Complete";
  input.replaceWith(select);
}

export function ApplicationStatusSelectEnhancer() {
  useEffect(() => {
    enhanceApplicationStatusField();
    const observer = new MutationObserver(enhanceApplicationStatusField);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
