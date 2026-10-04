import type { Boss, PlayerState } from '../types/game';

// ---------------------------------------------------------------------------
// Skill-combat layer: Parry [X], Perfect Dodge (late Shift-dash), boss Posture /
// Stagger, and a Momentum meter. Kept in one module so App.tsx only calls hooks.
// ---------------------------------------------------------------------------

export const DASH_DURATION_MS = 200;

/** Parry: press X shortly BEFORE a heavy hit lands. */
export const PARRY_WINDOW_MS = 220;
/** Late press (just after window closes) = partial block. */
export const PARRY_LATE_GRACE_MS = 140;
/** Whiffed / spammed parry leaves you unable to parry again for this long. */
export const PARRY_COOLDOWN_MS = 750;

/** Perfect dodge: heavy hit lands within this many ms after the dash started. */
export const PERFECT_DODGE_WINDOW_MS = 110;
/** After a perfect dodge, boss posture damage is doubled for this long. */
export const PERFECT_DODGE_BONUS_MS = 2200;

/** Hits below this are chip/DoT ticks and never count for parry / perfect dodge. */
export const HEAVY_HIT_MIN = 15;

export const POSTURE_MAX = 100;
export const STAGGER_MS = 2600;
const POSTURE_REGEN_DELAY_MS = 3000;
const POSTURE_REGEN_PER_SEC = 14;

export const MOMENTUM_MAX = 100;
const MOMENTUM_IDLE_MS = 4000;
const MOMENTUM_DECAY_PER_SEC = 7;

export function isStaggered(boss: Boss, now: number): boolean {
  return boss.staggerUntil !== undefined && now < boss.staggerUntil;
}

/** True when this boss state must not be interrupted into a stagger. */
function isUninterruptible(boss: Boss, now: number): boolean {
  if (boss.state === 'entering' || boss.state === 'roar') return true;
  if (boss.phaseTransitionUntil !== undefined && now < boss.phaseTransitionUntil) return true;
  if (boss.splitActive) return true;
  return false;
}

/**
 * Adds posture damage. Returns true if this hit broke the boss's posture.
 * A stagger reuses the existing 'dizzy' state so the render + AI already handle it.
 */
export function addPosture(
  boss: Boss,
  amount: number,
  now: number,
  fx: { text: (x: number, y: number, s: string, color: string, size?: number) => void; shake: (n: number) => void; burst: (x: number, y: number, color: string, n: number, speed: number, life: number) => void }
): boolean {
  if (boss.dead || amount <= 0) return false;
  if (isStaggered(boss, now) || isUninterruptible(boss, now)) return false;
  boss.posture = Math.min(POSTURE_MAX, (boss.posture ?? 0) + amount);
  boss.lastPostureHit = now;
  if (boss.posture < POSTURE_MAX) return false;

  // POSTURE BREAK
  boss.posture = 0;
  boss.staggerUntil = now + STAGGER_MS;
  boss.state = 'dizzy';
  boss.stateTimer = STAGGER_MS;
  boss.height = 0;
  boss.vHeight = 0;
  boss.staggerCount = (boss.staggerCount ?? 0) + 1;
  fx.text(boss.x, boss.y - boss.r - 60, 'POSTURE BROKEN!', '#ffd166', 24);
  fx.shake(18);
  fx.burst(boss.x, boss.y, '#ffd166', 28, 9, 500);
  return true;
}

/** Per-frame upkeep: posture regen (only if the player disengages) + momentum decay. */
export function tickCombat(player: PlayerState, boss: Boss | null, now: number, dtMs: number): void {
  if (boss && !boss.dead && !isStaggered(boss, now) && (boss.posture ?? 0) > 0) {
    if (now - (boss.lastPostureHit ?? 0) > POSTURE_REGEN_DELAY_MS) {
      boss.posture = Math.max(0, (boss.posture ?? 0) - (POSTURE_REGEN_PER_SEC * dtMs) / 1000);
    }
  }
  if ((player.momentum ?? 0) > 0 && now - (player.lastMomentumGain ?? 0) > MOMENTUM_IDLE_MS) {
    player.momentum = Math.max(0, (player.momentum ?? 0) - (MOMENTUM_DECAY_PER_SEC * dtMs) / 1000);
  }
}

export function addMomentum(player: PlayerState, amount: number, now: number): void {
  player.momentum = Math.max(0, Math.min(MOMENTUM_MAX, (player.momentum ?? 0) + amount));
  player.lastMomentumGain = now;
}

/** +0% .. +30% damage at full momentum. */
export function momentumDamageMul(player: PlayerState): number {
  return 1 + ((player.momentum ?? 0) / MOMENTUM_MAX) * 0.3;
}

/** Called on X press. Returns true if a parry window was opened. */
export function tryStartParry(player: PlayerState, now: number): boolean {
  if (player.hp <= 0) return false;
  if (now < (player.parryCdUntil ?? 0)) return false;
  player.parryUntil = now + PARRY_WINDOW_MS;
  player.parryCdUntil = now + PARRY_WINDOW_MS + PARRY_COOLDOWN_MS; // lowered on a successful parry
  return true;
}

export type DefenseResult =
  | { kind: 'none' }
  | { kind: 'parry' }
  | { kind: 'lateBlock' }
  | { kind: 'perfectDodge' };

/** Classifies an incoming hit against the player's current defensive timing. */
export function classifyIncomingHit(player: PlayerState, dmg: number, now: number): DefenseResult {
  if (dmg < HEAVY_HIT_MIN) return { kind: 'none' };
  const parryUntil = player.parryUntil ?? 0;
  if (now < parryUntil) return { kind: 'parry' };
  if (now >= parryUntil && now < parryUntil + PARRY_LATE_GRACE_MS && parryUntil > 0) return { kind: 'lateBlock' };
  if (now < player.dashLockedUntil && now - (player.lastDashAt ?? 0) <= PERFECT_DODGE_WINDOW_MS) {
    return { kind: 'perfectDodge' };
  }
  return { kind: 'none' };
}

/** World-space overlay: boss posture bar + player momentum / parry-ready indicator. */
export function drawCombatOverlay(ctx: CanvasRenderingContext2D, boss: Boss | null, player: PlayerState, now: number): void {
  if (boss && !boss.dead) {
    const w = Math.max(70, boss.r * 2.2);
    const x = boss.x - w / 2;
    const y = boss.y - boss.height - boss.r - 22;
    const staggered = isStaggered(boss, now);
    const frac = staggered ? 1 : Math.min(1, (boss.posture ?? 0) / POSTURE_MAX);
    if (staggered || frac > 0.02) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 1, y - 1, w + 2, 7);
      ctx.fillStyle = staggered ? (Math.floor(now / 100) % 2 ? '#ffe066' : '#ff9f1c') : '#f4a261';
      ctx.fillRect(x, y, w * frac, 5);
      ctx.restore();
    }
  }

  const mom = (player.momentum ?? 0) / MOMENTUM_MAX;
  const parryReady = now >= (player.parryCdUntil ?? 0);
  ctx.save();
  if (mom > 0.02) {
    const w = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(player.x - w / 2 - 1, player.y + player.r + 9, w + 2, 5);
    ctx.fillStyle = mom > 0.7 ? '#ff4d5e' : '#83d3e1';
    ctx.fillRect(player.x - w / 2, player.y + player.r + 10, w * mom, 3);
  }
  if (now < (player.parryUntil ?? 0)) {
    // Active parry window — bright ring so the timing is readable
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (!parryReady) {
    ctx.strokeStyle = 'rgba(160,160,160,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
