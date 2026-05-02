/**
 * T-VIEW-10: Unit tests for legendView — legend view with material/symbol entries.
 */
import { describe, it, expect } from 'vitest';
import {
  createLegendView,
  addLegendEntry,
  type LegendView,
  type LegendEntryType,
} from './legendView';

describe('T-VIEW-10: legendView', () => {
  it('createLegendView returns a view with type legend', () => {
    const view = createLegendView('Material Legend');
    expect(view.type).toBe('legend');
  });

  it('createLegendView sets the name', () => {
    const view = createLegendView('Door Type Legend');
    expect(view.name).toBe('Door Type Legend');
  });

  it('createLegendView starts with empty entries', () => {
    const view = createLegendView('Finish Legend');
    expect(view.entries).toHaveLength(0);
  });

  it('addLegendEntry adds a hatch entry', () => {
    const view = createLegendView('Legend');
    addLegendEntry(view, { type: 'hatch', label: 'Brick', description: '102mm facing brick' });
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]?.type).toBe('hatch');
  });

  it('addLegendEntry adds a symbol entry', () => {
    const view = createLegendView('Legend');
    addLegendEntry(view, { type: 'symbol', label: 'Door', description: 'Type D1 internal' });
    expect(view.entries[0]?.type).toBe('symbol');
  });

  it('addLegendEntry adds a line-style entry', () => {
    const view = createLegendView('Legend');
    addLegendEntry(view, { type: 'line-style', label: 'Setout line', description: 'Long dashed' });
    expect(view.entries[0]?.type).toBe('line-style');
  });

  it('multiple entries accumulate in order', () => {
    const view = createLegendView('Legend');
    addLegendEntry(view, { type: 'hatch', label: 'A', description: '' });
    addLegendEntry(view, { type: 'hatch', label: 'B', description: '' });
    addLegendEntry(view, { type: 'symbol', label: 'C', description: '' });
    expect(view.entries).toHaveLength(3);
    expect(view.entries.map((e) => e.label)).toEqual(['A', 'B', 'C']);
  });

  it('legend entry has a unique id', () => {
    const view = createLegendView('Legend');
    addLegendEntry(view, { type: 'hatch', label: 'X', description: '' });
    addLegendEntry(view, { type: 'hatch', label: 'Y', description: '' });
    const ids = view.entries.map((e) => e.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
