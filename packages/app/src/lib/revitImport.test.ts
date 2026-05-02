/**
 * T-IO-V2-01: Revit import tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseRevitJSON,
  mapRevitCategoryToOpenCAD,
  extractRevitParameters,
  REVIT_CATEGORY_MAP,
} from './revitImport';

const validRevitDoc = {
  fileVersion: '2023',
  elements: [
    {
      id: 'el-1',
      revitCategory: 'Walls',
      revitFamily: 'Basic Wall',
      revitType: 'Generic - 200mm',
      parameters: { Height: 3000, Material: 'Concrete', FireRating: '1hr' },
    },
    {
      id: 'el-2',
      revitCategory: 'Doors',
      revitFamily: 'Single-Flush',
      revitType: '0915 x 2134mm',
      parameters: { Width: 915, Height: 2134 },
    },
  ],
  levels: [
    { id: 'lv-1', elevation: 0, name: 'Ground Floor' },
    { id: 'lv-2', elevation: 3000, name: 'First Floor' },
  ],
  views: [
    { id: 'v-1', name: 'Level 1', viewType: 'FloorPlan' },
    { id: 'v-2', name: '{3D}', viewType: '3D' },
  ],
};

describe('parseRevitJSON', () => {
  it('parses a valid Revit document', () => {
    const doc = parseRevitJSON(validRevitDoc);
    expect(doc.fileVersion).toBe('2023');
    expect(doc.elements).toHaveLength(2);
    expect(doc.levels).toHaveLength(2);
    expect(doc.views).toHaveLength(2);
  });

  it('parses element properties correctly', () => {
    const doc = parseRevitJSON(validRevitDoc);
    const wall = doc.elements[0];
    expect(wall.id).toBe('el-1');
    expect(wall.revitCategory).toBe('Walls');
    expect(wall.revitFamily).toBe('Basic Wall');
    expect(wall.parameters['Height']).toBe(3000);
    expect(wall.parameters['Material']).toBe('Concrete');
  });

  it('parses level data correctly', () => {
    const doc = parseRevitJSON(validRevitDoc);
    expect(doc.levels[0]).toEqual({ id: 'lv-1', elevation: 0, name: 'Ground Floor' });
    expect(doc.levels[1].elevation).toBe(3000);
  });

  it('parses view data correctly', () => {
    const doc = parseRevitJSON(validRevitDoc);
    expect(doc.views[0].viewType).toBe('FloorPlan');
    expect(doc.views[1].viewType).toBe('3D');
  });

  it('throws when input is not an object', () => {
    expect(() => parseRevitJSON('not an object')).toThrow();
    expect(() => parseRevitJSON(null)).toThrow();
    expect(() => parseRevitJSON(42)).toThrow();
  });

  it('throws when fileVersion is missing', () => {
    const invalid = { ...validRevitDoc, fileVersion: undefined };
    expect(() => parseRevitJSON(invalid)).toThrow(/fileVersion/);
  });

  it('throws when elements array is missing', () => {
    const { elements: _e, ...rest } = validRevitDoc;
    expect(() => parseRevitJSON(rest)).toThrow(/elements/);
  });

  it('throws when an element has invalid parameters type', () => {
    const bad = {
      ...validRevitDoc,
      elements: [
        { id: 'x', revitCategory: 'Walls', revitFamily: 'F', revitType: 'T', parameters: { bad: true } },
      ],
    };
    expect(() => parseRevitJSON(bad)).toThrow(/string or number/);
  });

  it('throws when level is missing elevation', () => {
    const bad = {
      ...validRevitDoc,
      levels: [{ id: 'lv-1', name: 'Ground' }],
    };
    expect(() => parseRevitJSON(bad)).toThrow(/elevation/);
  });

  it('parses empty elements/levels/views', () => {
    const empty = { fileVersion: '2024', elements: [], levels: [], views: [] };
    const doc = parseRevitJSON(empty);
    expect(doc.elements).toHaveLength(0);
  });
});

describe('mapRevitCategoryToOpenCAD', () => {
  it('maps known categories', () => {
    expect(mapRevitCategoryToOpenCAD('Walls')).toBe('walls');
    expect(mapRevitCategoryToOpenCAD('Floors')).toBe('floors');
    expect(mapRevitCategoryToOpenCAD('Doors')).toBe('doors');
    expect(mapRevitCategoryToOpenCAD('Windows')).toBe('windows');
    expect(mapRevitCategoryToOpenCAD('Roofs')).toBe('roofs');
    expect(mapRevitCategoryToOpenCAD('Columns')).toBe('columns');
  });

  it('falls back to lowercased underscored form for unknown categories', () => {
    expect(mapRevitCategoryToOpenCAD('Custom Category')).toBe('custom_category');
    expect(mapRevitCategoryToOpenCAD('MyThing')).toBe('mything');
  });
});

describe('REVIT_CATEGORY_MAP', () => {
  it('contains expected keys', () => {
    expect(REVIT_CATEGORY_MAP).toHaveProperty('Walls', 'walls');
    expect(REVIT_CATEGORY_MAP).toHaveProperty('Floors', 'floors');
    expect(REVIT_CATEGORY_MAP).toHaveProperty('Rooms', 'spaces');
  });
});

describe('extractRevitParameters', () => {
  it('extracts specified keys', () => {
    const parsed = parseRevitJSON(validRevitDoc).elements[0];
    const result = extractRevitParameters(parsed, ['Height', 'Material']);
    expect(result['Height']).toBe(3000);
    expect(result['Material']).toBe('Concrete');
  });

  it('returns undefined for missing keys', () => {
    const parsed = parseRevitJSON(validRevitDoc).elements[0];
    const result = extractRevitParameters(parsed, ['NonExistent']);
    expect(result['NonExistent']).toBeUndefined();
  });

  it('returns empty object for empty key list', () => {
    const parsed = parseRevitJSON(validRevitDoc).elements[0];
    expect(extractRevitParameters(parsed, [])).toEqual({});
  });
});
