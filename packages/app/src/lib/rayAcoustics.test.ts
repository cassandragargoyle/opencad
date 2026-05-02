/**
 * T-ANA-07: Image-source acoustics and ISO 3382 parameter tests.
 */
import { describe, it, expect } from 'vitest';
import {
  computeImageSources,
  computeImpulseResponse,
  iso3382EDT,
  iso3382C80,
  iso3382D50,
  octaveBandEnergy,
  type RoomGeometry,
  type AcousticSource,
} from './rayAcoustics';

const flatAbsorption = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] as unknown as number[];

const sampleRoom: RoomGeometry = {
  width: 10,
  depth: 8,
  height: 3,
  absorptionCoeffs: {
    floor:    [...flatAbsorption],
    ceiling:  [...flatAbsorption],
    'wall-n': [...flatAbsorption],
    'wall-s': [...flatAbsorption],
    'wall-e': [...flatAbsorption],
    'wall-w': [...flatAbsorption],
  },
};

const sampleSource: AcousticSource = {
  position: { x: 2, y: 2, z: 1.5 },
  powerDB: 90,
};

describe('T-ANA-07: computeImageSources()', () => {
  it('returns at least direct sound (order 0)', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 1);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0]!.order).toBe(0);
  });

  it('includes higher-order reflections when maxOrder > 0', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 2);
    const higherOrder = refs.filter((r) => r.order > 0);
    expect(higherOrder.length).toBeGreaterThan(0);
  });

  it('reflections are sorted by delay (ascending)', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 2);
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i]!.delay).toBeGreaterThanOrEqual(refs[i - 1]!.delay);
    }
  });

  it('all delays are positive', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 1);
    refs.forEach((r) => expect(r.delay).toBeGreaterThanOrEqual(0));
  });

  it('more orders produces more reflections', () => {
    const refs1 = computeImageSources(sampleRoom, sampleSource, 1);
    const refs2 = computeImageSources(sampleRoom, sampleSource, 2);
    expect(refs2.length).toBeGreaterThan(refs1.length);
  });
});

describe('T-ANA-07: computeImpulseResponse()', () => {
  it('returns correct length Float32Array', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 1);
    const ir = computeImpulseResponse(refs, 48000, 1000);
    expect(ir).toBeInstanceOf(Float32Array);
    expect(ir.length).toBe(48000); // 1000ms at 48kHz
  });

  it('has non-zero values', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 1);
    const ir = computeImpulseResponse(refs, 48000, 1000);
    const sum = ir.reduce((s, v) => s + Math.abs(v), 0);
    expect(sum).toBeGreaterThan(0);
  });
});

describe('T-ANA-07: iso3382EDT()', () => {
  it('returns a positive number', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 2);
    const ir = computeImpulseResponse(refs, 48000, 1000);
    const edt = iso3382EDT(ir, 48000);
    expect(edt).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for silent IR', () => {
    const ir = new Float32Array(1000);
    expect(iso3382EDT(ir, 48000)).toBe(0);
  });
});

describe('T-ANA-07: iso3382C80()', () => {
  it('returns a finite number for typical IR', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 2);
    const ir = computeImpulseResponse(refs, 48000, 1000);
    const c80 = iso3382C80(ir, 48000);
    expect(isFinite(c80)).toBe(true);
  });

  it('dry room (direct sound only) has high C80', () => {
    // Single spike at t=0: all energy is early
    const ir = new Float32Array(48000);
    ir[0] = 1.0;
    const c80 = iso3382C80(ir, 48000);
    // All energy early, no late energy → returns 10
    expect(c80).toBe(10);
  });
});

describe('T-ANA-07: iso3382D50()', () => {
  it('returns value between 0 and 1', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 2);
    const ir = computeImpulseResponse(refs, 48000, 1000);
    const d50 = iso3382D50(ir, 48000);
    expect(d50).toBeGreaterThanOrEqual(0);
    expect(d50).toBeLessThanOrEqual(1);
  });

  it('direct-only IR has D50 near 1', () => {
    const ir = new Float32Array(48000);
    ir[0] = 1.0;
    const d50 = iso3382D50(ir, 48000);
    expect(d50).toBeCloseTo(1, 5);
  });
});

describe('T-ANA-07: octaveBandEnergy()', () => {
  it('returns a non-negative number', () => {
    const refs = computeImageSources(sampleRoom, sampleSource, 1);
    const ir = computeImpulseResponse(refs, 48000, 500);
    const energy = octaveBandEnergy(ir, 48000, 500);
    expect(energy).toBeGreaterThanOrEqual(0);
  });
});
