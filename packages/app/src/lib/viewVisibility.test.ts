/**
 * T-VIS-V2-01/02 (#418, #419): Unit tests for view visibility and ghost mode.
 */
import { describe, it, expect } from 'vitest';
import {
  createViewVisibility,
  resolveElementVisibility,
  setCategoryVisible,
  setElementVisible,
  setCategoryGhost,
  resetViewVisibility,
  overriddenElementIds,
  hiddenCategories,
  DEFAULT_GHOST_CONFIG,
  type GhostModeConfig,
} from './viewVisibility';

describe('T-VIS-V2-01: createViewVisibility()', () => {
  it('creates empty state for a view', () => {
    const v = createViewVisibility('view-1');
    expect(v.viewId).toBe('view-1');
    expect(v.globalOpacity).toBe(1);
    expect(Object.keys(v.categoryOverrides)).toHaveLength(0);
    expect(Object.keys(v.elementOverrides)).toHaveLength(0);
  });
});

describe('T-VIS-V2-01: resolveElementVisibility()', () => {
  it('defaults to visible, opacity 1, no ghost', () => {
    const v = createViewVisibility('v1');
    const r = resolveElementVisibility('el-1', 'walls', v);
    expect(r.visible).toBe(true);
    expect(r.opacity).toBeCloseTo(1);
    expect(r.ghost).toBe(false);
  });

  it('category override hides all walls', () => {
    const v = setCategoryVisible(createViewVisibility('v1'), 'walls', false);
    const r = resolveElementVisibility('el-1', 'walls', v);
    expect(r.visible).toBe(false);
  });

  it('element override takes precedence over category', () => {
    let v = setCategoryVisible(createViewVisibility('v1'), 'walls', false);
    v = setElementVisible(v, 'el-1', true);
    const r = resolveElementVisibility('el-1', 'walls', v);
    expect(r.visible).toBe(true);
  });

  it('global opacity multiplies with category opacity', () => {
    const v: typeof createViewVisibility extends (...a: any[]) => infer R ? R : never =
      { ...createViewVisibility('v1'), globalOpacity: 0.5 };
    const r = resolveElementVisibility('el-1', 'walls', v);
    expect(r.opacity).toBeCloseTo(0.5);
  });
});

describe('T-VIS-V2-02: ghost mode', () => {
  const ghostConfig: GhostModeConfig = {
    ...DEFAULT_GHOST_CONFIG,
    ghostedCategories: ['floors'],
    ghostOpacity: 0.15,
    ghostColour: '#888',
  };

  it('ghosted category has reduced opacity', () => {
    const v = createViewVisibility('v1');
    const r = resolveElementVisibility('el-1', 'floors', v, ghostConfig);
    expect(r.ghost).toBe(true);
    expect(r.opacity).toBeCloseTo(0.15);
    expect(r.colour).toBe('#888');
  });

  it('non-ghosted category renders normally', () => {
    const v = createViewVisibility('v1');
    const r = resolveElementVisibility('el-1', 'walls', v, ghostConfig);
    expect(r.ghost).toBe(false);
    expect(r.opacity).toBeCloseTo(1);
  });

  it('pinned element is not ghosted even if its category is ghosted', () => {
    const config: GhostModeConfig = {
      ...ghostConfig,
      pinnedElementIds: ['pinned-el'],
    };
    const v = createViewVisibility('v1');
    const r = resolveElementVisibility('pinned-el', 'floors', v, config);
    expect(r.ghost).toBe(false);
    expect(r.opacity).toBeCloseTo(1);
  });

  it('DEFAULT_GHOST_CONFIG has reasonable opacity', () => {
    expect(DEFAULT_GHOST_CONFIG.ghostOpacity).toBeLessThan(0.3);
    expect(DEFAULT_GHOST_CONFIG.ghostOpacity).toBeGreaterThan(0);
  });
});

describe('T-VIS-V2-01: mutation helpers', () => {
  it('setCategoryVisible does not mutate original', () => {
    const orig = createViewVisibility('v1');
    setCategoryVisible(orig, 'walls', false);
    expect(orig.categoryOverrides['walls']).toBeUndefined();
  });

  it('setCategoryGhost marks category as ghost', () => {
    const v = setCategoryGhost(createViewVisibility('v1'), 'mep-duct', true);
    expect(v.categoryOverrides['mep-duct']?.ghost).toBe(true);
  });

  it('resetViewVisibility clears all overrides', () => {
    let v = setCategoryVisible(createViewVisibility('v1'), 'walls', false);
    v = setElementVisible(v, 'el-1', false);
    v = resetViewVisibility('v1');
    expect(Object.keys(v.categoryOverrides)).toHaveLength(0);
    expect(Object.keys(v.elementOverrides)).toHaveLength(0);
  });

  it('overriddenElementIds returns all overridden ids', () => {
    let v = createViewVisibility('v1');
    v = setElementVisible(v, 'el-a', false);
    v = setElementVisible(v, 'el-b', true);
    expect(overriddenElementIds(v)).toHaveLength(2);
    expect(overriddenElementIds(v)).toContain('el-a');
  });

  it('hiddenCategories returns only hidden categories', () => {
    let v = createViewVisibility('v1');
    v = setCategoryVisible(v, 'floors', false);
    v = setCategoryVisible(v, 'walls', true);
    const hidden = hiddenCategories(v);
    expect(hidden).toContain('floors');
    expect(hidden).not.toContain('walls');
  });
});
