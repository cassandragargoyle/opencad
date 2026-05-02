/**
 * T-ANA-04: ASHRAE 55-2020 thermal comfort analysis tests.
 */
import { describe, it, expect } from 'vitest';
import {
  pmv,
  ppd,
  adaptivePMV,
  comfortCategory,
  ASHRAE55_METABOLIC_RATES,
  ASHRAE55_CLO_VALUES,
  type PMVInput,
} from './thermalComfort';

const neutralInput: PMVInput = {
  airTempC: 22,
  radiantTempC: 22,
  relativeHumidity: 0.5,
  airVelocityMs: 0.1,
  metabolicRateMet: 1.2,
  clothingInsulationClo: 0.5,
};

describe('T-ANA-04: pmv()', () => {
  it('returns a value in [-3, 3] for typical conditions', () => {
    const v = pmv(neutralInput);
    expect(v).toBeGreaterThanOrEqual(-3);
    expect(v).toBeLessThanOrEqual(3);
  });

  it('neutral conditions produce PMV near 0', () => {
    // Fanger neutral is ~24.5°C at 1.2 met, 0.5 clo, 0.1 m/s, 50% RH
    const v = pmv({ ...neutralInput, airTempC: 24.5, radiantTempC: 24.5 });
    expect(Math.abs(v)).toBeLessThan(0.2);
  });

  it('hot conditions produce positive PMV', () => {
    const v = pmv({ ...neutralInput, airTempC: 32, radiantTempC: 32 });
    expect(v).toBeGreaterThan(1);
  });

  it('cold conditions produce negative PMV', () => {
    const v = pmv({ ...neutralInput, airTempC: 10, radiantTempC: 10 });
    expect(v).toBeLessThan(-1);
  });

  it('higher metabolic rate reduces cold PMV magnitude', () => {
    const coldBase = pmv({ ...neutralInput, airTempC: 15, radiantTempC: 15, metabolicRateMet: 1.0 });
    const coldHigh = pmv({ ...neutralInput, airTempC: 15, radiantTempC: 15, metabolicRateMet: 2.5 });
    expect(coldHigh).toBeGreaterThan(coldBase);
  });
});

describe('T-ANA-04: ppd()', () => {
  it('PPD is ~5% at PMV=0', () => {
    expect(ppd(0)).toBeCloseTo(5, 0);
  });

  it('PPD increases away from neutral', () => {
    expect(ppd(1)).toBeGreaterThan(ppd(0));
    expect(ppd(-1)).toBeGreaterThan(ppd(0));
  });

  it('PPD near max at PMV=±3', () => {
    expect(ppd(3)).toBeGreaterThan(90);
    expect(ppd(-3)).toBeGreaterThan(90);
  });

  it('PPD is symmetric around 0', () => {
    expect(ppd(1)).toBeCloseTo(ppd(-1), 1);
  });
});

describe('T-ANA-04: adaptivePMV()', () => {
  it('neutral temperature follows ASHRAE 55 equation', () => {
    const r = adaptivePMV(20, 22);
    expect(r.neutralTemp).toBeCloseTo(0.31 * 20 + 17.8, 1);
  });

  it('90% acceptability band is ±2.5°C', () => {
    const r = adaptivePMV(20, 22);
    expect(r.upperBound90 - r.neutralTemp).toBeCloseTo(2.5, 5);
    expect(r.neutralTemp - r.lowerBound90).toBeCloseTo(2.5, 5);
  });

  it('80% acceptability band is ±3.5°C', () => {
    const r = adaptivePMV(20, 22);
    expect(r.upperBound80 - r.neutralTemp).toBeCloseTo(3.5, 5);
    expect(r.neutralTemp - r.lowerBound80).toBeCloseTo(3.5, 5);
  });

  it('returns result object with expected keys', () => {
    const r = adaptivePMV(20, 22);
    expect(r).toHaveProperty('neutralTemp');
    expect(r).toHaveProperty('lowerBound90');
    expect(r).toHaveProperty('upperBound90');
    expect(r).toHaveProperty('lowerBound80');
    expect(r).toHaveProperty('upperBound80');
  });
});

describe('T-ANA-04: comfortCategory()', () => {
  it('PMV in [-0.5, 0.5] is comfortable', () => {
    expect(comfortCategory(0)).toBe('comfortable');
    expect(comfortCategory(0.4)).toBe('comfortable');
    expect(comfortCategory(-0.4)).toBe('comfortable');
  });

  it('PMV in (0.5, 1.0] is slightly-uncomfortable', () => {
    expect(comfortCategory(0.7)).toBe('slightly-uncomfortable');
    expect(comfortCategory(-0.7)).toBe('slightly-uncomfortable');
  });

  it('PMV in (1.0, 2.0] is uncomfortable', () => {
    expect(comfortCategory(1.5)).toBe('uncomfortable');
    expect(comfortCategory(-1.5)).toBe('uncomfortable');
  });

  it('PMV beyond ±2 is very-uncomfortable', () => {
    expect(comfortCategory(2.5)).toBe('very-uncomfortable');
    expect(comfortCategory(-2.5)).toBe('very-uncomfortable');
  });
});

describe('T-ANA-04: lookup tables', () => {
  it('ASHRAE55_METABOLIC_RATES has seated-quiet = 1.0', () => {
    expect(ASHRAE55_METABOLIC_RATES['seated-quiet']).toBe(1.0);
  });

  it('ASHRAE55_CLO_VALUES has typical-summer-office = 0.5', () => {
    expect(ASHRAE55_CLO_VALUES['typical-summer-office']).toBe(0.5);
  });
});
