import { describe, expect, it } from "vitest";
import {
  clampInt,
  cn,
  formatChessClock,
  formatClock,
  formatDateTime,
  formatHalf,
  formatMatchClock,
  initials,
  ordinal,
  plural,
  shortName,
  timeAgo,
  uid,
} from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("uid", () => {
  it("returns the requested number of lowercase alphanumeric characters", () => {
    expect(uid()).toMatch(/^[0-9a-z]{10}$/);
    expect(uid(5)).toMatch(/^[0-9a-z]{5}$/);
  });

  it("produces different ids", () => {
    expect(uid(16)).not.toBe(uid(16));
  });
});

describe("clampInt", () => {
  it("keeps values inside the range and truncates decimals", () => {
    expect(clampInt(5, 0, 10)).toBe(5);
    expect(clampInt(15, 0, 10)).toBe(10);
    expect(clampInt(-3, 0, 10)).toBe(0);
    expect(clampInt(3.9, 0, 10)).toBe(3);
  });

  it("parses numeric strings", () => {
    expect(clampInt("7", 0, 10)).toBe(7);
  });

  it("falls back for non-numeric input", () => {
    expect(clampInt("x", 0, 10, 4)).toBe(4);
    expect(clampInt(NaN, 1, 5)).toBe(1);
    expect(clampInt(Infinity, 1, 5, 2)).toBe(2);
  });
});

describe("plural", () => {
  it("only uses the singular for exactly one", () => {
    expect(plural(1, "run")).toBe("1 run");
    expect(plural(2, "run")).toBe("2 runs");
    expect(plural(0, "wicket")).toBe("0 wickets");
  });

  it("accepts an irregular plural", () => {
    expect(plural(2, "inning", "innings")).toBe("2 innings");
  });
});

describe("shortName / initials", () => {
  it("abbreviates multi-word names by first letters", () => {
    expect(shortName("Mumbai Indians")).toBe("MI");
    expect(shortName("Royal Challengers Bangalore")).toBe("RCB");
    expect(shortName("A B C D")).toBe("ABC");
  });

  it("takes the first letters of a single word", () => {
    expect(shortName("Chennai")).toBe("CHE");
    expect(shortName("Chennai", 2)).toBe("CH");
  });

  it("returns an empty string for blank names", () => {
    expect(shortName("")).toBe("");
    expect(shortName("   ")).toBe("");
  });

  it("builds two-letter initials with a placeholder for blanks", () => {
    expect(initials("Mumbai Indians")).toBe("MI");
    expect(initials("Chennai")).toBe("CH");
    expect(initials("Alpha Bravo Charlie")).toBe("AB");
    expect(initials("")).toBe("?");
  });
});

describe("clock formatting", () => {
  it("formatClock shows mm:ss and adds hours when needed", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65_000)).toBe("01:05");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("00:00");
  });

  it("formatMatchClock never rolls into hours", () => {
    expect(formatMatchClock(5_400_000)).toBe("90:00");
    expect(formatMatchClock(7_200_000)).toBe("120:00");
    expect(formatMatchClock(999)).toBe("00:00");
    expect(formatMatchClock(-1)).toBe("00:00");
  });

  it("formatChessClock shows tenths under ten seconds", () => {
    expect(formatChessClock(0)).toBe("0:00");
    expect(formatChessClock(-5)).toBe("0:00");
    expect(formatChessClock(5_000)).toBe("0:05.0");
    expect(formatChessClock(9_950)).toBe("0:09.9");
  });

  it("formatChessClock rounds up to whole seconds from ten seconds", () => {
    expect(formatChessClock(10_000)).toBe("0:10");
    expect(formatChessClock(59_001)).toBe("1:00");
    expect(formatChessClock(61_000)).toBe("1:01");
    expect(formatChessClock(3_600_000)).toBe("1:00:00");
  });
});

describe("formatHalf", () => {
  it("renders whole numbers and halves", () => {
    expect(formatHalf(0)).toBe("0");
    expect(formatHalf(3)).toBe("3");
    expect(formatHalf(0.5)).toBe("½");
    expect(formatHalf(3.5)).toBe("3½");
  });
});

describe("ordinal", () => {
  it("adds the right suffix", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(20)).toBe("20th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(101)).toBe("101st");
  });

  it("uses 'th' for the teens", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(111)).toBe("111th");
  });
});

describe("formatDateTime", () => {
  it("returns an empty string for missing values", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
  });

  it("formats a valid ISO string", () => {
    expect(formatDateTime("2026-01-01T12:00:00Z")).not.toBe("");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-06-15T12:00:00Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  it("says 'just now' for recent past and 'in a moment' for near future", () => {
    expect(timeAgo(ago(10), now)).toBe("just now");
    expect(timeAgo(ago(-10), now)).toBe("in a moment");
  });

  it("uses minutes, hours and days", () => {
    expect(timeAgo(ago(5 * 60), now)).toBe(rtf.format(-5, "minute"));
    expect(timeAgo(ago(2 * 3600), now)).toBe(rtf.format(-2, "hour"));
    expect(timeAgo(ago(3 * 86400), now)).toBe(rtf.format(-3, "day"));
  });

  it("falls back to a calendar date after a month", () => {
    const iso = ago(60 * 86400);
    expect(timeAgo(iso, now)).toBe(
      new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
  });
});
