/**
 * T-SITE-V2-03: Wind shader for foliage animation.
 * Provides deterministic wind offset computation and keyframe animation generation.
 */

export interface WindShaderConfig {
  frequency: number;
  amplitude: number;
  speed: number;
  gustiness: number;
}

export const DEFAULT_WIND_CONFIG: WindShaderConfig = {
  frequency: 0.5,
  amplitude: 0.3,
  speed: 1.0,
  gustiness: 0.4,
};

export interface WindFrame {
  time: number;
  offsets: Array<{ x: number; y: number; dx: number; dy: number }>;
}

export interface WindAnimation {
  frames: WindFrame[];
  fps: number;
  durationS: number;
}

/**
 * Compute the wind displacement at position (x, y) at the given time.
 * Uses a sine-wave model with a gust factor derived from `config.gustiness`.
 */
export function computeWindOffset(
  x: number,
  y: number,
  time: number,
  config: WindShaderConfig
): { dx: number; dy: number } {
  const { frequency, amplitude, speed, gustiness } = config;
  const gustFactor = gustiness * Math.sin(0.7 * time);
  const dx = amplitude * Math.sin(frequency * x + speed * time + gustFactor);
  // dy uses y position and a phase offset for variation
  const dy = amplitude * 0.5 * Math.sin(frequency * y + speed * time * 0.8 + gustFactor + Math.PI * 0.25);
  return { dx, dy };
}

/**
 * Build a wind animation from a set of foliage points.
 */
export function generateWindAnimation(
  points: Array<{ x: number; y: number }>,
  config: WindShaderConfig,
  fps: number,
  durationS: number
): WindAnimation {
  if (fps <= 0 || durationS <= 0) {
    return { frames: [], fps, durationS };
  }

  const frameCount = Math.round(fps * durationS);
  const dt = durationS / frameCount;
  const frames: WindFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const time = f * dt;
    const offsets = points.map((p) => {
      const { dx, dy } = computeWindOffset(p.x, p.y, time, config);
      return { x: p.x, y: p.y, dx, dy };
    });
    frames.push({ time, offsets });
  }

  return { frames, fps, durationS };
}

/**
 * Linearly interpolate between two wind frames at fractional position `t` (0–1).
 * The interpolated frame's time is also lerped.
 */
export function interpolateWind(
  a: WindFrame,
  b: WindFrame,
  t: number
): WindFrame {
  const clampedT = Math.max(0, Math.min(1, t));
  const time = a.time + (b.time - a.time) * clampedT;

  const offsets = a.offsets.map((ao, i) => {
    const bo = b.offsets[i] ?? ao;
    return {
      x: ao.x + (bo.x - ao.x) * clampedT,
      y: ao.y + (bo.y - ao.y) * clampedT,
      dx: ao.dx + (bo.dx - ao.dx) * clampedT,
      dy: ao.dy + (bo.dy - ao.dy) * clampedT,
    };
  });

  return { time, offsets };
}
