import { describe, it, expect, beforeAll } from "vitest";
import { signRequestToken, verifyRequestToken, requestQuoteUrl } from "./request-link";

const LEAD = "3f2b7c1e-8a4d-4c6b-9e1f-0a2b3c4d5e6f";
const OTHER = "9e1f0a2b-3c4d-4e6f-8a4d-3f2b7c1e4c6b";

beforeAll(() => {
  process.env.REQUEST_LINK_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
});

describe("request links", () => {
  it("round-trips a signed token", () => {
    expect(verifyRequestToken(signRequestToken(LEAD))).toBe(LEAD);
  });

  it("rejects a signature moved onto another job", () => {
    const sig = signRequestToken(LEAD).split(".")[1];
    expect(verifyRequestToken(`${OTHER}.${sig}`)).toBeNull();
  });

  it("rejects malformed or unsigned tokens", () => {
    expect(verifyRequestToken(LEAD)).toBeNull();
    expect(verifyRequestToken("not-a-uuid.abc")).toBeNull();
    expect(verifyRequestToken("")).toBeNull();
    expect(verifyRequestToken(`${LEAD}.short`)).toBeNull();
  });

  it("builds the page URL with its origin", () => {
    expect(requestQuoteUrl(LEAD, "receipt")).toBe(`https://example.com/request/${signRequestToken(LEAD)}?via=receipt`);
  });
});
