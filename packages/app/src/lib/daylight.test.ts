/**
 * T-ANA-01: Unit tests for climate-based daylight engine.
 */
import { describe, it, expect } from 'vitest';
import {
  parseEPW,
  solarAngles,
  perezIlluminance,
  tregenzaWeights,
  TREGENZA_PATCH_COUNT,
  generateGrid,
  computeMetrics,
  aggregateSpaceMetrics,
  estimatePointIlluminance,
} from './daylight';

// ── EPW parser ────────────────────────────────────────────────────────────────

const MINIMAL_EPW = `LOCATION,Chicago,IL,USA,TMY3,725300,41.98,-87.92,-6.0,201.0
DESIGN CONDITIONS,0
TYPICAL/EXTREME PERIODS,0
GROUND TEMPERATURES,0
HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0
COMMENTS 1,Custom/User Format
COMMENTS 2,
DATA PERIODS,1,1,Data,Sunday,1/1,12/31
1985,1,1,1,0,?9?9?9?9E0?9?9?9?9?9?9?9?9?9?9?9?9?9?9?9*9*9?9*9*9,-6.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,300,0,80,0,0,0,0,0,0,0,0,0,0,0
`;

describe('T-ANA-01: EPW parser', () => {
  it('parses LOCATION metadata', () => {
    const epw = parseEPW(MINIMAL_EPW);
    expect(epw.metadata.city).toBe('Chicago');
    expect(epw.metadata.country).toBe('USA');
    expect(epw.metadata.latitude).toBeCloseTo(41.98, 2);
    expect(epw.metadata.longitude).toBeCloseTo(-87.92, 2);
    expect(epw.metadata.timezone).toBe(-6);
  });

  it('parses data hours', () => {
    const epw = parseEPW(MINIMAL_EPW);
    expect(epw.hours.length).toBe(1);
    expect(epw.hours[0].month).toBe(1);
    expect(epw.hours[0].hour).toBe(1);
  });

  it('throws on file too short', () => {
    expect(() => parseEPW('LOCATION,A,B,C')).toThrow();
  });

  it('throws when line 1 does not start with LOCATION', () => {
    const bad = Array(10).fill('garbage,1,2,3').join('\n');
    expect(() => parseEPW(bad)).toThrow();
  });

  it('extracts DNI and DHI from data row', () => {
    const epw = parseEPW(MINIMAL_EPW);
    expect(typeof epw.hours[0].dni).toBe('number');
    expect(typeof epw.hours[0].dhi).toBe('number');
  });
});

// ── Solar geometry ────────────────────────────────────────────────────────────

describe('T-ANA-01: solar angles', () => {
  it('returns negative altitude at night', () => {
    // Chicago, midnight (hour 0)
    const { altitude } = solarAngles(180, 0, 41.98, -87.92, -6);
    expect(altitude).toBeLessThan(0);
  });

  it('returns positive altitude at solar noon in summer', () => {
    // Chicago, day 172 (June 21), solar noon ≈ hour 12
    const { altitude } = solarAngles(172, 12, 41.98, -87.92, -6);
    expect(altitude).toBeGreaterThan(60);
    expect(altitude).toBeLessThan(90);
  });

  it('returns azimuth in range [0, 360]', () => {
    const { azimuth } = solarAngles(172, 10, 41.98, -87.92, -6);
    expect(azimuth).toBeGreaterThanOrEqual(0);
    expect(azimuth).toBeLessThanOrEqual(360);
  });

  it('sun is due south at solar noon in northern hemisphere', () => {
    // At solar noon, azimuth should be close to 180° (south) in NH
    const { azimuth } = solarAngles(172, 12.1, 41.98, 0, 0);
    expect(azimuth).toBeGreaterThan(150);
    expect(azimuth).toBeLessThan(210);
  });
});

// ── Perez illuminance ────────────────────────────────────────────────────────

describe('T-ANA-01: Perez illuminance', () => {
  it('returns 0 when solar altitude ≤ 0', () => {
    expect(perezIlluminance(600, 200, -5)).toBe(0);
    expect(perezIlluminance(600, 200, 0)).toBe(0);
  });

  it('returns positive lux for valid inputs', () => {
    const lux = perezIlluminance(600, 200, 40);
    expect(lux).toBeGreaterThan(0);
  });

  it('is higher on a clear day than an overcast day', () => {
    const clear    = perezIlluminance(800, 100, 50); // high DNI, low DHI
    const overcast = perezIlluminance(0, 300, 50);   // no DNI, moderate DHI
    expect(clear).toBeGreaterThan(overcast);
  });

  it('scales with solar altitude', () => {
    const low  = perezIlluminance(500, 200, 10);
    const high = perezIlluminance(500, 200, 60);
    expect(high).toBeGreaterThan(low);
  });
});

// ── Tregenza weights ─────────────────────────────────────────────────────────

describe('T-ANA-01: Tregenza sky discretisation', () => {
  it('returns exactly 145 patches', () => {
    expect(tregenzaWeights().length).toBe(TREGENZA_PATCH_COUNT);
  });

  it('all weights are positive', () => {
    const w = tregenzaWeights();
    for (let i = 0; i < w.length; i++) {
      expect(w[i]).toBeGreaterThan(0);
    }
  });

  it('sky hemisphere weights sum to 2π (± 5%)', () => {
    const w  = tregenzaWeights();
    const sum = Array.from(w.subarray(0, 144)).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(2 * Math.PI, 0);
  });

  it('ground patch weight equals 2π', () => {
    const w = tregenzaWeights();
    expect(w[144]).toBeCloseTo(2 * Math.PI, 3);
  });
});

// ── Analysis grid ─────────────────────────────────────────────────────────────

describe('T-ANA-01: analysis grid generation', () => {
  it('generates a non-empty grid for a large space', () => {
    const pts = generateGrid(0, 0, 10000, 8000);
    expect(pts.length).toBeGreaterThan(0);
  });

  it('all points are within the wall-offset boundary', () => {
    const pts = generateGrid(0, 0, 10000, 8000, { wallOffset: 500 });
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(500);
      expect(p.y).toBeGreaterThanOrEqual(500);
      expect(p.x).toBeLessThanOrEqual(9500);
      expect(p.y).toBeLessThanOrEqual(7500);
    }
  });

  it('returns empty array when space is too small after wall offset', () => {
    const pts = generateGrid(0, 0, 800, 800, { wallOffset: 500 });
    expect(pts).toHaveLength(0);
  });

  it('respects spacing parameter', () => {
    const coarse = generateGrid(0, 0, 10000, 8000, { spacing: 2000 });
    const fine   = generateGrid(0, 0, 10000, 8000, { spacing: 600 });
    expect(fine.length).toBeGreaterThan(coarse.length);
  });

  it('points are on the grid spacing', () => {
    const spacing = 1000;
    const pts = generateGrid(0, 0, 5000, 5000, { spacing, wallOffset: 0 });
    for (const p of pts) {
      expect(p.x % spacing).toBeCloseTo(0, 0);
      expect(p.y % spacing).toBeCloseTo(0, 0);
    }
  });
});

// ── LM-83-12 metrics ─────────────────────────────────────────────────────────

describe('T-ANA-01: daylight metrics (LM-83-12)', () => {
  it('DA=0 when all hours dark', () => {
    const { DA } = computeMetrics(new Float32Array(8760));
    expect(DA).toBe(0);
  });

  it('DA=1 when all hours exceed threshold', () => {
    const lux = new Float32Array(8760).fill(500);
    const { DA } = computeMetrics(lux);
    expect(DA).toBeCloseTo(1, 5);
  });

  it('DA=0.5 when half hours exceed threshold', () => {
    const lux = new Float32Array(8760);
    for (let i = 0; i < 4380; i++) lux[i] = 500;
    const { DA } = computeMetrics(lux);
    expect(DA).toBeCloseTo(0.5, 2);
  });

  it('cDA is ≥ DA (partial credit)', () => {
    const lux = new Float32Array(8760);
    for (let i = 0; i < 8760; i++) lux[i] = 150; // below threshold but not zero
    const m = computeMetrics(lux);
    expect(m.cDA).toBeGreaterThan(m.DA);
    expect(m.cDA).toBeCloseTo(150 / 300, 3);
  });

  it('UDI is fraction of hours between 100-2000 lux', () => {
    const lux = new Float32Array(8760);
    for (let i = 0; i < 8760; i++) lux[i] = i < 4380 ? 500 : 0; // half in UDI band
    const m = computeMetrics(lux);
    expect(m.UDI).toBeCloseTo(0.5, 2);
  });

  it('ASE counts hours above 1000 lux', () => {
    const lux = new Float32Array(8760);
    for (let i = 0; i < 300; i++) lux[i] = 1500; // 300 hours > 1000 lux
    const m = computeMetrics(lux);
    expect(m.ASE).toBe(300);
  });

  it('returns zeros for empty input', () => {
    const m = computeMetrics([]);
    expect(m.DA).toBe(0);
    expect(m.sDA).toBe(0);
  });
});

// ── Space-level aggregation ───────────────────────────────────────────────────

describe('T-ANA-01: space metrics aggregation', () => {
  it('sDA=1 when all points have DA ≥ 0.5', () => {
    const metrics = Array.from({ length: 10 }, () => ({
      DA: 0.7, sDA: 0.7, ASE: 100, cDA: 0.7, UDI: 0.6,
    }));
    const s = aggregateSpaceMetrics(metrics);
    expect(s.sDA).toBeCloseTo(1, 5);
  });

  it('ASE fraction = 0 when all points < 250 hours', () => {
    const metrics = Array.from({ length: 10 }, () => ({
      DA: 0.7, sDA: 0.7, ASE: 100, cDA: 0.7, UDI: 0.6, // ASE < 250
    }));
    const s = aggregateSpaceMetrics(metrics);
    expect(s.ASE).toBe(0);
  });

  it('LEED score 3 when sDA ≥ 75% and ASE ≤ 10%', () => {
    const metrics = Array.from({ length: 10 }, () => ({
      DA: 0.8, sDA: 0.8, ASE: 100, cDA: 0.8, UDI: 0.7,
    }));
    const s = aggregateSpaceMetrics(metrics);
    expect(s.LEEDScore).toBe(3);
  });

  it('LEED score 2 when sDA ≥ 55% and < 75%, ASE ≤ 10%', () => {
    const goodPoints = Array.from({ length: 6 }, () => ({ DA: 0.8, sDA: 0.8, ASE: 100, cDA: 0.8, UDI: 0.7 }));
    const badPoints  = Array.from({ length: 4 }, () => ({ DA: 0.3, sDA: 0.3, ASE: 100, cDA: 0.3, UDI: 0.3 }));
    const s = aggregateSpaceMetrics([...goodPoints, ...badPoints]);
    expect(s.LEEDScore).toBe(2);
    expect(s.sDA).toBeCloseTo(0.6, 5);
  });

  it('LEED score 0 when ASE > 10%', () => {
    const metrics = Array.from({ length: 10 }, () => ({
      DA: 0.9, sDA: 0.9, ASE: 300, cDA: 0.9, UDI: 0.8, // ASE > 250h
    }));
    const s = aggregateSpaceMetrics(metrics);
    expect(s.LEEDScore).toBe(0);
  });

  it('returns zeros for empty input', () => {
    const s = aggregateSpaceMetrics([]);
    expect(s.sDA).toBe(0);
    expect(s.LEEDScore).toBe(0);
  });
});

// ── Point illuminance estimate ────────────────────────────────────────────────

describe('T-ANA-01: point illuminance estimate', () => {
  it('returns 0 when GHI is 0', () => {
    expect(estimatePointIlluminance(0, 5, 3)).toBe(0);
  });

  it('returns 0 when window area is 0', () => {
    expect(estimatePointIlluminance(50000, 0, 3)).toBe(0);
  });

  it('returns positive lux for valid inputs', () => {
    const lux = estimatePointIlluminance(50000, 5, 3);
    expect(lux).toBeGreaterThan(0);
  });

  it('illuminance decreases with distance', () => {
    const near = estimatePointIlluminance(50000, 5, 1);
    const far  = estimatePointIlluminance(50000, 5, 5);
    expect(near).toBeGreaterThan(far);
  });

  it('transmittance scales linearly', () => {
    const t60 = estimatePointIlluminance(50000, 5, 3, 0.6);
    const t30 = estimatePointIlluminance(50000, 5, 3, 0.3);
    expect(t60).toBeCloseTo(t30 * 2, 5);
  });
});
