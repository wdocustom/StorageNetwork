import { describe, expect, it } from "vitest";
import { applyMergeTags, outreachTextToHtml, unknownMergeTags } from "./installer-outreach";

const mario = { first_name: "Mario", last_name: "Flores", business_name: "No Limit Consulting", city: "Omaha", state: "NE" };
const blank = { first_name: null, last_name: null, business_name: "  ", city: null, state: null };

describe("applyMergeTags", () => {
  it("fills known tags, tolerating spaces and case", () => {
    expect(applyMergeTags("Hi {{first_name}} at {{ Business_Name }} in {{city}}", mario)).toBe(
      "Hi Mario at No Limit Consulting in Omaha"
    );
  });

  it("uses default and inline fallbacks for missing values", () => {
    expect(applyMergeTags("Hi {{first_name}}, {{business_name}}", blank)).toBe("Hi there, your business");
    expect(applyMergeTags("Hi {{first_name|friend}}", blank)).toBe("Hi friend");
    expect(applyMergeTags("Hi {{first_name|friend}}", mario)).toBe("Hi Mario");
  });

  it("leaves unknown tags visible", () => {
    expect(applyMergeTags("Hey {{nickname}}", mario)).toBe("Hey {{nickname}}");
    expect(unknownMergeTags("Hey {{nickname}} {{first_name}}")).toEqual(["nickname"]);
  });
});

describe("outreachTextToHtml", () => {
  it("escapes HTML, splits paragraphs and links URLs", () => {
    const html = outreachTextToHtml("Hi <b>you</b>\nline two\n\nSee https://storage-network.app/dashboard.");
    expect(html).toContain("Hi &lt;b&gt;you&lt;/b&gt;<br>line two");
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).toContain('<a href="https://storage-network.app/dashboard"');
  });
});
