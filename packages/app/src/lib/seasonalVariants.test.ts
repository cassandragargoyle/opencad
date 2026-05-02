/**
 * T-SITE-V2-04: Unit tests for seasonalVariants.
 */
import { describe, it, expect } from 'vitest';
import {
  SEASONAL_SPECS,
  MATURITY_SPECS,
  computeTreeGeometry,
  lerpSeason,
  type Season,
  type MaturityStage,
} from './seasonalVariants';

describe('T-SITE-V2-04: seasonalVariants', () => {
  // ── SEASONAL_SPECS ─────────────────────────────────────────────────────────

  it('has all four seasons', () => {
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    for (const s of seasons) {
      expect(SEASONAL_SPECS[s]).toBeDefined();
      expect(SEASONAL_SPECS[s].season).toBe(s);
    }
  });

  it('summer has the highest canopy density', () => {
    expect(SEASONAL_SPECS.summer.canopyDensity).toBe(1.0);
  });

  it('winter has zero canopy density and no leaves', () => {
    expect(SEASONAL_SPECS.winter.canopyDensity).toBe(0);
    expect(SEASONAL_SPECS.winter.hasLeaves).toBe(false);
  });

  it('spring, summer, autumn all have leaves', () => {
    expect(SEASONAL_SPECS.spring.hasLeaves).toBe(true);
    expect(SEASONAL_SPECS.summer.hasLeaves).toBe(true);
    expect(SEASONAL_SPECS.autumn.hasLeaves).toBe(true);
  });

  it('all leaf colours are valid CSS hex', () => {
    for (const spec of Object.values(SEASONAL_SPECS)) {
      expect(spec.leafColour).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('canopy density is in range 0–1 for all seasons', () => {
    for (const spec of Object.values(SEASONAL_SPECS)) {
      expect(spec.canopyDensity).toBeGreaterThanOrEqual(0);
      expect(spec.canopyDensity).toBeLessThanOrEqual(1);
    }
  });

  // ── MATURITY_SPECS ────────────────────────────────────────────────────────

  it('has all four maturity stages', () => {
    const stages: MaturityStage[] = ['sapling', 'young', 'mature', 'ancient'];
    for (const st of stages) {
      expect(MATURITY_SPECS[st]).toBeDefined();
      expect(MATURITY_SPECS[st].stage).toBe(st);
    }
  });

  it('ancient tree is taller than sapling (heightMultiplier ordering)', () => {
    expect(MATURITY_SPECS.ancient.heightMultiplier).toBeGreaterThan(
      MATURITY_SPECS.sapling.heightMultiplier
    );
  });

  it('canopy radius increases with maturity', () => {
    expect(MATURITY_SPECS.sapling.canopyRadiusM).toBeLessThan(MATURITY_SPECS.young.canopyRadiusM);
    expect(MATURITY_SPECS.young.canopyRadiusM).toBeLessThan(MATURITY_SPECS.mature.canopyRadiusM);
    expect(MATURITY_SPECS.mature.canopyRadiusM).toBeLessThan(MATURITY_SPECS.ancient.canopyRadiusM);
  });

  // ── computeTreeGeometry ──────────────────────────────────────────────────

  it('mature summer tree at 20m base has height = 20m', () => {
    const geom = computeTreeGeometry(20, 'mature', 'summer');
    expect(geom.heightM).toBeCloseTo(20 * 1.0, 5);
  });

  it('sapling has smaller height than mature with same base', () => {
    const sapling = computeTreeGeometry(20, 'sapling', 'summer');
    const mature = computeTreeGeometry(20, 'mature', 'summer');
    expect(sapling.heightM).toBeLessThan(mature.heightM);
  });

  it('winter tree has zero canopy density regardless of maturity', () => {
    const geom = computeTreeGeometry(15, 'ancient', 'winter');
    expect(geom.canopyDensity).toBe(0);
  });

  it('returns correct leaf colour from seasonal spec', () => {
    const geom = computeTreeGeometry(10, 'mature', 'autumn');
    expect(geom.leafColour).toBe(SEASONAL_SPECS.autumn.leafColour);
  });

  it('canopy radius matches maturity spec regardless of season', () => {
    const geom = computeTreeGeometry(10, 'young', 'spring');
    expect(geom.canopyRadiusM).toBe(MATURITY_SPECS.young.canopyRadiusM);
  });

  // ── lerpSeason ────────────────────────────────────────────────────────────

  it('t=0 returns spec matching season a', () => {
    const result = lerpSeason('spring', 'summer', 0);
    expect(result.leafColour).toBe(SEASONAL_SPECS.spring.leafColour);
    expect(result.canopyDensity).toBeCloseTo(SEASONAL_SPECS.spring.canopyDensity, 5);
  });

  it('t=1 returns spec matching season b', () => {
    const result = lerpSeason('spring', 'summer', 1);
    expect(result.leafColour).toBe(SEASONAL_SPECS.summer.leafColour);
    expect(result.canopyDensity).toBeCloseTo(SEASONAL_SPECS.summer.canopyDensity, 5);
  });

  it('t=0.5 yields intermediate canopy density', () => {
    const result = lerpSeason('spring', 'summer', 0.5);
    const expected = (SEASONAL_SPECS.spring.canopyDensity + SEASONAL_SPECS.summer.canopyDensity) / 2;
    expect(result.canopyDensity).toBeCloseTo(expected, 5);
  });

  it('clamps t below 0', () => {
    const normal = lerpSeason('spring', 'autumn', 0);
    const clamped = lerpSeason('spring', 'autumn', -1);
    expect(clamped.leafColour).toBe(normal.leafColour);
  });

  it('clamps t above 1', () => {
    const normal = lerpSeason('spring', 'autumn', 1);
    const clamped = lerpSeason('spring', 'autumn', 2);
    expect(clamped.leafColour).toBe(normal.leafColour);
  });

  it('winter->spring lerp hasLeaves switches at midpoint', () => {
    const early = lerpSeason('winter', 'spring', 0.4);
    const late = lerpSeason('winter', 'spring', 0.6);
    expect(early.hasLeaves).toBe(false); // winter side
    expect(late.hasLeaves).toBe(true);   // spring side
  });
});
