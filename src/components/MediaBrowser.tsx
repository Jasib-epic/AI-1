import React, { useState, useRef } from 'react';
import {
  FolderPlus,
  Upload,
  Film,
  Music,
  Image as ImageIcon,
  Wand2,
  Sparkles,
  Layers,
  Mic,
  MicOff,
  Type,
  Plus,
  Play,
  Scissors,
  Check,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { EffectType, TransitionType } from '../types/editor';
import { audioEngine } from '../services/audioEngine';

type BrowserTab = 'media' | 'effects' | 'transitions' | 'audio' | 'titles';

export const MediaBrowser: React.FC = () => {
  const {
    mediaAssets,
    importUserFiles,
    addClipToTrack,
    addTitleClip,
    selectedClipId,
    addEffectToClip,
    setClipTransition,
    addMediaAsset,
    currentTime,
    project,
  } = useProject();

  const [activeTab, setActiveTab] = useState<BrowserTab>('media');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecordingVo, setIsRecordingVo] = useState(false);
  const [voDuration, setVoDuration] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voTimerRef = useRef<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      importUserFiles(e.target.files);
    }
  };

  // Voiceover Recording Handler
  const handleToggleVoiceover = async () => {
    if (!isRecordingVo) {
      const ok = await audioEngine.startVoiceoverRecording();
      if (ok) {
        setIsRecordingVo(true);
        setVoDuration(0);
        voTimerRef.current = window.setInterval(() => {
          setVoDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      setIsRecordingVo(false);
      const result = await audioEngine.stopVoiceoverRecording();
      if (result) {
        const newAsset = {
          id: `vo-${Date.now()}`,
          name: `Voiceover ${new Date().toLocaleTimeString()}.wav`,
          type: 'audio' as const,
          url: result.url,
          duration: result.duration,
          blob: result.blob,
        };
        addMediaAsset(newAsset);
        // Automatically drop onto dialogue track (A1) at current playhead
        addClipToTrack(newAsset.id, 'track-a1', currentTime);
      }
    }
  };

  // Visual Effects definitions
  const effectsCatalog: { type: EffectType; name: string; desc: string; icon: string }[] = [
    { type: 'film_grain', name: '35mm Film Grain', desc: 'Organic analog grain texture', icon: '🎞️' },
    { type: 'vignette', name: 'Cinematic Vignette', desc: 'Radial perimeter dark falloff', icon: '🔘' },
    { type: 'glow', name: 'Halation Glow', desc: 'Warm highlight bloom diffusion', icon: '✨' },
    { type: 'chromatic_aberration', name: 'Chromatic Aberration', desc: 'Optical RGB prism channel split', icon: '🌈' },
    { type: 'blur', name: 'Gaussian Blur', desc: 'Smooth aesthetic depth defocus', icon: '🌫️' },
    { type: 'sharpen', name: 'Detail Sharpen', desc: 'High-pass edge clarity boost', icon: '🔍' },
    { type: 'chroma_key', name: 'Chroma Key (Green Screen)', desc: 'Transparent backdrop isolate', icon: '🟩' },
  ];

  // Transitions catalog
  const transitionsCatalog: { type: TransitionType; name: string; desc: string }[] = [
    { type: 'crossfade', name: 'Cross Dissolve', desc: 'Seamless linear opacity blend' },
    { type: 'dip_black', name: 'Dip to Black', desc: 'Dramatic fade through dark' },
    { type: 'dip_white', name: 'Dip to White', desc: 'High-exposure flash cut' },
    { type: 'wipe_right', name: 'Horizontal Wipe', desc: 'Clean graphic directional wipe' },
    { type: 'zoom_in', name: 'Zoom In Burst', desc: 'Dynamic scale motion transition' },
    { type: 'glitch', name: 'Digital Glitch', desc: 'Signal artifact displacement' },
  ];

  const filteredAssets = mediaAssets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 bg-[#0f131d] border-r border-[#1e2638] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-[#1c2436] bg-[#0c1018] px-2 pt-1 gap-1">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'media'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Media</span>
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'effects'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Effects</span>
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'transitions'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Transitions</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'audio'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Audio</span>
        </button>
        <button
          onClick={() => setActiveTab('titles')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
            activeTab === 'titles'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Titles</span>
        </button>
      </div>

      {/* Tab 1: Project Media Pool */}
      {activeTab === 'media' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* Import Button & Search */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#1e273c] hover:bg-[#283450] text-blue-400 hover:text-blue-300 text-xs font-semibold rounded border border-blue-500/30 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Media</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
            />
          </div>

          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141a27] text-xs text-slate-300 px-2.5 py-1.5 rounded border border-[#212b3e] outline-none focus:border-blue-500/60 mb-3"
          />

          {/* Assets List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No media assets found. Import MP4, MOV, MP3 or images above.
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group bg-[#151b28] hover:bg-[#1a2335] p-2 rounded-lg border border-[#212b3e] flex items-center gap-2.5 transition-colors"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-12 h-10 bg-[#0d1017] rounded overflow-hidden relative shrink-0 flex items-center justify-center">
                    {asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === 'video' ? (
                      <Film className="w-5 h-5 text-blue-400" />
                    ) : asset.type === 'audio' ? (
                      <Music className="w-5 h-5 text-amber-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{asset.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {asset.duration.toFixed(1)}s · {asset.type.toUpperCase()}
                    </p>
                  </div>

                  {/* Add to Timeline Button */}
                  <button
                    onClick={() => {
                      const trackId = asset.type === 'audio' ? 'track-a1' : 'track-v1';
                      addClipToTrack(asset.id, trackId);
                    }}
                    className="p-1.5 rounded bg-[#1e273c] text-blue-400 hover:text-white hover:bg-blue-600 transition-colors"
                    title="Add to Timeline at playhead"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Visual Effects */}
      {activeTab === 'effects' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto">
          <p className="text-[11px] text-slate-400 mb-3">
            {selectedClipId
              ? 'Click any effect to stack onto the selected video clip:'
              : 'Select a video clip on the timeline to apply effects:'}
          </p>

          <div className="space-y-2">
            {effectsCatalog.map((eff) => (
              <button
                key={eff.type}
                disabled={!selectedClipId}
                onClick={() => selectedClipId && addEffectToClip(selectedClipId, eff.type)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                  selectedClipId
                    ? 'bg-[#151b28] hover:bg-[#1f283c] border-[#212b3e] text-slate-200 cursor-pointer'
                    : 'bg-[#121620] border-[#1b2232] text-slate-600 cursor-not-allowed opacity-60'
                }`}
              >
                <span className="text-xl shrink-0">{eff.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">{eff.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{eff.desc}</div>
                </div>
                {selectedClipId && <Plus className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Transitions */}
      {activeTab === 'transitions' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto">
          <p className="text-[11px] text-slate-400 mb-3">
            Apply cinematic transitions to the selected clip:
          </p>

          <div className="space-y-2">
            {transitionsCatalog.map((tr) => (
              <button
                key={tr.type}
                disabled={!selectedClipId}
                onClick={() =>
                  selectedClipId &&
                  setClipTransition(selectedClipId, { type: tr.type, duration: 0.8 })
                }
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                  selectedClipId
                    ? 'bg-[#151b28] hover:bg-[#1f283c] border-[#212b3e] text-slate-200 cursor-pointer'
                    : 'bg-[#121620] border-[#1b2232] text-slate-600 cursor-not-allowed opacity-60'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">{tr.name}</div>
                  <div className="text-[11px] text-slate-400">{tr.desc}</div>
                </div>
                {selectedClipId && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Audio Studio & Voiceover */}
      {activeTab === 'audio' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-4">
          {/* Microphone Voiceover Recorder */}
          <div className="p-3 bg-[#151b28] rounded-lg border border-[#232c40]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-red-400" />
                <span>Voiceover Studio</span>
              </span>
              {isRecordingVo && (
                <span className="text-[11px] font-mono text-red-400 font-bold animate-pulse tabular-nums">
                  REC 00:0{voDuration}s
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Record microphone voiceover and automatically drop it onto the timeline.
            </p>
            <button
              onClick={handleToggleVoiceover}
              className={`w-full py-2 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                isRecordingVo
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-[#20293e] hover:bg-[#2b3754] text-red-400 hover:text-white border border-red-500/30'
              }`}
            >
              {isRecordingVo ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecordingVo ? 'Stop & Drop onto Timeline' : 'Record Voiceover'}</span>
            </button>
          </div>

          {/* Sound FX Library */}
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Built-in Studio SFX & Music
            </span>
            <div className="space-y-1.5">
              {mediaAssets
                .filter((a) => a.type === 'audio')
                .map((audio) => (
                  <div
                    key={audio.id}
                    className="p-2 bg-[#141926] hover:bg-[#1a2233] rounded border border-[#20283a] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs text-slate-200 truncate">{audio.name}</span>
                    </div>
                    <button
                      onClick={() => addClipToTrack(audio.id, 'track-a2')}
                      className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-[#1e273c] rounded shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Titles & Motion Graphics */}
      {activeTab === 'titles' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3">
          <p className="text-[11px] text-slate-400">
            Add motion graphics and title overlays to the timeline:
          </p>
          <button
            onClick={() => addTitleClip('track-v2')}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Type className="w-4 h-4" />
            <span>+ Add Cinematic Title Layer</span>
          </button>

          <div className="space-y-2 mt-2">
            {[
              { title: 'Lower Third Broadcast', style: 'News / Documentary style name banner' },
              { title: 'Minimalist Modern Opener', style: 'Crisp serif typography with fade reveal' },
              { title: 'Kinetic Highlight Title', style: 'Dynamic tracking and high-contrast punch' },
            ].map((t, i) => (
              <div
                key={i}
                onClick={() => addTitleClip('track-v2')}
                className="p-2.5 bg-[#141a27] hover:bg-[#1a2335] rounded-lg border border-[#212b3e] cursor-pointer transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">{t.title}</div>
                <div className="text-[11px] text-slate-400">{t.style}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
