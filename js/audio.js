// Tiny WebAudio sound effects — no external assets. Synthesized on the fly.
let ctx = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.15, slide = 0 }) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur + 0.02);
}

export const Audio = {
  // Unlock audio on first user gesture (mobile requirement).
  unlock() { ensureCtx(); },
  setMuted(m) { muted = m; },
  isMuted() { return muted; },

  shoot() { tone({ freq: 320, type: 'triangle', dur: 0.09, gain: 0.09, slide: 120 }); },

  // Merge pitch rises with combo depth for satisfying escalation.
  merge(comboStep = 1) {
    const base = 380 + comboStep * 70;
    tone({ freq: base, type: 'sine', dur: 0.14, gain: 0.16, slide: 160 });
    tone({ freq: base * 1.5, type: 'triangle', dur: 0.1, gain: 0.06 });
  },

  bigMerge() {
    tone({ freq: 220, type: 'sawtooth', dur: 0.25, gain: 0.14, slide: 260 });
    tone({ freq: 440, type: 'sine', dur: 0.3, gain: 0.1, slide: 300 });
  },

  powerup() { tone({ freq: 600, type: 'square', dur: 0.12, gain: 0.08, slide: 400 }); },
  bomb() { tone({ freq: 90, type: 'sawtooth', dur: 0.35, gain: 0.18, slide: -40 }); },
  coin() { tone({ freq: 880, type: 'square', dur: 0.06, gain: 0.05 }); },
  buy() { tone({ freq: 520, type: 'triangle', dur: 0.1, gain: 0.1, slide: 200 }); },
  gameover() {
    tone({ freq: 300, type: 'sawtooth', dur: 0.4, gain: 0.14, slide: -180 });
  },
};
