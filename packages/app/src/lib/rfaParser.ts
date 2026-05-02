/**
 * T-IO-V2-04: RFA (Revit Family) JSON manifest parser.
 * Parses RFA family manifests and builds instance properties.
 */

export interface RFAFamilyParameter {
  name: string;
  type: string;
  defaultValue: string | number;
}

export interface RFAFamily {
  name: string;
  category: string;
  parameters: RFAFamilyParameter[];
  geometry: string;
}

export interface RFAFamilyType {
  id: string;
  name: string;
  parameterValues: Record<string, string | number>;
}

export interface RFALibraryEntry {
  family: RFAFamily;
  types: RFAFamilyType[];
}

export const RFA_PARAMETER_CATEGORIES: string[] = [
  'Dimensions',
  'Structural',
  'Materials and Finishes',
  'Identity Data',
  'Constraints',
  'Graphics',
  'Electrical',
  'Mechanical',
  'Plumbing',
  'Energy Analysis',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

export function parseRFAManifest(json: unknown): RFALibraryEntry {
  if (!isRecord(json)) {
    throw new Error('RFA manifest must be an object');
  }

  // Parse family
  if (!isRecord(json['family'])) {
    throw new Error("Missing object 'family'");
  }
  const rawFamily = json['family'];

  if (typeof rawFamily['name'] !== 'string') throw new Error("Family missing string 'name'");
  if (typeof rawFamily['category'] !== 'string') throw new Error("Family missing string 'category'");
  if (typeof rawFamily['geometry'] !== 'string') throw new Error("Family missing string 'geometry'");
  if (!Array.isArray(rawFamily['parameters'])) throw new Error("Family missing array 'parameters'");

  const parameters: RFAFamilyParameter[] = (rawFamily['parameters'] as unknown[]).map((p, i) => {
    if (!isRecord(p)) throw new Error(`Parameter at index ${i} is not an object`);
    if (typeof p['name'] !== 'string') throw new Error(`Parameter at index ${i} missing 'name'`);
    if (typeof p['type'] !== 'string') throw new Error(`Parameter at index ${i} missing 'type'`);
    if (!isStringOrNumber(p['defaultValue'])) throw new Error(`Parameter at index ${i} defaultValue must be string or number`);
    return { name: p['name'] as string, type: p['type'] as string, defaultValue: p['defaultValue'] as string | number };
  });

  const family: RFAFamily = {
    name: rawFamily['name'] as string,
    category: rawFamily['category'] as string,
    parameters,
    geometry: rawFamily['geometry'] as string,
  };

  // Parse types
  if (!Array.isArray(json['types'])) {
    throw new Error("Missing array 'types'");
  }

  const types: RFAFamilyType[] = (json['types'] as unknown[]).map((t, i) => {
    if (!isRecord(t)) throw new Error(`Type at index ${i} is not an object`);
    if (typeof t['id'] !== 'string') throw new Error(`Type at index ${i} missing string 'id'`);
    if (typeof t['name'] !== 'string') throw new Error(`Type at index ${i} missing string 'name'`);
    if (!isRecord(t['parameterValues'])) throw new Error(`Type at index ${i} missing object 'parameterValues'`);

    const parameterValues: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(t['parameterValues'])) {
      if (!isStringOrNumber(v)) throw new Error(`Type ${t['id']} parameterValues['${k}'] must be string or number`);
      parameterValues[k] = v;
    }

    return { id: t['id'] as string, name: t['name'] as string, parameterValues };
  });

  return { family, types };
}

export function buildFamilyInstanceProps(
  entry: RFALibraryEntry,
  typeId: string,
  overrides?: Record<string, string | number>,
): Record<string, string | number> {
  // Start with defaults from family parameters
  const result: Record<string, string | number> = {};
  for (const param of entry.family.parameters) {
    result[param.name] = param.defaultValue;
  }

  // Find the matching type
  const familyType = entry.types.find((t) => t.id === typeId);
  if (familyType) {
    // Apply type-level overrides
    for (const [k, v] of Object.entries(familyType.parameterValues)) {
      result[k] = v;
    }
  }

  // Apply caller overrides
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      result[k] = v;
    }
  }

  return result;
}
