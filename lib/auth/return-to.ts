export function safeLocalReturnTo(value: unknown, fallback = "/dashboard"): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  try {
    const base = new URL("https://flytally.local");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
