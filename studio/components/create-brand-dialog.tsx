"use client";
import { useState, useTransition } from "react";
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

export function CreateBrandDialog({ cta }: { cta?: string }) {
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
        const result = await createBrandAction({
          name: form.name,
          url: form.url || undefined,
          voice: form.voice || undefined,
          audiences:
            form.audiences
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .length > 0
              ? form.audiences.split(",").map((s) => s.trim()).filter(Boolean)
              : undefined,
        });
        toast.success(`Created ${result.brand.voice ? "brand" : "brand"}`);
        setOpen(false);
        setForm({ name: "", url: "", voice: "", audiences: "" });
        router.push(`/brands/${result.brand_id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create brand");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size={cta ? "lg" : "default"} className="gap-2">
            {cta ? <Sparkles className="size-4" /> : <Plus className="size-4" />}
            {cta ?? "New brand"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a brand</DialogTitle>
          <DialogDescription>
            Paste a URL and we&apos;ll build a voice + audience profile with Gemini. The
            other fields are optional hints.
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
            <Label htmlFor="url">Website URL</Label>
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
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
