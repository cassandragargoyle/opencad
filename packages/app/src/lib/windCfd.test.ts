/**
 * T-ANA-06: Wind CFD — facade pressure, pedestrian wind, Lawson criteria tests.
 */
import { describe, it, expect } from 'vitest';
import {
  windDirectionToAngle,
  dominantWindDirection,
  estimateFacadePressure,
  computePedestrianWind,
  lawsonCategory,
  beaufortForce,
  BEAUFORT_SCALE,
  type WindRose,
} from './windCfd';

describe('T-ANA-06: windDirectionToAngle()', () => {
  it('N is 0 degrees', () => {
    expect(windDirectionToAngle('N')).toBe(0);
  });

  it('E is 90 degrees', () => {
    expect(windDirectionToAngle('E')).toBe(90);
  });

  it('S is 180 degrees', () => {
    expect(windDirectionToAngle('S')).toBe(180);
  });

  it('W is 270 degrees', () => {
    expect(windDirectionToAngle('W')).toBe(270);
  });
});

describe('T-ANA-06: dominantWindDirection()', () => {
  const rose: WindRose = {
    speeds:      [3, 2, 5, 2, 3, 2, 4, 2],
    frequencies: [0.1, 0.1, 0.3, 0.1, 0.1, 0.1, 0.15, 0.05],
  };

  it('returns direction with highest frequency×speed', () => {
    // E: 5 * 0.3 = 1.5 — highest product
    expect(dominantWindDirection(rose)).toBe('E');
  });
});

describe('T-ANA-06: estimateFacadePressure()', () => {
  it('windward Cp is positive at 0° angle', () => {
    const p = estimateFacadePressure(1, 0);
    expect(p.windwardCoeff).toBeGreaterThan(0);
  });

  it('leeward Cp is negative', () => {
    const p = estimateFacadePressure(1, 0);
    expect(p.leewardCoeff).toBeLessThan(0);
  });

  it('windward Cp at 90° is near 0 (oblique incidence)', () => {
    const p = estimateFacadePressure(1, 90);
    expect(Math.abs(p.windwardCoeff)).toBeLessThan(0.1);
  });

  it('leeward Cp magnitude varies with aspect ratio', () => {
    const p1 = estimateFacadePressure(0.5, 0); // narrow (deep): L/B = 2 → Cp = -0.3
    const p2 = estimateFacadePressure(2.0, 0); // wide (shallow): L/B = 0.5 → Cp = -0.5
    // Deep buildings have less negative leeward Cp than shallow buildings
    expect(p1.leewardCoeff).toBeGreaterThan(p2.leewardCoeff);
  });
});

describe('T-ANA-06: computePedestrianWind()', () => {
  it('returns a pedestrian point with windSpeedMs', () => {
    const result = computePedestrianWind(20, 10, 5);
    expect(result).toHaveProperty('windSpeedMs');
    expect(result.windSpeedMs).toBeGreaterThanOrEqual(0);
  });

  it('speed is less than free-stream speed', () => {
    const result = computePedestrianWind(20, 10, 5);
    expect(result.windSpeedMs).toBeLessThan(5);
  });

  it('returns a Lawson category', () => {
    const result = computePedestrianWind(20, 10, 5);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(result.lawsonCategory);
  });
});

describe('T-ANA-06: lawsonCategory()', () => {
  it('< 2 m/s is category A', () => {
    expect(lawsonCategory(1)).toBe('A');
  });

  it('2–4 m/s is category B', () => {
    expect(lawsonCategory(3)).toBe('B');
  });

  it('4–6 m/s is category C', () => {
    expect(lawsonCategory(5)).toBe('C');
  });

  it('6–8 m/s is category D', () => {
    expect(lawsonCategory(7)).toBe('D');
  });

  it('>= 8 m/s is category E', () => {
    expect(lawsonCategory(9)).toBe('E');
  });
});

describe('T-ANA-06: beaufortForce()', () => {
  it('calm (0 m/s) is force 0', () => {
    expect(beaufortForce(0)).toBe(0);
  });

  it('5 m/s is force 3 (gentle breeze)', () => {
    expect(beaufortForce(5)).toBe(3);
  });

  it('30 m/s is force 11 or 12', () => {
    const force = beaufortForce(30);
    expect(force).toBeGreaterThanOrEqual(11);
  });

  it('BEAUFORT_SCALE has 13 entries (0–12)', () => {
    expect(BEAUFORT_SCALE).toHaveLength(13);
  });
});
