/**
 * T-ANA-04: Unit tests for EC3 methodology A1-A5 carbon reporting.
 */
import { describe, it, expect } from 'vitest';
import {
  EC3_EPDS,
  LIFECYCLE_STAGES,
  calcMaterialCarbon,
  summariseBuilding,
  benchmarkCarbon,
  RIBA_BENCHMARKS,
} from './carbon';

describe('T-ANA-04: EPD database', () => {
  it('EC3_EPDS has concrete and steel entries', () => {
    expect(EC3_EPDS['concrete-30mpa']).toBeDefined();
    expect(EC3_EPDS['steel-structural']).toBeDefined();
  });

  it('timber-glulam has negative A1 (biogenic carbon storage)', () => {
    expect(EC3_EPDS['timber-glulam']!.gwp.A1).toBeLessThan(0);
  });

  it('all EPDs have 5 lifecycle stages', () => {
    for (const epd of Object.values(EC3_EPDS)) {
      for (const stage of LIFECYCLE_STAGES) {
        expect(typeof epd.gwp[stage]).toBe('number');
      }
    }
  });
});

describe('T-ANA-04: calcMaterialCarbon()', () => {
  it('calculates total A1-A5 for concrete', () => {
    const result = calcMaterialCarbon({ epdId: 'concrete-30mpa', quantity: 10 });
    // A1=185+A2=4+A3=12+A4=8+A5=5 = 214 per m³, × 10 = 2140 kgCO₂e
    expect(result.totalA1A5).toBeCloseTo(2140, 0);
  });

  it('returns zero for unknown EPD', () => {
    const result = calcMaterialCarbon({ epdId: 'unknown-material', quantity: 100 });
    expect(result.totalA1A5).toBe(0);
  });

  it('each stage is correct fraction', () => {
    const result = calcMaterialCarbon({ epdId: 'steel-structural', quantity: 1000 });
    // A1 = 0.95 * 1000 = 950
    expect(result.stageEmissions.A1).toBeCloseTo(950, 1);
    // A3 = 0.45 * 1000 = 450
    expect(result.stageEmissions.A3).toBeCloseTo(450, 1);
  });

  it('transport override replaces A4', () => {
    const std      = calcMaterialCarbon({ epdId: 'concrete-30mpa', quantity: 1 });
    const nearsite = calcMaterialCarbon({ epdId: 'concrete-30mpa', quantity: 1, transportKm: 10 });
    // Near site should have much lower A4
    expect(nearsite.stageEmissions.A4).toBeLessThan(std.stageEmissions.A4);
  });

  it('preserves declared unit in result', () => {
    const result = calcMaterialCarbon({ epdId: 'concrete-30mpa', quantity: 5 });
    expect(result.declaredUnit).toBe('m3');
  });

  it('timber-clt total can be negative (carbon sink)', () => {
    const result = calcMaterialCarbon({ epdId: 'timber-clt', quantity: 10 });
    // A1 very negative, should dominate → total negative
    expect(result.stageEmissions.A1).toBeLessThan(0);
  });
});

describe('T-ANA-04: summariseBuilding()', () => {
  const quantities = [
    { epdId: 'concrete-30mpa', quantity: 100 },
    { epdId: 'steel-structural', quantity: 5000 },
    { epdId: 'gypsum-board', quantity: 500 },
  ];

  it('returns a total A1-A5 value', () => {
    const summary = summariseBuilding(quantities);
    expect(summary.totalA1A5_kgCO2e).toBeGreaterThan(0);
  });

  it('byStage sums to totalA1A5', () => {
    const summary = summariseBuilding(quantities);
    const stageSum = Object.values(summary.byStage).reduce((s, v) => s + v, 0);
    expect(stageSum).toBeCloseTo(summary.totalA1A5_kgCO2e, 1);
  });

  it('byCategory groups materials', () => {
    const summary = summariseBuilding(quantities);
    expect(summary.byCategory['Concrete']).toBeDefined();
    expect(summary.byCategory['Steel']).toBeDefined();
  });

  it('computes intensity per m² when GFA provided', () => {
    const summary = summariseBuilding(quantities, 1000);
    expect(summary.intensityPerM2).toBeDefined();
    expect(summary.intensityPerM2!).toBeCloseTo(summary.totalA1A5_kgCO2e / 1000, 2);
  });

  it('intensity is undefined when no GFA', () => {
    const summary = summariseBuilding(quantities);
    expect(summary.intensityPerM2).toBeUndefined();
  });

  it('handles empty quantities', () => {
    const summary = summariseBuilding([]);
    expect(summary.totalA1A5_kgCO2e).toBe(0);
    expect(summary.elements).toHaveLength(0);
  });
});

describe('T-ANA-04: RIBA benchmarks', () => {
  it('RIBA_BENCHMARKS has office entry', () => {
    expect(RIBA_BENCHMARKS['office']).toBeDefined();
    expect(RIBA_BENCHMARKS['office']!.target2030).toBe(350);
  });

  it('benchmarkCarbon passes low-carbon office', () => {
    const r = benchmarkCarbon(200, 'office');
    expect(r.meetsTarget2030).toBe(true);
    expect(r.meetsTarget2035).toBe(true);
    expect(r.benchmark).not.toBeNull();
  });

  it('benchmarkCarbon fails high-carbon office', () => {
    const r = benchmarkCarbon(500, 'office');
    expect(r.meetsTarget2030).toBe(false);
    expect(r.meetsTarget2035).toBe(false);
  });

  it('meets 2030 but not 2035', () => {
    const r = benchmarkCarbon(320, 'office'); // 350 > 320 > 300
    expect(r.meetsTarget2030).toBe(true);
    expect(r.meetsTarget2035).toBe(false);
  });

  it('returns null benchmark for unknown building type', () => {
    const r = benchmarkCarbon(300, 'unknown-type-xyz');
    expect(r.benchmark).toBeNull();
    expect(r.meetsTarget2030).toBe(false);
  });
});
