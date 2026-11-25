import React, { useState } from 'react';
import {
  Activity,
  Cloud,
  GitBranch,
  GitCommitHorizontal,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CommitItem, PostLaunchMetricPoint } from '../engine/types';

interface CollabLiveOpsPanelProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onCloudSync: () => Promise<void>;
  cloudSyncStatus: string;
  activeBranch: string;
  onSwitchBranch: (branch: string) => void;
  commits: CommitItem[];
  onCreateCommit: (message: string, diffSummary: string) => void;
  liveOpsMetrics: PostLaunchMetricPoint[];
}

export const CollabLiveOpsPanel: React.FC<CollabLiveOpsPanelProps> = ({
  user,
  onSignIn,
  onSignOut,
  onCloudSync,
  cloudSyncStatus,
  activeBranch,
  onSwitchBranch,
  commits,
  onCreateCommit,
  liveOpsMetrics,
}) => {
  const [commitMsg, setCommitMsg] = useState('');
  const [commitDiff, setCommitDiff] = useState('Synced FSM transitions & Itel A70 ASTC textures');
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;
    onCreateCommit(commitMsg.trim(), commitDiff.trim() || 'Updated studio snapshot');
    setCommitMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Cloud SQL Sync & Team Presence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase text-amber-600 dark:text-amber-400">
                Cloud SQL + Firebase Auth
              </p>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Cross-Device Cloud Storage Sync
              </h2>
            </div>
            <Cloud className="h-5 w-5 text-sky-500" />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
            {!avatarFailed ? (
              <img
                src={user?.photoURL || '/src/assets/images/avatar_director_1795556968825.jpg'}
                alt="Studio Lead Avatar"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-11 w-11 rounded-full object-cover border border-slate-300 dark:border-slate-700"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm">
                {(user?.displayName || 'SL').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white truncate">
                {user ? user.displayName || user.email : 'Local Studio Workspace'}
              </div>
              <div className="text-slate-500 dark:text-slate-400 truncate">
                {user ? `${user.email} · Cloud SQL Active` : 'Sign in with Google to sync projects, builds & tickets to Cloud SQL'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => void onCloudSync()}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  Sync Project to Cloud SQL
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In with Google for Cloud Sync
              </button>
            )}
          </div>
          <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{cloudSyncStatus}</div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              Active Studio Disciplines Online
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div>Creative Director · GDD</div>
              <div>Engine Architect · SoA</div>
              <div>Tech Artist · LOD0</div>
              <div>Itel A70 QA · Fuzzing</div>
            </div>
          </div>
        </div>

        {/* Integrated VCS */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-amber-500" />
                Integrated Version Control (VCS)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Branch switching, snapshot commits & script diff tracking
              </p>
            </div>
            <select
              aria-label="Active VCS Branch"
              value={activeBranch}
              onChange={(e) => onSwitchBranch(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 font-mono text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="main">branch: main</option>
              <option value="itel-a70-opt">branch: itel-a70-opt</option>
              <option value="feature/fsm-v2">branch: feature/fsm-v2</option>
            </select>
          </div>

          <form onSubmit={handleCommit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message (e.g., Lock 30Hz particle pool)"
              className="sm:col-span-5 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={commitDiff}
              onChange={(e) => setCommitDiff(e.target.value)}
              placeholder="Diff summary"
              className="sm:col-span-5 h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="sm:col-span-2 inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 text-xs font-semibold text-white dark:text-slate-900"
            >
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              Commit
            </button>
          </form>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {commits.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{c.message}</div>
                  <div className="font-mono text-[11px] text-slate-500 mt-0.5">{c.diffSummary}</div>
                </div>
                <div className="font-mono text-[11px] text-right whitespace-nowrap shrink-0 text-amber-600 dark:text-amber-400">
                  {c.branch} · {c.hash}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post-Launch Live Ops Analytics */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              Post-Launch Live Ops & Device Fleet Telemetry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily Active Users, Crash-Free Rate, Average Itel A70 FPS, and Retention Cohort
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium">DAU</th>
                <th className="py-2 pr-3 font-medium">Crash Rate</th>
                <th className="py-2 pr-3 font-medium">Itel A70 Avg FPS</th>
                <th className="py-2 font-medium text-right">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
              {liveOpsMetrics.map((m) => (
                <tr key={m.dayLabel}>
                  <td className="py-2.5 pr-3 text-slate-900 dark:text-slate-100">{m.dayLabel}</td>
                  <td className="py-2.5 pr-3 text-sky-600 dark:text-sky-400">{m.dau.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-emerald-600 dark:text-emerald-400">{m.crashRate.toFixed(2)}%</td>
                  <td className="py-2.5 pr-3 text-amber-600 dark:text-amber-400">{m.avgFps.toFixed(1)} FPS</td>
                  <td className="py-2.5 text-right text-slate-800 dark:text-slate-200">{m.retentionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
