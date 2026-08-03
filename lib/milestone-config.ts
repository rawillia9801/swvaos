import "server-only";

import { getSupabaseConfig, supabaseRequest } from "../db/supabase";
import { defaultBuyerMilestoneConfig, mergeBuyerMilestoneConfig, type BuyerMilestoneConfig } from "./milestone-defaults";

const objectKey = "_system/swvaos-buyer-milestones.json";

export async function getBuyerMilestoneConfig(): Promise<BuyerMilestoneConfig> {
  const { storageBucket } = getSupabaseConfig();
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, { cache: "no-store" });
  if (response.status === 404 || response.status === 400) return structuredClone(defaultBuyerMilestoneConfig);
  if (!response.ok) throw new Error((await response.text()) || "Unable to load buyer milestones.");
  return mergeBuyerMilestoneConfig(await response.json());
}

export async function saveBuyerMilestoneConfig(value: unknown): Promise<BuyerMilestoneConfig> {
  const config = mergeBuyerMilestoneConfig(value);
  config.updatedAt = new Date().toISOString();
  const { storageBucket } = getSupabaseConfig();
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", "x-upsert": "true" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to save buyer milestones.");
  return config;
}
