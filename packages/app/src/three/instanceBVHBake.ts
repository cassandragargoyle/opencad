/**
 * T-SITE-09: Pathtracer BVH bake — merge landscape InstancedMesh objects into
 * flat BufferGeometry meshes so three-gpu-pathtracer can build a correct BVH
 * across all landscape instances.
 *
 * InstancedMesh is not supported by all pathtracer versions; baking transforms
 * per-instance geometry into a single merged mesh ensures full coverage.
 */
import * as THREE from 'three';

/**
 * Result of a bake operation.
 * Call `dispose()` after the pathtracer render to free the merged geometries.
 */
export interface BakeResult {
  /** Merged meshes ready to add to the scene for BVH construction. */
  meshes: THREE.Mesh[];
  /** Free GPU resources for the merged geometries. */
  dispose(): void;
}

/**
 * Bake all InstancedMesh objects in the scene into flat merged meshes.
 * Each InstancedMesh becomes one merged Mesh whose geometry contains all
 * active instances with their transforms pre-applied.
 *
 * @param scene  Three.js scene to scan for InstancedMesh objects.
 * @param filter Optional predicate — only bake meshes where `filter(mesh)` is true.
 *               Defaults to landscape instanced meshes (userData.isLandscape).
 */
export function bakeInstancesToBVH(
  scene: THREE.Scene,
  filter?: (mesh: THREE.InstancedMesh) => boolean
): BakeResult {
  const baked: THREE.Mesh[] = [];
  const geoms: THREE.BufferGeometry[] = [];

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.InstancedMesh)) return;
    if (obj.count === 0) return;

    const include = filter ? filter(obj) : (obj.userData.isLandscape === true);
    if (!include) return;

    const merged = mergeInstanced(obj);
    if (!merged) return;

    const mat = Array.isArray(obj.material)
      ? (obj.material[0] ?? new THREE.MeshStandardMaterial())
      : obj.material;

    const mesh = new THREE.Mesh(merged, mat);
    mesh.userData.isBakedLandscape = true;
    mesh.castShadow    = obj.castShadow;
    mesh.receiveShadow = obj.receiveShadow;
    baked.push(mesh);
    geoms.push(merged);
  });

  return {
    meshes: baked,
    dispose: () => {
      for (const g of geoms) g.dispose();
    },
  };
}

/** Merge all active instances of an InstancedMesh into one BufferGeometry. */
function mergeInstanced(
  instanced: THREE.InstancedMesh
): THREE.BufferGeometry | null {
  const srcGeom = instanced.geometry;
  const posAttr = srcGeom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return null;

  const vertexCount = posAttr.count;
  const activeCount = instanced.count;
  if (activeCount === 0 || vertexCount === 0) return null;

  const totalVertices = vertexCount * activeCount;
  const mergedPositions = new Float32Array(totalVertices * 3);

  const srcIndex = srcGeom.index;
  let mergedIndex: Uint32Array | null = null;
  if (srcIndex) {
    mergedIndex = new Uint32Array(srcIndex.count * activeCount);
  }

  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();

  for (let i = 0; i < activeCount; i++) {
    instanced.getMatrixAt(i, mat);
    const vOffset = i * vertexCount;

    for (let v = 0; v < vertexCount; v++) {
      pos.fromBufferAttribute(posAttr, v);
      pos.applyMatrix4(mat);
      const base = (vOffset + v) * 3;
      mergedPositions[base]     = pos.x;
      mergedPositions[base + 1] = pos.y;
      mergedPositions[base + 2] = pos.z;
    }

    if (srcIndex && mergedIndex) {
      const idxOffset  = i * srcIndex.count;
      for (let k = 0; k < srcIndex.count; k++) {
        mergedIndex[idxOffset + k] = (srcIndex.getX(k) ?? 0) + vOffset;
      }
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  if (mergedIndex) {
    merged.setIndex(new THREE.BufferAttribute(mergedIndex, 1));
  }
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Temporarily add baked meshes to the scene for pathtrace, then remove them.
 * Usage:
 *   const bake = bakeInstancesToBVH(scene);
 *   addBakeToScene(scene, bake);
 *   await pathtracer.setSceneAsync(scene, camera);
 *   removeBakeFromScene(scene, bake);
 *   bake.dispose();
 */
export function addBakeToScene(scene: THREE.Scene, bake: BakeResult): void {
  for (const m of bake.meshes) scene.add(m);
}

export function removeBakeFromScene(scene: THREE.Scene, bake: BakeResult): void {
  for (const m of bake.meshes) scene.remove(m);
}
