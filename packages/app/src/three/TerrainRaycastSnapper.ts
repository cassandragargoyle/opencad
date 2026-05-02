/**
 * T-SITE-05: Terrain raycast snap — snaps landscape element placement to the
 * surface of topography meshes using three-mesh-bvh accelerated raycasting.
 * Falls back to the ground plane (Y=0) when no terrain is hit.
 */
import * as THREE from 'three';

/** Y-up ground plane at Y=0. Used when no terrain mesh is hit. */
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Element types treated as terrain surfaces for snap. */
const TERRAIN_TYPES = new Set([
  'topography',
  'surface',
  'terrain_contour',
]);

export interface SnapResult {
  /** World X (mm). */
  x: number;
  /** World Y (mm) — this is depth in the CAD coordinate system (Z-up in BIM). */
  y: number;
  /** World Z (mm) — elevation. */
  z: number;
  /** True when the snap landed on a terrain mesh, false for ground-plane fallback. */
  snappedToTerrain: boolean;
}

export class TerrainRaycastSnapper {
  /** element id → Three.js mesh for terrain elements. */
  private terrainMeshes: Map<string, THREE.Object3D> = new Map();

  /**
   * Sync terrain meshes from the current element mesh map.
   * Call this whenever `updateScene()` runs.
   */
  syncFromElementMeshes(
    elementMeshes: Map<string, THREE.Object3D>,
    elements: Record<string, { type: string }>
  ): void {
    this.terrainMeshes.clear();
    for (const [id, obj] of elementMeshes) {
      const el = elements[id];
      if (el && TERRAIN_TYPES.has(el.type)) {
        this.terrainMeshes.set(id, obj);
      }
    }
  }

  /**
   * Raycast against terrain meshes. Returns the world-space hit point
   * translated to CAD coordinates (X = world X, Y = world Z, Z = world Y).
   * Falls back to ground-plane intersection if no terrain is hit.
   */
  snap(raycaster: THREE.Raycaster): SnapResult {
    if (this.terrainMeshes.size > 0) {
      const candidates: THREE.Mesh[] = [];
      for (const obj of this.terrainMeshes.values()) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) candidates.push(child);
        });
      }
      const hits = raycaster.intersectObjects(candidates, false);
      if (hits.length > 0) {
        const p = hits[0].point;
        // Three.js scene: X=right, Y=up, Z=depth
        // CAD/BIM:        X=easting, Y=northing, Z=elevation
        // Mapping used in createMeshFromElement:
        //   mesh.position.set(posX + tt.x, posY + tt.z, posZ + tt.y)
        // So:  threeX = cadX,  threeY = cadZ,  threeZ = cadY
        return { x: p.x, y: p.z, z: p.y, snappedToTerrain: true };
      }
    }

    // Ground-plane fallback.
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(GROUND_PLANE, target);
    return { x: target.x, y: target.z, z: 0, snappedToTerrain: false };
  }

  dispose(): void {
    this.terrainMeshes.clear();
  }
}
