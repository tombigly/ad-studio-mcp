import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBrand, listAds } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DeleteBrandButton } from "@/components/delete-brand-button";
import { EnrichBrandButton } from "@/components/enrich-brand-button";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let brand;
  try {
    brand = getBrand(id);
  } catch {
    brand = null;
  }
  if (!brand) notFound();

  let brandJson: Record<string, unknown> = {};
  try {
    brandJson = JSON.parse(brand.brand_json);
  } catch {}

  const ads = safeListAds(id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to brands
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">{brand.name}</h1>
          {brand.url && (
            <a
              href={brand.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-foreground hover:text-primary"
            >
              {brand.url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EnrichBrandButton brand_id={brand.id} hasUrl={Boolean(brand.url)} />
          <Link
            href={`/studio?brand_id=${brand.id}`}
            className={buttonVariants({ size: "default" })}
          >
            Generate ad
          </Link>
          <DeleteBrandButton brand_id={brand.id} />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{(brandJson.voice as string) || "—"}</p>
          </CardContent>
        </Card>
        <ListCard title="Pillars" items={brandJson.pillars as string[]} />
        <ListCard title="Audiences" items={brandJson.audiences as string[]} />
        <ListCard title="Do" items={brandJson.do_list as string[]} />
        <ListCard title="Don't" items={brandJson.dont_list as string[]} />
        {Array.isArray(brandJson.offers) && brandJson.offers.length > 0 ? (
          <ListCard title="Offers" items={brandJson.offers as string[]} />
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Ads</h2>
        {ads.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-foreground">
              No ads yet for this brand.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {ads.map((a) => (
              <Link
                key={a.id}
                href={`/ads/${a.id}`}
                className="block rounded-md border border-border hover:border-primary/60 transition-colors p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="line-clamp-1 font-medium">{a.prompt}</div>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5">
                    {a.status}
                  </span>
                </div>
                <div className="text-xs text-foreground mt-1">
                  {a.platforms}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground hover:text-foreground">
          Raw BrandSystem JSON
        </summary>
        <pre className="mt-2 rounded-md bg-muted/40 p-3 text-xs overflow-auto">
          {JSON.stringify(brandJson, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items?: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {items.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="text-foreground">•</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground">—</p>
        )}
      </CardContent>
    </Card>
  );
}

function safeListAds(brand_id: string) {
  try {
    return listAds({ brand_id });
  } catch {
    return [];
  }
}
