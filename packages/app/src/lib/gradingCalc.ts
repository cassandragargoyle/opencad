/**
 * T-SITE-08: Grading calculations — cut/fill volume estimation and slope analysis.
 * Volumes are computed by comparing existing and proposed elevation grids using
 * the prismatoid method (average end area × grid cell area).
 */

export interface ElevationGrid {
  /** Number of columns (including endpoints). */
  cols: number;
  /** Number of rows (including endpoints). */
  rows: number;
  /** Flat array of elevations (mm), row-major order: [row0col0, row0col1, ...]. */
  elevations: Float32Array | number[];
  /** Physical X extent (mm). */
  rangeX: number;
  /** Physical Y extent (mm). */
  rangeY: number;
}

export interface CutFillResult {
  /** Volume of earth to be cut (removed), mm³. */
  cutVolume: number;
  /** Volume of earth to be fill (added), mm³. */
  fillVolume: number;
  /** Net volume (positive = net fill, negative = net cut), mm³. */
  netVolume: number;
  /** Grid cells classified as 'cut', 'fill', or 'flat'. */
  cellClasses: ('cut' | 'fill' | 'flat')[];
}

export interface SpotLevel {
  /** World X (mm). */
  x: number;
  /** World Y (mm). */
  y: number;
  /** Elevation (mm). */
  z: number;
  /** Optional label text (e.g. "FL +0.300"). */
  label?: string;
}

export interface DrainageArrow {
  /** Arrow start point. */
  x1: number; y1: number;
  /** Arrow end point (points downhill). */
  x2: number; y2: number;
  /** Slope as rise/run (e.g. 0.02 = 2%). */
  slope: number;
}

/**
 * Compute cut/fill volumes between an existing and a proposed elevation grid.
 * Both grids must have the same dimensions and physical extents.
 *
 * @param existing  Existing terrain elevations.
 * @param proposed  Proposed grade elevations.
 */
export function computeCutFill(
  existing: ElevationGrid,
  proposed: ElevationGrid
): CutFillResult {
  const { cols, rows } = existing;
  if (
    proposed.cols !== cols || proposed.rows !== rows ||
    cols < 2 || rows < 2
  ) {
    return { cutVolume: 0, fillVolume: 0, netVolume: 0, cellClasses: [] };
  }

  const cellW = existing.rangeX / (cols - 1);
  const cellH = existing.rangeY / (rows - 1);
  const cellArea = cellW * cellH; // mm²

  let cutVolume  = 0;
  let fillVolume = 0;
  const cellClasses: ('cut' | 'fill' | 'flat')[] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      // Four corners of the quad cell.
      const idx = [
        r * cols + c,
        r * cols + c + 1,
        (r + 1) * cols + c,
        (r + 1) * cols + c + 1,
      ];

      let sumDiff = 0;
      for (const i of idx) {
        const diff = (proposed.elevations[i] ?? 0) - (existing.elevations[i] ?? 0);
        sumDiff += diff;
      }
      // Average elevation difference across the four corners.
      const avgDiff = sumDiff / 4;
      const vol = Math.abs(avgDiff) * cellArea;

      if (avgDiff > 1e-3) {
        fillVolume += vol;
        cellClasses.push('fill');
      } else if (avgDiff < -1e-3) {
        cutVolume += vol;
        cellClasses.push('cut');
      } else {
        cellClasses.push('flat');
      }
    }
  }

  return {
    cutVolume,
    fillVolume,
    netVolume: fillVolume - cutVolume,
    cellClasses,
  };
}

/**
 * Compute the slope (rise/run) and drainage direction between two spot levels.
 *
 * @param from  Uphill spot level.
 * @param to    Downhill spot level.
 * @returns `DrainageArrow` from `from` to `to`.
 */
export function spotLevelsToArrow(from: SpotLevel, to: SpotLevel): DrainageArrow {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizDist = Math.sqrt(dx * dx + dy * dy) || 1;
  const slope = (to.z - from.z) / horizDist;
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y, slope };
}

/**
 * Format a spot level label using engineering convention.
 * Positive elevations relative to datum get "+", negative get "−".
 *
 * @param z  Elevation in mm.
 * @param prefix  Optional prefix (e.g. "FL" for finish level, "NGL" for natural ground).
 */
export function formatSpotLevel(z: number, prefix = 'FL'): string {
  const meters = z / 1000;
  const sign   = meters >= 0 ? '+' : '';
  return `${prefix} ${sign}${meters.toFixed(3)}`;
}

/**
 * Format a slope as a percentage or ratio string.
 *
 * @param slope  Rise/run (dimensionless).
 * @param format 'percent' (default) or 'ratio'.
 */
export function formatSlope(slope: number, format: 'percent' | 'ratio' = 'percent'): string {
  if (format === 'ratio') {
    const run = Math.abs(slope) > 1e-6 ? 1 / Math.abs(slope) : Infinity;
    return `1:${run.toFixed(0)}`;
  }
  return `${(slope * 100).toFixed(1)}%`;
}
