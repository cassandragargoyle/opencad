/**
 * T-VIEW-06: Unit tests for callout — detail marker cross-reference system.
 */
import { describe, it, expect } from 'vitest';
import {
  createCalloutMarker,
  resolveCalloutLabel,
  type CalloutMarker,
} from './callout';

describe('T-VIEW-06: callout', () => {
  it('createCalloutMarker returns a marker with the target view id', () => {
    const marker = createCalloutMarker({ x: 1000, y: 2000 }, 'view-abc');
    expect(marker.targetViewId).toBe('view-abc');
  });

  it('createCalloutMarker stores position', () => {
    const marker = createCalloutMarker({ x: 500, y: 750 }, 'view-xyz');
    expect(marker.x).toBe(500);
    expect(marker.y).toBe(750);
  });

  it('createCalloutMarker has a unique id', () => {
    const m1 = createCalloutMarker({ x: 0, y: 0 }, 'view-1');
    const m2 = createCalloutMarker({ x: 0, y: 0 }, 'view-1');
    expect(m1.id).not.toBe(m2.id);
  });

  it('resolveCalloutLabel returns view name when view exists', () => {
    const views = [
      { id: 'view-1', name: 'Detail A', type: 'detail' as const },
    ];
    const label = resolveCalloutLabel('view-1', views);
    expect(label).toContain('Detail A');
  });

  it('resolveCalloutLabel returns empty string for unknown view', () => {
    const label = resolveCalloutLabel('nonexistent', []);
    expect(label).toBe('');
  });

  it('resolveCalloutLabel includes view type', () => {
    const views = [{ id: 'v1', name: 'Section B', type: 'section' as const }];
    const label = resolveCalloutLabel('v1', views);
    expect(label.toLowerCase()).toContain('section');
  });

  it('marker sheet and detail number default to undefined', () => {
    const marker = createCalloutMarker({ x: 0, y: 0 }, 'view-1');
    expect(marker.sheetNumber).toBeUndefined();
    expect(marker.detailNumber).toBeUndefined();
  });
});
