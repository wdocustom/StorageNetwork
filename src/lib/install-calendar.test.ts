import { describe, expect, it } from "vitest";
import { addToCalendarHtml, googleCalendarUrl, installEvent, installIcs, outlookCalendarUrl } from "./install-calendar";

const base = {
  leadId: "11111111-2222-3333-4444-555555555555",
  date: "2026-11-13T00:00:00+00:00",
  installerName: "Rack City Totes",
  address: "12 Oak St, Columbus, OH",
  trackUrl: "https://storage-network.app/track/abc",
};
const now = new Date("2026-10-30T15:00:00Z");

describe("installEvent", () => {
  it("is an all-day event on the stored calendar date", () => {
    const e = installEvent(base)!;
    expect(e.start).toBe("20261113");
    expect(e.end).toBe("20261114");
    expect(e.title).toBe("Storage rack install — Rack City Totes");
    expect(e.uid).toBe(`install-${base.leadId}@storage-network.app`);
  });

  it("rolls the end date over a month boundary", () => {
    const e = installEvent({ ...base, date: "2026-11-30" })!;
    expect(e.end).toBe("20261201");
  });

  it("names the arrival window when the customer picked one", () => {
    expect(installEvent({ ...base, timePreference: "morning" })!.title).toContain("(morning)");
    expect(installEvent({ ...base, timePreference: "anytime" })!.title).not.toContain("(");
  });

  it("is null without a real date", () => {
    expect(installEvent({ ...base, date: "TBD" })).toBeNull();
  });
});

describe("calendar links", () => {
  const e = installEvent(base)!;
  it("Google gets the all-day range and location", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261113/20261114");
    expect(u.searchParams.get("location")).toBe(base.address);
  });
  it("Outlook gets an all-day event", () => {
    const u = new URL(outlookCalendarUrl(e));
    expect(u.searchParams.get("startdt")).toBe("2026-11-13");
    expect(u.searchParams.get("enddt")).toBe("2026-11-14");
    expect(u.searchParams.get("allday")).toBe("true");
  });
  it("escapes the URLs into the button HTML", () => {
    const html = addToCalendarHtml(e, "https://x.test/a.ics");
    expect(html).toContain("&amp;dates=");
    expect(html).toContain(">Apple<");
  });
});

describe("installIcs", () => {
  const e = installEvent({ ...base, address: "12 Oak St, Columbus; OH" })!;
  const ics = installIcs(e, {
    method: "REQUEST",
    organizer: { name: "Rack City Totes", email: "orders@storage-network.app" },
    attendee: { name: "Judy Smith", email: "judy@example.com" },
    now,
  });
  const unfolded = ics.replace(/\r\n /g, "");

  it("is a CRLF invite Gmail can turn into an event card", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(unfolded).toContain("METHOD:REQUEST");
    expect(unfolded).toContain("DTSTART;VALUE=DATE:20261113");
    expect(unfolded).toContain("DTEND;VALUE=DATE:20261114");
    expect(unfolded).toContain('ORGANIZER;CN="Rack City Totes":mailto:orders@storage-network.app');
    expect(unfolded).toContain("mailto:judy@example.com");
    expect(unfolded).toContain("DTSTAMP:20261030T150000Z");
  });

  it("escapes text values", () => {
    expect(unfolded).toContain(String.raw`LOCATION:12 Oak St\, Columbus\; OH`);
    expect(unfolded).toMatch(/DESCRIPTION:[^\r]*\\n/);
  });

  it("folds long lines to 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  it("bumps SEQUENCE on a later send so a reschedule replaces the event", () => {
    const seq = (s: string) => Number(/SEQUENCE:(\d+)/.exec(s)![1]);
    const later = installIcs(e, { method: "REQUEST", now: new Date(now.getTime() + 60_000) });
    expect(seq(later)).toBeGreaterThan(seq(ics));
  });
});
