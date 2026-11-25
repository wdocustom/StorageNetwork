import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { INSTALLER_TOUR_STEPS } from "./tourSteps";

// Every tour step points at a real element through a data-tour attribute at
// its call site. If one gets renamed or deleted, the tour would sit waiting
// on a step whose target never appears, so fail here instead.

const SRC = path.resolve(__dirname, "../../..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const allSource = sourceFiles(SRC)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** Literal tags, CollapsibleSection tourIds, and `tour: "..."` entries rendered as data-tour={tour}. */
function declaredTargets(): Set<string> {
  const found = new Set<string>();
  for (const m of allSource.matchAll(/data-tour="([a-z0-9-]+)"/g)) found.add(m[1]);
  for (const m of allSource.matchAll(/tourId="([a-z0-9-]+)"/g)) found.add(m[1]);
  for (const m of allSource.matchAll(/\btour: "([a-z0-9-]+)"/g)) found.add(m[1]);
  // Settings tabs: data-tour={`settings-tab-${tab}`}
  if (allSource.includes("data-tour={`settings-tab-${tab}`}")) {
    for (const tab of ["business", "pricing", "portfolio", "account"]) found.add(`settings-tab-${tab}`);
  }
  return found;
}

describe("installer dashboard tour", () => {
  const targets = declaredTargets();

  it.each(INSTALLER_TOUR_STEPS.filter((s) => s.target).map((s) => [s.id, s.target!]))(
    "step %s points at a data-tour target that exists (%s)",
    (_id, target) => {
      expect(targets.has(target)).toBe(true);
    },
  );

  it("has unique step ids", () => {
    const ids = INSTALLER_TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts on Today with a centred welcome and ends with a Finish step", () => {
    expect(INSTALLER_TOUR_STEPS[0]).toMatchObject({ target: null, route: "/dashboard" });
    expect(INSTALLER_TOUR_STEPS.at(-1)?.last).toBe(true);
    expect(INSTALLER_TOUR_STEPS.filter((s) => s.last)).toHaveLength(1);
  });

  it("only asks for a tap where there is a real element to tap", () => {
    for (const s of INSTALLER_TOUR_STEPS) {
      if (s.advance === "tap") expect(s.target).toBeTruthy();
    }
  });
});
