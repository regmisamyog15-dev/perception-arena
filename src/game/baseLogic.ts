import { BaseState, PlayerState, Soldier, Zombie, Boss, Bullet } from '../types/game';
import { WORLD_W, WORLD_H } from './constants';

export interface BaseLevelDef {
  level: number;
  name: string;
  desc: string;
  cost: number;
  maxSoldiers: number;
  healingRate: number;
  safeRadius: number;
  spawnBlockRadius: number;
  turrets: number;
  hpMax: number;
  beaconColor: string;
}

// Hard squad cap — Jack (rifleman) + one other soldier, no more.
export const MAX_SQUAD_SIZE = 2;

export const BASE_LEVELS: Record<number, BaseLevelDef> = {
  1: {
    level: 1,
    name: 'Cobblestone Sanctuary',
    desc: 'Blocky Minecraft safe base with cyan beacon. Impenetrable forcefield shields against all zombies. Recruits 1 squad soldier.',
    cost: 0,
    maxSoldiers: 1,
    healingRate: 35,
    safeRadius: 280,
    spawnBlockRadius: 850,
    turrets: 0,
    hpMax: 3000,
    beaconColor: '#83d3e1',
  },
  2: {
    level: 2,
    name: 'Fortified Stone Citadel',
    desc: 'Stone brick battlements with emerald beacon + 2 perimeter defense Tesla coils. Recruits up to 2 soldiers + faster healing.',
    cost: 250,
    maxSoldiers: 2,
    healingRate: 60,
    safeRadius: 320,
    spawnBlockRadius: 950,
    turrets: 2,
    hpMax: 6000,
    beaconColor: '#7ee787',
  },
  3: {
    level: 3,
    name: 'Obsidian & Diamond Stronghold',
    desc: 'Obsidian ramparts with amethyst beacon + 4 defense turrets. Recruits full squad of MAX 3 soldiers (1 Legendary Hero) + squad damage boost.',
    cost: 550,
    maxSoldiers: 3,
    healingRate: 95,
    safeRadius: 360,
    spawnBlockRadius: 1100,
    turrets: 4,
    hpMax: 12000,
    beaconColor: '#b98bff',
  },
  4: {
    level: 4,
    name: 'Netherite Mega-Sanctuary',
    desc: 'Supreme Netherite Bastion with celestial golden beacon. Full squad of MAX 3 elite soldiers + hyper healing + 6 plasma defense turrets.',
    cost: 1000,
    maxSoldiers: 3,
    healingRate: 150,
    safeRadius: 400,
    spawnBlockRadius: 1350,
    turrets: 6,
    hpMax: 25000,
    beaconColor: '#ffd166',
  },
};

export function createInitialBase(): BaseState {
  const def = BASE_LEVELS[1];
  const bx = WORLD_W / 2;
  const by = WORLD_H / 2;
  return {
    x: bx,
    y: by,
    w: 520,
    h: 520,
    level: 1,
    hp: def.hpMax,
    hpMax: def.hpMax,
    safeRadius: def.safeRadius,
    spawnBlockRadius: def.spawnBlockRadius,
    maxSoldiers: Math.min(def.maxSoldiers, MAX_SQUAD_SIZE),
    healingRate: def.healingRate,
    turrets: def.turrets,
    beaconColor: def.beaconColor,
    pulseTimer: 0,
    lastTurretShot: 0,
    powerStandX: bx + 90,
    powerStandY: by - 70,
  };
}

export function isEntityInsideBase(x: number, y: number, base: BaseState): boolean {
  const dist = Math.hypot(x - base.x, y - base.y);
  return dist <= base.safeRadius;
}

export function isNearBaseSpawnBlock(x: number, y: number, base: BaseState): boolean {
  const dist = Math.hypot(x - base.x, y - base.y);
  return dist <= base.spawnBlockRadius;
}

export function upgradeBase(base: BaseState): boolean {
  const nextLvl = base.level + 1;
  const def = BASE_LEVELS[nextLvl];
  if (!def) return false;

  base.level = nextLvl;
  base.hpMax = def.hpMax;
  base.hp = def.hpMax;
  base.safeRadius = def.safeRadius;
  base.spawnBlockRadius = def.spawnBlockRadius;
  base.maxSoldiers = Math.min(def.maxSoldiers, MAX_SQUAD_SIZE);
  base.healingRate = def.healingRate;
  base.turrets = def.turrets;
  base.beaconColor = def.beaconColor;
  return true;
}

export function updateBaseLogic(
  base: BaseState,
  player: PlayerState,
  soldiers: Soldier[],
  zombies: Zombie[],
  boss: Boss | null,
  bullets: Bullet[],
  dt: number,
  time: number,
  damageEntity: (ent: Zombie | Boss, rawDmg: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void
) {
  base.pulseTimer = (base.pulseTimer + dt) % 4000;

  // 1. Healing Aura for Player & Soldiers inside the Base
  const playerInBase = isEntityInsideBase(player.x, player.y, base);
  if (playerInBase && player.hp < player.hpMax) {
    const healAmount = (base.healingRate * (dt / 1000));
    player.hp = Math.min(player.hpMax, player.hp + healAmount);
  }

  for (const s of soldiers) {
    if (!s.isDead && isEntityInsideBase(s.x, s.y, base) && s.hp < s.hpMax) {
      const healAmount = (base.healingRate * (dt / 1000) * 1.5);
      s.hp = Math.min(s.hpMax, s.hp + healAmount);
    }
  }

  // 2. Physical Repulsion Barrier: Prevent Zombies & Boss from entering the base safe zone
  for (const z of zombies) {
    if (z.dead) continue;
    const dist = Math.hypot(z.x - base.x, z.y - base.y);
    const minDist = base.safeRadius + z.r + 4;
    if (dist < minDist) {
      const ang = Math.atan2(z.y - base.y, z.x - base.x);
      z.x = base.x + Math.cos(ang) * minDist;
      z.y = base.y + Math.sin(ang) * minDist;
      // Kinetic shock spark
      if (Math.random() < 0.05) {
        createParticles(z.x, z.y, base.beaconColor, 3, 3, 180);
      }
    }
  }

  if (boss && boss.state !== 'entering') {
    const dist = Math.hypot(boss.x - base.x, boss.y - base.y);
    const minDist = base.safeRadius + boss.r + 8;
    if (dist < minDist) {
      const ang = Math.atan2(boss.y - base.y, boss.x - base.x);
      boss.x = base.x + Math.cos(ang) * minDist;
      boss.y = base.y + Math.sin(ang) * minDist;
      if (Math.random() < 0.08) {
        createParticles(boss.x, boss.y, '#ffd166', 5, 4, 200);
      }
    }
  }

  // 3. Base Defensive Turrets (Level 2+)
  if (base.turrets > 0 && time - base.lastTurretShot > (1400 / base.turrets)) {
    // Find closest hostile target outside the barrier
    let closestTarget: Zombie | Boss | null = null;
    let closestDist = 650;

    if (boss && boss.state !== 'entering') {
      const d = Math.hypot(boss.x - base.x, boss.y - base.y);
      if (d < closestDist && d > base.safeRadius) {
        closestTarget = boss;
        closestDist = d;
      }
    }

    for (const z of zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - base.x, z.y - base.y);
      if (d < closestDist && d > base.safeRadius) {
        closestTarget = z;
        closestDist = d;
      }
    }

    if (closestTarget) {
      base.lastTurretShot = time;
      const ang = Math.atan2(closestTarget.y - base.y, closestTarget.x - base.x);
      const turretRadius = base.safeRadius - 15;
      const tx = base.x + Math.cos(ang) * turretRadius;
      const ty = base.y + Math.sin(ang) * turretRadius;

      bullets.push({
        id: Math.random().toString(),
        x: tx,
        y: ty,
        vx: Math.cos(ang) * 22,
        vy: Math.sin(ang) * 22,
        dmg: 65 + base.level * 25,
        cls: 'turretbullet',
        life: 1000,
      });

      createParticles(tx, ty, base.beaconColor, 4, 3, 100);
    }
  }
}
