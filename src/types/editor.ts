export type MediaType = 'video' | 'audio' | 'image' | 'title';

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  url: string;
  duration: number; // in seconds
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  blob?: Blob;
  audioBuffer?: AudioBuffer;
}

export type LUTPreset =
  | 'none'
  | 'teal_orange'
  | 'kodak_portra'
  | 'film_noir'
  | 'cyber_neon'
  | 'bleach_bypass'
  | 'vintage_70s'
  | 'fuji_chrome';

export interface ColorWheelValue {
  r: number; // -1 to 1
  g: number;
  b: number;
  y: number; // luminance / offset
}

export interface ColorGradeSettings {
  exposure: number; // -1.0 to 1.0
  brightness: number; // -50 to 50
  contrast: number; // 0.5 to 2.0
  saturation: number; // 0 to 2.0
  temperature: number; // -50 to 50 (warm/cool)
  tint: number; // -50 to 50 (magenta/green)
  highlights: number; // -50 to 50
  shadows: number; // -50 to 50
  whites: number; // -50 to 50
  blacks: number; // -50 to 50
  gamma: number; // -50 to 50
  gain: number; // -50 to 50
  lift: number; // -50 to 50
  vibrance: number; // -50 to 50
  hue: number; // -180 to 180
  wheels: {
    lift: ColorWheelValue;
    gamma: ColorWheelValue;
    gain: ColorWheelValue;
  };
  lut: LUTPreset;
  lutIntensity: number; // 0 to 1
}

export type EffectType =
  | 'blur'
  | 'sharpen'
  | 'glow'
  | 'film_grain'
  | 'vignette'
  | 'chromatic_aberration'
  | 'lens_distortion'
  | 'chroma_key';

export interface EffectItem {
  id: string;
  type: EffectType;
  name: string;
  intensity: number; // 0 to 1
  enabled: boolean;
  options?: Record<string, any>; // e.g. keyColor: '#00ff00'
}

export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'dip_black'
  | 'dip_white'
  | 'wipe_right'
  | 'wipe_left'
  | 'zoom_in'
  | 'glitch';

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // seconds
}

export type SubtitleStyle =
  | 'highlight_karaoke'
  | 'bold_outline'
  | 'cinematic_box'
  | 'minimal_serif'
  | 'neon_glow';

export interface SubtitleItem {
  id: string;
  start: number; // seconds
  end: number;
  text: string;
}

export interface TextClipConfig {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '800';
  color: string;
  outlineColor: string;
  outlineWidth: number;
  backgroundColor: string;
  alignment: 'center' | 'left' | 'right';
  animation: 'none' | 'fade' | 'slide_up' | 'typewriter' | 'karaoke' | 'kinetic';
  positionY: number; // percentage from top (0-100)
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string;
  name: string;
  type: MediaType;
  start: number; // timeline start time in seconds
  duration: number; // clip duration on timeline in seconds
  offset: number; // source media start offset in seconds
  speed: number; // 0.25 to 4.0
  volume: number; // 0 to 2.0
  opacity: number; // 0 to 1.0
  transform: {
    x: number; // -100 to 100 percentage
    y: number;
    scale: number; // 0.1 to 3.0
    rotation: number; // degrees
    fit: 'contain' | 'cover' | 'fill';
  };
  colorGrade: ColorGradeSettings;
  effects: EffectItem[];
  transitionIn?: TransitionConfig;
  transitionOut?: TransitionConfig;
  textConfig?: TextClipConfig;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'caption';
  locked: boolean;
  muted: boolean;
  solo: boolean;
  volume: number; // for audio tracks
  height: number;
}

export interface MasterAudioSettings {
  volume: number;
  eqLow: number; // dB (-12 to +12)
  eqMid: number;
  eqHigh: number;
  compressor: boolean;
  limiter: boolean;
  reverb: number; // 0 to 1
  noiseReduction: boolean;
}

export type WorkspaceTab =
  | 'edit'
  | 'color'
  | 'effects'
  | 'audio'
  | 'captions'
  | 'export';

export interface VideoProject {
  id: string;
  name: string;
  fps: number;
  resolution: {
    width: number;
    height: number;
    label: string;
    aspectRatio: string;
  };
  duration: number; // total sequence duration in seconds
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  subtitles: SubtitleItem[];
  subtitleStyle: SubtitleStyle;
  subtitleFont: string;
  masterAudio: MasterAudioSettings;
  updatedAt: number;
}

export interface AudioVisualizerData {
  frequencyData: Uint8Array;
  leftPeak: number;
  rightPeak: number;
}
