"use client";

import { Check } from "lucide-react";
import { TEAM_COLORS } from "@/lib/sports/registry";
import { cn } from "@/lib/utils";

export function ColorSwatches({ value, onChange, label = "Colour" }: { value: string; onChange: (color: string) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {TEAM_COLORS.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-transform active:scale-90",
              active && "ring-2 ring-foreground ring-offset-2 ring-offset-surface",
            )}
            style={{ backgroundColor: c }}
          >
            {active ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}
