/**
 * T-FIELD-V2-01: WebXR AR hit testing and placement utilities.
 * Pure utility functions — no browser DOM or WebXR API calls.
 */

export interface ARHitResult {
  worldX: number;
  worldY: number;
  worldZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  confidence: number;
}

export interface ARPlacementResult {
  elementId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: number;
}

export interface ARSessionConfig {
  maxPlanes: number;
  enableLighting: boolean;
  hitTestFrequencyHz: number;
}

export const DEFAULT_AR_CONFIG: ARSessionConfig = {
  maxPlanes: 10,
  enableLighting: true,
  hitTestFrequencyHz: 30,
};

export function parseHitTestResult(raw: {
  position: number[];
  normal: number[];
}): ARHitResult {
  const [px = 0, py = 0, pz = 0] = raw.position;
  const [nx = 0, ny = 1, nz = 0] = raw.normal;

  // Compute confidence based on how close the normal is to vertical (0,1,0)
  // A perfect upward-facing plane has confidence 1.0
  const dotUp = Math.abs(ny); // dot product with (0,1,0) = ny
  const confidence = Math.max(0, Math.min(1, dotUp));

  return {
    worldX: px,
    worldY: py,
    worldZ: pz,
    normalX: nx,
    normalY: ny,
    normalZ: nz,
    confidence,
  };
}

/**
 * Computes the placement transform for an element on a hit surface.
 * Returns a unique elementId based on hit position + timestamp.
 */
export function computePlacementTransform(
  hit: ARHitResult,
  elementSizeM: number,
): ARPlacementResult {
  // Align the element to the hit surface normal.
  // For a flat floor (normal ~0,1,0) the rotation is identity.
  // We compute the quaternion that rotates Y-up to the surface normal.
  const [qx, qy, qz, qw] = normalToQuaternion(
    hit.normalX,
    hit.normalY,
    hit.normalZ,
  );

  const elementId = `ar-${Math.round(hit.worldX * 1000)}-${Math.round(hit.worldY * 1000)}-${Math.round(hit.worldZ * 1000)}`;

  return {
    elementId,
    position: { x: hit.worldX, y: hit.worldY, z: hit.worldZ },
    rotation: { x: qx, y: qy, z: qz, w: qw },
    scale: elementSizeM,
  };
}

/**
 * Returns a quaternion that rotates (0,1,0) to the given normal.
 */
function normalToQuaternion(nx: number, ny: number, nz: number): [number, number, number, number] {
  // up = (0, 1, 0)
  // We need q such that q * up * q^-1 = normal
  const upX = 0, upY = 1, upZ = 0;

  const dot = upX * nx + upY * ny + upZ * nz;

  // If normals are nearly parallel, return identity
  if (dot > 0.9999) return [0, 0, 0, 1];

  // If normals are nearly anti-parallel, rotate 180° around X axis
  if (dot < -0.9999) return [1, 0, 0, 0];

  // Cross product: up × normal
  const cx = upY * nz - upZ * ny;
  const cy = upZ * nx - upX * nz;
  const cz = upX * ny - upY * nx;

  const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const sinHalf = Math.sqrt((1 - dot) / 2);
  const cosHalf = Math.sqrt((1 + dot) / 2);

  return [
    (cx / len) * sinHalf,
    (cy / len) * sinHalf,
    (cz / len) * sinHalf,
    cosHalf,
  ];
}

export function isValidARSurface(hit: ARHitResult, minConfidence: number = 0.5): boolean {
  return hit.confidence >= minConfidence;
}

export function filterHitResultsByConfidence(
  hits: ARHitResult[],
  threshold: number,
): ARHitResult[] {
  return hits.filter((h) => h.confidence >= threshold);
}
