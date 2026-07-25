/**
 * fetchPendingLead regression test.
 *
 * The 7-day expiry check used to key off created_at, so a lead an
 * installer just reactivated (by editing an expired quote, which bumps
 * updated_at and resets status to "pending_payment" — see jobs.test.ts)
 * would immediately re-expire on the very next page load if its original
 * created_at was more than 7 days ago. The check must key off the most
 * recent activity (updated_at), not the original creation time.
 */

import { vi, describe, it, expect } from "vitest";

let leadRow: Record<string, unknown>;
let expireUpdatePayload: Record<string, unknown> | undefined;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue(
        table === "leads" ? { data: leadRow, error: null } : { data: null, error: null }
      );
      chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        expireUpdatePayload = payload;
        return chain;
      });
      return chain;
    }),
  }),
}));

vi.mock("@/lib/email", () => ({
  sendAbandonedCartEmail: vi.fn(),
}));

const { fetchPendingLead } = await import("./abandoned-cart");

describe("fetchPendingLead", () => {
  it("resumes a lead reactivated more than 7 days after its original creation", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const justNow = new Date().toISOString();

    leadRow = {
      id: "lead-1",
      customer_name: "Kathy Petersen",
      customer_email: "customer@example.com",
      customer_phone: null,
      address: null,
      quote_data: [],
      estimated_price: 1660,
      deposit_amount: 249,
      installer_id: null,
      source: "installer_manual",
      created_at: fortyDaysAgo, // original quote is old
      updated_at: justNow,      // but the installer just edited/reactivated it
      status: "pending_payment",
      discount_code: null,
      delivery_fee: 0,
      sales_tax_amount: 0,
      billing_state: null,
    };

    const result = await fetchPendingLead("lead-1");

    expect(result.success).toBe(true);
    expect(expireUpdatePayload).toBeUndefined();
  });

  it("still expires a lead with no activity in the last 7 days", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    leadRow = {
      id: "lead-2",
      customer_name: "Old Customer",
      customer_email: "old@example.com",
      customer_phone: null,
      address: null,
      quote_data: [],
      estimated_price: 500,
      deposit_amount: 75,
      installer_id: null,
      source: "installer_manual",
      created_at: fortyDaysAgo,
      updated_at: fortyDaysAgo,
      status: "pending_payment",
      discount_code: null,
      delivery_fee: 0,
      sales_tax_amount: 0,
      billing_state: null,
    };

    const result = await fetchPendingLead("lead-2");

    expect(result.success).toBe(false);
    expect(expireUpdatePayload?.status).toBe("expired");
  });
});
