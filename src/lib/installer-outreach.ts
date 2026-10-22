// ═══════════════════════════════════════════════════════════════════════════
// Installer Outreach — merge tags + plain-text → email HTML
//
// Admin-written (or Gemini-drafted) outreach emails are plain text with
// {{merge_tags}} so one draft can go to many installers and still read
// personally. Pure functions only — shared by the Partner Portal preview
// and the server-side sender so what the admin previews is what gets sent.
// ═══════════════════════════════════════════════════════════════════════════

export interface OutreachRecipient {
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
}

export const OUTREACH_MERGE_TAGS = [
  { tag: "first_name", label: "First name" },
  { tag: "business_name", label: "Business" },
  { tag: "city", label: "City" },
] as const;

function tagValue(tag: string, r: OutreachRecipient): string | null {
  switch (tag) {
    case "first_name":
      return r.first_name?.trim() || null;
    case "last_name":
      return r.last_name?.trim() || null;
    case "full_name":
      return [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || null;
    case "business_name":
      return r.business_name?.trim() || null;
    case "city":
      return r.city?.trim() || null;
    case "state":
      return r.state?.trim() || null;
    default:
      return null;
  }
}

const FALLBACKS: Record<string, string> = {
  first_name: "there",
  last_name: "",
  full_name: "there",
  business_name: "your business",
  city: "your area",
  state: "your state",
};

/**
 * Replace {{tag}} / {{ tag }} / {{tag|fallback}} with the recipient's value.
 * Unknown tags are left untouched so a typo is visible in the preview
 * instead of silently vanishing.
 */
export function applyMergeTags(text: string, r: OutreachRecipient): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi, (match, rawTag: string, inlineFallback?: string) => {
    const tag = rawTag.toLowerCase();
    if (!(tag in FALLBACKS)) return match;
    return tagValue(tag, r) ?? (inlineFallback !== undefined ? inlineFallback.trim() : FALLBACKS[tag]);
  });
}

/** Tags in `text` that applyMergeTags won't recognise. */
export function unknownMergeTags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*(?:\|[^}]*)?\}\}/gi)) {
    if (!(m[1].toLowerCase() in FALLBACKS)) out.add(m[1]);
  }
  return [...out];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plain text → email-safe HTML paragraphs. Blank lines split paragraphs,
 * single newlines become <br>, and bare http(s) URLs become links.
 */
export function outreachTextToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => {
      const html = escapeHtml(p.trim())
        .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:#facc15;">${url}</a>`)
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px;color:#e5e5e5;font-size:15px;line-height:1.7;">${html}</p>`;
    })
    .join("\n");
}
