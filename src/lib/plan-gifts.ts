// ═══════════════════════════════════════════════════════════════════════════
// Gift DIY plans: shared rules for /plans/gift (client + server)
//
// A gifter buys All-Access (TOTE_PLAN_ALL_ACCESS, $19 each) for 1–10
// people. Each recipient gets their own lifetime All-Access: their own
// purchase row, their own link, and a separate email, so one bounced or
// spam-filtered address never affects the others.
//
// The same parser runs in the browser (instant feedback) and on the server
// (the only one that counts). Prices always come from here, never from
// the client.
// ═══════════════════════════════════════════════════════════════════════════

import { TOTE_PLAN_ALL_ACCESS, formatPlanPrice } from "@/lib/tote-plans";

export const GIFT_MAX_RECIPIENTS = 10;
export const GIFT_MESSAGE_MAX = 300;
export const GIFT_NAME_MAX = 60;
/** One gift's regular price: a full All-Access, same as buying it for yourself. */
export const GIFT_UNIT_PRICE = TOTE_PLAN_ALL_ACCESS.price;

// ── Volume pricing ──────────────────────────────────────────────────────────
// More gifts, lower price each. Totals for 3–7 are bundle prices; from
// GIFT_FLAT_FROM up it's a flat price per gift. 1–2 gifts pay the regular
// price. The total only ever goes up with each gift added, and the price per
// gift only ever goes down. Nothing else stacks on these (gift checkout takes
// no promo codes or offers). Server-side, these are the only prices charged.
export const GIFT_BUNDLE_TOTALS: Readonly<Record<number, number>> = {
  3: 4500,
  4: 5800,
  5: 6900,
  6: 7800,
  7: 8500,
};
export const GIFT_FLAT_FROM = 8;
export const GIFT_FLAT_EACH = 1100;
/** The bundles to advertise (4 and 6 still get their price, just not a badge). */
export const GIFT_FEATURED_BUNDLES = [3, 5, 7] as const;
/** Gifter-triggered resends per recipient, and the wait between them. */
export const GIFT_MAX_RESENDS = 3;
export const GIFT_RESEND_COOLDOWN_MS = 60 * 1000;
/** A mistyped address can be fixed this many times, and only before the gift is opened. */
export const GIFT_MAX_EMAIL_CORRECTIONS = 2;
export const GIFT_SENDER_ADDRESS = "orders@storage-network.app";

/** What N gifts cost, in cents, with volume pricing. */
export function giftTotalCents(quantity: number): number {
  const q = Math.max(0, Math.floor(quantity));
  if (q >= GIFT_FLAT_FROM) return GIFT_FLAT_EACH * q;
  return GIFT_BUNDLE_TOTALS[q] ?? GIFT_UNIT_PRICE * q;
}

/** What N gifts would cost at the regular price (the struck-through price). */
export function giftListCents(quantity: number): number {
  return GIFT_UNIT_PRICE * Math.max(0, Math.floor(quantity));
}

export function giftSavingsCents(quantity: number): number {
  return giftListCents(quantity) - giftTotalCents(quantity);
}

/** Effective price per gift, in cents (rounded to the cent). */
export function giftEachCents(quantity: number): number {
  return quantity > 0 ? Math.round(giftTotalCents(quantity) / quantity) : 0;
}

/** "$15", "$13.80": per-gift price for display. */
export function giftEachLabel(quantity: number): string {
  return formatPlanPrice(giftEachCents(quantity));
}

/** "Bundle of 3", "8+ at $11 each", or null at the regular price. */
export function giftDealName(quantity: number): string | null {
  if (quantity >= GIFT_FLAT_FROM) return `${GIFT_FLAT_FROM}+ gifts · ${formatPlanPrice(GIFT_FLAT_EACH)} each`;
  if (GIFT_BUNDLE_TOTALS[quantity] != null) return `Bundle of ${quantity}`;
  return null;
}

/**
 * The next price break worth mentioning ("Add 1 more: 3 for $45"), or null
 * when they're already at the flat rate or the order limit.
 */
export function nextGiftDeal(quantity: number): { quantity: number; total: number; add: number; eachCents: number } | null {
  for (let q = Math.max(1, quantity + 1); q <= GIFT_MAX_RECIPIENTS; q++) {
    const featured = (GIFT_FEATURED_BUNDLES as readonly number[]).includes(q) || q === GIFT_FLAT_FROM;
    if (featured && giftEachCents(q) < giftEachCents(Math.max(1, quantity))) {
      return { quantity: q, total: giftTotalCents(q), add: q - quantity, eachCents: giftEachCents(q) };
    }
  }
  return null;
}

export const giftPriceLabel = (cents: number) => formatPlanPrice(cents);

export interface GiftRecipientInput {
  name: string;
  email: string;
}

export interface GiftOrderInput {
  gifterName: string;
  gifterEmail: string;
  message: string;
  recipients: GiftRecipientInput[];
  /** The gifter ticked "all sales are final / I'll let them know". */
  acknowledged: boolean;
}

export interface ParsedGiftOrder {
  gifterName: string;
  gifterEmail: string;
  message: string | null;
  recipients: GiftRecipientInput[];
}

/** Field-level problems, keyed for the form: "gifterName", "recipients.2.email", … */
export type GiftFieldErrors = Record<string, string>;

export type GiftParseResult =
  | { ok: true; order: ParsedGiftOrder }
  | { ok: false; error: string; fields: GiftFieldErrors };

// Practical, not RFC-complete: one @, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * A person's name, safe to put in an email subject, a From display name and
 * HTML (still escaped on output): no control characters, angle brackets,
 * quotes or @ (which would make "Jo <x@y>" look like an address).
 */
export function cleanPersonName(raw: unknown, max = GIFT_NAME_MAX): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[<>"@\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** Free-text note: printable characters and line breaks, at most GIFT_MESSAGE_MAX. */
export function cleanGiftMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, GIFT_MESSAGE_MAX)
    .trim();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

// Most-mistyped domains → the one they meant. Shown as "Did you mean …?"
// before paying; never changed silently.
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "aol.co": "aol.com",
  "aol.con": "aol.com",
  "comcast.met": "comcast.net",
};

/** "jo@gmial.com" → "jo@gmail.com"; null when nothing looks off. */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  const fixed = DOMAIN_FIXES[domain];
  return fixed ? `${email.slice(0, at)}@${fixed}` : null;
}

export function parseGiftOrder(raw: unknown): GiftParseResult {
  const fields: GiftFieldErrors = {};
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof GiftOrderInput, unknown>>;

  const gifterName = cleanPersonName(input.gifterName);
  if (!gifterName) fields.gifterName = "Add your name so they know who it's from.";

  const gifterEmail = normalizeEmail(input.gifterEmail);
  if (!isValidEmail(gifterEmail)) fields.gifterEmail = "Enter a valid email for your receipt.";

  const rawMessage = typeof input.message === "string" ? input.message : "";
  const message = cleanGiftMessage(rawMessage);
  if (rawMessage.trim().length > GIFT_MESSAGE_MAX) {
    fields.message = `Keep the note under ${GIFT_MESSAGE_MAX} characters.`;
  }

  const list = Array.isArray(input.recipients) ? input.recipients : [];
  if (list.length === 0) {
    fields.recipients = "Add at least one person.";
  } else if (list.length > GIFT_MAX_RECIPIENTS) {
    fields.recipients = `Up to ${GIFT_MAX_RECIPIENTS} people per order.`;
  }

  const recipients: GiftRecipientInput[] = [];
  const seen = new Map<string, number>();
  list.slice(0, GIFT_MAX_RECIPIENTS).forEach((r, i) => {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const name = cleanPersonName(row.name);
    const email = normalizeEmail(row.email);
    if (!name) fields[`recipients.${i}.name`] = "Add their name.";
    if (!email) fields[`recipients.${i}.email`] = "Add their email.";
    else if (!isValidEmail(email)) fields[`recipients.${i}.email`] = "That email doesn't look right.";
    else if (seen.has(email)) {
      fields[`recipients.${i}.email`] = `Same email as person ${seen.get(email)! + 1}. Each gift needs its own address.`;
    } else seen.set(email, i);
    recipients.push({ name, email });
  });

  if (input.acknowledged !== true) {
    fields.acknowledged = "Please confirm you've read this before paying.";
  }

  const count = Object.keys(fields).length;
  if (count) {
    return {
      ok: false,
      error: count === 1 ? Object.values(fields)[0] : "A few details need fixing before checkout.",
      fields,
    };
  }
  return { ok: true, order: { gifterName, gifterEmail, message: message || null, recipients } };
}

/** "Jo", "Jo and Sam", "Jo, Sam and 3 others" */
export function recipientListLabel(names: string[], max = 3): string {
  const firsts = names.map((n) => firstNameOf(n) || n);
  if (firsts.length <= 1) return firsts[0] ?? "";
  if (firsts.length <= max) return `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
  const rest = firsts.length - (max - 1);
  return `${firsts.slice(0, max - 1).join(", ")} and ${rest} others`;
}

/** Status of one recipient, as the gifter sees it on the "gifts sent" page. */
export type GiftDeliveryStatus = "preparing" | "sending" | "sent" | "failed";

export interface GiftRecipientView {
  id: string;
  position: number;
  name: string;
  email: string;
  status: GiftDeliveryStatus;
  sentAt: string | null;
  openedAt: string | null;
  /** The recipient's gift page — absolute, for texting it to them. Null until fulfilled. */
  giftUrl: string | null;
  error: string | null;
  canResend: boolean;
  /** Seconds until another resend is allowed (0 = now). */
  resendInSeconds: number;
  resendsLeft: number;
  canCorrectEmail: boolean;
}

export interface GiftOrderView {
  orderRef: string;
  paid: boolean;
  gifterName: string;
  gifterEmail: string;
  message: string | null;
  quantity: number;
  amountCents: number;
  paidAt: string | null;
  manageUrl: string;
  receiptSent: boolean;
  recipients: GiftRecipientView[];
}

/** Short order reference, e.g. "GIFT-3F9A2C1B". */
export function giftOrderRef(orderId: string): string {
  return `GIFT-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const giftOpenPath = (token: string) => `/plans/gift/open?token=${token}`;
export const giftManagePath = (manageToken: string) => `/plans/gift/sent?order=${manageToken}`;
