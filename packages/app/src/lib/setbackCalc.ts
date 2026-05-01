/**
 * T-SITE-07: Setback envelope calculator.
 * Computes the legal buildable polygon by offsetting a site boundary inward
 * by setback distances. Uses per-edge inward offset with adjacent-edge
 * intersection — correct for convex polygons, approximate for concave.
 */

export interface Point2D { x: number; y: number; }

export interface SetbackDistances {
  front:  number; // mm from front boundary edge
  rear:   number; // mm from rear boundary edge
  left:   number; // mm from left side boundary edge
  right:  number; // mm from right side boundary edge
}

export interface SetbackResult {
  /** Buildable envelope polygon vertices (CCW winding). */
  polygon: Point2D[];
  /** Whether the setbacks left any buildable area (false = zero / negative area). */
  buildable: boolean;
}

/**
 * Compute the inward-offset polygon for a site boundary.
 *
 * @param boundary  Site polygon vertices in CCW order (world units, mm).
 * @param setbacks  Setback distances per edge side. Edges are assigned
 *                  front/rear/left/right by compass angle from the polygon centroid.
 */
export function computeSetbackEnvelope(
  boundary: Point2D[],
  setbacks: SetbackDistances
): SetbackResult {
  if (boundary.length < 3) {
    return { polygon: [], buildable: false };
  }

  const n = boundary.length;
  // For each edge, determine the setback distance based on the edge's outward
  // normal direction (which face of the lot it belongs to).
  const offsets: number[] = boundary.map((_, i) => {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % n]!;
    const angle = edgeAngle(a, b);
    return selectSetback(angle, setbacks);
  });

  // Compute inward-offset edge lines.
  type Line = { px: number; py: number; dx: number; dy: number };
  const offsetLines: Line[] = boundary.map((_, i) => {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % n]!;
    const d = offsets[i]!;
    return inwardOffsetLine(a, b, d);
  });

  // Intersect adjacent offset lines to get new vertices.
  const result: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const lineA = offsetLines[i]!;
    const lineB = offsetLines[(i + 1) % n]!;
    const pt = lineIntersect(lineA, lineB);
    if (pt) result.push(pt);
  }

  if (result.length < 3) return { polygon: [], buildable: false };

  // Check that the resulting polygon has positive area.
  const area = polygonArea(result);
  if (area <= 0) return { polygon: [], buildable: false };

  // Verify that every vertex of the result satisfies all setback half-spaces.
  // Over-large setbacks can produce a valid-looking polygon (e.g. a small
  // square at the center) whose vertices violate other edges' constraints.
  const EPS = 1e-6;
  for (let i = 0; i < n; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.sqrt(ex * ex + ey * ey) || 1;
    // Inward normal for CCW polygon.
    const nx = -ey / len;
    const ny =  ex / len;
    const d  = offsets[i]!;
    // Offset point on this edge's offset line.
    const opx = a.x + nx * d;
    const opy = a.y + ny * d;

    for (const v of result) {
      // Check: (v - offsetPoint) · inwardNormal >= -EPS
      const dot = (v.x - opx) * nx + (v.y - opy) * ny;
      if (dot < -EPS) {
        return { polygon: [], buildable: false };
      }
    }
  }

  return { polygon: result, buildable: true };
}

/** Compute signed area (positive = CCW). */
export function polygonArea(pts: Point2D[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** Centroid of a polygon. */
export function polygonCentroid(pts: Point2D[]): Point2D {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / pts.length, y: cy / pts.length };
}

/** Angle of edge a→b from north (0=north, 90=east, CCW). */
function edgeAngle(a: Point2D, b: Point2D): number {
  return Math.atan2(b.x - a.x, b.y - a.y) * (180 / Math.PI);
}

/**
 * Map edge angle to a setback distance.
 * Edges are assigned: front = nearest south (angle ≈ 180°),
 * rear = nearest north, left/right = east/west sides.
 */
function selectSetback(angleDeg: number, s: SetbackDistances): number {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45)   return s.rear;   // north-facing edge → rear
  if (a >= 45  && a < 135)  return s.right;  // east-facing edge → right
  if (a >= 135 && a < 225)  return s.front;  // south-facing edge → front
  return s.left;                              // west-facing edge → left
}

/** Inward-offset line: shifts edge a→b inward (to the left of CCW polygon). */
function inwardOffsetLine(
  a: Point2D,
  b: Point2D,
  d: number
): { px: number; py: number; dx: number; dy: number } {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.sqrt(ex * ex + ey * ey) || 1;
  // Inward normal for CCW polygon = perpendicular left = (-ey, ex) normalised.
  const nx = -ey / len;
  const ny =  ex / len;
  return {
    px: a.x + nx * d,
    py: a.y + ny * d,
    dx: ex,
    dy: ey,
  };
}

/** Point-in-polygon test using ray casting (Jordan curve theorem). */
export function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  const n = poly.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    const intersect = (yi > pt.y) !== (yj > pt.y) &&
      pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Intersect two parametric lines and return the intersection point. */
function lineIntersect(
  A: { px: number; py: number; dx: number; dy: number },
  B: { px: number; py: number; dx: number; dy: number }
): Point2D | null {
  const denom = A.dx * B.dy - A.dy * B.dx;
  if (Math.abs(denom) < 1e-10) return null; // parallel
  const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / denom;
  return {
    x: A.px + t * A.dx,
    y: A.py + t * A.dy,
  };
}
