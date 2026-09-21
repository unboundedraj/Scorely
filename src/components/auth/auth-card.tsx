import type { ReactNode } from "react";
import { LogoMark } from "@/components/layout/logo";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark className="size-12" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {isSupabaseConfigured ? (
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">{children}</div>
      ) : (
        <SetupNotice state="unconfigured" />
      )}
      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </div>
  );
}
