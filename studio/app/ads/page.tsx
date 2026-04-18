import Link from "next/link";
import { Video, Sparkles } from "lucide-react";
import { listAds, listBrands } from "@/lib/queries";
import { mediaUrl } from "@/lib/media";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { VideoThumb } from "@/components/video-thumb";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  generating: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  publishing: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  published: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/20 text-destructive",
};

export default function AdsPage() {
  let ads: ReturnType<typeof listAds> = [];
  let brandsMap: Record<string, string> = {};
  try {
    ads = listAds();
    brandsMap = Object.fromEntries(listBrands().map((b) => [b.id, b.name]));
  } catch {}

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ads</h1>
          <p className="text-muted-foreground mt-1">All generated ads.</p>
        </div>
        <Link href="/studio" className={buttonVariants({ size: "default" }) + " gap-2"}>
          <Sparkles className="size-4" />
          New ad
        </Link>
      </header>

      {ads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Video className="size-6" />
            <div className="max-w-sm">
              No ads yet. Generate your first in Studio.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => {
            const videoUrl = mediaUrl({ localPath: ad.video_url, r2Url: ad.r2_video_url });
            const imageUrl = mediaUrl({ localPath: ad.image_url, r2Url: ad.r2_image_url });
            return (
              <Link key={ad.id} href={`/ads/${ad.id}`}>
                <Card className="overflow-hidden hover:border-primary/60 transition-colors h-full">
                  <VideoThumb url={videoUrl} imageUrl={imageUrl} />

                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-[10px] rounded-full px-2 py-0.5 font-medium uppercase tracking-wide",
                          STATUS_TONE[ad.status] ?? STATUS_TONE.draft
                        )}
                      >
                        {ad.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm line-clamp-2">{ad.prompt}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{brandsMap[ad.brand_id] ?? "—"}</span>
                      <span>·</span>
                      <span>{ad.platforms}</span>
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
