"use client";
import { useState, useTransition, isValidElement, cloneElement } from "react";
import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBrandAction } from "@/lib/actions/brands";

export interface BrandCreated {
  brand_id: string;
  name: string;
  voice: string;
}

export function CreateBrandDialog({
  cta,
  trigger,
  onCreated,
}: {
  cta?: string;
  /** Custom trigger element. If omitted, a default pill button is rendered. */
  trigger?: ReactElement;
  /**
   * Called after successful creation. When provided, dialog does NOT navigate to /brands/[id].
   * Lets callers (e.g. Studio) keep the user in place and select the new brand inline.
   */
  onCreated?: (brand: BrandCreated) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    url: "",
    voice: "",
    audiences: "",
  });

  const submit = () => {
    if (!form.name) return;
    startTransition(async () => {
      try {
        const audiences = form.audiences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const result = await createBrandAction({
          name: form.name,
          url: form.url || undefined,
          voice: form.voice || undefined,
          audiences: audiences.length > 0 ? audiences : undefined,
        });
        toast.success("Brand created");
        setOpen(false);
        setForm({ name: "", url: "", voice: "", audiences: "" });
        if (onCreated) {
          onCreated({
            brand_id: result.brand_id,
            name: form.name,
            voice: result.brand.voice,
          });
        } else {
          router.push(`/brands/${result.brand_id}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create brand");
      }
    });
  };

  const defaultTrigger = (
    <Button size={cta ? "lg" : "default"} className="gap-2">
      {cta ? <Sparkles className="size-4" /> : <Plus className="size-4" />}
      {cta ?? "New brand"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={isValidElement(trigger) ? cloneElement(trigger) : defaultTrigger}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a brand</DialogTitle>
          <DialogDescription>
            Just a name is required. Add a URL and you can click &ldquo;Auto-fill with AI&rdquo; on
            the brand page afterwards to fill in voice, pillars, and audiences automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Coffee"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Website URL (optional)</Label>
            <Input
              id="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://acmecoffee.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice">Voice (optional)</Label>
            <Textarea
              id="voice"
              value={form.voice}
              onChange={(e) => setForm({ ...form, voice: e.target.value })}
              placeholder="warm, direct, a little dry humor"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audiences">Audiences (optional, comma-separated)</Label>
            <Input
              id="audiences"
              value={form.audiences}
              onChange={(e) => setForm({ ...form, audiences: e.target.value })}
              placeholder="remote workers, café owners, coffee enthusiasts"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={submit} disabled={!form.name || pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create brand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
