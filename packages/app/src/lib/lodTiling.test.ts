/**
 * T-PERF-02 (#430): LOD tiling tests.
 */
import { describe, it, expect } from 'vitest';
import {
  computeLOD,
  createQuadtree,
  buildTileDescriptors,
  frustumCull,
  totalEstimatedVertices,
  LOD_THRESHOLDS,
  type AABB2D,
  type QuadtreeEntry,
} from './lodTiling';

const worldBounds: AABB2D = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

function makeEntry(id: string, x: number, y: number, size = 5): QuadtreeEntry {
  return { id, bounds: { minX: x, minY: y, maxX: x + size, maxY: y + size } };
}

describe('T-PERF-02: computeLOD()', () => {
  it('distance 0 is LOD 0 (full detail)', () => {
    expect(computeLOD(0)).toBe(0);
  });

  it('distance < LOD1 threshold is LOD 0', () => {
    expect(computeLOD(LOD_THRESHOLDS[1] - 1)).toBe(0);
  });

  it('distance >= LOD1 threshold is LOD 1', () => {
    expect(computeLOD(LOD_THRESHOLDS[1])).toBe(1);
  });

  it('distance >= LOD2 threshold is LOD 2', () => {
    expect(computeLOD(LOD_THRESHOLDS[2])).toBe(2);
  });

  it('distance >= LOD3 threshold is LOD 3 (culled)', () => {
    expect(computeLOD(LOD_THRESHOLDS[3])).toBe(3);
  });
});

describe('T-PERF-02: Quadtree', () => {
  it('size() tracks inserted entries', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 10, 10));
    tree.insert(makeEntry('b', 500, 500));
    expect(tree.size()).toBe(2);
  });

  it('query returns entries in region', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('in',  50, 50));
    tree.insert(makeEntry('out', 800, 800));
    const results = tree.query({ minX: 0, minY: 0, maxX: 200, maxY: 200 });
    const ids = results.map((r) => r.id);
    expect(ids).toContain('in');
    expect(ids).not.toContain('out');
  });

  it('query returns empty array for region with no entries', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 900, 900));
    const results = tree.query({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(results).toHaveLength(0);
  });

  it('handles large numbers of entries without error', () => {
    const tree = createQuadtree(worldBounds);
    for (let i = 0; i < 500; i++) {
      tree.insert(makeEntry(`e${i}`, (i * 2) % 990, (i * 3) % 990));
    }
    expect(tree.size()).toBe(500);
  });

  it('query returns all entries when querying full bounds', () => {
    const tree = createQuadtree(worldBounds);
    for (let i = 0; i < 10; i++) {
      tree.insert(makeEntry(`e${i}`, i * 50, i * 50));
    }
    const all = tree.query(worldBounds);
    expect(all.length).toBe(10);
  });
});

describe('T-PERF-02: buildTileDescriptors()', () => {
  it('returns empty array when no entries visible', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 900, 900));
    const tiles = buildTileDescriptors(tree, { minX: 0, minY: 0, maxX: 10, maxY: 10 }, 10);
    expect(tiles).toHaveLength(0);
  });

  it('returns tiles for visible entries', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 50, 50));
    tree.insert(makeEntry('b', 60, 60));
    const tiles = buildTileDescriptors(tree, { minX: 0, minY: 0, maxX: 200, maxY: 200 }, 10);
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('tiles at far distance have higher LOD number', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 50, 50));
    const closeTiles = buildTileDescriptors(tree, worldBounds, 5);
    const farTiles   = buildTileDescriptors(tree, worldBounds, 300);
    expect(farTiles[0]!.lodLevel).toBeGreaterThan(closeTiles[0]!.lodLevel);
  });

  it('elementIds is populated for each tile', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 50, 50));
    const tiles = buildTileDescriptors(tree, worldBounds, 10);
    const allIds = tiles.flatMap((t) => t.elementIds);
    expect(allIds).toContain('a');
  });
});

describe('T-PERF-02: frustumCull()', () => {
  it('returns only tiles intersecting frustum', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('near', 50, 50));
    tree.insert(makeEntry('far', 800, 800));
    const allTiles  = buildTileDescriptors(tree, worldBounds, 10);
    const culled    = frustumCull(allTiles, { minX: 0, minY: 0, maxX: 200, maxY: 200 });
    expect(culled.length).toBeLessThanOrEqual(allTiles.length);
  });
});

describe('T-PERF-02: totalEstimatedVertices()', () => {
  it('returns 0 for empty tile list', () => {
    expect(totalEstimatedVertices([])).toBe(0);
  });

  it('sums vertices across tiles', () => {
    const tree = createQuadtree(worldBounds);
    tree.insert(makeEntry('a', 50, 50));
    const tiles = buildTileDescriptors(tree, worldBounds, 10);
    expect(totalEstimatedVertices(tiles)).toBeGreaterThan(0);
  });
});
