/**
 * T-IO-05: USD / USDZ export.
 *
 * Produces a USDA (ASCII) scene description that can be opened in
 * Pixar's USD toolchain, Apple Reality Composer, or any USD-aware viewer.
 * USDZ is a ZIP archive of USD + referenced assets; we generate the USDA
 * payload here and leave ZIP packaging to the caller (browser or Tauri).
 *
 * Spec: https://openusd.org/release/spec.html
 */
import type { DocumentSchema, ElementSchema } from './types';

export interface USDExportOptions {
  /** Scale factor from document units (mm) to USD units (cm by default). */
  cmPerUnit?: number;
  /** Embed a simple material per element type. Default true. */
  includeMaterials?: boolean;
  /** USD up-axis. Default 'Y'. */
  upAxis?: 'Y' | 'Z';
}

/** Export a DocumentSchema as USDA text. */
export function exportUSDA(
  doc: DocumentSchema,
  opts: USDExportOptions = {},
): string {
  const scale       = opts.cmPerUnit         ?? 0.1;  // mm → cm
  const materials   = opts.includeMaterials  ?? true;
  const upAxis      = opts.upAxis            ?? 'Y';

  const elements    = Object.values(doc.content.elements ?? {});
  const physTypes   = new Set(['wall', 'slab', 'roof', 'column', 'beam', 'stair', 'door', 'window']);
  const physical    = elements.filter((e) => physTypes.has(e.type));

  const matDefs = materials ? buildMaterialDefs() : '';
  const primDefs = physical.map((el) => buildMeshPrim(el, scale, materials)).join('\n');

  return `#usda 1.0
(
    defaultPrim = "World"
    doc = """${escUsd(doc.name)} — exported from OpenCAD"""
    metersPerUnit = ${(scale * 0.01).toFixed(6)}
    upAxis = "${upAxis}"
)

def Xform "World"
{
${matDefs}
${primDefs}
}
`;
}

/** Export a DocumentSchema as a USDZ-ready payload (USDA + asset manifest). */
export interface USDZPayload {
  /** USDA file content. */
  usda: string;
  /** Suggested filename for the USDA inside the ZIP. */
  usdaFilename: string;
  /** Any additional referenced asset paths (empty for geometry-only export). */
  assets: string[];
}

export function buildUSDZPayload(
  doc: DocumentSchema,
  opts: USDExportOptions = {},
): USDZPayload {
  const usda = exportUSDA(doc, opts);
  const safeName = doc.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  return {
    usda,
    usdaFilename: `${safeName}.usda`,
    assets: [],
  };
}

// ── Prim builders ────────────────────────────────────────────────────────────

function buildMeshPrim(el: ElementSchema, scale: number, includeMaterial: boolean): string {
  const bb = el.boundingBox;
  if (!bb) return '';

  const { min, max } = bb;
  const sx = (max.x - min.x) * scale;
  const sy = (max.z - min.z) * scale;  // z in mm → y in USD (up)
  const sz = (max.y - min.y) * scale;

  // origin in USD space
  const ox = ((min.x + max.x) / 2) * scale;
  const oy = ((min.z + max.z) / 2) * scale;
  const oz = ((min.y + max.y) / 2) * scale;

  const primName = safePrimName(el.id);
  const matBinding = includeMaterial
    ? `\n        rel material:binding = </World/Materials/${el.type}>`
    : '';

  return `    def Mesh "${primName}"
    {
        float3[] extent = [(${(-sx/2).toFixed(4)}, ${(-sy/2).toFixed(4)}, ${(-sz/2).toFixed(4)}), (${(sx/2).toFixed(4)}, ${(sy/2).toFixed(4)}, ${(sz/2).toFixed(4)})]
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 7, 3, 1, 5, 6, 2, 0, 1, 5, 4, 2, 6, 7, 3]
        point3f[] points = [
            (${(-sx/2).toFixed(4)}, ${(-sy/2).toFixed(4)}, ${(-sz/2).toFixed(4)}),
            (${(sx/2).toFixed(4)}, ${(-sy/2).toFixed(4)}, ${(-sz/2).toFixed(4)}),
            (${(sx/2).toFixed(4)}, ${(sy/2).toFixed(4)}, ${(-sz/2).toFixed(4)}),
            (${(-sx/2).toFixed(4)}, ${(sy/2).toFixed(4)}, ${(-sz/2).toFixed(4)}),
            (${(-sx/2).toFixed(4)}, ${(-sy/2).toFixed(4)}, ${(sz/2).toFixed(4)}),
            (${(sx/2).toFixed(4)}, ${(-sy/2).toFixed(4)}, ${(sz/2).toFixed(4)}),
            (${(sx/2).toFixed(4)}, ${(sy/2).toFixed(4)}, ${(sz/2).toFixed(4)}),
            (${(-sx/2).toFixed(4)}, ${(sy/2).toFixed(4)}, ${(sz/2).toFixed(4)})
        ]
        double3 xformOp:translate = (${ox.toFixed(4)}, ${oy.toFixed(4)}, ${oz.toFixed(4)})
        uniform token[] xformOpOrder = ["xformOp:translate"]
        string userProperties:elementId = "${el.id}"
        string userProperties:elementType = "${el.type}"${matBinding}
    }`;
}

const MATERIAL_COLORS: Record<string, string> = {
  wall:    '(0.8, 0.8, 0.75)',
  slab:    '(0.6, 0.6, 0.6)',
  roof:    '(0.5, 0.4, 0.35)',
  column:  '(0.7, 0.7, 0.65)',
  beam:    '(0.65, 0.65, 0.6)',
  door:    '(0.55, 0.4, 0.3)',
  window:  '(0.5, 0.7, 0.9)',
  stair:   '(0.6, 0.55, 0.5)',
};

function buildMaterialDefs(): string {
  const defs = Object.entries(MATERIAL_COLORS).map(([type, color]) => `
    def Material "${type}"
    {
        token outputs:surface.connect = </World/Materials/${type}/PBRShader.outputs:surface>
        def Shader "PBRShader"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor = ${color}
            float inputs:roughness = 0.6
            float inputs:metallic = 0.0
            token outputs:surface
        }
    }`).join('');

  return `    def Scope "Materials"
    {${defs}
    }`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safePrimName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escUsd(s: string): string {
  return s.replace(/"/g, '\\"');
}
