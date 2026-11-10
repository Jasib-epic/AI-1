import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Palette,
  Subtitles,
  Volume2,
  Scissors,
  Wand2,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';

export const AIAssistantModal: React.FC = () => {
  const {
    isAiModalOpen,
    setIsAiModalOpen,
    applyAIActions,
    project,
  } = useProject();

  const [prompt, setPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'claude'>('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    summary: string;
    actions: any[];
    isFallback?: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAiModalOpen) return null;

  const quickPrompts = [
    'Make this video cinematic, improve contrast, add professional subtitles, enhance audio and create smooth transitions',
    'Apply warm Kodak Portra color grading, add 35mm film grain, and increase shadow contrast',
    'Generate auto-captions with karaoke highlights and clean background audio EQ',
    'Create rhythmic crossfade transitions between all cuts and boost audio presence',
    'Detect key highlights and set high-impact blockbuster color grade with Teal & Orange LUT',
  ];

  const handleRunAI = async (selectedPrompt?: string) => {
    const textToRun = selectedPrompt || prompt;
    if (!textToRun.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setAiResult(null);

    try {
      const res = await fetch(aiProvider === 'claude' ? '/api/ai/claude-edit-assistant' : '/api/ai/edit-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToRun,
          projectSummary: {
            title: project.name,
            duration: project.duration,
            clipCount: project.clips.length,
            tracks: project.tracks.map((t) => t.name),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process AI instruction');
      }

      setAiResult(data);
    } catch (err: any) {
      console.error('AI assistant error:', err);
      setErrorMsg(err.message || 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToTimeline = () => {
    if (aiResult && aiResult.actions) {
      applyAIActions(aiResult.actions, aiResult.summary);
      setIsAiModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0e121c] border border-[#232c42] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#1c2438] bg-[#0b0e17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{aiProvider === 'claude' ? 'Claude AI Video Editing Assistant' : 'Gemini AI Video Editing Assistant'}</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  {aiProvider === 'claude' ? 'Claude API' : 'Gemini API'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Type natural language editing commands to grade colors, add subtitles, transitions, and audio mastering.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAiModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#1a2234]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2">
            <label htmlFor="cineflow-ai-provider" className="text-xs text-slate-400">AI provider</label>
            <select id="cineflow-ai-provider" value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'claude')}
              className="bg-[#131926] text-xs text-slate-200 px-3 py-2 rounded border border-[#212b3e]">
              <option value="gemini">Gemini (GEMINI_API_KEY)</option>
              <option value="claude">Claude (ANTHROPIC_API_KEY)</option>
            </select>
          </div>

          {/* Prompt Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Editing Instruction
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Make this video cinematic, improve contrast, add professional subtitles, enhance the audio and create smooth transitions..."
                rows={3}
                className="w-full bg-[#131926] text-xs text-slate-200 p-3 rounded-lg border border-[#212b3e] outline-none focus:border-amber-500/60 resize-none font-medium placeholder-slate-500"
              />
              <button
                onClick={() => handleRunAI()}
                disabled={isLoading || !prompt.trim()}
                className={`absolute right-3 bottom-3 px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isLoading || !prompt.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 cursor-pointer'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Generate Plan</span>
              </button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Recommended Commands
            </span>
            <div className="space-y-1.5">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrompt(qp);
                    handleRunAI(qp);
                  }}
                  className="w-full text-left p-2 rounded bg-[#131826] hover:bg-[#1a2236] border border-[#1e263c] text-xs text-slate-300 hover:text-white transition-colors flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{qp}</span>
                  <Wand2 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* AI Result Card */}
          {aiResult && (
            <div className="p-4 bg-[#111726] border border-[#24304c] rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>AI Plan Generated</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {aiResult.summary}
              </p>

              {/* Action Pills */}
              <div className="space-y-1.5 pt-2 border-t border-[#1d273e]">
                <span className="text-[11px] font-semibold text-slate-400">Timeline Operations:</span>
                <div className="grid grid-cols-2 gap-2">
                  {aiResult.actions.map((act, i) => (
                    <div
                      key={i}
                      className="p-2 bg-[#161e30] rounded border border-[#232f4a] flex items-center gap-2 text-xs text-slate-200"
                    >
                      {act.type === 'set_color_grade' ? (
                        <Palette className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : act.type === 'add_subtitles' ? (
                        <Subtitles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      ) : act.type === 'adjust_audio' ? (
                        <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Scissors className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate font-medium capitalize">
                        {act.type.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0a0d15] border-t border-[#1c2438] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Operations apply directly to non-destructive timeline clips
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-[#1a2234]"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyToTimeline}
              disabled={!aiResult || !aiResult.actions}
              className={`px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                aiResult && aiResult.actions
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Apply Changes to Timeline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
