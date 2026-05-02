/**
 * T-PRES-01: Unit tests for camera animation — Bezier interpolation and
 * timeline retiming.
 */
import { describe, it, expect } from 'vitest';
import {
  cubicHermite,
  interpolateCameraPath,
  retimeKeyframe,
  hasOverlap,
  generatePresetKeyframes,
  totalFrameCount,
  frameTimestamps,
  autoTangents,
  type CameraKeyframe,
  type AnimationSchema,
} from './animation';

function kf(id: string, time: number, x = 0): CameraKeyframe {
  return {
    id,
    time,
    position: { x, y: 0, z: 0 },
    target:   { x: 0, y: 0, z: 0 },
    fov: 60,
  };
}

describe('T-PRES-01: cubicHermite()', () => {
  it('t=0 returns p0', () => {
    expect(cubicHermite(0, 0, 10, 0, 0)).toBeCloseTo(0);
  });

  it('t=1 returns p1', () => {
    expect(cubicHermite(0, 0, 10, 0, 1)).toBeCloseTo(10);
  });

  it('t=0.5 midpoint between equal tangents', () => {
    // With m0=m1=0 (ease-in-out) midpoint is 5
    expect(cubicHermite(0, 0, 10, 0, 0.5)).toBeCloseTo(5);
  });

  it('matches reference value for arbitrary input', () => {
    // cubicHermite(0, 0, 10, 0, 0.25) = 2*(0.25)^3*-3*(0.25)^2+1)*0 + ... simplifies to
    // (2*0.015625 - 3*0.0625 + 1)*0 + (0.015625-0.125+0.25)*0 + (-2*0.015625+3*0.0625)*10
    // = (-0.03125 + 0.1875) * 10 = 1.5625
    expect(cubicHermite(0, 0, 10, 0, 0.25)).toBeCloseTo(1.5625);
  });
});

describe('T-PRES-01: interpolateCameraPath()', () => {
  it('empty keyframes returns default pose', () => {
    const pose = interpolateCameraPath([], 1);
    expect(pose.fov).toBe(60);
  });

  it('single keyframe returns that keyframe', () => {
    const pose = interpolateCameraPath([kf('a', 0, 5)], 99);
    expect(pose.position.x).toBeCloseTo(5);
  });

  it('before first keyframe clamps to first', () => {
    const pose = interpolateCameraPath([kf('a', 2, 10), kf('b', 5, 20)], 0);
    expect(pose.position.x).toBeCloseTo(10);
  });

  it('after last keyframe clamps to last', () => {
    const pose = interpolateCameraPath([kf('a', 0, 10), kf('b', 5, 20)], 99);
    expect(pose.position.x).toBeCloseTo(20);
  });

  it('at t=0 between two keyframes returns first', () => {
    const pose = interpolateCameraPath([kf('a', 0, 0), kf('b', 10, 100)], 0);
    expect(pose.position.x).toBeCloseTo(0);
  });

  it('at t=end between two keyframes returns last', () => {
    const pose = interpolateCameraPath([kf('a', 0, 0), kf('b', 10, 100)], 10);
    expect(pose.position.x).toBeCloseTo(100);
  });

  it('midpoint between two keyframes (no tangents) is at midpoint', () => {
    const pose = interpolateCameraPath([kf('a', 0, 0), kf('b', 10, 10)], 5);
    expect(pose.position.x).toBeCloseTo(5, 3);
  });

  it('FOV interpolates between keyframes', () => {
    const frames: CameraKeyframe[] = [
      { ...kf('a', 0), fov: 30 },
      { ...kf('b', 10), fov: 90 },
    ];
    const pose = interpolateCameraPath(frames, 5);
    expect(pose.fov).toBeCloseTo(60);
  });
});

describe('T-PRES-01: retimeKeyframe()', () => {
  it('moves keyframe to new time and re-sorts', () => {
    const kfs = [kf('a', 0), kf('b', 5), kf('c', 10)];
    // Retiming 'b' from 5 → 8 keeps it between a(0) and c(10)
    const updated = retimeKeyframe(kfs, 'b', 8);
    expect(updated.map((k) => k.id)).toEqual(['a', 'b', 'c']);
    expect(updated.find((k) => k.id === 'b')!.time).toBe(8);
    // Also verify retiming past c(10) produces ['a', 'c', 'b']
    const updated2 = retimeKeyframe(kfs, 'b', 15);
    expect(updated2.map((k) => k.id)).toEqual(['a', 'c', 'b']);
  });

  it('throws for negative time', () => {
    const kfs = [kf('a', 0), kf('b', 5)];
    expect(() => retimeKeyframe(kfs, 'b', -1)).toThrow(RangeError);
  });

  it('throws for unknown keyframe id', () => {
    const kfs = [kf('a', 0)];
    expect(() => retimeKeyframe(kfs, 'z', 5)).toThrow();
  });

  it('throws if new time overlaps existing keyframe', () => {
    const kfs = [kf('a', 0), kf('b', 5), kf('c', 10)];
    expect(() => retimeKeyframe(kfs, 'b', 10)).toThrow(/overlap/i);
  });

  it('preserves ordering after retiming', () => {
    const kfs = [kf('a', 0), kf('b', 3), kf('c', 7), kf('d', 10)];
    const updated = retimeKeyframe(kfs, 'd', 5);
    const times = updated.map((k) => k.time);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });
});

describe('T-PRES-01: hasOverlap()', () => {
  it('no overlap returns false', () => {
    expect(hasOverlap([kf('a', 0), kf('b', 1), kf('c', 2)])).toBe(false);
  });

  it('overlap within epsilon returns true', () => {
    expect(hasOverlap([kf('a', 0), kf('b', 0.005)])).toBe(true);
  });

  it('single keyframe never overlaps', () => {
    expect(hasOverlap([kf('a', 0)])).toBe(false);
  });
});

describe('T-PRES-01: generatePresetKeyframes()', () => {
  const centre = { x: 0, y: 0, z: 0 };

  it('orbit preset generates multiple keyframes', () => {
    const kfs = generatePresetKeyframes('orbit', centre, 10);
    expect(kfs.length).toBeGreaterThanOrEqual(8);
  });

  it('fly-through preset generates 3 keyframes', () => {
    expect(generatePresetKeyframes('fly-through', centre, 10)).toHaveLength(3);
  });

  it('dolly-zoom preset generates 2 keyframes', () => {
    expect(generatePresetKeyframes('dolly-zoom', centre, 10)).toHaveLength(2);
  });

  it('top-down-reveal preset generates 3 keyframes', () => {
    expect(generatePresetKeyframes('top-down-reveal', centre, 10)).toHaveLength(3);
  });

  it('elevation-sweep preset generates 3 keyframes', () => {
    expect(generatePresetKeyframes('elevation-sweep', centre, 10)).toHaveLength(3);
  });

  it('all preset keyframes are sorted by time', () => {
    for (const preset of ['orbit', 'fly-through', 'dolly-zoom', 'top-down-reveal', 'elevation-sweep'] as const) {
      const kfs = generatePresetKeyframes(preset, centre, 10);
      const times = kfs.map((k) => k.time);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });
});

describe('T-PRES-01: frame count + timestamps', () => {
  const anim: AnimationSchema = {
    id: 'a1',
    name: 'test',
    durationSeconds: 5,
    fps: 30,
    keyframes: [],
  };

  it('totalFrameCount is durationSeconds × fps', () => {
    expect(totalFrameCount(anim, { fps: 30, width: 1920, height: 1080, codec: 'h264', pathtrace: false })).toBe(150);
  });

  it('frameTimestamps has correct length', () => {
    const ts = frameTimestamps(anim, { fps: 30, width: 1920, height: 1080, codec: 'h264', pathtrace: false });
    expect(ts).toHaveLength(150);
  });

  it('first timestamp is 0', () => {
    const ts = frameTimestamps(anim, { fps: 30, width: 1920, height: 1080, codec: 'h264', pathtrace: false });
    expect(ts[0]).toBe(0);
  });

  it('frame timestamps increment by 1/fps', () => {
    const ts = frameTimestamps(anim, { fps: 30, width: 1920, height: 1080, codec: 'h264', pathtrace: false });
    expect(ts[1]).toBeCloseTo(1 / 30);
  });
});

describe('T-PRES-01: autoTangents()', () => {
  it('populates tangentIn/tangentOut for interior keyframes', () => {
    const kfs = [kf('a', 0, 0), kf('b', 5, 10), kf('c', 10, 5)];
    const result = autoTangents(kfs);
    expect(result[1]!.tangentOut).toBeDefined();
    expect(result[1]!.tangentIn).toBeDefined();
  });

  it('single keyframe returns unchanged', () => {
    const kfs = [kf('a', 0, 5)];
    const result = autoTangents(kfs);
    expect(result[0]!.tangentOut).toBeUndefined();
  });
});
