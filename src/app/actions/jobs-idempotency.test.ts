/**
 * completeJob / completeJobWithProof replay safety (native offline queue).
 *
 * The native app queues "mark complete" while offline and replays it on
 * reconnect. A replay must never pull a paid / payment_pending job backwards
 * or decrement inventory a second time.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const claim = vi.fn();
vi.mock("@/lib/server/idempotency", () => ({
  claimIdempotencyKey: (...a: unknown[]) => claim(...a),
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ id: "installer-1" }),
}));
vi.mock("@/app/actions/fee-engine", () => ({ getDepositAmount: vi.fn() }));
vi.mock("@/app/actions/discount-codes", () => ({ validateDiscountCode: vi.fn() }));
vi.mock("@/app/actions/installer-activity", () => ({
  logActivityInternal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({ sendInstallScheduledNotice: vi.fn() }));
vi.mock("@/app/actions/calculate-materials", () => ({
  calculateMaterialCostServer: vi.fn().mockResolvedValue({ rawCounts: {} }),
}));

const getInstallerInventory = vi.fn().mockResolvedValue({});
vi.mock("@/app/actions/inventory", () => ({
  updateInventoryAfterJob: vi.fn(),
  getInstallerInventory: (...a: unknown[]) => getInstallerInventory(...a),
}));

// `advanceResult` is what the guarded status UPDATE returns: a row when the
// job really moved forward, null when it was already paid / payment_pending.
let advanceResult: { id: string } | null;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: vi.fn().mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.not = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn().mockReturnValue(chain);
      chain.single = vi
        .fn()
        .mockResolvedValue({ data: { installer_id: "installer-1", quote_data: [{ price: 1 }] }, error: null });
      chain.maybeSingle = vi.fn().mockImplementation(() =>
        Promise.resolve({ data: advanceResult, error: null })
      );
      // `await chain` (updates with no terminal call) resolves OK
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
      return chain;
    }),
  }),
}));

const { completeJob, completeJobWithProof } = await import("./jobs");

// syncInventoryForLead is fire-and-forget; let it run before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("completeJob replay safety", () => {
  beforeEach(() => {
    claim.mockReset().mockResolvedValue(true);
    getInstallerInventory.mockClear();
    advanceResult = { id: "lead-1" };
  });

  it("advances a fresh job once and syncs inventory", async () => {
    const res = await completeJob("lead-1", "key-1");
    expect(res).toEqual({ success: true });
    expect(claim).toHaveBeenCalledWith("installer-1", "key-1", "completeJob");
    await flush();
    expect(getInstallerInventory).toHaveBeenCalledTimes(1);
  });

  it("is a no-op success when the Idempotency-Key was already used", async () => {
    claim.mockResolvedValue(false);
    const res = await completeJob("lead-1", "key-1");
    expect(res).toEqual({ success: true, duplicate: true });
    expect(getInstallerInventory).not.toHaveBeenCalled();
  });

  it("does not regress or re-sync a job that is already paid / payment_pending", async () => {
    advanceResult = null; // guarded UPDATE matched no row
    const res = await completeJob("lead-1");
    expect(res).toEqual({ success: true, duplicate: true });
    await flush();
    expect(getInstallerInventory).not.toHaveBeenCalled();
  });
});

describe("completeJobWithProof replay safety", () => {
  beforeEach(() => {
    claim.mockReset().mockResolvedValue(true);
    getInstallerInventory.mockClear();
    advanceResult = { id: "lead-1" };
  });

  it("syncs inventory only on the real transition", async () => {
    await completeJobWithProof("lead-1", "https://x/p.jpg", null, "Cust", 100);
    await flush();
    expect(getInstallerInventory).toHaveBeenCalledTimes(1);

    getInstallerInventory.mockClear();
    advanceResult = null; // replay after the job already moved on
    const res = await completeJobWithProof("lead-1", "https://x/p.jpg", null, "Cust", 100);
    await flush();
    expect(res.success).toBe(true);
    expect(getInstallerInventory).not.toHaveBeenCalled();
  });

  it("is a no-op success on a repeated Idempotency-Key", async () => {
    claim.mockResolvedValue(false);
    const res = await completeJobWithProof("lead-1", "u", null, "C", 1, undefined, "key-9");
    expect(res).toEqual({ success: true, duplicate: true });
    expect(getInstallerInventory).not.toHaveBeenCalled();
  });
});
