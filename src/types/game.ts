export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  iconImg?: string;
  dmg: number;
  rate: number;
  fireRate?: number;
  spread: number;
  speed: number;
  bulletSpeed?: number;
  bulletCls?: 'bullet' | 'rocket' | 'grenade';
  infinite?: boolean;
  durMax?: number;
  dur?: number;
  damaged?: boolean;
  repairCost?: number;
  auto: boolean;
  type: 'gun' | 'rocket' | 'melee_wpn';
  pellets?: number;
  splash?: number;
  ammoBased?: boolean;
  ammoMax?: number;
  ammo?: number;
  kb?: number;
}

export interface MeleeDef {
  name: string;
  icon: string;
  dmg: number;
  range: number;
  rate: number;
  cd?: number;
  lastSwing?: number;
  legendary: boolean;
  isLegendary?: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  speed: number;
  slots: (WeaponDef | null)[];
  activeSlot: number;
  melee: MeleeDef;
  grenades: number;
  medkits: number;
  serums: number;
  lastShot: number;
  recoil?: number;
  frozenUntil: number;
  lastRegen: number;
  dashLock: number;
  dashVx: number;
  dashVy: number;
  dashLockedUntil: number;
  onBoxId: string | null;
  onTowerId: string | null;
  elevation: number;
  inCoverId: string | null;
  armorLevel: number;
  upgrades: {
    speedBoost: number;
    damageBoost: number;
    rapidFire: number;
    regenBoost: number;
    magnetRadius: number;
  };
  pushVx?: number;
  pushVy?: number;
}

export interface Zombie {
  id: string;
  type: 'shambler' | 'runner' | 'gunner' | 'rpgz' | 'ztank';
  kind: 'melee' | 'ranged';
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  speed: number;
  dmg: number;
  color: string;
  vx?: number;
  vy?: number;
  kbTime?: number;
  range?: number;
  fireRate?: number;
  fireCd?: number;
  bulletDmg?: number;
  bulletSpeed?: number;
  splash?: number;
  lastShot?: number;
  nextFire?: number;
  dead?: boolean;
  push?: boolean;
  isAggro?: boolean;
  wanderAngle?: number;
  wanderTimer?: number;
  aggroRange?: number;
  deaggroRange?: number;
  lastHit?: number;
  level?: number;
}

export interface BossSkin {
  key: string;
  name: string;
  color: string;
  emoji: string;
  hatText?: string;
  quote?: string;
  flies: boolean;
  moves: string[];
  leapMult?: number;
  chargeMult?: number;
  hpMult: number;
  title?: string;
  // Competitive gimmick system: unique mechanic per boss
  gimmick?: string;        // internal key: 'rampage' | 'shield_of_souls' | 'armor_plating' | etc.
  gimmickHint?: string;    // shown to player on arena entry
  counterSkill?: string;   // superpower id that best counters this boss
}

export interface Boss {
  skin: BossSkin;
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  baseSpeed: number;
  color: string;
  dead: boolean;
  state: 'entering' | 'chasing' | 'anticipate' | 'rising' | 'airborne' | 'landing' | 'chargeWindup' | 'charging' | 'chargeRecover' | 'fireballWindup' | 'teleportOut' | 'teleportStrike' | 'spinWindup' | 'spinning' | 'roar' | 'tripped' | 'laserWindup' | 'laserSweep' | 'summonWindup' | 'solarWindup' | 'solarBeam' | 'pushSlam';
  stateTimer: number;
  targetAng: number;
  facingAng: number;
  chargeAng?: number;
  leapTargetX?: number;
  leapTargetY?: number;
  height: number;
  vHeight: number;
  squash: number;
  moveIdx: number;
  roarBoostUntil: number;
  cycleMs: number;
  spinTick?: number;
  isGuardian?: boolean;
  isFinal?: boolean;
  doorIndex?: number;
  phase: 1 | 2;
  enraged: boolean;
  laserAng?: number;
  laserSweepDir?: number;
  laserTimer?: number;
  solarAng?: number;
  solarSweepSpeed?: number;
  inArena?: boolean;
  arenaId?: number;
  // Gimmick system
  gimmickActive?: boolean;
  gimmickTimer?: number;       // multi-purpose: rampage duration, bass drop cooldown, etc.
  soulShieldHp?: number;       // warlock shield hp
  bassDropCd?: number;         // dj bass drop timer
  reflectActive?: boolean;     // larry mirror active
  wallBounceWarning?: boolean; // bouncer wall proximity warning
  beaconStandTimer?: number;   // arena center beacon eject timer (per boss)
}

export interface EliteGuard {
  id: string;
  doorIndex: number;
  name: string;
  title: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  shieldHp: number;
  shieldMax: number;
  speed: number;
  dmg: number;
  lastShot: number;
  fireCd: number;
  dead: boolean;
  specialTimer: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  cls: 'bullet' | 'rocket' | 'grenade' | 'zfireball' | 'zombiebullet' | 'tankmissile' | 'turretbullet' | 'solarorb' | 'elitebullet';
  splash?: number;
  life: number;
  targetX?: number;
  targetY?: number;
  isRpg?: boolean;
  fromBoss?: boolean;
  color?: string;
}

export interface Shockwave {
  id: string;
  x: number;
  y: number;
  r: number;
  maxR: number;
  dmg: number;
  speed: number;
  color: string;
  pushForce?: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  color: string;
  life: number;
  maxLife: number;
  r?: number;
  isArc?: boolean;
  ang?: number;
  isFlash?: boolean;
  rot?: number;
  vRot?: number;
  isCasing?: boolean;
  isMuzzleFlash?: boolean;
  isSmoke?: boolean;
}

export interface Floater {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Airdrop {
  id: string;
  x: number;
  y: number;
  state: 'falling' | 'landed';
  z: number;
  life: number;
}

export interface Crack {
  id: string;
  x: number;
  y: number;
  time: number;
  type: 'shambler' | 'runner' | 'gunner' | 'rpgz' | 'ztank';
}

export interface Decal {
  id: string;
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
}

export interface Box {
  id: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
}

export interface Turret {
  id: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  range: number;
  cd: number;
  lastShot?: number;
  targetAng?: number;
}

export interface Tank {
  owned: boolean;
  mounted: boolean;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  r: number;
  lastFire: number;
  armorLevel: number;
  cannonLevel: number;
  speedLevel: number;
  nanitesLevel: number;
}

export interface Door {
  index: number;
  name: string;
  cost: number;
  unlocked: boolean;
  cleared: boolean;
  eliteSpawned: boolean;
  eliteDefeated: boolean;
  x: number;
  y: number;
  arenaX: number;
  arenaY: number;
  arenaW: number;
  arenaH: number;
  bossKey: string;
  bossName: string;
  bossColor: string;
  bossIcon: string;
}

export interface Tower {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ladderX: number;
  ladderY: number;
  hp: number;
  hpMax: number;
  destroyed: boolean;
  repairTimer: number;
  repairDuration: number;
  elevation: number;
  shakeTime?: number;
}

export interface CoverObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'sandbag' | 'concrete' | 'bunker';
  angle?: number;
  hp?: number;
}

export interface ExploreNode {
  id: string;
  name: string;
  type: 'scrap_node' | 'radar_station' | 'ammo_cache' | 'bunker_chest';
  x: number;
  y: number;
  r: number;
  atomsYield: number;
  cooldown: number;
  lastLooted: number;
  active: boolean;
}

export interface BaseState {
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
  hp: number;
  hpMax: number;
  safeRadius: number;
  spawnBlockRadius: number;
  maxSoldiers: number;
  healingRate: number;
  turrets: number;
  beaconColor: string;
  pulseTimer: number;
  lastTurretShot: number;
  powerStandX?: number;
  powerStandY?: number;
}

export type SoldierType = 'rifleman' | 'shotgunner' | 'sniper' | 'demolitionist' | 'pyro' | 'cryo' | 'thunder';

export interface Soldier {
  id: string;
  type: SoldierType;
  name: string;
  title: string;
  weaponName: string;
  icon: string;
  color: string;
  level: number;
  hp: number;
  hpMax: number;
  speed: number;
  dmg: number;
  range: number;
  fireRate: number;
  lastShot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetAng: number;
  hasSuperpower: boolean;
  superpowerName?: string;
  superpowerCd?: number;
  lastSuperpower?: number;
  kills: number;
  isDead: boolean;
  respawnTimer: number;
  cost: number;
  upgradeCosts: number[];
  isLegendaryHero: boolean;
  assignedPowerId?: string;
  assignedPowerName?: string;
  assignedPowerColor?: string;
  assignedPowerIcon?: string;
}

export interface Superpower {
  id: string;
  category: 'active' | 'passive';
  name: string;
  desc: string;
  icon: string;
  color: string;
  unlocked: boolean;
  equipped?: boolean;
  slotIndex?: number;
  level: number;
  cooldown: number;
  lastUsed: number;
  duration: number;
  activeUntil: number;
  key: string;
  bossSource: string;
}
