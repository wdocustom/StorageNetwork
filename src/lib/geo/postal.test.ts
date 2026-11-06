import { describe, expect, it } from "vitest";
import zipcodes from "zipcodes";
import {
  countryOfPostal,
  isCompletePostalInput,
  parsePostalCode,
  postalKey,
  provinceFromPostal,
  regionCodeFromLookup,
  sanitizePostalInput,
} from "./postal";
import { currencyForCountry, formatMoney, normalizeCurrency } from "./currency";

describe("parsePostalCode", () => {
  it("parses US ZIPs and ZIP+4", () => {
    expect(parsePostalCode("29401")).toEqual({ country: "US", key: "29401", formatted: "29401" });
    expect(parsePostalCode(" 29401-1234 ")?.key).toBe("29401");
    expect(parsePostalCode("294011234")?.key).toBe("29401");
  });

  it("parses Canadian postal codes in any spacing/case to the FSA key", () => {
    for (const v of ["M5V 2T6", "m5v2t6", "M5V-2T6", "  m5v 2t6 "]) {
      expect(parsePostalCode(v)).toEqual({ country: "CA", key: "M5V", formatted: "M5V 2T6" });
    }
    expect(parsePostalCode("h2x")).toEqual({ country: "CA", key: "H2X", formatted: "H2X" });
  });

  it("rejects malformed codes and letters Canada Post never uses", () => {
    for (const v of ["", "1234", "123456", "ABCDE", "D5V 2T6", "M5V 2T", "Z1A 1A1", "M5O", null, undefined]) {
      expect(parsePostalCode(v as string)).toBeNull();
    }
  });

  it("postalKey / countryOfPostal", () => {
    expect(postalKey("k1a 0b1")).toBe("K1A");
    expect(postalKey("nope")).toBeNull();
    expect(countryOfPostal("K1A")).toBe("CA");
    expect(countryOfPostal("10001")).toBe("US");
  });
});

describe("keys line up with the zipcodes dataset", () => {
  it("resolves Canadian FSAs and US ZIPs", () => {
    expect(zipcodes.lookup(postalKey("M5V 2T6")!)?.country).toBe("Canada");
    expect(zipcodes.lookup(postalKey("29401")!)?.country).toBe("US");
  });
});

describe("provinces", () => {
  it("derives the province from the FSA", () => {
    expect(provinceFromPostal("M5V 2T6")).toBe("ON");
    expect(provinceFromPostal("H2X")).toBe("QC");
    expect(provinceFromPostal("V6B")).toBe("BC");
    expect(provinceFromPostal("X0A")).toBe("NU");
    expect(provinceFromPostal("X1A")).toBe("NT");
    expect(provinceFromPostal("29401")).toBeNull();
  });

  it("normalizes lookup results to 2-letter region codes", () => {
    expect(regionCodeFromLookup(zipcodes.lookup("M5V"))).toBe("ON");
    expect(regionCodeFromLookup(zipcodes.lookup("29401"))).toBe("SC");
    expect(regionCodeFromLookup(undefined)).toBeNull();
  });
});

describe("sanitizePostalInput", () => {
  it("keeps digit-first input as a 5-digit ZIP", () => {
    expect(sanitizePostalInput("29401-12")).toBe("29401");
    expect(sanitizePostalInput("2a9")).toBe("29");
  });
  it("formats letter-first input as A1A 1A1", () => {
    expect(sanitizePostalInput("m5v2t6")).toBe("M5V 2T6");
    expect(sanitizePostalInput("m5v")).toBe("M5V");
    expect(sanitizePostalInput("M5V 2T6X")).toBe("M5V 2T6");
  });
  it("empty in, empty out", () => {
    expect(sanitizePostalInput("  ")).toBe("");
  });
});

describe("currency", () => {
  it("maps countries to currencies", () => {
    expect(currencyForCountry("CA")).toBe("cad");
    expect(currencyForCountry("US")).toBe("usd");
    expect(currencyForCountry(null)).toBe("usd");
    expect(normalizeCurrency("CAD")).toBe("cad");
    expect(normalizeCurrency("eur")).toBe("usd");
  });
  it("formats money unambiguously", () => {
    expect(formatMoney(1234, "usd")).toBe("$1,234");
    expect(formatMoney(1234.5, "cad")).toBe("CA$1,234.50");
    expect(formatMoney(-20, "cad")).toBe("-CA$20");
  });
});

describe("isCompletePostalInput", () => {
  it("fires on full codes only", () => {
    expect(isCompletePostalInput("29401")).toBe(true);
    expect(isCompletePostalInput("2940")).toBe(false);
    expect(isCompletePostalInput("M5V")).toBe(false);
    expect(isCompletePostalInput("M5V 2T")).toBe(false);
    expect(isCompletePostalInput("M5V 2T6")).toBe(true);
  });
});
