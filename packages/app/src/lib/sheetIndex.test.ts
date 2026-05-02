/**
 * T-VIEW-08: Unit tests for sheetIndex — auto-numbered sheet browser.
 */
import { describe, it, expect } from 'vitest';
import {
  createSheet,
  autoNumberSheets,
  groupSheetsByDiscipline,
  buildSheetIndexRows,
  type Sheet,
} from './sheetIndex';

describe('T-VIEW-08: sheetIndex', () => {
  it('createSheet generates a sheet with defaults', () => {
    const sheet = createSheet({ title: 'Floor Plan', discipline: 'A' });
    expect(sheet.title).toBe('Floor Plan');
    expect(sheet.discipline).toBe('A');
    expect(sheet.id).toBeTruthy();
  });

  it('autoNumberSheets assigns sequential numbers per discipline', () => {
    const sheets: Sheet[] = [
      createSheet({ title: 'Floor Plan',   discipline: 'A' }),
      createSheet({ title: 'Foundation',   discipline: 'S' }),
      createSheet({ title: 'Elevations',   discipline: 'A' }),
      createSheet({ title: 'Details',      discipline: 'S' }),
    ];
    const numbered = autoNumberSheets(sheets);
    const aSheets = numbered.filter((s) => s.discipline === 'A');
    const sSheets = numbered.filter((s) => s.discipline === 'S');
    expect(aSheets[0]?.sheetNumber).toBe('A-101');
    expect(aSheets[1]?.sheetNumber).toBe('A-102');
    expect(sSheets[0]?.sheetNumber).toBe('S-101');
    expect(sSheets[1]?.sheetNumber).toBe('S-102');
  });

  it('autoNumberSheets handles empty array', () => {
    expect(autoNumberSheets([])).toHaveLength(0);
  });

  it('groupSheetsByDiscipline groups correctly', () => {
    const sheets: Sheet[] = [
      createSheet({ title: 'Floor Plan', discipline: 'A' }),
      createSheet({ title: 'Foundation', discipline: 'S' }),
      createSheet({ title: 'Elevations', discipline: 'A' }),
    ];
    const groups = groupSheetsByDiscipline(sheets);
    expect(groups.get('A')).toHaveLength(2);
    expect(groups.get('S')).toHaveLength(1);
  });

  it('groupSheetsByDiscipline returns empty map for empty array', () => {
    const groups = groupSheetsByDiscipline([]);
    expect(groups.size).toBe(0);
  });

  it('buildSheetIndexRows returns one row per sheet with all required fields', () => {
    const sheets: Sheet[] = [
      createSheet({ title: 'Site Plan', discipline: 'C' }),
      createSheet({ title: 'Floor Plan', discipline: 'A' }),
    ];
    const numbered = autoNumberSheets(sheets);
    const rows = buildSheetIndexRows(numbered);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty('sheetNumber');
    expect(rows[0]).toHaveProperty('title');
    expect(rows[0]).toHaveProperty('discipline');
  });

  it('sheet index rows are sorted: sheets without sheetNumber come last', () => {
    const sheets: Sheet[] = [
      createSheet({ title: 'Plan', discipline: 'A' }),
    ];
    const rows = buildSheetIndexRows(autoNumberSheets(sheets));
    expect(rows[0]?.sheetNumber).toBeTruthy();
  });
});
