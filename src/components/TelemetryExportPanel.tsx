import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Code2,
  Download,
  FileArchive,
  FileDown,
  HardDrive,
  Mail,
  Server,
  Share2,
  ShieldAlert,
  Smartphone,
  Ticket,
  Trash2,
  Upload,
} from 'lucide-react';
import { packGameBinaryBundle } from '../engine/assetAtlas';
import { downloadBinaryFile, downloadTextFile, safeJsonParse, sanitizeSlug } from '../engine/ioUtils';
import { exportBuildAnalysisPdf } from '../engine/pdfExport';
import { QOLBU_CONSTANTS, runQolbu8StageAudit } from '../engine/qolbuCore';
import { runAutomatedLogicTests } from '../engine/stateMachine';
import { generateAndroidItelA70BuildPack, generatePlayableHtml5Export } from '../engine/studioPipeline';
import type {
  AutomatedTestCaseResult,
  BuildRecordItem,
  LiveTelemetrySnapshot,
  ServerHealthStatus,
  StudioProjectState,
} from '../engine/types';

interface TelemetryExportPanelProps {
  project: StudioProjectState;
  builds: BuildRecordItem[];
  liveMetrics: LiveTelemetrySnapshot;
  serverHealth?: ServerHealthStatus | null;
  automationTests?: AutomatedTestCaseResult[];
  onSimulateBuild: (outcome: 'passed' | 'failed') => void;
  onRunPreBuildAudit?: () => void;
  onCreateTicketFromError?: (title: string, detail: string) => void;
  onImportProject?: (imported: StudioProjectState) => void;
  onShareFeedback: (msg: string) => void;
}

type MetricKey = 'fpsAvg' | 'cpuMs' | 'gpuMs' | 'drawCalls' | 'memoryMb';

const METRIC_META: Record<MetricKey, { label: string; unit: string; target: number; color: string }> = {
  fpsAvg: { label: 'Frame Rate', unit: 'FPS', target: 30, color: '#10b981' },
  cpuMs: { label: 'CPU Frame Time', unit: 'ms', target: 20, color: '#f59e0b' },
  gpuMs: { label: 'GPU Frame Time', unit: 'ms', target: 14, color: '#38bdf8' },
  drawCalls: { label: 'Draw Calls', unit: 'DC', target: 35, color: '#a855f7' },
  memoryMb: { label: 'RSS Heap Memory', unit: 'MB', target: 280, color: '#fb7185' },
};

const DESKTOP_16GB_MB = 16384;

export const TelemetryExportPanel: React.FC<TelemetryExportPanelProps> = ({
  project,
  builds,
  liveMetrics,
  serverHealth,
  automationTests,
  onSimulateBuild,
  onRunPreBuildAudit,
  onCreateTicketFromError,
  onImportProject,
  onShareFeedback,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('fpsAvg');
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');
  const [alertEmail, setAlertEmail] = useState('release-lead@studio.local');
  const [budgetView, setBudgetView] = useState<'itel_a70' | 'desktop_16gb'>('itel_a70');
  const [simulatedTextureOffsetMb, setSimulatedTextureOffsetMb] = useState(0);
  const [simulatedMeshOffsetMb, setSimulatedMeshOffsetMb] = useState(0);

  const apkPack = useMemo(() => generateAndroidItelA70BuildPack(project.brief), [project.brief]);
  const qbinPack = useMemo(() => packGameBinaryBundle(project), [project]);

  const effectiveTexturesMb = Number(Math.max(24, liveMetrics.texturesMb + simulatedTextureOffsetMb).toFixed(1));
  const effectiveMeshesMb = Number(Math.max(12, liveMetrics.meshesMb + simulatedMeshOffsetMb).toFixed(1));
  const effectiveAudioMb = liveMetrics.audioMb;
  const effectiveRuntimeMb = liveMetrics.runtimeMb;
  const effectiveTotalHeapMb = Number(
    (effectiveTexturesMb + effectiveMeshesMb + effectiveAudioMb + effectiveRuntimeMb).toFixed(1)
  );
  const activeCapMb = budgetView === 'itel_a70' ? QOLBU_CONSTANTS.MEMORY_BUDGET_MB : DESKTOP_16GB_MB;
  const isItelHeapExceeded = effectiveTotalHeapMb > QOLBU_CONSTANTS.MEMORY_BUDGET_MB;

  const computedTests = useMemo(
    () => automationTests ?? runAutomatedLogicTests(project.stateMachine, liveMetrics.drawCalls, effectiveTotalHeapMb),
    [automationTests, project.stateMachine, liveMetrics.drawCalls, effectiveTotalHeapMb]
  );
  const passedTestCount = computedTests.filter((t) => t.passed).length;

  const orderedBuilds = useMemo(() => [...builds].reverse(), [builds]);
  const meta = METRIC_META[selectedMetric];

  const maxVal = useMemo(() => {
    const vals = orderedBuilds.map((b) => Number(b[selectedMetric]));
    return Math.max(meta.target * 1.25, ...vals, 1);
  }, [orderedBuilds, selectedMetric, meta.target]);

  const handleExportPdf = () => {
    const audit = runQolbu8StageAudit(liveMetrics.drawCalls, effectiveTotalHeapMb);
    exportBuildAnalysisPdf(project, builds, computedTests, audit);
    onShareFeedback('Automated PDF Build Analysis Report exported.');
  };

  const handleSocialShare = async () => {
    const summary = `Built "${project.brief.title}" (${project.brief.genre}) with MungilEngine V13 / Qolbu AAA Studio · ${liveMetrics.fps} FPS & ${liveMetrics.drawCalls} Draw Calls on Itel A70 profile!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: project.brief.title, text: summary, url: window.location.href });
        onShareFeedback('Shared project showcase cleanly.');
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${summary} ${window.location.href}`);
      onShareFeedback('Share summary copied to clipboard for social posting.');
    } catch {
      onShareFeedback(summary);
    }
  };

  const targetY = 160 - (meta.target / maxVal) * 130;
  const slug = sanitizeSlug(project.brief.title);

  return (
    <div className="space-y-6">
      {/* Real-Time Server Status & Automated Test Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          data-testid="telemetry-server-status"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Backend Control Plane
            </span>
            <span
              className={`font-mono text-[11px] font-bold uppercase ${
                serverHealth?.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
              }`}
            >
              {serverHealth?.ok ? 'ONLINE' : 'CHECKING'}
            </span>
          </div>
          <div className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
            {serverHealth?.engine ?? 'MungilEngine V13 / Qolbu'}
          </div>
          <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            Latency {serverHealth?.latencyMs ?? 12}ms · AI {serverHealth?.aiConfigured ? 'Ready' : 'Deterministic'}
          </div>
        </div>

        <div
          data-testid="telemetry-automated-tests"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Automated QA Logic Suite
            </span>
            <span
              className={`font-mono text-[11px] font-bold tabular-nums ${
                passedTestCount === computedTests.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}
            >
              {passedTestCount}/{computedTests.length} PASSED
            </span>
          </div>
          <div className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Physics, FSM Reachability &amp; Fuzz Guard
          </div>
          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {computedTests.map((t) => `${t.passed ? 'PASS' : 'FAIL'}:${t.suite}`).join(' · ')}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <FileArchive className="h-3.5 w-3.5" />
              QBIN13 Binary Bundle
            </span>
            <span className="font-mono text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {qbinPack.headerSummary.ratioPct}% RATIO
            </span>
          </div>
          <div className="font-display text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            {qbinPack.headerSummary.compressedBytes} B (from {qbinPack.headerSummary.uncompressedBytes} B)
          </div>
          <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            CRC32 {qbinPack.headerSummary.crc32Hex} · ASTC 6x6 Atlas
          </div>
        </div>
      </div>
      {/* Warning Banner when Heap Exceeds 280MB on Target Itel A70 Specs */}
      {isItelHeapExceeded && (
        <div
          role="alert"
          data-testid="itel-memory-warning"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/60 bg-rose-500/12 px-4 py-3 text-xs text-rose-900 dark:text-rose-100"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <div className="font-semibold">
                Itel A70 Heap Budget Exceeded ({effectiveTotalHeapMb} MB / {QOLBU_CONSTANTS.MEMORY_BUDGET_MB} MB ceiling)
              </div>
              <div className="opacity-90">
                Overage of {(effectiveTotalHeapMb - QOLBU_CONSTANTS.MEMORY_BUDGET_MB).toFixed(1)} MB risks LMK eviction on 3GB RAM Android devices. Trigger LRU texture eviction or ASTC 6x6 compression.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onCreateTicketFromError && (
              <button
                type="button"
                onClick={() =>
                  onCreateTicketFromError(
                    `Itel A70 Heap Breach (${effectiveTotalHeapMb} MB > 280 MB)`,
                    `Textures ${effectiveTexturesMb}MB + Meshes ${effectiveMeshesMb}MB exceeded 280MB ceiling.`
                  )
                }
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-rose-400/50 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Ticket className="h-3.5 w-3.5" />
                Escalate to Ticket
              </button>
            )}
            <button
              type="button"
              data-testid="evict-lru-btn"
              onClick={() => {
                setSimulatedTextureOffsetMb((v) => Math.max(0, v - 80));
                setSimulatedMeshOffsetMb((v) => Math.max(0, v - 40));
                onShareFeedback('Evicted 40MB–120MB LRU texture/mesh mip pools for Itel A70 stability.');
              }}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Evict LRU Batch (-80MB)
            </button>
          </div>
        </div>
      )}

      {/* Interactive 16GB Desktop vs 280MB Itel A70 Memory Budget Visualizer */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-amber-600 dark:text-amber-400">
              Memory Budget Architecture · Textures / Meshes / Audio / ECS
            </p>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-amber-500" />
              16GB Desktop Envelope vs 280MB Itel A70 Allocator
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBudgetView('itel_a70')}
              className={`h-8 rounded-lg px-3 text-xs font-semibold ${
                budgetView === 'itel_a70'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Itel A70 (280 MB Cap)
            </button>
            <button
              type="button"
              onClick={() => setBudgetView('desktop_16gb')}
              className={`h-8 rounded-lg px-3 text-xs font-semibold ${
                budgetView === 'desktop_16gb'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Desktop Studio (16 GB)
            </button>
            <button
              type="button"
              data-testid="simulate-heap-spike"
              onClick={() => {
                setSimulatedTextureOffsetMb(95);
                setSimulatedMeshOffsetMb(35);
              }}
              className="h-8 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20"
            >
              Simulate +130MB Spike
            </button>
          </div>
        </div>

        {/* Stacked Allocation Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-xs tabular-nums">
            <span className="text-slate-600 dark:text-slate-300">
              Active Allocation: <strong className="text-slate-900 dark:text-white">{effectiveTotalHeapMb} MB</strong> / {activeCapMb.toLocaleString()} MB
            </span>
            <span className={isItelHeapExceeded ? 'text-rose-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
              {((effectiveTotalHeapMb / activeCapMb) * 100).toFixed(budgetView === 'desktop_16gb' ? 2 : 1)}% utilized
            </span>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, (effectiveTexturesMb / activeCapMb) * 100)}%` }}
              title={`Textures: ${effectiveTexturesMb} MB`}
            />
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${Math.min(100, (effectiveMeshesMb / activeCapMb) * 100)}%` }}
              title={`Meshes: ${effectiveMeshesMb} MB`}
            />
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (effectiveAudioMb / activeCapMb) * 100)}%` }}
              title={`Audio: ${effectiveAudioMb} MB`}
            />
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${Math.min(100, (effectiveRuntimeMb / activeCapMb) * 100)}%` }}
              title={`Runtime/ECS: ${effectiveRuntimeMb} MB`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Textures (ASTC 6x6)</span>
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {effectiveTexturesMb} MB
            </div>
            <input
              aria-label="Texture Streaming Load Offset"
              type="range"
              min={0}
              max={150}
              value={simulatedTextureOffsetMb}
              onChange={(e) => setSimulatedTextureOffsetMb(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Meshes &amp; Instancing</span>
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {effectiveMeshesMb} MB
            </div>
            <input
              aria-label="Mesh Streaming Load Offset"
              type="range"
              min={0}
              max={90}
              value={simulatedMeshOffsetMb}
              onChange={(e) => setSimulatedMeshOffsetMb(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Audio (16-Voice Pool)</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {effectiveAudioMb} MB
            </div>
            <div className="text-[11px] text-slate-500">22kHz Mono Ring · Zero Leak</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">SoA ECS &amp; WASM</span>
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {effectiveRuntimeMb} MB
            </div>
            <div className="text-[11px] text-slate-500">128 Entities · 64 Particles</div>
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry + Customizable Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-amber-600 dark:text-amber-400">
              Real-Time Build Performance &amp; Custom Metric Visualizer
            </p>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {meta.label} Telemetry ({meta.unit})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select Build Metric"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              <option value="fpsAvg">Metric: FPS Avg</option>
              <option value="cpuMs">Metric: CPU ms</option>
              <option value="gpuMs">Metric: GPU ms</option>
              <option value="drawCalls">Metric: Draw Calls</option>
              <option value="memoryMb">Metric: Memory MB</option>
            </select>

            <button
              type="button"
              onClick={() => setChartMode((m) => (m === 'line' ? 'bar' : 'line'))}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {chartMode === 'line' ? 'Line Chart' : 'Bar Chart'}
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export PDF Report
            </button>
          </div>
        </div>

        {/* Live Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            <div className="text-slate-500">Live Viewport FPS</div>
            <div className="font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {liveMetrics.fps} FPS
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            <div className="text-slate-500">CPU / GPU Frame</div>
            <div className="font-mono text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">
              {liveMetrics.cpuMs} / {liveMetrics.gpuMs}ms
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            <div className="text-slate-500">Active Draw Calls</div>
            <div className="font-mono text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {liveMetrics.drawCalls} / 35
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            <div className="text-slate-500">Triangle Budget</div>
            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-200">
              {liveMetrics.triangles} / 60K
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            <div className="text-slate-500">Effective Heap</div>
            <div className={`font-mono text-lg font-bold tabular-nums ${isItelHeapExceeded ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {effectiveTotalHeapMb} MB
            </div>
          </div>
        </div>

        {/* Customizable SVG Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
          <svg viewBox="0 0 640 190" className="w-full h-44">
            <line x1="40" y1={targetY} x2="628" y2={targetY} stroke="#64748b" strokeDasharray="4 4" strokeWidth="1" />
            <text x="626" y={Math.max(14, targetY - 6)} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
              Target {meta.target} {meta.unit}
            </text>

            {orderedBuilds.length > 0 &&
              (() => {
                const stepX = orderedBuilds.length > 1 ? 430 / (orderedBuilds.length - 1) : 0;
                const points = orderedBuilds.map((b, i) => {
                  const x = 60 + i * stepX;
                  const val = Number(b[selectedMetric]);
                  const y = 160 - (val / maxVal) * 130;
                  return { x, y, val, tag: b.versionTag };
                });

                return (
                  <>
                    {chartMode === 'line' && points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke={meta.color}
                        strokeWidth="2.5"
                        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                      />
                    )}
                    {points.map((p) => (
                      <g key={p.tag}>
                        {chartMode === 'bar' && (
                          <rect
                            x={p.x - 14}
                            y={p.y}
                            width="28"
                            height={160 - p.y}
                            rx="4"
                            fill={meta.color}
                            opacity="0.85"
                          />
                        )}
                        <circle cx={p.x} cy={p.y} r="4.5" fill={meta.color} />
                        <text x={p.x} y={178} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                          {p.tag}
                        </text>
                        <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="#cbd5e1" fontFamily="monospace">
                          {p.val}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
          </svg>
        </div>
      </div>

      {/* Build Audit Log History + Alert Trigger + Multi-Platform & APK Release Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Compilation Audit Log &amp; Alert Dispatcher
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pre-build asset pipeline check &amp; instant email/push alert triggers
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onRunPreBuildAudit && (
                <button
                  type="button"
                  data-testid="run-prebuild-audit"
                  onClick={onRunPreBuildAudit}
                  className="inline-flex h-8 items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Pre-Build Asset Audit
                </button>
              )}
              <button
                type="button"
                data-testid="run-verified-build"
                onClick={() => onSimulateBuild('passed')}
                className="inline-flex h-8 items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Run Verified Build
              </button>
              <button
                type="button"
                onClick={() => onSimulateBuild('failed')}
                className="inline-flex h-8 items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                Test Failure Alert
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400">Alert Recipient:</span>
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className="h-8 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {builds.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {b.versionTag} · {b.targetPlatform}
                  </span>
                  <div className="flex items-center gap-2">
                    {b.status === 'failed' && onCreateTicketFromError && (
                      <button
                        type="button"
                        onClick={() =>
                          onCreateTicketFromError(
                            `Build ${b.versionTag} Failure: ${b.errorSummary || 'Threshold Breach'}`,
                            b.logText
                          )
                        }
                        className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-500/25"
                      >
                        <Ticket className="h-3 w-3" />
                        Create Ticket
                      </button>
                    )}
                    <span
                      className={`uppercase font-bold ${
                        b.status === 'passed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-500">
                  CPU {b.cpuMs}ms · GPU {b.gpuMs}ms · {b.drawCalls} DC · {b.memoryMb} MB · {b.fpsAvg} FPS
                </div>
                <div className="text-slate-600 dark:text-slate-300">{b.logText}</div>
              </div>
            ))}
          </div>

          {/* Automated QA Test Matrix */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                Live Automated Test Results ({passedTestCount}/{computedTests.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {computedTests.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-2 text-[11px] flex items-center justify-between gap-2"
                >
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                    {t.name}
                  </span>
                  <span className={`font-mono font-bold shrink-0 ${t.passed ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.passed ? 'PASS' : 'FAIL'} · {t.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Multi-Platform Export & Android Itel A70 APK Pack */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-amber-500" />
              Itel A70 APK Release &amp; Multi-Platform Export
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Android 5+ (minSdk 21 → targetSdk 35), .qbin Binary Pack, PWA, &amp; Social Showcase
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
            <div>App ID: {apkPack.appId}</div>
            <div>Target: Itel A70 (3GB RAM) · WebViewAssetLoader · 0 Deprecated APIs</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => downloadTextFile(apkPack.buildGradleKts, 'build.gradle.kts', 'text/plain')}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Download className="h-3.5 w-3.5" />
              build.gradle.kts
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(apkPack.mainActivityKt, 'MainActivity.kt', 'text/plain')}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              MainActivity.kt
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(apkPack.proguardRulesPro, 'proguard-rules.pro', 'text/plain')}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              proguard-rules.pro
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile(apkPack.androidManifestXml, 'AndroidManifest.xml', 'application/xml')}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              AndroidManifest.xml
            </button>
            <button
              type="button"
              data-testid="download-qbin-btn"
              onClick={() => {
                downloadBinaryFile(qbinPack.bytes, `${slug}-v13.qbin`);
                onShareFeedback(
                  `Exported ${slug}-v13.qbin (${qbinPack.headerSummary.compressedBytes}B, CRC ${qbinPack.headerSummary.crc32Hex}).`
                );
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
            >
              <FileArchive className="h-3.5 w-3.5" />
              Binary Pack (.qbin)
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  generatePlayableHtml5Export(project),
                  `${slug}-playable.html`,
                  'text/html;charset=utf-8'
                )
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Code2 className="h-3.5 w-3.5" />
              Playable HTML5 Game
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  JSON.stringify(project, null, 2),
                  `${slug}-studio-project.json`,
                  'application/json'
                )
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Export Project (.json)
            </button>
            {onImportProject && (
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Upload className="h-3.5 w-3.5" />
                Import Project (.json)
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const parsed = safeJsonParse<StudioProjectState | null>(
                        String(reader.result || ''),
                        null
                      );
                      if (parsed?.brief?.title && parsed?.gdd && parsed?.stateMachine) {
                        onImportProject(parsed);
                      } else {
                        onShareFeedback('Invalid studio project JSON schema.');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            )}
            <button
              type="button"
              onClick={handleSocialShare}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 px-3 text-xs font-semibold text-white dark:text-slate-900 sm:col-span-2"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Creation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
