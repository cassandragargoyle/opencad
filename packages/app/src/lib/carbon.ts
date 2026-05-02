/**
 * T-ANA-04: EC3 methodology A1-A5 lifecycle carbon reporting.
 *
 * Implements embodied carbon calculation following the EC3 (Embodied Carbon
 * in Construction Calculator) methodology and EN 15978 lifecycle stages:
 *
 *   A1 — Raw material supply (extraction + processing)
 *   A2 — Transport to manufacturer
 *   A3 — Manufacturing
 *   A4 — Transport to site
 *   A5 — Installation into the building
 *
 * Emissions factors are expressed as kgCO₂e per declared unit (kg, m², m³).
 *
 * References:
 *   EN 15978:2011 — Sustainability of construction works
 *   EC3 tool: https://buildingtransparency.org/ec3
 *   CIBSE TM65 (2021) — Embodied carbon in building services
 */

// ── Declared units ────────────────────────────────────────────────────────────

export type DeclaredUnit = 'kg' | 'm2' | 'm3' | 'each' | 'lm';

// ── EPD data record ───────────────────────────────────────────────────────────

export interface EPDRecord {
  id: string;
  /** Material / product name */
  name: string;
  category: string;
  /** Functional unit for the GWP values */
  declaredUnit: DeclaredUnit;
  /** Global Warming Potential per declared unit — A1-A5 stages (kgCO₂e / unit) */
  gwp: {
    A1: number;
    A2: number;
    A3: number;
    A4: number;
    A5: number;
  };
  /** Mass per declared unit (kg/unit) — used for A4 transport calculation */
  massPerUnit: number;
  /** Plant-to-site transport distance (km) — default 160 km (EC3 conservative) */
  transportKm?: number;
  /** Source: 'epd' | 'industry-average' | 'conservative' */
  source: 'epd' | 'industry-average' | 'conservative';
}

/** EC3 industry-average GWP factors for common structural/envelope materials. */
export const EC3_EPDS: Record<string, EPDRecord> = {
  'concrete-30mpa': {
    id: 'concrete-30mpa',
    name: 'Ready-mix Concrete 30 MPa',
    category: 'Concrete',
    declaredUnit: 'm3',
    gwp: { A1: 185, A2: 4, A3: 12, A4: 8, A5: 5 },
    massPerUnit: 2400,
    source: 'industry-average',
  },
  'concrete-50mpa': {
    id: 'concrete-50mpa',
    name: 'Ready-mix Concrete 50 MPa',
    category: 'Concrete',
    declaredUnit: 'm3',
    gwp: { A1: 250, A2: 4, A3: 15, A4: 8, A5: 5 },
    massPerUnit: 2450,
    source: 'industry-average',
  },
  'steel-structural': {
    id: 'steel-structural',
    name: 'Structural Steel (hot-rolled)',
    category: 'Steel',
    declaredUnit: 'kg',
    gwp: { A1: 0.95, A2: 0.02, A3: 0.45, A4: 0.03, A5: 0.01 },
    massPerUnit: 1,
    source: 'industry-average',
  },
  'steel-rebar': {
    id: 'steel-rebar',
    name: 'Reinforcing Steel',
    category: 'Steel',
    declaredUnit: 'kg',
    gwp: { A1: 0.75, A2: 0.01, A3: 0.30, A4: 0.02, A5: 0.01 },
    massPerUnit: 1,
    source: 'industry-average',
  },
  'timber-glulam': {
    id: 'timber-glulam',
    name: 'Glue-laminated Timber (GLT)',
    category: 'Timber',
    declaredUnit: 'm3',
    gwp: { A1: -570, A2: 5, A3: 25, A4: 15, A5: 5 }, // carbon-storing: A1 negative
    massPerUnit: 500,
    source: 'industry-average',
  },
  'timber-clt': {
    id: 'timber-clt',
    name: 'Cross-laminated Timber (CLT)',
    category: 'Timber',
    declaredUnit: 'm3',
    gwp: { A1: -700, A2: 6, A3: 30, A4: 18, A5: 8 },
    massPerUnit: 490,
    source: 'industry-average',
  },
  'masonry-cmu': {
    id: 'masonry-cmu',
    name: 'Concrete Masonry Unit (8 in)',
    category: 'Masonry',
    declaredUnit: 'm2',
    gwp: { A1: 18, A2: 1, A3: 3, A4: 2, A5: 1 },
    massPerUnit: 70,
    source: 'industry-average',
  },
  'gypsum-board': {
    id: 'gypsum-board',
    name: 'Gypsum Wallboard (12.7mm)',
    category: 'Interior Finishes',
    declaredUnit: 'm2',
    gwp: { A1: 1.8, A2: 0.1, A3: 0.5, A4: 0.2, A5: 0.1 },
    massPerUnit: 10.5,
    source: 'industry-average',
  },
  'insulation-mineral-wool': {
    id: 'insulation-mineral-wool',
    name: 'Mineral Wool Insulation (100mm)',
    category: 'Insulation',
    declaredUnit: 'm2',
    gwp: { A1: 2.5, A2: 0.2, A3: 1.5, A4: 0.3, A5: 0.1 },
    massPerUnit: 8,
    source: 'industry-average',
  },
  'glass-curtain-wall': {
    id: 'glass-curtain-wall',
    name: 'Curtain Wall System (IGU + frame)',
    category: 'Glazing',
    declaredUnit: 'm2',
    gwp: { A1: 80, A2: 2, A3: 30, A4: 5, A5: 3 },
    massPerUnit: 50,
    source: 'industry-average',
  },
};

// ── Carbon calculation ────────────────────────────────────────────────────────

export type LifecycleStage = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
export const LIFECYCLE_STAGES: LifecycleStage[] = ['A1', 'A2', 'A3', 'A4', 'A5'];

export interface MaterialQuantity {
  epdId: string;
  /** Quantity in declared units */
  quantity: number;
  /** Optional transport override (km) */
  transportKm?: number;
}

export interface ElementCarbonResult {
  epdId: string;
  materialName: string;
  quantity: number;
  declaredUnit: DeclaredUnit;
  /** kgCO₂e per stage */
  stageEmissions: Record<LifecycleStage, number>;
  /** Total A1-A5 kgCO₂e */
  totalA1A5: number;
}

/**
 * Calculate embodied carbon for a material quantity.
 * Transport A4 may be overridden by providing `transportKm`.
 * A4 = massPerUnit * quantity * transportKm * 0.0001 kgCO₂e/kg·km (lorry, EC3 default)
 */
export function calcMaterialCarbon(
  q: MaterialQuantity,
  epds: Record<string, EPDRecord> = EC3_EPDS,
): ElementCarbonResult {
  const epd = epds[q.epdId];
  if (!epd) {
    return {
      epdId: q.epdId,
      materialName: q.epdId,
      quantity: q.quantity,
      declaredUnit: 'kg',
      stageEmissions: { A1: 0, A2: 0, A3: 0, A4: 0, A5: 0 },
      totalA1A5: 0,
    };
  }

  const stageEmissions = {} as Record<LifecycleStage, number>;
  for (const stage of LIFECYCLE_STAGES) {
    if (stage === 'A4' && q.transportKm !== undefined) {
      // Override A4 with user-supplied transport distance
      // Standard road freight: 0.0001 kgCO₂e / kg·km
      const massTotal = epd.massPerUnit * q.quantity;
      stageEmissions.A4 = massTotal * q.transportKm * 0.0001;
    } else {
      stageEmissions[stage] = epd.gwp[stage] * q.quantity;
    }
  }

  const totalA1A5 = Object.values(stageEmissions).reduce((s, v) => s + v, 0);
  return {
    epdId: q.epdId,
    materialName: epd.name,
    quantity: q.quantity,
    declaredUnit: epd.declaredUnit,
    stageEmissions,
    totalA1A5,
  };
}

// ── Building-level summary ────────────────────────────────────────────────────

export interface BuildingCarbonSummary {
  /** Total A1-A5 embodied carbon (kgCO₂e) */
  totalA1A5_kgCO2e: number;
  /** Per-stage totals (kgCO₂e) */
  byStage: Record<LifecycleStage, number>;
  /** Per-category totals (kgCO₂e) */
  byCategory: Record<string, number>;
  /** Intensity: kgCO₂e / m² GFA */
  intensityPerM2?: number;
  /** Per-element results */
  elements: ElementCarbonResult[];
}

export function summariseBuilding(
  quantities: MaterialQuantity[],
  grossFloorAreaM2?: number,
  epds: Record<string, EPDRecord> = EC3_EPDS,
): BuildingCarbonSummary {
  const elements = quantities.map((q) => calcMaterialCarbon(q, epds));

  const byStage = LIFECYCLE_STAGES.reduce((acc, stage) => {
    acc[stage] = elements.reduce((s, el) => s + el.stageEmissions[stage], 0);
    return acc;
  }, {} as Record<LifecycleStage, number>);

  const totalA1A5 = Object.values(byStage).reduce((s, v) => s + v, 0);

  const byCategory: Record<string, number> = {};
  for (const el of elements) {
    const epd = epds[el.epdId];
    const cat = epd?.category ?? 'Other';
    byCategory[cat] = (byCategory[cat] ?? 0) + el.totalA1A5;
  }

  const intensityPerM2 = grossFloorAreaM2 && grossFloorAreaM2 > 0
    ? totalA1A5 / grossFloorAreaM2
    : undefined;

  return { totalA1A5_kgCO2e: totalA1A5, byStage, byCategory, intensityPerM2, elements };
}

// ── Benchmark comparison ──────────────────────────────────────────────────────

/**
 * RIBA 2030 Climate Challenge benchmarks (kgCO₂e/m² GFA) by building type.
 */
export const RIBA_BENCHMARKS: Record<string, { target2030: number; target2035: number }> = {
  'office':       { target2030: 350, target2035: 300 },
  'residential':  { target2030: 300, target2035: 250 },
  'education':    { target2030: 350, target2035: 300 },
  'healthcare':   { target2030: 400, target2035: 350 },
  'retail':       { target2030: 400, target2035: 350 },
  'industrial':   { target2030: 450, target2035: 400 },
};

export function benchmarkCarbon(
  intensityKgCO2ePerM2: number,
  buildingType: string,
): { meetsTarget2030: boolean; meetsTarget2035: boolean; benchmark: typeof RIBA_BENCHMARKS[string] | null } {
  const benchmark = RIBA_BENCHMARKS[buildingType] ?? null;
  if (!benchmark) return { meetsTarget2030: false, meetsTarget2035: false, benchmark: null };
  return {
    meetsTarget2030:  intensityKgCO2ePerM2 <= benchmark.target2030,
    meetsTarget2035:  intensityKgCO2ePerM2 <= benchmark.target2035,
    benchmark,
  };
}
