import {
  TimelineClip,
  TimelineTrack,
  SubtitleItem,
  SubtitleStyle,
  EffectItem,
  ColorGradeSettings,
} from '../types/editor';
import { applyPixelColorGrade, getCssFilterString } from '../utils/colorGrading';

/**
 * High-Performance Compositing and Video Rendering Engine
 */

export class VideoRenderEngine {
  private mediaElements: Map<string, HTMLVideoElement | HTMLImageElement> = new Map();
  private noiseCanvas: HTMLCanvasElement;
  private noiseCtx: CanvasRenderingContext2D | null;

  constructor() {
    // Pre-generate noise canvas for film grain effect
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = 256;
    this.noiseCanvas.height = 256;
    this.noiseCtx = this.noiseCanvas.getContext('2d');
    this.updateFilmGrainNoise();
  }

  // Pre-bake or refresh film grain noise texture
  private updateFilmGrainNoise(): void {
    if (!this.noiseCtx) return;
    const imgData = this.noiseCtx.createImageData(256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.random() * 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = Math.random() * 60; // subtle opacity
    }
    this.noiseCtx.putImageData(imgData, 0, 0);
  }

  // Register or get media element
  public getOrCreateMediaElement(
    assetId: string,
    url: string,
    type: 'video' | 'image' | 'audio'
  ): HTMLVideoElement | HTMLImageElement | null {
    if (this.mediaElements.has(assetId)) {
      return this.mediaElements.get(assetId)!;
    }

    if (type === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.preload = 'auto';
      video.muted = true; // muted for canvas painting; audio handled via Web Audio
      video.playsInline = true;
      this.mediaElements.set(assetId, video);
      return video;
    } else if (type === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      this.mediaElements.set(assetId, img);
      return img;
    }
    return null;
  }

  /**
   * Render single frame at exact timeline timecode
   */
  public renderFrame(
    targetCanvas: HTMLCanvasElement,
    time: number,
    tracks: TimelineTrack[],
    clips: TimelineClip[],
    subtitles: SubtitleItem[],
    subtitleStyle: SubtitleStyle,
    options: {
      splitCompare?: boolean;
      splitPosition?: number; // 0 to 1
      showSafeMargins?: boolean;
      forceRaw?: boolean;
    } = {}
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const width = targetCanvas.width;
    const height = targetCanvas.height;

    // 1. Clear background to deep studio black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Filter tracks: sort video tracks bottom-to-top
    const videoTracks = tracks
      .filter((t) => t.type === 'video' && !t.muted)
      .map((t) => t.id);

    // Find active clips at current time
    const activeClips = clips
      .filter((c) => {
        const inTrack = videoTracks.includes(c.trackId) || c.type === 'title';
        return inTrack && time >= c.start && time < c.start + c.duration;
      })
      .sort((a, b) => {
        const trackA = videoTracks.indexOf(a.trackId);
        const trackB = videoTracks.indexOf(b.trackId);
        return trackA - trackB;
      });

    // Render each active clip
    for (const clip of activeClips) {
      this.renderClip(ctx, clip, time, width, height, options);
    }

    // 2. Render Subtitles / Captions track
    const activeSub = subtitles.find((s) => time >= s.start && time <= s.end);
    if (activeSub) {
      this.renderSubtitle(ctx, activeSub, time, width, height, subtitleStyle);
    }

    // 3. Render Broadcast Safe Margins if enabled
    if (options.showSafeMargins) {
      this.renderSafeMargins(ctx, width, height);
    }

    // 4. Split Screen Before/After Comparison Line
    if (options.splitCompare && options.splitPosition !== undefined) {
      const splitX = width * options.splitPosition;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();

      // Labels: GRADED / ORIGINAL
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(splitX - 75, 20, 65, 24);
      ctx.fillRect(splitX + 10, 20, 75, 24);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('GRADED', splitX - 68, 36);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('ORIGINAL', splitX + 16, 36);
      ctx.restore();
    }
  }

  private renderClip(
    ctx: CanvasRenderingContext2D,
    clip: TimelineClip,
    time: number,
    width: number,
    height: number,
    options: { splitCompare?: boolean; splitPosition?: number; forceRaw?: boolean }
  ): void {
    const clipLocalTime = (time - clip.start) * clip.speed + clip.offset;

    ctx.save();

    // Calculate transition opacity and transforms
    let clipOpacity = clip.opacity;
    let transitionOffsetX = 0;
    let transitionScale = 1;

    // In-transition
    if (clip.transitionIn && clip.transitionIn.type !== 'none') {
      const transDur = clip.transitionIn.duration;
      const progress = Math.min(1, Math.max(0, (time - clip.start) / transDur));
      if (progress < 1) {
        if (clip.transitionIn.type === 'crossfade' || clip.transitionIn.type === 'dip_black') {
          clipOpacity *= progress;
        } else if (clip.transitionIn.type === 'wipe_right') {
          transitionOffsetX = (1 - progress) * -width;
        } else if (clip.transitionIn.type === 'zoom_in') {
          transitionScale = 0.5 + progress * 0.5;
        }
      }
    }

    // Out-transition
    if (clip.transitionOut && clip.transitionOut.type !== 'none') {
      const clipEnd = clip.start + clip.duration;
      const transDur = clip.transitionOut.duration;
      const progress = Math.min(1, Math.max(0, (clipEnd - time) / transDur));
      if (progress < 1) {
        if (clip.transitionOut.type === 'crossfade' || clip.transitionOut.type === 'dip_black') {
          clipOpacity *= progress;
        }
      }
    }

    ctx.globalAlpha = clipOpacity;

    // Apply Transforms (Position, Scale, Rotation)
    const centerX = width / 2 + (clip.transform.x / 100) * width + transitionOffsetX;
    const centerY = height / 2 + (clip.transform.y / 100) * height;

    ctx.translate(centerX, centerY);
    if (clip.transform.rotation !== 0) {
      ctx.rotate((clip.transform.rotation * Math.PI) / 180);
    }
    const finalScale = clip.transform.scale * transitionScale;
    ctx.scale(finalScale, finalScale);

    // Apply Color Grade filters (via CSS filter when not in split compare or raw mode)
    const isRaw = options.forceRaw;
    if (!isRaw) {
      ctx.filter = getCssFilterString(clip.colorGrade);
    } else {
      ctx.filter = 'none';
    }

    // Render Title / Text Overlay Clip
    if (clip.type === 'title' && clip.textConfig) {
      this.renderTextClip(ctx, clip.textConfig, width, height, time - clip.start);
      ctx.restore();
      return;
    }

    // Render Media (Video or Image)
    const media = this.mediaElements.get(clip.assetId);
    if (media) {
      if (media instanceof HTMLVideoElement) {
        // Sync video element seek time
        if (Math.abs(media.currentTime - clipLocalTime) > 0.15) {
          media.currentTime = clipLocalTime;
        }
        if (media.readyState >= 2) {
          ctx.drawImage(media, -width / 2, -height / 2, width, height);
        }
      } else if (media instanceof HTMLImageElement) {
        ctx.drawImage(media, -width / 2, -height / 2, width, height);
      }
    } else {
      // Fallback placeholder if media not yet loaded
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.fillStyle = '#64748b';
      ctx.font = '24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(clip.name, 0, 0);
    }

    ctx.restore();

    // Render Visual Effects Stack (e.g. Film Grain, Vignette, Glow)
    if (!isRaw && clip.effects && clip.effects.length > 0) {
      this.renderEffectsStack(ctx, clip.effects, width, height);
    }
  }

  // Render Visual Effects Stack
  private renderEffectsStack(
    ctx: CanvasRenderingContext2D,
    effects: EffectItem[],
    width: number,
    height: number
  ): void {
    for (const effect of effects) {
      if (!effect.enabled || effect.intensity <= 0) continue;

      ctx.save();
      if (effect.type === 'vignette') {
        const radius = Math.max(width, height) * 0.75;
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          radius * 0.3,
          width / 2,
          height / 2,
          radius
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, effect.intensity * 1.2)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (effect.type === 'film_grain') {
        // 35mm dynamic grain overlay
        this.updateFilmGrainNoise();
        ctx.globalAlpha = effect.intensity * 0.4;
        ctx.globalCompositeOperation = 'overlay';
        const pattern = ctx.createPattern(this.noiseCanvas, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
      } else if (effect.type === 'glow') {
        ctx.globalAlpha = effect.intensity * 0.35;
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = `blur(${Math.round(effect.intensity * 24)}px)`;
        ctx.drawImage(ctx.canvas, 0, 0, width, height);
      } else if (effect.type === 'chromatic_aberration') {
        // Color fringe offset
        ctx.globalAlpha = effect.intensity * 0.4;
        ctx.globalCompositeOperation = 'screen';
        const offset = Math.round(effect.intensity * 8);
        ctx.drawImage(ctx.canvas, offset, 0, width, height);
      }
      ctx.restore();
    }
  }

  // Render Subtitles with styling (e.g. karaoke highlight, outline, boxed)
  private renderSubtitle(
    ctx: CanvasRenderingContext2D,
    sub: SubtitleItem,
    time: number,
    width: number,
    height: number,
    style: SubtitleStyle
  ): void {
    ctx.save();
    const progress = (time - sub.start) / (sub.end - sub.start);
    const words = sub.text.split(' ');
    const activeWordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

    const posY = height * 0.86;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (style === 'highlight_karaoke') {
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';

      // Measure total text width
      const totalWidth = ctx.measureText(sub.text).width;
      let curX = width / 2 - totalWidth / 2;

      for (let i = 0; i < words.length; i++) {
        const word = words[i] + ' ';
        const wordWidth = ctx.measureText(word).width;
        const isCurrent = i === activeWordIdx;

        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;

        if (isCurrent) {
          ctx.fillStyle = '#fbbf24'; // Vivid Amber
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4;
          ctx.strokeText(word, curX + wordWidth / 2, posY - 2);
          ctx.fillText(word, curX + wordWidth / 2, posY - 2);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(word, curX + wordWidth / 2, posY);
          ctx.fillText(word, curX + wordWidth / 2, posY);
        }

        curX += wordWidth;
      }
    } else if (style === 'cinematic_box') {
      ctx.font = '600 30px "Plus Jakarta Sans", sans-serif';
      const textWidth = ctx.measureText(sub.text).width;

      // Dark translucent pill box
      ctx.fillStyle = 'rgba(11, 13, 19, 0.75)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - textWidth / 2 - 20, posY - 24, textWidth + 40, 48, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub.text, width / 2, posY);
    } else if (style === 'minimal_serif') {
      ctx.font = '400 28px "Georgia", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(sub.text, width / 2, posY);
    } else {
      // Bold outline
      ctx.font = '800 38px "Outfit", sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeText(sub.text, width / 2, posY);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(sub.text, width / 2, posY);
    }

    ctx.restore();
  }

  // Render Motion Graphics / Title Text Clip
  private renderTextClip(
    ctx: CanvasRenderingContext2D,
    config: any,
    width: number,
    height: number,
    timeIntoClip: number
  ): void {
    const text = config.text || 'TITLE TEXT';
    const fontSize = config.fontSize || 48;
    const fontFamily = config.fontFamily || '"Plus Jakarta Sans", sans-serif';

    ctx.font = `${config.fontWeight || 'bold'} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = (config.alignment || 'center') as any;
    ctx.textBaseline = 'middle';

    const y = (config.positionY ? config.positionY / 100 : 0.5) * height - height / 2;

    // Animation effects
    if (config.animation === 'fade') {
      ctx.globalAlpha *= Math.min(1, timeIntoClip * 2);
    } else if (config.animation === 'slide_up') {
      const slide = Math.max(0, (1 - timeIntoClip * 1.5) * 40);
      ctx.translate(0, slide);
    }

    // Outline stroke
    if (config.outlineWidth > 0) {
      ctx.strokeStyle = config.outlineColor || '#000000';
      ctx.lineWidth = config.outlineWidth;
      ctx.strokeText(text, 0, y);
    }

    // Main text
    ctx.fillStyle = config.color || '#ffffff';
    ctx.fillText(text, 0, y);
  }

  // Render standard safe margins (Title Safe & Action Safe)
  private renderSafeMargins(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Action Safe (90% bounding box)
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);

    // Title Safe (80% bounding box)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);

    // Center Crosshair
    const cx = width / 2;
    const cy = height / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Export / Render Pipeline
   */
  public async renderVideo(
    projectData: {
      tracks: TimelineTrack[];
      clips: TimelineClip[];
      subtitles: SubtitleItem[];
      subtitleStyle: SubtitleStyle;
      duration: number;
      width: number;
      height: number;
      fps: number;
      bitrateMbps: number;
    },
    onProgress: (progress: number, frame: number, total: number) => void
  ): Promise<Blob> {
    const { tracks, clips, subtitles, subtitleStyle, duration, width, height, fps, bitrateMbps } =
      projectData;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const stream = exportCanvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrateMbps * 1000000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const totalFrames = Math.ceil(duration * fps);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const resultBlob = new Blob(chunks, { type: mimeType });
        resolve(resultBlob);
      };

      recorder.start();

      let currentFrame = 0;
      const step = 1 / fps;

      const renderInterval = setInterval(() => {
        const time = currentFrame * step;
        this.renderFrame(exportCanvas, time, tracks, clips, subtitles, subtitleStyle);

        currentFrame++;
        const pct = Math.min(100, Math.round((currentFrame / totalFrames) * 100));
        onProgress(pct, currentFrame, totalFrames);

        if (currentFrame >= totalFrames) {
          clearInterval(renderInterval);
          setTimeout(() => {
            recorder.stop();
          }, 300);
        }
      }, 1000 / fps);
    });
  }
}

export const renderEngine = new VideoRenderEngine();
