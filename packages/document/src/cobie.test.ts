/**
 * T-IO-03: Unit tests for COBie 2.4 export.
 */
import { describe, it, expect } from 'vitest';
import { exportCOBie, cobieToCSVMap } from './cobie';
import { createProject } from './document';

function makeDoc() {
  return createProject('proj-1', 'user-1');
}

describe('T-IO-03: COBie 2.4 export', () => {
  it('returns an array of sheets', () => {
    const sheets = exportCOBie(makeDoc());
    expect(Array.isArray(sheets)).toBe(true);
    expect(sheets.length).toBeGreaterThan(0);
  });

  it('includes required COBie sheet names', () => {
    const sheets = exportCOBie(makeDoc());
    const names = sheets.map((s) => s.name);
    expect(names).toContain('Facility');
    expect(names).toContain('Floor');
    expect(names).toContain('Space');
    expect(names).toContain('Component');
    expect(names).toContain('Type');
    expect(names).toContain('Attribute');
  });

  it('Facility sheet contains project name', () => {
    const doc = makeDoc();
    doc.name = 'My Facility';
    const sheets = exportCOBie(doc);
    const facility = sheets.find((s) => s.name === 'Facility')!;
    expect(facility.rows[1][0]).toBe('My Facility');
  });

  it('Floor sheet has one row per level', () => {
    const doc = makeDoc();
    const levelCount = Object.keys(doc.organization.levels).length;
    const sheets = exportCOBie(doc);
    const floor = sheets.find((s) => s.name === 'Floor')!;
    expect(floor.rows.length - 1).toBe(levelCount); // minus header
  });

  it('each sheet has a header row', () => {
    const sheets = exportCOBie(makeDoc());
    for (const sheet of sheets) {
      expect(sheet.rows.length).toBeGreaterThanOrEqual(1);
      expect(sheet.rows[0]).toContain('Name');
      expect(sheet.rows[0]).toContain('CreatedBy');
      expect(sheet.rows[0]).toContain('CreatedOn');
    }
  });

  it('Space sheet lists space elements', () => {
    const doc = makeDoc();
    doc.content.elements['sp1'] = {
      id: 'sp1',
      type: 'space',
      properties: { Name: { type: 'string', value: 'Lobby' }, Area: { type: 'number', value: 80 } },
      propertySets: [],
      geometry: { type: 'point', data: null },
      layerId: 'l0',
      levelId: 'lv0',
      transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      boundingBox: { min: { x: 0, y: 0, z: 0, _type: 'Point3D' }, max: { x: 1, y: 1, z: 1, _type: 'Point3D' } },
      metadata: { id: 'sp1', createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
      visible: true,
      locked: false,
    };
    const sheets = exportCOBie(doc);
    const space = sheets.find((s) => s.name === 'Space')!;
    expect(space.rows.some((r) => r[0] === 'Lobby')).toBe(true);
  });

  it('createdBy option is applied', () => {
    const sheets = exportCOBie(makeDoc(), { createdBy: 'Tester' });
    const facility = sheets.find((s) => s.name === 'Facility')!;
    expect(facility.rows[1][1]).toBe('Tester');
  });

  it('cobieToCSVMap produces a string per sheet', () => {
    const sheets = exportCOBie(makeDoc());
    const map = cobieToCSVMap(sheets);
    expect(typeof map['Facility']).toBe('string');
    expect(typeof map['Floor']).toBe('string');
    expect(map['Facility'].length).toBeGreaterThan(0);
  });

  it('CSV escapes commas in values', () => {
    const doc = makeDoc();
    doc.name = 'A, Building';
    const sheets = exportCOBie(doc);
    const map = cobieToCSVMap(sheets);
    expect(map['Facility']).toContain('"A, Building"');
  });
});
