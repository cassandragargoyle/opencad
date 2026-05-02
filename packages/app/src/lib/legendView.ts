/**
 * T-VIEW-10: Legend view — a standalone 2D view holding symbol + hatch + line-style
 * legend components. Placeable on a sheet.
 */
import type { ViewSchema } from '@opencad/document';

export type LegendEntryType = 'hatch' | 'symbol' | 'line-style' | 'keynote';

export interface LegendEntry {
  id: string;
  type: LegendEntryType;
  label: string;
  description: string;
  /** Optional colour/hatch code for hatch entries. */
  hatchCode?: string;
}

export interface LegendView extends ViewSchema {
  type: 'legend';
  entries: LegendEntry[];
}

export function createLegendView(name: string): LegendView {
  const id = `legend_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  return {
    id,
    name,
    type: 'legend',
    camera: {
      position: { x: 0, y: 0, z: 0 },
      target:   { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fov: 50, near: 1, far: 10_000,
    },
    entries: [],
  };
}

export function addLegendEntry(
  view: LegendView,
  params: { type: LegendEntryType; label: string; description: string; hatchCode?: string },
): void {
  const id = `le_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  view.entries.push({ id, ...params });
}
