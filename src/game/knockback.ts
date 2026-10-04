import { KNOCKBACK_UNITS, KNOCKBACK_TAU_MS } from './constants';

// ---------------------------------------------------------------------------
// Minecraft-style knockback.
//
// A hit sets an instant velocity directly away from the attacker (it replaces any
// knockback already in progress, like Minecraft) and that velocity decays
// exponentially, so the player is thrown hard and slides to a stop. The total
// distance travelled is exactly `units` (default 46) no matter the frame rate.
//
// Note: the old player.pushVx / pushVy fields were set by boss attacks but were
// never applied anywhere in the game loop, so no hit ever pushed the player.
// ---------------------------------------------------------------------------

export interface KnockbackTarget {
  x: number;
  y: number;
  kbVx?: number;
  kbVy?: number;
  kbReadyAt?: number;
}

/** Throw `target` `units` away from (fromX, fromY). cooldownMs > 0 ignores repeat calls inside that window. */
export function applyKnockback(
  target: KnockbackTarget,
  fromX: number,
  fromY: number,
  now: number,
  units: number = KNOCKBACK_UNITS,
  cooldownMs = 0
): boolean {
  if (cooldownMs > 0 && now < (target.kbReadyAt || 0)) return false;
  let dx = target.x - fromX;
  let dy = target.y - fromY;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) {
    const a = Math.random() * Math.PI * 2; // exactly on top of the attacker: any direction
    dx = Math.cos(a);
    dy = Math.sin(a);
    d = 1;
  }
  const v0 = units / KNOCKBACK_TAU_MS; // px per ms; total travel = v0 * tau = units
  target.kbVx = (dx / d) * v0;
  target.kbVy = (dy / d) * v0;
  if (cooldownMs > 0) target.kbReadyAt = now + cooldownMs;
  return true;
}

export function cancelKnockback(target: KnockbackTarget) {
  target.kbVx = 0;
  target.kbVy = 0;
}

/** Advance the slide by dt ms. Uses the exact integral of the decay so distance is frame-rate independent. */
export function stepKnockback(target: KnockbackTarget, dt: number) {
  const vx = target.kbVx || 0;
  const vy = target.kbVy || 0;
  if (vx === 0 && vy === 0) return;
  const k = Math.exp(-dt / KNOCKBACK_TAU_MS);
  const f = KNOCKBACK_TAU_MS * (1 - k);
  target.x += vx * f;
  target.y += vy * f;
  target.kbVx = vx * k;
  target.kbVy = vy * k;
  if (Math.hypot(target.kbVx, target.kbVy) < 0.0002) {
    target.kbVx = 0;
    target.kbVy = 0;
  }
}

/** Throw `target` `units` along the given direction vector (used for charge rams). */
export function applyKnockbackDir(target: KnockbackTarget, dirX: number, dirY: number, units: number): void {
  const d = Math.hypot(dirX, dirY) || 1;
  const v0 = units / KNOCKBACK_TAU_MS;
  target.kbVx = (dirX / d) * v0;
  target.kbVy = (dirY / d) * v0;
}
