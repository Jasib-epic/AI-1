import React, { useState } from 'react';
import {
  Subtitles,
  X,
  Plus,
  Trash2,
  Globe,
  Sparkles,
  Download,
  Upload,
  Check,
  Loader2,
  Play,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { SubtitleItem, SubtitleStyle } from '../types/editor';

export const SubtitleStudioModal: React.FC = () => {
  const {
    isSubtitleModalOpen,
    setIsSubtitleModalOpen,
    project,
    updateSubtitles,
    setSubtitleStyle,
    seek,
  } = useProject();

  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(project.subtitles);
  const [selectedStyle, setSelectedStyle] = useState<SubtitleStyle>(project.subtitleStyle);
  const [targetLang, setTargetLang] = useState<string>('Malayalam');
  const [sourceLang, setSourceLang] = useState<string>('Auto-detect');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionFile, setTranscriptionFile] = useState<File | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string>('');

  if (!isSubtitleModalOpen) return null;

  const languages = [
    'English',
    'Malayalam',
    'Hindi',
    'Arabic',
    'Tamil',
    'Telugu',
    'Kannada',
    'Spanish',
    'French',
    'German',
    'Japanese',
  ];

  const styles: { id: SubtitleStyle; name: string; preview: string }[] = [
    { id: 'highlight_karaoke', name: 'Karaoke Word Highlight', preview: 'Glowing active word bounce' },
    { id: 'bold_outline', name: 'Bold Outline (Social)', preview: 'Vivid yellow with thick black stroke' },
    { id: 'cinematic_box', name: 'Cinematic Frosted Box', preview: 'Clean backdrop pill for maximum legibility' },
    { id: 'minimal_serif', name: 'Minimalist Serif', preview: 'Criterion / Film festival classic look' },
  ];

  // Transcribe real uploaded media. No filename/title-based mock transcript.
  const handleAutoTranscribe = async () => {
    if (!transcriptionFile) {
      setTranscriptionError('Choose a video or audio file first.');
      return;
    }
    setIsTranscribing(true);
    setTranscriptionError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the selected media file.'));
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.readAsDataURL(transcriptionFile);
      });
      const res = await fetch('/api/ai/transcribe-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64: base64,
          mimeType: transcriptionFile.type || 'video/mp4',
          duration: project.duration,
          language: sourceLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription request failed.');
      if (!Array.isArray(data.subtitles)) throw new Error('The transcription service returned invalid captions.');
      setSubtitles(data.subtitles);
      if (data.subtitles.length === 0) setTranscriptionError('No intelligible speech was detected in this media.');
    } catch (err) {
      setTranscriptionError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Multilingual Translation using Gemini endpoint
  const handleTranslate = async () => {
    if (subtitles.length === 0) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/translate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles,
          targetLanguage: targetLang,
        }),
      });

      const data = await res.json();
      if (data.subtitles && Array.isArray(data.subtitles)) {
        setSubtitles(data.subtitles);
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Export SRT
  const handleExportSRT = () => {
    let srtContent = '';
    const formatSrtTime = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = Math.floor(sec % 60);
      const millis = Math.floor((sec % 1) * 1000);
      const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
    };

    subtitles.forEach((s, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n`;
      srtContent += `${s.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_subtitles.srt`;
    a.click();
  };

  // Save changes
  const handleSave = () => {
    updateSubtitles(subtitles);
    setSubtitleStyle(selectedStyle);
    setIsSubtitleModalOpen(false);
  };

  const handleAddRow = () => {
    const lastSub = subtitles[subtitles.length - 1];
    const newStart = lastSub ? lastSub.end + 0.5 : 1.0;
    const newSub: SubtitleItem = {
      id: `sub-${Date.now()}`,
      start: newStart,
      end: newStart + 3.0,
      text: 'New subtitle dialogue line',
    };
    setSubtitles([...subtitles, newSub]);
  };

  const handleUpdateSub = (id: string, updates: Partial<SubtitleItem>) => {
    setSubtitles(subtitles.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteSub = (id: string) => {
    setSubtitles(subtitles.filter((s) => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-[#0e121c] border border-[#232c42] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#1c2438] bg-[#0b0e17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Subtitles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Subtitle & Caption Studio</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Word-level timing synchronization, multilingual AI translation, and animated styles.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSubtitleModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#1a2234]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Studio Top Control Strip */}
        <div className="px-5 py-3 border-b border-[#1c2438] bg-[#121622] flex items-center justify-between gap-4 flex-wrap">
          {/* Source media for genuine speech recognition */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-slate-300">
              Media for transcription
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,audio/*"
                onChange={(e) => { setTranscriptionFile(e.target.files?.[0] || null); setTranscriptionError(''); }}
                className="block mt-1 max-w-[220px] text-[10px] text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-[#283550] file:px-2 file:py-1 file:text-slate-200"
              />
            </label>
            {transcriptionFile && <span className="text-[10px] text-slate-400">{transcriptionFile.name}</span>}
          </div>
          {/* AI Auto-Transcribe Button */}
          <button
            onClick={handleAutoTranscribe}
            disabled={isTranscribing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            {isTranscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Auto-Transcribe Speech</span>
          </button>

          {transcriptionError && <p role="alert" className="w-full text-xs text-amber-300">{transcriptionError}</p>}

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-400" htmlFor="cineflow-source-language">Speech language</label>
            <select id="cineflow-source-language" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
              className="bg-[#182030] text-xs text-slate-200 px-2 py-1.5 rounded border border-[#242f46]">
              {['Auto-detect','English','Malayalam','Hindi','Arabic','Tamil','Telugu','Kannada','Spanish','French','German','Japanese'].map((lang) => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>

          {/* Multilingual Translation Dropdown & Button */}
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-[#182030] text-xs text-slate-200 px-2 py-1.5 rounded border border-[#242f46] outline-none"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e273c] hover:bg-[#283550] text-blue-400 text-xs font-semibold rounded border border-blue-500/30 transition-colors"
            >
              {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              <span>Translate Captions</span>
            </button>
          </div>

          {/* Export SRT */}
          <button
            onClick={handleExportSRT}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#182030] hover:bg-[#212b40] text-slate-300 text-xs font-medium rounded border border-[#263248] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SRT</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Style Selector Grid */}
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Visual Caption Style Preset
            </span>
            <div className="grid grid-cols-4 gap-2">
              {styles.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStyle(st.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedStyle === st.id
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-[#131826] hover:bg-[#182032] border-[#1f283c] text-slate-400'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-200 mb-0.5">{st.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{st.preview}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Dialogue Lines ({subtitles.length})
              </span>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line</span>
              </button>
            </div>

            <div className="space-y-2">
              {subtitles.map((sub, i) => (
                <div
                  key={sub.id}
                  className="bg-[#131826] p-2.5 rounded-lg border border-[#1f283c] flex items-center gap-3"
                >
                  <button
                    onClick={() => seek(sub.start)}
                    className="p-1 rounded bg-[#1c2438] text-slate-400 hover:text-white"
                    title="Jump playhead to this line"
                  >
                    <Play className="w-3 h-3 ml-0.5" />
                  </button>

                  {/* Timing Inputs */}
                  <div className="flex items-center gap-1 text-xs font-mono">
                    <input
                      type="number"
                      step={0.1}
                      value={sub.start}
                      onChange={(e) =>
                        handleUpdateSub(sub.id, { start: Number(e.target.value) })
                      }
                      className="w-16 bg-[#0c1018] px-1.5 py-1 rounded border border-[#20293d] text-center text-slate-300 outline-none"
                    />
                    <span className="text-slate-600">→</span>
                    <input
                      type="number"
                      step={0.1}
                      value={sub.end}
                      onChange={(e) =>
                        handleUpdateSub(sub.id, { end: Number(e.target.value) })
                      }
                      className="w-16 bg-[#0c1018] px-1.5 py-1 rounded border border-[#20293d] text-center text-slate-300 outline-none"
                    />
                  </div>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={sub.text}
                    onChange={(e) => handleUpdateSub(sub.id, { text: e.target.value })}
                    className="flex-1 bg-[#0c1018] text-xs text-slate-200 px-2.5 py-1.5 rounded border border-[#20293d] outline-none focus:border-purple-500"
                  />

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteSub(sub.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0a0d15] border-t border-[#1c2438] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Real-time word-level captions sync directly with timeline playback
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSubtitleModalOpen(false)}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-[#1a2234]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            >
              Save to Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
