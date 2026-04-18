"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Send, Loader2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  approveAdAction,
  publishAdAction,
  deleteAdAction,
  updateCaptionsAction,
} from "@/lib/actions/ads";
import { cn } from "@/lib/utils";

type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";

const PLATFORM_META: Record<Platform, { label: string; tone: string }> = {
  x: { label: "X", tone: "bg-zinc-900 dark:bg-zinc-200" },
  instagram: { label: "Instagram", tone: "bg-gradient-to-br from-pink-500 to-orange-400" },
  tiktok: { label: "TikTok", tone: "bg-gradient-to-br from-cyan-400 to-pink-500" },
  facebook: { label: "Facebook", tone: "bg-blue-600" },
  youtube: { label: "YouTube", tone: "bg-red-600" },
};

interface Props {
  adId: string;
  status: string;
  platforms: string[];
  captions: Record<string, unknown>;
  posts: Array<{
    id: string;
    platform: string;
    status: string;
    published_at: number | null;
  }>;
}

export function AdDetailClient({ adId, status, platforms, captions, posts }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of platforms) {
      const v = captions[p];
      if (typeof v === "string") out[p] = v;
      else if (v && typeof v === "object") out[p] = JSON.stringify(v, null, 2);
    }
    return out;
  });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const saveCaptions = () => {
    startTransition(async () => {
      try {
        const next = { ...(captions as Record<string, unknown>) };
        for (const [k, v] of Object.entries(local)) {
          if (k === "youtube") {
            try {
              next[k] = JSON.parse(v);
            } catch {
              next[k] = v;
            }
          } else {
            next[k] = v;
          }
        }
        await updateCaptionsAction(adId, JSON.stringify(next));
        setDirty({});
        toast.success("Captions saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const approve = () => {
    startTransition(async () => {
      try {
        await approveAdAction(adId);
        toast.success("Ad approved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Approve failed");
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      try {
        await deleteAdAction(adId);
        toast.success("Deleted");
        router.push("/ads");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const canApprove = status === "draft";
  const canPublish = status === "approved" || status === "failed";

  const defaultTab = platforms[0] ?? "instagram";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button onClick={approve} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Approve
          </Button>
        )}
        {canPublish && (
          <PublishDialog adId={adId} platforms={platforms as Platform[]} />
        )}
        <Button
          variant="outline"
          onClick={saveCaptions}
          disabled={pending || Object.values(dirty).every((v) => !v)}
          className="gap-2"
        >
          Save captions
        </Button>
        <DeleteAdButton onConfirm={remove} pending={pending} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 pt-2">
              {platforms.map((p) => {
                const meta = PLATFORM_META[p as Platform];
                return (
                  <TabsTrigger key={p} value={p} className="gap-2">
                    <span className={cn("size-2.5 rounded-sm", meta?.tone ?? "bg-muted")} />
                    {meta?.label ?? p}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {platforms.map((p) => (
              <TabsContent key={p} value={p} className="p-5 space-y-3">
                <Label htmlFor={`cap-${p}`}>Caption</Label>
                {p === "youtube" ? (
                  <YouTubeEditor
                    value={local[p] ?? "{}"}
                    onChange={(v) => {
                      setLocal((s) => ({ ...s, [p]: v }));
                      setDirty((d) => ({ ...d, [p]: true }));
                    }}
                  />
                ) : (
                  <Textarea
                    id={`cap-${p}`}
                    rows={6}
                    value={local[p] ?? ""}
                    onChange={(e) => {
                      setLocal({ ...local, [p]: e.target.value });
                      setDirty({ ...dirty, [p]: true });
                    }}
                  />
                )}
                <p className="text-xs text-foreground">
                  {p === "x" && "280 characters max."}
                  {p === "instagram" && "2200 characters max. Hashtags at end."}
                  {p === "tiktok" && "2200 characters. Strong hook first."}
                  {p === "facebook" && "Conversational paragraphs."}
                  {p === "youtube" && "Edit title and description as JSON."}
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {posts.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-medium">Posts</div>
            <div className="space-y-2">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2.5 rounded-sm",
                        PLATFORM_META[post.platform as Platform]?.tone ?? "bg-muted"
                      )}
                    />
                    <span className="capitalize">{post.platform}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {post.status === "sent" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                    {post.status === "failed" && <XCircle className="size-3.5 text-destructive" />}
                    <span className="text-foreground">{post.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function YouTubeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let obj: { title?: string; description?: string } = {};
  try {
    obj = JSON.parse(value);
  } catch {}

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-foreground">Title (≤100)</Label>
        <Input
          value={obj.title ?? ""}
          onChange={(e) =>
            onChange(JSON.stringify({ ...obj, title: e.target.value }, null, 2))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-foreground">Description</Label>
        <Textarea
          rows={6}
          value={obj.description ?? ""}
          onChange={(e) =>
            onChange(JSON.stringify({ ...obj, description: e.target.value }, null, 2))
          }
        />
      </div>
    </div>
  );
}

function PublishDialog({ adId, platforms }: { adId: string; platforms: Platform[] }) {
  const [selected, setSelected] = useState<Set<Platform>>(new Set(platforms));
  const [when, setWhen] = useState("");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const publish = () => {
    startTransition(async () => {
      try {
        await publishAdAction(adId, when || undefined);
        toast.success("Published");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Publish failed");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Send className="size-4" />
            Publish
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish this ad</DialogTitle>
          <DialogDescription>
            Fires the configured Pipedream webhooks for each selected platform.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const on = selected.has(p);
                const meta = PLATFORM_META[p];
                return (
                  <button
                    key={p}
                    onClick={() => {
                      const next = new Set(selected);
                      if (on) next.delete(p);
                      else next.add(p);
                      setSelected(next);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm flex items-center gap-2 transition-colors",
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border text-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-2.5 rounded-sm", meta.tone)} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="when">Schedule (optional)</Label>
            <Input
              id="when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <p className="text-xs text-foreground">
              Leave empty to publish now. Otherwise Pipedream delays until this time.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={publish} disabled={pending || selected.size === 0} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {when ? "Schedule" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAdButton({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="destructive" className="gap-2">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this ad?</DialogTitle>
          <DialogDescription>
            Removes the ad, its captions, and any associated posts. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="destructive" onClick={onConfirm} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
