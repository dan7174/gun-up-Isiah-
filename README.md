# Number Cascade — Merge Blaster

An original **2048-style shoot-and-merge** arcade puzzle game. Aim a launcher at
the bottom of a vertical arena, fire numbered balls, and merge matching numbers
into doubles. Chain merges for combo multipliers, earn coins, buy upgrades,
trigger power-ups, and climb past 2048 for a high score.

This is an original game — no real app's name, art, or assets are used.

## Play it

No build step. Serve the folder over HTTP and open it:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000/index.html** in your browser.

(Opening `index.html` directly via `file://` won't work because the game uses ES
modules, which browsers only load over HTTP.)

## Controls

- **Move the pointer / finger** to aim (a dashed line shows the trajectory).
- **Click or tap** the arena — or press **Space** — to shoot the current ball.
- **🛒** opens the upgrade shop, **🔊 / 🔇** toggles sound.
- Tap a **power-up chip** (bottom-left) to use it.

## How to play

- Two balls of the **same** number that touch merge into one ball of **double**
  the value and award points.
- Multiple merges in quick succession from a shot build a **combo multiplier**.
- Merges earn **coins** — spend them in the shop on a higher starting value,
  faster reload, or an extra next-ball preview.
- **Power-ups** drop occasionally: **Scatter** (triple spread shot), **Bomb**
  (clears the densest cluster), and **Freeze** (stops gravity for a few seconds).
- Don't let a ball come to rest above the **red danger line** for ~2 seconds — it's
  game over. Your best score persists across sessions.

## Tech

- Plain HTML, CSS, and modular JavaScript (ES modules).
- [Matter.js](https://brm.io/matter-js/) 0.19.0 for 2D physics and collisions,
  vendored locally at `vendor/matter.min.js` (with a CDN fallback) so the game
  works offline.

## Project structure

```
index.html            markup: canvas, HUD, overlays
styles.css            layout, HUD, overlays, responsive/mobile
vendor/matter.min.js  Matter.js physics engine (vendored)
js/
  main.js             game loop, state, rendering, merging, scoring, input
  physics.js          Matter engine, world, and arena walls
  balls.js            ball creation, radius + color per value
  launcher.js         aiming, ball queue/preview, reload, drawing
  ui.js               HUD, upgrade shop, overlays
  powerups.js         scatter / bomb / freeze drops
  audio.js            synthesized WebAudio sound effects + mute
```
