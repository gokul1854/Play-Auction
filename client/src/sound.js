// Countdown sound: a tick each second in the last ten seconds, and a higher beep for the last three.
// Built with the Web Audio API, so no sound files are needed. The choice is remembered on this device.
const KEY = "auction.sound";
const listeners = new Set();
let ctx = null;

export function isSoundOn() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode: keep it for this visit */ }
  listeners.forEach((f) => f(on));
}

export function onSoundChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// kind: "tick" for a short click, "beep" for the final seconds.
export function playCountdown(kind = "tick") {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const beep = kind === "beep";
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = beep ? "sine" : "square";
  osc.frequency.value = beep ? 880 : 1600;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(beep ? 0.25 : 0.12, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (beep ? 0.18 : 0.05));
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

// The SOLD sound: an original jingle. A brass chord swells, a quick bell run rings above it, and a light shimmer fades out.
export function playSold() {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  const out = c.createGain();
  out.gain.value = 0.9;
  out.connect(c.destination);

  // Brass chord: three sawtooth voices through a low-pass filter that opens up.
  const brassFilter = c.createBiquadFilter();
  brassFilter.type = "lowpass";
  brassFilter.Q.value = 3;
  brassFilter.frequency.setValueAtTime(350, t);
  brassFilter.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
  brassFilter.frequency.exponentialRampToValueAtTime(900, t + 0.9);
  const brassGain = c.createGain();
  brassGain.gain.setValueAtTime(0.0001, t);
  brassGain.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  brassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  brassFilter.connect(brassGain);
  brassGain.connect(out);
  [233.08, 293.66, 349.23].forEach((f) => {
    const v = c.createOscillator();
    v.type = "sawtooth";
    v.frequency.value = f;
    v.connect(brassFilter);
    v.start(t);
    v.stop(t + 1.0);
  });

  // Bell run: each note is a sine with a bright upper partial, ringing out.
  [659.25, 783.99, 987.77, 1318.51].forEach((f, i) => {
    const at = t + 0.06 + i * 0.075;
    [[f, 0.14], [f * 2.76, 0.05]].forEach(([freq, vol]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      o.connect(g);
      g.connect(out);
      o.start(at);
      o.stop(at + 0.75);
    });
  });

  // Shimmer: quiet high-passed noise that fades as the chord ends.
  const len = Math.floor(c.sampleRate * 0.6);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const shimmer = c.createBufferSource();
  shimmer.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  const sg = c.createGain();
  sg.gain.value = 0.05;
  shimmer.connect(hp);
  hp.connect(sg);
  sg.connect(out);
  shimmer.start(t + 0.2);
}

// One short tone. `to` slides the pitch from `from` over the length of the tone.
function tone({ type = "sine", from, to = from, at, len, vol }) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + len);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

// A new lot comes up: a rising sweep.
export function playLotOpen() {
  if (!isSoundOn()) return;
  const t = audio()?.currentTime ?? 0;
  tone({ type: "triangle", from: 400, to: 1200, at: t + 0.02, len: 0.35, vol: 0.18 });
}

// A bid is placed: a short blip.
export function playBid() {
  if (!isSoundOn()) return;
  const t = audio()?.currentTime ?? 0;
  tone({ type: "sine", from: 1200, at: t + 0.01, len: 0.07, vol: 0.15 });
}

// The lot goes unsold: a falling "wah-wah".
export function playUnsold() {
  if (!isSoundOn()) return;
  const t = audio()?.currentTime ?? 0;
  tone({ type: "sawtooth", from: 330, to: 165, at: t + 0.02, len: 0.45, vol: 0.12 });
  tone({ type: "sawtooth", from: 311, to: 155, at: t + 0.5, len: 0.6, vol: 0.12 });
}

// The auction is paused: two notes falling.
export function playPause() {
  if (!isSoundOn()) return;
  const t = audio()?.currentTime ?? 0;
  tone({ type: "sine", from: 660, at: t + 0.02, len: 0.18, vol: 0.2 });
  tone({ type: "sine", from: 440, at: t + 0.2, len: 0.25, vol: 0.2 });
}

// The auction resumes: two notes rising.
export function playResume() {
  if (!isSoundOn()) return;
  const t = audio()?.currentTime ?? 0;
  tone({ type: "sine", from: 440, at: t + 0.02, len: 0.18, vol: 0.2 });
  tone({ type: "sine", from: 660, at: t + 0.2, len: 0.25, vol: 0.2 });
}
