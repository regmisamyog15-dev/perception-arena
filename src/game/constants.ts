import { BossSkin, WeaponDef, MeleeDef } from '../types/game';

// Expanded World size for massive battlefield exploration & arena realms
export const WORLD_W = 7200;
export const WORLD_H = 5400;

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: { id: 'pistol', name: 'Pistol', icon: '🔫', iconImg: '/sprites/icons/guns/Icon29_01.png', dmg: 28, rate: 220, spread: 0.04, speed: 20, infinite: true, auto: false, type: 'gun', repairCost: 0 },
  smg: { id: 'smg', name: 'SMG', icon: '📠', iconImg: '/sprites/icons/guns/Icon29_09.png', dmg: 16, rate: 75, spread: 0.10, speed: 22, durMax: 260, auto: true, type: 'gun', repairCost: 20 },
  ak47: { id: 'ak47', name: 'AK-47', icon: '🔫', iconImg: '/sprites/icons/guns/Icon29_17.png', dmg: 38, rate: 130, spread: 0.05, speed: 24, durMax: 200, auto: true, type: 'gun', repairCost: 35 },
  shotgun: { id: 'shotgun', name: 'Combat Shotgun', icon: '💥', iconImg: '/sprites/icons/guns/Icon29_29.png', dmg: 22, rate: 550, spread: 0.22, speed: 18, durMax: 60, auto: false, pellets: 8, type: 'gun', repairCost: 30 },
  rpg: { id: 'rpg', name: 'Hydra RPG', icon: '🚀', iconImg: '/sprites/icons/guns/Icon29_37.png', dmg: 320, rate: 1000, spread: 0.02, speed: 15, ammoBased: true, ammoMax: 20, auto: false, type: 'rocket', splash: 220, repairCost: 50 },
  sniper: { id: 'sniper', name: 'Anti-Materiel Sniper', icon: '🎯', iconImg: '/sprites/icons/guns/Icon29_13.png', dmg: 260, rate: 780, spread: 0.003, speed: 36, durMax: 70, auto: false, type: 'gun', repairCost: 45 },
  hammer: { id: 'hammer', name: 'Squeaky War Hammer', icon: '🪀', dmg: 50, rate: 350, spread: 0, speed: 0, durMax: 50, auto: false, type: 'melee_wpn', kb: 1000, repairCost: 25 },
  plasmagun: { id: 'plasmagun', name: 'Plasma Disruptor', icon: '⚡', iconImg: '/sprites/icons/guns/Icon29_21.png', dmg: 55, rate: 120, spread: 0.03, speed: 26, durMax: 180, auto: true, type: 'gun', repairCost: 55 },
  minigun: { id: 'minigun', name: 'Titan Minigun', icon: '🔥', iconImg: '/sprites/icons/guns/Icon29_33.png', dmg: 26, rate: 50, spread: 0.14, speed: 25, durMax: 450, auto: true, type: 'gun', repairCost: 70 }
};

export const MELEE_BASE: MeleeDef = { name: 'COMBAT KNIFE', icon: '🔪', dmg: 45, range: 75, rate: 320, legendary: false };
export const MELEE_LEGEND: MeleeDef = { name: 'DRAGON SLAYER BLADE', icon: '🗡️', dmg: 220, range: 120, rate: 220, legendary: true, isLegendary: true };

export const ZOMBIE_TYPES = {
  shambler: { hp: 75, speed: 1.6, r: 18, dmg: 12, color: '#4a5d3f', kind: 'melee' as const, aggroRange: 750, deaggroRange: 1100 },
  runner: { hp: 45, speed: 4.0, r: 14, dmg: 16, color: '#8a3a3a', kind: 'melee' as const, aggroRange: 850, deaggroRange: 1200 },
  gunner: { hp: 65, speed: 1.2, r: 16, dmg: 8, color: '#5a6b8a', kind: 'ranged' as const, fireRate: 1500, range: 450, bulletDmg: 15, bulletSpeed: 10, aggroRange: 800, deaggroRange: 1150 },
  rpgz: { hp: 95, speed: 0.95, r: 19, dmg: 10, color: '#8a5a3a', kind: 'ranged' as const, fireRate: 2800, range: 500, bulletDmg: 80, bulletSpeed: 8, splash: 85, aggroRange: 850, deaggroRange: 1200 },
  ztank: { hp: 550, speed: 1.0, r: 32, dmg: 32, color: '#33421f', kind: 'melee' as const, push: true, aggroRange: 900, deaggroRange: 1300 }
};

export const ARMOR_LEVELS = [
  null,
  { hpBonus: 300, reduction: 0.08, cost: 180 },
  { hpBonus: 650, reduction: 0.15, cost: 380 },
  { hpBonus: 1100, reduction: 0.22, cost: 650 },
  { hpBonus: 1700, reduction: 0.30, cost: 1000 },
  { hpBonus: 2500, reduction: 0.40, cost: 1500 }
];

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  maxLevel: number;
}

export const UPGRADES: Record<string, UpgradeDef> = {
  speedBoost: { id: 'speedBoost', name: 'Hyper Thrusters', desc: '+15% Operator Move Speed', icon: '⚡', cost: 65, maxLevel: 5 },
  damageBoost: { id: 'damageBoost', name: 'Plasma Injector', desc: '+20% All Weapon & Melee Damage', icon: '🔥', cost: 85, maxLevel: 5 },
  rapidFire: { id: 'rapidFire', name: 'Overclock Module', desc: '+15% Attack & Fire Rate', icon: '⏱️', cost: 75, maxLevel: 4 },
  regenBoost: { id: 'regenBoost', name: 'Bioregen Matrix', desc: 'Halves Regen cooldown + heals +60 HP on kills', icon: '💉', cost: 100, maxLevel: 3 },
  magnetRadius: { id: 'magnetRadius', name: 'Atom Magnet', desc: 'Pulls Zomb Atoms from 3x farther away', icon: '🧲', cost: 50, maxLevel: 3 },
};

// 10 Gate Definitions with Arena Dimensions and Boss Keys
// arenaW/H are now larger for competitive play — room to dodge and kite
export const GATE_DEFINITIONS = [
  { index: 1,  name: 'Gate I: The Crimson Rift',       cost: 100,  bossKey: 'behemoth',    bossName: 'THE CRIMSON BEHEMOTH',       bossIcon: '👹', bossColor: '#e63946', arenaW: 3200, arenaH: 3200, eliteName: 'Crimson Vanguard' },
  { index: 2,  name: 'Gate II: Necrotic Sanctum',      cost: 220,  bossKey: 'warlock',     bossName: 'THE VOID WARLOCK',           bossIcon: '💀', bossColor: '#8a9a5b', arenaW: 3300, arenaH: 3300, eliteName: 'Necrotic Warden' },
  { index: 3,  name: 'Gate III: Iron Bastion',         cost: 380,  bossKey: 'ironclad',    bossName: 'IRONCLAD REAPER',            bossIcon: '⛓️', bossColor: '#7a6a58', arenaW: 3400, arenaH: 3400, eliteName: 'Ironclad Sentinel' },
  { index: 4,  name: 'Gate IV: Solar Executioner',     cost: 580,  bossKey: 'executioner', bossName: 'SOLAR TITAN EXECUTIONER',    bossIcon: '☀️', bossColor: '#f77f00', arenaW: 3600, arenaH: 3600, eliteName: 'Solar Arch-Champion' },
  { index: 5,  name: 'Gate V: Abyssal Coliseum',       cost: 820,  bossKey: 'bouncer',     bossName: 'THE ABYSSAL BOUNCER',        bossIcon: '🕶️', bossColor: '#264653', arenaW: 3700, arenaH: 3700, eliteName: 'Abyssal Enforcer' },
  { index: 6,  name: 'Gate VI: Tempest Spire',         cost: 1100, bossKey: 'dj',          bossName: 'DJ TEMPEST CRUSHER',         bossIcon: '⚡', bossColor: '#f4a261', arenaW: 3800, arenaH: 3800, eliteName: 'Stormbringer Guard' },
  { index: 7,  name: 'Gate VII: Dread Wastes',         cost: 1450, bossKey: 'auntie',      bossName: 'DREAD QUEEN APOCALYPSE',     bossIcon: '👑', bossColor: '#e76f51', arenaW: 3900, arenaH: 3900, eliteName: 'Dread Dreadnought' },
  { index: 8,  name: 'Gate VIII: Phantom Void',        cost: 1850, bossKey: 'larry',       bossName: 'VOIDWALKER LARRY',           bossIcon: '🎩', bossColor: '#9d4edd', arenaW: 4000, arenaH: 4000, eliteName: 'Shadow Assassin' },
  { index: 9,  name: 'Gate IX: Obsidian Core',         cost: 2350, bossKey: 'gary',        bossName: 'GARY THE DESTROYER',         bossIcon: '🔥', bossColor: '#588157', arenaW: 4200, arenaH: 4200, eliteName: 'Magma Colossus' },
  { index: 10, name: 'Gate X: Celestial Singularity',  cost: 3000, bossKey: 'overlord',    bossName: 'THE CELESTIAL OVERLORD',     bossIcon: '🌌', bossColor: '#1a141f', arenaW: 4600, arenaH: 4600, eliteName: 'Omega Seraph Guard' },
];

export const DOOR_COSTS = GATE_DEFINITIONS.map(g => g.cost);

// Balanced, fair, and epic boss skins with progressive tier scaling.
// Each boss has a unique gimmick — the player must adapt their skill loadout.
//   gimmick:        short internal key describing the special mechanic
//   gimmickHint:    text shown on arena entry so the player knows what to expect
//   counterSkill:   superpower id that gives a meaningful advantage vs this boss
export const BOSS_SKINS: BossSkin[] = [
  {
    key: 'behemoth',
    name: 'THE CRIMSON BEHEMOTH',
    color: '#e63946',
    emoji: '👹',
    title: 'Warlord of the Blood Plains',
    quote: 'CRUSH! SHATTER! YOU CANNOT ESCAPE MY SLAM!',
    flies: false,
    moves: ['leap', 'charge', 'pushSlam', 'roar', 'solarBeam', 'spikeField'],
    leapMult: 1.0,
    chargeMult: 1.0,
    hpMult: 1.0,
    gimmick: 'rampage',           // After roar: speed triples for 3s — you MUST dash away
    gimmickHint: '⚠️ GIMMICK: After ROAR he enters RAMPAGE — dodge with [Shift] or you die!',
    counterSkill: 'earth_shatter',
  },
  {
    key: 'warlock',
    name: 'THE VOID WARLOCK',
    color: '#8a9a5b',
    emoji: '💀',
    title: 'Master of Dark Sorcery',
    quote: 'The void hungers for your flesh...',
    flies: true,
    moves: ['fireball', 'teleport', 'solarBeam', 'summon', 'pushSlam'],
    leapMult: 0.9,
    chargeMult: 0.9,
    hpMult: 0.95,
    gimmick: 'shield_of_souls',   // Summons a soul shield: immune to ranged while shield alive, use melee/AOE
    gimmickHint: '⚠️ GIMMICK: Soul Shield blocks bullets — switch to MELEE or [C] Ground Slam to break it!',
    counterSkill: 'chronoshift',
  },
  {
    key: 'ironclad',
    name: 'IRONCLAD REAPER',
    color: '#7a6a58',
    emoji: '⛓️',
    title: 'Indestructible Fortress',
    quote: 'Your weapons are mere pebbles against my iron armor!',
    flies: false,
    moves: ['spin', 'charge', 'pushSlam', 'laser', 'megasmash'],
    leapMult: 1.1,
    chargeMult: 1.1,
    hpMult: 1.15,
    gimmick: 'armor_plating',     // Takes 70% reduced damage from front — must hit from the back or sides
    gimmickHint: '⚠️ GIMMICK: Iron Plating — hit him from the SIDE or BACK. Frontal damage is 70% reduced!',
    counterSkill: 'divine_aegis',
  },
  {
    key: 'executioner',
    name: 'SOLAR TITAN EXECUTIONER',
    color: '#f77f00',
    emoji: '☀️',
    title: 'Bearer of the Sun Flare',
    quote: 'INCINERATE IN CELESTIAL SOLAR FIRE!',
    flies: false,
    moves: ['solarBeam', 'megasmash', 'charge', 'pushSlam', 'laser', 'spikeField'],
    leapMult: 1.15,
    chargeMult: 1.1,
    hpMult: 1.2,
    gimmick: 'solar_overload',    // Standing still >1.5s while solar is active triggers 3x damage burst
    gimmickHint: '⚠️ GIMMICK: SOLAR OVERLOAD — keep moving! Standing still during Solar Beam deals triple damage!',
    counterSkill: 'orbital_beam',
  },
  {
    key: 'bouncer',
    name: 'THE ABYSSAL BOUNCER',
    color: '#264653',
    emoji: '🕶️',
    title: 'Guardian of the Void Gate',
    quote: 'No entry. Prepare to be tossed!',
    flies: false,
    moves: ['charge', 'pushSlam', 'spin', 'leap', 'solarBeam'],
    leapMult: 1.2,
    chargeMult: 1.2,
    hpMult: 1.25,
    gimmick: 'wall_bounce',       // Charge slam sends player into arena wall for +50% bonus damage on impact
    gimmickHint: '⚠️ GIMMICK: WALL BOUNCE — stay AWAY from edges! Getting slammed into the wall deals bonus damage!',
    counterSkill: 'iron_skin',
  },
  {
    key: 'dj',
    name: 'DJ TEMPEST CRUSHER',
    color: '#f4a261',
    emoji: '⚡',
    title: 'Maestro of Thunder',
    quote: 'FEEL THE BASS DROP AND THE SHOCKWAVES!',
    flies: false,
    moves: ['spin', 'leap', 'roar', 'pushSlam', 'solarBeam'],
    leapMult: 1.2,
    chargeMult: 1.15,
    hpMult: 1.3,
    gimmick: 'bass_drop',         // Every 8s emits a massive multi-ring shockwave — jump/dodge before it expands
    gimmickHint: '⚠️ GIMMICK: BASS DROP — every 8s a ring explosion fires! DASH [Shift] through the ring to avoid it!',
    counterSkill: 'vampiric_strikes',
  },
  {
    key: 'auntie',
    name: 'DREAD QUEEN APOCALYPSE',
    color: '#e76f51',
    emoji: '👑',
    title: 'Empress of the Ruined Realm',
    quote: 'Bow before the Queen of Apocalypse!',
    flies: false,
    moves: ['charge', 'leap', 'solarBeam', 'summon', 'pushSlam', 'spikeField'],
    leapMult: 1.25,
    chargeMult: 1.2,
    hpMult: 1.35,
    gimmick: 'queen_summons',     // Summons 4 elite zombie escorts — kills them to heal the Queen if you ignore them
    gimmickHint: '⚠️ GIMMICK: ROYAL ESCORT — kill her summoned guards FAST or they heal her 150 HP each!',
    counterSkill: 'berserker_instinct',
  },
  {
    key: 'larry',
    name: 'VOIDWALKER LARRY',
    color: '#9d4edd',
    emoji: '🎩',
    title: 'Gentleman of the Abyss',
    quote: 'Pardon my intrusion, but it is time for your demise.',
    flies: false,
    moves: ['teleport', 'solarBeam', 'spin', 'pushSlam', 'laser'],
    leapMult: 1.2,
    chargeMult: 1.15,
    hpMult: 1.4,
    gimmick: 'void_mirror',       // Reflects 30% of bullet damage back to player — melee/skills/AOE bypass the mirror
    gimmickHint: '⚠️ GIMMICK: VOID MIRROR — bullets reflect 30% damage back at you! Use melee & skills to bypass!',
    counterSkill: 'second_wind',
  },
  {
    key: 'gary',
    name: 'GARY THE DESTROYER',
    color: '#588157',
    emoji: '🔥',
    title: 'Scourge of the Netherite',
    quote: 'Your survival request has been DENIED with extreme prejudice!',
    flies: false,
    moves: ['charge', 'roar', 'pushSlam', 'solarBeam', 'megasmash', 'spikeField'],
    leapMult: 1.3,
    chargeMult: 1.3,
    hpMult: 1.45,
    gimmick: 'berserker_rage',    // Below 50% HP: moves 40% faster AND reflects 20% of damage; requires constant movement
    gimmickHint: '⚠️ GIMMICK: DESTROYER RAGE — below 50% HP Gary goes berserk! Keep circling, NEVER stop moving!',
    counterSkill: 'earth_shatter',
  },
];

export const FINAL_BOSS_SKIN: BossSkin = {
  key: 'overlord',
  name: 'THE CELESTIAL OVERLORD',
  color: '#1a141f',
  emoji: '🌌',
  title: 'Supreme Ruler of Dimensions',
  quote: 'I AM THE BEGINNING AND THE END OF THIS ARENA.',
  flies: true,
  moves: ['solarBeam', 'leap', 'fireball', 'charge', 'spin', 'teleport', 'roar', 'laser', 'pushSlam', 'summon', 'spikeField'],
  leapMult: 1.4,
  chargeMult: 1.35,
  hpMult: 1.75
};

export const BOSS_QUOTES = [
  "You think you can match my might?",
  "Feel the full force of my slam!",
  "Tremble before the Arena Master!",
  "Your weapons only tickle!",
  "Is that the best your squad has?",
  "Ow. Okay. Rude.",
  "I tripped. This never happened.",
  "Who let you bring a SMG to a boss fight?!",
  "Five stars, would NOT get slammed again.",
  "Hang on, I dropped my keys— NO WAIT THAT'S FAKE, KEEP RUNNING",
];

export const BOSS_TELEGRAPHS = [
  "🔥 *GATHERING CELESTIAL ENERGY*",
  "⚡ *LEAPING FOR SHOCKWAVE SLAM*",
  "🌪️ *WINDING UP KINETIC PUSH*",
  "☀️ *FOCUSING SOLAR DEATH BEAM*"
];

