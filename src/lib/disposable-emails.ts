/**
 * Disposable / alias / privacy-cloaked email domain blocklist.
 *
 * These domains are commonly used by bots, test accounts, and
 * fake signups to mask identity. Legitimate business partners
 * should use a real business or personal email.
 *
 * Sources: community-maintained lists + manual additions from
 * observed fake signups on the platform.
 */

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // ── Privacy / cloaking aliases (observed on platform) ───────────
  "clkdmail.com",
  "cloakedmail.com",
  "burnermail.io",
  "emailmask.com",

  // ── Major disposable email providers ────────────────────────────
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempinbox.com",
  "tempmailo.com",
  "tempmailaddress.com",
  "throwaway.email",
  "throwaway.cc",
  "throwawaymail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "grr.la",
  "guerrilla.ml",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "maildrop.cc",
  "maildrop.gq",
  "mailnesia.com",
  "mailnull.com",
  "mailcatch.com",
  "mailsac.com",
  "dispostable.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "yopmail.gq",
  "sharklasers.com",
  "spamgourmet.com",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "trashmail.org",
  "trashymail.com",
  "trashymail.net",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.co.za",
  "20minutemail.com",
  "20minutemail.it",
  "minutemail.com",
  "fakeinbox.com",
  "fakemail.fr",
  "fakemail.net",
  "mailforspam.com",
  "spamfree24.org",
  "spamhereplease.com",
  "safetymail.info",
  "mytemp.email",
  "mytempmail.com",
  "emailondeck.com",
  "tempail.com",
  "tempr.email",
  "temptam.com",
  "tmpmail.net",
  "tmpmail.org",
  "bupmail.com",
  "mohmal.com",
  "mohmal.im",
  "harakirimail.com",
  "getairmail.com",
  "getnada.com",
  "nada.email",
  "nada.ltd",
  "inboxkitten.com",
  "mailhazard.com",
  "mailhazard.us",
  "mailtemp.info",
  "receiveee.com",
  "tempsky.com",
  "dropmail.me",
  "emkei.cz",
  "crazymailing.com",
  "mailpoof.com",
  "spambox.us",
  "jetable.org",
  "anonymbox.com",
  "filzmail.com",
  "incognitomail.com",
  "incognitomail.org",
  "mailexpire.com",
  "meltmail.com",
  "mintemail.com",
  "nomail.xl.cx",
  "sogetthis.com",
  "spamavert.com",
  "trashmail.at",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "mailzilla.com",
  "bugmenot.com",
  "deadaddress.com",
  "e4ward.com",
  "emailigo.de",
  "emailsensei.com",
  "emailtemporario.com.br",
  "ephemail.net",
  "gishpuppy.com",
  "guerrillamail.biz",
  "haltospam.com",
  "hidemail.de",
  "jetable.com",
  "kasmail.com",
  "klassmaster.com",
  "lroid.com",
  "mailblocks.com",
  "mailmoat.com",
  "mytrashmail.com",
  "nobulk.com",
  "oneoffemail.com",
  "shortmail.net",
  "spamcero.com",
  "spamcorptastic.com",
  "spamex.com",
  "spamfighter.cf",
  "spamfree.eu",
  "spamhole.com",
  "tempemail.net",
  "tempemails.io",
  "thankyou2010.com",
  "trashmail.ws",
  "tmail.ws",
  "tmpbox.net",

  // ── Apple / iCloud relay aliases ────────────────────────────────
  "privaterelay.appleid.com",

  // ── Other known alias / relay services ──────────────────────────
  "duck.com",         // DuckDuckGo email relay
  "mozmail.com",      // Mozilla relay
  "simplelogin.co",   // SimpleLogin aliases
  "simplelogin.com",
  "anonaddy.me",      // AnonAddy aliases
  "anonaddy.com",
]);

/**
 * Check if an email address uses a disposable or alias domain.
 * Returns the blocked domain name if blocked, or null if clean.
 */
export function getBlockedEmailDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return null;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return domain;
  return null;
}

/**
 * Quick boolean check — is this email from a disposable domain?
 */
export function isDisposableEmail(email: string): boolean {
  return getBlockedEmailDomain(email) !== null;
}
