import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Maximize2,
  Columns,
  Grid,
  Activity,
  ChevronLeft,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { renderEngine } from '../services/renderEngine';
import { computeVideoScopes, ScopeData } from '../utils/colorGrading';

export const PreviewMonitor: React.FC = () => {
  const {
    project,
    currentTime,
    isPlaying,
    togglePlay,
    seek,
    stepFrame,
    splitCompare,
    setSplitCompare,
    splitPosition,
    setSplitPosition,
    showSafeMargins,
    setShowSafeMargins,
    showScopes,
    setShowScopes,
    scopeType,
    setScopeType,
  } = useProject();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  // Timecode Formatter: Seconds -> HH:MM:SS:FF
  const formatTimecode = (seconds: number, fps: number = 30) => {
    const totalFrames = Math.floor(seconds * fps);
    const hrs = Math.floor(totalFrames / (fps * 3600));
    const mins = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
    const secs = Math.floor((totalFrames % (fps * 60)) / fps);
    const frames = totalFrames % fps;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  // Render loop for the main preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderEngine.renderFrame(
      canvas,
      currentTime,
      project.tracks,
      project.clips,
      project.subtitles,
      project.subtitleStyle,
      {
        splitCompare,
        splitPosition,
        showSafeMargins,
      }
    );

    // If scopes are open, compute and render them
    if (showScopes && scopeCanvasRef.current) {
      renderScopes(canvas, scopeCanvasRef.current, scopeType);
    }
  }, [
    currentTime,
    project.tracks,
    project.clips,
    project.subtitles,
    project.subtitleStyle,
    splitCompare,
    splitPosition,
    showSafeMargins,
    showScopes,
    scopeType,
  ]);

  // Render real-time color scopes (Waveform, Vectorscope, Histogram)
  const renderScopes = (
    srcCanvas: HTMLCanvasElement,
    scopeCanvas: HTMLCanvasElement,
    type: 'waveform' | 'vectorscope' | 'histogram'
  ) => {
    const sCtx = scopeCanvas.getContext('2d');
    if (!sCtx) return;

    const w = scopeCanvas.width;
    const h = scopeCanvas.height;
    sCtx.fillStyle = '#090c14';
    sCtx.fillRect(0, 0, w, h);

    const scopes: ScopeData = computeVideoScopes(srcCanvas);

    if (type === 'waveform') {
      // 0..100 IRE Luma Waveform
      sCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      sCtx.lineWidth = 1;
      // Grid lines for 100 IRE (Peak), 50 IRE, 0 IRE (Black)
      [0.1, 0.5, 0.9].forEach((frac) => {
        const y = h * frac;
        sCtx.beginPath();
        sCtx.moveTo(0, y);
        sCtx.lineTo(w, y);
        sCtx.stroke();
      });

      // IRE Labels
      sCtx.fillStyle = '#64748b';
      sCtx.font = '9px "JetBrains Mono", monospace';
      sCtx.fillText('100 IRE', 6, h * 0.12);
      sCtx.fillText('50 IRE', 6, h * 0.52);
      sCtx.fillText('0 IRE', 6, h * 0.92);

      // Plot green/white luma scatter
      sCtx.fillStyle = 'rgba(74, 222, 128, 0.5)';
      const wave = scopes.waveformLuma;
      const stepX = w / wave.length;
      for (let x = 0; x < wave.length; x++) {
        const points = wave[x];
        const drawX = x * stepX;
        for (let p = 0; p < points.length; p += 2) {
          const luma = points[p]; // 0..255
          const drawY = h * 0.9 - (luma / 255) * (h * 0.8);
          sCtx.fillRect(drawX, drawY, 1.5, 1.5);
        }
      }
    } else if (type === 'vectorscope') {
      // Polar Vectorscope (Cb / Cr)
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 15;

      // Outer circle & Crosshair
      sCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      sCtx.beginPath();
      sCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      sCtx.stroke();

      sCtx.beginPath();
      sCtx.moveTo(cx - radius, cy);
      sCtx.lineTo(cx + radius, cy);
      sCtx.moveTo(cx, cy - radius);
      sCtx.lineTo(cx, cy + radius);
      sCtx.stroke();

      // SMPTE targets (R, Mg, B, Cy, G, Yl)
      sCtx.fillStyle = '#94a3b8';
      sCtx.font = '8px "JetBrains Mono", monospace';
      sCtx.fillText('R', cx + radius * 0.6, cy - radius * 0.6);
      sCtx.fillText('B', cx - radius * 0.7, cy + radius * 0.4);
      sCtx.fillText('G', cx - radius * 0.5, cy - radius * 0.5);

      // Plot points
      sCtx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      scopes.vectorscopePoints.forEach((pt) => {
        const px = cx + (pt.x / 128) * (radius * 0.85);
        const py = cy + (pt.y / 128) * (radius * 0.85);
        sCtx.fillRect(px, py, 1.5, 1.5);
      });
    } else {
      // RGB Histogram
      const maxVal = Math.max(...scopes.histogramR, ...scopes.histogramG, ...scopes.histogramB, 1);
      const barW = w / 256;

      // Plot R, G, B channels
      sCtx.globalCompositeOperation = 'screen';

      // Red
      sCtx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      for (let i = 0; i < 256; i++) {
        const barH = (scopes.histogramR[i] / maxVal) * (h * 0.85);
        sCtx.fillRect(i * barW, h - barH, barW, barH);
      }
      // Green
      sCtx.fillStyle = 'rgba(34, 197, 94, 0.6)';
      for (let i = 0; i < 256; i++) {
        const barH = (scopes.histogramG[i] / maxVal) * (h * 0.85);
        sCtx.fillRect(i * barW, h - barH, barW, barH);
      }
      // Blue
      sCtx.fillStyle = 'rgba(59, 130, 246, 0.6)';
      for (let i = 0; i < 256; i++) {
        const barH = (scopes.histogramB[i] / maxVal) * (h * 0.85);
        sCtx.fillRect(i * barW, h - barH, barW, barH);
      }
      sCtx.globalCompositeOperation = 'source-over';
    }
  };

  // Handle Split Screen Comparison Dragging
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      setSplitPosition(pos);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    if (isDraggingSplit) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit, setSplitPosition]);

  return (
    <div className="flex-1 flex flex-col bg-[#080a10] overflow-hidden select-none relative">
      {/* Top Monitor Toolbar */}
      <div className="h-9 bg-[#0d1017] border-b border-[#1b2234] px-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-300 font-semibold tracking-wider">
            PROGRAM MONITOR
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {project.resolution.width}x{project.resolution.height} @ {project.fps}fps
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Safe Margins */}
          <button
            onClick={() => setShowSafeMargins(!showSafeMargins)}
            className={`p-1.5 rounded transition-colors ${
              showSafeMargins ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-[#1a2133] text-slate-400'
            }`}
            title="Toggle Safe Margins Guides"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Split Comparison Slider Toggle */}
          <button
            onClick={() => setSplitCompare(!splitCompare)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
              splitCompare ? 'bg-blue-600 text-white font-medium' : 'hover:bg-[#1a2133] text-slate-400'
            }`}
            title="Before & After Color Grading Split"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Compare</span>
          </button>

          {/* Real-Time Video Scopes */}
          <button
            onClick={() => setShowScopes(!showScopes)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
              showScopes ? 'bg-amber-600/30 text-amber-400 font-medium' : 'hover:bg-[#1a2133] text-slate-400'
            }`}
            title="Toggle Real-Time Video Scopes"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Scopes</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (containerRef.current) {
                if (!document.fullscreenElement) {
                  containerRef.current.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }
            }}
            className="p-1.5 rounded hover:bg-[#1a2133] text-slate-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Monitor Viewport */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-black/40"
      >
        {/* Aspect Ratio Preserved Video Canvas */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-sm overflow-hidden"
          style={{
            aspectRatio: `${project.resolution.width} / ${project.resolution.height}`,
            maxHeight: 'calc(100% - 10px)',
          }}
        >
          <canvas
            ref={canvasRef}
            width={project.resolution.width}
            height={project.resolution.height}
            className="w-full h-full object-contain bg-black"
          />

          {/* Interactive Split Comparison Slider Line */}
          {splitCompare && (
            <div
              onMouseDown={handleSplitMouseDown}
              className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize z-20 group"
              style={{ left: `${splitPosition * 100}%` }}
            >
              <div className="w-[2px] h-full bg-white shadow-lg group-hover:bg-blue-400" />
              <div className="absolute w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-md text-[10px] font-bold">
                ↔
              </div>
            </div>
          )}
        </div>

        {/* Floating Scopes Overlay Panel */}
        {showScopes && (
          <div className="absolute top-4 right-4 w-72 bg-[#10141f]/95 border border-[#232c42] rounded-lg shadow-2xl p-2.5 z-30 backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1f283c]">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Video Scopes
              </span>
              <div className="flex items-center gap-1">
                {(['waveform', 'vectorscope', 'histogram'] as const).map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setScopeType(sc)}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                      scopeType === sc ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sc === 'waveform' ? 'Wave' : sc === 'vectorscope' ? 'Vector' : 'Hist'}
                  </button>
                ))}
              </div>
            </div>
            <canvas
              ref={scopeCanvasRef}
              width={260}
              height={140}
              className="w-full h-36 bg-[#080b12] rounded border border-[#1b2234]"
            />
          </div>
        )}
      </div>

      {/* Bottom Transport Controls Bar */}
      <div className="h-11 bg-[#0d1017] border-t border-[#1b2234] px-6 flex items-center justify-between select-none">
        {/* Left: SMPTE Timecode Counter */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-blue-400 tabular-nums">
            {formatTimecode(currentTime, project.fps)}
          </span>
          <span className="text-slate-600 text-xs font-mono">/</span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {formatTimecode(project.duration, project.fps)}
          </span>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => seek(0)}
            className="p-1.5 rounded hover:bg-[#1a2133] text-slate-300 hover:text-white transition-colors"
            title="Go to Start (Home)"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => stepFrame(-1)}
            className="p-1.5 rounded hover:bg-[#1a2133] text-slate-300 hover:text-white transition-colors"
            title="Previous Frame (J)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Master Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => stepFrame(1)}
            className="p-1.5 rounded hover:bg-[#1a2133] text-slate-300 hover:text-white transition-colors"
            title="Next Frame (L)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => seek(project.duration)}
            className="p-1.5 rounded hover:bg-[#1a2133] text-slate-300 hover:text-white transition-colors"
            title="Go to End"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Loop toggle & Speed Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded text-xs transition-colors ${
              isLooping ? 'text-blue-400 bg-blue-600/20' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Loop Playback"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-400">1.0x PLAY</span>
        </div>
      </div>
    </div>
  );
};
