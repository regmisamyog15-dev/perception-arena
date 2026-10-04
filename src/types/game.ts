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
  // Skill-combat layer (see game/combat.ts)
  lastDashAt?: number;
  parryUntil?: number;
  parryCdUntil?: number;
  momentum?: number;
  lastMomentumGain?: number;
  perfectDodgeUntil?: number;
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
  /** Knockback velocity in px/ms (see knockback.ts). */
  kbVx?: number;
  kbVy?: number;
  kbReadyAt?: number;
  /** Timestamp (performance.now) until which the player is drawn red after a heavy hit. */
  hurtUntil?: number;
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
  /** Born from a boss portal; counts toward the 4-at-once summon cap. */
  summoned?: boolean;
  /** Id of the boss summon wave that produced this zombie. */
  summonWave?: number;
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
  state: 'entering' | 'chasing' | 'anticipate' | 'rising' | 'airborne' | 'landing' | 'chargeWindup' | 'charging' | 'chargeRecover' | 'fireballWindup' | 'teleportOut' | 'phantomTelegraph' | 'teleportStrike' | 'spinWindup' | 'spinning' | 'roar' | 'tripped' | 'laserWindup' | 'laserSweep' | 'summonWindup' | 'solarWindup' | 'solarBeam' | 'pushSlam' | 'spikeField' | 'frostWindup' | 'frostBeam' | 'denialWindup' | 'despWindup' | 'despStrike' | 'despRecover' | 'splitCast' | 'dizzy' | 'meteorWindup' | 'meteorShower' | 'throwWindup' | 'pullWindup' | 'pulling' | 'comboWindup' | 'comboRecover' | 'orbCharge';
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
  phase: 1 | 2 | 3;
  enraged: boolean;
  phaseTransitionUntil?: number; // brief invulnerability + telegraph window during a phase change
  phantomSpots?: { x: number; y: number; real: boolean }[]; // Phantom Feint decoys
  repositionUntil?: number; // timestamp — boss is strafing/repositioning instead of closing distance
  repositionDir?: number;   // 1 or -1, which way it's circling
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
  // Spike Field — sequential telegraphed ground-eruption attack
  spikeBurstsLeft?: number;
  spikeX?: number;
  spikeY?: number;
  spikeBurstAt?: number;    // timestamp (ms) of next eruption
  spikeBurstDelay?: number; // ms of warning before that eruption, for render progress
  // Universal anti-camping punish — tracked per boss
  campAnchorX?: number;
  campAnchorY?: number;
  campCheckAt?: number;  // next timestamp to re-check player movement
  campPunishCd?: number; // cooldown so the punish can't fire back-to-back
  // Universal charge fix — travel the full telegraphed lane, hit once for real damage
  chargeDistTraveled?: number;
  chargeHitPlayer?: boolean;
  // Phase 3 "Phantom Split" — 3 bodies, each goes dizzy after taking a slice of the phase-3 pool
  splitDone?: boolean;
  splitActive?: boolean;
  splitMeter?: number;
  splitMeterMax?: number;
  splitDizzy?: boolean;
  // Posture / stagger (see game/combat.ts)
  posture?: number;
  meleeStreak?: number;      // combos in a row; triggers the void orb
  chargeOrbId?: string;      // id of the purple orb being charged over the boss's head
  chargeOrbStart?: number;
  lastPostureHit?: number;
  staggerUntil?: number;
  staggerCount?: number;
  // Final stand ("final hearts"): meteors, thrown weapon, homing missile orb
  finalStand?: boolean;
  finalStandAt?: number;
  missilesFired?: number;
  missileAt?: number;
  meteorNextAt?: number;
  // Chain pull + God-of-War style combo
  pullAt?: number;
  comboStep?: number;
  comboAng?: number;
  comboCdUntil?: number;
  // Summon wave (once a minute); App wipes the previous batch when this id changes
  summonWaveAt?: number;
  summonWaveId?: number;
  // Universal portal summon system — every boss, independent of gimmick/moveset
  portalCheckAt?: number;
  // Runner pack: 5 fast, extra-health runners every minute
  runnerWaveAt?: number;
  // Jumpscare: vanish in a cloud, reappear right next to the player
  jumpscareAt?: number;
  jumpscare?: boolean;
  // Universal yellow orb volley — every boss, independent of gimmick/moveset
  orbCheckAt?: number;
  // Freeze/Slow beam — narrow aimed bolt that slows the player on hit (phase 2+)
  frostAng?: number;
  frostHitPlayer?: boolean; // tracks whether it connected, to unlock a follow-up chain
  // Area Denial — 2-4 short-lived hazard zones the player must reposition out of
  areaZones?: { x: number; y: number; r: number; warnUntil: number; expiresAt: number }[];
  // Feint — boss commits to one recognizable windup, then cancels into a different attack
  feintInto?: 'charge';
}

// Big slow projectile fired by any boss roughly once a minute. Travels in a
// straight line (no homing) so it's readable and dodgeable, and can be shot
// out of the air by the player's own bullets before it connects.
export interface BossOrb {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  hpMax: number;
  dmg: number;
  life: number;
  /** 'orb' (default slow straight orb), 'missile' (phase 3 homing), 'throw' (thrown melee weapon). */
  kind?: 'orb' | 'missile' | 'throw' | 'charge' | 'void';
  speed?: number; // missile cruise speed (px/frame)
  spin?: number;  // thrown weapon rotation
  travelled?: number; // thrown weapon: distance flown outbound
  returning?: boolean; // thrown weapon: being recalled to the boss
}

/** A phantom copy of the boss during phase 3. Shares the boss's sprite. */
export interface BossClone {
  id: string;
  isClone: true;
  skinKey: string;
  x: number;
  y: number;
  r: number;
  color: string;
  facingAng: number;
  squash: number;
  alpha: number;
  state: 'chasing' | 'dizzy' | 'absorbing';
  stateTimer: number;
  atkCd: number;
  meter: number;
  meterMax: number;
  role?: 'rusher' | 'caster';
  act?: 'windup' | 'dash';   // sub-action while state === 'chasing'
  actTimer?: number;
  actAng?: number;
  actDist?: number;
}

export interface Meteor {
  id: string;
  x: number; // impact point
  y: number;
  t: number; // ms elapsed
  fallMs: number;
  dmg: number;
  dps: number; // crater damage per second it will leave behind
}

export interface Crater {
  id: string;
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  dps: number;
}

export interface Phase3State {
  shuffleAt?: number;
  clones: BossClone[];
  meteors: Meteor[];
  craters: Crater[];
  flash: number; // 0..1 light flash from the breaking dimension
  flashAt: number;
  crackX: number;
  crackY: number;
  crackSeed: number;
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
  noBossDamage?: boolean; // soldier-fired bullets — never allowed to hit a boss
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
  /** Plain spark particle owned by the particle pool (see createParticles). */
  pooled?: boolean;
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
  /** Health multiplier applied when the portal births its zombie (runner pack). */
  hpMul?: number;
  /** Skips the boss-summon cap (runner pack is its own timed event). */
  bypassCap?: boolean;
  /** Which summon wave opened this portal. */
  waveId?: number;
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
  // Resurrection Pod — a purchasable structure that heals dragged-back soldiers
  hasRevivePod?: boolean;
  podHealingSoldierId?: string | null;
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
  rentalExpiresAt?: number; // timestamp — soldier is auto-removed from squad when time passes this (e.g. Jack's timed activation)
  // Downed-soldier drag & revive-pod system
  carriedBody?: boolean;   // true while the player is dragging this body back to base
  podHealing?: boolean;    // true while resting in the Resurrection Pod, healing
  podHealStart?: number;   // timestamp healing began, for progress display
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
