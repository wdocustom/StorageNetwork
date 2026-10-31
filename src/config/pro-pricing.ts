// Pro pricing — one place for the price and the "free right now" promo.

/**
 * Limited-time free Pro. While on:
 *   • trials never hit the 3-job cap or the 45-day expiry (checkProTrial)
 *   • /upgrade turns Pro on for free instead of opening Stripe checkout
 *   • a canceled subscription keeps Pro instead of suspending the account
 *   • every price reads "~~$49/mo~~ FREE · limited time"
 * Installers who got Pro free keep a trial clock (pro_trial_ends_at), so
 * turning this off puts them back through the normal expiry + grace window.
 * Paying subscribers are untouched — Stripe keeps billing them.
 */
export const PRO_FREE_PROMO = true;

/** List price in dollars per month. */
export const PRO_MONTHLY_PRICE = 49;

/** "$49/mo" */
export const PRO_PRICE_LABEL = `$${PRO_MONTHLY_PRICE}/mo`;

/** Short promo tag shown next to the crossed-out price. */
export const PRO_PROMO_TAG = "Limited time";

/** One-line price for plain text (AI answers, metadata, FAQ copy). */
export const PRO_PRICE_TEXT = PRO_FREE_PROMO
  ? `free right now (normally $${PRO_MONTHLY_PRICE}/month — limited time)`
  : `$${PRO_MONTHLY_PRICE}/month`;
