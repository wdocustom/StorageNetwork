import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getServiceClient without env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws a clear error instead of recursing forever", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getServiceClient } = await import("./supabase-server");
    const client = getServiceClient();
    expect(() => client.from("profiles")).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("is not treated as a promise", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getServiceClient } = await import("./supabase-server");
    expect((getServiceClient() as unknown as { then?: unknown }).then).toBeUndefined();
  });

  it("resolves to a real client once env is set at runtime", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getServiceClient } = await import("./supabase-server");
    const client = getServiceClient();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect(typeof client.from).toBe("function");
  });
});
