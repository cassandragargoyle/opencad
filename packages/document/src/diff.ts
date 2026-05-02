/**
 * Document Diff
 *
 * Computes element-level differences between two DocumentSchema snapshots.
 * Used by VersionHistoryPanel to show what changed between versions.
 */

import type { DocumentSchema } from './types';

export interface ElementChange {
  elementId: string;
  type: 'added' | 'removed' | 'modified';
  elementType: string;
  changedProperties?: string[];
}

export interface DocumentDiff {
  versionA: number;
  versionB: number;
  added: number;
  removed: number;
  modified: number;
  changes: ElementChange[];
}

/**
 * Diff two document schemas, returning a summary of element-level changes.
 *
 * @param docA - The "before" document (older version)
 * @param docB - The "after" document (newer version)
 * @param versionA - Version number to label docA (default 0)
 * @param versionB - Version number to label docB (default 1)
 */
export function diffDocuments(
  docA: DocumentSchema,
  docB: DocumentSchema,
  versionA = 0,
  versionB = 1
): DocumentDiff {
  const changes: ElementChange[] = [];
  const idsA = new Set(Object.keys(docA.content.elements));
  const idsB = new Set(Object.keys(docB.content.elements));

  // Elements present in B but not A → added
  for (const id of idsB) {
    if (!idsA.has(id)) {
      changes.push({
        elementId: id,
        type: 'added',
        elementType: docB.content.elements[id].type,
      });
    } else {
      // Present in both → check for property changes only
      const elA = docA.content.elements[id];
      const elB = docB.content.elements[id];
      const propsA = elA.properties ?? {};
      const propsB = elB.properties ?? {};
      const allPropKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
      const changedProps = [...allPropKeys].filter(
        (k) => JSON.stringify(propsB[k]) !== JSON.stringify(propsA[k])
      );
      if (changedProps.length > 0) {
        changes.push({
          elementId: id,
          type: 'modified',
          elementType: elB.type,
          changedProperties: changedProps,
        });
      }
    }
  }

  // Elements present in A but not B → removed
  for (const id of idsA) {
    if (!idsB.has(id)) {
      changes.push({
        elementId: id,
        type: 'removed',
        elementType: docA.content.elements[id].type,
      });
    }
  }

  return {
    versionA,
    versionB,
    added: changes.filter((c) => c.type === 'added').length,
    removed: changes.filter((c) => c.type === 'removed').length,
    modified: changes.filter((c) => c.type === 'modified').length,
    changes,
  };
}

// ── T-COL-01: Branch diff ─────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface PropertyDiff {
  key: string;
  before: unknown;
  after: unknown;
}

export interface ElementDiff {
  elementId: string;
  elementType: string;
  status: DiffStatus;
  propertyDiffs: PropertyDiff[];
}

export interface BranchDiff {
  added:     ElementDiff[];
  removed:   ElementDiff[];
  modified:  ElementDiff[];
  unchanged: ElementDiff[];
  totalCount: number;
}

/**
 * Diff two document branches.
 * Elements are keyed by id; returns added/removed/modified/unchanged
 * with per-property before/after for modified elements.
 */
export function diffBranches(
  snapshotA: DocumentSchema,
  snapshotB: DocumentSchema,
  options: { includeUnchanged?: boolean } = {},
): BranchDiff {
  const elA = snapshotA.content.elements;
  const elB = snapshotB.content.elements;
  const allIds = new Set([...Object.keys(elA), ...Object.keys(elB)]);

  const added:     ElementDiff[] = [];
  const removed:   ElementDiff[] = [];
  const modified:  ElementDiff[] = [];
  const unchanged: ElementDiff[] = [];

  for (const id of allIds) {
    const a = elA[id];
    const b = elB[id];

    if (!a && b) {
      added.push({ elementId: id, elementType: b.type, status: 'added', propertyDiffs: [] });
    } else if (a && !b) {
      removed.push({ elementId: id, elementType: a.type, status: 'removed', propertyDiffs: [] });
    } else if (a && b) {
      const propDiffs = _diffProperties(a.properties ?? {}, b.properties ?? {});
      if (propDiffs.length > 0 || a.type !== b.type || a.levelId !== b.levelId || a.layerId !== b.layerId) {
        modified.push({ elementId: id, elementType: b.type, status: 'modified', propertyDiffs: propDiffs });
      } else if (options.includeUnchanged) {
        unchanged.push({ elementId: id, elementType: a.type, status: 'unchanged', propertyDiffs: [] });
      }
    }
  }

  const sortById = (arr: ElementDiff[]) => arr.sort((x, y) => x.elementId.localeCompare(y.elementId));
  sortById(added); sortById(removed); sortById(modified); sortById(unchanged);

  return {
    added, removed, modified, unchanged,
    totalCount: added.length + removed.length + modified.length + unchanged.length,
  };
}

function _diffProperties(
  propsA: Record<string, { type: string; value: unknown }>,
  propsB: Record<string, { type: string; value: unknown }>,
): PropertyDiff[] {
  const diffs: PropertyDiff[] = [];
  const allKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
  for (const key of allKeys) {
    const va = propsA[key];
    const vb = propsB[key];
    const sa = va ? JSON.stringify(va.value) : undefined;
    const sb = vb ? JSON.stringify(vb.value) : undefined;
    if (sa !== sb) diffs.push({ key, before: va?.value, after: vb?.value });
  }
  return diffs.sort((x, y) => x.key.localeCompare(y.key));
}

/** Diff highlight colours per status (matches T-COL-01 spec). */
export const DIFF_COLORS: Record<DiffStatus, string> = {
  added:     '#22c55e',
  removed:   '#ef4444',
  modified:  '#f59e0b',
  unchanged: 'transparent',
};

export const UNCHANGED_OPACITY = 0.3;
