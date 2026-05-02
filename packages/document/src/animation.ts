/**
 * T-PRES-01: Camera animation — keyframe timeline + Bezier interpolation.
 *
 * Implements:
 *   - CameraKeyframe type with position, target, FOV and cubic Bezier tangents
 *   - Cubic Bezier interpolation (scalar and Vec3)
 *   - Path sampling at arbitrary time
 *   - Timeline retiming helpers (drag keyframe, overlap detection)
 *   - Preset camera animations (orbit, fly-through, dolly-zoom, top-down, elevation-sweep)
 *
 * Storage: AnimationSchema is stored on DocumentSchema.presentation.animations[].
 */

// ── Vec3 ─────────────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// ── Keyframe ─────────────────────────────────────────────────────────────────

export interface CameraKeyframe {
  /** Unique id within this animation */
  id: string;
  /** Time in seconds from start of animation */
  time: number;
  position: Vec3;
  target: Vec3;
  /** Vertical FOV in degrees */
  fov: number;
  /** Incoming cubic Bezier tangent (world-space velocity vector) */
  tangentIn?: Vec3;
  /** Outgoing cubic Bezier tangent */
  tangentOut?: Vec3;
  /** Easing preset (overrides tangent if set) */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface AnimationSchema {
  id: string;
  name: string;
  durationSeconds: number;
  fps: 30 | 60;
  keyframes: CameraKeyframe[];
}

// ── Scalar cubic Bezier ──────────────────────────────────────────────────────

/**
 * Cubic Bezier scalar interpolation.
 * p0, p1 are the two endpoint values; m0, m1 are the outgoing/incoming
 * tangents (Hermite form, converted to Bezier control points internally).
 */
export function cubicHermite(p0: number, m0: number, p1: number, m1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * m1
  );
}

function cubicHermiteVec3(p0: Vec3, m0: Vec3, p1: Vec3, m1: Vec3, t: number): Vec3 {
  return {
    x: cubicHermite(p0.x, m0.x, p1.x, m1.x, t),
    y: cubicHermite(p0.y, m0.y, p1.y, m1.y, t),
    z: cubicHermite(p0.z, m0.z, p1.z, m1.z, t),
  };
}

// ── Easing ───────────────────────────────────────────────────────────────────

function applyEasing(t: number, easing: CameraKeyframe['easing']): number {
  switch (easing) {
    case 'ease-in':      return t * t;
    case 'ease-out':     return t * (2 - t);
    case 'ease-in-out':  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:             return t; // linear
  }
}

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

// ── Path sampling ─────────────────────────────────────────────────────────────

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/**
 * Interpolate camera pose at `timeSec` along a sorted keyframe list.
 * Returns the first or last keyframe pose if time is out of range.
 */
export function interpolateCameraPath(keyframes: CameraKeyframe[], timeSec: number): CameraPose {
  if (keyframes.length === 0) return { position: ZERO_VEC3, target: ZERO_VEC3, fov: 60 };
  if (keyframes.length === 1 || timeSec <= keyframes[0]!.time) {
    const kf = keyframes[0]!;
    return { position: kf.position, target: kf.target, fov: kf.fov };
  }
  const last = keyframes[keyframes.length - 1]!;
  if (timeSec >= last.time) return { position: last.position, target: last.target, fov: last.fov };

  // Find surrounding pair
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1]!.time <= timeSec) i++;
  const a = keyframes[i]!;
  const b = keyframes[i + 1]!;
  const span = b.time - a.time;
  let t = span > 0 ? (timeSec - a.time) / span : 0;

  // Apply easing (prefer outgoing keyframe's easing)
  const easingPreset = b.easing ?? a.easing;
  t = applyEasing(t, easingPreset);

  // Scale tangents by segment duration (Catmull-Rom style if tangents absent)
  const m0 = a.tangentOut ?? ZERO_VEC3;
  const m1 = b.tangentIn  ?? ZERO_VEC3;

  const scaledM0 = { x: m0.x * span, y: m0.y * span, z: m0.z * span };
  const scaledM1 = { x: m1.x * span, y: m1.y * span, z: m1.z * span };

  return {
    position: cubicHermiteVec3(a.position, scaledM0, b.position, scaledM1, t),
    target:   cubicHermiteVec3(a.target,   scaledM0, b.target,   scaledM1, t),
    fov:      cubicHermite(a.fov, 0, b.fov, 0, t),
  };
}

// ── Timeline retiming ─────────────────────────────────────────────────────────

/**
 * Move a keyframe to a new time, keeping the list sorted.
 * Returns a new sorted array; throws if `newTime` is negative or overlaps within epsilon.
 */
export function retimeKeyframe(
  keyframes: CameraKeyframe[],
  id: string,
  newTime: number,
  overlapEpsilonSec = 0.01,
): CameraKeyframe[] {
  if (newTime < 0) throw new RangeError('Keyframe time must be ≥ 0');
  const idx = keyframes.findIndex((kf) => kf.id === id);
  if (idx === -1) throw new Error(`Keyframe ${id} not found`);

  const others = keyframes.filter((kf) => kf.id !== id);
  const conflict = others.find((kf) => Math.abs(kf.time - newTime) < overlapEpsilonSec);
  if (conflict) throw new Error(`Keyframe overlap at t=${newTime}s (conflict with ${conflict.id})`);

  const updated = [...others, { ...keyframes[idx]!, time: newTime }];
  return updated.sort((a, b) => a.time - b.time);
}

/**
 * True if any two keyframes in the list are within `epsilonSec` of each other.
 */
export function hasOverlap(keyframes: CameraKeyframe[], epsilonSec = 0.01): boolean {
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1]!.time - sorted[i]!.time < epsilonSec) return true;
  }
  return false;
}

// ── Preset animations ─────────────────────────────────────────────────────────

export type AnimationPreset = 'orbit' | 'fly-through' | 'dolly-zoom' | 'top-down-reveal' | 'elevation-sweep';

/**
 * Generate preset keyframes for a model centred at `centre` with approximate `radius`.
 */
export function generatePresetKeyframes(
  preset: AnimationPreset,
  centre: Vec3,
  radius: number,
): CameraKeyframe[] {
  const { x: cx, y: cy, z: cz } = centre;
  const r = radius;

  const kf = (id: string, time: number, position: Vec3, target: Vec3, fov: number): CameraKeyframe => ({
    id, time, position, target, fov, easing: 'ease-in-out',
  });

  switch (preset) {
    case 'orbit': {
      // 360° orbit at mid-height, 8 keyframes over 10s
      const frames: CameraKeyframe[] = [];
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        frames.push(kf(`orbit-${i}`, (i / steps) * 10, {
          x: cx + r * Math.cos(angle),
          y: cy + r * 0.4,
          z: cz + r * Math.sin(angle),
        }, { x: cx, y: cy, z: cz }, 60));
      }
      return frames;
    }

    case 'fly-through':
      return [
        kf('ft-0', 0,  { x: cx - r * 1.5, y: cy + r * 0.3, z: cz }, { x: cx, y: cy, z: cz }, 75),
        kf('ft-1', 3,  { x: cx,            y: cy + r * 0.15, z: cz }, { x: cx + r * 0.5, y: cy, z: cz }, 65),
        kf('ft-2', 6,  { x: cx + r * 1.5, y: cy + r * 0.3, z: cz }, { x: cx, y: cy, z: cz }, 55),
      ];

    case 'dolly-zoom': {
      // Dolly-zoom: move closer while widening FOV to keep subject same size
      const near = r * 0.5;
      const far  = r * 2.0;
      return [
        kf('dz-0', 0, { x: cx + far,  y: cy + r * 0.1, z: cz }, { x: cx, y: cy, z: cz }, 20),
        kf('dz-1', 5, { x: cx + near, y: cy + r * 0.1, z: cz }, { x: cx, y: cy, z: cz }, 90),
      ];
    }

    case 'top-down-reveal':
      return [
        kf('td-0', 0, { x: cx, y: cy + r * 3, z: cz }, { x: cx, y: cy, z: cz }, 30),
        kf('td-1', 4, { x: cx, y: cy + r * 1, z: cz + r * 0.5 }, { x: cx, y: cy, z: cz }, 55),
        kf('td-2', 8, { x: cx + r * 0.8, y: cy + r * 0.5, z: cz + r * 0.8 }, { x: cx, y: cy, z: cz }, 65),
      ];

    case 'elevation-sweep':
      return [
        kf('es-0', 0,  { x: cx + r, y: cy,         z: cz + r }, { x: cx, y: cy, z: cz }, 60),
        kf('es-1', 5,  { x: cx + r, y: cy + r * 2, z: cz + r }, { x: cx, y: cy, z: cz }, 60),
        kf('es-2', 10, { x: cx + r, y: cy + r * 4, z: cz + r }, { x: cx, y: cy + r, z: cz }, 45),
      ];

    default:
      return [];
  }
}

// ── MP4 export options (pure config — actual encoding is browser-side) ────────

export interface Mp4ExportOptions {
  fps: 30 | 60;
  width: 1920 | 3840;
  height: 1080 | 2160;
  codec: 'h264' | 'webm';
  pathtrace: boolean;
}

/** Total frame count for a given animation and export options. */
export function totalFrameCount(animation: AnimationSchema, opts: Mp4ExportOptions): number {
  return Math.ceil(animation.durationSeconds * opts.fps);
}

/** Timestamps (seconds) for each frame. */
export function frameTimestamps(animation: AnimationSchema, opts: Mp4ExportOptions): number[] {
  const count = totalFrameCount(animation, opts);
  const dt = 1 / opts.fps;
  return Array.from({ length: count }, (_, i) => i * dt);
}

/** All camera poses to render, one per frame. */
export function exportFramePoses(animation: AnimationSchema, opts: Mp4ExportOptions): CameraPose[] {
  const ts = frameTimestamps(animation, opts);
  return ts.map((t) => interpolateCameraPath(animation.keyframes, t));
}

// ── Catmull-Rom tangent auto-generation ──────────────────────────────────────

function vec3Sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function vec3Scale(v: Vec3, s: number): Vec3 { return { x: v.x * s, y: v.y * s, z: v.z * s }; }

/**
 * Auto-generate Catmull-Rom tangents for all keyframes.
 * Returns a new array with tangentIn/tangentOut populated.
 */
export function autoTangents(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  if (keyframes.length < 2) return keyframes;
  return keyframes.map((kf, i) => {
    const prev = keyframes[i - 1];
    const next = keyframes[i + 1];
    if (!prev && !next) return kf;
    const tangent = prev && next
      ? vec3Scale(vec3Sub(next.position, prev.position), 0.5)
      : prev ? vec3Sub(kf.position, prev.position) : vec3Sub(next!.position, kf.position);
    return { ...kf, tangentIn: tangent, tangentOut: tangent };
  });
}

// ── Lerp util (exported for tests) ───────────────────────────────────────────
export { lerpVec3 };
