import { db } from "@/lib/mcp";
import { CalendarView } from "@/components/calendar-view";

export const dynamic = "force-dynamic";

interface ScheduledPost {
  post_id: string;
  ad_id: string;
  platform: string;
  scheduled_at: number;
  prompt: string;
  status: string;
}

export default function CalendarPage() {
  let scheduled: ScheduledPost[] = [];
  try {
    scheduled = db
      .prepare(
        `SELECT posts.id AS post_id, posts.ad_id, posts.platform, posts.scheduled_at,
                posts.status, ads.prompt
           FROM posts
           JOIN ads ON ads.id = posts.ad_id
          WHERE posts.scheduled_at IS NOT NULL
          ORDER BY posts.scheduled_at ASC`
      )
      .all() as ScheduledPost[];
  } catch {}

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">Scheduled posts across every platform.</p>
      </header>
      <CalendarView scheduled={scheduled} />
    </div>
  );
}
