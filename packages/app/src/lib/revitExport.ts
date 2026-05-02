/**
 * T-IO-V2-02: Revit JSON export utilities.
 * Converts OpenCAD elements to Revit-compatible JSON format.
 */

export interface OpenCADElement {
  id: string;
  type: string;
  properties: Record<string, string | number>;
  levelId: string;
  layerId: string;
}

export interface RevitParameter {
  name: string;
  value: string | number;
  type: 'String' | 'Double' | 'Integer';
}

export const REVIT_PARAMETER_TYPES: Record<string, 'String' | 'Double' | 'Integer'> = {
  id: 'String',
  name: 'String',
  material: 'String',
  finish: 'String',
  mark: 'String',
  comments: 'String',
  manufacturer: 'String',
  model: 'String',
  url: 'String',
  description: 'String',
  category: 'String',
  family: 'String',
  type: 'String',
  fireRating: 'String',
  acousticRating: 'String',
  height: 'Double',
  width: 'Double',
  depth: 'Double',
  length: 'Double',
  thickness: 'Double',
  area: 'Double',
  volume: 'Double',
  elevation: 'Double',
  offset: 'Double',
  angle: 'Double',
  slope: 'Double',
  sillHeight: 'Double',
  headerHeight: 'Double',
  count: 'Integer',
  level: 'Integer',
  risers: 'Integer',
  treads: 'Integer',
  numberOfBays: 'Integer',
};

function inferParameterType(name: string, value: string | number): 'String' | 'Double' | 'Integer' {
  const explicit = REVIT_PARAMETER_TYPES[name];
  if (explicit) return explicit;
  if (typeof value === 'string') return 'String';
  if (Number.isInteger(value)) return 'Integer';
  return 'Double';
}

export function buildRevitParameterSet(
  props: Record<string, string | number>,
): RevitParameter[] {
  return Object.entries(props).map(([name, value]) => ({
    name,
    value,
    type: inferParameterType(name, value),
  }));
}

export function toRevitJSON(
  elements: OpenCADElement[],
  projectName: string,
): object {
  return {
    projectName,
    exportedAt: new Date().toISOString(),
    schema: 'opencad-revit-export/1.0',
    elements: elements.map((el) => ({
      id: el.id,
      revitCategory: el.type,
      levelId: el.levelId,
      layerId: el.layerId,
      parameters: buildRevitParameterSet(el.properties),
    })),
  };
}

export function validateRevitExport(obj: object): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const o = obj as Record<string, unknown>;

  if (typeof o['projectName'] !== 'string' || o['projectName'].trim() === '') {
    errors.push("Missing or empty 'projectName'");
  }

  if (!Array.isArray(o['elements'])) {
    errors.push("Missing 'elements' array");
  } else {
    (o['elements'] as unknown[]).forEach((el, i) => {
      if (typeof el !== 'object' || el === null) {
        errors.push(`Element at index ${i} is not an object`);
        return;
      }
      const e = el as Record<string, unknown>;
      if (typeof e['id'] !== 'string') {
        errors.push(`Element at index ${i} missing string 'id'`);
      }
      if (typeof e['revitCategory'] !== 'string') {
        errors.push(`Element at index ${i} missing string 'revitCategory'`);
      }
      if (!Array.isArray(e['parameters'])) {
        errors.push(`Element at index ${i} missing 'parameters' array`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
