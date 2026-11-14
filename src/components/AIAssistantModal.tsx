import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  CheckCircle2,
  Palette,
  Volume2,
  Wand2,
  Film,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

type EditAction = {
  type: 'set_color_grade' | 'add_effect' | 'adjust_audio' | 'add_transition';
  params: Record<string, unknown>;
};

type EditPlan = {
  summary: string;
  actions: EditAction[];
};

function buildLocalEditPlan(prompt: string): EditPlan {
  const text = prompt.toLowerCase();
  const actions: EditAction[] = [];

  if (/cinematic|film look|color grade|colour grade|color grading|colour grading|warm|vintage|noir|teal|orange|contrast|saturat/.test(text)) {
    let lut = 'none';
    if (/portra|kodak|warm|vintage/.test(text)) lut = 'kodak_portra';
    else if (/noir|black and white|monochrome/.test(text)) lut = 'film_noir';
    else if (/teal|orange|blockbuster/.test(text)) lut = 'teal_orange';
    else if (/cyber|neon/.test(text)) lut = 'cyber_neon';
    else if (/bleach/.test(text)) lut = 'bleach_bypass';
    else if (/fuji|chrome/.test(text)) lut = 'fuji_chrome';

    actions.push({
      type: 'set_color_grade',
      params: {
        exposure: 0,
        brightness: 0,
        contrast: /high contrast|dramatic|blockbuster/.test(text) ? 1.25 : 1.12,
        saturation: /muted|desaturated|noir/.test(text) ? 0.85 : 1.08,
        temperature: /warm|golden|sunset|portra/.test(text) ? 10 : 0,
        tint: 0,
        highlights: -8,
        shadows: -4,
        whites: 0,
        blacks: -5,
        vibrance: 8,
        lut,
      },
    });
  }

  const effectMatch = text.match(/(vignette|film grain|grain|glow|blur|sharpen|chromatic aberration|lens distortion)/);
  if (effectMatch) {
    const requested = effectMatch[1];
    const effectType =
      requested === 'grain' ? 'film_grain' :
      requested === 'chromatic aberration' ? 'chromatic_aberration' :
      requested === 'lens distortion' ? 'lens_distortion' :
      requested.replace(/ /g, '_');
    actions.push({
      type: 'add_effect',
      params: { effectType, intensity: /subtle|slight|light/.test(text) ? 0.2 : 0.35 },
    });
  }

  if (/audio|sound|volume|music|voice|loud|quiet/.test(text)) {
    actions.push({
      type: 'adjust_audio',
      params: {
        volume: /louder|boost|increase/.test(text) ? 1.15 : 1,
        eqLow: 1,
        eqMid: 0,
        eqHigh: 1,
        compression: 0.25,
        reverb: 0,
        noiseReduction: false,
      },
    });
  }

  if (/transition|crossfade|fade between|smooth cuts/.test(text)) {
    actions.push({
      type: 'add_transition',
      params: {
        transitionType: /dip to black|fade to black/.test(text) ? 'dip_black' : 'crossfade',
        duration: 0.8,
      },
    });
  }

  return {
    summary: actions.length
      ? 'Created an offline edit plan using CineFlow’s built-in controls. Review the actions before applying them.'
      : 'No supported local edit command was found. Try a color-grade, effect, audio, or transition instruction.',
    actions,
  };
}

export const AIAssistantModal: React.FC = () => {
  const { isAiModalOpen, setIsAiModalOpen, applyAIActions, project } = useProject();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<EditPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAiModalOpen) return null;

  const quickPrompts = [
    'Give the video a cinematic color grade with stronger contrast',
    'Apply a warm Kodak Portra style and subtle film grain',
    'Add a subtle vignette and glow effect',
    'Improve the audio presence and gently boost the volume',
    'Add smooth crossfade transitions between video clips',
  ];

  const handleRunLocal = (selectedPrompt?: string) => {
    const textToRun = selectedPrompt ?? prompt;
    if (!textToRun.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setAiResult(null);

    // Keep the interaction asynchronous so the loading state is visible,
    // while all planning itself remains local and makes no network request.
    window.setTimeout(() => {
      const plan = buildLocalEditPlan(textToRun);
      if (plan.actions.length === 0) {
        setErrorMsg(
          /subtitle|caption|transcrib|translat|speech|split|cut|reverse|speed/.test(textToRun.toLowerCase())
            ? 'This request needs a feature that the offline assistant cannot perform. Captions can still be added manually in Subtitle Studio. No changes were made.'
            : 'No supported local action matched that instruction. Try color grading, an effect, audio adjustment, or a transition.'
        );
      } else {
        setAiResult(plan);
      }
      setIsLoading(false);
    }, 120);
  };

  const handleApplyToTimeline = () => {
    if (!aiResult?.actions.length) return;
    applyAIActions(aiResult.actions, aiResult.summary);
    setIsAiModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0e121c] border border-[#232c42] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="p-4 border-b border-[#1c2438] bg-[#0b0e17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Quick Edit Assistant</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                  OFFLINE
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Builds edit plans locally. No Gemini, Claude, API key, or media upload required.
              </p>
            </div>
          </div>
          <button onClick={() => setIsAiModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#1a2234]" aria-label="Close assistant">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-200">
            Offline mode supports color grading, visual effects, audio settings, and transitions. It does not analyze footage, generate speech transcripts, or translate captions.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block" htmlFor="cineflow-local-prompt">
              Editing instruction
            </label>
            <div className="relative">
              <textarea
                id="cineflow-local-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Give my video a warm cinematic look, add subtle film grain, and improve the audio..."
                rows={3}
                className="w-full bg-[#131926] text-xs text-slate-200 p-3 rounded-lg border border-[#212b3e] outline-none focus:border-amber-500/60 resize-none font-medium placeholder-slate-500"
              />
              <button
                onClick={() => handleRunLocal()}
                disabled={isLoading || !prompt.trim()}
                className="absolute right-3 bottom-3 px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white disabled:bg-slate-800 disabled:text-slate-500"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Preparing...' : 'Build Local Plan'}</span>
              </button>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">Example commands</span>
            <div className="space-y-1.5">
              {quickPrompts.map((item) => (
                <button
                  key={item}
                  onClick={() => { setPrompt(item); handleRunLocal(item); }}
                  className="w-full text-left p-2 rounded bg-[#131826] hover:bg-[#1a2236] border border-[#1e263c] text-xs text-slate-300 hover:text-white flex items-center justify-between gap-2"
                >
                  <span>{item}</span>
                  <Wand2 className="w-3 h-3 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {errorMsg && <div role="alert" className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-lg text-xs text-amber-200">{errorMsg}</div>}

          {aiResult && (
            <div className="p-4 bg-[#111726] border border-[#24304c] rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Local edit plan ready</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{aiResult.summary}</p>
              <div className="grid grid-cols-2 gap-2">
                {aiResult.actions.map((action, index) => (
                  <div key={index} className="p-2 bg-[#161e30] rounded border border-[#232f4a] flex items-center gap-2 text-xs text-slate-200">
                    {action.type === 'set_color_grade' ? <Palette className="w-3.5 h-3.5 text-blue-400" /> :
                      action.type === 'adjust_audio' ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> :
                      <Film className="w-3.5 h-3.5 text-emerald-400" />}
                    <span className="capitalize">{action.type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
              {project.clips.filter((clip) => clip.type === 'video').length === 0 && (
                <p className="text-[11px] text-amber-300">There are no video clips on the timeline yet. Color and visual effects will apply when video clips are present.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-3 bg-[#0a0d15] border-t border-[#1c2438] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Review the plan before applying changes.</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsAiModalOpen(false)} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-[#1a2234]">Close</button>
            <button
              onClick={handleApplyToTimeline}
              disabled={!aiResult?.actions.length}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-500"
            >
              Apply to Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
