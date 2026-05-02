/**
 * T-IO-V2-05: IFC 4.3 MVD utilities.
 * Alignment geometry support for IFC 4.3 Reference View and Design Transfer View.
 */

export type MVDType = 'IfcReferenceView' | 'IfcDesignTransferView' | 'IfcAlignment';

export interface IFC43AlignmentSegment {
  id: string;
  segmentType: 'Line' | 'Arc' | 'Clothoid';
  startStation: number;
  length: number;
  startX: number;
  startY: number;
  azimuthRad: number;
  radius?: number;
}

export interface IFC43HorizontalAlignment {
  id: string;
  segments: IFC43AlignmentSegment[];
  name: string;
}

export function validateAlignment(alignment: IFC43HorizontalAlignment): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!alignment.id || alignment.id.trim() === '') {
    errors.push("Alignment 'id' must be a non-empty string");
  }
  if (!alignment.name || alignment.name.trim() === '') {
    errors.push("Alignment 'name' must be a non-empty string");
  }
  if (!Array.isArray(alignment.segments)) {
    errors.push("Alignment 'segments' must be an array");
  } else {
    alignment.segments.forEach((seg, i) => {
      if (!seg.id || seg.id.trim() === '') {
        errors.push(`Segment at index ${i} missing 'id'`);
      }
      if (!['Line', 'Arc', 'Clothoid'].includes(seg.segmentType)) {
        errors.push(`Segment at index ${i} has invalid segmentType '${seg.segmentType}'`);
      }
      if (seg.length <= 0) {
        errors.push(`Segment at index ${i} length must be positive`);
      }
      if (seg.segmentType === 'Arc' && (seg.radius === undefined || seg.radius === 0)) {
        errors.push(`Arc segment at index ${i} must have non-zero radius`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function computeAlignmentLength(alignment: IFC43HorizontalAlignment): number {
  return alignment.segments.reduce((sum, seg) => sum + seg.length, 0);
}

export function buildAlignmentIFC(alignment: IFC43HorizontalAlignment): string {
  const lines: string[] = [];
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('IFC4X3 Alignment - ${alignment.name}'),'2;1');`);
  lines.push("FILE_NAME('','',(''),(''),'','','');");
  lines.push("FILE_SCHEMA(('IFC4X3'));");
  lines.push('ENDSEC;');
  lines.push('DATA;');

  let entityId = 1;
  const alignmentEntityId = entityId++;
  const curveEntityId = entityId++;

  // Write segment entities
  const segmentIds: number[] = [];
  for (const seg of alignment.segments) {
    const segId = entityId++;
    segmentIds.push(segId);
    const azDeg = ((seg.azimuthRad * 180) / Math.PI).toFixed(6);

    if (seg.segmentType === 'Line') {
      lines.push(`#${segId}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${seg.startX.toFixed(3)},${seg.startY.toFixed(3)})),${azDeg},0.,${seg.length.toFixed(3)},.LINE.,$,$);`);
    } else if (seg.segmentType === 'Arc') {
      const r = seg.radius ?? 0;
      lines.push(`#${segId}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${seg.startX.toFixed(3)},${seg.startY.toFixed(3)})),${azDeg},${r.toFixed(3)},${seg.length.toFixed(3)},.CIRCULARARC.,$,$);`);
    } else {
      // Clothoid
      lines.push(`#${segId}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${seg.startX.toFixed(3)},${seg.startY.toFixed(3)})),${azDeg},$,${seg.length.toFixed(3)},.CLOTHOID.,$,$);`);
    }
  }

  const segRefs = segmentIds.map((id) => `#${id}`).join(',');
  lines.push(`#${curveEntityId}=IFCALIGNMENTHORIZONTAL($,(${segRefs}));`);
  lines.push(`#${alignmentEntityId}=IFCALIGNMENT('${alignment.id}',$,'${alignment.name}',$,$,$,#${curveEntityId},$);`);

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}
