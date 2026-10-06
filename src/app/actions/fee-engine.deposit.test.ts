/**
 * The campaign (and every other) booking path takes its deposit from
 * getDepositAmount(total, installerId). Lock in that it follows each
 * installer's own deposit config, with the 15% floor that covers the
 * platform's network fee.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

let depositConfig: unknown = null;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = async () => ({ data: { deposit_config: depositConfig } });
      return chain;
    },
  }),
}));

const { getDepositAmount, getDepositLabel } = await import("./fee-engine");
const INSTALLER = "cc12ae7c-3ae1-46be-82b7-f7ba276878e5";

describe("getDepositAmount follows the installer's deposit config", () => {
  beforeEach(() => {
    depositConfig = null;
  });

  it("defaults to 15% when the installer has no config", async () => {
    expect(await getDepositAmount(1000, INSTALLER)).toBe(150);
    expect(await getDepositAmount(1000)).toBe(150);
  });

  it("uses a higher percentage config", async () => {
    depositConfig = { type: "percentage", value: 25 };
    expect(await getDepositAmount(1000, INSTALLER)).toBe(250);
    expect(await getDepositLabel(INSTALLER)).toBe("25%");
  });

  it("uses a flat config", async () => {
    depositConfig = { type: "flat", value: 200 };
    expect(await getDepositAmount(1000, INSTALLER)).toBe(200);
    expect(await getDepositLabel(INSTALLER)).toBe("$200");
  });

  it("never goes below the 15% floor (a $50 flat deposit on $1,000 becomes $150)", async () => {
    depositConfig = { type: "flat", value: 50 };
    expect(await getDepositAmount(1000, INSTALLER)).toBe(150);
    depositConfig = { type: "percentage", value: 5 };
    expect(await getDepositAmount(1000, INSTALLER)).toBe(150);
  });
});
