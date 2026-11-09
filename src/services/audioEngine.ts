import { MasterAudioSettings } from '../types/editor';

/**
 * Advanced Web Audio Studio Engine
 * Provides real-time EQ, Dynamics Compression, Reverb, VU metering, and Voiceover recording.
 */

class AudioStudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active audio elements pool mapped by clip ID
  private audioElements: Map<string, { element: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode }> = new Map();

  // Voiceover recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    // Lazily initialized upon user interaction to satisfy browser autoplay policies
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupMasterChain();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private setupMasterChain(): void {
    if (!this.ctx) return;

    // 1. 3-Band Parametric Equalizer
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 160;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1200;
    this.eqMid.Q.value = 1.0;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4500;

    // 2. Dynamics Compressor & Limiter
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;

    // 3. Reverb Convolver
    this.reverbNode = this.ctx.createConvolver();
    this.createImpulseResponse(1.8, 2.0); // 1.8s decay studio impulse

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.0;

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;

    // 4. Master Volume Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // 5. Analyser for VU Meter & Frequency visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Chain: EQ Low -> Mid -> High -> Split (Dry / Reverb) -> Compressor -> Master Gain -> Analyser -> Destination
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    this.eqHigh.connect(this.dryGain);
    this.eqHigh.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);

    this.dryGain.connect(this.compressor);
    this.reverbGain.connect(this.compressor);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  // Procedural Studio Reverb Impulse Response
  private createImpulseResponse(duration: number, decay: number): void {
    if (!this.ctx || !this.reverbNode) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    this.reverbNode.buffer = impulse;
  }

  public updateMasterSettings(settings: MasterAudioSettings): void {
    const ctx = this.getContext();
    const t = ctx.currentTime;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(settings.volume, t, 0.05);
    }
    if (this.eqLow) {
      this.eqLow.gain.setTargetAtTime(settings.eqLow, t, 0.05);
    }
    if (this.eqMid) {
      this.eqMid.gain.setTargetAtTime(settings.eqMid, t, 0.05);
    }
    if (this.eqHigh) {
      this.eqHigh.gain.setTargetAtTime(settings.eqHigh, t, 0.05);
    }
    if (this.reverbGain && this.dryGain) {
      this.reverbGain.gain.setTargetAtTime(settings.reverb * 0.7, t, 0.05);
      this.dryGain.gain.setTargetAtTime(1 - settings.reverb * 0.3, t, 0.05);
    }
    if (this.compressor) {
      this.compressor.ratio.setTargetAtTime(settings.compressor ? 8 : 1, t, 0.05);
    }
  }

  // Connect an HTML Audio / Video element into the studio mastering chain
  public registerMediaElement(id: string, element: HTMLMediaElement): GainNode {
    const ctx = this.getContext();
    if (this.audioElements.has(id)) {
      return this.audioElements.get(id)!.gain;
    }

    try {
      const source = ctx.createMediaElementSource(element as any);
      const gain = ctx.createGain();
      gain.gain.value = 1.0;

      source.connect(gain);
      if (this.eqLow) {
        gain.connect(this.eqLow);
      } else {
        gain.connect(ctx.destination);
      }

      this.audioElements.set(id, { element: element as any, source, gain });
      return gain;
    } catch (e) {
      // Element might already be connected or CORS restricted
      const gain = ctx.createGain();
      return gain;
    }
  }

  // Read current visualizer spectrum and dB stereo peaks
  public getVisualizerData(): { frequencyData: Uint8Array; peakDb: number } {
    if (!this.analyser) {
      return { frequencyData: new Uint8Array(64), peakDb: -60 };
    }
    const freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freq);

    // Calculate RMS and dB peak
    let sum = 0;
    for (let i = 0; i < freq.length; i++) {
      sum += freq[i];
    }
    const avg = sum / freq.length;
    const peakDb = avg > 0 ? Math.min(0, Math.max(-60, 20 * Math.log10(avg / 255))) : -60;

    return { frequencyData: freq, peakDb };
  }

  // Voiceover recording with Microphone
  public async startVoiceoverRecording(): Promise<boolean> {
    try {
      this.getContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      return false;
    }
  }

  public stopVoiceoverRecording(): Promise<{ url: string; blob: Blob; duration: number } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const tracks = this.mediaRecorder?.stream.getTracks();
        tracks?.forEach((t) => t.stop());

        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        // Calculate duration from audio buffer
        const ctx = this.getContext();
        const arrayBuf = await blob.arrayBuffer();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuf);
          resolve({ url, blob, duration: audioBuffer.duration });
        } catch {
          resolve({ url, blob, duration: 4.0 });
        }
      };

      this.mediaRecorder.stop();
    });
  }
}

export const audioEngine = new AudioStudioEngine();
