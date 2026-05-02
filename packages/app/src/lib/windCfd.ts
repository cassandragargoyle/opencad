/**
 * T-ANA-06: Wind CFD utilities — façade pressure coefficients, pedestrian wind,
 * Lawson criteria, and Beaufort scale.
 *
 * Implements:
 *   - Wind rose and direction types
 *   - Façade pressure coefficient (Cp) estimation from wind tunnel literature
 *   - Street canyon pedestrian wind estimation
 *   - Lawson criteria classification
 *   - Beaufort scale lookup
 *
 * References:
 *   ASCE 7-22 Chapter 27 — Wind Loads: MWFRS Directional Procedure
 *   Lawson (1990) — Criteria for assessing the wind environment of pedestrians
 *   Davenport (1960) — Rationale for determining design wind velocities
 *   Cook (1985) — The Designer's Guide to Wind Loading of Building Structures
 */

// ── Wind direction types ──────────────────────────────────────────────────────

export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Convert a WindDirection cardinal to clockwise degrees from north.
 * N=0°, E=90°, S=180°, W=270°.
 */
export function windDirectionToAngle(dir: WindDirection): number {
  const map: Record<WindDirection, number> = {
    N:  0,
    NE: 45,
    E:  90,
    SE: 135,
    S:  180,
    SW: 225,
    W:  270,
    NW: 315,
  };
  return map[dir];
}

// ── Wind rose ─────────────────────────────────────────────────────────────────

/**
 * Wind rose: 8-direction wind statistics.
 * Directions are ordered N, NE, E, SE, S, SW, W, NW (indices 0–7).
 */
export interface WindRose {
  /** Mean wind speed per direction (m/s), indexed N→NW */
  speeds: [number, number, number, number, number, number, number, number];
  /** Frequency of occurrence per direction (fraction), must sum to ≈1 */
  frequencies: [number, number, number, number, number, number, number, number];
}

const WIND_ROSE_DIRS: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Find the dominant wind direction using the highest frequency × speed product.
 */
export function dominantWindDirection(rose: WindRose): WindDirection {
  let maxProduct  = -Infinity;
  let dominantIdx = 0;
  for (let i = 0; i < 8; i++) {
    const product = rose.frequencies[i] * rose.speeds[i];
    if (product > maxProduct) {
      maxProduct  = product;
      dominantIdx = i;
    }
  }
  return WIND_ROSE_DIRS[dominantIdx]!;
}

// ── Façade pressure coefficients ──────────────────────────────────────────────

export interface FacadePressure {
  /** Surface / face identifier */
  faceId: string;
  /** External pressure coefficient on windward face (positive = pressure) */
  windwardCoeff: number;
  /** External pressure coefficient on leeward face (negative = suction) */
  leewardCoeff: number;
}

/**
 * Estimate external pressure coefficients (Cp) for a rectangular building.
 *
 * Based on simplified wind tunnel data from Cook (1985) and ASCE 7-22 Fig. 27.3-1.
 * buildingAspect = width / depth (plan ratio in the wind direction).
 * windAngleDeg   = angle of attack clockwise from building long axis (0–90°).
 *
 * Returns nominal Cp values for windward and leeward faces.
 */
export function estimateFacadePressure(
  buildingAspect: number,
  windAngleDeg: number,
): FacadePressure {
  // Clamp aspect ratio to sensible range
  const aspect = Math.max(0.2, Math.min(5.0, buildingAspect));

  // Wind angle in [0°, 90°] by symmetry
  const theta = Math.abs(((windAngleDeg % 360) + 360) % 360);
  const effectiveAngle = theta <= 90 ? theta : theta <= 180 ? 180 - theta : theta <= 270 ? theta - 180 : 360 - theta;
  const angleRad = (effectiveAngle * Math.PI) / 180;

  // Windward Cp — interpolate between normal-incidence Cp and oblique-incidence minimum
  // ASCE 7-22 windward Cp = 0.8 at 0°, reduces with angle
  const cpWindwardBase = 0.8;
  const cpWindward = cpWindwardBase * Math.cos(angleRad);

  // Leeward Cp — function of aspect ratio (from ASCE 7-22 Figure 27.3-1)
  // L/B (depth/width) = 1/aspect
  const lBRatio = 1 / aspect;
  let cpLeewardBase: number;
  if (lBRatio <= 1.0)       cpLeewardBase = -0.5;
  else if (lBRatio <= 2.0)  cpLeewardBase = -0.3;
  else                      cpLeewardBase = -0.2;

  // Side walls are suction at all angles
  const cpLeeward = cpLeewardBase;

  return {
    faceId:        'primary',
    windwardCoeff: Math.round(cpWindward * 1000) / 1000,
    leewardCoeff:  Math.round(cpLeeward  * 1000) / 1000,
  };
}

// ── Pedestrian wind estimation ────────────────────────────────────────────────

export interface PedestrianPoint {
  x: number;
  y: number;
  /** Estimated pedestrian-level wind speed (m/s) */
  windSpeedMs: number;
  /** Lawson comfort category at this point */
  lawsonCategory: LawsonCriteria;
}

/**
 * Estimate pedestrian-level wind speed using a street canyon / building wake model.
 *
 * Based on Lawson & Penwarden (1975) and Oke (1988) canyon flow regimes.
 *
 * Model: wind speed at pedestrian height (1.5 m) in the wake of a building is
 * reduced by a factor dependent on building height and setback distance.
 *
 *   U_ped = U_ref × (1.5 / buildingHeight)^α × reductionFactor
 *
 * where α = 0.25 (power law exponent for suburban terrain, ASCE 7-22 exposure B).
 *
 * @param buildingHeight  Building height (m)
 * @param setbackM        Distance from building face to pedestrian point (m)
 * @param freeStreamMs    Unobstructed free-stream wind speed at 10 m (m/s)
 */
export function computePedestrianWind(
  buildingHeight: number,
  setbackM: number,
  freeStreamMs: number,
): PedestrianPoint {
  const alpha = 0.25; // power law exponent, suburban terrain

  // Reference height wind speed at building height (profile extrapolation)
  const uAtBuildingH = freeStreamMs * Math.pow(buildingHeight / 10, alpha);

  // Canyon reduction factor: decreases with setback-to-height ratio
  const hToSRatio = buildingHeight / Math.max(1, setbackM);
  let reductionFactor: number;

  if (hToSRatio >= 3.0) {
    // Deep canyon — strong channelling, little reduction of street-level wind
    reductionFactor = 0.9;
  } else if (hToSRatio >= 1.0) {
    // Transitional canyon regime
    reductionFactor = 0.5 + 0.4 * (hToSRatio - 1.0) / 2.0;
  } else {
    // Isolated building wake — significant speed reduction
    reductionFactor = 0.3 + 0.2 * hToSRatio;
  }

  // Wind speed at pedestrian height (1.5 m) using power law
  const uPed = uAtBuildingH * Math.pow(1.5 / buildingHeight, alpha) * reductionFactor;
  const windSpeedMs = Math.max(0, uPed);

  return {
    x: setbackM,
    y: 0,
    windSpeedMs: Math.round(windSpeedMs * 100) / 100,
    lawsonCategory: lawsonCategory(windSpeedMs),
  };
}

// ── Lawson criteria ───────────────────────────────────────────────────────────

/**
 * Lawson pedestrian wind comfort categories.
 * A = suitable for sitting/outdoor dining (lowest wind)
 * E = unsafe for pedestrians (highest wind)
 */
export type LawsonCriteria = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * Classify mean hourly wind speed into Lawson comfort categories.
 *
 * Thresholds based on Lawson (1990) and City of London wind microclimate guidelines:
 *   A: < 2 m/s  — sitting comfort (cafés, benches)
 *   B: 2–4 m/s  — standing comfort (bus stops, entrances)
 *   C: 4–6 m/s  — walking comfort (footpaths, retail)
 *   D: 6–8 m/s  — uncomfortable for walking
 *   E: > 8 m/s  — unsafe (potential hazard)
 */
export function lawsonCategory(windSpeedMs: number): LawsonCriteria {
  if (windSpeedMs < 2)  return 'A';
  if (windSpeedMs < 4)  return 'B';
  if (windSpeedMs < 6)  return 'C';
  if (windSpeedMs < 8)  return 'D';
  return 'E';
}

// ── Beaufort scale ────────────────────────────────────────────────────────────

export interface BeaufortEntry {
  force: number;
  description: string;
  /** Maximum wind speed for this Beaufort force (m/s) */
  maxSpeedMs: number;
}

/**
 * Beaufort wind scale (WMO), forces 0–12.
 * maxSpeedMs is the upper boundary; force 12 has Infinity.
 */
export const BEAUFORT_SCALE: BeaufortEntry[] = [
  { force: 0,  description: 'Calm',               maxSpeedMs: 0.2   },
  { force: 1,  description: 'Light air',           maxSpeedMs: 1.5   },
  { force: 2,  description: 'Light breeze',        maxSpeedMs: 3.3   },
  { force: 3,  description: 'Gentle breeze',       maxSpeedMs: 5.4   },
  { force: 4,  description: 'Moderate breeze',     maxSpeedMs: 7.9   },
  { force: 5,  description: 'Fresh breeze',        maxSpeedMs: 10.7  },
  { force: 6,  description: 'Strong breeze',       maxSpeedMs: 13.8  },
  { force: 7,  description: 'Near gale',           maxSpeedMs: 17.1  },
  { force: 8,  description: 'Gale',                maxSpeedMs: 20.7  },
  { force: 9,  description: 'Severe gale',         maxSpeedMs: 24.4  },
  { force: 10, description: 'Storm',               maxSpeedMs: 28.4  },
  { force: 11, description: 'Violent storm',       maxSpeedMs: 32.6  },
  { force: 12, description: 'Hurricane force',     maxSpeedMs: Infinity },
];

/**
 * Return Beaufort force number (0–12) for a given wind speed in m/s.
 */
export function beaufortForce(speedMs: number): number {
  for (const entry of BEAUFORT_SCALE) {
    if (speedMs <= entry.maxSpeedMs) return entry.force;
  }
  return 12;
}
