/**
 * Sound for the Cards onboarding, synthesised with Web Audio (no files): an ambient pad under
 * the starfield, and one cue per beat of the animation. Everything runs through a master gain
 * so mute is a single ramp, then a compressor and a generated reverb for space.
 */
export const MUTE_KEY = "gravv-onboarding-muted";

export class OnboardingSound {
  private ctx: AudioContext;
  private master: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private noise: AudioBuffer;
  private pad: { stop: (at: number) => void } | null = null;
  private muted: boolean;
  private closed = false;

  constructor(muted: boolean) {
    this.muted = muted;
    this.ctx = new AudioContext();
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = muted ? 0 : 0.8;
    this.master.connect(comp);
    this.dry = c.createGain();
    this.dry.connect(this.master);
    // Reverb: exponentially decaying stereo noise as the impulse.
    const verb = c.createConvolver();
    const len = Math.round(c.sampleRate * 3);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    this.wet = c.createGain();
    this.wet.gain.value = 0.55;
    this.wet.connect(verb);
    verb.connect(this.master);

    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }

  /** Browsers start audio suspended until a gesture; call on any click too. */
  resume() {
    if (!this.closed && this.ctx.state === "suspended")
      this.ctx.resume().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.08);
    if (!m) this.resume();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => this.ctx.close().catch(() => {}), 400);
  }

  // --- building blocks -------------------------------------------------------------------

  private get now() {
    return this.ctx.currentTime;
  }

  private out(node: AudioNode, pan = 0, wet = 0.4) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    p.connect(this.dry);
    const send = this.ctx.createGain();
    send.gain.value = wet;
    p.connect(send);
    send.connect(this.wet);
    return p;
  }

  private noiseSource(at: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(at);
    s.stop(at + dur + 0.1);
    return s;
  }

  private env(
    g: GainNode,
    at: number,
    peak: number,
    attack: number,
    hold: number,
    release: number,
  ) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    peak: number,
    type: OscillatorType = "sine",
    pan = 0,
    wet = 0.6,
  ) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, at, peak, 0.01, 0, dur);
    o.connect(g);
    this.out(g, pan, wet);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  // --- cues --------------------------------------------------------------------------------

  /** Low, slow pad under the starfield (A minor-ish, filtered, breathing). */
  startPad() {
    if (this.pad) return;
    const c = this.ctx,
      at = this.now;
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, at);
    bus.gain.exponentialRampToValueAtTime(0.11, at + 2.5);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.Q.value = 0.6;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lp.connect(bus);
    this.out(bus, 0, 0.7);
    const oscs = [55, 110, 110.6, 164.8, 220.4].map((f, i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? "sine" : "sawtooth";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = i === 0 ? 0.6 : 0.12;
      o.connect(g).connect(lp);
      o.start(at);
      return o;
    });
    lfo.start(at);
    this.pad = {
      stop: (t: number) => {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0.0001, t, 0.6);
        [...oscs, lfo].forEach((o) => o.stop(t + 4));
      },
    };
  }

  stopPad(delay = 0) {
    this.pad?.stop(this.now + delay);
    this.pad = null;
  }

  /** Stars swirling into the card: band-passed air sweeping across the stereo field. */
  gather(dur = 2) {
    const c = this.ctx,
      at = this.now;
    const s = this.noiseSource(at, dur);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, at);
    bp.frequency.exponentialRampToValueAtTime(2200, at + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(700, at + dur);
    const g = c.createGain();
    this.env(g, at, 0.22, dur * 0.5, 0, dur * 0.5);
    const p = this.out(g, -0.7, 0.5) as StereoPannerNode;
    p.pan.setValueAtTime(-0.7, at);
    p.pan.linearRampToValueAtTime(0.5, at + dur);
    s.connect(bp).connect(g);
    // a soft tonal settle as the card lands
    this.tone(659.3, at + dur * 0.92, 1.6, 0.04, "sine", 0, 0.8);
    this.tone(987.8, at + dur * 0.98, 1.4, 0.025, "sine", 0.2, 0.8);
  }

  /** The card laying back into the scene: a low, airy swell. */
  settle() {
    const c = this.ctx,
      at = this.now;
    const s = this.noiseSource(at, 2);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, at);
    lp.frequency.exponentialRampToValueAtTime(220, at + 1.8);
    const g = c.createGain();
    this.env(g, at, 0.09, 0.5, 0.2, 1.2);
    s.connect(lp).connect(g);
    this.out(g, 0, 0.7);
    this.tone(146.8, at + 0.2, 2.2, 0.035, "sine", 0, 0.8);
  }

  /** Verification scan: a rising sweep that pans with the line, plus a fine tick. */
  scan(dur: number, panFrom: number, panTo: number) {
    const c = this.ctx,
      at = this.now;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(520, at);
    o.frequency.exponentialRampToValueAtTime(1560, at + dur);
    const g = c.createGain();
    this.env(g, at, 0.022, 0.2, dur - 0.5, 0.3);
    const p = this.out(g, panFrom, 0.35) as StereoPannerNode;
    p.pan.setValueAtTime(panFrom, at);
    p.pan.linearRampToValueAtTime(panTo, at + dur);
    o.connect(g);
    o.start(at);
    o.stop(at + dur + 0.1);
    for (let i = 0; i < 10; i++) {
      const k = i / 9;
      this.tone(
        2400 + k * 900,
        at + k * dur,
        0.05,
        0.02,
        "square",
        panFrom + (panTo - panFrom) * k,
        0.2,
      );
    }
  }

  /** The card collapsing: air sucked inwards, a tone climbing into the core. */
  implode(dur: number) {
    const c = this.ctx,
      at = this.now;
    const s = this.noiseSource(at, dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(180, at);
    lp.frequency.exponentialRampToValueAtTime(7000, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.35, at + dur);
    g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.03);
    s.connect(lp).connect(g);
    this.out(g, 0, 0.2);
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70, at);
    o.frequency.exponentialRampToValueAtTime(420, at + dur);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(0.07, at + dur);
    og.gain.linearRampToValueAtTime(0.0001, at + dur + 0.03);
    const olp = c.createBiquadFilter();
    olp.type = "lowpass";
    olp.frequency.value = 1400;
    o.connect(olp).connect(og);
    this.out(og, 0, 0.2);
    o.start(at);
    o.stop(at + dur + 0.1);
  }

  /** The detonation: a falling sub, a noise blast and a long tail. */
  boom() {
    const c = this.ctx,
      at = this.now;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(32, at + 1.4);
    const og = c.createGain();
    this.env(og, at, 0.9, 0.005, 0.05, 1.6);
    o.connect(og);
    this.out(og, 0, 0.35);
    o.start(at);
    o.stop(at + 1.8);
    const s = this.noiseSource(at, 2.2);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(5200, at);
    lp.frequency.exponentialRampToValueAtTime(240, at + 1.8);
    const g = c.createGain();
    this.env(g, at, 0.45, 0.004, 0.02, 2);
    s.connect(lp).connect(g);
    this.out(g, 0, 0.9);
  }

  /** Dots flying home: a scatter of high pentatonic glints across the stereo field. */
  reform(dur: number) {
    const at = this.now;
    const notes = [1318.5, 1568, 1760, 1975.5, 2349.3, 2637];
    for (let i = 0; i < 8; i++) {
      const f = notes[Math.floor(Math.random() * notes.length)];
      const t = at + 0.1 + Math.pow(Math.random(), 0.7) * dur;
      this.tone(
        f,
        t,
        0.5 + Math.random() * 0.6,
        0.018 + Math.random() * 0.02,
        "sine",
        Math.random() * 1.6 - 0.8,
        0.8,
      );
    }
  }

  /** "Request granted": two soft notes. */
  granted() {
    const at = this.now;
    this.tone(659.3, at, 1.6, 0.07, "sine", -0.1, 0.7);
    this.tone(987.8, at + 0.12, 1.9, 0.06, "sine", 0.1, 0.7);
    this.tone(1318.5, at + 0.24, 2.2, 0.03, "triangle", 0, 0.8);
  }

  /** A shooting star: a faint high glide, panned to where it is. */
  meteor(pan: number) {
    const c = this.ctx,
      at = this.now;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(2600, at);
    o.frequency.exponentialRampToValueAtTime(1100, at + 0.7);
    const g = c.createGain();
    this.env(g, at, 0.018, 0.08, 0.2, 0.5);
    const p = this.out(g, pan, 0.8) as StereoPannerNode;
    p.pan.linearRampToValueAtTime(
      Math.max(-1, Math.min(1, pan * 0.4)),
      at + 0.8,
    );
    o.connect(g);
    o.start(at);
    o.stop(at + 0.9);
  }

  /** The card breaking into the dashboard: a descending whoosh and a soft landing swell. */
  burst() {
    const c = this.ctx,
      at = this.now;
    const s = this.noiseSource(at, 1.8);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(3200, at);
    bp.frequency.exponentialRampToValueAtTime(260, at + 1.5);
    const g = c.createGain();
    this.env(g, at, 0.28, 0.12, 0.2, 1.3);
    s.connect(bp).connect(g);
    this.out(g, 0, 0.6);
    this.tone(220, at + 0.9, 2.4, 0.05, "sine", 0, 0.8);
    this.tone(329.6, at + 1, 2.4, 0.035, "sine", 0, 0.8);
  }
}
