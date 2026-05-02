/**
 * T-FIELD-03: Unit tests for geolocated field issue cards.
 */
import { describe, it, expect } from 'vitest';
import {
  createFieldIssue,
  filterIssues,
  sortIssues,
  clusterIssues,
  issueStats,
  issueDistance,
  assembleReportEntries,
  type FieldIssue,
} from './fieldIssues';

function makeIssue(
  id: string,
  overrides: Partial<FieldIssue> = {},
): FieldIssue {
  return createFieldIssue({
    id,
    title: `Issue ${id}`,
    position3D: { x: 0, y: 0, z: 0 },
    createdBy: 'user-1',
    ...overrides,
  });
}

describe('T-FIELD-03: createFieldIssue()', () => {
  it('defaults status to open', () => {
    expect(makeIssue('i1').status).toBe('open');
  });

  it('defaults priority to medium', () => {
    expect(makeIssue('i1').priority).toBe('medium');
  });

  it('populates createdAt', () => {
    const before = Date.now();
    const issue = makeIssue('i1');
    expect(issue.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('uses provided id', () => {
    expect(makeIssue('my-id').id).toBe('my-id');
  });

  it('photos defaults to empty array', () => {
    expect(makeIssue('i1').photos).toHaveLength(0);
  });
});

describe('T-FIELD-03: filterIssues()', () => {
  const issues = [
    makeIssue('a', { status: 'open',     priority: 'critical', assignedTo: 'alice' }),
    makeIssue('b', { status: 'resolved', priority: 'low' }),
    makeIssue('c', { status: 'open',     priority: 'high', bcfTopicGuid: 'topic-1' }),
    makeIssue('d', { status: 'open',     priority: 'medium', photos: [{ id: 'p1', dataUri: 'data:x', capturedAt: 0 }] }),
  ];

  it('filter by status', () => {
    expect(filterIssues(issues, { status: ['open'] })).toHaveLength(3);
  });

  it('filter by priority', () => {
    expect(filterIssues(issues, { priority: ['critical'] })).toHaveLength(1);
  });

  it('filter by assignedTo', () => {
    expect(filterIssues(issues, { assignedTo: 'alice' })).toHaveLength(1);
  });

  it('filter hasBcfLink=true', () => {
    expect(filterIssues(issues, { hasBcfLink: true })).toHaveLength(1);
  });

  it('filter hasBcfLink=false', () => {
    expect(filterIssues(issues, { hasBcfLink: false })).toHaveLength(3);
  });

  it('filter hasPhoto=true', () => {
    expect(filterIssues(issues, { hasPhoto: true })).toHaveLength(1);
  });

  it('combined filter: open + critical', () => {
    expect(filterIssues(issues, { status: ['open'], priority: ['critical'] })).toHaveLength(1);
  });

  it('no filter returns all', () => {
    expect(filterIssues(issues, {})).toHaveLength(4);
  });

  it('filter by tags', () => {
    const tagged = makeIssue('e', { tags: ['safety', 'structural'] });
    expect(filterIssues([...issues, tagged], { tags: ['safety'] })).toHaveLength(1);
  });
});

describe('T-FIELD-03: sortIssues()', () => {
  const issues = [
    makeIssue('a', { priority: 'low',      createdAt: 1000 }),
    makeIssue('b', { priority: 'critical', createdAt: 3000 }),
    makeIssue('c', { priority: 'high',     createdAt: 2000 }),
  ];

  it('sort by priority ascending (critical first)', () => {
    const sorted = sortIssues(issues, 'priority');
    expect(sorted[0]!.priority).toBe('critical');
    expect(sorted[2]!.priority).toBe('low');
  });

  it('sort by createdAt ascending (oldest first)', () => {
    const sorted = sortIssues(issues, 'createdAt');
    expect(sorted[0]!.createdAt).toBe(1000);
  });

  it('sort descending reverses order', () => {
    const sorted = sortIssues(issues, 'createdAt', true);
    expect(sorted[0]!.createdAt).toBe(3000);
  });

  it('sort by title alphabetically', () => {
    const withTitles = [
      makeIssue('x', { title: 'Zebra' }),
      makeIssue('y', { title: 'Apple' }),
      makeIssue('z', { title: 'Mango' }),
    ];
    const sorted = sortIssues(withTitles, 'title');
    expect(sorted[0]!.title).toBe('Apple');
    expect(sorted[2]!.title).toBe('Zebra');
  });
});

describe('T-FIELD-03: clusterIssues()', () => {
  it('no issues = no clusters', () => {
    expect(clusterIssues([], 1000)).toHaveLength(0);
  });

  it('all issues far apart = one cluster each', () => {
    const issues = [
      makeIssue('a', { position3D: { x: 0,     y: 0, z: 0 } }),
      makeIssue('b', { position3D: { x: 10000, y: 0, z: 0 } }),
      makeIssue('c', { position3D: { x: 20000, y: 0, z: 0 } }),
    ];
    expect(clusterIssues(issues, 100)).toHaveLength(3);
  });

  it('nearby issues merge into one cluster', () => {
    const issues = [
      makeIssue('a', { position3D: { x: 0,  y: 0, z: 0 } }),
      makeIssue('b', { position3D: { x: 50, y: 0, z: 0 } }),
      makeIssue('c', { position3D: { x: 90, y: 0, z: 0 } }),
    ];
    const clusters = clusterIssues(issues, 1000);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(3);
  });

  it('cluster centroid is avg of member positions', () => {
    const issues = [
      makeIssue('a', { position3D: { x: 0,   y: 0, z: 0 } }),
      makeIssue('b', { position3D: { x: 100, y: 0, z: 0 } }),
    ];
    const clusters = clusterIssues(issues, 1000);
    expect(clusters[0]!.centroid.x).toBeCloseTo(50);
  });
});

describe('T-FIELD-03: issueDistance()', () => {
  it('same position = 0', () => {
    const a = makeIssue('a');
    expect(issueDistance(a, a)).toBeCloseTo(0);
  });

  it('3D distance is correct', () => {
    const a = makeIssue('a', { position3D: { x: 0, y: 0, z: 0 } });
    const b = makeIssue('b', { position3D: { x: 3000, y: 4000, z: 0 } });
    expect(issueDistance(a, b)).toBeCloseTo(5000);
  });
});

describe('T-FIELD-03: issueStats()', () => {
  const issues = [
    makeIssue('a', { status: 'open',        priority: 'critical' }),
    makeIssue('b', { status: 'in-progress', priority: 'high' }),
    makeIssue('c', { status: 'resolved',    priority: 'low', bcfTopicGuid: 'topic-1' }),
    makeIssue('d', { status: 'open',        photos: [{ id: 'p1', dataUri: 'x', capturedAt: 0 }] }),
  ];

  it('counts total correctly', () => {
    expect(issueStats(issues).total).toBe(4);
  });

  it('counts open correctly', () => {
    expect(issueStats(issues).open).toBe(2);
  });

  it('counts in-progress correctly', () => {
    expect(issueStats(issues).inProgress).toBe(1);
  });

  it('counts critical correctly', () => {
    expect(issueStats(issues).critical).toBe(1);
  });

  it('counts withPhotos correctly', () => {
    expect(issueStats(issues).withPhotos).toBe(1);
  });

  it('counts withBcf correctly', () => {
    expect(issueStats(issues).withBcf).toBe(1);
  });
});

describe('T-FIELD-03: assembleReportEntries()', () => {
  it('returns one entry per issue', () => {
    const issues = [makeIssue('a'), makeIssue('b'), makeIssue('c')];
    expect(assembleReportEntries(issues)).toHaveLength(3);
  });

  it('issue numbers are 1-based sequential', () => {
    const issues = [makeIssue('a'), makeIssue('b')];
    const entries = assembleReportEntries(issues);
    expect(entries[0]!.issueNumber).toBe(1);
    expect(entries[1]!.issueNumber).toBe(2);
  });

  it('includes gpsLabel when GPS present', () => {
    const issue = makeIssue('a', {
      gps: { latitude: 51.5074, longitude: -0.1278 },
    });
    const entries = assembleReportEntries([issue]);
    expect(entries[0]!.gpsLabel).toContain('51.507400');
  });

  it('gpsLabel is undefined when no GPS', () => {
    const entries = assembleReportEntries([makeIssue('a')]);
    expect(entries[0]!.gpsLabel).toBeUndefined();
  });

  it('createdAt is ISO date string', () => {
    const entries = assembleReportEntries([makeIssue('a')]);
    expect(entries[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
