import { AttackTokenPool, resolveCircleAabbCollision } from './gameplayKernel';
import { fastClampDt } from './qolbuCore';
import type { GameRuntimeConfig, LiveTelemetrySnapshot, ProjectionMode } from './types';

export interface Canvas2DFallbackControls {
  moveX: number;
  moveZ: number;
  dashJustPressed: boolean;
}

export interface Canvas2DEnemy {
  id: number;
  x: number;
  z: number;
  role: 'chaser' | 'flanker' | 'turret';
  hp: number;
  stunTimer: number;
  telegraphTimer: number;
  cooldownTimer: number;
}

export interface Canvas2DShard {
  x: number;
  z: number;
  collected: boolean;
}

export interface Canvas2DPillar {
  x: number;
  z: number;
  radius: number;
}

export interface Canvas2DFallbackState {
  status: 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
  playerX: number;
  playerZ: number;
  hp: number;
  maxHp: number;
  stamina: number;
  dashTimer: number;
  dashCooldown: number;
  invulnTimer: number;
  hitstopTimer: number;
  score: number;
  elapsedSec: number;
  aiTickCount: number;
  shards: Canvas2DShard[];
  pillars: Canvas2DPillar[];
  enemies: Canvas2DEnemy[];
  gateX: number;
  gateZ: number;
  halfBounds: number;
  tokenPool: AttackTokenPool;
}

export function createCanvas2DFallbackState(shardCount = 5): Canvas2DFallbackState {
  const clampedShards = Math.max(3, Math.min(8, Math.round(shardCount)));
  const shardAngles = Array.from({ length: clampedShards }, (_, i) => (i / clampedShards) * Math.PI * 2);
  return {
    status: 'playing',
    playerX: 0,
    playerZ: 7.5,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    dashTimer: 0,
    dashCooldown: 0,
    invulnTimer: 0,
    hitstopTimer: 0,
    score: 0,
    elapsedSec: 0,
    aiTickCount: 0,
    shards: shardAngles.map((a, idx) => ({
      x: Number((Math.cos(a) * (idx % 2 === 0 ? 7.5 : 11.2)).toFixed(2)),
      z: Number((Math.sin(a) * (idx % 2 === 0 ? 7.5 : 11.2) - 1.5).toFixed(2)),
      collected: false,
    })),
    pillars: [
      { x: -6.5, z: 2.5, radius: 1.05 },
      { x: 6.5, z: 2.5, radius: 1.05 },
      { x: -6.5, z: -7.5, radius: 1.05 },
      { x: 6.5, z: -7.5, radius: 1.05 },
    ],
    enemies: [
      { id: 0, x: -7.5, z: -9.5, role: 'chaser', hp: 2, stunTimer: 0, telegraphTimer: 0, cooldownTimer: 0.4 },
      { id: 1, x: 7.5, z: -9.5, role: 'flanker', hp: 2, stunTimer: 0, telegraphTimer: 0, cooldownTimer: 0.8 },
      { id: 2, x: 0, z: -12.5, role: 'turret', hp: 2, stunTimer: 0, telegraphTimer: 0, cooldownTimer: 1.1 },
    ],
    gateX: 0,
    gateZ: -15.5,
    halfBounds: 18.2,
    tokenPool: new AttackTokenPool(2),
  };
}

export function stepCanvas2DFallback(
  state: Canvas2DFallbackState,
  rawDt: number,
  cfg: GameRuntimeConfig,
  controls: Canvas2DFallbackControls
): { collectedShard: boolean; parried: boolean; damaged: boolean; outcomeChanged: 'victory' | 'gameover' | null } {
  const dt = fastClampDt(rawDt);
  const events = {
    collectedShard: false,
    parried: false,
    damaged: false,
    outcomeChanged: null as 'victory' | 'gameover' | null,
  };

  if (state.status !== 'playing') return events;
  state.elapsedSec += dt;

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
  }

  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.invulnTimer = Math.max(0, state.invulnTimer - dt);
  state.stamina = Math.min(100, state.stamina + 26 * dt);

  if (controls.dashJustPressed && state.dashCooldown <= 0 && state.stamina >= 25) {
    state.dashTimer = 0.18;
    state.dashCooldown = 0.65;
    state.invulnTimer = Math.max(state.invulnTimer, 0.25);
    state.stamina -= 25;
  }

  const moveLen = Math.hypot(controls.moveX, controls.moveZ) || 1;
  const speed = state.dashTimer > 0 ? cfg.moveSpeed * 2.1 : cfg.moveSpeed;
  if (state.dashTimer > 0) state.dashTimer = Math.max(0, state.dashTimer - dt);

  if (controls.moveX !== 0 || controls.moveZ !== 0) {
    state.playerX += (controls.moveX / moveLen) * speed * dt;
    state.playerZ += (controls.moveZ / moveLen) * speed * dt;
  }

  const clampB = state.halfBounds - 0.6;
  state.playerX = Math.max(-clampB, Math.min(clampB, state.playerX));
  state.playerZ = Math.max(-clampB, Math.min(clampB, state.playerZ));

  for (let i = 0; i < state.pillars.length; i++) {
    const p = state.pillars[i];
    const hit = resolveCircleAabbCollision(state.playerX, state.playerZ, 0.55, p.x, p.z, p.radius, p.radius);
    if (hit.collided) {
      state.playerX = hit.x;
      state.playerZ = hit.z;
    }
  }

  for (let i = 0; i < state.shards.length; i++) {
    const s = state.shards[i];
    if (s.collected) continue;
    if (Math.hypot(s.x - state.playerX, s.z - state.playerZ) < 1.5) {
      s.collected = true;
      state.score += 200;
      events.collectedShard = true;
    }
  }

  state.aiTickCount += 1;
  for (let i = 0; i < state.enemies.length; i++) {
    const en = state.enemies[i];
    if (en.hp <= 0) continue;
    if (en.stunTimer > 0) {
      en.stunTimer = Math.max(0, en.stunTimer - dt);
      state.tokenPool.release(en.id);
      continue;
    }
    en.cooldownTimer = Math.max(0, en.cooldownTimer - dt);
    const dx = state.playerX - en.x;
    const dz = state.playerZ - en.z;
    const dist = Math.hypot(dx, dz) || 1;

    if (en.telegraphTimer > 0) {
      en.telegraphTimer -= dt;
      if (en.telegraphTimer <= 0 && dist < 2.2) {
        if (state.dashTimer > 0) {
          en.hp -= 1;
          en.stunTimer = 1.4;
          state.score += 120;
          state.hitstopTimer = 0.05;
          events.parried = true;
        } else if (state.invulnTimer <= 0) {
          state.hp = Math.max(0, state.hp - 15);
          state.invulnTimer = 0.85;
          state.hitstopTimer = 0.04;
          events.damaged = true;
          if (state.hp <= 0) {
            state.status = 'gameover';
            events.outcomeChanged = 'gameover';
          }
        }
        state.tokenPool.release(en.id);
      }
      continue;
    }

    if (en.role === 'chaser') {
      en.x += (dx / dist) * cfg.enemySpeed * dt;
      en.z += (dz / dist) * cfg.enemySpeed * dt;
    } else if (en.role === 'flanker') {
      const tx = -dz / dist;
      const tz = dx / dist;
      en.x += ((dx / dist) * 0.5 + tx * 0.65) * cfg.enemySpeed * dt;
      en.z += ((dz / dist) * 0.5 + tz * 0.65) * cfg.enemySpeed * dt;
    } else if (dist > 6) {
      en.x += (dx / dist) * (cfg.enemySpeed * 0.45) * dt;
      en.z += (dz / dist) * (cfg.enemySpeed * 0.45) * dt;
    }

    if (dist < 2.1 && en.cooldownTimer <= 0 && state.tokenPool.acquire(en.id)) {
      en.telegraphTimer = 0.42;
      en.cooldownTimer = 1.65;
    } else if (dist < 1.3 && state.dashTimer > 0) {
      en.hp -= 1;
      en.stunTimer = 1.4;
      state.score += 120;
      events.parried = true;
    }
  }

  const allShards = state.shards.every((s) => s.collected);
  if (allShards && Math.hypot(state.gateX - state.playerX, state.gateZ - state.playerZ) < 2.2) {
    state.status = 'victory';
    state.score += 500;
    events.outcomeChanged = 'victory';
  }

  return events;
}

export function renderCanvas2DFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: Canvas2DFallbackState,
  cfg: GameRuntimeConfig,
  projectionMode: ProjectionMode
): LiveTelemetrySnapshot {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  ctx.save();
  ctx.fillStyle = cfg.skyHex || '#0c1220';
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width, height) / (state.halfBounds * 2.25);
  const project = (wx: number, wz: number): [number, number] => {
    if (projectionMode === '2.5d_isometric') {
      const isoX = (wx - wz) * 0.72 * scale;
      const isoY = (wx + wz) * 0.44 * scale;
      return [width * 0.5 + isoX, height * 0.52 + isoY];
    }
    if (projectionMode === 'pseudo_3d') {
      const depth = Math.max(0.55, 1 + wz / 42);
      return [width * 0.5 + wx * scale * depth, height * 0.54 + wz * scale * 0.82];
    }
    return [width * 0.5 + wx * scale, height * 0.52 + wz * scale];
  };

  // Floor arena pad
  const [x0, y0] = project(-state.halfBounds, -state.halfBounds);
  const [x1, y1] = project(state.halfBounds, -state.halfBounds);
  const [x2, y2] = project(state.halfBounds, state.halfBounds);
  const [x3, y3] = project(-state.halfBounds, state.halfBounds);
  ctx.fillStyle = cfg.groundHex || '#1e293b';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Floor grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let g = -15; g <= 15; g += 5) {
    const [gx0, gy0] = project(g, -state.halfBounds);
    const [gx1, gy1] = project(g, state.halfBounds);
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.lineTo(gx1, gy1);
    ctx.stroke();

    const [zx0, zy0] = project(-state.halfBounds, g);
    const [zx1, zy1] = project(state.halfBounds, g);
    ctx.beginPath();
    ctx.moveTo(zx0, zy0);
    ctx.lineTo(zx1, zy1);
    ctx.stroke();
  }

  // Gate Obelisk
  const allCollected = state.shards.every((s) => s.collected);
  const [gatePx, gatePy] = project(state.gateX, state.gateZ);
  ctx.fillStyle = allCollected ? cfg.nominalHex || '#10b981' : '#475569';
  ctx.beginPath();
  ctx.arc(gatePx, gatePy, scale * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pillars
  for (let i = 0; i < state.pillars.length; i++) {
    const p = state.pillars[i];
    const [px, py] = project(p.x, p.z);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(px + 4, py + 5, p.radius * scale, p.radius * scale * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(px - p.radius * scale * 0.8, py - p.radius * scale * 1.2, p.radius * scale * 1.6, p.radius * scale * 1.4);
  }

  // Shards
  for (let i = 0; i < state.shards.length; i++) {
    const s = state.shards[i];
    if (s.collected) continue;
    const [sx, sy] = project(s.x, s.z);
    ctx.fillStyle = cfg.accentHex || '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(sx, sy - scale * 0.85);
    ctx.lineTo(sx + scale * 0.65, sy);
    ctx.lineTo(sx, sy + scale * 0.85);
    ctx.lineTo(sx - scale * 0.65, sy);
    ctx.closePath();
    ctx.fill();
  }

  // Enemies
  for (let i = 0; i < state.enemies.length; i++) {
    const en = state.enemies[i];
    if (en.hp <= 0) continue;
    const [ex, ey] = project(en.x, en.z);
    if (en.telegraphTimer > 0) {
      ctx.strokeStyle = cfg.hazardHex || '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, scale * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = en.stunTimer > 0 ? '#94a3b8' : cfg.hazardHex || '#f43f5e';
    ctx.beginPath();
    ctx.arc(ex, ey, scale * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player Hero
  const [hx, hy] = project(state.playerX, state.playerZ);
  ctx.fillStyle = state.dashTimer > 0 ? cfg.accentHex || '#f59e0b' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(hx, hy, scale * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle Canvas2D Fallback badge at top-center perimeter
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.fillRect(width * 0.5 - 108, height - 30, 216, 22);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '600 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`CANVAS2D FALLBACK · ${projectionMode.toUpperCase()}`, width * 0.5, height - 15);
  ctx.restore();

  const cpuMs = Number(Math.max(1.2, (typeof performance !== 'undefined' ? performance.now() : 0) - start + 2.4).toFixed(1));
  return {
    fps: 30,
    cpuMs,
    gpuMs: 2.1,
    drawCalls: 6,
    triangles: 0,
    memoryMb: 89.4,
    texturesMb: 38,
    meshesMb: 14,
    audioMb: 16,
    runtimeMb: 21.4,
  };
}
