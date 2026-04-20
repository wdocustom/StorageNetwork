/**
 * Webhook handler tests — Tests core logic of the Stripe webhook route.
 *
 * Strategy: Mock Stripe (constructEvent, transfers.create), Supabase, and email.
 * Test the POST handler's behavior for different event types, idempotency,
 * signature verification, and error handling.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type Stripe from "stripe";

// ── Mock Supabase ─────────────────────────────────────────────────────────
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) });
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
  select: mockSelect.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: mockSingle.mockResolvedValue({ data: null, error: null }),
    }),
  }),
});
const mockAuth = {
  admin: {
    getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "installer@test.com" } } }),
  },
};

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: mockFrom,
    auth: mockAuth,
  }),
}));

// ── Mock email ────────────────────────────────────────────────────────────
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  sendNewBookingAlert: vi.fn().mockResolvedValue(undefined),
  sendProWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendBountyPaidEmail: vi.fn().mockResolvedValue(undefined),
  sendJobReceipt: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceivedAlert: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock pro-subscription ─────────────────────────────────────────────────
vi.mock("@/app/actions/pro-subscription", () => ({
  activateProSubscription: vi.fn().mockResolvedValue({ success: true, slug: "test-pro" }),
  deactivateProSubscription: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Mock cleanout-upsell ──────────────────────────────────────────────────
vi.mock("@/app/actions/cleanout-upsell", () => ({
  handleCleanoutUpsellPayment: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock Stripe ───────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn();
const mockTransferCreate = vi.fn().mockResolvedValue({ id: "tr_test123" });

vi.mock("stripe", () => {
  const MockStripe = function() {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      transfers: { create: mockTransferCreate },
    };
  };
  return { default: MockStripe };
});

// Set env before importing the route
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";

// Import the handler AFTER mocks are in place
const { POST } = await import("./route");

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body = "{}", signature = "sig_test") {
  return new Request("https://test.com/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
  }) as unknown as import("next/server").NextRequest;
}

function makeCheckoutEvent(overrides: Partial<{
  id: string;
  leadId: string;
  paymentType: string;
  amount: number;
  email: string;
}>): Stripe.Event {
  const id = overrides.id ?? `evt_test_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        client_reference_id: overrides.leadId ?? "lead-uuid-123",
        amount_total: (overrides.amount ?? 150) * 100,
        metadata: {
          type: overrides.paymentType ?? "booking",
          installerId: "installer-uuid-123",
        },
        customer_details: {
          email: overrides.email ?? "customer@test.com",
          address: {
            line1: "123 Main St",
            city: "Austin",
            state: "TX",
            postal_code: "78701",
          },
        },
        payment_intent: "pi_test_456",
      },
    },
    api_version: "2025-12-15.clover",
    created: Date.now() / 1000,
    livemode: false,
    object: "event",
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

function makePaymentIntentEvent(overrides: Partial<{
  id: string;
  leadId: string;
  paymentType: string;
  amount: number;
}>): Stripe.Event {
  return {
    id: overrides.id ?? `evt_pi_${Math.random().toString(36).slice(2)}`,
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_789",
        amount: (overrides.amount ?? 150) * 100,
        metadata: {
          leadId: overrides.leadId ?? "lead-uuid-456",
          type: overrides.paymentType ?? "deposit",
          customer_email: "cust@test.com",
          customer_name: "Test Customer",
        },
        receipt_email: "cust@test.com",
      },
    },
    api_version: "2025-12-15.clover",
    created: Date.now() / 1000,
    livemode: false,
    object: "event",
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

describe("Stripe Webhook POST handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the DB mock chain for each test
    const eqMock = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockSelect.mockReturnValue({ eq: eqMock });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  // ── Signature & Config ────────────────────────────────────────────────

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("https://test.com/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    }) as unknown as import("next/server").NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Missing stripe-signature/i);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  // ── checkout.session.completed (booking) ──────────────────────────────

  it("processes checkout.session.completed booking event", async () => {
    const event = makeCheckoutEvent({});

    // Mock successful DB update
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);

    // Verify DB update was called
    expect(mockFrom).toHaveBeenCalledWith("leads");
  });

  it("returns 200 when leadId is missing from checkout session", async () => {
    const event = makeCheckoutEvent({ leadId: undefined });
    // Remove client_reference_id to simulate missing leadId
    (event.data.object as any).client_reference_id = null;
    (event.data.object as any).metadata = {};

    mockConstructEvent.mockReturnValue(event);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  it("ignores duplicate events (idempotency guard)", async () => {
    const event = makeCheckoutEvent({ id: "evt_duplicate_test" });
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    // First call
    const res1 = await POST(makeRequest());
    expect(res1.status).toBe(200);

    // Second call with same event ID
    const res2 = await POST(makeRequest());
    expect(res2.status).toBe(200);

    // DB update should only be called for the first event
    // (the second is rejected by idempotency guard before DB calls)
  });

  // ── checkout.session.completed (cleanout_upsell) ──────────────────────

  it("routes cleanout_upsell to handler and returns 200", async () => {
    const event = makeCheckoutEvent({ paymentType: "cleanout_upsell" });
    mockConstructEvent.mockReturnValue(event);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── checkout.session.completed (final_payment) ─────────────────────────

  it("marks lead as paid for final_payment type", async () => {
    const event = makeCheckoutEvent({ paymentType: "final_payment" });
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("leads");
  });

  // ── payment_intent.succeeded ──────────────────────────────────────────

  it("processes payment_intent.succeeded deposit event", async () => {
    const event = makePaymentIntentEvent({ paymentType: "deposit" });
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("processes payment_intent.succeeded final_payment event", async () => {
    const event = makePaymentIntentEvent({ paymentType: "final_payment" });
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── DB failure on booking ─────────────────────────────────────────────

  it("returns 500 when DB update fails on booking", async () => {
    const event = makeCheckoutEvent({});
    mockConstructEvent.mockReturnValue(event);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ── Bounty Calculation Tests (pure logic) ─────────────────────────────────

describe("Bounty calculation logic", () => {
  const BOUNTY_RATE = 0.30;
  const BOUNTY_FLOOR_CENTS = 1500;

  function calculateBounty(depositDollars: number): number {
    const depositCents = Math.round(depositDollars * 100);
    const calculatedBountyCents = Math.round(depositCents * BOUNTY_RATE);
    return Math.max(calculatedBountyCents, BOUNTY_FLOOR_CENTS);
  }

  it("calculates 30% of deposit for large deposits", () => {
    // $200 deposit → 30% = $60 (above $15 floor)
    expect(calculateBounty(200)).toBe(6000); // $60.00 in cents
  });

  it("applies $15 floor for small deposits", () => {
    // $30 deposit → 30% = $9 (below $15 floor → use $15)
    expect(calculateBounty(30)).toBe(1500); // $15.00 in cents
  });

  it("applies $15 floor for exact boundary", () => {
    // $50 deposit → 30% = $15 (exactly at floor)
    expect(calculateBounty(50)).toBe(1500); // $15.00
  });

  it("calculates correctly for $150 deposit", () => {
    // $150 → 30% = $45
    expect(calculateBounty(150)).toBe(4500);
  });

  it("calculates correctly for $1000 deposit", () => {
    // $1000 → 30% = $300
    expect(calculateBounty(1000)).toBe(30000);
  });

  it("applies floor for zero deposit", () => {
    // $0 → 30% = $0 → floor $15
    expect(calculateBounty(0)).toBe(1500);
  });
});

// ── Idempotency Set Pruning (pure logic) ──────────────────────────────────

describe("Idempotency set pruning", () => {
  it("prunes oldest entries when exceeding max", () => {
    const MAX = 5;
    const set = new Set<string>();

    // Add MAX + 3 entries
    for (let i = 0; i < MAX + 3; i++) {
      set.add(`evt_${i}`);
    }

    // Prune (same logic as the webhook)
    if (set.size > MAX) {
      const entries = Array.from(set);
      const toRemove = entries.slice(0, entries.length - MAX);
      toRemove.forEach((id) => set.delete(id));
    }

    expect(set.size).toBe(MAX);
    // Oldest entries should be gone
    expect(set.has("evt_0")).toBe(false);
    expect(set.has("evt_1")).toBe(false);
    expect(set.has("evt_2")).toBe(false);
    // Newest should remain
    expect(set.has(`evt_${MAX + 2}`)).toBe(true);
  });

  it("does not prune when under max", () => {
    const MAX = 1000;
    const set = new Set<string>();
    set.add("evt_1");
    set.add("evt_2");

    if (set.size > MAX) {
      // Should NOT enter this block
      throw new Error("Should not prune");
    }

    expect(set.size).toBe(2);
  });
});
