import { createHash } from "node:crypto";

export function normalizeText(value: string): string {
  return value.trim().normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").toLowerCase();
}

export function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeHost(url: string): string | null {
  try {
    const host = new URL(url).host.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.hostname.startsWith("www.")) parsed.hostname = parsed.hostname.slice(4);
  parsed.searchParams.sort();
  return parsed.toString();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

