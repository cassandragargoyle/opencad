/**
 * T-VIEW-05: Keynote system — model keynotes (material/assembly codes) and
 * user keynotes (spec references). Both types are stored in a KeynoteTable
 * and referenced by id from annotation elements.
 */

export type KeynoteType = 'model' | 'user';

export interface Keynote {
  id: string;
  number: number;
  type: KeynoteType;
  code: string;
  text: string;
}

export interface KeynoteTable {
  entries: Keynote[];
}

export function createKeynoteTable(): KeynoteTable {
  return { entries: [] };
}

let _seq = 1;

export function addKeynote(
  table: KeynoteTable,
  params: { type: KeynoteType; code: string; text: string },
): string {
  const id = `kn_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  const number = table.entries.length + 1;
  _seq++;
  table.entries.push({ id, number, ...params });
  return id;
}

export function resolveKeynoteLabel(table: KeynoteTable, id: string): string {
  const entry = table.entries.find((e) => e.id === id);
  if (!entry) return '';
  return `${entry.number}. ${entry.text}`;
}

export function filterKeynotesByType(
  table: KeynoteTable,
  type: KeynoteType,
): Keynote[] {
  return table.entries.filter((e) => e.type === type);
}
