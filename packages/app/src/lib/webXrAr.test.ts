/**
 * T-FIELD-V2-01: WebXR AR tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseHitTestResult,
  computePlacementTransform,
  isValidARSurface,
  filterHitResultsByConfidence,
  DEFAULT_AR_CONFIG,
  type ARHitResult,
} from './webXrAr';

describe('DEFAULT_AR_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_AR_CONFIG.maxPlanes).toBeGreaterThan(0);
    expect(typeof DEFAULT_AR_CONFIG.enableLighting).toBe('boolean');
    expect(DEFAULT_AR_CONFIG.hitTestFrequencyHz).toBeGreaterThan(0);
  });
});

describe('parseHitTestResult', () => {
  it('parses position and normal correctly', () => {
    const hit = parseHitTestResult({ position: [1, 0, 2], normal: [0, 1, 0] });
    expect(hit.worldX).toBe(1);
    expect(hit.worldY).toBe(0);
    expect(hit.worldZ).toBe(2);
    expect(hit.normalX).toBe(0);
    expect(hit.normalY).toBe(1);
    expect(hit.normalZ).toBe(0);
  });

  it('assigns confidence 1.0 for upward-facing surface', () => {
    const hit = parseHitTestResult({ position: [0, 0, 0], normal: [0, 1, 0] });
    expect(hit.confidence).toBeCloseTo(1.0);
  });

  it('assigns lower confidence for angled surface', () => {
    const hit = parseHitTestResult({ position: [0, 0, 0], normal: [0.7071, 0.7071, 0] });
    expect(hit.confidence).toBeGreaterThan(0);
    expect(hit.confidence).toBeLessThan(1);
  });

  it('assigns near 0 confidence for vertical surface', () => {
    const hit = parseHitTestResult({ position: [0, 0, 0], normal: [1, 0, 0] });
    expect(hit.confidence).toBeCloseTo(0, 1);
  });

  it('uses default values for missing position/normal entries', () => {
    const hit = parseHitTestResult({ position: [], normal: [] });
    expect(hit.worldX).toBe(0);
    expect(hit.worldY).toBe(0);
    expect(hit.normalY).toBe(1);
  });

  it('confidence is clamped between 0 and 1', () => {
    const hit = parseHitTestResult({ position: [0, 0, 0], normal: [0, 2, 0] });
    expect(hit.confidence).toBeLessThanOrEqual(1);
    expect(hit.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('computePlacementTransform', () => {
  const flatHit: ARHitResult = {
    worldX: 1, worldY: 0, worldZ: 2,
    normalX: 0, normalY: 1, normalZ: 0,
    confidence: 1.0,
  };

  it('returns position matching hit result', () => {
    const result = computePlacementTransform(flatHit, 1.0);
    expect(result.position.x).toBe(1);
    expect(result.position.y).toBe(0);
    expect(result.position.z).toBe(2);
  });

  it('returns the provided scale', () => {
    const result = computePlacementTransform(flatHit, 2.5);
    expect(result.scale).toBe(2.5);
  });

  it('returns a non-empty elementId', () => {
    const result = computePlacementTransform(flatHit, 1.0);
    expect(typeof result.elementId).toBe('string');
    expect(result.elementId.length).toBeGreaterThan(0);
  });

  it('returns identity-like rotation for flat floor', () => {
    const result = computePlacementTransform(flatHit, 1.0);
    // For up normal, rotation should be identity (w=1)
    expect(result.rotation.w).toBeCloseTo(1, 3);
    expect(result.rotation.x).toBeCloseTo(0, 3);
  });

  it('returns quaternion values between -1 and 1', () => {
    const angledHit: ARHitResult = { ...flatHit, normalX: 0.5, normalY: 0.866, normalZ: 0 };
    const result = computePlacementTransform(angledHit, 1.0);
    expect(Math.abs(result.rotation.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.rotation.w)).toBeLessThanOrEqual(1);
  });
});

describe('isValidARSurface', () => {
  it('returns true when confidence >= default threshold (0.5)', () => {
    const hit: ARHitResult = { worldX: 0, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.8 };
    expect(isValidARSurface(hit)).toBe(true);
  });

  it('returns false when confidence < default threshold', () => {
    const hit: ARHitResult = { worldX: 0, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.3 };
    expect(isValidARSurface(hit)).toBe(false);
  });

  it('uses custom minConfidence', () => {
    const hit: ARHitResult = { worldX: 0, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.4 };
    expect(isValidARSurface(hit, 0.3)).toBe(true);
    expect(isValidARSurface(hit, 0.5)).toBe(false);
  });

  it('accepts exactly at threshold', () => {
    const hit: ARHitResult = { worldX: 0, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.5 };
    expect(isValidARSurface(hit, 0.5)).toBe(true);
  });
});

describe('filterHitResultsByConfidence', () => {
  const hits: ARHitResult[] = [
    { worldX: 0, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.9 },
    { worldX: 1, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.5 },
    { worldX: 2, worldY: 0, worldZ: 0, normalX: 0, normalY: 1, normalZ: 0, confidence: 0.2 },
  ];

  it('filters by threshold', () => {
    const result = filterHitResultsByConfidence(hits, 0.5);
    expect(result).toHaveLength(2);
  });

  it('returns all hits when threshold is 0', () => {
    expect(filterHitResultsByConfidence(hits, 0)).toHaveLength(3);
  });

  it('returns no hits when threshold is 1', () => {
    expect(filterHitResultsByConfidence(hits, 1.0)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterHitResultsByConfidence([], 0.5)).toHaveLength(0);
  });
});
