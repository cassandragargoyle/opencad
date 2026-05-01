/**
 * T-SITE-04: Manages Three.js InstancedMesh objects for landscape elements.
 * One InstancedMesh per species keeps draw calls proportional to species count,
 * not element count. BVH raycasting via three-mesh-bvh.
 */
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import type { ElementSchema } from '@opencad/document';
import { isLandscapeElement } from '@opencad/document';

// Patch InstancedMesh with BVH raycast once at module load.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Maximum instances pre-allocated per species (grows if exceeded). */
const INITIAL_CAPACITY = 64;

/** Camera-distance thresholds for LOD switching (world units = mm). */
const LOD_NEAR  = 15_000;
const LOD_FAR   = 60_000;

type LodLevel = 'hi' | 'mid' | 'lo';

interface SpeciesBucket {
  /** One InstancedMesh per LOD level. */
  meshes: Record<LodLevel, THREE.InstancedMesh>;
  /** element id → instance index mapping. */
  elementIndex: Map<string, number>;
  /** Free slots (indices returned by removed instances). */
  freeSlots: number[];
  count: number;
}

function getLodForDistance(d: number): LodLevel {
  if (d < LOD_NEAR) return 'hi';
  if (d < LOD_FAR)  return 'mid';
  return 'lo';
}

/** Build placeholder geometry for a landscape element type. */
function buildGeometry(elementType: string, lod: LodLevel): THREE.BufferGeometry {
  const segments = lod === 'hi' ? 8 : lod === 'mid' ? 6 : 4;
  switch (elementType) {
    case 'planting':
      // Trunk (thin cylinder) + canopy (cone) merged via merge is complex —
      // use a cone as a recognisable placeholder.
      return new THREE.ConeGeometry(500, 2000, segments);
    case 'rock':
      return new THREE.DodecahedronGeometry(500, lod === 'hi' ? 1 : 0);
    case 'site_furniture':
      return new THREE.BoxGeometry(600, 900, 600);
    case 'person':
      return new THREE.CapsuleGeometry(120, 600, segments, segments);
    case 'vehicle':
      return new THREE.BoxGeometry(2000, 1500, 4500);
    case 'terrain_contour':
      return new THREE.BoxGeometry(100, 20, 100);
    default:
      return new THREE.SphereGeometry(300, segments, segments);
  }
}

/** Color per element type for instanced mesh material. */
const TYPE_COLOR: Record<string, string> = {
  planting:       '#4a7c3f',
  rock:           '#8a8070',
  site_furniture: '#b0a090',
  person:         '#c0a080',
  vehicle:        '#606878',
  terrain_contour:'#a0906a',
};

function buildMaterial(elementType: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color:     new THREE.Color(TYPE_COLOR[elementType] ?? '#888888'),
    roughness: 0.85,
    metalness: 0.05,
  });
}

function createBucket(speciesId: string, elementType: string, scene: THREE.Scene): SpeciesBucket {
  const lods: LodLevel[] = ['hi', 'mid', 'lo'];
  const meshes = {} as Record<LodLevel, THREE.InstancedMesh>;

  for (const lod of lods) {
    const geom = buildGeometry(elementType, lod);
    geom.computeBoundsTree();
    const mat  = buildMaterial(elementType);
    const mesh = new THREE.InstancedMesh(geom, mat, INITIAL_CAPACITY);
    mesh.count = 0;
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.userData.speciesId    = speciesId;
    mesh.userData.elementType  = elementType;
    mesh.userData.lod          = lod;
    mesh.userData.isLandscape  = true;
    // Only hi-LOD mesh is initially visible; updateLod() switches as needed.
    mesh.visible = lod === 'hi';
    scene.add(mesh);
    meshes[lod] = mesh;
  }

  return {
    meshes,
    elementIndex: new Map(),
    freeSlots: [],
    count: 0,
  };
}

/** Extract position/rotation/scale from a landscape ElementSchema. */
function elementTransform(el: ElementSchema): { pos: THREE.Vector3; ry: number; scale: number } {
  const props = el.properties as Record<string, { value: unknown }>;
  const pv = (k: string, fb: number) =>
    typeof props[k]?.value === 'number' ? (props[k]!.value as number) : fb;

  const x  = pv('X', 0);
  const y  = pv('Y', 0);
  const z  = pv('Z', 0);
  const ry = THREE.MathUtils.degToRad(pv('Rotation', 0));
  // Scale property is dimensionless (1.0 = normal). Convert mm-scale geometry
  // to scene units by applying the element scale directly.
  const scale = pv('Scale', 1.0);

  const tt = el.transform?.translation ?? { x: 0, y: 0, z: 0 };
  return {
    pos:   new THREE.Vector3(x + tt.x, z + tt.z, y + tt.y),
    ry,
    scale,
  };
}

const _matrix  = new THREE.Matrix4();
const _pos     = new THREE.Vector3();
const _quat    = new THREE.Quaternion();
const _eulerY  = new THREE.Euler();
const _scale   = new THREE.Vector3();

function buildMatrix(pos: THREE.Vector3, ry: number, scale: number): THREE.Matrix4 {
  _pos.copy(pos);
  _eulerY.set(0, ry, 0);
  _quat.setFromEuler(_eulerY);
  _scale.setScalar(scale);
  _matrix.compose(_pos, _quat, _scale);
  return _matrix;
}

function growBucket(bucket: SpeciesBucket, scene: THREE.Scene): void {
  const lods: LodLevel[] = ['hi', 'mid', 'lo'];
  for (const lod of lods) {
    const old  = bucket.meshes[lod];
    const cap  = old.instanceMatrix.array.length / 16;
    const newMesh = new THREE.InstancedMesh(
      old.geometry,
      old.material as THREE.Material,
      cap * 2
    );
    newMesh.count = old.count;
    newMesh.castShadow    = true;
    newMesh.receiveShadow = true;
    newMesh.visible       = old.visible;
    newMesh.userData      = { ...old.userData };
    // Copy existing instance matrices.
    for (let i = 0; i < old.count; i++) {
      old.getMatrixAt(i, _matrix);
      newMesh.setMatrixAt(i, _matrix);
    }
    newMesh.instanceMatrix.needsUpdate = true;
    scene.remove(old);
    old.geometry.disposeBoundsTree?.();
    old.geometry.dispose();
    (old.material as THREE.Material).dispose();
    scene.add(newMesh);
    bucket.meshes[lod] = newMesh;
  }
}

export class LandscapeInstanceManager {
  private scene:   THREE.Scene;
  private buckets: Map<string, SpeciesBucket> = new Map();
  /** element id → speciesId for quick removal. */
  private elementSpecies: Map<string, string> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Sync all landscape elements from the document. Diffs against internal
   * state and adds/updates/removes instances accordingly.
   */
  sync(elements: Record<string, ElementSchema>): void {
    const seenIds = new Set<string>();

    for (const el of Object.values(elements)) {
      if (!isLandscapeElement(el)) continue;
      seenIds.add(el.id);

      const speciesId = (el.properties as Record<string, { value: unknown }>)['SpeciesId']
        ?.value as string | undefined ?? `${el.type}:default`;

      const existingSpecies = this.elementSpecies.get(el.id);
      if (existingSpecies && existingSpecies !== speciesId) {
        // Species changed — remove from old bucket, re-add to new.
        this._remove(el.id, existingSpecies);
      }

      if (!this.buckets.has(speciesId)) {
        this.buckets.set(speciesId, createBucket(speciesId, el.type, this.scene));
      }

      const bucket = this.buckets.get(speciesId)!;
      const { pos, ry, scale } = elementTransform(el);

      if (!this.elementSpecies.has(el.id)) {
        // New instance.
        this._addInstance(bucket, el.id, pos, ry, scale);
        this.elementSpecies.set(el.id, speciesId);
      } else {
        // Update existing instance.
        const idx = bucket.elementIndex.get(el.id);
        if (idx !== undefined) {
          const mat = buildMatrix(pos, ry, scale);
          for (const lod of (['hi', 'mid', 'lo'] as LodLevel[])) {
            bucket.meshes[lod].setMatrixAt(idx, mat);
            bucket.meshes[lod].instanceMatrix.needsUpdate = true;
          }
        }
      }
    }

    // Remove instances for elements that are no longer in the document.
    for (const [id, speciesId] of this.elementSpecies) {
      if (!seenIds.has(id)) {
        this._remove(id, speciesId);
      }
    }
  }

  /** Update LOD visibility for all buckets based on camera distance. */
  updateLod(cameraPosition: THREE.Vector3): void {
    const lods: LodLevel[] = ['hi', 'mid', 'lo'];
    for (const bucket of this.buckets.values()) {
      if (bucket.count === 0) continue;

      // Compute average position of instances to estimate distance.
      // For large scenes a bounding sphere would be better, but this is
      // sufficient for the typical number of landscape species (< 20).
      const lod = getLodForDistance(cameraPosition.distanceTo(
        // Use first instance position as representative.
        ((): THREE.Vector3 => {
          bucket.meshes.hi.getMatrixAt(0, _matrix);
          _matrix.decompose(_pos, _quat, _scale);
          return _pos.clone();
        })()
      ));

      for (const l of lods) {
        bucket.meshes[l].visible = l === lod && bucket.count > 0;
      }
    }
  }

  /** Raycast against all visible landscape instanced meshes. */
  raycast(raycaster: THREE.Raycaster): THREE.Intersection[] {
    const hits: THREE.Intersection[] = [];
    for (const bucket of this.buckets.values()) {
      const lods: LodLevel[] = ['hi', 'mid', 'lo'];
      for (const lod of lods) {
        const mesh = bucket.meshes[lod];
        if (!mesh.visible || mesh.count === 0) continue;
        const results: THREE.Intersection[] = [];
        mesh.raycast(raycaster, results);
        hits.push(...results);
        break; // Only raycast the visible LOD.
      }
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  /** Get element id from an instanced mesh intersection result. */
  getElementId(mesh: THREE.InstancedMesh, instanceIndex: number): string | null {
    const speciesId = mesh.userData.speciesId as string | undefined;
    if (!speciesId) return null;
    const bucket = this.buckets.get(speciesId);
    if (!bucket) return null;
    for (const [elId, idx] of bucket.elementIndex) {
      if (idx === instanceIndex) return elId;
    }
    return null;
  }

  /** Remove all instanced meshes from the scene and free GPU memory. */
  dispose(): void {
    const lods: LodLevel[] = ['hi', 'mid', 'lo'];
    for (const bucket of this.buckets.values()) {
      for (const lod of lods) {
        const mesh = bucket.meshes[lod];
        this.scene.remove(mesh);
        mesh.geometry.disposeBoundsTree?.();
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
    this.buckets.clear();
    this.elementSpecies.clear();
  }

  private _addInstance(
    bucket: SpeciesBucket,
    elementId: string,
    pos: THREE.Vector3,
    ry: number,
    scale: number
  ): void {
    const lods: LodLevel[] = ['hi', 'mid', 'lo'];
    let idx: number;

    if (bucket.freeSlots.length > 0) {
      idx = bucket.freeSlots.pop()!;
    } else {
      const cap = bucket.meshes.hi.instanceMatrix.array.length / 16;
      if (bucket.count >= cap) {
        growBucket(bucket, this.scene);
      }
      idx = bucket.count;
      bucket.count++;
    }

    const mat = buildMatrix(pos, ry, scale);
    for (const lod of lods) {
      const mesh = bucket.meshes[lod];
      mesh.setMatrixAt(idx, mat);
      mesh.count = Math.max(mesh.count, idx + 1);
      mesh.instanceMatrix.needsUpdate = true;
    }

    bucket.elementIndex.set(elementId, idx);
  }

  private _remove(elementId: string, speciesId: string): void {
    const bucket = this.buckets.get(speciesId);
    if (!bucket) return;

    const idx = bucket.elementIndex.get(elementId);
    if (idx === undefined) return;

    // Zero-out the matrix so the instance is effectively invisible at index idx.
    const zeroMat = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0));
    const lods: LodLevel[] = ['hi', 'mid', 'lo'];
    for (const lod of lods) {
      bucket.meshes[lod].setMatrixAt(idx, zeroMat);
      bucket.meshes[lod].instanceMatrix.needsUpdate = true;
    }

    bucket.elementIndex.delete(elementId);
    bucket.freeSlots.push(idx);
    this.elementSpecies.delete(elementId);
  }
}
