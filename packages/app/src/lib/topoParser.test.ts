/**
 * T-SITE-06: Unit tests for topoParser — CSV + GeoJSON elevation parsing and
 * IDW heightmap geometry builder.
 */
import { describe, it, expect } from 'vitest';
import { parseCSV, parseGeoJSON, buildTerrainGeometry } from './topoParser';

describe('T-SITE-06: topoParser', () => {
  // ── parseCSV ────────────────────────────────────────────────────────────────

  it('parses comma-separated x,y,z rows', () => {
    const { points } = parseCSV('0,0,10\n100,0,20\n0,100,15');
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 0, y: 0, z: 10 });
    expect(points[1]).toEqual({ x: 100, y: 0, z: 20 });
  });

  it('parses tab-separated rows', () => {
    const { points } = parseCSV('0\t0\t5\n50\t50\t8');
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 0, y: 0, z: 5 });
  });

  it('skips header rows with non-numeric first cell', () => {
    const { points } = parseCSV('x,y,z\n0,0,10\n100,0,20');
    expect(points).toHaveLength(2);
  });

  it('skips rows with fewer than 3 values', () => {
    const { points } = parseCSV('0,0\n1,1,5\n2,2,6');
    expect(points).toHaveLength(2);
  });

  it('returns correct bounding box from CSV', () => {
    const { bounds } = parseCSV('0,0,0\n100,200,50');
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(100);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(200);
    expect(bounds.minZ).toBe(0);
    expect(bounds.maxZ).toBe(50);
  });

  it('returns empty result for empty CSV', () => {
    const { points } = parseCSV('');
    expect(points).toHaveLength(0);
  });

  // ── parseGeoJSON ────────────────────────────────────────────────────────────

  it('parses GeoJSON FeatureCollection with LineString contours', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[0, 0, 10], [100, 0, 10], [100, 100, 10]],
          },
          properties: { elevation: 10 },
        },
      ],
    };
    const { points } = parseGeoJSON(geojson);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 0, y: 0, z: 10 });
  });

  it('reads elevation from 3rd coordinate if properties.elevation absent', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[0, 0, 25], [50, 0, 30]] },
          properties: {},
        },
      ],
    };
    const { points } = parseGeoJSON(geojson);
    expect(points[0]?.z).toBe(25);
    expect(points[1]?.z).toBe(30);
  });

  it('falls back to feature properties.elevation', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[0, 0], [50, 0]] },
          properties: { elevation: 42 },
        },
      ],
    };
    const { points } = parseGeoJSON(geojson);
    expect(points[0]?.z).toBe(42);
    expect(points[1]?.z).toBe(42);
  });

  it('handles MultiLineString', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [[[0, 0, 5], [10, 0, 5]], [[0, 10, 8], [10, 10, 8]]],
          },
          properties: {},
        },
      ],
    };
    const { points } = parseGeoJSON(geojson);
    expect(points).toHaveLength(4);
  });

  it('handles Point features', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [100, 200, 30] },
          properties: {},
        },
      ],
    };
    const { points } = parseGeoJSON(geojson);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ x: 100, y: 200, z: 30 });
  });

  it('returns empty result for non-FeatureCollection input', () => {
    const { points } = parseGeoJSON({ type: 'Geometry' });
    expect(points).toHaveLength(0);
  });

  // ── buildTerrainGeometry ────────────────────────────────────────────────────

  it('returns a PlaneGeometry fallback for empty point array', () => {
    const geom = buildTerrainGeometry([]);
    expect(geom).toBeTruthy();
  });

  it('builds a BufferGeometry with position attribute', () => {
    const points = [
      { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 100 },
      { x: 0, y: 1000, z: 50 }, { x: 1000, y: 1000, z: 75 },
    ];
    const geom = buildTerrainGeometry(points, 4);
    expect(geom.attributes['position']).toBeDefined();
    expect(geom.index).not.toBeNull();
  });

  it('vertex count = (gridRes+1)² for square domain', () => {
    const res = 8;
    const points = [
      { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 },
      { x: 0, y: 1000, z: 0 }, { x: 1000, y: 1000, z: 0 },
    ];
    const geom = buildTerrainGeometry(points, res);
    const verts = geom.attributes['position']!.count;
    // For a square domain, cols = rows = res, so (res+1)² vertices.
    expect(verts).toBe((res + 1) * (res + 1));
  });

  it('IDW elevation: query at sample point returns exact Z', () => {
    const pts = [
      { x: 0, y: 0, z: 10 },
      { x: 1000, y: 0, z: 20 },
      { x: 0, y: 1000, z: 30 },
    ];
    // Build geometry with resolution 1 (2×2 grid: 4 vertices at corners)
    const geom = buildTerrainGeometry(pts, 1);
    const positions = geom.attributes['position']!.array as Float32Array;
    // Vertex at [0,0] should have y = IDW(0,0) ≈ 10 (point is at the sample)
    expect(positions[1]).toBeCloseTo(10, 0);
  });
});
