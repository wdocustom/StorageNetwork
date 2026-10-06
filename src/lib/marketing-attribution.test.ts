import { describe, it, expect } from "vitest";
import { isWithinAttributionWindow, resolveMarketingAttribution } from "./marketing-attribution";
import type { SupabaseClient } from "@supabase/supabase-js";

const SEND = "11111111-1111-4111-8111-111111111111";
const INSTALLER = "22222222-2222-4222-8222-222222222222";

function fakeDb(row: unknown): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: row });
  return { from: () => chain } as unknown as SupabaseClient;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("isWithinAttributionWindow", () => {
  it("accepts a send inside the window and rejects one outside", () => {
    expect(isWithinAttributionWindow(daysAgo(10), 60)).toBe(true);
    expect(isWithinAttributionWindow(daysAgo(61), 60)).toBe(false);
  });
  it("rejects an unparseable date", () => {
    expect(isWithinAttributionWindow("nope", 60)).toBe(false);
  });
});

describe("resolveMarketingAttribution", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: SEND,
    installer_id: INSTALLER,
    sent_at: daysAgo(5),
    marketing_campaigns: { attribution_days: 60 },
    ...over,
  });

  it("attributes a valid token for the matching installer", async () => {
    expect(await resolveMarketingAttribution(fakeDb(row()), SEND, INSTALLER)).toEqual({ sendId: SEND });
  });

  it("does not attribute when the token was issued for a different installer", async () => {
    const other = "33333333-3333-4333-8333-333333333333";
    expect(await resolveMarketingAttribution(fakeDb(row()), SEND, other)).toBeNull();
  });

  it("does not attribute an expired send", async () => {
    expect(await resolveMarketingAttribution(fakeDb(row({ sent_at: daysAgo(90) })), SEND, INSTALLER)).toBeNull();
  });

  it("ignores a malformed or missing token without touching the db", async () => {
    expect(await resolveMarketingAttribution(fakeDb(row()), "not-a-uuid", INSTALLER)).toBeNull();
    expect(await resolveMarketingAttribution(fakeDb(row()), undefined, INSTALLER)).toBeNull();
    expect(await resolveMarketingAttribution(fakeDb(null), SEND, INSTALLER)).toBeNull();
  });
});
