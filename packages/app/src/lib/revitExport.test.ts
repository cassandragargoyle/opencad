/**
 * T-IO-V2-02: Revit export tests
 */
import { describe, it, expect } from 'vitest';
import {
  toRevitJSON,
  buildRevitParameterSet,
  validateRevitExport,
  REVIT_PARAMETER_TYPES,
  type OpenCADElement,
} from './revitExport';

const sampleElements: OpenCADElement[] = [
  {
    id: 'wall-1',
    type: 'walls',
    properties: { height: 3000, material: 'Concrete', thickness: 200 },
    levelId: 'lv-1',
    layerId: 'layer-0',
  },
  {
    id: 'door-1',
    type: 'doors',
    properties: { width: 900, height: 2100, fireRating: '60min', count: 1 },
    levelId: 'lv-1',
    layerId: 'layer-0',
  },
];

describe('toRevitJSON', () => {
  it('produces expected structure', () => {
    const result = toRevitJSON(sampleElements, 'Test Project') as Record<string, unknown>;
    expect(result['projectName']).toBe('Test Project');
    expect(result['schema']).toBe('opencad-revit-export/1.0');
    expect(Array.isArray(result['elements'])).toBe(true);
  });

  it('includes all elements', () => {
    const result = toRevitJSON(sampleElements, 'Test') as Record<string, unknown>;
    const elements = result['elements'] as unknown[];
    expect(elements).toHaveLength(2);
  });

  it('maps element fields correctly', () => {
    const result = toRevitJSON(sampleElements, 'P') as Record<string, unknown>;
    const els = result['elements'] as Array<Record<string, unknown>>;
    expect(els[0]['id']).toBe('wall-1');
    expect(els[0]['revitCategory']).toBe('walls');
    expect(els[0]['levelId']).toBe('lv-1');
    expect(Array.isArray(els[0]['parameters'])).toBe(true);
  });

  it('works with empty elements array', () => {
    const result = toRevitJSON([], 'Empty') as Record<string, unknown>;
    expect(result['elements']).toEqual([]);
  });
});

describe('buildRevitParameterSet', () => {
  it('infers String type for string values', () => {
    const params = buildRevitParameterSet({ material: 'Concrete' });
    expect(params[0]).toEqual({ name: 'material', value: 'Concrete', type: 'String' });
  });

  it('infers Double type for float values', () => {
    const params = buildRevitParameterSet({ area: 12.5 });
    expect(params[0]).toEqual({ name: 'area', value: 12.5, type: 'Double' });
  });

  it('infers Integer type for integer values with known integer key', () => {
    const params = buildRevitParameterSet({ count: 3 });
    expect(params[0]).toEqual({ name: 'count', value: 3, type: 'Integer' });
  });

  it('uses explicit type map for height', () => {
    const params = buildRevitParameterSet({ height: 3000 });
    expect(params[0].type).toBe('Double');
  });

  it('returns empty array for empty props', () => {
    expect(buildRevitParameterSet({})).toEqual([]);
  });

  it('handles multiple properties', () => {
    const params = buildRevitParameterSet({ width: 900, fireRating: '60min', risers: 18 });
    expect(params).toHaveLength(3);
    const names = params.map((p) => p.name);
    expect(names).toContain('width');
    expect(names).toContain('fireRating');
    expect(names).toContain('risers');
  });
});

describe('validateRevitExport', () => {
  it('validates a correct export object', () => {
    const exported = toRevitJSON(sampleElements, 'Test') as object;
    const result = validateRevitExport(exported);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing projectName', () => {
    const bad = { elements: [] };
    const result = validateRevitExport(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('projectName'))).toBe(true);
  });

  it('returns errors for missing elements array', () => {
    const bad = { projectName: 'Test' };
    const result = validateRevitExport(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('elements'))).toBe(true);
  });

  it('returns errors for element missing id', () => {
    const bad = {
      projectName: 'Test',
      elements: [{ revitCategory: 'walls', parameters: [] }],
    };
    const result = validateRevitExport(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("'id'"))).toBe(true);
  });

  it('returns errors for element missing parameters', () => {
    const bad = {
      projectName: 'Test',
      elements: [{ id: 'x', revitCategory: 'walls' }],
    };
    const result = validateRevitExport(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('parameters'))).toBe(true);
  });
});

describe('REVIT_PARAMETER_TYPES', () => {
  it('has entries for common parameters', () => {
    expect(REVIT_PARAMETER_TYPES['height']).toBe('Double');
    expect(REVIT_PARAMETER_TYPES['material']).toBe('String');
    expect(REVIT_PARAMETER_TYPES['count']).toBe('Integer');
  });
});
