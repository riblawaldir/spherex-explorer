import { describe, it, expect, vi } from "vitest";
import { fetchObservations } from "./observationsApi";

describe("observationsApi Service (Sprint Adaptador Epoch)", () => {
  const dummyCoords = { ra: 127.69, dec: -39.17 };

  it("muestra errores IRSA aunque el backend devuelva fixtures", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ok: true, status: 200,
      json: async () => ({epochs: [], provenance: "cached_sample", warning: "IRSA query failed"})});
    const result = await fetchObservations(dummyCoords, {fetchImpl: mockFetch as unknown as typeof fetch});
    expect(result.status).toBe("error");
    expect(result.error).toContain("IRSA query failed");
  });

  it("gestiona una lista vacía de épocas devolviendo status 'empty'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ epochs: [], provenance: "stub" }),
    });

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("empty");
    expect(res.observations).toEqual([]);
    expect(res.discarded).toEqual([]);
    expect(res.isSimulated).toBe(true);
  });

  it("gestiona error HTTP 4xx devolviendo status 'error'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
    });

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("error");
    expect(res.error).toContain("422");
    expect(res.observations).toEqual([]);
  });

  it("gestiona error HTTP 5xx devolviendo status 'error'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("error");
    expect(res.error).toContain("500");
    expect(res.observations).toEqual([]);
  });

  it("gestiona fallo de red (conexión caída) devolviendo status 'error'", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch / Connection refused"));

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("error");
    expect(res.error).toContain("Failed to fetch");
    expect(res.observations).toEqual([]);
  });

  it("valida la forma de la respuesta si no contiene la lista 'epochs'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invalid_key: [] }),
    });

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("error");
    expect(res.error).toContain("epochs");
  });

  it("procesa épocas válidas y separa épocas incompletas en 'discarded'", async () => {
    const apiPayload = {
      epochs: [
        {
          obs_id: "EP-VALID-1",
          t_mjd: 60000,
          bandpass: "B1",
          ra: 127.694,
          dec: -39.177,
          collection: "DR1",
          source_url: "https://example.com/source/1",
          preview_url: "/api/preview/EP-VALID-1",
          provenance: "cached_sample",
        },
        {
          obs_id: "EP-INCOMPLETE-2",
          t_mjd: 60000,
          bandpass: "B2",
          ra: null, // Sin coordenadas
          dec: null,
          collection: null,
          source_url: null,
          preview_url: null,
          provenance: "cached_sample",
        },
      ],
      provenance: "cached_sample",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => apiPayload,
    });

    const res = await fetchObservations(dummyCoords, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe("ready");
    expect(res.observations).toHaveLength(1);
    expect(res.observations[0]?.id).toBe("EP-VALID-1");
    expect(res.observations[0]?.observed_at).toBe("2023-02-25T00:00:00.000Z");

    expect(res.discarded).toHaveLength(1);
    expect(res.discarded[0]?.obs_id).toBe("EP-INCOMPLETE-2");
    expect(res.discarded[0]?.reasons.length).toBeGreaterThan(0);
    expect(res.isSimulated).toBe(true);
  });

  it("permite el uso de datos simulados solo cuando useMocks es true con etiqueta DATOS SIMULADOS", async () => {
    const res = await fetchObservations(dummyCoords, { useMocks: true });

    expect(res.status).toBe("ready");
    expect(res.provenance).toBe("DATOS SIMULADOS");
    expect(res.isSimulated).toBe(true);
    expect(res.observations.length).toBeGreaterThan(0);
  });
});
