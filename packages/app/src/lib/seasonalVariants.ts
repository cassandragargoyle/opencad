/**
 * T-SITE-V2-04: Seasonal variants and tree maturity stages.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type MaturityStage = 'sapling' | 'young' | 'mature' | 'ancient';

export interface SeasonalSpec {
  season: Season;
  /** CSS hex leaf colour. */
  leafColour: string;
  /** Canopy density 0–1. */
  canopyDensity: number;
  hasLeaves: boolean;
}

export interface MaturitySpec {
  stage: MaturityStage;
  /** Multiplier on base height. */
  heightMultiplier: number;
  /** Canopy radius in metres. */
  canopyRadiusM: number;
  /** Trunk diameter in metres. */
  trunkDiameterM: number;
}

export interface TreeGeometry {
  heightM: number;
  canopyRadiusM: number;
  trunkDiameterM: number;
  leafColour: string;
  canopyDensity: number;
}

// ── Canonical specs ───────────────────────────────────────────────────────────

export const SEASONAL_SPECS: Record<Season, SeasonalSpec> = {
  spring: {
    season: 'spring',
    leafColour: '#a8d870',
    canopyDensity: 0.6,
    hasLeaves: true,
  },
  summer: {
    season: 'summer',
    leafColour: '#2d7a2d',
    canopyDensity: 1.0,
    hasLeaves: true,
  },
  autumn: {
    season: 'autumn',
    leafColour: '#d4700a',
    canopyDensity: 0.7,
    hasLeaves: true,
  },
  winter: {
    season: 'winter',
    leafColour: '#888888',
    canopyDensity: 0.0,
    hasLeaves: false,
  },
};

export const MATURITY_SPECS: Record<MaturityStage, MaturitySpec> = {
  sapling: {
    stage: 'sapling',
    heightMultiplier: 0.15,
    canopyRadiusM: 0.3,
    trunkDiameterM: 0.03,
  },
  young: {
    stage: 'young',
    heightMultiplier: 0.45,
    canopyRadiusM: 1.5,
    trunkDiameterM: 0.1,
  },
  mature: {
    stage: 'mature',
    heightMultiplier: 1.0,
    canopyRadiusM: 4.0,
    trunkDiameterM: 0.35,
  },
  ancient: {
    stage: 'ancient',
    heightMultiplier: 1.3,
    canopyRadiusM: 6.5,
    trunkDiameterM: 0.8,
  },
};

/**
 * Compute the final tree geometry from a base height and specs.
 */
export function computeTreeGeometry(
  baseHeightM: number,
  stage: MaturityStage,
  season: Season
): TreeGeometry {
  const mat = MATURITY_SPECS[stage];
  const sea = SEASONAL_SPECS[season];
  return {
    heightM: baseHeightM * mat.heightMultiplier,
    canopyRadiusM: mat.canopyRadiusM,
    trunkDiameterM: mat.trunkDiameterM,
    leafColour: sea.leafColour,
    canopyDensity: sea.canopyDensity,
  };
}

// ── Season ordering for interpolation ────────────────────────────────────────
const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

function _hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function _rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function _lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two adjacent seasons at fraction `t` (0–1).
 * Returns a blended SeasonalSpec. If seasons are not adjacent, treats them
 * as the endpoints of the order cycle.
 */
export function lerpSeason(a: Season, b: Season, t: number): SeasonalSpec {
  const clampedT = Math.max(0, Math.min(1, t));
  const specA = SEASONAL_SPECS[a];
  const specB = SEASONAL_SPECS[b];

  const [rA, gA, bA] = _hexToRgb(specA.leafColour);
  const [rB, gBv, bB] = _hexToRgb(specB.leafColour);

  const leafColour = _rgbToHex(
    _lerpNum(rA, rB, clampedT),
    _lerpNum(gA, gBv, clampedT),
    _lerpNum(bA, bB, clampedT)
  );

  const canopyDensity = _lerpNum(specA.canopyDensity, specB.canopyDensity, clampedT);
  const hasLeaves = clampedT < 0.5 ? specA.hasLeaves : specB.hasLeaves;

  // Season label: use a or b based on which side of the midpoint
  const season = clampedT < 0.5 ? a : b;

  return { season, leafColour, canopyDensity, hasLeaves };
}

// Re-export for convenience
export { SEASON_ORDER };
