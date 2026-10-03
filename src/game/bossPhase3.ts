import { Boss, BossClone, BossOrb, PlayerState, Tank, Phase3State } from '../types/game';
import {
  SPLIT_STAT_MUL,
  SPLIT_CLONE_COUNT,
  SPLIT_BREAK_FRACTION,
  CLONE_STRIKE_DMG,
  MISSILE_TURN,
  METEOR_FALL_MS,
  METEOR_BLAST_R,
  CRATER_R,
  CRATER_LIFE_MS,
  CRATER_MAX,
} from './constants';

// ---------------------------------------------------------------------------
// Phase 3 — "Phantom Split" and the final stand.
//
// The real boss splits into 3 bodies (itself + 2 clones). Every body deals half
// damage, and only the real boss's timers spawn zombies, so 3 bodies is NOT 3x
// the summons. Each body has its own "dizzy" meter worth 1/6 of the phase-3
// health pool (150 of 900). Damage to a body fills its meter and drains the
// boss's health by the same amount, so the bar still moves — but a body can
// never be killed here, only broken. When the third body goes dizzy the clones
// turn transparent and are dragged into the real boss; whatever health is left
// is the "final hearts" for the final stand (meteors, thrown weapon, missile).
// ---------------------------------------------------------------------------

export interface SplitFx {
  spawnFloater: (x: number, y: number, text: string, color?: string, size?: number) => void;
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void;
  addScreenShake: (amount: number) => void;
}

export interface Phase3Fx extends SplitFx {
  applyPlayerDamage: (dmg: number, isRanged?: boolean) => void;
  flashVignette: () => void;
}

export function createPhase3State(): Phase3State {
  return { clones: [], meteors: [], craters: [], flash: 0, flashAt: 0, crackX: 0, crackY: 0, crackSeed: 1 };
}

export function resetPhase3(p3: Phase3State) {
  p3.clones.length = 0;
  p3.meteors.length = 0;
  p3.craters.length = 0;
  p3.flash = 0;
  p3.flashAt = 0;
}

/** Damage scale for the boss's current gate tier / enrage / split state. */
export function bossDmgScale(boss: Boss): number {
  const gateTier = boss.doorIndex ? Math.floor((boss.doorIndex - 1) / 2) : 0;
  return (1 + gateTier * 0.22) * (boss.enraged ? 1.25 : 1) * (boss.splitActive ? SPLIT_STAT_MUL : 1);
}

function clampTo(bounds: { minX: number; maxX: number; minY: number; maxY: number }, v: number, lo: 'x' | 'y', pad: number) {
  return lo === 'x' ? Math.max(bounds.minX + pad, Math.min(bounds.maxX - pad, v)) : Math.max(bounds.minY + pad, Math.min(bounds.maxY - pad, v));
}

export function startSplit(
  boss: Boss,
  p3: Phase3State,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  fx: SplitFx,
  cloud: (x: number, y: number) => void
) {
  const pool = boss.hp;
  boss.splitActive = true;
  boss.splitDone = true;
  boss.splitDizzy = false;
  boss.splitMeter = 0;
  boss.splitMeterMax = Math.max(1, pool * SPLIT_BREAK_FRACTION);
  p3.clones.length = 0;
  for (let i = 0; i < SPLIT_CLONE_COUNT; i++) {
    const a = boss.facingAng + (i === 0 ? 1 : -1) * Math.PI * 0.62;
    const x = clampTo(bounds, boss.x + Math.cos(a) * 190, 'x', boss.r);
    const y = clampTo(bounds, boss.y + Math.sin(a) * 190, 'y', boss.r);
    p3.clones.push({
      id: Math.random().toString(),
      isClone: true,
      skinKey: boss.skin.key,
      x,
      y,
      r: boss.r,
      color: boss.color,
      facingAng: boss.facingAng,
      squash: 1.3,
      alpha: 1,
      state: 'chasing',
      stateTimer: 0,
      atkCd: 1200,
      meter: 0,
      meterMax: boss.splitMeterMax,
    });
    cloud(x, y);
  }
  fx.spawnFloater(boss.x, boss.y - 130, '👥 PHANTOM SPLIT — BREAK ALL THREE!', '#c9c9ff', 24);
  fx.addScreenShake(24);
}

/** Routes a hit on any of the 3 bodies into that body's dizzy meter. */
export function damageSplitBody(
  boss: Boss,
  p3: Phase3State,
  target: Boss | BossClone,
  dmg: number,
  fx: SplitFx
) {
  const clone = 'isClone' in target ? target : null;
  const dizzy = clone ? clone.state !== 'chasing' : !!boss.splitDizzy;
  if (dizzy) {
    fx.spawnFloater(target.x, target.y - target.r - 24, '💫 DIZZY', '#c9c9d6', 13);
    return;
  }
  const meter = clone ? clone.meter : boss.splitMeter || 0;
  const max = clone ? clone.meterMax : boss.splitMeterMax || 1;
  const applied = Math.min(dmg, max - meter);
  if (applied <= 0) return;

  // The boss's health bar still shrinks, but a split body can't be killed.
  boss.hp = Math.max(1, boss.hp - applied);
  const next = meter + applied;
  if (clone) clone.meter = next;
  else boss.splitMeter = next;

  fx.spawnFloater(target.x + (Math.random() - 0.5) * 20, target.y - target.r - 12, `-${Math.round(applied)}`, '#ffd166', 18);
  fx.createParticles(target.x, target.y, '#b9b9ff', 4, 4, 250);

  if (next >= max - 0.001) {
    if (clone) {
      clone.state = 'dizzy';
    } else {
      boss.splitDizzy = true;
      boss.state = 'dizzy';
      boss.height = 0;
      boss.vHeight = 0;
    }
    fx.spawnFloater(target.x, target.y - target.r - 40, '💫 DIZZY!', '#ffe066', 22);
    fx.createParticles(target.x, target.y, '#ffe066', 24, 8, 500);
    fx.addScreenShake(10);
    tryMerge(boss, p3, fx);
  }
}

/** When all 3 bodies are dizzy, the clones turn transparent and are dragged into the boss. */
export function tryMerge(boss: Boss, p3: Phase3State, fx: SplitFx) {
  if (!boss.splitActive || !boss.splitDizzy) return;
  if (p3.clones.some((c) => c.state === 'chasing')) return;
  let started = false;
  for (const c of p3.clones) {
    if (c.state === 'dizzy') {
      c.state = 'absorbing';
      c.stateTimer = 1300;
      started = true;
    }
  }
  if (started) {
    fx.spawnFloater(boss.x, boss.y - 130, '👻 THE CLONES ARE DRAWN INTO ITS BODY...', '#cfd4ff', 20);
    fx.addScreenShake(14);
  }
}

function updateClones(
  p3: Phase3State,
  boss: Boss,
  player: PlayerState,
  tank: Tank,
  dt: number,
  now: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  fx: Phase3Fx
) {
  for (let i = p3.clones.length - 1; i >= 0; i--) {
    const c = p3.clones[i];
    // Safety: if the split ended some other way, don't leave clones hanging around.
    if (!boss.splitActive && c.state !== 'absorbing') {
      c.state = 'absorbing';
      c.stateTimer = 700;
    }
    c.squash += (1 - c.squash) * Math.min(1, dt / 120);

    if (c.state === 'chasing') {
      const ang = Math.atan2(player.y - c.y, player.x - c.x);
      c.facingAng = ang;
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      const speed = boss.baseSpeed * 0.85 * (boss.enraged ? 2 : 1);
      if (d > c.r + player.r + 24) {
        c.x += Math.cos(ang) * speed;
        c.y += Math.sin(ang) * speed;
      }
      c.x = clampTo(bounds, c.x, 'x', c.r);
      c.y = clampTo(bounds, c.y, 'y', c.r);
      c.squash = 1 + Math.sin(now / 90) * 0.06;
      c.atkCd -= dt;
      if (d < c.r + player.r + 40 && c.atkCd <= 0) {
        c.atkCd = 1400;
        c.squash = 0.8;
        if (!tank.mounted) {
          const dmg = Math.round(CLONE_STRIKE_DMG * bossDmgScale(boss));
          fx.applyPlayerDamage(dmg);
          fx.flashVignette();
          player.pushVx = Math.cos(ang) * 12;
          player.pushVy = Math.sin(ang) * 12;
          fx.spawnFloater(player.x, player.y - 40, `-${dmg} CLONE STRIKE`, '#c9c9ff', 18);
        }
        fx.createParticles(c.x + Math.cos(ang) * c.r, c.y + Math.sin(ang) * c.r, '#c9c9ff', 10, 6, 300);
      }
    } else if (c.state === 'dizzy') {
      c.squash = 1 + Math.sin(now / 140) * 0.1;
    } else {
      // absorbing: fade to transparent while being dragged into the real boss
      c.stateTimer -= dt;
      c.alpha = Math.max(0, c.stateTimer / 1300) * 0.7;
      const dx = boss.x - c.x;
      const dy = boss.y - c.y;
      const d = Math.hypot(dx, dy);
      const pull = Math.min(d, Math.max(3, d * Math.min(1, dt / 260)));
      if (d > 1) {
        c.x += (dx / d) * pull;
        c.y += (dy / d) * pull;
      }
      if (Math.random() < 0.7) fx.createParticles(c.x, c.y, '#cfd4ff', 2, 3, 450);
      if (c.stateTimer <= 0 || d < 24) {
        fx.createParticles(boss.x, boss.y, '#cfd4ff', 22, 9, 550);
        p3.clones.splice(i, 1);
      }
    }
  }
}

export function spawnMeteor(p3: Phase3State, x: number, y: number, dmg: number, dps: number) {
  p3.meteors.push({ id: Math.random().toString(), x, y, t: 0, fallMs: METEOR_FALL_MS, dmg, dps });
}

function updateMeteors(p3: Phase3State, player: PlayerState, tank: Tank, dt: number, fx: Phase3Fx) {
  for (let i = p3.meteors.length - 1; i >= 0; i--) {
    const m = p3.meteors[i];
    m.t += dt;
    if (m.t < m.fallMs) continue;
    // IMPACT
    const d = Math.hypot(player.x - m.x, player.y - m.y);
    if (d < METEOR_BLAST_R + player.r && !tank.mounted) {
      fx.applyPlayerDamage(m.dmg);
      fx.flashVignette();
      const a = Math.atan2(player.y - m.y, player.x - m.x);
      player.pushVx = Math.cos(a) * 14;
      player.pushVy = Math.sin(a) * 14;
      fx.spawnFloater(player.x, player.y - 40, `-${m.dmg} METEOR`, '#ff9a3c', 22);
    }
    p3.craters.push({ id: Math.random().toString(), x: m.x, y: m.y, r: CRATER_R, life: CRATER_LIFE_MS, maxLife: CRATER_LIFE_MS, dps: m.dps });
    while (p3.craters.length > CRATER_MAX) p3.craters.shift();
    fx.createParticles(m.x, m.y, '#ff9a3c', 34, 12, 600);
    fx.createParticles(m.x, m.y, '#3a2a20', 18, 7, 700);
    fx.addScreenShake(12);
    p3.flash = Math.min(1, p3.flash + 0.55);
    p3.meteors.splice(i, 1);
  }
  // Craters stay as a dent in the ground: standing in one hurts, so the path
  // across the arena has to be planned around them.
  for (let i = p3.craters.length - 1; i >= 0; i--) {
    const c = p3.craters[i];
    c.life -= dt;
    if (c.life <= 0) {
      p3.craters.splice(i, 1);
      continue;
    }
    if (!tank.mounted && Math.hypot(player.x - c.x, player.y - c.y) < c.r) {
      fx.applyPlayerDamage(c.dps * (dt / 1000));
      if (Math.random() < 0.2) fx.createParticles(player.x, player.y, '#ff9a3c', 2, 4, 250);
    }
  }
}

/** Called once per frame from the game loop. */
export function updatePhase3(
  p3: Phase3State,
  boss: Boss,
  player: PlayerState,
  tank: Tank,
  dt: number,
  now: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  fx: Phase3Fx
) {
  updateClones(p3, boss, player, tank, dt, now, bounds, fx);
  updateMeteors(p3, player, tank, dt, fx);
  // The breaking dimension flashes on its own every couple of seconds (kept soft:
  // low peak brightness, never faster than every ~2s).
  if (boss.finalStand && now >= p3.flashAt) {
    p3.flash = Math.max(p3.flash, 0.7);
    p3.flashAt = now + 2200 + Math.random() * 1800;
  }
  p3.flash = Math.max(0, p3.flash - dt / 700);
}

/** Homing: turn toward the player a little each frame at constant speed. */
export function steerMissile(orb: BossOrb, px: number, py: number) {
  const speed = orb.speed || Math.hypot(orb.vx, orb.vy) || 6.5;
  const cur = Math.atan2(orb.vy, orb.vx);
  const want = Math.atan2(py - orb.y, px - orb.x);
  let diff = want - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-MISSILE_TURN, Math.min(MISSILE_TURN, diff));
  const na = cur + turn;
  orb.vx = Math.cos(na) * speed;
  orb.vy = Math.sin(na) * speed;
}
