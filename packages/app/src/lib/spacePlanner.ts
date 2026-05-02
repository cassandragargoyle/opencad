/**
 * T-ANA-09 (#427): Constrained space-planning / test-fit engine.
 *
 * Given a floor polygon and a list of room programmes, pack rooms into
 * the available area using a greedy strip-packing algorithm.  Rooms are
 * placed left-to-right in strips; each strip height equals the tallest
 * room placed in it.
 *
 * The result is a list of placed rectangles (RoomPlacement[]) that callers
 * can use to generate floor-plan elements via addElement().
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomProgram {
  /** Unique identifier */
  id: string;
  /** Human-readable room name */
  name: string;
  /** Required floor area (m²) */
  targetAreaM2: number;
  /** Minimum room width (m) */
  minWidthM: number;
  /** Minimum room depth (m) */
  minDepthM: number;
  /** Preferred aspect ratio width/depth (default 1.0 = square-ish) */
  aspectRatio?: number;
  /** Room type for adjacency preferences */
  type?: string;
}

export interface RoomPlacement {
  roomId: string;
  roomName: string;
  /** Bottom-left corner X (m) */
  x: number;
  /** Bottom-left corner Y (m) */
  y: number;
  /** Placed width (m) */
  width: number;
  /** Placed depth (m) */
  depth: number;
  /** Actual placed area (m²) */
  areaMm2: number;
  /** True if the room met its target area */
  areaFulfilled: boolean;
}

export interface TestFitResult {
  placements: RoomPlacement[];
  /** Total area used (m²) */
  usedAreaM2: number;
  /** Available bounding-box area (m²) */
  availableAreaM2: number;
  /** Fraction of available area placed (0–1) */
  efficiency: number;
  /** Rooms that could not be placed due to space constraints */
  unplacedRooms: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default corridor/partition allowance as fraction of room area. */
export const DEFAULT_CIRCULATION_FACTOR = 0.2;

// ── Space planner ─────────────────────────────────────────────────────────────

/**
 * Pack rooms into a rectangular bounding box using strip packing.
 *
 * Rooms are sorted by area (largest first) and placed left-to-right
 * into horizontal strips until the strip is full, then a new strip starts.
 *
 * @param rooms           Room programmes to place
 * @param boundingWidthM  Bounding box width (m)
 * @param boundingDepthM  Bounding box depth (m)
 * @param opts            Options
 */
export function runTestFit(
  rooms: RoomProgram[],
  boundingWidthM: number,
  boundingDepthM: number,
  opts: {
    circulationFactor?: number;
    gapM?: number;
  } = {},
): TestFitResult {
  const circulation = opts.circulationFactor ?? DEFAULT_CIRCULATION_FACTOR;
  const gap = opts.gapM ?? 0;

  // Net area after circulation allowance
  const netWidthM = boundingWidthM;
  const netDepthM = boundingDepthM * (1 - circulation);
  const availableAreaM2 = netWidthM * netDepthM;

  // Sort rooms largest-first
  const sorted = [...rooms].sort((a, b) => b.targetAreaM2 - a.targetAreaM2);

  const placements: RoomPlacement[] = [];
  const unplacedRooms: string[] = [];
  let usedAreaM2 = 0;

  let cursorX = 0;
  let cursorY = 0;
  let stripHeight = 0;

  for (const room of sorted) {
    const aspect = room.aspectRatio ?? 1.0;

    // Compute dimensions from target area + aspect ratio
    let w = Math.sqrt(room.targetAreaM2 * aspect);
    let d = room.targetAreaM2 / w;

    // Enforce minimums
    if (w < room.minWidthM) { w = room.minWidthM; d = room.targetAreaM2 / w; }
    if (d < room.minDepthM) { d = room.minDepthM; w = room.targetAreaM2 / d; }

    // Round up to nearest 0.1 m
    w = Math.ceil(w * 10) / 10;
    d = Math.ceil(d * 10) / 10;

    // Check if room fits in current strip
    if (cursorX + w > netWidthM + 0.001) {
      // Start new strip
      cursorY += stripHeight + gap;
      cursorX = 0;
      stripHeight = 0;
    }

    // Check vertical overflow
    if (cursorY + d > netDepthM + 0.001) {
      unplacedRooms.push(room.id);
      continue;
    }

    const placedArea = w * d;
    placements.push({
      roomId:        room.id,
      roomName:      room.name,
      x:             Math.round(cursorX * 1000) / 1000,
      y:             Math.round(cursorY * 1000) / 1000,
      width:         w,
      depth:         d,
      areaMm2:       placedArea,
      areaFulfilled: placedArea >= room.targetAreaM2 * 0.95,
    });

    usedAreaM2 += placedArea;
    cursorX    += w + gap;
    if (d > stripHeight) stripHeight = d;
  }

  return {
    placements,
    usedAreaM2:      Math.round(usedAreaM2 * 100) / 100,
    availableAreaM2: Math.round(availableAreaM2 * 100) / 100,
    efficiency:      availableAreaM2 > 0 ? Math.min(1, usedAreaM2 / availableAreaM2) : 0,
    unplacedRooms,
  };
}

// ── Area budget helpers ───────────────────────────────────────────────────────

/**
 * Total target area of a room programme list (m²).
 */
export function totalProgrammeArea(rooms: RoomProgram[]): number {
  return rooms.reduce((s, r) => s + r.targetAreaM2, 0);
}

/**
 * Check if all rooms fit within the bounding box (accounting for circulation).
 */
export function programmeFitsInBbox(
  rooms: RoomProgram[],
  widthM: number,
  depthM: number,
  circulationFactor = DEFAULT_CIRCULATION_FACTOR,
): boolean {
  const netArea = widthM * depthM * (1 - circulationFactor);
  return totalProgrammeArea(rooms) <= netArea;
}

/**
 * Summarize room types and their total area requirements.
 */
export function roomTypeSummary(rooms: RoomProgram[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const r of rooms) {
    const t = r.type ?? 'unclassified';
    summary[t] = (summary[t] ?? 0) + r.targetAreaM2;
  }
  return summary;
}
