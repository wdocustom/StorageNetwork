import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// 1. Initialize Stripe with your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    // 2. Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      // We are NOT using 'transfer_data' here.
      // That means 100% of the funds go to YOU (Storage Network).

      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Storage Network Deposit',
              description: 'Direct payment to Platform',
            },
            unit_amount: 15000, // $150.00 (in cents)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',

      // 3. Where to send the user after payment
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?payment=cancelled`,
    });

    // 4. Return the URL so the frontend can redirect
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error('Stripe Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
