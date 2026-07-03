// Number Cascade — a 2048-style shoot-and-merge arcade game.
// Orchestrates physics, rendering, input, scoring, upgrades, and power-ups.
import { createPhysics } from './physics.js';
import { createBall, radiusFor, colorFor } from './balls.js';
import { Launcher } from './launcher.js';
import { UI } from './ui.js';
import { PowerupManager } from './powerups.js';
import { Audio } from './audio.js';

const { World, Body, Composite } = Matter;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.wrap = document.getElementById('arena-wrap');

    this.physics = createPhysics();
    this.engine = this.physics.engine;
    this.world = this.physics.world;

    this.audio = Audio;
    this.launcher = new Launcher(this);
    this.ui = new UI(this);
    this.powerups = new PowerupManager(this);

    this.rand = () => Math.random();

    // Persisted best score.
    this.best = parseInt(localStorage.getItem('nc_best') || '0', 10) || 0;

    this.state = 'menu'; // menu | playing | over
    this.frozenHardStop = false;

    this.particles = [];
    this.shakeAmt = 0;
    this.flashMsg = '';
    this.flashUntil = 0;
    this.nowMs = 0;
    this.lastFrame = 0;

    this.comboStep = 1;
    this.lastMergeAt = -9999;

    this.upgrades = this.freshUpgrades();

    this.resetStats();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    Audio.setMuted(localStorage.getItem('nc_muted') === '1');
    this.ui.setMuteIcon(Audio.isMuted());

    this.ui.updateHUD();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  freshUpgrades() {
    return {
      startValue: {
        emoji: '🎲', name: 'Higher Start', desc: 'Adds bigger balls to the launch pool',
        level: 0, maxLevel: 3, cost: (l) => [30, 80, 180][l],
      },
      reload: {
        emoji: '⚡', name: 'Fast Reload', desc: 'Shorter cooldown between shots',
        level: 0, maxLevel: 4, cost: (l) => 25 + l * 35,
      },
      preview: {
        emoji: '👁️', name: 'Extra Preview', desc: 'See one more upcoming ball',
        level: 0, maxLevel: 2, cost: (l) => [60, 150][l],
      },
    };
  }

  resetStats() {
    this.score = 0;
    this.coins = 0;
    this.highestTile = 2;
    this.comboStep = 1;
    this.lastMergeAt = -9999;
  }

  // ---------- Sizing ----------
  resize() {
    const rect = this.wrap.getBoundingClientRect();
    this.w = Math.max(240, rect.width);
    this.h = Math.max(320, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.physics.buildWalls(this.w, this.h);
    this.launcher.resize(this.w, this.h);
    this.dangerY = Math.max(64, this.h * 0.13);
  }

  // ---------- Input ----------
  bindInput() {
    const aim = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const p = pointFromEvent(e, rect);
      if (p) this.launcher.aimAt(p.x, p.y);
    };
    this.canvas.addEventListener('pointermove', aim);
    this.canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      aim(e);
      if (this.state === 'playing') this.fire();
    });
    // Keyboard convenience: space to shoot.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.state === 'playing') { e.preventDefault(); this.fire(); }
    });
  }

  // ---------- Game flow ----------
  start() {
    // Clear all balls.
    for (const b of this.physics.getBalls()) World.remove(this.world, b);
    this.particles = [];
    this.resetStats();
    this.upgrades = this.freshUpgrades();
    this.launcher.reset();
    this.powerups.reset();
    this.shakeAmt = 0;
    this.flashMsg = '';
    this.state = 'playing';
    this.ui.showOverlay(null);
    this.ui.showCombo(1);
    this.ui.updateHUD();
    Audio.unlock();
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.audio.gameover();
    this.shake(18);
    this.ui.showGameOver();
  }

  openShop() {
    if (this.state !== 'playing') return;
    this.ui.renderShop();
    this.ui.showOverlay('shop');
  }
  closeShop() {
    if (this.state === 'playing') this.ui.showOverlay(null);
  }

  toggleMute() {
    const m = !Audio.isMuted();
    Audio.setMuted(m);
    localStorage.setItem('nc_muted', m ? '1' : '0');
    this.ui.setMuteIcon(m);
  }

  buyUpgrade(key) {
    const u = this.upgrades[key];
    if (u.level >= u.maxLevel) return;
    const cost = u.cost(u.level);
    if (this.coins < cost) return;
    this.coins -= cost;
    u.level++;
    if (key === 'preview') this.launcher.refillQueue();
    this.audio.buy();
    this.ui.updateHUD();
    this.ui.renderShop();
  }

  // ---------- Shooting ----------
  fire() {
    const shot = this.launcher.shoot();
    if (!shot) return;
    const armed = this.powerups.consumeArmed();
    const tipx = this.launcher.x + Math.cos(shot.angle) * (this.launcher.barrelLen + 8);
    const tipy = this.launcher.y + Math.sin(shot.angle) * (this.launcher.barrelLen + 8);
    const spreads = armed === 'scatter' ? [-0.26, 0, 0.26] : [0];
    for (const off of spreads) {
      const a = shot.angle + off;
      const b = createBall(shot.value, tipx, tipy);
      b.popT = 0.4;
      Body.setVelocity(b, { x: Math.cos(a) * shot.speed, y: Math.sin(a) * shot.speed });
      World.add(this.world, b);
    }
    this.audio.shoot();
  }

  addScore(n) {
    this.score += n;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('nc_best', String(this.best));
    }
  }

  // ---------- Merging ----------
  mergePass() {
    const balls = this.physics.getBalls();
    const pairs = [];
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.merging) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.merging || a.value !== b.value) continue;
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const d = Math.hypot(dx, dy);
        // Merge when the two circles are touching/overlapping.
        if (d <= a.radius + b.radius + 1.5) {
          a.merging = true;
          b.merging = true;
          pairs.push([a, b]);
          break; // a is consumed; stop pairing it
        }
      }
    }
    for (const [a, b] of pairs) this.doMerge(a, b);
  }

  doMerge(a, b) {
    const value = a.value;
    const nv = value * 2;
    const mx = (a.position.x + b.position.x) / 2;
    const my = (a.position.y + b.position.y) / 2;
    const vel = {
      x: (a.velocity.x + b.velocity.x) / 2,
      y: (a.velocity.y + b.velocity.y) / 2,
    };
    World.remove(this.world, a);
    World.remove(this.world, b);

    const nb = createBall(nv, mx, my);
    nb.popT = 1;
    Body.setVelocity(nb, vel);
    World.add(this.world, nb);

    // Combo: rapid successive merges chain into a multiplier.
    if (this.nowMs - this.lastMergeAt < 750) this.comboStep++;
    else this.comboStep = 1;
    this.lastMergeAt = this.nowMs;
    const mult = this.comboStep;

    this.addScore(nv * mult);
    this.coins += Math.max(1, Math.floor(Math.log2(nv)) - 1);
    this.highestTile = Math.max(this.highestTile, nv);

    const burst = 8 + Math.min(16, Math.floor(Math.log2(nv)) * 2);
    this.spawnParticles(mx, my, value, burst);
    this.ui.showCombo(mult);
    this.ui.updateHUD();

    if (nv >= 256) {
      this.shake(6 + Math.log2(nv));
      this.audio.bigMerge();
      this.flash(nv + '!');
    } else {
      this.shake(2 + this.comboStep * 0.6);
      this.audio.merge(this.comboStep);
    }
    if (mult >= 3) this.flash('Combo x' + mult + '!');

    this.powerups.onMerge(this.comboStep);
  }

  // ---------- Danger / game over ----------
  checkDanger(dtMs) {
    // Pause the danger clock while gravity is frozen (fair play).
    if (this.powerups.isFrozen(this.nowMs)) return;
    for (const b of this.physics.getBalls()) {
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      const slow = speed < 0.7;
      const high = b.position.y - b.radius * 0.35 < this.dangerY;
      if (high && slow) {
        if (b.aboveDangerSince == null) b.aboveDangerSince = this.nowMs;
        else if (this.nowMs - b.aboveDangerSince > 2000) { this.gameOver(); return; }
      } else {
        b.aboveDangerSince = null;
      }
    }
  }

  // ---------- Particles & juice ----------
  spawnParticles(x, y, value, count) {
    const color = colorFor(value * 2);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color,
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  shake(amt) { this.shakeAmt = Math.min(24, Math.max(this.shakeAmt, amt)); }
  flash(msg) { this.flashMsg = msg; this.flashUntil = this.nowMs + 900; }

  // ---------- Main loop ----------
  loop(ts) {
    if (!this.lastFrame) this.lastFrame = ts;
    let dt = ts - this.lastFrame;
    this.lastFrame = ts;
    if (dt > 50) dt = 50; // clamp after tab-switch stalls
    this.nowMs = ts;

    if (this.state === 'playing') {
      // Fixed physics step for stability.
      Matter.Engine.update(this.engine, 1000 / 60);
      this.mergePass();
      this.launcher.update(dt);
      this.powerups.update(dt, this.nowMs);
      this.checkDanger(dt);

      // Reset combo display after an idle gap.
      if (this.comboStep > 1 && this.nowMs - this.lastMergeAt > 900) {
        this.comboStep = 1;
        this.ui.showCombo(1);
      }
    }

    this.updateParticles();
    this.updatePops(dt);
    if (this.shakeAmt > 0) this.shakeAmt *= 0.86;
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;

    this.render();
    requestAnimationFrame(this.loop);
  }

  updatePops(dt) {
    for (const b of this.physics.getBalls()) {
      if (b.popT > 0) {
        b.popT -= dt / 200;
        if (b.popT < 0) b.popT = 0;
      }
    }
  }

  // ---------- Rendering ----------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    ctx.save();
    if (this.shakeAmt > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shakeAmt,
        (Math.random() - 0.5) * this.shakeAmt
      );
    }

    this.drawDangerLine(ctx);
    this.drawBalls(ctx);
    this.drawParticles(ctx);

    if (this.state === 'playing' || this.state === 'over') {
      this.launcher.draw(ctx);
    }

    this.drawFlash(ctx);
    ctx.restore();
  }

  drawDangerLine(ctx) {
    const y = this.dangerY;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,90,90,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    // subtle glow band above the line
    const grad = ctx.createLinearGradient(0, 0, 0, y);
    grad.addColorStop(0, 'rgba(255,90,90,0.12)');
    grad.addColorStop(1, 'rgba(255,90,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, y);
    ctx.restore();
  }

  drawBalls(ctx) {
    for (const b of this.physics.getBalls()) {
      const scale = 1 + (b.popT || 0) * 0.35;
      const r = b.radius * scale;
      const x = b.position.x;
      const y = b.position.y;
      const c = colorFor(b.value);

      ctx.save();
      // Danger highlight if lingering high.
      if (b.aboveDangerSince != null) {
        ctx.shadowColor = 'rgba(255,90,90,0.9)';
        ctx.shadowBlur = 14;
      }
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.16, c);
      grad.addColorStop(1, shade(c, -18));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.stroke();
      ctx.restore();

      // number label
      ctx.save();
      ctx.fillStyle = '#0b1020';
      ctx.font = `700 ${Math.max(10, r * 0.8)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.value), x, y + 1);
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx) {
    if (this.nowMs > this.flashUntil || !this.flashMsg) return;
    const t = (this.flashUntil - this.nowMs) / 900;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.fillStyle = '#f6a821';
    ctx.font = '800 26px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = this.dangerY + 40 - (1 - t) * 16;
    ctx.fillText(this.flashMsg, this.w / 2, y);
    ctx.restore();
  }
}

// ---------- helpers ----------
function pointFromEvent(e, rect) {
  const x = (e.clientX ?? 0) - rect.left;
  const y = (e.clientY ?? 0) - rect.top;
  return { x, y };
}

function shade(hsl, delta) {
  const m = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (!m) return hsl;
  const h = +m[1], s = +m[2], l = Math.max(0, Math.min(100, +m[3] + delta));
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Boot once the DOM (and Matter from CDN) are ready.
window.addEventListener('DOMContentLoaded', () => {
  if (!window.Matter) {
    document.body.innerHTML = '<p style="color:#fff;padding:20px">Failed to load physics engine (Matter.js). Check your connection.</p>';
    return;
  }
  window.game = new Game();
});
