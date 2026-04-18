"use server";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { upsertMcpServer, getMcpConfigSummary } from "../mcp-config";
import { ENV_PATH } from "../mcp";

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const raw = readFileSync(ENV_PATH, "utf8");
  const out: Record<string, string> = {};
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
    out[key] = value;
  }
  return out;
}

function findMcpBinPath(): string {
  // Compiled stdio MCP lives at <package root>/dist/index.js.
  // studio/ is a child of the root, so go up one then into dist.
  return resolve(process.cwd(), "..", "dist", "index.js");
}

export async function writeMcpConfigAction() {
  const env = readEnv();
  const binPath = findMcpBinPath();
  if (!existsSync(binPath)) {
    throw new Error(
      `MCP server binary not found at ${binPath}. Run 'npm run build' at the package root first.`
    );
  }
  const result = await upsertMcpServer({
    binPath,
    env,
    serverName: "ad-studio",
  });
  return result;
}

export async function getMcpSummaryAction() {
  return getMcpConfigSummary();
}

// unused, silence TS about join if not referenced
void join;
