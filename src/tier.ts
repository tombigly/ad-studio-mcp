// Free / Paid tier selector. Controls which Gemini key is used and whether
// Kling video generation is allowed. Stored in the shared DB config table so
// both the MCP stdio server and the Next.js studio see the same mode.
import { getConfig, setConfig } from "./db.js";
import { env } from "./config.js";

export type TierMode = "paid" | "free";

export function getTierMode(): TierMode {
  const v = getConfig("tier.mode");
  return v === "free" ? "free" : "paid";
}

export function setTierMode(mode: TierMode): void {
  setConfig("tier.mode", mode);
}

/**
 * Returns the Gemini API key that should be used for the current tier.
 * Free tier falls back to the paid key if GEMINI_API_KEY_FREE isn't set.
 */
export function getActiveGeminiKey(): string {
  if (getTierMode() === "free" && env.GEMINI_API_KEY_FREE) {
    return env.GEMINI_API_KEY_FREE;
  }
  return env.GEMINI_API_KEY;
}

/** Whether Kling / paid-tier features should be exposed in the current mode. */
export function isPaidTier(): boolean {
  return getTierMode() === "paid";
}
