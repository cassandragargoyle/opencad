/**
 * T-PRES-03: 360° equirectangular panorama export + turntable animation.
 *
 * Implements:
 *   - Cubemap face naming and direction mapping
 *   - Cubemap → equirectangular pixel projection (pure math; actual rendering is Three.js)
 *   - Equirectangular UV → 3D direction and inverse
 *   - Turntable camera pose generation (N evenly-spaced orbit angles)
 *   - Hotspot schema
 *   - Export option types
 *
 * Actual canvas rendering, JPEG encoding, and MP4/GIF muxing happen in the
 * React export dialog component which calls these helpers.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CubemapFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface EquirectResolution {
  width: number;
  height: number;
}

export const EQUIRECT_PRESETS: Record<string, EquirectResolution> = {
  '2K': { width: 2048,  height: 1024  },
  '4K': { width: 4096,  height: 2048  },
  '8K': { width: 8192,  height: 4096  },
};

// ── Direction ↔ UV math ───────────────────────────────────────────────────────

/**
 * Convert equirectangular pixel coordinates to a unit direction vector.
 *
 * @param u  Horizontal fraction [0, 1) — 0 = leftmost column (west), 1 = wrap
 * @param v  Vertical fraction [0, 1) — 0 = top (north pole), 1 = bottom (south pole)
 */
export function equirectUVToDirection(u: number, v: number): Vec3 {
  const phi   = u * 2 * Math.PI - Math.PI; // longitude: [-π, π]
  const theta = v * Math.PI;               // co-latitude: [0, π]
  const sinTheta = Math.sin(theta);
  return {
    x:  sinTheta * Math.sin(phi),
    y:  Math.cos(theta),
    z:  sinTheta * Math.cos(phi),
  };
}

/**
 * Convert a unit direction vector to equirectangular [u, v] fractions.
 */
export function directionToEquirectUV(dir: Vec3): [number, number] {
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
  const nx = dir.x / len, ny = dir.y / len, nz = dir.z / len;
  const phi   = Math.atan2(nx, nz);               // [-π, π]
  const theta = Math.acos(Math.max(-1, Math.min(1, ny))); // [0, π]
  const u = (phi + Math.PI) / (2 * Math.PI);
  const v = theta / Math.PI;
  return [u, v];
}

// ── Cubemap face selection ────────────────────────────────────────────────────

/**
 * Given a direction vector, return which cubemap face it projects onto
 * and the face UV coordinates in [-1, 1].
 */
export function directionToCubemapFace(dir: Vec3): { face: CubemapFace; u: number; v: number } {
  const { x, y, z } = dir;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face: CubemapFace;
  let fu: number, fv: number;

  if (ax >= ay && ax >= az) {
    face = x > 0 ? 'px' : 'nx';
    fu = x > 0 ? -z / ax : z / ax;
    fv = y / ax;
  } else if (ay >= ax && ay >= az) {
    face = y > 0 ? 'py' : 'ny';
    fu = x / ay;
    fv = y > 0 ? z / ay : -z / ay;
  } else {
    face = z > 0 ? 'pz' : 'nz';
    fu = z > 0 ? x / az : -x / az;
    fv = y / az;
  }

  return { face, u: fu, v: fv };
}

// ── Equirectangular stitching plan ────────────────────────────────────────────

export interface EquirectSamplePoint {
  /** Output pixel coordinates */
  px: number;
  py: number;
  face: CubemapFace;
  /** Face UV [0,1] for bilinear sampling */
  faceU: number;
  faceV: number;
}

/**
 * Generate the complete mapping table from equirectangular output pixels
 * to cubemap face sample coordinates.
 *
 * In practice this is computed on the GPU as a shader; this pure-JS version
 * is used for testing the math is correct.
 *
 * @param width   Output equirectangular image width
 * @param height  Output equirectangular image height
 */
export function buildEquirectSampleMap(width: number, height: number): EquirectSamplePoint[] {
  const map: EquirectSamplePoint[] = [];
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width;
      const v = (py + 0.5) / height;
      const dir = equirectUVToDirection(u, v);
      const { face, u: fu, v: fv } = directionToCubemapFace(dir);
      map.push({
        px,
        py,
        face,
        faceU: (fu + 1) / 2,
        faceV: (fv + 1) / 2,
      });
    }
  }
  return map;
}

// ── Turntable ─────────────────────────────────────────────────────────────────

export interface TurntablePose {
  frameIndex: number;
  /** Orbit angle in degrees, measured from positive Z axis */
  azimuthDeg: number;
  position: Vec3;
  target: Vec3;
}

/**
 * Generate evenly-spaced turntable camera poses orbiting a centre point.
 *
 * @param numFrames  Number of orbit frames (default 36 = 10° per frame)
 * @param centre     World-space orbit centre
 * @param radius     Orbit radius
 * @param pitchDeg   Camera elevation above the centre plane (degrees)
 * @param startDeg   Starting azimuth angle (degrees)
 */
export function generateTurntablePoses(
  numFrames: number,
  centre: Vec3,
  radius: number,
  pitchDeg = 15,
  startDeg = 0,
): TurntablePose[] {
  const pitchRad = pitchDeg * (Math.PI / 180);
  const poses: TurntablePose[] = [];
  for (let i = 0; i < numFrames; i++) {
    const azimuthDeg = startDeg + (i / numFrames) * 360;
    const azRad = azimuthDeg * (Math.PI / 180);
    const position: Vec3 = {
      x: centre.x + radius * Math.cos(pitchRad) * Math.sin(azRad),
      y: centre.y + radius * Math.sin(pitchRad),
      z: centre.z + radius * Math.cos(pitchRad) * Math.cos(azRad),
    };
    poses.push({ frameIndex: i, azimuthDeg: azimuthDeg % 360, position, target: { ...centre } });
  }
  return poses;
}

/**
 * Verify that turntable poses are evenly spaced and start/end wrap correctly.
 * Returns true if the angular step between consecutive poses is uniform.
 */
export function isTurntableUniform(poses: TurntablePose[]): boolean {
  if (poses.length < 2) return true;
  const expectedStep = 360 / poses.length;
  for (let i = 0; i < poses.length - 1; i++) {
    const step = ((poses[i + 1]!.azimuthDeg - poses[i]!.azimuthDeg) + 360) % 360;
    if (Math.abs(step - expectedStep) > 0.001) return false;
  }
  return true;
}

// ── Hotspot ───────────────────────────────────────────────────────────────────

export interface PanoramaHotspot {
  id: string;
  /** Equirectangular UV of the hotspot */
  u: number;
  v: number;
  title: string;
  description?: string;
  /** Link URL for click-through */
  href?: string;
}

export interface PanoramaManifest {
  id: string;
  name: string;
  /** Panorama JPEG filename */
  filename: string;
  resolution: EquirectResolution;
  hotspots: PanoramaHotspot[];
  createdAt: string;
}

// ── Export options ────────────────────────────────────────────────────────────

export interface PanoramaExportOptions {
  resolution: '2K' | '4K' | '8K';
  faceSize?: number;
  pathtrace: boolean;
  includeViewer: boolean;
}

export interface TurntableExportOptions {
  numFrames: number;
  fps: 12 | 24 | 30;
  resolution: '1080p' | '4K';
  format: 'gif' | 'mp4' | 'both';
  pitchDeg?: number;
  radius?: number;
  pathtrace: boolean;
}

export function turntableResolution(preset: TurntableExportOptions['resolution']): { width: number; height: number } {
  return preset === '4K' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };
}
