/**
 * T-VIEW-08: Sheet index and auto-numbered sheet browser.
 * Manages sheet collection with auto-numbering and discipline grouping.
 */

export type Discipline = 'A' | 'S' | 'M' | 'E' | 'P' | 'C' | 'L' | 'T' | string;

export interface Sheet {
  id: string;
  title: string;
  /** Discipline code: A=Architectural, S=Structural, M=Mechanical, E=Electrical, etc. */
  discipline: Discipline;
  /** Auto-assigned: A-101, S-101, etc. */
  sheetNumber?: string;
  revision?: string;
  revisionDate?: string;
  author?: string;
  /** Ordered index within its discipline group (0-based). */
  seq?: number;
}

export interface SheetIndexRow {
  sheetNumber: string;
  title: string;
  discipline: string;
  revision: string;
  revisionDate: string;
  author: string;
}

export function createSheet(params: {
  title: string;
  discipline: Discipline;
  revision?: string;
  author?: string;
}): Sheet {
  const id = `sheet_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  return {
    id,
    title: params.title,
    discipline: params.discipline,
    revision: params.revision,
    author: params.author,
  };
}

/**
 * Assign sequential sheet numbers per discipline.
 * Preserves order; A-101, A-102, S-101, S-102, etc.
 */
export function autoNumberSheets(sheets: Sheet[]): Sheet[] {
  const counters = new Map<string, number>();
  return sheets.map((sheet) => {
    const n = (counters.get(sheet.discipline) ?? 100) + 1;
    counters.set(sheet.discipline, n);
    return { ...sheet, sheetNumber: `${sheet.discipline}-${n}` };
  });
}

/**
 * Group sheets by discipline code.
 * Returns a Map preserving insertion order of disciplines.
 */
export function groupSheetsByDiscipline(sheets: Sheet[]): Map<Discipline, Sheet[]> {
  const groups = new Map<Discipline, Sheet[]>();
  for (const sheet of sheets) {
    const group = groups.get(sheet.discipline) ?? [];
    group.push(sheet);
    groups.set(sheet.discipline, group);
  }
  return groups;
}

/** Build flat sheet-index table rows for a cover-sheet listing. */
export function buildSheetIndexRows(sheets: Sheet[]): SheetIndexRow[] {
  return sheets
    .filter((s) => s.sheetNumber)
    .map((s) => ({
      sheetNumber:  s.sheetNumber!,
      title:        s.title,
      discipline:   s.discipline,
      revision:     s.revision ?? '',
      revisionDate: s.revisionDate ?? '',
      author:       s.author ?? '',
    }));
}

export const DISCIPLINE_LABELS: Record<string, string> = {
  A: 'Architectural',
  S: 'Structural',
  M: 'Mechanical',
  E: 'Electrical',
  P: 'Plumbing',
  C: 'Civil',
  L: 'Landscape',
  T: 'Telecom',
};
