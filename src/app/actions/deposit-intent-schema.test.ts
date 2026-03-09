/**
 * Zod schema validation tests for depositIntentSchema.
 * Tests the payment validation layer in isolation.
 */

import { z } from "zod/v4";

// Reproduce the schema inline to avoid triggering Stripe/Supabase initialization
const depositIntentSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
  amount: z.number().positive("Deposit must be positive").max(100_000, "Amount too large"),
  totalPrice: z.number().positive("Total price must be positive").max(1_000_000, "Price too large"),
  installerId: z.string().uuid("Invalid installer ID").optional(),
  source: z.enum(["platform", "partner_link", "installer_manual"]),
  customerEmail: z.email("Invalid email").optional(),
  customerName: z.string().max(200).optional(),
  scheduledAt: z.string().max(30).optional(),
  salesTaxAmount: z.number().min(0).max(100_000).optional(),
  billingState: z.string().max(2).optional(),
  discountCode: z.string().max(50).optional(),
  discountCodeAmount: z.number().min(0).max(100_000).optional(),
  deliveryFeeAmount: z.number().min(0).max(10_000).optional(),
});

function validInput() {
  return {
    leadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    amount: 150,
    totalPrice: 1000,
    source: "platform" as const,
  };
}

describe("depositIntentSchema validation", () => {
  it("accepts minimal valid input", () => {
    const result = depositIntentSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("accepts full valid input", () => {
    const result = depositIntentSchema.safeParse({
      ...validInput(),
      installerId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      scheduledAt: "2026-04-15",
      salesTaxAmount: 60,
      billingState: "CA",
      discountCode: "SAVE50",
      discountCodeAmount: 50,
      deliveryFeeAmount: 75,
    });
    expect(result.success).toBe(true);
  });

  // leadId
  it("rejects non-UUID leadId", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), leadId: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("rejects missing leadId", () => {
    const { leadId, ...rest } = validInput();
    const result = depositIntentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // amount
  it("rejects zero amount", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), amount: -50 });
    expect(result.success).toBe(false);
  });

  it("rejects amount over 100K", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), amount: 100_001 });
    expect(result.success).toBe(false);
  });

  it("accepts amount at 100K boundary", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), amount: 100_000 });
    expect(result.success).toBe(true);
  });

  // totalPrice
  it("rejects zero totalPrice", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), totalPrice: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects totalPrice over 1M", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), totalPrice: 1_000_001 });
    expect(result.success).toBe(false);
  });

  // source
  it("rejects invalid source", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), source: "direct" });
    expect(result.success).toBe(false);
  });

  it("accepts installer_manual source", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), source: "installer_manual" });
    expect(result.success).toBe(true);
  });

  // email
  it("rejects malformed email", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), customerEmail: "not-email" });
    expect(result.success).toBe(false);
  });

  // salesTaxAmount
  it("rejects negative tax", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), salesTaxAmount: -5 });
    expect(result.success).toBe(false);
  });

  it("accepts zero tax", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), salesTaxAmount: 0 });
    expect(result.success).toBe(true);
  });

  // billingState
  it("rejects state longer than 2 chars", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), billingState: "CAL" });
    expect(result.success).toBe(false);
  });

  // discountCode
  it("rejects discount code longer than 50 chars", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), discountCode: "X".repeat(51) });
    expect(result.success).toBe(false);
  });

  // deliveryFeeAmount
  it("rejects negative delivery fee", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), deliveryFeeAmount: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects delivery fee over 10K", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), deliveryFeeAmount: 10_001 });
    expect(result.success).toBe(false);
  });

  // discountCodeAmount
  it("rejects negative discount amount", () => {
    const result = depositIntentSchema.safeParse({ ...validInput(), discountCodeAmount: -1 });
    expect(result.success).toBe(false);
  });
});
