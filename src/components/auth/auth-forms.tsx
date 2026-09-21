"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { getBrowserSupabase } from "@/lib/supabase/client";

function confirmUrl(next: string) {
  return `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Try signing in.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

function Done({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <MailCheck className="size-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magic, setMagic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    if (magic) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: confirmUrl(next), shouldCreateUser: false } });
      setLoading(false);
      if (error) toast.error(friendly(error.message));
      else setSent(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(friendly(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sent) {
    return (
      <Done title="Check your email">
        We sent a sign-in link to <strong className="text-foreground">{email}</strong>.
      </Done>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      {!magic ? (
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-semibold text-primary">
                Forgot?
              </Link>
            </span>
          }
          htmlFor="password"
        >
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      ) : null}
      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Spinner /> : null} {magic ? "Email me a sign-in link" : "Sign in"}
      </Button>
      <button type="button" onClick={() => setMagic((m) => !m)} className="w-full text-center text-sm font-medium text-muted hover:text-foreground">
        {magic ? "Use a password instead" : "Sign in with an email link instead"}
      </button>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmUrl(next), data: { scorely_name: name.trim().slice(0, 60) } },
    });
    setLoading(false);
    if (error) {
      toast.error(friendly(error.message));
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Done title="Confirm your email">
        We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Open it on this device to finish signing up.
      </Done>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name" htmlFor="name" hint="Shown to spectators as the scorer">
        <Input id="name" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Kumar" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Spinner /> : null} Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: confirmUrl("/reset-password") });
    setLoading(false);
    if (error) toast.error(friendly(error.message));
    else setSent(true);
  }

  if (sent) {
    return (
      <Done title="Check your email">
        If an account exists for <strong className="text-foreground">{email}</strong>, you&apos;ll get a link to reset your password.
      </Done>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Spinner /> : null} Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(friendly(error.message));
      return;
    }
    toast.success("Password updated");
    router.replace("/matches");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters">
        <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" block disabled={loading}>
        {loading ? <Spinner /> : null} Update password
      </Button>
    </form>
  );
}
