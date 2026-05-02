/**
 * T-ANA-09 (#427): Constrained space-planning test-fit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  runTestFit,
  totalProgrammeArea,
  programmeFitsInBbox,
  roomTypeSummary,
  DEFAULT_CIRCULATION_FACTOR,
  type RoomProgram,
} from './spacePlanner';

const officeRooms: RoomProgram[] = [
  { id: 'r1', name: 'Open Office',   targetAreaM2: 200, minWidthM: 5, minDepthM: 5, type: 'office' },
  { id: 'r2', name: 'Meeting Room',  targetAreaM2: 30,  minWidthM: 3, minDepthM: 3, type: 'meeting' },
  { id: 'r3', name: 'Reception',     targetAreaM2: 20,  minWidthM: 3, minDepthM: 3, type: 'circulation' },
];

describe('T-ANA-09: runTestFit()', () => {
  it('places at least one room in a generous bbox', () => {
    const result = runTestFit(officeRooms, 50, 50);
    expect(result.placements.length).toBeGreaterThan(0);
  });

  it('placements have valid x,y coordinates', () => {
    const result = runTestFit(officeRooms, 50, 50);
    for (const p of result.placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('no placement overlaps the bounding box width', () => {
    const result = runTestFit(officeRooms, 50, 50);
    for (const p of result.placements) {
      expect(p.x + p.width).toBeLessThanOrEqual(50 + 0.01);
    }
  });

  it('efficiency is between 0 and 1', () => {
    const result = runTestFit(officeRooms, 50, 50);
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });

  it('returns unplacedRooms when bbox is too small', () => {
    const result = runTestFit(officeRooms, 3, 3);
    expect(result.unplacedRooms.length).toBeGreaterThan(0);
  });

  it('usedAreaM2 > 0 when rooms are placed', () => {
    const result = runTestFit(officeRooms, 50, 50);
    expect(result.usedAreaM2).toBeGreaterThan(0);
  });

  it('returns empty placements for empty room list', () => {
    const result = runTestFit([], 50, 50);
    expect(result.placements).toHaveLength(0);
    expect(result.usedAreaM2).toBe(0);
  });
});

describe('T-ANA-09: totalProgrammeArea()', () => {
  it('sums all target areas', () => {
    expect(totalProgrammeArea(officeRooms)).toBeCloseTo(250, 1);
  });

  it('returns 0 for empty list', () => {
    expect(totalProgrammeArea([])).toBe(0);
  });
});

describe('T-ANA-09: programmeFitsInBbox()', () => {
  it('true when bbox is large enough', () => {
    expect(programmeFitsInBbox(officeRooms, 30, 20)).toBe(true);
  });

  it('false when bbox is too small', () => {
    expect(programmeFitsInBbox(officeRooms, 5, 5)).toBe(false);
  });

  it('DEFAULT_CIRCULATION_FACTOR is applied', () => {
    expect(DEFAULT_CIRCULATION_FACTOR).toBeGreaterThan(0);
    expect(DEFAULT_CIRCULATION_FACTOR).toBeLessThan(1);
  });
});

describe('T-ANA-09: roomTypeSummary()', () => {
  it('groups rooms by type', () => {
    const summary = roomTypeSummary(officeRooms);
    expect(summary['office']).toBeCloseTo(200, 1);
    expect(summary['meeting']).toBeCloseTo(30, 1);
  });

  it('uses unclassified for rooms without type', () => {
    const rooms: RoomProgram[] = [
      { id: 'x', name: 'X', targetAreaM2: 10, minWidthM: 2, minDepthM: 2 },
    ];
    const summary = roomTypeSummary(rooms);
    expect(summary['unclassified']).toBeCloseTo(10, 1);
  });
});
