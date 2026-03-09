import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml('&<>"\''))
      .toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("returns plain strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes mixed content (simulated XSS payload)", () => {
    const payload = '<script>alert("xss")</script>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("escapes HTML attribute injection", () => {
    const input = '" onmouseover="alert(1)';
    expect(escapeHtml(input)).toBe("&quot; onmouseover=&quot;alert(1)");
  });
});
