import { describe, it, expect, vi } from "vitest";
import {
  fetchTargets,
  searchByQuery,
  searchByCoordinates,
  checkBackendHealth,
} from "./searchService";

describe("Search Service API Client (Sprint 1)", () => {
  describe("fetchTargets", () => {
    it("returns targets when API responds with 200", async () => {
      const mockTargets = [
        { id: "tgt-1", name: "Crab Nebula", ra: 83.63, dec: 22.01, notes: "Calibration" },
      ];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTargets,
      });

      const result = await fetchTargets(mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0]?.name).toBe("Crab Nebula");
    });

    it("handles HTTP error response gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchTargets(mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(false);
      expect(result.targets).toEqual([]);
      expect(result.error).toContain("500");
    });

    it("handles network failure gracefully", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));

      const result = await fetchTargets(mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network connection lost");
    });
  });

  describe("searchByQuery", () => {
    it("returns search hits and marks simulated provenance", async () => {
      const mockResponse = {
        hits: [{ id: "hit-1", name: "Orion", ra: 83.82, dec: -5.39 }],
        provenance: "stub",
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await searchByQuery("Orion", mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      expect(result.hits).toHaveLength(1);
      expect(result.isSimulated).toBe(true);
    });
  });

  describe("searchByCoordinates", () => {
    it("maps backend epochs to observations and marks as simulated", async () => {
      const mockEpochs = {
        epochs: [
          {
            obs_id: "EP-001",
            t_mjd: 60000,
            bandpass: "B1",
            wavelength_um: 0.75,
            preview_url: "/api/preview/EP-001",
            provenance: "stub",
          },
        ],
        provenance: "stub",
      };
      const mockSearch = {
        hits: [],
        provenance: "stub",
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/epochs")) {
          return { ok: true, json: async () => mockEpochs };
        }
        return { ok: true, json: async () => mockSearch };
      });

      const result = await searchByCoordinates(
        { ra: 127.69, dec: -39.17, radiusDegrees: 0.01 },
        mockFetch as unknown as typeof fetch,
      );

      expect(result.success).toBe(true);
      expect(result.backendAvailable).toBe(true);
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0]?.id).toBe("EP-001");
      expect(result.observations[0]?.band).toBe("B1");
      expect(result.isSimulated).toBe(true);
    });

    it("returns backendAvailable=false and clear error message when backend is unreachable", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const result = await searchByCoordinates(
        { ra: 0, dec: 0 },
        mockFetch as unknown as typeof fetch,
      );

      expect(result.success).toBe(false);
      expect(result.backendAvailable).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("checkBackendHealth", () => {
    it("returns true when /health returns ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      });

      const isHealthy = await checkBackendHealth(mockFetch as unknown as typeof fetch);
      expect(isHealthy).toBe(true);
    });

    it("returns false when /health fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Unreachable"));
      const isHealthy = await checkBackendHealth(mockFetch as unknown as typeof fetch);
      expect(isHealthy).toBe(false);
    });
  });
});
