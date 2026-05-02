/**
 * T-IO-02: gbXML 6.01 export — energy model exchange format for energy
 * analysis tools (IES-VE, EnergyPlus, OpenStudio, eQUEST).
 *
 * Spec: https://www.gbxml.org/schema
 */
import type { DocumentSchema, ElementSchema } from './types';

export interface GbXMLExportOptions {
  /** Scale factor from document units (mm) to metres. Default 0.001. */
  metersPerUnit?: number;
  /** Override ASHRAE space-type string. */
  defaultSpaceType?: string;
}

/** Export a DocumentSchema as a gbXML 6.01 string. */
export function exportGbXML(
  doc: DocumentSchema,
  opts: GbXMLExportOptions = {},
): string {
  const scale = opts.metersPerUnit ?? 0.001;
  const spaceType = opts.defaultSpaceType ?? 'Office';

  const levels = Object.values(doc.organization.levels ?? {});
  const elements = Object.values(doc.content.elements ?? {});

  const spaces     = elements.filter((e) => e.type === 'space');
  const walls      = elements.filter((e) => e.type === 'wall');
  const slabs      = elements.filter((e) => e.type === 'slab' || e.type === 'roof');
  // openings (door/window/skylight) are future: gbXML Opening element not yet emitted
  // const openings = elements.filter((e) => e.type === 'door' || e.type === 'window' || e.type === 'skylight');

  const storeys = levels.map((lv) => `
    <BuildingStorey id="Storey_${lv.id}" buildingIdRef="Building_1">
      <Name>${escXml(lv.name)}</Name>
      <Level>${(lv.elevation * scale).toFixed(3)}</Level>
    </BuildingStorey>`).join('');

  const spaceXml = spaces.map((sp) => buildSpaceXml(sp, scale, spaceType)).join('');
  const surfaceXml = [
    ...walls.map((w) => buildWallSurfaceXml(w, scale)),
    ...slabs.map((s) => buildSlabSurfaceXml(s, scale)),
  ].join('');
  const constructionXml = buildDefaultConstructions();

  return `<?xml version="1.0" encoding="UTF-8"?>
<gbXML version="6.01" xmlns="http://www.gbxml.org/schema"
       temperatureUnit="C" lengthUnit="Meters" areaUnit="SquareMeters"
       volumeUnit="CubicMeters" useSIUnitsForResults="true">
  <Campus id="Campus_1">
    <Name>${escXml(doc.name)}</Name>
    <Building id="Building_1" buildingType="Office">
      <Name>${escXml(doc.name)}</Name>
      <Description>${escXml(doc.name)} — exported from OpenCAD</Description>
      <Area>${computeBuildingArea(spaces, scale).toFixed(3)}</Area>
${storeys}
${spaceXml}
${surfaceXml}
    </Building>
  </Campus>
${constructionXml}
</gbXML>`;
}

// ── Element serialisers ──────────────────────────────────────────────────────

function buildSpaceXml(el: ElementSchema, scale: number, spaceType: string): string {
  const name = String(el.properties?.Name?.value ?? el.id);
  const area = Number(el.properties?.Area?.value ?? 0) * scale * scale;
  const vol  = Number(el.properties?.Volume?.value ?? 0) * scale * scale * scale;
  const lpd  = Number(el.properties?.LPD?.value ?? 10);  // W/m²
  const epd  = Number(el.properties?.EPD?.value ?? 10);  // W/m²
  const levelRef = el.levelId ? ` buildingStoreyIdRef="Storey_${el.levelId}"` : '';
  return `
    <Space id="Space_${el.id}"${levelRef} spaceType="${escXml(spaceType)}">
      <Name>${escXml(name)}</Name>
      <Area>${area.toFixed(3)}</Area>
      <Volume>${vol.toFixed(3)}</Volume>
      <LightingControl type="Manual" fractionControlled="1.0"/>
      <LightPowerPerArea unit="WattPerSquareMeter">${lpd.toFixed(2)}</LightPowerPerArea>
      <EquipPowerPerArea unit="WattPerSquareMeter">${epd.toFixed(2)}</EquipPowerPerArea>
    </Space>`;
}

function buildWallSurfaceXml(el: ElementSchema, scale: number): string {
  const bb = el.boundingBox;
  if (!bb) return '';
  const w = (bb.max.x - bb.min.x) * scale;
  const h = (bb.max.z - bb.min.z) * scale;
  const area = w * h;
  return `
    <Surface id="Wall_${el.id}" surfaceType="ExteriorWall" constructionIdRef="DefaultWallConstruction">
      <Name>Wall ${el.id}</Name>
      <Area>${area.toFixed(3)}</Area>
      <RectangularGeometry>
        <Azimuth>0</Azimuth>
        <Tilt>90</Tilt>
        <Width>${w.toFixed(3)}</Width>
        <Height>${h.toFixed(3)}</Height>
      </RectangularGeometry>
    </Surface>`;
}

function buildSlabSurfaceXml(el: ElementSchema, scale: number): string {
  const bb = el.boundingBox;
  if (!bb) return '';
  const w = (bb.max.x - bb.min.x) * scale;
  const d = (bb.max.y - bb.min.y) * scale;
  const area = w * d;
  const type = el.type === 'roof' ? 'Roof' : 'InteriorFloor';
  return `
    <Surface id="Slab_${el.id}" surfaceType="${type}" constructionIdRef="DefaultSlabConstruction">
      <Name>${el.type === 'roof' ? 'Roof' : 'Slab'} ${el.id}</Name>
      <Area>${area.toFixed(3)}</Area>
      <RectangularGeometry>
        <Azimuth>0</Azimuth>
        <Tilt>${el.type === 'roof' ? 0 : 180}</Tilt>
        <Width>${w.toFixed(3)}</Width>
        <Height>${d.toFixed(3)}</Height>
      </RectangularGeometry>
    </Surface>`;
}

function buildDefaultConstructions(): string {
  return `
  <Construction id="DefaultWallConstruction">
    <Name>Default Wall</Name>
    <U-Value unit="WPerSquareMeterK">0.35</U-Value>
  </Construction>
  <Construction id="DefaultSlabConstruction">
    <Name>Default Slab</Name>
    <U-Value unit="WPerSquareMeterK">0.25</U-Value>
  </Construction>`;
}

function computeBuildingArea(spaces: ElementSchema[], scale: number): number {
  return spaces.reduce((sum, sp) => {
    const a = Number(sp.properties?.Area?.value ?? 0);
    return sum + a * scale * scale;
  }, 0);
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
