import React, { useState } from 'react';
import {
  Download,
  X,
  Film,
  CheckCircle2,
  Loader2,
  Play,
  Monitor,
  Sparkles,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { renderEngine } from '../services/renderEngine';

export const ExportModal: React.FC = () => {
  const { isExportModalOpen, setIsExportModalOpen, project } = useProject();

  const [resolution, setResolution] = useState<{ width: number; height: number; label: string }>({
    width: 1920,
    height: 1080,
    label: '1080p Full HD (1920x1080)',
  });
  const [fps, setFps] = useState<number>(30);
  const [bitrateMbps, setBitrateMbps] = useState<number>(16);
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm');

  const [isRendering, setIsRendering] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);

  if (!isExportModalOpen) return null;

  const resolutionOptions = [
    { width: 1280, height: 720, label: '720p HD (1280x720)' },
    { width: 1920, height: 1080, label: '1080p Full HD (1920x1080)' },
    { width: 2560, height: 1440, label: '1440p 2K QHD (2560x1440)' },
    { width: 3840, height: 2160, label: '4K UHD (3840x2160)' },
  ];

  const handleStartRender = async () => {
    setIsRendering(true);
    setProgressPct(0);
    setRenderedBlob(null);
    setRenderedUrl(null);

    try {
      const blob = await renderEngine.renderVideo(
        {
          tracks: project.tracks,
          clips: project.clips,
          subtitles: project.subtitles,
          subtitleStyle: project.subtitleStyle,
          duration: project.duration,
          width: resolution.width,
          height: resolution.height,
          fps,
          bitrateMbps,
        },
        (pct, frame, total) => {
          setProgressPct(pct);
          setCurrentFrame(frame);
          setTotalFrames(total);
        }
      );

      const url = URL.createObjectURL(blob);
      setRenderedBlob(blob);
      setRenderedUrl(url);
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!renderedUrl) return;
    const a = document.createElement('a');
    a.href = renderedUrl;
    a.download = `${project.name.replace(/\s+/g, '_')}_rendered.${format}`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-[#0e121c] border border-[#232c42] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#1c2438] bg-[#0b0e17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Export & Render Studio Video</h2>
              <p className="text-[11px] text-slate-400">
                Hardware-accelerated client render pipeline. No watermarks, no credit restrictions.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#1a2234]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!isRendering && !renderedUrl ? (
            <>
              {/* Resolution */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Export Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {resolutionOptions.map((res) => (
                    <button
                      key={res.label}
                      onClick={() => setResolution(res)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        resolution.label === res.label
                          ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                          : 'bg-[#131926] hover:bg-[#182133] border-[#1e273c] text-slate-400'
                      }`}
                    >
                      <div className="text-xs">{res.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Frame Rate (FPS)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[24, 25, 30, 50, 60].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`py-2 rounded-lg border text-center transition-all text-xs font-mono font-medium ${
                        fps === f
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#131926] hover:bg-[#182133] border-[#1e273c] text-slate-400'
                      }`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Bitrate & Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                    <span>Target Bitrate</span>
                    <span className="font-mono text-blue-400">{bitrateMbps} Mbps</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={bitrateMbps}
                    onChange={(e) => setBitrateMbps(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Container Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFormat('webm')}
                      className={`py-2 rounded border text-center text-xs font-mono font-medium ${
                        format === 'webm'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#131926] border-[#1e273c] text-slate-400'
                      }`}
                    >
                      WebM (VP9)
                    </button>
                    <button
                      onClick={() => setFormat('mp4')}
                      className={`py-2 rounded border text-center text-xs font-mono font-medium ${
                        format === 'mp4'
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#131926] border-[#1e273c] text-slate-400'
                      }`}
                    >
                      MP4 (AVC)
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : isRendering ? (
            /* Real-Time Rendering Progress Screen */
            <div className="py-8 px-4 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Rendering Video Frames ({progressPct}%)
                </h3>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  Frame {currentFrame} of {totalFrames} frames
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-[#131826] rounded-full overflow-hidden border border-[#20293d]">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : (
            /* Render Complete Screen */
            <div className="py-6 px-4 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Video Rendered Successfully!</h3>
                <p className="text-xs text-slate-400">
                  {resolution.width}x{resolution.height} @ {fps}fps · {bitrateMbps} Mbps ·{' '}
                  {renderedBlob ? `${(renderedBlob.size / (1024 * 1024)).toFixed(1)} MB` : ''}
                </p>
              </div>

              {/* Video Player Preview */}
              {renderedUrl && (
                <div className="w-full aspect-video rounded-lg overflow-hidden border border-[#232f48] bg-black">
                  <video src={renderedUrl} controls className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0a0d15] border-t border-[#1c2438] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            {project.duration.toFixed(1)}s sequence duration
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-[#1a2234]"
            >
              Close
            </button>
            {!renderedUrl ? (
              <button
                onClick={handleStartRender}
                disabled={isRendering}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Start Render</span>
              </button>
            ) : (
              <button
                onClick={handleDownload}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Video</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
