/**
 * Tipos mínimos de Aladin Lite v3 usados por el mapa.
 * La API real queda detrás de aladinClient.ts.
 *
 * Referencia: https://aladin.cds.unistra.fr/AladinLite/doc/API/
 * y https://cds-astro.github.io/aladin-lite/Aladin.html
 */

export interface AladinSource {
  ra?: number;
  dec?: number;
  data?: Record<string, unknown>;
}

export interface AladinCatalog {
  addSources(sources: unknown[]): void;
  removeAll(): void;
}

export interface AladinGraphicOverlay {
  addFootprints(shapes: unknown[]): void;
  removeAll(): void;
}

export interface AladinInstance {
  gotoRaDec(ra: number, dec: number): void;
  setFoV(fovInDegrees: number): void;
  getFov(): [number, number] | number;
  getRaDec(): [number, number];
  setImageSurvey(surveyId: string): void;
  /** https://cds-astro.github.io/aladin-lite/Aladin.html — setCooGrid({ color, opacity, thickness, enabled }) */
  setCooGrid(options: {
    color?: string;
    opacity?: number;
    labelSize?: number;
    thickness?: number;
    enabled?: boolean;
  }): void;
  addCatalog(catalog: AladinCatalog): void;
  removeCatalog?(catalog: AladinCatalog): void;
  addOverlay(overlay: AladinGraphicOverlay | AladinCatalog): void;
  removeOverlay(overlay: AladinGraphicOverlay | AladinCatalog): void;
  on(event: string, callback: (payload?: unknown) => void): void;
  off(event: string): void;
  getParentDiv?(): HTMLElement | undefined;
}

export interface AladinNamespace {
  init: Promise<void>;
  aladin(container: string | HTMLElement, options?: Record<string, unknown>): AladinInstance;
  catalog(options?: Record<string, unknown>): AladinCatalog;
  source(ra: number, dec: number, data?: Record<string, unknown>, options?: Record<string, unknown>): unknown;
  graphicOverlay(options?: Record<string, unknown>): AladinGraphicOverlay;
  circle(ra: number, dec: number, radiusInDegrees: number, options?: Record<string, unknown>): unknown;
}
