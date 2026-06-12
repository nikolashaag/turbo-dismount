import { loadAudio } from './assets';

type ImpactKind = 'flesh' | 'metal' | 'glass' | 'wood' | 'soft' | 'crunch';

const IMPACT_FILES: Record<ImpactKind, string[]> = {
  flesh: [
    'impactPunch_heavy_000',
    'impactPunch_heavy_001',
    'impactPunch_heavy_002',
    'impactPunch_heavy_003',
    'impactPunch_heavy_004',
  ],
  crunch: ['impactPunch_medium_000', 'impactPunch_medium_001', 'impactBell_heavy_000'],
  metal: [
    'impactMetal_heavy_000',
    'impactMetal_heavy_001',
    'impactMetal_heavy_002',
    'impactMetal_heavy_003',
    'impactMetal_medium_000',
    'impactMetal_medium_001',
  ],
  glass: ['impactGlass_heavy_000', 'impactGlass_heavy_001', 'impactGlass_medium_000'],
  wood: ['impactWood_heavy_000', 'impactWood_heavy_001', 'impactPlate_heavy_000', 'impactPlate_heavy_001'],
  soft: ['impactSoft_heavy_000', 'impactSoft_heavy_001', 'impactSoft_heavy_002', 'impactSoft_heavy_003'],
};

const UI_FILES = {
  click: 'click_001',
  hover: 'click_003',
  confirm: 'confirmation_001',
  error: 'error_001',
  select: 'select_001',
  switch: 'switch_001',
  open: 'maximize_001',
  close: 'minimize_001',
} as const;

/**
 * WebAudio mixer: Kenney impact one-shots, a synthesized engine, a
 * step-sequenced funk loop, and a global slow-mo treatment (master lowpass +
 * playback-rate drop) so slow motion sounds underwater like in TD2 replays.
 */
export class AudioSystem {
  ctx: AudioContext;
  private master: GainNode;
  private sfxBus: GainNode;
  private musicBus: GainNode;
  private lowpass: BiquadFilterNode;
  private buffers = new Map<string, AudioBuffer>();
  private lastPlay = new Map<string, number>();
  private recentPlays: number[] = [];
  private engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextStepTime = 0;
  muted = false;
  musicEnabled = true;
  /** 1 = normal. <1 darkens everything (slow-mo). */
  private timeFactor = 1;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.lowpass = this.ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.master.connect(this.lowpass);
    this.lowpass.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.34;
    this.musicBus.connect(this.master);
  }

  async preload() {
    const names = new Set<string>();
    Object.values(IMPACT_FILES).forEach((arr) => arr.forEach((n) => names.add(n)));
    Object.values(UI_FILES).forEach((n) => names.add(n));
    await Promise.all(
      [...names].map(async (n) => {
        try {
          this.buffers.set(n, await loadAudio(this.ctx, `/assets/audio/${n}.ogg`));
        } catch {
          /* missing audio is non-fatal */
        }
      })
    );
  }

  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** Slow-mo audio treatment. */
  setTimeFactor(f: number) {
    this.timeFactor = f;
    const cutoff = f < 0.9 ? 700 : 20000;
    this.lowpass.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.08);
  }

  private playBuffer(name: string, volume: number, rate = 1, bus?: GainNode) {
    const buf = this.buffers.get(name);
    if (!buf) return;
    const now = performance.now();
    // Global rate limit: max ~10 overlapping one-shots per 150ms window.
    this.recentPlays = this.recentPlays.filter((t) => now - t < 150);
    if (this.recentPlays.length > 10) return;
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < 60) return;
    this.lastPlay.set(name, now);
    this.recentPlays.push(now);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (this.timeFactor < 0.9 ? 0.55 : 1);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start();
  }

  /** force-scaled impact. intensity 0..1 */
  impact(kind: ImpactKind, intensity: number, pan = 0) {
    void pan;
    const files = IMPACT_FILES[kind];
    const name = files[Math.floor(Math.random() * files.length)];
    const vol = 0.25 + 0.75 * Math.min(intensity, 1);
    const rate = 0.88 + Math.random() * 0.24;
    this.playBuffer(name, vol, rate);
    if (kind === 'flesh' && intensity > 0.5) {
      // Layer a low thud under big body hits.
      this.thud(0.4 + 0.5 * intensity);
    }
  }

  /** Synthesized low-frequency thud for weighty hits. */
  thud(volume: number) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  explosion() {
    const t = this.ctx.currentTime;
    const dur = 0.9;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain();
    g.gain.value = 0.9;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    this.thud(1);
  }

  ui(name: keyof typeof UI_FILES) {
    this.playBuffer(UI_FILES[name], 0.5, 1, this.sfxBus);
  }

  // ---- Engine ----

  startEngine() {
    if (this.engine) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.frequency.value = 55;
    osc2.frequency.value = 55.7;
    osc.start();
    osc2.start();
    this.engine = { osc, osc2, gain, filter };
  }

  /** rev 0..1 (idle..redline), volume 0..1 */
  setEngine(rev: number, volume: number) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const freq = 48 + rev * 165;
    this.engine.osc.frequency.setTargetAtTime(freq, t, 0.04);
    this.engine.osc2.frequency.setTargetAtTime(freq * 1.013 + 0.6, t, 0.04);
    this.engine.filter.frequency.setTargetAtTime(300 + rev * 1400, t, 0.05);
    this.engine.gain.gain.setTargetAtTime(volume * 0.16, t, 0.06);
  }

  stopEngine() {
    if (!this.engine) return;
    this.engine.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
  }

  // ---- Funk loop (16-step sequencer, ~104 BPM with swing) ----

  startMusic() {
    if (this.musicTimer !== null || !this.musicEnabled) return;
    this.musicStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (!on) this.stopMusic();
    else this.startMusic();
  }

  private scheduleMusic() {
    const stepDur = 60 / 104 / 4; // 16ths at 104 BPM
    while (this.nextStepTime < this.ctx.currentTime + 0.25) {
      const s = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      const swing = s % 2 === 1 ? stepDur * 0.24 : 0;
      const t = this.nextStepTime + swing;
      this.playMusicStep(s, bar, t, stepDur);
      this.nextStepTime += stepDur;
      this.musicStep++;
    }
  }

  private playMusicStep(s: number, bar: number, t: number, stepDur: number) {
    // Drums
    if (s === 0 || s === 7 || s === 10) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0) this.hat(t, s === 14 ? 0.32 : 0.16);
    // Funk bass line (E minor pentatonic walk, varies per bar)
    const lines: number[][] = [
      [41, -1, 41, -1, 44, -1, 41, -1, 46, -1, 44, 41, -1, 39, -1, -1],
      [41, -1, 41, 44, -1, 44, -1, 46, -1, 48, 46, 44, -1, 41, -1, 39],
      [41, -1, 41, -1, 44, -1, 41, -1, 46, -1, 44, 41, -1, 49, 48, 46],
      [34, -1, 34, 36, -1, 36, -1, 39, -1, 39, 41, 44, -1, 46, -1, 48],
    ];
    const note = lines[bar][s];
    if (note >= 0) this.bass(t, 440 * Math.pow(2, (note - 69) / 12), stepDur * 1.7);
    // Clav stabs
    if ((bar % 2 === 0 && (s === 3 || s === 11)) || (bar % 2 === 1 && (s === 3 || s === 6 || s === 11))) {
      this.clav(t, 220 * Math.pow(2, (bar % 2) * 3 / 12));
    }
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.15);
  }

  private snare(t: number) {
    const buf = this.ctx.createBuffer(1, 4000, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t);
  }

  private hat(t: number, vol: number) {
    const buf = this.ctx.createBuffer(1, 1400, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7800;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t);
  }

  private bass(t: number, freq: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.6, t + dur);
    f.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.34, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private clav(t: number, freq: number) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * 4;
    f.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.14);
  }
}
