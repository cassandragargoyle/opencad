/**
 * T-IO-V2-03: ArchiCAD JSON import utilities.
 * Parses and maps ArchiCAD project JSON to OpenCAD structures.
 */

export interface ArchiCADElement {
  id: string;
  elementType: string;
  attributes: Record<string, unknown>;
  layerId: string;
  floorIndex: number;
}

export interface ArchiCADProject {
  elements: ArchiCADElement[];
  floors: Array<{ index: number; elevation: number; name: string }>;
  projectInfo: Record<string, string>;
}

export const ARCHICAD_TYPE_MAP: Record<string, string> = {
  Wall: 'walls',
  Slab: 'floors',
  Roof: 'roofs',
  Shell: 'shells',
  Column: 'columns',
  Beam: 'beams',
  Door: 'doors',
  Window: 'windows',
  Stair: 'stairs',
  Railing: 'railings',
  Room: 'spaces',
  Zone: 'spaces',
  Object: 'furniture',
  Lamp: 'lighting_fixtures',
  Mesh: 'terrain',
  CurtainWall: 'curtain_walls',
  Skylight: 'skylights',
  Morph: 'morphs',
};

export function mapArchiCADTypeToOpenCAD(archicadType: string): string {
  return ARCHICAD_TYPE_MAP[archicadType] ?? archicadType.toLowerCase().replace(/\s+/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseArchiCADJSON(json: unknown): ArchiCADProject {
  if (!isRecord(json)) {
    throw new Error('ArchiCAD JSON must be an object');
  }

  if (!Array.isArray(json['elements'])) {
    throw new Error("Missing array 'elements'");
  }
  if (!Array.isArray(json['floors'])) {
    throw new Error("Missing array 'floors'");
  }
  if (!isRecord(json['projectInfo'])) {
    throw new Error("Missing object 'projectInfo'");
  }

  const elements: ArchiCADElement[] = (json['elements'] as unknown[]).map((el, i) => {
    if (!isRecord(el)) throw new Error(`Element at index ${i} is not an object`);
    if (typeof el['id'] !== 'string') throw new Error(`Element at index ${i} missing string 'id'`);
    if (typeof el['elementType'] !== 'string') throw new Error(`Element at index ${i} missing string 'elementType'`);
    if (typeof el['layerId'] !== 'string') throw new Error(`Element at index ${i} missing string 'layerId'`);
    if (typeof el['floorIndex'] !== 'number') throw new Error(`Element at index ${i} missing number 'floorIndex'`);
    if (!isRecord(el['attributes'])) throw new Error(`Element at index ${i} missing object 'attributes'`);

    return {
      id: el['id'] as string,
      elementType: el['elementType'] as string,
      attributes: el['attributes'] as Record<string, unknown>,
      layerId: el['layerId'] as string,
      floorIndex: el['floorIndex'] as number,
    };
  });

  const floors = (json['floors'] as unknown[]).map((fl, i) => {
    if (!isRecord(fl)) throw new Error(`Floor at index ${i} is not an object`);
    if (typeof fl['index'] !== 'number') throw new Error(`Floor at index ${i} missing number 'index'`);
    if (typeof fl['elevation'] !== 'number') throw new Error(`Floor at index ${i} missing number 'elevation'`);
    if (typeof fl['name'] !== 'string') throw new Error(`Floor at index ${i} missing string 'name'`);
    return { index: fl['index'] as number, elevation: fl['elevation'] as number, name: fl['name'] as string };
  });

  const rawInfo = json['projectInfo'] as Record<string, unknown>;
  const projectInfo: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawInfo)) {
    projectInfo[k] = String(v);
  }

  return { elements, floors, projectInfo };
}
