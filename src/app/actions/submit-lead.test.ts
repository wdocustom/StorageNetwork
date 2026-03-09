/**
 * Zod schema validation tests for submitLeadSchema.
 * Tests edge cases in the submit-lead validation layer
 * WITHOUT hitting Supabase or Stripe.
 */

import { z } from "zod/v4";

// Reproduce the schema inline so we test validation in isolation
// (importing the module would trigger Supabase client initialization)
const submitLeadSchema = z.object({
  customer_name: z.string().min(1, "Name is required").max(200),
  customer_email: z.email("Invalid email address"),
  customer_phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
  address_line1: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_state: z.string().max(2).optional(),
  address_zip: z.string().regex(/^\d{5}$/, "Invalid ZIP code").optional(),
  delivery_address: z.string().max(500).optional(),
  quote_data: z.array(z.record(z.string(), z.unknown())).min(1, "At least one unit is required"),
  grand_total: z.number().positive("Total must be positive").max(1_000_000),
  installer_id: z.string().uuid("Invalid installer ID").optional(),
  referring_installer_id: z.string().uuid().optional(),
  source: z.enum(["platform", "partner_link"]).optional(),
  scheduled_at: z.string().max(30).optional(),
});

function validInput() {
  return {
    customer_name: "John Doe",
    customer_email: "john@example.com",
    customer_phone: "555-1234",
    address: "123 Main St",
    address_zip: "90210",
    quote_data: [{ cols: 3, rows: 4, price: 500 }],
    grand_total: 500,
  };
}

describe("submitLeadSchema validation", () => {
  it("accepts valid input", () => {
    const result = submitLeadSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects empty customer_name", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), customer_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), customer_name: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), customer_email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects email with spaces", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), customer_email: "john @example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty quote_data", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), quote_data: [] });
    expect(result.success).toBe(false);
  });

  it("rejects zero grand_total", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), grand_total: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative grand_total", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), grand_total: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects grand_total over 1M", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), grand_total: 1_000_001 });
    expect(result.success).toBe(false);
  });

  it("accepts grand_total at 1M boundary", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), grand_total: 1_000_000 });
    expect(result.success).toBe(true);
  });

  // ZIP code validation
  it("rejects 4-digit ZIP", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), address_zip: "9021" });
    expect(result.success).toBe(false);
  });

  it("rejects 6-digit ZIP", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), address_zip: "902101" });
    expect(result.success).toBe(false);
  });

  it("rejects ZIP with letters", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), address_zip: "9021A" });
    expect(result.success).toBe(false);
  });

  it("accepts undefined address_zip (optional)", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).address_zip;
    const result = submitLeadSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  // installer_id validation
  it("rejects non-UUID installer_id", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), installer_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID installer_id", () => {
    const result = submitLeadSchema.safeParse({
      ...validInput(),
      installer_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  // source validation
  it("rejects invalid source value", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), source: "unknown_source" });
    expect(result.success).toBe(false);
  });

  it("accepts platform source", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), source: "platform" });
    expect(result.success).toBe(true);
  });

  it("accepts partner_link source", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), source: "partner_link" });
    expect(result.success).toBe(true);
  });

  // address_state max length
  it("rejects state longer than 2 chars", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), address_state: "CAL" });
    expect(result.success).toBe(false);
  });

  it("accepts 2-char state", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), address_state: "CA" });
    expect(result.success).toBe(true);
  });

  // phone max length
  it("rejects phone longer than 30 chars", () => {
    const result = submitLeadSchema.safeParse({ ...validInput(), customer_phone: "1".repeat(31) });
    expect(result.success).toBe(false);
  });

  // Defaults
  it("defaults customer_phone to empty string", () => {
    const input = validInput();
    delete (input as Record<string, unknown>).customer_phone;
    const result = submitLeadSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBe("");
    }
  });
});
