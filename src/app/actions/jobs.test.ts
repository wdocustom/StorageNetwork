/**
 * updateQuote reactivation regression test.
 *
 * Bug: an installer editing an expired quote (leads.status = "expired",
 * set by the abandoned-cart cron after 7 days unpaid) got a "Quote
 * Updated!" success message, but the customer's /pay link kept showing
 * "Order Not Found" — fetchPendingLead() only resumes status
 * "pending_payment", and updateQuote() never reset the status.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "installer-1" }),
}));

vi.mock("@/app/actions/fee-engine", () => ({
  getDepositAmount: vi.fn().mockResolvedValue(50),
}));

vi.mock("@/app/actions/discount-codes", () => ({
  validateDiscountCode: vi.fn().mockResolvedValue({ valid: false }),
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

let leadRow: { installer_id: string; deposit_paid: boolean; status: string };
let updatePayload: Record<string, unknown> | undefined;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({ data: leadRow, error: null });
      chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      });
      return chain;
    }),
  }),
}));

const { updateQuote } = await import("./jobs");

describe("updateQuote", () => {
  beforeEach(() => {
    updatePayload = undefined;
  });

  it("reactivates an expired lead so the customer pay link works again", async () => {
    leadRow = { installer_id: "installer-1", deposit_paid: false, status: "expired" };

    const result = await updateQuote({
      leadId: "lead-1",
      quote_data: [{ price: 300 } as never],
      grand_total: 300,
    });

    expect(result.success).toBe(true);
    expect(updatePayload?.status).toBe("pending_payment");
  });

  it("leaves an already-pending lead's status untouched", async () => {
    leadRow = { installer_id: "installer-1", deposit_paid: false, status: "pending_payment" };

    const result = await updateQuote({
      leadId: "lead-2",
      quote_data: [{ price: 300 } as never],
      grand_total: 300,
    });

    expect(result.success).toBe(true);
    expect(updatePayload?.status).toBeUndefined();
  });
});
