/**
 * T-VIEW-01: Unit tests for sectionCut — cut-plane → 2D cross-section geometry.
 */
import { describe, it, expect } from 'vitest';
import {
  computeSectionCut,
  sectionPlaneFromMarker,
  type SectionPlane,
  type SectionCutResult,
} from './sectionCut';
import type { ElementSchema } from '@opencad/document';

function makeWall(x1: number, y1: number, x2: number, y2: number, zBase = 0, zTop = 3000): ElementSchema {
  return {
    id: `wall-${x1}-${y1}`,
    type: 'wall',
    layerId: 'l0',
    levelId: 'lv0',
    locked: false,
    visible: true,
    properties: { ZBase: zBase, ZTop: zTop, Thickness: 200 },
    geometry: { type: 'line', x1, y1, x2, y2 },
  };
}

function makeSlab(points: { x: number; y: number }[], zBase = 0, zTop = 300): ElementSchema {
  return {
    id: 'slab-1',
    type: 'slab',
    layerId: 'l0',
    levelId: 'lv0',
    locked: false,
    visible: true,
    properties: { ZBase: zBase, ZTop: zTop },
    geometry: { type: 'polygon', points },
  };
}

describe('T-VIEW-01: sectionCut', () => {
  // ── sectionPlaneFromMarker ────────────────────────────────────────────────

  it('creates a section plane from two marker points (X-axis cut)', () => {
    const plane = sectionPlaneFromMarker(
      { x: 0, y: 5000 }, { x: 10000, y: 5000 },
      { zBottom: 0, zTop: 4000, depth: 6000 }
    );
    expect(plane.origin.x).toBe(0);
    expect(plane.origin.y).toBe(5000);
    expect(plane.normal.x).toBeCloseTo(0, 3);
    expect(plane.normal.y).toBeCloseTo(1, 3);
  });

  it('creates a section plane from two marker points (diagonal)', () => {
    const plane = sectionPlaneFromMarker(
      { x: 0, y: 0 }, { x: 1000, y: 1000 },
      { zBottom: 0, zTop: 3000, depth: 5000 }
    );
    // Normal is perpendicular to the cut direction (rotated 90°)
    expect(plane.normal.x).toBeCloseTo(-Math.SQRT1_2, 3);
    expect(plane.normal.y).toBeCloseTo(Math.SQRT1_2, 3);
  });

  // ── computeSectionCut ────────────────────────────────────────────────────

  it('returns empty results for empty element array', () => {
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([], plane);
    expect(results).toHaveLength(0);
  });

  it('intersects a wall that crosses the cut plane', () => {
    // Wall running Y-direction at X=5000, crossing section plane at Y=5000
    const wall = makeWall(5000, 0, 5000, 10000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results.length).toBeGreaterThan(0);
  });

  it('excludes wall that does not cross the cut plane', () => {
    // Wall entirely at Y=1000, far from cut plane at Y=5000
    const wall = makeWall(0, 1000, 10000, 1000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results).toHaveLength(0);
  });

  it('wall lying exactly on cut plane (coplanar) is not included', () => {
    // Wall at Y=5000 running in X direction — lies in the cut plane (d=0 both ends)
    const wall = makeWall(0, 5000, 10000, 5000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    // Coplanar wall: both endpoints at d=0 → not a crossing → excluded
    const results = computeSectionCut([wall], plane);
    expect(results).toHaveLength(0);
  });

  it('cut result for a wall has correct elementId', () => {
    // Wall crossing the cut plane at Y=5000
    const wall = makeWall(5000, 0, 5000, 10000);
    wall.id = 'my-wall-id';
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results[0]?.elementId).toBe('my-wall-id');
  });

  it('cut result has a non-empty lines array', () => {
    const wall = makeWall(5000, 0, 5000, 10000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results[0]?.lines.length).toBeGreaterThan(0);
  });

  it('cut result lines have correct z-range (zBase to zTop)', () => {
    const wall = makeWall(5000, 0, 5000, 10000, 0, 3000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    const line = results[0]?.lines[0];
    expect(line?.y1).toBe(0);
    expect(line?.y2).toBe(3000);
  });

  it('excludes invisible elements', () => {
    const wall = makeWall(0, 5000, 10000, 5000);
    wall.visible = false;
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results).toHaveLength(0);
  });

  it('slab polygon intersected by cut plane produces cut lines', () => {
    const slab = makeSlab([
      { x: 0, y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 10000 },
      { x: 0, y: 10000 },
    ], 0, 300);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([slab], plane);
    expect(results.length).toBeGreaterThan(0);
  });

  it('depth limit excludes elements behind the section', () => {
    // Wall at Y=9000, depth=6000, section at Y=5000 facing +Y (depth goes into +Y)
    // Elements within depth: Y=5000 to Y=11000 — wall at Y=9000 is within
    // But wall at Y=12000 should be excluded
    const wall = makeWall(0, 12000, 10000, 12000);
    const plane: SectionPlane = {
      origin: { x: 0, y: 5000 },
      normal: { x: 0, y: 1 },
      cutDir: { x: 1, y: 0 },
      zBottom: 0,
      zTop: 4000,
      depth: 6000,
    };
    const results = computeSectionCut([wall], plane);
    expect(results).toHaveLength(0);
  });
});
