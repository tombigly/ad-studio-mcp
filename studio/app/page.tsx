import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Video, Users, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { countBy, sumCostCents, listAds, listBrands } from "@/lib/queries";
import { isConfigured } from "@/lib/mcp";
import { VideoThumb } from "@/components/video-thumb";
import { mediaUrl } from "@/lib/media";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  generating: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  publishing: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  published: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/20 text-destructive",
};

export default function DashboardPage() {
  if (!isConfigured()) redirect("/setup");

  let stats = { brands: 0, ads: 0, published7d: 0, spendCents: 0 };
  let recent: ReturnType<typeof listAds> = [];
  let brandsMap: Record<string, string> = {};
  try {
    stats = {
      brands: countBy("brands"),
      ads: countBy("ads"),
      published7d: countBy("ads", "status", "published"),
      spendCents: sumCostCents(),
    };
    recent = listAds().slice(0, 6);
    brandsMap = Object.fromEntries(listBrands().map((b) => [b.id, b.name]));
  } catch {}

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Generate, review, and publish AI video ads.
          </p>
        </div>
        <Link href="/studio" className={buttonVariants({ size: "lg" }) + " gap-2"}>
          <Sparkles className="size-4" />
          Create ad
        </Link>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video} label="Total ads" value={stats.ads.toString()} />
        <StatCard icon={Clock} label="Published" value={stats.published7d.toString()} />
        <StatCard icon={Users} label="Brands" value={stats.brands.toString()} />
        <StatCard
          icon={DollarSign}
          label="Spend"
          value={`$${(stats.spendCents / 100).toFixed(2)}`}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Recent ads</h2>
          {recent.length > 0 && (
            <Link href="/ads" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <Sparkles className="size-6" />
              <div className="max-w-sm">
                No ads yet. Create your first one in Studio — prompt, pick platforms,
                and we handle the rest.
              </div>
              <Link
                href="/studio"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-2"}
              >
                Open Studio
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {recent.map((ad) => {
              const videoUrl = mediaUrl({
                localPath: ad.video_url,
                r2Url: ad.r2_video_url,
              });
              const imageUrl = mediaUrl({
                localPath: ad.image_url,
                r2Url: ad.r2_image_url,
              });
              return (
                <Link key={ad.id} href={`/ads/${ad.id}`} className="group">
                  <Card className="overflow-hidden group-hover:border-primary/60 transition-colors">
                    <VideoThumb url={videoUrl} imageUrl={imageUrl} />
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[9px] rounded-full px-1.5 py-0.5 font-medium uppercase tracking-wide",
                            STATUS_TONE[ad.status] ?? STATUS_TONE.draft
                          )}
                        >
                          {ad.status}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatDistanceToNow(new Date(ad.created_at))}
                        </span>
                      </div>
                      <div className="text-xs line-clamp-2">{ad.prompt}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {brandsMap[ad.brand_id] ?? ""}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
