/**
 * T-ANA-03: Sabine reverberation time + STC report.
 *
 * Implements:
 *   - Sabine formula: T60 = 0.161 * V / (A + 4mV) [ISO 3382-2]
 *   - Eyring formula: T60 = 0.161 * V / (-S * ln(1 - α_avg) + 4mV)
 *   - STC (Sound Transmission Class) estimation from wall construction
 *   - Noise Reduction computation between adjacent spaces
 *   - Room acoustics suitability check against ANSI/ASA S12.60 for classrooms
 *
 * References:
 *   ISO 3382-2:2008 — Measurement of room acoustic parameters
 *   Sabine (1900) — Reverberation and the art of architectural acoustics
 *   ANSI/ASA S12.60-2010 — Acoustical performance criteria for schools
 */

// ── Material absorption coefficients ─────────────────────────────────────────

/** Octave-band center frequencies (Hz) used throughout. */
export const OCTAVE_BANDS = [125, 250, 500, 1000, 2000, 4000] as const;
export type OctaveBand = typeof OCTAVE_BANDS[number];

/** Sound absorption coefficients per octave band (αs). */
export type AbsorptionCoeffs = Record<OctaveBand, number>;

/** Common material absorption coefficients. */
export const MATERIAL_ABSORPTION: Record<string, AbsorptionCoeffs> = {
  'concrete-bare': {
    125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.03, 4000: 0.03,
  },
  'brick-painted': {
    125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.02, 4000: 0.03,
  },
  'carpet-heavy': {
    125: 0.02, 250: 0.06, 500: 0.14, 1000: 0.37, 2000: 0.60, 4000: 0.65,
  },
  'acoustic-tile-suspended': {
    125: 0.25, 250: 0.45, 500: 0.81, 1000: 0.97, 2000: 0.93, 4000: 0.82,
  },
  'glass-single': {
    125: 0.35, 250: 0.25, 500: 0.18, 1000: 0.12, 2000: 0.07, 4000: 0.04,
  },
  'glass-double': {
    125: 0.20, 250: 0.15, 500: 0.10, 1000: 0.07, 2000: 0.05, 4000: 0.04,
  },
  'gypsum-board': {
    125: 0.29, 250: 0.10, 500: 0.05, 1000: 0.04, 2000: 0.07, 4000: 0.09,
  },
  'wood-floor-hard': {
    125: 0.04, 250: 0.04, 500: 0.07, 1000: 0.06, 2000: 0.06, 4000: 0.07,
  },
  'audience-seated': {
    125: 0.60, 250: 0.74, 500: 0.88, 1000: 0.96, 2000: 0.93, 4000: 0.85,
  },
};

// ── Reverberation time (T60) ──────────────────────────────────────────────────

export interface RoomAcousticsInput {
  /** Room volume (m³) */
  volumeM3: number;
  /** Total room surface area (m²) */
  totalSurfaceM2: number;
  /** Surface material assignments: surface area (m²) per material name */
  surfaces: Array<{ materialName: string; areaSqM: number }>;
  /** Air absorption coefficient m (per metre): 0.006 at 20°C (use 0 to ignore) */
  airAbsorption?: number;
}

/** Compute Sabine T60 (seconds) per octave band. */
export function sabineT60(input: RoomAcousticsInput): Record<OctaveBand, number> {
  const m = input.airAbsorption ?? 0;
  const V = input.volumeM3;
  const result = {} as Record<OctaveBand, number>;

  for (const band of OCTAVE_BANDS) {
    // Total absorption A = sum(alpha_i * S_i) for each surface
    let A = 0;
    for (const surf of input.surfaces) {
      const coeffs = MATERIAL_ABSORPTION[surf.materialName];
      const alpha  = coeffs ? coeffs[band] : 0.05; // default 0.05 for unknown materials
      A += alpha * surf.areaSqM;
    }

    const T60 = A + 4 * m * V > 0 ? (0.161 * V) / (A + 4 * m * V) : Infinity;
    result[band] = T60;
  }
  return result;
}

/** Compute Eyring T60 (seconds) per octave band. */
export function eyringT60(input: RoomAcousticsInput): Record<OctaveBand, number> {
  const m = input.airAbsorption ?? 0;
  const V = input.volumeM3;
  const S = input.totalSurfaceM2;
  const result = {} as Record<OctaveBand, number>;

  for (const band of OCTAVE_BANDS) {
    let sumAlpha = 0;
    for (const surf of input.surfaces) {
      const coeffs = MATERIAL_ABSORPTION[surf.materialName];
      const alpha  = coeffs ? coeffs[band] : 0.05;
      sumAlpha += alpha * surf.areaSqM;
    }
    const avgAlpha = S > 0 ? sumAlpha / S : 0;
    const eyring   = -S * Math.log(Math.max(1e-10, 1 - avgAlpha));
    const T60      = eyring + 4 * m * V > 0 ? (0.161 * V) / (eyring + 4 * m * V) : Infinity;
    result[band] = T60;
  }
  return result;
}

// ── STC estimation ────────────────────────────────────────────────────────────

/** Common partition STC values. */
export const PARTITION_STC: Record<string, number> = {
  'gypsum-single-stud':        33,
  'gypsum-double-layer':       40,
  'gypsum-double-stud':        55,
  'cmu-8in-unpainted':         49,
  'cmu-8in-painted':           51,
  'poured-concrete-200mm':     55,
  'glass-single-6mm':          27,
  'glass-double-igs':          34,
  'solid-wood-door-50mm':      30,
  'hollow-core-door':          20,
  'exterior-wall-typical':     50,
};

/**
 * Estimate STC for a composite partition.
 * For composite partitions (e.g., wall + window) the weakest element
 * controls; this approximation is conservative but practical.
 */
export interface CompositeElement {
  materialName: string;
  areaSqM: number;
}

export function estimateCompositeSTC(elements: CompositeElement[]): number {
  if (elements.length === 0) return 0;

  // Sound transmission loss TL: STC approximation
  const tls = elements.map((e) => {
    const stc = PARTITION_STC[e.materialName] ?? 30; // default 30 for unknown
    return { tl: stc, area: e.areaSqM };
  });

  const totalArea = tls.reduce((s, e) => s + e.area, 0);
  if (totalArea <= 0) return tls[0]?.tl ?? 30;

  // Composite TL: TL_composite = -10 * log10(sum(tau_i * S_i) / S)
  // tau = 10^(-TL/10)
  const tauSum = tls.reduce((s, e) => s + Math.pow(10, -e.tl / 10) * e.area, 0);
  const compositeTL = -10 * Math.log10(tauSum / totalArea);
  return Math.round(compositeTL);
}

// ── Noise reduction between spaces ───────────────────────────────────────────

/**
 * Compute noise reduction (NR) from room A to room B through a common partition.
 * NR = STC + 10*log10(A_B / S_p)
 * where A_B = total absorption in receiving room (m²), S_p = partition area (m²).
 */
export function noiseReduction(
  stc: number,
  receivingRoomAbsorption: number, // m² of absorption (Sabine)
  partitionAreaM2: number,
): number {
  if (partitionAreaM2 <= 0 || receivingRoomAbsorption <= 0) return stc;
  return stc + 10 * Math.log10(receivingRoomAbsorption / partitionAreaM2);
}

// ── ANSI S12.60 classroom compliance ─────────────────────────────────────────

export interface ClassroomAcousticsResult {
  /** T60 at 500 Hz (s) */
  T60_500: number;
  /** T60 at 1000 Hz (s) */
  T60_1000: number;
  /** Meets ANSI S12.60 T60 ≤ 0.6s requirement */
  T60Compliant: boolean;
  /** Background noise level (dBA) — not calculated here, just stored */
  backgroundNoiseDBA?: number;
  /** Meets ANSI S12.60 noise ≤ 35 dBA requirement */
  noiseCompliant?: boolean;
  issues: string[];
}

/** T60 limit for core learning spaces ≤ 283 m³ per ANSI S12.60 (s). */
const ANSI_T60_LIMIT = 0.6;
const ANSI_NOISE_LIMIT = 35; // dBA

export function checkClassroomAcoustics(
  t60Map: Record<OctaveBand, number>,
  backgroundNoiseDBA?: number,
): ClassroomAcousticsResult {
  const issues: string[] = [];
  const T60_500  = t60Map[500]  ?? Infinity;
  const T60_1000 = t60Map[1000] ?? Infinity;
  const T60Compliant = T60_500 <= ANSI_T60_LIMIT && T60_1000 <= ANSI_T60_LIMIT;

  if (!T60Compliant) {
    issues.push(
      `T60 exceeds ${ANSI_T60_LIMIT}s limit: 500Hz=${T60_500.toFixed(2)}s, 1000Hz=${T60_1000.toFixed(2)}s`,
    );
  }

  let noiseCompliant: boolean | undefined;
  if (backgroundNoiseDBA !== undefined) {
    noiseCompliant = backgroundNoiseDBA <= ANSI_NOISE_LIMIT;
    if (!noiseCompliant) {
      issues.push(`Background noise ${backgroundNoiseDBA} dBA exceeds ${ANSI_NOISE_LIMIT} dBA limit`);
    }
  }

  return { T60_500, T60_1000, T60Compliant, backgroundNoiseDBA, noiseCompliant, issues };
}
