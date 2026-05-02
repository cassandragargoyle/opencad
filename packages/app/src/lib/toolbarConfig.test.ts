/**
 * #451: Unit tests for toolbar configuration.
 */
import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  getPrimaryTools,
  getSecondaryTools,
  getToolsByTier,
  effectiveTier,
  toolByShortcut,
  getFreeformTools,
  showFreeformTool,
  hideTool,
} from './toolbarConfig';

describe('#451: TOOL_REGISTRY', () => {
  it('contains architectural tools as primary', () => {
    const ids = TOOL_REGISTRY.filter((t) => t.defaultTier === 'primary').map((t) => t.id);
    expect(ids).toContain('wall');
    expect(ids).toContain('floor');
    expect(ids).toContain('roof');
    expect(ids).toContain('door');
    expect(ids).toContain('window');
  });

  it('freeform shape tools are hidden by default', () => {
    const freeform = TOOL_REGISTRY.filter((t) => t.category === 'freeform');
    expect(freeform.length).toBeGreaterThan(0);
    const allHiddenOrSecondary = freeform.every(
      (t) => t.defaultTier === 'hidden' || t.defaultTier === 'secondary',
    );
    expect(allHiddenOrSecondary).toBe(true);
  });

  it('spline, circle, polygon, freehand are hidden by default', () => {
    for (const id of ['spline', 'circle', 'polygon', 'freehand', 'rectangle']) {
      const tool = TOOL_REGISTRY.find((t) => t.id === id);
      expect(tool?.defaultTier).toBe('hidden');
    }
  });

  it('all tools have unique ids', () => {
    const ids = TOOL_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('#451: getPrimaryTools()', () => {
  it('wall, floor, roof in primary tier', () => {
    const tools = getPrimaryTools();
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('wall');
    expect(ids).toContain('floor');
    expect(ids).toContain('roof');
  });

  it('spline not in primary tier', () => {
    const tools = getPrimaryTools();
    expect(tools.find((t) => t.id === 'spline')).toBeUndefined();
  });

  it('user override can promote a tool to primary', () => {
    const tools = getPrimaryTools({ spline: 'primary' });
    expect(tools.find((t) => t.id === 'spline')).toBeDefined();
  });
});

describe('#451: getSecondaryTools()', () => {
  it('line and arc are secondary by default', () => {
    const tools = getSecondaryTools();
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('line');
    expect(ids).toContain('arc');
  });
});

describe('#451: effectiveTier()', () => {
  it('returns defaultTier when no override', () => {
    expect(effectiveTier('wall')).toBe('primary');
    expect(effectiveTier('spline')).toBe('hidden');
  });

  it('returns override tier when present', () => {
    expect(effectiveTier('spline', { spline: 'secondary' })).toBe('secondary');
  });

  it('returns hidden for unknown tool id', () => {
    expect(effectiveTier('nonexistent-tool-xyz')).toBe('hidden');
  });
});

describe('#451: toolByShortcut()', () => {
  it('W maps to wall', () => {
    expect(toolByShortcut('W')?.id).toBe('wall');
  });

  it('case insensitive', () => {
    expect(toolByShortcut('w')?.id).toBe('wall');
  });

  it('returns undefined for unmapped key', () => {
    expect(toolByShortcut('X')).toBeUndefined();
  });
});

describe('#451: getFreeformTools()', () => {
  it('returns all freeform category tools', () => {
    const tools = getFreeformTools();
    expect(tools.length).toBeGreaterThan(3);
    expect(tools.every((t) => t.category === 'freeform')).toBe(true);
  });
});

describe('#451: showFreeformTool() + hideTool()', () => {
  it('showFreeformTool promotes to secondary', () => {
    const overrides = showFreeformTool({}, 'spline');
    expect(overrides['spline']).toBe('secondary');
  });

  it('hideTool demotes to hidden', () => {
    const overrides = hideTool({}, 'line');
    expect(overrides['line']).toBe('hidden');
  });

  it('overrides are composable', () => {
    let ovr = showFreeformTool({}, 'circle');
    ovr = showFreeformTool(ovr, 'polygon');
    expect(ovr['circle']).toBe('secondary');
    expect(ovr['polygon']).toBe('secondary');
  });
});

describe('#451: tool counts', () => {
  it('at least 10 primary architectural tools', () => {
    expect(getPrimaryTools().length).toBeGreaterThanOrEqual(10);
  });

  it('no hidden tools appear in default primary or secondary tier', () => {
    const primary = getPrimaryTools();
    const secondary = getSecondaryTools();
    const visible = [...primary, ...secondary];
    const hidden = getToolsByTier('hidden');
    for (const h of hidden) {
      expect(visible.find((t) => t.id === h.id)).toBeUndefined();
    }
  });
});
