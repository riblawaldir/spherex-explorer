/**
 * Utilidades astronómicas y validación estricta de coordenadas para SPHEREx Explorer.
 * Soporta grados decimales y formato sexagesimal (HMS para RA, DMS para Dec).
 */

export interface PresetTarget {
  id: string;
  name: string;
  category: string;
  ra: number;
  dec: number;
  radius: number;
  description: string;
}

/**
 * Objetivos astronómicos predefinidos de referencia para SPHEREx y calibración.
 */
export const PRESET_TARGETS: PresetTarget[] = [
  {
    id: "WISE-0855",
    name: "WISE 0855",
    category: "Fixture demo",
    ra: 133.79513,
    dec: -7.24459,
    radius: 0.01,
    description:
      "Región de fixtures stub/cached (WISE J085510.83-071442.5). Primera búsqueda con resultados en modo API.",
  },
  {
    id: "SPX-NEP",
    name: "North Ecliptic Pole (NEP)",
    category: "SPHEREx Deep Field",
    ra: 270.0,
    dec: 66.5607,
    radius: 0.05,
    description: "Deep-coverage area in the northern hemisphere (SPHEREx Deep Field North).",
  },
  {
    id: "SPX-SEP",
    name: "South Ecliptic Pole (SEP)",
    category: "SPHEREx Deep Field",
    ra: 90.0,
    dec: -66.5607,
    radius: 0.05,
    description: "Deep-coverage area in the southern hemisphere (SPHEREx Deep Field South).",
  },
  {
    id: "M1",
    name: "M1 · Crab Nebula",
    category: "Calibration",
    ra: 83.63308,
    dec: 22.0145,
    radius: 0.02,
    description: "Supernova remnant used as a standard photometric calibrator.",
  },
  {
    id: "M42",
    name: "M42 · Orion Nebula",
    category: "H II region",
    ra: 83.82208,
    dec: -5.39111,
    radius: 0.03,
    description: "Massive star-forming region visible in the infrared.",
  },
  {
    id: "M31",
    name: "M31 · Andromeda Galaxy",
    category: "Galaxy",
    ra: 10.68471,
    dec: 41.26875,
    radius: 0.05,
    description: "Giant spiral galaxy in the Local Group.",
  },
  {
    id: "SPX-SIM-DEFAULT",
    name: "Simulated test region",
    category: "Simulated data",
    ra: 127.69444,
    dec: -39.1776,
    radius: 0.01,
    description: "Region with synthetic observations for development (SIMULATED DATA).",
  },
];

export interface CoordinateParseResult {
  valid: boolean;
  degrees?: number;
  error?: string;
  isSexagesimal?: boolean;
}

/**
 * Parsea y valida una Ascensión Recta (RA).
 * Acepta grados decimales [0, 360] o formato sexagesimal HMS (e.g. "18h 00m 00s", "18:00:00").
 */
export function parseAndValidateRA(input: string): CoordinateParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "RA es obligatoria (entre 0° y 360°)." };
  }

  // 1. Verificar formato sexagesimal HMS: e.g. "18h 00m 00s", "18:00:00", "18 00 00.5"
  const hmsRegex = /^(\d{1,2})(?:[h:\s])\s*(\d{1,2})?(?:[m:\s])?\s*(\d{1,2}(?:\.\d+)?)?s?$/i;
  const hmsMatch = trimmed.match(hmsRegex);

  // Si contiene caracteres sexagesimales (h, m, s o dos puntos ':')
  if (trimmed.includes(":") || trimmed.toLowerCase().includes("h")) {
    if (!hmsMatch) {
      return {
        valid: false,
        error: "Invalid RA sexagesimal format. Use 'HH:MM:SS' or 'HHh MMm SSs'.",
      };
    }

    const hours = Number(hmsMatch[1]);
    const minutes = hmsMatch[2] ? Number(hmsMatch[2]) : 0;
    const seconds = hmsMatch[3] ? Number(hmsMatch[3]) : 0;

    if (hours < 0 || hours >= 24) {
      return { valid: false, error: "Las horas de RA deben estar entre 0 y 23." };
    }
    if (minutes < 0 || minutes >= 60) {
      return { valid: false, error: "Los minutos de RA deben estar entre 0 y 59." };
    }
    if (seconds < 0 || seconds >= 60) {
      return { valid: false, error: "Los segundos de RA deben estar entre 0 y 59.99." };
    }

    const degrees = (hours + minutes / 60 + seconds / 3600) * 15;
    if (degrees < 0 || degrees > 360) {
      return { valid: false, error: "RA must be between 0° and 360°." };
    }

    return { valid: true, degrees: Number(degrees.toFixed(6)), isSexagesimal: true };
  }

  // 2. Grados decimales directos
  const num = Number(trimmed);
  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: "RA must be a valid number or sexagesimal value." };
  }

  if (num < 0 || num > 360) {
    return { valid: false, error: "RA must be between 0 and 360 degrees." };
  }

  return { valid: true, degrees: num, isSexagesimal: false };
}

/**
 * Parsea y valida una Declinación (Dec).
 * Acepta grados decimales [-90, +90] o formato sexagesimal DMS (e.g. "+66:33:38", "-39° 10' 39\"").
 */
export function parseAndValidateDec(input: string): CoordinateParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "Dec es obligatoria (entre −90° y +90°)." };
  }

  // Si contiene caracteres sexagesimales (d, m, s, grados '°', comillas, o dos puntos ':')
  if (
    trimmed.includes(":") ||
    trimmed.includes("°") ||
    trimmed.includes("'") ||
    trimmed.toLowerCase().includes("d")
  ) {
    const dmsRegex =
      /^([+-])?\s*(\d{1,2})(?:[°d:\s])\s*(\d{1,2})?(?:['m:\s])?\s*(\d{1,2}(?:\.\d+)?)?["s]?$/i;
    const dmsMatch = trimmed.match(dmsRegex);

    if (!dmsMatch) {
      return {
        valid: false,
        error: "Invalid Dec sexagesimal format. Use '±DD:MM:SS' or '±DD° MM\\' SS\\\"'.",
      };
    }

    const sign = dmsMatch[1] === "-" ? -1 : 1;
    const degPart = Number(dmsMatch[2]);
    const minutes = dmsMatch[3] ? Number(dmsMatch[3]) : 0;
    const seconds = dmsMatch[4] ? Number(dmsMatch[4]) : 0;

    if (degPart < 0 || degPart > 90) {
      return { valid: false, error: "Dec degrees must be between 0 and 90." };
    }
    if (minutes < 0 || minutes >= 60) {
      return { valid: false, error: "Los minutos de Dec deben estar entre 0 y 59." };
    }
    if (seconds < 0 || seconds >= 60) {
      return { valid: false, error: "Los segundos de Dec deben estar entre 0 y 59.99." };
    }

    const totalDeg = sign * (degPart + minutes / 60 + seconds / 3600);
    if (totalDeg < -90 || totalDeg > 90) {
      return { valid: false, error: "Dec must be between −90 and 90 degrees." };
    }

    return { valid: true, degrees: Number(totalDeg.toFixed(6)), isSexagesimal: true };
  }

  // Grados decimales directos
  const num = Number(trimmed);
  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: "Dec must be a valid number or sexagesimal value." };
  }

  if (num < -90 || num > 90) {
    return { valid: false, error: "Dec must be between −90 and 90 degrees." };
  }

  return { valid: true, degrees: num, isSexagesimal: false };
}

/**
 * Parsea y valida el Radio de búsqueda (en grados).
 */
export function parseAndValidateRadius(input: string, maxRadius = 5.0): CoordinateParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "El radio es obligatorio." };
  }

  const num = Number(trimmed);
  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: "Radius must be a valid number." };
  }

  if (num <= 0) {
    return { valid: false, error: "Radius must be greater than 0." };
  }

  if (num > maxRadius) {
    return {
      valid: false,
      error: `The recommended maximum radius is ${maxRadius}° to avoid overloading the query.`,
    };
  }

  return { valid: true, degrees: num, isSexagesimal: false };
}

/**
 * Convierte grados decimales de RA a formato sexagesimal HMS (HH:MM:SS.ss).
 */
export function degreesToHMS(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const totalHours = normalized / 15;
  const h = Math.floor(totalHours);
  const totalMinutes = (totalHours - h) * 60;
  const m = Math.floor(totalMinutes);
  const s = (totalMinutes - m) * 60;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toFixed(2).padStart(5, "0");

  return `${hh}h ${mm}m ${ss}s`;
}

/**
 * Convierte grados decimales de Dec a formato sexagesimal DMS (±DD° MM' SS.s").
 */
export function degreesToDMS(deg: number): string {
  const sign = deg < 0 ? "-" : "+";
  const absDeg = Math.abs(deg);
  const d = Math.floor(absDeg);
  const totalMinutes = (absDeg - d) * 60;
  const m = Math.floor(totalMinutes);
  const s = (totalMinutes - m) * 60;

  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toFixed(2).padStart(5, "0");

  return `${sign}${dd}° ${mm}' ${ss}"`;
}

/**
 * Validador integrado para el formulario de búsqueda de coordenadas.
 * Retorna errores compatibles con Coordinates de search.ts.
 */
export function validateCoordinatesStrict(coords: {
  ra: string;
  dec: string;
  radius: string;
}): {
  isValid: boolean;
  errors: Partial<Record<"ra" | "dec" | "radius", string>>;
  parsed?: { ra: number; dec: number; radius: number };
} {
  const raRes = parseAndValidateRA(coords.ra);
  const decRes = parseAndValidateDec(coords.dec);
  const radRes = parseAndValidateRadius(coords.radius);

  const errors: Partial<Record<"ra" | "dec" | "radius", string>> = {};
  if (!raRes.valid && raRes.error) errors.ra = raRes.error;
  if (!decRes.valid && decRes.error) errors.dec = decRes.error;
  if (!radRes.valid && radRes.error) errors.radius = radRes.error;

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    parsed: isValid
      ? {
          ra: raRes.degrees!,
          dec: decRes.degrees!,
          radius: radRes.degrees!,
        }
      : undefined,
  };
}
