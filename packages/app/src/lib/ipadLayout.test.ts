/**
 * T-FIELD-01: Unit tests for iPad PWA layout utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyDevice,
  isTouchDevice,
  meetsHIGMinimum,
  expandToHIGMinimum,
  classifyPointer,
  isPencil,
  pencilPressureToWeight,
  computePinchGesture,
  computePalettePosition,
  withinColdStartBudget,
  HIG_MIN_HIT_TARGET,
  COLD_START_BUDGET_MS,
  type ViewportSize,
} from './ipadLayout';

describe('T-FIELD-01: classifyDevice()', () => {
  it('iPad Pro 13" landscape is ipad-13', () => {
    expect(classifyDevice({ width: 1366, height: 1024, devicePixelRatio: 2 })).toBe('ipad-13');
  });

  it('iPad Pro 11" landscape is ipad-11', () => {
    expect(classifyDevice({ width: 1194, height: 834, devicePixelRatio: 2 })).toBe('ipad-11');
  });

  it('iPhone SE portrait is iphone', () => {
    expect(classifyDevice({ width: 375, height: 667, devicePixelRatio: 2 })).toBe('iphone');
  });

  it('desktop browser is desktop', () => {
    expect(classifyDevice({ width: 1440, height: 900, devicePixelRatio: 1 })).toBe('desktop');
  });

  it('iPad in portrait orientation still classified correctly', () => {
    expect(classifyDevice({ width: 834, height: 1194, devicePixelRatio: 2 })).toBe('ipad-11');
  });
});

describe('T-FIELD-01: isTouchDevice()', () => {
  it('iPad-11 is touch', () => expect(isTouchDevice('ipad-11')).toBe(true));
  it('iPad-13 is touch', () => expect(isTouchDevice('ipad-13')).toBe(true));
  it('iPhone is touch',  () => expect(isTouchDevice('iphone')).toBe(true));
  it('Desktop is not touch', () => expect(isTouchDevice('desktop')).toBe(false));
});

describe('T-FIELD-01: HIG hit targets', () => {
  it('HIG minimum is 44px', () => {
    expect(HIG_MIN_HIT_TARGET).toBe(44);
  });

  it('44×44 meets HIG minimum', () => {
    expect(meetsHIGMinimum({ width: 44, height: 44 })).toBe(true);
  });

  it('larger than 44×44 meets minimum', () => {
    expect(meetsHIGMinimum({ width: 56, height: 48 })).toBe(true);
  });

  it('smaller than 44×44 does not meet minimum', () => {
    expect(meetsHIGMinimum({ width: 24, height: 24 })).toBe(false);
  });

  it('expandToHIGMinimum returns original when already large enough', () => {
    const t = { width: 60, height: 60 };
    expect(expandToHIGMinimum(t)).toEqual(t);
  });

  it('expandToHIGMinimum expands small targets to 44×44 minimum', () => {
    const t = expandToHIGMinimum({ width: 20, height: 20 });
    expect(t.width).toBeGreaterThanOrEqual(44);
    expect(t.height).toBeGreaterThanOrEqual(44);
  });
});

describe('T-FIELD-01: pointer classification', () => {
  it('pencil recognized from pen pointer type', () => {
    expect(classifyPointer({ pointerType: 'pen', pressure: 0.5 })).toBe('pencil');
  });

  it('finger recognized from touch pointer type', () => {
    expect(classifyPointer({ pointerType: 'touch', pressure: 0.3 })).toBe('finger');
  });

  it('mouse recognized', () => {
    expect(classifyPointer({ pointerType: 'mouse', pressure: 0 })).toBe('mouse');
  });

  it('isPencil true for pen type', () => {
    expect(isPencil({ pointerType: 'pen', pressure: 0.5 })).toBe(true);
  });

  it('isPencil false for touch', () => {
    expect(isPencil({ pointerType: 'touch', pressure: 0.5 })).toBe(false);
  });
});

describe('T-FIELD-01: pencilPressureToWeight()', () => {
  it('zero pressure gives minimum weight', () => {
    expect(pencilPressureToWeight(0)).toBeCloseTo(0.5);
  });

  it('full pressure gives maximum weight', () => {
    expect(pencilPressureToWeight(1)).toBeCloseTo(2.0);
  });

  it('mid pressure gives mid weight', () => {
    expect(pencilPressureToWeight(0.5)).toBeCloseTo(1.25);
  });

  it('pressure > 1 is clamped', () => {
    expect(pencilPressureToWeight(2)).toBeCloseTo(2.0);
  });

  it('pressure < 0 is clamped', () => {
    expect(pencilPressureToWeight(-1)).toBeCloseTo(0.5);
  });
});

describe('T-FIELD-01: computePinchGesture()', () => {
  it('no movement = scale 1, rotation 0', () => {
    const p: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }];
    const g = computePinchGesture(p, p);
    expect(g.scaleDelta).toBeCloseTo(1);
    expect(g.rotationDelta).toBeCloseTo(0);
  });

  it('spreading fingers doubles scale', () => {
    const prev: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }];
    const curr: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 200, y: 0 }];
    const g = computePinchGesture(prev, curr);
    expect(g.scaleDelta).toBeCloseTo(2);
  });

  it('rotating 90° gives π/2 rotation delta', () => {
    const prev: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }];
    const curr: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 100 }];
    const g = computePinchGesture(prev, curr);
    expect(g.rotationDelta).toBeCloseTo(Math.PI / 2);
  });

  it('centroid is midpoint of current touches', () => {
    const prev: [any, any] = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }];
    const curr: [any, any] = [{ id: 1, x: 10, y: 20 }, { id: 2, x: 90, y: 40 }];
    const g = computePinchGesture(prev, curr);
    expect(g.centroid.x).toBeCloseTo(50);
    expect(g.centroid.y).toBeCloseTo(30);
  });
});

describe('T-FIELD-01: computePalettePosition()', () => {
  const vp: ViewportSize = { width: 1194, height: 834, devicePixelRatio: 2 };

  it('right-side palette is in the right half', () => {
    const p = computePalettePosition(vp, 80, 300, 'right');
    expect(p.x).toBeGreaterThan(vp.width / 2);
    expect(p.side).toBe('right');
  });

  it('left-side palette is in the left margin', () => {
    const p = computePalettePosition(vp, 80, 300, 'left');
    expect(p.x).toBeLessThan(vp.width / 2);
    expect(p.side).toBe('left');
  });

  it('palette y is near the bottom', () => {
    const p = computePalettePosition(vp, 80, 300);
    expect(p.y).toBeGreaterThan(vp.height / 2);
  });
});

describe('T-FIELD-01: cold start budget', () => {
  it('COLD_START_BUDGET_MS is 2000', () => {
    expect(COLD_START_BUDGET_MS).toBe(2000);
  });

  it('1500ms is within budget', () => {
    expect(withinColdStartBudget(1500)).toBe(true);
  });

  it('2500ms exceeds budget', () => {
    expect(withinColdStartBudget(2500)).toBe(false);
  });
});
