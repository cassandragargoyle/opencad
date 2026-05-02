/**
 * T-IO-05: Unit tests for USD / USDZ export.
 */
import { describe, it, expect } from 'vitest';
import { exportUSDA, buildUSDZPayload } from './usd';
import { createProject } from './document';

function makeDoc() {
  return createProject('proj-1', 'user-1');
}

function addWall(doc: ReturnType<typeof makeDoc>) {
  doc.content.elements['w1'] = {
    id: 'w1',
    type: 'wall',
    properties: { Name: { type: 'string', value: 'Wall 1' } },
    propertySets: [],
    geometry: { type: 'mesh', data: null },
    layerId: 'l0',
    levelId: 'lv0',
    transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    boundingBox: { min: { x: 0, y: 0, z: 0, _type: 'Point3D' }, max: { x: 5000, y: 200, z: 3000, _type: 'Point3D' } },
    metadata: { id: 'w1', createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
    visible: true,
    locked: false,
  };
}

describe('T-IO-05: USD / USDZ export', () => {
  it('returns a non-empty USDA string', () => {
    const usda = exportUSDA(makeDoc());
    expect(usda.length).toBeGreaterThan(0);
  });

  it('starts with the USDA magic token', () => {
    const usda = exportUSDA(makeDoc());
    expect(usda.trimStart()).toMatch(/^#usda 1\.0/);
  });

  it('includes metersPerUnit declaration', () => {
    const usda = exportUSDA(makeDoc());
    expect(usda).toContain('metersPerUnit');
  });

  it('includes upAxis declaration', () => {
    const usda = exportUSDA(makeDoc());
    expect(usda).toContain('upAxis = "Y"');
  });

  it('respects upAxis option', () => {
    const usda = exportUSDA(makeDoc(), { upAxis: 'Z' });
    expect(usda).toContain('upAxis = "Z"');
  });

  it('includes a Wall mesh prim for wall elements', () => {
    const doc = makeDoc();
    addWall(doc);
    const usda = exportUSDA(doc);
    expect(usda).toContain('def Mesh "w1"');
  });

  it('embeds elementId as user property', () => {
    const doc = makeDoc();
    addWall(doc);
    const usda = exportUSDA(doc);
    expect(usda).toContain('elementId = "w1"');
  });

  it('includes material bindings by default', () => {
    const doc = makeDoc();
    addWall(doc);
    const usda = exportUSDA(doc);
    expect(usda).toContain('material:binding');
  });

  it('omits material definitions when includeMaterials=false', () => {
    const doc = makeDoc();
    addWall(doc);
    const usda = exportUSDA(doc, { includeMaterials: false });
    expect(usda).not.toContain('def Material');
    expect(usda).not.toContain('material:binding');
  });

  it('includes project name in doc string', () => {
    const doc = makeDoc();
    doc.name = 'Test Tower';
    const usda = exportUSDA(doc);
    expect(usda).toContain('Test Tower');
  });

  it('scales geometry with cmPerUnit option', () => {
    const doc = makeDoc();
    addWall(doc);
    // wall is 5000mm wide; at 0.1 (mm→cm) that's 500cm half-extent 250cm
    const usda = exportUSDA(doc, { cmPerUnit: 0.1 });
    expect(usda).toContain('250.0000');
  });

  describe('buildUSDZPayload', () => {
    it('returns usda, filename, and assets', () => {
      const payload = buildUSDZPayload(makeDoc());
      expect(typeof payload.usda).toBe('string');
      expect(payload.usdaFilename).toMatch(/\.usda$/);
      expect(Array.isArray(payload.assets)).toBe(true);
    });

    it('sanitises project name for filename', () => {
      const doc = makeDoc();
      doc.name = 'My Building (2024)';
      const payload = buildUSDZPayload(doc);
      expect(payload.usdaFilename).not.toContain(' ');
      expect(payload.usdaFilename).not.toContain('(');
    });
  });
});
