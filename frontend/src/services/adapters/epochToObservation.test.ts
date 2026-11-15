import { describe, it, expect } from "vitest";
import {
  mjdToIsoUtc,
  adaptSingleEpoch,
  adaptEpochsToObservations,
} from "./epochToObservation";

/** Fixture-shaped epoch: no collection / source_url (as returned by /api/epochs stubs). */
const fixtureEpoch = {
  obs_id: "SPX-FIXTURE-001",
  t_mjd: 60000,
  bandpass: "B1",
  ra: 127.694,
  dec: -39.177,
  preview_url: null,
  provenance: "cached_sample",
};

describe("Adaptador Epoch a Observation (epochToObservation)", () => {
  describe("Conversión MJD a ISO 8601 UTC", () => {
    it("convierte MJD 40587 exactamente a 1970-01-01T00:00:00.000Z (Unix Epoch)", () => {
      expect(mjdToIsoUtc(40587)).toBe("1970-01-01T00:00:00.000Z");
    });

    it("convierte MJD 60000 exactamente a 2023-02-25T00:00:00.000Z", () => {
      expect(mjdToIsoUtc(60000)).toBe("2023-02-25T00:00:00.000Z");
    });

    it("convierte valores no enteros de MJD dando la hora fraccional correcta", () => {
      expect(mjdToIsoUtc(40587.5)).toBe("1970-01-01T12:00:00.000Z");
      expect(mjdToIsoUtc(40587.25)).toBe("1970-01-01T06:00:00.000Z");
    });
  });

  describe("Validación estricta y descarte de t_mjd inválido", () => {
    const baseValidEpoch = {
      ...fixtureEpoch,
      obs_id: "SPX-TEST-001",
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

  describe("collection / source_url opcionales (fixtures / demo)", () => {
    it("acepta época fixture sin collection ni source_url", () => {
      const res = adaptSingleEpoch(fixtureEpoch);
      expect(res.discarded).toBeUndefined();
      expect(res.observation).toBeDefined();
      expect(res.observation?.id).toBe("SPX-FIXTURE-001");
      expect(res.observation?.collection).toBeNull();
      expect(res.observation?.source_url).toBeNull();
      expect(res.observation?.provenance).toBe("cached_sample");
    });

    it("acepta collection y source_url null sin inventar valores", () => {
      const res = adaptSingleEpoch({
        ...fixtureEpoch,
        collection: null,
        source_url: null,
      });
      expect(res.observation).toBeDefined();
      expect(res.observation?.collection).toBeNull();
      expect(res.observation?.source_url).toBeNull();
      expect(res.observation?.collection).not.toBe("DR1");
      expect(res.observation?.collection).not.toBe("QR3");
      expect(res.observation?.source_url).toBeNull();
    });

    it("acepta collection / source_url omitidos (undefined) sin inventar", () => {
      const { collection: _c, source_url: _s, ...rest } = {
        ...fixtureEpoch,
        collection: undefined as string | undefined,
        source_url: undefined as string | undefined,
      };
      void _c;
      void _s;
      const res = adaptSingleEpoch(rest);
      expect(res.observation).toBeDefined();
      expect(res.observation?.collection).toBeNull();
      expect(res.observation?.source_url).toBeNull();
    });

    it("pasa collection / source_url reales cuando la API los provee", () => {
      const res = adaptSingleEpoch({
        ...fixtureEpoch,
        collection: "DR1",
        source_url: "https://data.nasa.gov/obs/1",
      });
      expect(res.observation?.collection).toBe("DR1");
      expect(res.observation?.source_url).toBe("https://data.nasa.gov/obs/1");
    });

    it("trata cadenas vacías de collection / source_url como null (sin inventar)", () => {
      const res = adaptSingleEpoch({
        ...fixtureEpoch,
        collection: "   ",
        source_url: "",
      });
      expect(res.observation).toBeDefined();
      expect(res.observation?.collection).toBeNull();
      expect(res.observation?.source_url).toBeNull();
    });
  });

  describe("Épocas incompletas: campos realmente requeridos", () => {
    const baseValidEpoch = {
      ...fixtureEpoch,
      obs_id: "SPX-TEST-002",
      bandpass: "B2",
      ra: 180.0,
      dec: 45.0,
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

  describe("Época completa y gestión de preview_url / provenance", () => {
    it("convierte exactamente una época completa con provenance", () => {
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
        provenance: "cached_sample",
      });
    });

    it("permite preview_url null sin inventar imagen simulada", () => {
      const epochWithoutPreview = {
        obs_id: "SPX-NO-PREVIEW",
        t_mjd: 40587,
        bandpass: "B4",
        ra: 90.0,
        dec: -66.56,
        preview_url: null,
        provenance: "stub",
      };

      const res = adaptSingleEpoch(epochWithoutPreview);
      expect(res.observation).toBeDefined();
      expect(res.observation?.preview_url).toBeNull();
      expect(res.observation?.provenance).toBe("stub");
    });

    it("pone provenance null si está ausente (sin inventar)", () => {
      const { provenance: _p, ...noProv } = fixtureEpoch;
      void _p;
      const res = adaptSingleEpoch(noProv);
      expect(res.observation).toBeDefined();
      expect(res.observation?.provenance).toBeNull();
    });
  });

  describe("adaptEpochsToObservations con listas heterogéneas", () => {
    it("acepta fixtures sin collection y descarta solo épocas inválidas", () => {
      const list = [
        {
          obs_id: "OBS-OK-1",
          t_mjd: 60000,
          bandpass: "B1",
          ra: 100,
          dec: 10,
          preview_url: null,
          provenance: "stub",
        },
        {
          obs_id: "OBS-OK-NO-PROVENANCE-FIELDS",
          t_mjd: 60000,
          bandpass: "B2",
          ra: 100,
          dec: 10,
          // collection / source_url ausentes — debe aceptarse
        },
        {
          obs_id: "OBS-BAD-MJD",
          t_mjd: null,
          bandpass: "B3",
          ra: 100,
          dec: 10,
        },
        {
          obs_id: "",
          t_mjd: 60000,
          bandpass: "B1",
          ra: 100,
          dec: 10,
        },
      ];

      const { observations, discarded } = adaptEpochsToObservations(list);
      expect(observations).toHaveLength(2);
      expect(observations[0]?.id).toBe("OBS-OK-1");
      expect(observations[0]?.collection).toBeNull();
      expect(observations[0]?.source_url).toBeNull();
      expect(observations[1]?.id).toBe("OBS-OK-NO-PROVENANCE-FIELDS");
      expect(observations[1]?.collection).toBeNull();

      expect(discarded).toHaveLength(2);
      expect(discarded[0]?.obs_id).toBe("OBS-BAD-MJD");
      expect(discarded[1]?.reasons.some((r) => r.includes("obs_id"))).toBe(true);
    });

    it("gestiona una lista vacía retornando arreglos vacíos", () => {
      const { observations, discarded } = adaptEpochsToObservations([]);
      expect(observations).toEqual([]);
      expect(discarded).toEqual([]);
    });
  });
});
