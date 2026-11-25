export type StudioSectionId =
  | 'director'
  | 'sandbox'
  | 'statemachine'
  | 'media'
  | 'github'
  | 'telemetry'
  | 'collab';

export type CameraPreset3D = 'third_person' | 'isometric' | 'first_person' | 'orbit';
export type ProjectionMode = '3d_pbr' | '2.5d_isometric' | '2d_flat' | 'pseudo_3d';
export type QualityPresetId = 'itel_a70_eco' | 'hd_stylized' | 'ultra_pbr';
export type GameRunStatus = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export interface LiveTelemetrySnapshot {
  fps: number;
  cpuMs: number;
  gpuMs: number;
  drawCalls: number;
  triangles: number;
  memoryMb: number;
  texturesMb: number;
  meshesMb: number;
  audioMb: number;
  runtimeMb: number;
}

export interface StudioBrief {
  title: string;
  prompt: string;
  genre: string;
  platform: string;
  targetDevice: string;
  artStyle: string;
  coreLoop: string;
  audience: string;
}

export interface GddSection {
  highConcept: string;
  pillars: string[];
  playerVerbs: string[];
  progressionLoop: string[];
  verticalSliceScope: string[];
  monetizationAndFairness: string;
  risks: Array<{ title: string; mitigation: string }>;
}

export interface StyleBibleSpec {
  visualThesis: string;
  palette: Array<{ role: string; hex: string; usage: string }>;
  materialRules: string[];
  lightingRig: string;
  silhouetteRules: string[];
  avoidList: string[];
}

export type AgentExecutionStatus = 'idle' | 'queued' | 'running' | 'synced' | 'verified';

export type StudioTriadRole = 'Creative Director' | 'Art Lead' | 'Lead Engineer' | 'Specialist';

export interface StudioAgentNode {
  id: string;
  role: string;
  triadRole?: StudioTriadRole;
  department: string;
  skills: string[];
  githubDna?: string[];
  dependsOn: string[];
  status: AgentExecutionStatus;
  latencyMs: number;
  deliverableSummary: string;
  qaCheck: string;
  approved: boolean;
}

export interface EventBusMessage {
  id: string;
  timestamp: string;
  fromAgent: string;
  toTopic: string;
  channel?: 'directive' | 'validation' | 'error' | 'feedback';
  ack?: boolean;
  payload: string;
  round: number;
}

export interface StateMachineNode {
  id: string;
  name: string;
  scriptHook: string;
  onEnter: string;
  onUpdate: string;
  isInitial?: boolean;
  x: number;
  y: number;
}

export interface StateMachineTransition {
  id: string;
  from: string;
  to: string;
  trigger: string;
  guardExpr: string;
  blendMs: number;
}

export interface StateMachineSpec {
  name: string;
  nodes: StateMachineNode[];
  transitions: StateMachineTransition[];
}

export interface StateMachineValidationReport {
  valid: boolean;
  reachableStates: string[];
  unreachableStates: string[];
  danglingTransitions: string[];
  deadEndStates: string[];
  warnings: string[];
}

export interface AutomatedTestCaseResult {
  id: string;
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  detail: string;
}

export interface AssetCompileCheck {
  assetName: string;
  kind: 'mesh' | 'texture' | 'audio' | 'shader' | 'script';
  sizeKb: number;
  status: 'ok' | 'recovered' | 'blocked';
  message: string;
}

export interface PreBuildAssetInput {
  name: string;
  kind: 'mesh' | 'texture' | 'audio';
  drawCalls: number;
  texelDensityPxPerM: number;
  tris?: number;
  sizeKb: number;
  hasNaN?: boolean;
}

export interface FlaggedAssetIssue {
  assetName: string;
  kind: PreBuildAssetInput['kind'];
  severity: 'warning' | 'error';
  reason: string;
  remediation: string;
  drawCalls: number;
  texelDensityPxPerM: number;
}

export interface PreBuildAssetValidationReport {
  passed: boolean;
  totalAssets: number;
  totalDrawCalls: number;
  maxDrawCallsAllowed: number;
  flaggedAssets: FlaggedAssetIssue[];
  summary: string;
  checkedAt: string;
}

export interface QolbuSystemEntry {
  code: string;
  name: string;
  features: string;
  reason: string;
  itelBudget: string;
}

export interface QolbuLayerSpec {
  layerIndex: number;
  title: string;
  subtitle: string;
  systems: QolbuSystemEntry[];
  moduleCount: number;
}

export interface QolbuStageResult {
  stage: number;
  name: string;
  metric: string;
  target: string;
  passed: boolean;
}

export interface QolbuAuditReport {
  maxEntities: number;
  particlePoolSize: number;
  audioPoolSize: number;
  memoryBudgetMb: number;
  frameBudgetMs: number;
  aiHz: number;
  fuzzEventsTested: number;
  fuzzBlockedCount: number;
  stages: QolbuStageResult[];
  allPassed: boolean;
}

export interface BuildRecordItem {
  id: string;
  versionTag: string;
  status: 'passed' | 'failed' | 'warning';
  targetPlatform: string;
  cpuMs: number;
  gpuMs: number;
  drawCalls: number;
  memoryMb: number;
  fpsAvg: number;
  errorSummary: string;
  logText: string;
  createdAt: string;
}

export interface TicketItem {
  id: string;
  title: string;
  department: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  assignee: string;
  createdAt: string;
}

export interface CommitItem {
  id: string;
  branch: string;
  hash: string;
  author: string;
  message: string;
  diffSummary: string;
  createdAt: string;
}

export interface PostLaunchMetricPoint {
  dayLabel: string;
  dau: number;
  crashRate: number;
  avgFps: number;
  retentionPct: number;
}

export interface StudioNotification {
  id: string;
  channel: 'push' | 'email' | 'build';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

export interface GitHubRepoEntry {
  rank: number;
  repo: string;
  url: string;
  license: string;
  starsLabel: string;
  description: string;
  dnaIntegration: string;
  adopted?: boolean;
}

export interface GitHubKeywordGroup {
  keyword: string;
  category: string;
  repos: GitHubRepoEntry[];
}

export type AudioScaleId = 'pentatonic' | 'cyber_minor' | 'heroic_major' | 'tension_phrygian';

export interface GameRuntimeConfig {
  projectionMode: ProjectionMode;
  skyHex: string;
  groundHex: string;
  accentHex: string;
  hazardHex: string;
  nominalHex: string;
  moveSpeed: number;
  jumpForce: number;
  gravity: number;
  enemySpeed: number;
  shardCount: number;
  fogDensity: number;
  pillarScale: number;
  sunWarmth: number;
  audioTempoBpm: number;
  audioScale: AudioScaleId;
  mechanicsTags: string[];
  activeDnaSummary: string[];
}

export interface AtlasTileSpec {
  id: string;
  label: string;
  u: number;
  v: number;
  w: number;
  h: number;
  hex: string;
  roughness: number;
}

export type CoreAgentFlagshipId = 'gdd_writer' | 'asset_generator' | 'code_architect' | 'qa_tester';

export interface OrchestrationStageSummary {
  id: CoreAgentFlagshipId;
  name: string;
  mappedDepartments: string[];
  status: 'idle' | 'passed' | 'healed';
  summary: string;
  iteration: number;
}

export interface OrchestrationFeedbackTrace {
  converged: boolean;
  roundsExecuted: number;
  autoHealedIssues: string[];
  stages: OrchestrationStageSummary[];
}

export interface ServerHealthStatus {
  ok: boolean;
  engine: string;
  aiConfigured: boolean;
  latencyMs: number;
  checkedAt: string;
}

export interface InGameSettings {
  bgmVolume: number;
  sfxVolume: number;
  reduceScreenShake: boolean;
  showControlHints: boolean;
}

export interface StudioProjectState {
  dbId?: number;
  brief: StudioBrief;
  gdd: GddSection;
  styleBible: StyleBibleSpec;
  runtimeConfig: GameRuntimeConfig;
  agents: StudioAgentNode[];
  eventBus: EventBusMessage[];
  stateMachine: StateMachineSpec;
  techDocsMd: string;
  adoptedRepos: string[];
  activeBranch: string;
  orchestration?: OrchestrationFeedbackTrace;
}

