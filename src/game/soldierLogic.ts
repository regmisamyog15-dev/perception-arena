import { Soldier, SoldierType, PlayerState, Zombie, Boss, Bullet, Particle, Floater } from '../types/game';
import { isEntityInsideBase } from './baseLogic';

export interface SoldierDef {
  type: SoldierType;
  name: string;
  title: string;
  weaponName: string;
  icon: string;
  color: string;
  hasSuperpower: boolean;
  superpowerName?: string;
  superpowerDesc?: string;
  baseHp: number;
  baseDmg: number;
  baseSpeed: number;
  baseRange: number;
  baseFireRate: number;
  cost: number;
  upgradeCosts: [number, number]; // Cost to upgrade to Lv2, Lv3
}

export const SOLDIER_DEFINITIONS: Record<SoldierType, SoldierDef> = {
  rifleman: {
    type: 'rifleman',
    name: 'Jack "Trigger"',
    title: 'Assault Marksman',
    weaponName: 'AK-47',
    icon: '🎖️',
    color: '#4cc9f0',
    hasSuperpower: false,
    baseHp: 350,
    baseDmg: 38,
    baseSpeed: 5.4,
    baseRange: 500,
    baseFireRate: 200,
    cost: 1000, // rented, not owned — see RIFLEMAN_RENTAL_MS
    upgradeCosts: [110, 220],
  },
  shotgunner: {
    type: 'shotgunner',
    name: 'Brick "Sledge"',
    title: 'Heavy Breacher',
    weaponName: 'Auto-Combat Shotgun',
    icon: '🛡️',
    color: '#f72585',
    hasSuperpower: false,
    baseHp: 500,
    baseDmg: 24, // per pellet (6 pellets)
    baseSpeed: 4.8,
    baseRange: 360,
    baseFireRate: 520,
    cost: 110,
    upgradeCosts: [150, 280],
  },
  sniper: {
    type: 'sniper',
    name: 'Hawkeye "Ghost"',
    title: 'Covert Sniper',
    weaponName: 'Anti-Materiel Railgun',
    icon: '🎯',
    color: '#7209b7',
    hasSuperpower: false,
    baseHp: 280,
    baseDmg: 240,
    baseSpeed: 5.6,
    baseRange: 800,
    baseFireRate: 880,
    cost: 140,
    upgradeCosts: [190, 340],
  },
  demolitionist: {
    type: 'demolitionist',
    name: 'Boomer "Rex"',
    title: 'Heavy Demolitions',
    weaponName: 'Hydra Rocket Cannon',
    icon: '🚀',
    color: '#f77f00',
    hasSuperpower: false,
    baseHp: 420,
    baseDmg: 280, // splash
    baseSpeed: 4.6,
    baseRange: 540,
    baseFireRate: 1150,
    cost: 180,
    upgradeCosts: [240, 420],
  },
  pyro: {
    type: 'pyro',
    name: 'Ember "Ignis"',
    title: 'Pyro Valkyrie',
    weaponName: 'Inferno Flamethrower',
    icon: '🔥',
    color: '#e63946',
    hasSuperpower: true,
    superpowerName: 'Celestial Meteor Strike',
    superpowerDesc: 'Calls blazing orbital meteors that engulf hordes in persistent burning hellfire (10s CD).',
    baseHp: 480,
    baseDmg: 55,
    baseSpeed: 5.2,
    baseRange: 460,
    baseFireRate: 180,
    cost: 280,
    upgradeCosts: [350, 600],
  },
  cryo: {
    type: 'cryo',
    name: 'Kael "Glacius"',
    title: 'Frost Arch-Mage',
    weaponName: 'Absolute Zero Cannon',
    icon: '❄️',
    color: '#00f5d4',
    hasSuperpower: true,
    superpowerName: 'Glacial Stasis Blizzard',
    superpowerDesc: 'Unleashes an icy stasis wave freezing all surrounding zombies completely solid for 4s (12s CD).',
    baseHp: 440,
    baseDmg: 45,
    baseSpeed: 5.2,
    baseRange: 520,
    baseFireRate: 260,
    cost: 320,
    upgradeCosts: [380, 650],
  },
  thunder: {
    type: 'thunder',
    name: 'Volt "Zeus"',
    title: 'Thunder Paladin',
    weaponName: 'Mjolnir Lightning Arcs',
    icon: '⚡',
    color: '#fee440',
    hasSuperpower: true,
    superpowerName: 'Mjolnir Chain Lightning',
    superpowerDesc: 'Summons violent electrical tempest chaining between up to 8 enemies for 500 shock dmg (8s CD).',
    baseHp: 520,
    baseDmg: 70,
    baseSpeed: 5.5,
    baseRange: 580,
    baseFireRate: 340,
    cost: 380,
    upgradeCosts: [450, 750],
  },
};

// Jack is rented, not owned outright: 1000 ⚛ buys 2.5 minutes of activation,
// then he's auto-removed from the squad and must be re-bought.
export const RIFLEMAN_RENTAL_MS = 2.5 * 60 * 1000;

export function createSoldier(type: SoldierType, spawnX: number, spawnY: number): Soldier {
  const def = SOLDIER_DEFINITIONS[type];
  return {
    id: Math.random().toString(),
    type,
    name: def.name,
    title: def.title,
    weaponName: def.weaponName,
    icon: def.icon,
    color: def.color,
    level: 1,
    hp: def.baseHp,
    hpMax: def.baseHp,
    speed: def.baseSpeed,
    dmg: def.baseDmg,
    range: def.baseRange,
    fireRate: def.baseFireRate,
    lastShot: 0,
    x: spawnX + (Math.random() - 0.5) * 60,
    y: spawnY + (Math.random() - 0.5) * 60,
    vx: 0,
    vy: 0,
    targetAng: 0,
    hasSuperpower: def.hasSuperpower,
    superpowerName: def.superpowerName,
    superpowerCd: type === 'pyro' ? 10000 : type === 'cryo' ? 12000 : type === 'thunder' ? 8000 : 0,
    lastSuperpower: 0,
    kills: 0,
    isDead: false,
    respawnTimer: 0,
    cost: def.cost,
    upgradeCosts: def.upgradeCosts,
    isLegendaryHero: false,
    rentalExpiresAt: type === 'rifleman' ? performance.now() + RIFLEMAN_RENTAL_MS : undefined,
  };
}

export function imbueSoldierWithPower(
  soldier: Soldier,
  powerId: string,
  powerName: string,
  powerColor: string,
  powerIcon: string
) {
  soldier.isLegendaryHero = true;
  soldier.assignedPowerId = powerId;
  soldier.assignedPowerName = powerName;
  soldier.assignedPowerColor = powerColor;
  soldier.assignedPowerIcon = powerIcon;
  soldier.hasSuperpower = true;
  soldier.superpowerName = powerName;
  soldier.superpowerCd = 9000;
  soldier.lastSuperpower = 0;
  
  // Legendary Boost: +50% HP and +35% DMG
  soldier.hpMax = Math.round(soldier.hpMax * 1.5);
  soldier.hp = soldier.hpMax;
  soldier.dmg = Math.round(soldier.dmg * 1.35);
  soldier.range += 80;
}

export function upgradeSoldier(soldier: Soldier): boolean {
  if (soldier.level >= 3) return false;
  soldier.level += 1;
  const def = SOLDIER_DEFINITIONS[soldier.type];

  if (soldier.level === 2) {
    soldier.hpMax = Math.round(def.baseHp * 1.5 * (soldier.isLegendaryHero ? 1.5 : 1));
    soldier.hp = soldier.hpMax;
    soldier.dmg = Math.round(def.baseDmg * 1.4 * (soldier.isLegendaryHero ? 1.35 : 1));
    soldier.fireRate = Math.round(def.baseFireRate * 0.82);
    if (soldier.superpowerCd) soldier.superpowerCd = Math.round(soldier.superpowerCd * 0.85);
  } else if (soldier.level === 3) {
    soldier.hpMax = Math.round(def.baseHp * 2.2 * (soldier.isLegendaryHero ? 1.5 : 1));
    soldier.hp = soldier.hpMax;
    soldier.dmg = Math.round(def.baseDmg * 2.0 * (soldier.isLegendaryHero ? 1.35 : 1));
    soldier.fireRate = Math.round(def.baseFireRate * 0.68);
    if (soldier.superpowerCd) soldier.superpowerCd = Math.round(soldier.superpowerCd * 0.7);
  }
  return true;
}

export function updateSoldiersLogic(
  soldiers: Soldier[],
  player: PlayerState,
  base: any,
  zombies: Zombie[],
  boss: Boss | null,
  bullets: Bullet[],
  particles: Particle[],
  floaters: Floater[],
  dt: number,
  time: number,
  damageEntity: (ent: Zombie | Boss, rawDmg: number) => void,
  explode: (x: number, y: number, radius: number, dmg: number, hitsBoss?: boolean) => void,
  spawnFloatingText: (x: number, y: number, text: string, color?: string, size?: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void
) {
  const isPlayerInBase = isEntityInsideBase(player.x, player.y, base);

  for (let sIdx = 0; sIdx < soldiers.length; sIdx++) {
    const s = soldiers[sIdx];

    // Timed rental activation (Jack) — expires and leaves the squad automatically
    if (s.rentalExpiresAt && time >= s.rentalExpiresAt) {
      spawnFloatingText(s.x, s.y - 30, `⏱️ ${s.name}'S CONTRACT EXPIRED — REBUY TO REDEPLOY`, '#ffcf5c', 16);
      createParticles(s.x, s.y, '#ffcf5c', 20, 4, 300);
      soldiers.splice(sIdx, 1);
      sIdx--;
      continue;
    }

    // Handle Respawn if knocked down
    if (s.isDead) {
      s.respawnTimer -= dt;
      if (s.respawnTimer <= 0) {
        s.isDead = false;
        s.hp = s.hpMax;
        s.x = base.x + (Math.random() - 0.5) * 80;
        s.y = base.y + (Math.random() - 0.5) * 80;
        spawnFloatingText(s.x, s.y - 30, `🛡️ ${s.name} RESPAWNED!`, '#7ee787', 16);
        createParticles(s.x, s.y, s.color, 25, 4, 350);
      }
      continue;
    }

    // Legendary Soldier Particle Trail & Aura
    if (s.isLegendaryHero && Math.random() < 0.3) {
      createParticles(s.x + (Math.random() - 0.5) * 16, s.y + (Math.random() - 0.5) * 16, s.assignedPowerColor || '#ffd166', 1, 2, 250);
    }

    // Determine target location (Tactical Squad Formation around Player, or Base Perimeter if player in Base)
    let targetX = player.x;
    let targetY = player.y;

    if (isPlayerInBase) {
      // Guard circular defensive posts inside the safe base
      const formAng = (sIdx / Math.max(1, soldiers.length)) * Math.PI * 2 + (time * 0.0003);
      targetX = base.x + Math.cos(formAng) * (base.safeRadius * 0.55);
      targetY = base.y + Math.sin(formAng) * (base.safeRadius * 0.55);
    } else {
      // Tactical ring formation around the player
      const formAng = (sIdx / Math.max(1, soldiers.length)) * Math.PI * 2;
      const formDist = 65 + (s.type === 'shotgunner' ? 20 : s.type === 'sniper' ? 75 : 45);
      targetX = player.x + Math.cos(formAng) * formDist;
      targetY = player.y + Math.sin(formAng) * formDist;
    }

    // Move smoothly toward target position
    const distToFormation = Math.hypot(targetX - s.x, targetY - s.y);
    if (distToFormation > 15) {
      const moveAng = Math.atan2(targetY - s.y, targetX - s.x);
      const moveSpeed = distToFormation > 200 ? s.speed * 1.5 : s.speed;
      s.x += Math.cos(moveAng) * moveSpeed;
      s.y += Math.sin(moveAng) * moveSpeed;
    }

    // Acquire Target — zombies only. Soldiers never engage bosses, in the
    // homeland or in the arena; they're backup for the horde, not boss DPS.
    let target: Zombie | Boss | null = null;
    let targetDist = s.range;

    for (const z of zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - s.x, z.y - s.y);
      if (d < targetDist) {
        target = z;
        targetDist = d;
      }
    }

    if (target) {
      s.targetAng = Math.atan2(target.y - s.y, target.x - s.x);

      // --- SUPERPOWER TRIGGER (Built-in or Imbued Legendary Power) ---
      if (s.hasSuperpower && s.superpowerCd && time - (s.lastSuperpower || 0) > s.superpowerCd) {
        s.lastSuperpower = time;

        // Custom Imbued Legendary Superpower execution
        if (s.isLegendaryHero && s.assignedPowerId) {
          if (s.assignedPowerId === 'orbital_beam') {
            spawnFloatingText(s.x, s.y - 45, '☀️ SOLAR DEATH RAY!', '#ffd166', 20);
            createParticles(target.x, target.y, '#ffd166', 35, 8, 500);
            explode(target.x, target.y, 220, s.dmg * 4.5, false);
          } else if (s.assignedPowerId === 'chronoshift') {
            spawnFloatingText(s.x, s.y - 45, '❄️ CHRONO GLACIAL STASIS!', '#00f5d4', 20);
            createParticles(s.x, s.y, '#a0f0ff', 40, 9, 500);
            for (const z of zombies) {
              if (z.dead) continue;
              if (Math.hypot(z.x - s.x, z.y - s.y) < 450) {
                z.speed = 0.25;
                damageEntity(z, s.dmg * 2.8);
                setTimeout(() => {
                  if (!z.dead) z.speed = 1.6;
                }, 4000);
              }
            }
          } else if (s.assignedPowerId === 'earth_shatter') {
            spawnFloatingText(s.x, s.y - 45, '🌋 TECTONIC SEISMIC SLAM!', '#f77f00', 20);
            createParticles(s.x, s.y, '#f77f00', 45, 10, 600);
            explode(s.x, s.y, 350, s.dmg * 3.8, false);
          } else if (s.assignedPowerId === 'divine_aegis') {
            spawnFloatingText(s.x, s.y - 45, '🛡️ CELESTIAL DIVINE AEGIS!', '#ffd166', 20);
            createParticles(s.x, s.y, '#ffd166', 50, 10, 600);
            player.hp = Math.min(player.hpMax, player.hp + 250);
            for (const z of zombies) {
              if (z.dead) continue;
              if (Math.hypot(z.x - s.x, z.y - s.y) < 320) {
                damageEntity(z, s.dmg * 2.2);
              }
            }
          }
        } else if (s.type === 'pyro') {
          // Celestial Meteor Strike
          spawnFloatingText(s.x, s.y - 45, '🔥 METEOR STRIKE!', '#e63946', 18);
          for (let m = 0; m < (s.level === 3 ? 5 : 3); m++) {
            const tx = target.x + (Math.random() - 0.5) * 160;
            const ty = target.y + (Math.random() - 0.5) * 160;
            setTimeout(() => {
              explode(tx, ty, s.level === 3 ? 240 : 180, s.dmg * 4, false);
              createParticles(tx, ty, '#ff4d00', 40, 8, 600);
            }, m * 220);
          }
        } else if (s.type === 'cryo') {
          // Glacial Stasis Blizzard
          spawnFloatingText(s.x, s.y - 45, '❄️ BLIZZARD FREEZE!', '#00f5d4', 18);
          createParticles(s.x, s.y, '#a0f0ff', 50, 10, 500);

          const freezeRadius = s.level === 3 ? 500 : 380;
          for (const z of zombies) {
            if (z.dead) continue;
            if (Math.hypot(z.x - s.x, z.y - s.y) < freezeRadius) {
              z.speed = 0.2;
              damageEntity(z, s.dmg * 2.5);
              createParticles(z.x, z.y, '#00f5d4', 8, 3, 400);
              setTimeout(() => {
                if (!z.dead) z.speed = 1.5;
              }, s.level === 3 ? 5000 : 3500);
            }
          }
        } else if (s.type === 'thunder') {
          // Mjolnir Chain Lightning
          spawnFloatingText(s.x, s.y - 45, '⚡ CHAIN LIGHTNING!', '#fee440', 18);
          const chainMax = s.level === 3 ? 10 : s.level === 2 ? 8 : 6;
          let currentChain = 0;
          let lastChainX = s.x;
          let lastChainY = s.y;

          const eligible = [...zombies];

          for (const ent of eligible) {
            if (currentChain >= chainMax) break;
            if (ent.dead) continue;
            if (Math.hypot(ent.x - lastChainX, ent.y - lastChainY) < 420) {
              damageEntity(ent, s.dmg * 3.2);
              createParticles(ent.x, ent.y, '#fee440', 12, 6, 250);
              lastChainX = ent.x;
              lastChainY = ent.y;
              currentChain++;
            }
          }
        }
      }

      // --- STANDARD WEAPON FIRE ---
      if (time - (s.lastShot || 0) > s.fireRate) {
        s.lastShot = time;
        const ang = s.targetAng + (Math.random() - 0.5) * 0.08;
        const bulletColor = s.isLegendaryHero ? (s.assignedPowerColor || '#ffd166') : s.color;

        if (s.type === 'shotgunner') {
          const pellets = s.level === 3 ? 9 : s.level === 2 ? 7 : 6;
          for (let p = 0; p < pellets; p++) {
            const pAng = ang + (Math.random() - 0.5) * 0.35;
            bullets.push({
              id: Math.random().toString(),
              x: s.x,
              y: s.y,
              vx: Math.cos(pAng) * 20,
              vy: Math.sin(pAng) * 20,
              dmg: s.dmg,
              cls: 'bullet',
              life: 500,
              noBossDamage: true,
            });
          }
        } else if (s.type === 'demolitionist') {
          bullets.push({
            id: Math.random().toString(),
            x: s.x,
            y: s.y,
            vx: Math.cos(ang) * 16,
            vy: Math.sin(ang) * 16,
            dmg: s.dmg,
            cls: 'rocket',
            splash: s.level === 3 ? 240 : 180,
            life: 1200,
            noBossDamage: true,
          });
        } else if (s.type === 'sniper') {
          bullets.push({
            id: Math.random().toString(),
            x: s.x,
            y: s.y,
            vx: Math.cos(ang) * 32,
            vy: Math.sin(ang) * 32,
            dmg: s.dmg,
            cls: 'bullet',
            life: 1400,
            noBossDamage: true,
          });
        } else {
          // Standard / Legendary infused basic shots
          bullets.push({
            id: Math.random().toString(),
            x: s.x,
            y: s.y,
            vx: Math.cos(ang) * 22,
            vy: Math.sin(ang) * 22,
            dmg: s.dmg,
            cls: 'bullet',
            life: 900,
            noBossDamage: true,
          });
        }

        createParticles(s.x + Math.cos(ang) * 12, s.y + Math.sin(ang) * 12, bulletColor, 3, 2, 80);
      }
    }

    // Zombie damage to soldier (only if outside base)
    if (!isPlayerInBase && !isEntityInsideBase(s.x, s.y, base)) {
      for (const z of zombies) {
        if (z.dead) continue;
        if (Math.hypot(z.x - s.x, z.y - s.y) < z.r + 14) {
          s.hp -= z.dmg * (dt / 1000) * 1.8;
          if (s.hp <= 0 && !s.isDead) {
            s.hp = 0;
            s.isDead = true;
            s.respawnTimer = 20000; // 20s respawn at base
            spawnFloatingText(s.x, s.y - 30, `⚠️ ${s.name} DOWN!`, '#ff4d5e', 18);
            createParticles(s.x, s.y, '#ff4d5e', 20, 4, 300);
            break;
          }
        }
      }
    }
  }
}
