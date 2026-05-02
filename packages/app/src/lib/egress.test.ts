/**
 * T-ANA-02: Unit tests for IBC 2021 occupant load + egress checker.
 */
import { describe, it, expect } from 'vitest';
import {
  IBC_OCCUPANT_FACTORS,
  occupantLoad,
  requiredExits,
  minCorridorWidth,
  minDoorWidth,
  checkTravelDistance,
  TRAVEL_DISTANCE_LIMITS,
  bfsToExit,
  checkSpaceEgress,
} from './egress';

describe('T-ANA-02: occupant load factors', () => {
  it('IBC_OCCUPANT_FACTORS has business entry', () => {
    expect(IBC_OCCUPANT_FACTORS['business']).toBeDefined();
    expect(IBC_OCCUPANT_FACTORS['business']!.m2PerOccupant).toBeCloseTo(9.3, 1);
  });

  it('assembly-standing-space uses gross area', () => {
    expect(IBC_OCCUPANT_FACTORS['assembly-standing-space']!.basis).toBe('gross');
  });
});

describe('T-ANA-02: occupantLoad()', () => {
  it('calculates business occupancy', () => {
    // 93 m² / 9.3 = 10 occupants
    expect(occupantLoad(93, 'business')).toBe(10);
  });

  it('rounds up fractional occupants', () => {
    // 10 m² / 9.3 = 1.07... → 2
    expect(occupantLoad(10, 'business')).toBe(2);
  });

  it('uses fallback factor for unknown type', () => {
    const known   = occupantLoad(100, 'other');
    const unknown = occupantLoad(100, 'xyz-nonexistent');
    expect(known).toBe(unknown);
  });

  it('returns 0 for zero area', () => {
    expect(occupantLoad(0, 'business')).toBe(0);
  });
});

describe('T-ANA-02: requiredExits()', () => {
  it('1 exit for ≤ 49 occupants', () => {
    expect(requiredExits(49)).toBe(1);
    expect(requiredExits(1)).toBe(1);
  });

  it('2 exits for 50-500 occupants', () => {
    expect(requiredExits(50)).toBe(2);
    expect(requiredExits(500)).toBe(2);
  });

  it('3 exits for 501-1000 occupants', () => {
    expect(requiredExits(501)).toBe(3);
    expect(requiredExits(1000)).toBe(3);
  });

  it('4 exits for >1000 occupants', () => {
    expect(requiredExits(1001)).toBe(4);
  });

  it('returns 1 for zero occupants', () => {
    expect(requiredExits(0)).toBe(1);
  });
});

describe('T-ANA-02: minimum widths', () => {
  it('minCorridorWidth is at least 1118 mm (44 in)', () => {
    expect(minCorridorWidth(1)).toBeGreaterThanOrEqual(1118);
    expect(minCorridorWidth(0)).toBe(1118);
  });

  it('minCorridorWidth scales with occupant load', () => {
    const small = minCorridorWidth(50);
    const large = minCorridorWidth(500);
    expect(large).toBeGreaterThan(small);
  });

  it('minDoorWidth is at least 813 mm (32 in)', () => {
    expect(minDoorWidth(1)).toBeGreaterThanOrEqual(813);
  });

  it('healthcare door is at least 1067 mm (42 in)', () => {
    expect(minDoorWidth(1, true)).toBeGreaterThanOrEqual(1067);
  });
});

describe('T-ANA-02: travel distance', () => {
  it('TRAVEL_DISTANCE_LIMITS has B (business) entry', () => {
    expect(TRAVEL_DISTANCE_LIMITS['B']).toBeDefined();
    expect(TRAVEL_DISTANCE_LIMITS['B']!.unsprinklered).toBeGreaterThan(0);
  });

  it('compliant when within limit', () => {
    const r = checkTravelDistance(30000, 'B', false);
    expect(r.compliant).toBe(true);
    expect(r.excess).toBe(0);
  });

  it('non-compliant when over limit', () => {
    const r = checkTravelDistance(100000, 'B', false);
    expect(r.compliant).toBe(false);
    expect(r.excess).toBeGreaterThan(0);
  });

  it('sprinklered limit is higher than unsprinklered', () => {
    const us = TRAVEL_DISTANCE_LIMITS['B']!.unsprinklered;
    const sp = TRAVEL_DISTANCE_LIMITS['B']!.sprinklered;
    expect(sp).toBeGreaterThan(us);
  });

  it('uses B limits for unknown occupancy group', () => {
    const r = checkTravelDistance(50000, 'X_UNKNOWN', false);
    expect(r.limit).toBe(TRAVEL_DISTANCE_LIMITS['B']!.unsprinklered);
  });
});

describe('T-ANA-02: BFS egress path', () => {
  function makeSimpleGraph() {
    return {
      nodes: [
        { id: 'room',      x: 0,   y: 0,   isExit: false },
        { id: 'corridor',  x: 5,   y: 0,   isExit: false },
        { id: 'stairwell', x: 10,  y: 0,   isExit: false },
        { id: 'exit',      x: 15,  y: 0,   isExit: true  },
      ],
      edges: [
        { from: 'room',      to: 'corridor',  distanceMm: 5000 },
        { from: 'corridor',  to: 'stairwell', distanceMm: 5000 },
        { from: 'stairwell', to: 'exit',      distanceMm: 5000 },
      ],
    };
  }

  it('finds a path to exit', () => {
    const result = bfsToExit(makeSimpleGraph(), 'room');
    expect(result.reachable).toBe(true);
    expect(result.path).toContain('exit');
  });

  it('path starts at origin', () => {
    const result = bfsToExit(makeSimpleGraph(), 'room');
    expect(result.path[0]).toBe('room');
  });

  it('path ends at exit', () => {
    const result = bfsToExit(makeSimpleGraph(), 'room');
    expect(result.path[result.path.length - 1]).toBe('exit');
  });

  it('total distance is sum of edge weights', () => {
    const result = bfsToExit(makeSimpleGraph(), 'room');
    expect(result.totalDistanceMm).toBeCloseTo(15000, 0);
  });

  it('returns reachable=false when no exit exists', () => {
    const graph = {
      nodes: [
        { id: 'room', x: 0, y: 0, isExit: false },
        { id: 'hall', x: 5, y: 0, isExit: false },
      ],
      edges: [{ from: 'room', to: 'hall', distanceMm: 5000 }],
    };
    const result = bfsToExit(graph, 'room');
    expect(result.reachable).toBe(false);
  });

  it('prefers shorter path when two exits exist', () => {
    const graph = {
      nodes: [
        { id: 'room',    x: 0,  y: 0, isExit: false },
        { id: 'exit-a',  x: 5,  y: 0, isExit: true  },
        { id: 'exit-b',  x: 20, y: 0, isExit: true  },
      ],
      edges: [
        { from: 'room', to: 'exit-a', distanceMm: 5000 },
        { from: 'room', to: 'exit-b', distanceMm: 20000 },
      ],
    };
    const result = bfsToExit(graph, 'room');
    expect(result.totalDistanceMm).toBe(5000);
    expect(result.path).toContain('exit-a');
  });
});

describe('T-ANA-02: checkSpaceEgress()', () => {
  const baseInput = {
    id: 'office-1',
    areaSqM: 186,     // 186 m² / 9.3 = 20 occupants
    occupancyGroup: 'B',
    occupancyClass: 'business',
    exitsProvided: 2,
    travelDistanceMm: 30000,
    sprinklered: false,
  };

  it('compliant office passes all checks', () => {
    const result = checkSpaceEgress(baseInput);
    expect(result.exitsCompliant).toBe(true);
    expect(result.travelCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags insufficient exits', () => {
    const result = checkSpaceEgress({ ...baseInput, exitsProvided: 0 });
    expect(result.exitsCompliant).toBe(false);
    expect(result.issues.some((i) => i.includes('exit'))).toBe(true);
  });

  it('flags excessive travel distance', () => {
    const result = checkSpaceEgress({ ...baseInput, travelDistanceMm: 150000 });
    expect(result.travelCompliant).toBe(false);
    expect(result.issues.some((i) => i.toLowerCase().includes('travel'))).toBe(true);
  });

  it('calculates correct occupant load', () => {
    const result = checkSpaceEgress(baseInput);
    expect(result.occupantLoad).toBe(20);
  });

  it('calculates required exits based on occupant load', () => {
    const result = checkSpaceEgress(baseInput);
    expect(result.requiredExits).toBe(1); // 20 occ → 1 exit required
  });
});
