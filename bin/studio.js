#!/usr/bin/env node
// ad-studio — launches the Next.js web UI on localhost and opens the browser.
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = resolve(__dirname, "..", "studio");
const PORT = process.env.AD_STUDIO_PORT || "3847";
const HOST = process.env.AD_STUDIO_HOST || "127.0.0.1";

if (!existsSync(resolve(STUDIO_DIR, ".next"))) {
  console.error(
    `Studio not built. Run 'npm run build' inside ${STUDIO_DIR} first.`
  );
  process.exit(1);
}

const nextBin = resolve(STUDIO_DIR, "node_modules/.bin/next");
if (!existsSync(nextBin)) {
  console.error(`Next binary not found at ${nextBin}. Run 'npm install' in ${STUDIO_DIR}.`);
  process.exit(1);
}

const url = `http://${HOST}:${PORT}`;
console.log(`\nAd Studio → ${url}\n`);

const child = spawn(nextBin, ["start", "-H", HOST, "-p", PORT], {
  cwd: STUDIO_DIR,
  stdio: "inherit",
  env: { ...process.env },
});

// Open browser after a short delay so the server has time to bind the port.
setTimeout(async () => {
  try {
    const open = (await import("open")).default;
    await open(url);
  } catch {
    // No-op — printing the URL is enough.
  }
}, 1500);

const shutdown = () => {
  if (child.killed) return;
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 2000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code ?? 0));
