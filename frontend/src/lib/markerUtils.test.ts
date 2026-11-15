import { describe, expect, it } from "vitest";
import { groupObservationsByPosition, transformObservationsToMarkers } from "./markerUtils";
import type { Observation } from "@/types/observation";

function observation(partial: Pick<Observation, "id" | "ra" | "dec"> & Partial<Observation>): Observation {
  return {
    observed_at: "2026-01-01T00:00:00Z",
    collection: "DR1",
    band: "B1",
    preview_url: null,
    source_url: null,
    ...partial,
  };
}

describe("marcadores de observaciones", () => {
  const samePlace = [
    observation({ id: "OBS-1", ra: 100.5, dec: 20.2, band: "B1" }),
    observation({ id: "OBS-2", ra: 100.5, dec: 20.2, band: "B2" }),
    observation({ id: "OBS-3", ra: 120, dec: -15, collection: "QR3", band: "B3" }),
  ];

  it("agrupa solo coordenadas idénticas y conserva cada observación", () => {
    const nearby = observation({ id: "OBS-NEAR", ra: 100.50002, dec: 20.2 });
    const groups = groupObservationsByPosition([...samePlace, nearby]);
    expect(groups).toHaveLength(3);
    expect(groups[0]?.map((item) => item.id)).toEqual(["OBS-1", "OBS-2"]);
    expect(groups.flat()).toHaveLength(4);
  });

  it("trata RA 0° y RA 360° como la misma posición", () => {
    const groups = groupObservationsByPosition([
      observation({ id: "A", ra: 0, dec: 10 }),
      observation({ id: "B", ra: 360, dec: 10 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("copia ra y dec sin redondear y distingue selección y comparación", () => {
    const precise = observation({ id: "P", ra: 127.6944441, dec: -39.1776004 });
    const { markers } = transformObservationsToMarkers([precise, ...samePlace], "OBS-1", ["OBS-3"]);

    const preciseMarker = markers.find((marker) => marker.primaryObservation.id === "P");
    expect(preciseMarker?.ra).toBe(127.6944441);
    expect(preciseMarker?.dec).toBe(-39.1776004);
    expect(preciseMarker?.state).toBe("normal");

    const grouped = markers.find((marker) => marker.isGrouped);
    expect(grouped?.count).toBe(2);
    expect(grouped?.state).toBe("selected");
    expect(grouped?.color).toBe("#facc15");
    expect(grouped?.observations.map((item) => item.id)).toEqual(["OBS-1", "OBS-2"]);

    const compared = markers.find((marker) => marker.primaryObservation.id === "OBS-3");
    expect(compared?.state).toBe("compared");
    expect(compared?.shape).toBe("plus");
    expect(compared?.color).toBe("#a855f7");
  });

  it("marca selección y comparación a la vez y omite coordenadas no finitas", () => {
    const broken = observation({ id: "BAD", ra: Number.NaN, dec: 1 });
    const { markers, skipped } = transformObservationsToMarkers(samePlace, "OBS-3", ["OBS-3"]);
    const both = markers.find((marker) => marker.primaryObservation.id === "OBS-3");
    expect(both?.state).toBe("selected_and_compared");
    expect(both?.shape).toBe("rhomb");

    const skippedBuild = transformObservationsToMarkers([broken, samePlace[2] as Observation]);
    expect(skippedBuild.skipped.map((item) => item.id)).toEqual(["BAD"]);
    expect(skippedBuild.markers).toHaveLength(1);
    expect(skipped.map((item) => item.id)).toEqual([]);
  });
});
