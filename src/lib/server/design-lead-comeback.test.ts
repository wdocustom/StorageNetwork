import { beforeEach, describe, expect, it, vi } from "vitest";


// ── A small in-memory Supabase: enough of the query builder for the giveaway ──
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[]> = {
  public_plan_purchases: ["stripe_session_id", "access_token"],
  refund_giveaway_winners: ["entry_ref"],
};
/** Partial unique indexes on refund_giveaway_winners (rows that aren't void). */
function winnerClash(rows: Row[], row: Row): boolean {
  if (row.status === "void") return false;
  const live = rows.filter((x) => x.status !== "void");
  return live.some(
    (x) =>
      (x.draw_date === row.draw_date && String(x.email).toLowerCase() === String(row.email).toLowerCase()) ||
      (row.stripe_session_id != null && x.stripe_session_id === row.stripe_session_id)
  );
}

function from(table: string) {
  tables[table] ??= [];
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = {
    kind: "select",
  };
  let wantRows = false;
  let order: { col: string; asc: boolean } | null = null;
  let limit = Infinity;

  const run = (): { data: Row[] | null; error: { code?: string; message: string } | null } => {
    const rows = tables[table];
    if (op.kind === "insert") {
      const made: Row[] = [];
      for (const r of op.rows) {
        const row: Row = { id: crypto.randomUUID(), ...r };
        if (table === "public_plan_purchases") row.access_token ??= crypto.randomUUID();
        if (table === "refund_giveaway_winners") {
          row.status ??= "drawn";
          row.created_at ??= new Date(Date.now() + rows.length).toISOString();
          if (winnerClash(rows, row)) return { data: null, error: { code: "23505", message: "dup" } };
        }
        for (const col of UNIQUE[table] ?? []) {
          if (row[col] != null && rows.some((x) => x[col] === row[col])) return { data: null, error: { code: "23505", message: "dup" } };
        }
        made.push(row);
      }
      rows.push(...made);
      return { data: made, error: null };
    }
    let hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op.kind === "update") {
      for (const r of hit) Object.assign(r, op.patch);
      return { data: wantRows ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    if (op.kind === "delete") {
      tables[table] = rows.filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    if (order) {
      const { col, asc } = order;
      hit = [...hit].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1));
    }
    return { data: hit.slice(0, limit).map((r) => ({ ...r })), error: null };
  };

  const api = {
    select: () => {
      wantRows = true;
      return api;
    },
    insert: (r: Row | Row[]) => {
      op = { kind: "insert", rows: Array.isArray(r) ? r : [r] };
      return api;
    },
    update: (patch: Row) => {
      op = { kind: "update", patch };
      return api;
    },
    delete: () => {
      op = { kind: "delete" };
      return api;
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), api),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
    lt: (k: string, v: string | number) => (filters.push((r) => r[k] != null && (r[k] as string | number) < v), api),
    gte: (k: string, v: string | number) => (filters.push((r) => r[k] != null && (r[k] as string | number) >= v), api),
    like: (k: string, pat: string) => (filters.push((r) => typeof r[k] === "string" && (r[k] as string).startsWith(pat.replace(/%$/, ""))), api),
    ilike: (k: string, v: string) => (filters.push((r) => String(r[k]).toLowerCase() === v.replace(/\\(.)/g, "$1").toLowerCase()), api),
    order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), api),
    limit: (n: number) => ((limit = n), api),
    single: async () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error: error ?? (data?.length ? null : { message: "no rows" }) };
    },
    maybeSingle: async () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error };
    },
    then: (resolve: (v: ReturnType<typeof run>) => void) => resolve(run()),
  };
  return api;
}


vi.mock("server-only", () => ({}));
vi.mock("@/lib/url-helper", () => ({ getAppUrl: () => "https://app.test" }));
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from }) }));
const jigEmails: { to: string; token: string }[] = [];
vi.mock("@/lib/emails/plansTemplates", () => ({
  sendLadderJigAccessEmail: async (to: string, token: string) => {
    jigEmails.push({ to, token });
    return { success: true };
  },
  sendTotePlanAccessEmail: async () => ({ success: true }),
}));

import { DESIGN_COMEBACK_CAMPAIGN, comebackRecipients, processDesignLeadComeback } from "./design-lead-comeback";
import { grantIncludedLadderJig } from "./plan-fulfilment";
import { designComebackEmailContent } from "@/lib/emails/designComebackTemplates";
import { comebackOfferFor, isRetentionOffer, offerIncludesLadderJig, totePlanOfferPrice, decodeTotePlanDesign } from "@/lib/tote-plans";

const NOW = Date.parse("2026-11-19T15:00:00Z");
const db = { from } as never;

function lead(email: string, design: string, offer: string | null, hoursAgo: number) {
  tables.plan_design_leads.push({ email, design, design_name: null, offer, created_at: new Date(NOW - hoursAgo * 3600_000).toISOString() });
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const t of ["plan_design_leads", "public_plan_purchases", "plan_buyer_campaigns"]) tables[t] = [];
  jigEmails.length = 0;
});

describe("come-back offer codes", () => {
  it("keeps the price they saved at and adds the jig", () => {
    expect(comebackOfferFor("save5")).toBe("save5jig");
    expect(comebackOfferFor("save3")).toBe("save3jig");
    expect(comebackOfferFor(null)).toBe("save3jig");
    expect(totePlanOfferPrice("save5jig")).toBe(1400);
    expect(totePlanOfferPrice("save3jig")).toBe(1600);
    expect(isRetentionOffer("save5jig")).toBe(true);
    expect(offerIncludesLadderJig("save3jig")).toBe(true);
    expect(offerIncludesLadderJig("save3")).toBe(false);
  });
});

describe("comebackRecipients", () => {
  it("emails each lead once with their newest design and best price, skipping buyers and fresh leads", async () => {
    lead("a@x.com", "H4x4wt", "save5", 120);
    lead("A@x.com", "H6x2wts", "save3", 50); // newer design, worse price: keep $14, use 6x2
    lead("b@x.com", "H5x4", "save3", 30);
    lead("bought@x.com", "H4x4", "save5", 90);
    tables.public_plan_purchases.push({ email: "Bought@x.com", plan_id: "tote-organizer" });
    lead("fresh@x.com", "H4x4", "save3", 2); // saved 2 hours ago: not yet
    lead("done@x.com", "H4x4", "save3", 90);
    tables.plan_buyer_campaigns.push({ email: "done@x.com", campaign: DESIGN_COMEBACK_CAMPAIGN });

    const r = await comebackRecipients(db, NOW);
    const by = Object.fromEntries(r.map((x) => [x.email, x]));
    expect(Object.keys(by).sort()).toEqual(["a@x.com", "b@x.com"]);
    expect(by["a@x.com"]).toMatchObject({ offer: "save5jig", email_data: { priceCents: 1400 } });
    expect(by["a@x.com"].email_data.link).toBe("https://app.test/plans/checkout?design=H6x2wts&utm_source=design_comeback&offer=save5jig");
    expect(by["b@x.com"]).toMatchObject({ offer: "save3jig", email_data: { priceCents: 1600 } });
  });

  it("sends once, and retries a failed send on the next run", async () => {
    lead("a@x.com", "H4x4wt", "save5", 48);
    lead("b@x.com", "H5x4", "save3", 48);
    const sent: string[] = [];
    let fail = "b@x.com";
    const send = async (to: string) => {
      if (to === fail) return { success: false, error: "bounced" };
      sent.push(to);
      return { success: true };
    };
    const first = await processDesignLeadComeback(db, send as never, NOW, 0);
    expect(first).toMatchObject({ eligible: 2, sent: 1 });
    expect(first.errors[0]).toMatch(/b@x.com/);

    fail = "";
    const second = await processDesignLeadComeback(db, send as never, NOW, 0);
    expect(second).toMatchObject({ eligible: 1, sent: 1 });
    const third = await processDesignLeadComeback(db, send as never, NOW, 0);
    expect(third.eligible).toBe(0);
    expect(sent).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("the email", () => {
  it("shows their price, the free jig and (during the promotion) the holiday refund note", () => {
    const design = decodeTotePlanDesign("H5x4")!;
    const during = designComebackEmailContent({ design, link: "https://app.test/x", priceCents: 1400 }, new Date("2026-11-19T18:00:00Z"));
    expect(during.subject).toBe("Your 5×4 Tote Organizer design: still $14, plus free jig plans");
    expect(during.html).toContain("Ladder Building Jig plans free ($9 value)");
    expect(during.html).toContain("No purchase necessary");
    expect(during.html).toContain("https://app.test/refund-rules");
    const after = designComebackEmailContent({ design, link: "https://app.test/x", priceCents: 1600 }, new Date("2027-02-05T18:00:00Z"));
    expect(after.html).not.toContain("Holiday surprise");
  });
});

describe("grantIncludedLadderJig", () => {
  it("adds the jig plans as included (not a sale), emails the link, and never twice", async () => {
    await grantIncludedLadderJig("a@x.com", "tote-token");
    await grantIncludedLadderJig("a@x.com", "tote-token");
    const jig = tables.public_plan_purchases.filter((r) => r.plan_id === "ladder-jig");
    expect(jig).toHaveLength(1);
    expect(jig[0]).toMatchObject({ email: "a@x.com", included_from: "tote-token", stripe_session_id: "included_jig_tote-token", email_sent: true });
    expect(jigEmails).toEqual([{ to: "a@x.com", token: jig[0].access_token }]);
  });

  it("skips buyers who already own the jig", async () => {
    tables.public_plan_purchases.push({ email: "a@x.com", plan_id: "ladder-jig", access_token: "owned", stripe_session_id: "cs_jig" });
    await grantIncludedLadderJig("a@x.com", "tote-token");
    expect(tables.public_plan_purchases).toHaveLength(1);
    expect(jigEmails).toHaveLength(0);
  });
});
