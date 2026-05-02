/**
 * T-SITE-V2-02: Grass component on topography.
 * Generates procedural grass fields with wind and altitude-based colouring.
 */

export interface AABB2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GrassBlade {
  x: number;
  y: number;
  /** Height in world units. */
  height: number;
  /** Lean angle in radians (0 = upright, positive = leans right/+x direction). */
  lean: number;
  /** CSS hex colour string e.g. "#4a7c40". */
  colour: string;
}

export interface GrassField {
  blades: GrassBlade[];
  density: number;
  patchId: string;
}

// ── Seeded LCG ───────────────────────────────────────────────────────────────

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Return a CSS hex colour for grass at a given altitude in metres.
 * Low altitude → lush green; high altitude → pale/yellowed.
 */
export function bladeColourForAltitude(altM: number): string {
  // Clamp to realistic range 0 – 4000 m
  const t = Math.max(0, Math.min(1, altM / 4000));
  // Interpolate green channel and blue slightly for high altitude
  const r = Math.round(40 + t * 120);        // 40 → 160
  const g = Math.round(140 - t * 60);        // 140 → 80
  const b = Math.round(30 + t * 20);         // 30 → 50
  return `#${_hex2(r)}${_hex2(g)}${_hex2(b)}`;
}

function _hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * Generate a grass patch filling `bounds` at the given `density`.
 * `windStrength` affects the initial lean distribution.
 */
export function generateGrassPatch(
  bounds: AABB2D,
  density: number,
  windStrength: number
): GrassField {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0 || density <= 0) {
    return { blades: [], density, patchId: _makePatchId(bounds) };
  }

  const area = width * height;
  const count = Math.max(0, Math.round(density * area));
  const seed = Math.round(bounds.minX * 73 + bounds.minY * 37 + density * 1000);
  const rng = lcg(seed);

  const blades: GrassBlade[] = [];
  for (let i = 0; i < count; i++) {
    const x = bounds.minX + rng() * width;
    const y = bounds.minY + rng() * height;
    // Estimate altitude from y position (higher y = higher altitude for simple topo)
    const normY = (y - bounds.minY) / (height || 1);
    const altM = normY * 2000; // simple 0–2000 m proxy
    const bladeHeight = 0.05 + rng() * 0.15; // 5–20 cm
    const baseLean = (rng() - 0.5) * 0.2;   // natural variation
    const windLean = windStrength * (rng() * 0.3);
    blades.push({
      x,
      y,
      height: bladeHeight,
      lean: baseLean + windLean,
      colour: bladeColourForAltitude(altM),
    });
  }

  return { blades, density, patchId: _makePatchId(bounds) };
}

function _makePatchId(bounds: AABB2D): string {
  return `gp-${bounds.minX}-${bounds.minY}-${bounds.maxX}-${bounds.maxY}`;
}

/**
 * Apply wind to a grass field, updating each blade's lean based on wind direction and strength.
 * `windDir` is in radians (0 = +x axis direction).
 */
export function applyWind(
  field: GrassField,
  windDir: number,
  windStrength: number
): GrassField {
  const blades = field.blades.map((b) => ({
    ...b,
    lean: b.lean + windStrength * Math.cos(windDir) * 0.5,
  }));
  return { ...field, blades };
}
