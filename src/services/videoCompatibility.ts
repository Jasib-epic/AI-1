import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpegInstance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!loading) {
    loading = (async () => {
      const ffmpeg = new FFmpeg();
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
      const loadAsset = async (url: string, type: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not download the local video converter.');
        return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
      };
      const [coreURL, wasmURL] = await Promise.all([
        loadAsset(`${base}/ffmpeg-core.js`, 'text/javascript'),
        loadAsset(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
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
  const inputName = 'source-input';
  const outputName = 'browser-compatible.mp4';
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
  if (result !== 0) throw new Error('Automatic video conversion failed for this file.');
  const data = await ffmpeg.readFile(outputName);
  if (!(data instanceof Uint8Array) || data.length === 0) {
    throw new Error('The converted video file is empty.');
  }
  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(outputName).catch(() => undefined);
  return new File([data], file.name.replace(/\.[^.]+$/, '') + '-converted.mp4', {
    type: 'video/mp4',
    lastModified: Date.now(),
  });
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
