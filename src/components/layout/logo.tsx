import { cn } from "@/lib/utils";

export const APP_NAME = "Scorely";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="scorely-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#scorely-g)" />
      <rect x="7" y="9" width="7.5" height="14" rx="2.2" fill="#fff" fillOpacity=".95" />
      <rect x="17.5" y="9" width="7.5" height="14" rx="2.2" fill="#fff" fillOpacity=".95" />
      <rect x="9.6" y="12.2" width="2.3" height="7.6" rx="1.15" fill="#047857" />
      <path d="M20.2 13.2h2.2v6.6" stroke="#047857" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
