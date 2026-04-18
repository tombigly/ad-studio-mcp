import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, existsSync } from "node:fs";

// R2 is OPTIONAL. If present, media gets uploaded to R2 (persistent URLs).
// If absent, the studio runs a localtunnel and serves media locally.
// Only Gemini + Replicate are strictly required.
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  /** Optional second Gemini key for free-tier mode. When tier mode = "free" and this is set,
   *  the app uses this key instead of GEMINI_API_KEY. Lets you keep paid + free keys side-by-side. */
  GEMINI_API_KEY_FREE: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().min(1, "REPLICATE_API_TOKEN is required"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  AD_STUDIO_HOME: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// --- Ad Studio home directory is the one value we always resolve up-front ---
// On Vercel the only writable path is /tmp, so default there when deployed.
export const HOME_DIR =
  process.env.AD_STUDIO_HOME ??
  (process.env.VERCEL ? "/tmp/.ad-studio" : join(homedir(), ".ad-studio"));
mkdirSync(HOME_DIR, { recursive: true });

export const DB_PATH = join(HOME_DIR, "db.sqlite");
export const MEDIA_DIR = join(HOME_DIR, "media");
mkdirSync(MEDIA_DIR, { recursive: true });

export const ENV_PATH = join(HOME_DIR, ".env");

// Load ~/.ad-studio/.env if it exists. We don't depend on the `dotenv` package
// because the file format is simple: KEY=VALUE per line.
function loadDotEnv(): void {
  if (!existsSync(ENV_PATH)) return;
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

// --- Lazy validation. The stdio MCP server needs all envs; the web UI boots
//     before setup is complete and must not throw at import time.
let _validated: Env | null = null;
let _validationError: Error | null = null;

function validate(): Env {
  if (_validated) return _validated;
  if (_validationError) throw _validationError;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    _validationError = new Error(`Ad Studio is not configured:\n${issues}`);
    throw _validationError;
  }
  _validated = parsed.data;
  return _validated;
}

export function isConfigured(): boolean {
  try {
    validate();
    return true;
  } catch {
    return false;
  }
}

// Whether R2 is fully configured for persistent media uploads.
// When false, the studio falls back to serving media via a localtunnel.
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_BASE_URL
  );
}

export function reloadEnv(): void {
  _validated = null;
  _validationError = null;
  loadDotEnv();
}

export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    const cfg = validate();
    return cfg[prop as keyof Env];
  },
  has(_, prop: string) {
    try {
      const cfg = validate();
      return prop in cfg;
    } catch {
      return false;
    }
  },
});

// R2 endpoint and public base URL resolve only when the MCP is fully configured.
export function getR2Endpoint(): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}
export function getR2PublicUrlBase(): string {
  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }
  return env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
}
