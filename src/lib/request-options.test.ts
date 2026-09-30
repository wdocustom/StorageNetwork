import { describe, it, expect } from "vitest";
import { requestOptionsFor, requestWantLabel } from "./request-options";
import { DEFAULT_SERVICES, type ServiceOffering } from "@/config/services";

const values = (o: { value: string }[]) => o.map((x) => x.value);

describe("requestOptionsFor", () => {
  it("defaults: tote racks, add-ons, the three clean-outs, something else", () => {
    expect(values(requestOptionsFor(null, null))).toEqual([
      "rack",
      "addons",
      "service:cleanout_1car",
      "service:cleanout_2car",
      "service:cleanout_3car",
      "other",
    ]);
  });

  it("only offers products the installer has enabled", () => {
    const opts = values(
      requestOptionsFor({ overhead_storage_enabled: true, raised_bed_enabled: true }, DEFAULT_SERVICES)
    );
    expect(opts).toContain("overhead");
    expect(opts).toContain("raised_bed");
    expect(opts).not.toContain("shelving");
    expect(opts).not.toContain("chair");
  });

  it("drops disabled services and keeps custom ones", () => {
    const services: ServiceOffering[] = [
      { ...DEFAULT_SERVICES[0] },
      { ...DEFAULT_SERVICES[1], enabled: false },
      { id: "epoxy", name: "Epoxy Floors", description: "", price: 1500, enabled: true, built_in: false },
    ];
    const opts = requestOptionsFor({}, services);
    expect(values(opts)).toEqual(["rack", "addons", "service:epoxy", "other"]);
    expect(opts.find((o) => o.value === "service:epoxy")?.label).toBe("Epoxy Floors");
  });

  it("hides racks and add-ons when tote storage is switched off", () => {
    const services = DEFAULT_SERVICES.map((s) => (s.id === "tote_storage" ? { ...s, enabled: false } : s));
    const opts = values(requestOptionsFor({ overhead_storage_enabled: true }, services));
    expect(opts).not.toContain("rack");
    expect(opts).not.toContain("addons");
    expect(opts).toContain("overhead");
  });

  it("leaves totes out of the add-on label for frame-only installers", () => {
    const addons = requestOptionsFor({ totes_disabled: true }, null).find((o) => o.value === "addons");
    expect(addons?.label).toBe("Add a top or wheels");
  });
});

describe("requestWantLabel", () => {
  it("labels a service even after it's been switched off", () => {
    const services = DEFAULT_SERVICES.map((s) => ({ ...s, enabled: false }));
    expect(requestWantLabel("service:cleanout_2car", services)).toBe("2-Car Garage Clean Out");
    expect(requestWantLabel("overhead", services)).toBe("Overhead storage");
  });
});
