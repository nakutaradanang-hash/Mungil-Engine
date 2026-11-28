import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Code2,
  Compass,
  Download,
  FileText,
  Lock,
  Mic,
  MicOff,
  Palette,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { downloadTextFile, sanitizeSlug } from '../engine/ioUtils';
import { generatePlayableHtml5Export } from '../engine/studioPipeline';
import type {
  AudioScaleId,
  GameRuntimeConfig,
  ProjectionMode,
  StudioProjectState,
  StudioTriadRole,
} from '../engine/types';

interface DirectorGddPanelProps {
  project: StudioProjectState;
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  onUpdateRuntimeConfig?: (next: GameRuntimeConfig) => void;
  onGenerateFromPrompt: (prompt: string, customTitle?: string) => Promise<void>;
  onToggleAgentApproval: (agentId: string) => void;
  onSyncRound: () => void;
  onRunAll18Agents: () => void;
  onTriggerFeedbackCycle?: () => void;
  onJumpToSandbox: () => void;
  onInstantPlay?: () => void;
  isGenerating: boolean;
  aiNotice: string | null;
}

const PROMPT_TEMPLATES = [
  {
    label: 'Cyber-Nusantara 3D Action',
    title: 'Garuda Obsidian',
    prompt: 'Cyber-Nusantara 3D action platformer with parkour dash parry, 6 floating temple shards, and Itel A70 30Hz optimization.',
  },
  {
    label: '2.5D Isometric Tactical',
    title: 'Sentinel Protocol',
    prompt: 'Isometric 2.5D tactical mech skirmish with 3 AI archetypes, cover pillars, destructible shields, and 16-voice cyber audio.',
  },
  {
    label: 'Pseudo-3D Synth Drift',
    title: 'Archipelago Drift',
    prompt: 'Pseudo-3D fake-3d coastal arcade racing with 8 speed checkpoints, dynamic mist, and Android 5+ APK release.',
  },
  {
    label: 'Retro 2D Top-Down',
    title: 'Labyrinth Keeper',
    prompt: 'Retro 2D top-down pixel survival dungeon with 5 relic shards, stealth fog, and low-RAM mobile controls.',
  },
];

export const DirectorGddPanel: React.FC<DirectorGddPanelProps> = ({
  project,
  projectionMode,
  onProjectionChange,
  onUpdateRuntimeConfig,
  onGenerateFromPrompt,
  onToggleAgentApproval,
  onSyncRound,
  onRunAll18Agents,
  onTriggerFeedbackCycle,
  onJumpToSandbox,
  onInstantPlay,
  isGenerating,
  aiNotice,
}) => {
  const [promptInput, setPromptInput] = useState(project.brief.prompt);
  const [titleInput, setTitleInput] = useState(project.brief.title);
  const [compareMode, setCompareMode] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(true);
  const [activeDocTab, setActiveDocTab] = useState<'agents' | 'gdd' | 'style' | 'techdocs' | 'playable'>('agents');
  const [triadFilter, setTriadFilter] = useState<'all' | StudioTriadRole>('all');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setPromptInput(project.brief.prompt);
    setTitleInput(project.brief.title);
  }, [project.brief.prompt, project.brief.title]);

  const playableHtml = useMemo(() => generatePlayableHtml5Export(project), [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerateFromPrompt(promptInput, titleInput);
  };

  const toggleVoicePrompt = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '').split(',')[1] || '';
          if (!base64) return;
          setTranscribing(true);
          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
            });
            if (res.ok) {
              const data = (await res.json()) as { transcript?: string };
              if (data.transcript) {
                setPromptInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript!));
                setVoiceError(null);
              }
            } else {
              setVoiceError('Voice transcription unavailable — type or pick a template.');
            }
          } catch {
            setVoiceError('Network error transcribing voice prompt.');
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setVoiceError(null);
    } catch {
      setRecording(false);
      setVoiceError('Microphone access denied or unavailable in this browser.');
    }
  };

  const downloadMarkdownDocs = () => {
    downloadTextFile(
      project.techDocsMd,
      `${sanitizeSlug(project.brief.title)}-tech-docs.md`,
      'text/markdown;charset=utf-8'
    );
  };

  const downloadPlayableHtml = () => {
    downloadTextFile(
      playableHtml,
      `${sanitizeSlug(project.brief.title)}-playable.html`,
      'text/html;charset=utf-8'
    );
  };

  const approvedCount = project.agents.filter((a) => a.approved).length;
  const orch = project.orchestration;

  return (
    <div className="space-y-6">
      {/* Prompt-to-AAA Studio Generator */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pipeline V2 · Event-Driven 18-Agent Feedback Loop
            </p>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              One-Prompt AAA Game Studio Generator
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {compareMode ? 'Hide Comparison' : 'Standard Prompt vs AAA Pipeline'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g., Aetherfall Sanctuary"
              className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Dimension Mode
            </label>
            <select
              aria-label="Target Dimension Mode"
              value={projectionMode}
              onChange={(e) => onProjectionChange(e.target.value as ProjectionMode)}
              className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="3d_pbr">3D PBR Stylized</option>
              <option value="2.5d_isometric">2.5D Isometric</option>
              <option value="pseudo_3d">Pseudo-3D / Fake-3D</option>
              <option value="2d_flat">2D Top-Down</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Natural Language Game Prompt
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Describe genre, mechanics, visual mood, and target device..."
                className="flex-1 min-w-[200px] h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={toggleVoicePrompt}
                className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border px-3 text-xs font-medium ${
                  recording
                    ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {recording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {transcribing ? 'Transcribing...' : recording ? 'Stop Mic' : 'Voice'}
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isGenerating ? 'Synthesizing...' : 'Run AAA Pipeline'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Style &amp; Genre Presets:</span>
            {PROMPT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                onClick={() => {
                  setTitleInput(tpl.title);
                  setPromptInput(tpl.prompt);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-slate-700 dark:text-slate-200 hover:border-amber-500"
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomizerOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500"
            >
              <Sliders className="h-3.5 w-3.5 text-amber-500" />
              {customizerOpen ? 'Hide Dev Mechanics' : 'Edit Mechanics'}
            </button>
            {onInstantPlay && (
              <button
                type="button"
                data-testid="instant-play-btn"
                onClick={onInstantPlay}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Zap className="h-3.5 w-3.5" />
                1-Click Instant Play
              </button>
            )}
          </div>
        </div>

        {customizerOpen && onUpdateRuntimeConfig && (
          <div
            data-testid="dev-mechanics-customizer"
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-3 text-xs"
          >
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500 tabular-nums">
                Move ({project.runtimeConfig.moveSpeed} m/s)
              </span>
              <input
                type="range"
                min={4}
                max={14}
                step={0.5}
                value={project.runtimeConfig.moveSpeed}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, moveSpeed: Number(e.target.value) })
                }
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500 tabular-nums">
                Enemy ({project.runtimeConfig.enemySpeed} m/s)
              </span>
              <input
                type="range"
                min={1.5}
                max={6.5}
                step={0.2}
                value={project.runtimeConfig.enemySpeed}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, enemySpeed: Number(e.target.value) })
                }
                className="w-full accent-rose-500"
              />
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500 tabular-nums">
                Shards ({project.runtimeConfig.shardCount})
              </span>
              <input
                type="range"
                min={3}
                max={8}
                step={1}
                value={project.runtimeConfig.shardCount}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, shardCount: Number(e.target.value) })
                }
                className="w-full accent-emerald-500"
              />
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500 tabular-nums">
                Tempo ({project.runtimeConfig.audioTempoBpm} BPM)
              </span>
              <input
                type="range"
                min={72}
                max={164}
                step={2}
                value={project.runtimeConfig.audioTempoBpm}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, audioTempoBpm: Number(e.target.value) })
                }
                className="w-full accent-sky-500"
              />
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500">Audio Scale</span>
              <select
                value={project.runtimeConfig.audioScale}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, audioScale: e.target.value as AudioScaleId })
                }
                className="h-7 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[11px]"
              >
                <option value="pentatonic">Pentatonic</option>
                <option value="cyber_minor">Cyber Minor</option>
                <option value="heroic_major">Heroic Major</option>
                <option value="tension_phrygian">Phrygian</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500">Sky / Ground</span>
              <div className="flex gap-1.5">
                <input
                  aria-label="Sky Color Hex"
                  type="color"
                  value={project.runtimeConfig.skyHex}
                  onChange={(e) =>
                    onUpdateRuntimeConfig({ ...project.runtimeConfig, skyHex: e.target.value.toUpperCase() })
                  }
                  className="h-7 w-full cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
                <input
                  aria-label="Ground Color Hex"
                  type="color"
                  value={project.runtimeConfig.groundHex}
                  onChange={(e) =>
                    onUpdateRuntimeConfig({ ...project.runtimeConfig, groundHex: e.target.value.toUpperCase() })
                  }
                  className="h-7 w-full cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
            </label>
            <label className="space-y-1">
              <span className="block font-mono text-[11px] text-slate-500">Focal Accent</span>
              <input
                aria-label="Focal Accent Hex"
                type="color"
                value={project.runtimeConfig.accentHex}
                onChange={(e) =>
                  onUpdateRuntimeConfig({ ...project.runtimeConfig, accentHex: e.target.value.toUpperCase() })
                }
                className="h-7 w-full cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </label>
          </div>
        )}

        {(voiceError || aiNotice) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {voiceError && <span className="text-rose-500">{voiceError}</span>}
            {aiNotice && <span className="ml-auto text-sky-600 dark:text-sky-400">{aiNotice}</span>}
          </div>
        )}
      </form>

      {/* Standard Prompt vs AAA Pipeline Comparison */}
      {compareMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 p-4 space-y-2">
            <div className="text-xs font-mono uppercase text-slate-500">Standard Single-Prompt Output</div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Ad-hoc Unsynchronized Prototype
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 list-disc pl-4">
              <li>Single generic script block with unguarded state transitions & runtime GC spikes.</li>
              <li>No Style Bible contrast ratios, material roughness rules, or contact shadows.</li>
              <li>Uncapped draw calls and textures prone to OOM/thermal throttling on Itel A70.</li>
              <li>Zero automated logic test suite, technical docs, or ticket traceability.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
            <div className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
              MungilEngine V13 AAA 18-Agent Pipeline
            </div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Production-Locked Studio Release
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
              <li>18 specialist departments aligned via typed Event Bus & feedback verification loop.</li>
              <li>Complete GDD + 60-30-10 Style Bible + reachability-verified State Machine FSM.</li>
              <li>Qolbu v13.0 budgets enforced: &lt;35 draw calls, 128 SoA entities, 280MB LRU cap.</li>
              <li>Auto-updated Technical Docs, PDF telemetry report, and Android 5+ `.aab`/`.apk` pack.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Sub-Tabs for Multi-Agent / GDD / Style Bible / Tech Docs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'agents', label: `18-Agent Studio (${approvedCount}/18)`, icon: Users },
            { id: 'gdd', label: 'GDD Blueprint', icon: FileText },
            { id: 'style', label: 'Style Bible', icon: Palette },
            { id: 'techdocs', label: 'Auto Tech Docs', icon: Download },
            { id: 'playable', label: 'Playable Code (.html)', icon: Code2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDocTab(tab.id as typeof activeDocTab)}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3.5 text-xs font-semibold ${
                  activeDocTab === tab.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="run-all-18-agents"
            onClick={onRunAll18Agents}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Run All 18 Agents (DAG)
          </button>
          {onTriggerFeedbackCycle && (
            <button
              type="button"
              data-testid="test-self-healing-loop"
              onClick={onTriggerFeedbackCycle}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Test Self-Healing Loop
            </button>
          )}
          <button
            type="button"
            onClick={onSyncRound}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
          >
            <Play className="h-3.5 w-3.5" />
            Re-Sync Triad Loop
          </button>
          <button
            type="button"
            onClick={onJumpToSandbox}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-amber-500"
          >
            <Box className="h-3.5 w-3.5 text-amber-500" />
            Launch 3D Sandbox
          </button>
        </div>
      </div>

      {/* Event-Driven 4-Agent Synchronized Feedback Loop */}
      {orch && (
        <div
          data-testid="orchestration-feedback-loop"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[11px] uppercase text-amber-600 dark:text-amber-400">
                Synchronized Event-Driven Feedback Loop · GDD Dictates Logic, Assets &amp; UI
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Rounds Executed: <span className="font-mono font-bold tabular-nums">{orch.roundsExecuted}</span> · Status:{' '}
                <span className={orch.converged ? 'font-mono font-bold text-emerald-600 dark:text-emerald-400' : 'font-mono font-bold text-amber-500'}>
                  {orch.converged ? 'CONVERGED' : 'IN REVIEW'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(project.syncProtocol ?? orch.syncProtocol) && (
                <span
                  data-testid="sync-protocol-lock"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums"
                >
                  <Lock className="h-3 w-3" />
                  Tokens {(project.syncProtocol ?? orch.syncProtocol)!.designTokenHash} · FSM {(project.syncProtocol ?? orch.syncProtocol)!.stateChecksum} · {(project.syncProtocol ?? orch.syncProtocol)!.barrierLocked ? 'LOCKED' : 'DRIFT'}
                </span>
              )}
              {orch.autoHealedIssues.length > 0 && (
                <span className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                  Auto-Healed {orch.autoHealedIssues.length} Budget Breach
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {orch.stages.map((st, idx) => (
              <div
                key={st.id}
                className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                  st.status === 'healed'
                    ? 'border-sky-500/50 bg-sky-500/5'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {idx + 1}. {st.name}
                  </span>
                  <span
                    className={`uppercase font-bold ${
                      st.status === 'healed'
                        ? 'text-sky-500'
                        : st.status === 'passed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {st.status} · R{st.iteration}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {st.mappedDepartments.join(' · ')}
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-snug">{st.summary}</p>
              </div>
            ))}
          </div>

          {orch.autoHealedIssues.length > 0 && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 px-3 py-2 text-[11px] text-sky-800 dark:text-sky-200">
              <span className="font-mono font-bold">QA Feedback Trace: </span>
              {orch.autoHealedIssues.join(' ')}
            </div>
          )}
        </div>
      )}

      {/* Triad Orchestration Spotlight: Creative Director · Art Lead · Lead Engineer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            role: 'Creative Director' as StudioTriadRole,
            focus: 'GDD Pillars, Worldbuilding & Systems',
            detail: `${project.gdd.pillars.length} Pillars · ${project.gdd.playerVerbs.length} Player Verbs synced`,
            icon: Compass,
          },
          {
            role: 'Art Lead' as StudioTriadRole,
            focus: 'Style Bible, 60-30-10 Palette & Assets',
            detail: `${project.styleBible.palette.length} Color Tokens · Texel & Contact Shadow Rules`,
            icon: Palette,
          },
          {
            role: 'Lead Engineer' as StudioTriadRole,
            focus: 'Zero-GC SoA ECS, FSM & Itel A70 Runtime',
            detail: `${project.stateMachine.nodes.length} FSM States · Message-Bus Feedback Active`,
            icon: Code2,
          },
        ].map((triad) => {
          const Icon = triad.icon;
          const active = triadFilter === triad.role;
          return (
            <button
              key={triad.role}
              type="button"
              onClick={() => setTriadFilter((prev) => (prev === triad.role ? 'all' : triad.role))}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                  <Icon className="h-3.5 w-3.5" />
                  {triad.role}
                </span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">LOCKED</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">{triad.focus}</div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{triad.detail}</div>
            </button>
          );
        })}
      </div>

      {/* 18-Agent Grid + Event Bus */}
      {activeDocTab === 'agents' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Filter Triad Pod:</span>
            {(['all', 'Creative Director', 'Art Lead', 'Lead Engineer', 'Specialist'] as const).map((pod) => (
              <button
                key={pod}
                type="button"
                onClick={() => setTriadFilter(pod)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  triadFilter === pod
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                {pod === 'all' ? 'All 18 Agents' : pod}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {project.agents
                .filter((a) => triadFilter === 'all' || a.triadRole === triadFilter)
                .map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase text-amber-600 dark:text-amber-400 truncate">
                          {agent.triadRole ?? agent.department}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-slate-500">
                          {agent.latencyMs}ms
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                        {agent.role}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {agent.deliverableSummary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Skills: <span className="font-mono text-slate-700 dark:text-slate-300">{agent.skills.join(' · ')}</span>
                      </div>
                      {agent.githubDna && agent.githubDna.length > 0 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          DNA: <span className="font-mono text-sky-600 dark:text-sky-400">{agent.githubDna.join(' · ')}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                          {agent.qaCheck}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleAgentApproval(agent.id)}
                          className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
                            agent.approved
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {agent.approved ? 'Synced' : 'Review'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Studio Message Bus Log
                </h3>
                <span className="font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                  {project.eventBus.length} events
                </span>
              </div>
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {project.eventBus.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className={ev.channel === 'error' ? 'text-rose-500 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
                        {ev.toTopic}
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {(ev.channel ?? 'directive').toUpperCase()} · R{ev.round}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{ev.fromAgent}</div>
                    <p className="text-slate-600 dark:text-slate-400">{ev.payload}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GDD Blueprint */}
      {activeDocTab === 'gdd' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                High Concept & Design Pillars
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{project.gdd.highConcept}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">Core Pillars</h4>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                {project.gdd.pillars.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">Player Verbs</h4>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {project.gdd.playerVerbs.join(' · ')}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
                3-Phase Progression Loop
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                {project.gdd.progressionLoop.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
                Risk & Mitigation Register
              </h4>
              <div className="space-y-2">
                {project.gdd.risks.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{r.title}</div>
                    <div className="text-slate-600 dark:text-slate-400 mt-0.5">{r.mitigation}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style Bible */}
      {activeDocTab === 'style' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Visual Thesis & 60-30-10 Palette
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{project.styleBible.visualThesis}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {project.styleBible.palette.map((sw) => (
              <div
                key={sw.role}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-2"
              >
                <div className="h-10 w-full rounded-lg border border-slate-300/40" style={{ backgroundColor: sw.hex }} />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">{sw.role}</span>
                  <span className="font-mono text-slate-500">{sw.hex}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">{sw.usage}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="font-mono uppercase text-amber-600 dark:text-amber-400">Material & PBR Rules</div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-4">
                {project.styleBible.materialRules.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono uppercase text-amber-600 dark:text-amber-400">Silhouette & Avoid Guardrails</div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc pl-4">
                {project.styleBible.silhouetteRules.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
                {project.styleBible.avoidList.map((a, idx) => (
                  <li key={`av-${idx}`} className="text-rose-600 dark:text-rose-400">
                    Avoid: {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Auto Tech Docs */}
      {activeDocTab === 'techdocs' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Auto-Generated Technical Documentation (Synced on Every Build)
            </h3>
            <button
              type="button"
              onClick={downloadMarkdownDocs}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download .md
            </button>
          </div>
          <pre className="max-h-[460px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {project.techDocsMd}
          </pre>
        </div>
      )}

      {/* Playable Synthesized Runtime & Standalone HTML5 Export */}
      {activeDocTab === 'playable' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Synthesized Game Runtime &amp; Standalone HTML5 Export
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parameters auto-compiled from your prompt and active GitHub DNA into both the 3D Sandbox and offline HTML5 build
              </p>
            </div>
            <button
              type="button"
              onClick={downloadPlayableHtml}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Download className="h-3.5 w-3.5" />
              Download Playable (.html)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <div className="text-slate-500">Projection Mode</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">{project.runtimeConfig.projectionMode}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <div className="text-slate-500">Physics (Move / Enemy)</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                {project.runtimeConfig.moveSpeed} / {project.runtimeConfig.enemySpeed} m/s
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <div className="text-slate-500">Objective &amp; Audio</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                {project.runtimeConfig.shardCount} Shards · {project.runtimeConfig.audioTempoBpm} BPM
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <div className="text-slate-500">Active Scale &amp; Tags</div>
              <div className="font-bold text-amber-600 dark:text-amber-400 truncate mt-0.5">
                {project.runtimeConfig.audioScale} · {project.runtimeConfig.mechanicsTags.join(', ')}
              </div>
            </div>
          </div>

          <pre className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre">
            {playableHtml}
          </pre>
        </div>
      )}
    </div>
  );
};
