/**
 * T-ANA-05: EnergyPlus IDF export and EUI estimator tests.
 */
import { describe, it, expect } from 'vitest';
import {
  buildIDFZone,
  buildIDFConstruction,
  buildIDFSiteLocation,
  buildIDF,
  estimateEUI,
  type ZoneDefinition,
  type BuildingConstruction,
  type SiteLocation,
  type EnergyModelInput,
} from './energyModel';

const sampleZone: ZoneDefinition = {
  id: 'z1',
  name: 'Office Zone',
  floorAreaM2: 200,
  heightM: 3.0,
  infiltrationACH: 0.5,
  occupantDensityM2perPerson: 10,
  lightingWpM2: 10,
  equipmentWpM2: 15,
};

const sampleConstruction: BuildingConstruction = {
  name: 'Concrete Wall',
  layers: [
    { name: 'Concrete', thickness: 0.2, conductivity: 1.8, density: 2300, specificHeat: 900 },
    { name: 'Insulation', thickness: 0.05, conductivity: 0.04, density: 30, specificHeat: 1000 },
  ],
};

const sampleLocation: SiteLocation = {
  latitude: 40.7128,
  longitude: -74.006,
  elevation: 10,
  weatherFile: 'USA_NY_New.York.epw',
};

describe('T-ANA-05: buildIDFZone()', () => {
  it('includes zone name in output', () => {
    const idf = buildIDFZone(sampleZone);
    expect(idf).toContain('Office Zone');
  });

  it('includes Zone keyword', () => {
    const idf = buildIDFZone(sampleZone);
    expect(idf).toContain('Zone,');
  });

  it('includes infiltration block', () => {
    const idf = buildIDFZone(sampleZone);
    expect(idf).toContain('ZoneInfiltration');
  });

  it('includes lights block', () => {
    const idf = buildIDFZone(sampleZone);
    expect(idf).toContain('Lights,');
  });

  it('includes equipment block', () => {
    const idf = buildIDFZone(sampleZone);
    expect(idf).toContain('ElectricEquipment,');
  });
});

describe('T-ANA-05: buildIDFConstruction()', () => {
  it('includes Construction keyword', () => {
    const idf = buildIDFConstruction(sampleConstruction);
    expect(idf).toContain('Construction,');
  });

  it('includes Material blocks for each layer', () => {
    const idf = buildIDFConstruction(sampleConstruction);
    expect(idf).toContain('Material,');
    expect(idf).toContain('Concrete');
    expect(idf).toContain('Insulation');
  });
});

describe('T-ANA-05: buildIDFSiteLocation()', () => {
  it('includes Site:Location keyword', () => {
    const idf = buildIDFSiteLocation(sampleLocation);
    expect(idf).toContain('Site:Location,');
  });

  it('includes latitude', () => {
    const idf = buildIDFSiteLocation(sampleLocation);
    expect(idf).toContain('40.7128');
  });
});

describe('T-ANA-05: buildIDF()', () => {
  const input: EnergyModelInput = {
    zones: [sampleZone],
    constructions: [sampleConstruction],
    location: sampleLocation,
    simPeriod: { startMonth: 1, endMonth: 12 },
  };

  it('returns a non-empty string', () => {
    const idf = buildIDF(input);
    expect(idf.length).toBeGreaterThan(100);
  });

  it('contains Version object', () => {
    const idf = buildIDF(input);
    expect(idf).toContain('Version,');
  });

  it('contains Building object', () => {
    const idf = buildIDF(input);
    expect(idf).toContain('Building,');
  });

  it('contains all zone names', () => {
    const idf = buildIDF(input);
    expect(idf).toContain('Office Zone');
  });

  it('contains RunPeriod', () => {
    const idf = buildIDF(input);
    expect(idf).toContain('RunPeriod,');
  });
});

describe('T-ANA-05: estimateEUI()', () => {
  it('returns 0 for empty zones', () => {
    expect(estimateEUI([], 'temperate')).toBe(0);
  });

  it('hot-humid climate has higher EUI than temperate', () => {
    const eui1 = estimateEUI([sampleZone], 'hot-humid');
    const eui2 = estimateEUI([sampleZone], 'temperate');
    expect(eui1).toBeGreaterThan(eui2);
  });

  it('returns a positive number for a single zone', () => {
    const eui = estimateEUI([sampleZone], 'cold');
    expect(eui).toBeGreaterThan(0);
  });
});
