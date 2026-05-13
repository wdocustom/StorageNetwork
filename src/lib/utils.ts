/**
 * Canonical site origin (no trailing slash). Use this anywhere we generate a
 * link that will be received on a different device than the one running the
 * browser — most importantly outbound emails (password reset, magic links,
 * gift notifications). `window.location.origin` is a footgun in those cases:
 * on a developer's laptop it resolves to http://localhost:3000, which the
 * recipient's phone can't reach.
 *
 * Prefers NEXT_PUBLIC_APP_URL (set per-environment in Vercel + .env), then
 * falls back to the current browser origin for client-only URL building, then
 * to the production domain as a last resort for SSR/edge contexts.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://storage-network.app";
}

/**
 * Generate the correct booking link for an installer.
 * Installers with a slug get their portfolio page; others go direct to design.
 * Both formats are supported by the design page resolver.
 */
export function getInstallerLink(user: {
  id: string;
  slug?: string | null;
  is_pro?: boolean;
}): string {
  const baseUrl = getAppUrl();

  // Installers with a slug get their portfolio page
  if (user.slug) {
    return `${baseUrl}/p/${encodeURIComponent(user.slug)}`;
  }

  return `${baseUrl}/design?installer_id=${user.id}`;
}

/**
 * Convert a decimal inch measurement to a woodworking fraction string.
 * Rounds to nearest 1/8".
 *
 *   86.5   → "86-1/2"
 *   19.75  → "19-3/4"
 *   96     → "96"
 *   30.125 → "30-1/8"
 */
export function toFraction(value: number): string {
  const whole = Math.floor(value);
  const remainder = value - whole;
  const eighths = Math.round(remainder * 8);
  if (eighths === 0) return String(whole);
  if (eighths === 8) return String(whole + 1);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(eighths, 8);
  const num = eighths / d;
  const den = 8 / d;
  if (whole === 0) return `${num}/${den}`;
  return `${whole}-${num}/${den}`;
}

/**
 * Convert a business name into a URL-safe slug.
 * "Joe's Garage & Storage" → "joes-garage-storage"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[''"]/g, "")        // remove apostrophes/quotes
    .replace(/&/g, "and")         // & → and
    .replace(/[^a-z0-9]+/g, "-")  // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "")      // trim leading/trailing hyphens
    .slice(0, 60);                 // max length
}
