import { MediaAsset } from '../types/editor';

/**
 * Procedural Media Asset Generator
 * Creates realistic, ready-to-edit video and audio assets using native Canvas and Web Audio APIs.
 * This guarantees instant, offline-capable playback without external network dependencies.
 */

// Generate a procedural video clip with real frames and timecodes
export async function createProceduralVideo(
  type: 'cyber' | 'sunset' | 'particles',
  durationSec: number = 6
): Promise<{ url: string; blob: Blob; thumbnailUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  // Thumbnail canvas
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 160;
  thumbCanvas.height = 90;
  const thumbCtx = thumbCanvas.getContext('2d')!;

  const fps = 30;
  const totalFrames = durationSec * fps;
  const stream = canvas.captureStream(fps);

  // Audio track for the video (subtle ambient drone)
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const dest = audioCtx.createMediaStreamDestination();
  osc.frequency.setValueAtTime(type === 'cyber' ? 110 : 80, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(dest);
  osc.start();

  const combinedStream = new MediaStream([
    ...stream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      osc.stop();
      audioCtx.close();
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
      resolve({ url, blob, thumbnailUrl });
    };

    recorder.start();

    let frame = 0;
    const interval = setInterval(() => {
      const progress = frame / totalFrames;
      const t = frame / fps;

      ctx.save();
      if (type === 'cyber') {
        // Deep cyber dark background with grid & glowing sun
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGrad.addColorStop(0, '#0a0d1a');
        bgGrad.addColorStop(0.6, '#180f33');
        bgGrad.addColorStop(1, '#06070d');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Perspective grid lines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1.5;
        const horizon = canvas.height * 0.6;
        for (let x = -canvas.width; x <= canvas.width * 2; x += 80) {
          ctx.beginPath();
          ctx.moveTo(canvas.width / 2, horizon);
          ctx.lineTo(x + ((t * 40) % 80), canvas.height);
          ctx.stroke();
        }
        for (let y = horizon; y <= canvas.height; y += 24) {
          const depth = (y - horizon) / (canvas.height - horizon);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Glowing Synth Sun
        const sunX = canvas.width / 2;
        const sunY = horizon - 60;
        const sunRadius = 110;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRadius);
        sunGrad.addColorStop(0, '#fbbf24');
        sunGrad.addColorStop(0.7, '#f43f5e');
        sunGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        // City skyline silhouettes
        ctx.fillStyle = '#0a0914';
        const buildings = [
          { x: 180, w: 90, h: 220 },
          { x: 300, w: 120, h: 280 },
          { x: 440, w: 80, h: 190 },
          { x: 540, w: 140, h: 320 },
          { x: 700, w: 100, h: 240 },
          { x: 820, w: 130, h: 290 },
          { x: 970, w: 90, h: 210 },
        ];
        buildings.forEach((b) => {
          ctx.fillRect(b.x, horizon - b.h + Math.sin(t + b.x) * 4, b.w, b.h + 50);
          // Window lights
          ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
          for (let wy = horizon - b.h + 20; wy < horizon; wy += 22) {
            for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 18) {
              if (Math.sin(wx * 11 + wy * 13) > 0.1) {
                ctx.fillRect(wx, wy, 8, 10);
              }
            }
          }
          ctx.fillStyle = '#0a0914';
        });
      } else if (type === 'sunset') {
        // Golden hour ocean sunset
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGrad.addColorStop(0, '#fdba74');
        bgGrad.addColorStop(0.35, '#f97316');
        bgGrad.addColorStop(0.55, '#c2410c');
        bgGrad.addColorStop(0.56, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Sun
        const sunY = canvas.height * 0.52 - progress * 40;
        ctx.fillStyle = '#fffbeb';
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 45;
        ctx.beginPath();
        ctx.arc(canvas.width * 0.5, sunY, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Water reflection waves
        ctx.fillStyle = 'rgba(254, 215, 170, 0.35)';
        for (let i = 0; i < 40; i++) {
          const y = canvas.height * 0.56 + i * 8;
          const spread = (i / 40) * 350;
          const waveX = canvas.width * 0.5 + Math.sin(t * 3 + i) * 20;
          ctx.fillRect(waveX - spread / 2, y, spread, 3);
        }
      } else {
        // Abstract cinematic light particles
        ctx.fillStyle = '#08090f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 60; i++) {
          const px = (Math.sin(i * 1.5 + t * 0.5) * 0.5 + 0.5) * canvas.width;
          const py = (Math.cos(i * 2.1 + t * 0.4) * 0.5 + 0.5) * canvas.height;
          const rad = (Math.sin(t + i) * 0.5 + 0.5) * 8 + 3;

          const pGrad = ctx.createRadialGradient(px, py, 0, px, py, rad * 3);
          pGrad.addColorStop(0, i % 2 === 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(236, 72, 153, 0.8)');
          pGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(px, py, rad * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Studio Overlay Text / Timecode stamp
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '16px "JetBrains Mono", monospace';
      ctx.fillText(`REC [00:00:0${Math.floor(t)}:${Math.floor((t % 1) * 30)}]  •  CINEFLOW RAW 4K`, 40, 50);

      ctx.restore();

      // Capture thumbnail mid-way
      if (frame === Math.floor(totalFrames / 3)) {
        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }

      frame++;
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / fps);
  });
}

// Synthesize an ambient music audio buffer & blob
export async function createProceduralAudio(
  type: 'lofi' | 'ambient' | 'sfx_whoosh' | 'sfx_impact'
): Promise<{ url: string; duration: number; blob: Blob }> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const sampleRate = audioCtx.sampleRate;
  const duration = type.startsWith('sfx') ? 1.5 : 12;
  const frameCount = sampleRate * duration;
  const buffer = audioCtx.createBuffer(2, frameCount, sampleRate);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (type === 'lofi') {
    // Warm chord progression + subtle vinyl crackle
    const chords = [261.63, 329.63, 392.0, 493.88]; // C, E, G, B
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const chordIndex = Math.floor(t / 3) % chords.length;
      const baseFreq = chords[chordIndex];

      // Fundamental + harmonic
      const wave =
        Math.sin(2 * Math.PI * baseFreq * t) * 0.2 +
        Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.08 +
        Math.sin(2 * Math.PI * (baseFreq * 0.5) * t) * 0.15;

      // Vinyl crackle
      const crackle = Math.random() > 0.998 ? (Math.random() - 0.5) * 0.15 : 0;
      // Gentle sidechain pump every 1 second
      const pump = 0.8 + 0.2 * Math.cos(2 * Math.PI * 1.0 * t);

      left[i] = (wave * pump + crackle) * 0.6;
      right[i] = (wave * pump * 0.95 + crackle * 0.8) * 0.6;
    }
  } else if (type === 'ambient') {
    // Cinematic drone pad with chorus
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const f1 = 65.41; // C2
      const f2 = 98.0; // G2
      const wave =
        Math.sin(2 * Math.PI * f1 * t) * 0.25 +
        Math.sin(2 * Math.PI * f2 * t + Math.sin(t * 0.5)) * 0.2 +
        Math.sin(2 * Math.PI * (f1 * 2.01) * t) * 0.1;

      left[i] = wave * Math.sin((t / duration) * Math.PI);
      right[i] = wave * Math.sin((t / duration) * Math.PI) * 0.9;
    }
  } else if (type === 'sfx_whoosh') {
    // Filtered noise sweep
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const env = Math.sin((t / duration) * Math.PI);
      const noise = (Math.random() * 2 - 1) * env * 0.4;
      left[i] = noise;
      right[i] = noise * 0.8;
    }
  } else {
    // Low frequency cinematic impact sub-drop
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 3);
      const freq = 120 * Math.exp(-t * 5);
      const hit = Math.sin(2 * Math.PI * freq * t) * decay * 0.7;
      left[i] = hit;
      right[i] = hit;
    }
  }

  // Convert buffer to WAV Blob
  const wavBlob = audioBufferToWavBlob(buffer);
  const url = URL.createObjectURL(wavBlob);
  audioCtx.close();
  return { url, duration, blob: wavBlob };
}

// Utility to convert AudioBuffer to WAV format
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  out.setUint8(pos++, 0x52);
  out.setUint8(pos++, 0x49);
  out.setUint8(pos++, 0x46);
  out.setUint8(pos++, 0x46);
  setUint32(length - 8);
  // WAVE
  out.setUint8(pos++, 0x57);
  out.setUint8(pos++, 0x41);
  out.setUint8(pos++, 0x56);
  out.setUint8(pos++, 0x45);
  // fmt
  out.setUint8(pos++, 0x66);
  out.setUint8(pos++, 0x6d);
  out.setUint8(pos++, 0x74);
  out.setUint8(pos++, 0x20);
  setUint32(16); // subchunk1size
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample
  // data
  out.setUint8(pos++, 0x64);
  out.setUint8(pos++, 0x61);
  out.setUint8(pos++, 0x74);
  out.setUint8(pos++, 0x61);
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

// Generate the initial starter bundle for new projects
export async function generateInitialMediaBundle(): Promise<{
  assets: MediaAsset[];
}> {
  try {
    const [cyberVideo, sunsetVideo, lofiAudio, sfxWhoosh] = await Promise.all([
      createProceduralVideo('cyber', 6),
      createProceduralVideo('sunset', 6),
      createProceduralAudio('lofi'),
      createProceduralAudio('sfx_whoosh'),
    ]);

    const assets: MediaAsset[] = [
      {
        id: 'asset-cyber-1',
        name: 'Cyberpunk Neon City 4K.mp4',
        type: 'video',
        url: cyberVideo.url,
        duration: 6,
        width: 1280,
        height: 720,
        thumbnailUrl: cyberVideo.thumbnailUrl,
        blob: cyberVideo.blob,
      },
      {
        id: 'asset-sunset-2',
        name: 'Golden Hour Horizon.mp4',
        type: 'video',
        url: sunsetVideo.url,
        duration: 6,
        width: 1280,
        height: 720,
        thumbnailUrl: sunsetVideo.thumbnailUrl,
        blob: sunsetVideo.blob,
      },
      {
        id: 'asset-lofi-1',
        name: 'Midnight Cinematic Beat.wav',
        type: 'audio',
        url: lofiAudio.url,
        duration: lofiAudio.duration,
        blob: lofiAudio.blob,
      },
      {
        id: 'asset-whoosh-1',
        name: 'Smooth Whoosh Transition.wav',
        type: 'audio',
        url: sfxWhoosh.url,
        duration: sfxWhoosh.duration,
        blob: sfxWhoosh.blob,
      },
    ];

    return { assets };
  } catch (err) {
    console.warn('Initial bundle generation fallback:', err);
    return { assets: [] };
  }
}
