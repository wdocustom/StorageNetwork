import { describe, expect, it, vi } from "vitest";

process.env.REQUEST_LINK_SECRET = "test-secret";

let lead: Record<string, unknown> | null;
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: lead ? { ...lead, time_preference: "morning" } : null }),
      });
      return chain;
    },
  }),
}));
vi.mock("@/lib/server/install-tracking", () => ({
  installerInfo: async () => ({ name: "Rack City Totes", phone: null, replyTo: undefined }),
}));

const LEAD = "11111111-2222-3333-4444-555555555555";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";

async function get(path: string, ua = iphone) {
  const { GET } = await import("./route");
  const token = path.split("/").pop()!;
  return GET(new Request(`https://storage-network.app/api/calendar/${path}`, { headers: { "user-agent": ua } }), {
    params: Promise.resolve({ token }),
  });
}

describe("GET /api/calendar/[token]", () => {
  const setLead = (email: string) =>
    (lead = {
      id: LEAD,
      installer_id: "inst",
      deposit_paid: true,
      scheduled_at: "2026-11-13T00:00:00+00:00",
      customer_email: email,
      delivery_address_line1: "12 Oak St",
      delivery_address_city: "Columbus",
      delivery_address_state: "OH",
    });

  it("sends a Gmail customer to Google Calendar", async () => {
    setLead("judy@gmail.com");
    const { signTrackToken } = await import("@/lib/server/request-link");
    const res = await get(signTrackToken(LEAD));
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("location")!);
    expect(to.host).toBe("calendar.google.com");
    expect(to.searchParams.get("dates")).toBe("20261113T140000Z/20261113T170000Z");
  });

  it("sends an iPhone customer to the .ics file, which serves the event", async () => {
    setLead("judy@company.com");
    const { signTrackToken } = await import("@/lib/server/request-link");
    const token = signTrackToken(LEAD);
    const res = await get(token);
    expect(res.headers.get("location")).toBe(`https://storage-network.app/api/calendar/${token}.ics`);

    const file = await get(`${token}.ics`);
    expect(file.headers.get("content-type")).toContain("text/calendar");
    expect(await file.text()).toContain("DTSTART:20261113T140000Z");
  });

  it("404s a bad token", async () => {
    setLead("judy@gmail.com");
    expect((await get(`${LEAD}.forged`)).status).toBe(404);
  });
});
