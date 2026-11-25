// Звуки игры, синтезируются на лету (без файлов): захват, авария, турбо, буква.
let ac = null, master = null;
export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
  } catch { ac = null; }
}
function tone(freq, t0, dur, type = 'triangle', vol = 0.5, slide = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, vol = 0.6, lp = 900) {
  const n = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = n; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}
export function play(kind, size = 1) {
  if (!ac || document.hidden) return;
  const t = ac.currentTime;
  if (kind === 'capture') { const k = Math.min(4, 1 + size); [523, 659, 784, 1047].slice(0, k).forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'triangle', 0.35)); }
  else if (kind === 'crash') { noise(t, 0.45, 0.8, 700); tone(140, t, 0.35, 'sawtooth', 0.25, 0.4); }
  else if (kind === 'boost') { tone(220, t, 0.4, 'sawtooth', 0.12, 3); }
  else if (kind === 'letter') { tone(1319, t, 0.12, 'sine', 0.3); tone(1760, t + 0.08, 0.2, 'sine', 0.3); }
  else if (kind === 'power') { tone(660, t, 0.1, 'square', 0.15); tone(990, t + 0.08, 0.16, 'square', 0.15); }
  else if (kind === 'bump') { tone(90, t, 0.15, 'sine', 0.5, 0.6); }
  else if (kind === 'egg') { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 'sine', 0.3)); }
}
