// Power-ups: occasional drops the player can tap to activate.
// Types: scatter (triple spread shot), bomb (clear a radius), freeze (stop gravity).
const { World, Body } = Matter;

export const POWERUPS = {
  scatter: { emoji: '🎯', name: 'Scatter', label: 'Triple shot' },
  bomb: { emoji: '💥', name: 'Bomb', label: 'Clear area' },
  freeze: { emoji: '❄️', name: 'Freeze', label: 'Stop gravity' },
};

export class PowerupManager {
  constructor(game) {
    this.game = game;
    this.available = [];      // types currently sitting in the tray
    this.tray = document.getElementById('powerup-tray');
    this.dropCooldown = 9000; // ms between possible drops
    this.timer = this.dropCooldown;
    this.freezeUntil = 0;
    this.armed = null;        // 'scatter' arms the next shot
  }

  reset() {
    this.available = [];
    this.timer = this.dropCooldown;
    this.freezeUntil = 0;
    this.armed = null;
    this.render();
    this.game.engine.gravity.scale = 0.0011;
  }

  // Called on each merge — good merges have a chance to grant a drop sooner.
  onMerge(comboStep) {
    if (comboStep >= 2 && this.game.rand() < 0.5) this.timer = Math.min(this.timer, 1200);
  }

  update(dt, nowMs) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.dropCooldown;
      if (this.available.length < 3) this.drop();
    }
    // Freeze expiry: restore gravity.
    if (this.freezeUntil && nowMs >= this.freezeUntil) {
      this.freezeUntil = 0;
      this.game.engine.gravity.scale = 0.0011;
    }
  }

  isFrozen(nowMs) { return this.freezeUntil && nowMs < this.freezeUntil; }

  drop() {
    const keys = Object.keys(POWERUPS);
    const type = keys[Math.floor(this.game.rand() * keys.length)];
    this.available.push(type);
    this.render();
    this.game.audio.powerup();
  }

  render() {
    this.tray.innerHTML = '';
    this.available.forEach((type, i) => {
      const p = POWERUPS[type];
      const chip = document.createElement('div');
      chip.className = 'powerup-chip';
      chip.innerHTML = `<span class="emoji">${p.emoji}</span><span>${p.name}</span>`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activate(i);
      });
      this.tray.appendChild(chip);
    });
  }

  activate(index) {
    const type = this.available[index];
    if (!type) return;
    this.available.splice(index, 1);
    this.render();

    if (type === 'scatter') {
      // Arm the next shot to fire a spread.
      this.armed = 'scatter';
      this.game.flash('Scatter armed — next shot spreads!');
    } else if (type === 'bomb') {
      this.detonate();
    } else if (type === 'freeze') {
      this.freeze();
    }
    this.game.audio.powerup();
  }

  // Consume an armed modifier for the current shot (returns null or 'scatter').
  consumeArmed() {
    const a = this.armed;
    this.armed = null;
    return a;
  }

  detonate() {
    // Blast the densest cluster: pick the ball with the most neighbors.
    const balls = this.game.physics.getBalls();
    if (balls.length === 0) return;
    const radius = 130;
    let best = balls[0], bestCount = -1;
    for (const b of balls) {
      let count = 0;
      for (const o of balls) {
        if (o === b) continue;
        const d = Math.hypot(o.position.x - b.position.x, o.position.y - b.position.y);
        if (d < radius) count++;
      }
      if (count > bestCount) { bestCount = count; best = b; }
    }
    const cx = best.position.x, cy = best.position.y;
    const toRemove = [];
    for (const b of balls) {
      const d = Math.hypot(b.position.x - cx, b.position.y - cy);
      if (d < radius) toRemove.push(b);
    }
    for (const b of toRemove) {
      this.game.spawnParticles(b.position.x, b.position.y, b.value, 10);
      World.remove(this.game.world, b);
    }
    this.game.addScore(toRemove.length * 4);
    this.game.shake(14);
    this.game.audio.bomb();
    this.game.flash('💥 Bomb!');
  }

  freeze() {
    this.freezeUntil = this.game.nowMs + 4000;
    this.game.engine.gravity.scale = 0; // suspend gravity; existing velocities damp out
    // Gently slow everything so the pause reads clearly.
    for (const b of this.game.physics.getBalls()) {
      Body.setVelocity(b, { x: b.velocity.x * 0.3, y: b.velocity.y * 0.3 });
    }
    this.game.flash('❄️ Freeze!');
  }
}
