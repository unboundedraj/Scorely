import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const linkError = sp.error === "link";
  return (
    <AuthCard
      title="Welcome back"
      subtitle={linkError ? "That link has expired or was already used — please sign in again." : "Sign in to score, sync and share matches."}
      footer={
        <>
          New to Scorely?{" "}
          <Link href={`/signup${next !== "/matches" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
