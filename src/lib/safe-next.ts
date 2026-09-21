/** Only allow same-origin relative redirects ("/matches"), never "//evil.com" or absolute URLs. */
export function safeNext(value: string | null | undefined, fallback = "/matches"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
