"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">🏳️</p>
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">{error.digest ? `Error ${error.digest}. ` : ""}Please try again.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
