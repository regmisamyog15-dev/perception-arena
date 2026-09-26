import { Boss, PlayerState, Shockwave, Crack, Tank, Bullet, BossOrb } from '../types/game';
import {
  BOSS_TELEGRAPHS, BOSS_QUOTES, CHARGE_LANE_LEN,
  PORTAL_INTERVAL_MS, PORTAL_INTERVAL_ENRAGED_MS,
  ORB_INTERVAL_MS, ORB_INTERVAL_ENRAGED_MS, ORB_SPEED, ORB_HP, ORB_DMG_MULT,
} from './constants';
import { playExplosionSound, playBossRoarSound, playAlertStinger } from '../audio/sound';

export function updateBossAI(
  boss: Boss,
  player: PlayerState,
  tank: Tank,
  shockwaves: Shockwave[],
  cracks: Crack[],
  bullets: Bullet[],
  bossOrbs: BossOrb[],
  dt: number,
  now: number,
  wave: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  applyPlayerDamage: (dmg: number, isRanged?: boolean) => void,
  flashVignette: () => void,
  spawnFloater: (x: number, y: number, text: string, color?: string, size?: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void,
  addDecal: (x: number, y: number, r: number) => void,
  addScreenShake: (amount: number) => void
) {
  // Calculate milestone gate tier (Every 2 gates = +1 tier)
  const gateTier = boss.doorIndex ? Math.floor((boss.doorIndex - 1) / 2) : 0;
  const dmgMul = (1 + gateTier * 0.22) * (boss.enraged ? 1.25 : 1.0);

  // Check Enrage / Phase 2 threshold (below 40% HP)
  if (!boss.enraged && boss.hp <= boss.hpMax * 0.4) {
    boss.enraged = true;
    boss.phase = 2;
    boss.baseSpeed *= 1.2;
    boss.cycleMs = Math.max(1200, boss.cycleMs * 0.75);
    playBossRoarSound();
    playAlertStinger();
    addScreenShake(25);
    spawnFloater(boss.x, boss.y - 120, '🔥 PHASE 2: ENRAGED MODE ACTIVATED!', '#ff4d5e', 24);
    createParticles(boss.x, boss.y, '#ff4d5e', 60, 14, 700);
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
      boss.stateTimer = 300;
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
  // UNIVERSAL PORTAL SUMMONS — every boss, on a clock, independent of
  // its gimmick or move rotation. Portals open in a ring around (but never
  // on top of) the player, count down while pulsing (the existing Crack
  // visuals), then each births a giant ztank — the same heavy unit used
  // in the final phases — so a portal wave reads as a real escalation.
  // =====================================================
  const portalInterval = boss.enraged ? PORTAL_INTERVAL_ENRAGED_MS : PORTAL_INTERVAL_MS;
  if (boss.portalCheckAt === undefined) {
    boss.portalCheckAt = now + portalInterval;
  } else if (now >= boss.portalCheckAt) {
    boss.portalCheckAt = now + portalInterval;
    addScreenShake(14);
    spawnFloater(boss.x, boss.y - 100, '🌀 5 PORTALS UNLEASH GIANTS!', '#b98bff', 20);
    const portalCount = 5;
    for (let i = 0; i < portalCount; i++) {
      const ang = (i / portalCount) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 300 + Math.random() * 140; // wider ring — ztanks hit harder & take up more space
      const px = Math.max(bounds.minX + 60, Math.min(bounds.maxX - 60, player.x + Math.cos(ang) * dist));
      const py = Math.max(bounds.minY + 60, Math.min(bounds.maxY - 60, player.y + Math.sin(ang) * dist));
      cracks.push({
        id: Math.random().toString(),
        x: px,
        y: py,
        time: boss.enraged ? 950 : 1200,
        type: 'ztank',
      });
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
  } else if (now >= boss.orbCheckAt) {
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
      spawnFloater(boss.x, boss.y - 110, '💀 BERSERKER RAGE ACTIVATED! KEEP MOVING!', '#588157', 24);
      createParticles(boss.x, boss.y, '#588157', 60, 14, 700);
    }
    if (boss.gimmickActive && Math.random() < 0.3) {
      createParticles(boss.x + (Math.random()-0.5)*60, boss.y + (Math.random()-0.5)*60, '#588157', 2, 5, 200);
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
    const speedMul = (now < boss.roarBoostUntil ? 1.3 : 1) * (boss.enraged ? 1.2 : 1);
    const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.facingAng = ang;
    const dToPlayer = Math.hypot(player.x - boss.x, player.y - boss.y);

    if (!boss.skin.flies || dToPlayer > 260) {
      boss.x += Math.cos(ang) * boss.baseSpeed * speedMul;
      boss.y += Math.sin(ang) * boss.baseSpeed * speedMul;
    }
    boss.squash = 1 + Math.sin(now / 90) * 0.06;
    if (boss.skin.flies) boss.height = 60 + Math.sin(now / 260) * 12;

    if (boss.stateTimer <= 0) {
      const moves = [...boss.skin.moves];
      if (boss.enraged) {
        moves.push('solarBeam', 'pushSlam', 'laser', 'charge', 'spikeField');
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
          boss.stateTimer = boss.enraged ? 550 : 800; // longer now that the red lane gives a real dodge read
          boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
          spawnFloater(boss.x, boss.y - 100, '⚡ BULL CHARGE LOCK', '#ffcf5c', 18);
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
          spawnFloater(boss.x, boss.y - 100, '*shadow blink*', '#9fdb6e', 18);
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
        }
      }
    }
  } else if (boss.state === 'anticipate') {
    if (boss.stateTimer <= 0) {
      boss.state = 'rising';
      boss.stateTimer = 400;
      boss.vHeight = 15;
      boss.squash = 1.35;
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

      const leapDmg = Math.round(65 * (boss.skin.leapMult || 1) * dmgMul);
      const waveDmg = Math.round(35 * dmgMul);
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
        // Push Player with reasonable impulse
        const pushAng = Math.atan2(player.y - boss.y, player.x - boss.x) + (Math.random() - 0.5) * 0.3;
        const pushMag = 12 * (boss.enraged ? 1.25 : 1.0);
        player.pushVx = Math.cos(pushAng) * pushMag;
        player.pushVy = Math.sin(pushAng) * pushMag;
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
        const solarDmg = 42 * dmgMul * (dt / 1000);
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
      // Safety cap only — the real end condition is covering the full
      // telegraphed lane length below, so this never cuts a charge short.
      boss.stateTimer = 2500;
      boss.chargeAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.chargeDistTraveled = 0;
      boss.chargeHitPlayer = false;
    }
  } else if (boss.state === 'charging') {
    boss.squash = 1.15;
    const chargeSpeed = (14 + gateTier * 1.2) * (boss.enraged ? 1.2 : 1);
    boss.x += Math.cos(boss.chargeAng || 0) * chargeSpeed;
    boss.y += Math.sin(boss.chargeAng || 0) * chargeSpeed;
    boss.facingAng = boss.chargeAng || 0;
    boss.chargeDistTraveled = (boss.chargeDistTraveled || 0) + chargeSpeed;

    createParticles(boss.x, boss.y, '#ff4d5e', 3, 5, 200);

    // Hit-check across the FULL width of the red lane (same geometry it's
    // drawn with) rather than a tiny circle around the boss, and it lands
    // once, for real damage — not shredded into near-zero per-frame ticks.
    if (!boss.chargeHitPlayer && !tank.mounted) {
      const ang = boss.chargeAng || 0;
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const forward = dx * Math.cos(ang) + dy * Math.sin(ang);
      const lateral = Math.abs(dx * -Math.sin(ang) + dy * Math.cos(ang));
      const laneHalfWidth = boss.r + player.r + 15;
      if (forward > -boss.r && forward < laneHalfWidth * 2 && lateral < laneHalfWidth) {
        const chargeDmg = Math.round(70 * (boss.skin.chargeMult || 1) * dmgMul);
        applyPlayerDamage(chargeDmg);
        flashVignette();
        spawnFloater(player.x, player.y - 40, `-${chargeDmg} RAMMED!`, '#ff4d5e', 22);
        player.pushVx = Math.cos(ang) * 16;
        player.pushVy = Math.sin(ang) * 16;
        boss.chargeHitPlayer = true;
      }
    }

    boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x));
    boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y));

    // Travel the full telegraphed distance (matches the red lane length the
    // player was shown) instead of stopping early on an arbitrary timer.
    if ((boss.chargeDistTraveled || 0) >= CHARGE_LANE_LEN || boss.stateTimer <= 0) {
      boss.state = 'chargeRecover';
      boss.stateTimer = 450;
      createParticles(boss.x, boss.y, '#999', 20, 6);
    }
  } else if (boss.state === 'chargeRecover') {
    boss.squash = 0.92;
    if (boss.stateTimer <= 0) {
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
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
        applyPlayerDamage(40 * dmgMul * (dt / 1000), true);
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
      const portalCount = 5;
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
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
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
      const a = Math.random() * Math.PI * 2;
      boss.x = player.x + Math.cos(a) * 160;
      boss.y = player.y + Math.sin(a) * 160;
      boss.x = Math.max(bounds.minX + boss.r, Math.min(bounds.maxX - boss.r, boss.x));
      boss.y = Math.max(bounds.minY + boss.r, Math.min(bounds.maxY - boss.r, boss.y));
      boss.squash = 1.3;
      createParticles(boss.x, boss.y, '#9fdb6e', 25, 8);
      boss.state = 'teleportStrike';
      boss.stateTimer = 350;
      spawnFloater(boss.x, boss.y - 90, '*BLINK STRIKE*', '#9fdb6e', 20);
    }
  } else if (boss.state === 'teleportStrike') {
    if (boss.stateTimer <= 0) {
      const pd = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (pd < 160 && !tank.mounted) {
        const blinkDmg = Math.round(55 * dmgMul);
        applyPlayerDamage(blinkDmg);
        flashVignette();
        spawnFloater(player.x, player.y - 40, `-${blinkDmg} BLINK STRIKE`, '#9fdb6e', 22);
        // Gentle knockback
        const pAng = Math.atan2(player.y - boss.y, player.x - boss.x);
        player.pushVx = Math.cos(pAng) * 10;
        player.pushVy = Math.sin(pAng) * 10;
      }
      addScreenShake(16);
      boss.state = 'chasing';
      boss.stateTimer = boss.cycleMs;
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
      const pAng = Math.atan2(player.y - boss.y, player.x - boss.x);
      player.pushVx = Math.cos(pAng) * 8;
      player.pushVy = Math.sin(pAng) * 8;
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
        const spikeDmg = Math.round(46 * dmgMul);
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
  }
}
