import { describe, it, expect } from "vitest";
import {
  mjdToIsoUtc,
  adaptSingleEpoch,
  adaptEpochsToObservations,
} from "./epochToObservation";

describe("Adaptador Epoch a Observation (epochToObservation)", () => {
  describe("Conversión MJD a ISO 8601 UTC", () => {
    it("convierte MJD 40587 exactamente a 1970-01-01T00:00:00.000Z (Unix Epoch)", () => {
      expect(mjdToIsoUtc(40587)).toBe("1970-01-01T00:00:00.000Z");
    });

    it("convierte MJD 60000 exactamente a 2023-02-25T00:00:00.000Z", () => {
      expect(mjdToIsoUtc(60000)).toBe("2023-02-25T00:00:00.000Z");
    });

    it("convierte valores no enteros de MJD dando la hora fraccional correcta", () => {
      // 40587.5 = 12 horas después de la medianoche
      expect(mjdToIsoUtc(40587.5)).toBe("1970-01-01T12:00:00.000Z");
      // 40587.25 = 06:00:00
      expect(mjdToIsoUtc(40587.25)).toBe("1970-01-01T06:00:00.000Z");
    });
  });

  describe("Validación estricta y descarte de t_mjd inválido", () => {
    const baseValidEpoch = {
      obs_id: "SPX-TEST-001",
      t_mjd: 60000,
      bandpass: "B1",
      ra: 127.694,
      dec: -39.177,
      collection: "DR1",
      source_url: "https://example.com/obs/1",
      preview_url: null,
      provenance: "cached_sample",
    };

    it("descarta la época si t_mjd es nulo, sin inventar fecha", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, t_mjd: null });
      expect(res.observation).toBeUndefined();
      expect(res.discarded).toBeDefined();
      expect(res.discarded?.obs_id).toBe("SPX-TEST-001");
      expect(res.discarded?.reasons.some((r) => r.includes("t_mjd"))).toBe(true);
    });

    it("descarta la época si t_mjd es NaN", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, t_mjd: NaN });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("t_mjd"))).toBe(true);
    });

    it("descarta la época si t_mjd viene como string", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, t_mjd: "60000" });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("t_mjd"))).toBe(true);
    });
  });

  describe("Épocas incompletas sin campos requeridos de Observation", () => {
    const baseValidEpoch = {
      obs_id: "SPX-TEST-002",
      t_mjd: 60000,
      bandpass: "B2",
      ra: 180.0,
      dec: 45.0,
      collection: "DR1",
      source_url: "https://example.com/obs/2",
      preview_url: "/api/preview/2",
      provenance: "stub",
    };

    it("descarta si falta ra o es null", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, ra: null });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("ra"))).toBe(true);
    });

    it("descarta si ra está fuera de rango [0, 360]", () => {
      const resUnder = adaptSingleEpoch({ ...baseValidEpoch, ra: -1 });
      expect(resUnder.observation).toBeUndefined();
      expect(resUnder.discarded?.reasons.some((r) => r.includes("ra"))).toBe(true);

      const resOver = adaptSingleEpoch({ ...baseValidEpoch, ra: 360.5 });
      expect(resOver.observation).toBeUndefined();
      expect(resOver.discarded?.reasons.some((r) => r.includes("ra"))).toBe(true);
    });

    it("descarta si falta dec o es null", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, dec: null });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("dec"))).toBe(true);
    });

    it("descarta si dec está fuera de rango [-90, 90]", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, dec: -95 });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("dec"))).toBe(true);
    });

    it("descarta si falta collection (no asume ni inventa una colección)", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, collection: undefined });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("collection"))).toBe(true);
    });

    it("descarta si falta source_url (no construye URLs inventadas)", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, source_url: undefined });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("source_url"))).toBe(true);
    });

    it("descarta si falta obs_id", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, obs_id: "" });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("obs_id"))).toBe(true);
    });

    it("descarta si falta bandpass", () => {
      const res = adaptSingleEpoch({ ...baseValidEpoch, bandpass: "" });
      expect(res.observation).toBeUndefined();
      expect(res.discarded?.reasons.some((r) => r.includes("bandpass"))).toBe(true);
    });
  });

  describe("Época completa y gestión de preview_url", () => {
    it("convierte exactamente una época completa", () => {
      const fullEpoch = {
        obs_id: "SPX-VALID-999",
        t_mjd: 60000,
        bandpass: "B3",
        ra: 270.0,
        dec: 66.56,
        collection: "QR3",
        source_url: "https://data.nasa.gov/obs/999",
        preview_url: "/api/preview/SPX-VALID-999",
        provenance: "cached_sample",
      };

      const res = adaptSingleEpoch(fullEpoch);
      expect(res.discarded).toBeUndefined();
      expect(res.observation).toEqual({
        id: "SPX-VALID-999",
        observed_at: "2023-02-25T00:00:00.000Z",
        collection: "QR3",
        ra: 270.0,
        dec: 66.56,
        band: "B3",
        preview_url: "/api/preview/SPX-VALID-999",
        source_url: "https://data.nasa.gov/obs/999",
      });
    });

    it("permite preview_url null sin inventar imagen simulada", () => {
      const epochWithoutPreview = {
        obs_id: "SPX-NO-PREVIEW",
        t_mjd: 40587,
        bandpass: "B4",
        ra: 90.0,
        dec: -66.56,
        collection: "DR1",
        source_url: "https://data.nasa.gov/obs/1000",
        preview_url: null,
        provenance: "stub",
      };

      const res = adaptSingleEpoch(epochWithoutPreview);
      expect(res.observation).toBeDefined();
      expect(res.observation?.preview_url).toBeNull();
    });
  });

  describe("adaptEpochsToObservations con listas heterogéneas", () => {
    it("separa observaciones válidas de épocas descartadas con sus motivos", () => {
      const list = [
        {
          obs_id: "OBS-OK-1",
          t_mjd: 60000,
          bandpass: "B1",
          ra: 100,
          dec: 10,
          collection: "DR1",
          source_url: "https://example.com/1",
          preview_url: null,
          provenance: "stub",
        },
        {
          obs_id: "OBS-BAD-COLLECTION",
          t_mjd: 60000,
          bandpass: "B2",
          ra: 100,
          dec: 10,
          // collection ausente
          source_url: "https://example.com/2",
        },
        {
          obs_id: "OBS-BAD-MJD",
          t_mjd: null,
          bandpass: "B3",
          ra: 100,
          dec: 10,
          collection: "DR1",
          source_url: "https://example.com/3",
        },
      ];

      const { observations, discarded } = adaptEpochsToObservations(list);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.id).toBe("OBS-OK-1");

      expect(discarded).toHaveLength(2);
      expect(discarded[0]?.obs_id).toBe("OBS-BAD-COLLECTION");
      expect(discarded[1]?.obs_id).toBe("OBS-BAD-MJD");
    });

    it("gestiona una lista vacía retornando arreglos vacíos", () => {
      const { observations, discarded } = adaptEpochsToObservations([]);
      expect(observations).toEqual([]);
      expect(discarded).toEqual([]);
    });
  });
});
