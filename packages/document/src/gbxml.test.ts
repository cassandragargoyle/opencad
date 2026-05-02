/**
 * T-IO-02: Unit tests for gbXML 6.01 export.
 */
import { describe, it, expect } from 'vitest';
import { exportGbXML } from './gbxml';
import { createProject } from './document';

function makeDoc() {
  return createProject('proj-1', 'user-1');
}

describe('T-IO-02: gbXML export', () => {
  it('returns a non-empty XML string', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml.length).toBeGreaterThan(0);
  });

  it('includes gbXML root element with version 6.01', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml).toContain('version="6.01"');
  });

  it('includes xmlns gbxml namespace', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml).toContain('http://www.gbxml.org/schema');
  });

  it('includes Campus element', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml).toContain('<Campus');
  });

  it('includes Building element', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml).toContain('<Building');
  });

  it('includes BuildingStorey per level', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml).toContain('<BuildingStorey');
  });

  it('outputs well-formed XML (starts and ends correctly)', () => {
    const xml = exportGbXML(makeDoc());
    expect(xml.trimStart()).toMatch(/^<\?xml/);
    expect(xml.trimEnd()).toMatch(/<\/gbXML>\s*$/);
  });

  it('includes Space elements for space-type elements', () => {
    const doc = makeDoc();
    doc.content.elements['sp1'] = {
      id: 'sp1',
      type: 'space',
      properties: { Name: { type: 'string', value: 'Living Room' }, Area: { type: 'number', value: 25 } },
      propertySets: [],
      geometry: { type: 'point', data: null },
      layerId: 'l0',
      levelId: 'lv0',
      transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      boundingBox: { min: { x: 0, y: 0, z: 0, _type: 'Point3D' }, max: { x: 5000, y: 5000, z: 2700, _type: 'Point3D' } },
      metadata: { id: 'sp1', createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
      visible: true,
      locked: false,
    };
    const xml = exportGbXML(doc);
    expect(xml).toContain('<Space');
  });

  it('accepts metersPerUnit option without throwing', () => {
    expect(() => exportGbXML(makeDoc(), { metersPerUnit: 0.001 })).not.toThrow();
  });

  it('metersPerUnit scales level elevation', () => {
    const doc = makeDoc();
    const levelId = Object.keys(doc.organization.levels)[0];
    if (levelId) doc.organization.levels[levelId].elevation = 3000;
    const xml = exportGbXML(doc, { metersPerUnit: 0.001 });
    expect(xml).toContain('3.000');
  });

  it('document name appears in Building description', () => {
    const doc = makeDoc();
    doc.name = 'My Building';
    const xml = exportGbXML(doc);
    expect(xml).toContain('My Building');
  });
});
