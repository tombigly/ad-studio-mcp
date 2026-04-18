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

type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";
type Aspect = "9:16" | "1:1" | "16:9";

const PLATFORMS: { id: Platform; label: string; tone: string }[] = [
  { id: "x", label: "X", tone: "bg-zinc-900 dark:bg-zinc-200" },
  { id: "instagram", label: "Instagram", tone: "bg-gradient-to-br from-pink-500 to-orange-400" },
  { id: "tiktok", label: "TikTok", tone: "bg-gradient-to-br from-cyan-400 to-pink-500" },
  { id: "facebook", label: "Facebook", tone: "bg-blue-600" },
  { id: "youtube", label: "YouTube", tone: "bg-red-600" },
];

const ASPECTS: { id: Aspect; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16", hint: "Reels, Shorts, TikTok" },
  { id: "1:1", label: "1:1", hint: "Feed, carousel" },
  { id: "16:9", label: "16:9", hint: "YouTube long-form, X" },
];

const STAGES = [
  { id: "split", label: "Splitting prompt", icon: Scissors },
  { id: "image", label: "Generating hero frame", icon: ImageIcon },
  { id: "video", label: "Rendering video", icon: Film },
  { id: "captions", label: "Writing captions", icon: Type },
];

type StageState = "pending" | "active" | "done" | "skipped" | "error";

export function StudioForm({
  brands,
  defaultBrandId,
}: {
  brands: Array<{ id: string; name: string }>;
  defaultBrandId?: string;
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "tiktok"]);
  const [aspect, setAspect] = useState<Aspect>("9:16");

  type CreativeType = "still" | "video" | "both";
  const [creativeType, setCreativeType] = useState<CreativeType>("still");
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
          aspect,
          creative_type: creativeType,
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

  if (brands.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Sparkles className="size-6" />
          <div className="max-w-sm">
            You need a brand first so we know what voice to use.
          </div>
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Create a brand
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Brand</Label>
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrandId(b.id)}
                  disabled={running}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    b.id === brandId
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Cold brew in a glass, morning light through a coffee shop window, steam rising, subtle bokeh, hero shot"
              rows={5}
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              Describe the shot. We&apos;ll split this into a scene prompt (Nano Banana) and a
              motion prompt (Kling) automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
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
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-3 rounded-sm", tone)} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECTS.map(({ id, label, hint }) => (
                <button
                  key={id}
                  onClick={() => setAspect(id)}
                  disabled={running}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left transition-colors",
                    id === aspect
                      ? "border-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Creative type</Label>
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
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCreativeType(opt.id)}
                  disabled={running}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left transition-colors",
                    creativeType === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.cost}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            onClick={generate}
            disabled={!canSubmit}
            className="gap-2 w-full"
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

      <Card className={cn(!running && Object.keys(stages).length === 0 && "opacity-60")}>
        <CardContent className="p-6 space-y-4">
          <div className="text-sm font-medium">Pipeline</div>
          <div className="space-y-2">
            {STAGES.map(({ id, label, icon: Icon }) => {
              const state = (stages[id] ?? "pending") as StageState;
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border border-border p-2.5 text-sm",
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
                      <Loader2 className="size-4 text-primary" />
                    </motion.div>
                  ) : state === "done" ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : state === "error" ? (
                    <XCircle className="size-4 text-destructive" />
                  ) : (
                    <Icon className="size-4 text-muted-foreground" />
                  )}
                  <span className={cn((state === "pending" || state === "skipped") && "text-muted-foreground")}>
                    {label}
                  </span>
                  {state === "skipped" && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      Skipped
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          {!running && !error && Object.keys(stages).length === 0 && (
            <p className="text-xs text-muted-foreground">
              Kling takes 60–120s. You can leave this tab open.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
