"use client";

import { useEffect } from "react";

const PUPPY_STATUSES = [
  "Newborn",
  "Growing",
  "Available",
  "Reserved",
  "Matched",
  "Ready to Go Home",
  "Gone Home",
  "Retained",
  "Not Available",
  "Archived",
];

function enhancePuppyStatusField() {
  const modal = document.querySelector<HTMLFormElement>("form.modal");
  if (!modal) return;
  const heading = modal.querySelector("header h2")?.textContent?.trim().toLowerCase();
  if (heading !== "puppies") return;

  const input = modal.querySelector<HTMLInputElement>('input[name="status"]');
  if (!input || input.dataset.puppyStatusEnhanced === "true") return;

  const select = document.createElement("select");
  select.name = input.name;
  select.required = input.required;
  select.className = input.className;
  select.setAttribute("aria-label", "Puppy status");
  select.dataset.puppyStatusEnhanced = "true";

  const currentValue = input.value.trim();
  if (currentValue && !PUPPY_STATUSES.includes(currentValue)) {
    const currentOption = document.createElement("option");
    currentOption.value = currentValue;
    currentOption.textContent = `Current: ${currentValue}`;
    select.append(currentOption);
  }

  for (const status of PUPPY_STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = status === currentValue;
    select.append(option);
  }

  if (!currentValue) select.value = "Growing";
  input.replaceWith(select);
}

export function PuppyStatusSelectEnhancer() {
  useEffect(() => {
    enhancePuppyStatusField();
    const observer = new MutationObserver(enhancePuppyStatusField);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
