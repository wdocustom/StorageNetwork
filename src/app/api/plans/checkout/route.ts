import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { getPlanById } from "@/lib/plans-config";
import { resolvePromoterReferralCode } from "@/app/actions/promoter-program";

const PROMOTER_COOKIE = "sn_promoter_ref";

// Guest checkout — no authenticated buyer to compare against for
// self-referral, but a promoter buying their own plan via a guest session
// is an edge case we don't need to special-case here (the webhook still
// requires an active agreement + connected Stripe account to pay out).
async function resolvePromoterAttribution(
  request: NextRequest
): Promise<{ promoterId: string; code: string } | null> {
  const raw = request.cookies.get(PROMOTER_COOKIE)?.value;
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  const resolved = await resolvePromoterReferralCode(normalized);
  if (!resolved) return null;
  return { promoterId: resolved.promoterId, code: normalized };
}

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json() as { planId: string };
    const plan = getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const baseUrl = siteConfig.baseUrl;
    const attribution = await resolvePromoterAttribution(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: undefined, // Stripe will collect email in checkout
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.name} — Digital Build Plans`,
              description: plan.tagline,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/plans/access?session_id={CHECKOUT_SESSION_ID}&plan_id=${encodeURIComponent(planId)}`,
      cancel_url: `${baseUrl}/plans`,
      metadata: {
        type: "public_plan",
        plan_id: planId,
        ...(attribution
          ? { promoter_id: attribution.promoterId, promoter_referral_code: attribution.code }
          : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[PlansCheckout]", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
