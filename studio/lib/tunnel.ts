// Auto-starts a localtunnel when the studio boots, writes the public URL
// into the shared config table so both the web UI and the MCP stdio server
// (via getConfig("tunnel.url")) can use it as the media_url for Pipedream.
import "server-only";
import { setConfig, getConfig } from "./mcp";

interface TunnelHandle {
  url: string;
  closed: boolean;
  close: () => void;
  on: (event: string, cb: (err?: unknown) => void) => void;
}

let tunnel: TunnelHandle | null = null;
let startingPromise: Promise<string | null> | null = null;

export async function startTunnel(localPort: number): Promise<string | null> {
  if (tunnel && !tunnel.closed) {
    return await getConfig("tunnel.url");
  }
  if (startingPromise) return startingPromise;

  startingPromise = (async () => {
    try {
      const mod = (await import("localtunnel")) as unknown as {
        default: (opts: { port: number }) => Promise<TunnelHandle>;
      };
      const t = await mod.default({ port: localPort });
      tunnel = t;
      await setConfig("tunnel.url", t.url);
      await setConfig("tunnel.updated_at", String(Date.now()));
      t.on("close", () => {
        tunnel = null;
        console.error("[tunnel] closed");
      });
      t.on("error", (err: unknown) => {
        console.error("[tunnel] error:", err);
      });
      console.error(`[tunnel] ready: ${t.url} -> localhost:${localPort}`);
      return t.url;
    } catch (err) {
      console.error("[tunnel] failed to start:", err);
      return null;
    } finally {
      startingPromise = null;
    }
  })();

  return startingPromise;
}

export async function getTunnelUrl(): Promise<string | null> {
  return await getConfig("tunnel.url");
}
