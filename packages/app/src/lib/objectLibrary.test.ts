/**
 * T-LIB-V2-01: Object library tests
 */
import { describe, it, expect } from 'vitest';
import {
  SEED_LIBRARY,
  searchLibrary,
  filterByTags,
  groupByCategory,
  type ObjectCategory,
} from './objectLibrary';

describe('SEED_LIBRARY', () => {
  it('has at least 10 objects', () => {
    expect(SEED_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it('covers multiple categories', () => {
    const categories = new Set(SEED_LIBRARY.map((o) => o.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('all objects have required fields', () => {
    for (const obj of SEED_LIBRARY) {
      expect(typeof obj.id).toBe('string');
      expect(typeof obj.name).toBe('string');
      expect(typeof obj.category).toBe('string');
      expect(Array.isArray(obj.tags)).toBe(true);
      expect(typeof obj.properties).toBe('object');
    }
  });

  it('has unique ids', () => {
    const ids = SEED_LIBRARY.map((o) => o.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('contains objects in all 7 categories', () => {
    const categories = new Set(SEED_LIBRARY.map((o) => o.category));
    const expected: ObjectCategory[] = ['doors', 'windows', 'fixtures', 'furniture', 'equipment', 'lighting', 'landscape'];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});

describe('searchLibrary', () => {
  it('returns all objects when query is empty', () => {
    expect(searchLibrary('')).toHaveLength(SEED_LIBRARY.length);
  });

  it('filters by name match', () => {
    const results = searchLibrary('door');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      const matches = r.name.toLowerCase().includes('door') ||
        r.tags.some((t) => t.toLowerCase().includes('door'));
      expect(matches).toBe(true);
    });
  });

  it('filters by tag match', () => {
    const results = searchLibrary('toilet');
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by category', () => {
    const doors = searchLibrary('', 'doors');
    expect(doors.length).toBeGreaterThan(0);
    doors.forEach((d) => expect(d.category).toBe('doors'));
  });

  it('filters by both query and category', () => {
    const results = searchLibrary('window', 'windows');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.category).toBe('windows'));
  });

  it('returns empty for unmatched query', () => {
    expect(searchLibrary('xyznotfound123')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const lower = searchLibrary('door');
    const upper = searchLibrary('DOOR');
    expect(upper.length).toBe(lower.length);
  });
});

describe('filterByTags', () => {
  it('returns all objects when tags is empty', () => {
    expect(filterByTags(SEED_LIBRARY, [])).toHaveLength(SEED_LIBRARY.length);
  });

  it('filters objects that have all specified tags', () => {
    const result = filterByTags(SEED_LIBRARY, ['door']);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((obj) => {
      expect(obj.tags.some((t) => t.toLowerCase() === 'door')).toBe(true);
    });
  });

  it('filters by multiple tags (AND logic)', () => {
    const result = filterByTags(SEED_LIBRARY, ['door', 'interior']);
    result.forEach((obj) => {
      expect(obj.tags.some((t) => t.toLowerCase() === 'door')).toBe(true);
      expect(obj.tags.some((t) => t.toLowerCase() === 'interior')).toBe(true);
    });
  });

  it('returns empty when no objects match all tags', () => {
    const result = filterByTags(SEED_LIBRARY, ['door', 'nonexistent-tag-xyz']);
    expect(result).toHaveLength(0);
  });
});

describe('groupByCategory', () => {
  it('groups all objects by category', () => {
    const grouped = groupByCategory(SEED_LIBRARY);
    const allObjects = Object.values(grouped).flat();
    expect(allObjects).toHaveLength(SEED_LIBRARY.length);
  });

  it('returns all 7 category keys', () => {
    const grouped = groupByCategory(SEED_LIBRARY);
    const keys: ObjectCategory[] = ['doors', 'windows', 'fixtures', 'furniture', 'equipment', 'lighting', 'landscape'];
    keys.forEach((k) => expect(grouped).toHaveProperty(k));
  });

  it('places objects in correct category', () => {
    const grouped = groupByCategory(SEED_LIBRARY);
    grouped.doors.forEach((obj) => expect(obj.category).toBe('doors'));
    grouped.windows.forEach((obj) => expect(obj.category).toBe('windows'));
  });

  it('works with empty array', () => {
    const grouped = groupByCategory([]);
    const allObjects = Object.values(grouped).flat();
    expect(allObjects).toHaveLength(0);
  });
});
