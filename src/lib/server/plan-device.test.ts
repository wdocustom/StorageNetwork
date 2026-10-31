import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ── Cookie jar + request headers ─────────────────────────────────────────
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
  }),
  headers: async () => new Headers({ "user-agent": "test-agent", "x-forwarded-for": "1.2.3.4" }),
}));

const sentCodes: { email: string; code: string }[] = [];
vi.mock("@/lib/emails/plansTemplates", () => ({
  sendPlanDeviceCodeEmail: vi.fn(async (email: string, code: string) => {
    sentCodes.push({ email, code });
    return { success: true };
  }),
}));

// ── In-memory tables ─────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let nextId = 1;

function table(name: string) {
  const rows = (tables[name] ??= []);
  let op: "select" | "update" | "insert" | "upsert" = "select";
  let patch: Row = {};
  let head = false;
  const filters: ((r: Row) => boolean)[] = [];
  let sort: { col: string; asc: boolean } | null = null;
  let cap = Infinity;

  const matches = () => {
    let out = rows.filter((r) => filters.every((f) => f(r)));
    if (sort) {
      const { col, asc } = sort;
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
    }
    return out.slice(0, cap);
  };
  const run = () => {
    if (op === "update") {
      matches().forEach((r) => Object.assign(r, patch));
      return { data: null, error: null };
    }
    const data = matches();
    return head ? { data: null, count: data.length, error: null } : { data, error: null };
  };

  const b: Record<string, unknown> = {
    select: (_c?: string, opts?: { head?: boolean }) => ((head = !!opts?.head), b),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
    gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
    in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
    order: (col: string, o?: { ascending?: boolean }) => ((sort = { col, asc: o?.ascending !== false }), b),
    limit: (n: number) => ((cap = n), b),
    update: (p: Row) => ((op = "update"), (patch = p), b),
    insert: (row: Row) => {
      rows.push({ id: `id${nextId++}`, created_at: new Date().toISOString(), attempts: 0, used_at: null, ...row });
      return Promise.resolve({ error: null });
    },
    upsert: (row: Row) => {
      const hit = rows.find((r) => r.email === row.email && r.device_hash === row.device_hash);
      if (hit) Object.assign(hit, row);
      else rows.push({ id: `id${nextId++}`, created_at: new Date().toISOString(), ...row });
      return Promise.resolve({ error: null });
    },
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve(run()),
  };
  return b;
}
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: table }) }));

import {
  MAX_DEVICES,
  PLAN_DEVICE_COOKIE,
  checkPlanDevice,
  isKnownPlanDevice,
  maskEmail,
  sendPlanDeviceCode,
  verifyPlanDeviceCode,
} from "./plan-device";

/** Switch to a different browser (fresh cookie jar). */
const newDevice = () => jar.clear();

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  jar.clear();
  sentCodes.length = 0;
  vi.useRealTimers();
});

describe("checkPlanDevice", () => {
  it("lets the first device in and remembers it", async () => {
    expect(await checkPlanDevice("Judy@Gmail.com")).toEqual({ ok: true });
    expect(jar.get(PLAN_DEVICE_COOKIE)).toBeTruthy();
    expect(tables.plan_buyer_devices).toHaveLength(1);
    expect(tables.plan_buyer_devices[0]).toMatchObject({ email: "judy@gmail.com", verified_by: "first", ip: "1.2.3.4" });
    // The cookie is stored only as a hash
    expect(tables.plan_buyer_devices[0].device_hash).not.toBe(jar.get(PLAN_DEVICE_COOKIE));
    expect(await checkPlanDevice("judy@gmail.com")).toEqual({ ok: true });
  });

  it("asks a second device for a code — a forwarded link alone isn't enough", async () => {
    await checkPlanDevice("judy@gmail.com");
    newDevice();
    expect(await checkPlanDevice("judy@gmail.com")).toEqual({ ok: false, emailHint: "ju•••@gmail.com" });
    expect(await isKnownPlanDevice("judy@gmail.com")).toBe(false);
  });

  it("trusts the device that just paid even when another is on record", async () => {
    await checkPlanDevice("judy@gmail.com");
    newDevice();
    expect(await checkPlanDevice("judy@gmail.com", { trusted: true })).toEqual({ ok: true });
    expect(await isKnownPlanDevice("judy@gmail.com")).toBe(true);
  });
});

describe("emailed code", () => {
  async function secondDevice() {
    await checkPlanDevice("judy@gmail.com");
    newDevice();
  }

  it("unlocks the new device with the right code", async () => {
    await secondDevice();
    const sent = await sendPlanDeviceCode("judy@gmail.com");
    expect(sent).toEqual({ ok: true, emailHint: "ju•••@gmail.com" });
    expect(sentCodes[0].code).toMatch(/^\d{6}$/);
    expect(await verifyPlanDeviceCode("judy@gmail.com", sentCodes[0].code)).toEqual({ ok: true });
    expect(await checkPlanDevice("judy@gmail.com")).toEqual({ ok: true });
    // Code is single-use
    expect((await verifyPlanDeviceCode("judy@gmail.com", sentCodes[0].code)).ok).toBe(false);
  });

  it("rejects a wrong code and locks after 5 tries", async () => {
    await secondDevice();
    await sendPlanDeviceCode("judy@gmail.com");
    const wrong = sentCodes[0].code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verifyPlanDeviceCode("judy@gmail.com", wrong)).ok).toBe(false);
    const res = await verifyPlanDeviceCode("judy@gmail.com", sentCodes[0].code);
    expect(res).toEqual({ ok: false, error: "Too many wrong tries. Send a new code." });
  });

  it("won't resend within a minute", async () => {
    await secondDevice();
    await sendPlanDeviceCode("judy@gmail.com");
    const again = await sendPlanDeviceCode("judy@gmail.com");
    expect(again.ok).toBe(false);
    expect(sentCodes).toHaveLength(1);
  });

  it("expires after 15 minutes", async () => {
    await secondDevice();
    await sendPlanDeviceCode("judy@gmail.com");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(await verifyPlanDeviceCode("judy@gmail.com", sentCodes[0].code)).toEqual({
      ok: false,
      error: "That code has expired. Send a new one.",
    });
  });

  it(`keeps at most ${MAX_DEVICES} devices — the least recently used is retired`, async () => {
    await checkPlanDevice("judy@gmail.com");
    const firstCookie = jar.get(PLAN_DEVICE_COOKIE)!;
    for (let i = 0; i < MAX_DEVICES; i++) {
      newDevice();
      // Bypass the resend wait between devices
      for (const c of tables.plan_access_codes ?? []) c.created_at = "2000-01-01T00:00:00.000Z";
      await sendPlanDeviceCode("judy@gmail.com");
      await new Promise((r) => setTimeout(r, 2)); // distinct last_seen_at
      expect(await verifyPlanDeviceCode("judy@gmail.com", sentCodes.at(-1)!.code)).toEqual({ ok: true });
    }
    const active = tables.plan_buyer_devices.filter((d) => !d.revoked_at);
    expect(tables.plan_buyer_devices).toHaveLength(MAX_DEVICES + 1);
    expect(active).toHaveLength(MAX_DEVICES);
    // The first device is the one retired
    jar.clear();
    jar.set(PLAN_DEVICE_COOKIE, firstCookie);
    expect((await checkPlanDevice("judy@gmail.com")).ok).toBe(false);
  });
});

describe("maskEmail", () => {
  it("shows just enough to recognize the address", () => {
    expect(maskEmail("robertelynch@bellsouth.net")).toBe("ro•••@bellsouth.net");
  });
});
