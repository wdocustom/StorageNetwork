import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const recorded: { owner: unknown; event: string; payload: Record<string, unknown> }[] = [];
const TOKEN = "11111111-1111-4111-8111-111111111111";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: async () => {},
  RateLimitError: class extends Error {},
}));
vi.mock("@/lib/server/plan-activity", () => ({
  activityOwnerByToken: async (t: unknown) => (t === TOKEN ? { access_token: TOKEN, email: "jo@example.com", plan_id: "tote-organizer" } : null),
  recordPlanActivity: async (owner: unknown, event: string, payload: Record<string, unknown>) => {
    recorded.push({ owner, event, payload });
  },
}));

import { POST } from "./route";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const post = (body: unknown, ua = UA) =>
  POST(
    new NextRequest("http://localhost/api/analytics/plan-activity", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "user-agent": ua },
    })
  );

beforeEach(() => {
  recorded.length = 0;
});

describe("POST /api/analytics/plan-activity", () => {
  it("records a browser event for a real purchase", async () => {
    const res = await post({ token: TOKEN, event: "guide_step", detail: "Module A", value: 5, total: 12, sessionId: "s1" });
    expect(res.status).toBe(200);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      event: "guide_step",
      payload: { detail: "Module A", value: 5, total: 12, sessionId: "s1" },
    });
  });

  it("refuses server-only events (an 'open' can't be faked from the browser)", async () => {
    expect((await post({ token: TOKEN, event: "open" })).status).toBe(400);
    expect((await post({ token: TOKEN, event: "code_verified" })).status).toBe(400);
    expect(recorded).toHaveLength(0);
  });

  it("refuses unknown tokens and drops bots and automated browsers", async () => {
    expect((await post({ token: "22222222-2222-4222-8222-222222222222", event: "guide_open" })).status).toBe(404);
    await post({ token: TOKEN, event: "guide_open", automated: true });
    await post({ token: TOKEN, event: "guide_open" }, "Googlebot/2.1 (+http://www.google.com/bot.html)");
    expect(recorded).toHaveLength(0);
  });

  it("rejects garbage", async () => {
    const res = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});
