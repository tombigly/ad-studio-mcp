"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  KeyRound,
  Cloud,
  Webhook,
  Check,
  Loader2,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  saveEnvAction,
  validateGeminiKey,
  validateReplicateToken,
} from "@/lib/actions/setup";
import { verifyToken, provisionR2 } from "@/lib/cloudflare";
import { setWebhookUrl } from "@/lib/actions/webhooks";
import { writeMcpConfigAction } from "@/lib/actions/mcp-config";
import { cn } from "@/lib/utils";

type StepId = "welcome" | "gemini" | "replicate" | "cloudflare" | "pipedream" | "done";

const STEPS: { id: StepId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "gemini", label: "Gemini", icon: KeyRound },
  { id: "replicate", label: "Replicate", icon: KeyRound },
  { id: "cloudflare", label: "Cloudflare R2", icon: Cloud },
  { id: "pipedream", label: "Pipedream", icon: Webhook },
  { id: "done", label: "Finish", icon: Check },
];

export function SetupWizard({
  initialHas,
  initialWebhooks,
}: {
  initialHas: Record<string, boolean>;
  initialWebhooks: Record<string, string | null>;
}) {
  const router = useRouter();

  // Pre-mark steps already satisfied by disk state, so users don't re-enter keys.
  const initiallyComplete = (() => {
    const s = new Set<StepId>(["welcome"]);
    if (initialHas.GEMINI_API_KEY) s.add("gemini");
    if (initialHas.REPLICATE_API_TOKEN) s.add("replicate");
    if (
      initialHas.R2_ACCOUNT_ID &&
      initialHas.R2_BUCKET &&
      initialHas.R2_PUBLIC_BASE_URL &&
      initialHas.R2_ACCESS_KEY_ID &&
      initialHas.R2_SECRET_ACCESS_KEY
    ) {
      s.add("cloudflare");
    }
    if (Object.values(initialWebhooks).some((v) => v)) s.add("pipedream");
    return s;
  })();

  // First uncompleted step, or last (done) if everything is set.
  const firstUnfinished =
    STEPS.findIndex((s) => !initiallyComplete.has(s.id) && s.id !== "done");
  const [stepIndex, setStepIndex] = useState(
    firstUnfinished >= 0 ? firstUnfinished : STEPS.length - 1
  );
  const [completed, setCompleted] = useState<Set<StepId>>(initiallyComplete);

  const step = STEPS[stepIndex].id;

  const next = () => {
    setCompleted((prev) => {
      const n = new Set(prev);
      n.add(step);
      return n;
    });
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const back = () => setStepIndex(Math.max(0, stepIndex - 1));

  return (
    <div className="min-h-screen flex">
      <aside className="w-72 shrink-0 border-r border-border bg-sidebar px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500" />
          <div className="font-semibold tracking-tight">Ad Studio</div>
        </div>
        <div className="space-y-1">
          {STEPS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setStepIndex(i)}
              className={cn(
                "w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                i === stepIndex
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : completed.has(id)
                  ? "text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
                  : "text-sidebar-foreground/50"
              )}
            >
              <span
                className={cn(
                  "size-6 grid place-items-center rounded-full border text-xs",
                  completed.has(id)
                    ? "bg-primary border-primary text-primary-foreground"
                    : i === stepIndex
                    ? "border-primary text-primary"
                    : "border-border text-foreground"
                )}
              >
                {completed.has(id) ? <Check className="size-3" /> : i + 1}
              </span>
              <Icon className="size-4 opacity-70" />
              {label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              {step === "welcome" && <WelcomeStep onNext={next} initialHas={initialHas} />}
              {step === "gemini" && (
                <GeminiStep
                  onNext={next}
                  onBack={back}
                  alreadySaved={initialHas.GEMINI_API_KEY ?? false}
                />
              )}
              {step === "replicate" && (
                <ReplicateStep
                  onNext={next}
                  onBack={back}
                  alreadySaved={initialHas.REPLICATE_API_TOKEN ?? false}
                />
              )}
              {step === "cloudflare" && (
                <CloudflareStep
                  onNext={next}
                  onBack={back}
                  alreadySaved={
                    (initialHas.R2_ACCOUNT_ID &&
                      initialHas.R2_BUCKET &&
                      initialHas.R2_PUBLIC_BASE_URL &&
                      initialHas.R2_ACCESS_KEY_ID &&
                      initialHas.R2_SECRET_ACCESS_KEY) ??
                    false
                  }
                />
              )}
              {step === "pipedream" && (
                <PipedreamStep
                  onNext={next}
                  onBack={back}
                  initialWebhooks={initialWebhooks}
                />
              )}
              {step === "done" && <DoneStep onFinish={() => router.push("/")} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Individual steps ---------------------------------------------------

function WelcomeStep({
  onNext,
  initialHas,
}: {
  onNext: () => void;
  initialHas: Record<string, boolean>;
}) {
  const counted = Object.values(initialHas).filter(Boolean).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Let&apos;s get you posting.</CardTitle>
        <CardDescription className="text-base">
          Connect Gemini, Replicate, Cloudflare R2, and Pipedream. Five minutes end to end.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="size-4 text-foreground" />
            Your keys are saved locally in{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.ad-studio/.env</code>
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 text-foreground" />
            Claude Code config{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.claude/mcp.json</code>{" "}
            is written automatically
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 text-foreground" />
            You bring your own keys — we never proxy your generation
          </li>
        </ul>
        {counted > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
            Detected {counted} existing env value{counted === 1 ? "" : "s"}. You&apos;ll only
            need to fill in what&apos;s missing.
          </div>
        )}
        <div className="pt-2">
          <Button onClick={onNext} size="lg" className="gap-2">
            Get started <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GeminiStep({
  onNext,
  onBack,
  alreadySaved,
}: {
  onNext: () => void;
  onBack: () => void;
  alreadySaved: boolean;
}) {
  return (
    <KeyStep
      title="Gemini API key"
      description="Used for image generation (Nano Banana), prompt splitting, and captions. Free tier covers most dev."
      getKeyUrl="https://aistudio.google.com/apikey"
      envKey="GEMINI_API_KEY"
      placeholder="AIza..."
      validate={validateGeminiKey}
      onNext={onNext}
      onBack={onBack}
      alreadySaved={alreadySaved}
    />
  );
}

function ReplicateStep({
  onNext,
  onBack,
  alreadySaved,
}: {
  onNext: () => void;
  onBack: () => void;
  alreadySaved: boolean;
}) {
  return (
    <KeyStep
      title="Replicate token"
      description="Runs Kling v2.1 image-to-video. About $0.25 per 5-second video."
      getKeyUrl="https://replicate.com/account/api-tokens"
      envKey="REPLICATE_API_TOKEN"
      placeholder="r8_..."
      validate={validateReplicateToken}
      onNext={onNext}
      onBack={onBack}
      alreadySaved={alreadySaved}
    />
  );
}

function KeyStep({
  title,
  description,
  getKeyUrl,
  envKey,
  placeholder,
  validate,
  onNext,
  onBack,
  alreadySaved,
}: {
  title: string;
  description: string;
  getKeyUrl: string;
  envKey: string;
  placeholder: string;
  validate: (key: string) => Promise<{ ok: boolean; error?: string }>;
  onNext: () => void;
  onBack: () => void;
  alreadySaved: boolean;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "valid" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);

  const handleContinue = () => {
    if (!value) return;
    startTransition(async () => {
      setState("idle");
      setError(null);
      const result = await validate(value);
      if (!result.ok) {
        setState("invalid");
        setError(result.error ?? "Validation failed");
        toast.error("Key rejected by the service");
        return;
      }
      await saveEnvAction({ [envKey]: value });
      setState("valid");
      toast.success("Saved");
      setTimeout(onNext, 300);
    });
  };

  if (alreadySaved && !replaceMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl flex items-center gap-2">
            {title}{" "}
            <span className="text-xs rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-medium uppercase tracking-wide">
              Saved
            </span>
          </CardTitle>
          <CardDescription>
            This key is already set in your config. Nothing to do — unless you want to rotate it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
            <Check className="size-4 text-primary" />
            <code className="text-xs">{envKey}</code>
            <span className="text-foreground text-xs ml-auto">•••••• (saved)</span>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setReplaceMode(true)}>
                Replace
              </Button>
              <Button onClick={onNext} className="gap-2">
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <a
          href={getKeyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Get a key <ExternalLink className="size-3.5" />
        </a>
        <div className="space-y-2">
          <Label htmlFor={envKey}>{envKey}</Label>
          <Input
            id={envKey}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!value || pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {state === "valid" ? (
              <>
                Verified <Check className="size-4" />
              </>
            ) : (
              <>
                Verify &amp; save <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CloudflareStep({
  onNext,
  onBack,
  alreadySaved,
}: {
  onNext: () => void;
  onBack: () => void;
  alreadySaved: boolean;
}) {
  const [replaceMode, setReplaceMode] = useState(false);
  const [cfToken, setCfToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bucketName, setBucketName] = useState("ad-studio-media");
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<
    "token" | "verified" | "provisioning" | "need_creds" | "saving" | "done" | "error"
  >("token");
  const [error, setError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [tokenDashUrl, setTokenDashUrl] = useState<string | null>(null);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  const handleVerify = () => {
    startTransition(async () => {
      setError(null);
      const r = await verifyToken(cfToken);
      if (!r.ok) {
        setError(r.error ?? "Token invalid");
        setStep("error");
        return;
      }
      setAccounts(r.accounts ?? []);
      if (r.accounts && r.accounts.length === 1) {
        setAccountId(r.accounts[0].id);
      }
      setStep("verified");
      toast.success("Token accepted");
    });
  };

  const handleProvision = () => {
    startTransition(async () => {
      setError(null);
      setStep("provisioning");
      const r = await provisionR2({ token: cfToken, accountId, bucketName });
      if (!r.ok) {
        setError(`Failed at ${r.step}: ${r.error}`);
        setStep("error");
        return;
      }
      setPublicUrl(r.publicUrl ?? null);
      setTokenDashUrl(r.tokenDashboardUrl ?? null);
      // Save what we have so far so a refresh doesn't lose it.
      await saveEnvAction({
        R2_ACCOUNT_ID: accountId,
        R2_BUCKET: bucketName,
        R2_PUBLIC_BASE_URL: r.publicUrl ?? "",
      });
      setStep("need_creds");
      toast.success("Bucket + public URL ready");
    });
  };

  const handleSaveCreds = () => {
    startTransition(async () => {
      setError(null);
      setStep("saving");
      try {
        await saveEnvAction({
          R2_ACCESS_KEY_ID: accessKeyId.trim(),
          R2_SECRET_ACCESS_KEY: secretAccessKey.trim(),
        });
        setStep("done");
        toast.success("R2 credentials saved");
        setTimeout(onNext, 600);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        setStep("need_creds");
      }
    });
  };

  if (alreadySaved && !replaceMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl flex items-center gap-2">
            Cloudflare R2{" "}
            <span className="text-xs rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-medium uppercase tracking-wide">
              Saved
            </span>
          </CardTitle>
          <CardDescription>
            Bucket, public URL, and S3 credentials already configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
            <Check className="size-4 text-primary" />
            <span>Storage is ready</span>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setReplaceMode(true)}>
                Reconfigure
              </Button>
              <Button onClick={onNext} className="gap-2">
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl flex items-center gap-2">
          Cloudflare R2{" "}
          <span className="text-xs rounded-full bg-muted text-foreground px-2 py-0.5 font-medium uppercase tracking-wide">
            Optional
          </span>
        </CardTitle>
        <CardDescription>
          Publishing works without this — the studio runs a local tunnel that Pipedream can
          fetch from. Add R2 only if you want <em>persistent</em> public URLs that survive
          restarts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={onNext} className="gap-1 text-foreground">
            Skip — use tunnel instead <ArrowRight className="size-3.5" />
          </Button>
        </div>
        <a
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Create an API token (template: &ldquo;Edit R2 Storage&rdquo;){" "}
          <ExternalLink className="size-3.5" />
        </a>

        <div className="space-y-2">
          <Label htmlFor="cf-token">Cloudflare API token</Label>
          <Input
            id="cf-token"
            type="password"
            value={cfToken}
            onChange={(e) => setCfToken(e.target.value)}
            placeholder="Bearer token with R2 edit scope"
            autoComplete="off"
            spellCheck={false}
            disabled={step === "done" || step === "need_creds" || pending}
          />
        </div>

        {step !== "token" && accounts.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="cf-account">Account</Label>
            <select
              id="cf-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={step === "done" || step === "need_creds" || pending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </div>
        )}

        {step !== "token" && (
          <div className="space-y-2">
            <Label htmlFor="cf-bucket">Bucket name</Label>
            <Input
              id="cf-bucket"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              disabled={step === "done" || step === "need_creds" || pending}
            />
          </div>
        )}

        {publicUrl && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
            <div className="flex items-center gap-1.5 text-primary">
              <Check className="size-3.5" />
              <span className="text-xs font-medium">Bucket + public URL ready</span>
            </div>
            <code className="text-xs break-all block opacity-80">{publicUrl}</code>
          </div>
        )}

        {step === "need_creds" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="text-sm font-medium">
              Last step: paste your S3 access keys
            </div>
            <p className="text-xs text-foreground">
              Cloudflare generates these in the dashboard only. Click below, click{" "}
              <strong>&ldquo;Create API token&rdquo;</strong>, select permission{" "}
              <strong>&ldquo;Object Read &amp; Write&rdquo;</strong>, restrict to bucket{" "}
              <code className="text-base bg-background px-1 rounded">{bucketName}</code>,
              then paste the two values below.
            </p>
            {tokenDashUrl && (
              <a
                href={tokenDashUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Open R2 API Tokens <ExternalLink className="size-3.5" />
              </a>
            )}
            <div className="space-y-2">
              <Label htmlFor="r2-access-key" className="text-xs">
                Access Key ID
              </Label>
              <Input
                id="r2-access-key"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="e.g. 4f25…"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r2-secret-key" className="text-xs">
                Secret Access Key
              </Label>
              <Input
                id="r2-secret-key"
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="(shown once by Cloudflare)"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            Back
          </Button>
          {step === "token" && (
            <Button onClick={handleVerify} disabled={!cfToken || pending} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Verify token <ArrowRight className="size-4" />
            </Button>
          )}
          {(step === "verified" || step === "error") && (
            <Button
              onClick={handleProvision}
              disabled={!accountId || !bucketName || pending}
              className="gap-2"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create bucket &amp; public URL <ArrowRight className="size-4" />
            </Button>
          )}
          {step === "provisioning" && (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" /> Provisioning
            </Button>
          )}
          {step === "need_creds" && (
            <Button
              onClick={handleSaveCreds}
              disabled={!accessKeyId || !secretAccessKey || pending}
              className="gap-2"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save credentials <ArrowRight className="size-4" />
            </Button>
          )}
          {step === "saving" && (
            <Button disabled className="gap-2">
              <Loader2 className="size-4 animate-spin" /> Saving
            </Button>
          )}
          {step === "done" && (
            <Button onClick={onNext} className="gap-2">
              Continue <Check className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const PLATFORM_META: {
  id: "x" | "instagram" | "tiktok" | "facebook" | "youtube";
  label: string;
  tone: string;
}[] = [
  { id: "x", label: "X / Twitter", tone: "bg-zinc-900 dark:bg-zinc-100" },
  { id: "instagram", label: "Instagram", tone: "bg-gradient-to-br from-pink-500 to-orange-400" },
  { id: "tiktok", label: "TikTok", tone: "bg-gradient-to-br from-cyan-400 to-pink-500" },
  { id: "facebook", label: "Facebook", tone: "bg-blue-600" },
  { id: "youtube", label: "YouTube", tone: "bg-red-600" },
];

function PipedreamStep({
  onNext,
  onBack,
  initialWebhooks,
}: {
  onNext: () => void;
  onBack: () => void;
  initialWebhooks: Record<string, string | null>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLATFORM_META.map(({ id }) => [id, initialWebhooks[id] ?? ""])
    )
  );
  const [saved, setSaved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      PLATFORM_META.map(({ id }) => [id, Boolean(initialWebhooks[id])])
    )
  );
  const [pending, startTransition] = useTransition();

  const save = (platform: "x" | "instagram" | "tiktok" | "facebook" | "youtube") => {
    const url = urls[platform];
    if (!url) return;
    startTransition(async () => {
      try {
        await setWebhookUrl(platform, url);
        setSaved((s) => ({ ...s, [platform]: true }));
        toast.success(`${platform} webhook saved`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  // Bulk-save any populated-but-unsaved URLs when the user clicks Continue.
  const continueAndFlush = () => {
    startTransition(async () => {
      const pendingSaves: Array<Promise<unknown>> = [];
      const toMarkSaved: string[] = [];
      for (const { id } of PLATFORM_META) {
        const url = urls[id];
        if (url && !saved[id]) {
          pendingSaves.push(
            setWebhookUrl(
              id as "x" | "instagram" | "tiktok" | "facebook" | "youtube",
              url
            )
          );
          toMarkSaved.push(id);
        }
      }
      if (pendingSaves.length > 0) {
        try {
          await Promise.all(pendingSaves);
          setSaved((s) => {
            const n = { ...s };
            for (const id of toMarkSaved) n[id] = true;
            return n;
          });
          toast.success(`Saved ${pendingSaves.length} webhook${pendingSaves.length === 1 ? "" : "s"}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Bulk save failed");
          return;
        }
      }
      onNext();
    });
  };

  const savedCount = Object.values(saved).filter(Boolean).length;
  const dirtyCount = PLATFORM_META.filter(
    ({ id }) => urls[id] && !saved[id]
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Pipedream webhooks</CardTitle>
        <CardDescription>
          One webhook per platform. Pipedream handles the OAuth to your social accounts —
          we just fire the payload. Add the platforms you care about now; skip the rest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <a
          href="https://pipedream.com/new"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Create workflows on Pipedream <ExternalLink className="size-3.5" />
        </a>
        <div className="space-y-3">
          {PLATFORM_META.map(({ id, label, tone }) => (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className={cn("size-8 rounded-md shrink-0", tone)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{label}</div>
                <Input
                  value={urls[id] ?? ""}
                  onChange={(e) => setUrls((u) => ({ ...u, [id]: e.target.value }))}
                  placeholder="https://eo...m.pipedream.net"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <Button
                variant={saved[id] ? "secondary" : "outline"}
                size="sm"
                onClick={() => save(id)}
                disabled={!urls[id] || pending}
                className="gap-1"
              >
                {saved[id] ? <Check className="size-3.5" /> : null}
                {saved[id] ? "Saved" : "Save"}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            Back
          </Button>
          <Button onClick={continueAndFlush} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {dirtyCount > 0
              ? `Save ${dirtyCount} & continue`
              : savedCount > 0
              ? `Continue with ${savedCount}`
              : "Skip for now"}{" "}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  const [state, setState] = useState<"idle" | "writing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mcpPath, setMcpPath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const writeConfig = () => {
    startTransition(async () => {
      setState("writing");
      setError(null);
      try {
        const r = await writeMcpConfigAction();
        setMcpPath(r.path);
        setState("done");
        toast.success("Claude Code is wired up");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl flex items-center gap-2">
          <Check className="size-6 text-primary" /> You&apos;re set up
        </CardTitle>
        <CardDescription>
          One last step: write your config to{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">~/.claude/mcp.json</code>{" "}
          so Claude Code sees the same tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "idle" && (
          <Button size="lg" onClick={writeConfig} disabled={pending} className="gap-2">
            Install MCP server <ArrowRight className="size-4" />
          </Button>
        )}
        {state === "writing" && (
          <Button size="lg" disabled className="gap-2">
            <Loader2 className="size-4 animate-spin" /> Writing config
          </Button>
        )}
        {state === "error" && (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button size="lg" onClick={writeConfig} className="gap-2">
              Retry
            </Button>
          </>
        )}
        {state === "done" && mcpPath && (
          <>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
              <div className="text-foreground text-xs">
                Wrote <code className="bg-background px-1 rounded">{mcpPath}</code>.
                Restart Claude Code to pick up the new server.
              </div>
            </div>
            <Button size="lg" onClick={onFinish} className="gap-2">
              Open dashboard <ArrowRight className="size-4" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
