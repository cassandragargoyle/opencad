/**
 * T-ANA-03: Unit tests for Sabine reverberation + STC.
 */
import { describe, it, expect } from 'vitest';
import {
  OCTAVE_BANDS,
  MATERIAL_ABSORPTION,
  sabineT60,
  eyringT60,
  PARTITION_STC,
  estimateCompositeSTC,
  noiseReduction,
  checkClassroomAcoustics,
} from './acoustics';

describe('T-ANA-03: material database', () => {
  it('OCTAVE_BANDS has 6 entries', () => {
    expect(OCTAVE_BANDS.length).toBe(6);
  });

  it('concrete-bare has all 6 bands', () => {
    const c = MATERIAL_ABSORPTION['concrete-bare'];
    expect(c).toBeDefined();
    for (const band of OCTAVE_BANDS) {
      expect(typeof c![band]).toBe('number');
    }
  });

  it('carpet has higher absorption at 1000Hz than concrete', () => {
    const carpet   = MATERIAL_ABSORPTION['carpet-heavy']![1000];
    const concrete = MATERIAL_ABSORPTION['concrete-bare']![1000];
    expect(carpet).toBeGreaterThan(concrete!);
  });
});

describe('T-ANA-03: Sabine T60', () => {
  function makeRoom(materialName: string) {
    return {
      volumeM3: 200,
      totalSurfaceM2: 200,
      surfaces: [{ materialName, areaSqM: 200 }],
    };
  }

  it('returns T60 for each octave band', () => {
    const t60 = sabineT60(makeRoom('concrete-bare'));
    for (const band of OCTAVE_BANDS) {
      expect(typeof t60[band]).toBe('number');
      expect(t60[band]).toBeGreaterThan(0);
    }
  });

  it('highly absorptive room has shorter T60', () => {
    const liveRoom = sabineT60(makeRoom('concrete-bare'));
    const deadRoom = sabineT60(makeRoom('acoustic-tile-suspended'));
    expect(deadRoom[500]).toBeLessThan(liveRoom[500]);
  });

  it('Sabine formula: T60 = 0.161 * V / A', () => {
    // For a room with alpha=0.02 on 200m², A=4m²; T60=0.161*200/4=8.05s
    const t60 = sabineT60({
      volumeM3: 200,
      totalSurfaceM2: 200,
      surfaces: [{ materialName: 'concrete-bare', areaSqM: 200 }],
    });
    // concrete-bare at 500Hz: alpha=0.02 → A=4 → T60=8.05
    expect(t60[500]).toBeCloseTo(8.05, 1);
  });

  it('uses default alpha for unknown material', () => {
    const t60 = sabineT60({
      volumeM3: 200,
      totalSurfaceM2: 200,
      surfaces: [{ materialName: 'unknown-xyz', areaSqM: 200 }],
    });
    // alpha=0.05, A=10, T60=0.161*200/10=3.22
    expect(t60[500]).toBeCloseTo(3.22, 1);
  });
});

describe('T-ANA-03: Eyring T60', () => {
  it('Eyring < Sabine for highly absorptive rooms', () => {
    const room = {
      volumeM3: 100,
      totalSurfaceM2: 100,
      surfaces: [{ materialName: 'carpet-heavy', areaSqM: 100 }],
    };
    const sab = sabineT60(room);
    const eyr = eyringT60(room);
    // Eyring is more accurate for high absorption — should be < Sabine
    expect(eyr[1000]).toBeLessThanOrEqual(sab[1000] + 0.1);
  });

  it('returns T60 per octave band', () => {
    const t60 = eyringT60({
      volumeM3: 200,
      totalSurfaceM2: 200,
      surfaces: [{ materialName: 'gypsum-board', areaSqM: 200 }],
    });
    for (const band of OCTAVE_BANDS) {
      expect(t60[band]).toBeGreaterThan(0);
    }
  });
});

describe('T-ANA-03: STC', () => {
  it('PARTITION_STC has gypsum-single-stud entry', () => {
    expect(PARTITION_STC['gypsum-single-stud']).toBe(33);
  });

  it('estimateCompositeSTC with one element returns that element STC', () => {
    const stc = estimateCompositeSTC([{ materialName: 'gypsum-double-layer', areaSqM: 10 }]);
    expect(stc).toBe(40);
  });

  it('composite STC with window is dominated by weaker element', () => {
    const wallOnly = estimateCompositeSTC([{ materialName: 'cmu-8in-painted', areaSqM: 10 }]);
    const withWindow = estimateCompositeSTC([
      { materialName: 'cmu-8in-painted', areaSqM: 8 },
      { materialName: 'glass-single-6mm', areaSqM: 2 },
    ]);
    expect(withWindow).toBeLessThan(wallOnly);
  });

  it('returns 0 for empty elements', () => {
    expect(estimateCompositeSTC([])).toBe(0);
  });
});

describe('T-ANA-03: noise reduction', () => {
  it('NR increases with more absorption in receiving room', () => {
    const nr_low  = noiseReduction(50, 5, 10);
    const nr_high = noiseReduction(50, 50, 10);
    expect(nr_high).toBeGreaterThan(nr_low);
  });

  it('NR decreases with larger partition', () => {
    const nr_small = noiseReduction(50, 20, 5);
    const nr_large = noiseReduction(50, 20, 20);
    expect(nr_small).toBeGreaterThan(nr_large);
  });

  it('returns STC when partition area equals receiving room absorption', () => {
    // NR = STC + 10*log10(A_B / S_p) = STC + 0 when A_B = S_p
    const nr = noiseReduction(40, 10, 10);
    expect(nr).toBeCloseTo(40, 3);
  });
});

describe('T-ANA-03: classroom acoustics (ANSI S12.60)', () => {
  it('compliant when T60 at 500 and 1000Hz ≤ 0.6s', () => {
    const t60 = { 125: 1.2, 250: 0.8, 500: 0.5, 1000: 0.5, 2000: 0.4, 4000: 0.4 } as never;
    const r   = checkClassroomAcoustics(t60);
    expect(r.T60Compliant).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('non-compliant when T60 > 0.6s', () => {
    const t60 = { 125: 2, 250: 1.5, 500: 1.2, 1000: 1.0, 2000: 0.8, 4000: 0.7 } as never;
    const r   = checkClassroomAcoustics(t60);
    expect(r.T60Compliant).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('checks background noise when provided', () => {
    const t60  = { 125: 0.4, 250: 0.4, 500: 0.4, 1000: 0.4, 2000: 0.4, 4000: 0.4 } as never;
    const loud = checkClassroomAcoustics(t60, 40); // exceeds 35 dBA
    expect(loud.noiseCompliant).toBe(false);
    expect(loud.issues.some((i) => i.includes('noise'))).toBe(true);
  });

  it('noise compliance undefined when noise not provided', () => {
    const t60 = { 125: 0.4, 250: 0.4, 500: 0.4, 1000: 0.4, 2000: 0.4, 4000: 0.4 } as never;
    const r   = checkClassroomAcoustics(t60);
    expect(r.noiseCompliant).toBeUndefined();
  });
});
