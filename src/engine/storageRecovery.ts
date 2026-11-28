import { computeCrc32 } from './assetAtlas';
import { buildProjectFromPrompt, runAll18AgentsPipeline, synthesizeRuntimeConfig } from './studioPipeline';
import type {
  BuildRecordItem,
  CommitItem,
  PreBuildAssetInput,
  ProjectionMode,
  StudioProjectState,
  TicketItem,
} from './types';

export const WORKSPACE_STORAGE_KEY = 'mungil_v13_workspace_v2';
export const WORKSPACE_BACKUP_KEY = 'mungil_v13_workspace_recovery_v2';
export const WORKSPACE_LEGACY_KEY = 'mungil_v13_workspace_v1';
export const WORKSPACE_SCHEMA_VERSION = 2;
export const MAX_IMPORT_JSON_BYTES = 2 * 1024 * 1024;

export interface WorkspaceSnapshotPayload {
  project: StudioProjectState;
  builds: BuildRecordItem[];
  tickets: TicketItem[];
  commits: CommitItem[];
  importedAssets: PreBuildAssetInput[];
  projectionMode: ProjectionMode;
}

export interface VersionedWorkspaceEnvelope {
  schemaVersion: number;
  checksumCrc32: string;
  savedAt: string;
  payload: WorkspaceSnapshotPayload;
}

export interface WorkspaceLoadResult {
  snapshot: WorkspaceSnapshotPayload | null;
  recoveredFromBackup: boolean;
  migratedFromVersion: number | null;
  warning: string | null;
}

export interface JsonImportValidationResult {
  ok: boolean;
  project: StudioProjectState | null;
  error: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VALID_PROJECTIONS = new Set<ProjectionMode>(['3d_pbr', '2.5d_isometric', '2d_flat', 'pseudo_3d']);
const VALID_SCALES = new Set(['pentatonic', 'cyber_minor', 'heroic_major', 'tension_phrygian']);

export function normalizeHexColor(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : fallback;
}

function clampFinite(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function computeSnapshotChecksum(payload: WorkspaceSnapshotPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return computeCrc32(bytes).toString(16).padStart(8, '0').toUpperCase();
}

export function sanitizeProjectState(raw: unknown): StudioProjectState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<StudioProjectState>;
  if (!candidate.brief || typeof candidate.brief.title !== 'string' || !candidate.brief.title.trim()) {
    return null;
  }
  if (!candidate.gdd || !candidate.stateMachine || !Array.isArray(candidate.stateMachine.nodes)) {
    return null;
  }

  const prompt = String(candidate.brief.prompt || candidate.brief.title).trim().slice(0, 2400);
  const title = candidate.brief.title.trim().slice(0, 120);
  const adoptedRepos = Array.isArray(candidate.adoptedRepos)
    ? candidate.adoptedRepos.filter((r): r is string => typeof r === 'string').slice(0, 64)
    : [];

  const baseline = buildProjectFromPrompt(prompt, title, adoptedRepos);
  const rawStyle = candidate.styleBible ?? baseline.styleBible;
  const safeStyleBible = {
    visualThesis: String(rawStyle.visualThesis || baseline.styleBible.visualThesis).slice(0, 800),
    lightingRig: String(rawStyle.lightingRig || baseline.styleBible.lightingRig).slice(0, 400),
    palette: Array.isArray(rawStyle.palette) && rawStyle.palette.length >= 3
      ? rawStyle.palette.slice(0, 8).map((p, idx) => ({
          role: String(p?.role || baseline.styleBible.palette[idx % baseline.styleBible.palette.length].role).slice(0, 40),
          hex: normalizeHexColor(p?.hex, baseline.styleBible.palette[idx % baseline.styleBible.palette.length].hex),
          usage: String(p?.usage || 'Surface').slice(0, 120),
        }))
      : baseline.styleBible.palette,
    materialRules: Array.isArray(rawStyle.materialRules)
      ? rawStyle.materialRules.map((x) => String(x).slice(0, 200)).slice(0, 10)
      : baseline.styleBible.materialRules,
    silhouetteRules: Array.isArray(rawStyle.silhouetteRules)
      ? rawStyle.silhouetteRules.map((x) => String(x).slice(0, 200)).slice(0, 10)
      : baseline.styleBible.silhouetteRules,
    avoidList: Array.isArray(rawStyle.avoidList)
      ? rawStyle.avoidList.map((x) => String(x).slice(0, 200)).slice(0, 10)
      : baseline.styleBible.avoidList,
  };

  const rawCfg = candidate.runtimeConfig;
  const synthesized = synthesizeRuntimeConfig(prompt, baseline.brief, safeStyleBible, adoptedRepos);
  const safeCfg = rawCfg
    ? {
        ...synthesized,
        projectionMode: VALID_PROJECTIONS.has(rawCfg.projectionMode)
          ? rawCfg.projectionMode
          : synthesized.projectionMode,
        skyHex: normalizeHexColor(rawCfg.skyHex, synthesized.skyHex),
        groundHex: normalizeHexColor(rawCfg.groundHex, synthesized.groundHex),
        accentHex: normalizeHexColor(rawCfg.accentHex, synthesized.accentHex),
        hazardHex: normalizeHexColor(rawCfg.hazardHex, synthesized.hazardHex),
        nominalHex: normalizeHexColor(rawCfg.nominalHex, synthesized.nominalHex),
        moveSpeed: clampFinite(rawCfg.moveSpeed, 4, 15, synthesized.moveSpeed),
        jumpForce: clampFinite(rawCfg.jumpForce, 6, 16, synthesized.jumpForce),
        gravity: clampFinite(rawCfg.gravity, 12, 34, synthesized.gravity),
        enemySpeed: clampFinite(rawCfg.enemySpeed, 1.5, 8, synthesized.enemySpeed),
        shardCount: Math.round(clampFinite(rawCfg.shardCount, 3, 8, synthesized.shardCount)),
        fogDensity: clampFinite(rawCfg.fogDensity, 0.002, 0.04, synthesized.fogDensity),
        pillarScale: clampFinite(rawCfg.pillarScale, 0.6, 1.6, synthesized.pillarScale),
        sunWarmth: clampFinite(rawCfg.sunWarmth, 0.5, 1.8, synthesized.sunWarmth),
        audioTempoBpm: Math.round(clampFinite(rawCfg.audioTempoBpm, 64, 176, synthesized.audioTempoBpm)),
        audioScale: VALID_SCALES.has(rawCfg.audioScale) ? rawCfg.audioScale : synthesized.audioScale,
      }
    : synthesized;

  const safeProject: StudioProjectState = {
    ...baseline,
    ...(typeof candidate.dbId === 'number' && Number.isInteger(candidate.dbId) && candidate.dbId > 0
      ? { dbId: candidate.dbId }
      : {}),
    brief: {
      ...baseline.brief,
      title,
      prompt,
      genre: String(candidate.brief.genre || baseline.brief.genre).slice(0, 80),
      platform: String(candidate.brief.platform || baseline.brief.platform).slice(0, 100),
      targetDevice: String(candidate.brief.targetDevice || baseline.brief.targetDevice).slice(0, 100),
      artStyle: String(candidate.brief.artStyle || baseline.brief.artStyle).slice(0, 120),
      coreLoop: String(candidate.brief.coreLoop || baseline.brief.coreLoop).slice(0, 280),
      audience: String(candidate.brief.audience || baseline.brief.audience).slice(0, 160),
    },
    gdd: {
      highConcept: String(candidate.gdd.highConcept || baseline.gdd.highConcept).slice(0, 800),
      pillars: Array.isArray(candidate.gdd.pillars) && candidate.gdd.pillars.length
        ? candidate.gdd.pillars.map((p) => String(p).slice(0, 160)).slice(0, 6)
        : baseline.gdd.pillars,
      playerVerbs: Array.isArray(candidate.gdd.playerVerbs) && candidate.gdd.playerVerbs.length
        ? candidate.gdd.playerVerbs.map((p) => String(p).slice(0, 80)).slice(0, 10)
        : baseline.gdd.playerVerbs,
      progressionLoop: Array.isArray(candidate.gdd.progressionLoop) && candidate.gdd.progressionLoop.length
        ? candidate.gdd.progressionLoop.map((p) => String(p).slice(0, 200)).slice(0, 8)
        : baseline.gdd.progressionLoop,
      verticalSliceScope: Array.isArray(candidate.gdd.verticalSliceScope) && candidate.gdd.verticalSliceScope.length
        ? candidate.gdd.verticalSliceScope.map((p) => String(p).slice(0, 200)).slice(0, 8)
        : baseline.gdd.verticalSliceScope,
      monetizationAndFairness: String(
        candidate.gdd.monetizationAndFairness || baseline.gdd.monetizationAndFairness
      ).slice(0, 400),
      risks: Array.isArray(candidate.gdd.risks)
        ? candidate.gdd.risks.slice(0, 6).map((r) => ({
            title: String(r?.title || 'Risk').slice(0, 120),
            mitigation: String(r?.mitigation || 'Mitigated').slice(0, 200),
          }))
        : baseline.gdd.risks,
    },
    styleBible: safeStyleBible,
    runtimeConfig: safeCfg,
    stateMachine: candidate.stateMachine.nodes.length >= 2 ? candidate.stateMachine : baseline.stateMachine,
    adoptedRepos,
    activeBranch: String(candidate.activeBranch || 'main').replace(/[^\w./-]/g, '').slice(0, 48) || 'main',
  };

  return runAll18AgentsPipeline(safeProject, 24, 187.4);
}

export function validateAndMigrateImportedProjectJson(rawText: string): JsonImportValidationResult {
  if (!rawText || typeof rawText !== 'string') {
    return { ok: false, project: null, error: 'Empty project file.' };
  }
  if (rawText.length > MAX_IMPORT_JSON_BYTES) {
    return { ok: false, project: null, error: 'Project JSON exceeds 2 MB safety limit.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, project: null, error: 'Malformed JSON syntax in imported project file.' };
  }

  // Unwrap v2 workspace envelope if user imports a saved snapshot directly
  const candidate =
    parsed && typeof parsed === 'object' && 'payload' in parsed && (parsed as VersionedWorkspaceEnvelope).payload?.project
      ? (parsed as VersionedWorkspaceEnvelope).payload.project
      : parsed;

  const sanitized = sanitizeProjectState(candidate);
  if (!sanitized) {
    return {
      ok: false,
      project: null,
      error: 'Invalid project schema: requires brief.title, gdd, and stateMachine.nodes.',
    };
  }
  return { ok: true, project: sanitized, error: null };
}

function normalizeSnapshotPayload(raw: unknown): WorkspaceSnapshotPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<WorkspaceSnapshotPayload>;
  const project = sanitizeProjectState(obj.project);
  if (!project) return null;

  const projectionMode = VALID_PROJECTIONS.has(obj.projectionMode as ProjectionMode)
    ? (obj.projectionMode as ProjectionMode)
    : project.runtimeConfig.projectionMode;

  const builds = Array.isArray(obj.builds) ? obj.builds.slice(0, 40) : [];
  const tickets = Array.isArray(obj.tickets) ? obj.tickets.slice(0, 60) : [];
  const commits = Array.isArray(obj.commits) ? obj.commits.slice(0, 40) : [];
  const importedAssets = Array.isArray(obj.importedAssets) ? obj.importedAssets.slice(0, 40) : [];

  return {
    project,
    builds,
    tickets,
    commits,
    importedAssets,
    projectionMode,
  };
}

export function saveStudioWorkspaceSnapshot(
  storage: StorageLike | null | undefined,
  payload: WorkspaceSnapshotPayload
): { ok: boolean; checksumCrc32: string } {
  const checksumCrc32 = computeSnapshotChecksum(payload);
  if (!storage) return { ok: false, checksumCrc32 };

  const envelope: VersionedWorkspaceEnvelope = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    checksumCrc32,
    savedAt: new Date().toISOString(),
    payload,
  };

  try {
    // Rotate last valid primary snapshot into backup recovery slot before overwriting
    const previousRaw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (previousRaw) {
      try {
        const prevEnv = JSON.parse(previousRaw) as VersionedWorkspaceEnvelope;
        if (
          prevEnv?.schemaVersion === WORKSPACE_SCHEMA_VERSION &&
          prevEnv.payload &&
          computeSnapshotChecksum(prevEnv.payload) === prevEnv.checksumCrc32
        ) {
          storage.setItem(WORKSPACE_BACKUP_KEY, previousRaw);
        }
      } catch {
        // Do not overwrite good backup with corrupted primary
      }
    }
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(envelope));
    return { ok: true, checksumCrc32 };
  } catch {
    return { ok: false, checksumCrc32 };
  }
}

function tryReadEnvelope(raw: string | null): {
  valid: boolean;
  snapshot: WorkspaceSnapshotPayload | null;
  migratedFrom: number | null;
} {
  if (!raw) return { valid: false, snapshot: null, migratedFrom: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, snapshot: null, migratedFrom: null };
  }

  if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed) {
    const env = parsed as Partial<VersionedWorkspaceEnvelope>;
    if (env.schemaVersion === WORKSPACE_SCHEMA_VERSION && env.payload) {
      const actualCrc = computeSnapshotChecksum(env.payload);
      if (actualCrc !== env.checksumCrc32) {
        return { valid: false, snapshot: null, migratedFrom: null };
      }
      const normalized = normalizeSnapshotPayload(env.payload);
      return { valid: Boolean(normalized), snapshot: normalized, migratedFrom: null };
    }
    if (env.schemaVersion === 1 && env.payload) {
      const normalized = normalizeSnapshotPayload(env.payload);
      return { valid: Boolean(normalized), snapshot: normalized, migratedFrom: 1 };
    }
  }

  // Legacy unversioned snapshot (v0)
  const legacyProject = sanitizeProjectState(parsed);
  if (legacyProject) {
    return {
      valid: true,
      snapshot: {
        project: legacyProject,
        builds: [],
        tickets: [],
        commits: [],
        importedAssets: [],
        projectionMode: legacyProject.runtimeConfig.projectionMode,
      },
      migratedFrom: 0,
    };
  }
  return { valid: false, snapshot: null, migratedFrom: null };
}

export function loadStudioWorkspaceSnapshot(storage: StorageLike | null | undefined): WorkspaceLoadResult {
  if (!storage) {
    return { snapshot: null, recoveredFromBackup: false, migratedFromVersion: null, warning: null };
  }

  const primaryRaw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (primaryRaw) {
    const primary = tryReadEnvelope(primaryRaw);
    if (primary.valid && primary.snapshot) {
      return {
        snapshot: primary.snapshot,
        recoveredFromBackup: false,
        migratedFromVersion: primary.migratedFrom,
        warning: null,
      };
    }
  }

  const backupRaw = storage.getItem(WORKSPACE_BACKUP_KEY);
  if (backupRaw) {
    const backup = tryReadEnvelope(backupRaw);
    if (backup.valid && backup.snapshot) {
      saveStudioWorkspaceSnapshot(storage, backup.snapshot);
      return {
        snapshot: backup.snapshot,
        recoveredFromBackup: true,
        migratedFromVersion: backup.migratedFrom,
        warning: primaryRaw
          ? 'Primary local save failed integrity checksum; automatically restored verified recovery snapshot.'
          : 'Restored studio workspace from backup recovery snapshot.',
      };
    }
  }

  const legacyRaw = storage.getItem(WORKSPACE_LEGACY_KEY);
  if (legacyRaw) {
    const legacy = tryReadEnvelope(legacyRaw);
    if (legacy.valid && legacy.snapshot) {
      saveStudioWorkspaceSnapshot(storage, legacy.snapshot);
      return {
        snapshot: legacy.snapshot,
        recoveredFromBackup: false,
        migratedFromVersion: legacy.migratedFrom ?? 1,
        warning: 'Migrated studio workspace from legacy v1 storage schema.',
      };
    }
  }

  if (primaryRaw) {
    return {
      snapshot: null,
      recoveredFromBackup: false,
      migratedFromVersion: null,
      warning: 'Stored local save was corrupted and no intact recovery snapshot was found; initialized clean project.',
    };
  }

  return { snapshot: null, recoveredFromBackup: false, migratedFromVersion: null, warning: null };
}
