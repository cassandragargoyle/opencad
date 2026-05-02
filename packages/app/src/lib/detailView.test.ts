/**
 * T-VIEW-03: Unit tests for detailView — 2D detail view region logic.
 */
import { describe, it, expect } from 'vitest';
import {
  createDetailView,
  getDetailViewElements,
  type DetailRegion,
} from './detailView';
import type { ElementSchema } from '@opencad/document';

function makeElement(id: string, x1: number, y1: number, x2: number, y2: number): ElementSchema {
  return {
    id,
    type: 'wall',
    layerId: 'l0',
    levelId: 'lv0',
    locked: false,
    visible: true,
    properties: {},
    geometry: { type: 'line', x1, y1, x2, y2 },
  };
}

describe('T-VIEW-03: detailView', () => {
  it('createDetailView returns a view with type detail', () => {
    const view = createDetailView('Detail 1', { x: 0, y: 0, width: 5000, height: 3000 }, 20);
    expect(view.type).toBe('detail');
  });

  it('createDetailView sets view name', () => {
    const view = createDetailView('Wall Section A', { x: 0, y: 0, width: 2000, height: 1500 }, 10);
    expect(view.name).toBe('Wall Section A');
  });

  it('createDetailView stores region in view.detailRegion', () => {
    const region: DetailRegion = { x: 1000, y: 2000, width: 3000, height: 4000 };
    const view = createDetailView('Detail', region, 5);
    expect(view.detailRegion?.x).toBe(1000);
    expect(view.detailRegion?.y).toBe(2000);
    expect(view.detailRegion?.width).toBe(3000);
    expect(view.detailRegion?.height).toBe(4000);
  });

  it('createDetailView stores scale in view.detailRegion', () => {
    const view = createDetailView('Detail', { x: 0, y: 0, width: 1000, height: 1000 }, 50);
    expect(view.detailRegion?.scale).toBe(50);
  });

  it('getDetailViewElements returns elements inside the region', () => {
    const elements = [
      makeElement('e1', 100, 100, 400, 100),   // inside
      makeElement('e2', 600, 100, 900, 100),   // outside
      makeElement('e3', 200, 200, 300, 200),   // inside
    ];
    const region: DetailRegion = { x: 0, y: 0, width: 500, height: 500, scale: 10 };
    const result = getDetailViewElements(elements, region);
    const ids = result.map((e) => e.id);
    expect(ids).toContain('e1');
    expect(ids).toContain('e3');
    expect(ids).not.toContain('e2');
  });

  it('getDetailViewElements returns empty for no elements in region', () => {
    const elements = [makeElement('e1', 1000, 1000, 2000, 1000)];
    const region: DetailRegion = { x: 0, y: 0, width: 100, height: 100, scale: 10 };
    expect(getDetailViewElements(elements, region)).toHaveLength(0);
  });

  it('getDetailViewElements excludes invisible elements', () => {
    const el = makeElement('e1', 10, 10, 50, 10);
    el.visible = false;
    const region: DetailRegion = { x: 0, y: 0, width: 100, height: 100, scale: 10 };
    expect(getDetailViewElements([el], region)).toHaveLength(0);
  });

  it('element crossing region boundary is included', () => {
    // Element starts inside, ends outside
    const el = makeElement('e1', 300, 300, 700, 300);
    const region: DetailRegion = { x: 0, y: 0, width: 500, height: 500, scale: 10 };
    const result = getDetailViewElements([el], region);
    expect(result).toHaveLength(1);
  });
});
