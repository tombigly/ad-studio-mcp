import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sparkles,
  Video,
  Users,
  Clock,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  countBy,
  sumCostCents,
  listAds,
  listBrands,
} from "@/lib/queries";
import { isConfigured } from "@/lib/mcp";
import { VideoThumb } from "@/components/video-thumb";
import { mediaUrl } from "@/lib/media";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHeader, SectionHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  generating: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  draft: "bg-muted text-foreground border-border",
  approved: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  publishing: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-destructive/20 text-destructive border-destructive/30",
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
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Create a brand, draft a creative, and publish across every platform — from the same workspace."
        accent
        actions={
          <Link href="/studio" className={buttonVariants({ size: "lg" }) + " gap-2"}>
            <Sparkles className="size-4" />
            Create ad
          </Link>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Video}
          label="Total ads"
          value={stats.ads.toString()}
          hint="Drafts, approved, and published combined."
          tone="from-violet-500/30 to-fuchsia-500/20"
        />
        <StatCard
          icon={Clock}
          label="Published"
          value={stats.published7d.toString()}
          hint="Successful posts across all platforms."
          tone="from-emerald-500/30 to-teal-500/20"
        />
        <StatCard
          icon={Users}
          label="Brands"
          value={stats.brands.toString()}
          hint="Each brand is a voice + audience profile."
          tone="from-sky-500/30 to-indigo-500/20"
        />
        <StatCard
          icon={DollarSign}
          label="Spend"
          value={`$${(stats.spendCents / 100).toFixed(2)}`}
          hint="Total Gemini + Replicate cost to date."
          tone="from-amber-500/30 to-orange-500/20"
        />
      </section>

      <section>
        <SectionHeader
          title="Recent ads"
          subtitle="Latest creatives from every brand, newest first."
          right={
            recent.length > 0 ? (
              <Link
                href="/ads"
                className="inline-flex items-center gap-1 text-xs text-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            ) : null
          }
        />
        {recent.length === 0 ? (
          <EmptyDashboard />
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
                  <Card className="overflow-hidden border-border/70 group-hover:border-primary/60 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all">
                    <VideoThumb url={videoUrl} imageUrl={imageUrl} />
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-base rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider",
                            STATUS_TONE[ad.status] ?? STATUS_TONE.draft
                          )}
                        >
                          {ad.status}
                        </span>
                        <span className="text-xs text-foreground">
                          {formatDistanceToNow(new Date(ad.created_at))}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 leading-relaxed">{ad.prompt}</p>
                      <p className="text-xs text-foreground truncate">
                        {brandsMap[ad.brand_id] ?? ""}
                      </p>
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
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div
        aria-hidden
        className={cn(
          "absolute -top-8 -right-8 size-32 rounded-full bg-gradient-to-br blur-2xl opacity-70",
          tone
        )}
      />
      <CardContent className="relative p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="size-10 rounded-xl grid place-items-center bg-background/60 border border-border/60">
            <Icon className="size-5 text-foreground/80" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-foreground font-semibold">
            {label}
          </div>
          {/* h2 — stat value */}
          <div className="text-6xl font-semibold tracking-tight">{value}</div>
          <p className="text-sm text-foreground leading-relaxed">
            {hint}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyDashboard() {
  return (
    <Card className="border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
      <CardContent className="py-20 flex flex-col items-center gap-5 text-center">
        <div className="size-16 rounded-2xl grid place-items-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-border/60">
          <Sparkles className="size-7 text-violet-300" />
        </div>
        <div className="max-w-md space-y-2">
          {/* h3 */}
          <h3 className="text-xl font-medium tracking-tight">No ads yet</h3>
          <p className="text-base text-foreground leading-relaxed">
            Create your first one in Studio — describe what you want, pick the platforms, and we handle the rest.
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
  );
}
