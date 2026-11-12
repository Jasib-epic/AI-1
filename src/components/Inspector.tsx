import React, { useState } from 'react';
import {
  Sliders,
  Palette,
  Wand2,
  Volume2,
  Type,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { LUT_PRESETS, DEFAULT_COLOR_GRADE } from '../utils/colorGrading';
import { EffectType, LUTPreset } from '../types/editor';

type InspectorTab = 'transform' | 'color' | 'effects' | 'audio' | 'text';

export const Inspector: React.FC = () => {
  const {
    project,
    selectedClipId,
    updateClip,
    updateColorGrade,
    addEffectToClip,
    toggleEffect,
    updateEffectIntensity,
    removeEffect,
    updateMasterAudio,
  } = useProject();

  const [activeTab, setActiveTab] = useState<InspectorTab>('color');

  const clip = project.clips.find((c) => c.id === selectedClipId);

  if (!clip) {
    return (
      <aside className="w-80 bg-[#0e121b] border-l border-[#1c2438] flex flex-col items-center justify-center p-6 text-center select-none text-slate-500">
        <Sliders className="w-8 h-8 mb-2 opacity-40 text-blue-400" />
        <p className="text-xs font-medium text-slate-400 mb-1">No Clip Selected</p>
        <p className="text-[11px] text-slate-500">
          Click any video, audio, or title clip on the timeline to inspect and edit its properties.
        </p>
      </aside>
    );
  }

  const isTitle = clip.type === 'title';

  return (
    <aside className="w-80 bg-[#0e121b] border-l border-[#1c2438] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Header with Clip Name & Tabs */}
      <div className="p-3 border-b border-[#1b2234] bg-[#0c0f17]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
            Inspector
          </span>
          <span className="text-xs text-slate-300 font-medium truncate max-w-[160px]">
            {clip.name}
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#07090e] p-1 rounded border border-[#181f30]">
          <button
            onClick={() => setActiveTab('color')}
            className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'color' ? 'bg-[#1b2336] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Color Grading"
          >
            <Palette className="w-3 h-3" />
            <span>Color</span>
          </button>
          <button
            onClick={() => setActiveTab('transform')}
            className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'transform' ? 'bg-[#1b2336] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Transforms & Speed"
          >
            <Sliders className="w-3 h-3" />
            <span>Motion</span>
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'effects' ? 'bg-[#1b2336] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Effects Stack"
          >
            <Wand2 className="w-3 h-3" />
            <span>FX ({clip.effects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'audio' ? 'bg-[#1b2336] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Audio Dynamics & EQ"
          >
            <Volume2 className="w-3 h-3" />
            <span>Audio</span>
          </button>
          {isTitle && (
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'text' ? 'bg-[#1b2336] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3 h-3" />
              <span>Text</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Professional Color Grading Studio */}
      {activeTab === 'color' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Preset LUTs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200">Cinematic LUTs</span>
              <button
                onClick={() => updateColorGrade(clip.id, DEFAULT_COLOR_GRADE)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                title="Reset All Color Grading"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {LUT_PRESETS.map((lut) => (
                <button
                  key={lut.id}
                  onClick={() => updateColorGrade(clip.id, { lut: lut.id })}
                  className={`p-2 rounded text-left border transition-all ${
                    clip.colorGrade.lut === lut.id
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                      : 'bg-[#131926] hover:bg-[#182133] border-[#1f283c] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: lut.previewColor }}
                    />
                    <span className="text-xs font-medium truncate">{lut.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{lut.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Corrections Sliders */}
          <div className="space-y-3 pt-2 border-t border-[#1c2438]">
            <span className="text-xs font-semibold text-slate-200 block">Primary Adjustments</span>

            {/* Exposure */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Exposure</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {clip.colorGrade.exposure > 0 ? `+${clip.colorGrade.exposure.toFixed(2)}` : clip.colorGrade.exposure.toFixed(2)} EV
                </span>
              </div>
              <input
                type="range"
                min={-1.5}
                max={1.5}
                step={0.05}
                value={clip.colorGrade.exposure}
                onChange={(e) => updateColorGrade(clip.id, { exposure: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Contrast */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Contrast</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {clip.colorGrade.contrast.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={clip.colorGrade.contrast}
                onChange={(e) => updateColorGrade(clip.id, { contrast: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Saturation</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {Math.round(clip.colorGrade.saturation * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.05}
                value={clip.colorGrade.saturation}
                onChange={(e) => updateColorGrade(clip.id, { saturation: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Temperature (Warm / Cool) */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Temperature</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {clip.colorGrade.temperature > 0 ? `+${clip.colorGrade.temperature}` : clip.colorGrade.temperature}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                value={clip.colorGrade.temperature}
                onChange={(e) => updateColorGrade(clip.id, { temperature: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Tint (Magenta / Green) */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Tint</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {clip.colorGrade.tint}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                value={clip.colorGrade.tint}
                onChange={(e) => updateColorGrade(clip.id, { tint: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Highlights & Shadows */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Highlights</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {clip.colorGrade.highlights}
                  </span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={clip.colorGrade.highlights}
                  onChange={(e) => updateColorGrade(clip.id, { highlights: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Shadows</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {clip.colorGrade.shadows}
                  </span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={clip.colorGrade.shadows}
                  onChange={(e) => updateColorGrade(clip.id, { shadows: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Vibrance */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Vibrance</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {clip.colorGrade.vibrance}
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                value={clip.colorGrade.vibrance}
                onChange={(e) => updateColorGrade(clip.id, { vibrance: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* 3-Way Color Wheels (Lift, Gamma, Gain) */}
          <details className="cineflow-disclosure">
            <summary>Advanced color wheels</summary>
          <div className="pt-2 border-t border-[#1c2438]">
            <span className="text-xs font-semibold text-slate-200 block mb-3">
              3-Way Color Wheels
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['lift', 'gamma', 'gain'] as const).map((wheel) => {
                const val = clip.colorGrade.wheels[wheel];
                return (
                  <div key={wheel} className="bg-[#121622] p-2 rounded border border-[#1e263a]">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      {wheel}
                    </span>
                    {/* Interactive color picker simulation */}
                    <div className="w-16 h-16 mx-auto rounded-full border border-slate-700 bg-gradient-to-tr from-blue-900 via-neutral-800 to-amber-900 relative cursor-pointer flex items-center justify-center">
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-white shadow"
                        style={{
                          transform: `translate(${val.r * 15}px, ${val.b * 15}px)`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-slate-400">
                      Y: {val.y.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {/* Tab 2: Transforms & Motion */}
      {activeTab === 'transform' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-xs font-semibold text-slate-200 block">Position & Scale</span>

          {/* Position X */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Position X</span>
              <span className="font-mono text-slate-200 tabular-nums">{clip.transform.x}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={clip.transform.x}
              onChange={(e) =>
                updateClip(clip.id, {
                  transform: { ...clip.transform, x: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Position Y */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Position Y</span>
              <span className="font-mono text-slate-200 tabular-nums">{clip.transform.y}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={clip.transform.y}
              onChange={(e) =>
                updateClip(clip.id, {
                  transform: { ...clip.transform, y: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Scale */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Scale</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {clip.transform.scale.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={clip.transform.scale}
              onChange={(e) =>
                updateClip(clip.id, {
                  transform: { ...clip.transform, scale: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Rotation */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Rotation</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {clip.transform.rotation}°
              </span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              value={clip.transform.rotation}
              onChange={(e) =>
                updateClip(clip.id, {
                  transform: { ...clip.transform, rotation: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Opacity */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Opacity</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {Math.round(clip.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={clip.opacity}
              onChange={(e) => updateClip(clip.id, { opacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Speed Multiplier */}
          <div className="pt-2 border-t border-[#1c2438]">
            <span className="text-xs font-semibold text-slate-200 block mb-2">Speed Multiplier</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => updateClip(clip.id, { speed: spd })}
                  className={`py-1.5 rounded text-xs font-mono font-medium border ${
                    clip.speed === spd
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#131926] hover:bg-[#192233] border-[#1e273c] text-slate-300'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Visual Effects Stack */}
      {activeTab === 'effects' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Active Effects Stack</span>
            <span className="text-[11px] text-slate-500 font-mono">{clip.effects.length} loaded</span>
          </div>

          {clip.effects.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No effects stacked on this clip. Use the left panel Effects library to add Grain, Glow, Vignette, etc.
            </div>
          ) : (
            <div className="space-y-2.5">
              {clip.effects.map((eff) => (
                <div
                  key={eff.id}
                  className="bg-[#131926] p-3 rounded-lg border border-[#1f283c] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={eff.enabled}
                        onChange={() => toggleEffect(clip.id, eff.id)}
                        className="rounded accent-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-200">{eff.name}</span>
                    </div>
                    <button
                      onClick={() => removeEffect(clip.id, eff.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove effect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Intensity</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {Math.round(eff.intensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={eff.intensity}
                      onChange={(e) =>
                        updateEffectIntensity(clip.id, eff.id, Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Audio Engineering Studio */}
      {activeTab === 'audio' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-xs font-semibold text-slate-200 block">Clip Volume & Level</span>

          {/* Volume */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Volume</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {Math.round(clip.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.05}
              value={clip.volume}
              onChange={(e) => updateClip(clip.id, { volume: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* 3-Band Parametric Equalizer */}
          <details className="cineflow-disclosure" open>
            <summary>Parametric equalizer</summary>
            <div className="pb-3 space-y-3">

            {/* EQ Low */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Bass (Low Shelf 160Hz)</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {project.masterAudio.eqLow > 0 ? `+${project.masterAudio.eqLow}` : project.masterAudio.eqLow} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                value={project.masterAudio.eqLow}
                onChange={(e) => updateMasterAudio({ eqLow: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* EQ Mid */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Mid (Presence 1.2kHz)</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {project.masterAudio.eqMid > 0 ? `+${project.masterAudio.eqMid}` : project.masterAudio.eqMid} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                value={project.masterAudio.eqMid}
                onChange={(e) => updateMasterAudio({ eqMid: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* EQ High */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Treble (High Shelf 4.5kHz)</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {project.masterAudio.eqHigh > 0 ? `+${project.masterAudio.eqHigh}` : project.masterAudio.eqHigh} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                value={project.masterAudio.eqHigh}
                onChange={(e) => updateMasterAudio({ eqHigh: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            </div>
          </details>

          {/* Dynamics & Reverb */}
          <details className="cineflow-disclosure">
            <summary>Dynamics & ambience</summary>
            <div className="pb-3 space-y-3">

            {/* Studio Reverb */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Studio Reverb Space</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {Math.round(project.masterAudio.reverb * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={project.masterAudio.reverb}
                onChange={(e) => updateMasterAudio({ reverb: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Compression Toggle */}
            <div className="flex items-center justify-between bg-[#121622] p-2 rounded border border-[#1e273a]">
              <span className="text-xs text-slate-300">Master Compressor / Limiter</span>
              <input
                type="checkbox"
                checked={project.masterAudio.compressor}
                onChange={(e) => updateMasterAudio({ compressor: e.target.checked })}
                className="rounded accent-blue-500"
              />
            </div>
            </div>
          </details>
        </div>
      )}

      {/* Tab 5: Text / Motion Graphics Config */}
      {activeTab === 'text' && clip.textConfig && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="text-xs font-semibold text-slate-200 block">Title Properties</span>

          {/* Text Input */}
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Title Text</label>
            <input
              type="text"
              value={clip.textConfig.text}
              onChange={(e) =>
                updateClip(clip.id, {
                  textConfig: { ...clip.textConfig!, text: e.target.value },
                })
              }
              className="w-full bg-[#131926] text-xs text-white px-2.5 py-1.5 rounded border border-[#20293d] outline-none focus:border-blue-500"
            />
          </div>

          {/* Font Size */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Font Size</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {clip.textConfig.fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={18}
              max={96}
              value={clip.textConfig.fontSize}
              onChange={(e) =>
                updateClip(clip.id, {
                  textConfig: { ...clip.textConfig!, fontSize: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Text Color</label>
              <input
                type="color"
                value={clip.textConfig.color}
                onChange={(e) =>
                  updateClip(clip.id, {
                    textConfig: { ...clip.textConfig!, color: e.target.value },
                  })
                }
                className="w-full h-8 bg-transparent rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Outline Color</label>
              <input
                type="color"
                value={clip.textConfig.outlineColor}
                onChange={(e) =>
                  updateClip(clip.id, {
                    textConfig: { ...clip.textConfig!, outlineColor: e.target.value },
                  })
                }
                className="w-full h-8 bg-transparent rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
