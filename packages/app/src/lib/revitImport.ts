/**
 * T-IO-V2-01: Revit JSON import utilities.
 * Parses and maps Revit document JSON to OpenCAD structures.
 */

export interface RevitElement {
  id: string;
  revitCategory: string;
  revitFamily: string;
  revitType: string;
  parameters: Record<string, string | number>;
}

export interface RevitDocument {
  elements: RevitElement[];
  levels: Array<{ id: string; elevation: number; name: string }>;
  views: Array<{ id: string; name: string; viewType: string }>;
  fileVersion: string;
}

export const REVIT_CATEGORY_MAP: Record<string, string> = {
  Walls: 'walls',
  Floors: 'floors',
  Roofs: 'roofs',
  Ceilings: 'ceilings',
  Columns: 'columns',
  Beams: 'beams',
  Doors: 'doors',
  Windows: 'windows',
  Stairs: 'stairs',
  Railings: 'railings',
  Rooms: 'spaces',
  Areas: 'spaces',
  Furniture: 'furniture',
  'Plumbing Fixtures': 'plumbing_fixtures',
  'Mechanical Equipment': 'mechanical_equipment',
  'Electrical Equipment': 'electrical_equipment',
  'Lighting Fixtures': 'lighting_fixtures',
  'Structural Foundations': 'foundations',
  Grids: 'grids',
  Levels: 'levels',
};

export function mapRevitCategoryToOpenCAD(revitCategory: string): string {
  return REVIT_CATEGORY_MAP[revitCategory] ?? revitCategory.toLowerCase().replace(/\s+/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

function validateRevitElement(raw: unknown, index: number): RevitElement {
  if (!isRecord(raw)) {
    throw new Error(`Element at index ${index} is not an object`);
  }
  if (typeof raw['id'] !== 'string') {
    throw new Error(`Element at index ${index} missing string 'id'`);
  }
  if (typeof raw['revitCategory'] !== 'string') {
    throw new Error(`Element at index ${index} missing string 'revitCategory'`);
  }
  if (typeof raw['revitFamily'] !== 'string') {
    throw new Error(`Element at index ${index} missing string 'revitFamily'`);
  }
  if (typeof raw['revitType'] !== 'string') {
    throw new Error(`Element at index ${index} missing string 'revitType'`);
  }
  if (!isRecord(raw['parameters'])) {
    throw new Error(`Element at index ${index} missing object 'parameters'`);
  }

  const parameters: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw['parameters'])) {
    if (!isStringOrNumber(v)) {
      throw new Error(`Element ${raw['id']} parameter '${k}' must be string or number`);
    }
    parameters[k] = v;
  }

  return {
    id: raw['id'] as string,
    revitCategory: raw['revitCategory'] as string,
    revitFamily: raw['revitFamily'] as string,
    revitType: raw['revitType'] as string,
    parameters,
  };
}

export function parseRevitJSON(json: unknown): RevitDocument {
  if (!isRecord(json)) {
    throw new Error('Revit JSON must be an object');
  }

  if (typeof json['fileVersion'] !== 'string') {
    throw new Error("Missing string 'fileVersion'");
  }

  if (!Array.isArray(json['elements'])) {
    throw new Error("Missing array 'elements'");
  }
  if (!Array.isArray(json['levels'])) {
    throw new Error("Missing array 'levels'");
  }
  if (!Array.isArray(json['views'])) {
    throw new Error("Missing array 'views'");
  }

  const elements = (json['elements'] as unknown[]).map((el, i) => validateRevitElement(el, i));

  const levels = (json['levels'] as unknown[]).map((lv, i) => {
    if (!isRecord(lv)) throw new Error(`Level at index ${i} is not an object`);
    if (typeof lv['id'] !== 'string') throw new Error(`Level at index ${i} missing string 'id'`);
    if (typeof lv['elevation'] !== 'number') throw new Error(`Level at index ${i} missing number 'elevation'`);
    if (typeof lv['name'] !== 'string') throw new Error(`Level at index ${i} missing string 'name'`);
    return { id: lv['id'] as string, elevation: lv['elevation'] as number, name: lv['name'] as string };
  });

  const views = (json['views'] as unknown[]).map((vw, i) => {
    if (!isRecord(vw)) throw new Error(`View at index ${i} is not an object`);
    if (typeof vw['id'] !== 'string') throw new Error(`View at index ${i} missing string 'id'`);
    if (typeof vw['name'] !== 'string') throw new Error(`View at index ${i} missing string 'name'`);
    if (typeof vw['viewType'] !== 'string') throw new Error(`View at index ${i} missing string 'viewType'`);
    return { id: vw['id'] as string, name: vw['name'] as string, viewType: vw['viewType'] as string };
  });

  return {
    elements,
    levels,
    views,
    fileVersion: json['fileVersion'] as string,
  };
}

export function extractRevitParameters(
  el: RevitElement,
  keys: string[],
): Record<string, string | number | undefined> {
  const result: Record<string, string | number | undefined> = {};
  for (const key of keys) {
    result[key] = el.parameters[key];
  }
  return result;
}
