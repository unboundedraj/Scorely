"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

/** Small dropdown menu anchored to a trigger button. */
export function Menu({
  trigger,
  items,
  align = "end",
  label,
  triggerClassName,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);
  const itemClass = (item: MenuItem) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
      item.danger ? "text-danger hover:bg-danger-soft" : "hover:bg-surface-2",
      item.disabled && "pointer-events-none opacity-40",
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-full z-40 mt-2 w-56 animate-fade-in rounded-xl border border-border bg-surface p-1.5 shadow-float",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {visible.map((item, i) =>
            item.href ? (
              <Link key={i} role="menuitem" href={item.href} className={itemClass(item)} onClick={() => setOpen(false)}>
                {item.icon}
                {item.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={itemClass(item)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
