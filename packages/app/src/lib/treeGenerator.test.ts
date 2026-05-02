/**
 * T-SITE-V2-05: Unit tests for treeGenerator.
 */
import { describe, it, expect } from 'vitest';
import {
  generateTree,
  treeCanopyAABB,
  scaleTrees,
  type TreeGeneratorConfig,
  type TreeStyle,
} from './treeGenerator';

const BASE_CONFIG: TreeGeneratorConfig = {
  style: 'deciduous',
  seed: 42,
  heightM: 10,
  branchLevels: 2,
  canopyDensity: 0.8,
};

describe('T-SITE-V2-05: treeGenerator', () => {
  // ── generateTree ───────────────────────────────────────────────────────────

  it('returns a tree with at least the trunk node', () => {
    const tree = generateTree(BASE_CONFIG);
    expect(tree.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('trunk is the first node with parentId null', () => {
    const tree = generateTree(BASE_CONFIG);
    expect(tree.nodes[0].parentId).toBeNull();
  });

  it('tree style and heightM are preserved on result', () => {
    const tree = generateTree(BASE_CONFIG);
    expect(tree.style).toBe('deciduous');
    expect(tree.heightM).toBe(10);
  });

  it('canopyRadiusM is positive', () => {
    const tree = generateTree(BASE_CONFIG);
    expect(tree.canopyRadiusM).toBeGreaterThan(0);
  });

  it('same seed produces the same tree (deterministic)', () => {
    const t1 = generateTree(BASE_CONFIG);
    const t2 = generateTree(BASE_CONFIG);
    expect(t1.nodes.length).toBe(t2.nodes.length);
    expect(t1.nodes[0].radius).toBeCloseTo(t2.nodes[0].radius, 10);
  });

  it('different seeds produce different trees', () => {
    const t1 = generateTree({ ...BASE_CONFIG, seed: 1 });
    const t2 = generateTree({ ...BASE_CONFIG, seed: 2 });
    // At least one branch node position should differ
    const differ = t1.nodes.some((n, i) => {
      const n2 = t2.nodes[i];
      return n2 && (Math.abs(n.x - n2.x) > 1e-9 || Math.abs(n.y - n2.y) > 1e-9);
    });
    expect(differ).toBe(true);
  });

  it('branchLevels=0 produces only the trunk (1 node)', () => {
    const tree = generateTree({ ...BASE_CONFIG, branchLevels: 0 });
    expect(tree.nodes).toHaveLength(1);
  });

  it('branchLevels=1 produces more nodes than branchLevels=0', () => {
    const t0 = generateTree({ ...BASE_CONFIG, branchLevels: 0 });
    const t1 = generateTree({ ...BASE_CONFIG, branchLevels: 1 });
    expect(t1.nodes.length).toBeGreaterThan(t0.nodes.length);
  });

  it('each non-trunk node has a valid parentId', () => {
    const tree = generateTree(BASE_CONFIG);
    const ids = new Set(tree.nodes.map((n) => n.id));
    for (const n of tree.nodes.slice(1)) {
      expect(ids.has(n.parentId as string)).toBe(true);
    }
  });

  it('all tree styles generate valid trees', () => {
    const styles: TreeStyle[] = ['deciduous', 'conifer', 'palm', 'shrub'];
    for (const style of styles) {
      const tree = generateTree({ ...BASE_CONFIG, style });
      expect(tree.nodes.length).toBeGreaterThan(0);
      expect(tree.canopyRadiusM).toBeGreaterThan(0);
    }
  });

  // ── treeCanopyAABB ─────────────────────────────────────────────────────────

  it('AABB minZ is non-negative (trunk is above ground)', () => {
    const tree = generateTree(BASE_CONFIG);
    const aabb = treeCanopyAABB(tree);
    expect(aabb.minZ).toBeGreaterThanOrEqual(0);
  });

  it('AABB maxZ is approximately tree heightM', () => {
    const tree = generateTree({ ...BASE_CONFIG, branchLevels: 0 });
    const aabb = treeCanopyAABB(tree);
    expect(aabb.maxZ).toBeCloseTo(tree.heightM, 1);
  });

  it('AABB minX <= maxX and minY <= maxY', () => {
    const tree = generateTree(BASE_CONFIG);
    const aabb = treeCanopyAABB(tree);
    expect(aabb.minX).toBeLessThanOrEqual(aabb.maxX);
    expect(aabb.minY).toBeLessThanOrEqual(aabb.maxY);
  });

  it('returns zero AABB for tree with no nodes', () => {
    const emptyTree = { nodes: [], style: 'deciduous' as TreeStyle, heightM: 10, canopyRadiusM: 4 };
    const aabb = treeCanopyAABB(emptyTree);
    expect(aabb.minX).toBe(0);
    expect(aabb.maxX).toBe(0);
  });

  // ── scaleTrees ─────────────────────────────────────────────────────────────

  it('scales heightM by factor', () => {
    const trees = [generateTree(BASE_CONFIG)];
    const scaled = scaleTrees(trees, 2);
    expect(scaled[0].heightM).toBeCloseTo(trees[0].heightM * 2, 5);
  });

  it('scales canopyRadiusM by factor', () => {
    const trees = [generateTree(BASE_CONFIG)];
    const scaled = scaleTrees(trees, 0.5);
    expect(scaled[0].canopyRadiusM).toBeCloseTo(trees[0].canopyRadiusM * 0.5, 5);
  });

  it('scales node positions by factor', () => {
    const trees = [generateTree(BASE_CONFIG)];
    const origZ = trees[0].nodes[0].z;
    const scaled = scaleTrees(trees, 3);
    expect(scaled[0].nodes[0].z).toBeCloseTo(origZ * 3, 5);
  });

  it('scaling returns new array (immutable)', () => {
    const trees = [generateTree(BASE_CONFIG)];
    const scaled = scaleTrees(trees, 1.5);
    expect(scaled).not.toBe(trees);
    expect(scaled[0]).not.toBe(trees[0]);
  });

  it('factor=1 leaves tree unchanged', () => {
    const trees = [generateTree(BASE_CONFIG)];
    const scaled = scaleTrees(trees, 1);
    expect(scaled[0].heightM).toBeCloseTo(trees[0].heightM, 10);
    expect(scaled[0].canopyRadiusM).toBeCloseTo(trees[0].canopyRadiusM, 10);
  });
});
