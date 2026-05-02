/**
 * T-VIEW-04: Unit tests for revisionCloud — arc-bump polygon path generation.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRevisionCloudPath,
  computeRevisionCloudBumps,
} from './revisionCloud';

describe('T-VIEW-04: revisionCloud', () => {
  const squarePoly = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ];

  it('returns an empty array for fewer than 2 polygon points', () => {
    const bumps = computeRevisionCloudBumps([{ x: 0, y: 0 }], 200);
    expect(bumps).toHaveLength(0);
  });

  it('returns bumps for a square polygon', () => {
    const bumps = computeRevisionCloudBumps(squarePoly, 200);
    expect(bumps.length).toBeGreaterThan(0);
  });

  it('each bump has a center and radius', () => {
    const bumps = computeRevisionCloudBumps(squarePoly, 200);
    const first = bumps[0]!;
    expect(typeof first.cx).toBe('number');
    expect(typeof first.cy).toBe('number');
    expect(first.r).toBeGreaterThan(0);
  });

  it('bump radius matches the requested arc size', () => {
    const bumps = computeRevisionCloudBumps(squarePoly, 150);
    for (const b of bumps) {
      expect(b.r).toBeCloseTo(150 / 2, 0);
    }
  });

  it('bumps cover the full perimeter (count scales with perimeter)', () => {
    const bumpSize = 200;
    const perimeter = 4 * 1000; // 4000mm square
    const expectedApprox = Math.floor(perimeter / bumpSize);
    const bumps = computeRevisionCloudBumps(squarePoly, bumpSize);
    expect(bumps.length).toBeGreaterThanOrEqual(expectedApprox - 2);
  });

  it('buildRevisionCloudPath returns a non-empty SVG path string', () => {
    const path = buildRevisionCloudPath(squarePoly, 200);
    expect(path.length).toBeGreaterThan(0);
    expect(path).toContain('M ');
  });

  it('buildRevisionCloudPath path includes arc commands', () => {
    const path = buildRevisionCloudPath(squarePoly, 200);
    expect(path).toContain('A ');
  });

  it('triangle polygon produces bumps', () => {
    const tri = [{ x: 0, y: 0 }, { x: 500, y: 866 }, { x: 1000, y: 0 }];
    const bumps = computeRevisionCloudBumps(tri, 100);
    expect(bumps.length).toBeGreaterThan(0);
  });
});
