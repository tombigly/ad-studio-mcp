import { listBrands } from "@/lib/queries";
import { StudioForm } from "@/components/studio-form";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ brand_id?: string }>;
}) {
  const { brand_id } = await searchParams;
  let brands: Array<{ id: string; name: string }> = [];
  try {
    brands = listBrands().map((b) => ({ id: b.id, name: b.name }));
  } catch {}

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Studio</h1>
        <p className="text-muted-foreground mt-1">
          Prompt → hero frame → video → captions. Takes about 60–120 seconds.
        </p>
      </header>
      <StudioForm brands={brands} defaultBrandId={brand_id} />
    </div>
  );
}
