/**
 * T-PERF-02 (#430): LOD (Level of Detail) tiling for 500k+ element scenes.
 *
 * Implements:
 *   - Quadtree spatial index for 2D element bounding boxes
 *   - LOD level assignment based on camera distance / zoom level
 *   - Tile descriptor generation for progressive loading
 *   - Frustum culling against tile bounds
 */

// ── Geometry primitives ───────────────────────────────────────────────────────

export interface AABB2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point2D {
  x: number;
  y: number;
}

// ── LOD levels ────────────────────────────────────────────────────────────────

export type LODLevel = 0 | 1 | 2 | 3;

/**
 * LOD level semantics:
 *   0 = full detail (all geometry, textures)
 *   1 = reduced (simplified meshes, no textures)
 *   2 = bbox proxy (just bounding box rectangles)
 *   3 = culled (not rendered)
 */
export const LOD_THRESHOLDS: Record<LODLevel, number> = {
  0: 0,      // distance 0 – always full detail
  1: 50,     // > 50 m equivalent
  2: 200,    // > 200 m equivalent
  3: 1000,   // > 1000 m equivalent → cull
};

/**
 * Compute the appropriate LOD level for an element at a given camera distance.
 */
export function computeLOD(distanceM: number): LODLevel {
  if (distanceM < LOD_THRESHOLDS[1]) return 0;
  if (distanceM < LOD_THRESHOLDS[2]) return 1;
  if (distanceM < LOD_THRESHOLDS[3]) return 2;
  return 3;
}

// ── Quadtree ──────────────────────────────────────────────────────────────────

export interface QuadtreeEntry {
  id: string;
  bounds: AABB2D;
}

interface QuadtreeNode {
  bounds: AABB2D;
  entries: QuadtreeEntry[];
  children: QuadtreeNode[] | null;
  depth: number;
}

const MAX_ENTRIES_PER_NODE = 8;
const MAX_DEPTH = 8;

function aabbIntersects(a: AABB2D, b: AABB2D): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function aabbContains(outer: AABB2D, inner: AABB2D): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

function splitNode(node: QuadtreeNode): void {
  const { minX, minY, maxX, maxY } = node.bounds;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const d    = node.depth + 1;

  node.children = [
    { bounds: { minX, minY, maxX: midX, maxY: midY }, entries: [], children: null, depth: d },
    { bounds: { minX: midX, minY, maxX, maxY: midY }, entries: [], children: null, depth: d },
    { bounds: { minX, minY: midY, maxX: midX, maxY }, entries: [], children: null, depth: d },
    { bounds: { minX: midX, minY: midY, maxX, maxY }, entries: [], children: null, depth: d },
  ];

  // Redistribute entries
  const overflow: QuadtreeEntry[] = [];
  for (const e of node.entries) {
    let placed = false;
    for (const child of node.children) {
      if (aabbContains(child.bounds, e.bounds)) {
        child.entries.push(e);
        placed = true;
        break;
      }
    }
    if (!placed) overflow.push(e);
  }
  node.entries = overflow;
}

function insertIntoNode(node: QuadtreeNode, entry: QuadtreeEntry): void {
  // Try to place in a child node first
  if (node.children) {
    for (const child of node.children) {
      if (aabbContains(child.bounds, entry.bounds)) {
        insertIntoNode(child, entry);
        return;
      }
    }
    // Doesn't fit entirely in one child — keep at this level
    node.entries.push(entry);
    return;
  }

  node.entries.push(entry);

  // Split if over capacity and not at max depth
  if (node.entries.length > MAX_ENTRIES_PER_NODE && node.depth < MAX_DEPTH) {
    splitNode(node);
  }
}

function queryNode(node: QuadtreeNode, query: AABB2D, out: QuadtreeEntry[]): void {
  if (!aabbIntersects(node.bounds, query)) return;

  for (const e of node.entries) {
    if (aabbIntersects(e.bounds, query)) out.push(e);
  }

  if (node.children) {
    for (const child of node.children) {
      queryNode(child, query, out);
    }
  }
}

export interface Quadtree {
  insert(entry: QuadtreeEntry): void;
  query(region: AABB2D): QuadtreeEntry[];
  /** Total entries in the tree */
  size(): number;
}

/**
 * Create a quadtree covering the given world bounds.
 */
export function createQuadtree(worldBounds: AABB2D): Quadtree {
  const root: QuadtreeNode = {
    bounds:   worldBounds,
    entries:  [],
    children: null,
    depth:    0,
  };
  let count = 0;

  return {
    insert(entry: QuadtreeEntry): void {
      insertIntoNode(root, entry);
      count++;
    },
    query(region: AABB2D): QuadtreeEntry[] {
      const out: QuadtreeEntry[] = [];
      queryNode(root, region, out);
      return out;
    },
    size(): number {
      return count;
    },
  };
}

// ── Tile descriptor ───────────────────────────────────────────────────────────

export interface TileDescriptor {
  tileId: string;
  bounds: AABB2D;
  lodLevel: LODLevel;
  elementIds: string[];
  /** Estimated vertex count for this tile at the assigned LOD */
  estimatedVertices: number;
}

/**
 * Build a flat list of tile descriptors from a quadtree, given a camera
 * view frustum (as AABB) and camera distance.
 *
 * Each tile gets the LOD level appropriate for its distance from the camera.
 */
export function buildTileDescriptors(
  tree: Quadtree & { _root?: QuadtreeNode },
  visibleBounds: AABB2D,
  cameraDistanceM: number,
): TileDescriptor[] {
  const entries = tree.query(visibleBounds);
  if (entries.length === 0) return [];

  // Group entries by tile (simple grid: 100m × 100m tiles)
  const tileSize = 100;
  const tileMap  = new Map<string, { bounds: AABB2D; ids: string[] }>();

  for (const e of entries) {
    const tileX = Math.floor(e.bounds.minX / tileSize);
    const tileY = Math.floor(e.bounds.minY / tileSize);
    const key   = `${tileX}:${tileY}`;

    if (!tileMap.has(key)) {
      tileMap.set(key, {
        bounds: {
          minX: tileX * tileSize,
          minY: tileY * tileSize,
          maxX: (tileX + 1) * tileSize,
          maxY: (tileY + 1) * tileSize,
        },
        ids: [],
      });
    }
    tileMap.get(key)!.ids.push(e.id);
  }

  const descriptors: TileDescriptor[] = [];
  for (const [tileId, tile] of tileMap) {
    const lod = computeLOD(cameraDistanceM);
    // Rough vertex estimate: full=1000, reduced=200, bbox=8, culled=0
    const vertexFactors: Record<LODLevel, number> = { 0: 1000, 1: 200, 2: 8, 3: 0 };

    descriptors.push({
      tileId,
      bounds:            tile.bounds,
      lodLevel:          lod,
      elementIds:        tile.ids,
      estimatedVertices: tile.ids.length * vertexFactors[lod],
    });
  }

  return descriptors;
}

// ── Frustum culling ───────────────────────────────────────────────────────────

/**
 * Filter tile descriptors to those intersecting the camera frustum.
 * The frustum is approximated as an AABB for 2D plan view.
 */
export function frustumCull(
  tiles: TileDescriptor[],
  frustumBounds: AABB2D,
): TileDescriptor[] {
  return tiles.filter((t) => aabbIntersects(t.bounds, frustumBounds));
}

/**
 * Total estimated vertex count across all tiles.
 */
export function totalEstimatedVertices(tiles: TileDescriptor[]): number {
  return tiles.reduce((s, t) => s + t.estimatedVertices, 0);
}
