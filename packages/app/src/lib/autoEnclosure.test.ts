/**
 * #453: Unit tests for auto-detect floor/roof from closed wall footprint.
 */
import { describe, it, expect } from 'vitest';
import {
  autoEnclosure,
  computeFootprint,
  polygonCentroid,
  isPointInPolygon,
  isClosedLoop,
  DEFAULT_FLOOR_THICKNESS_MM,
  DEFAULT_ROOF_THICKNESS_MM,
  type WallSegment,
} from './autoEnclosure';

function makeSquare(size = 5000): WallSegment[] {
  const pts = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  return pts.map((p, i) => ({
    id: `w${i}`,
    start: p,
    end: pts[(i + 1) % pts.length]!,
    thickness: 200,
    height: 2700,
    levelId: 'lvl-1',
    layerId: 'lay-1',
  }));
}

describe('#453: computeFootprint()', () => {
  it('extracts vertices from segment starts', () => {
    const fp = computeFootprint(makeSquare());
    expect(fp.vertices).toHaveLength(4);
  });

  it('computes correct area for 5m×5m square (25 m²)', () => {
    const fp = computeFootprint(makeSquare(5000));
    // 5000mm × 5000mm = 25,000,000 mm²
    expect(fp.areaMm2).toBeCloseTo(25_000_000, -3);
  });

  it('computes correct perimeter for 5m×5m square (20 m)', () => {
    const fp = computeFootprint(makeSquare(5000));
    expect(fp.perimeterMm).toBeCloseTo(20_000, -3);
  });
});

describe('#453: autoEnclosure()', () => {
  it('returns floor and roof specs', () => {
    const result = autoEnclosure(makeSquare(), 0, 2700);
    expect(result.floor.type).toBe('floor');
    expect(result.roof.type).toBe('roof');
  });

  it('floor elevation equals level elevation', () => {
    const result = autoEnclosure(makeSquare(), 3000, 2700);
    expect(result.floor.elevationMm).toBe(3000);
  });

  it('roof elevation = levelElevation + wallHeight', () => {
    const result = autoEnclosure(makeSquare(), 3000, 2700);
    expect(result.roof.elevationMm).toBe(5700);
  });

  it('floor thickness defaults to DEFAULT_FLOOR_THICKNESS_MM', () => {
    expect(autoEnclosure(makeSquare()).floor.thickness).toBe(DEFAULT_FLOOR_THICKNESS_MM);
  });

  it('roof thickness defaults to DEFAULT_ROOF_THICKNESS_MM', () => {
    expect(autoEnclosure(makeSquare()).roof.thickness).toBe(DEFAULT_ROOF_THICKNESS_MM);
  });

  it('custom thickness respected', () => {
    const result = autoEnclosure(makeSquare(), 0, 2700, { floorThickness: 400, roofThickness: 500 });
    expect(result.floor.thickness).toBe(400);
    expect(result.roof.thickness).toBe(500);
  });

  it('roof type defaults to flat', () => {
    expect(autoEnclosure(makeSquare()).roof.roofType).toBe('flat');
  });

  it('level and layer ids are inherited from segments', () => {
    const result = autoEnclosure(makeSquare());
    expect(result.floor.levelId).toBe('lvl-1');
    expect(result.floor.layerId).toBe('lay-1');
  });

  it('polygon has the correct area', () => {
    const result = autoEnclosure(makeSquare(5000));
    expect(result.polygon.areaMm2).toBeCloseTo(25_000_000, -3);
  });
});

describe('#453: polygonCentroid()', () => {
  it('centroid of a 5000×5000 square is at (2500, 2500)', () => {
    const c = polygonCentroid([
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 5000 },
      { x: 0, y: 5000 },
    ]);
    expect(c.x).toBeCloseTo(2500);
    expect(c.y).toBeCloseTo(2500);
  });
});

describe('#453: isPointInPolygon()', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

  it('centre point is inside', () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
  });

  it('outside point is outside', () => {
    expect(isPointInPolygon({ x: 200, y: 200 }, square)).toBe(false);
  });
});

describe('#453: isClosedLoop()', () => {
  it('closed square is a valid loop', () => {
    expect(isClosedLoop(makeSquare())).toBe(true);
  });

  it('only 2 segments is not valid', () => {
    const segs = makeSquare().slice(0, 2);
    expect(isClosedLoop(segs)).toBe(false);
  });

  it('open chain (last end ≠ first start) is not a loop', () => {
    const segs = makeSquare();
    segs[segs.length - 1] = { ...segs[segs.length - 1]!, end: { x: 9999, y: 9999 } };
    expect(isClosedLoop(segs)).toBe(false);
  });
});
