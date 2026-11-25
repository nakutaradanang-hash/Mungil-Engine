import React, { useMemo, useState } from 'react';
import { Bell, Check, ChevronRight, Compass, Search, X } from 'lucide-react';
import { GITHUB_33_KEYWORDS } from '../engine/github33Catalog';
import { QOLBU_12_LAYERS } from '../engine/qolbuCore';
import { AAA_DEPARTMENTS_18 } from '../engine/studioPipeline';
import type { StudioNotification, StudioSectionId, TicketItem } from '../engine/types';

interface QuickSearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: StudioSectionId) => void;
  tickets: TicketItem[];
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  open,
  onClose,
  onNavigate,
  tickets,
}) => {
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const entries: Array<{ title: string; subtitle: string; section: StudioSectionId }> = [
      { title: 'Studio Director & 18 Agents', subtitle: 'GDD, Style Bible, Event Bus & Prompt Generator', section: 'director' },
      { title: 'Live 3D & Qolbu v13 Sandbox', subtitle: 'Playable Three.js Sanctuary, 12 Layers & 9 Larangan Mutlak', section: 'sandbox' },
      { title: 'State Machine, Logic QA & Tickets', subtitle: 'Visual FSM, Asset Error Guard & Issue Tracker', section: 'statemachine' },
      { title: 'AI Director, Voice Live & 3D Mesh Forge', subtitle: 'Gemini Chat, Live Voice, TTS, Foley & .OBJ/.GLTF', section: 'media' },
      { title: 'GitHub 33×10 Ecosystem Directory', subtitle: '330 Open-Source Connectors across 33 keywords', section: 'github' },
      { title: 'Build Telemetry, PDF & APK Release', subtitle: 'Custom Charts, PDF Report & Itel A70 Gradle/Kotlin Pack', section: 'telemetry' },
      { title: 'Cloud Sync, VCS & Live Ops', subtitle: 'Cloud SQL, Branches/Commits & DAU Analytics', section: 'collab' },
    ];

    AAA_DEPARTMENTS_18.forEach((d) =>
      entries.push({ title: d.role, subtitle: `${d.department} · ${d.skills.join(', ')}`, section: 'director' })
    );
    QOLBU_12_LAYERS.forEach((l) =>
      l.systems.forEach((s) =>
        entries.push({ title: `${s.code} ${s.name}`, subtitle: `${l.title} · ${s.itelBudget}`, section: 'sandbox' })
      )
    );
    GITHUB_33_KEYWORDS.forEach((kw) =>
      entries.push({ title: `GitHub Top 10: #${kw}`, subtitle: 'Open-Source Connector Catalog', section: 'github' })
    );
    tickets.forEach((t) =>
      entries.push({ title: `Ticket: ${t.title}`, subtitle: `${t.department} · ${t.status}`, section: 'statemachine' })
    );

    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 14);
    return entries
      .filter(
        (e) =>
          e.title.toLowerCase().includes(needle) ||
          e.subtitle.toLowerCase().includes(needle)
      )
      .slice(0, 18);
  }, [q, tickets]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 pt-20 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-amber-500" />
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Quick search menus, 18 agents, Qolbu systems, GitHub keywords, tickets..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Search"
            className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onNavigate(item.section);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-amber-500/10"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{item.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onJumpToSandbox: () => void;
}

const GUIDE_STEPS = [
  {
    title: '1. Describe Your Game in Plain Language',
    body: 'Enter any idea in the Studio Director prompt box. All 18 AAA departments synchronize your GDD, Style Bible, and State Machine automatically.',
  },
  {
    title: '2. Play & Inspect in the Live 3D Sandbox',
    body: 'Switch to the 3D Sandbox tab to test movement, dash-parry combat, AI decimation (15Hz), and Qolbu Engine v13.0 budgets tailored for Itel A70.',
  },
  {
    title: '3. Verify State Machine, Logic Tests & Tickets',
    body: 'Validate script transitions visually, auto-repair malformed mesh assets, run 2,000 adversarial security checks, and track team tickets.',
  },
  {
    title: '4. Export PDF Reports & Android APK Packs',
    body: 'Download automated PDF build reports, Gradle/Kotlin Itel A70 release files, PWA bundles, and sync your workspace to Cloud SQL anytime.',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onClose,
  onJumpToSandbox,
}) => {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const current = GUIDE_STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-amber-600 dark:text-amber-400">
            <Compass className="h-4 w-4" />
            Studio Quickstart Guide ({step + 1}/{GUIDE_STEPS.length})
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Skip Guide
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {current.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {current.body}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5">
            {GUIDE_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Guide step ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-amber-500' : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="h-9 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Back
              </button>
            )}
            {step < GUIDE_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="h-9 rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onJumpToSandbox();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Check className="h-3.5 w-3.5" />
                Launch 3D Sandbox
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: StudioNotification[];
  onMarkAllRead: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
      <div className="w-full max-w-md h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
        <div className="space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
              <Bell className="h-4 w-4 text-amber-500" />
              Push & Build Alert Center
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Notifications"
              className="rounded-lg p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-3 text-xs space-y-1 ${
                  n.severity === 'error'
                    ? 'border-rose-500/40 bg-rose-500/10'
                    : n.severity === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px] uppercase">
                  <span className="text-amber-600 dark:text-amber-400">{n.channel}</span>
                  <span className="text-slate-500">{n.timestamp}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">{n.title}</div>
                <div className="text-slate-600 dark:text-slate-300">{n.body}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onMarkAllRead}
          className="mt-4 h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Mark All Notifications Read
        </button>
      </div>
    </div>
  );
};
