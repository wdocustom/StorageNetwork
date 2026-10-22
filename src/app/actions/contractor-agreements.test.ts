/**
 * Contractor agreement signing — the audit trail (signer IP + user agent)
 * must be captured. In Next 15 headers() returns a Promise; reading it
 * without await silently dropped both fields.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

type Row = Record<string, unknown>;
let updates: Row[];

// Next 15 semantics: headers() is async.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "TestBrowser/1.0",
    })
  ),
}));
vi.mock("@/lib/url-helper", () => ({ getAppUrl: () => "https://storage-network.app" }));
vi.mock("@/lib/emails/contractorAgreementTemplates", () => ({
  sendContractorAgreementInvite: vi.fn(async () => ({ success: true })),
  sendContractorAgreementSignedReceipt: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => {
      let op = "select";
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is"]) chain[m] = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn((p: Row) => {
        op = "update";
        updates.push(p);
        return chain;
      });
      chain.maybeSingle = vi.fn(async () =>
        op === "update"
          ? { data: { id: "agr-1" }, error: null }
          : {
              data: {
                id: "agr-1",
                status: "sent",
                contractor_name_snapshot: "Jane Q Installer",
                contractor_email_snapshot: "jane@example.com",
                title: "Independent Contractor Agreement",
                contractor_signed_at: null,
              },
              error: null,
            }
      );
      return chain;
    },
  }),
}));

const TOKEN = "3f2b7c1e-8a4d-4c6b-9e1f-0a2b3c4d5e6f";

describe("acceptContractorAgreement", () => {
  beforeEach(() => {
    updates = [];
  });

  it("records the signer's IP and user agent", async () => {
    const { acceptContractorAgreement } = await import("./contractor-agreements");
    const res = await acceptContractorAgreement({ token: TOKEN, typedSignature: "jane  q installer" });

    expect(res).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: "signed",
      contractor_typed_signature: "jane  q installer",
      contractor_signed_ip: "203.0.113.7",
      contractor_signed_user_agent: "TestBrowser/1.0",
    });
  });
});
