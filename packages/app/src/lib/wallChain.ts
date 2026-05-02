/**
 * #452: Wall placement — Revit-style chained paint-on workflow.
 *
 * Pure state machine for the wall chain tool.  UI wires PointerEvents;
 * this module handles the geometry and state transitions.
 *
 * Workflow:
 *   idle → clicking points builds a segment chain
 *   on close-loop snap, closes the footprint
 *   segments export as WallSegment[] ready for addElement()
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  start: Point2D;
  end: Point2D;
  /** Thickness in mm */
  thickness: number;
  /** Height in mm */
  height: number;
  levelId: string;
  layerId: string;
}

export type WallChainState =
  | { status: 'idle' }
  | { status: 'drawing'; points: Point2D[]; pendingEnd: Point2D }
  | { status: 'closed'; segments: WallSegment[] };

// ── Snap constants ────────────────────────────────────────────────────────────

/** Distance in screen pixels at which the cursor snaps to the first point (close loop). */
export const LOOP_CLOSE_SNAP_PX = 16;

/** Default wall thickness in mm. */
export const DEFAULT_WALL_THICKNESS_MM = 200;

/** Default wall height in mm (2700 = standard 9-foot ceiling). */
export const DEFAULT_WALL_HEIGHT_MM = 2700;

// ── State machine ─────────────────────────────────────────────────────────────

/** Start a new chain at the first clicked point. */
export function startChain(point: Point2D): WallChainState {
  return { status: 'drawing', points: [point], pendingEnd: point };
}

/** Update the pending (ghost) endpoint as the cursor moves. */
export function updatePending(state: WallChainState, cursor: Point2D): WallChainState {
  if (state.status !== 'drawing') return state;
  return { ...state, pendingEnd: cursor };
}

/**
 * Add a new anchor point (user click).
 * If the cursor is within LOOP_CLOSE_SNAP_PX of the first point and
 * there are at least 3 points, close the loop.
 *
 * @param state     Current chain state
 * @param point     Clicked world-space point
 * @param snapPx    Close-loop snap threshold (default LOOP_CLOSE_SNAP_PX)
 * @param opts      Wall defaults
 */
export function addChainPoint(
  state: WallChainState,
  point: Point2D,
  snapPx = LOOP_CLOSE_SNAP_PX,
  opts: {
    thickness?: number;
    height?: number;
    levelId?: string;
    layerId?: string;
    screenToWorld?: number; // scale factor px→mm (default 1)
  } = {},
): WallChainState {
  if (state.status !== 'drawing') return state;

  const { points } = state;
  const thickness = opts.thickness ?? DEFAULT_WALL_THICKNESS_MM;
  const height    = opts.height    ?? DEFAULT_WALL_HEIGHT_MM;
  const levelId   = opts.levelId   ?? 'default-level';
  const layerId   = opts.layerId   ?? 'default-layer';
  const scale     = opts.screenToWorld ?? 1;

  // Check for loop close
  const first = points[0]!;
  const screenDist = euclidean2D(point, first) / scale;
  const canClose   = points.length >= 3 && screenDist <= snapPx;

  if (canClose) {
    // Close the loop: add the first point as final anchor, then build segments
    const closed = [...points, first];
    return {
      status: 'closed',
      segments: buildSegments(closed, thickness, height, levelId, layerId),
    };
  }

  return { ...state, points: [...points, point], pendingEnd: point };
}

/** Cancel the active chain (Escape pressed). */
export function cancelChain(): WallChainState {
  return { status: 'idle' };
}

/** Undo the last placed point. Returns idle if chain becomes empty. */
export function undoLastPoint(state: WallChainState): WallChainState {
  if (state.status !== 'drawing') return state;
  if (state.points.length <= 1) return { status: 'idle' };
  const points = state.points.slice(0, -1);
  return { ...state, points, pendingEnd: points[points.length - 1]! };
}

/** True if cursor is close enough to the first point to trigger loop close. */
export function isNearLoopClose(
  state: WallChainState,
  cursor: Point2D,
  snapPx = LOOP_CLOSE_SNAP_PX,
  scale = 1,
): boolean {
  if (state.status !== 'drawing' || state.points.length < 3) return false;
  return euclidean2D(cursor, state.points[0]!) / scale <= snapPx;
}

// ── Segment builder ──────────────────────────────────────────────────────────

function buildSegments(
  points: Point2D[],
  thickness: number,
  height: number,
  levelId: string,
  layerId: string,
): WallSegment[] {
  const segs: WallSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segs.push({
      id: `wall-${i}-${Date.now()}`,
      start: points[i]!,
      end:   points[i + 1]!,
      thickness,
      height,
      levelId,
      layerId,
    });
  }
  return segs;
}

// ── Ghost segment for live preview ───────────────────────────────────────────

/**
 * Returns the live preview segment (from last anchor to current cursor).
 * Returns null when not drawing.
 */
export function ghostSegment(state: WallChainState): { start: Point2D; end: Point2D } | null {
  if (state.status !== 'drawing' || state.points.length === 0) return null;
  return {
    start: state.points[state.points.length - 1]!,
    end:   state.pendingEnd,
  };
}

/** All confirmed segments built so far (from the anchor chain, not yet closed). */
export function previewSegments(state: WallChainState): Array<{ start: Point2D; end: Point2D }> {
  if (state.status !== 'drawing') return [];
  return state.points.slice(0, -1).map((p, i) => ({
    start: p,
    end:   state.points[i + 1]!,
  }));
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function euclidean2D(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Total perimeter of a closed segment array (mm). */
export function chainPerimeter(segments: WallSegment[]): number {
  return segments.reduce((sum, s) => sum + euclidean2D(s.start, s.end), 0);
}

/** Signed area of a closed polygon via shoelace formula (mm²). */
export function chainArea(segments: WallSegment[]): number {
  const pts = segments.map((s) => s.start);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}
