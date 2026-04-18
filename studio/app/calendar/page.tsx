import { db } from "@/lib/mcp";
import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

interface ScheduledPost {
  post_id: string;
  ad_id: string;
  platform: string;
  scheduled_at: number;
  prompt: string;
  status: string;
}

export default async function CalendarPage() {
  let scheduled: ScheduledPost[] = [];
  try {
    scheduled = (await db
      .prepare(
        `SELECT posts.id AS post_id, posts.ad_id, posts.platform, posts.scheduled_at,
                posts.status, ads.prompt
           FROM posts
           JOIN ads ON ads.id = posts.ad_id
          WHERE posts.scheduled_at IS NOT NULL
          ORDER BY posts.scheduled_at ASC`
      )
      .all()) as unknown as ScheduledPost[];
  } catch {}

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Calendar"
        subtitle="Every scheduled post across every platform. Click a day to see what&rsquo;s queued."
      />
      <CalendarView scheduled={scheduled} />
    </div>
  );
}
