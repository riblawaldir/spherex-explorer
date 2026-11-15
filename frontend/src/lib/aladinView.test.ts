import { describe, expect, it } from "vitest";
import {
  ALADIN_SURVEYS,
  computeAladinViewParams,
  DEFAULT_ALADIN_SURVEY,
  formatCoordinatesDisplay,
  nextFov,
  panCenter,
  parseSubmittedQuery,
  projectFallbackPosition,
  surveyBackgroundLabel,
  surveyTileSeen,
  unprojectFallbackPosition,
} from "./aladinView";

describe("consulta a vista de Aladin", () => {
  it("conserva RA/Dec exactos y abre un campo proporcional al diámetro", () => {
    const view = computeAladinViewParams(127.6944441, -39.1776004, 0.1);
    expect(view.ra).toBe(127.6944441);
    expect(view.dec).toBe(-39.1776004);
    expect(view.radiusDeg).toBe(0.1);
    // diámetro 0.2° × 1.75 = 0.35°
    expect(view.fov).toBeCloseTo(0.35, 10);
  });

  it("no mueve una declinación fuera de rango y envuelve la RA al mismo meridiano", () => {
    const view = computeAladinViewParams(370, 95, 0.5);
    expect(view.ra).toBe(10);
    expect(view.dec).toBe(95);
    expect(computeAladinViewParams(-30, -10, 0.5).ra).toBe(330);
  });

  it("limita el campo de visión sin cambiar el radio pedido", () => {
    expect(computeAladinViewParams(100, 20, 0.001).fov).toBe(0.02);
    expect(computeAladinViewParams(0, 0, 100).fov).toBe(180);
    expect(computeAladinViewParams(0, 0, 100).radiusDeg).toBe(100);
  });

  it("rechaza números no finitos y no inventa un centro", () => {
    expect(() => computeAladinViewParams(Number.NaN, 0, 1)).toThrow();
  });

  it("lee la consulta con el mismo parser del buscador", () => {
    expect(parseSubmittedQuery({ ra: "127.6944441", dec: "-39.1776004", radius: "0.01" })).toEqual({
      ra: 127.6944441,
      dec: -39.1776004,
      radiusDeg: 0.01,
    });
    expect(parseSubmittedQuery({ ra: "", dec: "0", radius: "1" })).toBeNull();
  });

  it("usa el espejo ESA de DSS2 Color porque el nodo CDS no entrega teselas", () => {
    expect(DEFAULT_ALADIN_SURVEY).toBe("https://skies.esac.esa.int/DSSColor");
    expect(ALADIN_SURVEYS[DEFAULT_ALADIN_SURVEY]?.name).toBe("DSS2 Color");
  });

  it("reconoce una tesela JPEG del survey y no el HTML local", () => {
    const host = "https://skies.esac.esa.int/DSSColor";
    expect(
      surveyTileSeen(
        ["https://skies.esac.esa.int/DSSColor/Norder3/Dir0/Npix0.jpg"],
        host,
      ),
    ).toBe(true);
    expect(surveyTileSeen(["http://localhost:5173/P/DSS2/color/properties"], host)).toBe(false);
    expect(surveyTileSeen(["https://skies.esac.esa.int/DSSColor/properties"], host)).toBe(false);
  });

  it("no presenta DSS2 como activo si el fondo no llegó", () => {
    expect(surveyBackgroundLabel("loading")).toContain("Cargando fondo…");
    expect(surveyBackgroundLabel("ready")).toContain("Fondo: DSS2 Color");
    expect(surveyBackgroundLabel("ready")).toContain("skies.esac.esa.int");
    expect(surveyBackgroundLabel("unavailable")).toBe(
      "Fondo del cielo no disponible; los marcadores siguen activos.",
    );
  });

  it("formatea el centro en grados y en sexagesimal", () => {
    const formatted = formatCoordinatesDisplay(270, 66.5607);
    expect(formatted.decimal).toContain("RA 270.00000°");
    expect(formatted.decimal).toContain("DEC +66.56070°");
    expect(formatted.sexagesimal).toContain("18h 00m 00.00s");
  });

  it("desplaza la vista hacia la izquierda aumentando la RA", () => {
    const moved = panCenter(10, 0, 2, 2, "left", 0.25);
    expect(moved.ra).toBeCloseTo(10.5, 10);
    expect(moved.dec).toBe(0);
    const north = panCenter(10, 0, 2, 2, "up", 0.25);
    expect(north.dec).toBeCloseTo(0.5, 10);
  });

  it("acerca y aleja el campo dentro de los límites", () => {
    expect(nextFov(1.4, "in")).toBeCloseTo(1, 10);
    expect(nextFov(0.01, "in")).toBe(0.02);
    expect(nextFov(170, "out")).toBe(180);
  });

  it("proyecta el centro, el norte y el este en la vista de respaldo", () => {
    const center = projectFallbackPosition(20, 10, 20, 10, 10);
    expect(center.xPercent).toBe(50);
    expect(center.yPercent).toBe(50);

    const north = projectFallbackPosition(20, 12, 20, 10, 10);
    expect(north.yPercent).toBeLessThan(50);

    const east = projectFallbackPosition(22, 10, 20, 10, 10);
    expect(east.xPercent).toBeLessThan(50);
    expect(east.inside).toBe(true);

    const back = unprojectFallbackPosition(east.xPercent, east.yPercent, 20, 10, 10);
    expect(back.ra).toBeCloseTo(22, 8);
    expect(back.dec).toBeCloseTo(10, 8);
  });
});
