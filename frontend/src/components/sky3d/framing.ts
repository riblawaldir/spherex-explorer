export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewerFrame {
  width: number;
  height: number;
  /** Free canvas area for labels: between the toolbar, the status line and the side panels. */
  region: Box;
  /** Area the scene is fitted into; narrower than `region` when the details panel sits beside it. */
  fit: Box;
  /** Overlays inside `region` that labels must avoid. */
  blocked: Box[];
}

/** Camera distance at which a sphere of `radius` spans the shorter side of `fit` minus `marginPx`. */
export function fitDistance(radius: number, fovDeg: number, viewportHeight: number, fit: Box, marginPx = 8): number {
  const available = Math.max(48, Math.min(fit.right - fit.left, fit.bottom - fit.top) - marginPx * 2);
  const halfTan = (Math.tan((fovDeg * Math.PI) / 360) * available) / Math.max(1, viewportHeight);
  return (radius * Math.sqrt(1 + halfTan * halfTan)) / halfTan;
}

/** `setViewOffset` x/y that move the optical axis onto the center of `fit`. */
export function centerOffset(width: number, height: number, fit: Box): { x: number; y: number } {
  return {
    x: width / 2 - (fit.left + fit.right) / 2,
    y: height / 2 - (fit.top + fit.bottom) / 2,
  };
}

export function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function contains(outer: Box, inner: Box): boolean {
  return inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
}
