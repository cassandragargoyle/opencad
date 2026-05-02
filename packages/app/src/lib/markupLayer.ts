/**
 * T-FIELD-02: Bluebeam-style markup layer — schema, tool types, and serialisation.
 *
 * Markups are stored in a separate namespace from the BIM model.  Each markup
 * is optionally linked to a BCF topic via `bcfTopicGuid`.  Markups export to
 * PDF as an overlay layer.
 *
 * Supported tools: pen, highlighter, text-box, arrow, cloud, measurement-callout,
 * photo-stamp.
 */

// ── Point ─────────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

// ── Markup types ──────────────────────────────────────────────────────────────

export type MarkupTool =
  | 'pen'
  | 'highlighter'
  | 'text-box'
  | 'arrow'
  | 'cloud'
  | 'measurement-callout'
  | 'photo-stamp';

export type MarkupStatus = 'open' | 'resolved' | 'rejected';

export interface MarkupBase {
  id: string;
  tool: MarkupTool;
  /** View id (sheet, 2D view, 3D view) that this markup belongs to */
  viewId: string;
  /** Optional link to a BCF topic */
  bcfTopicGuid?: string;
  colour: string;
  opacity: number;
  status: MarkupStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PenMarkup extends MarkupBase {
  tool: 'pen';
  /** Stroke points */
  points: Point2D[];
  strokeWidth: number;
}

export interface HighlighterMarkup extends MarkupBase {
  tool: 'highlighter';
  points: Point2D[];
  strokeWidth: number;
}

export interface TextBoxMarkup extends MarkupBase {
  tool: 'text-box';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface ArrowMarkup extends MarkupBase {
  tool: 'arrow';
  from: Point2D;
  to: Point2D;
  strokeWidth: number;
  arrowHead: 'open' | 'filled' | 'none';
}

export interface CloudMarkup extends MarkupBase {
  tool: 'cloud';
  /** Bounding box corners (clockwise) */
  points: Point2D[];
  strokeWidth: number;
  /** Arc radius for cloud bumps (CSS pixels) */
  arcRadius: number;
}

export interface MeasurementCallout extends MarkupBase {
  tool: 'measurement-callout';
  from: Point2D;
  to: Point2D;
  /** Measured distance in model units (mm) */
  distanceMm: number;
  /** Display label (computed from distanceMm + unit pref) */
  label: string;
}

export interface PhotoStampMarkup extends MarkupBase {
  tool: 'photo-stamp';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Data URI or object URL of the photo */
  imageDataUri: string;
  caption?: string;
}

export type Markup =
  | PenMarkup
  | HighlighterMarkup
  | TextBoxMarkup
  | ArrowMarkup
  | CloudMarkup
  | MeasurementCallout
  | PhotoStampMarkup;

// ── Markup layer (per view) ───────────────────────────────────────────────────

export interface MarkupLayer {
  viewId: string;
  markups: Markup[];
  /** True when markups are visible in the viewport */
  visible: boolean;
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

/**
 * Add a markup to a layer. Returns new layer (immutable update).
 */
export function addMarkup(layer: MarkupLayer, markup: Markup): MarkupLayer {
  return { ...layer, markups: [...layer.markups, markup] };
}

/**
 * Update an existing markup by id. Returns new layer.
 * Throws if markup not found.
 */
export function updateMarkup(layer: MarkupLayer, id: string, patch: Partial<Markup>): MarkupLayer {
  const idx = layer.markups.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error(`Markup ${id} not found`);
  const updated = { ...layer.markups[idx]!, ...patch, updatedAt: Date.now() } as Markup;
  const markups = [...layer.markups];
  markups[idx] = updated;
  return { ...layer, markups };
}

/**
 * Delete a markup by id. Returns new layer.
 */
export function deleteMarkup(layer: MarkupLayer, id: string): MarkupLayer {
  return { ...layer, markups: layer.markups.filter((m) => m.id !== id) };
}

/**
 * Filter markups by tool type.
 */
export function markupsByTool(layer: MarkupLayer, tool: MarkupTool): Markup[] {
  return layer.markups.filter((m) => m.tool === tool);
}

/**
 * Filter markups linked to a specific BCF topic.
 */
export function markupsByBCF(layer: MarkupLayer, bcfTopicGuid: string): Markup[] {
  return layer.markups.filter((m) => m.bcfTopicGuid === bcfTopicGuid);
}

/**
 * Filter markups by status.
 */
export function markupsByStatus(layer: MarkupLayer, status: MarkupStatus): Markup[] {
  return layer.markups.filter((m) => m.status === status);
}

// ── Bounding box ──────────────────────────────────────────────────────────────

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Compute the bounding box of a markup.
 */
export function markupBBox(markup: Markup): BBox {
  switch (markup.tool) {
    case 'pen':
    case 'highlighter':
    case 'cloud': {
      const xs = markup.points.map((p) => p.x);
      const ys = markup.points.map((p) => p.y);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    case 'text-box':
    case 'photo-stamp':
      return { minX: markup.x, minY: markup.y, maxX: markup.x + markup.width, maxY: markup.y + markup.height };
    case 'arrow':
    case 'measurement-callout':
      return {
        minX: Math.min(markup.from.x, markup.to.x),
        minY: Math.min(markup.from.y, markup.to.y),
        maxX: Math.max(markup.from.x, markup.to.x),
        maxY: Math.max(markup.from.y, markup.to.y),
      };
    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}

// ── Serialisation ─────────────────────────────────────────────────────────────

/**
 * Serialise a markup layer to JSON.
 */
export function serialiseMarkupLayer(layer: MarkupLayer): string {
  return JSON.stringify(layer);
}

/**
 * Deserialise a markup layer from JSON.
 */
export function deserialiseMarkupLayer(json: string): MarkupLayer {
  return JSON.parse(json) as MarkupLayer;
}

// ── Cloud bump path ──────────────────────────────────────────────────────────

/**
 * Generate the SVG path data for a revision cloud outline.
 * Each segment between consecutive points gets n arcs.
 *
 * @param points  Corner points of the cloud outline
 * @param radius  Arc radius
 */
export function buildCloudPath(points: Point2D[], radius: number): string {
  if (points.length < 2) return '';
  const closed = [...points, points[0]!];
  let path = `M ${closed[0]!.x} ${closed[0]!.y}`;
  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i]!;
    const b = closed[i + 1]!;
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const numArcs = Math.max(1, Math.round(len / (radius * 2)));
    for (let k = 0; k < numArcs; k++) {
      const t1 = (k + 1) / numArcs;
      const mx = a.x + (b.x - a.x) * t1;
      const my = a.y + (b.y - a.y) * t1;
      path += ` A ${radius} ${radius} 0 0 1 ${mx} ${my}`;
    }
  }
  path += ' Z';
  return path;
}
