import { listBrands } from "@/lib/queries";
import { StudioForm } from "@/components/studio-form";
import { PageHeader } from "@/components/page-header";
import { getTierStatusAction } from "@/lib/actions/tier";

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
  const tier = await getTierStatusAction();

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Studio"
        subtitle="Describe the ad once. We split the prompt, render per-platform assets, write captions, and hand you a ready-to-publish creative in 60–120 seconds."
        accent
      />
      <StudioForm brands={brands} defaultBrandId={brand_id} tierMode={tier.mode} />
    </div>
  );
}
