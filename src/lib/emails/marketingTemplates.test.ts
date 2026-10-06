import { describe, it, expect } from "vitest";
import { buildRepeatOrderEmail, repeatOrderUrls } from "./marketingTemplates";

const input = {
  customerName: "Pat Smith",
  installerName: "Acme <Racks>",
  installerId: "22222222-2222-4222-8222-222222222222",
  sendId: "11111111-1111-4111-8111-111111111111",
};

describe("repeat-order email", () => {
  it("links to the installer's booking page with the attribution token", () => {
    const { bookUrl } = repeatOrderUrls(input);
    expect(bookUrl).toContain(`/book/${input.installerId}?mc=${input.sendId}`);
    expect(buildRepeatOrderEmail(input).html).toContain(bookUrl);
  });

  it("has a promotions-only unsubscribe link that says orders are unaffected", () => {
    const { html } = buildRepeatOrderEmail(input);
    expect(html).toContain(`/api/unsubscribe-marketing?token=${input.sendId}`);
    expect(html).toContain("not affected");
    expect(html).toContain("1100 Williams Way");
  });

  it("escapes the installer name", () => {
    expect(buildRepeatOrderEmail(input).html).not.toContain("Acme <Racks>");
  });

  it("has a holiday, promotional tone and names the installer in the subject", () => {
    const { subject, html } = buildRepeatOrderEmail(input);
    expect(subject).toContain("holidays");
    expect(subject).toContain("Acme <Racks>"); // subject is plain text, not HTML
    expect(html).toContain("Get Organized for the Holidays");
  });

  it("renders the button with black text, set several ways, on a yellow cell", () => {
    const { html } = buildRepeatOrderEmail(input);
    const btn = html.slice(html.indexOf('bgcolor="#facc15"'));
    expect(btn).toContain("background-color:#facc15");
    expect(btn).toContain("color:#000000;-webkit-text-fill-color:#000000");
    expect(btn).not.toMatch(/color:#ffffff[^<]*<span[^>]*>Get Organized/);
  });
});
