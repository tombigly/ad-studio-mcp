"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Film,
  Type,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { Plus } from "lucide-react";

type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";
type Aspect = "9:16" | "1:1" | "16:9";

const PLATFORMS: { id: Platform; label: string; tone: string; aspect: Aspect }[] = [
  { id: "instagram", label: "Instagram", tone: "bg-gradient-to-br from-pink-500 to-orange-400", aspect: "9:16" },
  { id: "tiktok", label: "TikTok", tone: "bg-gradient-to-br from-cyan-400 to-pink-500", aspect: "9:16" },
  { id: "youtube", label: "YouTube", tone: "bg-red-600", aspect: "9:16" },
  { id: "facebook", label: "Facebook", tone: "bg-blue-600", aspect: "1:1" },
  { id: "x", label: "X", tone: "bg-zinc-900 dark:bg-zinc-200", aspect: "16:9" },
];

const ASPECT_TO_PLATFORMS = (aspect: Aspect) =>
  PLATFORMS.filter((p) => p.aspect === aspect);

const STAGES = [
  { id: "preflight", label: "Checking providers", icon: Scissors },
  { id: "split", label: "Splitting prompt", icon: Scissors },
  { id: "image", label: "Generating hero frame", icon: ImageIcon },
  { id: "video", label: "Rendering video", icon: Film },
  { id: "captions", label: "Writing captions", icon: Type },
];

type StageState = "pending" | "active" | "done" | "skipped" | "error";

export function StudioForm({
  brands,
  defaultBrandId,
  tierMode = "paid",
}: {
  brands: Array<{ id: string; name: string }>;
  defaultBrandId?: string;
  tierMode?: "paid" | "free";
}) {
  const router = useRouter();
  // Maintain a local copy of brands so we can append new ones inline without a
  // full page reload. Seeded from server-rendered props.
  const [localBrands, setLocalBrands] = useState(brands);
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "tiktok"]);
  const isFreeTier = tierMode === "free";

  type CreativeType = "still" | "video" | "both";
  const [creativeType, setCreativeType] = useState<CreativeType>("still");
  // In free mode, force still and never send anything else to the server.
  const effectiveCreativeType: CreativeType = isFreeTier ? "still" : creativeType;
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Record<string, StageState>>({});
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: Platform) => {
    setPlatforms((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p]
    );
  };

  const canSubmit = brandId && prompt.length >= 4 && platforms.length > 0 && !running;

  const generate = async () => {
    if (!canSubmit) return;
    setRunning(true);
    setError(null);
    setStages(Object.fromEntries(STAGES.map((s) => [s.id, "pending"])));

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          prompt,
          platforms,
          creative_type: effectiveCreativeType,
        }),
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let adId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const eventLine = chunk.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));

          if (event === "stage") {
            setStages((s) => ({
              ...s,
              [data.stage]:
                data.status === "start"
                  ? "active"
                  : data.status === "skipped"
                  ? "skipped"
                  : "done",
            }));
          } else if (event === "done") {
            adId = data.ad_id;
            toast.success("Ad generated");
          } else if (event === "error") {
            setError(data.message);
            toast.error(data.message);
          }
        }
      }

      if (adId) {
        setTimeout(() => router.push(`/ads/${adId}`), 400);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  if (localBrands.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
        <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
          <div className="size-14 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-border/60">
            <Sparkles className="size-6 text-violet-300" />
          </div>
          <div className="max-w-sm space-y-1.5">
            <div className="font-medium">Start with a brand</div>
            <p className="text-sm text-foreground leading-relaxed">
              Brands are reusable — they define voice and audiences so every ad sounds like you.
            </p>
          </div>
          <CreateBrandDialog
            cta="Create your first brand"
            onCreated={(b) => {
              setLocalBrands([{ id: b.brand_id, name: b.name }]);
              setBrandId(b.brand_id);
              router.refresh();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
      <Card className="border-border/60">
        <CardContent className="p-6 md:p-7 space-y-7">
          <FormSection
            title="Brand"
            hint="Whose voice should this ad sound like? Tap + to add one on the fly."
          >
            <div className="flex flex-wrap gap-2 items-center">
              {localBrands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrandId(b.id)}
                  disabled={running}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xl transition-colors",
                    b.id === brandId
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {b.name}
                </button>
              ))}
              <CreateBrandDialog
                trigger={
                  <button
                    type="button"
                    disabled={running}
                    className={cn(
                      "rounded-full border border-dashed px-3.5 py-1.5 text-xl flex items-center gap-1.5 transition-colors",
                      "text-foreground hover:text-foreground hover:border-primary/60 hover:bg-primary/5"
                    )}
                    title="Create a new brand"
                  >
                    <Plus className="size-3.5" />
                    New brand
                  </button>
                }
                onCreated={(b) => {
                  setLocalBrands((curr) => [
                    ...curr,
                    { id: b.brand_id, name: b.name },
                  ]);
                  setBrandId(b.brand_id);
                  toast.success(`Selected ${b.name}`);
                  // Keep server state in sync in the background.
                  router.refresh();
                }}
              />
            </div>
          </FormSection>

          <FormSection
            title="Creative brief"
            hint="Describe the shot. We split this into a scene for Nano Banana and motion for Kling automatically."
          >
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Cold brew in a glass, morning light through a coffee shop window, steam rising, subtle bokeh, hero shot"
              rows={5}
              disabled={running}
              className="resize-none text-base leading-relaxed"
            />
          </FormSection>

          <FormSection
            title="Platforms"
            hint="Pick anywhere from one platform to all five."
          >
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label, tone }) => {
                const on = platforms.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => togglePlatform(id)}
                    disabled={running}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors flex items-center gap-2",
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border text-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-3 rounded-sm", tone)} />
                    {label}
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormSection
            title="Aspect ratios"
            hint="Auto-picked per platform. One render per unique aspect — shared platforms re-use the asset."
          >
            <div className="space-y-1.5">
              {(["9:16", "1:1", "16:9"] as Aspect[])
                .map((a) => ({
                  aspect: a,
                  platforms: ASPECT_TO_PLATFORMS(a).filter((p) => platforms.includes(p.id)),
                }))
                .filter((row) => row.platforms.length > 0)
                .map((row) => (
                  <div
                    key={row.aspect}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5"
                  >
                    <span className="text-sm font-semibold font-mono w-14 text-foreground/80">
                      {row.aspect}
                    </span>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {row.platforms.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-xs"
                        >
                          <span className={cn("size-2 rounded-sm", p.tone)} />
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              {platforms.length === 0 && (
                <p className="text-xs text-foreground py-1">
                  Pick at least one platform above.
                </p>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Creative type"
            hint={
              isFreeTier
                ? "Free mode: stills only. Flip to Paid in Settings to unlock Kling video."
                : "Still for quick iteration, Video when you want motion. Both renders everything and lets you pick per-platform at publish."
            }
          >
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "still" as CreativeType,
                    label: "Still",
                    cost: "≈ $0.04",
                    hint: "Image only. Gemini only.",
                  },
                  {
                    id: "video" as CreativeType,
                    label: "Video",
                    cost: "≈ $0.30",
                    hint: "Kling motion on the hero frame.",
                  },
                  {
                    id: "both" as CreativeType,
                    label: "Both",
                    cost: "≈ $0.30",
                    hint: "Still + video. Pick per platform on publish.",
                  },
                ]
              ).map((opt) => {
                const locked = isFreeTier && opt.id !== "still";
                const active =
                  !locked && (isFreeTier ? opt.id === "still" : creativeType === opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => !locked && setCreativeType(opt.id)}
                    disabled={running || locked}
                    title={locked ? "Not available in Free mode" : undefined}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/60",
                      locked && "opacity-40 cursor-not-allowed hover:border-border"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">
                        {opt.label}
                        {locked && (
                          <span className="text-xs ml-1.5 text-foreground font-normal">
                            · paid
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-foreground">{opt.cost}</span>
                    </div>
                    <p className="text-sm text-foreground mt-1.5 leading-relaxed">
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </FormSection>

          <Button
            size="lg"
            onClick={generate}
            disabled={!canSubmit}
            className="gap-2 w-full h-12 text-base font-medium"
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {creativeType === "still"
                  ? "Generate still ad"
                  : creativeType === "video"
                  ? "Generate video ad"
                  : "Generate still + video"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "border-border/60 h-fit sticky top-6",
          !running && Object.keys(stages).length === 0 && "opacity-80"
        )}
      >
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1.5">
            {/* h3 */}
            <h3 className="text-xl font-semibold tracking-tight">Pipeline</h3>
            <p className="text-sm text-foreground leading-relaxed">
              Each stage streams live while you wait. Safe to leave this tab open.
            </p>
          </div>
          <div className="space-y-2">
            {STAGES.map(({ id, label, icon: Icon }) => {
              const state = (stages[id] ?? "pending") as StageState;
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border p-3 text-xl",
                    state === "active" && "border-primary bg-primary/5",
                    state === "done" && "opacity-80",
                    state === "skipped" && "opacity-40"
                  )}
                >
                  {state === "active" ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="size-[18px] text-primary" />
                    </motion.div>
                  ) : state === "done" ? (
                    <CheckCircle2 className="size-[18px] text-primary" />
                  ) : state === "error" ? (
                    <XCircle className="size-[18px] text-destructive" />
                  ) : (
                    <Icon className="size-[18px] text-foreground" />
                  )}
                  <span className={cn((state === "pending" || state === "skipped") && "text-foreground")}>
                    {label}
                  </span>
                  {state === "skipped" && (
                    <span className="ml-auto text-xs uppercase tracking-wide text-foreground">
                      Skipped
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive leading-relaxed">
              {error}
            </div>
          )}
          {!running && !error && Object.keys(stages).length === 0 && (
            <p className="text-sm text-foreground leading-relaxed">
              Kling adds ~60–90s to video renders. Stills finish in ~15s.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Titled section with a one-sentence helper. Used across the studio form.
// Acts as an h4 in the page's heading hierarchy.
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-lg font-semibold tracking-tight">{title}</h4>
        {hint && (
          <p className="text-sm text-foreground leading-relaxed">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}
