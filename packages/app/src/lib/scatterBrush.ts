/**
 * T-SITE-V2-01: Scatter brush for vegetation placement.
 * Supports Poisson-disk sampling (avoidOverlap) and uniform random placement.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface ScatterBrushConfig {
  /** Brush radius in world units. */
  radius: number;
  /** Target number of points per brush-radius² area. */
  density: number;
  /** Element types to scatter (chosen round-robin or randomly). */
  elementTypes: string[];
  /** Jitter factor 0–1 applied on top of placement. */
  jitter: number;
  /** Use Poisson-disk sampling to avoid overlap when true. */
  avoidOverlap: boolean;
}

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  elementType: string;
}

// ── Simple seeded LCG used internally for determinism ─────────────────────────
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let _idCounter = 0;
function makeId(): string {
  return `sp-${Date.now()}-${++_idCounter}`;
}

/**
 * Generate scatter points within a circle of `config.radius` centred on `center`.
 * Uses Poisson-disk sampling when `config.avoidOverlap` is true, otherwise
 * fills the area with `config.density` uniformly-random candidates.
 */
export function generateScatterPoints(
  center: Point2D,
  config: ScatterBrushConfig
): ScatterPoint[] {
  const { radius, density, elementTypes, jitter, avoidOverlap } = config;
  if (radius <= 0 || density <= 0 || elementTypes.length === 0) return [];

  const area = Math.PI * radius * radius;
  const count = Math.max(1, Math.round(density * area));
  const rng = lcg(Math.round(center.x * 1000 + center.y));

  if (avoidOverlap) {
    return _poissonDisk(center, radius, count, elementTypes, jitter, rng);
  }

  const points: ScatterPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * radius; // uniform in disk
    const j = jitter > 0 ? (rng() - 0.5) * 2 * jitter * (radius * 0.1) : 0;
    points.push({
      id: makeId(),
      x: center.x + r * Math.cos(angle) + j,
      y: center.y + r * Math.sin(angle) + j,
      rotation: rng() * 2 * Math.PI,
      scale: 0.8 + rng() * 0.4,
      elementType: elementTypes[i % elementTypes.length],
    });
  }
  return points;
}

function _poissonDisk(
  center: Point2D,
  radius: number,
  count: number,
  elementTypes: string[],
  jitter: number,
  rng: () => number
): ScatterPoint[] {
  // Minimum distance between points: heuristic based on density
  const minDist = radius / Math.sqrt(count + 1);
  const maxAttempts = 30;

  const placed: ScatterPoint[] = [];

  candidate: for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rng() * 2 * Math.PI;
      const r = Math.sqrt(rng()) * radius;
      const j = jitter > 0 ? (rng() - 0.5) * 2 * jitter * (radius * 0.05) : 0;
      const cx = center.x + r * Math.cos(angle) + j;
      const cy = center.y + r * Math.sin(angle) + j;

      let tooClose = false;
      for (const p of placed) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        if (dx * dx + dy * dy < minDist * minDist) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        placed.push({
          id: makeId(),
          x: cx,
          y: cy,
          rotation: rng() * 2 * Math.PI,
          scale: 0.8 + rng() * 0.4,
          elementType: elementTypes[i % elementTypes.length],
        });
        continue candidate;
      }
    }
    // Could not place without overlap — skip this candidate
  }
  return placed;
}

/**
 * Keep only the scatter points whose (x, y) lies inside `maskPolygon`
 * using the ray-casting algorithm.
 */
export function filterByMask(
  points: ScatterPoint[],
  maskPolygon: Point2D[]
): ScatterPoint[] {
  if (maskPolygon.length < 3) return [];
  return points.filter((p) => _pointInPolygon(p.x, p.y, maskPolygon));
}

function _pointInPolygon(px: number, py: number, poly: Point2D[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Merge two scatter batches, deduplicating by `id`.
 */
export function mergeScatterBatches(
  a: ScatterPoint[],
  b: ScatterPoint[]
): ScatterPoint[] {
  const seen = new Set<string>();
  const result: ScatterPoint[] = [];
  for (const p of [...a, ...b]) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      result.push(p);
    }
  }
  return result;
}
