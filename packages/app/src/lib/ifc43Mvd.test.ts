/**
 * T-IO-V2-05: IFC 4.3 MVD tests
 */
import { describe, it, expect } from 'vitest';
import {
  buildAlignmentIFC,
  validateAlignment,
  computeAlignmentLength,
  type IFC43HorizontalAlignment,
  type MVDType,
} from './ifc43Mvd';

const sampleAlignment: IFC43HorizontalAlignment = {
  id: 'align-001',
  name: 'Main Road Alignment',
  segments: [
    {
      id: 'seg-1',
      segmentType: 'Line',
      startStation: 0,
      length: 100,
      startX: 0,
      startY: 0,
      azimuthRad: 0,
    },
    {
      id: 'seg-2',
      segmentType: 'Arc',
      startStation: 100,
      length: 50,
      startX: 100,
      startY: 0,
      azimuthRad: 0,
      radius: 500,
    },
    {
      id: 'seg-3',
      segmentType: 'Clothoid',
      startStation: 150,
      length: 30,
      startX: 150,
      startY: 5,
      azimuthRad: 0.1,
    },
  ],
};

describe('validateAlignment', () => {
  it('validates a correct alignment', () => {
    const result = validateAlignment(sampleAlignment);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error for empty id', () => {
    const bad = { ...sampleAlignment, id: '' };
    const result = validateAlignment(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'id'"))).toBe(true);
  });

  it('returns error for empty name', () => {
    const bad = { ...sampleAlignment, name: '' };
    const result = validateAlignment(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'name'"))).toBe(true);
  });

  it('returns error for segment with non-positive length', () => {
    const bad = {
      ...sampleAlignment,
      segments: [{ ...sampleAlignment.segments[0], length: 0 }],
    };
    const result = validateAlignment(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('length'))).toBe(true);
  });

  it('returns error for Arc segment missing radius', () => {
    const bad = {
      ...sampleAlignment,
      segments: [
        {
          id: 'arc-1',
          segmentType: 'Arc' as const,
          startStation: 0,
          length: 50,
          startX: 0,
          startY: 0,
          azimuthRad: 0,
          // no radius
        },
      ],
    };
    const result = validateAlignment(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('radius'))).toBe(true);
  });

  it('returns error for invalid segmentType', () => {
    const bad = {
      ...sampleAlignment,
      segments: [
        { ...sampleAlignment.segments[0], segmentType: 'Unknown' as 'Line' },
      ],
    };
    const result = validateAlignment(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('segmentType'))).toBe(true);
  });

  it('validates alignment with no segments (empty is technically valid structure)', () => {
    const empty = { id: 'a', name: 'Empty', segments: [] };
    const result = validateAlignment(empty);
    expect(result.valid).toBe(true);
  });
});

describe('computeAlignmentLength', () => {
  it('sums all segment lengths', () => {
    const total = computeAlignmentLength(sampleAlignment);
    expect(total).toBe(180); // 100 + 50 + 30
  });

  it('returns 0 for empty segments', () => {
    expect(computeAlignmentLength({ id: 'a', name: 'B', segments: [] })).toBe(0);
  });

  it('works for single segment', () => {
    const single: IFC43HorizontalAlignment = {
      id: 'x',
      name: 'X',
      segments: [{ id: 's1', segmentType: 'Line', startStation: 0, length: 250, startX: 0, startY: 0, azimuthRad: 0 }],
    };
    expect(computeAlignmentLength(single)).toBe(250);
  });
});

describe('buildAlignmentIFC', () => {
  it('produces a string starting with ISO-10303-21', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toMatch(/^ISO-10303-21;/);
  });

  it('includes the alignment name', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('Main Road Alignment');
  });

  it('includes IFC4X3 schema declaration', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain("FILE_SCHEMA(('IFC4X3'))");
  });

  it('includes ENDSEC and END-ISO-10303-21', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('ENDSEC;');
    expect(ifc).toContain('END-ISO-10303-21;');
  });

  it('includes alignment entity', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('IFCALIGNMENT');
  });

  it('includes Line segment type', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('.LINE.');
  });

  it('includes Arc segment type', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('.CIRCULARARC.');
  });

  it('includes Clothoid segment type', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('.CLOTHOID.');
  });

  it('includes DATA and ENDSEC sections', () => {
    const ifc = buildAlignmentIFC(sampleAlignment);
    expect(ifc).toContain('\nDATA;');
  });
});

describe('MVDType type', () => {
  it('type values are valid', () => {
    const types: MVDType[] = ['IfcReferenceView', 'IfcDesignTransferView', 'IfcAlignment'];
    expect(types).toHaveLength(3);
  });
});
