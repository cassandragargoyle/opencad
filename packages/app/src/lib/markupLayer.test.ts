/**
 * T-FIELD-02: Unit tests for the markup layer.
 */
import { describe, it, expect } from 'vitest';
import {
  addMarkup,
  updateMarkup,
  deleteMarkup,
  markupsByTool,
  markupsByBCF,
  markupsByStatus,
  markupBBox,
  serialiseMarkupLayer,
  deserialiseMarkupLayer,
  buildCloudPath,
  type MarkupLayer,
  type PenMarkup,
  type TextBoxMarkup,
  type ArrowMarkup,
} from './markupLayer';

function emptyLayer(): MarkupLayer {
  return { viewId: 'view-1', markups: [], visible: true };
}

function makePen(id = 'm1'): PenMarkup {
  return {
    id,
    tool: 'pen',
    viewId: 'view-1',
    colour: '#ff0000',
    opacity: 1,
    status: 'open',
    createdBy: 'user-1',
    createdAt: 0,
    updatedAt: 0,
    points: [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 30, y: 5 }],
    strokeWidth: 2,
  };
}

function makeTextBox(id = 'm2'): TextBoxMarkup {
  return {
    id,
    tool: 'text-box',
    viewId: 'view-1',
    colour: '#000',
    opacity: 1,
    status: 'open',
    createdBy: 'user-1',
    createdAt: 0,
    updatedAt: 0,
    x: 50, y: 50, width: 200, height: 100,
    text: 'Review this',
    fontSize: 14,
    bold: false,
    italic: false,
  };
}

describe('T-FIELD-02: addMarkup()', () => {
  it('adds a markup to an empty layer', () => {
    const layer = addMarkup(emptyLayer(), makePen());
    expect(layer.markups).toHaveLength(1);
  });

  it('does not mutate the original layer', () => {
    const orig = emptyLayer();
    addMarkup(orig, makePen());
    expect(orig.markups).toHaveLength(0);
  });

  it('preserves existing markups', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = addMarkup(layer, makePen('m2'));
    expect(layer.markups).toHaveLength(2);
  });
});

describe('T-FIELD-02: updateMarkup()', () => {
  it('updates a markup by id', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = updateMarkup(layer, 'm1', { colour: '#00ff00' });
    expect(layer.markups[0]!.colour).toBe('#00ff00');
  });

  it('throws for unknown id', () => {
    const layer = addMarkup(emptyLayer(), makePen('m1'));
    expect(() => updateMarkup(layer, 'nonexistent', { colour: '#000' })).toThrow();
  });

  it('updates updatedAt timestamp', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    const before = Date.now();
    layer = updateMarkup(layer, 'm1', { colour: '#blue' });
    expect(layer.markups[0]!.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('T-FIELD-02: deleteMarkup()', () => {
  it('removes a markup by id', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = deleteMarkup(layer, 'm1');
    expect(layer.markups).toHaveLength(0);
  });

  it('does not affect other markups', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = addMarkup(layer, makePen('m2'));
    layer = deleteMarkup(layer, 'm1');
    expect(layer.markups[0]!.id).toBe('m2');
  });

  it('no-op for unknown id', () => {
    const layer = addMarkup(emptyLayer(), makePen('m1'));
    const after = deleteMarkup(layer, 'nonexistent');
    expect(after.markups).toHaveLength(1);
  });
});

describe('T-FIELD-02: filter helpers', () => {
  it('markupsByTool filters correctly', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = addMarkup(layer, makeTextBox('m2'));
    expect(markupsByTool(layer, 'pen')).toHaveLength(1);
    expect(markupsByTool(layer, 'text-box')).toHaveLength(1);
  });

  it('markupsByBCF filters by topic guid', () => {
    const pen: PenMarkup = { ...makePen('m1'), bcfTopicGuid: 'topic-abc' };
    let layer = addMarkup(emptyLayer(), pen);
    layer = addMarkup(layer, makePen('m2'));
    expect(markupsByBCF(layer, 'topic-abc')).toHaveLength(1);
    expect(markupsByBCF(layer, 'topic-xyz')).toHaveLength(0);
  });

  it('markupsByStatus filters by status', () => {
    const resolved: PenMarkup = { ...makePen('m1'), status: 'resolved' };
    let layer = addMarkup(emptyLayer(), resolved);
    layer = addMarkup(layer, makePen('m2'));
    expect(markupsByStatus(layer, 'resolved')).toHaveLength(1);
    expect(markupsByStatus(layer, 'open')).toHaveLength(1);
  });
});

describe('T-FIELD-02: markupBBox()', () => {
  it('pen markup bbox covers all points', () => {
    const box = markupBBox(makePen());
    expect(box.minX).toBe(0);
    expect(box.minY).toBe(0);
    expect(box.maxX).toBe(30);
    expect(box.maxY).toBe(20);
  });

  it('text-box markup bbox matches x/y/width/height', () => {
    const box = markupBBox(makeTextBox());
    expect(box.minX).toBe(50);
    expect(box.minY).toBe(50);
    expect(box.maxX).toBe(250);
    expect(box.maxY).toBe(150);
  });

  it('arrow markup bbox covers from→to', () => {
    const arrow: ArrowMarkup = {
      id: 'a1', tool: 'arrow', viewId: 'v1', colour: '#000', opacity: 1,
      status: 'open', createdBy: 'u1', createdAt: 0, updatedAt: 0,
      from: { x: 10, y: 20 }, to: { x: 80, y: 60 }, strokeWidth: 1, arrowHead: 'filled',
    };
    const box = markupBBox(arrow);
    expect(box.minX).toBe(10);
    expect(box.maxX).toBe(80);
    expect(box.minY).toBe(20);
    expect(box.maxY).toBe(60);
  });
});

describe('T-FIELD-02: serialisation round-trip', () => {
  it('serialise → deserialise is identity', () => {
    let layer = addMarkup(emptyLayer(), makePen('m1'));
    layer = addMarkup(layer, makeTextBox('m2'));
    const json = serialiseMarkupLayer(layer);
    const restored = deserialiseMarkupLayer(json);
    expect(restored.markups).toHaveLength(2);
    expect(restored.viewId).toBe('view-1');
  });
});

describe('T-FIELD-02: buildCloudPath()', () => {
  it('empty points returns empty string', () => {
    expect(buildCloudPath([], 10)).toBe('');
  });

  it('single point returns empty string', () => {
    expect(buildCloudPath([{ x: 0, y: 0 }], 10)).toBe('');
  });

  it('generates path starting with M', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const path = buildCloudPath(pts, 15);
    expect(path.startsWith('M')).toBe(true);
  });

  it('generated path includes arc commands', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const path = buildCloudPath(pts, 15);
    expect(path).toContain('A');
  });

  it('path is closed with Z', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }];
    const path = buildCloudPath(pts, 10);
    expect(path.endsWith('Z')).toBe(true);
  });
});
