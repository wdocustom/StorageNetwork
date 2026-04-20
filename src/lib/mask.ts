// ═══════════════════════════════════════════════════════════════════════════
// Contact Masking Helpers
// Safe for client and server — no Node.js dependencies.
// ═══════════════════════════════════════════════════════════════════════════

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.com";
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-****";
  return `(***) ***-${digits.slice(-4)}`;
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "Customer";
  const first = parts[0];
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "";
  return `${first}${lastInitial}`;
}
