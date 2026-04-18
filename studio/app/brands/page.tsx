import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { listBrands } from "@/lib/queries";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  const brands = safeListBrands();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Brands</h1>
          <p className="text-muted-foreground mt-1">Voice, audience, and pillars.</p>
        </div>
        <CreateBrandDialog />
      </header>

      {brands.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Users className="size-6" />
            <div className="max-w-sm">
              No brands yet. Create your first brand — paste a URL and we&apos;ll build
              a voice + audience profile for you.
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
            return (
              <Link key={b.id} href={`/brands/${b.id}`}>
                <Card className="hover:border-primary/60 transition-colors h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{b.name}</div>
                        {b.url && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {new URL(b.url).hostname}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {brandObj.voice && (
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {brandObj.voice}
                      </div>
                    )}
                    {brandObj.pillars && brandObj.pillars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandObj.pillars.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-[10px] rounded-full border border-border px-2 py-0.5 bg-muted/40"
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

// keep Plus + Link referenced via sidebar etc. — silence unused import if any
void Plus;
