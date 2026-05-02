/**
 * #454: IFC 4x3 horizontal and vertical alignment utilities.
 * Provides civic alignment geometry computation and IFC STEP export.
 */

export type HorizontalSegmentType = 'Line' | 'CircularArc' | 'Clothoid' | 'Cubic';

export interface HorizontalCurveSegment {
  segmentType: HorizontalSegmentType;
  startPoint: { x: number; y: number };
  direction: number; // radians, azimuth at start
  length: number;
  radius?: number;
  clothoidConstant?: number;
}

export interface VerticalCurveSegment {
  startStation: number;
  startElevation: number;
  grade1: number; // start grade (ratio, e.g. 0.05 = 5%)
  grade2: number; // end grade
  length: number;
}

export interface CivicAlignment {
  id: string;
  name: string;
  horizontalSegments: HorizontalCurveSegment[];
  verticalSegments: VerticalCurveSegment[];
}

export function totalHorizontalLength(alignment: CivicAlignment): number {
  return alignment.horizontalSegments.reduce((sum, seg) => sum + seg.length, 0);
}

/**
 * Returns the total arc length up to each segment's start.
 */
function horizontalStations(alignment: CivicAlignment): number[] {
  const stations: number[] = [];
  let s = 0;
  for (const seg of alignment.horizontalSegments) {
    stations.push(s);
    s += seg.length;
  }
  return stations;
}

/**
 * Computes the (x, y) point on a horizontal alignment at a given station.
 * For Lines: simple straight-line interpolation.
 * For CircularArcs: arc interpolation.
 * For Clothoid / Cubic: linear approximation (simplified).
 */
function computeHorizontalPoint(
  alignment: CivicAlignment,
  station: number,
): { x: number; y: number; direction: number } {
  const stations = horizontalStations(alignment);

  let currentPoint = { x: 0, y: 0 };
  let currentDirection = 0;

  if (alignment.horizontalSegments.length > 0) {
    currentPoint = { ...alignment.horizontalSegments[0].startPoint };
    currentDirection = alignment.horizontalSegments[0].direction;
  }

  for (let i = 0; i < alignment.horizontalSegments.length; i++) {
    const seg = alignment.horizontalSegments[i];
    const segStart = stations[i];
    const segEnd = segStart + seg.length;

    if (station <= segEnd || i === alignment.horizontalSegments.length - 1) {
      const ds = Math.min(station, segEnd) - segStart;

      if (seg.segmentType === 'Line') {
        currentPoint = {
          x: seg.startPoint.x + Math.sin(seg.direction) * ds,
          y: seg.startPoint.y + Math.cos(seg.direction) * ds,
        };
        currentDirection = seg.direction;
      } else if (seg.segmentType === 'CircularArc') {
        const r = seg.radius ?? 1;
        // Angle swept
        const theta = ds / r;
        const dir = seg.direction;
        // Centre of arc
        const cx = seg.startPoint.x - r * Math.cos(dir);
        const cy = seg.startPoint.y + r * Math.sin(dir);
        const newAngle = dir - Math.PI / 2 + theta;
        currentPoint = {
          x: cx + r * Math.cos(newAngle - Math.PI / 2 + Math.PI),
          y: cy + r * Math.sin(newAngle - Math.PI / 2 + Math.PI),
        };
        // Approximation: linear direction change
        currentDirection = dir + theta;
      } else {
        // Clothoid / Cubic: linear approximation
        currentPoint = {
          x: seg.startPoint.x + Math.sin(seg.direction) * ds,
          y: seg.startPoint.y + Math.cos(seg.direction) * ds,
        };
        currentDirection = seg.direction;
      }
      break;
    }
  }

  return { ...currentPoint, direction: currentDirection };
}

/**
 * Returns the vertical elevation at a given station.
 * Parabolic vertical curve formula: y = y0 + g1*x + (g2-g1)/(2L) * x^2
 */
function computeElevation(alignment: CivicAlignment, station: number): number {
  if (alignment.verticalSegments.length === 0) return 0;

  for (const seg of alignment.verticalSegments) {
    const segEnd = seg.startStation + seg.length;
    if (station >= seg.startStation && (station <= segEnd || seg === alignment.verticalSegments[alignment.verticalSegments.length - 1])) {
      const x = Math.min(station, segEnd) - seg.startStation;
      return seg.startElevation + seg.grade1 * x + ((seg.grade2 - seg.grade1) / (2 * seg.length)) * x * x;
    }
  }

  // Before first segment
  const first = alignment.verticalSegments[0];
  return first.startElevation + first.grade1 * (station - first.startStation);
}

export function computePointOnAlignment(
  alignment: CivicAlignment,
  station: number,
): { x: number; y: number; z: number } {
  const horizontal = computeHorizontalPoint(alignment, station);
  const z = computeElevation(alignment, station);
  return { x: horizontal.x, y: horizontal.y, z };
}

export function gradeAtStation(alignment: CivicAlignment, station: number): number {
  if (alignment.verticalSegments.length === 0) return 0;

  for (const seg of alignment.verticalSegments) {
    const segEnd = seg.startStation + seg.length;
    if (station >= seg.startStation && (station <= segEnd || seg === alignment.verticalSegments[alignment.verticalSegments.length - 1])) {
      const x = Math.min(station, segEnd) - seg.startStation;
      // Derivative of parabola: g1 + (g2-g1)/L * x
      return seg.grade1 + ((seg.grade2 - seg.grade1) / seg.length) * x;
    }
  }

  return alignment.verticalSegments[0].grade1;
}

export function buildIFC4x3AlignmentStep(alignment: CivicAlignment): string {
  const lines: string[] = [];
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('IFC4X3 CivicAlignment - ${alignment.name}'),'2;1');`);
  lines.push("FILE_NAME('','',(''),(''),'','','');");
  lines.push("FILE_SCHEMA(('IFC4X3'));");
  lines.push('ENDSEC;');
  lines.push('DATA;');

  let entityId = 1;
  const alignId = entityId++;
  const hCurveId = entityId++;

  const segIds: number[] = [];
  for (const seg of alignment.horizontalSegments) {
    const id = entityId++;
    segIds.push(id);
    const dirDeg = ((seg.direction * 180) / Math.PI).toFixed(6);
    const x = seg.startPoint.x.toFixed(3);
    const y = seg.startPoint.y.toFixed(3);
    const len = seg.length.toFixed(3);

    switch (seg.segmentType) {
      case 'Line':
        lines.push(`#${id}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${x},${y})),${dirDeg},0.,${len},.LINE.,$,$);`);
        break;
      case 'CircularArc':
        lines.push(`#${id}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${x},${y})),${dirDeg},${(seg.radius ?? 0).toFixed(3)},${len},.CIRCULARARC.,$,$);`);
        break;
      case 'Clothoid':
        lines.push(`#${id}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${x},${y})),${dirDeg},$,${len},.CLOTHOID.,${(seg.clothoidConstant ?? 0).toFixed(3)},$);`);
        break;
      case 'Cubic':
        lines.push(`#${id}=IFCALIGNMENTHORIZONTALSEGMENT($,$,IFCCARTESIANPOINT((${x},${y})),${dirDeg},$,${len},.CUBIC.,$,$);`);
        break;
    }
  }

  // Vertical segments
  const vSegIds: number[] = [];
  for (const seg of alignment.verticalSegments) {
    const id = entityId++;
    vSegIds.push(id);
    lines.push(`#${id}=IFCALIGNMENTVERTICALSEGMENT($,$,${seg.startStation.toFixed(3)},${seg.length.toFixed(3)},${seg.startElevation.toFixed(3)},${seg.grade1.toFixed(6)},${seg.grade2.toFixed(6)},.PARABOLICARC.,$);`);
  }

  const segRefs = segIds.map((id) => `#${id}`).join(',');
  lines.push(`#${hCurveId}=IFCALIGNMENTHORIZONTAL($,(${segRefs}));`);

  if (vSegIds.length > 0) {
    const vCurveId = entityId++;
    const vRefs = vSegIds.map((id) => `#${id}`).join(',');
    lines.push(`#${vCurveId}=IFCALIGNMENTVERTICAL($,(${vRefs}));`);
    lines.push(`#${alignId}=IFCALIGNMENT('${alignment.id}',$,'${alignment.name}',$,$,$,#${hCurveId},#${vCurveId});`);
  } else {
    lines.push(`#${alignId}=IFCALIGNMENT('${alignment.id}',$,'${alignment.name}',$,$,$,#${hCurveId},$);`);
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}
