import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));

type Row = Record<string, unknown>;
let subs: Row[];
let deleted: unknown[];

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      let op = "select";
      const filters: Array<[string, unknown]> = [];
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "push_subscriptions" && op === "select") return { data: subs };
        if (table === "profiles") return { data: { id: "installer-1" } };
        return { data: null };
      };
      Object.assign(chain, {
        select: () => chain,
        update: () => ((op = "update"), chain),
        delete: () => ((op = "delete"), chain),
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          if (op === "delete") deleted.push(v);
          return chain;
        },
        limit: () => chain,
        maybeSingle: async () => result(),
        then: (resolve: (r: unknown) => unknown) => resolve(result()),
      });
      return chain;
    },
  }),
}));

const msg = { title: "New booking", body: "Deposit paid", url: "/dashboard/leads/l1" };

async function load(withKeys: boolean) {
  vi.resetModules();
  if (withKeys) {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
  } else {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
  return import("./push");
}

describe("pushToUser", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    subs = [
      { id: "s1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
      { id: "s2", endpoint: "https://push.example/2", p256dh: "k2", auth: "a2" },
    ];
    deleted = [];
  });

  it("sends the message to every device the installer subscribed", async () => {
    const { pushToUser } = await load(true);
    sendNotification.mockResolvedValue({});
    await pushToUser("installer-1", msg);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [target, payload] = sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: "https://push.example/1", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(payload as string)).toEqual(msg);
  });

  it("forgets a subscription the browser dropped (410) and keeps the rest", async () => {
    const { pushToUser } = await load(true);
    sendNotification.mockImplementation(async (t: { endpoint: string }) => {
      if (t.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return {};
    });
    await pushToUser("installer-1", msg);
    expect(deleted).toContain("s1");
    expect(deleted).not.toContain("s2");
  });

  it("is a quiet no-op without VAPID keys", async () => {
    const { pushToUser, pushToEmail } = await load(false);
    await pushToUser("installer-1", msg);
    await pushToEmail("inst@example.com", msg);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("finds the installer by email for the alert emails", async () => {
    const { pushToEmail } = await load(true);
    sendNotification.mockResolvedValue({});
    await pushToEmail("Inst@Example.com", msg);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});
