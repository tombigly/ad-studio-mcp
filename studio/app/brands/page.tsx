import Link from "next/link";
import { Users, Sparkles } from "lucide-react";
import { listBrands } from "@/lib/queries";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await safeListBrands();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Brands"
        subtitle="A brand is a reusable voice + audience profile. Every ad inherits its tone from here."
        actions={<CreateBrandDialog />}
      />

      {brands.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
          <CardContent className="py-20 flex flex-col items-center gap-5 text-center">
            <div className="size-16 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-border/60">
              <Users className="size-7 text-violet-300" />
            </div>
            <div className="max-w-md space-y-2">
              {/* h3 */}
              <h3 className="text-xl font-medium tracking-tight">No brands yet</h3>
              <p className="text-base text-foreground leading-relaxed">
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
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-xl grid place-items-center text-base font-semibold bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-border/60 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          {/* h3 — brand name */}
                          <h3 className="text-xl font-semibold tracking-tight truncate">{b.name}</h3>
                          {b.url && (
                            <p className="text-sm text-foreground truncate mt-0.5">
                              {safeHost(b.url)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {brandObj.voice && (
                      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                        {brandObj.voice}
                      </p>
                    )}
                    {brandObj.pillars && brandObj.pillars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandObj.pillars.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-xs rounded-full border border-border/60 px-2.5 py-0.5 bg-muted/40 text-foreground/80"
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

async function safeListBrands() {
  try {
    return await listBrands();
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
