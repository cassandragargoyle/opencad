/**
 * T-SITE-04: Unit tests for LandscapeInstanceManager.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// three-mesh-bvh patches BufferGeometry — mock it so tests run without WebGL.
vi.mock('three-mesh-bvh', () => ({
  computeBoundsTree: vi.fn(),
  disposeBoundsTree: vi.fn(),
  acceleratedRaycast: vi.fn(),
}));

// Minimal ElementSchema factory for landscape elements.
function makeElement(
  id: string,
  type: string,
  speciesId: string,
  x = 0,
  y = 0,
  z = 0,
  scale = 1.0,
  rotation = 0
) {
  return {
    id,
    type,
    layerId: 'l1',
    levelId: '',
    boundingBox: {
      min: { x: x - 500, y: y - 500, z },
      max: { x: x + 500, y: y + 500, z: z + 2000 },
    },
    transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    properties: {
      SpeciesId: { type: 'string', value: speciesId },
      LibraryId: { type: 'string', value: 'starter' },
      Scale:     { type: 'number', value: scale },
      Rotation:  { type: 'number', value: rotation },
      X:         { type: 'number', value: x },
      Y:         { type: 'number', value: y },
      Z:         { type: 'number', value: z },
    },
  };
}

// Import after mock so patches are applied.
import { LandscapeInstanceManager } from './LandscapeInstanceManager';

function makeScene() {
  const objects: THREE.Object3D[] = [];
  return {
    add:    vi.fn((o: THREE.Object3D) => objects.push(o)),
    remove: vi.fn((o: THREE.Object3D) => {
      const i = objects.indexOf(o);
      if (i >= 0) objects.splice(i, 1);
    }),
    _objects: objects,
  } as unknown as THREE.Scene;
}

describe('T-SITE-04: LandscapeInstanceManager', () => {
  let scene: THREE.Scene;
  let manager: LandscapeInstanceManager;

  beforeEach(() => {
    scene = makeScene();
    manager = new LandscapeInstanceManager(scene);
  });

  it('adds instanced meshes to the scene on first sync', () => {
    const elements = {
      e1: makeElement('e1', 'planting', 'tree_oak', 0, 0, 0),
    };
    manager.sync(elements as never);
    // 3 LOD meshes per species should have been added to the scene.
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(3);
  });

  it('does not add non-landscape elements', () => {
    const elements = {
      w1: {
        id: 'w1', type: 'wall', layerId: 'l1', levelId: '',
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 100, z: 3000 } },
        transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        properties: {},
      },
    };
    manager.sync(elements as never);
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(0);
  });

  it('creates one bucket (3 LOD meshes) per species', () => {
    const elements = {
      e1: makeElement('e1', 'planting', 'tree_oak'),
      e2: makeElement('e2', 'planting', 'tree_pine'),
    };
    manager.sync(elements as never);
    // 2 species × 3 LODs = 6 meshes.
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(6);
  });

  it('same species shares one bucket across multiple elements', () => {
    const elements = {
      e1: makeElement('e1', 'planting', 'tree_oak', 0),
      e2: makeElement('e2', 'planting', 'tree_oak', 5000),
    };
    manager.sync(elements as never);
    // Only 3 meshes (one bucket with 3 LODs) even though 2 elements.
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(3);
  });

  it('removes scene meshes on dispose', () => {
    const elements = {
      e1: makeElement('e1', 'planting', 'tree_oak'),
    };
    manager.sync(elements as never);
    manager.dispose();
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(0);
  });

  it('getElementId returns correct element id for an instance', () => {
    const elements = {
      e1: makeElement('e1', 'planting', 'tree_oak', 1000, 2000, 0),
    };
    manager.sync(elements as never);
    const meshes = (scene as unknown as { _objects: THREE.Object3D[] })._objects;
    const hiMesh = meshes.find(
      (m) => (m as THREE.InstancedMesh).userData.lod === 'hi'
    ) as THREE.InstancedMesh;
    expect(manager.getElementId(hiMesh, 0)).toBe('e1');
  });

  it('getElementId returns null for unknown mesh', () => {
    const dummy = new THREE.InstancedMesh(
      new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 4
    );
    expect(manager.getElementId(dummy, 0)).toBeNull();
  });

  it('syncing with removed element zeroes its instance', () => {
    const elements: Record<string, ReturnType<typeof makeElement>> = {
      e1: makeElement('e1', 'planting', 'tree_oak', 0),
      e2: makeElement('e2', 'planting', 'tree_oak', 5000),
    };
    manager.sync(elements as never);

    // Remove e1.
    const { e1: _removed, ...remaining } = elements;
    void _removed;
    manager.sync(remaining as never);

    // e1 slot should be freed — getElementId must return null for index 0.
    const meshes = (scene as unknown as { _objects: THREE.Object3D[] })._objects;
    const hiMesh = meshes.find(
      (m) => (m as THREE.InstancedMesh).userData.lod === 'hi'
    ) as THREE.InstancedMesh;
    // e1 at index 0 is removed; e2 is at index 1.
    expect(manager.getElementId(hiMesh, 0)).toBeNull();
    expect(manager.getElementId(hiMesh, 1)).toBe('e2');
  });

  it('updateLod does not throw', () => {
    const elements = { e1: makeElement('e1', 'planting', 'tree_oak') };
    manager.sync(elements as never);
    expect(() =>
      manager.updateLod(new THREE.Vector3(0, 10000, 0))
    ).not.toThrow();
  });

  it('raycast returns empty array when no instances', () => {
    const raycaster = new THREE.Raycaster();
    expect(manager.raycast(raycaster)).toEqual([]);
  });

  it('supports rock element type', () => {
    const elements = { r1: makeElement('r1', 'rock', 'rock_granite') };
    manager.sync(elements as never);
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(3);
  });

  it('supports all landscape element types without throwing', () => {
    const types = ['planting', 'rock', 'site_furniture', 'person', 'vehicle', 'terrain_contour'];
    const elements: Record<string, ReturnType<typeof makeElement>> = {};
    types.forEach((t, i) => {
      elements[`el_${i}`] = makeElement(`el_${i}`, t, `${t}_default`);
    });
    expect(() => manager.sync(elements as never)).not.toThrow();
    // 6 types × 3 LODs = 18 meshes.
    expect((scene as unknown as { _objects: THREE.Object3D[] })._objects.length).toBe(18);
  });
});
