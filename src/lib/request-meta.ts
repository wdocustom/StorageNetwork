// ═══════════════════════════════════════════════════════════════════════════
// Client IP + geo from request headers, on Vercel or Cloudflare.
//
// Safe for middleware (edge), route handlers and server actions.
//
// IP: on Cloudflare, CF-Connecting-IP is set by Cloudflare and can't be
// forged, while X-Forwarded-For keeps whatever the client sent and only
// appends the real address — so its first entry is spoofable there and must
// not key rate limits. On Vercel, x-real-ip / x-forwarded-for are set by the
// platform and a client-sent cf-connecting-ip would be untrusted, so the
// order flips on process.env.VERCEL.
//
// Geo: Vercel sends x-vercel-ip-*; Cloudflare sends cf-ipcountry always and
// cf-ipcity / cf-region-code when the "Add visitor location headers"
// managed transform is enabled on the zone.
// ═══════════════════════════════════════════════════════════════════════════

interface HeaderReader {
  get(name: string): string | null;
}

export function getClientIp(h: HeaderReader): string | null {
  const cf = h.get("cf-connecting-ip")?.trim();
  const real = h.get("x-real-ip")?.trim();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (process.env.VERCEL) return real || fwd || null;
  return cf || real || fwd || null;
}

export interface RequestGeo {
  city: string | null;
  region: string | null;
  country: string | null;
}

function decode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function getRequestGeo(h: HeaderReader): RequestGeo {
  const cfCountry = h.get("cf-ipcountry");
  return {
    city: decode(h.get("x-vercel-ip-city")) || h.get("cf-ipcity") || null,
    region: h.get("x-vercel-ip-country-region") || h.get("cf-region-code") || null,
    // Cloudflare uses XX (unknown) and T1 (Tor) as placeholder codes
    country:
      h.get("x-vercel-ip-country") ||
      (cfCountry && cfCountry !== "XX" && cfCountry !== "T1" ? cfCountry : null),
  };
}
