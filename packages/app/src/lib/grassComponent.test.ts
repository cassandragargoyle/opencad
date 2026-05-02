/**
 * T-SITE-V2-02: Unit tests for grassComponent.
 */
import { describe, it, expect } from 'vitest';
import {
  generateGrassPatch,
  bladeColourForAltitude,
  applyWind,
  type AABB2D,
} from './grassComponent';

const BOUNDS: AABB2D = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

describe('T-SITE-V2-02: grassComponent', () => {
  // ── bladeColourForAltitude ──────────────────────────────────────────────────

  it('returns a valid CSS hex colour', () => {
    const colour = bladeColourForAltitude(0);
    expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('low altitude colour has higher green channel than high altitude', () => {
    const low = bladeColourForAltitude(0);
    const high = bladeColourForAltitude(4000);
    const gLow = parseInt(low.slice(3, 5), 16);
    const gHigh = parseInt(high.slice(3, 5), 16);
    expect(gLow).toBeGreaterThan(gHigh);
  });

  it('handles altitude below 0 (clamps to 0)', () => {
    expect(bladeColourForAltitude(-100)).toBe(bladeColourForAltitude(0));
  });

  it('handles altitude above 4000 (clamps to 4000)', () => {
    expect(bladeColourForAltitude(5000)).toBe(bladeColourForAltitude(4000));
  });

  // ── generateGrassPatch ──────────────────────────────────────────────────────

  it('generates the expected number of blades proportional to density × area', () => {
    const field = generateGrassPatch(BOUNDS, 1, 0);
    // area = 100 units², density = 1 → ~100 blades
    expect(field.blades.length).toBeGreaterThan(50);
    expect(field.blades.length).toBeLessThan(200);
  });

  it('returns empty field for zero density', () => {
    const field = generateGrassPatch(BOUNDS, 0, 0);
    expect(field.blades).toHaveLength(0);
  });

  it('returns empty field for zero-area bounds', () => {
    const field = generateGrassPatch({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 1, 0);
    expect(field.blades).toHaveLength(0);
  });

  it('all blades are within bounds', () => {
    const field = generateGrassPatch(BOUNDS, 0.5, 0);
    for (const b of field.blades) {
      expect(b.x).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(b.x).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(b.y).toBeGreaterThanOrEqual(BOUNDS.minY);
      expect(b.y).toBeLessThanOrEqual(BOUNDS.maxY);
    }
  });

  it('patchId encodes the bounds', () => {
    const field = generateGrassPatch(BOUNDS, 0.1, 0);
    expect(field.patchId).toContain('0');
    expect(field.patchId).toContain('10');
  });

  it('density is stored on the field', () => {
    const field = generateGrassPatch(BOUNDS, 0.3, 0);
    expect(field.density).toBe(0.3);
  });

  it('blades have valid colour strings', () => {
    const field = generateGrassPatch(BOUNDS, 0.1, 0);
    for (const b of field.blades) {
      expect(b.colour).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // ── applyWind ───────────────────────────────────────────────────────────────

  it('returns a new GrassField (immutable)', () => {
    const field = generateGrassPatch(BOUNDS, 0.1, 0);
    const after = applyWind(field, 0, 1);
    expect(after).not.toBe(field);
    expect(after.blades[0]).not.toBe(field.blades[0]);
  });

  it('wind in +x direction (windDir=0) increases lean', () => {
    const field = generateGrassPatch(BOUNDS, 0.1, 0);
    const after = applyWind(field, 0, 2);
    // cos(0)=1, so lean increases
    for (let i = 0; i < field.blades.length; i++) {
      expect(after.blades[i].lean).toBeGreaterThan(field.blades[i].lean);
    }
  });

  it('zero wind strength leaves leans unchanged', () => {
    const field = generateGrassPatch(BOUNDS, 0.1, 0);
    const after = applyWind(field, Math.PI / 4, 0);
    for (let i = 0; i < field.blades.length; i++) {
      expect(after.blades[i].lean).toBeCloseTo(field.blades[i].lean, 10);
    }
  });

  it('preserves patchId and density after wind', () => {
    const field = generateGrassPatch(BOUNDS, 0.2, 0);
    const after = applyWind(field, 1, 0.5);
    expect(after.patchId).toBe(field.patchId);
    expect(after.density).toBe(field.density);
  });
});
