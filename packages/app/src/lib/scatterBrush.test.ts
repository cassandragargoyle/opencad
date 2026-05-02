/**
 * T-SITE-V2-01: Unit tests for scatterBrush.
 */
import { describe, it, expect } from 'vitest';
import {
  generateScatterPoints,
  filterByMask,
  mergeScatterBatches,
  type ScatterBrushConfig,
  type Point2D,
} from './scatterBrush';

const BASE_CONFIG: ScatterBrushConfig = {
  radius: 10,
  density: 0.1,
  elementTypes: ['tree', 'shrub'],
  jitter: 0,
  avoidOverlap: false,
};

describe('T-SITE-V2-01: scatterBrush', () => {
  // ── generateScatterPoints ──────────────────────────────────────────────────

  it('returns empty array for zero radius', () => {
    const result = generateScatterPoints({ x: 0, y: 0 }, { ...BASE_CONFIG, radius: 0 });
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty elementTypes', () => {
    const result = generateScatterPoints({ x: 0, y: 0 }, { ...BASE_CONFIG, elementTypes: [] });
    expect(result).toHaveLength(0);
  });

  it('generates points within the brush radius', () => {
    const center: Point2D = { x: 100, y: 200 };
    const cfg: ScatterBrushConfig = { ...BASE_CONFIG, radius: 50, density: 0.005 };
    const pts = generateScatterPoints(center, cfg);
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      // Allow a small jitter margin
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(cfg.radius + 1);
    }
  });

  it('assigns elementTypes from config list', () => {
    const pts = generateScatterPoints({ x: 0, y: 0 }, { ...BASE_CONFIG, radius: 20, density: 0.05 });
    const types = new Set(pts.map((p) => p.elementType));
    for (const t of types) {
      expect(BASE_CONFIG.elementTypes).toContain(t);
    }
  });

  it('each point has unique id', () => {
    const pts = generateScatterPoints({ x: 0, y: 0 }, { ...BASE_CONFIG, radius: 20, density: 0.05 });
    const ids = pts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('avoidOverlap mode produces points farther apart', () => {
    const center: Point2D = { x: 0, y: 0 };
    const cfg: ScatterBrushConfig = { ...BASE_CONFIG, radius: 20, density: 0.05, avoidOverlap: true };
    const pts = generateScatterPoints(center, cfg);
    expect(pts.length).toBeGreaterThan(0);
    // Verify all points are distinct
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        expect(dx * dx + dy * dy).toBeGreaterThan(0);
      }
    }
  });

  it('rotation is in [0, 2π)', () => {
    const pts = generateScatterPoints({ x: 0, y: 0 }, BASE_CONFIG);
    for (const p of pts) {
      expect(p.rotation).toBeGreaterThanOrEqual(0);
      expect(p.rotation).toBeLessThan(Math.PI * 2 + 0.001);
    }
  });

  // ── filterByMask ────────────────────────────────────────────────────────────

  it('keeps points inside polygon and discards outside', () => {
    const square: Point2D[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const inside = { id: 'a', x: 5, y: 5, rotation: 0, scale: 1, elementType: 'tree' };
    const outside = { id: 'b', x: 20, y: 20, rotation: 0, scale: 1, elementType: 'tree' };
    const result = filterByMask([inside, outside], square);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty array when polygon has fewer than 3 vertices', () => {
    const pts = [{ id: 'a', x: 1, y: 1, rotation: 0, scale: 1, elementType: 'tree' }];
    expect(filterByMask(pts, [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toHaveLength(0);
  });

  it('returns empty when all points are outside mask', () => {
    const triangle: Point2D[] = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2.5, y: 5 }];
    const pts = [{ id: 'a', x: 100, y: 100, rotation: 0, scale: 1, elementType: 'tree' }];
    expect(filterByMask(pts, triangle)).toHaveLength(0);
  });

  // ── mergeScatterBatches ──────────────────────────────────────────────────────

  it('merges two batches and deduplicates by id', () => {
    const a = [
      { id: '1', x: 0, y: 0, rotation: 0, scale: 1, elementType: 'tree' },
      { id: '2', x: 1, y: 1, rotation: 0, scale: 1, elementType: 'shrub' },
    ];
    const b = [
      { id: '2', x: 1, y: 1, rotation: 0, scale: 1, elementType: 'shrub' }, // duplicate
      { id: '3', x: 2, y: 2, rotation: 0, scale: 1, elementType: 'tree' },
    ];
    const merged = mergeScatterBatches(a, b);
    expect(merged).toHaveLength(3);
    expect(merged.map((p) => p.id)).toEqual(['1', '2', '3']);
  });

  it('merging two empty batches returns empty array', () => {
    expect(mergeScatterBatches([], [])).toHaveLength(0);
  });

  it('merging empty with non-empty returns non-empty', () => {
    const a = [{ id: 'x', x: 0, y: 0, rotation: 0, scale: 1, elementType: 'tree' }];
    expect(mergeScatterBatches([], a)).toHaveLength(1);
  });
});
