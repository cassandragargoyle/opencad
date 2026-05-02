/**
 * T-PRES-02: Unit tests for WebXR VR utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  computeTeleportArc,
  teleportLandingPoint,
  snapTurn,
  grabStateMachine,
  lerpAvatarPose,
  recommendFoveationLevel,
  isWebXRSupported,
  type XrAvatarPose,
} from './xrUtils';

describe('T-PRES-02: computeTeleportArc()', () => {
  it('returns numPoints arc points', () => {
    const arc = computeTeleportArc({ x: 0, y: 1, z: 0 }, { x: 0, y: 0.3, z: -1 }, 9.8, 8, 20);
    expect(arc.length).toBeGreaterThan(0);
    expect(arc.length).toBeLessThanOrEqual(20);
  });

  it('first point is the origin', () => {
    const origin = { x: 1, y: 2, z: 3 };
    const arc = computeTeleportArc(origin, { x: 0, y: 0, z: -1 }, 9.8, 8, 5);
    expect(arc[0]!.x).toBeCloseTo(1);
    expect(arc[0]!.y).toBeCloseTo(2);
    expect(arc[0]!.z).toBeCloseTo(3);
  });

  it('arc descends due to gravity when pointing horizontally', () => {
    const arc = computeTeleportArc({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, 9.8, 8, 30);
    const firstY = arc[0]!.y;
    const lastY  = arc[arc.length - 1]!.y;
    expect(lastY).toBeLessThan(firstY);
  });

  it('arc stops early if floor reached', () => {
    // Pointing straight down — should stop immediately
    const arc = computeTeleportArc({ x: 0, y: 0.1, z: 0 }, { x: 0, y: -1, z: 0 }, 9.8, 8, 30);
    expect(arc.length).toBeLessThan(30);
  });
});

describe('T-PRES-02: teleportLandingPoint()', () => {
  it('returns null for arc that never reaches floor', () => {
    // Arc entirely above y=0
    const arc = [{ x: 0, y: 1, z: 0 }, { x: 1, y: 2, z: -1 }, { x: 2, y: 3, z: -2 }];
    expect(teleportLandingPoint(arc)).toBeNull();
  });

  it('returns landing point when arc crosses y=0', () => {
    const arc = [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0.5, z: -1 }, { x: 2, y: -0.5, z: -2 }];
    const landing = teleportLandingPoint(arc);
    expect(landing).not.toBeNull();
    expect(landing!.y).toBeCloseTo(0);
  });
});

describe('T-PRES-02: snapTurn()', () => {
  it('right turn adds snap increment', () => {
    expect(snapTurn(0, 'right', 30)).toBe(30);
  });

  it('left turn subtracts snap increment', () => {
    expect(snapTurn(30, 'left', 30)).toBe(0);
  });

  it('wraps above 360', () => {
    expect(snapTurn(350, 'right', 30)).toBe(20);
  });

  it('wraps below 0', () => {
    expect(snapTurn(10, 'left', 30)).toBe(340);
  });

  it('default snap is 30 degrees', () => {
    expect(snapTurn(0, 'right')).toBe(30);
  });

  it('multiple snaps complete full circle', () => {
    let angle = 0;
    for (let i = 0; i < 12; i++) angle = snapTurn(angle, 'right', 30);
    expect(angle).toBe(0);
  });
});

describe('T-PRES-02: grabStateMachine()', () => {
  it('idle + enter → hover', () => {
    expect(grabStateMachine('idle', 'enter')).toBe('hover');
  });

  it('idle + trigger → idle (no hover)', () => {
    expect(grabStateMachine('idle', 'trigger')).toBe('idle');
  });

  it('hover + trigger → grab', () => {
    expect(grabStateMachine('hover', 'trigger')).toBe('grab');
  });

  it('hover + exit → idle', () => {
    expect(grabStateMachine('hover', 'exit')).toBe('idle');
  });

  it('grab + release → releasing', () => {
    expect(grabStateMachine('grab', 'release')).toBe('releasing');
  });

  it('grab + trigger → grab (stays)', () => {
    expect(grabStateMachine('grab', 'trigger')).toBe('grab');
  });

  it('releasing + enter → hover', () => {
    expect(grabStateMachine('releasing', 'enter')).toBe('hover');
  });

  it('releasing + trigger → idle', () => {
    expect(grabStateMachine('releasing', 'trigger')).toBe('idle');
  });

  it('full grab cycle: idle→hover→grab→releasing→idle', () => {
    let s = grabStateMachine('idle', 'enter');
    expect(s).toBe('hover');
    s = grabStateMachine(s, 'trigger');
    expect(s).toBe('grab');
    s = grabStateMachine(s, 'release');
    expect(s).toBe('releasing');
    s = grabStateMachine(s, 'exit');
    expect(s).toBe('idle');
  });
});

describe('T-PRES-02: lerpAvatarPose()', () => {
  const makeAvatar = (x: number): XrAvatarPose => ({
    peerId: 'p1',
    head: { position: { x, y: 1.7, z: 0 }, orientation: [0, 0, 0, 1] },
    updatedAt: Date.now(),
  });

  it('t=0 returns pose a', () => {
    const result = lerpAvatarPose(makeAvatar(0), makeAvatar(10), 0);
    expect(result.head.position.x).toBeCloseTo(0);
  });

  it('t=1 returns pose b', () => {
    const result = lerpAvatarPose(makeAvatar(0), makeAvatar(10), 1);
    expect(result.head.position.x).toBeCloseTo(10);
  });

  it('t=0.5 returns midpoint', () => {
    const result = lerpAvatarPose(makeAvatar(0), makeAvatar(10), 0.5);
    expect(result.head.position.x).toBeCloseTo(5);
  });
});

describe('T-PRES-02: recommendFoveationLevel()', () => {
  it('returns 0 when fps is on target', () => {
    expect(recommendFoveationLevel(90, 90)).toBe(0);
  });

  it('returns 1 when fps is slightly below target', () => {
    expect(recommendFoveationLevel(90, 75)).toBe(1);
  });

  it('returns 2 when fps is well below target', () => {
    expect(recommendFoveationLevel(90, 60)).toBe(2);
  });

  it('returns 3 when fps is critically low', () => {
    expect(recommendFoveationLevel(90, 40)).toBe(3);
  });
});

describe('T-PRES-02: isWebXRSupported()', () => {
  it('returns boolean', () => {
    expect(typeof isWebXRSupported()).toBe('boolean');
  });
});
