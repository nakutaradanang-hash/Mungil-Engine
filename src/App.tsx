import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  Download,
  FolderGit2,
  GitBranch,
  HelpCircle,
  MessageSquare,
  Moon,
  Search,
  Sparkles,
  Sun,
  WifiOff,
} from 'lucide-react';
import { CollabLiveOpsPanel } from './components/CollabLiveOpsPanel';
import { DirectorGddPanel } from './components/DirectorGddPanel';
import { GitHub33Panel } from './components/GitHub33Panel';
import { MediaVoiceForgePanel } from './components/MediaVoiceForgePanel';
import { StateMachineQaPanel } from './components/StateMachineQaPanel';
import { NotificationsDrawer, OnboardingModal, QuickSearchModal } from './components/StudioModals';
import { TelemetryExportPanel } from './components/TelemetryExportPanel';
import { ThreeSandboxViewport } from './components/ThreeSandboxViewport';
import { qolbuAudio } from './engine/audioSynth';
import { downloadDataUrl, sanitizeSlug } from './engine/ioUtils';
import {
  generateTechnicalDocs,
  runAutomatedLogicTests,
  stepStateMachine,
  validateAssetPipelinePreBuild,
} from './engine/stateMachine';
import {
  loadStudioWorkspaceSnapshot,
  saveStudioWorkspaceSnapshot,
} from './engine/storageRecovery';
import {
  buildProjectFromPrompt,
  reconcileProjectSyncProtocol,
  runAll18AgentsPipeline,
  runSynchronizedOrchestrationCycle,
  StudioMessageBus,
  synthesizeRuntimeConfig,
} from './engine/studioPipeline';
import type {
  AudioScaleId,
  BuildRecordItem,
  CommitItem,
  GameRuntimeConfig,
  LiveTelemetrySnapshot,
  PostLaunchMetricPoint,
  PreBuildAssetInput,
  PreBuildAssetValidationReport,
  ProjectionMode,
  ServerHealthStatus,
  StateMachineSpec,
  StudioNotification,
  StudioProjectState,
  StudioSectionId,
  TicketItem,
} from './engine/types';
import { auth, googleAuthProvider } from './lib/firebase';

interface StudioErrorBoundaryProps {
  children: React.ReactNode;
  preBuildReport?: PreBuildAssetValidationReport | null;
  onAutoFixAssets?: () => void;
  onProceedBuildAnyway?: () => void;
  onDismissPreBuildReport?: () => void;
}

class StudioErrorBoundary extends React.Component<
  StudioErrorBoundaryProps,
  { hasError: boolean; message: string }
> {
  constructor(props: StudioErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-800 dark:text-rose-200 space-y-3">
          <div className="font-semibold">Studio Module Recovery Guard Triggered</div>
          <p className="text-xs opacity-90">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950"
          >
            Recover Module
          </button>
        </div>
      );
    }

    const report = this.props.preBuildReport;
    return (
      <div className="space-y-5">
        {report && !report.passed && (
          <div
            role="alert"
            data-testid="prebuild-asset-report"
            className="rounded-2xl border border-amber-500/60 bg-amber-500/10 p-5 text-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400">
                  StudioErrorBoundary · Pre-Build Asset Pipeline Gate
                </div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {report.flaggedAssets.length} Flagged Asset Issues Blocked New Build
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">{report.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {this.props.onAutoFixAssets && (
                  <button
                    type="button"
                    data-testid="autofix-assets-btn"
                    onClick={this.props.onAutoFixAssets}
                    className="inline-flex h-9 items-center rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                  >
                    Auto-Fix &amp; Initiate Build
                  </button>
                )}
                {this.props.onProceedBuildAnyway && (
                  <button
                    type="button"
                    onClick={this.props.onProceedBuildAnyway}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-400 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Override &amp; Build
                  </button>
                )}
                {this.props.onDismissPreBuildReport && (
                  <button
                    type="button"
                    onClick={this.props.onDismissPreBuildReport}
                    className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {report.flaggedAssets.map((issue, idx) => (
                <div
                  key={`${issue.assetName}-${idx}`}
                  className="rounded-xl border border-rose-500/40 bg-white/80 dark:bg-slate-950/80 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">{issue.assetName}</span>
                    <span className="uppercase text-rose-500 font-bold">{issue.severity}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {issue.drawCalls} DC · {issue.texelDensityPxPerM} px/m · {issue.kind}
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-medium">{issue.reason}</div>
                  <div className="text-emerald-700 dark:text-emerald-400">Fix: {issue.remediation}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {this.props.children}
      </div>
    );
  }
}

const NAV_ITEMS: Array<{ id: StudioSectionId; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'director', label: '1. Director & 18 Agents', shortLabel: 'Director', icon: Sparkles },
  { id: 'sandbox', label: '2. 3D Sandbox', shortLabel: '3D Sandbox', icon: Box },
  { id: 'statemachine', label: '3. FSM & QA', shortLabel: 'FSM & QA', icon: GitBranch },
  { id: 'media', label: '4. Voice & 3D', shortLabel: 'Voice & 3D', icon: MessageSquare },
  { id: 'github', label: '5. GitHub 330', shortLabel: 'GitHub 330', icon: FolderGit2 },
  { id: 'telemetry', label: '6. Telemetry & APK', shortLabel: 'Telemetry', icon: BarChart3 },
  { id: 'collab', label: '7. Cloud & Live Ops', shortLabel: 'Cloud & Ops', icon: Activity },
];

const INITIAL_BUILDS: BuildRecordItem[] = [
  {
    id: 'b-1301',
    versionTag: 'v13.0.1',
    status: 'passed',
    targetPlatform: 'Itel A70 Android APK',
    cpuMs: 13.8,
    gpuMs: 10.9,
    drawCalls: 24,
    memoryMb: 187,
    fpsAvg: 30,
    errorSummary: '',
    logText: 'Zero-GC SoA ECS verified, 2000 fuzz vectors blocked, ProGuard release pack signed.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'b-1300',
    versionTag: 'v13.0.0',
    status: 'passed',
    targetPlatform: 'Web PWA + Desktop',
    cpuMs: 14.5,
    gpuMs: 11.8,
    drawCalls: 27,
    memoryMb: 194,
    fpsAvg: 58,
    errorSummary: '',
    logText: 'RoomEnvironment PMREM & procedural basalt terrain tile verified.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'b-1299',
    versionTag: 'v12.9.8',
    status: 'warning',
    targetPlatform: 'Itel A70 Android APK',
    cpuMs: 18.9,
    gpuMs: 13.6,
    drawCalls: 33,
    memoryMb: 246,
    fpsAvg: 29,
    errorSummary: 'Near 35 DC ceiling on pillar LOD0',
    logText: 'Auto-LOD decimated pillar geometry by 38% to stay under 35 draw calls.',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
];

const INITIAL_TICKETS: TicketItem[] = [
  {
    id: 'tk-101',
    title: 'Verify Itel A70 30Hz thermal stability under 128 active entities',
    department: 'Performance & Itel A70',
    priority: 'high',
    status: 'resolved',
    assignee: 'Performance Engineer',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tk-102',
    title: 'Sync dash-parry hitstop (40ms) with FSM combat -> idle recovery guard',
    department: 'Gameplay Engineering',
    priority: 'medium',
    status: 'in_progress',
    assignee: 'Gameplay Engineer',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_COMMITS: CommitItem[] = [
  {
    id: 'cm-1',
    branch: 'main',
    hash: 'a7f90c2',
    author: 'Engine Architect',
    message: 'Enforce 9 Larangan Mutlak & 16-voice audio pool ceiling',
    diffSummary: 'Updated qolbuCore.ts, stateMachine.ts, and 8-stage fuzz audit',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cm-2',
    branch: 'itel-a70-opt',
    hash: 'e41b8d9',
    author: 'Android & PWA Engineer',
    message: 'Set minSdk 21 + ASTC 6x6 asset streaming on worker thread',
    diffSummary: 'Updated build.gradle.kts & MainActivity.kt lifecycleScope preload',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_LIVEOPS: PostLaunchMetricPoint[] = [
  { dayLabel: 'Day 1', dau: 4280, crashRate: 0.14, avgFps: 30.0, retentionPct: 68 },
  { dayLabel: 'Day 3', dau: 6910, crashRate: 0.08, avgFps: 30.0, retentionPct: 54 },
  { dayLabel: 'Day 7', dau: 11420, crashRate: 0.03, avgFps: 29.9, retentionPct: 43 },
  { dayLabel: 'Day 14', dau: 16850, crashRate: 0.02, avgFps: 30.0, retentionPct: 37 },
];

export default function App() {
  const isAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [initialWorkspaceLoad] = useState(() =>
    typeof window !== 'undefined'
      ? loadStudioWorkspaceSnapshot(window.localStorage)
      : { snapshot: null, recoveredFromBackup: false, migratedFromVersion: null, warning: null }
  );

  const [darkMode, setDarkMode] = useState(true);
  const [activeSection, setActiveSection] = useState<StudioSectionId>(isAutoStart ? 'sandbox' : 'director');
  const [sandboxAutoStartNonce, setSandboxAutoStartNonce] = useState(0);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>(
    () => initialWorkspaceLoad.snapshot?.projectionMode ?? '3d_pbr'
  );
  const [project, setProject] = useState<StudioProjectState>(
    () =>
      initialWorkspaceLoad.snapshot?.project ??
      buildProjectFromPrompt('Cyber-Nusantara 3D Sanctuary Guardian optimized for Itel A70', 'Aetherfall Sanctuary')
  );
  const [activeFsmState, setActiveFsmState] = useState('idle');
  const [builds, setBuilds] = useState<BuildRecordItem[]>(() =>
    initialWorkspaceLoad.snapshot?.builds?.length ? initialWorkspaceLoad.snapshot.builds : INITIAL_BUILDS
  );
  const [tickets, setTickets] = useState<TicketItem[]>(() =>
    initialWorkspaceLoad.snapshot?.tickets?.length ? initialWorkspaceLoad.snapshot.tickets : INITIAL_TICKETS
  );
  const [commits, setCommits] = useState<CommitItem[]>(() =>
    initialWorkspaceLoad.snapshot?.commits?.length ? initialWorkspaceLoad.snapshot.commits : INITIAL_COMMITS
  );
  const [liveOpsMetrics] = useState<PostLaunchMetricPoint[]>(INITIAL_LIVEOPS);
  const liveMetricsRef = useRef<LiveTelemetrySnapshot>({
    fps: 30,
    cpuMs: 12.4,
    gpuMs: 9.8,
    drawCalls: 24,
    triangles: 4820,
    memoryMb: 187.4,
    texturesMb: 106,
    meshesMb: 44,
    audioMb: 16,
    runtimeMb: 21.4,
  });
  const [liveMetrics, setLiveMetrics] = useState<LiveTelemetrySnapshot>({ ...liveMetricsRef.current });
  const [importedAssets, setImportedAssets] = useState<PreBuildAssetInput[]>(() =>
    initialWorkspaceLoad.snapshot?.importedAssets?.length
      ? initialWorkspaceLoad.snapshot.importedAssets
      : [
          { name: 'temple_guardian_unbatched.glb', kind: 'mesh', drawCalls: 18, texelDensityPxPerM: 512, tris: 14200, sizeKb: 920 },
          { name: 'obsidian_4k_diffuse.png', kind: 'texture', drawCalls: 2, texelDensityPxPerM: 2048, sizeKb: 6400 },
          { name: 'basalt_tile_astc.ktx2', kind: 'texture', drawCalls: 1, texelDensityPxPerM: 512, sizeKb: 240 },
          { name: 'sanctuary_pillars_instanced.glb', kind: 'mesh', drawCalls: 5, texelDensityPxPerM: 384, tris: 4200, sizeKb: 310 },
        ]
  );
  const [preBuildReport, setPreBuildReport] = useState<PreBuildAssetValidationReport | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(initialWorkspaceLoad.warning);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPromptEvent, setInstallPromptEvent] = useState<{ prompt: () => Promise<void> } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    if (isAutoStart || typeof window === 'undefined') return false;
    return window.localStorage.getItem('mungil_v13_onboarded') !== '1';
  });

  const [notifications, setNotifications] = useState<StudioNotification[]>([
    {
      id: 'n-1',
      channel: 'build',
      severity: 'success',
      title: 'Qolbu Engine v13.0 Initialized',
      body: '8-stage Itel A70 verification and 33×10 GitHub DNA catalog loaded.',
      timestamp: 'Now',
      read: false,
    },
  ]);

  const [user, setUser] = useState<User | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('Ready — local browser persistence active.');
  const [serverHealth, setServerHealth] = useState<ServerHealthStatus | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveTimer = window.setTimeout(() => {
      saveStudioWorkspaceSnapshot(window.localStorage, {
        project,
        builds,
        tickets,
        commits,
        importedAssets,
        projectionMode,
      });
    }, 350);
    return () => window.clearTimeout(saveTimer);
  }, [project, builds, tickets, commits, importedAssets, projectionMode]);

  useEffect(() => {
    let active = true;
    const pollHealth = async () => {
      const start = performance.now();
      try {
        const res = await fetch('/api/health');
        const latencyMs = Math.max(1, Math.round(performance.now() - start));
        if (!res.ok) throw new Error('health status');
        const data = (await res.json()) as {
          ok?: boolean;
          engine?: string;
          aiConfigured?: boolean;
          timestamp?: string;
        };
        if (active) {
          setServerHealth({
            ok: Boolean(data.ok),
            engine: data.engine ?? 'MungilEngine V13 / Qolbu',
            aiConfigured: Boolean(data.aiConfigured),
            latencyMs,
            checkedAt: data.timestamp ?? new Date().toISOString(),
          });
        }
      } catch {
        if (active) {
          setServerHealth({
            ok: false,
            engine: 'MungilEngine V13 Offline',
            aiConfigured: false,
            latencyMs: 0,
            checkedAt: new Date().toISOString(),
          });
        }
      }
    };
    void pollHealth();
    const timer = window.setInterval(() => {
      void pollHealth();
    }, 25000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    return () => {
      qolbuAudio.dispose();
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) return;
      try {
        const token = await fbUser.getIdToken();
        const res = await fetch('/api/db/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            projects?: Array<{
              id: number;
              title: string;
              genre: string;
              prompt: string;
              gddJson: string;
              styleBibleJson: string;
              stateMachineJson: string;
              techDocsMd: string;
              activeBranch: string;
            }>;
          };
          const latest = data.projects?.[0];
          if (latest) {
            setProject((prev) => {
              const parsedGdd = JSON.parse(latest.gddJson);
              const parsedStyle = JSON.parse(latest.styleBibleJson);
              const parsedFsm = JSON.parse(latest.stateMachineJson);
              const nextBrief = { ...prev.brief, title: latest.title, genre: latest.genre, prompt: latest.prompt };
              const nextCfg = synthesizeRuntimeConfig(latest.prompt, nextBrief, parsedStyle, prev.adoptedRepos);
              return runAll18AgentsPipeline(
                {
                  ...prev,
                  dbId: latest.id,
                  brief: nextBrief,
                  gdd: parsedGdd,
                  styleBible: parsedStyle,
                  stateMachine: parsedFsm,
                  runtimeConfig: nextCfg,
                  techDocsMd: latest.techDocsMd,
                  activeBranch: latest.activeBranch,
                },
                liveMetricsRef.current.drawCalls,
                liveMetricsRef.current.memoryMb
              );
            });
            setCloudSyncStatus(`Loaded cloud workspace "${latest.title}" from Cloud SQL.`);
          }
        }
      } catch {
        setCloudSyncStatus('Signed in — click Sync Project to store workspace in Cloud SQL.');
      }
    });
    return () => unsub();
  }, []);

  const pushNotification = (notif: Omit<StudioNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications((prev) => [
      {
        ...notif,
        id: `n-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleGenerateFromPrompt = async (promptText: string, customTitle?: string) => {
    setIsGenerating(true);
    setAiNotice('Executed 18-agent deterministic DAG — enriching with Studio AI...');
    let localBase = buildProjectFromPrompt(promptText, customTitle, project.adoptedRepos);
    setProjectionMode(localBase.runtimeConfig.projectionMode);
    setProject((prev) => ({
      ...localBase,
      dbId: prev.dbId,
    }));
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/ai/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, title: customTitle }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          blueprint?: {
            title?: string;
            genre?: string;
            artStyle?: string;
            coreLoop?: string;
            audience?: string;
            highConcept?: string;
            pillars?: string[];
            playerVerbs?: string[];
            progressionLoop?: string[];
            verticalSliceScope?: string[];
            monetizationAndFairness?: string;
            visualThesis?: string;
            lightingRig?: string;
            palette?: Array<{ role: string; hex: string; usage: string }>;
            materialRules?: string[];
            silhouetteRules?: string[];
            avoidList?: string[];
            runtimeTuning?: {
              projectionMode?: ProjectionMode;
              moveSpeed?: number;
              enemySpeed?: number;
              shardCount?: number;
              fogDensity?: number;
              audioTempoBpm?: number;
              audioScale?: AudioScaleId;
            };
          };
        };
        const bp = data.blueprint;
        if (bp?.title && bp?.highConcept) {
          localBase.brief = {
            ...localBase.brief,
            title: bp.title,
            genre: bp.genre || localBase.brief.genre,
            artStyle: bp.artStyle || localBase.brief.artStyle,
            coreLoop: bp.coreLoop || localBase.brief.coreLoop,
            audience: bp.audience || localBase.brief.audience,
          };
          localBase.gdd = {
            ...localBase.gdd,
            highConcept: bp.highConcept,
            pillars: bp.pillars?.length ? bp.pillars : localBase.gdd.pillars,
            playerVerbs: bp.playerVerbs?.length ? bp.playerVerbs : localBase.gdd.playerVerbs,
            progressionLoop: bp.progressionLoop?.length ? bp.progressionLoop : localBase.gdd.progressionLoop,
            verticalSliceScope: bp.verticalSliceScope?.length ? bp.verticalSliceScope : localBase.gdd.verticalSliceScope,
            monetizationAndFairness: bp.monetizationAndFairness || localBase.gdd.monetizationAndFairness,
          };
          localBase.styleBible = {
            visualThesis: bp.visualThesis || localBase.styleBible.visualThesis,
            lightingRig: bp.lightingRig || localBase.styleBible.lightingRig,
            palette: bp.palette?.length ? bp.palette : localBase.styleBible.palette,
            materialRules: bp.materialRules?.length ? bp.materialRules : localBase.styleBible.materialRules,
            silhouetteRules: bp.silhouetteRules?.length ? bp.silhouetteRules : localBase.styleBible.silhouetteRules,
            avoidList: bp.avoidList?.length ? bp.avoidList : localBase.styleBible.avoidList,
          };
          const mergedRuntime = synthesizeRuntimeConfig(
            promptText,
            localBase.brief,
            localBase.styleBible,
            localBase.adoptedRepos,
            bp.runtimeTuning
          );
          localBase = runAll18AgentsPipeline(
            { ...localBase, runtimeConfig: mergedRuntime },
            liveMetrics.drawCalls,
            liveMetrics.memoryMb
          );
          setAiNotice('Synchronized live AI blueprint & runtime tuning across all 18 agents.');
        }
      } else {
        setAiNotice('Synthesized deterministic 18-agent AAA blueprint locally.');
      }
    } catch {
      setAiNotice('Synthesized deterministic 18-agent AAA blueprint locally.');
    } finally {
      window.clearTimeout(timer);
      setProjectionMode(localBase.runtimeConfig.projectionMode);
      setProject((prev) => ({
        ...localBase,
        dbId: prev.dbId,
      }));
      setIsGenerating(false);
      pushNotification({
        channel: 'push',
        severity: 'success',
        title: `18-Agent Pipeline Synced: ${localBase.brief.title}`,
        body: `${localBase.runtimeConfig.projectionMode} · ${localBase.runtimeConfig.shardCount} Shards · ${localBase.runtimeConfig.audioTempoBpm} BPM.`,
      });
    }
  };

  const handleRunAll18Agents = () => {
    setProject((prev) => runAll18AgentsPipeline(prev, liveMetrics.drawCalls, liveMetrics.memoryMb));
    setAiNotice('Executed full 18-agent topological DAG verification & synced Event Bus.');
    pushNotification({
      channel: 'build',
      severity: 'success',
      title: 'All 18 AI Agents Verified',
      body: 'Topological DAG dependencies, FSM guards, GitHub DNA, and Tech Docs updated.',
    });
  };

  const handleTriggerFeedbackCycle = () => {
    setProject((prev) =>
      runSynchronizedOrchestrationCycle(
        prev,
        Math.max(42, liveMetrics.drawCalls),
        Math.max(304, liveMetrics.memoryMb)
      )
    );
    setAiNotice('QA Tester flagged budget breach -> Code Architect & Asset Generator converged in Round 2.');
    pushNotification({
      channel: 'build',
      severity: 'info',
      title: 'Self-Healing Multi-Agent Loop Converged',
      body: 'QA feedback automatically decimated LOD draw calls <= 35 and compacted textures <= 280 MB.',
    });
  };

  const handleFsmTrigger = (trigger: string) => {
    const res = stepStateMachine(project.stateMachine, activeFsmState, trigger);
    if (res.transitioned) {
      setActiveFsmState(res.nextStateId);
    }
  };

  const handleUpdateStateMachine = (nextFsm: StateMachineSpec) => {
    const tests = runAutomatedLogicTests(nextFsm, liveMetrics.drawCalls, liveMetrics.memoryMb);
    const updatedDocs = generateTechnicalDocs(
      project.brief,
      project.gdd,
      project.styleBible,
      nextFsm,
      tests,
      builds[0]?.versionTag || 'v13.0.1'
    );
    setProject((prev) => ({ ...prev, stateMachine: nextFsm, techDocsMd: updatedDocs }));
  };

  const executeVerifiedBuildRecord = async (outcome: 'passed' | 'failed') => {
    const nextNum = builds.length + 1;
    const versionTag = `v13.0.${nextNum}`;
    const newBuild: BuildRecordItem =
      outcome === 'passed'
        ? {
            id: `b-${Date.now()}`,
            versionTag,
            status: 'passed',
            targetPlatform: 'Itel A70 Android APK',
            cpuMs: liveMetrics.cpuMs,
            gpuMs: liveMetrics.gpuMs,
            drawCalls: liveMetrics.drawCalls,
            memoryMb: liveMetrics.memoryMb,
            fpsAvg: liveMetrics.fps,
            errorSummary: '',
            logText: `Build ${versionTag} passed pre-build Asset Pipeline & 8-stage Qolbu audit; Tech Docs regenerated.`,
            createdAt: new Date().toISOString(),
          }
        : {
            id: `b-${Date.now()}`,
            versionTag,
            status: 'failed',
            targetPlatform: 'Itel A70 Android APK',
            cpuMs: 24.8,
            gpuMs: 17.2,
            drawCalls: 44,
            memoryMb: 308,
            fpsAvg: 21,
            errorSummary: 'DrawCalls (44 > 35) & Heap (308MB > 280MB) threshold breached',
            logText: `Build ${versionTag} blocked by Qolbu Error Guard; email + push alert dispatched.`,
            createdAt: new Date().toISOString(),
          };

    setBuilds((prev) => [newBuild, ...prev]);

    if (outcome === 'passed') {
      const tests = runAutomatedLogicTests(project.stateMachine, newBuild.drawCalls, newBuild.memoryMb);
      const updatedDocs = generateTechnicalDocs(
        project.brief,
        project.gdd,
        project.styleBible,
        project.stateMachine,
        tests,
        versionTag
      );
      setProject((prev) => ({ ...prev, techDocsMd: updatedDocs }));
      pushNotification({
        channel: 'build',
        severity: 'success',
        title: `Build ${versionTag} Verified`,
        body: 'Technical Docs regenerated and Itel A70 release profile passed.',
      });
    } else {
      pushNotification({
        channel: 'email',
        severity: 'error',
        title: `ALERT: Build ${versionTag} Failed`,
        body: newBuild.errorSummary,
      });
    }

    if (user && project.dbId) {
      try {
        const token = await user.getIdToken();
        await fetch('/api/db/builds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...newBuild, projectId: project.dbId }),
        });
      } catch {
        // Ignore offline DB log error
      }
    }
  };

  const handleSimulateBuild = async (outcome: 'passed' | 'failed') => {
    if (outcome === 'passed') {
      const report = validateAssetPipelinePreBuild(importedAssets, liveMetrics.drawCalls);
      if (!report.passed) {
        setPreBuildReport(report);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        pushNotification({
          channel: 'build',
          severity: 'warning',
          title: 'Pre-Build Asset Validation Flagged Issues',
          body: `${report.flaggedAssets.length} asset constraints require batching or texel optimization before release build.`,
        });
        return;
      }
    }
    await executeVerifiedBuildRecord(outcome);
  };

  const handleRunPreBuildAudit = () => {
    const report = validateAssetPipelinePreBuild(importedAssets, liveMetrics.drawCalls);
    setPreBuildReport(report);
    if (!report.passed && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (report.passed) {
      pushNotification({
        channel: 'build',
        severity: 'success',
        title: 'Pre-Build Asset Audit Clean',
        body: `All ${report.totalAssets} assets comply with <=35 DC and 128–1024 px/m texel density.`,
      });
    } else {
      pushNotification({
        channel: 'build',
        severity: 'warning',
        title: 'Pre-Build Asset Audit Flagged Issues',
        body: `${report.flaggedAssets.length} flagged assets reported inside StudioErrorBoundary.`,
      });
    }
  };

  const handleAutoFixAssetsAndBuild = async () => {
    const fixed: PreBuildAssetInput[] = importedAssets.map((a) => ({
      ...a,
      drawCalls: Math.min(a.drawCalls, 4),
      texelDensityPxPerM: Math.min(512, Math.max(256, a.texelDensityPxPerM)),
      tris: a.tris ? Math.min(a.tris, 12000) : undefined,
      hasNaN: false,
    }));
    setImportedAssets(fixed);
    setPreBuildReport(null);
    const bus = new StudioMessageBus();
    const remediationMsg = bus.publish({
      fromAgent: 'Art Lead & Technical Artist',
      toTopic: 'assets.prebuild.autofixed',
      channel: 'feedback',
      round: project.eventBus.length + 1,
      payload: `Auto-batched DrawCalls & compressed textures to 256-512 px/m ASTC 6x6 across ${fixed.length} assets.`,
    });
    setProject((prev) => ({
      ...prev,
      eventBus: [remediationMsg, ...prev.eventBus],
    }));
    await executeVerifiedBuildRecord('passed');
  };

  const handleCloudSync = async () => {
    if (!user) return;
    setCloudSyncStatus('Syncing studio workspace to Cloud SQL...');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/db/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: project.dbId,
          title: project.brief.title,
          genre: project.brief.genre,
          platform: project.brief.platform,
          prompt: project.brief.prompt,
          gddJson: JSON.stringify(project.gdd),
          styleBibleJson: JSON.stringify(project.styleBible),
          stateMachineJson: JSON.stringify(project.stateMachine),
          techDocsMd: project.techDocsMd,
          activeBranch: project.activeBranch,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { project: { id: number } };
        setProject((prev) => ({ ...prev, dbId: data.project.id }));
        setCloudSyncStatus(`Synced "${project.brief.title}" (ID #${data.project.id}) to Cloud SQL.`);
      } else {
        setCloudSyncStatus('Cloud SQL sync returned an error. Retry shortly.');
      }
    } catch {
      setCloudSyncStatus('Network error reaching Cloud SQL.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sticky Top Header (Compact <=12% height on mobile) */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1440px] px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-display font-bold text-sm">
              M13
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">MungilEngine V13</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline truncate">Qolbu AAA Studio</span>
              </div>
              <h1 className="font-display text-sm sm:text-base font-bold truncate">
                {project.brief.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isOnline && (
              <div
                data-testid="offline-status-badge"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-amber-500/50 bg-amber-500/15 px-2.5 font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-300"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Offline Mode</span>
              </div>
            )}

            {installPromptEvent && (
              <button
                type="button"
                data-testid="pwa-install-btn"
                onClick={async () => {
                  try {
                    await installPromptEvent.prompt();
                  } finally {
                    setInstallPromptEvent(null);
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            <div
              data-testid="header-server-health"
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-300"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  serverHealth?.ok ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{serverHealth?.ok ? `API ${serverHealth.latencyMs}ms` : 'API Sync'}</span>
            </div>

            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              aria-label="Open Quick Search"
              className="inline-flex h-9 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 sm:px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quick Search</span>
              <kbd className="hidden md:inline font-mono text-[10px] text-slate-400">Ctrl+K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              aria-label="Open Beginner Guide"
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Open Notifications"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-amber-500"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-amber-500"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Navigation Strip */}
        <nav className="mx-auto max-w-[1440px] px-4 pb-2 flex items-center gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`inline-flex h-10 sm:h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Studio Workspace */}
      <main className="mx-auto max-w-[1440px] px-4 py-6">
        {storageWarning && (
          <div
            role="status"
            data-testid="workspace-recovery-alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200"
          >
            <span>{storageWarning}</span>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-500/20"
            >
              Dismiss
            </button>
          </div>
        )}
        <StudioErrorBoundary
          key={activeSection}
          preBuildReport={activeSection === 'sandbox' ? null : preBuildReport}
          onAutoFixAssets={() => void handleAutoFixAssetsAndBuild()}
          onProceedBuildAnyway={() => {
            setPreBuildReport(null);
            void executeVerifiedBuildRecord('passed');
          }}
          onDismissPreBuildReport={() => setPreBuildReport(null)}
        >
          {activeSection === 'director' && (
            <DirectorGddPanel
              project={project}
              projectionMode={projectionMode}
              onProjectionChange={(mode) => {
                setProjectionMode(mode);
                setProject((prev) =>
                  reconcileProjectSyncProtocol({
                    ...prev,
                    runtimeConfig: { ...prev.runtimeConfig, projectionMode: mode },
                  })
                );
              }}
              onUpdateRuntimeConfig={(nextCfg) => {
                setProjectionMode(nextCfg.projectionMode);
                setProject((prev) => reconcileProjectSyncProtocol({ ...prev, runtimeConfig: nextCfg }));
              }}
              onGenerateFromPrompt={handleGenerateFromPrompt}
              onToggleAgentApproval={(agentId) =>
                setProject((prev) => ({
                  ...prev,
                  agents: prev.agents.map((a) => (a.id === agentId ? { ...a, approved: !a.approved } : a)),
                }))
              }
              onSyncRound={() => {
                const bus = new StudioMessageBus();
                const loopMsgs = bus.runTriadValidationLoop(project.brief, liveMetrics.drawCalls, liveMetrics.memoryMb);
                setProject((prev) =>
                  reconcileProjectSyncProtocol({
                    ...prev,
                    eventBus: [...loopMsgs, ...prev.eventBus].slice(0, 24),
                  })
                );
              }}
              onRunAll18Agents={handleRunAll18Agents}
              onTriggerFeedbackCycle={handleTriggerFeedbackCycle}
              onJumpToSandbox={() => setActiveSection('sandbox')}
              onInstantPlay={() => {
                setSandboxAutoStartNonce((n) => n + 1);
                setActiveSection('sandbox');
              }}
              isGenerating={isGenerating}
              aiNotice={aiNotice}
            />
          )}

          {activeSection === 'sandbox' && (
            <ThreeSandboxViewport
              brief={project.brief}
              runtimeConfig={project.runtimeConfig}
              autoStartSignal={sandboxAutoStartNonce}
              onUpdateRuntimeConfig={(nextCfg: GameRuntimeConfig) =>
                setProject((prev) => reconcileProjectSyncProtocol({ ...prev, runtimeConfig: nextCfg }))
              }
              onResetRuntimeConfig={() =>
                setProject((prev) =>
                  reconcileProjectSyncProtocol({
                    ...prev,
                    runtimeConfig: synthesizeRuntimeConfig(
                      prev.brief.prompt,
                      prev.brief,
                      prev.styleBible,
                      prev.adoptedRepos
                    ),
                  })
                )
              }
              metricsRef={liveMetricsRef}
              projectionMode={projectionMode}
              onProjectionChange={(mode) => {
                setProjectionMode(mode);
                setProject((prev) =>
                  reconcileProjectSyncProtocol({
                    ...prev,
                    runtimeConfig: { ...prev.runtimeConfig, projectionMode: mode },
                  })
                );
              }}
              onTelemetryTick={(m) => setLiveMetrics(m)}
              onFsmTrigger={handleFsmTrigger}
              onCaptureScreenshot={(dataUrl) => {
                downloadDataUrl(dataUrl, `${sanitizeSlug(project.brief.title)}-photomode.png`);
                pushNotification({
                  channel: 'push',
                  severity: 'info',
                  title: 'Photo Mode Snapshot Saved',
                  body: 'High-contrast WebGL frame captured for community sharing.',
                });
              }}
            />
          )}

          {activeSection === 'statemachine' && (
            <StateMachineQaPanel
              stateMachine={project.stateMachine}
              activeFsmState={activeFsmState}
              onTriggerFsm={handleFsmTrigger}
              onUpdateStateMachine={handleUpdateStateMachine}
              tickets={tickets}
              onCreateTicket={async (tk) => {
                const created: TicketItem = {
                  ...tk,
                  id: `tk-${Date.now()}`,
                  createdAt: new Date().toISOString(),
                };
                setTickets((prev) => [created, ...prev]);
                if (user && project.dbId) {
                  try {
                    const token = await user.getIdToken();
                    await fetch('/api/db/tickets', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ...created, projectId: project.dbId }),
                    });
                  } catch {
                    // Local fallback preserved
                  }
                }
              }}
              onUpdateTicketStatus={async (id, status) => {
                setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
                const numericId = Number(id);
                if (user && Number.isInteger(numericId) && numericId > 0) {
                  try {
                    const token = await user.getIdToken();
                    await fetch(`/api/db/tickets/${numericId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status }),
                    });
                  } catch {
                    // Local optimistic state preserved
                  }
                }
              }}
              drawCalls={liveMetrics.drawCalls}
              memoryMb={liveMetrics.memoryMb}
            />
          )}

          {activeSection === 'media' && <MediaVoiceForgePanel project={project} />}

          {activeSection === 'github' && (
            <GitHub33Panel
              adoptedRepos={project.adoptedRepos}
              onToggleAdoptRepo={(repo) =>
                setProject((prev) => {
                  const exists = prev.adoptedRepos.includes(repo);
                  const nextRepos = exists
                    ? prev.adoptedRepos.filter((r) => r !== repo)
                    : [...prev.adoptedRepos, repo];
                  const nextCfg = synthesizeRuntimeConfig(
                    prev.brief.prompt,
                    prev.brief,
                    prev.styleBible,
                    nextRepos,
                    prev.runtimeConfig
                  );
                  return runAll18AgentsPipeline(
                    { ...prev, adoptedRepos: nextRepos, runtimeConfig: nextCfg },
                    liveMetrics.drawCalls,
                    liveMetrics.memoryMb
                  );
                })
              }
            />
          )}

          {activeSection === 'telemetry' && (
            <TelemetryExportPanel
              project={project}
              builds={builds}
              liveMetrics={liveMetrics}
              serverHealth={serverHealth}
              automationTests={runAutomatedLogicTests(
                project.stateMachine,
                liveMetrics.drawCalls,
                liveMetrics.memoryMb
              )}
              onSimulateBuild={(outcome) => void handleSimulateBuild(outcome)}
              onRunPreBuildAudit={handleRunPreBuildAudit}
              onCreateTicketFromError={(title, detail) => {
                const ticket: TicketItem = {
                  id: `tk-${Date.now()}`,
                  title,
                  department: 'Performance & QA',
                  priority: 'high',
                  status: 'open',
                  assignee: 'QA & Automation Lead',
                  createdAt: new Date().toISOString(),
                };
                setTickets((prev) => [ticket, ...prev]);
                pushNotification({
                  channel: 'build',
                  severity: 'warning',
                  title: 'Ticket Escalated from Telemetry',
                  body: `${title} — ${detail}`,
                });
              }}
              onImportProject={(imported) => {
                const normalized = runAll18AgentsPipeline(
                  {
                    ...imported,
                    runtimeConfig:
                      imported.runtimeConfig ??
                      synthesizeRuntimeConfig(
                        imported.brief.prompt,
                        imported.brief,
                        imported.styleBible,
                        imported.adoptedRepos ?? []
                      ),
                  },
                  liveMetrics.drawCalls,
                  liveMetrics.memoryMb
                );
                setProject(normalized);
                setProjectionMode(normalized.runtimeConfig.projectionMode);
                pushNotification({
                  channel: 'build',
                  severity: 'success',
                  title: `Imported Studio Project: ${normalized.brief.title}`,
                  body: 'Re-verified all 18 agents and synced Sandbox parameters.',
                });
              }}
              onShareFeedback={(msg) =>
                pushNotification({
                  channel: 'push',
                  severity: 'success',
                  title: 'Export & Share',
                  body: msg,
                })
              }
            />
          )}

          {activeSection === 'collab' && (
            <CollabLiveOpsPanel
              user={user}
              onSignIn={() => void signInWithPopup(auth, googleAuthProvider)}
              onSignOut={() => void signOut(auth)}
              onCloudSync={handleCloudSync}
              cloudSyncStatus={cloudSyncStatus}
              activeBranch={project.activeBranch}
              onSwitchBranch={(branch) => setProject((prev) => ({ ...prev, activeBranch: branch }))}
              commits={commits}
              onCreateCommit={async (message, diffSummary) => {
                const entry: CommitItem = {
                  id: `cm-${Date.now()}`,
                  branch: project.activeBranch,
                  hash: Math.random().toString(16).slice(2, 9),
                  author: user?.displayName || 'Studio Lead',
                  message,
                  diffSummary,
                  createdAt: new Date().toISOString(),
                };
                setCommits((prev) => [entry, ...prev]);
                if (user && project.dbId) {
                  try {
                    const token = await user.getIdToken();
                    await fetch('/api/db/commits', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ ...entry, projectId: project.dbId }),
                    });
                  } catch {
                    // Local commit preserved
                  }
                }
              }}
              liveOpsMetrics={liveOpsMetrics}
            />
          )}
        </StudioErrorBoundary>
      </main>

      {/* Modals & Drawers */}
      <QuickSearchModal
        open={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        onNavigate={(sec) => setActiveSection(sec)}
        tickets={tickets}
      />

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('mungil_v13_onboarded', '1');
          }
        }}
        onJumpToSandbox={() => setActiveSection('sandbox')}
      />

      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
      />
    </div>
  );
}
