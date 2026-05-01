/**
 * T-SITE-06: Toposolid parser — converts CSV and GeoJSON elevation data into
 * a THREE.js BufferGeometry terrain mesh using a grid-based IDW heightmap.
 */
import * as THREE from 'three';

export interface TerrainPoint {
  x: number;
  y: number;
  z: number; // elevation
}

export interface TerrainParseResult {
  points: TerrainPoint[];
  /** Axis-aligned bounding box of the input point set. */
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
}

/** Parse a CSV with columns: x,y,z (one point per line, header optional). */
export function parseCSV(text: string): TerrainParseResult {
  const points: TerrainPoint[] = [];
  const lines = text.trim().split(/\r?\n/);

  for (const line of lines) {
    const parts = line.split(/[,\t\s]+/).map((s) => s.trim());
    if (parts.length < 3) continue;
    const [a, b, c] = parts;
    // Skip header rows (non-numeric first cell).
    const x = parseFloat(a!);
    const y = parseFloat(b!);
    const z = parseFloat(c!);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      points.push({ x, y, z });
    }
  }

  return { points, bounds: _computeBounds(points) };
}

/**
 * Parse a GeoJSON FeatureCollection of LineString contours.
 * Each feature must have an `elevation` or `ELEV` property (or a 3rd coordinate).
 */
export function parseGeoJSON(json: unknown): TerrainParseResult {
  const points: TerrainPoint[] = [];

  const fc = json as {
    type: string;
    features?: Array<{
      type: string;
      geometry: { type: string; coordinates: number[][] | number[][][] };
      properties?: Record<string, unknown>;
    }>;
  };

  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    return { points, bounds: _computeBounds(points) };
  }

  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    const geomType = feature.geometry.type;
    const elev =
      (feature.properties?.['elevation'] as number | undefined) ??
      (feature.properties?.['ELEV'] as number | undefined) ??
      (feature.properties?.['z'] as number | undefined) ??
      null;

    if (geomType === 'LineString') {
      const coords = feature.geometry.coordinates as number[][];
      for (const c of coords) {
        const x = c[0] ?? 0;
        const y = c[1] ?? 0;
        const z = c[2] ?? elev ?? 0;
        points.push({ x, y, z });
      }
    } else if (geomType === 'MultiLineString') {
      const lines = feature.geometry.coordinates as number[][][];
      for (const line of lines) {
        for (const c of line) {
          const x = c[0] ?? 0;
          const y = c[1] ?? 0;
          const z = c[2] ?? elev ?? 0;
          points.push({ x, y, z });
        }
      }
    } else if (geomType === 'Point') {
      const c = feature.geometry.coordinates as unknown as number[];
      const x = c[0] ?? 0;
      const y = c[1] ?? 0;
      const z = c[2] ?? elev ?? 0;
      points.push({ x, y, z });
    }
  }

  return { points, bounds: _computeBounds(points) };
}

/**
 * Build a THREE.BufferGeometry terrain mesh from scattered elevation points.
 *
 * Uses Inverse Distance Weighting on a regular grid to compute elevations,
 * then builds an indexed triangle mesh from that grid.
 *
 * @param points  Input elevation samples (world units — must be consistent).
 * @param gridRes Grid resolution: number of cells along the longer axis.
 *                Default 64 (produces 65×65 = 4225 vertices).
 */
export function buildTerrainGeometry(
  points: TerrainPoint[],
  gridRes = 64
): THREE.BufferGeometry {
  if (points.length === 0) {
    return new THREE.PlaneGeometry(1000, 1000);
  }

  const bounds = _computeBounds(points);
  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;
  const aspect = rangeX / rangeY;

  // Fit grid into gridRes × gridRes, preserving aspect ratio.
  const cols = aspect >= 1 ? gridRes : Math.max(4, Math.round(gridRes * aspect));
  const rows = aspect >= 1 ? Math.max(4, Math.round(gridRes / aspect)) : gridRes;

  const vCols = cols + 1;
  const vRows = rows + 1;

  const positions = new Float32Array(vCols * vRows * 3);
  const indices   = new Uint32Array(cols * rows * 6);

  // Build vertex grid with IDW elevation.
  for (let r = 0; r < vRows; r++) {
    for (let c = 0; c < vCols; c++) {
      const wx = bounds.minX + (c / cols) * rangeX;
      const wy = bounds.minY + (r / rows) * rangeY;
      const wz = _idwElevation(points, wx, wy);
      const i  = (r * vCols + c) * 3;
      positions[i]     = wx;
      positions[i + 1] = wz; // Three.js Y = CAD elevation
      positions[i + 2] = wy; // Three.js Z = CAD Y
    }
  }

  // Build index buffer (two triangles per quad).
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * vCols + c;
      const b = a + 1;
      const d = a + vCols;
      const e = d + 1;
      indices[idx++] = a; indices[idx++] = d; indices[idx++] = b;
      indices[idx++] = b; indices[idx++] = d; indices[idx++] = e;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return geom;
}

/** IDW elevation estimate at (qx, qy) from sample points. Power = 2. */
function _idwElevation(points: TerrainPoint[], qx: number, qy: number): number {
  let weightSum = 0;
  let valueSum  = 0;
  for (const p of points) {
    const d2 = (p.x - qx) ** 2 + (p.y - qy) ** 2;
    if (d2 < 1e-10) return p.z; // query is on a sample point
    const w = 1 / d2;
    weightSum += w;
    valueSum  += w * p.z;
  }
  return weightSum > 0 ? valueSum / weightSum : 0;
}

function _computeBounds(points: TerrainPoint[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  if (!Number.isFinite(minX)) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 0;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}
