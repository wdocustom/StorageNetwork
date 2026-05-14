// ═══════════════════════════════════════════════════════════════════════════
// Phone-number normalisation
//
// Used by the realtor gift-creation flows when capturing an optional
// recipient phone, and by anything that needs to render a tel: / sms: link.
// Single canonical place so the realtor input and the installer link
// agree on what counts as "valid".
//
// Format philosophy: store as digits-with-an-optional-leading-+ and let
// the display layer add formatting. Drops any non-numeric character
// except the leading +. Rejects too-short / too-long inputs.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise a free-form phone string into the format we store. Returns null
 * for missing or unusable input — the field is optional everywhere.
 *
 * Accepts:
 *   "(555) 123-4567"     → "+15551234567"   (10-digit US)
 *   "555-123-4567"       → "+15551234567"
 *   "+1 555 123 4567"    → "+15551234567"
 *   "+44 20 7946 0958"   → "+442079460958"  (international)
 *   ""                   → null
 *   "abc"                → null
 *   "123"                → null
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) return null;

  if (hasPlus) return `+${digits}`;
  // Assume US for bare 10-digit input. 11-digit starting with 1 is also US.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Other lengths without an explicit + — store as-is but with leading +
  // so display formatters always have one stable shape to parse.
  return `+${digits}`;
}

/**
 * Format a stored phone (the output of normalizePhone) for human display.
 * E.164-ish → "(555) 123-4567" for US, otherwise the original +digits form.
 */
export function formatPhoneForDisplay(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  // US (+1XXXXXXXXXX)
  const usMatch = trimmed.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (usMatch) {
    return `(${usMatch[1]}) ${usMatch[2]}-${usMatch[3]}`;
  }

  return trimmed;
}
