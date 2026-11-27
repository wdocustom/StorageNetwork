import { isDirectLeadSource, platformFeeRateForSource } from "@/lib/lead-source";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Installer take-home for the "new booking" alert.
//
// The alert used to show totalPrice × 0.85 for every job, which assumed the
// 15% network fee. On a direct lead (3% fee) that understated the installer's
// pay and made the platform fee look five times bigger than it was (an
// installer caught it on a $1,499 direct job: email said $1,274, real
// take-home was $1,454.03).
//
// Where possible this reads what Stripe actually did with the deposit — the
// deposit metadata records platform_fee_cents and installer_receives_cents
// (which already reflect waived first jobs, fee overrides, FB-share discounts
// and referral-partner cuts). Take-home is then:
//
//   take-home = installer's share of the deposit + balance still to collect
//
// When the deposit wasn't split to the installer (no connected Stripe
// account / not Pro — the platform holds the whole deposit), fall back to
// total − total × source fee rate.
// ═══════════════════════════════════════════════════════════════════════════

export interface BookingTakeHomeInput {
  totalPrice: number;
  depositPaid: number;
  /** leads.balance_due — what the customer still owes at install. */
  balanceDue?: number | null;
  /** leads.source (preferred) or deposit metadata source. */
  source?: string | null;
  /** Stripe metadata from the deposit Checkout Session / PaymentIntent. */
  metadata?: Record<string, string | undefined> | null;
}

export interface BookingTakeHome {
  isDirect: boolean;
  feeWaived: boolean;
  /** Installer's total for the job after the platform fee (and partner cut). */
  takeHome: number;
  platformFee: number;
  /** Rate label for the fee line, e.g. "3%" — null when the fee was waived. */
  feeRateLabel: string | null;
  partnerCut: number;
  /** Installer's share of the deposit, already sent to their Stripe account. Null when not split. */
  fromDeposit: number | null;
  /** What the installer still collects from the customer at install. */
  balanceToCollect: number;
}

function centsField(metadata: BookingTakeHomeInput["metadata"], key: string): number | null {
  const raw = metadata?.[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n / 100 : null;
}

export function computeBookingTakeHome(input: BookingTakeHomeInput): BookingTakeHome {
  const { totalPrice, depositPaid, metadata } = input;
  const source = input.source ?? metadata?.source ?? null;
  const isDirect = isDirectLeadSource(source);
  const balanceToCollect = roundMoney(
    input.balanceDue !== null && input.balanceDue !== undefined
      ? Math.max(0, input.balanceDue)
      : Math.max(0, totalPrice - depositPaid)
  );

  const platformFeeFromStripe = centsField(metadata, "platform_fee_cents");
  const installerReceives = centsField(metadata, "installer_receives_cents");
  const depositWasSplit = !!metadata?.installer_stripe_id && installerReceives !== null && platformFeeFromStripe !== null;

  if (depositWasSplit) {
    const feeWaived = metadata?.fee_waived === "true" || platformFeeFromStripe === 0;
    const partnerCut = centsField(metadata, "partner_cut_cents") ?? 0;
    const rateLabel = metadata?.platform_fee_rate?.match(/^\d+(\.\d+)?%/)?.[0] ?? null;
    return {
      isDirect,
      feeWaived,
      takeHome: roundMoney(installerReceives! + balanceToCollect),
      platformFee: roundMoney(platformFeeFromStripe!),
      feeRateLabel: feeWaived ? null : rateLabel,
      partnerCut: roundMoney(partnerCut),
      fromDeposit: roundMoney(installerReceives!),
      balanceToCollect,
    };
  }

  const rate = platformFeeRateForSource(source);
  const platformFee = roundMoney(totalPrice * rate);
  return {
    isDirect,
    feeWaived: false,
    takeHome: roundMoney(totalPrice - platformFee),
    platformFee,
    feeRateLabel: `${Math.round(rate * 100)}%`,
    partnerCut: 0,
    fromDeposit: null,
    balanceToCollect,
  };
}
