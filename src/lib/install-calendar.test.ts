import { describe, expect, it } from "vitest";
import {
  addToCalendarHtml,
  googleCalendarUrl,
  installEvent,
  installIcs,
  outlookCalendarUrl,
  pickCalendar,
  zoneForAddress,
} from "./install-calendar";

const base = {
  leadId: "11111111-2222-3333-4444-555555555555",
  date: "2026-11-13T00:00:00+00:00",
  installerName: "Rack City Totes",
  address: "12 Oak St, Columbus, OH 43215",
  trackUrl: "https://storage-network.app/track/abc",
};
const now = new Date("2026-10-30T15:00:00Z");

describe("installEvent", () => {
  it("morning is 9:00–12:00 at the install address (Eastern, after DST ends)", () => {
    const e = installEvent({ ...base, timePreference: "morning" })!;
    expect(e.start).toBe("20261113T140000Z");
    expect(e.end).toBe("20261113T170000Z");
    expect(e.title).toBe("Storage rack install — Rack City Totes");
    expect(e.uid).toBe(`install-${base.leadId}@storage-network.app`);
  });

  it("afternoon is 12:01–4:00", () => {
    const e = installEvent({ ...base, timePreference: "afternoon" })!;
    expect(e.start).toBe("20261113T170100Z");
    expect(e.end).toBe("20261113T210000Z");
  });

  it("no window picked is 9:00–4:00", () => {
    const e = installEvent(base)!;
    expect(e.start).toBe("20261113T140000Z");
    expect(e.end).toBe("20261113T210000Z");
  });

  it("follows daylight saving and the state's zone", () => {
    const e = installEvent({ ...base, date: "2026-07-01", address: "1 Main St, Austin, Texas", timePreference: "morning" })!;
    expect(e.start).toBe("20260701T140000Z"); // 9 AM CDT
  });

  it("falls back to floating local time when the state is unknown", () => {
    const e = installEvent({ ...base, address: "12 Oak St", timePreference: "morning" })!;
    expect(e.start).toBe("20261113T090000");
    expect(e.end).toBe("20261113T120000");
  });

  it("is null without a real date", () => {
    expect(installEvent({ ...base, date: "TBD" })).toBeNull();
  });
});

describe("zoneForAddress", () => {
  it("reads 2-letter and spelled-out states", () => {
    expect(zoneForAddress("1 A St, Phoenix, AZ 85001")).toBe("America/Phoenix");
    expect(zoneForAddress("1 A St, Seattle, WA")).toBe("America/Los_Angeles");
    expect(zoneForAddress("1 A St, Denver, Colorado 80202")).toBe("America/Denver");
    expect(zoneForAddress("1 A St, Somewhere")).toBeNull();
  });
});

describe("pickCalendar", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8)";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
  it("goes by email provider first", () => {
    expect(pickCalendar("judy@gmail.com", iphone)).toBe("google");
    expect(pickCalendar("judy@hotmail.com", android)).toBe("outlook");
    expect(pickCalendar("judy@outlook.co.uk", windows)).toBe("outlook");
    expect(pickCalendar("judy@icloud.com", android)).toBe("ics");
  });
  it("then by device", () => {
    expect(pickCalendar("judy@company.com", iphone)).toBe("ics");
    expect(pickCalendar("judy@company.com", android)).toBe("google");
    expect(pickCalendar("judy@company.com", windows)).toBe("ics");
    expect(pickCalendar(null, null)).toBe("ics");
  });
});

describe("calendar links", () => {
  const e = installEvent({ ...base, timePreference: "morning" })!;
  it("Google gets the timed block and location", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261113T140000Z/20261113T170000Z");
    expect(u.searchParams.get("location")).toBe(base.address);
  });
  it("Outlook gets ISO times", () => {
    const u = new URL(outlookCalendarUrl(e));
    expect(u.searchParams.get("startdt")).toBe("2026-11-13T14:00:00Z");
    expect(u.searchParams.get("enddt")).toBe("2026-11-13T17:00:00Z");
    expect(u.searchParams.has("allday")).toBe(false);
  });
  it("renders one Add to calendar button", () => {
    const html = addToCalendarHtml("https://x.test/api/calendar/t?a=1&b=2");
    expect(html).toContain("a=1&amp;b=2");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("Add to calendar");
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
    expect(unfolded).toMatch(/DTSTART:20261113T\d{6}\r\n/);
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
