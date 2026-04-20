// ═══════════════════════════════════════════════════════════════════════════
// HTML Escape — Prevents XSS in server-generated email HTML
//
// All user-supplied strings (names, addresses, etc.) MUST be escaped before
// interpolation into HTML templates. This prevents injection attacks where
// a malicious customer name like `<script>alert(1)</script>` could execute
// arbitrary JS in email clients that support it.
// ═══════════════════════════════════════════════════════════════════════════

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(str: string): string {
  return str.replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] || ch);
}
