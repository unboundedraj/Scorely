import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Link href="/" aria-label="Home">
        <LogoMark className="size-12" />
      </Link>
      <p className="mt-8 font-mono text-6xl font-extrabold text-muted">404</p>
      <h1 className="mt-3 text-xl font-bold">Out of bounds</h1>
      <p className="mt-2 text-sm text-muted">This page or match doesn&apos;t exist — or it&apos;s private.</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/live" variant="outline">
          Live matches
        </ButtonLink>
      </div>
    </div>
  );
}
