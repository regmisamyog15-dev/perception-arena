import { Superpower, PlayerState, Zombie, Boss, Bullet, Particle, Floater, Shockwave } from '../types/game';
import { playExplosionSound } from '../audio/sound';

export function createInitialSuperpowers(): Record<string, Superpower> {
  return {
    orbital_beam: {
      id: 'orbital_beam',
      category: 'active',
      name: 'Solar Flare Death Ray',
      desc: 'Calls down an apocalyptic celestial laser beam that incinerates zombies and melts bosses (4.5s duration).',
      icon: '☀️',
      color: '#ffcf5c',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 24000,
      lastUsed: -99999,
      duration: 4500,
      activeUntil: 0,
      key: 'Z',
      bossSource: 'The Red Behemoth (Wave 1 Boss)',
    },
    chronoshift: {
      id: 'chronoshift',
      category: 'active',
      name: 'Chronoshift Time Stasis',
      desc: 'Halts time for 5.0s — all zombies & hostile projectiles freeze completely while you move at hyper speed with criticals.',
      icon: '⏳',
      color: '#00f5d4',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 28000,
      lastUsed: -99999,
      duration: 5000,
      activeUntil: 0,
      key: 'Z',
      bossSource: 'The Bone Warlock (Wave 2 Boss)',
    },
    earth_shatter: {
      id: 'earth_shatter',
      category: 'active',
      name: 'Tectonic Earth Shatter',
      desc: 'Crushes the earth with colossal seismic tremors, sending 8 shockwaves that deal 750 damage and fling zombies away.',
      icon: '🌋',
      color: '#f77f00',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 20000,
      lastUsed: -99999,
      duration: 1200,
      activeUntil: 0,
      key: 'Z',
      bossSource: 'The Executioner (Wave 3 Boss)',
    },
    divine_aegis: {
      id: 'divine_aegis',
      category: 'active',
      name: 'Celestial Divine Aegis',
      desc: 'Summons an impenetrable golden forcefield for 6.0s that negates all damage, reflects projectiles, and burns adjacent foes.',
      icon: '🛡️',
      color: '#ffd166',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 32000,
      lastUsed: -99999,
      duration: 6000,
      activeUntil: 0,
      key: 'Z',
      bossSource: 'Ironclad Reaper (Wave 4 Boss)',
    },
    iron_skin: {
      id: 'iron_skin',
      category: 'passive',
      name: 'Iron Skin',
      desc: 'Passive: reduces all incoming damage by an extra 15%, stacking with your armor. Always on while equipped.',
      icon: '🪨',
      color: '#9aa5b1',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 0,
      lastUsed: -99999,
      duration: 0,
      activeUntil: 0,
      key: '',
      bossSource: 'The Bouncer (Wave 5 Boss)',
    },
    vampiric_strikes: {
      id: 'vampiric_strikes',
      category: 'passive',
      name: 'Vampiric Strikes',
      desc: 'Passive: heal for 10% of all damage you deal to zombies and bosses. Always on while equipped.',
      icon: '🩸',
      color: '#ff4d5e',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 0,
      lastUsed: -99999,
      duration: 0,
      activeUntil: 0,
      key: '',
      bossSource: 'DJ Deathstep (Wave 6 Boss)',
    },
    berserker_instinct: {
      id: 'berserker_instinct',
      category: 'passive',
      name: "Berserker's Instinct",
      desc: 'Passive: deal 30% extra damage whenever your HP is below 40%. Always on while equipped.',
      icon: '😤',
      color: '#ff6b35',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 0,
      lastUsed: -99999,
      duration: 0,
      activeUntil: 0,
      key: '',
      bossSource: 'Auntie Apocalypse (Wave 7 Boss)',
    },
    second_wind: {
      id: 'second_wind',
      category: 'passive',
      name: 'Second Wind',
      desc: 'Passive: the first time a hit would kill you, survive at 1 HP with 2.5s of invulnerability instead (90s internal cooldown).',
      icon: '💫',
      color: '#00f5d4',
      unlocked: false,
      equipped: false,
      level: 1,
      cooldown: 90000,
      lastUsed: -99999,
      duration: 2500,
      activeUntil: 0,
      key: '',
      bossSource: 'Larry the Lich (Wave 8 Boss)',
    },
  };
}

export function syncPowerStandHotkeys(superpowers: Record<string, Superpower>) {
  const equippedActive = Object.values(superpowers).find((s) => s.category === 'active' && s.unlocked && s.equipped);
  Object.values(superpowers).forEach((s) => {
    s.slotIndex = undefined;
    if (s.category === 'active') s.key = 'Z';
  });
  if (equippedActive) equippedActive.slotIndex = 1;
}

export function toggleEquipPowerStand(
  superpowers: Record<string, Superpower>,
  id: string
): { success: boolean; message: string } {
  const sp = superpowers[id];
  if (!sp || !sp.unlocked) {
    return { success: false, message: 'Skill is locked. Defeat bosses to unlock!' };
  }

  const cap = sp.category === 'active' ? 1 : 2;
  const currentlyEquipped = Object.values(superpowers).filter((s) => s.category === sp.category && s.unlocked && s.equipped);

  if (sp.equipped) {
    sp.equipped = false;
    syncPowerStandHotkeys(superpowers);
    return { success: true, message: `Unequipped ${sp.name}.` };
  } else {
    if (currentlyEquipped.length >= cap) {
      // Bump the oldest-equipped one of the same category to make room
      currentlyEquipped[0].equipped = false;
    }
    sp.equipped = true;
    syncPowerStandHotkeys(superpowers);
    return {
      success: true,
      message:
        sp.category === 'active'
          ? `⚡ Equipped ${sp.name} as your Active Skill [Z]!`
          : `🛡️ Slotted ${sp.name} as a Passive Skill!`,
    };
  }
}

export function unlockNextSuperpower(
  superpowers: Record<string, Superpower>,
  wave: number,
  spawnFloatingText: (x: number, y: number, text: string, color?: string, size?: number) => void,
  playerX: number,
  playerY: number
): string | null {
  const order = [
    'orbital_beam',
    'chronoshift',
    'earth_shatter',
    'divine_aegis',
    'iron_skin',
    'vampiric_strikes',
    'berserker_instinct',
    'second_wind',
  ];

  for (const id of order) {
    const sp = superpowers[id];
    if (!sp.unlocked) {
      sp.unlocked = true;
      const cap = sp.category === 'active' ? 1 : 2;
      const equippedCount = Object.values(superpowers).filter((s) => s.category === sp.category && s.unlocked && s.equipped).length;
      if (equippedCount < cap) {
        sp.equipped = true;
      }
      syncPowerStandHotkeys(superpowers);
      const tag = sp.category === 'active' ? 'ACTIVE SKILL' : 'PASSIVE SKILL';
      spawnFloatingText(playerX, playerY - 70, `⚡ ${tag} UNLOCKED: ${sp.name.toUpperCase()}!`, sp.color, 24);
      return sp.name;
    }
  }

  // If all unlocked, level up a random one
  const unlockedList = order.map((id) => superpowers[id]).filter((s) => s.unlocked);
  if (unlockedList.length > 0) {
    const pick = unlockedList[Math.floor(Math.random() * unlockedList.length)];
    pick.level += 1;
    pick.cooldown = Math.max(8000, Math.round(pick.cooldown * 0.82));
    pick.duration = Math.round(pick.duration * 1.2);
    spawnFloatingText(playerX, playerY - 70, `🌟 SKILL LEVEL UP: ${pick.name} LV${pick.level}!`, pick.color, 22);
    return `${pick.name} (Level ${pick.level})`;
  }

  return null;
}

export function activateSuperpower(
  id: string,
  superpowers: Record<string, Superpower>,
  player: PlayerState,
  zombies: Zombie[],
  boss: Boss | null,
  shockwaves: Shockwave[],
  particles: Particle[],
  mouse: { x: number; y: number },
  camX: number,
  camY: number,
  time: number,
  damageEntity: (ent: Zombie | Boss, rawDmg: number) => void,
  explode: (x: number, y: number, radius: number, dmg: number) => void,
  spawnFloatingText: (x: number, y: number, text: string, color?: string, size?: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void,
  addScreenShake: (amount: number) => void
): boolean {
  const sp = superpowers[id];
  if (!sp || !sp.unlocked || !sp.equipped) return false;

  if (time - sp.lastUsed < sp.cooldown) {
    const rem = Math.ceil((sp.cooldown - (time - sp.lastUsed)) / 1000);
    spawnFloatingText(player.x, player.y - 40, `${sp.name} on Cooldown (${rem}s)`, '#ff4d5e', 14);
    return false;
  }

  sp.lastUsed = time;
  sp.activeUntil = time + sp.duration;
  addScreenShake(25);
  spawnFloatingText(player.x, player.y - 60, `💥 ${sp.name.toUpperCase()} ACTIVATED!`, sp.color, 24);

  if (id === 'earth_shatter') {
    playExplosionSound();
    // Emit 8 directional seismic shockwaves
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      shockwaves.push({
        id: Math.random().toString(),
        x: player.x + Math.cos(ang) * 40,
        y: player.y + Math.sin(ang) * 40,
        r: 20,
        maxR: 350,
        dmg: 750 * (1 + (sp.level - 1) * 0.4),
        speed: 12,
        color: '#f77f00',
      });
    }

    // Direct area damage & blast knockback
    for (const z of zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - player.x, z.y - player.y);
      if (d < 380) {
        damageEntity(z, 650 * (1 + (sp.level - 1) * 0.4));
        const ang = Math.atan2(z.y - player.y, z.x - player.x);
        z.x += Math.cos(ang) * 80;
        z.y += Math.sin(ang) * 80;
      }
    }
    if (boss && boss.state !== 'entering') {
      const d = Math.hypot(boss.x - player.x, boss.y - player.y);
      if (d < 380) {
        damageEntity(boss, 800 * (1 + (sp.level - 1) * 0.4));
      }
    }
  }

  return true;
}

export function updateSuperpowersActive(
  superpowers: Record<string, Superpower>,
  player: PlayerState,
  zombies: Zombie[],
  boss: Boss | null,
  particles: Particle[],
  mouse: { x: number; y: number },
  camX: number,
  camY: number,
  time: number,
  dt: number,
  damageEntity: (ent: Zombie | Boss, rawDmg: number) => void,
  createParticles: (x: number, y: number, color: string, count: number, speedMax: number, lifeMax?: number) => void
) {
  // 1. Orbital Death Ray
  const orbital = superpowers.orbital_beam;
  if (orbital && orbital.activeUntil > time) {
    const targetX = mouse.x + camX;
    const targetY = mouse.y + camY;
    const beamRadius = 130 + (orbital.level - 1) * 30;

    // Laser damage per frame
    const dps = (1100 + (orbital.level - 1) * 450) * (dt / 1000);

    for (const z of zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - targetX, z.y - targetY) < beamRadius + z.r) {
        damageEntity(z, dps);
      }
    }

    if (boss && boss.state !== 'entering') {
      if (Math.hypot(boss.x - targetX, boss.y - targetY) < beamRadius + boss.r) {
        // Balanced boss solar resistance so boss is challenging and intense
        damageEntity(boss, dps * 0.42);
      }
    }

    createParticles(targetX + (Math.random() - 0.5) * beamRadius, targetY + (Math.random() - 0.5) * beamRadius, '#ffd166', 6, 6, 120);
  }

  // 2. Chronoshift Time Freeze
  const chrono = superpowers.chronoshift;
  if (chrono && chrono.activeUntil > time) {
    for (const z of zombies) {
      if (!z.dead) z.speed = 0.05; // Almost completely static
    }
  }

  // 3. Divine Aegis
  const aegis = superpowers.divine_aegis;
  if (aegis && aegis.activeUntil > time) {
    createParticles(player.x, player.y, '#ffd166', 2, 4, 150);
    // Burn nearby enemies
    for (const z of zombies) {
      if (z.dead) continue;
      if (Math.hypot(z.x - player.x, z.y - player.y) < 140) {
        damageEntity(z, 300 * (dt / 1000));
      }
    }
  }
}
