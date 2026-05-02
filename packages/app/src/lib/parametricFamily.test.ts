/**
 * T-EXT-V2-01: Parametric family tests
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  validateParameterValue,
  resolveFamily,
  type FamilyParameter,
  type FamilyFormula,
  type ParametricFamily,
} from './parametricFamily';

describe('evaluateFormula', () => {
  const vars = { width: 1000, depth: 500, height: 2500, count: 2 };

  it('evaluates simple variable reference', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'width' };
    expect(evaluateFormula(formula, vars)).toBe(1000);
  });

  it('evaluates addition', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'width + depth' };
    expect(evaluateFormula(formula, vars)).toBe(1500);
  });

  it('evaluates subtraction', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'width - depth' };
    expect(evaluateFormula(formula, vars)).toBe(500);
  });

  it('evaluates multiplication', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'depth * 2' };
    expect(evaluateFormula(formula, vars)).toBe(1000);
  });

  it('evaluates division', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'width / 2' };
    expect(evaluateFormula(formula, vars)).toBe(500);
  });

  it('evaluates complex expression with precedence', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'depth * 2 + count' };
    expect(evaluateFormula(formula, vars)).toBe(1002);
  });

  it('evaluates parenthesized expression', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: '(width + depth) * 2' };
    expect(evaluateFormula(formula, vars)).toBe(3000);
  });

  it('evaluates literal number', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: '42' };
    expect(evaluateFormula(formula, vars)).toBe(42);
  });

  it('evaluates negative value', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: '-width' };
    expect(evaluateFormula(formula, vars)).toBe(-1000);
  });

  it('throws for unknown variable', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'unknownVar' };
    expect(() => evaluateFormula(formula, vars)).toThrow(/unknown/i);
  });

  it('throws for division by zero', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: 'width / 0' };
    expect(() => evaluateFormula(formula, vars)).toThrow(/zero/i);
  });

  it('evaluates decimal numbers', () => {
    const formula: FamilyFormula = { outputParam: 'result', expression: '2.5 * 4' };
    expect(evaluateFormula(formula, {})).toBe(10);
  });
});

describe('validateParameterValue', () => {
  it('validates length type accepts positive numbers', () => {
    const param: FamilyParameter = { name: 'width', type: 'length', defaultValue: 1000 };
    expect(validateParameterValue(param, 500)).toBe(true);
  });

  it('validates length type rejects strings', () => {
    const param: FamilyParameter = { name: 'width', type: 'length', defaultValue: 1000 };
    expect(validateParameterValue(param, 'not a number')).toBe(false);
  });

  it('validates string type accepts strings', () => {
    const param: FamilyParameter = { name: 'material', type: 'string', defaultValue: 'Timber' };
    expect(validateParameterValue(param, 'Concrete')).toBe(true);
  });

  it('validates string type rejects numbers', () => {
    const param: FamilyParameter = { name: 'material', type: 'string', defaultValue: 'Timber' };
    expect(validateParameterValue(param, 42)).toBe(false);
  });

  it('validates boolean type accepts booleans', () => {
    const param: FamilyParameter = { name: 'visible', type: 'boolean', defaultValue: true };
    expect(validateParameterValue(param, false)).toBe(true);
    expect(validateParameterValue(param, true)).toBe(true);
  });

  it('validates boolean type rejects non-booleans', () => {
    const param: FamilyParameter = { name: 'visible', type: 'boolean', defaultValue: true };
    expect(validateParameterValue(param, 1)).toBe(false);
    expect(validateParameterValue(param, 'true')).toBe(false);
  });

  it('validates constraints min', () => {
    const param: FamilyParameter = { name: 'width', type: 'length', defaultValue: 100, constraints: { min: 50 } };
    expect(validateParameterValue(param, 50)).toBe(true);
    expect(validateParameterValue(param, 49)).toBe(false);
  });

  it('validates constraints max', () => {
    const param: FamilyParameter = { name: 'width', type: 'length', defaultValue: 100, constraints: { max: 200 } };
    expect(validateParameterValue(param, 200)).toBe(true);
    expect(validateParameterValue(param, 201)).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    const param: FamilyParameter = { name: 'width', type: 'length', defaultValue: 100 };
    expect(validateParameterValue(param, NaN)).toBe(false);
    expect(validateParameterValue(param, Infinity)).toBe(false);
  });
});

describe('resolveFamily', () => {
  const family: ParametricFamily = {
    id: 'door-family',
    name: 'Single Door',
    geometry: 'brep:door',
    parameters: [
      { name: 'width', type: 'length', defaultValue: 900 },
      { name: 'height', type: 'length', defaultValue: 2100 },
      { name: 'material', type: 'material', defaultValue: 'Timber' },
    ],
    formulas: [
      { outputParam: 'area', expression: 'width * height' },
      { outputParam: 'halfWidth', expression: 'width / 2' },
    ],
  };

  it('returns defaults when no overrides', () => {
    const resolved = resolveFamily(family, {});
    expect(resolved['width']).toBe(900);
    expect(resolved['height']).toBe(2100);
    expect(resolved['material']).toBe('Timber');
  });

  it('applies overrides', () => {
    const resolved = resolveFamily(family, { width: 1200 });
    expect(resolved['width']).toBe(1200);
    expect(resolved['height']).toBe(2100);
  });

  it('evaluates formulas with resolved values', () => {
    const resolved = resolveFamily(family, {});
    expect(resolved['area']).toBe(900 * 2100);
    expect(resolved['halfWidth']).toBe(450);
  });

  it('evaluates formulas with overridden values', () => {
    const resolved = resolveFamily(family, { width: 1200 });
    expect(resolved['area']).toBe(1200 * 2100);
    expect(resolved['halfWidth']).toBe(600);
  });
});
