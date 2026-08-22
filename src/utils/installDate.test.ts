import { describe, it, expect } from "vitest";
import {
  toInstallDateKey,
  isSameInstallDate,
  formatInstallDate,
  todayInstallDateKey,
} from "./installDate";

describe("toInstallDateKey", () => {
  it("passes a bare date through", () => {
    expect(toInstallDateKey("2026-08-25")).toBe("2026-08-25");
  });

  it("takes the calendar date out of the timestamptz Postgres stores", () => {
    // leads.scheduled_at is timestamptz; writing "2026-08-25" stores midnight
    // UTC and PostgREST hands it back in this shape.
    expect(toInstallDateKey("2026-08-25T00:00:00+00:00")).toBe("2026-08-25");
    expect(toInstallDateKey("2026-08-25T00:00:00Z")).toBe("2026-08-25");
  });

  it("normalizes a non-UTC offset through UTC", () => {
    expect(toInstallDateKey("2026-08-25T20:00:00-04:00")).toBe("2026-08-26");
  });

  it("returns null for empty and placeholder values", () => {
    expect(toInstallDateKey(null)).toBeNull();
    expect(toInstallDateKey(undefined)).toBeNull();
    expect(toInstallDateKey("")).toBeNull();
    expect(toInstallDateKey("TBD")).toBeNull();
    expect(toInstallDateKey("not a date")).toBeNull();
  });
});

describe("isSameInstallDate", () => {
  it("matches a stored timestamp against the date the installer picked", () => {
    expect(isSameInstallDate("2026-08-25T00:00:00+00:00", "2026-08-25")).toBe(true);
    expect(isSameInstallDate("2026-08-24T00:00:00+00:00", "2026-08-25")).toBe(false);
  });

  it("never treats a missing date as a match", () => {
    expect(isSameInstallDate(null, "2026-08-25")).toBe(false);
    expect(isSameInstallDate(null, null)).toBe(false);
  });
});

describe("formatInstallDate", () => {
  it("renders the day that was picked, not the day midnight UTC lands on locally", () => {
    // The old `new Date(iso).toLocaleDateString()` rendered this as Aug 24 for
    // any viewer west of UTC.
    expect(
      formatInstallDate("2026-08-25T00:00:00+00:00", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    ).toBe("Tue, Aug 25");
  });

  it("renders a bare date identically", () => {
    expect(
      formatInstallDate("2026-08-25", { weekday: "short", month: "short", day: "numeric" })
    ).toBe("Tue, Aug 25");
  });

  it("falls back when there is no date", () => {
    expect(formatInstallDate(null)).toBe("TBD");
    expect(formatInstallDate("", {}, "—")).toBe("—");
  });
});

describe("todayInstallDateKey", () => {
  it("answers in the viewer's timezone, not UTC", () => {
    // 9:30pm local on Aug 22. In any zone behind UTC that instant is already
    // Aug 23 in UTC, which is how the picker's `min` used to grey out today
    // for an installer working an evening job.
    const evening = new Date(2026, 7, 22, 21, 30);
    expect(todayInstallDateKey(evening)).toBe("2026-08-22");

    if (evening.getTimezoneOffset() > 150) {
      // Zone is far enough behind UTC that the old UTC-based `min` skipped a day.
      expect(evening.toISOString().split("T")[0]).toBe("2026-08-23");
    }
  });

  it("zero-pads single-digit months and days", () => {
    expect(todayInstallDateKey(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });
});
