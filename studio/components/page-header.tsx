import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  accent,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 px-8 py-8",
        accent
          ? "bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-background"
          : "bg-gradient-to-br from-muted/60 via-muted/20 to-background",
        className
      )}
    >
      {accent && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 blur-3xl"
        />
      )}
      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}
