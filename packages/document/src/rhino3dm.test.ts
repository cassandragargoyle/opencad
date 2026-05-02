/**
 * T-IO-04: Unit tests for Rhino 3DM import/export adapter.
 * Tests run without the actual rhino3dm WASM module — the adapter
 * degrades gracefully when no module is provided.
 */
import { describe, it, expect } from 'vitest';
import { importRhino3dm, exportRhino3dm } from './rhino3dm';
import { createProject } from './document';

function makeDoc() {
  return createProject('proj-1', 'user-1');
}

describe('T-IO-04: Rhino 3DM adapter', () => {
  describe('importRhino3dm without module', () => {
    it('returns zero elements and a warning', () => {
      const result = importRhino3dm(new Uint8Array());
      expect(result.objectCount).toBe(0);
      expect(result.elements).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('result has elements and warnings arrays', () => {
      const result = importRhino3dm(new Uint8Array());
      expect(Array.isArray(result.elements)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('exportRhino3dm without module', () => {
    it('returns null bytes and a warning', () => {
      const result = exportRhino3dm(makeDoc());
      expect(result.bytes).toBeNull();
      expect(result.objectCount).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('exportRhino3dm with mock module', () => {
    function makeMockRhino() {
      const faces: number[][] = [];
      const verts: number[][] = [];

      const mockMesh = {
        objectType: 32,
        vertices: () => ({
          count: 0,
          add(x: number, y: number, z: number) { verts.push([x, y, z]); },
        }),
        faces: () => ({
          addFace(a: number, b: number, c: number) { faces.push([a, b, c]); },
        }),
        normals: () => ({ computeNormals() {} }),
      };

      const addedObjects: unknown[] = [];

      const mockFile = {
        objects() {
          return {
            count: 0,
            get(_i: number) { return null; },
            add(geo: unknown, attr: unknown) { addedObjects.push({ geo, attr }); },
          };
        },
        toByteArray() { return new Uint8Array([0x33, 0x44]); },
        dispose() {},
        _addedObjects: addedObjects,
      };

      return {
        File3dm: class { constructor() { return mockFile; } } as unknown,
        File3dmFromByteArray: (_bytes: Uint8Array) => mockFile,
        Mesh: class { constructor() { return mockMesh; } } as unknown,
        Point3d: (x: number, y: number, z: number) => ({ x, y, z }),
        _mockFile: mockFile,
      } as unknown;
    }

    it('returns a Uint8Array', () => {
      const doc = makeDoc();
      doc.content.elements['wall1'] = {
        id: 'wall1',
        type: 'wall',
        properties: { Name: { type: 'string', value: 'Wall 1' } },
        propertySets: [],
        geometry: { type: 'mesh', data: null },
        layerId: 'l0',
        levelId: 'lv0',
        transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        boundingBox: { min: { x: 0, y: 0, z: 0, _type: 'Point3D' }, max: { x: 5000, y: 200, z: 3000, _type: 'Point3D' } },
        metadata: { id: 'wall1', createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
        visible: true,
        locked: false,
      };
      const rhino = makeMockRhino();
      const result = exportRhino3dm(doc, rhino as never);
      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(result.bytes!.length).toBeGreaterThan(0);
    });

    it('skips elements without bounding box', () => {
      const doc = makeDoc();
      // default doc elements have bounding boxes; add one without
      doc.content.elements['nobb'] = {
        id: 'nobb',
        type: 'wall',
        properties: {},
        propertySets: [],
        geometry: { type: 'mesh', data: null },
        layerId: 'l0',
        levelId: null,
        transform: { translation: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        boundingBox: null as unknown as never,
        metadata: { id: 'nobb', createdBy: 'test', createdAt: 0, updatedAt: 0, version: { clock: {} } },
        visible: true,
        locked: false,
      };
      const rhino = makeMockRhino();
      const result = exportRhino3dm(doc, rhino as never);
      expect(result.warnings.some((w) => w.includes('nobb'))).toBe(true);
    });
  });
});
