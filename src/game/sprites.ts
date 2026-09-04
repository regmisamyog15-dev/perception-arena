// ============================================================================
// Sprite Engine — loads & draws the Craftpix boss / zombie / soldier sheets
// All sheets are horizontal strips of SQUARE frames (frameSize x frameSize).
// Frame count is derived at runtime from naturalWidth / frameSize, so no
// manifest bookkeeping is required.
// ============================================================================

export type BossSpriteSet = 'caveman' | 'goblin' | 'viking' | 'necromancer' | 'troll';
export type BossDir = 'front' | 'back' | 'left' | 'right';
export type BossAnim = 'idle' | 'walk' | 'attack';

const BOSS_FRAME = 160;
const ZOMBIE_FRAME = 96;
const SOLDIER_FRAME = 128;

const imgCache = new Map<string, HTMLImageElement>();

function getImg(path: string): HTMLImageElement {
  let img = imgCache.get(path);
  if (!img) {
    img = new Image();
    img.src = path;
    imgCache.set(path, img);
  }
  return img;
}

/** Call once at app start so sprites are already decoded by the time combat begins. */
export function preloadAllSprites() {
  const bossSets: BossSpriteSet[] = ['caveman', 'goblin', 'viking'];
  const dirs: BossDir[] = ['front', 'back', 'left', 'right'];
  const anims: BossAnim[] = ['idle', 'walk', 'attack'];
  for (const set of bossSets) {
    for (const dir of dirs) {
      for (const anim of anims) {
        getImg(`/sprites/bosses/${set}/${dir}_${anim}.png`);
      }
    }
  }
  for (const f of ['soul - Idle.png', 'Soul - walk.png', 'Soul - Attack.png']) {
    getImg(`/sprites/bosses/necromancer/${f}`);
  }
  for (const c of ['green', 'purple', 'blue', 'red']) {
    getImg(`/sprites/bosses/troll/${c}.png`);
  }
  for (const p of ['ground_overworld.png', 'decor_overworld.png', 'ground_arena.png', 'decor_arena.png']) {
    getImg(`/sprites/backgrounds/${p}`);
  }
  const zFolders = ['zombie_man', 'zombie_woman', 'wild_zombie'];
  const zAnims = ['Idle', 'Walk', 'Run', 'Attack_1', 'Hurt', 'Dead'];
  for (const f of zFolders) for (const a of zAnims) getImg(`/sprites/zombies/${f}/${a}.png`);

  const sFolders = ['Gangsters_1', 'Gangsters_2', 'Gangsters_3'];
  const sAnims = ['Idle', 'Walk', 'Run', 'Hurt', 'Dead'];
  for (const f of sFolders) for (const a of sAnims) getImg(`/sprites/soldiers/${f}/${a}.png`);
}

interface DrawOpts {
  flipX?: boolean;
  alpha?: number;
  filter?: string;
  anchorY?: number; // 0..1, fraction of destSize above the (x,y) anchor point
  rotate?: number;
}

/** Draws the correct animation frame of a strip sheet. Returns false if the image isn't decoded yet. */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  path: string,
  frameSize: number,
  fps: number,
  now: number,
  x: number,
  y: number,
  destSize: number,
  opts: DrawOpts = {}
): boolean {
  const img = getImg(path);
  if (!img.complete || img.naturalWidth === 0) return false;
  const frameCount = Math.max(1, Math.round(img.naturalWidth / frameSize));
  const frameIdx = Math.floor((now / (1000 / fps)) % frameCount);

  ctx.save();
  ctx.translate(x, y);
  if (opts.rotate) ctx.rotate(opts.rotate);
  if (opts.flipX) ctx.scale(-1, 1);
  if (opts.filter) ctx.filter = opts.filter;
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  const anchorY = opts.anchorY ?? 0.5;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    frameIdx * frameSize,
    0,
    frameSize,
    frameSize,
    -destSize / 2,
    -destSize * anchorY,
    destSize,
    destSize
  );
  ctx.restore();
  return true;
}

// ---------------------------------------------------------------------------
// Boss helpers
// ---------------------------------------------------------------------------

// 3 base character rigs cycle across the 10 gate bosses; a per-boss CSS hue
// filter (see BOSS_TINTS below) keeps each gate visually distinct.
export const BOSS_SPRITE_SETS: Record<string, BossSpriteSet> = {
  behemoth: 'caveman',
  warlock: 'necromancer',
  ironclad: 'viking',
  executioner: 'caveman',
  bouncer: 'troll',
  dj: 'viking',
  auntie: 'goblin',
  larry: 'necromancer',
  gary: 'troll',
  overlord: 'viking',
};

// Directional (4-way) rigs vs single-strip flip-only rigs (necromancer is a
// side-view "prototype" rig — same drawing path used for zombies/soldiers).
export const BOSS_FLIP_ONLY_SETS = new Set<BossSpriteSet>(['necromancer']);

// Static single-image rigs (no animation frames available) — animated only
// via procedural squash/lean/bob at draw time.
export const BOSS_STATIC_SETS = new Set<BossSpriteSet>(['troll']);
export const TROLL_COLOR_BY_BOSS: Record<string, string> = {
  bouncer: 'purple',
  gary: 'red',
};

// hue-rotate + saturate filter per boss so recolors feel distinct from the base rig
export const BOSS_TINTS: Record<string, string> = {
  behemoth: 'hue-rotate(0deg) saturate(1.3) brightness(0.95)',
  warlock: 'hue-rotate(70deg) saturate(1.4) brightness(0.9)',
  ironclad: 'hue-rotate(180deg) saturate(0.7) brightness(0.85)',
  executioner: 'hue-rotate(-30deg) saturate(1.6) brightness(1.1)',
  bouncer: 'hue-rotate(200deg) saturate(1.1) brightness(0.8)',
  dj: 'hue-rotate(30deg) saturate(1.8) brightness(1.05)',
  auntie: 'hue-rotate(-90deg) saturate(1.5) brightness(1.0)',
  larry: 'hue-rotate(260deg) saturate(1.3) brightness(0.95)',
  gary: 'hue-rotate(110deg) saturate(1.2) brightness(0.9)',
  overlord: 'hue-rotate(230deg) saturate(1.9) brightness(0.75) contrast(1.15)',
};

export function bossDirFromAngle(ang: number): BossDir {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  if (Math.abs(c) > Math.abs(s)) return c >= 0 ? 'right' : 'left';
  return s >= 0 ? 'front' : 'back';
}

export function bossSpritePath(bossKey: string, dir: BossDir, anim: BossAnim): string {
  const set = BOSS_SPRITE_SETS[bossKey] || 'caveman';
  return `/sprites/bosses/${set}/${dir}_${anim}.png`;
}

const NECRO_FRAME = 128;

export function drawBossSprite(
  ctx: CanvasRenderingContext2D,
  bossKey: string,
  facingAng: number,
  anim: BossAnim,
  now: number,
  destSize: number,
  opts: { alpha?: number; extraFilter?: string } = {}
): boolean {
  const set = BOSS_SPRITE_SETS[bossKey] || 'caveman';
  const tint = BOSS_TINTS[bossKey] || '';
  const filter = opts.extraFilter ? `${tint} ${opts.extraFilter}` : tint;

  if (BOSS_STATIC_SETS.has(set)) {
    const color = TROLL_COLOR_BY_BOSS[bossKey] || 'green';
    const path = `/sprites/bosses/troll/${color}.png`;
    const img = getImg(path);
    if (!img.complete || img.naturalWidth === 0) return false;
    const facingRight = Math.cos(facingAng) >= 0;
    // procedural "lean into the swing" during attack windups since there's no attack animation
    const lean = anim === 'attack' ? Math.sin(now / 90) * 0.12 : 0;
    ctx.save();
    ctx.rotate(lean);
    if (filter) ctx.filter = filter;
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (!facingRight) ctx.scale(-1, 1);
    ctx.drawImage(img, -destSize / 2, -destSize * 0.86, destSize, destSize);
    ctx.restore();
    return true;
  }

  if (BOSS_FLIP_ONLY_SETS.has(set)) {
    // necromancer rig: single side-view strip, flip on facing, no direction sheets
    const necroAnim = anim === 'attack' ? 'Soul - Attack' : anim === 'walk' ? 'Soul - walk' : 'soul - Idle';
    const path = `/sprites/bosses/necromancer/${necroAnim}.png`;
    const fps = anim === 'attack' ? 11 : anim === 'walk' ? 9 : 5;
    const facingRight = Math.cos(facingAng) >= 0;
    return drawSpriteFrame(ctx, path, NECRO_FRAME, fps, now, 0, 0, destSize, {
      filter,
      alpha: opts.alpha,
      flipX: !facingRight,
      anchorY: 0.82,
    });
  }

  const dir = bossDirFromAngle(facingAng);
  const path = bossSpritePath(bossKey, dir, anim);
  const fps = anim === 'attack' ? 11 : anim === 'walk' ? 9 : 5;
  return drawSpriteFrame(ctx, path, BOSS_FRAME, fps, now, 0, 0, destSize, {
    filter,
    alpha: opts.alpha,
    anchorY: 0.82,
  });
}

// ---------------------------------------------------------------------------
// Zombie helpers
// ---------------------------------------------------------------------------

export function zombieSpriteFolder(type: string): string {
  switch (type) {
    case 'runner':
      return 'zombie_woman';
    case 'ztank':
      return 'wild_zombie';
    default:
      return 'zombie_man'; // shambler, gunner, rpgz
  }
}

export function drawZombieSprite(
  ctx: CanvasRenderingContext2D,
  type: string,
  anim: 'Idle' | 'Walk' | 'Run' | 'Attack_1' | 'Hurt',
  facingRight: boolean,
  now: number,
  destSize: number,
  alpha = 1
): boolean {
  const folder = zombieSpriteFolder(type);
  const path = `/sprites/zombies/${folder}/${anim}.png`;
  const fps = anim === 'Attack_1' ? 12 : anim === 'Run' ? 10 : anim === 'Walk' ? 8 : 4;
  return drawSpriteFrame(ctx, path, ZOMBIE_FRAME, fps, now, 0, 0, destSize, {
    flipX: !facingRight,
    alpha,
    anchorY: 0.86,
  });
}

// ---------------------------------------------------------------------------
// Soldier helpers
// ---------------------------------------------------------------------------

export function soldierSpriteFolder(seatIdx: number): string {
  return ['Gangsters_1', 'Gangsters_2', 'Gangsters_3'][seatIdx % 3];
}

export function drawSoldierSprite(
  ctx: CanvasRenderingContext2D,
  seatIdx: number,
  anim: 'Idle' | 'Walk' | 'Run' | 'Hurt',
  facingRight: boolean,
  now: number,
  destSize: number,
  filter?: string
): boolean {
  const folder = soldierSpriteFolder(seatIdx);
  const path = `/sprites/soldiers/${folder}/${anim}.png`;
  const fps = anim === 'Run' ? 10 : anim === 'Walk' ? 8 : 4;
  return drawSpriteFrame(ctx, path, SOLDIER_FRAME, fps, now, 0, 0, destSize, {
    flipX: !facingRight,
    filter,
    anchorY: 0.86,
  });
}
