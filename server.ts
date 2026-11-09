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
    if (!ai) {
      // Intelligent fallback when API key is not yet set in secrets
      const lower = prompt.toLowerCase();
      const fallbackActions: any[] = [];
      let thought = 'Applying studio presets based on prompt analysis.';

      if (lower.includes('cinematic') || lower.includes('contrast') || lower.includes('color') || lower.includes('grade')) {
        fallbackActions.push({
          type: 'set_color_grade',
          params: {
            exposure: 0.05,
            contrast: 1.25,
            saturation: 1.15,
            temperature: 8,
            tint: -4,
            highlights: -12,
            shadows: -18,
            whites: 6,
            blacks: -10,
            vibrance: 14,
            lut: 'teal_orange',
          },
        });
        fallbackActions.push({
          type: 'add_effect',
          params: {
            effectType: 'vignette',
            intensity: 0.35,
          },
        });
        fallbackActions.push({
          type: 'add_effect',
          params: {
            effectType: 'film_grain',
            intensity: 0.18,
          },
        });
        thought = 'Applied cinematic color grading: Teal & Orange LUT, raised contrast, calibrated highlights, film grain, and subtle vignette.';
      }

      if (lower.includes('subtitle') || lower.includes('caption')) {
        fallbackActions.push({
          type: 'add_subtitles',
          params: {
            subtitles: [
              { start: 0.5, end: 3.2, text: 'Welcome to CineFlow Studio' },
              { start: 3.5, end: 6.8, text: 'Next-Generation Nonlinear Video Editing' },
              { start: 7.0, end: 10.5, text: 'Powered by Real-Time WebGL & AI Studio' },
            ],
            style: 'highlight_karaoke',
          },
        });
      }

      if (lower.includes('audio') || lower.includes('sound') || lower.includes('enhance')) {
        fallbackActions.push({
          type: 'adjust_audio',
          params: {
            volume: 1.0,
            eqLow: 2,
            eqMid: -1,
            eqHigh: 3,
            compression: 0.6,
            limiter: true,
            noiseReduction: true,
          },
        });
      }

      if (lower.includes('transition') || lower.includes('smooth')) {
        fallbackActions.push({
          type: 'add_transition',
          params: {
            transitionType: 'crossfade',
            duration: 1.0,
          },
        });
      }

      if (lower.includes('split') || lower.includes('cut') || lower.includes('silence')) {
        fallbackActions.push({
          type: 'split_clip',
          params: {
            splitTime: 4.5,
          },
        });
      }

      return res.json({
        success: true,
        summary: thought,
        actions: fallbackActions,
        isFallback: true,
      });
    }

    // Call Gemini 3.8 Flash
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

// AI Caption Transcription endpoint
app.post('/api/ai/transcribe-captions', async (req, res) => {
  try {
    const { videoTitle, audioContext, duration, language = 'English' } = req.body;
    const ai = getAiClient();

    if (!ai) {
      // Fallback transcription based on context
      const dur = duration || 12;
      return res.json({
        success: true,
        subtitles: [
          { id: 'sub-1', start: 0.5, end: Math.min(3.5, dur * 0.3), text: 'Creating cinematic motion in modern video production.' },
          { id: 'sub-2', start: Math.min(4.0, dur * 0.35), end: Math.min(7.8, dur * 0.65), text: 'Precise color grading with real-time waveform and vectorscopes.' },
          { id: 'sub-3', start: Math.min(8.2, dur * 0.7), end: Math.min(dur - 0.5, dur * 0.95), text: 'Export in high-fidelity 4K 60FPS directly in your browser.' },
        ],
        isFallback: true,
      });
    }

    const prompt = `Generate realistic, professionally timed subtitles in ${language} for a video titled "${videoTitle || 'Cinematic Video Project'}" with a duration of ${duration || 15} seconds.
Audio context / description: "${audioContext || 'Cinematic footage with spoken dialogue and narrative rhythm'}".
Return a JSON array of objects with fields: "id", "start" (seconds, float), "end" (seconds, float), "text" (transcribed line).
Keep sentence lengths natural (3 to 8 words per segment) and ensure start/end timestamps are strictly sequential and within 0 to ${duration || 15}s.`;

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
      subtitles: Array.isArray(parsed) ? parsed : parsed.subtitles || [],
      isFallback: false,
    });
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
    if (!ai) {
      // Mock translation with language prefix if no API key
      const translated = subtitles.map((s: any) => ({
        ...s,
        text: `[${targetLanguage}] ${s.text}`,
      }));
      return res.json({ success: true, subtitles: translated, isFallback: true });
    }

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
      return res.json({
        success: true,
        timeline: {
          title: 'Cinematic Story Project',
          colorGrade: { lut: 'kodak_portra', contrast: 1.2, saturation: 1.1 },
          suggestedBpm: 110,
          scenes: [
            { title: 'Intro Scene', duration: 4, caption: 'Every story begins with a single frame.' },
            { title: 'Climax Action', duration: 6, caption: 'Pushing boundaries beyond the ordinary.' },
            { title: 'Resolution Outro', duration: 4, caption: 'Crafted with precision.' },
          ],
        },
        isFallback: true,
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

startServer();
