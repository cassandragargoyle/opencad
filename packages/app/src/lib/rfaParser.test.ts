/**
 * T-IO-V2-04: RFA Parser tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseRFAManifest,
  buildFamilyInstanceProps,
  RFA_PARAMETER_CATEGORIES,
} from './rfaParser';

const validManifest = {
  family: {
    name: 'Single-Flush Door',
    category: 'Doors',
    geometry: 'brep:door-single-flush',
    parameters: [
      { name: 'Width', type: 'Length', defaultValue: 900 },
      { name: 'Height', type: 'Length', defaultValue: 2100 },
      { name: 'FireRating', type: 'Text', defaultValue: 'None' },
    ],
  },
  types: [
    {
      id: 'type-900x2100',
      name: '0915 x 2134mm',
      parameterValues: { Width: 915, Height: 2134 },
    },
    {
      id: 'type-1200x2100',
      name: '1200 x 2100mm',
      parameterValues: { Width: 1200, Height: 2100 },
    },
  ],
};

describe('parseRFAManifest', () => {
  it('parses a valid manifest', () => {
    const entry = parseRFAManifest(validManifest);
    expect(entry.family.name).toBe('Single-Flush Door');
    expect(entry.family.category).toBe('Doors');
    expect(entry.family.parameters).toHaveLength(3);
    expect(entry.types).toHaveLength(2);
  });

  it('parses family parameters correctly', () => {
    const entry = parseRFAManifest(validManifest);
    expect(entry.family.parameters[0]).toEqual({ name: 'Width', type: 'Length', defaultValue: 900 });
    expect(entry.family.parameters[2].defaultValue).toBe('None');
  });

  it('parses types correctly', () => {
    const entry = parseRFAManifest(validManifest);
    expect(entry.types[0].id).toBe('type-900x2100');
    expect(entry.types[0].parameterValues['Width']).toBe(915);
  });

  it('throws for non-object input', () => {
    expect(() => parseRFAManifest(null)).toThrow();
    expect(() => parseRFAManifest('string')).toThrow();
  });

  it('throws when family is missing', () => {
    const { family: _f, ...rest } = validManifest;
    expect(() => parseRFAManifest(rest)).toThrow(/family/);
  });

  it('throws when family name is missing', () => {
    const bad = { ...validManifest, family: { ...validManifest.family, name: undefined } };
    expect(() => parseRFAManifest(bad)).toThrow(/name/);
  });

  it('throws when types is missing', () => {
    const { types: _t, ...rest } = validManifest;
    expect(() => parseRFAManifest(rest)).toThrow(/types/);
  });

  it('throws when type parameterValues contains non-string/number', () => {
    const bad = {
      ...validManifest,
      types: [
        { id: 'x', name: 'X', parameterValues: { Width: true } },
      ],
    };
    expect(() => parseRFAManifest(bad)).toThrow(/string or number/);
  });

  it('throws when parameter defaultValue is invalid', () => {
    const bad = {
      ...validManifest,
      family: {
        ...validManifest.family,
        parameters: [{ name: 'Width', type: 'Length', defaultValue: null }],
      },
    };
    expect(() => parseRFAManifest(bad)).toThrow(/defaultValue/);
  });
});

describe('buildFamilyInstanceProps', () => {
  it('returns defaults when typeId not found', () => {
    const entry = parseRFAManifest(validManifest);
    const props = buildFamilyInstanceProps(entry, 'non-existent');
    expect(props['Width']).toBe(900);
    expect(props['Height']).toBe(2100);
    expect(props['FireRating']).toBe('None');
  });

  it('applies type-level values', () => {
    const entry = parseRFAManifest(validManifest);
    const props = buildFamilyInstanceProps(entry, 'type-900x2100');
    expect(props['Width']).toBe(915);
    expect(props['Height']).toBe(2134);
    expect(props['FireRating']).toBe('None'); // default preserved
  });

  it('applies overrides on top of type values', () => {
    const entry = parseRFAManifest(validManifest);
    const props = buildFamilyInstanceProps(entry, 'type-900x2100', { FireRating: '60min', Width: 950 });
    expect(props['Width']).toBe(950);
    expect(props['FireRating']).toBe('60min');
  });

  it('works with no overrides', () => {
    const entry = parseRFAManifest(validManifest);
    const props = buildFamilyInstanceProps(entry, 'type-1200x2100');
    expect(props['Width']).toBe(1200);
  });
});

describe('RFA_PARAMETER_CATEGORIES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(RFA_PARAMETER_CATEGORIES)).toBe(true);
    expect(RFA_PARAMETER_CATEGORIES.length).toBeGreaterThan(0);
    expect(typeof RFA_PARAMETER_CATEGORIES[0]).toBe('string');
  });

  it('includes expected categories', () => {
    expect(RFA_PARAMETER_CATEGORIES).toContain('Dimensions');
    expect(RFA_PARAMETER_CATEGORIES).toContain('Identity Data');
  });
});
