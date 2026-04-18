"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Video,
  Users,
  CalendarDays,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getTierStatusAction } from "@/lib/actions/tier";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/ads", label: "Ads", icon: Video },
  { href: "/brands", label: "Brands", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tierMode, setTierModeLocal] = useState<"paid" | "free">("paid");
  useEffect(() => {
    setMounted(true);
    getTierStatusAction()
      .then((r) => setTierModeLocal(r.mode))
      .catch(() => {});
  }, [pathname]);

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500" />
        <div className="text-base font-semibold tracking-tight">Ad Studio</div>
        {mounted && tierMode === "free" && (
          <span className="ml-auto text-base rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 font-semibold uppercase tracking-wider">
            Free
          </span>
        )}
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xl transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {mounted ? (theme === "dark" ? "Light mode" : "Dark mode") : "Theme"}
        </Button>
      </div>
    </aside>
  );
}
