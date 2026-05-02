/**
 * T-SITE-V2-05: Procedural tree generator.
 * Uses a deterministic LCG for reproducible trees from a seed.
 */

export type TreeStyle = 'deciduous' | 'conifer' | 'palm' | 'shrub';

export interface TreeGeneratorConfig {
  style: TreeStyle;
  seed: number;
  heightM: number;
  branchLevels: number;
  canopyDensity: number;
}

export interface TreeNode {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  z: number;
  radius: number;
  length: number;
}

export interface GeneratedTree {
  nodes: TreeNode[];
  style: TreeStyle;
  heightM: number;
  canopyRadiusM: number;
}

// ── Seeded LCG ───────────────────────────────────────────────────────────────

function makeLcg(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Style parameters ──────────────────────────────────────────────────────────

interface StyleParams {
  trunkRadiusFraction: number; // trunk radius as fraction of height
  branchAngle: number;         // radians from vertical
  branchLengthRatio: number;   // child length as fraction of parent
  branchRadiusRatio: number;   // child radius as fraction of parent
  branchCountPerLevel: number;
  canopyRadiusFraction: number;
}

const STYLE_PARAMS: Record<TreeStyle, StyleParams> = {
  deciduous: {
    trunkRadiusFraction: 0.025,
    branchAngle: 0.6,
    branchLengthRatio: 0.65,
    branchRadiusRatio: 0.6,
    branchCountPerLevel: 3,
    canopyRadiusFraction: 0.45,
  },
  conifer: {
    trunkRadiusFraction: 0.018,
    branchAngle: 1.1,
    branchLengthRatio: 0.55,
    branchRadiusRatio: 0.5,
    branchCountPerLevel: 4,
    canopyRadiusFraction: 0.25,
  },
  palm: {
    trunkRadiusFraction: 0.015,
    branchAngle: 0.3,
    branchLengthRatio: 0.8,
    branchRadiusRatio: 0.4,
    branchCountPerLevel: 6,
    canopyRadiusFraction: 0.5,
  },
  shrub: {
    trunkRadiusFraction: 0.04,
    branchAngle: 0.9,
    branchLengthRatio: 0.7,
    branchRadiusRatio: 0.55,
    branchCountPerLevel: 4,
    canopyRadiusFraction: 0.55,
  },
};

// ── Generator ────────────────────────────────────────────────────────────────

let _nodeCounter = 0;
function _nodeId(): string {
  return `tn-${++_nodeCounter}`;
}

/**
 * Generate a procedural tree. The trunk is the first node; branches subdivide
 * recursively up to `config.branchLevels`.
 */
export function generateTree(config: TreeGeneratorConfig): GeneratedTree {
  const { style, seed, heightM, branchLevels } = config;
  const rng = makeLcg(seed);
  const params = STYLE_PARAMS[style];

  const nodes: TreeNode[] = [];
  const trunkId = _nodeId();

  // Trunk — stored at its tip position (top of trunk) so AABB captures full height.
  const trunkRadius = heightM * params.trunkRadiusFraction;
  nodes.push({
    id: trunkId,
    parentId: null,
    x: 0,
    y: 0,
    z: heightM, // tip of trunk
    radius: trunkRadius,
    length: heightM,
  });

  if (branchLevels > 0) {
    _addBranches(
      nodes,
      trunkId,
      { x: 0, y: 0, z: heightM }, // start point of first branches = top of trunk
      trunkRadius * params.branchRadiusRatio,
      heightM * params.branchLengthRatio,
      branchLevels,
      params,
      rng
    );
  }

  return {
    nodes,
    style,
    heightM,
    canopyRadiusM: heightM * params.canopyRadiusFraction,
  };
}

function _addBranches(
  nodes: TreeNode[],
  parentId: string,
  origin: { x: number; y: number; z: number },
  radius: number,
  length: number,
  levelsLeft: number,
  params: StyleParams,
  rng: () => number
): void {
  if (levelsLeft <= 0 || length < 0.01) return;

  const count = params.branchCountPerLevel;
  for (let i = 0; i < count; i++) {
    const azimuth = (i / count) * 2 * Math.PI + rng() * 0.5;
    const elevation = params.branchAngle + (rng() - 0.5) * 0.3;

    const dx = Math.sin(elevation) * Math.cos(azimuth) * length;
    const dy = Math.sin(elevation) * Math.sin(azimuth) * length;
    const dz = Math.cos(elevation) * length;

    const id = _nodeId();
    nodes.push({
      id,
      parentId,
      x: origin.x + dx,
      y: origin.y + dy,
      z: origin.z + dz,
      radius,
      length,
    });

    _addBranches(
      nodes,
      id,
      { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz },
      radius * params.branchRadiusRatio,
      length * params.branchLengthRatio,
      levelsLeft - 1,
      params,
      rng
    );
  }
}

/**
 * Compute the axis-aligned bounding box of a generated tree in 3D.
 */
export function treeCanopyAABB(
  tree: GeneratedTree
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  if (tree.nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const n of tree.nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
    if (n.z < minZ) minZ = n.z;
    if (n.z > maxZ) maxZ = n.z;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Scale all trees by a uniform factor, adjusting positions, radii, and canopy.
 */
export function scaleTrees(trees: GeneratedTree[], factor: number): GeneratedTree[] {
  return trees.map((tree) => ({
    ...tree,
    heightM: tree.heightM * factor,
    canopyRadiusM: tree.canopyRadiusM * factor,
    nodes: tree.nodes.map((n) => ({
      ...n,
      x: n.x * factor,
      y: n.y * factor,
      z: n.z * factor,
      radius: n.radius * factor,
      length: n.length * factor,
    })),
  }));
}
