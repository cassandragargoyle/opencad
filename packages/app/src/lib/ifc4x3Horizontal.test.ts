/**
 * #454: IFC4x3 horizontal alignment tests
 */
import { describe, it, expect } from 'vitest';
import {
  totalHorizontalLength,
  computePointOnAlignment,
  gradeAtStation,
  buildIFC4x3AlignmentStep,
  type CivicAlignment,
  type HorizontalSegmentType,
} from './ifc4x3Horizontal';

const straightAlignment: CivicAlignment = {
  id: 'align-001',
  name: 'Straight Road',
  horizontalSegments: [
    {
      segmentType: 'Line',
      startPoint: { x: 0, y: 0 },
      direction: 0,
      length: 200,
    },
    {
      segmentType: 'Line',
      startPoint: { x: 0, y: 200 },
      direction: 0,
      length: 100,
    },
  ],
  verticalSegments: [
    { startStation: 0, startElevation: 10, grade1: 0.03, grade2: 0.03, length: 300 },
  ],
};

const mixedAlignment: CivicAlignment = {
  id: 'align-002',
  name: 'Mixed Alignment',
  horizontalSegments: [
    {
      segmentType: 'Line',
      startPoint: { x: 0, y: 0 },
      direction: 0,
      length: 100,
    },
    {
      segmentType: 'CircularArc',
      startPoint: { x: 0, y: 100 },
      direction: 0,
      length: 50,
      radius: 500,
    },
    {
      segmentType: 'Clothoid',
      startPoint: { x: 0, y: 150 },
      direction: 0.1,
      length: 30,
      clothoidConstant: 200,
    },
  ],
  verticalSegments: [
    { startStation: 0, startElevation: 0, grade1: 0.02, grade2: 0.05, length: 180 },
  ],
};

describe('totalHorizontalLength', () => {
  it('sums all horizontal segment lengths', () => {
    expect(totalHorizontalLength(straightAlignment)).toBe(300);
  });

  it('returns 0 for empty segments', () => {
    const empty: CivicAlignment = { id: 'x', name: 'X', horizontalSegments: [], verticalSegments: [] };
    expect(totalHorizontalLength(empty)).toBe(0);
  });

  it('works for single segment', () => {
    const single: CivicAlignment = {
      id: 'x', name: 'X',
      horizontalSegments: [{ segmentType: 'Line', startPoint: { x: 0, y: 0 }, direction: 0, length: 150 }],
      verticalSegments: [],
    };
    expect(totalHorizontalLength(single)).toBe(150);
  });

  it('sums mixed segment types', () => {
    expect(totalHorizontalLength(mixedAlignment)).toBe(180);
  });
});

describe('computePointOnAlignment', () => {
  it('returns start point at station 0', () => {
    const pt = computePointOnAlignment(straightAlignment, 0);
    expect(pt.x).toBeCloseTo(0, 3);
    expect(pt.y).toBeCloseTo(0, 3);
  });

  it('computes correct z from vertical segment', () => {
    // At station 0: elevation = 10, grade = 0.03
    const pt = computePointOnAlignment(straightAlignment, 0);
    expect(pt.z).toBeCloseTo(10, 3);
  });

  it('increases z along constant grade', () => {
    const pt0 = computePointOnAlignment(straightAlignment, 0);
    const pt100 = computePointOnAlignment(straightAlignment, 100);
    expect(pt100.z).toBeGreaterThan(pt0.z);
    expect(pt100.z).toBeCloseTo(10 + 0.03 * 100, 3); // 13
  });

  it('returns a 3D point', () => {
    const pt = computePointOnAlignment(straightAlignment, 50);
    expect(typeof pt.x).toBe('number');
    expect(typeof pt.y).toBe('number');
    expect(typeof pt.z).toBe('number');
  });

  it('handles zero vertical segments', () => {
    const noVert: CivicAlignment = {
      id: 'x', name: 'X',
      horizontalSegments: [{ segmentType: 'Line', startPoint: { x: 0, y: 0 }, direction: 0, length: 100 }],
      verticalSegments: [],
    };
    const pt = computePointOnAlignment(noVert, 50);
    expect(pt.z).toBe(0);
  });
});

describe('gradeAtStation', () => {
  it('returns correct grade for constant grade segment', () => {
    expect(gradeAtStation(straightAlignment, 0)).toBeCloseTo(0.03, 5);
    expect(gradeAtStation(straightAlignment, 150)).toBeCloseTo(0.03, 5);
  });

  it('returns 0 for empty vertical segments', () => {
    const empty: CivicAlignment = { id: 'x', name: 'X', horizontalSegments: [], verticalSegments: [] };
    expect(gradeAtStation(empty, 100)).toBe(0);
  });

  it('interpolates between grade1 and grade2', () => {
    // grade1=0.02, grade2=0.05, length=180
    const gradeAtStart = gradeAtStation(mixedAlignment, 0);
    const gradeAtEnd = gradeAtStation(mixedAlignment, 180);
    expect(gradeAtStart).toBeCloseTo(0.02, 5);
    expect(gradeAtEnd).toBeCloseTo(0.05, 5);
  });

  it('grade at midpoint is interpolated', () => {
    const gradeMid = gradeAtStation(mixedAlignment, 90);
    // At x=90, grade = g1 + (g2-g1)/L * x = 0.02 + 0.03/180 * 90 = 0.02 + 0.015 = 0.035
    expect(gradeMid).toBeCloseTo(0.035, 5);
  });
});

describe('buildIFC4x3AlignmentStep', () => {
  it('starts with ISO-10303-21', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toMatch(/^ISO-10303-21;/);
  });

  it('includes IFC4X3 schema', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain("FILE_SCHEMA(('IFC4X3'))");
  });

  it('includes alignment name', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain('Straight Road');
  });

  it('includes IFCALIGNMENT entity', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain('IFCALIGNMENT');
  });

  it('includes horizontal segments', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain('IFCALIGNMENTHORIZONTALSEGMENT');
  });

  it('includes vertical segments when present', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain('IFCALIGNMENTVERTICALSEGMENT');
  });

  it('includes circular arc for CircularArc segment type', () => {
    const step = buildIFC4x3AlignmentStep(mixedAlignment);
    expect(step).toContain('.CIRCULARARC.');
  });

  it('includes clothoid for Clothoid segment type', () => {
    const step = buildIFC4x3AlignmentStep(mixedAlignment);
    expect(step).toContain('.CLOTHOID.');
  });

  it('ends with END-ISO-10303-21', () => {
    const step = buildIFC4x3AlignmentStep(straightAlignment);
    expect(step).toContain('END-ISO-10303-21;');
  });

  it('handles alignment with no vertical segments', () => {
    const noVert: CivicAlignment = {
      id: 'nv', name: 'NoVert',
      horizontalSegments: [{ segmentType: 'Line', startPoint: { x: 0, y: 0 }, direction: 0, length: 100 }],
      verticalSegments: [],
    };
    const step = buildIFC4x3AlignmentStep(noVert);
    expect(step).toContain('IFCALIGNMENT');
  });
});

describe('HorizontalSegmentType', () => {
  it('type values are valid', () => {
    const types: HorizontalSegmentType[] = ['Line', 'CircularArc', 'Clothoid', 'Cubic'];
    expect(types).toHaveLength(4);
  });
});
