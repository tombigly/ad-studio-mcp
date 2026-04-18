"use server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const MCP_JSON_PATH = join(homedir(), ".claude", "mcp.json");

interface McpServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerEntry>;
  [k: string]: unknown;
}

function read(): McpConfig {
  if (!existsSync(MCP_JSON_PATH)) return {};
  try {
    const raw = readFileSync(MCP_JSON_PATH, "utf8");
    return JSON.parse(raw) as McpConfig;
  } catch {
    return {};
  }
}

function write(cfg: McpConfig): void {
  mkdirSync(dirname(MCP_JSON_PATH), { recursive: true });
  writeFileSync(MCP_JSON_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export interface MergeOptions {
  binPath: string; // absolute path to the stdio MCP server entrypoint (dist/index.js)
  env: Record<string, string>;
  serverName?: string;
}

export async function upsertMcpServer(options: MergeOptions): Promise<{
  path: string;
  upserted: boolean;
}> {
  const name = options.serverName ?? "ad-studio";
  const cfg = read();
  const servers = (cfg.mcpServers ??= {});
  servers[name] = {
    command: "node",
    args: [options.binPath],
    env: options.env,
  };
  write(cfg);
  return { path: MCP_JSON_PATH, upserted: true };
}

export async function removeMcpServer(name = "ad-studio"): Promise<{ removed: boolean }> {
  const cfg = read();
  if (cfg.mcpServers && name in cfg.mcpServers) {
    delete cfg.mcpServers[name];
    write(cfg);
    return { removed: true };
  }
  return { removed: false };
}

export async function getMcpConfigSummary(): Promise<{
  path: string;
  exists: boolean;
  hasAdStudio: boolean;
  otherServers: string[];
}> {
  if (!existsSync(MCP_JSON_PATH)) {
    return { path: MCP_JSON_PATH, exists: false, hasAdStudio: false, otherServers: [] };
  }
  const cfg = read();
  const servers = cfg.mcpServers ?? {};
  return {
    path: MCP_JSON_PATH,
    exists: true,
    hasAdStudio: "ad-studio" in servers,
    otherServers: Object.keys(servers).filter((n) => n !== "ad-studio"),
  };
}
