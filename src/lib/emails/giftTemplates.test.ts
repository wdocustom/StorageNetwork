import { describe, expect, it, vi } from "vitest";

const sent: Record<string, unknown>[] = [];
vi.mock("./core", () => ({
  sendTransactionalEmail: async (p: Record<string, unknown>) => {
    sent.push(p);
    return { success: true };
  },
}));

import { giftReceiptEmailContent, giftRecipientEmailContent, sendGiftRecipientEmail } from "./giftTemplates";

const TOKEN = "11111111-1111-4111-8111-111111111111";

describe("gift recipient email", () => {
  it("escapes everything the gifter typed", () => {
    const { html, subject } = giftRecipientEmailContent({
      to: "jo@example.com",
      recipientName: "Jo <b>",
      gifterName: "Sky & Co",
      gifterEmail: "sky@example.com",
      message: `<script>alert("x")</script>\nLine two`,
      accessToken: TOKEN,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Line two");
    expect(html).toContain("Sky &amp; Co");
    expect(subject).toBe("Sky sent you DIY tote rack plans");
    expect(html).toContain(`/plans/gift/open?token=${TOKEN}`);
  });

  it("goes to one person, from the gifter's name, with replies to the gifter", async () => {
    await sendGiftRecipientEmail({
      to: "jo@example.com",
      recipientName: "Jo",
      gifterName: "Sky, Jr.",
      gifterEmail: "sky@example.com",
      message: null,
      accessToken: TOKEN,
    });
    expect(sent.at(-1)).toMatchObject({
      to: "jo@example.com",
      replyTo: "sky@example.com",
      senderName: "Sky via Storage Network",
    });
  });
});

describe("gifter receipt", () => {
  it("lists every recipient with delivery, the follow-up note and final-sale terms", () => {
    const { html, subject } = giftReceiptEmailContent({
      to: "sky@example.com",
      gifterName: "Sky",
      orderId: "abcdef12-0000-4000-8000-000000000000",
      manageToken: TOKEN,
      amountCents: 3800,
      recipients: [
        { name: "Jo", email: "jo@example.com", sent: true },
        { name: "Sam", email: "sam@example.com", sent: false },
      ],
    });
    expect(subject).toBe("Your DIY plan gifts are on the way (GIFT-ABCDEF12)");
    expect(html).toContain("jo@example.com");
    expect(html).toContain("Not delivered yet");
    expect(html).toContain("heads-up");
    expect(html).toContain("all sales are final");
    expect(html).toContain(`/plans/gift/sent?order=${TOKEN}`);
    expect(html).toContain("$38");
  });
});
