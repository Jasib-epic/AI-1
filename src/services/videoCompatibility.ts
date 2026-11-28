import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
// Keep the Blob URLs alive for as long as FFmpeg may need its core/WASM.
let coreBlobURLs: string[] = [];

const CORE_VERSION = '0.12.10';
const CORE_PATH = `@ffmpeg/core@${CORE_VERSION}/dist/umd`;

/**
 * Load FFmpeg's core as same-origin Blob URLs. Browsers often block a Web
 * Worker from importing the core directly from a third-party CDN. HEAD
 * requests are also unreliable on CDNs, so fetch and validate the actual
 * files instead.
 */
async function loadCore(ffmpeg: FFmpeg): Promise<void> {
  const bases = [
    `https://cdn.jsdelivr.net/npm/${CORE_PATH}`,
    `https://unpkg.com/${CORE_PATH}`,
  ];
  const failures: string[] = [];

  for (const base of bases) {
    let coreURL: string | null = null;
    let wasmURL: string | null = null;
    try {
      coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript');
      wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      coreBlobURLs = [coreURL, wasmURL];
      return;
    } catch (error) {
      if (coreURL) URL.revokeObjectURL(coreURL);
      if (wasmURL) URL.revokeObjectURL(wasmURL);
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Could not load the local video converter from either CDN. Check your internet connection or browser network restrictions. Details: ${failures.join(' | ')}`
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

/** Transcodes unsupported source codecs locally in the browser. */
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
    const baseName = file.name.replace(/\\.[^.]+$/, '');
    return new File([data], `${baseName}-converted.mp4`, {
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
