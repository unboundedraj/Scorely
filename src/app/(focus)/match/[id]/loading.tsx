export default function LoadingMatch() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading match">
      <div className="h-14 border-b border-border sm:h-16" />
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pt-6 sm:px-6">
        <div className="h-44 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
