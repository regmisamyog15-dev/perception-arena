import {
  Tower,
  CoverObstacle,
  Boss,
  Zombie,
  PlayerState,
  Tank,
  Bullet,
  Particle,
  Floater,
  Airdrop,
  Crack,
  Decal,
  Box,
  Turret,
  Door,
  Shockwave,
  BaseState,
  Soldier,
  Superpower,
  EliteGuard,
} from '../types/game';
import { WORLD_W, WORLD_H } from './constants';
import { drawBossSprite, drawZombieSprite, drawSoldierSprite } from './sprites';

const bgImgCache = new Map<string, HTMLImageElement>();
function getBgImg(path: string): HTMLImageElement {
  let img = bgImgCache.get(path);
  if (!img) {
    img = new Image();
    img.src = path;
    bgImgCache.set(path, img);
  }
  return img;
}
const bgPatternCache = new Map<string, CanvasPattern | null>();
function getPattern(ctx: CanvasRenderingContext2D, key: string, img: HTMLImageElement): CanvasPattern | null {
  let pat = bgPatternCache.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(img, 'repeat');
    bgPatternCache.set(key, pat);
  }
  return pat;
}

export function renderGameScene(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  camX: number,
  camY: number,
  screenShake: number,
  player: PlayerState,
  tank: Tank,
  boss: Boss | null,
  zombies: Zombie[],
  bullets: Bullet[],
  particles: Particle[],
  floaters: Floater[],
  airdrops: Airdrop[],
  cracks: Crack[],
  decals: Decal[],
  boxes: Box[],
  turrets: Turret[],
  doors: Door[],
  towers: Tower[],
  covers: CoverObstacle[],
  shockwaves: Shockwave[],
  mouse: { x: number; y: number },
  base: BaseState,
  soldiers: Soldier[],
  superpowers: Record<string, Superpower>,
  eliteGuards?: EliteGuard[],
  currentArenaId?: number | null,
  beaconEjectTimer?: number
) {
  ctx.clearRect(0, 0, cw, ch);

  ctx.save();
  const shakeX = (Math.random() - 0.5) * screenShake;
  const shakeY = (Math.random() - 0.5) * screenShake;
  ctx.translate(-camX + shakeX, -camY + shakeY);

  // Tiled forest ground (real texture instead of a flat fill) — pattern is
  // built once and cached on first draw, then just repeated every frame.
  const groundPath = currentArenaId ? '/sprites/backgrounds/ground_arena.png' : '/sprites/backgrounds/ground_overworld.png';
  const decorPath = currentArenaId ? '/sprites/backgrounds/decor_arena.png' : '/sprites/backgrounds/decor_overworld.png';
  const groundImg = getBgImg(groundPath);
  const decorImg = getBgImg(decorPath);
  const viewX0 = camX - 200;
  const viewY0 = camY - 200;
  const viewW = cw + 400;
  const viewH = ch + 400;
  if (groundImg.complete && groundImg.naturalWidth > 0) {
    const pat = getPattern(ctx, groundPath, groundImg);
    if (pat) {
      ctx.save();
      ctx.fillStyle = pat as unknown as string;
      ctx.fillRect(viewX0, viewY0, viewW, viewH);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = currentArenaId ? '#1a1410' : '#0f1a12';
    ctx.fillRect(viewX0, viewY0, viewW, viewH);
  }
  if (decorImg.complete && decorImg.naturalWidth > 0) {
    const pat2 = getPattern(ctx, decorPath, decorImg);
    if (pat2) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pat2 as unknown as string;
      ctx.fillRect(viewX0, viewY0, viewW, viewH);
      ctx.restore();
    }
  }

  // Arena Grid
  ctx.strokeStyle = currentArenaId ? 'rgba(255, 100, 50, 0.08)' : 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 120;
  const startX = Math.floor(camX / gridSize) * gridSize;
  const startY = Math.floor(camY / gridSize) * gridSize;
  ctx.beginPath();
  for (let x = startX; x < camX + cw + gridSize; x += gridSize) {
    ctx.moveTo(x, camY);
    ctx.lineTo(x, camY + ch);
  }
  for (let y = startY; y < camY + ch + gridSize; y += gridSize) {
    ctx.moveTo(camX, y);
    ctx.lineTo(camX + cw, y);
  }
  ctx.stroke();

  // Arena Realm Boundary Walls (100x100 arena pace)
  if (currentArenaId) {
    const door = doors.find(d => d.index === currentArenaId);
    if (door) {
      ctx.save();
      const ax = door.arenaX;
      const ay = door.arenaY;
      const aw = door.arenaW || 2600;
      const ah = door.arenaH || 2600;

      // Arena glow perimeter
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#ff4d5e';
      ctx.shadowBlur = 25;
      ctx.strokeRect(ax - aw / 2, ay - ah / 2, aw, ah);
      ctx.shadowBlur = 0;

      // Floor sigil in center of arena
      ctx.strokeStyle = 'rgba(255, 77, 94, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax, ay, 400, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ax, ay, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Beacon eject danger zone — glows red when player is on it
      const ejectPct = Math.min(1, (beaconEjectTimer || 0) / 5000);
      const ejectAlpha = 0.18 + ejectPct * 0.55;
      const ejectColor = ejectPct > 0.5 ? `rgba(255, 50, 50, ${ejectAlpha})` : `rgba(255, 200, 80, ${ejectAlpha})`;
      ctx.fillStyle = ejectColor;
      ctx.beginPath();
      ctx.arc(ax, ay, 80, 0, Math.PI * 2);
      ctx.fill();
      // Danger icon and countdown
      ctx.fillStyle = ejectPct > 0.5 ? '#ff4d5e' : '#ffd166';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ BEACON — EJECT ZONE', ax, ay + 110);
      if (ejectPct > 0) {
        const secsLeft = Math.ceil((5000 - (beaconEjectTimer || 0)) / 1000);
        ctx.fillStyle = '#ff4d5e';
        ctx.font = `bold ${16 + Math.floor(ejectPct * 8)}px "JetBrains Mono"`;
        ctx.fillText(`EJECT IN ${secsLeft}s`, ax, ay + 130);
      }
      // Progress arc around beacon
      if (ejectPct > 0) {
        ctx.strokeStyle = '#ff4d5e';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff4d5e';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ax, ay, 84, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ejectPct);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Competitive arena cover pillars — 4 diagonal pillars players can dodge behind
      const pillarPositions = [
        { x: ax - 500, y: ay - 500 },
        { x: ax + 500, y: ay - 500 },
        { x: ax - 500, y: ay + 500 },
        { x: ax + 500, y: ay + 500 },
      ];
      for (const pp of pillarPositions) {
        ctx.fillStyle = '#3a3a4a';
        ctx.strokeStyle = '#5a5a7a';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#5a5a7a';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.rect(pp.x - 35, pp.y - 35, 70, 70);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        // stone texture hint
        ctx.fillStyle = 'rgba(90,90,120,0.3)';
        ctx.fillRect(pp.x - 30, pp.y - 30, 28, 28);
        ctx.fillRect(pp.x + 2, pp.y + 2, 28, 28);
      }

      // Mid-range side barriers (2 horizontal cover walls)
      const sideBarriers = [
        { x: ax - 700, y: ay, w: 140, h: 30 },
        { x: ax + 700, y: ay, w: 140, h: 30 },
        { x: ax, y: ay - 700, w: 30, h: 140 },
        { x: ax, y: ay + 700, w: 30, h: 140 },
      ];
      for (const sb of sideBarriers) {
        ctx.fillStyle = '#2a3a2a';
        ctx.strokeStyle = '#4a6a4a';
        ctx.lineWidth = 2;
        ctx.fillRect(sb.x - sb.w / 2, sb.y - sb.h / 2, sb.w, sb.h);
        ctx.strokeRect(sb.x - sb.w / 2, sb.y - sb.h / 2, sb.w, sb.h);
      }

      // Exit Portal back to Main Base
      ctx.fillStyle = '#83d3e1';
      ctx.shadowColor = '#83d3e1';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(ax, ay + ah / 2 - 120, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('PORTAL', ax, ay + ah / 2 - 116);
      ctx.fillStyle = '#83d3e1';
      ctx.font = 'bold 11px "JetBrains Mono"';
      ctx.fillText('⬅ RETURN TO OVERWORLD', ax, ay + ah / 2 - 75);

      ctx.restore();
    }
  }

  // Floor Decals & Blood Splatters
  for (const d of decals) {
    const alpha = Math.max(0, d.life / d.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#4a0e17';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b050a';
    ctx.beginPath();
    ctx.arc(d.x + d.r * 0.2, d.y + d.r * 0.15, d.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----------------------------------------------------
  // TACTICAL MILITARY COMMAND BASTION & SANCTUARY (Level 1-4)
  // ----------------------------------------------------
  if (base) {
    ctx.save();
    ctx.translate(base.x, base.y);

    const rad = base.safeRadius;

    // 1. Reinforced Military Base Floor (Alloy Tiles & Hazard Trim)
    ctx.fillStyle = base.level >= 4 ? '#181528' : base.level === 3 ? '#161d2a' : '#171c24';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    // High-tech circular grid floor lines
    ctx.strokeStyle = base.beaconColor;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 2;
    for (let rStep = 60; rStep < rad; rStep += 60) {
      ctx.beginPath();
      ctx.arc(0, 0, rStep, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 2. Central Command Post Terminal Desk
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-50, -40, 100, 80);
    ctx.strokeStyle = base.beaconColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-50, -40, 100, 80);

    // Glowing Hologram Core
    const holoPulse = Math.sin(performance.now() / 250) * 4;
    ctx.fillStyle = base.beaconColor;
    ctx.shadowColor = base.beaconColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + holoPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 10px "JetBrains Mono"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('COMMAND HUB', 0, -22);

    // 3. Gun Repair & Rebuild Workbench Station Box (Left side of Base)
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-rad + 50, -35, 75, 70);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.strokeRect(-rad + 50, -35, 75, 70);
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillText('🔧 REPAIR BOX', -rad + 87, -18);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '8px "JetBrains Mono"';
    ctx.fillText('GUN WORKBENCH', -rad + 87, 0);
    ctx.fillText('PRESS [B] SHOP', -rad + 87, 14);

    // 4.5 Floating Flexing Power Stand (South area of Base)
    const standTime = performance.now() * 0.002;
    const standFloatY = Math.sin(standTime) * 6;
    ctx.save();
    ctx.translate(0, 48);

    // Pedestal Base
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, 16, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Energy Conduit Rays
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-28, 16);
    ctx.lineTo(-14, -10 + standFloatY);
    ctx.moveTo(28, 16);
    ctx.lineTo(14, -10 + standFloatY);
    ctx.stroke();

    // Floating Levitation Core
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(0, -12 + standFloatY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Power Glyphs / Rings
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -12 + standFloatY, 20, 8, standTime, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Power Stand Title
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillStyle = '#c084fc';
    ctx.fillText('⚡ POWER STAND', 0, -32 + standFloatY);
    ctx.fillStyle = '#e9d5ff';
    ctx.font = '8px "JetBrains Mono"';
    ctx.fillText('ACTIVE (MAX 2)', 0, 30);
    ctx.restore();

    // 5. Pulsing Forcefield Energy Barrier
    const pulseOffset = Math.sin(base.pulseTimer / 300) * 5;
    ctx.strokeStyle = base.beaconColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = base.beaconColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, base.safeRadius + pulseOffset, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([14, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, base.safeRadius - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Header Text & Level Banner
    ctx.font = 'bold 13px "JetBrains Mono"';
    ctx.fillStyle = base.beaconColor;
    ctx.textAlign = 'center';
    ctx.fillText(`🛡️ FORWARD OPERATING BASTION [LEVEL ${base.level}]`, 0, -rad - 22);

    ctx.font = '10px "JetBrains Mono"';
    ctx.fillStyle = '#7ee787';
    ctx.fillText(`⚡ SAFE HAVEN • +${base.healingRate} HP/s BIOREGEN • SQUAD: ${soldiers.length}/${base.maxSoldiers} SOLDIERS`, 0, -rad - 8);

    // Base Defensive Tesla / Plasma Coil Emplacements
    if (base.turrets > 0) {
      for (let t = 0; t < base.turrets; t++) {
        const tAng = (t / base.turrets) * Math.PI * 2 + (performance.now() * 0.0004);
        const tx = Math.cos(tAng) * (rad - 18);
        const ty = Math.sin(tAng) * (rad - 18);

        ctx.fillStyle = '#1c222b';
        ctx.beginPath();
        ctx.arc(tx, ty, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = base.beaconColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = base.beaconColor;
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Cover Obstacles & Concrete Bunkers
  for (const cov of covers) {
    ctx.save();
    ctx.translate(cov.x, cov.y);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-cov.w / 2 + 6, -cov.h / 2 + 8, cov.w, cov.h);

    if (cov.type === 'bunker') {
      ctx.fillStyle = '#22252c';
      ctx.fillRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);
      ctx.strokeStyle = '#4a5260';
      ctx.lineWidth = 3;
      ctx.strokeRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);

      ctx.fillStyle = '#0f1115';
      ctx.fillRect(-cov.w / 2 + 15, -cov.h / 2 + 10, cov.w - 30, cov.h - 20);
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillStyle = '#7ee787';
      ctx.textAlign = 'center';
      ctx.fillText('FORTIFIED BUNKER', 0, 4);
    } else if (cov.type === 'concrete') {
      ctx.fillStyle = '#3a3e47';
      ctx.fillRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);
      ctx.strokeStyle = '#636b78';
      ctx.lineWidth = 2;
      ctx.strokeRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);
    } else {
      ctx.fillStyle = '#5a492f';
      ctx.fillRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);
      ctx.strokeStyle = '#856e48';
      ctx.lineWidth = 2;
      ctx.strokeRect(-cov.w / 2, -cov.h / 2, cov.w, cov.h);
      ctx.fillStyle = '#bfa16b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SANDBAGS', 0, 4);
    }
    ctx.restore();
  }

  // Sniper Watchtowers (High Ground, 1000 HP, Destroyed/Repair State)
  for (const tw of towers) {
    ctx.save();
    const shakeOffsetX = (tw.shakeTime && tw.shakeTime > 0) ? (Math.random() - 0.5) * 6 : 0;
    const shakeOffsetY = (tw.shakeTime && tw.shakeTime > 0) ? (Math.random() - 0.5) * 6 : 0;
    ctx.translate(tw.x + shakeOffsetX, tw.y + shakeOffsetY);

    if (tw.destroyed) {
      // Destroyed Ruins & Rebuild Countdown
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-tw.w / 2, -tw.h / 2, tw.w, tw.h);

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.strokeRect(-tw.w / 2 + 10, -tw.h / 2 + 10, tw.w - 20, tw.h - 20);

      ctx.strokeStyle = 'rgba(255, 205, 92, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(-tw.w / 2 - 5, -tw.h / 2 - 5, tw.w + 10, tw.h + 10);
      ctx.setLineDash([]);

      const remSec = Math.ceil(tw.repairTimer / 1000);
      const min = Math.floor(remSec / 60);
      const sec = remSec % 60;
      const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;

      ctx.font = 'bold 12px "JetBrains Mono"';
      ctx.fillStyle = '#ff4d5e';
      ctx.textAlign = 'center';
      ctx.fillText(`💥 ${tw.name} DESTROYED`, 0, -tw.h / 2 - 14);

      ctx.fillStyle = '#ffcf5c';
      ctx.fillText(`REBUILDING: ${timeStr}`, 0, 0);

      const pct = 1 - (tw.repairTimer / tw.repairDuration);
      ctx.fillStyle = '#111';
      ctx.fillRect(-40, 14, 80, 6);
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(-40, 14, 80 * pct, 6);
    } else {
      // Active Tower Platform
      const isPlayerOn = player.onTowerId === tw.id;

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(-tw.w / 2 + 16, -tw.h / 2 + 20, tw.w, tw.h);

      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 8;
      ctx.strokeRect(-tw.w / 2, -tw.h / 2, tw.w, tw.h);

      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-tw.w / 2, -tw.h / 2);
      ctx.lineTo(tw.w / 2, tw.h / 2);
      ctx.moveTo(tw.w / 2, -tw.h / 2);
      ctx.lineTo(-tw.w / 2, tw.h / 2);
      ctx.stroke();

      ctx.fillStyle = isPlayerOn ? '#1a365d' : '#171923';
      ctx.fillRect(-tw.w / 2 + 10, -tw.h / 2 + 10, tw.w - 20, tw.h - 20);
      ctx.strokeStyle = isPlayerOn ? '#83d3e1' : '#4a5568';
      ctx.lineWidth = 3;
      ctx.strokeRect(-tw.w / 2 + 10, -tw.h / 2 + 10, tw.w - 20, tw.h - 20);

      ctx.strokeStyle = isPlayerOn ? '#63b3ed' : '#718096';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-tw.w / 2 + 18, -tw.h / 2 + 18, tw.w - 36, tw.h - 36);

      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-15, tw.h / 2 - 12, 30, 8);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, tw.h / 2 - 12, 30, 8);

      ctx.font = 'bold 11px "JetBrains Mono"';
      ctx.fillStyle = isPlayerOn ? '#83d3e1' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(`🗼 ${tw.name}`, 0, -tw.h / 2 - 16);

      const hpPct = Math.max(0, tw.hp / tw.hpMax);
      ctx.fillStyle = '#0a0a0d';
      ctx.fillRect(-45, -tw.h / 2 - 10, 90, 6);
      ctx.fillStyle = hpPct > 0.4 ? '#83d3e1' : '#ff4d5e';
      ctx.fillRect(-45, -tw.h / 2 - 10, 90 * hpPct, 6);
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 1;
      ctx.strokeRect(-45, -tw.h / 2 - 10, 90, 6);

      if (isPlayerOn) {
        ctx.fillStyle = '#ffd166';
        ctx.font = '10px "JetBrains Mono"';
        ctx.fillText('⚡ HIGH GROUND SNIPER DECK', 0, 4);
      }
    }
    ctx.restore();
  }

  // Border Doors
  for (const d of doors) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = d.cleared ? '#7ee787' : d.unlocked ? '#ffcf5c' : '#3a2a2c';
    ctx.strokeStyle = d.cleared ? '#0c2' : '#000';
    ctx.lineWidth = 3;
    ctx.fillRect(-22, -34, 44, 68);
    ctx.strokeRect(-22, -34, 44, 68);
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.cleared ? '✅' : d.unlocked ? '⚔️' : '🔒', 0, 8);
    ctx.font = 'bold 12px "JetBrains Mono"';
    ctx.fillStyle = '#fff';
    ctx.fillText(`#${d.index}`, 0, -42);
    if (!d.unlocked) {
      ctx.fillStyle = '#ffcf5c';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText(`${d.cost} ⚛`, 0, 46);
    }
    ctx.restore();
  }

  // Expanding Shockwaves
  for (const sw of shockwaves) {
    const alpha = Math.max(0, 1 - sw.r / sw.maxR);
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 6 * alpha;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cracks
  for (const c of cracks) {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 30 + Math.sin(performance.now() / 100) * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Boxes
  for (const bx of boxes) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(bx.x, bx.y + bx.r * 0.8, bx.r, bx.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = player.onBoxId === bx.id ? '#5a4326' : '#3a2c18';
    ctx.fillRect(bx.x - bx.r, bx.y - bx.r * 0.6, bx.r * 2, bx.r * 1.2);
    ctx.strokeStyle = '#83d3e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx.x - bx.r, bx.y - bx.r * 0.6, bx.r * 2, bx.r * 1.2);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx.x - bx.r, bx.y - bx.r * 0.6 - 8, bx.r * 2, 5);
    ctx.fillStyle = '#83d3e1';
    ctx.fillRect(bx.x - bx.r, bx.y - bx.r * 0.6 - 8, bx.r * 2 * (bx.hp / bx.hpMax), 5);
  }

  // Turrets
  for (const t of turrets) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 14, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2f38';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#83d3e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(t.x, t.y);
    const barrelAng = t.targetAng !== undefined ? t.targetAng : performance.now() / 800;
    ctx.rotate(barrelAng);
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(0, -3.5, 20, 7);
    ctx.strokeStyle = '#83d3e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -3.5, 20, 7);
    ctx.fillStyle = '#83d3e1';
    ctx.fillRect(18, -4, 4, 8);
    ctx.restore();

    ctx.fillStyle = '#000';
    ctx.fillRect(t.x - 16, t.y - 24, 32, 4);
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(t.x - 16, t.y - 24, 32 * (t.hp / t.hpMax), 4);
  }

  // Parked Tank
  if (tank.owned && tank.hp > 0 && !tank.mounted) {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath();
    ctx.ellipse(0, tank.r * 0.7, tank.r, tank.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a5d3f';
    ctx.fillRect(-tank.r, -tank.r * 0.6, tank.r * 2, tank.r * 1.2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(-tank.r, -tank.r * 0.6, tank.r * 2, tank.r * 1.2);
    ctx.fillStyle = '#2f3a26';
    ctx.fillRect(-14, -14, 28, 28);
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tank.r + 10, 0);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
  }

  // Airdrops
  for (const a of airdrops) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 25, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const drawY = a.y - (a.z || 0);
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(a.x - 20, drawY - 20, 40, 40);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x - 20, drawY - 20, 40, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📦', a.x, drawY);
  }

  // Zombies with Animated Walking & Hit Flinch
  for (const z of zombies) {
    const zAng = z.isAggro
      ? Math.atan2(player.y - z.y, player.x - z.x)
      : z.wanderAngle || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(z.x, z.y + z.r * 0.9, z.r * 0.9, z.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const nowMs = performance.now();
    const isHitFlinch = z.lastHit && nowMs - z.lastHit < 120;
    const distToPlayer = Math.hypot(player.x - z.x, player.y - z.y);
    const isAttacking = z.kind !== 'ranged' && distToPlayer < z.r + player.r + 24;
    const facingRight = Math.cos(zAng) >= 0;
    const moving = z.isAggro && (z.speed || 0) > 0;
    const spriteAnim: 'Idle' | 'Walk' | 'Run' | 'Attack_1' | 'Hurt' = isHitFlinch
      ? 'Hurt'
      : isAttacking
      ? 'Attack_1'
      : moving
      ? (z.speed > 2.6 ? 'Run' : 'Walk')
      : 'Idle';

    ctx.save();
    ctx.translate(z.x, z.y);
    const destSize = z.r * 3.1;
    const ok = drawZombieSprite(ctx, z.type, spriteAnim, facingRight, nowMs, destSize);
    if (!ok) {
      // Fallback while the sprite sheet is still decoding
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.arc(0, 0, z.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isHitFlinch) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,60,60,0.55)';
      ctx.fillRect(-destSize / 2, -destSize, destSize, destSize);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // Zombie HP bar
    ctx.fillStyle = '#000';
    ctx.fillRect(z.x - z.r, z.y - z.r - 8, z.r * 2, 4);
    ctx.fillStyle = '#ff4d5e';
    ctx.fillRect(z.x - z.r, z.y - z.r - 8, (z.r * 2) * Math.max(0, z.hp / z.hpMax), 4);
  }

  // ----------------------------------------------------
  // ELITE GATEKEEPER GUARDS (Summoned before Gate Keys)
  // ----------------------------------------------------
  if (eliteGuards) {
    for (const eg of eliteGuards) {
      if (eg.dead) continue;

      ctx.save();
      ctx.translate(eg.x, eg.y);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath();
      ctx.ellipse(0, eg.r * 0.9, eg.r * 1.1, eg.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Energy Shield Bubble
      if (eg.shieldHp > 0) {
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#00f5d4';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, eg.r + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Elite Body
      const eAng = Math.atan2(player.y - eg.y, player.x - eg.x);
      ctx.rotate(eAng);

      ctx.fillStyle = eg.color;
      ctx.beginPath();
      ctx.arc(0, 0, eg.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Heavy Plasma Cannon Weapon
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(eg.r * 0.6, -6, 26, 12);
      ctx.strokeStyle = eg.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(eg.r * 0.6, -6, 26, 12);

      ctx.restore();

      // Elite Name & Title Badge
      ctx.font = 'bold 11px "JetBrains Mono"';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️ ${eg.name} [GATE #${eg.doorIndex} GUARD]`, eg.x, eg.y - eg.r - 20);

      // Shield & Health Bars
      const barW = eg.r * 2.4;
      if (eg.shieldHp > 0) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(eg.x - barW / 2, eg.y - eg.r - 16, barW, 4);
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(eg.x - barW / 2, eg.y - eg.r - 16, barW * (eg.shieldHp / eg.shieldMax), 4);
      }

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(eg.x - barW / 2, eg.y - eg.r - 10, barW, 6);
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(eg.x - barW / 2, eg.y - eg.r - 10, barW * (eg.hp / eg.hpMax), 6);
    }
  }

  // ----------------------------------------------------
  // SQUAD SOLDIERS (Up to 7 Soldiers with Superpowers)
  // ----------------------------------------------------
  for (const s of soldiers) {
    if (s.isDead) {
      // Knocked Down / Respawning State
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💀', 0, 5);

      const remSec = Math.ceil(s.respawnTimer / 1000);
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.fillStyle = '#ff4d5e';
      ctx.fillText(`REVIVING (${remSec}s)`, 0, -18);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(s.x, s.y);

    // Ground Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Superpower Hero Radiant Aura
    if (s.isLegendaryHero || s.hasSuperpower) {
      const auraPulse = Math.sin(performance.now() / 200) * 4;
      const auraColor = s.isLegendaryHero ? (s.assignedPowerColor || '#ffd166') : s.color;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = s.isLegendaryHero ? 3.5 : s.level === 3 ? 3 : 2;
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = s.isLegendaryHero ? 20 : 14;
      ctx.beginPath();
      ctx.arc(0, 0, (s.isLegendaryHero ? 23 : 19) + auraPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Soldier Body Orientation
    const facingRight = Math.cos(s.targetAng || 0) >= 0;
    const soldierSeatIdx = soldiers.indexOf(s);
    const soldierAnim: 'Idle' | 'Walk' | 'Run' | 'Hurt' = (s.hp < s.hpMax * 0.97 && performance.now() - ((s as any).lastHit || 0) < 200)
      ? 'Hurt'
      : ((s as any).isMoving ? 'Walk' : 'Idle');
    const soldierFilter = s.isLegendaryHero
      ? `drop-shadow(0 0 6px ${s.assignedPowerColor || '#ffd166'})`
      : undefined;
    const soldierOk = drawSoldierSprite(ctx, soldierSeatIdx, soldierAnim, facingRight, performance.now(), 46, soldierFilter);

    if (!soldierOk) {
      ctx.rotate(s.targetAng || 0);
      // Legs
      ctx.strokeStyle = '#1a1f2c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(-4, 12);
      ctx.moveTo(4, 3);
      ctx.lineTo(4, 12);
      ctx.stroke();

      // Torso (Color Coded by Role or Legendary Element)
      ctx.fillStyle = s.isLegendaryHero ? (s.assignedPowerColor || '#ffd166') : s.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.isLegendaryHero ? '#ffd166' : '#000';
      ctx.lineWidth = s.isLegendaryHero ? 2 : 1.5;
      ctx.stroke();

      // Gun / Weapon Arm
      ctx.strokeStyle = s.isLegendaryHero ? (s.assignedPowerColor || '#ffd166') : s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(16, 2);
      ctx.stroke();

      ctx.fillStyle = '#111';
      ctx.fillRect(10, -2, 12, 5);

      // Head
      ctx.fillStyle = '#ffdfba';
      ctx.beginPath();
      ctx.arc(4, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();

    // Name & Rank Badge Above Head
    const rankStars = s.level === 3 ? '★★★' : s.level === 2 ? '★★' : '★';
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.fillStyle = s.isLegendaryHero ? '#ffd166' : s.level === 3 ? '#ffd166' : s.color;
    ctx.textAlign = 'center';
    const tagText = s.isLegendaryHero 
      ? `👑 ${s.assignedPowerIcon || '⚡'} ${s.name} [${s.assignedPowerName || 'LEGEND'}] ${rankStars}`
      : `${s.icon} ${s.name} ${rankStars}`;
    ctx.fillText(tagText, s.x, s.y - 20);

    // Soldier HP Bar
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 16, s.y - 14, 32, 4);
    ctx.fillStyle = s.isLegendaryHero ? (s.assignedPowerColor || '#ffd166') : s.hasSuperpower ? s.color : '#7ee787';
    ctx.fillRect(s.x - 16, s.y - 14, 32 * Math.max(0, s.hp / s.hpMax), 4);
  }

  // Boss Rendering
  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y - boss.height);

    // Enrage Aura & Flames
    if (boss.enraged) {
      const auraR = boss.r + 20 + Math.sin(performance.now() / 100) * 8;
      ctx.strokeStyle = 'rgba(255, 60, 40, 0.7)';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Laser Sweep Beam
    if (boss.state === 'laserSweep' && boss.laserAng !== undefined) {
      ctx.save();
      ctx.strokeStyle = '#ff2200';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(boss.laserAng) * 900, Math.sin(boss.laserAng) * 900);
      ctx.stroke();
      ctx.restore();
    }

    // Boss Body — animated sprite (falls back to the ellipse blob while decoding)
    const bossNow = performance.now();
    const attackStates = new Set([
      'chargeWindup', 'charging', 'anticipate', 'rising', 'airborne', 'landing',
      'solarWindup', 'solarBeam', 'laserWindup', 'laserSweep', 'fireballWindup',
      'spinWindup', 'spinning', 'teleportOut', 'teleportStrike', 'summonWindup', 'roar',
    ]);
    const bossAnim: 'idle' | 'walk' | 'attack' = attackStates.has(boss.state)
      ? 'attack'
      : boss.state === 'chasing'
      ? 'walk'
      : 'idle';
    const bossDestSize = boss.r * 3.6 * boss.squash;
    const spriteOk = drawBossSprite(ctx, boss.skin.key, boss.facingAng, bossAnim, bossNow, bossDestSize, {
      alpha: boss.state === 'teleportOut' ? Math.max(0.15, boss.squash) : 1,
    });

    if (!spriteOk) {
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, boss.r * boss.squash, boss.r / boss.squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Player OR Tank
  if (tank.mounted) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath();
    ctx.ellipse(0, tank.r * 0.7, tank.r, tank.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a5d3f';
    ctx.fillRect(-tank.r, -tank.r * 0.6, tank.r * 2, tank.r * 1.2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(-tank.r, -tank.r * 0.6, tank.r * 2, tank.r * 1.2);
    const tAng = Math.atan2(mouse.y + camY - player.y, mouse.x + camX - player.x);
    ctx.rotate(tAng);
    ctx.fillStyle = '#2f3a26';
    ctx.fillRect(-14, -14, 28, 28);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tank.r + 14, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x - 30, player.y - tank.r - 14, 60, 6);
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(player.x - 30, player.y - tank.r - 14, 60 * (tank.hp / tank.hpMax), 6);
  } else {
    // High Ground Elevation Shadow
    const elev = player.elevation || 0;
    ctx.fillStyle = `rgba(0,0,0,${elev > 0 ? 0.4 : 0.6})`;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.r * 0.9 + elev * 0.3, player.r * (elev > 0 ? 0.7 : 0.9), player.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Divine Aegis Superpower Shield Visual
    const aegis = superpowers?.divine_aegis;
    if (aegis && aegis.activeUntil > performance.now()) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(player.x, player.y - elev, player.r + 18, 0, Math.PI * 2);
      ctx.stroke();

      // Hexagonal rotating shield
      ctx.rotate(performance.now() * 0.002);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(player.x, player.y - elev, player.r + 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x, player.y - elev);
    const pAng = Math.atan2(mouse.y + camY - (player.y - elev), mouse.x + camX - player.x);
    const bodyTint = player.onTowerId
      ? '#90e0ef'
      : player.onBoxId
        ? '#ffd166'
        : player.inCoverId
          ? '#7ee787'
          : '#83d3e1';
    const armorTint = ['#83d3e1', '#8fdcc9', '#a0e0a0', '#e0d17e', '#e0a06a', '#ffcf5c'][player.armorLevel] || bodyTint;

    // Legs
    ctx.strokeStyle = '#1c2b30';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-6, player.r * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(6, player.r * 0.9);
    ctx.stroke();
    ctx.rotate(pAng);

    // Torso
    ctx.fillStyle = bodyTint;
    ctx.shadowBlur = 12;
    ctx.shadowColor = bodyTint;
    ctx.beginPath();
    ctx.ellipse(0, 0, player.r * 0.85, player.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0c1a1e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Armor Overlay
    if (player.armorLevel > 0) {
      ctx.strokeStyle = armorTint;
      ctx.lineWidth = 3 + player.armorLevel * 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, player.r * 0.6, player.r * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Arm + Weapon with Recoil Animation
    const recoilDecay = Math.max(0, 1 - (performance.now() - player.lastShot) / 140);
    const recoilOffset = recoilDecay * 5;

    ctx.strokeStyle = bodyTint;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(player.r * 1.3 - recoilOffset, 4);
    ctx.stroke();

    // Gun Barrel
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(player.r * 0.85 - recoilOffset, -3, player.r * 0.95, 8);
    ctx.strokeStyle = '#3a424e';
    ctx.lineWidth = 1;
    ctx.strokeRect(player.r * 0.85 - recoilOffset, -3, player.r * 0.95, 8);

    // Head
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath();
    ctx.arc(player.r * 0.3, -player.r * 0.55, player.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Laser Sight Beam when in Sniper High Ground
    if (elev > 0) {
      ctx.strokeStyle = 'rgba(131, 211, 225, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(player.r * 1.8, 4);
      ctx.lineTo(player.r * 1.8 + 600, 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----------------------------------------------------
  // SOLAR FLARE ORBITAL DEATH RAY (Superpower Active Beam)
  // ----------------------------------------------------
  const orbital = superpowers?.orbital_beam;
  if (orbital && orbital.activeUntil > performance.now()) {
    const targetX = mouse.x + camX;
    const targetY = mouse.y + camY;
    const beamRadius = 130 + (orbital.level - 1) * 30;

    ctx.save();
    // Core pillar
    const beamGrad = ctx.createRadialGradient(targetX, targetY, 10, targetX, targetY, beamRadius);
    beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    beamGrad.addColorStop(0.3, 'rgba(255, 207, 92, 0.85)');
    beamGrad.addColorStop(0.7, 'rgba(255, 77, 94, 0.5)');
    beamGrad.addColorStop(1, 'rgba(255, 77, 94, 0)');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.arc(targetX, targetY, beamRadius, 0, Math.PI * 2);
    ctx.fill();

    // Vertical Searing Pillar
    ctx.fillStyle = 'rgba(255, 220, 120, 0.4)';
    ctx.fillRect(targetX - 25, targetY - 1400, 50, 1400);

    // Glowing target reticle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(targetX, targetY, beamRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Bullets with Glowing Tracers & Effects
  for (const b of bullets) {
    if (b.cls === 'grenade') {
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (b.cls === 'zfireball') {
      ctx.fillStyle = '#7ee787';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#7ee787';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (b.cls === 'tankmissile' || b.cls === 'rocket') {
      ctx.save();
      const ang = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);

      ctx.fillStyle = '#ffcf5c';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = b.cls === 'tankmissile' ? '#5a6b8a' : '#ff4d5e';
      ctx.fillRect(-6, -3, 14, 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(14, 0);
      ctx.lineTo(8, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (b.cls === 'zombiebullet') {
      ctx.fillStyle = b.isRpg ? '#ff8c42' : '#ff6b81';
      ctx.shadowBlur = b.isRpg ? 14 : 8;
      ctx.shadowColor = ctx.fillStyle;

      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = b.isRpg ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.isRpg ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (b.cls === 'turretbullet') {
      ctx.strokeStyle = '#83d3e1';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#83d3e1';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 1.8, b.y - b.vy * 1.8);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 1.8, b.y - b.vy * 1.8);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Particles (Muzzle flashes, Casings, Melee Slashes, Sparks)
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    if (p.isMuzzleFlash) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang || 0);
      ctx.fillStyle = '#fffae0';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 16;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const r = (p.r || 14) * (0.8 + 0.4 * alpha);
      ctx.moveTo(r, 0);
      ctx.lineTo(r * 0.25, r * 0.25);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.25, r * 0.25);
      ctx.lineTo(-r, 0);
      ctx.lineTo(-r * 0.25, -r * 0.25);
      ctx.lineTo(0, -r);
      ctx.lineTo(r * 0.25, -r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.isCasing) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = '#ffd166';
      ctx.globalAlpha = alpha;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.strokeStyle = '#bfa140';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-3, -1.5, 6, 3);
      ctx.restore();
    } else if (p.isArc && p.ang !== undefined && p.r !== undefined) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, p.ang - 0.7, p.ang + 0.7);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, p.ang - 0.5, p.ang + 0.5);
      ctx.stroke();
      ctx.restore();
    } else if (p.isFlash) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r || 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r || 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Floater Texts
  for (const f of floaters) {
    ctx.font = `bold ${f.size}px "JetBrains Mono"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mouse.x - 12, mouse.y);
  ctx.lineTo(mouse.x + 12, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 12);
  ctx.lineTo(mouse.x, mouse.y + 12);
  ctx.stroke();
}
