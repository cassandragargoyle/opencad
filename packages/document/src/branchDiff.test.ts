/**
 * T-COL-01: Unit tests for branch diff.
 */
import { describe, it, expect } from 'vitest';
import { diffBranches, DIFF_COLORS, UNCHANGED_OPACITY } from './diff';
import { createProject } from './document';

function makeDoc() {
  return createProject('proj-1', 'user-1');
}

function withWall(doc: ReturnType<typeof makeDoc>, id = 'w1', name = 'Wall A') {
  // Use fixed IDs so cross-doc comparisons don't flag levelId/layerId mismatches
  doc.content.elements[id] = {
    id,
    type: 'wall',
    properties: { Name: { type: 'string', value: name } },
    propertySets: [],
    geometry: { type: 'brep', data: null },
    layerId: 'fixed-layer',
    levelId: 'fixed-level',
    transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    boundingBox: { min: { x: 0, y: 0, z: 0, _type: 'Point3D' }, max: { x: 5000, y: 200, z: 3000, _type: 'Point3D' } },
    metadata: { id, createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
    visible: true,
    locked: false,
  };
  return doc;
}

describe('T-COL-01: diffBranches()', () => {
  it('empty vs empty → no changes', () => {
    const d = diffBranches(makeDoc(), makeDoc());
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
    expect(d.modified).toHaveLength(0);
  });

  it('detects added element', () => {
    const a = makeDoc();
    const b = withWall(makeDoc(), 'w1');
    const d = diffBranches(a, b);
    expect(d.added.some((e) => e.elementId === 'w1')).toBe(true);
    expect(d.added[0].status).toBe('added');
  });

  it('detects removed element', () => {
    const a = withWall(makeDoc(), 'w1');
    const b = makeDoc();
    const d = diffBranches(a, b);
    expect(d.removed.some((e) => e.elementId === 'w1')).toBe(true);
    expect(d.removed[0].status).toBe('removed');
  });

  it('detects modified property', () => {
    const a = withWall(makeDoc(), 'w1', 'Wall A');
    const b = withWall(makeDoc(), 'w1', 'Wall B');
    const d = diffBranches(a, b);
    expect(d.modified.some((e) => e.elementId === 'w1')).toBe(true);
    const mod = d.modified.find((e) => e.elementId === 'w1')!;
    expect(mod.propertyDiffs.some((p) => p.key === 'Name')).toBe(true);
    expect(mod.propertyDiffs.find((p) => p.key === 'Name')?.before).toBe('Wall A');
    expect(mod.propertyDiffs.find((p) => p.key === 'Name')?.after).toBe('Wall B');
  });

  it('unchanged elements not included by default', () => {
    const a = withWall(makeDoc(), 'w1');
    const b = withWall(makeDoc(), 'w1');
    const d = diffBranches(a, b);
    expect(d.unchanged).toHaveLength(0);
  });

  it('unchanged elements included when option set', () => {
    const a = withWall(makeDoc(), 'w1');
    const b = withWall(makeDoc(), 'w1');
    const d = diffBranches(a, b, { includeUnchanged: true });
    expect(d.unchanged.some((e) => e.elementId === 'w1')).toBe(true);
  });

  it('totalCount sums all categories', () => {
    const a = withWall(makeDoc(), 'w1');
    const b = withWall(makeDoc(), 'w2');
    const d = diffBranches(a, b);
    expect(d.totalCount).toBe(d.added.length + d.removed.length + d.modified.length);
  });

  it('results are sorted by elementId', () => {
    const a = makeDoc();
    const b = withWall(withWall(makeDoc(), 'w2'), 'w1');
    const d = diffBranches(a, b);
    const ids = d.added.map((e) => e.elementId);
    expect(ids).toEqual([...ids].sort());
  });

  it('DIFF_COLORS has all statuses', () => {
    expect(DIFF_COLORS.added).toBeTruthy();
    expect(DIFF_COLORS.removed).toBeTruthy();
    expect(DIFF_COLORS.modified).toBeTruthy();
  });

  it('UNCHANGED_OPACITY is < 1', () => {
    expect(UNCHANGED_OPACITY).toBeLessThan(1);
    expect(UNCHANGED_OPACITY).toBeGreaterThan(0);
  });
});
