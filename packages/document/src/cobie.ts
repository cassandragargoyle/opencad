/**
 * T-IO-03: COBie 2.4 spreadsheet export.
 * Produces a multi-sheet CSV bundle (one CSV per COBie sheet) suitable for
 * import into COBie-aware facilities-management tools.
 *
 * Spec: https://www.nibs.org/cobie
 */
import type { DocumentSchema, ElementSchema, LevelSchema } from './types';

export interface CobieExportOptions {
  /** Author name to embed in CreatedBy cells. Default 'OpenCAD'. */
  createdBy?: string;
  /** ISO-8601 date string for CreatedOn cells. Default: now. */
  createdOn?: string;
}

/** A named CSV sheet in the COBie bundle. */
export interface CobieSheet {
  name: string;
  /** Rows, including the header row at index 0. */
  rows: string[][];
}

/** Export a DocumentSchema as a COBie 2.4 CSV bundle. */
export function exportCOBie(
  doc: DocumentSchema,
  opts: CobieExportOptions = {},
): CobieSheet[] {
  const createdBy  = opts.createdBy  ?? 'OpenCAD';
  const createdOn  = opts.createdOn  ?? new Date().toISOString().slice(0, 10);
  const elements   = Object.values(doc.content.elements ?? {});
  const levels     = Object.values(doc.organization.levels ?? {});
  const layers     = Object.values(doc.organization.layers ?? {});
  const materials  = Object.values(doc.library.materials ?? {});

  return [
    buildFacilitySheet(doc, createdBy, createdOn),
    buildFloorSheet(levels, createdBy, createdOn),
    buildSpaceSheet(elements, createdBy, createdOn),
    buildZoneSheet(layers, createdBy, createdOn),
    buildTypeSheet(materials, createdBy, createdOn),
    buildComponentSheet(elements, createdBy, createdOn),
    buildSystemSheet(elements, createdBy, createdOn),
    buildAttributeSheet(elements, createdBy, createdOn),
  ];
}

/** Serialise a COBie bundle to a map of sheet-name → CSV text. */
export function cobieToCSVMap(sheets: CobieSheet[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sheet of sheets) {
    map[sheet.name] = sheet.rows.map(csvRow).join('\n');
  }
  return map;
}

// ── Sheet builders ───────────────────────────────────────────────────────────

function buildFacilitySheet(
  doc: DocumentSchema,
  createdBy: string,
  createdOn: string,
): CobieSheet {
  return {
    name: 'Facility',
    rows: [
      ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'ProjectName', 'SiteName', 'LinearUnits', 'AreaUnits', 'VolumeUnits'],
      [esc(doc.name), createdBy, createdOn, 'Facility', esc(doc.name), 'n/a', 'millimeters', 'squaremeters', 'cubicmeters'],
    ],
  };
}

function buildFloorSheet(
  levels: LevelSchema[],
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'Elevation', 'Height'];
  const rows = levels.map((lv) => [esc(lv.name), createdBy, createdOn, 'Floor', String(lv.elevation), String(lv.height)]);
  return { name: 'Floor', rows: [header, ...rows] };
}

function buildSpaceSheet(
  elements: ElementSchema[],
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'FloorName', 'Description', 'GrossArea', 'NetArea'];
  const spaces = elements.filter((e) => e.type === 'space');
  const rows = spaces.map((sp) => {
    const name = String(sp.properties?.Name?.value ?? sp.id);
    const area = String(sp.properties?.Area?.value ?? 0);
    return [esc(name), createdBy, createdOn, 'Space', sp.levelId ?? 'n/a', esc(name), area, area];
  });
  return { name: 'Space', rows: [header, ...rows] };
}

function buildZoneSheet(
  layers: Array<{ id: string; name: string }>,
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'SpaceNames'];
  const rows = layers.map((ly) => [esc(ly.name), createdBy, createdOn, 'Zone', 'n/a']);
  return { name: 'Zone', rows: [header, ...rows] };
}

function buildTypeSheet(
  materials: Array<{ id: string; name: string; category: string }>,
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'Description'];
  const rows = materials.map((m) => [esc(m.name), createdBy, createdOn, esc(m.category), esc(m.name)]);
  return { name: 'Type', rows: [header, ...rows] };
}

function buildComponentSheet(
  elements: ElementSchema[],
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'TypeName', 'Space', 'Description'];
  const physical: ElementSchema[] = elements.filter((e) =>
    ['wall', 'door', 'window', 'slab', 'roof', 'column', 'beam', 'stair', 'ramp'].includes(e.type),
  );
  const rows = physical.map((el) => {
    const name = String(el.properties?.Name?.value ?? el.id);
    return [esc(name), createdBy, createdOn, el.type, el.levelId ?? 'n/a', esc(name)];
  });
  return { name: 'Component', rows: [header, ...rows] };
}

function buildSystemSheet(
  elements: ElementSchema[],
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'ComponentNames'];
  const mep = elements.filter((e) =>
    ['duct', 'pipe', 'cable_tray', 'conduit', 'mechanical_equipment', 'plumbing_fixture', 'electrical_equipment'].includes(e.type),
  );
  const rows = mep.map((el) => {
    const name = String(el.properties?.Name?.value ?? el.id);
    return [esc(name), createdBy, createdOn, el.type, esc(name)];
  });
  return { name: 'System', rows: [header, ...rows] };
}

function buildAttributeSheet(
  elements: ElementSchema[],
  createdBy: string,
  createdOn: string,
): CobieSheet {
  const header = ['Name', 'CreatedBy', 'CreatedOn', 'Category', 'SheetName', 'RowName', 'Value', 'Unit'];
  const rows: string[][] = [];
  for (const el of elements) {
    for (const [key, pv] of Object.entries(el.properties ?? {})) {
      rows.push([
        esc(key),
        createdBy,
        createdOn,
        'Attribute',
        'Component',
        esc(String(el.properties?.Name?.value ?? el.id)),
        esc(String(pv.value)),
        esc(pv.unit ?? 'n/a'),
      ]);
    }
  }
  return { name: 'Attribute', rows: [header, ...rows] };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(cells: string[]): string {
  return cells.join(',');
}
