import { Boss, BossClone, BossOrb, Phase3State } from '../types/game';
import { drawBossSprite } from './sprites';
import { METEOR_BLAST_R, COMBO_STEPS } from './constants';

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cracks in the dimension: jagged rays from the point where the boss woke, with light leaking out. */
function drawDimensionCracks(ctx: CanvasRenderingContext2D, p3: Phase3State, boss: Boss, now: number) {
  const open = Math.min(1, (now - (boss.finalStandAt || now)) / 3000); // opens up over ~3s
  const ox = p3.crackX;
  const oy = p3.crackY;
  const pulse = 0.6 + 0.4 * Math.sin(now / 380);

  // Light spilling out of the break
  const gr = 120 + 260 * open;
  const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, gr);
  glow.addColorStop(0, `rgba(255, 244, 214, ${0.35 * pulse * open})`);
  glow.addColorStop(0.5, `rgba(185, 139, 255, ${0.16 * open})`);
  glow.addColorStop(1, 'rgba(185, 139, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ox, oy, gr, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rays = 11;
  const segs = 6;
  const reach = 950;
  for (let i = 0; i < rays; i++) {
    const rng = mulberry32(p3.crackSeed + i * 977);
    let a = (i / rays) * TAU + (rng() - 0.5) * 0.35;
    let x = ox;
    let y = oy;
    const pts: Array<[number, number]> = [[x, y]];
    for (let s = 0; s < segs; s++) {
      a += (rng() - 0.5) * 0.7;
      const l = (reach / segs) * (0.7 + rng() * 0.6);
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      pts.push([x, y]);
    }
    const shown = open * segs;
    const full = Math.floor(shown);
    const frac = shown - full;
    const path = new Path2D();
    path.moveTo(pts[0][0], pts[0][1]);
    for (let s = 1; s <= Math.min(full, segs); s++) path.lineTo(pts[s][0], pts[s][1]);
    if (full < segs) {
      const p0 = pts[full];
      const p1 = pts[full + 1];
      path.lineTo(p0[0] + (p1[0] - p0[0]) * frac, p0[1] + (p1[1] - p0[1]) * frac);
    }
    ctx.strokeStyle = `rgba(185, 139, 255, ${0.22 * pulse})`;
    ctx.lineWidth = 14;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(255, 244, 214, ${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke(path);
  }
  ctx.restore();
}

function drawCraters(ctx: CanvasRenderingContext2D, p3: Phase3State, now: number) {
  for (const c of p3.craters) {
    const f = Math.max(0, c.life / c.maxLife);
    const a = Math.min(1, f * 3);
    // The dent in the ground
    const dent = ctx.createRadialGradient(c.x, c.y, c.r * 0.15, c.x, c.y, c.r * 1.15);
    dent.addColorStop(0, `rgba(12, 8, 6, ${0.9 * a})`);
    dent.addColorStop(0.7, `rgba(40, 24, 16, ${0.75 * a})`);
    dent.addColorStop(1, 'rgba(40, 24, 16, 0)');
    ctx.fillStyle = dent;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.15, 0, TAU);
    ctx.fill();
    // Glowing rim marks the danger edge
    ctx.strokeStyle = `rgba(255, 110, 40, ${(0.5 + 0.2 * Math.sin(now / 200 + c.x)) * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, TAU);
    ctx.stroke();
    // A few glowing fissures inside
    const rng = mulberry32(Math.floor(c.x * 31 + c.y * 17));
    ctx.strokeStyle = `rgba(255, 150, 60, ${0.55 * a})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const ang = rng() * TAU;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(ang) * c.r * 0.2, c.y + Math.sin(ang) * c.r * 0.2);
      ctx.lineTo(c.x + Math.cos(ang + 0.2) * c.r * 0.9, c.y + Math.sin(ang + 0.2) * c.r * 0.9);
      ctx.stroke();
    }
  }
}

/** Under the entities: cracks in the dimension, then craters. */
export function drawPhase3Ground(ctx: CanvasRenderingContext2D, p3: Phase3State, boss: Boss | null, now: number) {
  if (boss && boss.finalStand) drawDimensionCracks(ctx, p3, boss, now);
  drawCraters(ctx, p3, now);
}

/** Doctor-Strange-style spell circle: rotating dashed rings + counter-rotating square, orange. */
function drawSigil(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ff9a3c';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.rotate(now / 700);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(-now / 350);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, TAU);
  ctx.stroke();
  const s = r * 0.72;
  ctx.strokeRect(-s / 1.414, -s / 1.414, s * 1.414, s * 1.414);
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-s / 1.414, -s / 1.414, s * 1.414, s * 1.414);
  ctx.restore();
}

function drawEchoes(ctx: CanvasRenderingContext2D, p3: Phase3State, boss: Boss | null, now: number) {
  for (const e of p3.echoes) {
    const tele = e.state === 'telegraph';
    drawSigil(ctx, e.x, e.y, e.r + 22, now, tele ? 0.9 : 0.4);
    if (tele) {
      // aim line so the volley direction is readable
      ctx.save();
      ctx.strokeStyle = 'rgba(255,154,60,0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.ang) * 170, e.y + Math.sin(e.ang) * 170);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    const drawn = boss
      ? drawBossSprite(ctx, boss.skin.key, e.ang, 'walk', now, e.r * 3.4, { alpha: tele ? 0.55 : 0.8, extraFilter: 'hue-rotate(-25deg) saturate(1.5) brightness(1.15)' })
      : false;
    if (!drawn) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRusherLane(ctx: CanvasRenderingContext2D, c: BossClone, now: number) {
  if (c.act !== 'windup') return;
  const a = c.actAng || 0;
  ctx.save();
  ctx.strokeStyle = `rgba(201, 201, 255, ${0.5 + 0.4 * Math.sin(now / 50)})`;
  ctx.lineWidth = c.r * 1.2;
  ctx.globalAlpha = 0.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x + Math.cos(a) * 300, c.y + Math.sin(a) * 300);
  ctx.stroke();
  ctx.restore();
}

export function drawClones(ctx: CanvasRenderingContext2D, p3: Phase3State, now: number, boss: Boss | null = null) {
  drawEchoes(ctx, p3, boss, now);
  for (const c of p3.clones) {
    if (c.state !== 'absorbing') drawSigil(ctx, c.x, c.y + c.r * 0.6, c.r + 26, now, 0.6 * c.alpha);
    drawRusherLane(ctx, c, now);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.globalAlpha = 0.28 * c.alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, c.r * 0.8, c.r * 0.9, c.r * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const dest = c.r * 3.6 * c.squash;
    const drawn = drawBossSprite(ctx, c.skinKey, c.facingAng, c.state === 'chasing' ? 'walk' : 'idle', now, dest, {
      alpha: c.alpha,
      extraFilter: 'hue-rotate(45deg) saturate(1.15) brightness(1.05)',
    });
    if (!drawn) {
      ctx.globalAlpha = 0.8 * c.alpha;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, TAU);
      ctx.fill();
    }
    // Ghostly aura so clones read as phantoms
    ctx.strokeStyle = `rgba(190, 170, 255, ${0.55 * c.alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, c.r + 6 + Math.sin(now / 160) * 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDizzyStars(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number) {
  ctx.save();
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 8;
  for (let i = 0; i < 3; i++) {
    const a = now / 260 + (i * TAU) / 3;
    ctx.fillText('✦', x + Math.cos(a) * r * 0.65, y - r * 1.05 + Math.sin(a) * 9);
  }
  ctx.restore();
}

function drawMeter(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, meter: number, max: number, dizzy: boolean) {
  const w = 76;
  const h = 7;
  const bx = x - w / 2;
  const by = y - r - 34;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = dizzy ? '#ffe066' : '#b98bff';
  ctx.fillRect(bx, by, w * Math.min(1, meter / max), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 0.5, by - 0.5, w + 1, h + 1);
  ctx.restore();
}

/** Above the entities: meteors (falling + ground reticle), break meters, dizzy stars, flash overlay. */
export function drawPhase3Top(
  ctx: CanvasRenderingContext2D,
  p3: Phase3State,
  boss: Boss | null,
  now: number,
  camX: number,
  camY: number,
  cw: number,
  ch: number
) {
  // Meteors
  for (const m of p3.meteors) {
    const k = Math.min(1, m.t / m.fallMs);
    // Ground reticle tightens as it comes down
    ctx.fillStyle = `rgba(255, 80, 20, ${0.1 + 0.18 * k})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, METEOR_BLAST_R * (0.55 + 0.45 * k), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 140, 40, ${0.4 + 0.55 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, METEOR_BLAST_R * (1.1 - 0.5 * k), 0, TAU);
    ctx.stroke();
    // The meteor itself, streaking in diagonally
    const mx = m.x - 170 * (1 - k);
    const my = m.y - 520 * (1 - k);
    const tail = ctx.createLinearGradient(mx, my, mx - 170 * 0.45, my - 520 * 0.45);
    tail.addColorStop(0, 'rgba(255, 190, 90, 0.85)');
    tail.addColorStop(1, 'rgba(255, 90, 20, 0)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - 170 * 0.45, my - 520 * 0.45);
    ctx.stroke();
    const body = ctx.createRadialGradient(mx, my, 2, mx, my, 24);
    body.addColorStop(0, '#fff7d6');
    body.addColorStop(0.5, '#ff9a3c');
    body.addColorStop(1, '#7a2a10');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, TAU);
    ctx.fill();
  }

  if (boss && boss.splitActive) {
    // Break meters + dizzy stars for all three bodies
    const bm = boss.splitMeter || 0;
    const bmax = boss.splitMeterMax || 1;
    drawMeter(ctx, boss.x, boss.y - boss.height, boss.r, bm, bmax, !!boss.splitDizzy);
    if (boss.splitDizzy) drawDizzyStars(ctx, boss.x, boss.y - boss.height, boss.r, now);
    for (const c of p3.clones) {
      if (c.state === 'absorbing') continue;
      drawMeter(ctx, c.x, c.y, c.r, c.meter, c.meterMax, c.state === 'dizzy');
      if (c.state === 'dizzy') drawDizzyStars(ctx, c.x, c.y, c.r, now);
    }
  }

  // Soft light flash from the breaking dimension (kept gentle on purpose)
  if (p3.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 244, 214, ${Math.min(0.22, p3.flash * 0.22)})`;
    ctx.fillRect(camX - 80, camY - 80, cw + 160, ch + 160);
  }
}

/** Aim line for the weapon throw telegraph. */
export function drawThrowAim(ctx: CanvasRenderingContext2D, boss: Boss, now: number) {
  if (boss.state !== 'throwWindup') return;
  const a = boss.targetAng || 0;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 207, 92, ${0.45 + 0.35 * Math.sin(now / 60)})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(boss.x, boss.y - boss.height);
  ctx.lineTo(boss.x + Math.cos(a) * 900, boss.y - boss.height + Math.sin(a) * 900);
  ctx.stroke();
  ctx.restore();
}

/** Missile / thrown weapon. Returns true if drawn (caller skips the default orb art). */
export function drawSpecialOrb(ctx: CanvasRenderingContext2D, o: BossOrb, now: number): boolean {
  if (o.kind === 'charge' || o.kind === 'void') {
    // Purple void orb: swells while charging over the boss's head, then flies at the player
    const pulse = 1 + Math.sin(now / 90) * 0.08;
    const r = o.r * pulse;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.shadowColor = '#c77dff';
    ctx.shadowBlur = 26;
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#f3d9ff');
    g.addColorStop(0.45, '#b04dff');
    g.addColorStop(1, 'rgba(70, 10, 120, 0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(230, 180, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.rotate(now / 300);
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (o.hp < o.hpMax || o.kind === 'charge') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(o.x - 26, o.y - r - 18, 52, 6);
      ctx.fillStyle = '#c77dff';
      ctx.fillRect(o.x - 26, o.y - r - 18, 52 * Math.max(0, o.hp / o.hpMax), 6);
    }
    if (o.kind === 'charge') {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f3d9ff';
      ctx.fillText('SHOOT IT!', o.x, o.y - r - 26);
      ctx.restore();
    }
    return true;
  }
  if (o.kind === 'missile') {
    const ang = Math.atan2(o.vy, o.vx);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(ang);
    // exhaust flame
    const fl = 26 + Math.random() * 12;
    const fg = ctx.createLinearGradient(-fl - 14, 0, -10, 0);
    fg.addColorStop(0, 'rgba(255, 90, 20, 0)');
    fg.addColorStop(1, 'rgba(255, 210, 90, 0.95)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.lineTo(-fl - 14, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    // glowing yellow body
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(12, -8);
    ctx.lineTo(12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a4a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (o.hp < o.hpMax) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(o.x - 20, o.y - 30, 40, 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(o.x - 20, o.y - 30, 40 * Math.max(0, o.hp / o.hpMax), 5);
    }
    return true;
  }
  if (o.kind === 'throw') {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.spin || now / 40);
    ctx.shadowColor = '#ff4d5e';
    ctx.shadowBlur = 14;
    // handle
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    // double crescent blades
    ctx.fillStyle = '#cfd3da';
    ctx.strokeStyle = '#6f757c';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 22, -4);
      ctx.quadraticCurveTo(side * 44, -30, side * 12, -30);
      ctx.quadraticCurveTo(side * 30, -14, side * 22, -4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }
  return false;
}

/** Chain pull telegraph + the combo's cone/ring warning. */
export function drawBossMeleeFx(ctx: CanvasRenderingContext2D, boss: Boss, player: { x: number; y: number }, now: number) {
  if (boss.state === 'pullWindup' || boss.state === 'pulling') {
    const x1 = boss.x;
    const y1 = boss.y - boss.height;
    const taut = boss.state === 'pulling';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ff4d5e';
    ctx.shadowBlur = taut ? 16 : 8;
    ctx.strokeStyle = taut ? '#e5e7eb' : `rgba(229,231,235,${0.45 + 0.35 * Math.sin(now / 55)})`;
    ctx.lineWidth = taut ? 7 : 5;
    ctx.setLineDash([14, 7]);
    ctx.lineDashOffset = -(now / 18);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 9 + Math.sin(now / 70) * 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (boss.state === 'comboWindup') {
    const step = COMBO_STEPS[boss.comboStep || 0];
    const a = boss.comboAng || 0;
    const prog = 1 - Math.max(0, Math.min(1, boss.stateTimer / step.windup));
    const rad = boss.r + step.reach;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const heavy = step.arc >= TAU;
    ctx.fillStyle = heavy ? `rgba(255, 60, 60, ${0.12 + 0.28 * prog})` : `rgba(255, 140, 40, ${0.12 + 0.3 * prog})`;
    ctx.strokeStyle = heavy ? 'rgba(255, 90, 90, 0.9)' : 'rgba(255, 170, 70, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (heavy) {
      ctx.arc(0, 0, rad, 0, TAU);
    } else {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rad, a - step.arc / 2, a + step.arc / 2);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Button prompt: which key answers this swing
    const unparryable = step.arc >= TAU;
    const keys = unparryable ? [['SHIFT', 'DODGE!', '#ff6b6b']] : [['X', 'PARRY', '#ffd166'], ['SHIFT', 'DODGE', '#83d3e1']];
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const blink = prog > 0.55 ? 1 : 0.65; // brightens near the moment to react
    ctx.globalAlpha = blink;
    let px = boss.x - ((keys.length - 1) * 62) / 2;
    const py = boss.y - boss.r - 46 - boss.height;
    for (const [key, label, color] of keys) {
      const w = key === 'SHIFT' ? 52 : 28;
      ctx.fillStyle = 'rgba(15,15,25,0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - w / 2, py - 12, w, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(key, px, py);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(label, px, py + 22);
      ctx.font = 'bold 13px sans-serif';
      px += 62;
    }
    ctx.restore();
  }
}
