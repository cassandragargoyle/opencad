/**
 * #453: Auto-detect floor and roof from a closed wall footprint.
 *
 * Given a closed set of wall segments (from the wall chain tool or existing
 * walls), this module computes the interior polygon and returns scaffold
 * objects for auto-generated floor slab and roof elements.
 *
 * The generated elements are plain objects — callers hand them to addElement().
 */

import type { WallSegment } from './wallChain';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface EnclosurePolygon {
  /** Ordered vertices of the interior footprint. */
  vertices: Point2D[];
  /** Area in mm² */
  areaMm2: number;
  /** Perimeter in mm */
  perimeterMm: number;
}

export interface AutoFloorSpec {
  type: 'floor';
  polygon: EnclosurePolygon;
  /** Default thickness in mm */
  thickness: number;
  /** Elevation of the underside in mm */
  elevationMm: number;
  levelId: string;
  layerId: string;
  material: string;
}

export interface AutoRoofSpec {
  type: 'roof';
  polygon: EnclosurePolygon;
  /** Default thickness in mm */
  thickness: number;
  /** Elevation of the underside (= wallHeight + levelElevation) */
  elevationMm: number;
  levelId: string;
  layerId: string;
  material: string;
  /** Flat by default; user can change to pitched after placement */
  roofType: 'flat' | 'pitched';
  /** Pitch angle in degrees (0 for flat) */
  pitchDeg: number;
}

export interface AutoEnclosureResult {
  polygon: EnclosurePolygon;
  floor: AutoFloorSpec;
  roof: AutoRoofSpec;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_FLOOR_THICKNESS_MM = 250;
export const DEFAULT_ROOF_THICKNESS_MM  = 300;
export const DEFAULT_FLOOR_MATERIAL     = 'concrete';
export const DEFAULT_ROOF_MATERIAL      = 'concrete';

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Generate auto floor + roof specs from a closed wall chain.
 *
 * @param segments      Closed wall segments (last end = first start)
 * @param levelElevMm   Elevation of the floor level in mm
 * @param wallHeightMm  Wall height in mm (roof sits on top of walls)
 * @param opts          Override defaults
 */
export function autoEnclosure(
  segments: WallSegment[],
  levelElevMm = 0,
  wallHeightMm = 2700,
  opts: {
    floorThickness?: number;
    roofThickness?: number;
    floorMaterial?: string;
    roofMaterial?: string;
    levelId?: string;
    layerId?: string;
  } = {},
): AutoEnclosureResult {
  const polygon = computeFootprint(segments);
  const levelId = opts.levelId ?? segments[0]?.levelId ?? 'default-level';
  const layerId = opts.layerId ?? segments[0]?.layerId ?? 'default-layer';

  const floor: AutoFloorSpec = {
    type:        'floor',
    polygon,
    thickness:   opts.floorThickness ?? DEFAULT_FLOOR_THICKNESS_MM,
    elevationMm: levelElevMm,
    levelId,
    layerId,
    material:    opts.floorMaterial ?? DEFAULT_FLOOR_MATERIAL,
  };

  const roof: AutoRoofSpec = {
    type:        'roof',
    polygon,
    thickness:   opts.roofThickness ?? DEFAULT_ROOF_THICKNESS_MM,
    elevationMm: levelElevMm + wallHeightMm,
    levelId,
    layerId,
    material:    opts.roofMaterial ?? DEFAULT_ROOF_MATERIAL,
    roofType:    'flat',
    pitchDeg:    0,
  };

  return { polygon, floor, roof };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Extract the interior polygon from wall segments.
 * Assumes segments form an ordered closed loop.
 */
export function computeFootprint(segments: WallSegment[]): EnclosurePolygon {
  const vertices = segments.map((s) => s.start);
  const areaMm2  = shoelaceArea(vertices);
  const perimeterMm = segments.reduce(
    (sum, s) => sum + dist(s.start, s.end),
    0,
  );
  return { vertices, areaMm2, perimeterMm };
}

function shoelaceArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Centroid of a polygon.
 */
export function polygonCentroid(vertices: Point2D[]): Point2D {
  let cx = 0, cy = 0;
  for (const v of vertices) { cx += v.x; cy += v.y; }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

/**
 * True if a point is inside a polygon (ray-casting algorithm).
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.x, yi = polygon[i]!.y;
    const xj = polygon[j]!.x, yj = polygon[j]!.y;
    if ((yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if segments form a valid closed loop (last end ≈ first start).
 */
export function isClosedLoop(segments: WallSegment[], toleranceMm = 1): boolean {
  if (segments.length < 3) return false;
  const first = segments[0]!.start;
  const last  = segments[segments.length - 1]!.end;
  return dist(first, last) <= toleranceMm;
}
