/**
 * T-VIEW-04: Revision cloud geometry — generate arc-bump paths along a polygon.
 * Each polygon edge is subdivided into arc segments to create the characteristic
 * revision cloud appearance.
 */

export interface Point2D { x: number; y: number; }

export interface CloudBump {
  /** Arc center in model space. */
  cx: number;
  cy: number;
  /** Arc radius (= arcSize / 2). */
  r: number;
  /** SVG-style start angle (degrees). */
  startAngle: number;
  /** SVG-style end angle (degrees). */
  endAngle: number;
}

/**
 * Compute arc bump positions along the polygon edges.
 * @param polygon  Closed polygon vertices.
 * @param arcSize  Approximate arc chord length in model units.
 */
export function computeRevisionCloudBumps(
  polygon: Point2D[],
  arcSize: number,
): CloudBump[] {
  if (polygon.length < 2) return [];

  const r = arcSize / 2;
  const bumps: CloudBump[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen < 1) continue;

    const count = Math.max(1, Math.floor(edgeLen / arcSize));
    const step  = edgeLen / count;

    // Unit vectors along edge and perpendicular (inward for bumps)
    const ux = dx / edgeLen;
    const uy = dy / edgeLen;
    // Normal points "outside" (left of direction = -uy, ux)
    const nx = -uy;
    const ny =  ux;

    for (let k = 0; k < count; k++) {
      const t0 = (k + 0.5) * step;
      // Center of this bump arc at the midpoint of the step, offset by r outward
      const cx = a.x + ux * t0 + nx * r;
      const cy = a.y + uy * t0 + ny * r;

      // Start and end points on the edge
      const sx = a.x + ux * (k * step);
      const sy = a.y + uy * (k * step);

      // Angle from center to start point
      const startAngle = Math.atan2(sy - cy, sx - cx) * (180 / Math.PI);
      const endAngle   = startAngle + 180; // half arc

      bumps.push({ cx, cy, r, startAngle, endAngle });
    }
  }

  return bumps;
}

/**
 * Build an SVG path string for the revision cloud.
 * Uses arc commands to draw each bump.
 */
export function buildRevisionCloudPath(
  polygon: Point2D[],
  arcSize: number,
): string {
  if (polygon.length < 2) return '';

  const r = arcSize / 2;
  const n = polygon.length;
  const parts: string[] = [];
  let started = false;

  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen < 1) continue;

    const count = Math.max(1, Math.floor(edgeLen / arcSize));
    const step  = edgeLen / count;
    const ux = dx / edgeLen;
    const uy = dy / edgeLen;
    const nx = -uy;
    const ny =  ux;

    for (let k = 0; k < count; k++) {
      const x0 = a.x + ux * (k * step);
      const y0 = a.y + uy * (k * step);
      const x1 = a.x + ux * ((k + 1) * step);
      const y1 = a.y + uy * ((k + 1) * step);

      // Center of arc (outward offset by r)
      const mx = (x0 + x1) / 2 + nx * r;
      const my = (y0 + y1) / 2 + ny * r;

      // Recalculate start/end on circle
      const sdx = x0 - mx;
      const sdy = y0 - my;
      const actualR = Math.hypot(sdx, sdy);

      if (!started) {
        parts.push(`M ${x0.toFixed(1)} ${y0.toFixed(1)}`);
        started = true;
      }

      // SVG arc: A rx ry x-rotation large-arc sweep x y
      // sweep=1 = clockwise (outward bump)
      parts.push(
        `A ${actualR.toFixed(1)} ${actualR.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
      );
    }
  }

  if (parts.length > 0) parts.push('Z');
  return parts.join(' ');
}
