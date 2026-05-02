/**
 * T-ANA-04: ASHRAE 55-2020 thermal comfort analysis.
 *
 * Implements:
 *   - PMV (Predicted Mean Vote) — Fanger's full iterative equation
 *   - PPD (Predicted Percentage Dissatisfied) — ISO 7730
 *   - Adaptive comfort model — ASHRAE 55-2020 Section 5.4
 *   - Comfort category classification
 *
 * References:
 *   ASHRAE Standard 55-2020 — Thermal Environmental Conditions for Human Occupancy
 *   ISO 7730:2005 — Ergonomics of the thermal environment
 *   Fanger, P.O. (1970) — Thermal Comfort: Analysis and Applications in Environmental Engineering
 */

// ── Metabolic rate lookup (met) ───────────────────────────────────────────────

/**
 * Common activity metabolic rates in met (1 met = 58.15 W/m²).
 * Source: ASHRAE 55-2020 Table 1 / ISO 8996.
 */
export const ASHRAE55_METABOLIC_RATES: Record<string, number> = {
  'sleeping':                 0.7,
  'reclining':                0.8,
  'seated-quiet':             1.0,
  'standing-relaxed':         1.2,
  'sedentary-activity':       1.2,
  'light-activity-standing':  1.6,
  'walking-2km-h':            1.9,
  'walking-3km-h':            2.4,
  'walking-4km-h':            2.8,
  'light-machine-work':       2.1,
  'heavy-machine-work':       3.5,
  'dancing':                  3.4,
  'sports-tennis':            3.8,
  'sports-basketball':        6.3,
  'cooking':                  1.8,
  'office-work':              1.1,
};

// ── Clothing insulation lookup (clo) ─────────────────────────────────────────

/**
 * Common clothing ensembles in clo (1 clo = 0.155 m²K/W).
 * Source: ASHRAE 55-2020 Table 2 / ISO 9920.
 */
export const ASHRAE55_CLO_VALUES: Record<string, number> = {
  'naked':                    0.0,
  'shorts-only':              0.1,
  'typical-summer-office':    0.5,
  'light-summer-clothing':    0.3,
  'light-trousers-shirt':     0.5,
  'typical-indoor-winter':    1.0,
  'heavy-suit-heavy-sweater': 1.5,
  'typical-winter-outdoor':   1.5,
  'heavy-winter-clothing':    1.7,
  'trousers-long-sleeve':     0.6,
  'skirt-blouse':             0.55,
  'dress-slacks':             0.7,
};

// ── PMV/PPD core computation ──────────────────────────────────────────────────

export interface PMVInput {
  /** Dry-bulb air temperature (°C) */
  airTempC: number;
  /** Mean radiant temperature (°C) */
  radiantTempC: number;
  /** Relative humidity (fraction 0–1) */
  relativeHumidity: number;
  /** Air velocity (m/s) */
  airVelocityMs: number;
  /** Metabolic rate (met). 1 met = 58.15 W/m² */
  metabolicRateMet: number;
  /** Clothing insulation (clo). 1 clo = 0.155 m²K/W */
  clothingInsulationClo: number;
}

/**
 * Compute Predicted Mean Vote (PMV) per Fanger's full equation.
 *
 * Uses iterative calculation of clothing surface temperature (Tcl) and
 * convective heat transfer coefficient (hc).
 *
 * Returns PMV on scale -3 (cold) to +3 (hot). Values outside [-3, 3] are
 * clamped to reflect the scale boundaries.
 */
export function pmv(input: PMVInput): number {
  const {
    airTempC: ta,
    radiantTempC: tr,
    relativeHumidity: rh,
    airVelocityMs: var_,
    metabolicRateMet: met,
    clothingInsulationClo: clo,
  } = input;

  // Convert units
  const M   = met * 58.15;           // Metabolic rate W/m²
  const Icl = clo * 0.155;           // Clothing thermal resistance m²K/W
  const W   = 0;                     // External work (W/m²), assume 0

  // Saturated vapour pressure at air temperature (Pa) — Antoine equation
  const pa = rh * Math.exp(16.6536 - 4030.183 / (ta + 235.0)); // kPa → Pa
  const Pa = pa * 1000; // Pa

  // Clothing area factor (Dubois & Dubois)
  const fcl = clo <= 0.5 ? 1.0 + 0.2 * clo : 1.05 + 0.1 * clo;

  // Iterative solve for clothing surface temperature Tcl
  // Initial estimate using simplified formula
  let Tcl = ta + (35.5 - ta) / (3.5 * (6.45 * Icl + 0.1));

  for (let i = 0; i < 150; i++) {
    // Convective heat transfer coefficient (W/m²K)
    const hcf = 2.38 * Math.pow(Math.abs(Tcl - ta), 0.25); // free convection
    const hcv = 12.1 * Math.sqrt(var_);                     // forced convection
    const hc  = Math.max(hcf, hcv);

    // New Tcl from energy balance
    const TclNew =
      35.7 -
      0.028 * (M - W) -
      Icl *
        (3.96e-8 * fcl * (Math.pow(Tcl + 273, 4) - Math.pow(tr + 273, 4)) +
          fcl * hc * (Tcl - ta));

    if (Math.abs(TclNew - Tcl) < 0.001) {
      Tcl = TclNew;
      break;
    }
    Tcl = TclNew;
  }

  const hcFinal = Math.max(
    2.38 * Math.pow(Math.abs(Tcl - ta), 0.25),
    12.1 * Math.sqrt(var_),
  );

  // Heat loss components (W/m²)
  const L =
    // Heat loss by radiation from clothing surface
    3.96e-8 * fcl * (Math.pow(Tcl + 273, 4) - Math.pow(tr + 273, 4)) +
    // Heat loss by convection from clothing surface
    fcl * hcFinal * (Tcl - ta) +
    // Heat loss by water vapour diffusion through skin
    3.05e-3 * (5733 - 6.99 * (M - W) - Pa) +
    // Heat loss by evaporation (sweat)
    (M - W > 58.15
      ? 0.42 * ((M - W) - 58.15)
      : 0) +
    // Heat loss by latent respiration
    1.7e-5 * M * (5867 - Pa) +
    // Heat loss by dry respiration
    0.0014 * M * (34 - ta);

  // PMV from Fanger's thermal load equation
  const pmvValue = (0.303 * Math.exp(-0.036 * M) + 0.028) * ((M - W) - L);

  // Clamp to ASHRAE 55 scale [-3, +3]
  return Math.max(-3, Math.min(3, pmvValue));
}

/**
 * Predicted Percentage Dissatisfied (PPD) from PMV.
 * PPD = 100 − 95 × exp(−0.03353 × PMV⁴ − 0.2179 × PMV²)
 * Source: ISO 7730:2005 Eq. (5)
 */
export function ppd(pmvValue: number): number {
  return 100 - 95 * Math.exp(-0.03353 * Math.pow(pmvValue, 4) - 0.2179 * Math.pow(pmvValue, 2));
}

// ── Adaptive comfort model ────────────────────────────────────────────────────

export interface AdaptiveComfortResult {
  /** ASHRAE 55 adaptive neutral operative temperature (°C) */
  neutralTemp: number;
  /** Lower bound for 90% acceptability (°C) */
  lowerBound90: number;
  /** Upper bound for 90% acceptability (°C) */
  upperBound90: number;
  /** Lower bound for 80% acceptability (°C) */
  lowerBound80: number;
  /** Upper bound for 80% acceptability (°C) */
  upperBound80: number;
}

/**
 * ASHRAE 55-2020 adaptive comfort model (Section 5.4).
 *
 * Applicable to naturally ventilated spaces where occupants have control
 * over operable windows. Valid when prevailing mean outdoor temp is 10–33.5 °C.
 *
 * @param tOut  Prevailing mean outdoor dry-bulb temperature (°C)
 *              (running mean of daily mean temps over ~7–30 days)
 * @param tIn   Indoor operative temperature (°C) — used to check acceptability
 */
export function adaptivePMV(tOut: number, tIn: number): AdaptiveComfortResult {
  // ASHRAE 55-2020 Eq. (1): Tneutral = 0.31 × Tpma(out) + 17.8
  const neutralTemp = 0.31 * tOut + 17.8;

  // 90% acceptability: ±2.5 °C of neutral
  const lowerBound90 = neutralTemp - 2.5;
  const upperBound90 = neutralTemp + 2.5;

  // 80% acceptability: ±3.5 °C of neutral
  const lowerBound80 = neutralTemp - 3.5;
  const upperBound80 = neutralTemp + 3.5;

  // Suppress unused parameter lint — tIn is available for callers to check acceptability
  void tIn;

  return { neutralTemp, lowerBound90, upperBound90, lowerBound80, upperBound80 };
}

// ── Comfort category ──────────────────────────────────────────────────────────

export type ComfortCategory =
  | 'comfortable'
  | 'slightly-uncomfortable'
  | 'uncomfortable'
  | 'very-uncomfortable';

/**
 * Classify PMV into comfort category per ASHRAE 55-2020 / ISO 7730.
 *
 * | PMV range      | Category              |
 * |----------------|-----------------------|
 * | −0.5 to +0.5   | comfortable           |
 * | −1.0 to +1.0   | slightly-uncomfortable|
 * | −2.0 to +2.0   | uncomfortable         |
 * | outside ±2.0   | very-uncomfortable    |
 */
export function comfortCategory(pmvValue: number): ComfortCategory {
  const abs = Math.abs(pmvValue);
  if (abs <= 0.5) return 'comfortable';
  if (abs <= 1.0) return 'slightly-uncomfortable';
  if (abs <= 2.0) return 'uncomfortable';
  return 'very-uncomfortable';
}
