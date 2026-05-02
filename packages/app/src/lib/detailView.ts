/**
 * T-VIEW-03: Detail view — define a cropped 2D region of the model at an
 * enlarged scale for construction detail drawings.
 */
import type { ElementSchema, ViewSchema } from '@opencad/document';

export interface DetailRegion {
  /** Origin in model space (mm). */
  x: number;
  y: number;
  /** Size in model space (mm). */
  width: number;
  height: number;
  /** Print scale denominator (e.g. 10 = 1:10). */
  scale?: number;
}

/** Create a ViewSchema for a detail view. */
export function createDetailView(
  name: string,
  region: DetailRegion,
  scale: number,
): ViewSchema {
  const id = `detail_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  return {
    id,
    name,
    type: 'detail',
    camera: {
      position: { x: region.x + region.width / 2, y: 1000, z: region.y + region.height / 2 },
      target:   { x: region.x + region.width / 2, y: 0,    z: region.y + region.height / 2 },
      up: { x: 0, y: 1, z: 0 },
      fov: 50, near: 1, far: 100_000,
    },
    detailRegion: { ...region, scale },
  };
}

/**
 * Return elements whose geometry overlaps the detail region.
 * Uses a bounding-box test: element has at least one endpoint inside
 * or the element straddles the region boundary.
 */
export function getDetailViewElements(
  elements: ElementSchema[],
  region: DetailRegion,
): ElementSchema[] {
  return elements.filter((el) => {
    if (!el.visible) return false;
    return elementOverlapsRegion(el, region);
  });
}

function elementOverlapsRegion(el: ElementSchema, r: DetailRegion): boolean {
  const geom = el.geometry as unknown as Record<string, unknown>;
  if (!geom) return false;

  const rX2 = r.x + r.width;
  const rY2 = r.y + r.height;

  if (geom.type === 'line') {
    const x1 = geom.x1 as number;
    const y1 = geom.y1 as number;
    const x2 = geom.x2 as number;
    const y2 = geom.y2 as number;
    // At least one endpoint inside, or segment intersects region boundary
    return (
      (x1 >= r.x && x1 <= rX2 && y1 >= r.y && y1 <= rY2) ||
      (x2 >= r.x && x2 <= rX2 && y2 >= r.y && y2 <= rY2) ||
      lineIntersectsRect(x1, y1, x2, y2, r.x, r.y, rX2, rY2)
    );
  }

  if (geom.type === 'point') {
    const x = geom.x as number;
    const y = geom.y as number;
    return x >= r.x && x <= rX2 && y >= r.y && y <= rY2;
  }

  if (geom.type === 'polygon') {
    const pts = geom.points as Array<{ x: number; y: number }>;
    return pts.some((p) => p.x >= r.x && p.x <= rX2 && p.y >= r.y && p.y <= rY2);
  }

  return false;
}

function lineIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx1: number, ry1: number, rx2: number, ry2: number,
): boolean {
  // Cohen-Sutherland simplified: check if bounding boxes overlap
  const lx1 = Math.min(x1, x2);
  const lx2 = Math.max(x1, x2);
  const ly1 = Math.min(y1, y2);
  const ly2 = Math.max(y1, y2);
  return lx1 <= rx2 && lx2 >= rx1 && ly1 <= ry2 && ly2 >= ry1;
}
