/**
 * Generate the correct booking link for an installer.
 * Pro users get a vanity slug link; Basic users get the UUID link.
 * Both formats are supported by the design page resolver.
 */
export function getInstallerLink(user: {
  id: string;
  slug?: string | null;
}): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://storage-network.app");

  const param = user.slug
    ? `installer=${encodeURIComponent(user.slug)}`
    : `installer_id=${user.id}`;

  return `${baseUrl}/design?${param}`;
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
