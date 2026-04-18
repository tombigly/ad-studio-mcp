"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Platform = "x" | "instagram" | "tiktok" | "facebook" | "youtube";

const PLATFORM_TONE: Record<string, string> = {
  x: "bg-zinc-900 dark:bg-zinc-300",
  instagram: "bg-gradient-to-br from-pink-500 to-orange-400",
  tiktok: "bg-gradient-to-br from-cyan-400 to-pink-500",
  facebook: "bg-blue-600",
  youtube: "bg-red-600",
};

interface Scheduled {
  post_id: string;
  ad_id: string;
  platform: string;
  scheduled_at: number;
  prompt: string;
  status: string;
}

export function CalendarView({ scheduled }: { scheduled: Scheduled[] }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = useMemo(() => {
    const m = new Map<string, Scheduled[]>();
    for (const s of scheduled) {
      const d = new Date(s.scheduled_at);
      const key = format(d, "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return m;
  }, [scheduled]);

  const dayItems = (d: Date) => byDay.get(format(d, "yyyy-MM-dd")) ?? [];

  const selectedItems = selected ? dayItems(selected) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
              <div
                key={w}
                className="px-3 py-2 text-xs font-medium text-foreground border-r last:border-r-0"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const items = dayItems(d);
              const inMonth = isSameMonth(d, cursor);
              const isSel = selected && isSameDay(selected, d);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "min-h-[90px] border-r border-b last:border-r-0 p-2 text-left transition-colors",
                    !inMonth && "bg-muted/20 text-foreground",
                    isSel && "bg-primary/10",
                    isToday(d) && "ring-1 ring-inset ring-primary/40"
                  )}
                >
                  <div className="text-xs font-medium mb-1">{format(d, "d")}</div>
                  <div className="flex flex-wrap gap-1">
                    {items.slice(0, 4).map((it) => (
                      <span
                        key={it.post_id}
                        title={`${it.platform} · ${it.prompt}`}
                        className={cn(
                          "size-2 rounded-full",
                          PLATFORM_TONE[it.platform] ?? "bg-muted"
                        )}
                      />
                    ))}
                    {items.length > 4 && (
                      <span className="text-base text-foreground">+{items.length - 4}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-medium">{format(selected, "EEEE, MMMM d")}</div>
            {selectedItems.length === 0 ? (
              <div className="text-sm text-foreground">Nothing scheduled.</div>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((it) => (
                  <Link
                    key={it.post_id}
                    href={`/ads/${it.ad_id}`}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:border-primary/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2.5 rounded-sm shrink-0",
                          PLATFORM_TONE[it.platform] ?? "bg-muted"
                        )}
                      />
                      <span className="capitalize w-20 text-foreground">
                        {it.platform}
                      </span>
                      <span className="truncate">{it.prompt}</span>
                    </div>
                    <span className="text-xs text-foreground whitespace-nowrap ml-2">
                      {format(new Date(it.scheduled_at), "h:mm a")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// keep the Platform type referenced to avoid unused warnings; consumers may import later
void (0 as unknown as Platform);
