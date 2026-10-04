import { Boss, PlayerState, Shockwave, Crack, Tank, Bullet, BossOrb, Phase3State } from '../types/game';
import { startSplit, spawnMeteor } from './bossPhase3';
import { applyKnockback, applyKnockbackDir, cancelKnockback } from './knockback';
import {
  BOSS_TELEGRAPHS, BOSS_QUOTES, CHARGE_LANE_LEN,
  CHARGE_WINDUP_MS, CHARGE_DASH_MS, CHARGE_RECOVER_MS, KNOCKBACK_UNITS, SPLIT_STAT_MUL,
  MISSILE_SPEED_MUL, MISSILE_MAX_FIRED, MISSILE_HP, MISSILE_FIRST_MS, MISSILE_GAP_MS,
  METEOR_DMG, CRATER_DPS, THROW_SPEED, THROW_DMG,
  SUMMON_WAVE_INTERVAL_MS, SUMMON_WAVE_GIANTS, SUMMON_WAVE_RUNNERS, SUMMON_WAVE_RUNNER_HP_MUL,
  PULL_INTERVAL_MS, PULL_MIN_DIST, PULL_WINDUP_MS, PULL_SPEED, PULL_END_GAP, PULL_COMBO_WINDUP,
  COMBO_TRIGGER_RANGE, COMBO_COOLDOWN_MS, COMBO_RECOVER_MS, COMBO_STEPS,
  PORTAL_INTERVAL_MS, PORTAL_INTERVAL_ENRAGED_MS,
  BOSS_SUMMON_CAP, RUNNER_WAVE_INTERVAL_MS, RUNNER_WAVE_COUNT, RUNNER_WAVE_HP_MUL,
  JUMPSCARE_INTERVAL_MS, JUMPSCARE_INTERVAL_ENRAGED_MS, BOSS_SUPER_DMG_MUL,
  ORB_INTERVAL_MS, ORB_INTERVAL_ENRAGED_MS, ORB_SPEED, ORB_HP, ORB_DMG_MULT,
  RAM_KNOCKBACK_UNITS, VOID_ORB_STREAK, VOID_ORB_CHARGE_MS, VOID_ORB_HP, VOID_ORB_DMG, VOID_ORB_SPEED,
} from './constants';
import { STAGGER_MS } from './combat';
import { playExplosionSound, playBossRoarSound, playAlertStinger } from '../audio/sound';

// Small controlled combo table (spec item 4): specific attacks are allowed to
// chain directly into a named follow-up instead of always returning to
// 'chasing'. Deliberately short and hand-picked — NOT a random chain of
// everything. Phase-gated and rolled once per opportunity so it reads as an
// occasional "oh, it's not done" rather than a permanent combo lock.
const COMBO_CHANCE = 0.32;

// God-of-War style melee chain: slash -> backhand -> heavy smash. Each hit re-aims and
// lunges toward the player, so the boss keeps coming at you instead of waiting.
function startCombo(boss: Boss, player: PlayerState, now: number, firstWindup?: number) {
  boss.state = 'comboWindup';
  boss.comboStep = 0;
  boss.comboAng = Math.atan2(player.y - boss.y, player.x - boss.x);
  boss.facingAng = boss.comboAng;
  boss.stateTimer = firstWindup ?? COMBO_STEPS[0].windup;
  boss.comboCdUntil = now + COMBO_COOLDOWN_MS;
}

// Smoke-cloud burst used when the boss vanishes / reappears (slow, long-lived puffs).
function cloudBurst(
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void,
  x: number,
  y: number,
  big = false
) {
  createParticles(x, y, '#8d8d9e', big ? 40 : 26, 3.2, 900);
  createParticles(x, y, '#3b3b4a', big ? 26 : 16, 2.4, 1100);
  createParticles(x, y, '#c9c9d6', big ? 16 : 10, 4.5, 650);
}

// Phantom Feint decoys are real, hittable bodies (not just a visual timer).
// Shattering one is how the player actually solves "which one is real" —
// this is the interactive core of the clone mechanic, called from App.tsx's
// existing melee/explosion/bullet collision code so no separate hit-test
// system is needed.
export function shatterPhantomDecoy(
  boss: Boss,
  idx: number,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void,
  spawnFloater: (x: number, y: number, text: string, color?: string, size?: number) => void,
  addScreenShake: (amount: number) => void
) {
  if (!boss.phantomSpots) return;
  const spot = boss.phantomSpots[idx];
  if (!spot || spot.real) return; // never lets the real boss be "shattered" for free
  createParticles(spot.x, spot.y - boss.height, '#9fdb6e', 18, 7, 350);
  spawnFloater(spot.x, spot.y - boss.height - 30, 'FAKE! 💨', '#9fdb6e', 16);
  addScreenShake(4);
  boss.phantomSpots = boss.phantomSpots.filter((_, i) => i !== idx);
  // Once both decoys are down, the mystery is solved — cut the remaining
  // telegraph short and go straight to the reveal + counterattack rather
  // than making the player stare at an empty answer for the full window.
  if (boss.phantomSpots.length && boss.phantomSpots.every(s => s.real)) {
    boss.stateTimer = Math.min(boss.stateTimer, 120);
  }
}

export function updateBossAI(
  boss: Boss,
  player: PlayerState,
  tank: Tank,
  shockwaves: Shockwave[],
  cracks: Crack[],
  bullets: Bullet[],
  bossOrbs: BossOrb[],
  p3: Phase3State,
  dt: number,
  now: number,
  wave: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  applyPlayerDamage: (dmg: number, isRanged?: boolean, unparryable?: boolean) => void,
  flashVignette: () => void,
  spawnFloater: (x: number, y: number, text: string, color?: string, size?: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void,
  addDecal: (x: number, y: number, r: number) => void,
  addScreenShake: (amount: number) => void
) {
  // Calculate milestone gate tier (Every 2 gates = +1 tier)
  const gateTier = boss.doorIndex ? Math.floor((boss.doorIndex - 1) / 2) : 0;
  const dmgMul = (1 + gateTier * 0.22) * (boss.enraged ? 1.25 : 1.0) * (boss.splitActive ? SPLIT_STAT_MUL : 1);

  // =====================================================
  // MULTI-PHASE FIGHT — three real phases, not just a stronger HP bar.
  // Phase 1 (100-65%): establishes patterns. Phase 2 (65-30%): faster,
  // adds Phantom Feint to teleport. Phase 3 (<30%): fastest, most
  // aggressive, full moveset. Each transition has a brief invulnerability
  // window (so burst damage landing on the threshold can't skip the
  // telegraph) plus a clear, satisfying beat: roar, shake, color surge.
  // =====================================================
  if (boss.phase === 1 && boss.hp <= boss.hpMax * 0.65) {
    boss.phase = 2;
    boss.enraged = true;
    boss.phaseTransitionUntil = now + 550;
    boss.baseSpeed *= 1.06;
    boss.cycleMs = Math.max(1300, boss.cycleMs * 0.82);
    playBossRoarSound();
    playAlertStinger();
    addScreenShake(22);
    spawnFloater(boss.x, boss.y - 120, '⚠️ PHASE 2: THE GLOVES ARE OFF', '#ff4d5e', 24);
    createParticles(boss.x, boss.y, '#ff4d5e', 50, 12, 650);
  } else if (boss.phase === 2 && boss.hp <= boss.hpMax * 0.30) {
    boss.phase = 3;
    boss.phaseTransitionUntil = now + 650;
    boss.baseSpeed *= 1.06;
    boss.cycleMs = Math.max(900, boss.cycleMs * 0.78);
    playBossRoarSound();
    playAlertStinger();
    addScreenShake(32);
    spawnFloater(boss.x, boss.y - 130, '💀 FINAL PHASE: NO MORE HOLDING BACK', '#ffd166', 26);
    createParticles(boss.x, boss.y, '#ffd166', 80, 16, 800);
    // DESPERATION ATTACK (spec item J) — a guaranteed, one-time signature
    // finisher the instant Phase 3 opens, not just "faster + more damage".
    // Overrides whatever the boss was mid-doing; the invuln window below
    // covers the interruption so it never looks like a state glitch.
    boss.state = 'despWindup';
    boss.stateTimer = 500;
    // Blink adjacent to the player immediately — the desperation attack
    // reads as "it's suddenly right on top of you", not a slow walk-up.
    const despAng = Math.random() * Math.PI * 2;
    boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, player.x + Math.cos(despAng) * 140));
    boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, player.y + Math.sin(despAng) * 140));
  }
  const phaseInvuln = boss.phaseTransitionUntil !== undefined && now < boss.phaseTransitionUntil;
  if (phaseInvuln) {
    // Brief freeze during the transition flash — reads as a deliberate
    // "power surge" beat rather than the boss glitching mid-attack.
    boss.squash = 1 + Math.sin(now / 40) * 0.15;
    return;
  }

  boss.stateTimer -= dt;
  boss.squash += (1 - boss.squash) * Math.min(1, dt / 120);

  // =====================================================
  // UNIVERSAL ANTI-CAMPING PUNISH — applies to every boss regardless of
  // gimmick. Every 3s, check how far the player has actually moved; if
  // they've been parked in one spot (classic "circle-strafe and spam SMG"),
  // force-interrupt whatever the boss is doing with a short-windup charge
  // aimed straight at them. On a cooldown so it can't chain every 3s.
  // =====================================================
  if (boss.campCheckAt === undefined) {
    boss.campAnchorX = player.x;
    boss.campAnchorY = player.y;
    boss.campCheckAt = now + 3000;
  } else if (now >= boss.campCheckAt) {
    const moved = Math.hypot(player.x - (boss.campAnchorX ?? player.x), player.y - (boss.campAnchorY ?? player.y));
    const cdReady = boss.campPunishCd === undefined || now >= boss.campPunishCd;
    if (moved < 80 && boss.state === 'chasing' && cdReady) {
      boss.state = 'chargeWindup';
      boss.stateTimer = CHARGE_WINDUP_MS;
      boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.campPunishCd = now + 6000;
      addScreenShake(10);
      spawnFloater(boss.x, boss.y - 100, '⚠️ TOO COMFORTABLE — RUSH INCOMING!', '#ff4d5e', 20);
    }
    boss.campAnchorX = player.x;
    boss.campAnchorY = player.y;
    boss.campCheckAt = now + 3000;
  }

  // =====================================================
  // SUMMON WAVE — once a minute, and deliberately small: a couple of giants and a
  // few fast, extra-health runners. When the next wave arrives, the App instantly
  // kills whatever is left of the previous one (it watches summonWaveId), so there
  // is never more than one batch alive. No other timer or move spawns zombies.
  // =====================================================
  if (boss.summonWaveAt === undefined) {
    boss.summonWaveAt = now + SUMMON_WAVE_INTERVAL_MS;
  } else if (now >= boss.summonWaveAt) {
    boss.summonWaveAt = now + SUMMON_WAVE_INTERVAL_MS;
    boss.summonWaveId = (boss.summonWaveId || 0) + 1;
    addScreenShake(14);
    spawnFloater(boss.x, boss.y - 120, '🌀 THE OLD BATCH DIES — A NEW WAVE ARRIVES!', '#b98bff', 20);
    const total = SUMMON_WAVE_GIANTS + SUMMON_WAVE_RUNNERS;
    for (let i = 0; i < total; i++) {
      const giant = i < SUMMON_WAVE_GIANTS;
      const ang = (i / total) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (giant ? 300 : 260) + Math.random() * 150;
      cracks.push({
        id: Math.random().toString(),
        x: Math.max(bounds.minX + 60, Math.min(bounds.maxX - 60, player.x + Math.cos(ang) * dist)),
        y: Math.max(bounds.minY + 60, Math.min(bounds.maxY - 60, player.y + Math.sin(ang) * dist)),
        time: giant ? (boss.enraged ? 950 : 1200) : 800,
        type: giant ? 'ztank' : 'runner',
        hpMul: giant ? undefined : SUMMON_WAVE_RUNNER_HP_MUL,
        waveId: boss.summonWaveId,
      });
    }
  }

  // =====================================================
  // JUMPSCARE — every boss, on a clock: vanish in a smoke cloud, then
  // reappear right beside the player (handled in 'teleportOut' below).
  // Only fires from the neutral chase and only if the boss is far enough
  // away that the blink actually reads as a scare.
  // =====================================================
  const jumpscareInterval = boss.enraged ? JUMPSCARE_INTERVAL_ENRAGED_MS : JUMPSCARE_INTERVAL_MS;
  if (boss.jumpscareAt === undefined) {
    boss.jumpscareAt = now + jumpscareInterval;
  } else if (now >= boss.jumpscareAt && boss.state === 'chasing') {
    if (Math.hypot(player.x - boss.x, player.y - boss.y) > 320) {
      boss.jumpscareAt = now + jumpscareInterval;
      boss.jumpscare = true;
      boss.state = 'teleportOut';
      boss.stateTimer = 380;
      cloudBurst(createParticles, boss.x, boss.y, true);
      playAlertStinger();
    } else {
      boss.jumpscareAt = now + 3000; // already close — try again shortly
    }
  }

  // =====================================================
  // CHAIN PULL — every 20s, from the neutral chase, the boss yanks the player in
  // and goes straight into a combo, so kiting it forever isn't an option.
  // =====================================================
  if (boss.pullAt === undefined) {
    boss.pullAt = now + PULL_INTERVAL_MS;
  } else if (now >= boss.pullAt && boss.state === 'chasing') {
    if (Math.hypot(player.x - boss.x, player.y - boss.y) > PULL_MIN_DIST && !tank.mounted) {
      boss.pullAt = now + PULL_INTERVAL_MS;
      boss.state = 'pullWindup';
      boss.stateTimer = PULL_WINDUP_MS;
      boss.facingAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      playAlertStinger();
      addScreenShake(8);
      spawnFloater(boss.x, boss.y - 110, '⛓ CHAINED! YOU ARE BEING PULLED IN', '#ff4d5e', 22);
    } else {
      boss.pullAt = now + 3000; // already close (or in a tank) — try again shortly
    }
  }

  // =====================================================
  // UNIVERSAL YELLOW ORB VOLLEY — every boss, roughly once a minute.
  // A big, slow, straight-line projectile — easy to read and dodge on
  // foot, but it can also be shot out of the air with regular bullets.
  // =====================================================
  const orbInterval = boss.enraged ? ORB_INTERVAL_ENRAGED_MS : ORB_INTERVAL_MS;
  if (boss.orbCheckAt === undefined) {
    boss.orbCheckAt = now + orbInterval;
  } else if (now >= boss.orbCheckAt && boss.phase < 3) {
    boss.orbCheckAt = now + orbInterval;
    const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
    spawnFloater(boss.x, boss.y - 130, '🟡 ORB INCOMING — SHOOT OR DODGE!', '#ffd166', 20);
    addScreenShake(10);
    createParticles(boss.x, boss.y, '#ffd166', 20, 8, 400);
    bossOrbs.push({
      id: Math.random().toString(),
      x: boss.x,
      y: boss.y - boss.height,
      vx: Math.cos(ang) * ORB_SPEED,
      vy: Math.sin(ang) * ORB_SPEED,
      r: 34,
      hp: ORB_HP,
      hpMax: ORB_HP,
      dmg: Math.round(50 * dmgMul * ORB_DMG_MULT),
      life: 8000,
    });
  }

  // =====================================================
  // FINAL STAND MISSILE — in phase 3 the yellow orb turns into a homing missile at
  // 2.5x orb speed. It's only fired twice, and it can be shot down with enough
  // bullets or caught in a grenade/rocket blast.
  // =====================================================
  if (
    boss.finalStand &&
    boss.state !== 'dizzy' &&
    (boss.missilesFired || 0) < MISSILE_MAX_FIRED &&
    boss.missileAt !== undefined &&
    now >= boss.missileAt
  ) {
    boss.missilesFired = (boss.missilesFired || 0) + 1;
    boss.missileAt = now + MISSILE_GAP_MS;
    const mAng = Math.atan2(player.y - boss.y, player.x - boss.x);
    const mSpeed = ORB_SPEED * MISSILE_SPEED_MUL;
    bossOrbs.push({
      id: Math.random().toString(),
      x: boss.x,
      y: boss.y - boss.height,
      vx: Math.cos(mAng) * mSpeed,
      vy: Math.sin(mAng) * mSpeed,
      r: 26,
      hp: MISSILE_HP,
      hpMax: MISSILE_HP,
      dmg: Math.round(65 * dmgMul),
      life: 9000,
      kind: 'missile',
      speed: mSpeed,
    });
    addScreenShake(12);
    createParticles(boss.x, boss.y, '#ffd166', 24, 9, 450);
    spawnFloater(boss.x, boss.y - 130, '🚀 HOMING MISSILE — GRENADE IT OR SHOOT IT DOWN!', '#ff8c00', 20);
  }

  // =====================================================
  // UNIVERSAL AREA DENIAL ZONES — ticked independently of boss.state so a
  // deployed zone keeps threatening/expiring even while the boss moves on
  // to its next move. Each zone warns briefly (outline only, no damage)
  // before going hot for a few seconds, then disappears — force a
  // reposition without stacking into a permanent no-go arena.
  // =====================================================
  if (boss.areaZones && boss.areaZones.length) {
    for (let i = boss.areaZones.length - 1; i >= 0; i--) {
      const z = boss.areaZones[i];
      if (now > z.expiresAt) {
        boss.areaZones.splice(i, 1);
        continue;
      }
      if (now >= z.warnUntil && !tank.mounted) {
        const d = Math.hypot(player.x - z.x, player.y - z.y);
        if (d < z.r) {
          applyPlayerDamage(30 * dmgMul * (dt / 1000));
          if (Math.random() < 0.15) createParticles(player.x, player.y, '#c1440e', 2, 5, 200);
        }
      }
    }
  }

  // =====================================================
  // PER-BOSS GIMMICK SYSTEM — differentiated mechanics
  // =====================================================
  const gimmick = boss.skin.gimmick;

  // G1: BEHEMOTH RAMPAGE — after roar, triples speed for 3s, player must dodge
  if (gimmick === 'rampage') {
    if (boss.gimmickActive) {
      boss.gimmickTimer = (boss.gimmickTimer || 0) - dt;
      if (boss.gimmickTimer <= 0) {
        boss.gimmickActive = false;
        boss.baseSpeed /= 3.0; // restore speed
        spawnFloater(boss.x, boss.y - 80, 'RAMPAGE OVER', '#999', 16);
      } else {
        // triple-speed chase during rampage
        const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
        boss.x += Math.cos(ang) * boss.baseSpeed * 3;
        boss.y += Math.sin(ang) * boss.baseSpeed * 3;
        if (Math.random() < 0.4) createParticles(boss.x, boss.y, '#e63946', 3, 8, 200);
      }
    }
    // Trigger rampage on roar state end
    if (boss.state === 'roar' && boss.stateTimer <= 100 && !boss.gimmickActive) {
      boss.gimmickActive = true;
      boss.gimmickTimer = 3000;
      boss.baseSpeed *= 3.0;
      addScreenShake(20);
      spawnFloater(boss.x, boss.y - 100, '💢 RAMPAGE! DASH AWAY! [Shift]', '#e63946', 22);
    }
  }

  // G2: WARLOCK SOUL SHIELD — periodic ranged immunity; break with melee/AOE
  if (gimmick === 'shield_of_souls') {
    if (boss.soulShieldHp === undefined) boss.soulShieldHp = 0;
    boss.gimmickTimer = (boss.gimmickTimer || 18000) - dt;
    if (boss.gimmickTimer <= 0) {
      // Re-raise shield
      boss.soulShieldHp = 350 + (boss.enraged ? 200 : 0);
      boss.gimmickTimer = 18000;
      boss.gimmickActive = true;
      addScreenShake(12);
      spawnFloater(boss.x, boss.y - 100, '🛡️ SOUL SHIELD UP — USE MELEE!', '#8a9a5b', 20);
      createParticles(boss.x, boss.y, '#8a9a5b', 25, 8, 400);
    }
    if (boss.gimmickActive && boss.soulShieldHp <= 0) {
      boss.gimmickActive = false;
      spawnFloater(boss.x, boss.y - 80, 'SOUL SHIELD BROKEN!', '#ff4d5e', 18);
      createParticles(boss.x, boss.y, '#8a9a5b', 20, 10, 300);
    }
  }

  // G3: IRONCLAD ARMOR PLATING — handled in applyPlayerDamage intercept via flag
  // (The actual dmg reduction is applied in the boss hit handler in App.tsx)

  // G4: EXECUTIONER SOLAR OVERLOAD — extra damage if player stands still in beam
  if (gimmick === 'solar_overload') {
    if (boss.state === 'solarBeam' || boss.state === 'laserSweep') {
      // Track time player is being hit — amplify if sustained
      boss.gimmickTimer = (boss.gimmickTimer || 0) + dt;
    } else {
      boss.gimmickTimer = 0;
    }
    // Extra burn particle for visual warning
    if (boss.state === 'solarBeam' && boss.gimmickTimer && boss.gimmickTimer > 1000) {
      createParticles(boss.x, boss.y, '#f77f00', 3, 6, 150);
    }
  }

  // G5: BOUNCER WALL BOUNCE — extra damage near walls handled during charging
  if (gimmick === 'wall_bounce' && boss.state === 'charging') {
    const distToMinX = player.x - bounds.minX;
    const distToMaxX = bounds.maxX - player.x;
    const distToMinY = player.y - bounds.minY;
    const distToMaxY = bounds.maxY - player.y;
    const nearWall = Math.min(distToMinX, distToMaxX, distToMinY, distToMaxY) < 200;
    if (nearWall && !boss.wallBounceWarning) {
      boss.wallBounceWarning = true;
      spawnFloater(player.x, player.y - 50, '⚠️ NEAR WALL — DANGER!', '#ff4d5e', 17);
    } else if (!nearWall) {
      boss.wallBounceWarning = false;
    }
  }

  // G6: DJ BASS DROP — every 8s emit a massive expanding ring shockwave
  if (gimmick === 'bass_drop') {
    boss.bassDropCd = (boss.bassDropCd === undefined ? 8000 : boss.bassDropCd) - dt;
    if (boss.bassDropCd <= 0) {
      boss.bassDropCd = boss.enraged ? 5500 : 8000;
      addScreenShake(22);
      spawnFloater(boss.x, boss.y - 100, '🎵 BASS DROP! DASH THROUGH THE RING!', '#f4a261', 22);
      // Two concentric expanding rings
      shockwaves.push({
        id: Math.random().toString(),
        x: boss.x, y: boss.y,
        r: 60, maxR: 600,
        dmg: 55 * dmgMul, speed: 9,
        color: '#f4a261', pushForce: 14,
      });
      shockwaves.push({
        id: Math.random().toString(),
        x: boss.x, y: boss.y,
        r: 30, maxR: 400,
        dmg: 35 * dmgMul, speed: 6,
        color: '#ff8c00', pushForce: 8,
      });
      createParticles(boss.x, boss.y, '#f4a261', 40, 12, 500);
      playExplosionSound();
    }
  }

  // G7: QUEEN SUMMONS — summoned escorts heal queen if they survive >8s
  // (Summons happen via existing 'summon' move — the heal-on-survival is tracked in App.tsx)

  // G8: LARRY VOID MIRROR — bullet reflection tracked in App.tsx bullet hit handler
  if (gimmick === 'void_mirror') {
    // Flicker the mirror state visually
    boss.reflectActive = (boss.state !== 'tripped' && boss.state !== 'chargeRecover');
    if (boss.reflectActive && Math.random() < 0.15) {
      createParticles(boss.x + (Math.random()-0.5)*boss.r*2, boss.y - boss.height, '#9d4edd', 2, 4, 150);
    }
  }

  // G9: GARY BERSERKER RAGE — below 50% HP, even faster speed + partial reflect
  if (gimmick === 'berserker_rage') {
    const halfHp = boss.hp <= boss.hpMax * 0.5;
    if (halfHp && !boss.gimmickActive) {
      boss.gimmickActive = true;
      boss.baseSpeed *= 1.4;
      addScreenShake(28);
      playBossRoarSound();
      spawnFloater(boss.x, boss.y - 110, '💀 BERSERKER RAGE ACTIVATED! KEEP MOVING!', '#8b1a3f', 24);
      createParticles(boss.x, boss.y, '#8b1a3f', 60, 14, 700);
    }
    if (boss.gimmickActive && Math.random() < 0.3) {
      createParticles(boss.x + (Math.random()-0.5)*60, boss.y + (Math.random()-0.5)*60, '#8b1a3f', 2, 5, 200);
    }
  }

  if (boss.enraged && Math.random() < 0.25) {
    createParticles(boss.x + (Math.random() - 0.5) * boss.r, boss.y + (Math.random() - 0.5) * boss.r, '#ff4d5e', 2, 4, 300);
  }

  if (boss.state === 'entering') {
    boss.y += 5;
    if (boss.y > bounds.minY + 250) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'chasing') {
    const speedMul = (now < boss.roarBoostUntil ? 1.2 : 1) * (boss.enraged ? 1.25 : 1);
    const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.facingAng = ang;
    const dToPlayer = Math.hypot(player.x - boss.x, player.y - boss.y);

    // Movement variety (phase 2+): instead of always closing distance,
    // occasionally reposition — circle-strafe or briefly back off — before
    // resuming the chase. Keeps the boss readable but not a straight line
    // to predict every single time. Never fires while genuinely far away
    // (it should still close distance if the player's kited it off).
    if (boss.phase >= 2 && boss.repositionUntil === undefined && dToPlayer < 420 && dToPlayer > 140) {
      if (Math.random() < 0.006) {
        boss.repositionUntil = now + 700 + Math.random() * 500;
        boss.repositionDir = Math.random() < 0.5 ? 1 : -1;
      }
    }
    if (boss.repositionUntil !== undefined) {
      if (now >= boss.repositionUntil) {
        boss.repositionUntil = undefined;
      } else {
        // Strafe perpendicular to the player rather than a plain retreat —
        // reads as "circling for an opening", not "running away".
        const strafeAng = ang + (Math.PI / 2) * (boss.repositionDir || 1);
        if (!boss.skin.flies || dToPlayer > 260) {
          boss.x += Math.cos(strafeAng) * boss.baseSpeed * speedMul * 0.85;
          boss.y += Math.sin(strafeAng) * boss.baseSpeed * speedMul * 0.85;
        }
        boss.squash = 1 + Math.sin(now / 90) * 0.06;
        if (boss.skin.flies) boss.height = 60 + Math.sin(now / 260) * 12;
        return;
      }
    }

    if (!boss.skin.flies || dToPlayer > 260) {
      boss.x += Math.cos(ang) * boss.baseSpeed * speedMul;
      boss.y += Math.sin(ang) * boss.baseSpeed * speedMul;
    }
    boss.squash = 1 + Math.sin(now / 90) * 0.06;
    if (boss.skin.flies) boss.height = 60 + Math.sin(now / 260) * 12;

    // Once the boss has closed the gap it commits to a melee combo instead of just
    // walking into you (cooldown-gated so it can't chain combos back to back).
    if (dToPlayer < boss.r + player.r + COMBO_TRIGGER_RANGE && now >= (boss.comboCdUntil || 0)) {
      startCombo(boss, player, now);
      spawnFloater(boss.x, boss.y - 100, '⚔️ COMBO!', '#ff9a3c', 20);
      return;
    }

    if (boss.stateTimer <= 0) {
      // Summons are strictly the once-a-minute wave, so the old summon move is dropped.
      // The melee combo joins every boss's rotation.
      const moves = boss.skin.moves.filter((mv: string) => mv !== 'summon');
      moves.push('combo', 'combo');
      if (boss.phase >= 2) {
        moves.push('solarBeam', 'pushSlam', 'laser', 'charge', 'spikeField', 'frost', 'areaDenial', 'feint');
      }
      if (boss.phase >= 3) {
        // Final phase: the complete attack vocabulary, nothing held back.
        moves.push('teleport', 'fireball', 'spin', 'megasmash');
      }
      if (boss.finalStand) {
        // Final hearts: meteors and the thrown weapon dominate the rotation
        moves.push('meteor', 'throw', 'meteor', 'throw');
      }

      boss.moveIdx = (boss.moveIdx + 1) % (moves.length + 1);
      if (boss.moveIdx === moves.length) {
        boss.state = 'chasing';
        boss.stateTimer = boss.enraged ? 700 : 1200;
      } else {
        const m = moves[boss.moveIdx];
        if (m === 'leap' || m === 'megasmash' || m === 'pushSlam') {
          boss.state = 'anticipate';
          boss.stateTimer = boss.enraged ? 500 : 700;
          boss.squash = 0.65;
          const realAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          boss.targetAng = realAng + (Math.random() > 0.5 ? 1.6 : -1.6);
          boss.leapTargetX = player.x + (Math.random() - 0.5) * 80;
          boss.leapTargetY = player.y + (Math.random() - 0.5) * 80;
          spawnFloater(boss.x, boss.y - 100, BOSS_TELEGRAPHS[Math.floor(Math.random() * BOSS_TELEGRAPHS.length)], '#ffcf5c', 20);
        } else if (m === 'solarBeam') {
          boss.state = 'solarWindup';
          boss.stateTimer = boss.enraged ? 600 : 800;
          boss.solarAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          boss.solarSweepSpeed = (Math.random() > 0.5 ? 1 : -1) * (boss.enraged ? 1.1 : 0.85);
          spawnFloater(boss.x, boss.y - 100, '☀️ SOLAR DEATH FLARE INCOMING!', '#ffd166', 22);
          addScreenShake(12);
        } else if (m === 'charge') {
          boss.state = 'chargeWindup';
          boss.stateTimer = CHARGE_WINDUP_MS; // red lane: just 0.4s to get out of it
          boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          spawnFloater(boss.x, boss.y - 100, '⚡ BULL CHARGE LOCK', '#ffcf5c', 18);
        } else if (m === 'combo') {
          startCombo(boss, player, now);
          spawnFloater(boss.x, boss.y - 100, '⚔️ COMBO!', '#ff9a3c', 20);
        } else if (m === 'meteor') {
          boss.state = 'meteorWindup';
          boss.stateTimer = 700;
          playBossRoarSound();
          addScreenShake(14);
          spawnFloater(boss.x, boss.y - 110, '☄️ THE SKY IS FALLING!', '#ff9a3c', 22);
        } else if (m === 'throw') {
          boss.state = 'throwWindup';
          boss.stateTimer = 500;
          boss.targetAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          boss.facingAng = boss.targetAng;
          spawnFloater(boss.x, boss.y - 110, '🪓 WEAPON THROW!', '#ffcf5c', 20);
        } else if (m === 'roar') {
          boss.state = 'roar';
          boss.stateTimer = 750;
          playBossRoarSound();
          spawnFloater(boss.x, boss.y - 100, 'WAR ROAR!', '#b98bff', 22);
        } else if (m === 'fireball') {
          boss.state = 'fireballWindup';
          boss.stateTimer = 600;
          spawnFloater(boss.x, boss.y - 100, '🔥 HELLFIRE VOLLEY', '#ff4d5e', 20);
        } else if (m === 'teleport') {
          boss.state = 'teleportOut';
          boss.stateTimer = 280;
          cloudBurst(createParticles, boss.x, boss.y);
          spawnFloater(
            boss.x, boss.y - 100,
            boss.phase >= 2 ? '👻 PHANTOM FEINT — WATCH CLOSELY' : '*shadow blink*',
            '#9fdb6e', 18
          );
        } else if (m === 'spin') {
          boss.state = 'spinWindup';
          boss.stateTimer = 500;
          spawnFloater(boss.x, boss.y - 100, 'CYCLONE SPIN', '#ffd166', 18);
        } else if (m === 'laser') {
          boss.state = 'laserWindup';
          boss.stateTimer = 700;
          boss.laserAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          boss.laserSweepDir = Math.random() > 0.5 ? 1 : -1;
          spawnFloater(boss.x, boss.y - 100, '🔴 ANNIHILATION BEAM', '#ff4d5e', 20);
        } else if (m === 'summon') {
          boss.state = 'summonWindup';
          boss.stateTimer = 750;
          spawnFloater(boss.x, boss.y - 100, '💀 SUMMONING HORDE', '#b98bff', 20);
        } else if (m === 'spikeField') {
          boss.state = 'spikeField';
          boss.spikeBurstsLeft = boss.enraged ? 4 : 3;
          boss.spikeBurstDelay = boss.enraged ? 650 : 850;
          boss.spikeX = player.x;
          boss.spikeY = player.y;
          boss.spikeBurstAt = now + (boss.spikeBurstDelay || 850);
          boss.stateTimer = (boss.spikeBurstsLeft + 1) * (boss.spikeBurstDelay || 850);
          playBossRoarSound();
          spawnFloater(boss.x, boss.y - 100, '🌋 GROUND SPIKES — KEEP MOVING!', '#f4a261', 20);
        } else if (m === 'frost') {
          boss.state = 'frostWindup';
          boss.stateTimer = boss.enraged ? 480 : 620;
          boss.frostAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          boss.frostHitPlayer = false;
          spawnFloater(boss.x, boss.y - 100, '❄️ FROST BOLT CHARGING', '#7ad6ff', 20);
        } else if (m === 'areaDenial') {
          boss.state = 'denialWindup';
          boss.stateTimer = 350;
          spawnFloater(boss.x, boss.y - 100, '🔥 MARKING DANGER ZONES', '#f4a261', 20);
        } else if (m === 'feint') {
          // FEINT → CHARGE combo (spec item 4): boss commits to the
          // instantly-recognizable slam windup, then cancels straight into
          // a real charge lock instead of following through. Rare enough
          // (only reachable via the move rotation, not spammed) that the
          // player learns not to auto-dodge the first read every time.
          boss.state = 'anticipate';
          boss.stateTimer = boss.enraged ? 420 : 550;
          boss.squash = 0.65;
          boss.feintInto = 'charge';
          spawnFloater(boss.x, boss.y - 100, BOSS_TELEGRAPHS[Math.floor(Math.random() * BOSS_TELEGRAPHS.length)], '#ffcf5c', 20);
        }
      }
    }
  } else if (boss.state === 'anticipate') {
    if (boss.stateTimer <= 0) {
      if (boss.feintInto === 'charge') {
        // The cancel — this is the "wait, that wasn't the real attack" beat.
        boss.feintInto = undefined;
        boss.state = 'chargeWindup';
        boss.stateTimer = CHARGE_WINDUP_MS;
        boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
        addScreenShake(8);
        spawnFloater(boss.x, boss.y - 110, '👹 FEINT — IT WAS A CHARGE!', '#ff4d5e', 20);
      } else {
        boss.state = 'rising';
        boss.stateTimer = 400;
        boss.vHeight = 15;
        boss.squash = 1.35;
      }
    }
  } else if (boss.state === 'rising') {
    boss.height += boss.vHeight;
    boss.vHeight -= 0.65;
    if (boss.stateTimer <= 0 || boss.vHeight <= 0) {
      boss.state = 'airborne';
      boss.stateTimer = 320;
    }
  } else if (boss.state === 'airborne') {
    boss.x += ((boss.leapTargetX || boss.x) - boss.x) * 0.16;
    boss.y += ((boss.leapTargetY || boss.y) - boss.y) * 0.16;
    boss.height += boss.vHeight;
    boss.vHeight -= 0.55;
    if (boss.stateTimer <= 0) {
      boss.state = 'landing';
      boss.stateTimer = 90;
    }
  } else if (boss.state === 'landing') {
    boss.height = Math.max(0, boss.height - 50);
    if (boss.height <= 0) {
      boss.height = 0;
      boss.squash = 0.5;
      boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x));
      boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y));

      const leapDmg = Math.round(65 * (boss.skin.leapMult || 1) * dmgMul * BOSS_SUPER_DMG_MUL);
      const waveDmg = Math.round(35 * dmgMul * BOSS_SUPER_DMG_MUL);
      const radius = 240 + gateTier * 20;

      playExplosionSound();
      addDecal(boss.x, boss.y, radius * 0.65);
      addScreenShake(28);
      createParticles(boss.x, boss.y, '#ff8c00', 60, 14, 700);

      // Create ground shockwave expanding ring with kinetic knockback
      shockwaves.push({
        id: Math.random().toString(),
        x: boss.x,
        y: boss.y,
        r: 35,
        maxR: radius * 1.5,
        dmg: waveDmg,
        speed: 12,
        color: boss.enraged ? '#ff4d5e' : '#ffd166',
        pushForce: 12,
      });

      const pd = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (pd < radius && !tank.mounted) {
        applyPlayerDamage(leapDmg);
        flashVignette();
        applyKnockback(player, boss.x, boss.y, now);
        spawnFloater(player.x, player.y - 40, `SLAM! -${leapDmg}`, '#ff4d5e', 24);
      }

      if (Math.random() < 0.12 && !boss.enraged) {
        boss.state = 'tripped';
        boss.stateTimer = 1800;
        spawnFloater(boss.x, boss.y - 100, BOSS_QUOTES[Math.floor(Math.random() * BOSS_QUOTES.length)], '#ffcf5c', 20);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'solarWindup') {
    boss.squash = 1.25;
    createParticles(boss.x, boss.y - boss.height, '#ffd166', 6, 8, 250);
    if (boss.stateTimer <= 0) {
      boss.state = 'solarBeam';
      boss.stateTimer = 1600;
      addScreenShake(18);
    }
  } else if (boss.state === 'solarBeam') {
    // Boss Solar Death Ray: tracks player smoothly and dodgeably
    const targetPlayerAng = Math.atan2(player.y - (boss.y - boss.height), player.x - boss.x);
    let diff = targetPlayerAng - (boss.solarAng || 0);
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    boss.solarAng = (boss.solarAng || 0) + diff * Math.min(1, (dt / 1000) * (boss.enraged ? 2.2 : 1.6));
    const beamLen = 1400;
    const beamAng = boss.solarAng;

    // Check line-to-player collision
    const bx = boss.x;
    const by = boss.y - boss.height;
    const px = player.x;
    const py = player.y;

    const v1x = px - bx;
    const v1y = py - by;
    const beamVx = Math.cos(beamAng);
    const beamVy = Math.sin(beamAng);
    const proj = v1x * beamVx + v1y * beamVy;

    if (proj > 0 && proj < beamLen) {
      const perpDist = Math.abs(v1x * -beamVy + v1y * beamVx);
      if (perpDist < player.r + 28 && !tank.mounted) {
        // Balanced continuous solar damage (~40 dps)
        const solarDmg = 42 * dmgMul * BOSS_SUPER_DMG_MUL * (dt / 1000);
        applyPlayerDamage(solarDmg, true);
        flashVignette();
        createParticles(player.x, player.y, '#ffd166', 2, 6);

        // Gentle solar push
        player.pushVx = (player.pushVx || 0) + beamVx * 1.2;
        player.pushVy = (player.pushVy || 0) + beamVy * 1.2;
      }
    }

    createParticles(bx + Math.cos(beamAng) * (proj > 0 ? Math.min(beamLen, proj) : 200), by + Math.sin(beamAng) * (proj > 0 ? Math.min(beamLen, proj) : 200), '#ffd166', 2, 6);

    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'chargeWindup') {
    boss.squash = 0.8;
    if (boss.stateTimer <= 0) {
      boss.state = 'charging';
      // Safety cap only; the dash itself lasts CHARGE_DASH_MS. NOTE: no re-aim here —
      // the red lane the player was shown IS the lane that fires.
      boss.stateTimer = CHARGE_DASH_MS + 600;
      boss.chargeDistTraveled = 0;
      boss.chargeHitPlayer = false;
    }
  } else if (boss.state === 'charging') {
    boss.squash = 1.15;
    const ang = boss.chargeAng || 0;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    // The boss is DRAGGED along the lane, start point to end point, at a constant
    // speed (a visible slide, never a teleport). The whole lane takes ~CHARGE_DASH_MS.
    const remaining = CHARGE_LANE_LEN - (boss.chargeDistTraveled || 0);
    const step = Math.max(0, Math.min(remaining, (CHARGE_LANE_LEN / CHARGE_DASH_MS) * dt));
    const px0 = boss.x;
    const py0 = boss.y;
    boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x + cosA * step));
    boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y + sinA * step));
    const moved = Math.hypot(boss.x - px0, boss.y - py0);
    boss.facingAng = ang;
    boss.chargeDistTraveled = (boss.chargeDistTraveled || 0) + step;

    // Dust + red streak behind it so the drag reads clearly
    createParticles(px0, py0, '#ff4d5e', 2, 4, 260);
    createParticles(boss.x - cosA * boss.r, boss.y - sinA * boss.r + boss.r * 0.6, '#b9a98c', 2, 3, 300);

    // Swept hit across the full width of the lane over the ground covered this tick
    if (!boss.chargeHitPlayer && !tank.mounted) {
      const dx = player.x - px0;
      const dy = player.y - py0;
      const forward = dx * cosA + dy * sinA;
      const lateral = Math.abs(-dx * sinA + dy * cosA);
      const half = boss.r + player.r + 15;
      if (forward > -boss.r && forward < moved + half && lateral < half) {
        const chargeDmg = Math.round(70 * (boss.skin.chargeMult || 1) * dmgMul * BOSS_SUPER_DMG_MUL);
        const hp0 = player.hp;
        applyPlayerDamage(chargeDmg);
        if (player.hp < hp0) {
          flashVignette();
          spawnFloater(player.x, player.y - 40, `-${chargeDmg} RAMMED!`, '#ff4d5e', 22);
          boss.chargeHitPlayer = true;
          addScreenShake(14);
          applyKnockbackDir(player, cosA, sinA, RAM_KNOCKBACK_UNITS); // thrown 30 units the way the boss was charging
        }
      }
    }

    if ((boss.chargeDistTraveled || 0) >= CHARGE_LANE_LEN - 0.001 || boss.stateTimer <= 0) {
      if (!tank.mounted && Math.hypot(player.x - boss.x, player.y - boss.y) < boss.r + player.r + 30) {
        applyKnockbackDir(player, cosA, sinA, RAM_KNOCKBACK_UNITS);
      }
      boss.state = 'chargeRecover';
      boss.stateTimer = CHARGE_RECOVER_MS; // completely still for 1 second, then it moves again
      createParticles(boss.x, boss.y, '#999', 20, 6);
    }
  } else if (boss.state === 'chargeRecover') {
    boss.squash = 0.92;
    if (boss.stateTimer <= 0) {
      // COMBO: CHARGE → SLAM. Occasionally, phase 2+, the recovery isn't
      // actually the end of the exchange — the boss plants and immediately
      // raises for an overhead slam. Rolled once, not guaranteed, so it
      // stays a "combo table" entry rather than every charge auto-chaining.
      if (boss.phase >= 2 && Math.random() < COMBO_CHANCE) {
        boss.state = 'anticipate';
        boss.stateTimer = 380;
        boss.squash = 0.65;
        boss.leapTargetX = player.x;
        boss.leapTargetY = player.y;
        spawnFloater(boss.x, boss.y - 100, '⚡➜💥 FOLLOW-UP SLAM!', '#ffcf5c', 20);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'laserWindup') {
    boss.squash = 1.2;
    createParticles(boss.x, boss.y - boss.height, '#ff4d5e', 4, 6, 200);
    if (boss.stateTimer <= 0) {
      boss.state = 'laserSweep';
      boss.stateTimer = 1500;
      addScreenShake(16);
    }
  } else if (boss.state === 'laserSweep') {
    boss.laserAng = (boss.laserAng || 0) + (boss.laserSweepDir || 1) * (dt / 1000) * 1.5;
    const beamLen = 1300;
    const beamAng = boss.laserAng;

    const bx = boss.x;
    const by = boss.y - boss.height;
    const px = player.x;
    const py = player.y;

    const v1x = px - bx;
    const v1y = py - by;
    const beamVx = Math.cos(beamAng);
    const beamVy = Math.sin(beamAng);
    const proj = v1x * beamVx + v1y * beamVy;

    if (proj > 0 && proj < beamLen) {
      const perpDist = Math.abs(v1x * -beamVy + v1y * beamVx);
      if (perpDist < player.r + 24 && !tank.mounted) {
        applyPlayerDamage(40 * dmgMul * BOSS_SUPER_DMG_MUL * (dt / 1000), true);
        flashVignette();
        createParticles(player.x, player.y, '#ff4d5e', 3, 6);
      }
    }

    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'summonWindup') {
    if (boss.stateTimer <= 0) {
      playBossRoarSound();
      addScreenShake(18);
      const portalCount = BOSS_SUMMON_CAP;
      for (let i = 0; i < portalCount; i++) {
        const a = (i / portalCount) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 300 + Math.random() * 140;
        const cx = player.x + Math.cos(a) * dist;
        const cy = player.y + Math.sin(a) * dist;
        cracks.push({
          id: Math.random().toString(),
          x: Math.max(bounds.minX + 50, Math.min(bounds.maxX - 50, cx)),
          y: Math.max(bounds.minY + 50, Math.min(bounds.maxY - 50, cy)),
          time: 1200,
          type: 'ztank',
        });
      }
      spawnFloater(boss.x, boss.y - 100, `🌀 ${portalCount} PORTALS UNLEASH GIANTS!`, '#b98bff', 20);
      // COMBO: SUMMON → AREA DENIAL. While the player is busy with the
      // fresh giants, phase 2+ occasionally also drops hazard zones so
      // standing still to clean them up isn't free either.
      if (boss.phase >= 2 && Math.random() < COMBO_CHANCE) {
        boss.state = 'denialWindup';
        boss.stateTimer = 350;
        spawnFloater(boss.x, boss.y - 130, '🔥➜ MARKING DANGER ZONES!', '#f4a261', 18);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'fireballWindup') {
    boss.squash = 1.15;
    if (boss.stateTimer <= 0) {
      // Fire multi-projectile hellfire spread
      const baseAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      const count = boss.enraged ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.22;
        const shotAng = baseAng + spread;
        bullets.push({
          id: Math.random().toString(),
          x: boss.x,
          y: boss.y - boss.height,
          vx: Math.cos(shotAng) * 8.5,
          vy: Math.sin(shotAng) * 8.5,
          dmg: 28 * dmgMul,
          cls: 'zfireball',
          life: 2000,
          fromBoss: true,
          splash: 75,
        });
      }
      playExplosionSound();
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'teleportOut') {
    boss.squash = Math.max(0.1, boss.squash - dt / 250);
    if (boss.stateTimer <= 0) {
      if (boss.jumpscare) {
        // JUMPSCARE ARRIVAL: pop out of a cloud right beside the player.
        boss.jumpscare = false;
        const a = Math.random() * Math.PI * 2;
        const jd = 80 + Math.random() * 40;
        boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, player.x + Math.cos(a) * jd));
        boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, player.y + Math.sin(a) * jd));
        boss.squash = 1.45;
        cloudBurst(createParticles, boss.x, boss.y, true);
        playBossRoarSound();
        addScreenShake(26);
        flashVignette();
        spawnFloater(boss.x, boss.y - 100, '👁️ RIGHT BEHIND YOU!', '#ff4d5e', 24);
        boss.state = 'teleportStrike';
        boss.stateTimer = 320;
      } else if (boss.phase >= 2) {
        // PHANTOM FEINT — signature mechanic. Vanish, then flicker into
        // existence at 3 candidate spots at once (2 harmless decoys, 1
        // real). All 3 are visually identical except the real one pulses
        // very slightly faster — a genuine, learnable tell, not a coin
        // flip. After a readable beat, the decoys pop and only the real
        // boss remains, immediately following up with the blink strike.
        const spots: { x: number; y: number; real: boolean }[] = [];
        const realIdx = Math.floor(Math.random() * 3);
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 * i) / 3 + Math.random() * 0.6;
          let sx = player.x + Math.cos(a) * 170;
          let sy = player.y + Math.sin(a) * 170;
          sx = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, sx));
          sy = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, sy));
          spots.push({ x: sx, y: sy, real: i === realIdx });
        }
        boss.phantomSpots = spots;
        const real = spots[realIdx];
        boss.x = real.x;
        boss.y = real.y;
        createParticles(boss.x, boss.y, '#9fdb6e', 15, 6);
        cloudBurst(createParticles, boss.x, boss.y);
        boss.squash = 1.1;
        boss.state = 'phantomTelegraph';
        boss.stateTimer = 550;
      } else {
        const a = Math.random() * Math.PI * 2;
        boss.x = player.x + Math.cos(a) * 160;
        boss.y = player.y + Math.sin(a) * 160;
        boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x));
        boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y));
        boss.squash = 1.3;
        createParticles(boss.x, boss.y, '#9fdb6e', 25, 8);
        cloudBurst(createParticles, boss.x, boss.y);
        boss.state = 'teleportStrike';
        boss.stateTimer = 350;
        spawnFloater(boss.x, boss.y - 90, '*BLINK STRIKE*', '#9fdb6e', 20);
      }
    }
  } else if (boss.state === 'phantomTelegraph') {
    if (boss.stateTimer <= 0) {
      boss.phantomSpots = undefined;
      boss.squash = 1.3;
      createParticles(boss.x, boss.y, '#9fdb6e', 30, 9);
      addScreenShake(10);
      boss.state = 'teleportStrike';
      boss.stateTimer = 320;
      spawnFloater(boss.x, boss.y - 90, '*BLINK STRIKE*', '#9fdb6e', 20);
    }
  } else if (boss.state === 'teleportStrike') {
    if (boss.stateTimer <= 0) {
      const pd = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (pd < 160 && !tank.mounted) {
        const blinkDmg = Math.round((boss.phase >= 2 ? 68 : 55) * dmgMul * BOSS_SUPER_DMG_MUL);
        applyPlayerDamage(blinkDmg);
        flashVignette();
        spawnFloater(player.x, player.y - 40, `-${blinkDmg} BLINK STRIKE`, '#9fdb6e', 22);
        applyKnockback(player, boss.x, boss.y, now);
      }
      addScreenShake(16);
      // COMBO: TELEPORT → SLASH. After the blink strike lands (or whiffs),
      // phase 2+ occasionally follows immediately with a fast beam slash
      // instead of resetting to the neutral chase.
      if (boss.phase >= 2 && Math.random() < COMBO_CHANCE) {
        boss.state = 'laserWindup';
        boss.stateTimer = 450;
        boss.laserAng = Math.atan2(player.y - boss.y, player.x - boss.x);
        boss.laserSweepDir = Math.random() > 0.5 ? 1 : -1;
        spawnFloater(boss.x, boss.y - 100, '👻➜🔴 FOLLOW-UP SLASH!', '#9fdb6e', 20);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'spinWindup') {
    boss.squash = 0.85;
    if (boss.stateTimer <= 0) {
      boss.state = 'spinning';
      boss.stateTimer = 1600;
    }
  } else if (boss.state === 'spinning') {
    boss.facingAng += 0.35;
    const spinDmg = 38 * dmgMul * (dt / 1000);
    if (Math.hypot(player.x - boss.x, player.y - boss.y) < boss.r + 75 && !tank.mounted) {
      applyPlayerDamage(spinDmg);
      flashVignette();
      applyKnockback(player, boss.x, boss.y, now, KNOCKBACK_UNITS, 450); // once per pass, not every frame
    }
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'roar') {
    boss.squash = 1.25;
    boss.roarBoostUntil = now + 3500;
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'tripped') {
    boss.squash = 0.45;
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'spikeField') {
    // Sequential ground-eruption attack: each burst telegraphs at the
    // player's position when it's SET, then erupts a fixed delay later.
    // Surviving it means actually relocating between bursts — standing in
    // one spot spraying bullets gets you hit by every single eruption.
    if (now >= (boss.spikeBurstAt || 0)) {
      const sx = boss.spikeX ?? boss.x;
      const sy = boss.spikeY ?? boss.y;
      const dist = Math.hypot(player.x - sx, player.y - sy);
      if (dist < 95 && !tank.mounted) {
        const spikeDmg = Math.round(46 * dmgMul * BOSS_SUPER_DMG_MUL);
        applyPlayerDamage(spikeDmg);
        flashVignette();
        spawnFloater(player.x, player.y - 40, `-${spikeDmg} SPIKE!`, '#f4a261', 20);
      }
      addScreenShake(10);
      addDecal(sx, sy, 70);
      createParticles(sx, sy, '#f4a261', 22, 8, 350);
      playExplosionSound();

      boss.spikeBurstsLeft = (boss.spikeBurstsLeft || 1) - 1;
      if (boss.spikeBurstsLeft > 0) {
        boss.spikeX = player.x;
        boss.spikeY = player.y;
        boss.spikeBurstAt = now + (boss.spikeBurstDelay || 850);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'frostWindup') {
    boss.squash = 1.1;
    if (Math.random() < 0.5) createParticles(boss.x, boss.y - boss.height, '#7ad6ff', 3, 5, 200);
    if (boss.stateTimer <= 0) {
      boss.state = 'frostBeam';
      boss.stateTimer = 300; // narrow, short-lived bolt — not a sweeping beam
      boss.frostAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      addScreenShake(10);
    }
  } else if (boss.state === 'frostBeam') {
    // FREEZE/SLOW ATTACK (spec item G): a narrow, aimed bolt — locked at
    // fire time, not tracking — so it's dodgeable by moving off the line.
    // On a hit it slows the player (never fully locks movement) and opens
    // a brief follow-up window rather than being unavoidable chip damage.
    const bx = boss.x;
    const by = boss.y - boss.height;
    const beamAng = boss.frostAng || 0;
    const beamLen = 1100;
    const dx = player.x - bx;
    const dy = player.y - by;
    const proj = dx * Math.cos(beamAng) + dy * Math.sin(beamAng);
    if (proj > 0 && proj < beamLen) {
      const perp = Math.abs(dx * -Math.sin(beamAng) + dy * Math.cos(beamAng));
      if (perp < player.r + 20 && !tank.mounted && !boss.frostHitPlayer) {
        const frostDmg = Math.round(24 * dmgMul);
        applyPlayerDamage(frostDmg);
        player.frozenUntil = now + 1500;
        flashVignette();
        spawnFloater(player.x, player.y - 40, '❄️ SLOWED!', '#7ad6ff', 20);
        createParticles(player.x, player.y, '#7ad6ff', 16, 6, 400);
        boss.frostHitPlayer = true;
      }
    }
    createParticles(bx + Math.cos(beamAng) * Math.min(beamLen, Math.max(0, proj)), by + Math.sin(beamAng) * Math.min(beamLen, Math.max(0, proj)), '#7ad6ff', 3, 5, 200);
    if (boss.stateTimer <= 0) {
      // If it connected, capitalize immediately with a fast charge while
      // the player is still slowed — the "follow-up opportunity" the spec
      // asks for, without making the freeze itself unavoidable.
      if (boss.frostHitPlayer && boss.phase >= 2) {
        boss.state = 'chargeWindup';
        boss.stateTimer = CHARGE_WINDUP_MS;
        boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
        spawnFloater(boss.x, boss.y - 100, '❄️➜⚡ PUNISHING THE SLOW!', '#ff4d5e', 20);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  } else if (boss.state === 'denialWindup') {
    boss.squash = 1.15;
    if (boss.stateTimer <= 0) {
      // AREA DENIAL (spec item H): 2-4 zones scattered around the player
      // with gaps between them — a warning-only period before they go hot,
      // then they expire on their own. Ticked independently of boss.state
      // in the universal section above.
      const count = 2 + (boss.phase >= 3 ? 2 : 1);
      const zones: NonNullable<typeof boss.areaZones> = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 60 + Math.random() * 160;
        const zx = Math.max(bounds.minX + 70, Math.min(bounds.maxX - 70, player.x + Math.cos(a) * dist));
        const zy = Math.max(bounds.minY + 70, Math.min(bounds.maxY - 70, player.y + Math.sin(a) * dist));
        zones.push({ x: zx, y: zy, r: 85, warnUntil: now + 550, expiresAt: now + 550 + 3200 });
      }
      boss.areaZones = [...(boss.areaZones || []), ...zones];
      addScreenShake(10);
      spawnFloater(boss.x, boss.y - 100, '⚠️ DANGER ZONES ACTIVE!', '#f4a261', 20);
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'pullWindup') {
    // Chain telegraph: the boss locks on and the chain is drawn to the player
    boss.squash = 0.9;
    boss.facingAng = Math.atan2(player.y - boss.y, player.x - boss.x);
    if (boss.stateTimer <= 0) {
      boss.state = 'pulling';
      boss.stateTimer = 900; // safety cap
    }
  } else if (boss.state === 'pulling') {
    boss.squash = 1.05;
    const pdx = boss.x - player.x;
    const pdy = boss.y - player.y;
    const pd = Math.hypot(pdx, pdy);
    boss.facingAng = Math.atan2(-pdy, -pdx);
    const stopGap = boss.r + player.r + PULL_END_GAP;
    const pullStep = Math.min(Math.max(0, pd - stopGap), PULL_SPEED * dt);
    if (pd > 0.001 && pullStep > 0) {
      player.x += (pdx / pd) * pullStep;
      player.y += (pdy / pd) * pullStep;
    }
    cancelKnockback(player); // the yank overrides any slide in progress
    createParticles(player.x, player.y, '#c9c9d6', 2, 4, 220);
    if (pd - pullStep <= stopGap + 1 || boss.stateTimer <= 0) {
      // Arrived: straight into the combo
      addScreenShake(14);
      createParticles(player.x, player.y, '#ff4d5e', 14, 7, 300);
      startCombo(boss, player, now, PULL_COMBO_WINDUP);
    }
  } else if (boss.state === 'comboWindup') {
    const step = COMBO_STEPS[boss.comboStep || 0];
    boss.squash = 0.85;
    boss.facingAng = boss.comboAng || 0;
    if (boss.stateTimer <= 0) {
      const a = boss.comboAng || 0;
      // Lunge toward the locked direction, but never through the player
      const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
      const lunge = Math.max(0, Math.min(step.lunge, dist - (boss.r + player.r + 6)));
      const sx = boss.x;
      const sy = boss.y;
      boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x + Math.cos(a) * lunge));
      boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y + Math.sin(a) * lunge));
      for (let k = 0; k <= 3; k++) {
        createParticles(sx + (boss.x - sx) * (k / 3), sy + (boss.y - sy) * (k / 3), '#ff9a3c', 2, 5, 200);
      }
      // Hit check: inside the cone (or the whole ring for the smash) and within reach
      const hdx = player.x - boss.x;
      const hdy = player.y - boss.y;
      const hd = Math.hypot(hdx, hdy);
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(hdy, hdx) - a), Math.cos(Math.atan2(hdy, hdx) - a)));
      const inCone = step.arc >= Math.PI * 2 || da <= step.arc / 2;
      if (!tank.mounted && hd <= boss.r + player.r + step.reach && inCone) {
        const cDmg = Math.round(step.dmg * dmgMul);
        const hp0 = player.hp;
        applyPlayerDamage(cDmg, false, step.arc >= Math.PI * 2); // the SMASH can't be parried — dodge it
        if (player.hp < hp0) {
          flashVignette();
          applyKnockback(player, boss.x, boss.y, now);
          spawnFloater(player.x, player.y - 40, `-${cDmg} ${step.name}`, '#ff9a3c', 20);
        }
      }
      addScreenShake(step.shake);
      createParticles(boss.x + Math.cos(a) * boss.r, boss.y + Math.sin(a) * boss.r, '#ffd9a0', 10, 7, 260);
      // Next hit in the chain, or the finisher's recovery (a wide-open punish window)
      boss.comboStep = (boss.comboStep || 0) + 1;
      if (boss.comboStep < COMBO_STEPS.length) {
        boss.comboAng = Math.atan2(player.y - boss.y, player.x - boss.x);
        boss.stateTimer = COMBO_STEPS[boss.comboStep].windup;
      } else {
        boss.meleeStreak = (boss.meleeStreak || 0) + 1;
        if (boss.meleeStreak >= VOID_ORB_STREAK && !boss.splitActive) {
          // Too much melee: the boss stops and gathers a void orb over its head
          boss.meleeStreak = 0;
          boss.state = 'orbCharge';
          boss.stateTimer = VOID_ORB_CHARGE_MS;
          boss.chargeOrbStart = now;
          const oid = Math.random().toString();
          boss.chargeOrbId = oid;
          bossOrbs.push({
            id: oid, x: boss.x, y: boss.y - boss.r - 70, vx: 0, vy: 0, r: 14,
            hp: VOID_ORB_HP, hpMax: VOID_ORB_HP, dmg: Math.round(VOID_ORB_DMG * dmgMul),
            life: VOID_ORB_CHARGE_MS + 5000, kind: 'charge',
          });
          playBossRoarSound();
          spawnFloater(boss.x, boss.y - boss.r - 130, '🔮 DESTROY THE ORB!', '#c77dff', 24);
        } else {
          boss.state = 'comboRecover';
          boss.stateTimer = COMBO_RECOVER_MS;
        }
      }
    }
  } else if (boss.state === 'orbCharge') {
    boss.squash = 0.9 + Math.sin(now / 60) * 0.04;
    boss.height = 0;
    const orb = bossOrbs.find((o) => o.id === boss.chargeOrbId);
    if (!orb) {
      // Orb was shot down in time: the boss is staggered and wide open
      boss.chargeOrbId = undefined;
      boss.staggerUntil = now + STAGGER_MS;
      boss.posture = 0;
      boss.state = 'dizzy';
      boss.stateTimer = STAGGER_MS;
      addScreenShake(20);
      spawnFloater(boss.x, boss.y - boss.r - 80, 'ORB BROKEN — STAGGERED!', '#7ee787', 24);
      createParticles(boss.x, boss.y, '#c77dff', 40, 10, 600);
    } else {
      // Orb floats above the head and swells as it charges
      const prog = 1 - Math.max(0, boss.stateTimer / VOID_ORB_CHARGE_MS);
      orb.x = boss.x;
      orb.y = boss.y - boss.r - 70;
      orb.r = 14 + prog * 30;
      if (Math.random() < 0.5) createParticles(orb.x + (Math.random() - 0.5) * 80, orb.y + (Math.random() - 0.5) * 80, '#c77dff', 1, 2, 300);
      if (boss.stateTimer <= 0) {
        // Too slow: launch it at the player
        const a = Math.atan2(player.y - orb.y, player.x - orb.x);
        orb.kind = 'void';
        orb.vx = Math.cos(a) * VOID_ORB_SPEED;
        orb.vy = Math.sin(a) * VOID_ORB_SPEED;
        orb.life = 6000;
        boss.chargeOrbId = undefined;
        boss.state = 'comboRecover';
        boss.stateTimer = COMBO_RECOVER_MS;
        addScreenShake(10);
        spawnFloater(orb.x, orb.y - 30, 'ORB LAUNCHED — DODGE!', '#c77dff', 20);
      }
    }
  } else if (boss.state === 'comboRecover') {
    boss.squash = 0.9;
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'splitCast') {
    // Phase 3: the boss splits into 3 bodies (see bossPhase3.ts)
    boss.squash = 1.2 + Math.sin(now / 50) * 0.18;
    if (Math.random() < 0.7) createParticles(boss.x, boss.y - boss.height, '#c9c9ff', 4, 8, 400);
    if (boss.stateTimer <= 0) {
      startSplit(boss, p3, bounds, { spawnFloater, createParticles, addScreenShake }, (x, y) => cloudBurst(createParticles, x, y, true));
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'dizzy') {
    // This body took its slice of damage and is stunned until the other two are broken too.
    boss.squash = 1 + Math.sin(now / 130) * 0.08;
    boss.height = 0;
    if (Math.random() < 0.35) createParticles(boss.x + (Math.random() - 0.5) * boss.r, boss.y - boss.r * 0.8, '#ffe066', 1, 2, 500);
    if (!boss.splitActive) {
      // Posture-break stagger keeps the boss down until staggerUntil
      if (boss.staggerUntil === undefined || now >= boss.staggerUntil) {
        boss.staggerUntil = undefined;
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    } else if (boss.splitDizzy && p3.clones.length === 0) {
      // Every clone has been dragged in: the real boss wakes holding the remaining "final hearts".
      boss.splitActive = false;
      boss.splitDizzy = false;
      boss.finalStand = true;
      boss.finalStandAt = now;
      boss.missilesFired = 0;
      boss.missileAt = now + MISSILE_FIRST_MS;
      p3.crackX = boss.x;
      p3.crackY = boss.y;
      p3.crackSeed = Math.floor(Math.random() * 1e6) + 1;
      p3.flash = 1;
      p3.flashAt = now + 1500;
      playBossRoarSound();
      playAlertStinger();
      addScreenShake(32);
      createParticles(boss.x, boss.y, '#cfd4ff', 60, 14, 800);
      spawnFloater(boss.x, boss.y - 140, '💀 FINAL HEARTS — THE DIMENSION IS BREAKING!', '#ffd166', 24);
      boss.phaseTransitionUntil = now + 500;
      boss.state = 'chasing';
      boss.stateTimer = 800;
    }
  } else if (boss.state === 'meteorWindup') {
    boss.squash = 1.25 + Math.sin(now / 55) * 0.15;
    if (Math.random() < 0.6) createParticles(boss.x, boss.y - boss.height, '#ff9a3c', 3, 7, 300);
    if (boss.stateTimer <= 0) {
      boss.state = 'meteorShower';
      boss.stateTimer = 3200;
      boss.meteorNextAt = now;
    }
  } else if (boss.state === 'meteorShower') {
    boss.squash = 1.1;
    if (boss.meteorNextAt !== undefined && now >= boss.meteorNextAt) {
      boss.meteorNextAt = now + (boss.enraged ? 280 : 330);
      const mDmg = Math.round(METEOR_DMG * dmgMul);
      const mDps = CRATER_DPS * dmgMul;
      const cx = (v: number) => Math.max(bounds.minX + 60, Math.min(bounds.maxX - 60, v));
      const cy = (v: number) => Math.max(bounds.minY + 60, Math.min(bounds.maxY - 60, v));
      // One lands close to the player (forces movement), one further out
      const a1 = Math.random() * Math.PI * 2;
      const d1 = Math.random() * 120;
      spawnMeteor(p3, cx(player.x + Math.cos(a1) * d1), cy(player.y + Math.sin(a1) * d1), mDmg, mDps);
      const a2 = Math.random() * Math.PI * 2;
      const d2 = 150 + Math.random() * 370;
      spawnMeteor(p3, cx(player.x + Math.cos(a2) * d2), cy(player.y + Math.sin(a2) * d2), mDmg, mDps);
    }
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'throwWindup') {
    boss.squash = 0.85;
    boss.facingAng = boss.targetAng;
    if (boss.stateTimer <= 0) {
      const tAng = boss.targetAng;
      bossOrbs.push({
        id: Math.random().toString(),
        x: boss.x,
        y: boss.y - boss.height,
        vx: Math.cos(tAng) * THROW_SPEED,
        vy: Math.sin(tAng) * THROW_SPEED,
        r: 30,
        hp: 99999,
        hpMax: 99999,
        dmg: Math.round(THROW_DMG * dmgMul),
        life: 4500,
        kind: 'throw',
        spin: 0,
      });
      addScreenShake(8);
      playExplosionSound();
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
    }
  } else if (boss.state === 'despWindup') {
    // The one-time Phase 3 signature finisher (spec item J). Fully
    // telegraphed — a full extra beat longer than a normal windup — so
    // "it's suddenly next to you" still leaves a real read before it goes off.
    boss.squash = 1.3 + Math.sin(now / 60) * 0.15;
    if (Math.random() < 0.6) createParticles(boss.x, boss.y - boss.height, '#ffd166', 4, 7, 250);
    if (boss.stateTimer <= 0) {
      boss.state = 'despStrike';
      boss.stateTimer = 260;
      boss.facingAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      addScreenShake(24);
      spawnFloater(boss.x, boss.y - 130, '💀 DESPERATION STRIKE!', '#ff4d5e', 26);
    }
  } else if (boss.state === 'despStrike') {
    if (boss.stateTimer <= 0) {
      // Omnidirectional burst — expanding shockwave plus a full ring of
      // projectiles. Big and scary-looking, but a single readable payload,
      // not a stacked wall of unavoidable damage.
      const waveDmg = Math.round(45 * dmgMul * BOSS_SUPER_DMG_MUL);
      shockwaves.push({
        id: Math.random().toString(),
        x: boss.x, y: boss.y,
        r: 40, maxR: 480,
        dmg: waveDmg, speed: 13,
        color: '#ff4d5e', pushForce: 16,
      });
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        bullets.push({
          id: Math.random().toString(),
          x: boss.x,
          y: boss.y - boss.height,
          vx: Math.cos(a) * 7.5,
          vy: Math.sin(a) * 7.5,
          dmg: 24 * dmgMul,
          cls: 'zfireball',
          life: 1800,
          fromBoss: true,
          splash: 60,
        });
      }
      addScreenShake(30);
      createParticles(boss.x, boss.y, '#ff4d5e', 70, 16, 700);
      playExplosionSound();
      boss.state = 'despRecover';
      boss.stateTimer = 900; // long, real punish window — the payoff for surviving it
    }
  } else if (boss.state === 'despRecover') {
    boss.squash = 0.85;
    if (boss.stateTimer <= 0) {
      if (!boss.splitDone) {
        // The finisher is over — now the real boss splits into 3
        boss.splitDone = true;
        boss.state = 'splitCast';
        boss.stateTimer = 900;
        playBossRoarSound();
        spawnFloater(boss.x, boss.y - 120, '🌀 IT IS SPLITTING...', '#c9c9ff', 20);
      } else {
        boss.state = 'chasing';
        boss.stateTimer = boss.cycleMs;
      }
    }
  }
}
