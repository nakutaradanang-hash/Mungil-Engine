import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  getOrCreateUser,
  getProjectDetails,
  getTicketWithOwner,
  insertBuildRecord,
  insertCommitRecord,
  insertTicketRecord,
  listUserProjects,
  updateTicketStatusRecord,
  upsertProjectRecord,
} from './src/db/users.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';

const ALLOWED_TICKET_STATUSES = new Set(['open', 'in_progress', 'resolved']);
const ALLOWED_TICKET_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const ALLOWED_BUILD_STATUSES = new Set(['passed', 'failed', 'warning']);
const ALLOWED_TTS_VOICES = new Set(['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir']);
const clampStr = (val: unknown, maxLen: number, fallback = ''): string =>
  typeof val === 'string' ? val.trim().slice(0, maxLen) : fallback;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function pcm16ToWavBase64(pcmBase64: string, sampleRate = 24000, channels = 1): string {
  const pcmBuf = Buffer.from(pcmBase64, 'base64');
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuf.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuf.length, 40);
  return Buffer.concat([header, pcmBuf]).toString('base64');
}

const app = express();
app.use(express.json({ limit: '16mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    engine: 'MungilEngine V13 / Qolbu AAA Studio',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    timestamp: new Date().toISOString(),
  });
});

// ─── AI Blueprint Generator (Gemini 4 Hydrogen + ThinkingLevel.HIGH + Schema) ───
app.post('/api/ai/generate-blueprint', async (req, res) => {
  const ai = getAiClient();
  const prompt = clampStr(req.body?.prompt, 2400);
  const customTitle = clampStr(req.body?.title, 120);
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  if (!ai) {
    return res.status(503).json({ error: 'AI service key not configured on server.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are an AAA Game Studio Executive Pipeline (18 departments) powered by Qolbu Engine v13.0 targeting Itel A70 (3GB RAM, Android 5+, 30Hz Eco, <35 draw calls, <=280MB RAM) and Desktop WebGL.
Convert this user game concept into a tightly synchronized GDD, Style Bible, Core Loop, and runtimeTuning:
User Prompt: "${prompt}"
${customTitle ? `Preferred Title: "${customTitle}"` : ''}
Use palette roles "60% Canvas", "30% Surface", "10% Accent", "Hazard", "Nominal".
Keep runtimeTuning numeric values strictly within playable bounds: moveSpeed 5..12, enemySpeed 2..6, shardCount 3..8, fogDensity 0.004..0.03, audioTempoBpm 76..158.
Respond strictly in JSON matching the schema.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            genre: { type: Type.STRING },
            artStyle: { type: Type.STRING },
            coreLoop: { type: Type.STRING },
            audience: { type: Type.STRING },
            highConcept: { type: Type.STRING },
            pillars: { type: Type.ARRAY, items: { type: Type.STRING } },
            playerVerbs: { type: Type.ARRAY, items: { type: Type.STRING } },
            progressionLoop: { type: Type.ARRAY, items: { type: Type.STRING } },
            verticalSliceScope: { type: Type.ARRAY, items: { type: Type.STRING } },
            monetizationAndFairness: { type: Type.STRING },
            visualThesis: { type: Type.STRING },
            lightingRig: { type: Type.STRING },
            palette: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  hex: { type: Type.STRING },
                  usage: { type: Type.STRING },
                },
                required: ['role', 'hex', 'usage'],
              },
            },
            materialRules: { type: Type.ARRAY, items: { type: Type.STRING } },
            silhouetteRules: { type: Type.ARRAY, items: { type: Type.STRING } },
            avoidList: { type: Type.ARRAY, items: { type: Type.STRING } },
            runtimeTuning: {
              type: Type.OBJECT,
              properties: {
                projectionMode: {
                  type: Type.STRING,
                  enum: ['3d_pbr', '2.5d_isometric', 'pseudo_3d', '2d_flat'],
                },
                moveSpeed: { type: Type.NUMBER },
                enemySpeed: { type: Type.NUMBER },
                shardCount: { type: Type.NUMBER },
                fogDensity: { type: Type.NUMBER },
                audioTempoBpm: { type: Type.NUMBER },
                audioScale: {
                  type: Type.STRING,
                  enum: ['pentatonic', 'cyber_minor', 'heroic_major', 'tension_phrygian'],
                },
              },
            },
          },
          required: [
            'title',
            'genre',
            'artStyle',
            'coreLoop',
            'audience',
            'highConcept',
            'pillars',
            'playerVerbs',
            'progressionLoop',
            'verticalSliceScope',
            'monetizationAndFairness',
            'visualThesis',
            'lightingRig',
            'palette',
            'materialRules',
            'silhouetteRules',
            'avoidList',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ blueprint: parsed, model: 'gemini-4-hydrogen' });
  } catch (error) {
    console.error('Blueprint generation failed:', error);
    return res.status(502).json({ error: 'Unable to reach AI blueprint generator.' });
  }
});

// ─── AI Studio Director Chat (Gemini 4 Hydrogen / 3.1 Flash Lite + Google Search) ───
app.post('/api/ai/chat', async (req, res) => {
  const ai = getAiClient();
  const message = clampStr(req.body?.message, 4000);
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  const lowLatency = Boolean(req.body?.lowLatency);
  const useSearch = Boolean(req.body?.useSearch);
  const useThinking = req.body?.useThinking !== false;
  const projectContext = clampStr(req.body?.projectContext, 2000);

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (!ai) {
    return res.status(503).json({ error: 'AI service key not configured on server.' });
  }

  try {
    const model = lowLatency ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const contents = [
      ...history.slice(-10).map((turn: { role?: string; text?: string }) => ({
        role: turn.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(turn.text || '') }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const config: Record<string, unknown> = {
      systemInstruction: `You are the Lead Studio Architect for MungilEngine V13 (Qolbu Engine v13.0). Keep answers practical, accurate for Itel A70 / Android 5+ and Three.js WebGL optimization, and concise. Active studio context: ${projectContext}`,
    };

    if (!lowLatency && useThinking) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = groundingChunks
      .map((chunk: { web?: { uri?: string; title?: string } }) => chunk.web)
      .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
      .slice(0, 6);

    return res.json({
      reply: response.text || 'No response generated.',
      model,
      sources,
    });
  } catch (error) {
    console.error('AI chat failed:', error);
    return res.status(502).json({ error: 'AI Studio chat request failed.' });
  }
});

// ─── Text-to-Speech Voiceover (Gemini 3.8 Flash Lite / Flash TTS -> WAV) ───
app.post('/api/ai/tts', async (req, res) => {
  const ai = getAiClient();
  const text = clampStr(req.body?.text, 1500);
  const rawVoice = clampStr(req.body?.voiceName, 32, 'Kore');
  const voiceName = ALLOWED_TTS_VOICES.has(rawVoice) ? rawVoice : 'Kore';
  const highQuality = Boolean(req.body?.highQuality);

  if (!text) return res.status(400).json({ error: 'Text is required for speech synthesis.' });
  if (!ai) return res.status(503).json({ error: 'AI service key not configured on server.' });

  try {
    const model = highQuality ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts';
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      return res.status(502).json({ error: 'TTS response returned empty audio payload.' });
    }
    const wavBase64 = pcm16ToWavBase64(inlineData.data, 24000, 1);
    return res.json({ audioBase64: wavBase64, mimeType: 'audio/wav', model });
  } catch (error) {
    console.error('TTS synthesis failed:', error);
    return res.status(502).json({ error: 'Text-to-speech synthesis failed.' });
  }
});

// ─── Audio Transcription (Gemini 3.5 Transcribe) ───
app.post('/api/ai/transcribe', async (req, res) => {
  const ai = getAiClient();
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/webm';

  if (!audioBase64) return res.status(400).json({ error: 'Audio payload is required.' });
  if (!ai) return res.status(503).json({ error: 'AI service key not configured on server.' });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: audioBase64, mimeType } },
            { text: 'Transcribe this game design voice prompt verbatim.' },
          ],
        },
      ],
    });
    return res.json({ transcript: (response.text || '').trim(), model: 'gemini-3.5-transcribe' });
  } catch (error) {
    console.error('Audio transcription failed:', error);
    return res.status(502).json({ error: 'Audio transcription failed.' });
  }
});

// ─── Multimodal Media & Style Inspector (Gemini 4 Hydrogen) ───
app.post('/api/ai/analyze-media', async (req, res) => {
  const ai = getAiClient();
  const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'image/png';
  const goal =
    typeof req.body?.goal === 'string' && req.body.goal.trim()
      ? req.body.goal.trim()
      : 'Analyze silhouette readability, color palette (60-30-10), lighting contrast, and Itel A70 mobile optimization notes.';

  if (!dataBase64) return res.status(400).json({ error: 'Media payload is required.' });
  if (!ai) return res.status(503).json({ error: 'AI service key not configured on server.' });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: dataBase64, mimeType } },
            { text: goal },
          ],
        },
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });
    return res.json({ analysis: response.text || '', model: 'gemini-4-hydrogen' });
  } catch (error) {
    console.error('Media analysis failed:', error);
    return res.status(502).json({ error: 'Media analysis failed.' });
  }
});

// ─── Cloud SQL Protected Workspace Routes ───
app.get('/api/db/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || 'studio@mungil.local';
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, email, req.user?.name);
    const items = await listUserProjects(dbUser.id);
    return res.json({ user: dbUser, projects: items });
  } catch (error) {
    console.error('GET /api/db/projects failed:', error);
    return res.status(500).json({ error: 'Could not load cloud projects.' });
  }
});

app.post('/api/db/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || 'studio@mungil.local';
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, email, req.user?.name);

    const { id, title, genre, platform, prompt, gddJson, styleBibleJson, stateMachineJson, techDocsMd, activeBranch } =
      req.body ?? {};
    if (!title || !prompt) {
      return res.status(400).json({ error: 'Project title and prompt are required.' });
    }
    if (id !== undefined) {
      const existing = await getProjectDetails(Number(id));
      if (existing && existing.project.userId !== dbUser.id) {
        return res.status(403).json({ error: 'Access denied for this project.' });
      }
    }

    const saved = await upsertProjectRecord(dbUser.id, {
      id: typeof id === 'number' ? id : undefined,
      title: String(title),
      genre: String(genre || 'Action'),
      platform: String(platform || 'Android APK/AAB · Web PWA'),
      prompt: String(prompt),
      gddJson: String(gddJson || '{}'),
      styleBibleJson: String(styleBibleJson || '{}'),
      stateMachineJson: String(stateMachineJson || '{}'),
      techDocsMd: String(techDocsMd || ''),
      activeBranch: String(activeBranch || 'main'),
    });

    return res.json({ project: saved });
  } catch (error) {
    console.error('POST /api/db/projects failed:', error);
    return res.status(500).json({ error: 'Could not sync project to Cloud SQL.' });
  }
});

app.get('/api/db/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, req.user?.email || 'studio@mungil.local', req.user?.name);
    const projectId = Number(req.params.id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID.' });
    }
    const details = await getProjectDetails(projectId);
    if (!details) return res.status(404).json({ error: 'Project not found.' });
    if (details.project.userId !== dbUser.id) return res.status(403).json({ error: 'Forbidden.' });
    return res.json(details);
  } catch (error) {
    console.error('GET /api/db/projects/:id failed:', error);
    return res.status(500).json({ error: 'Could not load project details.' });
  }
});

app.post('/api/db/builds', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, req.user?.email || 'studio@mungil.local', req.user?.name);
    const projectId = Number(req.body?.projectId);
    const details = Number.isInteger(projectId) ? await getProjectDetails(projectId) : null;
    if (!details || details.project.userId !== dbUser.id) {
      return res.status(403).json({ error: 'Project not found or access denied.' });
    }
    const rawStatus = clampStr(req.body?.status, 24, 'passed');
    const safeBuildStatus = ALLOWED_BUILD_STATUSES.has(rawStatus) ? rawStatus : 'passed';
    const row = await insertBuildRecord({
      projectId,
      versionTag: clampStr(req.body?.versionTag, 32, 'v13.0.1'),
      status: safeBuildStatus,
      targetPlatform: clampStr(req.body?.targetPlatform, 80, 'Itel A70 Android APK'),
      cpuMs: Number.isFinite(Number(req.body?.cpuMs)) ? Math.max(0, Math.min(1000, Number(req.body.cpuMs))) : 14.2,
      gpuMs: Number.isFinite(Number(req.body?.gpuMs)) ? Math.max(0, Math.min(1000, Number(req.body.gpuMs))) : 11.4,
      drawCalls: Number.isFinite(Number(req.body?.drawCalls)) ? Math.max(0, Math.min(10000, Math.round(Number(req.body.drawCalls)))) : 24,
      memoryMb: Number.isFinite(Number(req.body?.memoryMb)) ? Math.max(0, Math.min(65536, Number(req.body.memoryMb))) : 187,
      fpsAvg: Number.isFinite(Number(req.body?.fpsAvg)) ? Math.max(1, Math.min(240, Number(req.body.fpsAvg))) : 30,
      errorSummary: clampStr(req.body?.errorSummary, 400),
      logText: clampStr(req.body?.logText, 4000, 'Build verified cleanly.'),
    });
    return res.json({ build: row });
  } catch (error) {
    console.error('POST /api/db/builds failed:', error);
    return res.status(500).json({ error: 'Failed to store build record.' });
  }
});

app.post('/api/db/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, req.user?.email || 'studio@mungil.local', req.user?.name);
    const projectId = Number(req.body?.projectId);
    const details = Number.isInteger(projectId) ? await getProjectDetails(projectId) : null;
    if (!details || details.project.userId !== dbUser.id) {
      return res.status(403).json({ error: 'Project not found or access denied.' });
    }
    const rawPriority = clampStr(req.body?.priority, 16, 'medium');
    const rawStatus = clampStr(req.body?.status, 24, 'open');
    const row = await insertTicketRecord({
      projectId,
      title: clampStr(req.body?.title, 200, 'Untitled Ticket'),
      department: clampStr(req.body?.department, 80, 'QA'),
      priority: ALLOWED_TICKET_PRIORITIES.has(rawPriority) ? rawPriority : 'medium',
      status: ALLOWED_TICKET_STATUSES.has(rawStatus) ? rawStatus : 'open',
      assignee: clampStr(req.body?.assignee, 80, 'QA & Automation Lead'),
    });
    return res.json({ ticket: row });
  } catch (error) {
    console.error('POST /api/db/tickets failed:', error);
    return res.status(500).json({ error: 'Failed to store ticket.' });
  }
});

app.patch('/api/db/tickets/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, req.user?.email || 'studio@mungil.local', req.user?.name);

    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: 'Invalid ticket ID.' });
    }
    const status = clampStr(req.body?.status, 24);
    if (!ALLOWED_TICKET_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid ticket status. Expected open, in_progress, or resolved.' });
    }

    const ownerRecord = await getTicketWithOwner(ticketId);
    if (!ownerRecord) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    if (ownerRecord.userId !== dbUser.id) {
      return res.status(403).json({ error: 'Access denied for this ticket.' });
    }

    const row = await updateTicketStatusRecord(ticketId, ownerRecord.projectId, status);
    return res.json({ ticket: row });
  } catch (error) {
    console.error('PATCH /api/db/tickets/:id failed:', error);
    return res.status(500).json({ error: 'Failed to update ticket status.' });
  }
});

app.post('/api/db/commits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Invalid user token.' });
    const dbUser = await getOrCreateUser(uid, req.user?.email || 'studio@mungil.local', req.user?.name);
    const projectId = Number(req.body?.projectId);
    const details = Number.isInteger(projectId) ? await getProjectDetails(projectId) : null;
    if (!details || details.project.userId !== dbUser.id) {
      return res.status(403).json({ error: 'Project not found or access denied.' });
    }
    const row = await insertCommitRecord({
      projectId,
      branch: String(req.body.branch || 'main'),
      hash: String(req.body.hash || Math.random().toString(16).slice(2, 9)),
      author: String(req.body.author || dbUser.displayName),
      message: String(req.body.message || 'Sync project snapshot'),
      diffSummary: String(req.body.diffSummary || 'Updated GDD, Style Bible, and FSM'),
    });
    return res.json({ commit: row });
  } catch (error) {
    console.error('POST /api/db/commits failed:', error);
    return res.status(500).json({ error: 'Failed to save commit.' });
  }
});

async function startServer() {
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
    if (pathname !== '/live') {
      return;
    }
    wss.handleUpgrade(request, socket, head, async (ws) => {
      const ai = getAiClient();
      if (!ai) {
        ws.send(JSON.stringify({ type: 'error', message: 'AI key not configured on server.' }));
        ws.close();
        return;
      }

      interface LiveSessionHandle {
        sendRealtimeInput: (input: { audio: { data: string; mimeType: string } }) => void;
        sendClientContent: (input: { turns: string; turnComplete: boolean }) => void;
        close: () => void;
      }

      let connectedSession: LiveSessionHandle;
      try {
        connectedSession = (await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction:
              'You are the MungilEngine V13 AAA Game Director. Give fast, friendly, expert advice about game design, state machines, and Itel A70 mobile optimization.',
          },
          callbacks: {
            onopen: () => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'ready' }));
              }
            },
            onmessage: (msg) => {
              if (ws.readyState !== 1) return;
              const serverContent = msg.serverContent;
              if (!serverContent) return;
              if (serverContent.interrupted) {
                ws.send(JSON.stringify({ type: 'interrupted' }));
              }
              if (serverContent.inputTranscription?.text) {
                ws.send(JSON.stringify({ type: 'input_transcript', text: serverContent.inputTranscription.text }));
              }
              if (serverContent.outputTranscription?.text) {
                ws.send(JSON.stringify({ type: 'output_transcript', text: serverContent.outputTranscription.text }));
              }
              const parts = serverContent.modelTurn?.parts ?? [];
              for (const part of parts) {
                if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                  ws.send(JSON.stringify({ type: 'audio', data: part.inlineData.data }));
                }
                if (part.text) {
                  ws.send(JSON.stringify({ type: 'text', text: part.text }));
                }
              }
            },
            onerror: () => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'error', message: 'Live voice session encountered a connection error.' }));
              }
            },
            onclose: () => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'closed' }));
                ws.close();
              }
            },
          },
        })) as unknown as LiveSessionHandle;
      } catch (error) {
        console.error('Gemini Live connect failed:', error);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'error', message: 'Could not start real-time voice session.' }));
          ws.close();
        }
        return;
      }

      ws.on('message', (raw: Buffer | string) => {
        try {
          const parsed = JSON.parse(raw.toString()) as { type?: string; data?: string; text?: string };
          if (parsed.type === 'audio' && parsed.data) {
            connectedSession.sendRealtimeInput({
              audio: { data: parsed.data, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.type === 'text' && parsed.text) {
            connectedSession.sendClientContent({ turns: parsed.text, turnComplete: true });
          }
        } catch {
          // Ignore malformed frame
        }
      });

      ws.on('close', () => {
        try {
          connectedSession.close();
        } catch {
          // Ignore close errors
        }
      });
    });
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('/{*splat}', async (req, res, next) => {
      try {
        const htmlPath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MungilEngine V13 server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
