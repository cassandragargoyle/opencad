/**
 * T-PRES-02: WebXR VR utilities — teleport arc, snap-turn, grab state machine,
 * avatar pose types.
 *
 * These are pure computation helpers; actual WebXR session management lives
 * in the VRMode React component which wraps @react-three/xr.
 */

// ── Vec3 ─────────────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ── Teleport arc ──────────────────────────────────────────────────────────────

export interface ArcPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute a parabolic teleport arc for the given ray.
 *
 * @param origin     Controller position (world space)
 * @param direction  Normalised ray direction from controller
 * @param gravity    Downward acceleration (m/s², default 9.8)
 * @param velocity   Initial ray speed (m/s, default 8)
 * @param numPoints  Number of arc segments to sample
 * @returns Arc points from origin to floor impact (or max range)
 */
export function computeTeleportArc(
  origin: Vec3,
  direction: Vec3,
  gravity = 9.8,
  velocity = 8,
  numPoints = 30,
): ArcPoint[] {
  const points: ArcPoint[] = [];
  const dt = 0.05; // time step per segment

  const vx = direction.x * velocity;
  let vy = direction.y * velocity;
  const vz = direction.z * velocity;
  let px = origin.x;
  let py = origin.y;
  let pz = origin.z;

  for (let i = 0; i < numPoints; i++) {
    points.push({ x: px, y: py, z: pz });
    if (py < 0) break; // hit floor (y=0 plane)
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    vy -= gravity * dt;
  }

  return points;
}

/**
 * Find the floor landing point of a teleport arc (first point where y ≤ 0).
 * Returns null if the arc never reaches the floor.
 */
export function teleportLandingPoint(arc: ArcPoint[]): ArcPoint | null {
  for (let i = 1; i < arc.length; i++) {
    const prev = arc[i - 1]!;
    const curr = arc[i]!;
    if (curr.y <= 0 && prev.y > 0) {
      // Linear interpolate exact floor crossing
      const t = prev.y / (prev.y - curr.y);
      return {
        x: prev.x + t * (curr.x - prev.x),
        y: 0,
        z: prev.z + t * (curr.z - prev.z),
      };
    }
  }
  return arc[arc.length - 1]?.y !== undefined && arc[arc.length - 1]!.y <= 0
    ? arc[arc.length - 1]!
    : null;
}

// ── Snap-turn ─────────────────────────────────────────────────────────────────

/**
 * Snap-rotate the player yaw by a discrete increment.
 *
 * @param currentAngleDeg  Current yaw in degrees (0–360)
 * @param direction        'left' | 'right'
 * @param snapDeg          Snap increment (default 30°)
 * @returns New yaw in degrees, normalised to [0, 360)
 */
export function snapTurn(currentAngleDeg: number, direction: 'left' | 'right', snapDeg = 30): number {
  const delta = direction === 'right' ? snapDeg : -snapDeg;
  return ((currentAngleDeg + delta) % 360 + 360) % 360;
}

// ── Grab state machine ────────────────────────────────────────────────────────

export type GrabState = 'idle' | 'hover' | 'grab' | 'releasing';

export type GrabEvent =
  | 'enter'     // controller ray intersects object
  | 'exit'      // ray leaves object
  | 'trigger'   // trigger pressed while hovering
  | 'release';  // trigger released while grabbing

/**
 * Grab interaction state machine (pure function, no side effects).
 * Returns the next GrabState given current state and incoming event.
 */
export function grabStateMachine(state: GrabState, event: GrabEvent): GrabState {
  switch (state) {
    case 'idle':
      if (event === 'enter') return 'hover';
      return 'idle';

    case 'hover':
      if (event === 'exit')    return 'idle';
      if (event === 'trigger') return 'grab';
      return 'hover';

    case 'grab':
      if (event === 'release') return 'releasing';
      return 'grab';

    case 'releasing':
      // After any subsequent event, transition back to idle or hover
      if (event === 'enter') return 'hover';
      return 'idle';

    default:
      return 'idle';
  }
}

// ── Avatar poses ──────────────────────────────────────────────────────────────

export interface XrPose {
  position: Vec3;
  /** Quaternion [x, y, z, w] */
  orientation: [number, number, number, number];
}

export interface XrAvatarPose {
  peerId: string;
  peerName?: string;
  /** User colour as CSS hex string */
  colour?: string;
  head: XrPose;
  leftHand?: XrPose;
  rightHand?: XrPose;
  /** Unix timestamp ms */
  updatedAt: number;
}

/**
 * Interpolate between two avatar poses (for smooth rendering at display rate).
 */
export function lerpAvatarPose(a: XrAvatarPose, b: XrAvatarPose, t: number): XrAvatarPose {
  function lerpV3(pa: Vec3, pb: Vec3): Vec3 {
    return {
      x: pa.x + (pb.x - pa.x) * t,
      y: pa.y + (pb.y - pa.y) * t,
      z: pa.z + (pb.z - pa.z) * t,
    };
  }

  function slerpQ(qa: [number,number,number,number], qb: [number,number,number,number]): [number,number,number,number] {
    // Normalised linear interpolation (good enough for avatar display)
    const dot = qa[0]*qb[0] + qa[1]*qb[1] + qa[2]*qb[2] + qa[3]*qb[3];
    const sign = dot < 0 ? -1 : 1;
    const rx = qa[0] + t * (sign * qb[0] - qa[0]);
    const ry = qa[1] + t * (sign * qb[1] - qa[1]);
    const rz = qa[2] + t * (sign * qb[2] - qa[2]);
    const rw = qa[3] + t * (sign * qb[3] - qa[3]);
    const len = Math.sqrt(rx*rx + ry*ry + rz*rz + rw*rw);
    return [rx/len, ry/len, rz/len, rw/len];
  }

  function lerpPose(pa?: XrPose, pb?: XrPose): XrPose | undefined {
    if (!pa || !pb) return pa ?? pb;
    return { position: lerpV3(pa.position, pb.position), orientation: slerpQ(pa.orientation, pb.orientation) };
  }

  return {
    ...b,
    head:      { position: lerpV3(a.head.position, b.head.position), orientation: slerpQ(a.head.orientation, b.head.orientation) },
    leftHand:  lerpPose(a.leftHand, b.leftHand),
    rightHand: lerpPose(a.rightHand, b.rightHand),
    updatedAt: b.updatedAt,
  };
}

// ── WebXR session helpers ─────────────────────────────────────────────────────

/** True if the browser supports WebXR immersive-vr mode (runtime check). */
export function isWebXRSupported(): boolean {
  return typeof navigator !== 'undefined' && 'xr' in navigator;
}

/**
 * Async check whether immersive-vr is supported on this device.
 * Returns false in non-browser environments (SSR, tests without mock).
 */
export async function checkImmersiveVR(): Promise<boolean> {
  if (!isWebXRSupported()) return false;
  try {
    return await (navigator as unknown as { xr: { isSessionSupported(m: string): Promise<boolean> } })
      .xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}

// ── Foveation helpers ─────────────────────────────────────────────────────────

export type FoveationLevel = 0 | 1 | 2 | 3;

/**
 * Map a target fps to a recommended foveation level.
 * Higher foveation = less peripheral resolution = better performance.
 */
export function recommendFoveationLevel(targetFps: number, currentFps: number): FoveationLevel {
  const ratio = currentFps / targetFps;
  if (ratio >= 0.95) return 0;
  if (ratio >= 0.80) return 1;
  if (ratio >= 0.65) return 2;
  return 3;
}
