/**
 * T-VIEW-05: Unit tests for keynote system — model and user keynotes.
 */
import { describe, it, expect } from 'vitest';
import {
  createKeynoteTable,
  addKeynote,
  resolveKeynoteLabel,
  filterKeynotesByType,
  type KeynoteTable,
  type Keynote,
} from './keynote';

describe('T-VIEW-05: keynote', () => {
  it('createKeynoteTable returns empty table', () => {
    const table = createKeynoteTable();
    expect(table.entries).toHaveLength(0);
  });

  it('addKeynote adds an entry and returns the id', () => {
    const table = createKeynoteTable();
    const id = addKeynote(table, { type: 'model', code: 'M-01', text: 'Concrete wall' });
    expect(table.entries).toHaveLength(1);
    expect(id).toBeTruthy();
  });

  it('addKeynote assigns sequential keynote numbers', () => {
    const table = createKeynoteTable();
    addKeynote(table, { type: 'model', code: 'M-01', text: 'First' });
    addKeynote(table, { type: 'model', code: 'M-02', text: 'Second' });
    const nums = table.entries.map((e) => e.number);
    expect(nums[0]).toBe(1);
    expect(nums[1]).toBe(2);
  });

  it('resolveKeynoteLabel returns number + text for model keynote', () => {
    const table = createKeynoteTable();
    const id = addKeynote(table, { type: 'model', code: 'M-01', text: 'Brick veneer' });
    const label = resolveKeynoteLabel(table, id);
    expect(label).toContain('1');
    expect(label).toContain('Brick veneer');
  });

  it('resolveKeynoteLabel returns empty string for unknown id', () => {
    const table = createKeynoteTable();
    expect(resolveKeynoteLabel(table, 'nonexistent')).toBe('');
  });

  it('filterKeynotesByType returns only model keynotes', () => {
    const table = createKeynoteTable();
    addKeynote(table, { type: 'model', code: 'M-01', text: 'Model note' });
    addKeynote(table, { type: 'user',  code: 'U-01', text: 'User note'  });
    const model = filterKeynotesByType(table, 'model');
    expect(model).toHaveLength(1);
    expect(model[0]?.text).toBe('Model note');
  });

  it('filterKeynotesByType returns only user keynotes', () => {
    const table = createKeynoteTable();
    addKeynote(table, { type: 'model', code: 'M-01', text: 'Model note' });
    addKeynote(table, { type: 'user',  code: 'U-01', text: 'User note'  });
    const user = filterKeynotesByType(table, 'user');
    expect(user).toHaveLength(1);
    expect(user[0]?.text).toBe('User note');
  });

  it('keynote entry stores code, text, type', () => {
    const table = createKeynoteTable();
    addKeynote(table, { type: 'user', code: 'U-05', text: 'See spec section 3' });
    const entry = table.entries[0]!;
    expect(entry.code).toBe('U-05');
    expect(entry.text).toBe('See spec section 3');
    expect(entry.type).toBe('user');
  });

  it('addKeynote continues incrementing numbers across types', () => {
    const table = createKeynoteTable();
    addKeynote(table, { type: 'model', code: 'M-01', text: 'First' });
    addKeynote(table, { type: 'user',  code: 'U-01', text: 'Second' });
    addKeynote(table, { type: 'model', code: 'M-02', text: 'Third' });
    const nums = table.entries.map((e) => e.number);
    expect(nums).toEqual([1, 2, 3]);
  });
});
