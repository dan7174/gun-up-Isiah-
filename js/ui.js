// HUD updates, upgrade shop rendering, and overlay control.
export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      score: document.getElementById('score'),
      best: document.getElementById('best'),
      coins: document.getElementById('coins'),
      combo: document.getElementById('combo'),
      comboWrap: document.getElementById('combo-wrap'),
      start: document.getElementById('start'),
      gameover: document.getElementById('gameover'),
      shop: document.getElementById('shop'),
      finalScore: document.getElementById('final-score'),
      finalBest: document.getElementById('final-best'),
      finalTile: document.getElementById('final-tile'),
      upgradeList: document.getElementById('upgrade-list'),
      muteBtn: document.getElementById('mute-btn'),
    };
    this.bindButtons();
  }

  bindButtons() {
    document.getElementById('start-btn').addEventListener('click', () => this.game.start());
    document.getElementById('restart-btn').addEventListener('click', () => this.game.start());
    document.getElementById('shop-btn').addEventListener('click', () => this.game.openShop());
    document.getElementById('shop-close').addEventListener('click', () => this.game.closeShop());
    this.el.muteBtn.addEventListener('click', () => this.game.toggleMute());
  }

  updateHUD() {
    const g = this.game;
    this.el.score.textContent = g.score;
    this.el.best.textContent = g.best;
    this.el.coins.textContent = g.coins;
  }

  showCombo(mult) {
    this.el.combo.textContent = 'x' + mult;
    this.el.comboWrap.classList.toggle('active', mult > 1);
  }

  setMuteIcon(muted) {
    this.el.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  showOverlay(name) {
    this.el.start.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.shop.classList.add('hidden');
    if (name && this.el[name]) this.el[name].classList.remove('hidden');
  }

  showGameOver() {
    const g = this.game;
    this.el.finalScore.textContent = g.score;
    this.el.finalBest.textContent = g.best;
    this.el.finalTile.textContent = g.highestTile;
    this.showOverlay('gameover');
  }

  renderShop() {
    const g = this.game;
    const list = this.el.upgradeList;
    list.innerHTML = '';
    for (const key of Object.keys(g.upgrades)) {
      const u = g.upgrades[key];
      const maxed = u.level >= u.maxLevel;
      const cost = u.cost(u.level);
      const affordable = !maxed && g.coins >= cost;

      const row = document.createElement('div');
      row.className = 'upgrade' + (maxed ? ' maxed' : '');
      row.innerHTML = `
        <div class="u-emoji">${u.emoji}</div>
        <div class="u-body">
          <div class="u-name">${u.name}</div>
          <div class="u-desc">${u.desc}</div>
          <div class="u-level">Level ${u.level} / ${u.maxLevel}</div>
        </div>
        <button ${maxed || !affordable ? 'disabled' : ''}>
          ${maxed ? 'MAX' : '💰 ' + cost}
        </button>`;
      const btn = row.querySelector('button');
      if (!maxed) {
        btn.addEventListener('click', () => g.buyUpgrade(key));
      }
      list.appendChild(row);
    }
  }
}
