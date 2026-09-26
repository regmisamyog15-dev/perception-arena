import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WeaponDef,
  PlayerState,
  Zombie,
  Boss,
  Bullet,
  Particle,
  Floater,
  Airdrop,
  Crack,
  Decal,
  Box,
  Turret,
  Tank,
  Door,
  Tower,
  CoverObstacle,
  Shockwave,
  BaseState,
  Soldier,
  Superpower,
  SoldierType,
  EliteGuard,
  BossOrb,
} from './types/game';
import {
  WORLD_W,
  WORLD_H,
  WEAPONS,
  MELEE_BASE,
  MELEE_LEGEND,
  ZOMBIE_TYPES,
  ARMOR_LEVELS,
  DOOR_COSTS,
  BOSS_SKINS,
  FINAL_BOSS_SKIN,
  UPGRADES,
  GATE_DEFINITIONS,
  MAX_SOLDIER_LEVEL,
} from './game/constants';
import {
  playShootSound,
  playExplosionSound,
  playMeleeSound,
  playHealSound,
  playAlertStinger,
  playUpgradeSound,
  startBgmMusic,
  stopBgmMusic,
  unlockAudio,
} from './audio/sound';
import { generateWorldStructures } from './game/structures';
import { updateTowersAndClimbing } from './game/towerLogic';
import { updateBossAI } from './game/bossLogic';
import { renderGameScene } from './game/renderWorld';
import { preloadAllSprites } from './game/sprites';
import {
  createInitialBase,
  isEntityInsideBase,
  isNearBaseSpawnBlock,
  upgradeBase,
  updateBaseLogic,
  BASE_LEVELS,
} from './game/baseLogic';
import {
  createSoldier,
  upgradeSoldier,
  updateSoldiersLogic,
  imbueSoldierWithPower,
  SOLDIER_DEFINITIONS,
  THUNDER_UNLOCK_BOSS_KILLS,
} from './game/soldierLogic';
import {
  createInitialSuperpowers,
  unlockNextSuperpower,
  activateSuperpower,
  updateSuperpowersActive,
  toggleEquipPowerStand,
} from './game/superpowerLogic';
import { ShopModal } from './components/ShopModal';
import { GameHUD } from './components/GameHUD';
import StartScreen from './components/StartScreen';

const SAVE_KEY = 'perception_arena_save';
const MAX_DEATHS = 3; // player gets 3 free respawns at base; the 4th death is a full game over + save wipe

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    preloadAllSprites();
  }, []);


  // React State for UI & Modals
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [shopOpen, setShopOpen] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('perception_arena_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });

  // Whether a resumable save exists (progress kept as long as the player has died 3 times or fewer)
  const [hasSavedGame, setHasSavedGame] = useState(() => {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  });

  // Persist current run progress (wave/atoms/base/tank/soldiers/superpowers/doors) to the browser.
  const saveProgress = useCallback(() => {
    try {
      const eng = engineRef.current;
      const data = {
        v: 1,
        deaths: eng.deaths,
        wave: eng.wave,
        kills: eng.kills,
        atoms: eng.atoms,
        bossesDefeated: eng.bossesDefeated,
        baseLevel: eng.base.level,
        tank: {
          owned: eng.tank.owned,
          armorLevel: eng.tank.armorLevel,
          cannonLevel: eng.tank.cannonLevel,
          speedLevel: eng.tank.speedLevel,
          nanitesLevel: eng.tank.nanitesLevel,
        },
        soldiers: eng.soldiers.map((s) => ({
          type: s.type,
          level: s.level,
          isLegendaryHero: s.isLegendaryHero,
          assignedPowerId: s.assignedPowerId,
          assignedPowerName: s.assignedPowerName,
          assignedPowerColor: s.assignedPowerColor,
          assignedPowerIcon: s.assignedPowerIcon,
        })),
        superpowers: Object.fromEntries(
          Object.entries(eng.superpowers).map(([id, sp]) => [id, { unlocked: (sp as Superpower).unlocked, equipped: (sp as Superpower).equipped }])
        ),
        player: {
          armorLevel: eng.player.armorLevel,
          upgrades: { ...eng.player.upgrades },
          grenades: eng.player.grenades,
          medkits: eng.player.medkits,
          serums: eng.player.serums,
        },
        doors: eng.doors.map((d) => ({
          index: d.index,
          unlocked: d.unlocked,
          cleared: d.cleared,
          eliteSpawned: d.eliteSpawned,
          eliteDefeated: d.eliteDefeated,
        })),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      setHasSavedGame(true);
    } catch {
      // silent — saving is best-effort
    }
  }, []);

  const clearSavedProgress = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // silent
    }
    setHasSavedGame(false);
  }, []);

  // Reactive state for HUD
  const [hudState, setHudState] = useState({
    hp: 500,
    hpMax: 500,
    wave: 1,
    kills: 0,
    atoms: 0,
    airdropTimer: '03:00',
    bossTimer: '02:30',
    activeSlot: 0,
    grenades: 2,
    medkits: 1,
    serums: 0,
    hasBoss: false,
    bossName: '',
    bossQuote: '',
    bossAttackTag: '',
    bossHpPct: 100,
    bossPhase: 1,
    bossEnraged: false,
    meleeLegendary: false,
    meleeName: 'KNIFE',
    slots: [] as (WeaponDef | null)[],
    tankNear: false,
    tankMounted: false,
    nearDoor: null as Door | null,
    onTowerName: null as string | null,
    towerHp: 1000,
    towerHpMax: 1000,
    inCover: false,
    inBaseSafeZone: false,
    groundSlamLastUsed: 0,
  });

  // Engine persistent refs
  const engineRef = useRef({
    cw: window.innerWidth,
    ch: window.innerHeight,
    camX: 0,
    camY: 0,
    screenShake: 0,
    gameTime: 0,
    airdropTimer: 180000,
    bossTimer: 150000,
    wave: 1,
    kills: 0,
    atoms: 0,
    deaths: 0,
    bossesDefeated: 0,
    vignetteTimer: 0,
    alertText: '',
    alertTimer: 0,
    player: {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      r: 16,
      hp: 500,
      hpMax: 500,
      speed: 6.2,
      slots: [{ ...WEAPONS.pistol, dur: Infinity }, null, null, null],
      activeSlot: 0,
      melee: { ...MELEE_BASE },
      grenades: 2,
      medkits: 1,
      serums: 0,
      lastShot: 0,
      frozenUntil: 0,
      lastRegen: 0,
      dashLock: 0,
      dashVx: 0,
      dashVy: 0,
      dashLockedUntil: 0,
      onBoxId: null,
      onTowerId: null,
      elevation: 0,
      inCoverId: null,
      armorLevel: 0,
      upgrades: {
        speedBoost: 0,
        damageBoost: 0,
        rapidFire: 0,
        regenBoost: 0,
        magnetRadius: 0,
      },
    } as PlayerState,
    tank: {
      owned: false,
      mounted: false,
      x: WORLD_W / 2 + 120,
      y: WORLD_H / 2,
      hp: 10000,
      hpMax: 10000,
      r: 38,
      lastFire: 0,
      armorLevel: 0,
      cannonLevel: 0,
      speedLevel: 0,
      nanitesLevel: 0,
    } as Tank,
    boss: null as Boss | null,
    eliteGuards: [] as EliteGuard[],
    currentArenaId: null as number | null,
    currentGateLevel: 1,
    zombies: [] as Zombie[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    floaters: [] as Floater[],
    airdrops: [] as Airdrop[],
    cracks: [] as Crack[],
    bossOrbs: [] as BossOrb[],
    decals: [] as Decal[],
    boxes: [] as Box[],
    turrets: [] as Turret[],
    doors: [] as Door[],
    towers: [] as Tower[],
    covers: [] as CoverObstacle[],
    shockwaves: [] as Shockwave[],
    base: createInitialBase() as BaseState,
    soldiers: [] as Soldier[],
    superpowers: createInitialSuperpowers() as Record<string, Superpower>,
    keys: {} as Record<string, boolean>,
    lastTap: { w: 0, a: 0, s: 0, d: 0 },
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false, justPressed: false },
    lastTime: 0,
    beaconEjectTimer: 0,       // ms player has been standing on arena center beacon
    beaconEjectWarned: false,  // whether we've shown the 3s warning
    nearPortalWarned: false,   // whether the "Press R to return" popup has fired for this visit
  });

  const initDoorsAndWorld = useCallback(() => {
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;
    const rx = WORLD_W / 2 - 140;
    const ry = WORLD_H / 2 - 140;
    // Spread arenas wider so large arenas don't overlap
    engineRef.current.doors = DOOR_COSTS.map((cost, i) => {
      const a = (i / DOOR_COSTS.length) * Math.PI * 2 - Math.PI / 2;
      const skin = i === 9 ? FINAL_BOSS_SKIN : BOSS_SKINS[i % BOSS_SKINS.length];
      const gateDef = GATE_DEFINITIONS[i];
      const arenaW = gateDef ? gateDef.arenaW : 3200;
      const arenaH = gateDef ? gateDef.arenaH : 3200;
      // Spread arenas: 5-column grid with 5000px spacing so none overlap
      const arenaX = 6000 + (i % 5) * 5200;
      const arenaY = 6000 + Math.floor(i / 5) * 5200;
      return {
        index: i + 1,
        name: gateDef ? gateDef.name : `Gate of ${skin.name}`,
        cost,
        unlocked: false,
        cleared: false,
        eliteSpawned: false,
        eliteDefeated: false,
        x: cx + Math.cos(a) * rx,
        y: cy + Math.sin(a) * ry,
        arenaX,
        arenaY,
        arenaW,
        arenaH,
        bossKey: skin.key,
        bossName: skin.name,
        bossColor: skin.color,
        bossIcon: skin.emoji,
      };
    });

    const { towers, covers } = generateWorldStructures();
    engineRef.current.towers = towers;
    engineRef.current.covers = covers;
  }, []);

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color = '#fff', size = 16) => {
    engineRef.current.floaters.push({
      id: Math.random().toString(),
      x,
      y,
      text,
      color,
      size,
      life: 1000,
      maxLife: 1000,
    });
  }, []);

  const createParticles = useCallback((x: number, y: number, color: string, count: number, speedMax: number, lifeMax = 400) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * speedMax;
      engineRef.current.particles.push({
        id: Math.random().toString(),
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: lifeMax,
        maxLife: lifeMax,
        r: Math.random() * 4 + 1,
      });
    }
  }, []);

  const flashVignette = useCallback(() => {
    engineRef.current.vignetteTimer = 160;
  }, []);

  const addDecal = useCallback((x: number, y: number, r: number) => {
    engineRef.current.decals.push({
      id: Math.random().toString(),
      x,
      y,
      r,
      life: 12000,
      maxLife: 12000,
    });
  }, []);

  const addScreenShake = useCallback((amount: number) => {
    let shakeEnabled = true;
    try {
      const raw = localStorage.getItem('perception_arena_settings');
      if (raw) shakeEnabled = JSON.parse(raw).screenShake !== false;
    } catch {
      /* corrupt/missing settings — default to shake enabled */
    }
    if (!shakeEnabled) return;
    engineRef.current.screenShake = Math.max(engineRef.current.screenShake, amount);
  }, []);

  const showAlert = useCallback((text: string) => {
    engineRef.current.alertText = text;
    engineRef.current.alertTimer = 3500;
    playAlertStinger();
  }, []);

  const addAtoms = useCallback((n: number) => {
    engineRef.current.atoms += n;
  }, []);

  const lootWeapon = useCallback((wpnDef: WeaponDef) => {
    const player = engineRef.current.player;
    let slotIdx = -1;
    for (let i = 1; i < 4; i++) {
      if (!player.slots[i]) {
        slotIdx = i;
        break;
      }
    }
    if (slotIdx === -1) slotIdx = player.activeSlot === 0 ? 1 : player.activeSlot;

    player.slots[slotIdx] = wpnDef.ammoBased
      ? { ...wpnDef, ammo: wpnDef.ammoMax }
      : { ...wpnDef, dur: wpnDef.durMax };
    player.activeSlot = slotIdx;
    spawnFloatingText(player.x, player.y - 40, `Equipped ${wpnDef.name}!`, '#83d3e1');
  }, [spawnFloatingText]);

  const damageEntity = useCallback((ent: Zombie | Boss, rawDmg: number, isRanged?: boolean) => {
    const sp = engineRef.current.superpowers;
    let dmgMultiplier = 1 + (engineRef.current.player.upgrades.damageBoost || 0) * 0.2;
    const berserker = sp.berserker_instinct;
    if (berserker && berserker.unlocked && berserker.equipped) {
      const p = engineRef.current.player;
      if (p.hp < p.hpMax * 0.4) dmgMultiplier *= 1.3;
    }

    // === BOSS GIMMICK DAMAGE MODIFIERS ===
    if ('skin' in ent) {
      const boss = ent as Boss;
      const gimmick = boss.skin.gimmick;

      // G2: Warlock Soul Shield — ranged attacks blocked while shield active
      if (gimmick === 'shield_of_souls' && boss.gimmickActive && boss.soulShieldHp && boss.soulShieldHp > 0) {
        if (isRanged !== false) {
          // Bullets hit the shield, not the boss
          boss.soulShieldHp -= rawDmg * dmgMultiplier;
          spawnFloatingText(boss.x + (Math.random()-0.5)*40, boss.y - boss.r - 20,
            `SHIELD -${Math.round(rawDmg * dmgMultiplier)}`, '#8a9a5b', 13);
          createParticles(boss.x, boss.y, '#8a9a5b', 3, 6, 200);
          return; // Damage goes to shield, not boss
        }
        // Melee bypasses shield and damages shield too
        boss.soulShieldHp -= rawDmg * 0.5;
      }

      // G3: Ironclad Armor Plating — front attacks 70% reduced
      if (gimmick === 'armor_plating') {
        const player = engineRef.current.player;
        const attackAng = Math.atan2(boss.y - player.y, boss.x - player.x);
        let angDiff = attackAng - boss.facingAng;
        while (angDiff > Math.PI) angDiff -= Math.PI * 2;
        while (angDiff < -Math.PI) angDiff += Math.PI * 2;
        if (Math.abs(angDiff) < Math.PI * 0.5) {
          // Frontal hit — 70% reduced
          dmgMultiplier *= 0.30;
          if (Math.random() < 0.2)
            spawnFloatingText(boss.x, boss.y - 80, '⛓️ ARMOR BLOCKED!', '#7a6a58', 14);
        } else {
          // Side/back hit — bonus damage
          dmgMultiplier *= 1.35;
        }
      }

      // G8: Larry Void Mirror — bullets deal 30% dmg back to player
      if (gimmick === 'void_mirror' && boss.reflectActive && isRanged !== false) {
        const reflectDmg = rawDmg * 0.30;
        const p = engineRef.current.player;
        if (p.hp > 0) {
          p.hp = Math.max(1, p.hp - reflectDmg);
          spawnFloatingText(p.x, p.y - 40, `MIRROR -${Math.round(reflectDmg)}`, '#9d4edd', 13);
        }
      }

      // G9: Gary Berserker Rage — below 50% HP reflects 20% dmg
      if (gimmick === 'berserker_rage' && boss.gimmickActive) {
        const reflectDmg = rawDmg * 0.20;
        const p = engineRef.current.player;
        if (p.hp > 0) {
          p.hp = Math.max(1, p.hp - reflectDmg);
          spawnFloatingText(p.x, p.y - 40, `RAGE REFLECT -${Math.round(reflectDmg)}`, '#588157', 12);
        }
      }
      // Universal punish-window system — applies to every boss regardless of
      // gimmick. Cheesing with a stationary SMG spray used to work exactly as
      // well no matter what the boss was doing; now positioning + timing
      // actually matter: tank a committed attack and it barely dents them,
      // dodge it clean and the recovery window afterward is wide open.
      const isRecovering = boss.state === 'chargeRecover' || boss.state === 'tripped' ||
        (boss.state === 'landing' && (boss.height || 0) <= 0);
      const isCommitted = boss.state === 'charging' || boss.state === 'spinning' ||
        boss.state === 'laserSweep' || boss.state === 'solarBeam' || boss.state === 'airborne';
      if (isRecovering) {
        dmgMultiplier *= 1.6;
        if (Math.random() < 0.35) spawnFloatingText(boss.x, boss.y - boss.r - 40, 'PUNISH!', '#7ee787', 15);
      } else if (isCommitted) {
        dmgMultiplier *= 0.55;
      }
    }

    const dmg = rawDmg * dmgMultiplier;
    ent.hp -= dmg;
    (ent as any).lastHit = performance.now();

    const vampiric = sp.vampiric_strikes;
    if (vampiric && vampiric.unlocked && vampiric.equipped) {
      const p = engineRef.current.player;
      p.hp = Math.min(p.hpMax, p.hp + dmg * 0.1);
    }

    // Floating damage numbers
    spawnFloatingText(
      ent.x + (Math.random() - 0.5) * 20,
      ent.y - ent.r - 12,
      `-${Math.round(dmg)}`,
      'skin' in ent ? '#ffd166' : '#ff8a7a',
      'skin' in ent ? 18 : 13
    );

    // Blood & Spark particles
    createParticles(ent.x, ent.y, ent.color || '#ff4d5e', Math.min(8, Math.max(3, Math.ceil(dmg / 15))), 4, 250);

    if (ent.hp <= 0 && !ent.dead) {
      ent.dead = true;
      if ('skin' in ent) {
        handleBossDeath(ent as Boss);
      } else {
        engineRef.current.kills++;
        const z = ent as Zombie;
        // Zombie kill atom drop — cut to a quarter of the original reward
        const baseAtomDrop = z.type === 'ztank' ? 8 : z.type === 'rpgz' || z.type === 'gunner' ? 4 : z.type === 'runner' ? 3 : 2;
        addAtoms(Math.max(1, Math.round(baseAtomDrop * 0.25)));

        // Ground blood splatter decal on death
        engineRef.current.decals.push({
          id: Math.random().toString(),
          x: z.x,
          y: z.y,
          r: z.r * (1.1 + Math.random() * 0.4),
          life: 35000,
          maxLife: 35000,
        });

        // Death particle burst
        createParticles(z.x, z.y, z.color, 12, 5, 400);

        if (engineRef.current.player.upgrades.regenBoost > 0) {
          const healBonus = 25 * engineRef.current.player.upgrades.regenBoost;
          engineRef.current.player.hp = Math.min(engineRef.current.player.hpMax, engineRef.current.player.hp + healBonus);
        }
      }
    }
  }, [addAtoms, createParticles, spawnFloatingText]);

  const explode = useCallback((x: number, y: number, radius: number, dmg: number, hitsBoss: boolean = true) => {
    engineRef.current.screenShake = Math.max(engineRef.current.screenShake, 20);
    playExplosionSound();
    createParticles(x, y, '#ff8c00', 50, 12, 600);
    engineRef.current.particles.push({
      id: Math.random().toString(),
      x,
      y,
      isFlash: true,
      r: radius,
      life: 250,
      maxLife: 250,
      color: 'rgba(255, 100, 0, 0.5)',
    });

    const targets: (Zombie | Boss)[] = [...engineRef.current.zombies];
    if (hitsBoss && engineRef.current.boss && engineRef.current.boss.state !== 'entering') {
      targets.push(engineRef.current.boss);
    }

    for (const t of targets) {
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist < radius + t.r) {
        damageEntity(t, dmg * (1 - dist / (radius * 1.5)));
      }
    }
  }, [createParticles, damageEntity]);

  const handleBossDeath = useCallback((b: Boss) => {
    spawnFloatingText(b.x, b.y, `${b.skin.name} DEFEATED!`, '#ffd166', 30);
    engineRef.current.screenShake = 40;
    playExplosionSound();
    createParticles(b.x, b.y, b.skin.color, 150, 20, 1500);
    addAtoms(250 + engineRef.current.wave * 40);
    engineRef.current.bossesDefeated += 1;

    const player = engineRef.current.player;

    // Unlock or Upgrade Boss Superpowers!
    const unlockedPower = unlockNextSuperpower(
      engineRef.current.superpowers,
      engineRef.current.wave,
      spawnFloatingText,
      player.x,
      player.y
    );
    if (unlockedPower) {
      showAlert(`⚡ POWER UNLOCKED: ${unlockedPower.toUpperCase()}!`);
    }

    if (Math.random() < 0.2) {
      player.melee = { ...MELEE_LEGEND };
      spawnFloatingText(player.x, player.y - 60, 'LEGENDARY DRAGON SWORD ACQUIRED!', '#ffd166', 22);
    } else {
      const dropChoices = [WEAPONS.smg, WEAPONS.ak47, WEAPONS.shotgun, WEAPONS.rpg, WEAPONS.sniper];
      lootWeapon(dropChoices[Math.floor(Math.random() * dropChoices.length)]);
    }
    player.serums += 2;

    if (b.isGuardian && b.doorIndex) {
      const door = engineRef.current.doors[b.doorIndex - 1];
      if (door) door.cleared = true;
      addAtoms(400 * b.doorIndex);
      if (b.isFinal) {
        showAlert('★ ARENA CONQUERED — VICTORY ★');
        spawnFloatingText(player.x, player.y - 90, '★ ALL 10 DOORS CLEARED ★', '#ffd166', 28);
      } else {
        spawnFloatingText(door.x, door.y - 60, `Door ${b.doorIndex} Cleared!`, '#7ee787', 20);
      }
    } else {
      engineRef.current.wave++;
      engineRef.current.bossTimer = 150000;
    }
    engineRef.current.boss = null;
  }, [addAtoms, createParticles, lootWeapon, showAlert, spawnFloatingText]);

  const spawnBoss = useCallback((guardianDoorIndex?: number) => {
    const wave = engineRef.current.wave;
    let skin = BOSS_SKINS[Math.floor(Math.random() * BOSS_SKINS.length)];
    let isFinal = false;

    if (guardianDoorIndex !== undefined) {
      if (guardianDoorIndex === 10) {
        skin = FINAL_BOSS_SKIN;
        isFinal = true;
      } else {
        skin = BOSS_SKINS[(guardianDoorIndex - 1) % BOSS_SKINS.length];
      }
    }

    const hpMul = (1 + (wave - 1) * 0.35) * skin.hpMult;
    const player = engineRef.current.player;

    // Disperse and clear regular zombies from the arena when the boss arrives
    for (const z of engineRef.current.zombies) {
      createParticles(z.x, z.y, '#ffd166', 8, 4, 300);
    }
    engineRef.current.zombies = [];

    engineRef.current.boss = {
      skin,
      x: player.x + (Math.random() - 0.5) * 100,
      y: Math.max(100, player.y - 500),
      r: 42,
      hp: Math.round(1800 * hpMul),
      hpMax: Math.round(1800 * hpMul),
      baseSpeed: 3.0,
      color: skin.color,
      dead: false,
      state: 'entering',
      stateTimer: 1800,
      targetAng: 0,
      facingAng: Math.PI / 2,
      height: 0,
      vHeight: 0,
      squash: 1,
      moveIdx: 0,
      roarBoostUntil: 0,
      cycleMs: Math.max(1200, 2400 - wave * 100),
      isGuardian: guardianDoorIndex !== undefined,
      isFinal,
      doorIndex: guardianDoorIndex,
      phase: 1,
      enraged: false,
    };

    showAlert(`⚠️ BOSS SPAWNED: ${skin.name.toUpperCase()} ⚠️`);
    spawnFloatingText(player.x, player.y - 100, `⚠️ BOSS: ${skin.name}`, '#ff4d5e', 24);
  }, [createParticles, showAlert, spawnFloatingText]);

  const applyPlayerDamage = useCallback((dmg: number, isRanged = false) => {
    const player = engineRef.current.player;
    if (player.hp <= 0) return;

    // If inside base safe sanctuary, Divine Aegis, or mid-dash, player takes 0 damage
    if (isEntityInsideBase(player.x, player.y, engineRef.current.base)) return;
    const aegis = engineRef.current.superpowers.divine_aegis;
    if (aegis && aegis.activeUntil > performance.now()) return;
    if (performance.now() < player.dashLockedUntil) return;

    let finalDmg = dmg;
    if (player.inCoverId && isRanged) {
      finalDmg *= 0.4; // 60% cover damage reduction
    }

    if (player.armorLevel > 0) {
      const armor = ARMOR_LEVELS[player.armorLevel];
      if (armor) finalDmg *= 1 - armor.reduction;
    }
    const ironSkin = engineRef.current.superpowers.iron_skin;
    if (ironSkin && ironSkin.unlocked && ironSkin.equipped) {
      finalDmg *= 0.85;
    }

    player.hp -= finalDmg;
    flashVignette();

    // Second Wind passive: survive a killing blow once per cooldown window
    const secondWind = engineRef.current.superpowers.second_wind;
    if (player.hp <= 0 && secondWind && secondWind.unlocked && secondWind.equipped) {
      const now = performance.now();
      if (now - secondWind.lastUsed >= secondWind.cooldown) {
        secondWind.lastUsed = now;
        player.hp = 1;
        player.dashLockedUntil = now + secondWind.duration;
        spawnFloatingText(player.x, player.y - 60, '💫 SECOND WIND!', secondWind.color, 22);
        addScreenShake(20);
        return;
      }
    }

    if (player.hp <= 0) {
      player.hp = 0;
      const eng = engineRef.current;
      eng.deaths = (eng.deaths || 0) + 1;

      // 3-respawn system: first 3 deaths teleport you back to base instead of ending the run
      if (eng.deaths <= MAX_DEATHS) {
        const remaining = MAX_DEATHS - eng.deaths;
        player.hp = player.hpMax;
        player.x = eng.base.x;
        player.y = eng.base.y;
        player.dashLockedUntil = performance.now() + 2000; // brief invulnerability after respawn
        showAlert(`💀 YOU DIED — Respawned at Base (${remaining} respawn${remaining === 1 ? '' : 's'} left)`);
        spawnFloatingText(player.x, player.y - 80, `RESPAWN ${eng.deaths}/${MAX_DEATHS}`, '#ff4d5e', 22);
        addScreenShake(15);
        saveProgress();
        return;
      }

      // 4th death: real game over, and the save is wiped so the next run starts clean
      setGameState('gameover');
      stopBgmMusic();
      clearSavedProgress();
      setHighScore((prev) => {
        const next = Math.max(prev, eng.wave);
        try {
          localStorage.setItem('perception_arena_highscore', next.toString());
        } catch {
          // silent
        }
        return next;
      });
    }
  }, [flashVignette, spawnFloatingText, addScreenShake, showAlert, saveProgress, clearSavedProgress]);

  const handleToggleEquipSkill = useCallback((id: string) => {
    const res = toggleEquipPowerStand(engineRef.current.superpowers, id);
    if (res.message) {
      spawnFloatingText(engineRef.current.player.x, engineRef.current.player.y - 40, res.message, '#a78bfa', 13);
    }
  }, [spawnFloatingText]);

  const performMelee = useCallback(() => {
    const player = engineRef.current.player;
    if (isEntityInsideBase(player.x, player.y, engineRef.current.base)) {
      spawnFloatingText(player.x, player.y - 35, '🏰 BASE SAFE SANCTUARY (WEAPONS SAFE)', '#83d3e1', 12);
      return;
    }

    const now = performance.now();
    const cd = player.melee.rate || player.melee.cd || 350;
    if (player.melee.lastSwing && now - player.melee.lastSwing < cd) return;

    player.melee.lastSwing = now;
    const isLegend = player.melee.legendary || (player.melee as any).isLegendary;
    playMeleeSound(isLegend || false);

    const m = engineRef.current.mouse;
    const ang = Math.atan2(m.y + engineRef.current.camY - player.y, m.x + engineRef.current.camX - player.x);
    const range = player.melee.range || (isLegend ? 110 : 75);
    const arc = 1.8;

    // Forward lunge step
    player.x += Math.cos(ang) * 10;
    player.y += Math.sin(ang) * 10;

    // Melee blade energy arc animation
    engineRef.current.particles.push({
      id: Math.random().toString(),
      x: player.x,
      y: player.y - player.elevation,
      ang,
      r: range,
      isArc: true,
      life: 160,
      maxLife: 160,
      color: isLegend ? '#ffd166' : '#83d3e1',
    });

    const targets: (Zombie | Boss)[] = [...engineRef.current.zombies];
    if (engineRef.current.boss && engineRef.current.boss.state !== 'entering') {
      targets.push(engineRef.current.boss);
    }

    for (const ent of targets) {
      const dist = Math.hypot(ent.x - player.x, ent.y - player.y);
      if (dist < range + ent.r) {
        const tAng = Math.atan2(ent.y - player.y, ent.x - player.x);
        let diff = Math.abs(tAng - ang);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < arc / 2) {
          damageEntity(ent, player.melee.dmg);
          const push = 18;
          ent.x += Math.cos(tAng) * push;
          ent.y += Math.sin(tAng) * push;
        }
      }
    }
  }, [damageEntity, spawnFloatingText]);

  // Ground Slam — a boss-style AOE smash, part of base kit (not skill-gated)
  const performGroundSlam = useCallback(() => {
    const player = engineRef.current.player;
    if (isEntityInsideBase(player.x, player.y, engineRef.current.base)) {
      spawnFloatingText(player.x, player.y - 35, '🏰 BASE SAFE SANCTUARY (WEAPONS SAFE)', '#83d3e1', 12);
      return;
    }
    const now = performance.now();
    const cd = 6000;
    const last = (player as any).groundSlamLastUsed || 0;
    if (now - last < cd) {
      const rem = Math.ceil((cd - (now - last)) / 1000);
      spawnFloatingText(player.x, player.y - 40, `Ground Slam CD (${rem}s)`, '#ff8a7a', 12);
      return;
    }
    (player as any).groundSlamLastUsed = now;
    addScreenShake(22);
    playExplosionSound();

    const eng = engineRef.current;
    const RADIUS = 190;
    const DMG = 180 + (player.upgrades.damageBoost || 0) * 30;

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      eng.shockwaves.push({
        id: Math.random().toString(),
        x: player.x + Math.cos(a) * 20,
        y: player.y + Math.sin(a) * 20,
        r: 15,
        maxR: RADIUS,
        dmg: DMG * 0.55,
        speed: 14,
        color: '#ffb703',
      });
    }

    const targets: (Zombie | Boss)[] = [...eng.zombies];
    if (eng.boss && eng.boss.state !== 'entering') targets.push(eng.boss);
    for (const ent of targets) {
      const d = Math.hypot(ent.x - player.x, ent.y - player.y);
      if (d < RADIUS + ent.r) {
        damageEntity(ent, DMG);
        const a = Math.atan2(ent.y - player.y, ent.x - player.x);
        ent.x += Math.cos(a) * 60;
        ent.y += Math.sin(a) * 60;
      }
    }
    createParticles(player.x, player.y, '#ffb703', 20, 8, 400);
    spawnFloatingText(player.x, player.y - 50, '💥 GROUND SLAM!', '#ffb703', 20);
  }, [addScreenShake, createParticles, damageEntity, spawnFloatingText]);

  const shootWeapon = useCallback(() => {
    const player = engineRef.current.player;
    const tank = engineRef.current.tank;

    // Safe zone check: Player cannot attack from inside the base
    if (isEntityInsideBase(player.x, player.y, engineRef.current.base)) {
      return;
    }

    // Tank cannon firing
    if (tank.mounted) {
      const now = performance.now();
      if (now - tank.lastFire < 600) return;
      tank.lastFire = now;

      const m = engineRef.current.mouse;
      const ang = Math.atan2(m.y + engineRef.current.camY - player.y, m.x + engineRef.current.camX - player.x);
      const spd = 18;

      engineRef.current.bullets.push({
        id: Math.random().toString(),
        x: player.x + Math.cos(ang) * (tank.r + 18),
        y: player.y + Math.sin(ang) * (tank.r + 18),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        dmg: 450,
        cls: 'tankmissile',
        splash: 220,
        life: 1400,
      });

      playShootSound('rocket');
      engineRef.current.screenShake = Math.max(engineRef.current.screenShake, 15);

      // Tank muzzle flash
      engineRef.current.particles.push({
        id: Math.random().toString(),
        x: player.x + Math.cos(ang) * (tank.r + 24),
        y: player.y + Math.sin(ang) * (tank.r + 24),
        ang,
        r: 28,
        color: '#ffcf5c',
        life: 120,
        maxLife: 120,
        isMuzzleFlash: true,
      });
      return;
    }

    const activeWpn = player.slots[player.activeSlot];
    if (!activeWpn) return;

    const now = performance.now();
    const fireRate = activeWpn.rate || (activeWpn as any).fireRate || 250;
    const rapidBonus = 1 - (player.upgrades.rapidFire || 0) * 0.12;
    if (now - player.lastShot < fireRate * rapidBonus) return;

    if (activeWpn.ammoBased && activeWpn.ammo !== undefined && activeWpn.ammo <= 0) return;
    if (!activeWpn.infinite && activeWpn.dur !== undefined && activeWpn.dur <= 0) return;

    player.lastShot = now;
    if (activeWpn.ammoBased && activeWpn.ammo !== undefined) activeWpn.ammo--;
    if (!activeWpn.infinite && activeWpn.dur !== undefined) activeWpn.dur--;

    const isSniper = activeWpn.id === 'sniper';
    const isRocket = activeWpn.type === 'rocket';
    playShootSound(isSniper ? 'sniper' : isRocket ? 'rocket' : 'gun');

    const m = engineRef.current.mouse;
    const baseAng = Math.atan2(m.y + engineRef.current.camY - (player.y - player.elevation), m.x + engineRef.current.camX - player.x);
    const count = activeWpn.pellets || 1;
    const elevBoost = player.elevation > 0 ? 1.35 : 1.0;
    const bulletSpeed = (activeWpn.speed || (activeWpn as any).bulletSpeed || 20) * elevBoost;
    const bulletCls = isRocket ? 'rocket' : 'bullet';

    const muzX = player.x + Math.cos(baseAng) * (player.r + 14);
    const muzY = (player.y - player.elevation) + Math.sin(baseAng) * (player.r + 14);

    // Muzzle Flash Particle Animation
    engineRef.current.particles.push({
      id: Math.random().toString(),
      x: muzX,
      y: muzY,
      ang: baseAng,
      r: isSniper ? 24 : isRocket ? 26 : 16,
      color: isSniper ? '#83d3e1' : '#ffd166',
      life: 80,
      maxLife: 80,
      isMuzzleFlash: true,
    });

    // Ejected Brass Bullet Casing Particle
    if (!isRocket) {
      const casingAng = baseAng + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      const casingSpeed = 2.5 + Math.random() * 2;
      engineRef.current.particles.push({
        id: Math.random().toString(),
        x: player.x + Math.cos(baseAng) * 6,
        y: (player.y - player.elevation) + Math.sin(baseAng) * 6,
        vx: Math.cos(casingAng) * casingSpeed,
        vy: Math.sin(casingAng) * casingSpeed,
        rot: Math.random() * Math.PI * 2,
        color: '#ffd166',
        life: 600,
        maxLife: 600,
        isCasing: true,
      });
    }

    if (isSniper) {
      engineRef.current.screenShake = Math.max(engineRef.current.screenShake, 6);
    }

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * (activeWpn.spread || 0.05);
      const ang = baseAng + spread;
      engineRef.current.bullets.push({
        id: Math.random().toString(),
        x: muzX,
        y: muzY,
        vx: Math.cos(ang) * bulletSpeed,
        vy: Math.sin(ang) * bulletSpeed,
        dmg: activeWpn.dmg * (player.elevation > 0 ? 1.35 : 1.0),
        cls: bulletCls,
        splash: activeWpn.splash,
        life: 1400,
        targetX: m.x + engineRef.current.camX,
        targetY: m.y + engineRef.current.camY,
      });
    }

    if (activeWpn.ammoBased && activeWpn.ammo === 0) {
      player.slots[player.activeSlot] = null;
      player.activeSlot = 0;
    } else if (!activeWpn.infinite && activeWpn.dur === 0) {
      player.slots[player.activeSlot] = null;
      player.activeSlot = 0;
    }
  }, []);

  const throwGrenade = useCallback(() => {
    const player = engineRef.current.player;
    if (isEntityInsideBase(player.x, player.y, engineRef.current.base)) return;
    if (player.grenades <= 0) return;
    player.grenades--;

    const m = engineRef.current.mouse;
    const tx = m.x + engineRef.current.camX;
    const ty = m.y + engineRef.current.camY;
    const ang = Math.atan2(ty - player.y, tx - player.x);
    const dist = Math.min(450, Math.hypot(tx - player.x, ty - player.y));

    engineRef.current.bullets.push({
      id: Math.random().toString(),
      x: player.x,
      y: player.y,
      vx: Math.cos(ang) * (dist / 22),
      vy: Math.sin(ang) * (dist / 22),
      dmg: 450,
      cls: 'grenade',
      splash: 190,
      life: 650,
    });
  }, []);

  const useConsumable = useCallback(() => {
    const player = engineRef.current.player;
    if (player.serums > 0) {
      player.serums--;
      player.hp = player.hpMax;
      playHealSound();
      spawnFloatingText(player.x, player.y - 40, 'MAX HEAL + SERUM BOOST!', '#7ee787', 20);
    } else if (player.medkits > 0) {
      player.medkits--;
      player.hp = Math.min(player.hpMax, player.hp + 350);
      playHealSound();
      spawnFloatingText(player.x, player.y - 40, '+350 HP', '#7ee787', 18);
    }
  }, [spawnFloatingText]);

  const toggleTank = useCallback(() => {
    const tank = engineRef.current.tank;
    const player = engineRef.current.player;
    if (!tank.owned || tank.hp <= 0) return;

    const d = Math.hypot(player.x - tank.x, player.y - tank.y);
    if (tank.mounted) {
      tank.mounted = false;
      player.x = tank.x + 50;
      player.y = tank.y;
    } else if (d < 100) {
      tank.mounted = true;
    }
  }, []);

  const spawnBossInArena = useCallback((doorIndex: number) => {
    const eng = engineRef.current;
    const door = eng.doors[doorIndex - 1];
    if (!door) return;
    const skin = doorIndex === 10 ? FINAL_BOSS_SKIN : BOSS_SKINS[(doorIndex - 1) % BOSS_SKINS.length];
    const wave = eng.wave;
    const hpMul = (1 + (doorIndex - 1) * 0.45 + (wave - 1) * 0.25) * skin.hpMult;

    // Disperse regular zombies
    for (const z of eng.zombies) {
      createParticles(z.x, z.y, '#ffd166', 8, 4, 300);
    }
    eng.zombies = [];

    eng.boss = {
      skin,
      x: door.arenaX,
      y: door.arenaY - 220,
      r: 44,
      hp: Math.round(2500 * hpMul),
      hpMax: Math.round(2500 * hpMul),
      baseSpeed: 3.3,
      color: skin.color,
      dead: false,
      state: 'entering',
      stateTimer: 1800,
      targetAng: 0,
      facingAng: Math.PI / 2,
      height: 0,
      vHeight: 0,
      squash: 1,
      moveIdx: 0,
      roarBoostUntil: 0,
      cycleMs: Math.max(1100, 2200 - doorIndex * 120),
      isGuardian: true,
      isFinal: doorIndex === 10,
      doorIndex,
      phase: 1,
      enraged: false,
      inArena: true,
      arenaId: doorIndex,
    };

    showAlert(`⚠️ ARENA TITAN: ${skin.name.toUpperCase()} ⚠️`);
    // Show gimmick hint if this boss has one
    if (skin.gimmick && skin.gimmickHint) {
      setTimeout(() => {
        spawnFloatingText(door.arenaX, door.arenaY - 80, skin.gimmickHint!, skin.color, 17);
      }, 1200);
    }
    if (skin.counterSkill) {
      setTimeout(() => {
        spawnFloatingText(door.arenaX, door.arenaY - 120, `💡 TIP: "${skin.counterSkill?.replace(/_/g, ' ').toUpperCase()}" counters this boss!`, '#ffd166', 15);
      }, 2500);
    }
  }, [createParticles, showAlert]);

  const spawnEliteGuard = useCallback((doorIndex: number) => {
    const door = engineRef.current.doors[doorIndex - 1];
    if (!door) return;
    door.eliteSpawned = true;
    const guardTitles = ['Gatekeeper Dreadnought', 'Voidwarden Archon', 'Infernal Sentinel', 'Apex Aegis Titan'];
    const name = guardTitles[(doorIndex - 1) % guardTitles.length];
    const hpBase = 1600 + doorIndex * 450;
    const shieldBase = 700 + doorIndex * 250;

    const guard: EliteGuard = {
      id: `elite-guard-${doorIndex}`,
      doorIndex,
      name: `${name} (Gate ${doorIndex})`,
      title: `Key Guardian of ${door.bossName}`,
      icon: '🛡️',
      color: door.bossColor || '#ff4d5e',
      x: door.x + (Math.random() - 0.5) * 60,
      y: door.y + 75,
      r: 28,
      hp: hpBase,
      hpMax: hpBase,
      shieldHp: shieldBase,
      shieldMax: shieldBase,
      speed: 3.2,
      dmg: 45 + doorIndex * 10,
      lastShot: 0,
      fireCd: 1100,
      dead: false,
      specialTimer: 3500,
    };

    engineRef.current.eliteGuards.push(guard);
    showAlert(`⚠️ ELITE GUARD SUMMONED: ${name.toUpperCase()}!`);
    spawnFloatingText(door.x, door.y - 70, `⚠️ DEFEAT ELITE TO UNLOCK KEY!`, '#ff4d5e', 22);
    addScreenShake(20);
  }, [showAlert, spawnFloatingText, addScreenShake]);

  const enterArenaRealm = useCallback((doorIndex: number) => {
    const door = engineRef.current.doors[doorIndex - 1];
    if (!door) return;
    const eng = engineRef.current;
    eng.currentArenaId = doorIndex;
    
    // Teleport player into center of 100x100 Arena Realm
    eng.player.x = door.arenaX;
    eng.player.y = door.arenaY + 250;
    
    // Teleport Tank if owned
    if (eng.tank.owned) {
      eng.tank.x = door.arenaX + 70;
      eng.tank.y = door.arenaY + 250;
    }
    
    // Teleport Soldiers
    eng.soldiers.forEach((s, idx) => {
      s.x = door.arenaX - 60 + idx * 25;
      s.y = door.arenaY + 280;
    });

    // Spawn Boss in arena if none is active or different boss
    if (!eng.boss || eng.boss.doorIndex !== doorIndex) {
      spawnBossInArena(doorIndex);
    }

    showAlert(`⚡ ENTERED 100x100 ARENA: ${door.bossName.toUpperCase()} ⚡`);
    spawnFloatingText(eng.player.x, eng.player.y - 50, `★ ARENA REALM ${doorIndex} ★`, door.bossColor, 26);
    createParticles(eng.player.x, eng.player.y, '#b98bff', 40, 10, 600);
    addScreenShake(25);
  }, [showAlert, spawnFloatingText, createParticles, addScreenShake, spawnBossInArena]);

  const leaveArenaRealm = useCallback(() => {
    const eng = engineRef.current;
    eng.currentArenaId = null;
    eng.player.x = WORLD_W / 2;
    eng.player.y = WORLD_H / 2 + 100;
    
    if (eng.tank.owned) {
      eng.tank.x = WORLD_W / 2 + 120;
      eng.tank.y = WORLD_H / 2 + 100;
    }
    
    eng.soldiers.forEach((s, idx) => {
      s.x = WORLD_W / 2 - 80 + idx * 30;
      s.y = WORLD_H / 2 + 120;
    });

    showAlert('🏰 RETURNED TO BASTION COMMAND POST');
    spawnFloatingText(eng.player.x, eng.player.y - 50, '🏰 SAFE COMMAND BASTION', '#83d3e1', 24);
    createParticles(eng.player.x, eng.player.y, '#83d3e1', 40, 10, 600);
  }, [showAlert, spawnFloatingText, createParticles]);

  const tryDoorInteract = useCallback(() => {
    const eng = engineRef.current;
    const player = eng.player;
    const doors = eng.doors;

    // Check if inside arena realm and near exit portal
    if (eng.currentArenaId) {
      const d = doors[eng.currentArenaId - 1];
      if (d) {
        const exitDist = Math.hypot(player.x - d.arenaX, player.y - (d.arenaY + d.arenaH / 2 - 120));
        if (exitDist < 120) {
          leaveArenaRealm();
          return;
        }
      }
    }

    // Check overworld gates
    for (const d of doors) {
      const dist = Math.hypot(player.x - d.x, player.y - d.y);
      if (dist < 130) {
        if (!d.eliteDefeated && !d.unlocked) {
          if (!d.eliteSpawned) {
            spawnEliteGuard(d.index);
          } else {
            spawnFloatingText(player.x, player.y - 40, `Defeat ${d.name}'s Elite Guard first!`, '#ff4d5e', 18);
          }
          return;
        }

        if (!d.unlocked) {
          if (eng.atoms >= d.cost) {
            eng.atoms -= d.cost;
            d.unlocked = true;
            eng.currentGateLevel = Math.max(eng.currentGateLevel, d.index + 1);
            spawnFloatingText(d.x, d.y - 40, `Gate ${d.index} Unlocked!`, '#ffcf5c', 22);
            playUpgradeSound();
            showAlert(`🌟 GATE ${d.index} OPENED — MOBS EVOLVE (LV${eng.currentGateLevel})!`);
            enterArenaRealm(d.index);
          } else {
            spawnFloatingText(player.x, player.y - 40, `Need ${d.cost} Atoms for Key!`, '#ff4d5e');
          }
        } else {
          // Free instant entry into Arena Realm anytime to fight boss!
          enterArenaRealm(d.index);
        }
        break;
      }
    }
  }, [enterArenaRealm, leaveArenaRealm, spawnEliteGuard, showAlert, spawnFloatingText]);

  const handleRepairWeapon = useCallback((slotIdx: number) => {
    const eng = engineRef.current;
    const w = eng.player.slots[slotIdx];
    if (!w) return;
    const cost = w.repairCost || 35;
    if (eng.atoms < cost) {
      spawnFloatingText(eng.player.x, eng.player.y - 40, `Need ${cost} ⚛ to Repair!`, '#ff4d5e');
      return;
    }
    eng.atoms -= cost;
    if (w.durMax) w.dur = w.durMax;
    if (w.ammoMax) w.ammo = w.ammoMax;
    w.damaged = false;
    playUpgradeSound();
    spawnFloatingText(eng.player.x, eng.player.y - 40, `🔧 ${w.name} RESTORED 100%!`, '#7ee787', 22);
  }, [spawnFloatingText]);

  const handleRebuildWeapon = useCallback((weaponId: string) => {
    const eng = engineRef.current;
    const def = (WEAPONS as Record<string, WeaponDef>)[weaponId];
    if (!def) return;
    const cost = def.repairCost ? def.repairCost * 2 : 120;
    if (eng.atoms < cost) {
      spawnFloatingText(eng.player.x, eng.player.y - 40, `Need ${cost} ⚛ to Rebuild!`, '#ff4d5e');
      return;
    }
    eng.atoms -= cost;
    lootWeapon(def);
    playUpgradeSound();
    spawnFloatingText(eng.player.x, eng.player.y - 40, `⚙️ ${def.name} REBUILT & EQUIPPED!`, '#ffd166', 22);
  }, [lootWeapon, spawnFloatingText]);

  const handleRepairTowers = useCallback(() => {
    const eng = engineRef.current;
    const cost = 150;
    if (eng.atoms < cost) {
      spawnFloatingText(eng.player.x, eng.player.y - 40, `Need ${cost} ⚛ to repair all towers!`, '#ff4d5e');
      return;
    }
    eng.atoms -= cost;
    eng.towers.forEach((t) => {
      t.hp = t.hpMax;
      t.destroyed = false;
      t.repairTimer = 0;
    });
    playUpgradeSound();
    showAlert('🗼 ALL SNIPER WATCHTOWERS REPAIRED');
    spawnFloatingText(eng.player.x, eng.player.y - 40, '🗼 ALL TOWERS RESTORED 1000 HP!', '#83d3e1', 22);
  }, [showAlert, spawnFloatingText]);

  const handleUpgradeTank = useCallback((component: 'armor' | 'cannon' | 'speed' | 'nanites') => {
    const eng = engineRef.current;
    const tank = eng.tank;
    if (!tank.owned) return;
    const currentLvl = (tank as any)[`${component}Level`] || 0;
    if (currentLvl >= 5) return;
    const costs = [150, 300, 550, 900, 1400];
    const cost = costs[currentLvl] || 500;
    if (eng.atoms < cost) {
      spawnFloatingText(eng.player.x, eng.player.y - 40, `Need ${cost} ⚛ to upgrade ${component}!`, '#ff4d5e');
      return;
    }
    eng.atoms -= cost;
    (tank as any)[`${component}Level`] = currentLvl + 1;
    if (component === 'armor') {
      tank.hpMax += 3000;
      tank.hp += 3000;
    }
    playUpgradeSound();
    spawnFloatingText(eng.player.x, eng.player.y - 40, `🛡️ TANK ${component.toUpperCase()} LV${currentLvl + 1}!`, '#7ee787', 22);
  }, [spawnFloatingText]);

  const handleBuyShopItem = useCallback((type: string, cost: number, payload?: any) => {
    const atoms = engineRef.current.atoms;
    const player = engineRef.current.player;
    const tank = engineRef.current.tank;

    // Tank feature removed — never allow a purchase to go through
    if (type === 'tank' || type === 'tank_upgrade') {
      spawnFloatingText(player.x, player.y - 40, 'Tank support has been decommissioned', '#ff4d5e');
      return;
    }

    if (atoms < cost) return;

    // Resurrection Pod is a one-time structure — check this before the
    // generic atoms deduction below so a repeat click can't double-charge.
    if (type === 'revivePod') {
      if (engineRef.current.base.hasRevivePod) return;
      engineRef.current.atoms -= cost;
      engineRef.current.base.hasRevivePod = true;
      playUpgradeSound();
      spawnFloatingText(player.x, player.y - 50, '⚕️ RESURRECTION POD ONLINE!', '#83d3e1', 22);
      return;
    }

    engineRef.current.atoms -= cost;
    playUpgradeSound();

    if (type === 'armor') {
      player.armorLevel = Math.min(5, (payload as number) || (player.armorLevel + 1));
      const def = ARMOR_LEVELS[player.armorLevel];
      if (def) {
        player.hpMax = 500 + def.hpBonus;
        player.hp = Math.min(player.hpMax, player.hp + def.hpBonus);
      }
      spawnFloatingText(player.x, player.y - 40, `ARMOR LV${player.armorLevel}!`, '#ffcf5c');
    } else if (type === 'medkit') {
      player.medkits++;
      spawnFloatingText(player.x, player.y - 40, '+1 Medkit', '#7ee787');
    } else if (type === 'grenades') {
      player.grenades += 2;
      spawnFloatingText(player.x, player.y - 40, '+2 Grenades', '#ffcf5c');
    } else if (type === 'tank') {
      tank.owned = true;
      tank.hp = tank.hpMax;
      tank.x = player.x + 80;
      tank.y = player.y;
      spawnFloatingText(player.x, player.y - 40, 'ASSAULT TANK DELIVERED!', '#7ee787', 22);
    } else if (type === 'turret') {
      engineRef.current.turrets.push({
        id: Math.random().toString(),
        x: player.x + (Math.random() - 0.5) * 50,
        y: player.y + (Math.random() - 0.5) * 50,
        r: 18,
        hp: 350,
        hpMax: 350,
        range: 420,
        cd: 380,
      });
      spawnFloatingText(player.x, player.y - 40, 'AUTOTURRET DEPLOYED!', '#83d3e1', 20);
    } else if (type === 'crate') {
      engineRef.current.boxes.push({
        id: Math.random().toString(),
        x: player.x + 30,
        y: player.y + 30,
        r: 28,
        hp: 1000,
        hpMax: 1000,
      });
      spawnFloatingText(player.x, player.y - 40, 'CLIMB CRATE DEPLOYED!', '#ffd166', 20);
    } else if (type === 'weapon' && payload) {
      lootWeapon(payload as WeaponDef);
    } else if (type === 'upgrade' && typeof payload === 'string') {
      const key = payload as keyof typeof player.upgrades;
      player.upgrades[key] = (player.upgrades[key] || 0) + 1;
      if (key === 'speedBoost') player.speed += 0.8;
      const upName = (UPGRADES as Record<string, any>)[payload]?.name || 'CORE';
      spawnFloatingText(player.x, player.y - 40, `${upName} UPGRADED!`, '#c6ff6b', 20);
    }
  }, [lootWeapon, spawnFloatingText]);

  // Upgrade Base Sanctuary
  const handleUpgradeBase = useCallback(() => {
    const base = engineRef.current.base;
    const nextLvl = base.level + 1;
    const def = BASE_LEVELS[nextLvl];
    if (!def) return;
    if (engineRef.current.atoms < def.cost) return;

    engineRef.current.atoms -= def.cost;
    upgradeBase(base);
    playUpgradeSound();
    spawnFloatingText(base.x, base.y - 60, `🏰 BASE UPGRADED: ${def.name.toUpperCase()}!`, '#7ee787', 24);
    showAlert(`🏰 BASE UPGRADED TO LEVEL ${base.level}`);
  }, [showAlert, spawnFloatingText]);

  // Recruit Soldier
  const handleRecruitSoldier = useCallback((type: SoldierType) => {
    const base = engineRef.current.base;
    const def = SOLDIER_DEFINITIONS[type];
    if (!def) return;
    if (engineRef.current.soldiers.length >= base.maxSoldiers) {
      spawnFloatingText(engineRef.current.player.x, engineRef.current.player.y - 40, 'Base at max squad capacity!', '#ff4d5e');
      return;
    }
    if (type === 'thunder' && engineRef.current.bossesDefeated < THUNDER_UNLOCK_BOSS_KILLS) {
      spawnFloatingText(engineRef.current.player.x, engineRef.current.player.y - 40, `Defeat ${THUNDER_UNLOCK_BOSS_KILLS} bosses to unlock!`, '#ff4d5e');
      return;
    }
    if (engineRef.current.atoms < def.cost) {
      spawnFloatingText(engineRef.current.player.x, engineRef.current.player.y - 40, `Need ${def.cost} Atoms!`, '#ff4d5e');
      return;
    }

    engineRef.current.atoms -= def.cost;
    const s = createSoldier(type, base.x, base.y);
    engineRef.current.soldiers.push(s);
    playUpgradeSound();
    spawnFloatingText(base.x, base.y - 50, `🎖️ RECRUITED ${s.name}!`, s.color, 22);
  }, [spawnFloatingText]);

  // Upgrade Soldier (Level 1 -> MAX_SOLDIER_LEVEL)
  const handleUpgradeSoldier = useCallback((id: string) => {
    const s = engineRef.current.soldiers.find((sol) => sol.id === id);
    if (!s || s.level >= MAX_SOLDIER_LEVEL) return;
    if (s.type === 'shotgunner' && engineRef.current.currentGateLevel < 2) {
      spawnFloatingText(s.x, s.y - 50, '🔒 CLEAR GATE 1 BOSS DOOR FIRST!', '#ff4d5e', 18);
      return;
    }
    const cost = s.upgradeCosts[s.level - 1];
    if (engineRef.current.atoms < cost) return;

    engineRef.current.atoms -= cost;
    upgradeSoldier(s);
    playUpgradeSound();
    spawnFloatingText(s.x, s.y - 50, `🌟 ${s.name} UPGRADED TO LV${s.level}!`, s.color, 22);
  }, [spawnFloatingText]);

  // Trigger Superpower directly
  const handleTriggerSuperpower = useCallback((id: string) => {
    const eng = engineRef.current;
    activateSuperpower(
      id,
      eng.superpowers,
      eng.player,
      eng.zombies,
      eng.boss,
      eng.shockwaves,
      eng.particles,
      eng.mouse,
      eng.camX,
      eng.camY,
      performance.now(),
      damageEntity,
      explode,
      spawnFloatingText,
      createParticles,
      addScreenShake
    );
  }, [addScreenShake, createParticles, damageEntity, explode, spawnFloatingText]);

  // Main Loop & Engine Updates
  useEffect(() => {
    let animationFrameId: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      unlockAudio();
      engineRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === 'b' || e.key === 'B') setShopOpen((prev) => !prev);
      if (e.key === 'q' || e.key === 'Q') performMelee();
      if (e.key === 'g' || e.key === 'G') throwGrenade();
      if (e.key === 'e' || e.key === 'E') useConsumable();
      if (e.key === 'f' || e.key === 'F') toggleTank();
      if (e.key === 'r' || e.key === 'R') tryDoorInteract();
      if (e.key === 'c' || e.key === 'C') performGroundSlam();

      // Dash / Dodge [Shift] — short i-frame burst on a cooldown
      if (e.key === 'Shift') {
        const eng = engineRef.current;
        const p = eng.player;
        const now = performance.now();
        if (!eng.tank.mounted && now >= p.dashLock && p.hp > 0) {
          let dx = 0;
          let dy = 0;
          if (eng.keys['w'] || eng.keys['arrowup']) dy -= 1;
          if (eng.keys['s'] || eng.keys['arrowdown']) dy += 1;
          if (eng.keys['a'] || eng.keys['arrowleft']) dx -= 1;
          if (eng.keys['d'] || eng.keys['arrowright']) dx += 1;
          if (dx === 0 && dy === 0) {
            const ang = Math.atan2(eng.mouse.y + eng.camY - p.y, eng.mouse.x + eng.camX - p.x);
            dx = Math.cos(ang);
            dy = Math.sin(ang);
          } else {
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
          }
          const DASH_SPEED = 27;
          const DASH_DURATION = 200;
          const DASH_COOLDOWN = 1400;
          p.dashVx = dx * DASH_SPEED;
          p.dashVy = dy * DASH_SPEED;
          p.dashLockedUntil = now + DASH_DURATION;
          p.dashLock = now + DASH_COOLDOWN;
          spawnFloatingText(p.x, p.y - 30, 'DASH!', '#83d3e1', 14);
          createParticles(p.x, p.y, '#83d3e1', 10, 6, 260);
        }
      }

      // Active Skill Keybind [Z] — triggers whichever active skill is equipped
      if (e.key === 'z' || e.key === 'Z') {
        const activeSkill = (Object.values(engineRef.current.superpowers) as Superpower[]).find(
          (s) => s.category === 'active' && s.unlocked && s.equipped
        );
        if (activeSkill) handleTriggerSuperpower(activeSkill.id);
      }

      if (['1', '2', '3', '4'].includes(e.key)) {
        const slotIdx = parseInt(e.key, 10) - 1;
        if (engineRef.current.player.slots[slotIdx]) {
          engineRef.current.player.activeSlot = slotIdx;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engineRef.current.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      engineRef.current.mouse.x = e.clientX;
      engineRef.current.mouse.y = e.clientY;
    };

    const handleMouseDown = () => {
      unlockAudio();
      engineRef.current.mouse.down = true;
      engineRef.current.mouse.justPressed = true;
    };

    const handleMouseUp = () => {
      engineRef.current.mouse.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    const gameLoop = (time: number) => {
      const eng = engineRef.current;
      if (!eng.lastTime) eng.lastTime = time;
      const dt = Math.min(100, time - eng.lastTime);
      eng.lastTime = time;

      if (gameState === 'playing' && !shopOpen) {
        eng.gameTime += dt;
        eng.airdropTimer -= dt;
        eng.bossTimer -= dt;

        if (eng.screenShake > 0) eng.screenShake = Math.max(0, eng.screenShake - dt * 0.06);
        if (eng.vignetteTimer > 0) eng.vignetteTimer -= dt;
        if (eng.alertTimer > 0) eng.alertTimer -= dt;

        const player = eng.player;
        const tank = eng.tank;

        // Player / Tank Movement
        let moveX = 0;
        let moveY = 0;
        if (eng.keys['w'] || eng.keys['arrowup']) moveY -= 1;
        if (eng.keys['s'] || eng.keys['arrowdown']) moveY += 1;
        if (eng.keys['a'] || eng.keys['arrowleft']) moveX -= 1;
        if (eng.keys['d'] || eng.keys['arrowright']) moveX += 1;

        if (moveX !== 0 && moveY !== 0) {
          moveX *= 0.7071;
          moveY *= 0.7071;
        }

        const currentSpeed = tank.mounted ? (4.8 + (tank.speedLevel || 0) * 0.75) : player.speed;
        const nowTs = performance.now();
        if (!tank.mounted && nowTs < player.dashLockedUntil) {
          player.x += player.dashVx;
          player.y += player.dashVy;
        } else {
          player.x += moveX * currentSpeed;
          player.y += moveY * currentSpeed;
        }

        if (tank.mounted) {
          tank.x = player.x;
          tank.y = player.y;
        }

        // Tank Nanite Auto-Repair
        if (tank.owned && tank.nanitesLevel && tank.nanitesLevel > 0 && tank.hp < tank.hpMax) {
          tank.hp = Math.min(tank.hpMax, tank.hp + tank.nanitesLevel * 45 * (dt / 1000));
        }

        // Keep inside bounds (Realm arena or overworld)
        if (eng.currentArenaId) {
          const currentDoor = eng.doors[eng.currentArenaId - 1];
          if (currentDoor) {
            const minX = currentDoor.arenaX - currentDoor.arenaW / 2 + 35;
            const maxX = currentDoor.arenaX + currentDoor.arenaW / 2 - 35;
            const minY = currentDoor.arenaY - currentDoor.arenaH / 2 + 35;
            const maxY = currentDoor.arenaY + currentDoor.arenaH / 2 - 35;
            player.x = Math.max(minX, Math.min(maxX, player.x));
            player.y = Math.max(minY, Math.min(maxY, player.y));
            if (tank.mounted) {
              tank.x = player.x;
              tank.y = player.y;
            }

            // Exit portal proximity popup — fires every time you step onto it
            const portalDist = Math.hypot(
              player.x - currentDoor.arenaX,
              player.y - (currentDoor.arenaY + currentDoor.arenaH / 2 - 120)
            );
            if (portalDist < 120) {
              if (!eng.nearPortalWarned) {
                eng.nearPortalWarned = true;
                showAlert('🌀 PRESS R TO RETURN TO OVERWORLD');
              }
            } else {
              eng.nearPortalWarned = false;
            }
          }
        } else {
          player.x = Math.max(player.r, Math.min(WORLD_W - player.r, player.x));
          player.y = Math.max(player.r, Math.min(WORLD_H - player.r, player.y));
          eng.nearPortalWarned = false;
        }

        // -------------------------------------------------------
        // ARENA BEACON EJECT: stand 5s on center sigil = kicked out
        // -------------------------------------------------------
        if (eng.currentArenaId) {
          const beaconDoor = eng.doors[eng.currentArenaId - 1];
          if (beaconDoor) {
            const distToCenter = Math.hypot(player.x - beaconDoor.arenaX, player.y - beaconDoor.arenaY);
            const BEACON_RADIUS = 80;
            if (distToCenter < BEACON_RADIUS && eng.boss && !eng.boss.dead) {
              eng.beaconEjectTimer = (eng.beaconEjectTimer || 0) + dt;
              const secsLeft = Math.ceil((5000 - eng.beaconEjectTimer) / 1000);
              if (eng.beaconEjectTimer > 2500 && !eng.beaconEjectWarned) {
                eng.beaconEjectWarned = true;
                spawnFloatingText(player.x, player.y - 60, `⚠️ BEACON WARNING: LEAVE OR BE EJECTED!`, '#ff4d5e', 18);
              }
              if (eng.beaconEjectTimer < 5000) {
                spawnFloatingText(player.x, player.y - 40, `🔴 BEACON EJECT: ${secsLeft}s`, '#ff4d5e', 15);
              }
              if (eng.beaconEjectTimer >= 5000) {
                // Force eject
                eng.beaconEjectTimer = 0;
                eng.beaconEjectWarned = false;
                leaveArenaRealm();
                showAlert('⚡ BEACON EJECT — You were expelled from the arena!');
              }
            } else {
              eng.beaconEjectTimer = Math.max(0, (eng.beaconEjectTimer || 0) - dt * 2);
              if (eng.beaconEjectTimer === 0) eng.beaconEjectWarned = false;
            }
          }
        } else {
          eng.beaconEjectTimer = 0;
          eng.beaconEjectWarned = false;
        }

        // Cover detection
        let insideCover: CoverObstacle | null = null;
        for (const cov of eng.covers) {
          if (
            player.x >= cov.x - cov.w / 2 &&
            player.x <= cov.x + cov.w / 2 &&
            player.y >= cov.y - cov.h / 2 &&
            player.y <= cov.y + cov.h / 2
          ) {
            insideCover = cov;
            break;
          }
        }
        player.inCoverId = insideCover ? insideCover.id : null;

        // Update Sniper Towers & Climbing (1000 HP, Zombie melee attacks, 4-min repair)
        updateTowersAndClimbing(
          eng.towers,
          player,
          eng.zombies,
          eng.boss,
          eng.bullets,
          dt,
          time,
          (t) => addScreenShake(25),
          (t) => {},
          spawnFloatingText
        );

        // Update Command Bastion Safe Sanctuary & Defensive Turrets
        updateBaseLogic(
          eng.base,
          player,
          eng.soldiers,
          eng.zombies,
          eng.boss,
          eng.bullets,
          dt,
          time,
          damageEntity,
          createParticles
        );

        // Update Squad Soldiers (AI, Superpowers, Formations, Level 1-3 stats)
        updateSoldiersLogic(
          eng.soldiers,
          player,
          eng.base,
          eng.zombies,
          eng.boss,
          eng.bullets,
          eng.particles,
          eng.floaters,
          dt,
          time,
          damageEntity,
          explode,
          spawnFloatingText,
          createParticles
        );

        // Update Active Boss-Unlocked Superpowers (Orbital Death Ray, Chronoshift, Divine Aegis)
        updateSuperpowersActive(
          eng.superpowers,
          player,
          eng.zombies,
          eng.boss,
          eng.particles,
          eng.mouse,
          eng.camX,
          eng.camY,
          time,
          dt,
          damageEntity,
          createParticles
        );

        // Update Elite Gatekeeper Guards
        for (let i = eng.eliteGuards.length - 1; i >= 0; i--) {
          const eg = eng.eliteGuards[i];
          if (eg.dead) {
            eng.eliteGuards.splice(i, 1);
            continue;
          }

          const dPlayer = Math.hypot(player.x - eg.x, player.y - eg.y);
          const ang = Math.atan2(player.y - eg.y, player.x - eg.x);
          
          if (dPlayer > 110) {
            eg.x += Math.cos(ang) * eg.speed;
            eg.y += Math.sin(ang) * eg.speed;
          }

          // Elite Guard Firing
          if (time - eg.lastShot > eg.fireCd && dPlayer < 680) {
            eg.lastShot = time;
            eng.bullets.push({
              id: Math.random().toString(),
              x: eg.x + Math.cos(ang) * 22,
              y: eg.y + Math.sin(ang) * 22,
              vx: Math.cos(ang) * 11,
              vy: Math.sin(ang) * 11,
              dmg: eg.dmg,
              cls: 'elitebullet',
              life: 1500,
              color: eg.color,
            });

            // Special Radial Plasma Volley
            eg.specialTimer -= 1000;
            if (eg.specialTimer <= 0) {
              eg.specialTimer = 4000;
              for (let k = 0; k < 6; k++) {
                const bAng = ang + (k / 6) * Math.PI * 2;
                eng.bullets.push({
                  id: Math.random().toString(),
                  x: eg.x,
                  y: eg.y,
                  vx: Math.cos(bAng) * 9,
                  vy: Math.sin(bAng) * 9,
                  dmg: eg.dmg * 0.8,
                  cls: 'elitebullet',
                  life: 1200,
                  color: eg.color,
                });
              }
              spawnFloatingText(eg.x, eg.y - 40, '⚡ PLASMA VOLLEY!', eg.color, 16);
              addScreenShake(10);
            }
          }

          // Melee attack on player
          if (dPlayer < eg.r + player.r && !tank.mounted && !isEntityInsideBase(player.x, player.y, eng.base)) {
            applyPlayerDamage(eg.dmg * (dt / 1000) * 1.8);
          }
        }

        // Weapon Firing
        if (eng.mouse.down) {
          shootWeapon();
        }

        // Spawn Boss when timer runs out
        if (eng.bossTimer <= 0 && !eng.boss) {
          spawnBoss();
        }

        // Spawn Airdrop
        if (eng.airdropTimer <= 0) {
          eng.airdropTimer = 180000;
          eng.airdrops.push({
            id: Math.random().toString(),
            x: player.x + (Math.random() - 0.5) * 500,
            y: player.y + (Math.random() - 0.5) * 500,
            state: 'falling',
            z: 400,
            life: 60000,
          });
          showAlert('📦 AIRDROP INBOUND');
        }

        // Natural Zombie Spawning (Scales with currentGateLevel!)
        const targetZombieCount = Math.min(70, 15 + eng.wave * 4 + (eng.currentGateLevel - 1) * 6);
        if (!eng.boss && !eng.currentArenaId && eng.zombies.length < targetZombieCount && Math.random() < 0.08) {
          const a = Math.random() * Math.PI * 2;
          const dist = 650 + Math.random() * 550;
          const zx = player.x + Math.cos(a) * dist;
          const zy = player.y + Math.sin(a) * dist;

          // Never spawn near base safe sanctuary
          if (
            zx > 50 &&
            zx < WORLD_W - 50 &&
            zy > 50 &&
            zy < WORLD_H - 50 &&
            !isNearBaseSpawnBlock(zx, zy, eng.base)
          ) {
            const zTypes: (keyof typeof ZOMBIE_TYPES)[] = ['shambler', 'runner', 'gunner', 'rpgz', 'ztank'];
            const randType = zTypes[Math.floor(Math.random() * (eng.wave > 4 ? 5 : eng.wave > 2 ? 3 : 2))];
            const def = ZOMBIE_TYPES[randType];
            const gateScaling = 1 + (eng.currentGateLevel - 1) * 0.35 + (eng.wave - 1) * 0.18;

            eng.zombies.push({
              type: randType,
              x: zx,
              y: zy,
              r: def.r,
              hp: def.hp * gateScaling,
              hpMax: def.hp * gateScaling,
              speed: def.speed * (1 + (eng.currentGateLevel - 1) * 0.05),
              dmg: def.dmg * (1 + (eng.currentGateLevel - 1) * 0.25),
              color: def.color,
              dead: false,
              kind: def.kind,
              range: 'range' in def ? (def as any).range : 500,
              fireCd: 'fireRate' in def ? (def as any).fireRate : 1200,
              lastShot: 0,
              splash: 'splash' in def ? (def as any).splash : 0,
              isAggro: false,
              aggroRange: def.aggroRange || 750,
              wanderAngle: Math.random() * Math.PI * 2,
              wanderTimer: 2000,
            });
          }
        }

        // Update Zombies (Smooth separation, no freeze on contact!)
        for (let i = eng.zombies.length - 1; i >= 0; i--) {
          const z = eng.zombies[i];
          if (z.dead) {
            eng.zombies.splice(i, 1);
            continue;
          }

          const distToPlayer = Math.hypot(player.x - z.x, player.y - z.y);
          z.isAggro = distToPlayer < (z.aggroRange || 750);

          if (z.isAggro) {
            const ang = Math.atan2(player.y - z.y, player.x - z.x);
            if (player.elevation === 0 || z.kind === 'ranged' || distToPlayer > 120) {
              z.x += Math.cos(ang) * z.speed;
              z.y += Math.sin(ang) * z.speed;
            }

            // Zombie Ranged Attack
            if (z.kind === 'ranged' && distToPlayer < (z.range || 500)) {
              if (time - (z.lastShot || 0) > (z.fireCd || 1200)) {
                z.lastShot = time;
                eng.bullets.push({
                  id: Math.random().toString(),
                  x: z.x,
                  y: z.y,
                  vx: Math.cos(ang) * (z.splash ? 7 : 9),
                  vy: Math.sin(ang) * (z.splash ? 7 : 9),
                  dmg: z.dmg,
                  cls: 'zombiebullet',
                  isRpg: (z.splash || 0) > 0,
                  life: 1600,
                });
              }
            }

            // Zombie Melee Attack on Player
            if (z.kind !== 'ranged' && distToPlayer < z.r + player.r && player.elevation === 0) {
              if (!tank.mounted && !isEntityInsideBase(player.x, player.y, eng.base)) {
                applyPlayerDamage(z.dmg * (dt / 1000) * 2.2);
              }
              z.x -= Math.cos(ang) * 2.5;
              z.y -= Math.sin(ang) * 2.5;
            }
          } else {
            z.wanderTimer = (z.wanderTimer || 2000) - dt;
            if (z.wanderTimer <= 0) {
              z.wanderAngle = Math.random() * Math.PI * 2;
              z.wanderTimer = 2000 + Math.random() * 2000;
            }
            z.x += Math.cos(z.wanderAngle || 0) * (z.speed * 0.35);
            z.y += Math.sin(z.wanderAngle || 0) * (z.speed * 0.35);
          }
        }

        // Update Boss AI (Enrage, Lasers, Push Slam, Shockwaves)
        if (eng.boss) {
          const arenaDoor = eng.currentArenaId ? eng.doors[eng.currentArenaId - 1] : null;
          const bounds = arenaDoor
            ? {
                minX: arenaDoor.arenaX - arenaDoor.arenaW / 2,
                maxX: arenaDoor.arenaX + arenaDoor.arenaW / 2,
                minY: arenaDoor.arenaY - arenaDoor.arenaH / 2,
                maxY: arenaDoor.arenaY + arenaDoor.arenaH / 2,
              }
            : { minX: 100, maxX: WORLD_W - 100, minY: 100, maxY: WORLD_H - 100 };

          updateBossAI(
            eng.boss,
            player,
            tank,
            eng.shockwaves,
            eng.cracks,
            eng.bullets,
            eng.bossOrbs,
            dt,
            time,
            eng.wave,
            bounds,
            applyPlayerDamage,
            flashVignette,
            spawnFloatingText,
            createParticles,
            addDecal,
            addScreenShake
          );
        }

        // Portal Cracks — boss summon countdown. Previously these just sat on
        // the ground forever with no zombie ever climbing out; now the portal
        // actually births the promised zombie the instant it finishes opening.
        for (let i = eng.cracks.length - 1; i >= 0; i--) {
          const c = eng.cracks[i];
          c.time -= dt;
          if (c.time <= 0) {
            const def = ZOMBIE_TYPES[c.type];
            const gateScaling = 1 + (eng.currentGateLevel - 1) * 0.35 + (eng.wave - 1) * 0.18;
            eng.zombies.push({
              type: c.type,
              x: c.x,
              y: c.y,
              r: def.r,
              hp: def.hp * gateScaling,
              hpMax: def.hp * gateScaling,
              speed: def.speed * (1 + (eng.currentGateLevel - 1) * 0.05),
              dmg: def.dmg * (1 + (eng.currentGateLevel - 1) * 0.25),
              color: def.color,
              dead: false,
              kind: def.kind,
              range: 'range' in def ? (def as any).range : 500,
              fireCd: 'fireRate' in def ? (def as any).fireRate : 1200,
              lastShot: 0,
              splash: 'splash' in def ? (def as any).splash : 0,
              isAggro: true, // summoned units come out already hunting — no free grace period
              aggroRange: def.aggroRange || 750,
              wanderAngle: Math.random() * Math.PI * 2,
              wanderTimer: 2000,
            });
            createParticles(c.x, c.y, '#b98bff', 28, 9, 420);
            addScreenShake(6);
            eng.cracks.splice(i, 1);
          }
        }

        // Update Shockwaves
        for (let i = eng.shockwaves.length - 1; i >= 0; i--) {
          const sw = eng.shockwaves[i];
          sw.r += sw.speed;

          if (player.elevation === 0 && !tank.mounted && !isEntityInsideBase(player.x, player.y, eng.base)) {
            const pDist = Math.hypot(player.x - sw.x, player.y - sw.y);
            if (Math.abs(pDist - sw.r) < 25) {
              applyPlayerDamage(sw.dmg * (dt / 1000) * 3);
            }
          }

          if (sw.r >= sw.maxR) {
            eng.shockwaves.splice(i, 1);
          }
        }

        // Helper for continuous swept bullet-segment collision
        const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
          const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
          if (l2 === 0) return Math.hypot(px - x1, py - y1);
          let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
        };

        // Update Bullets
        for (let i = eng.bullets.length - 1; i >= 0; i--) {
          const b = eng.bullets[i];
          const prevX = b.x;
          const prevY = b.y;
          b.x += b.vx;
          b.y += b.vy;
          b.life -= dt;

          if (b.cls === 'grenade' && b.life <= 0) {
            explode(b.x, b.y, b.splash || 180, b.dmg);
            eng.bullets.splice(i, 1);
            continue;
          }

          if (b.life <= 0) {
            eng.bullets.splice(i, 1);
            continue;
          }

          // Player / Turret / Soldier Bullet hitting Boss or Zombies or Elite Guards
          if (b.cls !== 'zombiebullet' && b.cls !== 'zfireball' && b.cls !== 'elitebullet') {
            let hit = false;
            if (!b.noBossDamage && eng.boss && eng.boss.state !== 'entering') {
              const dBoss = distToSegment(eng.boss.x, eng.boss.y, prevX, prevY, b.x, b.y);
              if (dBoss < eng.boss.r + 8) {
                if (b.splash) {
                  explode(b.x, b.y, b.splash, b.dmg);
                } else {
                  damageEntity(eng.boss, b.dmg, true); // isRanged = true for gimmick system
                }
                hit = true;
              }
            }

            // Bullet hitting a Boss Orb — shoot it down before it connects
            if (!hit) {
              for (let oi = eng.bossOrbs.length - 1; oi >= 0; oi--) {
                const orb = eng.bossOrbs[oi];
                const dOrb = distToSegment(orb.x, orb.y, prevX, prevY, b.x, b.y);
                if (dOrb < orb.r + 8) {
                  orb.hp -= b.dmg;
                  createParticles(orb.x, orb.y, '#ffd166', 5, 5);
                  if (orb.hp <= 0) {
                    createParticles(orb.x, orb.y, '#ffd166', 30, 10, 450);
                    addScreenShake(10);
                    spawnFloatingText(orb.x, orb.y - 30, 'ORB DESTROYED!', '#ffd166', 16);
                    eng.bossOrbs.splice(oi, 1);
                  }
                  hit = true;
                  break;
                }
              }
            }

            // Bullet hitting Elite Guards
            if (!hit) {
              for (const eg of eng.eliteGuards) {
                const dG = distToSegment(eg.x, eg.y, prevX, prevY, b.x, b.y);
                if (dG < eg.r + 8) {
                  if (eg.shieldHp > 0) {
                    eg.shieldHp = Math.max(0, eg.shieldHp - b.dmg);
                    createParticles(eg.x, eg.y, '#83d3e1', 6, 4);
                    spawnFloatingText(eg.x, eg.y - 35, `SHIELD -${Math.round(b.dmg)}`, '#83d3e1', 14);
                  } else {
                    eg.hp -= b.dmg;
                    createParticles(eg.x, eg.y, eg.color, 6, 5);
                    spawnFloatingText(eg.x, eg.y - 35, `-${Math.round(b.dmg)}`, '#ff8a7a', 15);
                  }

                  if (eg.hp <= 0 && !eg.dead) {
                    eg.dead = true;
                    const d = eng.doors[eg.doorIndex - 1];
                    if (d) d.eliteDefeated = true;
                    eng.atoms += 200 + eg.doorIndex * 60;
                    showAlert(`🏆 ELITE GUARD DEFEATED! GATE ${eg.doorIndex} KEY SEIZED!`);
                    spawnFloatingText(eg.x, eg.y - 50, `🔑 GATE ${eg.doorIndex} KEY UNLOCKED!`, '#ffd166', 26);
                    createParticles(eg.x, eg.y, eg.color, 80, 16, 900);
                    addScreenShake(30);
                  }
                  hit = true;
                  break;
                }
              }
            }

            if (!hit) {
              for (const z of eng.zombies) {
                const dZ = distToSegment(z.x, z.y, prevX, prevY, b.x, b.y);
                if (dZ < z.r + 8) {
                  if (b.splash) {
                    explode(b.x, b.y, b.splash, b.dmg, !b.noBossDamage);
                  } else {
                    damageEntity(z, b.dmg);
                  }
                  hit = true;
                  break;
                }
              }
            }

            if (hit) {
              eng.bullets.splice(i, 1);
              continue;
            }
          } else {
            // Zombie / Elite Guard bullet hitting Player
            const dPlayer = distToSegment(player.x, player.y - player.elevation, prevX, prevY, b.x, b.y);
            if (dPlayer < player.r + 6) {
              if (b.isRpg) {
                explode(b.x, b.y, 140, b.dmg);
              } else {
                applyPlayerDamage(b.dmg, true);
              }
              eng.bullets.splice(i, 1);
              continue;
            }
          }
        }

        // Update Boss Orbs — big slow dodgeable projectiles
        for (let i = eng.bossOrbs.length - 1; i >= 0; i--) {
          const orb = eng.bossOrbs[i];
          orb.x += orb.vx;
          orb.y += orb.vy;
          orb.life -= dt;
          if (orb.life <= 0) {
            eng.bossOrbs.splice(i, 1);
            continue;
          }
          if (Math.hypot(player.x - orb.x, player.y - orb.y) < player.r + orb.r && !tank.mounted) {
            applyPlayerDamage(orb.dmg);
            flashVignette();
            spawnFloatingText(player.x, player.y - 40, `-${orb.dmg} ORB HIT!`, '#ffd166', 22);
            createParticles(orb.x, orb.y, '#ffd166', 26, 9, 400);
            addScreenShake(14);
            eng.bossOrbs.splice(i, 1);
          }
        }

        // Update Airdrops
        for (let i = eng.airdrops.length - 1; i >= 0; i--) {
          const a = eng.airdrops[i];
          if (a.state === 'falling') {
            a.z = Math.max(0, a.z - dt * 0.4);
            if (a.z <= 0) a.state = 'landed';
          } else {
            a.life -= dt;
            if (Math.hypot(player.x - a.x, player.y - a.y) < player.r + 28) {
              const weaponsList = [WEAPONS.smg, WEAPONS.ak47, WEAPONS.shotgun, WEAPONS.rpg, WEAPONS.sniper];
              lootWeapon(weaponsList[Math.floor(Math.random() * weaponsList.length)]);
              player.medkits += 2;
              player.grenades += 3;
              addAtoms(75);
              spawnFloatingText(a.x, a.y - 30, '+MEDKITS +GRENADES +WEAPON', '#ffd166', 20);
              eng.airdrops.splice(i, 1);
              continue;
            }
            if (a.life <= 0) eng.airdrops.splice(i, 1);
          }
        }

        // Update Particles & Floaters & Decals
        for (let i = eng.particles.length - 1; i >= 0; i--) {
          const p = eng.particles[i];
          p.x += (p.vx || 0);
          p.y += (p.vy || 0);
          if (p.isCasing) {
            p.rot = (p.rot || 0) + 0.2;
            p.vx = (p.vx || 0) * 0.95;
            p.vy = (p.vy || 0) * 0.95 + 0.12;
          }
          p.life -= dt;
          if (p.life <= 0) eng.particles.splice(i, 1);
        }

        for (let i = eng.decals.length - 1; i >= 0; i--) {
          const d = eng.decals[i];
          d.life -= dt;
          if (d.life <= 0) eng.decals.splice(i, 1);
        }

        for (let i = eng.floaters.length - 1; i >= 0; i--) {
          const f = eng.floaters[i];
          f.y -= dt * 0.04;
          f.life -= dt;
          if (f.life <= 0) eng.floaters.splice(i, 1);
        }

        // Camera Follow
        eng.camX = player.x - eng.cw / 2;
        eng.camY = player.y - eng.ch / 2;

        // Reactive HUD update
        const activeTower = eng.towers.find((t) => t.id === player.onTowerId);
        const inBase = isEntityInsideBase(player.x, player.y, eng.base);

        setHudState({
          hp: player.hp,
          hpMax: player.hpMax,
          wave: eng.wave,
          kills: eng.kills,
          atoms: eng.atoms,
          airdropTimer: `${Math.floor(Math.max(0, eng.airdropTimer) / 60000)}:${Math.floor((Math.max(0, eng.airdropTimer) % 60000) / 1000).toString().padStart(2, '0')}`,
          bossTimer: eng.boss ? 'ACTIVE' : `${Math.floor(Math.max(0, eng.bossTimer) / 60000)}:${Math.floor((Math.max(0, eng.bossTimer) % 60000) / 1000).toString().padStart(2, '0')}`,
          activeSlot: player.activeSlot,
          grenades: player.grenades,
          medkits: player.medkits,
          serums: player.serums,
          hasBoss: !!eng.boss,
          bossName: eng.boss ? eng.boss.skin.name : '',
          bossQuote: eng.boss ? eng.boss.skin.quote : '',
          bossAttackTag: eng.boss ? eng.boss.state.toUpperCase() : '',
          bossHpPct: eng.boss ? Math.max(0, (eng.boss.hp / eng.boss.hpMax) * 100) : 0,
          bossPhase: eng.boss?.phase || 1,
          bossEnraged: eng.boss?.enraged || false,
          meleeLegendary: player.melee.isLegendary || false,
          meleeName: player.melee.name,
          slots: player.slots,
          tankNear: tank.owned && Math.hypot(player.x - tank.x, player.y - tank.y) < 110,
          tankMounted: tank.mounted,
          nearDoor: eng.doors.find((d) => Math.hypot(player.x - d.x, player.y - d.y) < 110) || null,
          onTowerName: activeTower ? activeTower.name : null,
          towerHp: activeTower ? activeTower.hp : 1000,
          towerHpMax: activeTower ? activeTower.hpMax : 1000,
          inCover: !!player.inCoverId,
          inBaseSafeZone: inBase,
          groundSlamLastUsed: (player as any).groundSlamLastUsed || 0,
        });
      }

      // Render World Scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            eng.cw = canvas.width;
            eng.ch = canvas.height;
          }
          renderGameScene(
            ctx,
            eng.cw,
            eng.ch,
            eng.camX,
            eng.camY,
            eng.screenShake,
            eng.player,
            eng.tank,
            eng.boss,
            eng.zombies,
            eng.bullets,
            eng.particles,
            eng.floaters,
            eng.airdrops,
            eng.cracks,
            eng.decals,
            eng.boxes,
            eng.turrets,
            eng.doors,
            eng.towers,
            eng.covers,
            eng.shockwaves,
            eng.mouse,
            eng.base,
            eng.soldiers,
            eng.superpowers,
            eng.eliteGuards,
            eng.currentArenaId,
            eng.beaconEjectTimer,
            eng.bossOrbs
          );
        }
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    gameState,
    shopOpen,
    performMelee,
    shootWeapon,
    throwGrenade,
    useConsumable,
    toggleTank,
    tryDoorInteract,
    handleTriggerSuperpower,
    applyPlayerDamage,
    damageEntity,
    explode,
    flashVignette,
    addDecal,
    addScreenShake,
    lootWeapon,
    spawnBoss,
    spawnFloatingText,
    createParticles,
    showAlert,
    highScore,
    handleRepairWeapon,
    handleRebuildWeapon,
    handleRepairTowers,
    handleUpgradeTank,
  ]);

  // Autosave progress every 15s while playing, and once more when the tab/window closes.
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => saveProgress(), 15000);
    const onUnload = () => saveProgress();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [gameState, saveProgress]);

  const startGame = () => {
    clearSavedProgress();
    initDoorsAndWorld();
    engineRef.current.lastTime = performance.now();
    engineRef.current.airdropTimer = 180000;
    engineRef.current.bossTimer = 150000;
    engineRef.current.eliteGuards = [];
    engineRef.current.currentArenaId = null;
    engineRef.current.currentGateLevel = 1;
    engineRef.current.deaths = 0;
    setGameState('playing');
    startBgmMusic();
  };

  // Resume a saved run: rebuild the world, then overlay saved progress (base/tank/soldiers/atoms/wave/doors).
  const continueGame = () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      startGame();
      return;
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      startGame();
      return;
    }

    initDoorsAndWorld();
    const eng = engineRef.current;
    eng.lastTime = performance.now();
    eng.airdropTimer = 180000;
    eng.bossTimer = 150000;
    eng.eliteGuards = [];
    eng.currentArenaId = null;
    eng.currentGateLevel = 1;

    eng.deaths = data.deaths || 0;
    eng.wave = data.wave || 1;
    eng.kills = data.kills || 0;
    eng.atoms = data.atoms || 0;
    eng.bossesDefeated = data.bossesDefeated || 0;

    eng.base = createInitialBase();
    const targetLevel = data.baseLevel || 1;
    while (eng.base.level < targetLevel) {
      if (!upgradeBase(eng.base)) break;
    }

    if (data.tank) {
      eng.tank.owned = !!data.tank.owned;
      eng.tank.armorLevel = data.tank.armorLevel || 0;
      eng.tank.cannonLevel = data.tank.cannonLevel || 0;
      eng.tank.speedLevel = data.tank.speedLevel || 0;
      eng.tank.nanitesLevel = data.tank.nanitesLevel || 0;
      eng.tank.hp = eng.tank.hpMax;
    }

    eng.soldiers = Array.isArray(data.soldiers)
      ? data.soldiers.map((sd: any) => {
          const s = createSoldier(sd.type as SoldierType, eng.base.x, eng.base.y);
          for (let i = 1; i < (sd.level || 1); i++) upgradeSoldier(s);
          if (sd.isLegendaryHero && sd.assignedPowerId) {
            imbueSoldierWithPower(s, sd.assignedPowerId, sd.assignedPowerName, sd.assignedPowerColor, sd.assignedPowerIcon);
          }
          return s;
        })
      : [];

    eng.superpowers = createInitialSuperpowers();
    if (data.superpowers) {
      Object.entries(data.superpowers as Record<string, { unlocked: boolean; equipped: boolean }>).forEach(
        ([id, sp]) => {
          if (eng.superpowers[id]) {
            eng.superpowers[id].unlocked = !!sp.unlocked;
            eng.superpowers[id].equipped = !!sp.equipped;
          }
        }
      );
    }

    if (data.player) {
      eng.player.armorLevel = data.player.armorLevel || 0;
      eng.player.upgrades = { ...eng.player.upgrades, ...data.player.upgrades };
      eng.player.grenades = data.player.grenades ?? eng.player.grenades;
      eng.player.medkits = data.player.medkits ?? eng.player.medkits;
      eng.player.serums = data.player.serums ?? eng.player.serums;
    }
    eng.player.hp = eng.player.hpMax;
    eng.player.x = eng.base.x;
    eng.player.y = eng.base.y;

    if (Array.isArray(data.doors)) {
      data.doors.forEach((sd: any) => {
        const d = eng.doors.find((x) => x.index === sd.index);
        if (d) {
          d.unlocked = !!sd.unlocked;
          d.cleared = !!sd.cleared;
          d.eliteSpawned = !!sd.eliteSpawned;
          d.eliteDefeated = !!sd.eliteDefeated;
        }
      });
    }

    setGameState('playing');
    startBgmMusic();
  };

  const restartGame = () => {
    clearSavedProgress();
    engineRef.current.deaths = 0;
    engineRef.current.player = {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      r: 16,
      hp: 500,
      hpMax: 500,
      speed: 6.2,
      slots: [{ ...WEAPONS.pistol, dur: Infinity }, null, null, null],
      activeSlot: 0,
      melee: { ...MELEE_BASE },
      grenades: 2,
      medkits: 1,
      serums: 0,
      lastShot: 0,
      frozenUntil: 0,
      lastRegen: 0,
      dashLock: 0,
      dashVx: 0,
      dashVy: 0,
      dashLockedUntil: 0,
      onBoxId: null,
      onTowerId: null,
      elevation: 0,
      inCoverId: null,
      armorLevel: 0,
      upgrades: {
        speedBoost: 0,
        damageBoost: 0,
        rapidFire: 0,
        regenBoost: 0,
        magnetRadius: 0,
      },
    };
    engineRef.current.tank = {
      owned: false,
      mounted: false,
      x: WORLD_W / 2 + 120,
      y: WORLD_H / 2,
      hp: 10000,
      hpMax: 10000,
      r: 38,
      lastFire: 0,
      armorLevel: 0,
      cannonLevel: 0,
      speedLevel: 0,
      nanitesLevel: 0,
    };
    engineRef.current.boss = null;
    engineRef.current.zombies = [];
    engineRef.current.bullets = [];
    engineRef.current.particles = [];
    engineRef.current.floaters = [];
    engineRef.current.airdrops = [];
    engineRef.current.cracks = [];
    engineRef.current.bossOrbs = [];
    engineRef.current.decals = [];
    engineRef.current.boxes = [];
    engineRef.current.turrets = [];
    engineRef.current.shockwaves = [];
    engineRef.current.base = createInitialBase();
    engineRef.current.soldiers = [];
    engineRef.current.superpowers = createInitialSuperpowers();
    engineRef.current.eliteGuards = [];
    engineRef.current.currentArenaId = null;
    engineRef.current.currentGateLevel = 1;
    engineRef.current.wave = 1;
    engineRef.current.kills = 0;
    engineRef.current.atoms = 0;
    engineRef.current.bossesDefeated = 0;
    initDoorsAndWorld();
    setGameState('playing');
    startBgmMusic();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0d] text-white select-none">
      <canvas id="gameCanvas" ref={canvasRef} className="absolute inset-0 z-[1] w-full h-full" />
      <div className="scanlines" />
      <div id="vignette" className={engineRef.current.vignetteTimer > 0 ? 'show' : ''} />

      {/* Alert Banner */}
      <div
        id="alert-banner"
        className={`absolute top-[28%] left-1/2 -translate-x-1/2 z-40 transition-opacity duration-300 pointer-events-none ${
          engineRef.current.alertTimer > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <h2 className="font-display text-3xl md:text-5xl font-black text-[#ff4d5e] neon-text-red animate-blink uppercase tracking-widest text-center px-4">
          {engineRef.current.alertText}
        </h2>
      </div>

      {/* Tank mount / Door hints */}
      {hudState.tankNear && (
        <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 text-xs text-[#ffcf5c] bg-black/75 px-4 py-2 rounded-lg border border-[#ffcf5c]/40 z-30 pointer-events-none">
          Press <b>F</b> to mount the Assault Tank
        </div>
      )}
      {hudState.nearDoor && !hudState.hasBoss && (
        <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2 text-xs text-[#7ee787] bg-black/75 px-4 py-2 rounded-lg border border-[#7ee787]/40 z-30 pointer-events-none text-center">
          {hudState.nearDoor.index === 1 || (engineRef.current.doors[hudState.nearDoor.index - 2] && engineRef.current.doors[hudState.nearDoor.index - 2].cleared)
            ? `Press R — Unlock Door ${hudState.nearDoor.index} (${hudState.nearDoor.cost} ⚛)`
            : `Door ${hudState.nearDoor.index} is sealed — Clear Door ${hudState.nearDoor.index - 1} first`}
        </div>
      )}

      {/* In-Game HUD */}
      {gameState === 'playing' && (
        <GameHUD
          hudState={hudState}
          player={engineRef.current.player}
          superpowers={engineRef.current.superpowers}
          soldiers={engineRef.current.soldiers}
          base={engineRef.current.base}
          onOpenShop={() => setShopOpen(true)}
          onPerformMelee={performMelee}
          onSelectSlot={(idx) => {
            if (engineRef.current.player.slots[idx]) engineRef.current.player.activeSlot = idx;
          }}
          onThrowGrenade={throwGrenade}
          onUseConsumable={useConsumable}
          onActivateSuperpower={handleTriggerSuperpower}
          onPerformGroundSlam={performGroundSlam}
        />
      )}

      {/* Start Screen */}
      {gameState === 'start' && (
        <StartScreen
          highScore={highScore}
          hasSavedGame={hasSavedGame}
          onStart={startGame}
          onContinue={continueGame}
        />
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="screen-overlay">
          <h1 className="font-display text-6xl md:text-8xl font-black text-[#ff4d5e] neon-text-red mb-2">YOU DIED</h1>
          <h2 className="text-xl md:text-2xl text-[#ffcf5c] mb-2 font-bold">
            Wave Reached: {engineRef.current.wave} &nbsp;|&nbsp; Kills: {engineRef.current.kills} &nbsp;|&nbsp; Atoms: {engineRef.current.atoms}
          </h2>
          <p className="text-sm text-[#ff4d5e] mb-6 font-bold">
            Used all {MAX_DEATHS} respawns — saved progress has been cleared.
          </p>
          <button onClick={restartGame} className="btn-arcade">
            START FRESH RUN
          </button>
        </div>
      )}

      {/* Shop & Upgrades Modal */}
      {shopOpen && (
        <ShopModal
          atoms={hudState.atoms}
          player={engineRef.current.player}
          tank={engineRef.current.tank}
          turretCount={engineRef.current.turrets.length}
          base={engineRef.current.base}
          soldiers={engineRef.current.soldiers}
          superpowers={engineRef.current.superpowers}
          towers={engineRef.current.towers}
          bossesDefeated={engineRef.current.bossesDefeated}
          currentGateLevel={engineRef.current.currentGateLevel}
          onBuyItem={handleBuyShopItem}
          onUpgradeBase={handleUpgradeBase}
          onRecruitSoldier={handleRecruitSoldier}
          onUpgradeSoldier={handleUpgradeSoldier}
          onRepairWeapon={handleRepairWeapon}
          onRebuildWeapon={handleRebuildWeapon}
          onUpgradeTank={handleUpgradeTank}
          onRepairTowers={handleRepairTowers}
          onToggleEquipSkill={handleToggleEquipSkill}
          onClose={() => setShopOpen(false)}
        />
      )}
    </div>
  );
}
