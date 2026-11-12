import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Initialize Google GenAI client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health and AI status endpoint
app.get('/api/ai/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    model: 'gemini-3.8-flash',
  });
});

// AI Video Editing Assistant endpoint
app.post('/api/ai/edit-assistant', async (req, res) => {
  try {
    const { prompt, projectSummary } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAiClient();
    if (!ai) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the server environment.' });

    const systemInstruction = `You are a professional video editor and colorist operating CineFlow Studio.
You receive a natural language editing instruction and optional project metadata.
You must return a valid JSON object ONLY with the following structure:
{
  "summary": "Clear, professional explanation of edits applied (e.g., 'Enhanced shadows, applied Kodak Portra LUT, added kinetic subtitles, and smoothed audio EQ')",
  "actions": [
    {
      "type": "set_color_grade" | "add_effect" | "add_subtitles" | "adjust_audio" | "add_transition" | "split_clip",
      "params": { ... }
    }
  ]
}

Action schema rules:
1. "set_color_grade":
   params: {
     "exposure": number (-1.0 to 1.0),
     "brightness": number (-50 to 50),
     "contrast": number (0.5 to 2.0),
     "saturation": number (0.0 to 2.0),
     "temperature": number (-50 to 50, warmer is positive),
     "tint": number (-50 to 50),
     "highlights": number (-50 to 50),
     "shadows": number (-50 to 50),
     "whites": number (-50 to 50),
     "blacks": number (-50 to 50),
     "vibrance": number (-50 to 50),
     "lut": "none" | "teal_orange" | "kodak_portra" | "film_noir" | "cyber_neon" | "bleach_bypass" | "vintage_70s" | "fuji_chrome"
   }
2. "add_effect":
   params: {
     "effectType": "vignette" | "film_grain" | "glow" | "blur" | "chromatic_aberration" | "lens_distortion" | "sharpen",
     "intensity": number (0.0 to 1.0)
   }
3. "add_subtitles":
   params: {
     "subtitles": [
       { "start": number, "end": number, "text": string }
     ],
     "style": "bold_outline" | "highlight_karaoke" | "cinematic_box" | "minimal_serif"
   }
4. "adjust_audio":
   params: {
     "volume": number (0.0 to 2.0),
     "eqLow": number (-12 to 12),
     "eqMid": number (-12 to 12),
     "eqHigh": number (-12 to 12),
     "compression": number (0.0 to 1.0),
     "reverb": number (0.0 to 1.0),
     "noiseReduction": boolean
   }
5. "add_transition":
   params: {
     "transitionType": "crossfade" | "dip_black" | "wipe_right" | "zoom_in" | "glitch",
     "duration": number (e.g. 0.8)
   }
6. "split_clip":
   params: {
     "splitTime": number
   }
Output MUST be pure JSON with no markdown tags or extra text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Project State: ${JSON.stringify(projectSummary || { duration: 15, clipCount: 2 })}\nInstruction: ${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const text = (response.text ?? '{}').trim();
    const result = JSON.parse(text);

    res.json({
      success: true,
      summary: result.summary || 'Applied requested edits successfully.',
      actions: result.actions || [],
      isFallback: false,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/edit-assistant:', error);
    res.status(500).json({ error: error.message || 'AI request failed' });
  }
});

// Optional Claude editing assistant. Requires the user's own server-side ANTHROPIC_API_KEY.
app.post('/api/ai/claude-edit-assistant', async (req, res) => {
  try {
    const { prompt, projectSummary } = req.body || {};
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt is required.' });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Claude is not configured. Add ANTHROPIC_API_KEY to the server environment.' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-latest',
        max_tokens: 1800,
        system: `You are an editing-plan generator for CineFlow Studio. Return only valid JSON: {"summary":string,"actions":array}. Only use these action types: set_color_grade, add_effect, add_subtitles, adjust_audio, add_transition, split_clip. Never claim to analyze media that was not supplied. Make conservative, supported suggestions. Project: ${JSON.stringify(projectSummary || {})}`,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const payload: any = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload.error?.message || 'Claude request failed.' });
    const textBlock = (payload.content || []).find((item: any) => item.type === 'text')?.text || '{}';
    const cleaned = textBlock.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(cleaned);
    res.json({ success: true, summary: result.summary || 'Editing plan generated.', actions: Array.isArray(result.actions) ? result.actions : [], provider: 'claude', isFallback: false });
  } catch (error: any) {
    console.error('Claude editing assistant error:', error);
    res.status(500).json({ error: error.message || 'Claude request failed.' });
  }
});

// Real media transcription endpoint. Never fabricate captions when no media/API is supplied.
app.post('/api/ai/transcribe-captions', async (req, res) => {
  try {
    const { mediaBase64, mimeType, language = 'English', duration } = req.body || {};
    if (!mediaBase64 || typeof mediaBase64 !== 'string' || !mimeType) {
      return res.status(400).json({ error: 'Choose a video or audio file to transcribe.' });
    }
    if (mediaBase64.length > 44_000_000) {
      return res.status(413).json({ error: 'Media is too large for direct transcription. Use a shorter or compressed file.' });
    }
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Real transcription requires GEMINI_API_KEY. No sample captions were generated.' });
    }
    const supported = /^(audio\/(mpeg|mp3|wav|ogg|webm|mp4|m4a|aac|flac)|video\/(mp4|webm|quicktime))$/i.test(mimeType);
    if (!supported) return res.status(415).json({ error: 'Unsupported media type. Use MP4, MOV, WebM, MP3, WAV, M4A or AAC.' });
    const prompt = `Transcribe the supplied media into accurate subtitles in ${language}. Return only JSON with a "subtitles" array. Each item must contain "id", "start" and "end" in seconds, and "text". Use actual speech only, preserve spoken language unless it is already ${language}, keep segments readable (roughly 2-8 seconds), and keep timestamps within the media duration ${Number(duration) > 0 ? Number(duration) : 'as detected'}. If there is no intelligible speech, return an empty array. Do not invent dialogue.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ inlineData: { mimeType, data: mediaBase64 } }, { text: prompt }],
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse((response.text ?? '{"subtitles":[]}').trim());
    const subtitles = Array.isArray(parsed) ? parsed : parsed.subtitles;
    if (!Array.isArray(subtitles)) throw new Error('Transcription model returned an invalid subtitle document.');
    const clean = subtitles.filter((s: any) =>
      typeof s.text === 'string' && Number.isFinite(Number(s.start)) &&
      Number.isFinite(Number(s.end)) && Number(s.end) > Number(s.start)
    ).map((s: any, i: number) => ({
      id: String(s.id || `transcript-${i + 1}`),
      start: Math.max(0, Number(s.start)),
      end: Math.min(Number(duration) > 0 ? Number(duration) : Number(s.end), Number(s.end)),
      text: s.text.trim(),
    })).filter((s: any) => s.end > s.start && s.text);
    res.json({ success: true, subtitles: clean, isFallback: false });
  } catch (error: any) {
    console.error('Error in /api/ai/transcribe-captions:', error);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

// AI Multilingual Subtitle Translation endpoint
app.post('/api/ai/translate-captions', async (req, res) => {
  try {
    const { subtitles, targetLanguage } = req.body;
    if (!subtitles || !targetLanguage) {
      return res.status(400).json({ error: 'Subtitles and targetLanguage are required' });
    }

    const ai = getAiClient();
    if (!ai) return res.status(503).json({ error: 'Translation requires GEMINI_API_KEY. No placeholder translation was generated.' });

    const prompt = `Translate the following video subtitles into ${targetLanguage}.
CRITICAL: Preserve the exact "id", "start", and "end" timestamps.
Only translate the "text" property into natural, fluent ${targetLanguage} suitable for video captions (support languages like Malayalam, Hindi, Arabic, Tamil, Telugu, Kannada, Spanish, French, German, Japanese, etc. using their authentic native script).

Input subtitles:
${JSON.stringify(subtitles)}

Return the exact JSON array of objects with: "id", "start", "end", "text".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim());
    res.json({
      success: true,
      subtitles: Array.isArray(parsed) ? parsed : parsed.subtitles || subtitles,
      isFallback: false,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/translate-captions:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

// Script to Video Project generator
app.post('/api/ai/script-to-timeline', async (req, res) => {
  try {
    const { script, style = 'cinematic' } = req.body;
    const ai = getAiClient();

    if (!ai) {
      return res.status(503).json({
        error: 'Script-to-timeline generation requires GEMINI_API_KEY. No sample timeline was generated.',
      });
    }

    const prompt = `Convert the following video script or concept into a structured timeline blueprint for video production:
Script: "${script}"
Style: "${style}"

Return a JSON object with:
{
  "title": "Project Title",
  "colorGrade": { "lut": "teal_orange" | "kodak_portra" | "film_noir" | "cyber_neon", "contrast": number, "saturation": number, "temperature": number },
  "suggestedBpm": number,
  "scenes": [
    { "title": "string", "duration": number (in seconds), "caption": "string", "transition": "crossfade" | "dip_black" | "wipe_right" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json({ success: true, timeline: result, isFallback: false });
  } catch (error: any) {
    console.error('Error in /api/ai/script-to-timeline:', error);
    res.status(500).json({ error: error.message || 'Script generation failed' });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineFlow Studio Server running on port ${PORT}`);
  });
}

// Export the Express app for Vercel's serverless API function.
export default app;

// Keep the Vite middleware and local HTTP listener for development only.
if (!process.env.VERCEL) {
  void startServer();
}
