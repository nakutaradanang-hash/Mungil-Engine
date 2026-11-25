/**
 * Deterministic Gameplay Kernel Utilities.
 * Adopts patterns from rot.js (seeded Mulberry32 PRNG), Rapier/Collision sweeps (Circle-vs-AABB push-out),
 * Yuka (Attack Token Crowd Pool), and spring damping / quadratic trauma camera shake.
 */

export class SeededPrng {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export class AttackTokenPool {
  private readonly maxConcurrent: number;
  private readonly owners = new Set<number>();

  constructor(maxConcurrent = 2) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  acquire(enemyIdx: number): boolean {
    if (this.owners.has(enemyIdx)) return true;
    if (this.owners.size >= this.maxConcurrent) return false;
    this.owners.add(enemyIdx);
    return true;
  }

  release(enemyIdx: number): void {
    this.owners.delete(enemyIdx);
  }

  clear(): void {
    this.owners.clear();
  }

  activeCount(): number {
    return this.owners.size;
  }
}

export interface CircleAabbResolution {
  collided: boolean;
  x: number;
  z: number;
}

/**
 * Zero-allocation scalar Circle vs AABB collision push-out in XZ plane.
 * Keeps hero and AI entities sliding smoothly around architectural pillars & gate pedestal.
 */
export function resolveCircleAabbCollision(
  cx: number,
  cz: number,
  radius: number,
  boxX: number,
  boxZ: number,
  halfW: number,
  halfD: number,
  out: CircleAabbResolution = { collided: false, x: cx, z: cz }
): CircleAabbResolution {
  const closestX = Math.max(boxX - halfW, Math.min(cx, boxX + halfW));
  const closestZ = Math.max(boxZ - halfD, Math.min(cz, boxZ + halfD));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    out.collided = false;
    out.x = cx;
    out.z = cz;
    return out;
  }

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const push = radius - dist;
    out.collided = true;
    out.x = cx + (dx / dist) * push;
    out.z = cz + (dz / dist) * push;
    return out;
  }

  // Fallback when circle center is exactly inside box
  const penLeft = Math.abs(cx - (boxX - halfW));
  const penRight = Math.abs(boxX + halfW - cx);
  const penTop = Math.abs(cz - (boxZ - halfD));
  const penBottom = Math.abs(boxZ + halfD - cz);
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);

  out.collided = true;
  if (minPen === penLeft) {
    out.x = boxX - halfW - radius;
    out.z = cz;
  } else if (minPen === penRight) {
    out.x = boxX + halfW + radius;
    out.z = cz;
  } else if (minPen === penTop) {
    out.x = cx;
    out.z = boxZ - halfD - radius;
  } else {
    out.x = cx;
    out.z = boxZ + halfD + radius;
  }
  return out;
}

export function stepExponentialDamp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function advanceTrauma(trauma: number, dt: number, decayPerSec = 2.4): {
  nextTrauma: number;
  shakeIntensity: number;
} {
  const clamped = Math.min(1, Math.max(0, trauma));
  const shakeIntensity = clamped * clamped;
  const nextTrauma = Math.max(0, clamped - decayPerSec * dt);
  return { nextTrauma, shakeIntensity };
}
