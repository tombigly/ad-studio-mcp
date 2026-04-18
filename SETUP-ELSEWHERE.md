# Setting up Ad Studio on another machine

This project uses a nested structure: the MCP stdio server at the root, and a Next.js web UI in `studio/`.

## Prerequisites

- Node.js ≥ 20 (22 LTS recommended)
- macOS / Linux (Windows works but the launcher is a shell script)

## Install

```bash
# 1. Extract the tarball
tar -xzf ad-studio-mcp-export.tar.gz
cd ad-studio-mcp

# 2. Install MCP deps
npm install

# 3. Build the MCP package (emits dist/)
npm run build:mcp

# 4. Install and build the studio
cd studio
npm install
npm run build
cd ..
```

## Configure

Put your API keys in `~/.ad-studio/.env`:

```
GEMINI_API_KEY=AIza...
REPLICATE_API_TOKEN=r8_...
```

R2 is optional — if omitted, the studio auto-starts a localtunnel for public media URLs.

## Run

### As an MCP server inside Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "ad-studio": {
      "command": "node",
      "args": ["/absolute/path/to/ad-studio-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Code. Eight tools appear under `ad-studio`.

### As a web UI

```bash
cd studio
npm run start     # production
# or
npm run dev       # dev with hot reload
```

Open http://localhost:3000. First load redirects to `/setup` if env is missing.

## Webhook publishing

Configure Pipedream workflows (see `pipedream-setup.md`) and paste webhook URLs in the studio's Pipedream step or Settings page.

## Shared state

Both the MCP server and the studio read/write `~/.ad-studio/db.sqlite`. Brands/ads/posts made in one surface appear in the other.
