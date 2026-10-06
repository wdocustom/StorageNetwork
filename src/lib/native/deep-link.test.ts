import { describe, it, expect } from "vitest";
import { resolveDeepLink, isSafeRelativePath, notificationTargetPath } from "./deep-link";

describe("resolveDeepLink", () => {
  it("maps the custom-scheme auth callback onto the web callback route", () => {
    expect(resolveDeepLink("storagenetwork://auth/callback?code=abc&type=recovery")).toBe(
      "/auth/callback?code=abc&type=recovery"
    );
  });
  it("maps custom-scheme dashboard links", () => {
    expect(resolveDeepLink("storagenetwork://dashboard/leads/123")).toBe("/dashboard/leads/123");
  });
  it("accepts universal links on the production origin", () => {
    expect(resolveDeepLink("https://storage-network.app/payment/success?x=1")).toBe(
      "/payment/success?x=1"
    );
    expect(resolveDeepLink("https://storage-network.app/dashboard")).toBe("/dashboard");
  });
  it("rejects foreign origins and non-allowlisted paths", () => {
    expect(resolveDeepLink("https://evil.com/dashboard")).toBeNull();
    expect(resolveDeepLink("https://storage-network.app/design")).toBeNull();
    expect(resolveDeepLink("storagenetwork://admin")).toBeNull();
    expect(resolveDeepLink("not a url")).toBeNull();
  });
});

describe("isSafeRelativePath", () => {
  it("only allows same-origin relative paths", () => {
    expect(isSafeRelativePath("/dashboard")).toBe(true);
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath(null)).toBe(false);
  });
});

describe("notificationTargetPath", () => {
  it("opens the lead when a leadId is present", () => {
    expect(notificationTargetPath({ leadId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" })).toBe(
      "/dashboard/leads/3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    );
  });
  it("falls back to the dashboard for missing or malformed ids", () => {
    expect(notificationTargetPath(undefined)).toBe("/dashboard");
    expect(notificationTargetPath({ leadId: "../../x" })).toBe("/dashboard");
  });
});
