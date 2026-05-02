/**
 * T-ANA-07: Image-source method for room acoustics (ISO 3382).
 *
 * Implements:
 *   - Rectangular room image-source model up to N-th order reflections
 *   - Impulse response construction from reflection data
 *   - ISO 3382-1 room acoustic parameters: EDT, C80, D50
 *   - Octave-band energy analysis
 *
 * References:
 *   Allen & Berkley (1979) — Image method for efficiently simulating small-room acoustics
 *   ISO 3382-1:2009 — Measurement of room acoustic parameters (performance spaces)
 *   ISO 3382-2:2008 — Measurement of room acoustic parameters (ordinary rooms)
 *   Kuttruff (2009) — Room Acoustics, 5th ed.
 */

// ── Geometry types ────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function vec3Dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ── Source and receiver types ─────────────────────────────────────────────────

export interface AcousticSource {
  position: Vec3;
  /** Sound power level (dB SPL re 20 µPa at 1 m) */
  powerDB: number;
}

export interface AcousticReceiver {
  id: string;
  position: Vec3;
}

// ── Room geometry ─────────────────────────────────────────────────────────────

/**
 * Rectangular room dimensions and per-surface absorption coefficients.
 * Six octave bands: [125, 250, 500, 1000, 2000, 4000] Hz.
 */
export interface RoomGeometry {
  /** Room width (m) — x-axis extent */
  width: number;
  /** Room depth (m) — y-axis extent */
  depth: number;
  /** Room height (m) — z-axis extent */
  height: number;
  /**
   * Absorption coefficients per surface, 6-element array for octave bands
   * [125, 250, 500, 1000, 2000, 4000] Hz.
   * Surfaces: 'floor' | 'ceiling' | 'wall-n' | 'wall-s' | 'wall-e' | 'wall-w'
   */
  absorptionCoeffs: Record<'floor' | 'ceiling' | 'wall-n' | 'wall-s' | 'wall-e' | 'wall-w', number[]>;
}

// ── Reflection data ───────────────────────────────────────────────────────────

export interface Reflection {
  /** Reflection order (0 = direct sound, 1 = first-order, etc.) */
  order: number;
  /** Propagation delay from source to receiver (s) */
  delay: number;
  /** Total attenuation at this reflection (dB, positive = loss) */
  attenuationDB: number;
}

// ── Image-source computation ──────────────────────────────────────────────────

const SPEED_OF_SOUND = 343; // m/s at 20°C

/**
 * Compute image sources for a rectangular room using the Allen-Berkley method.
 *
 * For a room with dimensions [Lx, Ly, Lz] and source at (sx, sy, sz), the
 * image source positions are:
 *
 *   x_img = 2*p*Lx ± sx
 *   y_img = 2*q*Ly ± sy
 *   z_img = 2*r*Lz ± sz
 *
 * for integer triples (p, q, r) with |p|+|q|+|r| ≤ maxOrder.
 *
 * Attenuation accounts for:
 *   - 1/r spherical spreading (in dB from reference 1 m)
 *   - Per-surface absorption (average over 6 octave bands) per bounce
 *
 * @param room      Room geometry with absorption coefficients
 * @param source    Acoustic source position and power
 * @param maxOrder  Maximum reflection order (1–8 recommended; higher is slow)
 */
export function computeImageSources(
  room: RoomGeometry,
  source: AcousticSource,
  maxOrder: number,
): Reflection[] {
  const Lx = room.width;
  const Ly = room.depth;
  const Lz = room.height;

  // Average absorption per surface face (mean across 6 octave bands)
  function meanAlpha(surface: keyof RoomGeometry['absorptionCoeffs']): number {
    const coeffs = room.absorptionCoeffs[surface];
    return coeffs.reduce((s, c) => s + c, 0) / coeffs.length;
  }

  const alphaFloor   = meanAlpha('floor');
  const alphaCeiling = meanAlpha('ceiling');
  const alphaWallN   = meanAlpha('wall-n');
  const alphaWallS   = meanAlpha('wall-s');
  const alphaWallE   = meanAlpha('wall-e');
  const alphaWallW   = meanAlpha('wall-w');

  // Reflection coefficient ρ = √(1 - α)
  const rhoFloor   = Math.sqrt(Math.max(0, 1 - alphaFloor));
  const rhoCeiling = Math.sqrt(Math.max(0, 1 - alphaCeiling));
  const rhoWallN   = Math.sqrt(Math.max(0, 1 - alphaWallN));
  const rhoWallS   = Math.sqrt(Math.max(0, 1 - alphaWallS));
  const rhoWallE   = Math.sqrt(Math.max(0, 1 - alphaWallE));
  const rhoWallW   = Math.sqrt(Math.max(0, 1 - alphaWallW));

  const sx = source.position.x;
  const sy = source.position.y;
  const sz = source.position.z;

  // We use a fixed receiver at origin for the image list — callers pass receiver
  // position separately. Here we return image positions relative to source.
  // The receiver is assumed at room centre for reflection structure (order/delay).
  const rx = Lx / 2;
  const ry = Ly / 2;
  const rz = Lz / 2;

  const reflections: Reflection[] = [];

  // Direct sound (order 0)
  const directDist = Math.sqrt((sx - rx) ** 2 + (sy - ry) ** 2 + (sz - rz) ** 2);
  reflections.push({
    order:         0,
    delay:         directDist / SPEED_OF_SOUND,
    attenuationDB: 20 * Math.log10(Math.max(0.001, directDist)),
  });

  const orderRange = Array.from({ length: maxOrder * 2 + 1 }, (_, i) => i - maxOrder);

  for (const p of orderRange) {
    for (const q of orderRange) {
      for (const r of orderRange) {
        if (p === 0 && q === 0 && r === 0) continue;

        for (let xs = 0; xs < 2; xs++) {
          for (let ys = 0; ys < 2; ys++) {
            for (let zs = 0; zs < 2; zs++) {
              const imgX = 2 * p * Lx + (xs === 0 ? sx : -sx + 2 * Lx);
              const imgY = 2 * q * Ly + (ys === 0 ? sy : -sy + 2 * Ly);
              const imgZ = 2 * r * Lz + (zs === 0 ? sz : -sz + 2 * Lz);

              const dist = Math.sqrt(
                (imgX - rx) ** 2 + (imgY - ry) ** 2 + (imgZ - rz) ** 2,
              );

              // Skip if too far (limit to 2-second window)
              if (dist / SPEED_OF_SOUND > 2.0) continue;

              // Count bounces per wall pair from image indices
              const bouncesX  = Math.abs(p) + (xs === 1 ? 1 : 0);
              const bouncesY  = Math.abs(q) + (ys === 1 ? 1 : 0);
              const bouncesZ  = Math.abs(r) + (zs === 1 ? 1 : 0);
              const order     = bouncesX + bouncesY + bouncesZ;

              if (order > maxOrder || order < 1) continue;

              // Total reflection coefficient: each x-bounce alternates wall-w / wall-e
              // Approximate by using geometric mean of opposing walls
              const rhoX  = Math.sqrt(rhoWallW * rhoWallE);
              const rhoY  = Math.sqrt(rhoWallN * rhoWallS);
              const rhoZ  = Math.sqrt(rhoFloor * rhoCeiling);

              const totalRho =
                Math.pow(rhoX, bouncesX) *
                Math.pow(rhoY, bouncesY) *
                Math.pow(rhoZ, bouncesZ);

              // Attenuation dB: spherical spreading + absorption
              const spreadingDB    = 20 * Math.log10(Math.max(0.001, dist));
              const absorptionDB   = -20 * Math.log10(Math.max(1e-10, totalRho));
              const attenuationDB  = spreadingDB + absorptionDB;

              reflections.push({
                order,
                delay:         dist / SPEED_OF_SOUND,
                attenuationDB,
              });
            }
          }
        }
      }
    }
  }

  // Sort by arrival time
  reflections.sort((a, b) => a.delay - b.delay);

  return reflections;
}

// ── Impulse response construction ────────────────────────────────────────────

/**
 * Convert a list of Reflections into a discrete impulse response (IR).
 *
 * Each reflection contributes a Dirac-like spike at the sample corresponding
 * to its delay, scaled by the linear amplitude from its attenuation in dB.
 * Amplitude = 10^(-attenuationDB / 20) (pressure amplitude).
 *
 * @param reflections  Output of computeImageSources
 * @param sampleRate   IR sample rate (Hz), e.g. 48000
 * @param durationMs   Total IR duration (ms), e.g. 2000
 */
export function computeImpulseResponse(
  reflections: Reflection[],
  sampleRate: number,
  durationMs: number,
): Float32Array {
  const numSamples = Math.ceil((durationMs / 1000) * sampleRate);
  const ir         = new Float32Array(numSamples);

  for (const ref of reflections) {
    const sampleIndex = Math.round(ref.delay * sampleRate);
    if (sampleIndex < 0 || sampleIndex >= numSamples) continue;

    // Pressure amplitude from dB attenuation
    const amplitude = Math.pow(10, -ref.attenuationDB / 20);
    ir[sampleIndex] += amplitude;
  }

  return ir;
}

// ── ISO 3382 acoustic parameters ─────────────────────────────────────────────

/**
 * ISO 3382-1 Early Decay Time (EDT).
 *
 * EDT is defined as 6× the time for the energy to decay by 10 dB
 * (i.e., the time from 0 to −10 dB, extrapolated to equivalent −60 dB).
 *
 * @param impulseResponse  Float32Array impulse response
 * @param sampleRate       Sample rate (Hz)
 * @returns EDT in seconds
 */
export function iso3382EDT(impulseResponse: Float32Array, sampleRate: number): number {
  const energy = new Float32Array(impulseResponse.length);

  // Backward integration (Schroeder integral)
  let total = 0;
  for (let i = impulseResponse.length - 1; i >= 0; i--) {
    total += impulseResponse[i]! ** 2;
    energy[i] = total;
  }

  const e0 = energy[0]!;
  if (e0 <= 0) return 0;

  // Find sample where energy has decayed by 10 dB from initial
  const threshold10dB = e0 * Math.pow(10, -10 / 10);
  let t10Sample = impulseResponse.length - 1;

  for (let i = 0; i < impulseResponse.length; i++) {
    if ((energy[i]! ?? 0) <= threshold10dB) {
      t10Sample = i;
      break;
    }
  }

  const t10s = t10Sample / sampleRate;
  // EDT = 6 × t10 (extrapolated from 10 dB to 60 dB)
  return 6 * t10s;
}

/**
 * ISO 3382-1 Clarity (C80).
 *
 * C80 = 10 × log10(E_early / E_late)
 * where E_early = energy in 0–80 ms, E_late = energy after 80 ms.
 *
 * @param impulseResponse  Float32Array impulse response
 * @param sampleRate       Sample rate (Hz)
 * @returns C80 in dB
 */
export function iso3382C80(impulseResponse: Float32Array, sampleRate: number): number {
  const cutoffSample = Math.round(0.080 * sampleRate); // 80 ms
  let earlyEnergy = 0;
  let lateEnergy  = 0;

  for (let i = 0; i < impulseResponse.length; i++) {
    const e = (impulseResponse[i]! ?? 0) ** 2;
    if (i <= cutoffSample) {
      earlyEnergy += e;
    } else {
      lateEnergy  += e;
    }
  }

  if (lateEnergy <= 0) return 10;
  if (earlyEnergy <= 0) return -Infinity;

  return 10 * Math.log10(earlyEnergy / lateEnergy);
}

/**
 * ISO 3382-2 Definition (D50).
 *
 * D50 = E(0–50ms) / E(0–∞), expressed as a fraction [0, 1].
 *
 * @param impulseResponse  Float32Array impulse response
 * @param sampleRate       Sample rate (Hz)
 * @returns D50 (dimensionless fraction)
 */
export function iso3382D50(impulseResponse: Float32Array, sampleRate: number): number {
  const cutoffSample = Math.round(0.050 * sampleRate); // 50 ms
  let earlyEnergy = 0;
  let totalEnergy = 0;

  for (let i = 0; i < impulseResponse.length; i++) {
    const e = (impulseResponse[i]! ?? 0) ** 2;
    totalEnergy += e;
    if (i <= cutoffSample) earlyEnergy += e;
  }

  if (totalEnergy <= 0) return 0;
  return earlyEnergy / totalEnergy;
}

// ── Octave-band energy ────────────────────────────────────────────────────────

/**
 * Compute RMS energy of the impulse response in a 1-octave band centred on centerHz.
 *
 * Applies a simple rectangular bandpass filter in the frequency domain via FFT.
 * The octave band extends from centerHz/√2 to centerHz×√2.
 *
 * @param impulseResponse  Float32Array impulse response
 * @param sampleRate       Sample rate (Hz)
 * @param centerHz         Octave-band centre frequency (Hz), e.g. 500
 * @returns RMS energy in the octave band
 */
export function octaveBandEnergy(
  impulseResponse: Float32Array,
  sampleRate: number,
  centerHz: number,
): number {
  const N   = impulseResponse.length;
  const lo  = centerHz / Math.SQRT2;
  const hi  = centerHz * Math.SQRT2;
  const bin = sampleRate / N; // Hz per FFT bin

  // DFT energy summation in the band (no windowing for simplicity)
  // Uses Parseval's theorem: sum of squared FFT magnitudes in band / N²
  let bandEnergy = 0;

  for (let k = 0; k < Math.floor(N / 2); k++) {
    const freqHz = k * bin;
    if (freqHz < lo || freqHz > hi) continue;

    // Compute DFT coefficient at bin k
    let re = 0;
    let im = 0;
    const twopiKoverN = (2 * Math.PI * k) / N;
    for (let n = 0; n < N; n++) {
      const angle = twopiKoverN * n;
      re += (impulseResponse[n]! ?? 0) * Math.cos(angle);
      im -= (impulseResponse[n]! ?? 0) * Math.sin(angle);
    }
    bandEnergy += (re * re + im * im) / (N * N);
  }

  // RMS from energy
  return Math.sqrt(bandEnergy);
}

// Re-export Vec3 distance helper for external use
export { vec3Dist };
