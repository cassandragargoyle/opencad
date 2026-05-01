/**
 * T-SITE-07: Unit tests for setbackCalc — property line setback envelope.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSetbackEnvelope,
  polygonArea,
  polygonCentroid,
  type Point2D,
  type SetbackDistances,
} from './setbackCalc';

const SQUARE_10M: Point2D[] = [
  { x: 0,     y: 0     },
  { x: 10000, y: 0     },
  { x: 10000, y: 10000 },
  { x: 0,     y: 10000 },
];

const UNIFORM: SetbackDistances = { front: 1000, rear: 1000, left: 1000, right: 1000 };

describe('T-SITE-07: setbackCalc', () => {
  // ── polygonArea ────────────────────────��─────────────────────────��──────────

  it('computes area of 10m square CCW polygon = 1e8 mm²', () => {
    expect(polygonArea(SQUARE_10M)).toBeCloseTo(1e8, -3);
  });

  it('returns negative area for CW polygon', () => {
    const cw = [...SQUARE_10M].reverse();
    expect(polygonArea(cw)).toBeLessThan(0);
  });

  // ── polygonCentroid ─────────────────────────���─────────────────────────��─────

  it('centroid of square is its center', () => {
    const c = polygonCentroid(SQUARE_10M);
    expect(c.x).toBeCloseTo(5000, 0);
    expect(c.y).toBeCloseTo(5000, 0);
  });

  // ── computeSetbackEnvelope ──────────────────────────────────────────────────

  it('returns empty polygon for fewer than 3 boundary points', () => {
    const result = computeSetbackEnvelope([{ x: 0, y: 0 }, { x: 1000, y: 0 }], UNIFORM);
    expect(result.polygon).toHaveLength(0);
    expect(result.buildable).toBe(false);
  });

  it('uniform 1m setback on 10m square produces 8m inner square', () => {
    const result = computeSetbackEnvelope(SQUARE_10M, UNIFORM);
    expect(result.buildable).toBe(true);
    expect(result.polygon).toHaveLength(4);
    // Inner square should have area ≈ 8m × 8m = 64e6 mm²
    const area = polygonArea(result.polygon);
    expect(Math.abs(area)).toBeCloseTo(64e6, -4);
  });

  it('result polygon is smaller than original', () => {
    const result = computeSetbackEnvelope(SQUARE_10M, UNIFORM);
    const innerArea = Math.abs(polygonArea(result.polygon));
    const outerArea = Math.abs(polygonArea(SQUARE_10M));
    expect(innerArea).toBeLessThan(outerArea);
  });

  it('asymmetric setbacks: larger front shrinks south edge more', () => {
    const setbacks: SetbackDistances = { front: 3000, rear: 1000, left: 1000, right: 1000 };
    const result = computeSetbackEnvelope(SQUARE_10M, setbacks);
    expect(result.buildable).toBe(true);
    // With 3m front vs 1m rear, inner polygon should have less depth.
    const innerArea = Math.abs(polygonArea(result.polygon));
    const uniformResult = computeSetbackEnvelope(SQUARE_10M, UNIFORM);
    const uniformArea   = Math.abs(polygonArea(uniformResult.polygon));
    expect(innerArea).toBeLessThan(uniformArea);
  });

  it('setbacks exceeding half the site width produce no buildable area', () => {
    const huge: SetbackDistances = { front: 6000, rear: 6000, left: 6000, right: 6000 };
    const result = computeSetbackEnvelope(SQUARE_10M, huge);
    expect(result.buildable).toBe(false);
  });

  it('zero setbacks return polygon equal to boundary', () => {
    const zero: SetbackDistances = { front: 0, rear: 0, left: 0, right: 0 };
    const result = computeSetbackEnvelope(SQUARE_10M, zero);
    expect(result.buildable).toBe(true);
    expect(result.polygon).toHaveLength(4);
    const innerArea = Math.abs(polygonArea(result.polygon));
    const outerArea = Math.abs(polygonArea(SQUARE_10M));
    expect(innerArea).toBeCloseTo(outerArea, -3);
  });
});
