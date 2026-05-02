/**
 * T-VIEW-06: Callout marker — a cross-reference annotation that links to an
 * existing detail, section, or elevation view. When the referenced view is
 * placed on a sheet, the callout auto-fills sheet and detail numbers.
 */

export interface CalloutMarker {
  id: string;
  /** Position in model space (mm). */
  x: number;
  y: number;
  /** The id of the referenced view (detail / section / elevation). */
  targetViewId: string;
  /** Sheet number — filled in when the target view is placed on a sheet. */
  sheetNumber?: string;
  /** Detail number on the sheet. */
  detailNumber?: string;
}

interface ViewRef {
  id: string;
  name: string;
  type: string;
}

export function createCalloutMarker(
  pos: { x: number; y: number },
  targetViewId: string,
): CalloutMarker {
  const id = `callout_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  return { id, x: pos.x, y: pos.y, targetViewId };
}

export function resolveCalloutLabel(targetViewId: string, views: ViewRef[]): string {
  const view = views.find((v) => v.id === targetViewId);
  if (!view) return '';
  return `${view.type} — ${view.name}`;
}
