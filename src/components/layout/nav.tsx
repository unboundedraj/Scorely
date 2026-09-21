"use client";

import { Home, LayoutList, Plus, Radio, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/matches", label: "My matches", short: "Matches", icon: LayoutList },
  { href: "/teams", label: "Teams", icon: Users },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(pathname, l.href, l.exact) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, l.href, l.exact) ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** App-style bottom tab bar for phones. */
export function MobileTabBar() {
  const pathname = usePathname();
  const tabs = [LINKS[0], LINKS[1], null, LINKS[2], LINKS[3]];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-xl safe-bottom md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {tabs.map((l) =>
          l === null ? (
            <Link
              key="new"
              href="/new"
              aria-label="New match"
              className="mx-auto -mt-7 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-float ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </Link>
          ) : (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(pathname, l.href, l.exact) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                isActive(pathname, l.href, l.exact) ? "text-primary" : "text-muted",
              )}
            >
              <l.icon className="size-5" strokeWidth={isActive(pathname, l.href, l.exact) ? 2.4 : 2} />
              {l.short ?? l.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
