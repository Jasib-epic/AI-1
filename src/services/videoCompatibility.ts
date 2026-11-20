import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpegInstance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_VERSION = '0.12.10';
const CORE_PATH = `@ffmpeg/core@${CORE_VERSION}/dist/umd';

/**
 * Load the single-threaded FFmpeg core from a public CDN.
 * Use direct URLs rather than Blob module URLs: some browsers and hosting
 * security policies reject importing the core script from a Blob URL.
 * If the primary CDN is unavailable, retry against jsDelivr.
 */
async function loadCore(ffmpeg: FFmpeg): Promise<void> {
  const bases = [
    `https://cdn.jsdelivr.net/npm/${CORE_PATH}`,
    `https://unpkg.com/${CORE_PATH}`,
  ];
  const failures: string[] = [];

  for (const base of bases) {
    try {
      const coreURL = `${base}/ffmpeg-core.js`;
      const wasmURL = `${base}/ffmpeg-core.wasm`;

      // Verify both assets are reachable before starting the worker. This
      // produces a useful CDN/network error instead of FFmpeg's vague
      // "failed to import ffmpeg-core.js" message.
      const [coreResponse, wasmResponse] = await Promise.all([
        fetch(coreURL, { method: 'HEAD', cache: 'force-cache' }),
        fetch(wasmURL, { method: 'HEAD', cache: 'force-cache' }),
      ]);
      if (!coreResponse.ok || !wasmResponse.ok) {
        throw new Error(`FFmpeg core assets unavailable (JS ${coreResponse.status}, WASM ${wasmResponse.status}).`);
      }

      await ffmpeg.load({ coreURL, wasmURL });
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Could not load FFmpeg from either CDN. Check network access, browser worker permissions, and Content-Security-Policy. ${failures.join(' | ')}`
  );
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!loading) {
    loading = (async () => {
      const ffmpeg = new FFmpeg();
      await loadCore(ffmpeg);
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/**
 * Transcodes unsupported source codecs locally in the browser.
 * Original footage is not uploaded to CineFlow's server.
 */
export async function transcodeVideoForBrowser(file: File): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const inputName = `source-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outputName = `converted-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    const result = await ffmpeg.exec([
      '-i', inputName,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputName,
    ]);
    if (result !== 0) throw new Error('FFmpeg could not convert this video.');
    const data = await ffmpeg.readFile(outputName);
    if (!(data instanceof Uint8Array) || data.length === 0) {
      throw new Error('The converted video file is empty.');
    }
    return new File([data], file.name.replace(/\\.[^.]+$/, '') + '-converted.mp4', {
      type: 'video/mp4',
      lastModified: Date.now(),
    });
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}

/** Resolve only after the browser has decoded a real video frame. */
export async function browserCanDecodeVideo(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  try {
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.removeAttribute('src');
        video.load();
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(false), 10000);
      video.addEventListener('loadeddata', () => finish(video.videoWidth > 0 && video.videoHeight > 0), { once: true });
      video.addEventListener('error', () => finish(false), { once: true });
      video.src = url;
      video.load();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
