/**
 * T-ANA-02: Occupant-load and egress-path checker (IBC 2021).
 *
 * Implements:
 *   - Occupant load factors from IBC Table 1004.5
 *   - Occupant load calculation per space
 *   - Required number of exits (IBC Section 1006)
 *   - Minimum corridor width (IBC Section 1005.1)
 *   - Maximum travel distance to exit (IBC Table 1017.2)
 *   - Egress path graph: BFS shortest path to nearest exit
 *
 * Reference: IBC 2021 Chapters 10–11
 */

// ── Occupant load factors (IBC Table 1004.5) ─────────────────────────────────

/** Gross or net area basis for an occupant load factor. */
export type AreaBasis = 'gross' | 'net';

export interface OccupantLoadFactor {
  /** m² per occupant */
  m2PerOccupant: number;
  basis: AreaBasis;
}

/**
 * IBC Table 1004.5 — Occupant load factors.
 * Keys are normalised occupancy classification strings.
 */
export const IBC_OCCUPANT_FACTORS: Record<string, OccupantLoadFactor> = {
  // Assembly
  'assembly-less-fixed-seats':  { m2PerOccupant: 0.65, basis: 'gross' },
  'assembly-standing-space':    { m2PerOccupant: 0.46, basis: 'gross' },
  'assembly-unconcentrated-tables': { m2PerOccupant: 1.39, basis: 'net' },
  'assembly-concentrated':      { m2PerOccupant: 0.65, basis: 'net' },
  'assembly-fixed-seating':     { m2PerOccupant: 0, basis: 'net' }, // use seat count
  'assembly-gaming':            { m2PerOccupant: 1.02, basis: 'gross' },

  // Business
  'business':                   { m2PerOccupant: 9.3, basis: 'gross' },

  // Educational
  'educational-classroom':      { m2PerOccupant: 1.86, basis: 'net' },
  'educational-shop':           { m2PerOccupant: 4.65, basis: 'net' },

  // Factory
  'factory-industrial':         { m2PerOccupant: 9.3, basis: 'gross' },

  // Healthcare
  'healthcare-sleeping':        { m2PerOccupant: 11.1, basis: 'gross' },
  'healthcare-treatment':       { m2PerOccupant: 22.3, basis: 'gross' },

  // Hotel / Residential
  'hotel-guestroom':            { m2PerOccupant: 18.6, basis: 'gross' },
  'residential-dwelling':       { m2PerOccupant: 18.6, basis: 'gross' },

  // Mercantile
  'mercantile-ground-floor':    { m2PerOccupant: 2.8, basis: 'gross' },
  'mercantile-upper-floors':    { m2PerOccupant: 5.6, basis: 'gross' },
  'mercantile-storage':         { m2PerOccupant: 27.9, basis: 'gross' },

  // Storage
  'storage':                    { m2PerOccupant: 46.5, basis: 'gross' },
  'parking':                    { m2PerOccupant: 18.6, basis: 'gross' },

  // Default fallback
  'other':                      { m2PerOccupant: 9.3, basis: 'gross' },
};

/** Calculate occupant load for a space. */
export function occupantLoad(areaSqM: number, occupancyClass: string): number {
  const factor = IBC_OCCUPANT_FACTORS[occupancyClass] ?? IBC_OCCUPANT_FACTORS['other']!;
  if (factor.m2PerOccupant <= 0) return 0;
  return Math.ceil(areaSqM / factor.m2PerOccupant);
}

// ── Required exits (IBC Section 1006) ────────────────────────────────────────

/**
 * Required number of means of egress from a space per IBC 1006.3.
 * Returns minimum exits required.
 */
export function requiredExits(occupantLoad: number, spaceType = 'other'): number {
  if (occupantLoad <= 0) return 1;

  // IBC 1006.3.4: Special occupancy thresholds
  const specialLimits: Record<string, number> = {
    'assembly-fixed-seating': 49,
    'assembly-concentrated':  49,
    'educational-classroom':  49,
  };
  const singleExitMax = specialLimits[spaceType] ?? 49;

  if (occupantLoad <= singleExitMax) return 1;
  if (occupantLoad <= 500)           return 2;
  if (occupantLoad <= 1000)          return 3;
  return 4;
}

// ── Minimum corridor / door widths (IBC 1005.1 / 1010.1) ─────────────────────

/**
 * Minimum corridor clear width (mm) for a given occupant load.
 * IBC 1005.1: 0.2 inches per occupant → 5.08 mm/occ, min 1118 mm (44 in).
 */
export function minCorridorWidth(occupantLoad: number): number {
  const fromOccupants = occupantLoad * 5.08;
  return Math.max(1118, fromOccupants); // mm
}

/**
 * Minimum door clear width (mm).
 * IBC 1010.1.1: min 813 mm (32 in) clear; healthcare 1067 mm (42 in).
 */
export function minDoorWidth(occupantLoad: number, isHealthcare = false): number {
  const base = isHealthcare ? 1067 : 813;
  const fromOccupants = occupantLoad * 5.08;
  return Math.max(base, fromOccupants);
}

// ── Maximum travel distances (IBC Table 1017.2) ──────────────────────────────

export interface TravelDistanceLimits {
  /** Max common path (mm) */
  commonPath: number;
  /** Max exit access travel distance (mm) without sprinklers */
  unsprinklered: number;
  /** Max exit access travel distance (mm) with sprinklers */
  sprinklered: number;
}

export const TRAVEL_DISTANCE_LIMITS: Record<string, TravelDistanceLimits> = {
  A:  { commonPath: 30480, unsprinklered: 60960, sprinklered: 76200 },  // Assembly
  B:  { commonPath: 30480, unsprinklered: 61000, sprinklered: 91440 },  // Business
  E:  { commonPath: 30480, unsprinklered: 45720, sprinklered: 91440 },  // Educational
  F1: { commonPath: 30480, unsprinklered: 60960, sprinklered: 91440 },  // Factory mod hazard
  F2: { commonPath: 30480, unsprinklered: 76200, sprinklered: 91440 },  // Factory low hazard
  H1: { commonPath: 7620,  unsprinklered: 7620,  sprinklered: 7620 },   // High hazard
  H2: { commonPath: 15240, unsprinklered: 30480, sprinklered: 30480 },
  I1: { commonPath: 30480, unsprinklered: 30480, sprinklered: 45720 },  // Institutional
  M:  { commonPath: 30480, unsprinklered: 45720, sprinklered: 91440 },  // Mercantile
  R1: { commonPath: 30480, unsprinklered: 30480, sprinklered: 53340 },  // Residential hotel
  R2: { commonPath: 30480, unsprinklered: 38100, sprinklered: 53340 },  // Residential dwelling
  S1: { commonPath: 30480, unsprinklered: 45720, sprinklered: 91440 },  // Storage mod hazard
  S2: { commonPath: 30480, unsprinklered: 60960, sprinklered: 91440 },  // Storage low hazard
};

/** Check whether a path length (mm) satisfies IBC travel distance limits. */
export function checkTravelDistance(
  travelMm: number,
  occupancyGroup: string,
  sprinklered: boolean,
): { compliant: boolean; limit: number; excess: number } {
  const limits = TRAVEL_DISTANCE_LIMITS[occupancyGroup] ?? TRAVEL_DISTANCE_LIMITS['B']!;
  const limit  = sprinklered ? limits.sprinklered : limits.unsprinklered;
  const excess = Math.max(0, travelMm - limit);
  return { compliant: excess === 0, limit, excess };
}

// ── Egress path BFS ──────────────────────────────────────────────────────────

export interface EgressNode {
  id: string;
  x: number;
  y: number;
  isExit: boolean;
}

export interface EgressEdge {
  from: string;
  to: string;
  /** Distance in mm */
  distanceMm: number;
}

export interface EgressGraph {
  nodes: EgressNode[];
  edges: EgressEdge[];
}

export interface EgressPathResult {
  /** Node ids from origin to nearest exit */
  path: string[];
  /** Total distance in mm */
  totalDistanceMm: number;
  /** true if an exit was reachable */
  reachable: boolean;
}

/**
 * BFS shortest path to nearest exit in an egress graph.
 * Distances are treated as equal hops (unweighted BFS); for weighted
 * shortest-path use Dijkstra — BFS gives the minimum hop count.
 */
export function bfsToExit(graph: EgressGraph, originId: string): EgressPathResult {
  const nodeMap = new Map<string, EgressNode>(graph.nodes.map((n) => [n.id, n]));
  const adjMap  = new Map<string, Array<{ id: string; dist: number }>>();

  for (const edge of graph.edges) {
    if (!adjMap.has(edge.from)) adjMap.set(edge.from, []);
    if (!adjMap.has(edge.to))   adjMap.set(edge.to, []);
    adjMap.get(edge.from)!.push({ id: edge.to,   dist: edge.distanceMm });
    adjMap.get(edge.to)!.push(  { id: edge.from, dist: edge.distanceMm });
  }

  // Dijkstra (min-distance to exit)
  const dist    = new Map<string, number>([[originId, 0]]);
  const prev    = new Map<string, string>();
  const visited = new Set<string>();
  const queue   = [originId];

  while (queue.length > 0) {
    // Simple priority: sort by known distance (inefficient but correct for small graphs)
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodeMap.get(current);
    if (node?.isExit && current !== originId) {
      // Reconstruct path
      const path: string[] = [];
      let c: string | undefined = current;
      while (c !== undefined) {
        path.unshift(c);
        c = prev.get(c);
      }
      return { path, totalDistanceMm: dist.get(current) ?? 0, reachable: true };
    }

    for (const nb of adjMap.get(current) ?? []) {
      if (visited.has(nb.id)) continue;
      const newDist = (dist.get(current) ?? Infinity) + nb.dist;
      if (newDist < (dist.get(nb.id) ?? Infinity)) {
        dist.set(nb.id, newDist);
        prev.set(nb.id, current);
        queue.push(nb.id);
      }
    }
  }

  return { path: [], totalDistanceMm: Infinity, reachable: false };
}

// ── Full space egress check ──────────────────────────────────────────────────

export interface SpaceEgressInput {
  /** Space id */
  id: string;
  /** Net area in m² */
  areaSqM: number;
  /** IBC occupancy group (A, B, E, …) */
  occupancyGroup: string;
  /** Occupancy classification key from IBC_OCCUPANT_FACTORS */
  occupancyClass: string;
  /** Number of exits actually provided */
  exitsProvided: number;
  /** Longest travel path to exit in mm */
  travelDistanceMm: number;
  /** True if space is fully sprinklered */
  sprinklered: boolean;
}

export interface SpaceEgressResult {
  id: string;
  occupantLoad: number;
  requiredExits: number;
  exitsProvided: number;
  exitsCompliant: boolean;
  travelDistanceMm: number;
  travelCompliant: boolean;
  travelLimit: number;
  issues: string[];
}

export function checkSpaceEgress(space: SpaceEgressInput): SpaceEgressResult {
  const occ    = occupantLoad(space.areaSqM, space.occupancyClass);
  const reqEx  = requiredExits(occ, space.occupancyClass);
  const travel = checkTravelDistance(space.travelDistanceMm, space.occupancyGroup, space.sprinklered);
  const issues: string[] = [];

  if (space.exitsProvided < reqEx) {
    issues.push(`Insufficient exits: ${space.exitsProvided} provided, ${reqEx} required for ${occ} occupants`);
  }
  if (!travel.compliant) {
    issues.push(`Travel distance ${Math.round(space.travelDistanceMm / 1000)}m exceeds ${Math.round(travel.limit / 1000)}m limit by ${Math.round(travel.excess / 1000)}m`);
  }

  return {
    id:                  space.id,
    occupantLoad:        occ,
    requiredExits:       reqEx,
    exitsProvided:       space.exitsProvided,
    exitsCompliant:      space.exitsProvided >= reqEx,
    travelDistanceMm:    space.travelDistanceMm,
    travelCompliant:     travel.compliant,
    travelLimit:         travel.limit,
    issues,
  };
}
