import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Download,
  Globe,
  Headphones,
  MessageSquare,
  Mic,
  MicOff,
  Music,
  Send,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import { qolbuAudio } from '../engine/audioSynth';
import { generateProcedural3DMeshExport } from '../engine/studioPipeline';
import type { StudioProjectState } from '../engine/types';

interface MediaVoiceForgePanelProps {
  project: StudioProjectState;
}

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
  model?: string;
  sources?: Array<{ uri: string; title?: string }>;
}

export const MediaVoiceForgePanel: React.FC<MediaVoiceForgePanelProps> = ({ project }) => {
  // AI Director Chat State
  const [chatInput, setChatInput] = useState('');
  const [lowLatency, setLowLatency] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [useThinking, setUseThinking] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: `Studio Director ready for "${project.brief.title}". Ask about FSM edge cases, Itel A70 draw-call budgets, or shader roughness tuning.`,
      model: 'gemini-4-hydrogen',
    },
  ]);

  // TTS & Audio Synth State
  const [ttsText, setTtsText] = useState(
    `Welcome to ${project.brief.title}. Six resonance shards await across the obsidian sanctuary.`
  );
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [ttsHighQuality, setTtsHighQuality] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Live API Voice Session State
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [livePromptText, setLivePromptText] = useState('');
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveMicStreamRef = useRef<MediaStream | null>(null);
  const liveAudioCtxRef = useRef<AudioContext | null>(null);
  const liveMicCtxRef = useRef<AudioContext | null>(null);
  const liveMicProcRef = useRef<ScriptProcessorNode | null>(null);

  // Media Inspector & 3D Mesh Forge
  const [mediaAnalysis, setMediaAnalysis] = useState<string>(
    'Upload a concept render, sprite sheet, or gameplay clip to run Style Bible & Itel A70 silhouette verification.'
  );
  const [mediaLoading, setMediaLoading] = useState(false);
  const [meshKind, setMeshKind] = useState<'hero' | 'obelisk' | 'drone'>('hero');
  const meshData = generateProcedural3DMeshExport(project.brief.title, meshKind);

  useEffect(() => {
    return () => {
      stopLiveSession();
      if (liveAudioCtxRef.current && liveAudioCtxRef.current.state !== 'closed') {
        void liveAudioCtxRef.current.close();
      }
      liveAudioCtxRef.current = null;
    };
  }, []);

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    const nextHistory: ChatTurn[] = [...chatTurns, { role: 'user', text: msg }];
    setChatTurns(nextHistory);
    setChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: nextHistory.slice(0, -1),
          lowLatency,
          useSearch,
          useThinking,
          projectContext: `${project.brief.title} (${project.brief.genre}) · Target: ${project.brief.targetDevice}`,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setChatTurns((prev) => [
          ...prev,
          { role: 'model', text: err.error || 'AI service unavailable. Check server configuration.' },
        ]);
      } else {
        const data = (await res.json()) as {
          reply: string;
          model?: string;
          sources?: Array<{ uri: string; title?: string }>;
        };
        setChatTurns((prev) => [
          ...prev,
          { role: 'model', text: data.reply, model: data.model, sources: data.sources },
        ]);
      }
    } catch {
      setChatTurns((prev) => [
        ...prev,
        { role: 'model', text: 'Network error reaching Studio AI Director.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateTts = async () => {
    if (!ttsText.trim() || ttsLoading) return;
    setTtsLoading(true);
    setTtsError(null);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText.trim(),
          voiceName: ttsVoice,
          highQuality: ttsHighQuality,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setTtsError(err.error || 'TTS synthesis unavailable.');
      } else {
        const data = (await res.json()) as { audioBase64: string; mimeType: string };
        setTtsAudioUrl(`data:${data.mimeType};base64,${data.audioBase64}`);
      }
    } catch {
      setTtsError('Network error during speech synthesis.');
    } finally {
      setTtsLoading(false);
    }
  };

  const playPcm24kChunk = (base64: string) => {
    try {
      const ctx = liveAudioCtxRef.current || new AudioContext({ sampleRate: 24000 });
      liveAudioCtxRef.current = ctx;
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch {
      // Ignore browser autoplay constraints
    }
  };

  const stopLiveSession = () => {
    liveWsRef.current?.close();
    liveWsRef.current = null;
    if (liveMicProcRef.current) {
      liveMicProcRef.current.disconnect();
      liveMicProcRef.current.onaudioprocess = null;
      liveMicProcRef.current = null;
    }
    if (liveMicCtxRef.current && liveMicCtxRef.current.state !== 'closed') {
      void liveMicCtxRef.current.close();
    }
    liveMicCtxRef.current = null;
    liveMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    liveMicStreamRef.current = null;
    setLiveStatus('idle');
  };

  const startLiveSession = async () => {
    if (liveStatus === 'connected' || liveStatus === 'connecting') {
      stopLiveSession();
      return;
    }
    setLiveStatus('connecting');
    setLiveLogs(['Connecting to Gemini 3.8 Live Studio Director...']);
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/live`);
    liveWsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string;
          data?: string;
          text?: string;
          message?: string;
        };
        if (msg.type === 'ready') {
          setLiveStatus('connected');
          setLiveLogs((prev) => [...prev, 'Live session connected. Speak or send a directive.']);
        } else if (msg.type === 'audio' && msg.data) {
          playPcm24kChunk(msg.data);
        } else if (msg.type === 'input_transcript' && msg.text) {
          setLiveLogs((prev) => [...prev.slice(-14), `You: ${msg.text}`]);
        } else if (msg.type === 'output_transcript' && msg.text) {
          setLiveLogs((prev) => [...prev.slice(-14), `Director: ${msg.text}`]);
        } else if (msg.type === 'error') {
          setLiveStatus('error');
          setLiveLogs((prev) => [...prev, `Notice: ${msg.message || 'Live connection closed'}`]);
        }
      } catch {
        // Ignore parse failures
      }
    };

    ws.onerror = () => setLiveStatus('error');
    ws.onclose = () => setLiveStatus((s) => (s === 'error' ? 'error' : 'idle'));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      liveMicStreamRef.current = stream;
      const micCtx = new AudioContext({ sampleRate: 16000 });
      liveMicCtxRef.current = micCtx;
      const source = micCtx.createMediaStreamSource(stream);
      const proc = micCtx.createScriptProcessor(4096, 1, 1);
      liveMicProcRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (ws.readyState !== 1) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        ws.send(JSON.stringify({ type: 'audio', data: btoa(binary) }));
      };
      source.connect(proc);
      proc.connect(micCtx.destination);
    } catch {
      setLiveLogs((prev) => [...prev, 'Microphone unavailable — text directives still active in Live session.']);
    }
  };

  const sendLiveText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!livePromptText.trim() || liveWsRef.current?.readyState !== 1) return;
    liveWsRef.current.send(JSON.stringify({ type: 'text', text: livePromptText.trim() }));
    setLiveLogs((prev) => [...prev.slice(-14), `You: ${livePromptText.trim()}`]);
    setLivePromptText('');
  };

  const handleMediaFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      if (!base64) return;
      setMediaLoading(true);
      try {
        const res = await fetch('/api/ai/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataBase64: base64,
            mimeType: file.type || 'image/png',
            goal: `Inspect ${file.name} for "${project.brief.title}" Style Bible contrast, silhouette clarity, and Itel A70 compression fit.`,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { analysis: string };
          setMediaAnalysis(data.analysis || 'No analysis returned.');
        } else {
          setMediaAnalysis('Unable to analyze media file right now.');
        }
      } finally {
        setMediaLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const downloadTextFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* AI Director Chat */}
        <div className="xl:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                AI Studio Director (Reasoning + Search Grounding)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between deep architectural reasoning and low-latency rapid replies
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={useThinking} onChange={(e) => setUseThinking(e.target.checked)} />
                Deep Think
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={lowLatency} onChange={(e) => setLowLatency(e.target.checked)} />
                <Zap className="h-3 w-3 text-amber-500" />
                Fast Mode
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} />
                <Globe className="h-3 w-3 text-sky-500" />
                Web Search
              </label>
            </div>
          </div>

          <div className="h-64 overflow-y-auto space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs">
            {chatTurns.map((t, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-3 ${
                  t.role === 'user'
                    ? 'ml-8 bg-amber-500/15 border border-amber-500/30 text-slate-900 dark:text-amber-50'
                    : 'mr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="font-mono text-[10px] uppercase text-slate-500 mb-1">
                  {t.role === 'user' ? 'Lead Developer' : `Studio AI ${t.model ? `· ${t.model}` : ''}`}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{t.text}</div>
                {t.sources && t.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                    {t.sources.map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-600 dark:text-sky-400 underline"
                      >
                        {src.title || src.uri}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSend} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about enemy AI, Android 5+ shader caps, or level pacing..."
              className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {chatLoading ? 'Thinking...' : 'Ask'}
            </button>
          </form>
        </div>

        {/* Live Real-Time Voice Session */}
        <div className="xl:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Headphones className="h-4 w-4 text-emerald-500" />
                Live Studio Voice Session
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time bidirectional voice with the Creative Director
              </p>
            </div>
            <button
              type="button"
              onClick={startLiveSession}
              className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-3.5 text-xs font-semibold ${
                liveStatus === 'connected'
                  ? 'bg-rose-600 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {liveStatus === 'connected' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {liveStatus === 'connected' ? 'End Live' : liveStatus === 'connecting' ? 'Connecting...' : 'Start Live Voice'}
            </button>
          </div>

          <div className="h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            {liveLogs.length === 0 ? (
              <div className="text-slate-500">Click Start Live Voice to stream 16kHz microphone audio or send live text cues.</div>
            ) : (
              liveLogs.map((l, idx) => <div key={idx}>{l}</div>)
            )}
          </div>

          <form onSubmit={sendLiveText} className="flex gap-2">
            <input
              type="text"
              value={livePromptText}
              onChange={(e) => setLivePromptText(e.target.value)}
              disabled={liveStatus !== 'connected'}
              placeholder={liveStatus === 'connected' ? 'Send live text cue...' : 'Start Live session first'}
              className="flex-1 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={liveStatus !== 'connected'}
              className="inline-flex h-9 items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Row: TTS + Procedural Music/SFX + Media Analyzer + 3D Mesh Forge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* TTS & Procedural 16-Voice Audio */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-amber-500" />
            TTS Voiceover & 16-Voice Synth
          </h3>
          <textarea
            rows={3}
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="Kore">Voice: Kore</option>
              <option value="Aoede">Voice: Aoede</option>
              <option value="Puck">Voice: Puck</option>
              <option value="Charon">Voice: Charon</option>
            </select>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={ttsHighQuality} onChange={(e) => setTtsHighQuality(e.target.checked)} />
              HD TTS
            </label>
            <button
              type="button"
              onClick={handleGenerateTts}
              disabled={ttsLoading}
              className="ml-auto inline-flex h-8 items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-slate-950"
            >
              {ttsLoading ? 'Synthesizing...' : 'Generate WAV'}
            </button>
          </div>
          {ttsError && <div className="text-xs text-rose-500">{ttsError}</div>}
          {ttsAudioUrl && <audio controls src={ttsAudioUrl} className="w-full h-9" />}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Music className="h-3.5 w-3.5 text-sky-500" />
              Zero-Asset Web Audio Foley & Adaptive Stems
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['pickup', 'jump', 'dash', 'hit', 'victory'] as const).map((sfx) => (
                <button
                  key={sfx}
                  type="button"
                  onClick={() => qolbuAudio.playSfx(sfx)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-mono uppercase text-slate-700 dark:text-slate-200 hover:border-amber-500"
                >
                  {sfx}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  qolbuAudio.setIntensity('explore');
                  qolbuAudio.startMusic();
                }}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-white dark:text-slate-900"
              >
                Play Stem
              </button>
              <button
                type="button"
                onClick={() => qolbuAudio.stopMusic()}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300"
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        {/* Multimodal Media Inspector */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-sky-500" />
            Visual / Audio Asset QA Inspector
          </h3>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-4 text-xs text-slate-600 dark:text-slate-300 hover:border-amber-500">
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(e) => handleMediaFile(e.target.files?.[0] ?? null)}
            />
            {mediaLoading ? 'Inspecting asset with AI Director...' : 'Drop or select Image / Video / Audio to inspect'}
          </label>
          <div className="h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {mediaAnalysis}
          </div>
        </div>

        {/* Procedural 3D Mesh Forge */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="h-4 w-4 text-emerald-500" />
            Procedural 3D Mesh Forge (.OBJ / .GLTF)
          </h3>
          <div className="flex gap-1.5">
            {(['hero', 'obelisk', 'drone'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setMeshKind(kind)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize ${
                  meshKind === kind
                    ? 'bg-amber-500 text-slate-950'
                    : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
            <div>Mesh: {meshData.name}_{meshKind}</div>
            <div>Vertices: {meshData.vertexCount} · Triangles: {meshData.triangleCount} (Itel A70 LOD0 Safe)</div>
            <pre className="max-h-24 overflow-auto text-[10px] text-slate-500 dark:text-slate-400 pt-1">
              {meshData.objText}
            </pre>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadTextFile(meshData.objText, `${meshData.name}-${meshKind}.obj`, 'text/plain')}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Export .OBJ
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(meshData.gltfJson, `${meshData.name}-${meshKind}.gltf`, 'model/gltf+json')}
              className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-xs font-semibold text-white dark:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Export .GLTF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
