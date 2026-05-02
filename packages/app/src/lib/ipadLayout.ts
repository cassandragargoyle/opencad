/**
 * T-FIELD-01: iPad PWA layout utilities — viewport detection, touch geometry,
 * Apple Pencil classification, and hit-target helpers.
 *
 * No React or DOM imports; all functions are pure so they can be tested in Vitest.
 */

// ── Viewport / device classification ─────────────────────────────────────────

export type DeviceClass = 'ipad-11' | 'ipad-13' | 'iphone' | 'desktop';

export interface ViewportSize {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/**
 * Classify the current device based on viewport dimensions.
 * Uses logical pixels (CSS pixels), not physical.
 */
export function classifyDevice(vp: ViewportSize): DeviceClass {
  const minDim = Math.min(vp.width, vp.height);
  const maxDim = Math.max(vp.width, vp.height);

  // iPad Pro 13" landscape: 1366×1024; portrait: 1024×1366
  // iPad Pro 11" landscape: 1194×834;  portrait: 834×1194
  // iPhone: max short edge ≤ 428

  if (minDim <= 428) return 'iphone';
  // Use device pixel ratio to disambiguate iPad (dpr≥2) from desktop monitors (dpr≤1).
  const isHighDensity = vp.devicePixelRatio >= 2;
  if (isHighDensity && (maxDim >= 1300 || minDim >= 1000)) return 'ipad-13';
  if (isHighDensity && minDim >= 768) return 'ipad-11';
  return 'desktop';
}

/** True if the device should use touch-first layout. */
export function isTouchDevice(device: DeviceClass): boolean {
  return device === 'ipad-11' || device === 'ipad-13' || device === 'iphone';
}

// ── Hit target validation ─────────────────────────────────────────────────────

/** Apple HIG minimum hit target in CSS pixels. */
export const HIG_MIN_HIT_TARGET = 44;

export interface HitTarget {
  width: number;
  height: number;
}

/**
 * True if a hit target meets the Apple HIG 44×44 minimum.
 */
export function meetsHIGMinimum(target: HitTarget): boolean {
  return target.width >= HIG_MIN_HIT_TARGET && target.height >= HIG_MIN_HIT_TARGET;
}

/**
 * Expand a hit target to meet the HIG minimum while preserving aspect ratio.
 * Returns the original target if it already meets the minimum.
 */
export function expandToHIGMinimum(target: HitTarget): HitTarget {
  if (meetsHIGMinimum(target)) return target;
  const scale = HIG_MIN_HIT_TARGET / Math.min(target.width, target.height);
  return {
    width:  Math.max(target.width  * scale, HIG_MIN_HIT_TARGET),
    height: Math.max(target.height * scale, HIG_MIN_HIT_TARGET),
  };
}

// ── Apple Pencil touch classification ─────────────────────────────────────────

export type PointerKind = 'pencil' | 'finger' | 'mouse' | 'unknown';

export interface PointerInputEvent {
  pointerType: string;
  /** Tip pressure [0, 1] */
  pressure: number;
  /** Altitude angle in radians (0 = parallel to screen, π/2 = perpendicular) */
  altitudeAngle?: number;
  /** Azimuth angle in radians */
  azimuthAngle?: number;
  /** Twist angle (Pencil 2nd gen) */
  twist?: number;
  /** Width of contact area */
  width?: number;
  /** Height of contact area */
  height?: number;
}

/**
 * Classify a pointer input as pencil, finger, or mouse.
 * Apple Pencil reports `pointerType === 'pen'` in browser events.
 */
export function classifyPointer(event: PointerInputEvent): PointerKind {
  if (event.pointerType === 'pen') return 'pencil';
  if (event.pointerType === 'touch') return 'finger';
  if (event.pointerType === 'mouse') return 'mouse';
  return 'unknown';
}

/**
 * True if the pointer represents an Apple Pencil (stylus).
 */
export function isPencil(event: PointerInputEvent): boolean {
  return classifyPointer(event) === 'pencil';
}

/**
 * Normalise pencil pressure to a stroke weight multiplier.
 * Light touch (pressure=0.1) → weight=0.5; full pressure (1.0) → weight=2.0.
 */
export function pencilPressureToWeight(pressure: number): number {
  const clamped = Math.max(0, Math.min(1, pressure));
  return 0.5 + clamped * 1.5;
}

// ── Touch gesture math ────────────────────────────────────────────────────────

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface PinchGesture {
  /** Scale factor relative to previous frame */
  scaleDelta: number;
  /** Rotation in radians relative to previous frame */
  rotationDelta: number;
  /** Centroid of the two touch points */
  centroid: { x: number; y: number };
}

/**
 * Compute pinch scale and rotation deltas from two pairs of touch points.
 * `prev` and `curr` each contain two fingers.
 */
export function computePinchGesture(
  prev: [TouchPoint, TouchPoint],
  curr: [TouchPoint, TouchPoint],
): PinchGesture {
  const prevDist = distance(prev[0], prev[1]);
  const currDist = distance(curr[0], curr[1]);
  const scaleDelta = prevDist > 0 ? currDist / prevDist : 1;

  const prevAngle = Math.atan2(prev[1].y - prev[0].y, prev[1].x - prev[0].x);
  const currAngle = Math.atan2(curr[1].y - curr[0].y, curr[1].x - curr[0].x);
  const rotationDelta = currAngle - prevAngle;

  const centroid = {
    x: (curr[0].x + curr[1].x) / 2,
    y: (curr[0].y + curr[1].y) / 2,
  };

  return { scaleDelta, rotationDelta, centroid };
}

function distance(a: TouchPoint, b: TouchPoint): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// ── Floating tool palette layout ──────────────────────────────────────────────

export interface PaletteLayout {
  /** Recommended position for the floating palette given thumb reach zones */
  x: number;
  y: number;
  /** Whether palette should be on the left or right side */
  side: 'left' | 'right';
}

/**
 * Compute the recommended position for a thumb-reachable floating tool palette.
 * Places the palette in the lower-corner "easy thumb" zone.
 *
 * @param vp         Viewport dimensions
 * @param paletteW   Palette width in CSS pixels
 * @param paletteH   Palette height in CSS pixels
 * @param preferSide 'left' | 'right' based on user handedness (default: right)
 * @param margin     Edge margin in CSS pixels (default: 16)
 */
export function computePalettePosition(
  vp: ViewportSize,
  paletteW: number,
  paletteH: number,
  preferSide: 'left' | 'right' = 'right',
  margin = 16,
): PaletteLayout {
  const x = preferSide === 'right'
    ? vp.width  - paletteW - margin
    : margin;
  const y = vp.height - paletteH - margin;
  return { x, y, side: preferSide };
}

// ── PWA cold start performance budget ────────────────────────────────────────

export const COLD_START_BUDGET_MS = 2000;

/** True if the cold start time is within the target budget. */
export function withinColdStartBudget(coldStartMs: number): boolean {
  return coldStartMs <= COLD_START_BUDGET_MS;
}
