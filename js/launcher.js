// Launcher: aiming, current/next ball queue, reload, and drawing.
import { radiusFor, colorFor } from './balls.js';

export class Launcher {
  constructor(game) {
    this.game = game;
    this.x = 0;
    this.y = 0;
    this.angle = -Math.PI / 2; // pointing straight up by default
    this.queue = [];           // [current, next, next2, ...]
    this.reloadT = 0;          // ms remaining until next shot allowed
    this.barrelLen = 34;
  }

  resize(w, h) {
    this.x = w / 2;
    this.y = h - 42;
  }

  // Value pool widens as the "starting value" upgrade is purchased.
  randomValue() {
    const boost = this.game.upgrades.startValue.level;
    const pool = [2, 2, 4]; // 2 is a bit more common than 4
    if (boost >= 1) pool.push(8);
    if (boost >= 2) pool.push(8, 16);
    if (boost >= 3) pool.push(32);
    return pool[Math.floor(this.game.rand() * pool.length)];
  }

  previewCount() {
    // 1 upcoming ball by default, +1 per preview upgrade level.
    return 1 + this.game.upgrades.preview.level;
  }

  refillQueue() {
    const want = 1 + this.previewCount();
    while (this.queue.length < want) this.queue.push(this.randomValue());
    // Trim if preview level was somehow reduced (not expected, but safe).
    if (this.queue.length > want) this.queue.length = want;
  }

  reset() {
    this.queue = [];
    this.reloadT = 0;
    this.angle = -Math.PI / 2;
    this.refillQueue();
  }

  reloadMs() {
    const lvl = this.game.upgrades.reload.level;
    return Math.max(140, 620 - lvl * 90);
  }

  aimAt(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    let a = Math.atan2(dy, dx);
    // Clamp so the player can only aim upward (into the arena), within a wide cone.
    const min = -Math.PI + 0.28; // just past horizontal-left
    const max = -0.28;           // just past horizontal-right
    if (a > 0) a = a < Math.PI / 2 ? max : min; // pointer below launcher -> clamp to nearest side
    a = Math.max(min, Math.min(max, a));
    this.angle = a;
  }

  canShoot() {
    return this.reloadT <= 0 && !this.game.frozenHardStop;
  }

  // Fire the current ball. Returns {value, angle, speed} or null.
  shoot() {
    if (!this.canShoot()) return null;
    const value = this.queue.shift();
    this.refillQueue();
    this.reloadT = this.reloadMs();
    return { value, angle: this.angle, speed: 15 };
  }

  update(dt) {
    if (this.reloadT > 0) this.reloadT -= dt;
    if (this.queue.length === 0) this.refillQueue();
  }

  // ---- Rendering ----
  draw(ctx) {
    const current = this.queue[0];
    const r = radiusFor(current);

    // Aim line (dashed trajectory) — only when ready to shoot.
    this.drawAim(ctx, r);

    // Barrel
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2b355a';
    ctx.strokeStyle = '#46527f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -12, this.barrelLen + 8, 24, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Base plate
    ctx.save();
    ctx.fillStyle = '#242e4d';
    ctx.strokeStyle = '#3a4570';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 6, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Current ball in the launcher
    const ready = this.reloadT <= 0;
    this.drawBall(ctx, this.x, this.y, current, ready ? 1 : 0.55);

    // Reload ring
    if (!ready) {
      const p = 1 - this.reloadT / this.reloadMs();
      ctx.save();
      ctx.strokeStyle = 'rgba(79,209,197,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 6, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Next-ball preview slots
    this.drawPreview(ctx);
  }

  drawAim(ctx, r) {
    const ready = this.reloadT <= 0;
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ready ? 'rgba(232,236,246,0.55)' : 'rgba(232,236,246,0.2)';
    const len = Math.min(this.game.h, 460);
    const sx = this.x + Math.cos(this.angle) * (r + 6);
    const sy = this.y + Math.sin(this.angle) * (r + 6);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(this.angle) * len, sy + Math.sin(this.angle) * len);
    ctx.stroke();
    ctx.setLineDash([]);
    // aim dot
    ctx.fillStyle = ready ? 'rgba(79,209,197,0.9)' : 'rgba(79,209,197,0.3)';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(this.angle) * len, sy + Math.sin(this.angle) * len, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPreview(ctx) {
    const slots = this.previewCount();
    const startX = this.x + 60;
    let px = startX;
    const py = this.y;
    ctx.save();
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#8a95b5';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', startX - 4, py - 20);
    for (let i = 1; i <= slots && i < this.queue.length; i++) {
      const v = this.queue[i];
      this.drawBall(ctx, px, py, v, 0.85, 0.7);
      px += 30;
    }
    ctx.restore();
  }

  drawBall(ctx, x, y, value, alpha = 1, scale = 1) {
    const r = radiusFor(value) * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    const c = colorFor(value);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, c);
    grad.addColorStop(1, shade(c, -18));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    // number
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0b1020';
    ctx.font = `700 ${Math.max(10, r * 0.85)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y + 1);
    ctx.restore();
  }
}

// Darken/lighten an hsl() color string by a lightness delta.
function shade(hsl, delta) {
  const m = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (!m) return hsl;
  const h = +m[1], s = +m[2], l = Math.max(0, Math.min(100, +m[3] + delta));
  return `hsl(${h}, ${s}%, ${l}%)`;
}
