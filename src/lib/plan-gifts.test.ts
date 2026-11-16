import { describe, expect, it } from "vitest";
import {
  GIFT_MAX_RECIPIENTS,
  GIFT_MESSAGE_MAX,
  cleanGiftMessage,
  cleanPersonName,
  giftDealName,
  giftEachCents,
  giftListCents,
  giftSavingsCents,
  giftTotalCents,
  nextGiftDeal,
  parseGiftOrder,
  recipientListLabel,
  suggestEmailFix,
} from "./plan-gifts";

const base = {
  gifterName: "Skyler Camacho",
  gifterEmail: "Skyler@Example.com ",
  message: "",
  acknowledged: true,
  recipients: [{ name: "Jo Builder", email: "JO@example.com" }],
};

describe("parseGiftOrder", () => {
  it("accepts a valid order and normalizes emails", () => {
    const res = parseGiftOrder(base);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order).toEqual({
      gifterName: "Skyler Camacho",
      gifterEmail: "skyler@example.com",
      message: null,
      recipients: [{ name: "Jo Builder", email: "jo@example.com" }],
    });
  });

  it("requires the final-sale acknowledgement", () => {
    const res = parseGiftOrder({ ...base, acknowledged: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fields.acknowledged).toBeTruthy();
  });

  it("flags each bad recipient field by position", () => {
    const res = parseGiftOrder({
      ...base,
      recipients: [
        { name: "", email: "a@example.com" },
        { name: "B", email: "not-an-email" },
        { name: "C", email: "" },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.fields).sort()).toEqual(["recipients.0.name", "recipients.1.email", "recipients.2.email"]);
  });

  it("rejects the same email twice (case-insensitive)", () => {
    const res = parseGiftOrder({
      ...base,
      recipients: [
        { name: "A", email: "same@example.com" },
        { name: "B", email: " SAME@example.com" },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fields["recipients.1.email"]).toMatch(/person 1/);
  });

  it("caps the order at the maximum and needs at least one person", () => {
    const many = Array.from({ length: GIFT_MAX_RECIPIENTS + 1 }, (_, i) => ({ name: `P${i}`, email: `p${i}@example.com` }));
    const tooMany = parseGiftOrder({ ...base, recipients: many });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.fields.recipients).toMatch(/Up to/);
    const none = parseGiftOrder({ ...base, recipients: [] });
    expect(none.ok).toBe(false);
  });

  it("rejects a note over the limit and garbage input", () => {
    const long = parseGiftOrder({ ...base, message: "x".repeat(GIFT_MESSAGE_MAX + 1) });
    expect(long.ok).toBe(false);
    expect(parseGiftOrder(null).ok).toBe(false);
    expect(parseGiftOrder({ recipients: "nope" }).ok).toBe(false);
  });

  it("needs the gifter's name and a valid email", () => {
    const res = parseGiftOrder({ ...base, gifterName: "  ", gifterEmail: "x@y" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.fields).sort()).toEqual(["gifterEmail", "gifterName"]);
  });
});

describe("cleaning", () => {
  it("strips header-unsafe characters from names", () => {
    expect(cleanPersonName('  Jo   "The Builder" <jo@evil.com>\n ')).toBe("Jo The Builder joevil.com");
    expect(cleanPersonName("Jo\nSmith")).toBe("Jo Smith");
    expect(cleanPersonName(42)).toBe("");
  });

  it("keeps line breaks in notes but drops control characters", () => {
    expect(cleanGiftMessage("Hi!\r\n\r\n\r\n\r\nEnjoy\u0007")).toBe("Hi!\n\nEnjoy");
  });
});

describe("helpers", () => {
  it("prices 1–2 gifts at the regular price, then volume pricing", () => {
    const totals = Array.from({ length: 10 }, (_, i) => giftTotalCents(i + 1));
    expect(totals).toEqual([1900, 3800, 4500, 5800, 6900, 7800, 8500, 8800, 9900, 11000]);
  });

  it("never charges more for fewer gifts, or more per gift for more gifts", () => {
    for (let q = 2; q <= GIFT_MAX_RECIPIENTS; q++) {
      expect(giftTotalCents(q), `total at ${q}`).toBeGreaterThan(giftTotalCents(q - 1));
      expect(giftEachCents(q), `each at ${q}`).toBeLessThanOrEqual(giftEachCents(q - 1));
    }
  });

  it("shows the regular price struck through and the savings", () => {
    expect(giftListCents(5)).toBe(9500);
    expect(giftSavingsCents(5)).toBe(2600);
    expect(giftSavingsCents(2)).toBe(0);
    expect(giftEachCents(7)).toBe(1214);
  });

  it("names the deal", () => {
    expect(giftDealName(2)).toBeNull();
    expect(giftDealName(3)).toBe("Bundle of 3");
    expect(giftDealName(8)).toBe("8+ gifts · $11 each");
    expect(giftDealName(10)).toBe("8+ gifts · $11 each");
  });

  it("points to the next price break", () => {
    expect(nextGiftDeal(1)).toMatchObject({ quantity: 3, add: 2, total: 4500 });
    expect(nextGiftDeal(3)).toMatchObject({ quantity: 5, add: 2, total: 6900 });
    expect(nextGiftDeal(6)).toMatchObject({ quantity: 7, add: 1, total: 8500 });
    expect(nextGiftDeal(7)).toMatchObject({ quantity: 8, add: 1, total: 8800, eachCents: 1100 });
    expect(nextGiftDeal(8)).toBeNull();
    expect(nextGiftDeal(10)).toBeNull();
  });

  it("suggests fixes for common domain typos only", () => {
    expect(suggestEmailFix("jo@gmial.com")).toBe("jo@gmail.com");
    expect(suggestEmailFix("jo@gmail.com")).toBeNull();
    expect(suggestEmailFix("nope")).toBeNull();
  });

  it("labels recipient lists", () => {
    expect(recipientListLabel(["Jo Builder"])).toBe("Jo");
    expect(recipientListLabel(["Jo B", "Sam C"])).toBe("Jo and Sam");
    expect(recipientListLabel(["A", "B", "C", "D", "E"])).toBe("A, B and 3 others");
  });
});
