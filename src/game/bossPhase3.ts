import { applyKnockback, applyKnockbackDir } from './knockback';
import { addPosture } from './combat';
import { Boss, BossClone, BossEcho, BossOrb, Crack, PlayerState, Tank, Phase3State, Zombie } from '../types/game';
import {
  RAM_KNOCKBACK_UNITS,
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
  THROW_RANGE,
  THROW_SPEED,
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
  applyPlayerDamage: (dmg: number, isRanged?: boolean, unparryable?: boolean) => void;
  flashVignette: () => void;
}

export function createPhase3State(): Phase3State {
  return { clones: [], echoes: [], meteors: [], craters: [], flash: 0, flashAt: 0, crackX: 0, crackY: 0, crackSeed: 1 };
}

export function resetPhase3(p3: Phase3State) {
  p3.clones.length = 0;
  p3.echoes.length = 0;
  p3.barrageAt = undefined;
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
      role: i === 0 ? 'rusher' : 'caster',
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
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      const speed = boss.baseSpeed * 0.85 * (boss.enraged ? 1.25 : 1);
      c.squash = 1 + Math.sin(now / 90) * 0.06;

      if (c.role === 'rusher') {
        // RUSHER: stalks you, then telegraphs a lane and dashes through it (dodge with Shift)
        if (c.act === 'windup') {
          c.actTimer = (c.actTimer || 0) - dt;
          c.squash = 0.8;
          if ((c.actTimer || 0) <= 0) { c.act = 'dash'; c.actDist = 0; }
        } else if (c.act === 'dash') {
          const step = 15 * (dt / 16.67);
          const a = c.actAng || 0;
          c.x = clampTo(bounds, c.x + Math.cos(a) * step, 'x', c.r);
          c.y = clampTo(bounds, c.y + Math.sin(a) * step, 'y', c.r);
          c.actDist = (c.actDist || 0) + step;
          c.facingAng = a;
          c.squash = 1.2;
          fx.createParticles(c.x, c.y, '#c9c9ff', 2, 3, 250);
          if (!tank.mounted && Math.hypot(player.x - c.x, player.y - c.y) < c.r + player.r + 6) {
            const dmg = Math.round(CLONE_STRIKE_DMG * 1.5 * bossDmgScale(boss));
            const hp0 = player.hp;
            fx.applyPlayerDamage(dmg);
            if (player.hp < hp0) {
              fx.flashVignette();
              applyKnockbackDir(player, Math.cos(a), Math.sin(a), RAM_KNOCKBACK_UNITS);
              fx.spawnFloater(player.x, player.y - 40, `-${dmg} PHANTOM RUSH`, '#c9c9ff', 20);
              c.act = undefined;
              c.atkCd = 2600;
            }
          }
          if ((c.actDist || 0) >= 300) { c.act = undefined; c.atkCd = 2200; }
        } else {
          c.facingAng = ang;
          if (d > c.r + player.r + 24) { c.x += Math.cos(ang) * speed; c.y += Math.sin(ang) * speed; }
          c.atkCd -= dt;
          if (c.atkCd <= 0 && d < 520) {
            c.act = 'windup';
            c.actTimer = 650;
            c.actAng = ang; // lane locks now — move out of it
          }
        }
      } else {
        // CASTER: keeps its distance, strafes, and calls telegraphed meteor strikes on you
        c.facingAng = ang;
        const want = 340;
        const strafe = ang + Math.PI / 2;
        if (d < want - 40) { c.x -= Math.cos(ang) * speed; c.y -= Math.sin(ang) * speed; }
        else if (d > want + 60) { c.x += Math.cos(ang) * speed; c.y += Math.sin(ang) * speed; }
        else { c.x += Math.cos(strafe) * speed * 0.7; c.y += Math.sin(strafe) * speed * 0.7; }
        c.atkCd -= dt;
        if (c.atkCd <= 0) {
          c.atkCd = 2800;
          c.squash = 0.8;
          // Lead the target slightly so standing still gets punished but moving works
          spawnMeteor(p3, player.x + (Math.random() - 0.5) * 60, player.y + (Math.random() - 0.5) * 60, Math.round(32 * bossDmgScale(boss)), 0);
          fx.spawnFloater(c.x, c.y - c.r - 30, '☄️ CASTING', '#c9c9ff', 14);
        }
      }
      c.x = clampTo(bounds, c.x, 'x', c.r);
      c.y = clampTo(bounds, c.y, 'y', c.r);
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


// ---------------------------------------------------------------------------
// Mirror Barrage — Doctor Strange vs Thanos. A ring of fragile mirror-dimension
// echoes opens around the player (orange sigils), then they all lunge in a rolling
// volley from every side. Shatter them first (any hit does it), or dash through a gap.
// ---------------------------------------------------------------------------
const ECHO_COUNT = 8;
const ECHO_RING_R = 360;
const ECHO_TELEGRAPH_MS = 900;
const ECHO_STAGGER_MS = 130;
const ECHO_SPEED = 15;       // px per 16.7ms frame
const ECHO_MAX_DIST = 520;
const ECHO_DMG = 26;
const BARRAGE_GAP_MS = 9000;

function spawnMirrorBarrage(
  p3: Phase3State,
  player: PlayerState,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  fx: SplitFx
) {
  const off = Math.random() * Math.PI * 2;
  for (let i = 0; i < ECHO_COUNT; i++) {
    const a = off + (i / ECHO_COUNT) * Math.PI * 2;
    const x = clampTo(bounds, player.x + Math.cos(a) * ECHO_RING_R, 'x', 40);
    const y = clampTo(bounds, player.y + Math.sin(a) * ECHO_RING_R, 'y', 40);
    p3.echoes.push({
      id: Math.random().toString(), x, y, r: 30, ang: Math.atan2(player.y - y, player.x - x),
      state: 'telegraph', t: 0, delay: i * ECHO_STAGGER_MS, dist: 0,
    });
    fx.createParticles(x, y, '#ff9a3c', 14, 5, 450);
  }
  p3.barrageTotal = ECHO_COUNT;
  p3.barrageShattered = 0;
  p3.barrageHit = false;
  fx.spawnFloater(player.x, player.y - 110, '🌀 MIRROR DIMENSION!', '#ff9a3c', 24);
  fx.addScreenShake(10);
}

/** Shatter one echo (called from bullet / melee / slam / blast hit sites). */
export function shatterEcho(p3: Phase3State, boss: Boss | null, idx: number, fx: SplitFx) {
  const e = p3.echoes[idx];
  if (!e) return;
  fx.createParticles(e.x, e.y, '#ff9a3c', 18, 8, 420);
  fx.createParticles(e.x, e.y, '#ffe0b0', 8, 5, 300);
  p3.echoes.splice(idx, 1);
  p3.barrageShattered = (p3.barrageShattered || 0) + 1;
  if (p3.echoes.length === 0 && !p3.barrageHit && (p3.barrageShattered || 0) >= (p3.barrageTotal || 0) && boss) {
    // Every echo broken before one connected: the real boss reels
    fx.spawnFloater(boss.x, boss.y - boss.r - 70, '🪞 MIRROR SHATTERED!', '#ffd166', 24);
    addPosture(boss, 45, performance.now(), { text: fx.spawnFloater, shake: fx.addScreenShake, burst: fx.createParticles });
  }
}

/** Shatter every echo within `radius` of a point (melee swings, slams, explosions). */
export function shatterEchoesNear(p3: Phase3State, boss: Boss | null, x: number, y: number, radius: number, fx: SplitFx) {
  for (let i = p3.echoes.length - 1; i >= 0; i--) {
    const e = p3.echoes[i];
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) shatterEcho(p3, boss, i, fx);
  }
}

function updateEchoes(
  p3: Phase3State, boss: Boss, player: PlayerState, tank: Tank, dt: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }, fx: Phase3Fx
) {
  for (let i = p3.echoes.length - 1; i >= 0; i--) {
    const e: BossEcho = p3.echoes[i];
    e.t += dt;
    if (e.state === 'telegraph') {
      e.ang = Math.atan2(player.y - e.y, player.x - e.x); // keeps tracking until it launches
      if (e.t >= ECHO_TELEGRAPH_MS + e.delay) { e.state = 'dash'; e.t = 0; e.dist = 0; }
      continue;
    }
    const step = ECHO_SPEED * (dt / 16.67);
    e.x += Math.cos(e.ang) * step;
    e.y += Math.sin(e.ang) * step;
    e.dist += step;
    if (Math.random() < 0.6) fx.createParticles(e.x, e.y, '#ff9a3c', 1, 2, 250);
    if (!tank.mounted && Math.hypot(player.x - e.x, player.y - e.y) < e.r + player.r) {
      const dmg = Math.round(ECHO_DMG * bossDmgScale(boss));
      const hp0 = player.hp;
      fx.applyPlayerDamage(dmg);
      p3.barrageHit = true;
      if (player.hp < hp0) {
        fx.flashVignette();
        applyKnockbackDir(player, Math.cos(e.ang), Math.sin(e.ang), RAM_KNOCKBACK_UNITS);
        fx.spawnFloater(player.x, player.y - 40, `-${dmg} MIRROR STRIKE`, '#ff9a3c', 18);
      }
      fx.createParticles(e.x, e.y, '#ff9a3c', 14, 7, 350);
      p3.echoes.splice(i, 1);
      continue;
    }
    if (e.dist >= ECHO_MAX_DIST || e.x < bounds.minX || e.x > bounds.maxX || e.y < bounds.minY || e.y > bounds.maxY) {
      p3.barrageHit = true; // one slipped through: no shatter bonus
      p3.echoes.splice(i, 1);
    }
  }
}

export function spawnMeteor(p3: Phase3State, x: number, y: number, dmg: number, dps: number) {
  p3.meteors.push({ id: Math.random().toString(), x, y, t: 0, fallMs: METEOR_FALL_MS, dmg, dps });
}

function updateMeteors(p3: Phase3State, player: PlayerState, tank: Tank, dt: number, now: number, fx: Phase3Fx) {
  for (let i = p3.meteors.length - 1; i >= 0; i--) {
    const m = p3.meteors[i];
    m.t += dt;
    if (m.t < m.fallMs) continue;
    // IMPACT
    const d = Math.hypot(player.x - m.x, player.y - m.y);
    if (d < METEOR_BLAST_R + player.r && !tank.mounted) {
      fx.applyPlayerDamage(m.dmg);
      fx.flashVignette();
      applyKnockback(player, m.x, m.y, now);
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
  updateEchoes(p3, boss, player, tank, dt, bounds, fx);
  if (boss.splitActive && !boss.splitDizzy && boss.state === 'chasing' && p3.echoes.length === 0) {
    if (p3.barrageAt === undefined) p3.barrageAt = now + 5000;
    if (now >= p3.barrageAt) {
      spawnMirrorBarrage(p3, player, bounds, fx);
      p3.barrageAt = now + BARRAGE_GAP_MS + Math.random() * 3000;
    }
  } else if (!boss.splitActive) {
    p3.barrageAt = undefined;
    p3.echoes.length = 0;
  }
  if (boss.splitActive && !boss.splitDizzy && boss.state === 'chasing' && p3.clones.length > 0) {
    if (p3.shuffleAt === undefined) p3.shuffleAt = now + 8000;
    if (now >= p3.shuffleAt) {
      const live = p3.clones.filter((c) => c.state === 'chasing');
      if (live.length) {
        const c = live[Math.floor(Math.random() * live.length)];
        const bx = boss.x, by = boss.y;
        fx.createParticles(bx, by, '#9d4edd', 24, 7, 500);
        fx.createParticles(c.x, c.y, '#9d4edd', 24, 7, 500);
        boss.x = c.x; boss.y = c.y; c.x = bx; c.y = by;
        fx.spawnFloater(boss.x, boss.y - boss.r - 60, '🔀 SHUFFLE!', '#c9c9ff', 20);
        fx.addScreenShake(8);
      }
      p3.shuffleAt = now + 8000 + Math.random() * 3000;
    }
  } else if (!boss.splitActive) {
    p3.shuffleAt = undefined;
  }
  updateMeteors(p3, player, tank, dt, now, fx);
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

/**
 * A new summon wave has arrived: instantly kill whatever is left of the previous
 * batch (zombies AND portals still opening). Zombies are only flagged dead, so they
 * vanish with no kill credit and no atom drops (no farming). Returns how many died.
 */
export function wipeOldSummons(zombies: Zombie[], cracks: Crack[], waveId: number, onKill?: (z: Zombie) => void): number {
  let wiped = 0;
  for (const z of zombies) {
    if (z.summoned && !z.dead && (z.summonWave ?? 0) < waveId) {
      z.dead = true;
      onKill?.(z);
      wiped++;
    }
  }
  for (let i = cracks.length - 1; i >= 0; i--) {
    const wid = cracks[i].waveId;
    if (wid !== undefined && wid < waveId) cracks.splice(i, 1);
  }
  return wiped;
}

/** Thrown melee weapon: flies out, then is recalled to the boss like a boomerang. 'caught' = remove it. */
export function updateThrownWeapon(orb: BossOrb, boss: Boss | null, dt: number): 'caught' | null {
  orb.spin = (orb.spin || 0) + dt * 0.022;
  if (!orb.returning) {
    orb.travelled = (orb.travelled || 0) + Math.hypot(orb.vx, orb.vy);
    if (orb.travelled >= THROW_RANGE) orb.returning = true;
  }
  if (orb.returning && boss) {
    const dx = boss.x - orb.x;
    const dy = boss.y - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < boss.r + 12) return 'caught';
    orb.vx = (dx / d) * THROW_SPEED * 1.1;
    orb.vy = (dy / d) * THROW_SPEED * 1.1;
  }
  return null;
}
