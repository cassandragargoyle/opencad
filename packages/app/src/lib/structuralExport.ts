/**
 * Structural analytical model export + OpenSees TCL export — T-ANA-043 / T-ANA-08.
 *
 * Walks the document and emits a simplified analytical structural
 * model: columns + beams as line elements, slabs + shear walls as
 * area elements, joints at connection points. The result feeds
 * exporters that write CIS/2, SAF, or IFC-structural files.
 */

import type { DocumentSchema, ElementSchema } from '@opencad/document';

export interface Joint {
  id: string;
  x: number; y: number; z: number;
  /** Element ids that terminate at this joint. */
  incident: string[];
}

export interface LineElement {
  id: string;
  sourceElementId: string;
  kind: 'column' | 'beam';
  startJointId: string;
  endJointId: string;
  profile?: string;
  material?: string;
}

export interface AreaElement {
  id: string;
  sourceElementId: string;
  kind: 'slab' | 'wall' | 'roof';
  vertices: Array<{ x: number; y: number; z: number }>;
  thickness: number;
  material?: string;
}

export interface AnalyticalModel {
  joints: Joint[];
  lines: LineElement[];
  areas: AreaElement[];
  unsupportedSourceIds: string[];
}

function num(el: ElementSchema, key: string, fb = 0): number {
  const p = (el.properties as Record<string, { value: unknown }>)[key];
  return p && typeof p.value === 'number' ? (p.value as number) : fb;
}
function str(el: ElementSchema, key: string): string | undefined {
  const p = (el.properties as Record<string, { value: unknown }>)[key];
  return p && typeof p.value === 'string' ? (p.value as string) : undefined;
}

/** Snap-to-existing joint or add a new one; returns the joint id. */
function getOrCreateJoint(
  joints: Joint[],
  x: number, y: number, z: number,
  incidentElId: string,
  tolerance = 20,
): string {
  for (const j of joints) {
    if (Math.hypot(j.x - x, j.y - y, j.z - z) <= tolerance) {
      if (!j.incident.includes(incidentElId)) j.incident.push(incidentElId);
      return j.id;
    }
  }
  const id = `j${joints.length + 1}`;
  joints.push({ id, x, y, z, incident: [incidentElId] });
  return id;
}

/**
 * Build the analytical model from a document.
 */
export function buildAnalyticalModel(doc: DocumentSchema): AnalyticalModel {
  const joints: Joint[] = [];
  const lines: LineElement[] = [];
  const areas: AreaElement[] = [];
  const unsupportedSourceIds: string[] = [];

  for (const el of Object.values(doc.content.elements)) {
    switch (el.type) {
      case 'column': {
        const x = num(el, 'X'), y = num(el, 'Y');
        const h = num(el, 'Height', 3000);
        const elev = num(el, 'ElevationOffset', 0);
        const sj = getOrCreateJoint(joints, x, y, elev, el.id);
        const ej = getOrCreateJoint(joints, x, y, elev + h, el.id);
        lines.push({
          id: `line-${el.id}`, sourceElementId: el.id, kind: 'column',
          startJointId: sj, endJointId: ej,
          profile: str(el, 'SectionType'), material: str(el, 'Material'),
        });
        break;
      }
      case 'beam': {
        const x1 = num(el, 'StartX'), y1 = num(el, 'StartY');
        const x2 = num(el, 'EndX',   x1 + 1000), y2 = num(el, 'EndY', y1);
        const elev = num(el, 'ElevationOffset', 0);
        const sj = getOrCreateJoint(joints, x1, y1, elev, el.id);
        const ej = getOrCreateJoint(joints, x2, y2, elev, el.id);
        lines.push({
          id: `line-${el.id}`, sourceElementId: el.id, kind: 'beam',
          startJointId: sj, endJointId: ej,
          material: str(el, 'Material'),
        });
        break;
      }
      case 'slab':
      case 'roof': {
        const raw = str(el, 'Points');
        if (!raw) break;
        try {
          const pts = JSON.parse(raw) as Array<{ x: number; y: number }>;
          const elev = num(el, 'ElevationOffset', 0);
          areas.push({
            id: `area-${el.id}`, sourceElementId: el.id,
            kind: el.type === 'slab' ? 'slab' : 'roof',
            vertices: pts.map((p) => ({ x: p.x, y: p.y, z: elev })),
            thickness: num(el, 'Thickness', 200),
            material: str(el, 'Material'),
          });
        } catch { unsupportedSourceIds.push(el.id); }
        break;
      }
      case 'wall': {
        // Walls only enter the analytical model when explicitly tagged
        // Structural=true.
        if (str(el, 'Structural') === 'true') {
          const x1 = num(el, 'StartX'), y1 = num(el, 'StartY');
          const x2 = num(el, 'EndX'),   y2 = num(el, 'EndY');
          const h = num(el, 'Height', 3000);
          const elev = num(el, 'ElevationOffset', 0);
          areas.push({
            id: `area-${el.id}`, sourceElementId: el.id, kind: 'wall',
            vertices: [
              { x: x1, y: y1, z: elev }, { x: x2, y: y2, z: elev },
              { x: x2, y: y2, z: elev + h }, { x: x1, y: y1, z: elev + h },
            ],
            thickness: num(el, 'Width', 200),
            material: str(el, 'Material'),
          });
        }
        break;
      }
      default:
        if (['morph', 'shell', 'stair'].includes(el.type)) {
          unsupportedSourceIds.push(el.id);
        }
    }
  }

  return { joints, lines, areas, unsupportedSourceIds };
}

// ═══════════════════════════════════════════════════════════════════════════
//  OpenSees TCL export — T-ANA-08
//
//  Implements:
//    - Structural node / member / section / load data types
//    - ASCE 7-22 basic load combinations
//    - OpenSees TCL script generation
//    - Parser for node displacement output from OpenSees stdout
//
//  References:
//    OpenSees v3.x — opensees.berkeley.edu
//    ASCE/SEI 7-22 — Minimum Design Loads for Buildings and Other Structures
// ═══════════════════════════════════════════════════════════════════════════

// ── Structural data types ─────────────────────────────────────────────────────

export interface StructuralNode {
  /** Unique node identifier (positive integer) */
  id: number;
  /** X-coordinate (mm) */
  x: number;
  /** Y-coordinate (mm) */
  y: number;
  /** Z-coordinate (mm) */
  z: number;
  /**
   * Degrees of freedom per node.
   * 3 for 2D planar analysis (ux, uy, rz)
   * 6 for 3D analysis (ux, uy, uz, rx, ry, rz)
   */
  dof: 3 | 6;
}

export interface StructuralMember {
  /** Unique element identifier */
  id: number;
  type: 'column' | 'beam' | 'wall' | 'slab';
  /** Start node id */
  nodeI: number;
  /** End node id */
  nodeJ: number;
  /** Reference to a SectionProfile id */
  sectionId: number;
}

export interface SectionProfile {
  /** Unique section identifier */
  id: number;
  type: 'W-shape' | 'HSS' | 'concrete-rect';
  /** Cross-sectional area (mm²) */
  area: number;
  /** Second moment of area about strong axis (mm⁴) */
  Ix: number;
  /** Second moment of area about weak axis (mm⁴) */
  Iy: number;
  material: 'steel' | 'concrete';
}

export interface NodeLoad {
  nodeId: number;
  /** Force in X-direction (N) */
  Fx: number;
  /** Force in Y-direction (N) */
  Fy: number;
  /** Force in Z-direction (N) */
  Fz: number;
  /** Moment about X-axis (N·mm) */
  Mx: number;
  /** Moment about Y-axis (N·mm) */
  My: number;
  /** Moment about Z-axis (N·mm) */
  Mz: number;
}

export interface LoadCase {
  id: number;
  type: 'dead' | 'live' | 'wind' | 'seismic';
  loads: NodeLoad[];
}

// ── ASCE 7-22 load combinations ───────────────────────────────────────────────

/**
 * ASCE 7-22 Section 2.3.6 basic load combinations (LRFD / strength design).
 * D=dead, L=live, Lr=roof live, S=snow, R=rain, W=wind, E=seismic, H=lateral earth.
 */
export const ASCE7_LOAD_COMBOS: string[] = [
  '1.4D',
  '1.2D + 1.6L + 0.5(Lr or S or R)',
  '1.2D + 1.6(Lr or S or R) + (L or 0.5W)',
  '1.2D + 1.0W + L + 0.5(Lr or S or R)',
  '0.9D + 1.0W',
  '1.2D + 1.0E + L + 0.2S',
  '0.9D + 1.0E',
];

// ── Internal helpers ──────────────────────────────────────────────────────────

const _OPENSEES_ELASTIC_MODULUS: Record<SectionProfile['material'], number> = {
  steel:    200000, // 200 GPa (MPa = N/mm²)
  concrete: 25000,  // 25 GPa  (C30/37)
};

function _tclLine(...parts: (string | number)[]): string {
  return parts.join(' ');
}

function _tclComment(text: string): string {
  return `# ${text}`;
}

// ── Node export ───────────────────────────────────────────────────────────────

/**
 * Generate OpenSees TCL `node` commands.
 * Coordinates converted from mm → m (SI standard in OpenSees).
 *
 * 2D node: `node $tag $x $y`
 * 3D node: `node $tag $x $y $z`
 */
export function exportOpenSeesNodes(nodes: StructuralNode[]): string {
  const lines: string[] = [
    _tclComment('── Nodes ──────────────────────────────────────'),
  ];
  for (const node of nodes) {
    const xM = (node.x / 1000).toFixed(6);
    const yM = (node.y / 1000).toFixed(6);
    const zM = (node.z / 1000).toFixed(6);
    if (node.dof === 3) {
      lines.push(_tclLine('node', node.id, xM, yM));
    } else {
      lines.push(_tclLine('node', node.id, xM, yM, zM));
    }
  }
  return lines.join('\n');
}

// ── Element export ────────────────────────────────────────────────────────────

/**
 * Generate OpenSees TCL material and `elasticBeamColumn` element commands.
 *
 * Element format (3D):
 *   `element elasticBeamColumn $eleTag $iNode $jNode $A $E $G $J $Iy $Iz $transfTag`
 *
 * Geometric transformation: PDelta for columns/walls, Linear for beams/slabs.
 */
export function exportOpenSeesElements(
  members: StructuralMember[],
  sections: SectionProfile[],
): string {
  const sectionMap = new Map<number, SectionProfile>(sections.map((s) => [s.id, s]));
  const lines: string[] = [
    _tclComment('── Materials ───────────────────────────────────'),
  ];

  const emittedMats = new Set<number>();
  for (const member of members) {
    const sec = sectionMap.get(member.sectionId);
    if (!sec || emittedMats.has(sec.id)) continue;
    emittedMats.add(sec.id);
    const E = _OPENSEES_ELASTIC_MODULUS[sec.material];
    lines.push(
      _tclComment(`Section ${sec.id}: ${sec.type} (${sec.material}) E=${E} MPa`),
      _tclLine('uniaxialMaterial', 'Elastic', sec.id, E),
    );
  }

  lines.push('', _tclComment('── Geometric Transformations ───────────────────'));

  const emittedTransf = new Set<number>();
  for (const member of members) {
    const isColumn  = member.type === 'column' || member.type === 'wall';
    const transfTag = isColumn ? 100 + member.id : 200 + member.id;
    if (emittedTransf.has(transfTag)) continue;
    emittedTransf.add(transfTag);
    const transfType = isColumn ? 'PDelta' : 'Linear';
    lines.push(_tclLine('geomTransf', transfType, transfTag, '0 0 1'));
  }

  lines.push('', _tclComment('── Elements ─────────────────────────────────────'));

  for (const member of members) {
    const sec = sectionMap.get(member.sectionId);
    if (!sec) {
      lines.push(_tclComment(`WARNING: section ${member.sectionId} not found for member ${member.id}`));
      continue;
    }
    const E        = _OPENSEES_ELASTIC_MODULUS[sec.material];
    const G        = sec.material === 'steel' ? E / (2 * 1.3) : E / (2 * 1.2);
    const isColumn = member.type === 'column' || member.type === 'wall';
    const transfTag = isColumn ? 100 + member.id : 200 + member.id;
    const J        = Math.min(sec.Ix, sec.Iy) / 2;

    lines.push(
      _tclComment(`${member.type} ${member.id}: section ${sec.id}`),
      _tclLine(
        'element', 'elasticBeamColumn',
        member.id,
        member.nodeI,
        member.nodeJ,
        sec.area.toFixed(2),
        E,
        G.toFixed(1),
        J.toFixed(1),
        sec.Iy.toFixed(1),
        sec.Ix.toFixed(1),
        transfTag,
      ),
    );
  }

  return lines.join('\n');
}

// ── Load export ───────────────────────────────────────────────────────────────

/**
 * Generate OpenSees TCL `pattern Plain` load commands for a LoadCase.
 *
 * All six DOF components are written; OpenSees ignores constrained DOFs.
 */
export function exportOpenSeesLoads(loadCase: LoadCase): string {
  const lines: string[] = [
    _tclComment(`── Load Case ${loadCase.id}: ${loadCase.type} ────────────────`),
    _tclLine('timeSeries', 'Constant', loadCase.id, '-factor', '1.0'),
    _tclLine('pattern', 'Plain', loadCase.id, loadCase.id, '{'),
  ];
  for (const load of loadCase.loads) {
    lines.push(
      `    load ${load.nodeId} ${load.Fx.toFixed(3)} ${load.Fy.toFixed(3)} ${load.Fz.toFixed(3)} ${load.Mx.toFixed(3)} ${load.My.toFixed(3)} ${load.Mz.toFixed(3)}`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}

// ── Full model assembly ───────────────────────────────────────────────────────

/**
 * Assemble a complete, analysis-ready OpenSees TCL script including:
 *   - wipe + model builder
 *   - Nodes + boundary conditions (nodes at z=0 or y=0 are fixed)
 *   - Section materials + elements
 *   - All load patterns
 *   - Static linear analysis settings
 *   - Node displacement recorder
 *   - analyze + print commands
 */
export function buildOpenSeesTCL(
  nodes: StructuralNode[],
  members: StructuralMember[],
  sections: SectionProfile[],
  loadCases: LoadCase[],
): string {
  const is2D = nodes.every((n) => n.dof === 3);
  const ndm  = is2D ? 2 : 3;
  const ndf  = is2D ? 3 : 6;

  const parts: string[] = [
    _tclComment('═══════════════════════════════════════════════'),
    _tclComment(' OpenSees structural model — generated by OpenCAD'),
    _tclComment(` Model type: ${is2D ? '2D planar' : '3D space frame'}`),
    _tclComment('═══════════════════════════════════════════════'),
    '',
    'wipe',
    `model basic -ndm ${ndm} -ndf ${ndf}`,
    '',
    exportOpenSeesNodes(nodes),
    '',
    _tclComment('── Boundary Conditions ─────────────────────────'),
  ];

  for (const node of nodes) {
    const isBase = is2D ? node.y <= 0 : node.z <= 0;
    if (isBase) {
      parts.push(_tclLine('fix', node.id, is2D ? '1 1 1' : '1 1 1 1 1 1'));
    }
  }

  parts.push('', exportOpenSeesElements(members, sections), '');

  for (const lc of loadCases) {
    parts.push(exportOpenSeesLoads(lc), '');
  }

  const dofList = Array.from({ length: ndf }, (_, i) => i + 1).join(' ');
  parts.push(
    _tclComment('── Analysis ─────────────────────────────────────'),
    'system BandSPD',
    'numberer RCM',
    'constraints Plain',
    'integrator LoadControl 1.0',
    'algorithm Linear',
    'analysis Static',
    '',
    _tclComment('── Recorders ────────────────────────────────────'),
    `recorder Node -file node_disp.out -time -nodeRange 1 ${nodes.length} -dof ${dofList} disp`,
    '',
    _tclComment('── Run ──────────────────────────────────────────'),
    'analyze 1',
    '',
    _tclComment('── Print node displacements ─────────────────────'),
    'print node',
  );

  return parts.join('\n');
}

// ── OpenSees output parser ────────────────────────────────────────────────────

/**
 * Parse node displacements from OpenSees `print node` stdout.
 *
 * Expected format (3D):
 *   Node: 1
 *     Coordinates  : 0.000 0.000 0.000
 *     Disps: 0.001234 0.002345 0.003456 0.000001 0.000002 0.000003
 *
 * @returns Map of node id string → {ux, uy, uz} (all in metres, from SI model).
 */
export function parseOpenSeesDisplacements(
  tclOutput: string,
): Record<string, { ux: number; uy: number; uz: number }> {
  const result: Record<string, { ux: number; uy: number; uz: number }> = {};
  const blockRe = /Node:\s*(\d+)[\s\S]*?Disps\s*[=:]\s*([\d.eE+\-\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(tclOutput)) !== null) {
    const nodeId = m[1]!.trim();
    const vals   = m[2]!.trim().split(/\s+/).map(Number).filter((v) => !isNaN(v));
    result[nodeId] = { ux: vals[0] ?? 0, uy: vals[1] ?? 0, uz: vals[2] ?? 0 };
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Original SAF / document-model analytical export below
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal SAF-like CSV export — one row per entity.
 */
export function exportAnalyticalCSV(model: AnalyticalModel): string {
  const lines: string[] = [];
  lines.push('entity,id,p1x,p1y,p1z,p2x,p2y,p2z,kind,material');
  for (const j of model.joints) {
    lines.push(`joint,${j.id},${j.x},${j.y},${j.z},,,,,`);
  }
  for (const ln of model.lines) {
    const a = model.joints.find((j) => j.id === ln.startJointId)!;
    const b = model.joints.find((j) => j.id === ln.endJointId)!;
    lines.push(`line,${ln.id},${a.x},${a.y},${a.z},${b.x},${b.y},${b.z},${ln.kind},${ln.material ?? ''}`);
  }
  for (const a of model.areas) {
    // First vertex as p1, last as p2 — placeholder; real SAF carries all verts
    const v1 = a.vertices[0]!, v2 = a.vertices[a.vertices.length - 1]!;
    lines.push(`area,${a.id},${v1.x},${v1.y},${v1.z},${v2.x},${v2.y},${v2.z},${a.kind},${a.material ?? ''}`);
  }
  return lines.join('\n') + '\n';
}
