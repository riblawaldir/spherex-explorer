import { describe, it, expect } from "vitest";
import {
  parseAndValidateRA,
  parseAndValidateDec,
  parseAndValidateRadius,
  degreesToHMS,
  degreesToDMS,
  validateCoordinatesStrict,
  PRESET_TARGETS,
} from "./coordinates";

describe("Astronomical Coordinates Parser & Validator (Sprint 1)", () => {
  describe("RA (Right Ascension) validation", () => {
    it("accepts valid decimal degrees between 0 and 360", () => {
      expect(parseAndValidateRA("0")).toEqual({ valid: true, degrees: 0, isSexagesimal: false });
      expect(parseAndValidateRA("360")).toEqual({ valid: true, degrees: 360, isSexagesimal: false });
      expect(parseAndValidateRA("127.69444")).toEqual({
        valid: true,
        degrees: 127.69444,
        isSexagesimal: false,
      });
      expect(parseAndValidateRA(" 180.5 ")).toEqual({
        valid: true,
        degrees: 180.5,
        isSexagesimal: false,
      });
    });

    it("rejects invalid decimal degrees for RA", () => {
      expect(parseAndValidateRA("-0.001").valid).toBe(false);
      expect(parseAndValidateRA("360.001").valid).toBe(false);
      expect(parseAndValidateRA("").valid).toBe(false);
      expect(parseAndValidateRA("   ").valid).toBe(false);
      expect(parseAndValidateRA("not_a_number").valid).toBe(false);
    });

    it("accepts valid sexagesimal HMS formats for RA", () => {
      // 18h = 270 degrees
      const hms1 = parseAndValidateRA("18h 00m 00s");
      expect(hms1.valid).toBe(true);
      expect(hms1.degrees).toBe(270);
      expect(hms1.isSexagesimal).toBe(true);

      // 12:30:00 = 12.5h = 187.5 degrees
      const hms2 = parseAndValidateRA("12:30:00");
      expect(hms2.valid).toBe(true);
      expect(hms2.degrees).toBe(187.5);

      // 00h 00m 00s = 0 degrees
      const hms3 = parseAndValidateRA("00:00:00");
      expect(hms3.valid).toBe(true);
      expect(hms3.degrees).toBe(0);
    });

    it("rejects out-of-range sexagesimal HMS values", () => {
      expect(parseAndValidateRA("25:00:00").valid).toBe(false);
      expect(parseAndValidateRA("12:65:00").valid).toBe(false);
      expect(parseAndValidateRA("12:00:75").valid).toBe(false);
      expect(parseAndValidateRA("18h 99m").valid).toBe(false);
    });
  });

  describe("Dec (Declination) validation", () => {
    it("accepts valid decimal degrees between -90 and +90", () => {
      expect(parseAndValidateDec("-90")).toEqual({
        valid: true,
        degrees: -90,
        isSexagesimal: false,
      });
      expect(parseAndValidateDec("90")).toEqual({
        valid: true,
        degrees: 90,
        isSexagesimal: false,
      });
      expect(parseAndValidateDec("+45.5")).toEqual({
        valid: true,
        degrees: 45.5,
        isSexagesimal: false,
      });
      expect(parseAndValidateDec("-39.17760")).toEqual({
        valid: true,
        degrees: -39.1776,
        isSexagesimal: false,
      });
      expect(parseAndValidateDec("0")).toEqual({
        valid: true,
        degrees: 0,
        isSexagesimal: false,
      });
    });

    it("rejects invalid decimal degrees for Dec", () => {
      expect(parseAndValidateDec("-90.001").valid).toBe(false);
      expect(parseAndValidateDec("90.001").valid).toBe(false);
      expect(parseAndValidateDec("").valid).toBe(false);
      expect(parseAndValidateDec("abc").valid).toBe(false);
    });

    it("accepts valid sexagesimal DMS formats for Dec", () => {
      const dms1 = parseAndValidateDec("+66:33:38");
      expect(dms1.valid).toBe(true);
      expect(dms1.degrees).toBeCloseTo(66.56055, 4);

      const dms2 = parseAndValidateDec("-39:10:39");
      expect(dms2.valid).toBe(true);
      expect(dms2.degrees).toBeCloseTo(-39.1775, 3);
    });

    it("rejects out-of-range sexagesimal DMS values", () => {
      expect(parseAndValidateDec("+95:00:00").valid).toBe(false);
      expect(parseAndValidateDec("+45:65:00").valid).toBe(false);
      expect(parseAndValidateDec("-10:20:90").valid).toBe(false);
    });
  });

  describe("Radius validation", () => {
    it("accepts valid radius > 0 and <= max", () => {
      expect(parseAndValidateRadius("0.01").valid).toBe(true);
      expect(parseAndValidateRadius("1.5").valid).toBe(true);
      expect(parseAndValidateRadius("5.0").valid).toBe(true);
    });

    it("rejects non-positive radius", () => {
      expect(parseAndValidateRadius("0").valid).toBe(false);
      expect(parseAndValidateRadius("-1").valid).toBe(false);
      expect(parseAndValidateRadius("").valid).toBe(false);
      expect(parseAndValidateRadius("invalid").valid).toBe(false);
    });

    it("rejects radius larger than max recommended", () => {
      expect(parseAndValidateRadius("5.1", 5.0).valid).toBe(false);
      expect(parseAndValidateRadius("10", 5.0).valid).toBe(false);
    });
  });

  describe("Format conversions", () => {
    it("converts decimal degrees to HMS string correctly", () => {
      expect(degreesToHMS(0)).toBe("00h 00m 00.00s");
      expect(degreesToHMS(270)).toBe("18h 00m 00.00s");
      expect(degreesToHMS(187.5)).toBe("12h 30m 00.00s");
    });

    it("converts decimal degrees to DMS string correctly", () => {
      expect(degreesToDMS(0)).toBe("+00° 00' 00.00\"");
      expect(degreesToDMS(45.5)).toBe("+45° 30' 00.00\"");
      expect(degreesToDMS(-39.5)).toBe("-39° 30' 00.00\"");
    });
  });

  describe("Integrated validation", () => {
    it("validates full coordinate set correctly", () => {
      const valid = validateCoordinatesStrict({
        ra: "127.69444",
        dec: "-39.17760",
        radius: "0.01",
      });
      expect(valid.isValid).toBe(true);
      expect(Object.keys(valid.errors)).toHaveLength(0);
      expect(valid.parsed).toEqual({
        ra: 127.69444,
        dec: -39.1776,
        radius: 0.01,
      });

      const invalid = validateCoordinatesStrict({
        ra: "-5",
        dec: "100",
        radius: "-0.5",
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.ra).toBeDefined();
      expect(invalid.errors.dec).toBeDefined();
      expect(invalid.errors.radius).toBeDefined();
    });
  });

  describe("Preset targets list", () => {
    it("contains valid astronomical reference targets including SPHEREx deep fields", () => {
      expect(PRESET_TARGETS.length).toBeGreaterThanOrEqual(4);
      for (const target of PRESET_TARGETS) {
        expect(target.id).toBeDefined();
        expect(target.name).toBeDefined();
        expect(target.ra).toBeGreaterThanOrEqual(0);
        expect(target.ra).toBeLessThanOrEqual(360);
        expect(target.dec).toBeGreaterThanOrEqual(-90);
        expect(target.dec).toBeLessThanOrEqual(90);
        expect(target.radius).toBeGreaterThan(0);
      }
    });
  });
});
