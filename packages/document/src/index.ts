/**
 * OpenCAD Document Model
 *
 * CRDT-based document model for browser-native, AI-powered BIM platform.
 * Implements real-time collaboration with offline-first architecture.
 *
 * @package @opencad/document
 */

export * from './types';
export * from './document';
export * from './layer';
export * from './level';
export * from './element';
export * from './storage';
export * from './ifc';
export * from './ifcCertification';
export * from './ifcCertFixtures';
export * from './versioning';
export * from './io';
export * from './material';
export * from './dwg';
export * from './pdf';
export * from './mep';
export * from './diff';
export * from './composite';
export * from './bcf';

// ArchiCAD adapter — explicit exports to avoid name collisions with ./io#detectFormat
export {
  parsePLN,
  parsePLA,
  parseGDL,
  type PLAObject,
} from './archicad';

// Revit adapter
export { parseRVT } from './revit';

// SketchUp adapter
export { parseSKP, serializeSKP } from './sketchup';

// gbXML 6.01 export (T-IO-02)
export { exportGbXML, type GbXMLExportOptions } from './gbxml';

// COBie 2.4 export (T-IO-03)
export { exportCOBie, cobieToCSVMap, type CobieSheet, type CobieExportOptions } from './cobie';

// Rhino 3DM import/export (T-IO-04)
export { importRhino3dm, exportRhino3dm, type Rhino3dmImportResult, type Rhino3dmExportResult } from './rhino3dm';

// USD / USDZ export (T-IO-05)
export { exportUSDA, buildUSDZPayload, type USDExportOptions, type USDZPayload } from './usd';

// IFC 4.3 ADD2 Reference View export (T-IO-01)
export { exportIFC43, type IFC43ExportOptions } from './ifc';
