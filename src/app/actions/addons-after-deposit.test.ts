/**
 * addItemsAfterDeposit — post-deposit add-on money math.
 *
 * Scenario from the installer: a $1,050 direct-lead order paid its 15%
 * deposit ($157.50, 3% platform fee = $31.50). At the last second the
 * customer adds a $150 plywood top. The add-on must carry its own 15%
 * deposit ($22.50) and 3% platform fee ($4.50), and raise the job total to
 * $1,200 so the balance after both deposits is $1,020.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "installer-1" }),
}));

vi.mock("@/app/actions/fee-engine", () => ({
  getDepositAmount: vi.fn(),
  // Default config: 15% of the add-on amount.
  getAddonDepositAmount: vi.fn(async (amount: number) => Math.round(amount * 0.15 * 100) / 100),
  getSalesTax: vi.fn(async () => ({ taxAmount: 0 })),
  getEstimatedSalesTax: vi.fn(async () => ({ taxAmount: 0 })),
}));

vi.mock("@/app/actions/discount-codes", () => ({ incrementDiscountCodeUsage: vi.fn() }));
vi.mock("@/app/actions/installer-activity", () => ({ logActivityInternal: vi.fn() }));
vi.mock("stripe", () => {
  class StripeMock {
    static errors = { StripeCardError: class extends Error {} };
  }
  return { default: StripeMock };
});

type Row = Record<string, unknown>;
let leadRow: Row;
let profileRow: Row;
let completedJobs: number;
let addonInsert: Row | undefined;
let leadUpdate: Row | undefined;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      let op: "select" | "insert" | "update" | "delete" = "select";
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "profiles") return { data: profileRow, error: null };
        if (table === "lead_addons") {
          return op === "insert" ? { data: { id: "addon-1" }, error: null } : { data: [], error: null };
        }
        if (op === "update") return { data: { id: "lead-1" }, error: null };
        return { data: leadRow, error: null, count: completedJobs };
      };
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockImplementation((payload: Row) => {
        op = "insert";
        addonInsert = payload;
        return chain;
      });
      chain.update = vi.fn().mockImplementation((payload: Row) => {
        op = "update";
        if (table === "leads") leadUpdate = payload;
        return chain;
      });
      chain.delete = vi.fn().mockImplementation(() => {
        op = "delete";
        return chain;
      });
      chain.single = vi.fn().mockImplementation(async () => result());
      chain.maybeSingle = vi.fn().mockImplementation(async () => result());
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
      return chain;
    },
  }),
}));

const { addItemsAfterDeposit } = await import("./payments");

const baseUnit = {
  cols: 4, rows: 3, toteType: "HDX", unitType: "standard", orientation: "standard",
  hasTotes: true, hasWheels: false, hasTop: false,
  totalW: 0, totalH: 0, depth: 0, desc: "4×3 rack",
};

describe("addItemsAfterDeposit", () => {
  beforeEach(() => {
    addonInsert = undefined;
    leadUpdate = undefined;
    completedJobs = 10; // past the 3 free jobs
    profileRow = {
      stripe_account_id: "acct_1",
      is_pro: true,
      platform_fee_override: null,
      stripe_subscription_id: "sub_1",
    };
    leadRow = {
      installer_id: "installer-1",
      quote_data: [{ ...baseUnit, price: 1050 }],
      delivery_fee: 0,
      status: "open",
      payout_status: "deposit_collected",
      source: "installer_manual",
      fee_status: "standard",
      billing_state: null,
      delivery_address_zip: null,
      address_zip: null,
      estimated_price: 1050,
      deposit_amount: 157.5,
      deposit_paid: true,
      discount_amount: 0,
      sales_tax_amount: 0,
    };
  });

  it("records a $150 top with its own $22.50 deposit and $4.50 platform fee", async () => {
    const result = await addItemsAfterDeposit({
      leadId: "lead-1",
      quote_data: [{ ...baseUnit, price: 1200, hasTop: true }] as never,
    });

    expect(result.success).toBe(true);
    expect(addonInsert).toMatchObject({
      amount: 150,
      deposit_amount: 22.5,
      platform_fee: 4.5,
      status: "pending",
      description: "Unit 1: + top",
    });
    // Job total rises by the add-on; deposit_amount is untouched until the
    // add-on deposit is actually paid, so the balance owes it in full.
    expect(leadUpdate).toMatchObject({ estimated_price: 1200, balance_due: 1042.5 });
    expect(leadUpdate).not.toHaveProperty("deposit_amount");
  });

  it("charges the 15% network rate on network leads", async () => {
    leadRow.source = "platform";
    await addItemsAfterDeposit({
      leadId: "lead-1",
      quote_data: [{ ...baseUnit, price: 1200, hasTop: true }] as never,
    });
    expect(addonInsert).toMatchObject({ deposit_amount: 22.5, platform_fee: 22.5 });
  });

  it("keeps a waived (free) job's add-ons fee-free", async () => {
    leadRow.fee_status = "waived";
    await addItemsAfterDeposit({
      leadId: "lead-1",
      quote_data: [{ ...baseUnit, price: 1200, hasTop: true }] as never,
    });
    expect(addonInsert).toMatchObject({ platform_fee: 0 });
  });

  it("refuses to lower the total after a deposit", async () => {
    const result = await addItemsAfterDeposit({
      leadId: "lead-1",
      quote_data: [{ ...baseUnit, price: 900 }] as never,
    });
    expect(result.success).toBe(false);
    expect(addonInsert).toBeUndefined();
    expect(leadUpdate).toBeUndefined();
  });

  it("refuses a lead with no deposit", async () => {
    leadRow.deposit_paid = false;
    const result = await addItemsAfterDeposit({
      leadId: "lead-1",
      quote_data: [{ ...baseUnit, price: 1200, hasTop: true }] as never,
    });
    expect(result.success).toBe(false);
  });
});
