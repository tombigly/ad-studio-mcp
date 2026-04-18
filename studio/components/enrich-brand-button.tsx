"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enrichBrandAction } from "@/lib/actions/brands";

export function EnrichBrandButton({
  brand_id,
  hasUrl,
}: {
  brand_id: string;
  hasUrl: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const enrich = () => {
    startTransition(async () => {
      try {
        await enrichBrandAction(brand_id);
        toast.success("Brand enriched with AI");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(
          msg.includes("prepayment") || msg.includes("429")
            ? "Gemini is out of credits — brand is unchanged"
            : `Enrichment failed: ${msg.slice(0, 120)}`
        );
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="default"
      onClick={enrich}
      disabled={pending}
      className="gap-2"
      title={
        hasUrl
          ? "Ask Gemini to fill in pillars, do/don't lists, etc. from the brand URL"
          : "Ask Gemini to infer BrandSystem fields from the brand name"
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      Auto-fill with AI
    </Button>
  );
}
