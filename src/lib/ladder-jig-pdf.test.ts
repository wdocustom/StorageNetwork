import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ladderJigContent } from "./ladder-jig-content";
import { generateLadderJigPDF } from "./ladder-jig-pdf";

const content = ladderJigContent();
const raw = (licensedTo?: string, edition?: "diy" | "installer") =>
  generateLadderJigPDF({ content, licensedTo, edition, links: { libraryUrl: "https://x.test/plans/library?token=t" } }).output();

describe("ladder jig PDF", () => {
  it("renders the whole workbook, two build steps to a page where they fit", () => {
    const doc = generateLadderJigPDF({ content });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(10);
    expect(pages).toBeLessThanOrEqual(13);
  });

  it("carries the plan's numbers: size, rail gap and all six rail marks", () => {
    const pdf = raw();
    expect(pdf).toContain("LADDER BUILDING JIG");
    for (const t of ['96"', '37"', '30"', '13"', '29"', '45"', '61"', '77"', '93"']) expect(pdf).toContain(t);
    for (const s of [...content.buildSteps, ...content.useSteps]) expect(pdf).toContain(s.title);
  });

  it("stamps the buyer's license on the pages and links My Builds", () => {
    const pdf = raw("Licensed to jo@example.com · Order SN-ABCD1234");
    expect(pdf.split("Licensed to jo@example.com").length - 1).toBeGreaterThan(5);
    expect(pdf).toContain("https://x.test/plans/library?token=t");
  });

  it("names the installer edition on the cover", () => {
    expect(raw(undefined, "installer")).toContain("INSTALLER EDITION");
    expect(raw()).toContain("FOR YOUR TOTE RACKS");
  });

  it("gives every step a drawing, and the guide pro tips", () => {
    for (const s of [...content.buildSteps, ...content.useSteps]) {
      expect(s.diagram).toBeTruthy();
      expect(s.tip).toBeTruthy();
    }
  });
});
