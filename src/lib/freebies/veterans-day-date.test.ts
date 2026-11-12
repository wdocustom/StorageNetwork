import { describe, expect, it } from "vitest";

import {
  PAGE_URL,
  googleCalendarUrl,
  nextVeteransDay,
  nextVeteransDayYear,
  outlookCalendarUrl,
  veteransDayIcs,
  veteransDayLabel,
} from "./veterans-day-date";

describe("next Veterans Day", () => {
  it("counts to this year's before November 11 and next year's from the day itself", () => {
    expect(nextVeteransDayYear(new Date(2026, 9, 1))).toBe(2026);
    expect(nextVeteransDayYear(new Date(2026, 10, 10, 23, 59))).toBe(2026);
    expect(nextVeteransDayYear(new Date(2026, 10, 11, 19, 2))).toBe(2027); // the evening of the day
    expect(nextVeteransDayYear(new Date(2026, 11, 31))).toBe(2027);
    const d = nextVeteransDay(new Date(2026, 10, 12));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 10, 11, 0]);
  });

  it("names the weekday", () => {
    expect(veteransDayLabel(2027)).toBe("Thursday, November 11, 2027");
  });
});

describe("add to calendar", () => {
  it("Google: an all-day event that repeats every year, with the planner link", () => {
    const url = new URL(googleCalendarUrl(2027));
    expect(url.host).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20271111/20271112");
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=YEARLY");
    expect(url.searchParams.get("details")).toContain(PAGE_URL);
    expect(url.searchParams.get("text")).toContain("Veterans Day");
  });

  it("Outlook: an all-day event with the planner link", () => {
    const url = new URL(outlookCalendarUrl(2027));
    expect(url.searchParams.get("startdt")).toBe("2027-11-11");
    expect(url.searchParams.get("allday")).toBe("true");
    expect(url.searchParams.get("body")).toContain(PAGE_URL);
  });

  it(".ics: valid all-day yearly event with a reminder the day before", () => {
    const ics = veteransDayIcs(2027, new Date("2026-11-12T01:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20271111\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20271112\r\n");
    expect(ics).toContain("RRULE:FREQ=YEARLY\r\n");
    expect(ics).toContain("DTSTAMP:20261112T010000Z\r\n");
    expect(ics).toContain("TRIGGER:-PT15H");
    expect(ics).toContain(`URL:${PAGE_URL}`);
    // Folded at 75 octets, and commas/newlines escaped.
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Thank you for your service.\\n\\nEvery Veterans Day\\, restaurants");
  });
});
