"use server";
import { setConfig, getConfig } from "../mcp";
import { revalidatePath } from "next/cache";

const PLATFORMS = ["x", "instagram", "tiktok", "facebook", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export async function setWebhookUrl(platform: Platform, url: string) {
  if (!url.startsWith("https://")) throw new Error("URL must start with https://");
  await setConfig(`webhook.${platform}`, url);
  revalidatePath("/settings");
  return { platform, saved: true };
}

export async function getWebhookUrls(): Promise<Record<Platform, string | null>> {
  const out = {} as Record<Platform, string | null>;
  for (const p of PLATFORMS) out[p] = await getConfig(`webhook.${p}`);
  return out;
}

export async function deleteWebhookUrl(platform: Platform) {
  await setConfig(`webhook.${platform}`, "");
  revalidatePath("/settings");
  return { platform, cleared: true };
}
