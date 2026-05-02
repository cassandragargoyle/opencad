/**
 * T-PRES-03: Unit tests for 360° panorama export and turntable.
 */
import { describe, it, expect } from 'vitest';
import {
  equirectUVToDirection,
  directionToEquirectUV,
  directionToCubemapFace,
  generateTurntablePoses,
  isTurntableUniform,
  turntableResolution,
} from './panoramaExport';

describe('T-PRES-03: equirectUVToDirection()', () => {
  it('u=0.5, v=0.5 points toward the horizon at south', () => {
    const d = equirectUVToDirection(0.5, 0.5);
    expect(d.y).toBeCloseTo(0, 3);
    expect(d.z).toBeGreaterThan(0); // cos(0) for phi=0
  });

  it('v=0 points straight up (north pole)', () => {
    const d = equirectUVToDirection(0, 0);
    expect(d.y).toBeCloseTo(1, 3);
  });

  it('v=1 points straight down (south pole)', () => {
    const d = equirectUVToDirection(0, 1);
    expect(d.y).toBeCloseTo(-1, 3);
  });

  it('result is a unit vector', () => {
    for (const [u, v] of [[0.1, 0.3], [0.7, 0.5], [0.25, 0.8]]) {
      const d = equirectUVToDirection(u!, v!);
      const len = Math.sqrt(d.x**2 + d.y**2 + d.z**2);
      expect(len).toBeCloseTo(1, 5);
    }
  });
});

describe('T-PRES-03: directionToEquirectUV()', () => {
  it('round-trips through equirectUVToDirection', () => {
    for (const [u, v] of [[0.1, 0.3], [0.7, 0.5], [0.25, 0.8], [0.5, 0.5]]) {
      const dir = equirectUVToDirection(u!, v!);
      const [ru, rv] = directionToEquirectUV(dir);
      expect(ru).toBeCloseTo(u!, 4);
      expect(rv).toBeCloseTo(v!, 4);
    }
  });
});

describe('T-PRES-03: directionToCubemapFace()', () => {
  it('+X axis maps to px face', () => {
    expect(directionToCubemapFace({ x: 1, y: 0, z: 0 }).face).toBe('px');
  });

  it('-X axis maps to nx face', () => {
    expect(directionToCubemapFace({ x: -1, y: 0, z: 0 }).face).toBe('nx');
  });

  it('+Y axis maps to py face', () => {
    expect(directionToCubemapFace({ x: 0, y: 1, z: 0 }).face).toBe('py');
  });

  it('-Y axis maps to ny face', () => {
    expect(directionToCubemapFace({ x: 0, y: -1, z: 0 }).face).toBe('ny');
  });

  it('+Z axis maps to pz face', () => {
    expect(directionToCubemapFace({ x: 0, y: 0, z: 1 }).face).toBe('pz');
  });

  it('-Z axis maps to nz face', () => {
    expect(directionToCubemapFace({ x: 0, y: 0, z: -1 }).face).toBe('nz');
  });

  it('face UV is within [-1, 1]', () => {
    const dirs = [
      { x: 0.7, y: 0.3, z: 0.1 },
      { x: -0.5, y: 0.8, z: 0.2 },
      { x: 0.1, y: -0.9, z: 0.3 },
    ];
    for (const dir of dirs) {
      const { u, v } = directionToCubemapFace(dir);
      expect(u).toBeGreaterThanOrEqual(-1);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('T-PRES-03: generateTurntablePoses()', () => {
  it('generates exactly numFrames poses', () => {
    expect(generateTurntablePoses(36, { x: 0, y: 0, z: 0 }, 10)).toHaveLength(36);
  });

  it('first pose azimuth equals startDeg', () => {
    const poses = generateTurntablePoses(36, { x: 0, y: 0, z: 0 }, 10, 15, 45);
    expect(poses[0]!.azimuthDeg).toBeCloseTo(45);
  });

  it('all poses target the centre', () => {
    const centre = { x: 1, y: 2, z: 3 };
    const poses = generateTurntablePoses(8, centre, 5);
    for (const p of poses) {
      expect(p.target.x).toBeCloseTo(centre.x);
      expect(p.target.y).toBeCloseTo(centre.y);
      expect(p.target.z).toBeCloseTo(centre.z);
    }
  });

  it('all poses are at the correct orbit radius', () => {
    const centre = { x: 0, y: 0, z: 0 };
    const radius = 8;
    const pitchDeg = 15;
    const pitchRad = pitchDeg * (Math.PI / 180);
    const poses = generateTurntablePoses(36, centre, radius, pitchDeg);
    for (const p of poses) {
      const dx = p.position.x - centre.x;
      const dz = p.position.z - centre.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      expect(horizontalDist).toBeCloseTo(radius * Math.cos(pitchRad), 3);
    }
  });

  it('frame indices are 0-based sequential', () => {
    const poses = generateTurntablePoses(10, { x: 0, y: 0, z: 0 }, 5);
    expect(poses.map((p) => p.frameIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('T-PRES-03: isTurntableUniform()', () => {
  it('36 evenly-spaced poses are uniform', () => {
    const poses = generateTurntablePoses(36, { x: 0, y: 0, z: 0 }, 10);
    expect(isTurntableUniform(poses)).toBe(true);
  });

  it('non-uniform poses fail the check', () => {
    const poses = generateTurntablePoses(36, { x: 0, y: 0, z: 0 }, 10);
    poses[1] = { ...poses[1]!, azimuthDeg: 999 }; // corrupt one
    expect(isTurntableUniform(poses)).toBe(false);
  });

  it('single pose is trivially uniform', () => {
    const poses = generateTurntablePoses(1, { x: 0, y: 0, z: 0 }, 10);
    expect(isTurntableUniform(poses)).toBe(true);
  });
});

describe('T-PRES-03: turntableResolution()', () => {
  it('1080p returns 1920×1080', () => {
    const r = turntableResolution('1080p');
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });

  it('4K returns 3840×2160', () => {
    const r = turntableResolution('4K');
    expect(r.width).toBe(3840);
    expect(r.height).toBe(2160);
  });
});
