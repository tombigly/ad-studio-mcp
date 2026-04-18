import Link from "next/link";
import { Users, Sparkles } from "lucide-react";
import { listBrands } from "@/lib/queries";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  const brands = safeListBrands();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Brands"
        subtitle="A brand is a reusable voice + audience profile. Every ad inherits its tone from here."
        actions={<CreateBrandDialog />}
      />

      {brands.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="size-14 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-border/60">
              <Users className="size-6 text-violet-300" />
            </div>
            <div className="max-w-md space-y-1.5">
              <div className="font-medium">No brands yet</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create your first brand. Add a URL later and we can auto-fill the voice, pillars, and audiences in one click.
              </p>
            </div>
            <CreateBrandDialog cta="Create your first brand" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => {
            let brandObj: { voice?: string; audiences?: string[]; pillars?: string[] } = {};
            try {
              brandObj = JSON.parse(b.brand_json);
            } catch {}
            const initials = b.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <Link key={b.id} href={`/brands/${b.id}`}>
                <Card className="border-border/60 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl grid place-items-center text-sm font-semibold bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-border/60 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{b.name}</div>
                          {b.url && (
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {safeHost(b.url)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {brandObj.voice && (
                      <div className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {brandObj.voice}
                      </div>
                    )}
                    {brandObj.pillars && brandObj.pillars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandObj.pillars.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-[10px] rounded-full border border-border/60 px-2 py-0.5 bg-muted/40 text-foreground/70"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function safeListBrands() {
  try {
    return listBrands();
  } catch {
    return [];
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Kept referenced to avoid unused warning; used in the empty state
void Sparkles;
