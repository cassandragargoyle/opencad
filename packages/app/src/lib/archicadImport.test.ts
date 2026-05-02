/**
 * T-IO-V2-03: ArchiCAD import tests
 */
import { describe, it, expect } from 'vitest';
import {
  parseArchiCADJSON,
  mapArchiCADTypeToOpenCAD,
  ARCHICAD_TYPE_MAP,
} from './archicadImport';

const validProject = {
  elements: [
    {
      id: 'wall-001',
      elementType: 'Wall',
      attributes: { thickness: 200, composite: false, height: 3000 },
      layerId: 'layer-walls',
      floorIndex: 0,
    },
    {
      id: 'door-001',
      elementType: 'Door',
      attributes: { width: 900, height: 2100 },
      layerId: 'layer-doors',
      floorIndex: 0,
    },
  ],
  floors: [
    { index: 0, elevation: 0, name: 'Ground Floor' },
    { index: 1, elevation: 3000, name: 'First Floor' },
  ],
  projectInfo: {
    projectName: 'Test Building',
    architect: 'John Doe',
    version: '26',
  },
};

describe('parseArchiCADJSON', () => {
  it('parses a valid project', () => {
    const project = parseArchiCADJSON(validProject);
    expect(project.elements).toHaveLength(2);
    expect(project.floors).toHaveLength(2);
    expect(project.projectInfo['projectName']).toBe('Test Building');
  });

  it('parses element fields correctly', () => {
    const project = parseArchiCADJSON(validProject);
    const wall = project.elements[0];
    expect(wall.id).toBe('wall-001');
    expect(wall.elementType).toBe('Wall');
    expect(wall.layerId).toBe('layer-walls');
    expect(wall.floorIndex).toBe(0);
    expect(wall.attributes['thickness']).toBe(200);
  });

  it('parses floor data correctly', () => {
    const project = parseArchiCADJSON(validProject);
    expect(project.floors[0]).toEqual({ index: 0, elevation: 0, name: 'Ground Floor' });
    expect(project.floors[1].elevation).toBe(3000);
  });

  it('coerces projectInfo values to strings', () => {
    const project = parseArchiCADJSON({ ...validProject, projectInfo: { count: 5 } });
    expect(project.projectInfo['count']).toBe('5');
  });

  it('throws for non-object input', () => {
    expect(() => parseArchiCADJSON(null)).toThrow();
    expect(() => parseArchiCADJSON('string')).toThrow();
  });

  it('throws when elements is missing', () => {
    const { elements: _e, ...rest } = validProject;
    expect(() => parseArchiCADJSON(rest)).toThrow(/elements/);
  });

  it('throws when floors is missing', () => {
    const { floors: _f, ...rest } = validProject;
    expect(() => parseArchiCADJSON(rest)).toThrow(/floors/);
  });

  it('throws when projectInfo is missing', () => {
    const { projectInfo: _p, ...rest } = validProject;
    expect(() => parseArchiCADJSON(rest)).toThrow(/projectInfo/);
  });

  it('throws when element missing elementType', () => {
    const bad = {
      ...validProject,
      elements: [{ id: 'x', layerId: 'l', floorIndex: 0, attributes: {} }],
    };
    expect(() => parseArchiCADJSON(bad)).toThrow(/elementType/);
  });

  it('throws when floor missing elevation', () => {
    const bad = {
      ...validProject,
      floors: [{ index: 0, name: 'GF' }],
    };
    expect(() => parseArchiCADJSON(bad)).toThrow(/elevation/);
  });

  it('handles empty arrays', () => {
    const project = parseArchiCADJSON({ elements: [], floors: [], projectInfo: {} });
    expect(project.elements).toHaveLength(0);
    expect(project.floors).toHaveLength(0);
  });
});

describe('mapArchiCADTypeToOpenCAD', () => {
  it('maps known types', () => {
    expect(mapArchiCADTypeToOpenCAD('Wall')).toBe('walls');
    expect(mapArchiCADTypeToOpenCAD('Slab')).toBe('floors');
    expect(mapArchiCADTypeToOpenCAD('Door')).toBe('doors');
    expect(mapArchiCADTypeToOpenCAD('Window')).toBe('windows');
    expect(mapArchiCADTypeToOpenCAD('Roof')).toBe('roofs');
    expect(mapArchiCADTypeToOpenCAD('Room')).toBe('spaces');
    expect(mapArchiCADTypeToOpenCAD('Zone')).toBe('spaces');
  });

  it('falls back for unknown types', () => {
    expect(mapArchiCADTypeToOpenCAD('CustomObject')).toBe('customobject');
    expect(mapArchiCADTypeToOpenCAD('My Type')).toBe('my_type');
  });
});

describe('ARCHICAD_TYPE_MAP', () => {
  it('has required entries', () => {
    expect(ARCHICAD_TYPE_MAP['Wall']).toBe('walls');
    expect(ARCHICAD_TYPE_MAP['Column']).toBe('columns');
    expect(ARCHICAD_TYPE_MAP['Stair']).toBe('stairs');
  });
});
