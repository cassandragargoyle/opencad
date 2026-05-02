/**
 * T-SITE-V2-03: Unit tests for windShader.
 */
import { describe, it, expect } from 'vitest';
import {
  computeWindOffset,
  generateWindAnimation,
  interpolateWind,
  DEFAULT_WIND_CONFIG,
  type WindShaderConfig,
  type WindFrame,
} from './windShader';

describe('T-SITE-V2-03: windShader', () => {
  // ── DEFAULT_WIND_CONFIG ─────────────────────────────────────────────────────

  it('DEFAULT_WIND_CONFIG has required keys', () => {
    expect(DEFAULT_WIND_CONFIG).toHaveProperty('frequency');
    expect(DEFAULT_WIND_CONFIG).toHaveProperty('amplitude');
    expect(DEFAULT_WIND_CONFIG).toHaveProperty('speed');
    expect(DEFAULT_WIND_CONFIG).toHaveProperty('gustiness');
  });

  // ── computeWindOffset ───────────────────────────────────────────────────────

  it('returns finite dx and dy', () => {
    const { dx, dy } = computeWindOffset(1, 2, 0.5, DEFAULT_WIND_CONFIG);
    expect(Number.isFinite(dx)).toBe(true);
    expect(Number.isFinite(dy)).toBe(true);
  });

  it('zero amplitude produces zero offset', () => {
    const cfg: WindShaderConfig = { ...DEFAULT_WIND_CONFIG, amplitude: 0 };
    const { dx, dy } = computeWindOffset(1, 2, 1, cfg);
    expect(dx).toBeCloseTo(0, 10);
    expect(dy).toBeCloseTo(0, 10);
  });

  it('offset magnitude is bounded by amplitude', () => {
    for (let t = 0; t < 10; t += 0.5) {
      const { dx } = computeWindOffset(t, t, t, DEFAULT_WIND_CONFIG);
      expect(Math.abs(dx)).toBeLessThanOrEqual(DEFAULT_WIND_CONFIG.amplitude + 1e-9);
    }
  });

  it('same position and time yields same result (deterministic)', () => {
    const r1 = computeWindOffset(3, 7, 2.5, DEFAULT_WIND_CONFIG);
    const r2 = computeWindOffset(3, 7, 2.5, DEFAULT_WIND_CONFIG);
    expect(r1.dx).toBe(r2.dx);
    expect(r1.dy).toBe(r2.dy);
  });

  it('different positions give different offsets at the same time', () => {
    const r1 = computeWindOffset(0, 0, 1, DEFAULT_WIND_CONFIG);
    const r2 = computeWindOffset(100, 100, 1, DEFAULT_WIND_CONFIG);
    expect(r1.dx).not.toBe(r2.dx);
  });

  // ── generateWindAnimation ───────────────────────────────────────────────────

  it('generates correct number of frames', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const anim = generateWindAnimation(pts, DEFAULT_WIND_CONFIG, 24, 2);
    expect(anim.frames).toHaveLength(48);
    expect(anim.fps).toBe(24);
    expect(anim.durationS).toBe(2);
  });

  it('returns empty frames for zero fps', () => {
    const anim = generateWindAnimation([{ x: 0, y: 0 }], DEFAULT_WIND_CONFIG, 0, 1);
    expect(anim.frames).toHaveLength(0);
  });

  it('returns empty frames for zero duration', () => {
    const anim = generateWindAnimation([{ x: 0, y: 0 }], DEFAULT_WIND_CONFIG, 24, 0);
    expect(anim.frames).toHaveLength(0);
  });

  it('each frame has an offset per point', () => {
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
    const anim = generateWindAnimation(pts, DEFAULT_WIND_CONFIG, 10, 1);
    for (const frame of anim.frames) {
      expect(frame.offsets).toHaveLength(3);
    }
  });

  it('frame times are evenly spaced starting near 0', () => {
    const anim = generateWindAnimation([{ x: 0, y: 0 }], DEFAULT_WIND_CONFIG, 10, 1);
    expect(anim.frames[0].time).toBeCloseTo(0, 5);
    const dt = anim.frames[1].time - anim.frames[0].time;
    for (let i = 1; i < anim.frames.length - 1; i++) {
      expect(anim.frames[i + 1].time - anim.frames[i].time).toBeCloseTo(dt, 5);
    }
  });

  // ── interpolateWind ─────────────────────────────────────────────────────────

  it('t=0 returns frame identical to a', () => {
    const a: WindFrame = { time: 0, offsets: [{ x: 0, y: 0, dx: 1, dy: 2 }] };
    const b: WindFrame = { time: 1, offsets: [{ x: 0, y: 0, dx: 3, dy: 4 }] };
    const result = interpolateWind(a, b, 0);
    expect(result.time).toBeCloseTo(0, 10);
    expect(result.offsets[0].dx).toBeCloseTo(1, 10);
    expect(result.offsets[0].dy).toBeCloseTo(2, 10);
  });

  it('t=1 returns frame identical to b', () => {
    const a: WindFrame = { time: 0, offsets: [{ x: 0, y: 0, dx: 1, dy: 2 }] };
    const b: WindFrame = { time: 1, offsets: [{ x: 0, y: 0, dx: 3, dy: 4 }] };
    const result = interpolateWind(a, b, 1);
    expect(result.time).toBeCloseTo(1, 10);
    expect(result.offsets[0].dx).toBeCloseTo(3, 10);
    expect(result.offsets[0].dy).toBeCloseTo(4, 10);
  });

  it('t=0.5 returns midpoint', () => {
    const a: WindFrame = { time: 0, offsets: [{ x: 0, y: 0, dx: 0, dy: 0 }] };
    const b: WindFrame = { time: 2, offsets: [{ x: 0, y: 0, dx: 4, dy: 8 }] };
    const result = interpolateWind(a, b, 0.5);
    expect(result.time).toBeCloseTo(1, 10);
    expect(result.offsets[0].dx).toBeCloseTo(2, 10);
    expect(result.offsets[0].dy).toBeCloseTo(4, 10);
  });

  it('clamps t below 0 to 0', () => {
    const a: WindFrame = { time: 0, offsets: [{ x: 0, y: 0, dx: 1, dy: 0 }] };
    const b: WindFrame = { time: 1, offsets: [{ x: 0, y: 0, dx: 5, dy: 0 }] };
    const result = interpolateWind(a, b, -1);
    expect(result.offsets[0].dx).toBeCloseTo(1, 10);
  });

  it('clamps t above 1 to 1', () => {
    const a: WindFrame = { time: 0, offsets: [{ x: 0, y: 0, dx: 1, dy: 0 }] };
    const b: WindFrame = { time: 1, offsets: [{ x: 0, y: 0, dx: 5, dy: 0 }] };
    const result = interpolateWind(a, b, 2);
    expect(result.offsets[0].dx).toBeCloseTo(5, 10);
  });
});
