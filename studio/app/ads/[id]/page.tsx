import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAd, getBrand, listPosts } from "@/lib/queries";
import { mediaUrl } from "@/lib/media";
import { Card, CardContent } from "@/components/ui/card";
import { AdDetailClient } from "@/components/ad-detail-client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  generating: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  draft: "bg-muted text-foreground",
  approved: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  publishing: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  published: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/20 text-destructive",
};

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let ad, brand, posts;
  try {
    ad = getAd(id);
    if (!ad) notFound();
    brand = getBrand(ad.brand_id);
    posts = listPosts(id);
  } catch {
    notFound();
  }
  if (!ad) notFound();

  const videoUrl = mediaUrl({ localPath: ad.video_url, r2Url: ad.r2_video_url });
  const imageUrl = mediaUrl({ localPath: ad.image_url, r2Url: ad.r2_image_url });

  let captions: Record<string, unknown> = {};
  try {
    if (ad.captions_json) captions = JSON.parse(ad.captions_json);
  } catch {}

  const platforms = ad.platforms.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <Link
        href="/ads"
        className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to ads
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-base rounded-full px-2 py-0.5 font-medium uppercase tracking-wide",
                STATUS_TONE[ad.status] ?? STATUS_TONE.draft
              )}
            >
              {ad.status}
            </span>
            <span className="text-xs text-foreground">
              {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}
            </span>
            <span className="text-xs text-foreground">·</span>
            <span className="text-xs text-foreground">
              ${(ad.cost_cents / 100).toFixed(2)}
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight line-clamp-2">{ad.prompt}</h1>
          {brand && (
            <Link
              href={`/brands/${brand.id}`}
              className="text-sm text-foreground hover:text-primary inline-flex items-center gap-1"
            >
              Brand: {brand.name}
            </Link>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">
        <Card className="overflow-hidden">
          <div className="aspect-[9/16] bg-black grid place-items-center">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Hero frame" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-foreground">Not rendered yet</div>
            )}
          </div>
          {imageUrl && (
            <CardContent className="p-3 border-t">
              <div className="text-xs text-foreground mb-2">Hero frame</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Hero" className="w-full rounded-md" />
            </CardContent>
          )}
        </Card>

        <AdDetailClient
          adId={ad.id}
          status={ad.status}
          platforms={platforms}
          captions={captions}
          posts={posts.map((p) => ({
            id: p.id,
            platform: p.platform,
            status: p.status,
            published_at: p.published_at,
          }))}
        />
      </div>
    </div>
  );
}
