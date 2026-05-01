/**
 * T-SITE-05: Unit tests for TerrainRaycastSnapper.
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TerrainRaycastSnapper } from './TerrainRaycastSnapper';

// three-mesh-bvh patches — mock so tests run without WebGL renderer.
vi.mock('three-mesh-bvh', () => ({
  computeBoundsTree: vi.fn(),
  disposeBoundsTree: vi.fn(),
  acceleratedRaycast: vi.fn(),
}));

function makeMesh(x = 0, y = 0, z = 0): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(20000, 20000);
  geom.rotateX(-Math.PI / 2); // horizontal plane
  const mat  = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function makeRaycasterDown(x = 0, z = 0, fromY = 5000): THREE.Raycaster {
  const rc = new THREE.Raycaster();
  rc.set(
    new THREE.Vector3(x, fromY, z),
    new THREE.Vector3(0, -1, 0)
  );
  return rc;
}

describe('T-SITE-05: TerrainRaycastSnapper', () => {
  it('returns snappedToTerrain=false when no terrain meshes registered', () => {
    const snapper = new TerrainRaycastSnapper();
    const rc = makeRaycasterDown();
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(false);
    expect(result.z).toBe(0); // ground plane elevation
  });

  it('falls back to ground plane (z=0) when raycaster misses terrain', () => {
    const snapper = new TerrainRaycastSnapper();
    const mesh = makeMesh(0, 1000, 0);
    const elementMeshes = new Map<string, THREE.Object3D>([['t1', mesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { t1: { type: 'topography' } });
    // Shoot upward — won't hit the terrain.
    const rc = new THREE.Raycaster();
    rc.set(new THREE.Vector3(0, -1000, 0), new THREE.Vector3(0, 1, 0));
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(false);
  });

  it('snaps to terrain mesh at correct elevation', () => {
    const snapper = new TerrainRaycastSnapper();
    // Flat terrain at Y=500 (Three.js world units = mm elevation).
    const mesh = makeMesh(0, 500, 0);
    const elementMeshes = new Map<string, THREE.Object3D>([['t1', mesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { t1: { type: 'topography' } });

    const rc = makeRaycasterDown(0, 0, 5000);
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(true);
    expect(result.z).toBeCloseTo(500, 0); // elevation = Three.js Y
  });

  it('does not include non-terrain elements', () => {
    const snapper = new TerrainRaycastSnapper();
    const wallMesh = makeMesh();
    const elementMeshes = new Map<string, THREE.Object3D>([['w1', wallMesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { w1: { type: 'wall' } });
    const rc = makeRaycasterDown();
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(false);
  });

  it('includes surface elements as terrain', () => {
    const snapper = new TerrainRaycastSnapper();
    const mesh = makeMesh(0, 200, 0);
    const elementMeshes = new Map<string, THREE.Object3D>([['s1', mesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { s1: { type: 'surface' } });
    const rc = makeRaycasterDown(0, 0, 5000);
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(true);
    expect(result.z).toBeCloseTo(200, 0);
  });

  it('maps Three.js XYZ to CAD XYZ correctly', () => {
    const snapper = new TerrainRaycastSnapper();
    const mesh = makeMesh(1000, 0, 2000); // X=1000, Y=0, Z=2000 in Three.js
    const elementMeshes = new Map<string, THREE.Object3D>([['t1', mesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { t1: { type: 'topography' } });

    // Shoot straight down at Three.js (X=1000, Z=2000)
    const rc = makeRaycasterDown(1000, 2000, 5000);
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(true);
    // CAD: X = threeX = 1000, Y = threeZ = 2000, Z = threeY = 0
    expect(result.x).toBeCloseTo(1000, 0);
    expect(result.y).toBeCloseTo(2000, 0);
    expect(result.z).toBeCloseTo(0, 0);
  });

  it('dispose clears terrain meshes', () => {
    const snapper = new TerrainRaycastSnapper();
    const mesh = makeMesh(0, 500, 0);
    const elementMeshes = new Map<string, THREE.Object3D>([['t1', mesh]]);
    snapper.syncFromElementMeshes(elementMeshes, { t1: { type: 'topography' } });
    snapper.dispose();
    // After dispose, no terrain — falls back to ground plane.
    const rc = makeRaycasterDown();
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(false);
  });

  it('sync clears old terrain meshes and adds new ones', () => {
    const snapper = new TerrainRaycastSnapper();
    const mesh1 = makeMesh(0, 500, 0);
    snapper.syncFromElementMeshes(
      new Map([['t1', mesh1 as THREE.Object3D]]),
      { t1: { type: 'topography' } }
    );
    // Re-sync with no terrain.
    snapper.syncFromElementMeshes(new Map(), {});
    const rc = makeRaycasterDown();
    const result = snapper.snap(rc);
    expect(result.snappedToTerrain).toBe(false);
  });
});
