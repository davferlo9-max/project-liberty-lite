// Audio 100% procedural con Web Audio API. Sin ficheros externos ni red.
// Los navegadores exigen un gesto del usuario para arrancar el AudioContext:
// se reanuda en el primer clic (ver resume()).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.engine = null;   // nodos del motor del coche (continuo)
    this.siren = null;    // nodos de la sirena (continuo)
  }

  // Debe llamarse desde un manejador de gesto del usuario (click/keydown).
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _now() { return this.ctx.currentTime; }

  // --- Efectos puntuales ---------------------------------------------------

  // Ruido blanco breve con envolvente: base de disparos e impactos.
  _noiseBurst(duration, startGain, filterFreq, filterType = 'bandpass') {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const t = this._now();
    gain.gain.setValueAtTime(startGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  playerShot() { this._noiseBurst(0.12, 0.6, 1800, 'highpass'); }
  policeShot() { this._noiseBurst(0.14, 0.45, 700, 'bandpass'); }
  impact()     { this._noiseBurst(0.25, 0.7, 300, 'lowpass'); }

  // Arpegio ascendente para celebrar hitos (mision completada).
  jingle() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this._beep(f, 0.12, this._now() + i * 0.1, 0.25, 'triangle'));
  }

  _beep(freq, dur, when, gainVal, type = 'sine') {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainVal, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  // --- Sonidos continuos ---------------------------------------------------

  // Motor: oscilador cuyo tono/volumen sube con la velocidad (0..1 norm).
  setEngine(active, speedNorm = 0) {
    if (!this.enabled) return;
    if (active && !this.engine) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      gain.gain.value = 0.0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.engine = { osc, gain };
    }
    if (!active && this.engine) {
      this.engine.osc.stop();
      this.engine = null;
      return;
    }
    if (this.engine) {
      const target = 55 + speedNorm * 160;
      this.engine.osc.frequency.setTargetAtTime(target, this._now(), 0.1);
      this.engine.gain.gain.setTargetAtTime(0.06 + speedNorm * 0.08, this._now(), 0.1);
    }
  }

  // Sirena nee-naw: dos tonos que alternan mientras haya policia activa.
  setSiren(active) {
    if (!this.enabled) return;
    if (active && !this.siren) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 700;
      lfo.type = 'sine';
      lfo.frequency.value = 1.2;           // velocidad del nee-naw
      lfoGain.gain.value = 180;            // excursion de frecuencia
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0.05;
      osc.connect(gain).connect(this.master);
      osc.start(); lfo.start();
      this.siren = { osc, lfo, gain };
    }
    if (!active && this.siren) {
      this.siren.osc.stop();
      this.siren.lfo.stop();
      this.siren = null;
    }
  }
}
