import { ColorGradeSettings, LUTPreset } from '../types/editor';

/**
 * Professional Color Grading & LUT Processing Engine
 */

export const DEFAULT_COLOR_GRADE: ColorGradeSettings = {
  exposure: 0,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  gamma: 0,
  gain: 0,
  lift: 0,
  vibrance: 0,
  hue: 0,
  wheels: {
    lift: { r: 0, g: 0, b: 0, y: 0 },
    gamma: { r: 0, g: 0, b: 0, y: 0 },
    gain: { r: 0, g: 0, b: 0, y: 0 },
  },
  lut: 'none',
  lutIntensity: 1.0,
};

// Preset descriptions and thumbnails
export const LUT_PRESETS: { id: LUTPreset; name: string; description: string; previewColor: string }[] = [
  { id: 'none', name: 'Rec.709 Natural', description: 'Standard linear video profile', previewColor: '#64748b' },
  { id: 'teal_orange', name: 'Teal & Orange', description: 'Blockbuster cinematic look with complementary cyan shadows & amber highlights', previewColor: '#0ea5e9' },
  { id: 'kodak_portra', name: 'Kodak Portra 400', description: 'Warm organic skin tones with gentle highlight roll-off', previewColor: '#f59e0b' },
  { id: 'film_noir', name: 'Film Noir B&W', description: 'High contrast monochrome with silver tones and deep shadows', previewColor: '#ffffff' },
  { id: 'cyber_neon', name: 'Cyberpunk Neon', description: 'Electrifying magenta and deep violet shadows', previewColor: '#d946ef' },
  { id: 'bleach_bypass', name: 'Bleach Bypass', description: 'Harsh silver retention, desaturated midtones, gritty contrast', previewColor: '#a1a1aa' },
  { id: 'vintage_70s', name: 'Vintage 70s Kodachrome', description: 'Warm amber tones, faded toe blacks, retro film nostalgia', previewColor: '#ea580c' },
  { id: 'fuji_chrome', name: 'Fuji Velvia Chrome', description: 'Vivid greens, crisp sky blues and punchy saturation', previewColor: '#10b981' },
];

/**
 * Generate CSS Filter string for fast GPU preview playback
 */
export function getCssFilterString(grade: ColorGradeSettings): string {
  const filters: string[] = [];

  // Exposure & Brightness
  const expMult = Math.pow(2, grade.exposure);
  const brightPct = Math.round((100 + grade.brightness) * expMult);
  filters.push(`brightness(${Math.max(10, brightPct)}%)`);

  // Contrast
  filters.push(`contrast(${Math.round(grade.contrast * 100)}%)`);

  // Saturation
  let sat = grade.saturation;
  if (grade.lut === 'film_noir') sat = 0;
  if (grade.lut === 'bleach_bypass') sat *= 0.5;
  filters.push(`saturate(${Math.round(sat * 100)}%)`);

  // Hue
  let hueDeg = grade.hue;
  if (grade.temperature > 0) hueDeg += grade.temperature * 0.3;
  if (grade.temperature < 0) hueDeg += grade.temperature * 0.3;
  if (hueDeg !== 0) {
    filters.push(`hue-rotate(${Math.round(hueDeg)}deg)`);
  }

  // Sepia / Warmth
  if (grade.temperature > 15 || grade.lut === 'vintage_70s') {
    filters.push(`sepia(${Math.round(Math.max(10, grade.temperature * 0.5))}%)`);
  }

  return filters.join(' ');
}

/**
 * Pixel-Accurate Color Grading Pipeline for Final Render and Canvas Drawing
 */
export function applyPixelColorGrade(
  imageData: ImageData,
  grade: ColorGradeSettings
): void {
  const data = imageData.data;
  const len = data.length;

  const expMult = Math.pow(2, grade.exposure);
  const contrast = grade.contrast;
  const sat = grade.saturation;
  const temp = grade.temperature / 100; // -0.5 to 0.5
  const tint = grade.tint / 100;
  const vibrance = grade.vibrance / 100;
  const highlights = grade.highlights / 100;
  const shadows = grade.shadows / 100;
  const lut = grade.lut;

  // 3-way color wheels
  const liftR = grade.wheels.lift.r;
  const liftG = grade.wheels.lift.g;
  const liftB = grade.wheels.lift.b;

  const gammaR = grade.wheels.gamma.r;
  const gammaG = grade.wheels.gamma.g;
  const gammaB = grade.wheels.gamma.b;

  const gainR = grade.wheels.gain.r;
  const gainG = grade.wheels.gain.g;
  const gainB = grade.wheels.gain.b;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Normalize to 0..1
    let nr = r / 255;
    let ng = g / 255;
    let nb = b / 255;

    // 1. Exposure
    nr *= expMult;
    ng *= expMult;
    nb *= expMult;

    // 2. Temperature & Tint
    nr += temp * 0.15;
    nb -= temp * 0.15;
    ng += tint * 0.1;

    // Calculate Luminance
    let luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;

    // 3. Highlights & Shadows recovery
    if (luma > 0.6) {
      const hWeight = (luma - 0.6) / 0.4;
      nr += highlights * hWeight * 0.2;
      ng += highlights * hWeight * 0.2;
      nb += highlights * hWeight * 0.2;
    } else if (luma < 0.4) {
      const sWeight = (0.4 - luma) / 0.4;
      nr += shadows * sWeight * 0.2;
      ng += shadows * sWeight * 0.2;
      nb += shadows * sWeight * 0.2;
    }

    // 4. Contrast around midpoint 0.5
    nr = (nr - 0.5) * contrast + 0.5;
    ng = (ng - 0.5) * contrast + 0.5;
    nb = (nb - 0.5) * contrast + 0.5;

    // 5. 3-Way Color Wheels
    // Lift affects darks (1 - luma), Gain affects brights (luma), Gamma affects midtones
    const liftFactor = Math.max(0, 1 - luma * 2);
    const gainFactor = Math.max(0, (luma - 0.5) * 2);
    const gammaFactor = 1 - Math.abs(luma - 0.5) * 2;

    nr += liftR * liftFactor * 0.3 + gammaR * gammaFactor * 0.25 + gainR * gainFactor * 0.3;
    ng += liftG * liftFactor * 0.3 + gammaG * gammaFactor * 0.25 + gainG * gainFactor * 0.3;
    nb += liftB * liftFactor * 0.3 + gammaB * gammaFactor * 0.25 + gainB * gainFactor * 0.3;

    // 6. LUT Emulation
    if (lut === 'teal_orange') {
      // Shadows -> Teal, Highlights -> Orange
      if (luma < 0.5) {
        nb += (0.5 - luma) * 0.25;
        ng += (0.5 - luma) * 0.12;
        nr -= (0.5 - luma) * 0.1;
      } else {
        nr += (luma - 0.5) * 0.28;
        ng += (luma - 0.5) * 0.1;
        nb -= (luma - 0.5) * 0.18;
      }
    } else if (lut === 'kodak_portra') {
      nr += 0.04;
      ng += 0.02;
      nb -= 0.03;
      // Soft highlight roll-off
      if (nr > 0.8) nr = 0.8 + (nr - 0.8) * 0.6;
      if (ng > 0.8) ng = 0.8 + (ng - 0.8) * 0.6;
    } else if (lut === 'film_noir') {
      const mono = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      nr = mono;
      ng = mono;
      nb = mono;
    } else if (lut === 'cyber_neon') {
      nr += (1 - luma) * 0.2;
      nb += luma * 0.3;
      ng -= 0.05;
    } else if (lut === 'vintage_70s') {
      nr += 0.08;
      ng += 0.04;
      nb -= 0.06;
      // Lifted toe blacks
      nr = Math.max(0.06, nr);
      ng = Math.max(0.04, ng);
      nb = Math.max(0.07, nb);
    }

    // 7. Saturation & Vibrance
    luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
    const maxVal = Math.max(nr, ng, nb);
    const minVal = Math.min(nr, ng, nb);
    const curSat = maxVal > 0 ? (maxVal - minVal) / maxVal : 0;
    const vibBonus = (1 - curSat) * vibrance;

    const totalSat = Math.max(0, sat + vibBonus);
    nr = luma + (nr - luma) * totalSat;
    ng = luma + (ng - luma) * totalSat;
    nb = luma + (nb - luma) * totalSat;

    // Clamp back to 0..255
    data[i] = Math.min(255, Math.max(0, Math.round(nr * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(ng * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(nb * 255)));
  }
}

/**
 * Real-Time Video Scopes Computation
 */
export interface ScopeData {
  histogramR: number[]; // 256 bins
  histogramG: number[];
  histogramB: number[];
  waveformLuma: number[][]; // sampled grid [x][luma]
  vectorscopePoints: { x: number; y: number }[];
}

export function computeVideoScopes(canvas: HTMLCanvasElement): ScopeData {
  const ctx = canvas.getContext('2d');
  const empty: ScopeData = {
    histogramR: new Array(256).fill(0),
    histogramG: new Array(256).fill(0),
    histogramB: new Array(256).fill(0),
    waveformLuma: [],
    vectorscopePoints: [],
  };

  if (!ctx || canvas.width === 0 || canvas.height === 0) return empty;

  // Sample downscaled grid for 60fps performance
  const sampleW = 160;
  const sampleH = 90;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = sampleW;
  offCanvas.height = sampleH;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return empty;

  offCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const imgData = offCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  const waveform: number[][] = Array.from({ length: sampleW }, () => []);
  const vectorPoints: { x: number; y: number }[] = [];

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      histR[r]++;
      histG[g]++;
      histB[b]++;

      // Luma for Waveform (0..100 IRE)
      const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      waveform[x].push(luma);

      // Cb and Cr for Vectorscope
      // Cb = -0.168736*R - 0.331264*G + 0.5*B
      // Cr = 0.5*R - 0.418688*G - 0.081312*B
      if ((x + y) % 2 === 0) {
        const cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 0.5 * r - 0.418688 * g - 0.081312 * b;
        vectorPoints.push({ x: cb, y: cr });
      }
    }
  }

  return {
    histogramR: histR,
    histogramG: histG,
    histogramB: histB,
    waveformLuma: waveform,
    vectorscopePoints: vectorPoints,
  };
}
