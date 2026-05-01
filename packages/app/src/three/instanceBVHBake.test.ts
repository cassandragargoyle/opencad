/**
 * T-SITE-09: Unit tests for instanceBVHBake — landscape instance → BVH bake.
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  bakeInstancesToBVH,
  addBakeToScene,
  removeBakeFromScene,
} from './instanceBVHBake';

// three-mesh-bvh patches — no WebGL needed.
vi.mock('three-mesh-bvh', () => ({
  computeBoundsTree: vi.fn(),
  disposeBoundsTree: vi.fn(),
  acceleratedRaycast: vi.fn(),
}));

function makeScene(): THREE.Scene {
  return new THREE.Scene();
}

function makeInstancedMesh(
  count: number,
  isLandscape = true
): THREE.InstancedMesh {
  const geom = new THREE.BoxGeometry(100, 100, 100);
  const mat  = new THREE.MeshStandardMaterial({ color: 'green' });
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  mesh.count = count;
  mesh.userData.isLandscape = isLandscape;

  // Place instances at known positions.
  for (let i = 0; i < count; i++) {
    const m = new THREE.Matrix4();
    m.makeTranslation(i * 200, 0, 0);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

describe('T-SITE-09: instanceBVHBake', () => {
  it('returns no meshes for empty scene', () => {
    const scene = makeScene();
    const bake = bakeInstancesToBVH(scene);
    expect(bake.meshes).toHaveLength(0);
  });

  it('returns no meshes when InstancedMesh is not landscape', () => {
    const scene = makeScene();
    const inst = makeInstancedMesh(2, false);
    scene.add(inst);
    const bake = bakeInstancesToBVH(scene);
    expect(bake.meshes).toHaveLength(0);
  });

  it('bakes one landscape InstancedMesh into one merged mesh', () => {
    const scene = makeScene();
    const inst = makeInstancedMesh(3, true);
    scene.add(inst);
    const bake = bakeInstancesToBVH(scene);
    expect(bake.meshes).toHaveLength(1);
  });

  it('merged mesh has vertex count = srcVertices × instanceCount', () => {
    const scene = makeScene();
    const inst  = makeInstancedMesh(4, true);
    const srcVertCount = inst.geometry.getAttribute('position').count;
    scene.add(inst);
    const bake = bakeInstancesToBVH(scene);
    const mergedVertCount = bake.meshes[0]!.geometry.getAttribute('position').count;
    expect(mergedVertCount).toBe(srcVertCount * 4);
  });

  it('merged mesh is tagged isBakedLandscape', () => {
    const scene = makeScene();
    scene.add(makeInstancedMesh(1, true));
    const bake = bakeInstancesToBVH(scene);
    expect(bake.meshes[0]!.userData.isBakedLandscape).toBe(true);
  });

  it('instance transforms are baked into vertex positions', () => {
    const scene = makeScene();
    // Two instances: one at X=0, one at X=1000.
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3)
    );
    const mat  = new THREE.MeshStandardMaterial();
    const inst = new THREE.InstancedMesh(geom, mat, 2);
    inst.count = 2;
    inst.userData.isLandscape = true;
    inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0));
    inst.setMatrixAt(1, new THREE.Matrix4().makeTranslation(1000, 0, 0));
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);

    const bake = bakeInstancesToBVH(scene);
    const positions = bake.meshes[0]!.geometry.getAttribute('position')!.array as Float32Array;
    // First vertex at X≈0, second at X≈1000.
    expect(positions[0]).toBeCloseTo(0, 0);
    expect(positions[3]).toBeCloseTo(1000, 0);
  });

  it('addBakeToScene adds meshes to the scene', () => {
    const scene  = makeScene();
    const inst   = makeInstancedMesh(1, true);
    scene.add(inst);
    const bake = bakeInstancesToBVH(scene);
    const beforeCount = scene.children.length;
    addBakeToScene(scene, bake);
    expect(scene.children.length).toBe(beforeCount + bake.meshes.length);
  });

  it('removeBakeFromScene removes meshes from the scene', () => {
    const scene = makeScene();
    const inst  = makeInstancedMesh(1, true);
    scene.add(inst);
    const bake = bakeInstancesToBVH(scene);
    addBakeToScene(scene, bake);
    const countAfterAdd = scene.children.length;
    removeBakeFromScene(scene, bake);
    expect(scene.children.length).toBe(countAfterAdd - bake.meshes.length);
  });

  it('dispose does not throw', () => {
    const scene = makeScene();
    scene.add(makeInstancedMesh(2, true));
    const bake = bakeInstancesToBVH(scene);
    expect(() => bake.dispose()).not.toThrow();
  });

  it('custom filter function controls which meshes are baked', () => {
    const scene = makeScene();
    const landscape = makeInstancedMesh(2, true);
    landscape.userData.speciesId = 'tree_oak';
    const other = makeInstancedMesh(2, true);
    other.userData.speciesId = 'rock_granite';
    scene.add(landscape);
    scene.add(other);

    // Only bake tree_oak.
    const bake = bakeInstancesToBVH(
      scene,
      (m) => m.userData.speciesId === 'tree_oak'
    );
    expect(bake.meshes).toHaveLength(1);
  });

  it('skips InstancedMesh with count=0', () => {
    const scene = makeScene();
    const empty = makeInstancedMesh(0, true);
    empty.count = 0;
    scene.add(empty);
    const bake = bakeInstancesToBVH(scene);
    expect(bake.meshes).toHaveLength(0);
  });
});
