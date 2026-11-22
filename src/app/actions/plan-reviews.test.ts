import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ── In-memory tables ─────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
function table(name: string) {
  const rows = (tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" = "select";
  let patch: Row = {};
  const matches = () => rows.filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    order: () => b,
    limit: () => b,
    update: (p: Row) => ((op = "update"), (patch = p), b),
    insert: async (row: Row) => {
      if (name === "plan_reviews" && rows.some((r) => r.email === row.email && r.product === row.product)) {
        return { error: { code: "23505", message: "duplicate" } };
      }
      rows.push({ id: `r${rows.length + 1}`, created_at: new Date().toISOString(), ...row });
      return { error: null };
    },
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (op === "update") {
        matches().forEach((r) => Object.assign(r, patch));
        return resolve({ data: null, error: null });
      }
      return resolve({ data: matches(), error: null });
    },
  };
  return b;
}
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: table }) }));

let deviceOk = true;
vi.mock("@/lib/server/plan-device", () => ({ isKnownPlanDevice: async () => deviceOk }));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: async () => undefined,
  RateLimitError: class extends Error {},
}));
const uploads: string[] = [];
vi.mock("@/lib/server/review-photos", () => ({
  photoFiles: (f: FormData) => f.getAll("photos"),
  uploadReviewPhotos: async (folder: string, files: unknown[]) => {
    uploads.push(folder);
    return { ok: true, urls: files.map((_, i) => `https://cdn/${folder}/${i}.jpg`) };
  },
}));
vi.mock("@/lib/server/plan-activity", () => ({ recordPlanActivity: async () => undefined }));
const heldEmails: unknown[] = [];
vi.mock("@/lib/emails/planReviewTemplates", () => ({
  sendPlanReviewHeldEmail: async (d: unknown) => (heldEmails.push(d), { success: true }),
}));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => null }));

import { getMyPlanReview, getPlanReviews, submitPlanReview } from "./plan-reviews";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const MINI_TOKEN = "11111111-2222-4333-8444-666666666666";
const INCLUDED_TOKEN = "11111111-2222-4333-8444-777777777777";

function form(fields: Record<string, string>, photos = 0): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  for (let i = 0; i < photos; i++) f.append("photos", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), `p${i}.jpg`);
  return f;
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  deviceOk = true;
  uploads.length = 0;
  heldEmails.length = 0;
  tables.public_plan_purchases = [
    {
      id: "p1",
      access_token: TOKEN,
      email: "judy@gmail.com",
      plan_id: "tote-organizer",
      customer_name: "Judy Smith",
      build_config: { units: [{ cols: 4, rows: 4, toteType: "HDX", hasWheels: true, hasTop: true }] },
      included_from: null,
    },
    {
      id: "p2",
      access_token: MINI_TOKEN,
      email: "judy@gmail.com",
      plan_id: "mini-tote-rack",
      customer_name: "Judy Smith",
      build_config: { units: [{ cols: 4, rows: 4, toteType: "MINI", hasWheels: false, hasTop: true }] },
      included_from: null,
    },
    {
      id: "p3",
      access_token: INCLUDED_TOKEN,
      email: "homeowner@gmail.com",
      plan_id: "tote-organizer",
      customer_name: "Home Owner",
      build_config: null,
      included_from: "lead-1",
    },
  ];
});

describe("submitPlanReview", () => {
  it("publishes a 5★ review from the verified buyer, with photos and build details", async () => {
    const res = await submitPlanReview(
      form(
        { token: TOKEN, rating: "5", headline: " Great plans ", comment: "Easy build", tags: '["easy_to_follow","bogus"]', skill_level: "first", build_hours: "4" },
        2,
      ),
    );
    expect(res).toEqual({ ok: true, held: false });
    expect(tables.plan_reviews[0]).toMatchObject({
      email: "judy@gmail.com",
      product: "tote",
      rating: 5,
      headline: "Great plans",
      tags: ["easy_to_follow"],
      skill_level: "first",
      build_hours: 4,
      build_summary: "4×4 rolling rack with a top",
      status: "published",
    });
    expect((tables.plan_reviews[0].photos as string[]).length).toBe(2);
    expect(heldEmails).toHaveLength(0);
    expect(await getMyPlanReview(TOKEN)).toMatchObject({ canReview: true, review: { rating: 5, status: "published" } });
  });

  it("holds 1–3★ reviews and emails the admin", async () => {
    const res = await submitPlanReview(form({ token: TOKEN, rating: "2", comment: "Cut list was off" }));
    expect(res).toEqual({ ok: true, held: true });
    expect(tables.plan_reviews[0].status).toBe("held");
    expect(heldEmails).toHaveLength(1);
    // Held reviews aren't public
    const pub = await getPlanReviews();
    expect(pub.summary.total).toBe(0);
    expect(pub.reviews).toHaveLength(0);
  });

  it("allows one review per product: 27-gal and Mini separately", async () => {
    expect((await submitPlanReview(form({ token: TOKEN, rating: "5" }))).ok).toBe(true);
    expect(await submitPlanReview(form({ token: TOKEN, rating: "4" }))).toMatchObject({ ok: false });
    expect(await submitPlanReview(form({ token: MINI_TOKEN, rating: "4" }))).toEqual({ ok: true, held: false });
    expect(tables.plan_reviews.map((r) => r.product)).toEqual(["tote", "mini"]);
  });

  it("refuses a device that isn't verified for the buyer (a forwarded link)", async () => {
    deviceOk = false;
    expect((await submitPlanReview(form({ token: TOKEN, rating: "5" }))).ok).toBe(false);
    expect(await getMyPlanReview(TOKEN)).toEqual({ canReview: false });
    expect(tables.plan_reviews ?? []).toHaveLength(0);
    expect(uploads).toHaveLength(0);
  });

  it("refuses plans included with an installer job, unknown tokens and bad ratings", async () => {
    expect((await submitPlanReview(form({ token: INCLUDED_TOKEN, rating: "5" }))).ok).toBe(false);
    expect((await submitPlanReview(form({ token: "not-a-token", rating: "5" }))).ok).toBe(false);
    expect((await submitPlanReview(form({ token: TOKEN, rating: "6" }))).ok).toBe(false);
    expect((await submitPlanReview(form({ token: TOKEN, rating: "4.5" }))).ok).toBe(false);
    expect(tables.plan_reviews ?? []).toHaveLength(0);
  });
});

describe("getPlanReviews", () => {
  it("shows published reviews with a public name and build line", async () => {
    await submitPlanReview(form({ token: TOKEN, rating: "5", comment: "Love it", skill_level: "first", build_hours: "6" }));
    await submitPlanReview(form({ token: MINI_TOKEN, rating: "4" }));
    const all = await getPlanReviews();
    expect(all.summary).toMatchObject({ total: 2, average: 4.5 });
    expect(all.reviews[0]).toMatchObject({ name: "Judy S.", meta: "Built a 4×4 rolling rack with a top · First build · 6 hrs" });
    expect((await getPlanReviews({ product: "mini" })).summary.total).toBe(1);
  });
});
