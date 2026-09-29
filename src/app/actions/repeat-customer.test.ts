/**
 * fetchCustomerForNewQuote — prefill for a repeat order started from one of
 * the customer's earlier jobs.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "installer-1" }),
}));
vi.mock("@/app/actions/fee-engine", () => ({ getDepositAmount: vi.fn() }));
vi.mock("@/app/actions/discount-codes", () => ({ validateDiscountCode: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendInstallScheduledNotice: vi.fn() }));
vi.mock("@/app/actions/calculate-materials", () => ({ calculateMaterialCostServer: vi.fn() }));
vi.mock("@/app/actions/inventory", () => ({ updateInventoryAfterJob: vi.fn(), getInstallerInventory: vi.fn() }));

let leadRow: Record<string, unknown>;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockImplementation(async () => ({ data: leadRow, error: null }));
      return chain;
    }),
  }),
}));

const { fetchCustomerForNewQuote } = await import("./jobs");

const base = {
  id: "lead-1",
  installer_id: "installer-1",
  status: "paid",
  customer_name: "Patricia Hawkins",
  customer_email: "p@example.com",
  customer_phone: "402-555-5512",
  delivery_address_line1: null,
  delivery_address_line2: null,
  delivery_address_city: null,
  delivery_address_state: null,
  delivery_address_zip: null,
  address_line1: null,
  address_city: null,
  address_state: null,
  address_zip: null,
};

describe("fetchCustomerForNewQuote", () => {
  beforeEach(() => {
    leadRow = { ...base };
  });

  it("returns the customer's contact and delivery details", async () => {
    leadRow = {
      ...base,
      delivery_address_line1: "12 Elm St",
      delivery_address_city: "Omaha",
      delivery_address_state: "NE",
      delivery_address_zip: "68102",
    };
    const r = await fetchCustomerForNewQuote("lead-1");
    expect(r.success).toBe(true);
    expect(r.customer).toMatchObject({
      sourceLeadId: "lead-1",
      customer_name: "Patricia Hawkins",
      customer_email: "p@example.com",
      customer_phone: "402-555-5512",
      delivery_address_line1: "12 Elm St",
      delivery_address_zip: "68102",
    });
  });

  it("falls back to the older address fields when there's no delivery address", async () => {
    leadRow = { ...base, address_line1: "9 Oak Ave", address_city: "Lincoln", address_state: "NE", address_zip: "68508" };
    const r = await fetchCustomerForNewQuote("lead-1");
    expect(r.customer).toMatchObject({
      delivery_address_line1: "9 Oak Ave",
      delivery_address_city: "Lincoln",
      delivery_address_zip: "68508",
    });
  });

  it("won't reveal a waitlisted customer's details", async () => {
    leadRow = { ...base, status: "waitlisted" };
    const r = await fetchCustomerForNewQuote("lead-1");
    expect(r.success).toBe(false);
    expect(r.customer).toBeUndefined();
  });

  it("refuses another installer's job", async () => {
    leadRow = { ...base, installer_id: "installer-2" };
    const r = await fetchCustomerForNewQuote("lead-1");
    expect(r.success).toBe(false);
  });
});
