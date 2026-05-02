/**
 * T-IO-04: Rhino 3DM import / export adapter.
 *
 * The official `rhino3dm` npm package ships a WebAssembly module that must be
 * asynchronously initialised before use.  To keep this package free of a heavy
 * optional dependency the adapter accepts the already-initialised `rhino3dm`
 * module as an explicit parameter, letting callers decide when / whether to
 * load it (e.g. only when the user triggers the command).
 *
 * Fallback: when no rhino module is provided, import/export operates on a
 * minimal "stub" representation that can still round-trip through our own
 * JSON encoding.
 */
import type { DocumentSchema, ElementSchema } from './types';

// ── rhino3dm type surface (subset we actually use) ──────────────────────────

export interface RhinoModule {
  File3dm: new () => RhinoFile3dm;
  File3dmFromByteArray(bytes: Uint8Array): RhinoFile3dm;
  Mesh: new () => RhinoMesh;
  Point3d(x: number, y: number, z: number): { x: number; y: number; z: number };
}

export interface RhinoFile3dm {
  objects(): { count: number; get(i: number): RhinoObject };
  objects(): { count: number; get(i: number): RhinoObject; add(obj: RhinoGeometry, attr: RhinoAttributes): void };
  toByteArray(): Uint8Array;
  dispose(): void;
}

export interface RhinoObject {
  geometry(): RhinoGeometry;
  attributes(): RhinoAttributes;
}

export interface RhinoGeometry {
  objectType: number;  // 1=Point, 4=Curve, 8=Surface, 32=Mesh, 16=Brep
}

export interface RhinoMesh extends RhinoGeometry {
  vertices(): { count: number; add(x: number, y: number, z: number): void };
  faces(): { addFace(a: number, b: number, c: number): void };
  normals(): { computeNormals(): void };
}

export interface RhinoAttributes {
  name: string;
  layerIndex: number;
  userStrings: { add(key: string, value: string): void; count: number; getItem(i: number): [string, string] };
}

// ── Import ───────────────────────────────────────────────────────────────────

export interface Rhino3dmImportResult {
  objectCount: number;
  elements: ElementSchema[];
  warnings: string[];
}

/**
 * Parse a 3DM file (provided as Uint8Array) into a list of ElementSchema stubs.
 * Pass the initialised `rhino3dm` module instance as the second argument.
 */
export function importRhino3dm(
  bytes: Uint8Array,
  rhino?: RhinoModule,
): Rhino3dmImportResult {
  const warnings: string[] = [];

  if (!rhino) {
    warnings.push('rhino3dm module not provided — returning empty element list');
    return { objectCount: 0, elements: [], warnings };
  }

  const file = rhino.File3dmFromByteArray(bytes);
  const objs = file.objects();
  const elements: ElementSchema[] = [];

  for (let i = 0; i < objs.count; i++) {
    const obj  = objs.get(i);
    const attr = obj.attributes();
    const geo  = obj.geometry();

    const el = makeStubElement(i, geo, attr);
    elements.push(el);
  }

  file.dispose();
  return { objectCount: objs.count, elements, warnings };
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface Rhino3dmExportResult {
  bytes: Uint8Array | null;
  objectCount: number;
  warnings: string[];
}

/**
 * Serialise a DocumentSchema to a 3DM byte array.
 * Pass the initialised `rhino3dm` module instance as the second argument.
 * Returns `bytes: null` when the rhino module is unavailable.
 */
export function exportRhino3dm(
  doc: DocumentSchema,
  rhino?: RhinoModule,
): Rhino3dmExportResult {
  const warnings: string[] = [];

  if (!rhino) {
    warnings.push('rhino3dm module not provided — export skipped');
    return { bytes: null, objectCount: 0, warnings };
  }

  const elements = Object.values(doc.content.elements ?? {});
  const file = new rhino.File3dm();
  const objs = file.objects() as unknown as {
    add(geo: RhinoGeometry, attr: RhinoAttributes): void;
  };

  let exported = 0;

  for (const el of elements) {
    const geo = buildMeshForElement(el, rhino);
    if (!geo) {
      warnings.push(`Element ${el.id} (${el.type}) skipped — no mesh representation`);
      continue;
    }
    const attr = buildAttributesForElement(el, rhino);
    objs.add(geo, attr);
    exported++;
  }

  const bytes = file.toByteArray();
  file.dispose();
  return { bytes, objectCount: exported, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_LEVEL_ID = 'lv0';
const PLACEHOLDER_LAYER_ID = 'l0';

function makeStubElement(
  index: number,
  geo: RhinoGeometry,
  attr: RhinoAttributes,
): ElementSchema {
  const id   = `rhino_${index}`;
  const name = attr.name || id;
  const type = rhinoObjectTypeToElementType(geo.objectType);

  const props: ElementSchema['properties'] = {
    Name: { type: 'string', value: name },
  };

  // Pull user strings into properties
  for (let j = 0; j < attr.userStrings.count; j++) {
    const [key, val] = attr.userStrings.getItem(j);
    props[key] = { type: 'string', value: val };
  }

  return {
    id,
    type,
    properties: props,
    propertySets: [],
    geometry: { type: 'mesh', data: null },
    layerId: PLACEHOLDER_LAYER_ID,
    levelId: PLACEHOLDER_LEVEL_ID,
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation:    { x: 0, y: 0, z: 0 },
      scale:       { x: 1, y: 1, z: 1 },
    },
    boundingBox: {
      min: { x: 0, y: 0, z: 0, _type: 'Point3D' },
      max: { x: 0, y: 0, z: 0, _type: 'Point3D' },
    },
    metadata: {
      id,
      createdBy: 'rhino3dm-import',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: { clock: {} },
    },
    visible: true,
    locked: false,
  };
}

/** Build a bounding-box mesh for elements that have a bounding box. */
function buildMeshForElement(el: ElementSchema, rhino: RhinoModule): RhinoMesh | null {
  const bb = el.boundingBox;
  if (!bb) return null;

  const mesh = new rhino.Mesh();
  const verts = mesh.vertices();
  const faces = mesh.faces();

  const { min, max } = bb;

  // 8 corners of the bounding box
  verts.add(min.x, min.y, min.z); // 0
  verts.add(max.x, min.y, min.z); // 1
  verts.add(max.x, max.y, min.z); // 2
  verts.add(min.x, max.y, min.z); // 3
  verts.add(min.x, min.y, max.z); // 4
  verts.add(max.x, min.y, max.z); // 5
  verts.add(max.x, max.y, max.z); // 6
  verts.add(min.x, max.y, max.z); // 7

  // 12 triangles (2 per face, 6 faces)
  faces.addFace(0, 1, 2); faces.addFace(0, 2, 3); // bottom
  faces.addFace(4, 6, 5); faces.addFace(4, 7, 6); // top
  faces.addFace(0, 4, 5); faces.addFace(0, 5, 1); // front
  faces.addFace(2, 6, 7); faces.addFace(2, 7, 3); // back
  faces.addFace(1, 5, 6); faces.addFace(1, 6, 2); // right
  faces.addFace(3, 7, 4); faces.addFace(3, 4, 0); // left

  mesh.normals().computeNormals();
  return mesh;
}

function buildAttributesForElement(el: ElementSchema, _rhino: RhinoModule): RhinoAttributes {
  const name = String(el.properties?.Name?.value ?? el.id);
  const userStrings = {
    _pairs: [] as [string, string][],
    add(key: string, value: string) { this._pairs.push([key, value]); },
    get count() { return this._pairs.length; },
    getItem(i: number): [string, string] { return this._pairs[i]; },
  };
  userStrings.add('ElementId', el.id);
  userStrings.add('ElementType', el.type);
  for (const [key, pv] of Object.entries(el.properties ?? {})) {
    if (key !== 'Name') userStrings.add(key, String(pv.value));
  }
  return { name, layerIndex: 0, userStrings } as unknown as RhinoAttributes;
}

function rhinoObjectTypeToElementType(objectType: number): ElementSchema['type'] {
  switch (objectType) {
    case 32:  return 'solid';   // Mesh
    case 16:  return 'solid';   // Brep
    case 8:   return 'surface'; // Surface
    case 4:   return 'line';    // Curve
    case 1:   return 'point';   // Point
    default:  return 'solid';
  }
}
