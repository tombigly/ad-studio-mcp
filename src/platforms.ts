// Canonical platform → aspect-ratio mapping used by the generation pipeline
// and by the publisher. Each platform's chosen aspect is the *default* that
// performs best natively (feed/reels/shorts). Users don't pick; we pick.

export type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";
export type Aspect = "9:16" | "1:1" | "16:9";

export const PLATFORMS: Platform[] = [
  "x",
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
];

/**
 * Default aspect ratio per platform.
 *
 * - Instagram: 9:16 (Reels-first, Stories-compatible, IG feed accepts)
 * - TikTok: 9:16 (strictly required for native)
 * - YouTube: 9:16 (Shorts — the highest-reach format today)
 * - Facebook: 1:1 (feed + Reels both accept)
 * - X: 16:9 (desktop feed default, video autoplay ideal)
 */
export const PLATFORM_ASPECT: Record<Platform, Aspect> = {
  instagram: "9:16",
  tiktok: "9:16",
  youtube: "9:16",
  facebook: "1:1",
  x: "16:9",
};

/**
 * Human-readable label for why an aspect was chosen, shown in the studio UI.
 */
export const PLATFORM_ASPECT_HINT: Record<Platform, string> = {
  instagram: "Reels / Stories",
  tiktok: "native feed",
  youtube: "Shorts",
  facebook: "feed + Reels",
  x: "desktop feed",
};

/**
 * Given a set of platforms, return the unique aspects we need to render.
 * This is what the pipeline iterates over — one render per unique aspect,
 * reused across every platform that shares it.
 */
export function uniqueAspectsFor(platforms: Platform[]): Aspect[] {
  const seen = new Set<Aspect>();
  for (const p of platforms) seen.add(PLATFORM_ASPECT[p]);
  return [...seen];
}

export function aspectFor(platform: Platform): Aspect {
  return PLATFORM_ASPECT[platform];
}
