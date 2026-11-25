import React, { useEffect, useRef } from 'react';
import { QOLBU_CONSTANTS } from '../engine/qolbuCore';
import type { LiveTelemetrySnapshot, QualityPresetId } from '../engine/types';

interface ProfilerOverlayProps {
  metricsRef: React.MutableRefObject<LiveTelemetrySnapshot>;
  visible: boolean;
  qualityPreset: QualityPresetId;
}

const HISTORY_SLOTS = 24;

export const ProfilerOverlay: React.FC<ProfilerOverlayProps> = ({
  metricsRef,
  visible,
  qualityPreset,
}) => {
  const fpsElRef = useRef<HTMLSpanElement | null>(null);
  const cpuElRef = useRef<HTMLSpanElement | null>(null);
  const gpuElRef = useRef<HTMLSpanElement | null>(null);
  const memElRef = useRef<HTMLSpanElement | null>(null);
  const dcElRef = useRef<HTMLSpanElement | null>(null);
  const memBreakElRef = useRef<HTMLDivElement | null>(null);
  const texBarElRef = useRef<HTMLDivElement | null>(null);
  const meshBarElRef = useRef<HTMLDivElement | null>(null);
  const audioBarElRef = useRef<HTMLDivElement | null>(null);
  const cpuBarsRef = useRef<Array<SVGRectElement | null>>([]);
  const ringBufferRef = useRef<Float32Array>(new Float32Array(HISTORY_SLOTS));
  const cursorRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) return;
    let rafId = 0;
    let lastSample = 0;

    // Zero-GC loop: reads mutable ref and updates DOM textContent / SVG attributes directly.
    const loop = (now: number) => {
      if (now - lastSample >= 120) {
        lastSample = now;
        const m = metricsRef.current;

        if (fpsElRef.current) fpsElRef.current.textContent = `${m.fps}`;
        if (cpuElRef.current) cpuElRef.current.textContent = `${m.cpuMs.toFixed(1)}ms`;
        if (gpuElRef.current) gpuElRef.current.textContent = `${m.gpuMs.toFixed(1)}ms`;
        if (memElRef.current) memElRef.current.textContent = `${m.memoryMb.toFixed(1)}MB`;
        if (dcElRef.current) dcElRef.current.textContent = `${m.drawCalls}/${QOLBU_CONSTANTS.MAX_DRAW_CALLS}`;

        if (memBreakElRef.current) {
          memBreakElRef.current.textContent = `Tex ${m.texturesMb.toFixed(0)} · Mesh ${m.meshesMb.toFixed(0)} · Aud ${m.audioMb.toFixed(0)} MB`;
        }

        const cap = QOLBU_CONSTANTS.MEMORY_BUDGET_MB;
        if (texBarElRef.current) {
          texBarElRef.current.style.width = `${Math.min(100, (m.texturesMb / cap) * 100).toFixed(1)}%`;
        }
        if (meshBarElRef.current) {
          meshBarElRef.current.style.width = `${Math.min(100, (m.meshesMb / cap) * 100).toFixed(1)}%`;
        }
        if (audioBarElRef.current) {
          audioBarElRef.current.style.width = `${Math.min(100, (m.audioMb / cap) * 100).toFixed(1)}%`;
        }

        const ring = ringBufferRef.current;
        const writeIdx = cursorRef.current % HISTORY_SLOTS;
        ring[writeIdx] = m.cpuMs;
        cursorRef.current = writeIdx + 1;

        for (let i = 0; i < HISTORY_SLOTS; i++) {
          const rect = cpuBarsRef.current[i];
          if (!rect) continue;
          const idx = (cursorRef.current + i) % HISTORY_SLOTS;
          const cpuVal = ring[idx];
          const norm = Math.min(1, Math.max(0.08, cpuVal / 33.3));
          const barH = Math.round(norm * 22);
          rect.setAttribute('y', String(24 - barH));
          rect.setAttribute('height', String(barH));
          rect.setAttribute('fill', cpuVal > 20 ? '#fb7185' : '#10b981');
        }
      }
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [visible, metricsRef]);

  if (!visible) return null;

  return (
    <aside
      data-testid="profiler-overlay"
      aria-label="Zero-GC Live Runtime Profiler"
      className="pointer-events-auto absolute top-16 right-3 z-20 w-60 rounded-xl border border-slate-700 bg-slate-950/92 p-2.5 text-[11px] text-slate-100 shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
          Zero-GC Profiler
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          {qualityPreset === 'itel_a70_eco' ? 'Itel A70' : qualityPreset === 'hd_stylized' ? 'HD' : 'Desktop'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 font-mono tabular-nums text-center mb-2">
        <div className="rounded-lg bg-slate-900/90 px-1 py-1">
          <div className="text-[9px] text-slate-400">FPS</div>
          <span ref={fpsElRef} className="font-bold text-emerald-400">
            30
          </span>
        </div>
        <div className="rounded-lg bg-slate-900/90 px-1 py-1">
          <div className="text-[9px] text-slate-400">CPU</div>
          <span ref={cpuElRef} className="font-bold text-amber-300">
            12.4ms
          </span>
        </div>
        <div className="rounded-lg bg-slate-900/90 px-1 py-1">
          <div className="text-[9px] text-slate-400">GPU</div>
          <span ref={gpuElRef} className="font-bold text-sky-300">
            9.8ms
          </span>
        </div>
        <div className="rounded-lg bg-slate-900/90 px-1 py-1">
          <div className="text-[9px] text-slate-400">DC</div>
          <span ref={dcElRef} className="font-bold text-slate-200">
            24/35
          </span>
        </div>
      </div>

      {/* Zero-GC SVG Frame Sparkbars */}
      <svg viewBox="0 0 192 26" className="w-full h-6 mb-2 rounded bg-slate-900/80 px-1">
        {Array.from({ length: HISTORY_SLOTS }, (_, i) => (
          <rect
            key={i}
            ref={(el) => {
              cpuBarsRef.current[i] = el;
            }}
            x={2 + i * 8}
            y={14}
            width={5}
            height={10}
            rx={1}
            fill="#10b981"
          />
        ))}
      </svg>

      {/* Memory Pool Bar (280MB Itel A70 Envelope) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">Heap / 280MB</span>
          <span ref={memElRef} className="font-bold tabular-nums text-white">
            187.4MB
          </span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div ref={texBarElRef} className="h-full bg-amber-400" style={{ width: '38%' }} />
          <div ref={meshBarElRef} className="h-full bg-sky-400" style={{ width: '16%' }} />
          <div ref={audioBarElRef} className="h-full bg-emerald-400" style={{ width: '6%' }} />
        </div>
        <div ref={memBreakElRef} className="font-mono text-[9px] tabular-nums text-slate-400">
          Tex 106 · Mesh 44 · Aud 16 MB
        </div>
      </div>
    </aside>
  );
};
