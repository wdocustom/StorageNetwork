/**
 * Generate the correct booking link for an installer.
 * Pro users get a vanity slug link; Basic users get the UUID link.
 * Both formats are supported by the design page resolver.
 */
export function getInstallerLink(user: {
  id: string;
  slug?: string | null;
  is_pro?: boolean;
}): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://storage-network.app");

  // STRICT: Only Pro users with a slug get the vanity link.
  // user.is_pro must be exactly true — no truthy coercion from stale DB values.
  const param =
    user.is_pro === true && user.slug
      ? `installer=${encodeURIComponent(user.slug)}`
      : `installer_id=${user.id}`;

  return `${baseUrl}/design?${param}`;
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
