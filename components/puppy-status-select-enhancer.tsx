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

function enhancePuppyFields() {
  const modal = document.querySelector<HTMLFormElement>("form.modal");
  if (!modal) return;
  const heading = modal.querySelector("header h2")?.textContent?.trim().toLowerCase();
  if (heading !== "puppies") return;

  const input = modal.querySelector<HTMLInputElement>('input[name="status"]');
  if (input && input.dataset.puppyStatusEnhanced !== "true") {
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

  const weightInput = modal.querySelector<HTMLInputElement>('input[name="current_weight"]');
  const weightLabel = weightInput?.closest("label");
  if (weightInput && weightLabel && weightInput.dataset.weeklyWeightEnhanced !== "true") {
    weightInput.dataset.weeklyWeightEnhanced = "true";
    weightInput.step = "0.01";
    weightInput.min = "0";
    const labelText = weightLabel.querySelector("span");
    if (labelText) labelText.textContent = "Weekly/current weight (lb)";
    const help = document.createElement("small");
    help.textContent = "Saving a new weight preserves it in the puppy's growth history, publishes the weekly weight to the assigned buyer, and refreshes the projected adult-weight range.";
    help.style.display = "block";
    help.style.marginTop = "6px";
    help.style.color = "#668083";
    help.style.fontSize = "9px";
    help.style.lineHeight = "1.45";
    weightLabel.append(help);
  }
}

export function PuppyStatusSelectEnhancer() {
  useEffect(() => {
    enhancePuppyFields();
    const observer = new MutationObserver(enhancePuppyFields);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
