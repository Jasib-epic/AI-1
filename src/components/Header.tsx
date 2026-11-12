import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  Sparkles,
  Download,
  Film,
  Monitor,
  Check,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const Header: React.FC = () => {
  const {
    project,
    updateProjectName,
    updateResolution,
    canUndo,
    canRedo,
    undo,
    redo,
    setIsAiModalOpen,
    setIsExportModalOpen,
  } = useProject();

  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [showResMenu, setShowResMenu] = useState(false);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (projectName.trim()) {
      updateProjectName(projectName.trim());
    } else {
      setProjectName(project.name);
    }
  };

  const resolutions = [
    { width: 1920, height: 1080, label: '1080p 16:9 Landscape', aspect: '16:9' },
    { width: 3840, height: 2160, label: '4K UHD 16:9 Landscape', aspect: '16:9' },
    { width: 1080, height: 1920, label: '1080p 9:16 Vertical (Reels/Shorts)', aspect: '9:16' },
    { width: 1080, height: 1080, label: '1080p 1:1 Square (Feed)', aspect: '1:1' },
    { width: 1080, height: 1350, label: '1080p 4:5 Portrait', aspect: '4:5' },
  ];

  return (
    <header className="h-12 bg-[#10141f] border-b border-[#1e2638] px-4 flex items-center justify-between gap-6 shrink-0 z-30 select-none">
      {/* Zone 1: Wordmark & Project Name */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wider text-white font-mono uppercase">
            CINEFLOW
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#232b3e]" />

        {/* Editable Project Name */}
        {isEditingName ? (
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
            autoFocus
            className="bg-[#1a2133] text-xs text-white px-2 py-1 rounded border border-blue-500 outline-none w-48 font-medium"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-xs text-slate-300 hover:text-white font-medium max-w-[200px] truncate px-2 py-1 rounded hover:bg-[#1a2133] transition-colors"
            title="Click to rename project"
          >
            {project.name}
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-1.5 rounded text-xs ${
              canUndo ? 'text-slate-300 hover:text-white hover:bg-[#1a2133]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-1.5 rounded text-xs ${
              canRedo ? 'text-slate-300 hover:text-white hover:bg-[#1a2133]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 3: Aspect Ratio, AI Studio, and Render Export */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Resolution selector */}
        <div className="relative">
          <button
            onClick={() => setShowResMenu(!showResMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-[#161c2a] hover:bg-[#1e2638] border border-[#242d42] rounded transition-colors whitespace-nowrap"
          >
            <Monitor className="w-3 h-3 text-slate-400" />
            <span className="font-mono tabular-nums">{project.resolution.aspectRatio}</span>
          </button>

          {showResMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-[#151a27] border border-[#242e44] rounded-lg shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#20273a]">
                Project Aspect Ratio & Resolution
              </div>
              {resolutions.map((res) => (
                <button
                  key={res.label}
                  onClick={() => {
                    updateResolution(res.width, res.height, res.label, res.aspect);
                    setShowResMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-slate-300 hover:text-white hover:bg-[#1f283d] transition-colors"
                >
                  <span className="truncate">{res.label}</span>
                  {project.resolution.aspectRatio === res.aspect && (
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Studio Assistant Button */}
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/40 rounded shadow-sm hover:shadow-amber-500/10 transition-all cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>AI Studio</span>
        </button>

        {/* Export / Render Button */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-md shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
