"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, AlertCircle, Save, Loader2, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveEnvAction } from "@/lib/actions/setup";
import { setWebhookUrl, deleteWebhookUrl } from "@/lib/actions/webhooks";
import { writeMcpConfigAction } from "@/lib/actions/mcp-config";
import { setTierAction, saveFreeTierKeyAction } from "@/lib/actions/tier";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const ENV_KEYS = [
  { id: "GEMINI_API_KEY", label: "Gemini API key", hint: "Image + captions" },
  { id: "REPLICATE_API_TOKEN", label: "Replicate token", hint: "Kling video" },
  { id: "R2_ACCOUNT_ID", label: "R2 account ID", hint: "Cloudflare R2" },
  { id: "R2_ACCESS_KEY_ID", label: "R2 access key ID", hint: "S3 compat" },
  { id: "R2_SECRET_ACCESS_KEY", label: "R2 secret access key", hint: "S3 compat" },
  { id: "R2_BUCKET", label: "R2 bucket name", hint: "Media storage" },
  { id: "R2_PUBLIC_BASE_URL", label: "R2 public URL base", hint: "Public media URL" },
] as const;

const PLATFORMS = ["x", "instagram", "tiktok", "facebook", "youtube"] as const;

const PLATFORM_TONE: Record<string, string> = {
  x: "bg-zinc-900 dark:bg-zinc-200",
  instagram: "bg-gradient-to-br from-pink-500 to-orange-400",
  tiktok: "bg-gradient-to-br from-cyan-400 to-pink-500",
  facebook: "bg-blue-600",
  youtube: "bg-red-600",
};

interface Props {
  env: { configured: boolean; has: Record<string, boolean> };
  mcp: { path: string; exists: boolean; hasAdStudio: boolean; otherServers: string[] };
  webhooks: Record<string, string | null>;
  tier: { mode: "paid" | "free"; hasFreeKey: boolean };
}

export function SettingsClient({ env, mcp, webhooks, tier }: Props) {
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [webhookValues, setWebhookValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(webhooks).map(([k, v]) => [k, v ?? ""]))
  );
  const [tierMode, setTierMode] = useState<"paid" | "free">(tier.mode);
  const [hasFreeKey, setHasFreeKey] = useState(tier.hasFreeKey);
  const [freeKeyInput, setFreeKeyInput] = useState("");
  const [pending, startTransition] = useTransition();

  const saveKey = (id: string) => {
    const v = keyValues[id];
    if (!v) return;
    startTransition(async () => {
      try {
        await saveEnvAction({ [id]: v });
        setKeyValues((s) => ({ ...s, [id]: "" }));
        toast.success(`${id} saved`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const saveHook = (platform: (typeof PLATFORMS)[number]) => {
    const v = webhookValues[platform];
    startTransition(async () => {
      try {
        if (!v) {
          await deleteWebhookUrl(platform);
          toast.success(`${platform} webhook cleared`);
        } else {
          await setWebhookUrl(platform, v);
          toast.success(`${platform} webhook saved`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const rewriteMcp = () => {
    startTransition(async () => {
      try {
        const r = await writeMcpConfigAction();
        toast.success(`Updated ${r.path}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Write failed");
      }
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Rotate API keys, manage platform webhooks, and control where Claude Code sees the MCP server."
      />


      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Tier
            <span
              className={cn(
                "text-base rounded-full px-2 py-0.5 font-medium uppercase tracking-wider border",
                tierMode === "free"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-violet-500/20 text-violet-300 border-violet-500/30"
              )}
            >
              {tierMode === "free" ? "Free mode" : "Paid mode"}
            </span>
          </CardTitle>
          <CardDescription>
            Flip to Free to route all Gemini calls through a free-tier key. Video / Kling is
            auto-disabled in Free mode (since Replicate always costs money). Your paid key stays
            saved — flipping back is one click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await setTierAction("paid");
                    setTierMode("paid");
                    toast.success("Switched to Paid mode");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Switch failed");
                  }
                });
              }}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                tierMode === "paid"
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-border hover:border-primary/60"
              )}
            >
              <div className="font-medium text-sm">Paid</div>
              <div className="text-base text-foreground mt-1 leading-relaxed">
                Uses your main GEMINI_API_KEY. Unlocks Kling video on Replicate.
              </div>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await setTierAction("free");
                    setTierMode("free");
                    toast.success(
                      hasFreeKey
                        ? "Switched to Free mode"
                        : "Free mode on — no free key set, falling back to main key. Paste a free-tier key below to switch."
                    );
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Switch failed");
                  }
                });
              }}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                tierMode === "free"
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : "border-border hover:border-primary/60"
              )}
            >
              <div className="font-medium text-sm flex items-center gap-2">
                Free
                {!hasFreeKey && (
                  <span className="text-base text-foreground font-normal opacity-70">
                    · no key yet
                  </span>
                )}
              </div>
              <div className="text-base text-foreground mt-1 leading-relaxed">
                {hasFreeKey
                  ? "Uses your free-tier Gemini key. Stills only — 15 req/min free quota."
                  : "Add a key below for the free quota, or switch now and we'll fall back to your main key."}
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="env-GEMINI_FREE">
              Free-tier Gemini key{" "}
              <span className="text-xs text-foreground font-normal">
                · separate from your main key
              </span>
            </Label>
            <div className="flex gap-2 items-start">
              <Input
                id="env-GEMINI_FREE"
                type="password"
                value={freeKeyInput}
                onChange={(e) => setFreeKeyInput(e.target.value)}
                placeholder={
                  hasFreeKey ? "•••••• (saved) — paste to replace" : "AIzaSy... from a new, unbilled project"
                }
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                variant="outline"
                size="default"
                onClick={() => {
                  if (!freeKeyInput) return;
                  startTransition(async () => {
                    try {
                      await saveFreeTierKeyAction(freeKeyInput);
                      setHasFreeKey(true);
                      setFreeKeyInput("");
                      toast.success("Free-tier key saved");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Save failed");
                    }
                  });
                }}
                disabled={!freeKeyInput || pending}
                className="gap-2"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
            <p className="text-base text-foreground leading-relaxed">
              Get one at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                aistudio.google.com/apikey
              </a>{" "}
              — pick &ldquo;Create API key in new project&rdquo; so it lands on the unbilled free tier.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className={env.configured ? "" : "border-amber-500/40"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {env.configured ? (
              <>
                <Check className="size-5 text-primary" /> Fully configured
              </>
            ) : (
              <>
                <AlertCircle className="size-5 text-amber-500" /> Setup incomplete
              </>
            )}
          </CardTitle>
          <CardDescription>
            {env.configured
              ? "All 7 required environment variables are set."
              : "Some values are missing. Generation and publishing will fail until setup is complete."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!env.configured && (
            <Link
              href="/setup?force=1"
              className={buttonVariants({ size: "default" }) + " gap-2"}
            >
              <RotateCcw className="size-4" />
              Run setup wizard
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Keys are saved to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.ad-studio/.env</code>.
            Values are never echoed back — leave a field blank to keep the current value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENV_KEYS.map(({ id, label, hint }) => (
            <div key={id} className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-2 items-end">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`env-${id}`}>
                    {label}{" "}
                    <span className="text-xs text-foreground font-normal">· {hint}</span>
                  </Label>
                  <span
                    className={cn(
                      "text-base rounded-full px-2 py-0.5 uppercase tracking-wide",
                      env.has[id]
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {env.has[id] ? "Set" : "Missing"}
                  </span>
                </div>
                <Input
                  id={`env-${id}`}
                  type="password"
                  value={keyValues[id] ?? ""}
                  onChange={(e) => setKeyValues({ ...keyValues, [id]: e.target.value })}
                  placeholder={env.has[id] ? "•••••• (saved)" : "Paste value"}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveKey(id)}
                disabled={!keyValues[id] || pending}
                className="gap-2"
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform webhooks</CardTitle>
          <CardDescription>
            Pipedream webhook URLs for publishing. Shared with the MCP server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className={cn("size-7 rounded-md shrink-0", PLATFORM_TONE[p])} />
              <div className="flex-1 min-w-0">
                <Label className="text-xs capitalize text-foreground">{p}</Label>
                <Input
                  value={webhookValues[p] ?? ""}
                  onChange={(e) =>
                    setWebhookValues({ ...webhookValues, [p]: e.target.value })
                  }
                  placeholder="https://eo...m.pipedream.net"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveHook(p)}
                disabled={pending}
              >
                Save
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claude Code MCP</CardTitle>
          <CardDescription>
            {mcp.exists && mcp.hasAdStudio
              ? "Ad Studio is installed as an MCP server. Restart Claude Code to pick up changes."
              : mcp.exists
              ? `${mcp.path} exists but doesn't include Ad Studio yet.`
              : `${mcp.path} doesn't exist yet.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mcp.otherServers.length > 0 && (
            <div className="text-sm text-foreground">
              Other servers preserved:{" "}
              {mcp.otherServers.map((s) => (
                <code key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded mr-1">
                  {s}
                </code>
              ))}
            </div>
          )}
          <Button onClick={rewriteMcp} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mcp.hasAdStudio ? "Rewrite mcp.json" : "Install Ad Studio MCP"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
