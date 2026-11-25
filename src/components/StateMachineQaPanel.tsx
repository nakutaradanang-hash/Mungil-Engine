import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Play,
  Plus,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { runQolbu8StageAudit } from '../engine/qolbuCore';
import {
  runAssetCompilationGuard,
  runAutomatedLogicTests,
  stepStateMachine,
  validateStateMachine,
} from '../engine/stateMachine';
import type {
  AutomatedTestCaseResult,
  StateMachineSpec,
  TicketItem,
} from '../engine/types';

interface StateMachineQaPanelProps {
  stateMachine: StateMachineSpec;
  activeFsmState: string;
  onTriggerFsm: (trigger: string) => void;
  onUpdateStateMachine: (next: StateMachineSpec) => void;
  tickets: TicketItem[];
  onCreateTicket: (ticket: Omit<TicketItem, 'id' | 'createdAt'>) => void;
  onUpdateTicketStatus: (id: string, status: TicketItem['status']) => void;
  drawCalls: number;
  memoryMb: number;
}

export const StateMachineQaPanel: React.FC<StateMachineQaPanelProps> = ({
  stateMachine,
  activeFsmState,
  onTriggerFsm,
  onUpdateStateMachine,
  tickets,
  onCreateTicket,
  onUpdateTicketStatus,
  drawCalls,
  memoryMb,
}) => {
  const [lastStepMsg, setLastStepMsg] = useState('FSM synchronized and ready for script transitions.');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeHook, setNewNodeHook] = useState('onCustomState()');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDept, setTicketDept] = useState('Gameplay Engineering');
  const [ticketPriority, setTicketPriority] = useState<TicketItem['priority']>('high');
  const [testRunNonce, setTestRunNonce] = useState(0);

  const validation = useMemo(() => validateStateMachine(stateMachine), [stateMachine]);

  const logicTests: AutomatedTestCaseResult[] = useMemo(
    () => runAutomatedLogicTests(stateMachine, drawCalls, memoryMb),
    [stateMachine, drawCalls, memoryMb, testRunNonce]
  );

  const audit8 = useMemo(
    () => runQolbu8StageAudit(drawCalls, memoryMb),
    [drawCalls, memoryMb, testRunNonce]
  );

  const assetGuard = useMemo(
    () =>
      runAssetCompilationGuard([
        { name: 'hero_guardian_rig.gltf', kind: 'mesh', sizeKb: 420, tris: 4200 },
        { name: 'terrain_basalt_tile.astc', kind: 'texture', sizeKb: 1280 },
        { name: 'sanctuary_pillar_hi.fbx', kind: 'mesh', sizeKb: 6400, tris: 92000 },
        { name: 'guardian_cape_cloth.bin', kind: 'mesh', sizeKb: 310, hasNaN: true },
        { name: 'combat_stems_22khz.ogg', kind: 'audio', sizeKb: 1840 },
      ]),
    [testRunNonce]
  );

  const handleFireTrigger = (trigger: string) => {
    const res = stepStateMachine(stateMachine, activeFsmState, trigger);
    setLastStepMsg(res.reason);
    onTriggerFsm(trigger);
  };

  const handleAddState = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNodeName.trim();
    if (!clean) return;
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (stateMachine.nodes.some((n) => n.id === id)) return;
    const nextSpec: StateMachineSpec = {
      ...stateMachine,
      nodes: [
        ...stateMachine.nodes,
        {
          id,
          name: clean,
          scriptHook: newNodeHook.trim() || `on${clean.replace(/\s+/g, '')}()`,
          onEnter: 'Sync Context',
          onUpdate: 'Step Fixed 30Hz',
          x: 620,
          y: 120,
        },
      ],
      transitions: [
        ...stateMachine.transitions,
        {
          id: `t-${Date.now()}`,
          from: 'idle',
          to: id,
          trigger: `ENTER_${id.toUpperCase()}`,
          guardExpr: 'isValidMove(pos)',
          blendMs: 80,
        },
        {
          id: `t-${Date.now() + 1}`,
          from: id,
          to: 'idle',
          trigger: `EXIT_${id.toUpperCase()}`,
          guardExpr: 'true',
          blendMs: 80,
        },
      ],
    };
    onUpdateStateMachine(nextSpec);
    setNewNodeName('');
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) return;
    onCreateTicket({
      title: ticketTitle.trim(),
      department: ticketDept,
      priority: ticketPriority,
      status: 'open',
      assignee: 'QA & Automation Lead',
    });
    setTicketTitle('');
  };

  const availableTriggers = stateMachine.transitions.filter((t) => t.from === activeFsmState);

  return (
    <div className="space-y-6">
      {/* Interactive Visual State Machine Editor & Script Bridge */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-amber-600 dark:text-amber-400">
              Finite State Machine & Smooth Script Transition Guard
            </p>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              {stateMachine.name} — Active State: <span className="font-mono text-emerald-600 dark:text-emerald-400">{activeFsmState}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 font-semibold ${validation.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {validation.valid
                ? `${validation.reachableStates.length}/${stateMachine.nodes.length} Reachable · 0 Dangling`
                : validation.warnings[0]}
            </span>
          </div>
        </div>

        {/* SVG State Diagram */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
          <svg viewBox="0 0 760 270" className="w-full min-w-[620px] h-56">
            <defs>
              <marker id="fsmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
              </marker>
            </defs>

            {stateMachine.transitions.map((t) => {
              const from = stateMachine.nodes.find((n) => n.id === t.from);
              const to = stateMachine.nodes.find((n) => n.id === t.to);
              if (!from || !to) return null;
              const active = from.id === activeFsmState;
              return (
                <g key={t.id}>
                  <line
                    x1={from.x + 70}
                    y1={from.y + 28}
                    x2={to.x + 70}
                    y2={to.y + 28}
                    stroke={active ? '#f59e0b' : '#475569'}
                    strokeWidth={active ? 2.2 : 1.3}
                    strokeDasharray={active ? undefined : '4 3'}
                    markerEnd="url(#fsmArrow)"
                  />
                </g>
              );
            })}

            {stateMachine.nodes.map((node) => {
              const isActive = node.id === activeFsmState;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect
                    width="148"
                    height="56"
                    rx="10"
                    fill={isActive ? '#f59e0b' : '#1e293b'}
                    stroke={isActive ? '#fef3c7' : '#475569'}
                    strokeWidth={isActive ? 2.2 : 1.2}
                  />
                  <text
                    x="10"
                    y="22"
                    fontSize="11"
                    fontWeight="700"
                    fill={isActive ? '#0f172a' : '#f8fafc'}
                  >
                    {node.name.slice(0, 20)}
                  </text>
                  <text
                    x="10"
                    y="40"
                    fontSize="10"
                    fontFamily="monospace"
                    fill={isActive ? '#451a03' : '#94a3b8'}
                  >
                    {node.scriptHook}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Trigger Simulator + Add State */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fire Transition:</span>
            {availableTriggers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleFireTrigger(t.trigger)}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                <Play className="h-3 w-3" />
                {t.trigger} → {t.to} ({t.blendMs}ms)
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{lastStepMsg}</span>
        </div>

        <form onSubmit={handleAddState} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <input
            type="text"
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            placeholder="New State Name (e.g., Wall Climb)"
            className="h-9 w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={newNodeHook}
            onChange={(e) => setNewNodeHook(e.target.value)}
            placeholder="Script Hook"
            className="h-9 w-48 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add State & Auto-Link
          </button>
        </form>
      </div>

      {/* Automated Logic Tests + Asset Compilation Error Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Automated Logic & Qolbu 8-Stage Validation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Runs on every script or state change · {audit8.fuzzEventsTested} fuzz vectors verified
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestRunNonce((n) => n + 1)}
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Re-Run Suite
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logicTests.map((tc) => (
              <div key={tc.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {tc.suite}: {tc.name}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{tc.detail}</div>
                </div>
                <span className={`font-mono font-bold whitespace-nowrap shrink-0 ${tc.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {tc.passed ? 'PASS' : 'FAIL'} · {tc.durationMs}ms
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Asset Compilation Error Guard
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-recovers NaN normals & &gt;60K poly meshes before packaging
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-amber-600 dark:text-amber-400">
              {assetGuard.recoveredCount} auto-fixed · {assetGuard.fatalCount} blocked
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {assetGuard.checks.map((ck) => (
              <div key={ck.assetName} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {ck.assetName} <span className="text-slate-500">({ck.kind} · {ck.sizeKb} KB)</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{ck.message}</div>
                </div>
                <span
                  className={`font-mono uppercase font-bold whitespace-nowrap shrink-0 ${
                    ck.status === 'ok'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ck.status === 'recovered'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-500'
                  }`}
                >
                  <Wrench className="inline h-3 w-3 mr-1" />
                  {ck.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrated Ticket Tracking System */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Studio Issue & Ticket Tracking
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Syncs QA blockers, shader tickets & Itel A70 performance issues across teams
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {tickets.filter((t) => t.status !== 'resolved').length} open / {tickets.length} total
          </span>
        </div>

        <form onSubmit={handleTicketSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={ticketTitle}
            onChange={(e) => setTicketTitle(e.target.value)}
            placeholder="Describe bug or milestone task..."
            className="flex-1 min-w-[200px] h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
          />
          <select
            value={ticketDept}
            onChange={(e) => setTicketDept(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option>Gameplay Engineering</option>
            <option>3D / Asset Pipeline</option>
            <option>Performance & Itel A70</option>
            <option>Audio Engineering</option>
            <option>Quality Assurance</option>
          </select>
          <select
            value={ticketPriority}
            onChange={(e) => setTicketPriority(e.target.value as TicketItem['priority'])}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Log Ticket
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Department</th>
                <th className="py-2 pr-3 font-medium">Priority</th>
                <th className="py-2 pr-3 font-medium">Assignee</th>
                <th className="py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                  <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400">{t.department}</td>
                  <td className={`py-2.5 pr-3 font-mono uppercase ${t.priority === 'critical' ? 'text-rose-500' : t.priority === 'high' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {t.priority}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400">{t.assignee}</td>
                  <td className="py-2.5 text-right">
                    <select
                      aria-label={`Ticket status for ${t.title}`}
                      value={t.status}
                      onChange={(e) => onUpdateTicketStatus(t.id, e.target.value as TicketItem['status'])}
                      className="h-7 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200"
                    >
                      <option value="open">OPEN</option>
                      <option value="in_progress">IN PROGRESS</option>
                      <option value="resolved">RESOLVED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
