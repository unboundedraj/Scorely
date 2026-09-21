import type { ReactNode } from "react";
import type { MatchStatus } from "@/lib/sports/types";
import { cn, initials } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full bg-live animate-live-pulse", className)} aria-hidden />;
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "live" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary-soft text-primary-soft-foreground",
    live: "bg-live/12 text-live",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, hasStarted = true }: { status: MatchStatus; hasStarted?: boolean }) {
  if (status === "live" && hasStarted)
    return (
      <Badge tone="live">
        <LiveDot className="size-1.5" /> Live
      </Badge>
    );
  if (status === "live") return <Badge tone="primary">Ready</Badge>;
  if (status === "completed") return <Badge>Final</Badge>;
  if (status === "scheduled") return <Badge tone="warning">Upcoming</Badge>;
  return <Badge tone="danger">Abandoned</Badge>;
}

export function TeamMark({
  name,
  short,
  color,
  size = "md",
  className,
}: {
  name: string;
  short?: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[8px]",
    sm: "size-7 text-[10px]",
    md: "size-9 text-xs",
    lg: "size-12 text-sm",
    xl: "size-16 text-lg",
  } as const;
  const label = (short || initials(name)).slice(0, 3);
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function SportTile({
  emoji,
  accent,
  size = "md",
  className,
}: {
  emoji: string;
  accent: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-9 text-lg rounded-xl", md: "size-11 text-2xl rounded-2xl", lg: "size-14 text-3xl rounded-2xl" } as const;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center", sizes[size], className)}
      style={{ background: `linear-gradient(145deg, ${accent}33, ${accent}14)`, boxShadow: `inset 0 0 0 1px ${accent}33` }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-4xl">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
