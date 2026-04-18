// Free / Paid tier selector. Controls which Gemini key is used and whether
// Kling video generation is allowed. Stored in the shared DB config table so
// both the MCP stdio server and the Next.js studio see the same mode.
import { getConfig, setConfig } from "./db.js";
import { env } from "./config.js";

export type TierMode = "paid" | "free";

export async function getTierMode(): Promise<TierMode> {
  const v = await getConfig("tier.mode");
  return v === "free" ? "free" : "paid";
}

export async function setTierMode(mode: TierMode): Promise<void> {
  await setConfig("tier.mode", mode);
  _cachedMode = mode;
  _cacheLoaded = true;
}

/** Force-reload the cached tier mode. Call after external config changes. */
export async function refreshTierCache(): Promise<void> {
  _cachedMode = await getTierMode();
  _cacheLoaded = true;
}

/**
 * Returns the Gemini API key that should be used for the current tier.
 * Free tier falls back to the paid key if GEMINI_API_KEY_FREE isn't set.
 *
 * Note: this is sync because callsites in the gen pipeline can't easily
 * become async. We cache the tier mode for the lifetime of the process.
 * On a fresh boot the cache is "paid" (the default) until overridden.
 */
let _cachedMode: TierMode = "paid";
let _cacheLoaded = false;
async function ensureCache(): Promise<void> {
  if (_cacheLoaded) return;
  try {
    _cachedMode = await getTierMode();
  } catch {
    _cachedMode = "paid";
  }
  _cacheLoaded = true;
}
// Kick off lazy load
ensureCache().catch(() => {});

export function getActiveGeminiKey(): string {
  if (_cachedMode === "free" && env.GEMINI_API_KEY_FREE) {
    return env.GEMINI_API_KEY_FREE;
  }
  return env.GEMINI_API_KEY;
}

/** Whether Kling / paid-tier features should be exposed in the current mode. */
export function isPaidTier(): boolean {
  return _cachedMode === "paid";
}
