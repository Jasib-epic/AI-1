import { GoogleGenAI } from '@google/genai';

const model = 'gemini-3.8-flash';
const getAI = () => process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const send = (res: any, status: number, body: unknown) => res.status(status).json(body);
const fallback = (res: any, _body: unknown) => send(res, 503, { success: false, error: 'The AI service is unavailable or not configured. No generated content was created. Check GEMINI_API_KEY and retry when the service is available.' });

export async function status(_req: any, res: any) {
  return send(res, 200, { status: 'ok', hasApiKey: Boolean(process.env.GEMINI_API_KEY), model });
}

export async function editAssistant(req: any, res: any) {
  const { prompt, projectSummary } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return send(res, 400, { error: 'Prompt is required' });
  try {
    const ai = getAI();
    if (!ai) {
      const p = prompt.toLowerCase();
      const actions: any[] = [];
      if (/cinematic|contrast|color|grade/.test(p)) actions.push({ type: 'set_color_grade', params: { exposure: 0.05, contrast: 1.2, saturation: 1.1, temperature: 6, tint: -2, highlights: -10, shadows: -12, vibrance: 10, lut: 'teal_orange' } });
      if (/subtitle|caption/.test(p)) actions.push({ type: 'add_subtitles', params: { subtitles: [{ start: 0.5, end: 3, text: 'Welcome to CineFlow Studio' }], style: 'highlight_karaoke' } });
      if (/audio|sound|enhance/.test(p)) actions.push({ type: 'adjust_audio', params: { volume: 1, eqLow: 2, eqMid: 0, eqHigh: 2, compression: 0.5, noiseReduction: true } });
      if (/transition|smooth/.test(p)) actions.push({ type: 'add_transition', params: { transitionType: 'crossfade', duration: 1 } });
      if (/split|cut/.test(p)) actions.push({ type: 'split_clip', params: { splitTime: 4.5 } });
      return fallback(res, { summary: actions.length ? 'Prepared editing actions from your instruction.' : 'Add a more specific editing instruction to generate actions.', actions });
    }
    const response = await ai.models.generateContent({
      model,
      contents: 'Return only JSON with summary and actions array. Allowed action types: set_color_grade, add_effect, add_subtitles, adjust_audio, add_transition, split_clip. User instruction: ' + prompt + '\nProject: ' + JSON.stringify(projectSummary || {}),
      config: { responseMimeType: 'application/json' }
    });
    const parsed = JSON.parse((response.text || '{}').trim());
    return send(res, 200, { success: true, summary: parsed.summary || 'Edits prepared.', actions: Array.isArray(parsed.actions) ? parsed.actions : [], isFallback: false });
  } catch (e: any) { console.error('Gemini edit request failed; using safe fallback:', e?.message); return fallback(res, { summary: 'Gemini is temporarily busy. Your instruction was received, but no automatic edits were generated. Please retry shortly.', actions: [] }); }
}

export async function transcribeCaptions(req: any, res: any) {
  const { videoTitle, audioContext, duration = 15, language = 'English' } = req.body || {};
  try {
    const ai = getAI();
    if (!ai) return fallback(res, { subtitles: [
      { id: 'sub-1', start: 0.5, end: Math.min(3.5, duration * 0.3), text: 'A new story begins here.' },
      { id: 'sub-2', start: Math.min(4, duration * 0.35), end: Math.min(7.8, duration * 0.65), text: 'Every frame shapes the moment.' },
      { id: 'sub-3', start: Math.min(8.2, duration * 0.7), end: Math.max(8.5, duration - 0.5), text: 'Made with CineFlow Studio.' }
    ] });
    const prompt = 'Create timed subtitle segments in ' + language + ' for "' + (videoTitle || 'Video') + '". Context: ' + (audioContext || '') + '. Duration: ' + duration + ' seconds. Return JSON array of {id,start,end,text}; timestamps must be sequential and within duration.';
    const out = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse((out.text || '[]').trim());
    return send(res, 200, { success: true, subtitles: Array.isArray(parsed) ? parsed : parsed.subtitles || [], isFallback: false });
  } catch (e: any) { console.error('Gemini caption request failed; using fallback captions:', e?.message); const d = Math.max(3, Number(duration) || 15); return fallback(res, { subtitles: [{ id: 'sub-1', start: 0.5, end: Math.min(3.5, d), text: 'A new story begins here.' }, { id: 'sub-2', start: Math.min(4, d * 0.4), end: Math.min(7.8, d * 0.7), text: 'Every frame shapes the moment.' }, { id: 'sub-3', start: Math.min(8.2, d * 0.75), end: Math.max(8.5, d - 0.5), text: 'Made with CineFlow Studio.' }] }); }
}

export async function translateCaptions(req: any, res: any) {
  const { subtitles, targetLanguage } = req.body || {};
  if (!Array.isArray(subtitles) || !targetLanguage) return send(res, 400, { error: 'Subtitles and targetLanguage are required' });
  try {
    const ai = getAI();
    if (!ai) return fallback(res, { subtitles: subtitles.map((s: any) => ({ ...s, text: '[' + targetLanguage + '] ' + s.text })) });
    const out = await ai.models.generateContent({ model, contents: 'Translate only subtitle text to ' + targetLanguage + '. Preserve ids and timestamps exactly. Return JSON array. Input: ' + JSON.stringify(subtitles), config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse((out.text || '[]').trim());
    return send(res, 200, { success: true, subtitles: Array.isArray(parsed) ? parsed : parsed.subtitles || subtitles, isFallback: false });
  } catch (e: any) { console.error('Gemini translation failed; using fallback labels:', e?.message); return fallback(res, { subtitles: subtitles.map((s: any) => ({ ...s, text: '[' + targetLanguage + '] ' + s.text })) }); }
}

export async function scriptToTimeline(req: any, res: any) {
  const { script = '', style = 'cinematic' } = req.body || {};
  try {
    const ai = getAI();
    if (!ai) return fallback(res, { timeline: { title: 'Cinematic Story Project', colorGrade: { lut: 'kodak_portra', contrast: 1.2, saturation: 1.1 }, suggestedBpm: 110, scenes: [
      { title: 'Opening', duration: 4, caption: 'Every story begins with a single frame.' },
      { title: 'Main Scene', duration: 6, caption: 'The story unfolds.' },
      { title: 'Closing', duration: 4, caption: 'Crafted with precision.' }
    ] } });
    const out = await ai.models.generateContent({ model, contents: 'Convert this script into a video timeline JSON object with title, colorGrade, suggestedBpm, and scenes [{title,duration,caption,transition}]. Style: ' + style + '. Script: ' + script, config: { responseMimeType: 'application/json' } });
    return send(res, 200, { success: true, timeline: JSON.parse((out.text || '{}').trim()), isFallback: false });
  } catch (e: any) { console.error('Gemini timeline request failed; using fallback timeline:', e?.message); return fallback(res, { timeline: { title: 'Cinematic Story Project', colorGrade: { lut: 'kodak_portra', contrast: 1.2, saturation: 1.1 }, suggestedBpm: 110, scenes: [{ title: 'Opening', duration: 4, caption: 'Every story begins with a single frame.' }, { title: 'Main Scene', duration: 6, caption: 'The story unfolds.' }, { title: 'Closing', duration: 4, caption: 'Crafted with precision.' }] } }); }
}
