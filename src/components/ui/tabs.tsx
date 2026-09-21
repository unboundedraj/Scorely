"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-border", className)}>
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn(
                "relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
    </div>
  );
}
