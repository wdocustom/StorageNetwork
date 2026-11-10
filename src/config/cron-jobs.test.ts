import { readdirSync, readFileSync } from "fs";
import path from "path";
import { CRON_JOBS, jobsForSchedule } from "./cron-jobs";

const root = path.resolve(__dirname, "../..");

function readJsonc(file: string): any {
  const raw = readFileSync(path.join(root, file), "utf-8");
  // strip // comments that aren't inside strings (none of our strings contain //)
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*\/\/.*$/gm, ","));
}

describe("cron jobs", () => {
  it("wrangler.jsonc has exactly one trigger per distinct schedule", () => {
    const crons: string[] = readJsonc("wrangler.jsonc").triggers.crons;
    const expected = [...new Set(CRON_JOBS.map((j) => j.schedule))];
    expect([...crons].sort()).toEqual([...expected].sort());
  });

  it("every trigger runs at least one job", () => {
    const crons: string[] = readJsonc("wrangler.jsonc").triggers.crons;
    for (const c of crons) expect(jobsForSchedule(c).length).toBeGreaterThan(0);
  });

  it("vercel.json matches while Vercel is still deployed", () => {
    const v = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf-8"));
    expect(v.crons).toEqual(CRON_JOBS);
  });

  it("every job path has a route", () => {
    for (const j of CRON_JOBS) {
      const route = path.join(root, "src/app", j.path, "route.ts");
      expect(() => readFileSync(route)).not.toThrow();
    }
  });

  it("every cron route refuses requests when CRON_SECRET is unset", () => {
    // Fail closed: `if (cronSecret && …)` skipped the check entirely when the
    // secret was missing, leaving customer-email jobs publicly triggerable.
    const dir = path.join(root, "src/app/api/cron");
    for (const name of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, name, "route.ts"), "utf-8");
      expect(src, name).toContain("process.env.CRON_SECRET");
      expect(src, name).not.toMatch(/cronSecret\s*&&/);
    }
  });
});
