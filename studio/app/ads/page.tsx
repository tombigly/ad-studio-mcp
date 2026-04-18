import Link from "next/link";
import { Video, Sparkles } from "lucide-react";
import { listAds, listBrands } from "@/lib/queries";
import { mediaUrl } from "@/lib/media";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { VideoThumb } from "@/components/video-thumb";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  generating: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  draft: "bg-muted text-foreground border-border",
  approved: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  publishing: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function AdsPage() {
  let ads: ReturnType<typeof listAds> = [];
  let brandsMap: Record<string, string> = {};
  try {
    ads = listAds();
    brandsMap = Object.fromEntries(listBrands().map((b) => [b.id, b.name]));
  } catch {}

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Ads"
        subtitle="Every generated creative. Approve, publish, or schedule from here."
        actions={
          <Link
            href="/studio"
            className={buttonVariants({ size: "default" }) + " gap-2"}
          >
            <Sparkles className="size-4" />
            New ad
          </Link>
        }
      />

      {ads.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
          <CardContent className="py-20 flex flex-col items-center gap-5 text-center">
            <div className="size-16 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-border/60">
              <Video className="size-7 text-violet-300" />
            </div>
            <div className="max-w-md space-y-2">
              {/* h3 */}
              <h3 className="text-xl font-medium tracking-tight">No ads yet</h3>
              <p className="text-base text-foreground leading-relaxed">
                Jump into Studio and write a one-liner. You&apos;ll have a ready-to-publish creative in a minute.
              </p>
            </div>
            <Link
              href="/studio"
              className={buttonVariants({ size: "lg" }) + " gap-2 mt-2"}
            >
              <Sparkles className="size-4" />
              Open Studio
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => {
            const videoUrl = mediaUrl({
              localPath: ad.video_url,
              r2Url: ad.r2_video_url,
            });
            const imageUrl = mediaUrl({
              localPath: ad.image_url,
              r2Url: ad.r2_image_url,
            });
            return (
              <Link key={ad.id} href={`/ads/${ad.id}`}>
                <Card className="overflow-hidden border-border/60 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 transition-all h-full">
                  <VideoThumb url={videoUrl} imageUrl={imageUrl} />
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs rounded-full border px-2.5 py-0.5 font-semibold uppercase tracking-wider",
                          STATUS_TONE[ad.status] ?? STATUS_TONE.draft
                        )}
                      >
                        {ad.status}
                      </span>
                      <span className="text-xs text-foreground">
                        {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {/* h4 — ad prompt/title */}
                    <h4 className="text-base line-clamp-2 leading-relaxed font-medium">
                      {ad.prompt}
                    </h4>
                    <div className="text-sm text-foreground flex items-center gap-2">
                      <span className="truncate">{brandsMap[ad.brand_id] ?? "—"}</span>
                      <span className="text-foreground/40">·</span>
                      <span className="truncate">{ad.platforms}</span>
                    </div>
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
