/**
 * T-SITE-08: Unit tests for gradingCalc — cut/fill, spot levels, slope.
 */
import { describe, it, expect } from 'vitest';
import {
  computeCutFill,
  spotLevelsToArrow,
  formatSpotLevel,
  formatSlope,
  type ElevationGrid,
} from './gradingCalc';

describe('T-SITE-08: gradingCalc', () => {
  // ── computeCutFill ──────────────────────────────────────────────────────────

  function makeGrid(
    cols: number, rows: number,
    elevFn: (c: number, r: number) => number,
    rangeX = 10000, rangeY = 10000
  ): ElevationGrid {
    const elevations = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        elevations[r * cols + c] = elevFn(c, r);
      }
    }
    return { cols, rows, elevations, rangeX, rangeY };
  }

  it('returns zero volumes for identical grids', () => {
    const g = makeGrid(3, 3, () => 500);
    const result = computeCutFill(g, g);
    expect(result.cutVolume).toBe(0);
    expect(result.fillVolume).toBe(0);
    expect(result.netVolume).toBe(0);
  });

  it('computes pure fill when proposed is uniformly higher', () => {
    const existing = makeGrid(3, 3, () => 0);
    const proposed = makeGrid(3, 3, () => 1000);
    const result = computeCutFill(existing, proposed);
    expect(result.cutVolume).toBe(0);
    expect(result.fillVolume).toBeGreaterThan(0);
    expect(result.netVolume).toBeGreaterThan(0);
  });

  it('computes pure cut when proposed is uniformly lower', () => {
    const existing = makeGrid(3, 3, () => 1000);
    const proposed = makeGrid(3, 3, () => 0);
    const result = computeCutFill(existing, proposed);
    expect(result.fillVolume).toBe(0);
    expect(result.cutVolume).toBeGreaterThan(0);
    expect(result.netVolume).toBeLessThan(0);
  });

  it('fill volume = cell area × height for uniform 1m fill on 10m² grid', () => {
    // Grid: 2×2 vertices = 1 cell, 10m×10m range, 1000mm fill.
    const existing = makeGrid(2, 2, () => 0, 10000, 10000);
    const proposed = makeGrid(2, 2, () => 1000, 10000, 10000);
    const result = computeCutFill(existing, proposed);
    // cellArea = 10000 × 10000 = 1e8 mm², fill = 1000 mm → volume = 1e11 mm³
    expect(result.fillVolume).toBeCloseTo(1e11, -5);
  });

  it('returns empty result for mismatched grid dimensions', () => {
    const g1 = makeGrid(3, 3, () => 0);
    const g2 = makeGrid(4, 3, () => 0);
    const result = computeCutFill(g1, g2);
    expect(result.cutVolume).toBe(0);
    expect(result.fillVolume).toBe(0);
    expect(result.cellClasses).toHaveLength(0);
  });

  it('returns empty result for single-column grid', () => {
    const g = makeGrid(1, 5, () => 0);
    const result = computeCutFill(g, g);
    expect(result.cellClasses).toHaveLength(0);
  });

  it('classifies cells as cut/fill/flat correctly', () => {
    const existing = makeGrid(3, 2, (c) => c * 500);   // 0, 500, 1000
    const proposed = makeGrid(3, 2, (c) => (2 - c) * 500); // 1000, 500, 0
    const result = computeCutFill(existing, proposed);
    // Left cells: proposed > existing → fill
    // Right cells: proposed < existing → cut
    expect(result.cellClasses).toContain('fill');
    expect(result.cellClasses).toContain('cut');
  });

  // ── spotLevelsToArrow ────────────────────────────────────────────────────────

  it('computes 2% slope for 1m rise over 50m horizontal', () => {
    const from = { x: 0,     y: 0, z: 0    };
    const to   = { x: 50000, y: 0, z: 1000 };
    const arrow = spotLevelsToArrow(from, to);
    expect(arrow.slope).toBeCloseTo(0.02, 4);
    expect(arrow.x1).toBe(0);
    expect(arrow.x2).toBe(50000);
  });

  it('returns negative slope for downhill direction', () => {
    const from = { x: 0,     y: 0, z: 1000 };
    const to   = { x: 10000, y: 0, z: 0    };
    const arrow = spotLevelsToArrow(from, to);
    expect(arrow.slope).toBeLessThan(0);
  });

  // ── formatSpotLevel ─────────────────────────────────────────────────────────

  it('formats positive FL elevation with + sign', () => {
    expect(formatSpotLevel(300)).toBe('FL +0.300');
  });

  it('formats zero elevation as FL +0.000', () => {
    expect(formatSpotLevel(0)).toBe('FL +0.000');
  });

  it('formats negative elevation with − sign', () => {
    expect(formatSpotLevel(-500)).toBe('FL -0.500');
  });

  it('uses custom prefix', () => {
    expect(formatSpotLevel(1500, 'NGL')).toBe('NGL +1.500');
  });

  // ── formatSlope ─────────────────────────────────────────────────────────────

  it('formats 2% slope as "2.0%"', () => {
    expect(formatSlope(0.02)).toBe('2.0%');
  });

  it('formats 0% slope', () => {
    expect(formatSlope(0)).toBe('0.0%');
  });

  it('formats slope as ratio 1:50', () => {
    expect(formatSlope(0.02, 'ratio')).toBe('1:50');
  });
});
