/**
 * T-FIELD-V2-02: Bluebeam sync tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseBluebeamXML,
  mergeMarkups,
  exportToBluebeamXML,
  filterMarkupsByType,
  type BluebeamMarkup,
} from './bluebeamSync';

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Markups>
  <Markup id="m-1" type="highlight" pageId="page-1" x="10" y="20" width="100" height="50" text="Review this section" author="Alice" createdAt="1700000000" />
  <Markup id="m-2" type="note" pageId="page-1" x="200" y="300" width="0" height="0" text="Check dimensions" author="Bob" createdAt="1700000100" />
  <Markup id="m-3" type="measurement" pageId="page-2" x="50" y="60" width="200" height="10" text="Wall length 5m" author="Alice" createdAt="1700000200" />
  <Markup id="m-4" type="stamp" pageId="page-2" x="0" y="0" width="150" height="80" text="APPROVED" author="Carol" createdAt="1700000300" />
</Markups>`;

describe('parseBluebeamXML', () => {
  it('parses all markups', () => {
    const markups = parseBluebeamXML(sampleXml);
    expect(markups).toHaveLength(4);
  });

  it('parses markup fields correctly', () => {
    const markups = parseBluebeamXML(sampleXml);
    const m1 = markups.find((m) => m.id === 'm-1')!;
    expect(m1.type).toBe('highlight');
    expect(m1.pageId).toBe('page-1');
    expect(m1.coords.x).toBe(10);
    expect(m1.coords.y).toBe(20);
    expect(m1.coords.width).toBe(100);
    expect(m1.coords.height).toBe(50);
    expect(m1.text).toBe('Review this section');
    expect(m1.author).toBe('Alice');
    expect(m1.createdAt).toBe(1700000000);
  });

  it('parses note type', () => {
    const markups = parseBluebeamXML(sampleXml);
    expect(markups.find((m) => m.id === 'm-2')?.type).toBe('note');
  });

  it('parses measurement type', () => {
    const markups = parseBluebeamXML(sampleXml);
    expect(markups.find((m) => m.id === 'm-3')?.type).toBe('measurement');
  });

  it('parses stamp type', () => {
    const markups = parseBluebeamXML(sampleXml);
    expect(markups.find((m) => m.id === 'm-4')?.type).toBe('stamp');
  });

  it('returns empty array for empty XML', () => {
    expect(parseBluebeamXML('<Markups></Markups>')).toHaveLength(0);
    expect(parseBluebeamXML('')).toHaveLength(0);
  });

  it('skips markup tags missing id', () => {
    const xml = `<Markups><Markup type="note" pageId="p1" x="0" y="0" width="0" height="0" text="" author="" createdAt="0" /></Markups>`;
    expect(parseBluebeamXML(xml)).toHaveLength(0);
  });
});

describe('mergeMarkups', () => {
  const local: BluebeamMarkup[] = [
    { id: 'm-1', type: 'highlight', pageId: 'p1', coords: { x: 0, y: 0, width: 10, height: 10 }, text: 'old', author: 'A', createdAt: 100 },
    { id: 'm-2', type: 'note', pageId: 'p1', coords: { x: 5, y: 5, width: 0, height: 0 }, text: 'local only', author: 'B', createdAt: 200 },
  ];
  const remote: BluebeamMarkup[] = [
    { id: 'm-1', type: 'highlight', pageId: 'p1', coords: { x: 0, y: 0, width: 10, height: 10 }, text: 'new', author: 'A', createdAt: 300 },
    { id: 'm-3', type: 'stamp', pageId: 'p2', coords: { x: 0, y: 0, width: 50, height: 30 }, text: 'APPROVED', author: 'C', createdAt: 400 },
  ];

  it('returns all unique ids', () => {
    const merged = mergeMarkups(local, remote);
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(['m-1', 'm-2', 'm-3']);
  });

  it('prefers remote when remote has higher createdAt', () => {
    const merged = mergeMarkups(local, remote);
    const m1 = merged.find((m) => m.id === 'm-1')!;
    expect(m1.text).toBe('new');
    expect(m1.createdAt).toBe(300);
  });

  it('keeps local when local has higher createdAt', () => {
    const localNewer: BluebeamMarkup[] = [
      { id: 'm-1', type: 'highlight', pageId: 'p1', coords: { x: 0, y: 0, width: 10, height: 10 }, text: 'local newer', author: 'A', createdAt: 500 },
    ];
    const merged = mergeMarkups(localNewer, remote);
    expect(merged.find((m) => m.id === 'm-1')?.text).toBe('local newer');
  });

  it('merges when one list is empty', () => {
    expect(mergeMarkups([], remote)).toHaveLength(2);
    expect(mergeMarkups(local, [])).toHaveLength(2);
  });
});

describe('exportToBluebeamXML', () => {
  it('produces valid XML wrapper', () => {
    const xml = exportToBluebeamXML([]);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<Markups>');
    expect(xml).toContain('</Markups>');
  });

  it('includes markup entries', () => {
    const markups: BluebeamMarkup[] = [
      { id: 'test-1', type: 'note', pageId: 'p1', coords: { x: 1, y: 2, width: 3, height: 4 }, text: 'Hello', author: 'Dev', createdAt: 12345 },
    ];
    const xml = exportToBluebeamXML(markups);
    expect(xml).toContain('id="test-1"');
    expect(xml).toContain('type="note"');
    expect(xml).toContain('text="Hello"');
    expect(xml).toContain('author="Dev"');
  });

  it('escapes XML special chars', () => {
    const markups: BluebeamMarkup[] = [
      { id: 'x&1', type: 'note', pageId: 'p', coords: { x: 0, y: 0, width: 0, height: 0 }, text: '<test> "quoted" & \'apos\'', author: 'A', createdAt: 0 },
    ];
    const xml = exportToBluebeamXML(markups);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });

  it('round-trips through parse', () => {
    const markups = parseBluebeamXML(sampleXml);
    const xml = exportToBluebeamXML(markups);
    const reparsed = parseBluebeamXML(xml);
    expect(reparsed).toHaveLength(markups.length);
    expect(reparsed.map((m) => m.id).sort()).toEqual(markups.map((m) => m.id).sort());
  });
});

describe('filterMarkupsByType', () => {
  const markups = parseBluebeamXML(sampleXml);

  it('filters highlights', () => {
    const highlights = filterMarkupsByType(markups, 'highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe('m-1');
  });

  it('filters notes', () => {
    const notes = filterMarkupsByType(markups, 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('m-2');
  });

  it('filters measurements', () => {
    const meas = filterMarkupsByType(markups, 'measurement');
    expect(meas).toHaveLength(1);
  });

  it('filters stamps', () => {
    const stamps = filterMarkupsByType(markups, 'stamp');
    expect(stamps).toHaveLength(1);
    expect(stamps[0].text).toBe('APPROVED');
  });

  it('returns empty for type with no matches', () => {
    expect(filterMarkupsByType([], 'highlight')).toHaveLength(0);
  });
});
