import { Tower, Zombie, PlayerState, Shockwave, Boss, Bullet } from '../types/game';
import { playTowerHitSound, playExplosionSound, playUpgradeSound, playClimbSound } from '../audio/sound';

export function updateTowersAndClimbing(
  towers: Tower[],
  player: PlayerState,
  zombies: Zombie[],
  boss: Boss | null,
  bullets: Bullet[],
  dt: number,
  now: number,
  onTowerCollapse: (t: Tower) => void,
  onTowerRebuilt: (t: Tower) => void,
  spawnFloater: (x: number, y: number, text: string, color?: string, size?: number) => void
) {
  let activeTower: Tower | null = null;

  for (const t of towers) {
    // Handle Auto-Rebuilding if destroyed
    if (t.destroyed) {
      t.repairTimer -= dt;
      if (t.repairTimer <= 0) {
        t.destroyed = false;
        t.hp = t.hpMax;
        t.repairTimer = 0;
        playUpgradeSound();
        onTowerRebuilt(t);
        spawnFloater(t.x, t.y - 60, `🗼 ${t.name} REBUILT! (${t.hpMax} HP)`, '#7ee787', 20);
      }
    }

    if (t.shakeTime && t.shakeTime > 0) {
      t.shakeTime -= dt;
    }

    // Climbing check: Only player can climb! Player touches tower base/ladder
    if (!t.destroyed) {
      const halfW = t.w / 2 + 18;
      const halfH = t.h / 2 + 18;
      const isInside = player.x >= t.x - halfW && player.x <= t.x + halfW && player.y >= t.y - halfH && player.y <= t.y + halfH;

      if (isInside) {
        if (player.onTowerId !== t.id) {
          playClimbSound();
          spawnFloater(player.x, player.y - 50, `CLIMBED ${t.name}! [+TACTICAL SNIPER VISION]`, '#83d3e1', 18);
        }
        player.onTowerId = t.id;
        player.elevation = t.elevation || 60;
        activeTower = t;
      }
    }
  }

  if (!activeTower) {
    player.onTowerId = null;
    player.elevation = 0;
  }

  // Melee & Ranged zombies attacking Tower Base (1000 HP)
  for (const t of towers) {
    if (t.destroyed) continue;

    const attackRadius = Math.max(t.w, t.h) / 2 + 45;

    for (const z of zombies) {
      if (z.dead) continue;

      const dist = Math.hypot(z.x - t.x, z.y - t.y);

      // If player is on tower, zombies surround and attack tower foundation
      if (player.onTowerId === t.id && dist < 500 && dist > attackRadius) {
        const ang = Math.atan2(t.y - z.y, t.x - z.x);
        z.x += Math.cos(ang) * z.speed * 0.9;
        z.y += Math.sin(ang) * z.speed * 0.9;
      }

      if (dist <= attackRadius) {
        const dmg = (z.dmg || 15) * (dt / 1000) * 2.5;
        t.hp -= dmg;
        t.shakeTime = 120;

        if (Math.random() < 0.05) {
          playTowerHitSound();
        }

        const sepAng = Math.atan2(z.y - t.y, z.x - t.x);
        z.x += Math.cos(sepAng) * 1.5;
        z.y += Math.sin(sepAng) * 1.5;

        if (t.hp <= 0 && !t.destroyed) {
          t.destroyed = true;
          t.hp = 0;
          t.repairTimer = t.repairDuration || 240000;
          playExplosionSound();
          onTowerCollapse(t);
          spawnFloater(t.x, t.y - 70, `💥 ${t.name} DESTROYED! Auto-repair in 4:00`, '#ff4d5e', 22);

          if (player.onTowerId === t.id) {
            player.onTowerId = null;
            player.elevation = 0;
            spawnFloater(player.x, player.y - 40, 'FELL FROM TOWER!', '#ff4d5e', 20);
          }
          break;
        }
      }
    }

    // Boss attacking tower if nearby
    if (boss && !boss.dead && boss.state !== 'entering') {
      const bossDist = Math.hypot(boss.x - t.x, boss.y - t.y);
      if (bossDist < attackRadius + boss.r) {
        t.hp -= 250 * (dt / 1000);
        t.shakeTime = 200;
        if (t.hp <= 0 && !t.destroyed) {
          t.destroyed = true;
          t.hp = 0;
          t.repairTimer = t.repairDuration || 240000;
          playExplosionSound();
          onTowerCollapse(t);
          spawnFloater(t.x, t.y - 70, `💥 ${t.name} CRUSHED BY BOSS!`, '#ff4d5e', 24);
          if (player.onTowerId === t.id) {
            player.onTowerId = null;
            player.elevation = 0;
          }
        }
      }
    }
  }
}
