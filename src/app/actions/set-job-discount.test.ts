/**
 * setJobDiscount — after-the-fact discounts on a job.
 *
 * Bug: a discount applied on the job ticket only lived in React state. The
 * ticket and invoice email showed the reduced amount, but the emailed
 * /payment/collect link and saved-card charge recompute the balance from the
 * lead row (computeBalanceDue), so the customer was still billed in full.
 * The discount must be saved on the lead.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { computeBalanceDue } from "@/lib/lead-money";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "installer-1" }),
}));

vi.mock("@/app/actions/fee-engine", () => ({
  getDepositAmount: vi.fn().mockResolvedValue(50),
}));

const validateDiscountCode = vi.fn();
vi.mock("@/app/actions/discount-codes", () => ({
  validateDiscountCode: (...args: unknown[]) => validateDiscountCode(...args),
}));

vi.mock("@/app/actions/installer-activity", () => ({
  logActivityInternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendInstallScheduledNotice: vi.fn(),
}));

vi.mock("@/app/actions/calculate-materials", () => ({
  calculateMaterialCostServer: vi.fn(),
}));

vi.mock("@/app/actions/inventory", () => ({
  updateInventoryAfterJob: vi.fn(),
  getInstallerInventory: vi.fn(),
}));

let leadRow: Record<string, unknown>;
let updatePayload: Record<string, unknown> | undefined;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({ data: leadRow, error: null });
      chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      });
      // update(...).eq(...) is awaited directly; select(...).eq(...) chains on
      chain.eq = vi.fn().mockImplementation(() =>
        updatePayload ? Promise.resolve({ error: null }) : chain
      );
      return chain;
    }),
  }),
}));

const { setJobDiscount } = await import("./jobs");

// $575 job, $172.50 deposit collected → $402.50 owed at install
const depositedJob = {
  installer_id: "installer-1",
  status: "payment_pending",
  payout_status: null,
  estimated_price: 575,
  deposit_amount: 172.5,
  deposit_paid: true,
  sales_tax_amount: 0,
};

describe("setJobDiscount", () => {
  beforeEach(() => {
    updatePayload = undefined;
    validateDiscountCode.mockReset();
    leadRow = { ...depositedJob };
  });

  it("saves a flat $100 adjustment so every balance path bills $302.50", async () => {
    const result = await setJobDiscount("lead-1", { amount: 100 });

    expect(result).toMatchObject({ success: true, discountAmount: 100, code: null });
    expect(updatePayload).toMatchObject({ discount_amount: 100, discount_code: null, balance_due: 302.5 });
    expect(computeBalanceDue({ ...depositedJob, discount_amount: updatePayload!.discount_amount as number })).toBe(302.5);
  });

  it("removes the discount with amount 0", async () => {
    const result = await setJobDiscount("lead-1", { amount: 0 });

    expect(result.success).toBe(true);
    expect(updatePayload).toMatchObject({ discount_amount: null, discount_code: null, balance_due: 402.5 });
  });

  it("saves a validated code with its server-resolved amount", async () => {
    validateDiscountCode.mockResolvedValue({ valid: true, discountAmount: 50, code: "SAVE50" });

    const result = await setJobDiscount("lead-1", { code: "save50" });

    expect(result).toMatchObject({ success: true, discountAmount: 50, code: "SAVE50" });
    expect(updatePayload).toMatchObject({ discount_amount: 50, discount_code: "SAVE50" });
  });

  it("rejects an invalid code without writing", async () => {
    validateDiscountCode.mockResolvedValue({ valid: false, discountAmount: 0, error: "Code expired." });

    const result = await setJobDiscount("lead-1", { code: "OLD" });

    expect(result).toEqual({ success: false, error: "Code expired." });
    expect(updatePayload).toBeUndefined();
  });

  it("rejects a discount larger than the remaining build balance", async () => {
    const result = await setJobDiscount("lead-1", { amount: 500 });

    expect(result.success).toBe(false);
    expect(updatePayload).toBeUndefined();
  });

  it("rejects a discount on a paid job", async () => {
    leadRow = { ...depositedJob, status: "paid" };

    const result = await setJobDiscount("lead-1", { amount: 100 });

    expect(result.success).toBe(false);
    expect(updatePayload).toBeUndefined();
  });

  it("allows up to the full price on an undeposited quote and leaves balance_due alone", async () => {
    leadRow = { ...depositedJob, status: "pending_payment", deposit_paid: false };

    const result = await setJobDiscount("lead-1", { amount: 575 });

    expect(result.success).toBe(true);
    expect(updatePayload).toMatchObject({ discount_amount: 575 });
    expect(updatePayload).not.toHaveProperty("balance_due");
  });
});
