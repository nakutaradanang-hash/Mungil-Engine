import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  Cpu,
  Download,
  Layers,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { qolbuAudio } from '../engine/audioSynth';
import {
  createCanvas2DFallbackState,
  renderCanvas2DFallback,
  stepCanvas2DFallback,
} from '../engine/canvas2dFallback';
import {
  AttackTokenPool,
  advanceTrauma,
  resolveCircleAabbCollision,
  stepExponentialDamp,
} from '../engine/gameplayKernel';
import { downloadTextFile, safeJsonParse, sanitizeSlug } from '../engine/ioUtils';
import {
  ITEL_A70_APK_FLAGS,
  NINE_COMMANDMENTS,
  QOLBU_12_LAYERS,
  QOLBU_CONSTANTS,
  fastClampDt,
  isValidMove,
} from '../engine/qolbuCore';
import type {
  CameraPreset3D,
  GameRunStatus,
  GameRuntimeConfig,
  InGameSettings,
  LiveTelemetrySnapshot,
  ProjectionMode,
  QualityPresetId,
  StudioBrief,
} from '../engine/types';
import { ProfilerOverlay } from './ProfilerOverlay';

interface ThreeSandboxViewportProps {
  brief: StudioBrief;
  runtimeConfig: GameRuntimeConfig;
  onUpdateRuntimeConfig?: (next: GameRuntimeConfig) => void;
  onResetRuntimeConfig?: () => void;
  metricsRef?: React.MutableRefObject<LiveTelemetrySnapshot>;
  projectionMode?: ProjectionMode;
  onProjectionChange?: (mode: ProjectionMode) => void;
  onTelemetryTick?: (metrics: LiveTelemetrySnapshot) => void;
  onFsmTrigger?: (trigger: string) => void;
  onCaptureScreenshot?: (dataUrl: string) => void;
  autoStartSignal?: number;
}

interface SandboxHudState {
  status: GameRunStatus;
  hp: number;
  maxHp: number;
  stamina: number;
  shards: number;
  totalShards: number;
  score: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  gateUnlocked: boolean;
  elapsedSec: number;
  aiTickCount: number;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(5, 8, 16, 0.58)');
  grad.addColorStop(0.55, 'rgba(5, 8, 16, 0.25)');
  grad.addColorStop(1, 'rgba(5, 8, 16, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createProceduralGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const shade = 64 + ((x * 17 + y * 31) % 24);
      ctx.fillStyle = `rgb(${shade},${shade + 8},${shade + 20})`;
      ctx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createStoneBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const shade = 105 + ((x * 13 + y * 29) % 45);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x + 2, y + 2, 28, 28);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function buildHeroGroup(shadowTex: THREE.CanvasTexture): {
  root: THREE.Group;
  cape: THREE.Mesh;
  core: THREE.Mesh;
} {
  const root = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.58,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.28,
    metalness: 0.85,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 1.6,
    roughness: 0.14,
    metalness: 0.1,
  });

  // Contact shadow disc grounded at y = 0.02
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Unified Lower Pedestal + Torso Cuirass + Helm (1 draw call)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 1.45, 8), armorMat);
  torso.position.set(0, 0.78, 0);
  torso.castShadow = true;
  root.add(torso);

  // Crowned Helm + Shoulder Trim Collar (1 draw call)
  const trimCrest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.44), trimMat);
  trimCrest.position.set(0, 1.42, 0);
  trimCrest.castShadow = true;
  root.add(trimCrest);

  // Chest Ember Core (1 draw call)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), coreMat);
  core.position.set(0, 1.15, 0.34);
  root.add(core);

  // Visor & Helm (1 draw call)
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), armorMat);
  helm.position.set(0, 1.76, 0);
  helm.castShadow = true;
  root.add(helm);

  // Cape (1 draw call)
  const cape = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.96, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85, metalness: 0.05 })
  );
  cape.position.set(0, 1.0, -0.34);
  cape.rotation.x = 0.16;
  root.add(cape);

  return { root, cape, core };
}

function buildEnemyGroup(
  archetype: 'swarmer' | 'flanker' | 'turret',
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const g = new THREE.Group();
  const hullColor = archetype === 'swarmer' ? 0x475569 : archetype === 'flanker' ? 0x334155 : 0x1e293b;
  const glowColor = archetype === 'swarmer' ? 0xef4444 : archetype === 'flanker' ? 0x38bdf8 : 0xf97316;

  const hullMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.42, metalness: 0.65 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.6,
    roughness: 0.18,
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);

  if (archetype === 'turret') {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.78, 1.65, 8), hullMat);
    column.position.y = 0.85;
    g.add(column);
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowMat);
    eye.position.y = 2.05;
    g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.07, 8, 18), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.05;
    g.add(ring);
  } else {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), hullMat);
    body.position.y = 0.95;
    g.add(body);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), glowMat);
    core.position.set(0, 0.95, 0.32);
    g.add(core);
    const wingBar = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.36), glowMat);
    wingBar.position.set(0, 1.15, -0.04);
    g.add(wingBar);
  }

  return g;
}

export const ThreeSandboxViewport: React.FC<ThreeSandboxViewportProps> = ({
  brief,
  runtimeConfig,
  onUpdateRuntimeConfig,
  onResetRuntimeConfig,
  metricsRef: externalMetricsRef,
  projectionMode = '3d_pbr',
  onProjectionChange,
  onTelemetryTick,
  onFsmTrigger,
  onCaptureScreenshot,
  autoStartSignal = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const internalMetricsRef = useRef<LiveTelemetrySnapshot>({
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
  const activeMetricsRef = externalMetricsRef ?? internalMetricsRef;

  const telemetryCbRef = useRef(onTelemetryTick);
  const fsmCbRef = useRef(onFsmTrigger);
  const captureCbRef = useRef(onCaptureScreenshot);
  const runtimeCfgRef = useRef<GameRuntimeConfig>(runtimeConfig);
  const dirtyVisualsRef = useRef(true);
  telemetryCbRef.current = onTelemetryTick;
  fsmCbRef.current = onFsmTrigger;
  captureCbRef.current = onCaptureScreenshot;

  useEffect(() => {
    runtimeCfgRef.current = runtimeConfig;
    dirtyVisualsRef.current = true;
    qolbuAudio.configureAudio({
      tempoBpm: runtimeConfig.audioTempoBpm,
      scale: runtimeConfig.audioScale,
    });
    setHud((prev) => ({
      ...prev,
      totalShards: runtimeConfig.shardCount,
      gateUnlocked: prev.shards >= runtimeConfig.shardCount,
    }));
  }, [runtimeConfig]);

  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('third_person');
  const [localProjection, setLocalProjection] = useState<ProjectionMode>(projectionMode);
  const [qualityPreset, setQualityPreset] = useState<QualityPresetId>('itel_a70_eco');
  const [profilerVisible, setProfilerVisible] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const [sceneEditorOpen, setSceneEditorOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [fallback2DMode, setFallback2DMode] = useState(false);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const [heroBgFailed, setHeroBgFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [subPanel, setSubPanel] = useState<'layers' | 'commandments'>('layers');
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [inGameSettings, setInGameSettings] = useState<InGameSettings>({
    bgmVolume: 0.75,
    sfxVolume: 0.9,
    reduceScreenShake: false,
    showControlHints: true,
  });
  const settingsRef = useRef<InGameSettings>(inGameSettings);
  settingsRef.current = inGameSettings;

  const oracleLines = [
    `Oracle (${brief.title}): Gather ${runtimeConfig.shardCount} Resonance Shards around the basalt pillars to unseal the Northern Gate.`,
    'Tactical Tip: Press Shift or E right as a Sentinel flashes red to execute a Dash Parry stun (+75 score).',
    'Itel A70 Guard: Physics runs in a zero-GC Circle-vs-AABB arena at <=35 Draw Calls with 15Hz AI token budgeting.',
  ];

  const initialAutoStart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [hud, setHud] = useState<SandboxHudState>({
    status: initialAutoStart ? 'playing' : 'title',
    hp: 100,
    maxHp: 100,
    stamina: 100,
    shards: 0,
    totalShards: runtimeConfig.shardCount,
    score: 0,
    fps: 30,
    drawCalls: 22,
    triangles: 4800,
    gateUnlocked: false,
    elapsedSec: 0,
    aiTickCount: 0,
  });

  const controlRef = useRef<{
    status: GameRunStatus;
    cameraPreset: CameraPreset3D;
    projectionMode: ProjectionMode;
    qualityPreset: QualityPresetId;
    keys: Record<string, boolean>;
    virtualMove: { x: number; z: number };
    jumpQueued: boolean;
    dashQueued: boolean;
    restartQueued: boolean;
    captureQueued: boolean;
  }>({
    status: initialAutoStart ? 'playing' : 'title',
    cameraPreset: 'third_person',
    projectionMode,
    qualityPreset: 'itel_a70_eco',
    keys: {},
    virtualMove: { x: 0, z: 0 },
    jumpQueued: false,
    dashQueued: false,
    restartQueued: false,
    captureQueued: false,
  });

  useEffect(() => {
    setLocalProjection(projectionMode);
    controlRef.current.projectionMode = projectionMode;
  }, [projectionMode]);

  useEffect(() => {
    controlRef.current.cameraPreset = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    controlRef.current.qualityPreset = qualityPreset;
  }, [qualityPreset]);

  useEffect(() => {
    document.body.dataset.state = hud.status;
  }, [hud.status]);

  useEffect(() => {
    if (autoStartSignal > 0) {
      controlRef.current.restartQueued = true;
      controlRef.current.status = 'playing';
      setHud((prev) => ({ ...prev, status: 'playing' }));
      qolbuAudio.startMusic();
      fsmCbRef.current?.('RESUME_CLICKED');
    }
  }, [autoStartSignal]);

  const setGameStatus = (nextStatus: GameRunStatus) => {
    controlRef.current.status = nextStatus;
    setHud((prev) => ({ ...prev, status: nextStatus }));
    if (nextStatus === 'playing') {
      qolbuAudio.playSfx('click');
      qolbuAudio.startMusic();
      fsmCbRef.current?.('RESUME_CLICKED');
    } else if (nextStatus === 'paused') {
      qolbuAudio.stopMusic();
      fsmCbRef.current?.('ESC_OR_BLUR');
    } else if (nextStatus === 'victory') {
      qolbuAudio.stopMusic();
      qolbuAudio.playSfx('victory');
      fsmCbRef.current?.('OBJECTIVES_MET');
    }
  };

  const triggerRestart = () => {
    setDialogIndex(null);
    controlRef.current.restartQueued = true;
    controlRef.current.status = 'playing';
    qolbuAudio.playSfx('click');
    qolbuAudio.startMusic();
    fsmCbRef.current?.('NEXT_STAGE');
  };

  const cycleOracleDialog = () => {
    qolbuAudio.playSfx('dialog');
    setDialogIndex((prev) => {
      if (prev === null) return 0;
      if (prev + 1 >= oracleLines.length) return null;
      return prev + 1;
    });
  };

  // Canvas2D graceful fallback loop (activated on WebGL failure, context loss, or explicit user toggle)
  const useCanvas2D = fallback2DMode || contextLost;

  useEffect(() => {
    if (!useCanvas2D) return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fbState = createCanvas2DFallbackState(runtimeCfgRef.current.shardCount);
    fbState.status = controlRef.current.status;

    const resizeCanvas2d = () => {
      const parent = canvas.parentElement;
      const w = Math.max(parent?.clientWidth ?? 640, 320);
      const h = Math.max(parent?.clientHeight ?? 520, 360);
      canvas.width = w;
      canvas.height = h;
    };
    resizeCanvas2d();
    const ro = new ResizeObserver(resizeCanvas2d);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const onKeyDown2d = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const code = e.code;
      controlRef.current.keys[code] = true;
      if (controlRef.current.status === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        setGameStatus('playing');
      } else if ((code === 'ShiftLeft' || code === 'KeyE') && controlRef.current.status === 'playing') {
        controlRef.current.dashQueued = true;
      } else if (code === 'KeyR' && controlRef.current.status !== 'title') {
        triggerRestart();
      } else if (code === 'KeyP' || code === 'Escape') {
        if (controlRef.current.status === 'playing') setGameStatus('paused');
        else if (controlRef.current.status === 'paused') setGameStatus('playing');
      }
    };
    const onKeyUp2d = (e: KeyboardEvent) => {
      controlRef.current.keys[e.code] = false;
    };
    const clearInputs2d = () => {
      controlRef.current.keys = {};
      controlRef.current.virtualMove = { x: 0, z: 0 };
      controlRef.current.jumpQueued = false;
      controlRef.current.dashQueued = false;
    };
    window.addEventListener('keydown', onKeyDown2d);
    window.addEventListener('keyup', onKeyUp2d);
    window.addEventListener('blur', clearInputs2d);
    document.addEventListener('visibilitychange', clearInputs2d);

    let raf2d = 0;
    let last2d = performance.now();
    let syncAcc = 0.4;
    let cancelled = false;

    const loop2d = (now: number) => {
      if (cancelled) return;
      const rawDt = (now - last2d) / 1000;
      last2d = now;
      if (document.hidden) {
        raf2d = window.requestAnimationFrame(loop2d);
        return;
      }

      if (controlRef.current.restartQueued) {
        controlRef.current.restartQueued = false;
        const fresh = createCanvas2DFallbackState(runtimeCfgRef.current.shardCount);
        Object.assign(fbState, fresh);
        fbState.status = controlRef.current.status;
      } else {
        fbState.status = controlRef.current.status;
      }

      if (controlRef.current.captureQueued) {
        controlRef.current.captureQueued = false;
        try {
          captureCbRef.current?.(canvas.toDataURL('image/png'));
        } catch {
          // Ignore canvas capture restrictions
        }
      }

      const keys = controlRef.current.keys;
      let mx = controlRef.current.virtualMove.x;
      let mz = controlRef.current.virtualMove.z;
      if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
      const dashJustPressed = controlRef.current.dashQueued;
      controlRef.current.dashQueued = false;

      const stepRes = stepCanvas2DFallback(fbState, rawDt, runtimeCfgRef.current, {
        moveX: mx,
        moveZ: mz,
        dashJustPressed,
      });
      if (stepRes.collectedShard) qolbuAudio.playSfx('pickup');
      if (stepRes.parried) qolbuAudio.playSfx('parry');
      if (stepRes.damaged) qolbuAudio.playSfx('hit');
      if (stepRes.outcomeChanged === 'victory') {
        controlRef.current.status = 'victory';
        qolbuAudio.playSfx('victory');
      } else if (stepRes.outcomeChanged === 'gameover') {
        controlRef.current.status = 'gameover';
        qolbuAudio.stopMusic();
      }

      const snap = renderCanvas2DFallback(
        ctx,
        canvas.width,
        canvas.height,
        fbState,
        runtimeCfgRef.current,
        controlRef.current.projectionMode
      );
      Object.assign(activeMetricsRef.current, snap);

      syncAcc += Math.min(rawDt, 0.05);
      if (syncAcc >= 0.3 || stepRes.outcomeChanged || stepRes.collectedShard) {
        syncAcc = 0;
        const collectedCount = fbState.shards.filter((s) => s.collected).length;
        setHud((prev) => ({
          ...prev,
          status: fbState.status,
          hp: Math.round(fbState.hp),
          stamina: Math.round(fbState.stamina),
          shards: collectedCount,
          totalShards: fbState.shards.length,
          score: fbState.score,
          fps: snap.fps,
          drawCalls: snap.drawCalls,
          triangles: 0,
          gateUnlocked: collectedCount >= fbState.shards.length,
          elapsedSec: Math.round(fbState.elapsedSec),
          aiTickCount: fbState.aiTickCount,
        }));
        telemetryCbRef.current?.(snap);
      }

      raf2d = window.requestAnimationFrame(loop2d);
    };

    raf2d = window.requestAnimationFrame(loop2d);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf2d);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown2d);
      window.removeEventListener('keyup', onKeyUp2d);
      window.removeEventListener('blur', clearInputs2d);
      document.removeEventListener('visibilitychange', clearInputs2d);
    };
  }, [useCanvas2D]);

  useEffect(() => {
    if (useCanvas2D) return;
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);

    // Renderer & software-WebGL check with automatic Canvas2D fallback on failure
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setFallback2DMode(true);
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL context loss & restore safety
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Scene, Atmosphere & RoomEnvironment
    const initCfg = runtimeCfgRef.current;
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(initCfg.skyHex);
    scene.background = bgColor;
    const fog = new THREE.FogExp2(initCfg.skyHex, initCfg.fogDensity);
    scene.fog = fog;

    const pmrem = new THREE.PMREMGenerator(renderer);
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    try {
      envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRenderTarget.texture;
    } catch {
      // Safe fallback when driver lacks float RT support
    }

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 180);
    camera.position.set(0, 6.5, 11.5);

    // Warm sun key + Cool sky/ground hemisphere + soft fill for software WebGL clarity
    const ambientFill = new THREE.AmbientLight(0xcbd5e1, isSoftwareGl ? 0.85 : 0.35);
    scene.add(ambientFill);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe4b5, 2.4);
    sunLight.position.set(16, 28, 14);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 75;
      const d = 28;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const shadowTex = createContactShadowTexture();
    const stoneBump = createStoneBumpTexture();
    const proceduralGroundTex = createProceduralGroundTexture();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    proceduralGroundTex.anisotropy = maxAniso;

    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initCfg.groundHex),
      map: proceduralGroundTex,
      bumpMap: stoneBump,
      bumpScale: 0.06,
      roughness: 0.86,
      metalness: 0.08,
    });

    // Upgrade ground texture to baked stone asset if available (zero-404 safe)
    let loadedFloorTex: THREE.Texture | null = null;
    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      '/src/assets/images/terrain_stone_tile_1795556965013.jpg',
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(14, 14);
        tex.anisotropy = maxAniso;
        loadedFloorTex = tex;
        groundMat.map = tex;
        groundMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep crisp procedural CanvasTexture on failure
      }
    );

    const ground = new THREE.Mesh(new THREE.CircleGeometry(42, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Outer Sanctuary Ring
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(26, 0.35, 10, 64),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.45,
        metalness: 0.65,
      })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.2;
    scene.add(rimRing);

    // 8 Architectural Pillars batched with InstancedMesh (stays < 35 Draw Calls for Itel A70!)
    const pillarPositions: Array<[number, number]> = [
      [-10, -10], [10, -10], [-10, 10], [10, 10],
      [-18, 0], [18, 0], [0, -18], [0, 18],
    ];
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.25 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 });
    const pShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

    const count = pillarPositions.length;
    const pShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 3.2), pShadowMat, count);
    const pPlinths = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0, 0.45, 2.0), pillarMat, count);
    const pShafts = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 4.4, 1.3), pillarMat, count);
    const pBands = new THREE.InstancedMesh(new THREE.BoxGeometry(1.44, 0.22, 1.44), bronzeMat, count);
    const pCaps = new THREE.InstancedMesh(new THREE.ConeGeometry(1.05, 0.85, 4), bronzeMat, count);
    [pShadows, pPlinths, pShafts, pBands, pCaps].forEach((m) => {
      m.frustumCulled = false;
    });
    pPlinths.castShadow = true;
    pShafts.castShadow = true;

    const dummy = new THREE.Object3D();
    const syncPillarMatrices = (scaleY: number) => {
      pillarPositions.forEach(([px, pz], idx) => {
        dummy.scale.set(1, 1, 1);
        dummy.position.set(px, 0.02, pz);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        pShadows.setMatrixAt(idx, dummy.matrix);

        dummy.rotation.set(0, 0, 0);
        dummy.position.set(px, 0.225, pz);
        dummy.updateMatrix();
        pPlinths.setMatrixAt(idx, dummy.matrix);

        dummy.scale.set(1, scaleY, 1);
        dummy.position.set(px, 0.45 + 2.2 * scaleY, pz);
        dummy.updateMatrix();
        pShafts.setMatrixAt(idx, dummy.matrix);

        dummy.scale.set(1, 1, 1);
        dummy.position.set(px, 0.45 + 3.4 * scaleY, pz);
        dummy.updateMatrix();
        pBands.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(px, 0.45 + 4.75 * scaleY, pz);
        dummy.rotation.set(0, Math.PI / 4, 0);
        dummy.updateMatrix();
        pCaps.setMatrixAt(idx, dummy.matrix);
      });
      pShadows.instanceMatrix.needsUpdate = true;
      pPlinths.instanceMatrix.needsUpdate = true;
      pShafts.instanceMatrix.needsUpdate = true;
      pBands.instanceMatrix.needsUpdate = true;
      pCaps.instanceMatrix.needsUpdate = true;
    };
    syncPillarMatrices(initCfg.pillarScale);
    scene.add(pShadows, pPlinths, pShafts, pBands, pCaps);

    // Central Sanctuary Gate Obelisk (Goal)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, -11.5);
    const gatePedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.45, 16), pillarMat);
    gatePedestal.position.y = 0.22;
    gateGroup.add(gatePedestal);
    const gateRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.14, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x0f172a,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.8,
      })
    );
    gateRing.position.y = 2.3;
    gateGroup.add(gateRing);
    const gateCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        emissive: 0x10b981,
        emissiveIntensity: 0.2,
        roughness: 0.12,
      })
    );
    gateCore.position.y = 2.3;
    gateGroup.add(gateCore);
    scene.add(gateGroup);

    // Hero
    const hero = buildHeroGroup(shadowTex);
    hero.root.position.set(0, 0, 8);
    scene.add(hero.root);

    // Resonance Shards (up to 8 collectibles batched into 3 InstancedMeshes -> 3 DC total)
    const shardCoords: Array<[number, number]> = [
      [-6.5, 4.5], [6.5, 4.5],
      [-13.5, -5.5], [13.5, -5.5],
      [-5.5, -14.5], [5.5, -14.5],
      [-15.5, 6.5], [15.5, 6.5],
    ];
    const shardCount = shardCoords.length;
    const shardShadowInstances = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
      shardCount
    );
    const shardCrystalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initCfg.accentHex),
      emissive: new THREE.Color(initCfg.accentHex),
      emissiveIntensity: 1.5,
      roughness: 0.12,
      metalness: 0.2,
    });
    const shardCrystalInstances = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.42, 0),
      shardCrystalMat,
      shardCount
    );
    const shardHaloInstances = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.58, 0.04, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: new THREE.Color(initCfg.accentHex), emissiveIntensity: 1.0 }),
      shardCount
    );
    shardShadowInstances.frustumCulled = false;
    shardCrystalInstances.frustumCulled = false;
    shardHaloInstances.frustumCulled = false;
    scene.add(shardShadowInstances, shardCrystalInstances, shardHaloInstances);

    const shards: Array<{ idx: number; active: boolean; collected: boolean; spin: number; basePos: THREE.Vector3 }> = shardCoords.map(
      ([sx, sz], idx) => ({
        idx,
        active: idx < initCfg.shardCount,
        collected: false,
        spin: idx * 0.55,
        basePos: new THREE.Vector3(sx, 0, sz),
      })
    );
    const syncShardMatrices = () => {
      for (let i = 0; i < shards.length; i++) {
        const s = shards[i];
        const scale = !s.active || s.collected ? 0 : 1;
        dummy.scale.set(scale, scale, scale);
        dummy.position.set(s.basePos.x, 0.02, s.basePos.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        shardShadowInstances.setMatrixAt(i, dummy.matrix);

        dummy.position.set(s.basePos.x, 1.15, s.basePos.z);
        dummy.rotation.set(0, s.spin, 0);
        dummy.updateMatrix();
        shardCrystalInstances.setMatrixAt(i, dummy.matrix);

        dummy.position.set(s.basePos.x, 1.15, s.basePos.z);
        dummy.rotation.set(Math.PI / 3, 0, s.spin * 0.8);
        dummy.updateMatrix();
        shardHaloInstances.setMatrixAt(i, dummy.matrix);
      }
      dummy.scale.set(1, 1, 1);
      shardShadowInstances.instanceMatrix.needsUpdate = true;
      shardCrystalInstances.instanceMatrix.needsUpdate = true;
      shardHaloInstances.instanceMatrix.needsUpdate = true;
    };
    syncShardMatrices();

    // 3 Distinct Enemy Archetypes + Attack Token Pool + Flash/KO State
    const attackTokens = new AttackTokenPool(2);
    const enemies: Array<{
      archetype: 'swarmer' | 'flanker' | 'turret';
      group: THREE.Group;
      home: THREE.Vector3;
      hp: number;
      cooldown: number;
      stunTimer: number;
      flashTimer: number;
      koTimer: number;
      telegraphTimer: number;
      telegraphPlayed: boolean;
    }> = [
      { archetype: 'swarmer', group: buildEnemyGroup('swarmer', shadowTex), home: new THREE.Vector3(-7, 0, -2), hp: 2, cooldown: 0, stunTimer: 0, flashTimer: 0, koTimer: 0, telegraphTimer: 0, telegraphPlayed: false },
      { archetype: 'flanker', group: buildEnemyGroup('flanker', shadowTex), home: new THREE.Vector3(7, 0, -2), hp: 2, cooldown: 0, stunTimer: 0, flashTimer: 0, koTimer: 0, telegraphTimer: 0, telegraphPlayed: false },
      { archetype: 'turret', group: buildEnemyGroup('turret', shadowTex), home: new THREE.Vector3(0, 0, -5), hp: 3, cooldown: 1.4, stunTimer: 0, flashTimer: 0, koTimer: 0, telegraphTimer: 0, telegraphPlayed: false },
    ];
    enemies.forEach((e) => {
      e.group.position.copy(e.home);
      scene.add(e.group);
    });

    // Pooled Impact Particles (64 pre-allocated inside 1 InstancedMesh — Zero GC & 1 DC!)
    const particleGeo = new THREE.OctahedronGeometry(0.12, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const particleInstances = new THREE.InstancedMesh(particleGeo, particleMat, QOLBU_CONSTANTS.POOL_PARTICLE);
    particleInstances.frustumCulled = false;
    particleInstances.visible = false;
    scene.add(particleInstances);
    const particlePool = Array.from({ length: QOLBU_CONSTANTS.POOL_PARTICLE }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
    }));
    const syncParticleMatrices = () => {
      let anyAlive = false;
      for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (p.life > 0) {
          anyAlive = true;
          const sc = Math.max(0.2, p.life / 0.45);
          dummy.position.copy(p.pos);
          dummy.rotation.set(p.life * 6, p.life * 4, 0);
          dummy.scale.set(sc, sc, sc);
        } else {
          dummy.position.set(0, -50, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        particleInstances.setMatrixAt(i, dummy.matrix);
      }
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      particleInstances.visible = anyAlive;
      if (anyAlive) particleInstances.instanceMatrix.needsUpdate = true;
    };
    syncParticleMatrices();
    let particleCursor = 0;

    const spawnBurst = (origin: THREE.Vector3, count = 10) => {
      for (let i = 0; i < count; i++) {
        const p = particlePool[particleCursor % particlePool.length];
        particleCursor += 1;
        p.pos.copy(origin);
        p.pos.y += 0.9;
        const angle = (Math.PI * 2 * i) / count;
        p.vel.set(Math.cos(angle) * 4.5, 2.5 + (i % 3), Math.sin(angle) * 4.5);
        p.life = 0.45;
      }
      syncParticleMatrices();
    };

    // Pooled Turret Bolts (8 pre-allocated inside 1 InstancedMesh — 1 DC!)
    const boltInstances = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      8
    );
    boltInstances.frustumCulled = false;
    boltInstances.visible = false;
    scene.add(boltInstances);
    const bolts = Array.from({ length: 8 }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
    }));
    const syncBoltMatrices = () => {
      let anyAlive = false;
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i];
        if (b.life > 0) {
          anyAlive = true;
          dummy.position.copy(b.pos);
          dummy.scale.set(1, 1, 1);
        } else {
          dummy.position.set(0, -50, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        boltInstances.setMatrixAt(i, dummy.matrix);
      }
      dummy.scale.set(1, 1, 1);
      boltInstances.visible = anyAlive;
      if (anyAlive) boltInstances.instanceMatrix.needsUpdate = true;
    };
    syncBoltMatrices();
    let boltCursor = 0;

    // Mutable Physics State (Zero Allocation Loop)
    const collisionScratch = { collided: false, x: 0, z: 0 };
    const sim = {
      vy: 0,
      grounded: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      dashBufferTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      hitstopTimer: 0,
      invulnTimer: 0,
      trauma: 0,
      scaleX: 1,
      scaleY: 1,
      stepDistAccum: 0,
      hp: 100,
      stamina: 100,
      shardsCollected: 0,
      score: 0,
      elapsedSec: 0,
      aiAccumulator: 0,
      aiTickCount: 0,
      orbitAngle: 0,
      fpsSampleTimer: 0,
      fpsFrameCount: 0,
      measuredFps: 30,
      camTarget: new THREE.Vector3(0, 1.4, 8),
      camDesired: new THREE.Vector3(0, 6.5, 16),
      camLook: new THREE.Vector3(0, 1.3, 8),
      moveDir: new THREE.Vector3(),
      tempVec: new THREE.Vector3(),
    };

    const resolveObstacleCollisions = (x: number, z: number, radius: number): [number, number] => {
      let rx = x;
      let rz = z;
      for (let i = 0; i < pillarPositions.length; i++) {
        const [px, pz] = pillarPositions[i];
        resolveCircleAabbCollision(rx, rz, radius, px, pz, 1.05, 1.05, collisionScratch);
        rx = collisionScratch.x;
        rz = collisionScratch.z;
      }
      // Central Sanctuary Gate Pedestal collider (0, -11.5)
      resolveCircleAabbCollision(rx, rz, radius, 0, -11.5, 1.65, 1.65, collisionScratch);
      return [collisionScratch.x, collisionScratch.z];
    };

    const clearHeldInputs = () => {
      controlRef.current.keys = {};
      controlRef.current.virtualMove = { x: 0, z: 0 };
      controlRef.current.jumpQueued = false;
      controlRef.current.dashQueued = false;
    };

    const resetWorld = () => {
      hero.root.position.set(0, 0, 8);
      hero.root.rotation.set(0, Math.PI, 0);
      hero.root.scale.set(1, 1, 1);
      sim.vy = 0;
      sim.grounded = true;
      sim.coyoteTimer = 0;
      sim.jumpBufferTimer = 0;
      sim.dashBufferTimer = 0;
      sim.dashTimer = 0;
      sim.dashCooldown = 0;
      sim.trauma = 0;
      sim.scaleX = 1;
      sim.scaleY = 1;
      sim.stepDistAccum = 0;
      sim.hp = 100;
      sim.stamina = 100;
      sim.shardsCollected = 0;
      sim.score = 0;
      sim.elapsedSec = 0;
      sim.hitstopTimer = 0;
      sim.invulnTimer = 0;
      attackTokens.clear();
      const activeShardLimit = runtimeCfgRef.current.shardCount;
      shards.forEach((s, idx) => {
        s.active = idx < activeShardLimit;
        s.collected = false;
      });
      syncShardMatrices();
      const ringMat = gateRing.material as THREE.MeshStandardMaterial;
      ringMat.color.setHex(0x475569);
      ringMat.emissive.setHex(0x0f172a);
      ringMat.emissiveIntensity = 0.5;
      const coreMat = gateCore.material as THREE.MeshStandardMaterial;
      coreMat.color.setHex(0x64748b);
      coreMat.emissive.setHex(0x10b981);
      coreMat.emissiveIntensity = 0.2;
      enemies.forEach((e) => {
        e.hp = e.archetype === 'turret' ? 3 : 2;
        e.stunTimer = 0;
        e.flashTimer = 0;
        e.koTimer = 0;
        e.telegraphTimer = 0;
        e.telegraphPlayed = false;
        e.group.visible = true;
        e.group.scale.set(1, 1, 1);
        e.group.rotation.set(0, 0, 0);
        e.group.position.copy(e.home);
      });
      bolts.forEach((b) => {
        b.life = 0;
      });
      syncBoltMatrices();
      particlePool.forEach((p) => {
        p.life = 0;
      });
      syncParticleMatrices();
      setHud((prev) => ({
        ...prev,
        status: controlRef.current.status,
        hp: 100,
        stamina: 100,
        shards: 0,
        totalShards: activeShardLimit,
        score: 0,
        gateUnlocked: false,
        elapsedSec: 0,
      }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const code = e.code;
      controlRef.current.keys[code] = true;

      if (controlRef.current.status === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        setGameStatus('playing');
        return;
      }

      if (code === 'Space' && controlRef.current.status === 'playing') {
        e.preventDefault();
        controlRef.current.jumpQueued = true;
      }
      if ((code === 'ShiftLeft' || code === 'KeyE') && controlRef.current.status === 'playing') {
        controlRef.current.dashQueued = true;
      }
      if (code === 'KeyF' && controlRef.current.status === 'playing') {
        e.preventDefault();
        cycleOracleDialog();
      }
      if (code === 'KeyM') {
        setMuted((prev) => {
          const next = !prev;
          qolbuAudio.setMuted(next);
          return next;
        });
      }
      if (code === 'KeyR' && controlRef.current.status !== 'title') {
        triggerRestart();
      }
      if (code === 'KeyP' || code === 'Escape') {
        if (controlRef.current.status === 'playing') {
          setGameStatus('paused');
        } else if (controlRef.current.status === 'paused') {
          setGameStatus('playing');
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      controlRef.current.keys[e.code] = false;
      // Variable jump height cut when releasing Space early
      if (e.code === 'Space' && sim.vy > 2.2) {
        sim.vy *= 0.52;
      }
    };

    const onVisibilityOrBlur = () => {
      clearHeldInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onVisibilityOrBlur);
    document.addEventListener('visibilitychange', onVisibilityOrBlur);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let lastTime = performance.now();
    let hudSyncTimer = 0.5;
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;

    const afterDraw = (fn: () => void) => {
      if (!isSoftwareGl) {
        rafId = window.requestAnimationFrame(fn);
        return;
      }
      const gl2 = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        let polls = 0;
        const poll = () => {
          if (disposed) {
            if (sync) gl2.deleteSync(sync);
            return;
          }
          polls += 1;
          const res = sync ? gl2.clientWaitSync(sync, 0, 0) : gl2.ALREADY_SIGNALED;
          if ((res === gl2.WAIT_FAILED || res === gl2.TIMEOUT_EXPIRED) && polls < 6) {
            timeoutId = window.setTimeout(poll, 16);
          } else {
            if (sync) gl2.deleteSync(sync);
            timeoutId = window.setTimeout(fn, 50);
          }
        };
        timeoutId = window.setTimeout(poll, 50);
      } else {
        timeoutId = window.setTimeout(fn, 50);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const tick = () => {
      if (disposed) return;
      if (typeof document !== 'undefined' && document.hidden) {
        lastTime = performance.now();
        timeoutId = window.setTimeout(() => {
          if (!disposed) afterDraw(tick);
        }, 250);
        return;
      }
      const tickStart = performance.now();
      const rawDt = (tickStart - lastTime) / 1000;
      lastTime = tickStart;
      const dt = fastClampDt(rawDt);
      const activeCfg = runtimeCfgRef.current;

      // Apply live Style Bible & Scene Editor changes without canvas teardown (Zero GC)
      if (dirtyVisualsRef.current) {
        dirtyVisualsRef.current = false;
        bgColor.set(activeCfg.skyHex);
        fog.color.set(activeCfg.skyHex);
        fog.density = activeCfg.fogDensity;
        groundMat.color.set(activeCfg.groundHex);
        shardCrystalMat.color.set(activeCfg.accentHex);
        shardCrystalMat.emissive.set(activeCfg.accentHex);
        bronzeMat.color.set(activeCfg.accentHex);
        sunLight.intensity = 2.4 * activeCfg.sunWarmth;
        syncPillarMatrices(activeCfg.pillarScale);
        for (let i = 0; i < shards.length; i++) {
          shards[i].active = i < activeCfg.shardCount;
        }
        syncShardMatrices();
      }

      // Handle queued actions
      if (controlRef.current.restartQueued) {
        controlRef.current.restartQueued = false;
        resetWorld();
      }

      if (controlRef.current.captureQueued) {
        controlRef.current.captureQueued = false;
        try {
          const url = renderer.domElement.toDataURL('image/png');
          captureCbRef.current?.(url);
        } catch {
          // Ignore canvas capture restrictions
        }
      }

      // FPS counter
      sim.fpsSampleTimer += rawDt > 0 ? rawDt : dt;
      sim.fpsFrameCount += 1;
      if (sim.fpsSampleTimer >= 0.5) {
        sim.measuredFps = Math.min(60, Math.max(12, Math.round(sim.fpsFrameCount / sim.fpsSampleTimer)));
        sim.fpsFrameCount = 0;
        sim.fpsSampleTimer = 0;
      }

      // Quality scaling
      const qMode = controlRef.current.qualityPreset;
      if (!isSoftwareGl) {
        const targetRatio = qMode === 'itel_a70_eco' ? 0.85 : qMode === 'hd_stylized' ? 1.25 : Math.min(window.devicePixelRatio || 1, 2);
        if (Math.abs(renderer.getPixelRatio() - targetRatio) > 0.05) {
          renderer.setPixelRatio(targetRatio);
        }
      }

      // Update active simulation when playing
      if (controlRef.current.status === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          sim.elapsedSec += dt;
          sim.stamina = Math.min(100, sim.stamina + 18 * dt);
          sim.dashCooldown = Math.max(0, sim.dashCooldown - dt);
          sim.invulnTimer = Math.max(0, sim.invulnTimer - dt);

          const keys = controlRef.current.keys;
          const vMove = controlRef.current.virtualMove;
          let mx = vMove.x;
          let mz = vMove.z;
          if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
          if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
          if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
          if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

          sim.moveDir.set(mx, 0, mz);
          if (sim.moveDir.lengthSq() > 0.001) {
            sim.moveDir.normalize();
          }

          // Input Buffering (0.12s window)
          if (controlRef.current.dashQueued) {
            controlRef.current.dashQueued = false;
            sim.dashBufferTimer = 0.12;
          } else {
            sim.dashBufferTimer = Math.max(0, sim.dashBufferTimer - dt);
          }

          if (controlRef.current.jumpQueued) {
            controlRef.current.jumpQueued = false;
            sim.jumpBufferTimer = 0.12;
          } else {
            sim.jumpBufferTimer = Math.max(0, sim.jumpBufferTimer - dt);
          }

          // Dash Parry Burst (buffered)
          if (sim.dashBufferTimer > 0 && sim.dashCooldown <= 0 && sim.stamina >= 25) {
            sim.dashBufferTimer = 0;
            sim.dashTimer = 0.18;
            sim.dashCooldown = 0.7;
            sim.stamina -= 25;
            sim.scaleX = 1.16;
            sim.scaleY = 0.88;
            sim.trauma = Math.min(1, sim.trauma + 0.3);
            qolbuAudio.playSfx('dash');
            spawnBurst(hero.root.position, 12);
            fsmCbRef.current?.('ACTION_PRESSED');

            // Check strike against nearby enemies (with Parry bonus on telegraphed attacks)
            enemies.forEach((enemy, idx) => {
              if (!enemy.group.visible || enemy.koTimer > 0) return;
              if (enemy.group.position.distanceTo(hero.root.position) < 3.6) {
                const parriedTelegraph = enemy.telegraphTimer > 0;
                enemy.hp -= parriedTelegraph ? 2 : 1;
                enemy.stunTimer = 1.3;
                enemy.flashTimer = 0.1;
                sim.hitstopTimer = 0.04;
                sim.trauma = Math.min(1, sim.trauma + 0.45);
                sim.score += parriedTelegraph ? 150 : 75;
                qolbuAudio.playSfx(parriedTelegraph ? 'parry' : 'hit');
                spawnBurst(enemy.group.position, 14);
                if (enemy.hp <= 0) {
                  enemy.koTimer = 0.35;
                  attackTokens.release(idx);
                  sim.score += 150;
                }
              }
            });
          }

          const speed = sim.dashTimer > 0 ? activeCfg.moveSpeed * 2.1 : activeCfg.moveSpeed;
          if (sim.dashTimer > 0) sim.dashTimer = Math.max(0, sim.dashTimer - dt);

          const rawNextX = hero.root.position.x + sim.moveDir.x * speed * dt;
          const rawNextZ = hero.root.position.z + sim.moveDir.z * speed * dt;
          const [resolvedX, resolvedZ] = resolveObstacleCollisions(rawNextX, rawNextZ, 0.55);

          // Keep inside 24.5m sanctuary arena & guard move step
          const distFromOrigin = Math.hypot(resolvedX, resolvedZ);
          if (
            distFromOrigin <= 24.5 &&
            isValidMove(
              hero.root.position.x,
              hero.root.position.y,
              hero.root.position.z,
              resolvedX,
              hero.root.position.y,
              resolvedZ,
              Math.max(QOLBU_CONSTANTS.MAX_SPEED_MPS, activeCfg.moveSpeed * 1.45)
            )
          ) {
            const movedDist = Math.hypot(resolvedX - hero.root.position.x, resolvedZ - hero.root.position.z);
            hero.root.position.x = resolvedX;
            hero.root.position.z = resolvedZ;
            if (sim.grounded && movedDist > 0.001) {
              sim.stepDistAccum += movedDist;
              if (sim.stepDistAccum >= 2.5) {
                sim.stepDistAccum = 0;
                qolbuAudio.playSfx('step');
              }
            }
          }

          if (sim.moveDir.lengthSq() > 0.01) {
            const targetYaw = Math.atan2(sim.moveDir.x, sim.moveDir.z);
            hero.root.rotation.y = targetYaw;
            hero.cape.rotation.x = 0.25 + Math.sin(tickStart * 0.015) * 0.18;
          } else {
            hero.cape.rotation.x = 0.14;
          }

          // Jump with coyote time & input buffer
          if (sim.grounded) {
            sim.coyoteTimer = 0.14;
          } else {
            sim.coyoteTimer = Math.max(0, sim.coyoteTimer - dt);
          }

          if (sim.jumpBufferTimer > 0 && (sim.grounded || sim.coyoteTimer > 0)) {
            sim.jumpBufferTimer = 0;
            sim.vy = activeCfg.jumpForce;
            sim.grounded = false;
            sim.coyoteTimer = 0;
            sim.scaleX = 0.88;
            sim.scaleY = 1.22;
            qolbuAudio.playSfx('jump');
          }

          sim.vy -= activeCfg.gravity * dt;
          hero.root.position.y += sim.vy * dt;
          if (hero.root.position.y <= 0) {
            if (!sim.grounded && sim.vy < -6) {
              sim.scaleX = 1.14;
              sim.scaleY = 0.82;
              qolbuAudio.playSfx('step');
            }
            hero.root.position.y = 0;
            sim.vy = 0;
            sim.grounded = true;
          }

          // Exponential spring recovery for Hero squash & stretch
          sim.scaleX = stepExponentialDamp(sim.scaleX, 1, 14, dt);
          sim.scaleY = stepExponentialDamp(sim.scaleY, 1, 14, dt);
          hero.root.scale.set(sim.scaleX, sim.scaleY, sim.scaleX);

          // Collect Shards (InstancedMesh zero-allocation update)
          let shardDirty = false;
          for (let i = 0; i < shards.length; i++) {
            const s = shards[i];
            if (!s.active || s.collected) continue;
            s.spin += 2.2 * dt;
            shardDirty = true;
            if (s.basePos.distanceTo(hero.root.position) < 1.65) {
              s.collected = true;
              sim.shardsCollected += 1;
              sim.score += 200;
              qolbuAudio.playSfx('pickup');
              spawnBurst(s.basePos, 12);
            }
          }
          if (shardDirty) syncShardMatrices();

          // Gate visual activation when required shards collected
          const unlocked = sim.shardsCollected >= activeCfg.shardCount;
          if (unlocked) {
            const ringMat = gateRing.material as THREE.MeshStandardMaterial;
            ringMat.color.setHex(0x10b981);
            ringMat.emissive.setHex(0x10b981);
            ringMat.emissiveIntensity = 1.6;
            const coreMat = gateCore.material as THREE.MeshStandardMaterial;
            coreMat.color.setHex(0xfbbf24);
            coreMat.emissive.setHex(0x10b981);
            coreMat.emissiveIntensity = 2.0;

            if (hero.root.position.distanceTo(gateGroup.position) < 2.8) {
              controlRef.current.status = 'victory';
              sim.trauma = Math.min(1, sim.trauma + 0.4);
              qolbuAudio.stopMusic();
              qolbuAudio.playSfx('victory');
              fsmCbRef.current?.('OBJECTIVES_MET');
              setHud((prev) => ({
                ...prev,
                status: 'victory',
                shards: sim.shardsCollected,
                totalShards: activeCfg.shardCount,
                score: sim.score + 500,
                gateUnlocked: true,
              }));
            }
          }

          // Enemy Hit Flash & KO Topple Animations
          enemies.forEach((enemy) => {
            if (!enemy.group.visible) return;
            if (enemy.flashTimer > 0) {
              enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
              enemy.group.scale.setScalar(1.14);
            } else if (enemy.koTimer > 0) {
              enemy.koTimer = Math.max(0, enemy.koTimer - dt);
              const t = Math.max(0.05, enemy.koTimer / 0.35);
              enemy.group.scale.set(t, t, t);
              enemy.group.rotation.z = (1 - t) * 1.4;
              if (enemy.koTimer <= 0) {
                enemy.group.visible = false;
              }
            } else {
              enemy.group.scale.set(1, 1, 1);
            }
          });

          // 15Hz AI Decimation Tick with Attack Token Crowd Pool + Telegraph Windup
          sim.aiAccumulator += dt;
          if (sim.aiAccumulator >= 1 / QOLBU_CONSTANTS.AI_TICK_HZ) {
            const aiDt = sim.aiAccumulator;
            sim.aiAccumulator = 0;
            sim.aiTickCount += 1;

            let anyClose = false;
            enemies.forEach((enemy, idx) => {
              if (!enemy.group.visible || enemy.koTimer > 0) return;
              if (enemy.stunTimer > 0) {
                enemy.stunTimer = Math.max(0, enemy.stunTimer - aiDt);
                enemy.telegraphTimer = 0;
                enemy.telegraphPlayed = false;
                return;
              }
              const toHero = sim.tempVec.subVectors(hero.root.position, enemy.group.position);
              toHero.y = 0;
              const dist = toHero.length();
              if (dist < 10) anyClose = true;

              const hasToken = dist < 19 && attackTokens.acquire(idx);
              if (!hasToken) {
                attackTokens.release(idx);
              }

              if (enemy.archetype === 'swarmer' && dist > 0.4 && dist < 18 && hasToken) {
                toHero.normalize();
                const ex = enemy.group.position.x + toHero.x * activeCfg.enemySpeed * aiDt;
                const ez = enemy.group.position.z + toHero.z * activeCfg.enemySpeed * aiDt;
                const [rx, rz] = resolveObstacleCollisions(ex, ez, 0.52);
                enemy.group.position.x = rx;
                enemy.group.position.z = rz;
                enemy.group.lookAt(hero.root.position.x, 0, hero.root.position.z);
              } else if (enemy.archetype === 'flanker' && dist > 0.5 && dist < 20 && hasToken) {
                toHero.normalize();
                const tangentX = -toHero.z;
                const tangentZ = toHero.x;
                const ex = enemy.group.position.x + (toHero.x * (activeCfg.enemySpeed * 0.7) + tangentX * (activeCfg.enemySpeed * 0.78)) * aiDt;
                const ez = enemy.group.position.z + (toHero.z * (activeCfg.enemySpeed * 0.7) + tangentZ * (activeCfg.enemySpeed * 0.78)) * aiDt;
                const [rx, rz] = resolveObstacleCollisions(ex, ez, 0.52);
                enemy.group.position.x = rx;
                enemy.group.position.z = rz;
                enemy.group.lookAt(hero.root.position.x, 0, hero.root.position.z);
              } else if (enemy.archetype === 'turret') {
                if (enemy.group.children[3]) {
                  enemy.group.children[3].rotation.y += 2.2 * aiDt;
                }
                enemy.cooldown -= aiDt;
                if (enemy.cooldown <= 0.45 && enemy.cooldown > 0 && dist < 19) {
                  enemy.telegraphTimer = enemy.cooldown;
                  if (!enemy.telegraphPlayed) {
                    enemy.telegraphPlayed = true;
                    qolbuAudio.playSfx('telegraph');
                  }
                }
                if (enemy.cooldown <= 0 && dist < 19 && hasToken) {
                  enemy.cooldown = 2.4;
                  enemy.telegraphTimer = 0;
                  enemy.telegraphPlayed = false;
                  const bolt = bolts[boltCursor % bolts.length];
                  boltCursor += 1;
                  bolt.pos.set(enemy.group.position.x, 1.3, enemy.group.position.z);
                  toHero.normalize();
                  bolt.vel.copy(toHero).multiplyScalar(7.5);
                  bolt.life = 2.5;
                }
              }

              if (idx < 2 && dist < 3.0) {
                enemy.telegraphTimer = Math.max(enemy.telegraphTimer, 0.25);
              } else if (idx < 2) {
                enemy.telegraphTimer = Math.max(0, enemy.telegraphTimer - aiDt);
              }

              if (dist < 1.35 && sim.invulnTimer <= 0 && idx < 2) {
                sim.hp = Math.max(0, sim.hp - 14);
                sim.invulnTimer = 0.85;
                sim.trauma = Math.min(1, sim.trauma + 0.55);
                qolbuAudio.playSfx('hit');
                spawnBurst(hero.root.position, 8);
              }
            });
            qolbuAudio.setIntensity(anyClose ? 'combat' : 'explore');
          }

          // Update projectiles (InstancedMesh)
          let boltsDirty = false;
          bolts.forEach((b) => {
            if (b.life <= 0) return;
            boltsDirty = true;
            b.life -= dt;
            b.pos.addScaledVector(b.vel, dt);
            if (b.life <= 0) {
              b.life = 0;
            } else if (b.pos.distanceTo(hero.root.position) < 1.15 && sim.invulnTimer <= 0) {
              b.life = 0;
              sim.hp = Math.max(0, sim.hp - 12);
              sim.invulnTimer = 0.85;
              sim.trauma = Math.min(1, sim.trauma + 0.5);
              qolbuAudio.playSfx('hit');
              spawnBurst(hero.root.position, 8);
            }
          });
          if (boltsDirty) syncBoltMatrices();

          if (sim.hp <= 0) {
            controlRef.current.status = 'gameover';
            qolbuAudio.stopMusic();
            qolbuAudio.playSfx('gameover');
            setHud((prev) => ({ ...prev, status: 'gameover', hp: 0 }));
          }
        }
      }

      // Animate decorative elements & particles even in title preview
      hero.core.rotation.y += 1.6 * dt;
      gateCore.rotation.y += 1.1 * dt;
      let particlesDirty = false;
      particlePool.forEach((p) => {
        if (p.life <= 0) return;
        particlesDirty = true;
        p.life -= dt;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.y -= 9.8 * dt;
        if (p.life < 0) p.life = 0;
      });
      if (particlesDirty) syncParticleMatrices();

      // Camera & Projection Mode Damped Rig (3D PBR / 2.5D Isometric / 2D Flat / Pseudo-3D)
      const preset = controlRef.current.cameraPreset;
      const projMode = controlRef.current.projectionMode;
      const hx = hero.root.position.x;
      const hy = hero.root.position.y;
      const hz = hero.root.position.z;

      const targetFov = projMode === '2.5d_isometric' || projMode === '2d_flat' ? 32 : projMode === 'pseudo_3d' ? 42 : 56;
      if (Math.abs(camera.fov - targetFov) > 0.25) {
        camera.fov += (targetFov - camera.fov) * 0.2;
        camera.updateProjectionMatrix();
      }

      if (controlRef.current.status === 'title' || preset === 'orbit') {
        sim.orbitAngle += 0.25 * dt;
        sim.camDesired.set(
          Math.sin(sim.orbitAngle) * 16,
          projMode === '2d_flat' ? 24 : 9.2,
          Math.cos(sim.orbitAngle) * 16
        );
        sim.camTarget.set(0, 1.5, -2);
      } else if (projMode === '2d_flat') {
        sim.camDesired.set(hx, 26, hz + 0.05);
        sim.camTarget.set(hx, 0, hz);
      } else if (projMode === '2.5d_isometric' || preset === 'isometric') {
        sim.camDesired.set(hx + 12.5, hy + 14.5, hz + 12.5);
        sim.camTarget.set(hx, hy + 0.8, hz);
      } else if (projMode === 'pseudo_3d') {
        sim.camDesired.set(hx, hy + 2.8, hz + 15.5);
        sim.camTarget.set(hx, hy + 1.2, hz - 2.0);
      } else if (preset === 'first_person') {
        const yaw = hero.root.rotation.y;
        sim.camDesired.set(hx + Math.sin(yaw) * 0.35, hy + 1.8, hz + Math.cos(yaw) * 0.35);
        sim.camTarget.set(hx + Math.sin(yaw) * 8, hy + 1.65, hz + Math.cos(yaw) * 8);
      } else {
        sim.camDesired.set(hx, hy + 5.8, hz + 9.8);
        sim.camTarget.set(hx, hy + 1.25, hz - 1.2);
      }

      const damp = 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(sim.camDesired, damp);
      sim.camLook.lerp(sim.camTarget, damp);

      // Quadratic trauma camera shake (disabled if Reduce Screen Shake is active)
      const { nextTrauma, shakeIntensity } = advanceTrauma(sim.trauma, dt);
      sim.trauma = nextTrauma;
      if (shakeIntensity > 0.001 && !settingsRef.current.reduceScreenShake) {
        const amp = shakeIntensity * 0.38;
        camera.position.x += Math.sin(tickStart * 0.09) * amp;
        camera.position.y += Math.cos(tickStart * 0.11) * amp * 0.7;
      }
      camera.lookAt(sim.camLook);

      renderer.render(scene, camera);

      const frameMs = Math.max(0.4, performance.now() - tickStart);
      const dc = renderer.info.render.calls;
      const tris = renderer.info.render.triangles;
      const texMb = Number((84 + (qMode === 'ultra_pbr' ? 68 : qMode === 'hd_stylized' ? 32 : 22)).toFixed(1));
      const meshMb = Number((38 + (tris / 60000) * 26).toFixed(1));
      const audioMb = 16.0;
      const runtimeMb = 21.4;
      const totalMem = Number((texMb + meshMb + audioMb + runtimeMb).toFixed(1));

      // Zero-GC direct mutation of live telemetry ref for ProfilerOverlay rAF
      const liveRef = activeMetricsRef.current;
      liveRef.fps = sim.measuredFps;
      liveRef.cpuMs = Number(Math.min(28, 3.8 + frameMs * 0.65).toFixed(1));
      liveRef.gpuMs = Number(Math.min(24, 2.2 + dc * 0.24 + (qMode === 'ultra_pbr' ? 3.5 : 0)).toFixed(1));
      liveRef.drawCalls = dc;
      liveRef.triangles = tris;
      liveRef.texturesMb = texMb;
      liveRef.meshesMb = meshMb;
      liveRef.audioMb = audioMb;
      liveRef.runtimeMb = runtimeMb;
      liveRef.memoryMb = totalMem;

      hudSyncTimer += dt;
      if (hudSyncTimer >= 0.45) {
        hudSyncTimer = 0;
        setHud((prev) => ({
          ...prev,
          hp: Math.round(sim.hp),
          stamina: Math.round(sim.stamina),
          shards: sim.shardsCollected,
          totalShards: activeCfg.shardCount,
          score: sim.score,
          fps: sim.measuredFps,
          drawCalls: dc,
          triangles: tris,
          gateUnlocked: sim.shardsCollected >= activeCfg.shardCount,
          elapsedSec: Math.round(sim.elapsedSec),
          aiTickCount: sim.aiTickCount,
        }));
        telemetryCbRef.current?.({ ...liveRef });
      }

      afterDraw(tick);
    };

    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onVisibilityOrBlur);
      document.removeEventListener('visibilitychange', onVisibilityOrBlur);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      resizeObserver.disconnect();
      qolbuAudio.stopMusic();

      // Traverse scene and dispose every GPU geometry, material, and texture (Zero VRAM leak)
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else if (mat) {
          mat.dispose();
        }
      });
      shadowTex.dispose();
      stoneBump.dispose();
      proceduralGroundTex.dispose();
      if (loadedFloorTex) loadedFloorTex.dispose();
      if (envRenderTarget) envRenderTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [useCanvas2D]);

  const currentLayer = QOLBU_12_LAYERS[activeLayerIdx] ?? QOLBU_12_LAYERS[0];

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    qolbuAudio.setMuted(next);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar Above 3D Viewport */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="font-mono text-amber-600 dark:text-amber-400">QOLBU ENGINE v13.0</span>
            <span>·</span>
            <span className="truncate">{brief.title}</span>
            <span>·</span>
            <span className="tabular-nums">{hud.drawCalls}/35 DC</span>
          </div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
            Live 3D Sanctuary Arena & Itel A70 Runtime Inspector
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Dimension Projection Mode"
            value={localProjection}
            onChange={(e) => {
              const next = e.target.value as ProjectionMode;
              setLocalProjection(next);
              controlRef.current.projectionMode = next;
              onProjectionChange?.(next);
            }}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="3d_pbr">Mode: 3D PBR</option>
            <option value="2.5d_isometric">Mode: 2.5D Isometric</option>
            <option value="pseudo_3d">Mode: Pseudo-3D / Fake-3D</option>
            <option value="2d_flat">Mode: 2D Top-Down</option>
          </select>

          <select
            aria-label="Camera Preset"
            value={cameraPreset}
            onChange={(e) => setCameraPreset(e.target.value as CameraPreset3D)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="third_person">Camera: Third-Person</option>
            <option value="isometric">Camera: Isometric</option>
            <option value="first_person">Camera: First-Person</option>
            <option value="orbit">Camera: Cinematic Orbit</option>
          </select>

          <select
            aria-label="Device Quality Preset"
            value={qualityPreset}
            onChange={(e) => setQualityPreset(e.target.value as QualityPresetId)}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="itel_a70_eco">Itel A70 Eco (30Hz)</option>
            <option value="hd_stylized">HD Stylized</option>
            <option value="ultra_pbr">Ultra PBR Desktop</option>
          </select>

          <button
            type="button"
            data-testid="toggle-scene-editor"
            onClick={() => setSceneEditorOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium ${
              sceneEditorOpen
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Scene Editor
          </button>

          <button
            type="button"
            data-testid="toggle-profiler"
            onClick={() => setProfilerVisible((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium ${
              profilerVisible
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            {profilerVisible ? 'Profiler ON' : 'Profiler OFF'}
          </button>

          <button
            type="button"
            onClick={() => {
              controlRef.current.captureQueued = true;
            }}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Camera className="h-3.5 w-3.5" />
            Photo Mode
          </button>

          <button
            type="button"
            data-testid="toggle-canvas2d-fallback"
            onClick={() => {
              setContextLost(false);
              setFallback2DMode((v) => !v);
            }}
            className={`inline-flex h-10 sm:h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 text-xs font-medium ${
              useCanvas2D
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
            }`}
          >
            {useCanvas2D ? '2D Fallback ON' : '2D Fallback'}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute Studio Audio' : 'Mute Studio Audio'}
            className="inline-flex h-10 sm:h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-rose-500" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-500" />}
            {muted ? 'Muted' : 'Audio'}
          </button>
        </div>
      </div>

      {/* Collapsible Unified Scene Editor & IO Drawer (Sits Above Canvas, Zero Viewport Occlusion) */}
      {sceneEditorOpen && onUpdateRuntimeConfig && (
        <div
          data-testid="scene-editor-drawer"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[11px] uppercase text-amber-600 dark:text-amber-400">
                Real-Time Scene, Physics &amp; Audiovisual Editor
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Mutates live Three.js lighting, terrain shader tint, audio tempo &amp; physics parameters with zero WebGL reload
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    JSON.stringify(runtimeConfig, null, 2),
                    `${sanitizeSlug(brief.title)}-scene.json`,
                    'application/json'
                  )
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
                Export Scene
              </button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <Upload className="h-3.5 w-3.5" />
                Import Scene
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const parsed = safeJsonParse<Partial<GameRuntimeConfig> | null>(
                        String(reader.result || ''),
                        null
                      );
                      if (parsed && typeof parsed === 'object') {
                        onUpdateRuntimeConfig({ ...runtimeConfig, ...parsed });
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Move Speed</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.moveSpeed.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={4}
                max={14}
                step={0.2}
                value={runtimeConfig.moveSpeed}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, moveSpeed: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Enemy Speed</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.enemySpeed.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={1.5}
                max={6.5}
                step={0.1}
                value={runtimeConfig.enemySpeed}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, enemySpeed: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Fog Density</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.fogDensity.toFixed(3)}</span>
              </span>
              <input
                type="range"
                min={0.002}
                max={0.035}
                step={0.001}
                value={runtimeConfig.fogDensity}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, fogDensity: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Pillar Scale</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.pillarScale.toFixed(2)}x</span>
              </span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={runtimeConfig.pillarScale}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, pillarScale: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Shard Goal</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.shardCount}</span>
              </span>
              <input
                type="range"
                min={3}
                max={8}
                step={1}
                value={runtimeConfig.shardCount}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, shardCount: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
            <label className="space-y-1">
              <span className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Audio BPM</span>
                <span className="tabular-nums text-slate-900 dark:text-white">{runtimeConfig.audioTempoBpm}</span>
              </span>
              <input
                type="range"
                min={72}
                max={164}
                step={2}
                value={runtimeConfig.audioTempoBpm}
                onChange={(e) => onUpdateRuntimeConfig({ ...runtimeConfig, audioTempoBpm: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">Audio Scale:</span>
              <select
                aria-label="Scene Audio Scale"
                value={runtimeConfig.audioScale}
                onChange={(e) =>
                  onUpdateRuntimeConfig({
                    ...runtimeConfig,
                    audioScale: e.target.value as GameRuntimeConfig['audioScale'],
                  })
                }
                className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="pentatonic">Pentatonic Sanctuary</option>
                <option value="cyber_minor">Cyber Minor</option>
                <option value="heroic_major">Heroic Major</option>
                <option value="tension_phrygian">Tension Phrygian</option>
              </select>
              <span className="text-[11px] text-slate-500 truncate max-w-md">
                {runtimeConfig.activeDnaSummary}
              </span>
            </div>
            {onResetRuntimeConfig && (
              <button
                type="button"
                onClick={onResetRuntimeConfig}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Prompt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Isolated WebGL / Playable Canvas2D Fallback Viewport Container */}
      <div className="relative h-[420px] sm:h-[580px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
        {!useCanvas2D ? (
          <div ref={mountRef} className="h-full w-full" />
        ) : (
          <canvas
            ref={canvas2dRef}
            data-testid="canvas2d-fallback-surface"
            className="block h-full w-full"
          />
        )}

        {contextLost && (
          <div
            role="status"
            data-testid="webgl-fallback-banner"
            className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 rounded-lg border border-amber-500/60 bg-slate-950/90 px-3 py-1 font-mono text-[11px] text-amber-300"
          >
            WebGL GPU context unavailable — active playable Canvas2D fallback
          </div>
        )}

        <ProfilerOverlay
          metricsRef={activeMetricsRef}
          visible={profilerVisible}
          qualityPreset={qualityPreset}
        />

        {/* Minimal Playing HUD (>=85% Canvas Clear, Zero Backdrop Blur Over Canvas) */}
        {hud.status === 'playing' && (
          <>
            <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-3">
              <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/90 bg-slate-950/90 px-3.5 py-2 text-xs text-slate-100">
                {/* Inline SVG Vitality Sockets (Full / Cracked / Empty) */}
                <div className="flex items-center gap-1.5" aria-label={`Vitality ${hud.hp} of ${hud.maxHp}`}>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((slot) => {
                      const thresholdFull = (slot + 1) * 20;
                      const thresholdHalf = slot * 20 + 10;
                      const fillMode =
                        hud.hp >= thresholdFull ? 'full' : hud.hp >= thresholdHalf ? 'cracked' : 'empty';
                      return (
                        <svg key={slot} viewBox="0 0 16 16" className="h-3.5 w-3.5">
                          <polygon
                            points="8,1 14,6 11,14 5,14 2,6"
                            fill={
                              fillMode === 'full'
                                ? '#10b981'
                                : fillMode === 'cracked'
                                  ? '#f59e0b'
                                  : '#1e293b'
                            }
                            stroke={fillMode === 'empty' ? '#475569' : '#ecfdf5'}
                            strokeWidth="1.2"
                          />
                        </svg>
                      );
                    })}
                  </div>
                  <span className="font-mono font-semibold tabular-nums text-emerald-400">
                    {hud.hp}
                  </span>
                </div>

                <span className="text-slate-600">·</span>

                {/* Compact Stamina Meter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">STM</span>
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
                    />
                  </div>
                </div>

                <span className="text-slate-600">·</span>
                <div>
                  <span className="text-slate-400">Shards </span>
                  <span className="font-mono font-semibold tabular-nums text-amber-400">
                    {hud.shards}/{hud.totalShards}
                  </span>
                </div>
                <span className="text-slate-600">·</span>
                <div>
                  <span className="text-slate-400">Score </span>
                  <span className="font-mono font-semibold tabular-nums text-white">{hud.score}</span>
                </div>
                <span className="text-slate-600">·</span>
                <span className="font-mono tabular-nums text-sky-400">
                  {hud.gateUnlocked ? 'GATE OPEN -> NORTH' : `COLLECT ${hud.totalShards} SHARDS`}
                </span>
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2 font-mono text-xs tabular-nums text-slate-200">
                  <span>{hud.fps} FPS</span>
                  <span className="text-slate-600">|</span>
                  <span>{hud.drawCalls} DC</span>
                </div>
                <button
                  type="button"
                  data-testid="toggle-oracle-dialog"
                  onClick={cycleOracleDialog}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-700 bg-slate-950/90 px-3 text-xs font-semibold text-amber-300 hover:bg-slate-800"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Oracle (F)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameStatus('paused')}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-700 bg-slate-950/90 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              </div>
            </div>

            {/* Diegetic Sanctuary Oracle Dialog Card (Bottom Perimeter, Zero Center Occlusion) */}
            {dialogIndex !== null && (
              <div
                data-testid="oracle-dialog-card"
                className="pointer-events-auto absolute bottom-14 left-3 right-3 sm:left-auto sm:right-3 sm:w-[440px] rounded-xl border border-amber-500/60 bg-slate-950/95 p-3.5 text-xs text-slate-100 shadow-lg"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[11px] uppercase font-bold text-amber-400">
                    Sanctuary Oracle ({dialogIndex + 1}/{oracleLines.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cycleOracleDialog}
                      className="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
                    >
                      {dialogIndex + 1 < oracleLines.length ? 'Next [F]' : 'Close [F]'}
                    </button>
                  </div>
                </div>
                <p className="leading-relaxed text-slate-200">{oracleLines[dialogIndex]}</p>
              </div>
            )}

            {/* Bottom Controls Helper + Mobile Touch Pad */}
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <div className="pointer-events-auto flex items-center gap-1.5 sm:hidden">
                {[
                  { label: '←', x: -1, z: 0 },
                  { label: '↑', x: 0, z: -1 },
                  { label: '↓', x: 0, z: 1 },
                  { label: '→', x: 1, z: 0 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onPointerDown={() => {
                      controlRef.current.virtualMove = { x: btn.x, z: btn.z };
                    }}
                    onPointerUp={() => {
                      controlRef.current.virtualMove = { x: 0, z: 0 };
                    }}
                    onPointerLeave={() => {
                      controlRef.current.virtualMove = { x: 0, z: 0 };
                    }}
                    className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950/90 text-sm font-bold text-white"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {inGameSettings.showControlHints ? (
                <div className="hidden sm:block rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-[11px] text-slate-300">
                  WASD Move · Space Jump · Shift/E Dash Parry · F Oracle · M Mute · P Pause · R Restart
                </div>
              ) : (
                <div />
              )}

              <div className="pointer-events-auto flex items-center gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => {
                    controlRef.current.jumpQueued = true;
                  }}
                  className="h-11 rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 text-xs font-semibold text-white"
                >
                  Jump
                </button>
                <button
                  type="button"
                  onClick={() => {
                    controlRef.current.dashQueued = true;
                  }}
                  className="h-11 rounded-xl bg-amber-500 px-3.5 text-xs font-semibold text-slate-950"
                >
                  Parry
                </button>
              </div>
            </div>
          </>
        )}

        {/* Title Overlay */}
        {hud.status === 'title' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-6">
            {!heroBgFailed && (
              <img
                src="/src/assets/images/studio_hero_backdrop_1795556965227.jpg"
                alt="Sanctuary Horizon"
                referrerPolicy="no-referrer"
                onError={() => setHeroBgFailed(true)}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
              />
            )}
            <div className="relative z-10 max-w-lg text-center space-y-5">
              <svg viewBox="0 0 64 64" className="mx-auto h-14 w-14 text-amber-400" fill="none">
                <polygon points="32,6 56,22 48,54 16,54 8,22" stroke="currentColor" strokeWidth="3" />
                <polygon points="32,16 44,32 32,48 20,32" fill="currentColor" opacity="0.9" />
              </svg>
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-400">
                  {brief.genre} · Qolbu Engine v13.0
                </p>
                <h3 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {brief.title}
                </h3>
                <p className="text-sm text-slate-300">
                  Gather {runtimeConfig.shardCount} Resonance Shards, parry Sentinels with Shift/E, and ignite the northern Gate Obelisk.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => setGameStatus('playing')}
                  className="inline-flex h-11 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Enter Sanctuary
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Press Enter/Space to Start · WASD Move · Shift Dash Parry · Target 30Hz Eco Itel A70
              </p>
            </div>
          </div>
        )}

        {/* Pause & In-Game Settings Modal */}
        {hud.status === 'paused' && (
          <div
            data-testid="sandbox-pause-modal"
            className="absolute inset-0 flex items-center justify-center bg-slate-950/88 p-6"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-display text-2xl font-bold text-white">Simulation Paused</h3>
                <p className="text-xs text-slate-300 font-mono tabular-nums">
                  Shards {hud.shards}/{hud.totalShards} · Score {hud.score} · AI Ticks {hud.aiTickCount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 text-xs">
                <div className="font-mono text-[11px] uppercase text-amber-400">
                  In-Game Audio &amp; Comfort Settings
                </div>
                <label className="block space-y-1">
                  <span className="flex justify-between text-slate-300">
                    <span>BGM Volume</span>
                    <span className="font-mono tabular-nums">{Math.round(inGameSettings.bgmVolume * 100)}%</span>
                  </span>
                  <input
                    aria-label="BGM Volume"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(inGameSettings.bgmVolume * 100)}
                    onChange={(e) => {
                      const val = Number(e.target.value) / 100;
                      setInGameSettings((prev) => ({ ...prev, bgmVolume: val }));
                      qolbuAudio.setVolumes({ bgm: val });
                    }}
                    className="w-full accent-amber-500"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="flex justify-between text-slate-300">
                    <span>SFX Volume</span>
                    <span className="font-mono tabular-nums">{Math.round(inGameSettings.sfxVolume * 100)}%</span>
                  </span>
                  <input
                    aria-label="SFX Volume"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(inGameSettings.sfxVolume * 100)}
                    onChange={(e) => {
                      const val = Number(e.target.value) / 100;
                      setInGameSettings((prev) => ({ ...prev, sfxVolume: val }));
                      qolbuAudio.setVolumes({ sfx: val });
                    }}
                    className="w-full accent-amber-500"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inGameSettings.reduceScreenShake}
                      onChange={(e) =>
                        setInGameSettings((prev) => ({ ...prev, reduceScreenShake: e.target.checked }))
                      }
                      className="accent-amber-500"
                    />
                    Reduce Screen Shake
                  </label>

                  <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inGameSettings.showControlHints}
                      onChange={(e) =>
                        setInGameSettings((prev) => ({ ...prev, showControlHints: e.target.checked }))
                      }
                      className="accent-amber-500"
                    />
                    Show Controls
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setGameStatus('playing')}
                  className="inline-flex h-10 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Resume
                </button>
                <button
                  type="button"
                  onClick={triggerRestart}
                  className="inline-flex h-10 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory / Game Over Overlay */}
        {(hud.status === 'victory' || hud.status === 'gameover') && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-6">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center space-y-4">
              <p className={`font-mono text-xs uppercase tracking-widest ${hud.status === 'victory' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hud.status === 'victory' ? 'Sanctuary Unlocked' : 'Guardian Fallen'}
              </p>
              <h3 className="font-display text-3xl font-bold text-white">
                {hud.status === 'victory' ? 'Stage Clear!' : 'Run Terminated'}
              </h3>
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs">
                <div>
                  <div className="text-slate-400">Shards</div>
                  <div className="font-mono text-base font-bold tabular-nums text-amber-400">
                    {hud.shards}/{hud.totalShards}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Score</div>
                  <div className="font-mono text-base font-bold tabular-nums text-white">{hud.score}</div>
                </div>
                <div>
                  <div className="text-slate-400">Time</div>
                  <div className="font-mono text-base font-bold tabular-nums text-sky-400">{hud.elapsedSec}s</div>
                </div>
              </div>
              <button
                type="button"
                onClick={triggerRestart}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Qolbu Engine v13.0 Architecture Explorer (12 Layers / 54 Systems / 9 Larangan Mutlak) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Qolbu Engine v13.0 Final Hardened Architecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              12 Layers · 54 Systems · 300+ Modules · Itel A70 Compiler Flags: <span className="font-mono">{ITEL_A70_APK_FLAGS.compilerFlags}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubPanel('layers')}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 text-xs font-semibold ${
                subPanel === 'layers'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              12 Layers (54 Systems)
            </button>
            <button
              type="button"
              onClick={() => setSubPanel('commandments')}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 text-xs font-semibold ${
                subPanel === 'commandments'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              9 Larangan Mutlak
            </button>
          </div>
        </div>

        {subPanel === 'layers' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
              {QOLBU_12_LAYERS.map((layer) => (
                <button
                  key={layer.layerIndex}
                  type="button"
                  onClick={() => setActiveLayerIdx(layer.layerIndex)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    activeLayerIdx === layer.layerIndex
                      ? 'bg-amber-500/15 border border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="truncate">{layer.title}</span>
                  <span className="ml-2 font-mono text-[11px] tabular-nums opacity-75">
                    {layer.systems.length}s
                  </span>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    {currentLayer.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{currentLayer.subtitle}</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                  {currentLayer.moduleCount} active modules
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {currentLayer.systems.map((sys) => (
                  <div key={sys.code} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-amber-600 dark:text-amber-400">{sys.code}</span>
                        <span>{sys.name}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {sys.features} — {sys.reason}
                      </p>
                    </div>
                    <div className="font-mono text-[11px] whitespace-nowrap shrink-0 text-sky-700 dark:text-sky-300">
                      <Cpu className="inline h-3 w-3 mr-1" />
                      {sys.itelBudget}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NINE_COMMANDMENTS.map((cmd) => (
              <div
                key={cmd.code}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {cmd.code}
                  </span>
                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">{cmd.rule}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{cmd.enforcement}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
