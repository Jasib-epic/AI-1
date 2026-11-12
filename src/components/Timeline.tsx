import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MousePointer,
  Scissors,
  Split,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Magnet,
  Maximize2,
  Plus,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { TimelineClip, TimelineTrack } from '../types/editor';

export const Timeline: React.FC = () => {
  const {
    project,
    currentTime,
    seek,
    selectedClipId,
    setSelectedClipId,
    activeTool,
    setActiveTool,
    zoomLevel,
    setZoomLevel,
    splitClipAtPlayhead,
    duplicateClip,
    deleteClip,
    updateClip,
    updateTrack,
    setIsSubtitleModalOpen,
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackHeaderScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [clipOriginalStart, setClipOriginalStart] = useState<number>(0);
  const [trimmingClip, setTrimmingClip] = useState<{ id: string; edge: 'left' | 'right'; origStart: number; origDur: number } | null>(null);

  const TRACK_HEADER_WIDTH = 164; // px

  // Format timecode for ruler labels (00:01, 00:02, etc.)
  const formatRulerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert timeline X position in scroll container to seconds
  const pixelToTime = useCallback(
    (pixelX: number) => {
      return Math.max(0, pixelX / zoomLevel);
    },
    [zoomLevel]
  );

  // Convert seconds to pixel position
  const timeToPixel = useCallback(
    (seconds: number) => {
      return seconds * zoomLevel;
    },
    [zoomLevel]
  );

  // Convert viewport pointer coordinates into timeline-content time.
  // scrollLeft is required because the ruler moves horizontally inside its scroller.
  const getTimelineTimeAtClientX = useCallback((clientX: number) => {
    if (!rulerRef.current) return 0;
    const rect = rulerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    return pixelToTime(clientX - rect.left + scrollLeft);
  }, [pixelToTime]);

  // Ruler Scrubbing Handler
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (!rulerRef.current) return;
    seek(getTimelineTimeAtClientX(e.clientX));
    setIsScrubbingRuler(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbingRuler && rulerRef.current) {
        seek(getTimelineTimeAtClientX(e.clientX));
      } else if (trimmingClip) {
        // Handle clip edge trimming
        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / zoomLevel;

        if (trimmingClip.edge === 'right') {
          const newDur = Math.max(0.5, trimmingClip.origDur + deltaTime);
          updateClip(trimmingClip.id, { duration: newDur });
        } else {
          const newStart = Math.max(0, trimmingClip.origStart + deltaTime);
          const newDur = Math.max(0.5, trimmingClip.origDur - deltaTime);
          updateClip(trimmingClip.id, { start: newStart, duration: newDur });
        }
      } else if (draggingClipId) {
        // Handle clip horizontal dragging
        const deltaX = e.clientX - dragStartX;
        const deltaTime = deltaX / zoomLevel;
        const newStart = Math.max(0, clipOriginalStart + deltaTime);
        updateClip(draggingClipId, { start: newStart });
      }
    };

    const handleMouseUp = () => {
      setIsScrubbingRuler(false);
      setDraggingClipId(null);
      setTrimmingClip(null);
    };

    if (isScrubbingRuler || draggingClipId || trimmingClip) {
      window.addEventListener('pointermove', handleMouseMove);
      window.addEventListener('pointerup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [
    isScrubbingRuler,
    draggingClipId,
    trimmingClip,
    dragStartX,
    clipOriginalStart,
    zoomLevel,
    pixelToTime,
    getTimelineTimeAtClientX,
    seek,
    updateClip,
  ]);

  // Handle Clip Click (Selection or Razor Cut)
  const handleClipPointerDown = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();

    if (activeTool === 'razor') {
      // Split clip directly where clicked
      if (rulerRef.current) {
        const clickTime = getTimelineTimeAtClientX(e.clientX);
        seek(clickTime);
        splitClipAtPlayhead(clip.id);
      }
      return;
    }

    setSelectedClipId(clip.id);
    setDraggingClipId(clip.id);
    setDragStartX(e.clientX);
    setClipOriginalStart(clip.start);
  };

  // Handle Trim Handle Mousedown
  const handleTrimPointerDown = (e: React.PointerEvent, clip: TimelineClip, edge: 'left' | 'right') => {
    e.stopPropagation();
    setTrimmingClip({
      id: clip.id,
      edge,
      origStart: clip.start,
      origDur: clip.duration,
    });
    setDragStartX(e.clientX);
  };

  const totalTimelineWidth = Math.max(1200, timeToPixel(project.duration + 5));

  // Generate ruler tick marks
  const rulerTicks = [];
  const tickInterval = zoomLevel < 30 ? 5 : zoomLevel < 80 ? 2 : 1; // interval in seconds
  for (let t = 0; t <= project.duration + 10; t += tickInterval) {
    rulerTicks.push(t);
  }

  return (
    <div className="cineflow-timeline h-64 bg-[#0a0d14] border-t border-[#1c2438] flex flex-col select-none shrink-0 overflow-hidden">
      {/* Timeline Control Toolbar */}
      <div className="h-9 bg-[#0e121b] border-b border-[#1c2438] px-3 flex items-center justify-between">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'select'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-[#182030]'
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('razor')}
            className={`p-1.5 rounded transition-colors ${
              activeTool === 'razor'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-[#182030]'
            }`}
            title="Razor Blade Tool (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-[#222c40] mx-1" />

          {/* Quick Edit Actions */}
          <button
            onClick={() => splitClipAtPlayhead()}
            disabled={!selectedClipId}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              selectedClipId
                ? 'text-slate-300 hover:text-white hover:bg-[#1a2336]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Split Clip at Playhead"
          >
            <Split className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>

          <button
            onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition-colors ${
              selectedClipId
                ? 'text-slate-300 hover:text-white hover:bg-[#1a2336]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Duplicate Clip"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => selectedClipId && deleteClip(selectedClipId)}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition-colors ${
              selectedClipId
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Delete Selected Clip (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Snapping & Current Timecode */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-400 font-mono font-semibold tabular-nums">
            {currentTime.toFixed(2)}s
          </span>
        </div>

        {/* Right: Zoom Level Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel(Math.max(15, zoomLevel - 10))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1a2336]"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={15}
            max={150}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-24 h-1 cursor-pointer"
          />
          <button
            onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1a2336]"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Multitrack Canvas Area */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Column: Fixed Track Headers */}
        <div
          className="bg-[#0b0e17] border-r border-[#1c2438] shrink-0 z-20 flex flex-col min-h-0"
          style={{ width: `${TRACK_HEADER_WIDTH}px` }}
        >
          {/* Top spacer matching ruler height */}
          <div className="h-6 border-b border-[#1c2438] bg-[#0d1017] flex items-center px-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Tracks
            </span>
          </div>

          {/* Track Headers */}
          <div ref={trackHeaderScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className="border-b border-[#1a2234] px-2 flex items-center justify-between transition-colors bg-[#0e121c] hover:bg-[#131926]"
                style={{ height: `${track.height}px` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      track.type === 'video'
                        ? 'bg-blue-600/30 text-blue-400'
                        : track.type === 'audio'
                        ? 'bg-amber-600/30 text-amber-400'
                        : 'bg-purple-600/30 text-purple-400'
                    }`}
                  >
                    {track.name.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-300 font-medium truncate">
                    {track.name.split(' ').slice(1).join(' ') || track.name}
                  </span>
                </div>

                {/* Track Controls (Mute / Lock) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                    className={`p-1 rounded ${
                      track.muted ? 'text-red-400 bg-red-500/20' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={track.muted ? 'Unmute Track' : 'Mute Track'}
                  >
                    {track.type === 'video' ? (
                      track.muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />
                    ) : track.muted ? (
                      <VolumeX className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => updateTrack(track.id, { locked: !track.locked })}
                    className={`p-1 rounded ${
                      track.locked ? 'text-amber-400 bg-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={track.locked ? 'Unlock Track' : 'Lock Track'}
                  >
                    {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Area: Scrollable Tracks & Ruler */}
        <div
          ref={containerRef}
          onScroll={(e) => {
            if (trackHeaderScrollRef.current) {
              trackHeaderScrollRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          className="flex-1 min-h-0 min-w-0 overflow-auto relative bg-[#090b12]"
        >
          <div style={{ width: `${totalTimelineWidth}px` }} className="relative min-h-full">
            {/* Top Timecode Ruler */}
            <div
              ref={rulerRef}
              onPointerDown={handleRulerPointerDown}
              className="sticky top-0 z-20 h-6 bg-[#0d1017] border-b border-[#1c2438] relative cursor-pointer select-none"
            >
              {rulerTicks.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col justify-end"
                  style={{ left: `${timeToPixel(t)}px` }}
                >
                  <div className="h-2 w-[1px] bg-slate-600" />
                  <span className="text-[9px] font-mono text-slate-400 pl-1 pb-0.5 tabular-nums pointer-events-none">
                    {formatRulerTime(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* Multitrack Lanes */}
            <div className="relative">
              {project.tracks.map((track) => {
                const trackClips = project.clips.filter((c) => c.trackId === track.id);

                return (
                  <div
                    key={track.id}
                    className="border-b border-[#171e2e] relative timeline-grid"
                    style={{ height: `${track.height}px` }}
                  >
                    {/* Captions Track Special Row */}
                    {track.type === 'caption' ? (
                      <div className="h-full flex items-center">
                        {project.subtitles.map((sub) => (
                          <div
                            key={sub.id}
                            onClick={() => setIsSubtitleModalOpen(true)}
                            className="absolute h-7 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 px-2 flex items-center text-[11px] text-purple-200 truncate cursor-pointer transition-colors shadow-sm"
                            style={{
                              left: `${timeToPixel(sub.start)}px`,
                              width: `${timeToPixel(sub.end - sub.start)}px`,
                            }}
                            title="Click to edit subtitles"
                          >
                            <span className="truncate">{sub.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Video / Audio Clip Blocks */
                      trackClips.map((clip) => {
                        const isSelected = selectedClipId === clip.id;
                        const clipLeft = timeToPixel(clip.start);
                        const clipWidth = timeToPixel(clip.duration);

                        return (
                          <div
                            key={clip.id}
                            onPointerDown={(e) => handleClipPointerDown(e, clip)}
                            className={`absolute top-1 bottom-1 rounded overflow-hidden cursor-pointer select-none transition-shadow flex flex-col justify-between p-1.5 ${
                              isSelected
                                ? 'ring-2 ring-blue-400 z-10 shadow-lg shadow-blue-500/20'
                                : 'hover:brightness-110'
                            } ${
                              clip.type === 'video'
                                ? 'bg-gradient-to-r from-blue-900/90 to-blue-800/90 border border-blue-500/40 text-blue-100'
                                : clip.type === 'title'
                                ? 'bg-gradient-to-r from-emerald-900/90 to-teal-800/90 border border-emerald-500/40 text-emerald-100'
                                : 'bg-gradient-to-r from-amber-900/90 to-yellow-800/90 border border-amber-500/40 text-amber-100'
                            }`}
                            style={{
                              left: `${clipLeft}px`,
                              width: `${clipWidth}px`,
                            }}
                          >
                            {/* Left Trim Handle */}
                            <div
                              onPointerDown={(e) => handleTrimPointerDown(e, clip, 'left')}
                              className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-w-resize"
                            />

                            {/* Clip Header Label */}
                            <div className="flex items-center justify-between text-[11px] font-semibold truncate pointer-events-none">
                              <span className="truncate">{clip.name}</span>
                              <span className="font-mono text-[10px] opacity-75 shrink-0 ml-1">
                                {clip.duration.toFixed(1)}s
                              </span>
                            </div>

                            {/* Transitions badges */}
                            <div className="flex items-center gap-1 pointer-events-none">
                              {clip.transitionIn && (
                                <span className="text-[9px] px-1 bg-black/40 rounded text-cyan-300">
                                  {clip.transitionIn.type}
                                </span>
                              )}
                              {clip.effects.length > 0 && (
                                <span className="text-[9px] px-1 bg-black/40 rounded text-amber-300">
                                  FX:{clip.effects.length}
                                </span>
                              )}
                            </div>

                            {/* Right Trim Handle */}
                            <div
                              onPointerDown={(e) => handleTrimPointerDown(e, clip, 'right')}
                              className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-e-resize"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>

            {/* Vertical Playhead Scrubber Needle */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              style={{ left: `${timeToPixel(currentTime)}px` }}
            >
              {/* Triangular Needle Cap */}
              <div className="w-3 h-3 bg-red-500 -ml-[5px] -mt-1 transform rotate-45 shadow-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
