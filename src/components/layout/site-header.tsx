import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Logo } from "./logo";
import { DesktopNav } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader({ user }: { user: CurrentUser | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Scorely home">
          <Logo />
        </Link>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <ButtonLink href="/new" size="md" className="hidden md:inline-flex">
            New match
          </ButtonLink>
          {user ? (
            <UserMenu name={user.displayName} email={user.email} />
          ) : isSupabaseConfigured ? (
            <ButtonLink href="/login" variant="outline" size="md">
              Sign in
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 hidden border-t border-border md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
        <p>Scorely — live scoring for every game.</p>
        <nav className="flex gap-5">
          <Link href="/live" className="hover:text-foreground">
            Live
          </Link>
          <Link href="/new" className="hover:text-foreground">
            Start a match
          </Link>
          <Link href="/matches" className="hover:text-foreground">
            My matches
          </Link>
        </nav>
      </div>
    </footer>
  );
}
