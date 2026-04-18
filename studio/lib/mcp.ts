// Re-exports from the MCP package so the UI calls the exact same business logic
// the MCP stdio server does. Shared state lives in ~/.ad-studio/db.sqlite.
export { db, getConfig, setConfig, ensureInit } from "../../dist/db.js";
export { createBrand, enrichBrandFromUrl } from "../../dist/brands.js";
export { runPipeline } from "../../dist/gen/pipeline.js";
export { publishAd, getPostStatus } from "../../dist/publish.js";
export {
  env,
  HOME_DIR,
  MEDIA_DIR,
  ENV_PATH,
  isConfigured,
  reloadEnv,
  getR2PublicUrlBase,
} from "../../dist/config.js";
export {
  getTierMode,
  setTierMode,
  getActiveGeminiKey,
  isPaidTier,
} from "../../dist/tier.js";
export type { TierMode } from "../../dist/tier.js";
export type { BrandSystem } from "../../dist/brands.js";
export type { PlatformCaptions } from "../../dist/gen/captions.js";
export type {
  GenerateAdArgs,
  GenerateAdResult,
  Platform,
} from "../../dist/gen/pipeline.js";
