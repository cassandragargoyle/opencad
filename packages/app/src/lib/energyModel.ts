/**
 * T-ANA-05: EnergyPlus IDF export schema types and minimal IDF builder.
 *
 * Implements:
 *   - Zone, material, and construction data interfaces
 *   - IDF text generation for zones, constructions, and site location
 *   - Full IDF assembly from EnergyModelInput
 *   - Degree-day rule-of-thumb EUI estimator (no EnergyPlus required)
 *
 * References:
 *   EnergyPlus v23.x Input-Output Reference — energyplus.net/documentation
 *   ASHRAE 90.1-2022 — Energy Standard for Buildings
 *   ASHRAE Fundamentals Handbook (2021) — Chapter 18, Nonresidential Cooling
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ZoneDefinition {
  /** Unique zone identifier */
  id: string;
  /** Human-readable zone name */
  name: string;
  /** Conditioned floor area (m²) */
  floorAreaM2: number;
  /** Ceiling height (m) */
  heightM: number;
  /** Infiltration air changes per hour at 4 Pa */
  infiltrationACH: number;
  /** Occupant density: m² per person */
  occupantDensityM2perPerson: number;
  /** Lighting power density (W/m²) */
  lightingWpM2: number;
  /** Plug / equipment power density (W/m²) */
  equipmentWpM2: number;
}

export interface MaterialLayer {
  /** Material name (used as IDF object name) */
  name: string;
  /** Layer thickness (m) */
  thickness: number;
  /** Thermal conductivity (W/m·K) */
  conductivity: number;
  /** Density (kg/m³) */
  density: number;
  /** Specific heat capacity (J/kg·K) */
  specificHeat: number;
}

export interface BuildingConstruction {
  /** Construction name (used as IDF object name) */
  name: string;
  /** Ordered material layers (outside → inside) */
  layers: MaterialLayer[];
}

export interface SiteLocation {
  latitude: number;
  longitude: number;
  /** Elevation above sea level (m) */
  elevation: number;
  /** Path or name of EnergyPlus weather file (.epw) */
  weatherFile: string;
}

export interface SimPeriod {
  /** Start month (1–12) */
  startMonth: number;
  /** End month (1–12) */
  endMonth: number;
}

export interface EnergyModelInput {
  zones: ZoneDefinition[];
  constructions: BuildingConstruction[];
  location: SiteLocation;
  simPeriod: SimPeriod;
}

export interface ZoneResult {
  zoneId: string;
  zoneName: string;
  annualCoolingKWh: number;
  annualHeatingKWh: number;
  peakCoolingKW: number;
  peakHeatingKW: number;
}

export interface EnergyModelResult {
  /** Annual Energy Use Intensity (kWh/m²/yr) */
  annualEUI: number;
  /** Peak cooling load for the whole building (kW) */
  peakCoolingKW: number;
  /** Peak heating load for the whole building (kW) */
  peakHeatingKW: number;
  /** Monthly energy loads (kWh) — 12 values Jan–Dec */
  monthlyLoads: [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];
  /** Unmet cooling setpoint hours */
  unmetCoolingHours: number;
  /** Unmet heating setpoint hours */
  unmetHeatingHours: number;
  zones: ZoneResult[];
}

// ── IDF building block generators ────────────────────────────────────────────

/** Indent string for IDF sub-fields. */
const IDF_INDENT = '    ';

/**
 * Build an EnergyPlus IDF Zone object text block.
 *
 * EnergyPlus IDD reference: Zone object.
 */
export function buildIDFZone(zone: ZoneDefinition): string {
  const volume = zone.floorAreaM2 * zone.heightM;
  return [
    `Zone,`,
    `${IDF_INDENT}${zone.name},          !- Name`,
    `${IDF_INDENT}0,                     !- Direction of Relative North {deg}`,
    `${IDF_INDENT}0,                     !- X Origin {m}`,
    `${IDF_INDENT}0,                     !- Y Origin {m}`,
    `${IDF_INDENT}0,                     !- Z Origin {m}`,
    `${IDF_INDENT}1,                     !- Type`,
    `${IDF_INDENT}1,                     !- Multiplier`,
    `${IDF_INDENT}${zone.heightM.toFixed(3)},        !- Ceiling Height {m}`,
    `${IDF_INDENT}${volume.toFixed(3)};              !- Volume {m3}`,
    ``,
    `ZoneInfiltration:DesignFlowRate,`,
    `${IDF_INDENT}${zone.name} Infiltration,  !- Name`,
    `${IDF_INDENT}${zone.name},              !- Zone or ZoneList Name`,
    `${IDF_INDENT}AlwaysOn,               !- Schedule Name`,
    `${IDF_INDENT}AirChanges/Hour,        !- Design Flow Rate Calculation Method`,
    `${IDF_INDENT},                       !- Design Flow Rate {m3/s}`,
    `${IDF_INDENT},                       !- Flow per Zone Floor Area {m3/s-m2}`,
    `${IDF_INDENT},                       !- Flow per Exterior Surface Area {m3/s-m2}`,
    `${IDF_INDENT}${zone.infiltrationACH.toFixed(3)};  !- Air Changes per Hour`,
    ``,
    `Lights,`,
    `${IDF_INDENT}${zone.name} Lights,        !- Name`,
    `${IDF_INDENT}${zone.name},              !- Zone or ZoneList Name`,
    `${IDF_INDENT}AlwaysOn,               !- Schedule Name`,
    `${IDF_INDENT}Watts/Area,             !- Design Level Calculation Method`,
    `${IDF_INDENT},                       !- Lighting Level {W}`,
    `${IDF_INDENT}${zone.lightingWpM2.toFixed(3)},    !- Watts per Zone Floor Area {W/m2}`,
    `${IDF_INDENT},                       !- Watts per Person {W/person}`,
    `${IDF_INDENT}0.72,                   !- Return Air Fraction`,
    `${IDF_INDENT}0.0,                    !- Fraction Radiant`,
    `${IDF_INDENT}0.0,                    !- Fraction Visible`,
    `${IDF_INDENT}1.0;                    !- Fraction Replaceable`,
    ``,
    `ElectricEquipment,`,
    `${IDF_INDENT}${zone.name} Equipment,     !- Name`,
    `${IDF_INDENT}${zone.name},              !- Zone or ZoneList Name`,
    `${IDF_INDENT}AlwaysOn,               !- Schedule Name`,
    `${IDF_INDENT}Watts/Area,             !- Design Level Calculation Method`,
    `${IDF_INDENT},                       !- Design Level {W}`,
    `${IDF_INDENT}${zone.equipmentWpM2.toFixed(3)},   !- Watts per Zone Floor Area {W/m2}`,
    `${IDF_INDENT};                       !- Watts per Person {W/person}`,
  ].join('\n');
}

/**
 * Build EnergyPlus IDF Material and Construction object blocks.
 */
export function buildIDFConstruction(c: BuildingConstruction): string {
  const lines: string[] = [];

  // Emit each layer as a Material object
  for (const layer of c.layers) {
    lines.push(
      `Material,`,
      `${IDF_INDENT}${layer.name},              !- Name`,
      `${IDF_INDENT}Rough,                  !- Roughness`,
      `${IDF_INDENT}${layer.thickness.toFixed(4)},       !- Thickness {m}`,
      `${IDF_INDENT}${layer.conductivity.toFixed(4)},    !- Conductivity {W/m-K}`,
      `${IDF_INDENT}${layer.density.toFixed(1)},         !- Density {kg/m3}`,
      `${IDF_INDENT}${layer.specificHeat.toFixed(1)};    !- Specific Heat {J/kg-K}`,
      ``,
    );
  }

  // Emit Construction object referencing layers
  const layerFields = c.layers
    .map((l, i) => `${IDF_INDENT}${l.name}${i < c.layers.length - 1 ? ',' : ';'}         !- Layer ${i + 1}`)
    .join('\n');

  lines.push(
    `Construction,`,
    `${IDF_INDENT}${c.name},               !- Name`,
    layerFields,
    ``,
  );

  return lines.join('\n');
}

/**
 * Build EnergyPlus IDF Site:Location and RunPeriod blocks.
 */
export function buildIDFSiteLocation(loc: SiteLocation): string {
  return [
    `Site:Location,`,
    `${IDF_INDENT}Site Location,          !- Name`,
    `${IDF_INDENT}${loc.latitude.toFixed(4)},          !- Latitude {deg}`,
    `${IDF_INDENT}${loc.longitude.toFixed(4)},         !- Longitude {deg}`,
    `${IDF_INDENT}0.0,                    !- Time Zone {hr}`,
    `${IDF_INDENT}${loc.elevation.toFixed(1)};          !- Elevation {m}`,
    ``,
    `SizingPeriod:WeatherFileDays,`,
    `${IDF_INDENT}Weather File Period,    !- Name`,
    `${IDF_INDENT}1,                      !- Begin Month`,
    `${IDF_INDENT}1,                      !- Begin Day of Month`,
    `${IDF_INDENT}12,                     !- End Month`,
    `${IDF_INDENT}31,                     !- End Day of Month`,
    `${IDF_INDENT}SummerDesignDay;        !- Day Type`,
  ].join('\n');
}

/**
 * Assemble a minimal but structurally valid EnergyPlus IDF string from
 * all zones and constructions in the EnergyModelInput.
 *
 * The resulting IDF can be submitted to EnergyPlus with a matching .epw
 * weather file. Additional objects (HVAC, schedules, etc.) would need to
 * be added for a full simulation.
 */
export function buildIDF(input: EnergyModelInput): string {
  const sections: string[] = [];

  // Header comment
  sections.push(
    [
      `!- EnergyPlus IDF generated by OpenCAD`,
      `!- EnergyPlus Version: 23.x`,
      `!- Simulation period: Month ${input.simPeriod.startMonth} to Month ${input.simPeriod.endMonth}`,
      ``,
    ].join('\n'),
  );

  // Version
  sections.push(`Version,23.1;\n`);

  // Global simulation controls
  sections.push(
    [
      `SimulationControl,`,
      `${IDF_INDENT}Yes,                    !- Do Zone Sizing Calculation`,
      `${IDF_INDENT}Yes,                    !- Do System Sizing Calculation`,
      `${IDF_INDENT}Yes,                    !- Do Plant Sizing Calculation`,
      `${IDF_INDENT}No,                     !- Run Simulation for Sizing Periods`,
      `${IDF_INDENT}Yes;                    !- Run Simulation for Weather File Run Periods`,
      ``,
    ].join('\n'),
  );

  // Building object
  sections.push(
    [
      `Building,`,
      `${IDF_INDENT}OpenCAD Building,       !- Name`,
      `${IDF_INDENT}0.0,                    !- North Axis {deg}`,
      `${IDF_INDENT}Suburbs,                !- Terrain`,
      `${IDF_INDENT}0.04,                   !- Loads Convergence Tolerance Value`,
      `${IDF_INDENT}0.004,                  !- Temperature Convergence Tolerance Value {deltaC}`,
      `${IDF_INDENT}FullInteriorAndExterior, !- Solar Distribution`,
      `${IDF_INDENT}25,                     !- Maximum Number of Warmup Days`,
      `${IDF_INDENT}6;                      !- Minimum Number of Warmup Days`,
      ``,
    ].join('\n'),
  );

  // Run period
  const startDay = `${input.simPeriod.startMonth}/1`;
  const endDay   = `${input.simPeriod.endMonth}/31`;
  sections.push(
    [
      `RunPeriod,`,
      `${IDF_INDENT}Annual Run,             !- Name`,
      `${IDF_INDENT}${input.simPeriod.startMonth},                      !- Begin Month`,
      `${IDF_INDENT}1,                      !- Begin Day of Month`,
      `${IDF_INDENT},                       !- Begin Year`,
      `${IDF_INDENT}${input.simPeriod.endMonth},                     !- End Month`,
      `${IDF_INDENT}31,                     !- End Day of Month`,
      `${IDF_INDENT},                       !- End Year`,
      `${IDF_INDENT}Sunday,                 !- Day of Week for Start Day`,
      `${IDF_INDENT}Yes,                    !- Use Weather File Holidays and Special Days`,
      `${IDF_INDENT}Yes,                    !- Use Weather File Dst Indicators`,
      `${IDF_INDENT}Yes,                    !- Apply Weekend Holiday Rule`,
      `${IDF_INDENT}Yes,                    !- Use Weather File Rain Indicators`,
      `${IDF_INDENT}Yes;                    !- Use Weather File Snow Indicators`,
      ``,
      `! Run period: ${startDay} — ${endDay}`,
    ].join('\n'),
  );

  // Site location
  sections.push(buildIDFSiteLocation(input.location));

  // Timestep
  sections.push(`\nTimestep,6;\n`);

  // Always-on schedule
  sections.push(
    [
      ``,
      `ScheduleTypeLimits,`,
      `${IDF_INDENT}Fraction,               !- Name`,
      `${IDF_INDENT}0.0,                    !- Lower Limit Value`,
      `${IDF_INDENT}1.0,                    !- Upper Limit Value`,
      `${IDF_INDENT}CONTINUOUS;             !- Numeric Type`,
      ``,
      `Schedule:Constant,`,
      `${IDF_INDENT}AlwaysOn,               !- Name`,
      `${IDF_INDENT}Fraction,               !- Schedule Type Limits Name`,
      `${IDF_INDENT}1.0;                    !- Hourly Value`,
      ``,
    ].join('\n'),
  );

  // Constructions
  for (const c of input.constructions) {
    sections.push(buildIDFConstruction(c));
  }

  // Zones
  for (const z of input.zones) {
    sections.push(buildIDFZone(z));
  }

  // Output requests
  sections.push(
    [
      ``,
      `Output:VariableDictionary,IDF;`,
      `Output:Surfaces:List,Details;`,
      `Output:Constructions,Constructions;`,
      ``,
      `OutputControl:Table:Style,HTML;`,
      ``,
      `Output:Table:SummaryReports,`,
      `${IDF_INDENT}AllSummary;`,
    ].join('\n'),
  );

  return sections.join('\n');
}

// ── Degree-day EUI estimator ──────────────────────────────────────────────────

export type ClimateZone = 'hot-humid' | 'cold' | 'temperate' | 'dry';

/** Base EUI values (kWh/m²/yr) by climate zone for a typical office building. */
const BASE_EUI_BY_CLIMATE: Record<ClimateZone, number> = {
  'hot-humid':  200,
  'cold':       220,
  'temperate':  150,
  'dry':        175,
};

/** Incremental EUI coefficients per W/m² of internal loads. */
const EUI_LOAD_FACTOR = 2.0; // kWh/m²/yr per W/m² increase above baseline

/**
 * Rule-of-thumb EUI estimate when EnergyPlus simulation is not available.
 * Uses climate-specific base EUI adjusted for internal gains.
 *
 * Not a substitute for full simulation — use for early-stage budgeting only.
 *
 * @returns Estimated annual EUI (kWh/m²/yr)
 */
export function estimateEUI(zones: ZoneDefinition[], climate: ClimateZone): number {
  if (zones.length === 0) return 0;

  const baseEUI = BASE_EUI_BY_CLIMATE[climate];

  // Weighted average of internal load densities
  let totalArea    = 0;
  let totalLoadW   = 0;

  for (const z of zones) {
    const area      = z.floorAreaM2;
    const loadWpM2  = z.lightingWpM2 + z.equipmentWpM2;
    totalArea  += area;
    totalLoadW += loadWpM2 * area;
  }

  const avgLoadWpM2   = totalArea > 0 ? totalLoadW / totalArea : 0;
  const baselineLoad  = 15; // W/m² reference for base EUI (typical office)
  const loadDelta     = avgLoadWpM2 - baselineLoad;

  // Infiltration penalty: each 0.1 ACH above 0.5 adds ~5 kWh/m²/yr
  let totalACH   = 0;
  for (const z of zones) totalACH += z.infiltrationACH;
  const avgACH   = zones.length > 0 ? totalACH / zones.length : 0;
  const infPenalty = Math.max(0, (avgACH - 0.5) / 0.1) * 5;

  const eui = baseEUI + loadDelta * EUI_LOAD_FACTOR + infPenalty;
  return Math.max(0, eui);
}
