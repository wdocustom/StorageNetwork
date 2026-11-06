/**
 * Canadian installers: sales tax resolves from a postal code to its province
 * and uses the GST/HST/PST rate there, while US ZIPs keep their state rates.
 */
import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = async () => ({ data: { sales_tax_enabled: true } });
      chain.maybeSingle = chain.single;
      return chain;
    },
  }),
}));

const { getStateFromZip, getEstimatedSalesTax, getSalesTax } = await import("./fee-engine");

describe("getStateFromZip", () => {
  it("maps Canadian postal codes to 2-letter provinces", async () => {
    expect(await getStateFromZip("M5V 2T6")).toBe("ON");
    expect(await getStateFromZip("h2x")).toBe("QC");
    expect(await getStateFromZip("V6B 1A1")).toBe("BC");
  });
  it("keeps US ZIP → state", async () => {
    expect(await getStateFromZip("29401")).toBe("SC");
  });
  it("returns null for junk", async () => {
    expect(await getStateFromZip("nope")).toBeNull();
  });
});

describe("sales tax", () => {
  it("applies HST in Ontario and GST+QST in Quebec", async () => {
    expect((await getEstimatedSalesTax(1000, "M5V 2T6")).taxAmount).toBe(130);
    expect((await getSalesTax(1000, "QC")).taxAmount).toBe(149.75);
  });
  it("leaves US state rates unchanged (CA is still California)", async () => {
    expect((await getSalesTax(1000, "CA")).taxRate).toBe(0.0725);
    expect((await getEstimatedSalesTax(1000, "29401")).taxAmount).toBe(60);
  });
});
