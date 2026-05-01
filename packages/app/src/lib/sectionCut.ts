/**
 * T-VIEW-01: Section cut geometry — intersect building elements with a cut plane
 * to produce 2D cross-section line work.
 *
 * Coordinate convention (millimetres):
 *   - Plan: X (easting), Y (northing)
 *   - Vertical: Z (elevation)
 * Section output: X is distance along the cut direction, Y is elevation (Z).
 */
import type { ElementSchema } from '@opencad/document';

export interface Point2D { x: number; y: number; }

export interface SectionPlane {
  /** A point on the cut plane in plan (mm). */
  origin: Point2D;
  /** Unit normal pointing toward the viewer (determines which side is "front"). */
  normal: Point2D;
  /** Unit vector along the cut line (perpendicular to normal, in plan). */
  cutDir: Point2D;
  /** Bottom elevation included in this section (mm). */
  zBottom: number;
  /** Top elevation included in this section (mm). */
  zTop: number;
  /** Depth behind the cut plane to include in projection (mm). */
  depth: number;
}

/** A single 2D line in section space: x = distance along cut, y = elevation. */
export interface SectionLine {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface SectionCutResult {
  elementId: string;
  elementType: string;
  /** Lines in section-space coordinates. */
  lines: SectionLine[];
  /** True if this line was cut directly by the plane (vs projected). */
  isCut: boolean;
}

/** Options for sectionPlaneFromMarker. */
export interface MarkerOptions {
  zBottom: number;
  zTop: number;
  depth: number;
}

/**
 * Build a SectionPlane from two points defining the cut line in plan.
 * The normal points 90° left of the cut direction (standard: viewer looks left→right).
 */
export function sectionPlaneFromMarker(
  a: Point2D,
  b: Point2D,
  opts: MarkerOptions,
): SectionPlane {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cutDir: Point2D = { x: dx / len, y: dy / len };
  // Normal = left perpendicular to cut direction (rotate 90° CCW)
  const normal: Point2D = { x: -cutDir.y, y: cutDir.x };
  return {
    origin: { x: a.x, y: a.y },
    normal,
    cutDir,
    zBottom: opts.zBottom,
    zTop: opts.zTop,
    depth: opts.depth,
  };
}

/**
 * Compute all section cut lines for a list of elements against a plane.
 * Returns one SectionCutResult per intersecting element.
 */
export function computeSectionCut(
  elements: ElementSchema[],
  plane: SectionPlane,
): SectionCutResult[] {
  const results: SectionCutResult[] = [];

  for (const el of elements) {
    if (!el.visible) continue;

    const cut = cutElement(el, plane);
    if (cut) results.push(cut);
  }

  return results;
}

// ── private helpers ─────────────────────────────────────────────────────────

function cutElement(
  el: ElementSchema,
  plane: SectionPlane,
): SectionCutResult | null {
  const geom = el.geometry as unknown as Record<string, unknown> | undefined;
  if (!geom) return null;

  const zBase = (el.properties?.ZBase as unknown as number | undefined) ?? 0;
  const zTop  = (el.properties?.ZTop  as unknown as number | undefined) ?? 3000;

  if (geom.type === 'line') {
    return cutLineElement(el, geom, zBase, zTop, plane);
  }
  if (geom.type === 'polygon') {
    return cutPolygonElement(el, geom, zBase, zTop, plane);
  }
  return null;
}

/** Signed distance of a 2D point from the plane (positive = viewer side). */
function signedDist(p: Point2D, plane: SectionPlane): number {
  return (p.x - plane.origin.x) * plane.normal.x +
         (p.y - plane.origin.y) * plane.normal.y;
}

/** Project a plan point onto the cut direction axis (section X coordinate). */
function projectOnCut(p: Point2D, plane: SectionPlane): number {
  return (p.x - plane.origin.x) * plane.cutDir.x +
         (p.y - plane.origin.y) * plane.cutDir.y;
}

function cutLineElement(
  el: ElementSchema,
  geom: Record<string, unknown>,
  zBase: number,
  zTop: number,
  plane: SectionPlane,
): SectionCutResult | null {
  const x1 = geom.x1 as number;
  const y1 = geom.y1 as number;
  const x2 = geom.x2 as number;
  const y2 = geom.y2 as number;

  const pA: Point2D = { x: x1, y: y1 };
  const pB: Point2D = { x: x2, y: y2 };

  const dA = signedDist(pA, plane);
  const dB = signedDist(pB, plane);

  // Both on same side — no intersection, check if within depth for projection
  if (dA * dB >= 0) {
    // Check if line segment lies within depth behind the plane
    const behindA = dA >= 0 && dA <= plane.depth;
    const behindB = dB >= 0 && dB <= plane.depth;
    if (!behindA && !behindB) return null;
    // Both within depth: project as hidden line — but for cut results we skip projection
    return null;
  }

  // Intersection: t = dA / (dA - dB)
  const t = dA / (dA - dB);
  const ix = x1 + t * (x2 - x1);
  const iy = y1 + t * (y2 - y1);
  const intersect: Point2D = { x: ix, y: iy };

  // Check within elevation range
  const z1 = Math.max(zBase, plane.zBottom);
  const z2 = Math.min(zTop,  plane.zTop);
  if (z2 <= z1) return null;

  const sx = projectOnCut(intersect, plane);

  return {
    elementId: el.id,
    elementType: el.type,
    lines: [{ x1: sx, y1: z1, x2: sx, y2: z2 }],
    isCut: true,
  };
}

function cutPolygonElement(
  el: ElementSchema,
  geom: Record<string, unknown>,
  zBase: number,
  zTop: number,
  plane: SectionPlane,
): SectionCutResult | null {
  const rawPts = geom.points as Array<{ x: number; y: number }> | undefined;
  if (!rawPts || rawPts.length < 3) return null;

  // Find all polygon edges that cross the cut plane
  const cuts: SectionLine[] = [];
  const n = rawPts.length;

  const z1 = Math.max(zBase, plane.zBottom);
  const z2 = Math.min(zTop,  plane.zTop);
  if (z2 <= z1) return null;

  for (let i = 0; i < n; i++) {
    const pA = rawPts[i]!;
    const pB = rawPts[(i + 1) % n]!;

    const dA = signedDist(pA, plane);
    const dB = signedDist(pB, plane);

    if (dA * dB >= 0) continue;

    const t = dA / (dA - dB);
    const ix = pA.x + t * (pB.x - pA.x);
    const iy = pA.y + t * (pB.y - pA.y);
    const intersect: Point2D = { x: ix, y: iy };
    const sx = projectOnCut(intersect, plane);
    cuts.push({ x1: sx, y1: z1, x2: sx, y2: z2 });
  }

  if (cuts.length === 0) return null;

  return {
    elementId: el.id,
    elementType: el.type,
    lines: cuts,
    isCut: true,
  };
}
