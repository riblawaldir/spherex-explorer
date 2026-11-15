/** Resolve a CSS color token to an rgb() string the WebGL renderer can parse. */

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  violet: string;
  muted: string;
  warning: string;
}

const TOKENS = {
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  violet: "--violet",
  muted: "--muted-foreground",
  warning: "--warning",
} as const;

function resolveToken(name: string): string | null {
  const specified = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!specified) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#000000";
  context.fillStyle = specified;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  const red = pixel[0] ?? 0;
  const green = pixel[1] ?? 0;
  const blue = pixel[2] ?? 0;
  const alpha = pixel[3] ?? 0;
  if (alpha === 0) return null;
  return `rgb(${red}, ${green}, ${blue})`;
}

export function readThemeColors(): ThemeColors | null {
  if (typeof document === "undefined") return null;
  const background = resolveToken(TOKENS.background);
  const foreground = resolveToken(TOKENS.foreground);
  const primary = resolveToken(TOKENS.primary);
  const violet = resolveToken(TOKENS.violet);
  const muted = resolveToken(TOKENS.muted);
  const warning = resolveToken(TOKENS.warning);
  if (!background || !foreground || !primary || !violet || !muted || !warning) return null;
  return { background, foreground, primary, violet, muted, warning };
}
