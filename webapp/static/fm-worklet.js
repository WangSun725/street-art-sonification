const TAU = Math.PI * 2;
const MAX_VOICES = 40;

const PATCHES = {
  drums: {
    algorithm: "feedback", ratios: [1, 1.414, 2.37, 3.91], indices: [0, 1, 1, 1],
    amp: [.001, .04, 0, .3], modDecay: [.1, .1, .1, .1], feedback: .25,
    level: .16, cutoff: [500, 12000], drive: 1.8, vibrato: [0, 0], noise: .2,
  },
  lead_synth: {
    algorithm: "serial", ratios: [1, 2, 3, 4], indices: [0, 1.3, 1.8, 1.25],
    amp: [.012, .16, .68, .22], modDecay: [.8, .55, .34, .2], feedback: .12,
    level: .16, cutoff: [1800, 7600], drive: 1.5, vibrato: [.15, 5.2],
  },
  counter_synth: {
    algorithm: "parallel", ratios: [1, 2, 1.005, 3], indices: [0, 1.05, 0, .72],
    amp: [.035, .24, .62, .34], modDecay: [1, .7, 1, .5], feedback: .04,
    level: .12, cutoff: [1300, 5600], drive: 1.2, vibrato: [.11, 4.7],
  },
  bass: {
    algorithm: "parallel", ratios: [.5, 1, 1, 2], indices: [0, .56, 0, .85],
    amp: [.008, .12, .72, .18], modDecay: [1, .18, 1, .26], feedback: .06,
    level: .21, cutoff: [380, 1800], drive: 2.1, vibrato: [0, 0],
  },
  guitar: {
    algorithm: "branch", ratios: [1, 2, 3, 5.04], indices: [0, 1.45, 2.2, 1.35],
    amp: [.004, .11, .16, .28], modDecay: [.8, .12, .075, .18], feedback: .08,
    level: .145, cutoff: [1700, 7800], drive: 1.65, vibrato: [.04, 5.7],
  },
  pad: {
    algorithm: "parallel", ratios: [1, 1.5, 1.003, 2.01], indices: [0, .72, 0, .52],
    amp: [.34, .8, .78, .85], modDecay: [1, 1.8, 1, 2.1], feedback: .025,
    level: .09, cutoff: [900, 4600], drive: 1.08, vibrato: [.08, 3.6],
  },
  strings: {
    algorithm: "carriers", ratios: [1, 1.004, .997, 2], indices: [0, 0, 0, .48],
    amp: [.19, .62, .76, .7], modDecay: [1, 1, 1, 1.4], feedback: .035,
    level: .085, cutoff: [1200, 6100], drive: 1.18, vibrato: [.2, 5.1],
  },
  keys_mallet: {
    algorithm: "serial", ratios: [1, 3, 5.7, 8.2], indices: [0, 2.2, 3.4, 2.4],
    amp: [.003, .065, .2, .25], modDecay: [.7, .09, .045, .03], feedback: .1,
    level: .16, cutoff: [2600, 11000], drive: 1.35, vibrato: [0, 0],
  },
  percussion_texture: {
    algorithm: "feedback", ratios: [1, 1.414, 2.37, 3.91], indices: [0, 2.8, 4.2, 5.4],
    amp: [.002, .055, .08, .2], modDecay: [.5, .05, .08, .035], feedback: .58,
    level: .12, cutoff: [1600, 11800], drive: 2.2, vibrato: [0, 0], noise: .18,
  },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function midiFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function envelope(time, duration, settings) {
  const [attack, decay, sustain, release] = settings;
  if (time < 0) return 0;
  if (time < attack) return time / Math.max(.0005, attack);
  if (time < attack + decay) {
    const phase = (time - attack) / Math.max(.0005, decay);
    return 1 + (sustain - 1) * phase;
  }
  const releaseStart = Math.max(attack + decay, duration);
  if (time < releaseStart) return sustain;
  if (time < releaseStart + release) return sustain * (1 - (time - releaseStart) / release);
  return 0;
}

function modulationEnvelope(time, decay, sustain) {
  return sustain + (1 - sustain) * Math.exp(-time / Math.max(.006, decay));
}

class StreetArtFMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.presences = new Map();
    this.regionMix = new Map();
    this.frame = 0;
    this.port.onmessage = (event) => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === "note") this.addVoice(message);
    if (message.type === "mix") {
      const active = new Set();
      for (const item of message.regions || []) {
        active.add(String(item.id));
        const id = String(item.id);
        const current = this.regionMix.get(id) || { value: 0, target: 0 };
        current.target = clamp(Number(item.mix) || 0, 0, 1);
        this.regionMix.set(id, current);
      }
      for (const [id, mix] of this.regionMix) {
        if (!active.has(id)) mix.target = 0;
      }
    }
    if (message.type === "presence") this.updatePresences(message.regions || []);
    if (message.type === "clear") {
      this.voices.length = 0;
      this.presences.clear();
      for (const mix of this.regionMix.values()) mix.target = 0;
    }
  }

  updatePresences(items) {
    const active = new Set();
    for (const item of items) {
      const id = String(item.id);
      active.add(id);
      const role = PATCHES[item.role] ? item.role : "lead_synth";
      const note = clamp(Number(item.note) || 60, 0, 127);
      const visual = item.visual || {};
      let voice = this.presences.get(id);
      if (!voice || voice.role !== role) {
        voice = {
          role,
          note,
          frequency: midiFrequency(note),
          targetFrequency: midiFrequency(note),
          velocity: clamp(Number(item.velocity) || .18, .02, .5),
          targetVelocity: clamp(Number(item.velocity) || .18, .02, .5),
          duration: 3600,
          regionId: String(item.regionId || id),
          pan: clamp(Number(item.pan) || 0, -1, 1),
          targetPan: clamp(Number(item.pan) || 0, -1, 1),
          brightness: clamp(Number(visual.brightness) || 0, 0, 1),
          saturation: clamp(Number(visual.saturation) || 0, 0, 1),
          texture: clamp(Number(visual.texture) || 0, 0, 1),
          hue: clamp(Number(visual.hue) || 0, 0, 1),
          speed: clamp(Number(item.speed) || 0, 0, 1),
          kind: "presence",
          phases: [0, 0, 0, 0],
          feedbackSample: 0,
          filterState: 0,
          seed: ((note + 1) * 1103515245 + this.frame) >>> 0,
          ageFrames: 0,
          gain: 0,
          targetGain: 0,
        };
        this.presences.set(id, voice);
      }
      voice.note = note;
      voice.targetFrequency = midiFrequency(note);
      voice.targetVelocity = clamp(Number(item.velocity) || .18, .02, .5);
      voice.targetPan = clamp(Number(item.pan) || 0, -1, 1);
      voice.brightness = clamp(Number(visual.brightness) || 0, 0, 1);
      voice.saturation = clamp(Number(visual.saturation) || 0, 0, 1);
      voice.texture = clamp(Number(visual.texture) || 0, 0, 1);
      voice.hue = clamp(Number(visual.hue) || 0, 0, 1);
      voice.speed = clamp(Number(item.speed) || 0, 0, 1);
      voice.targetGain = clamp(Number(item.mix) || 0, 0, 1);
    }
    for (const [id, voice] of this.presences) {
      if (!active.has(id)) voice.targetGain = 0;
    }
  }

  addVoice(message) {
    const role = PATCHES[message.role] ? message.role : "lead_synth";
    const note = clamp(Number(message.note) || 60, 0, 127);
    const duration = clamp(Number(message.duration) || .25, .025, 12);
    const delay = clamp(Number(message.delay) || 0, 0, 2);
    const visual = message.visual || {};
    const controls = message.controls || {};
    const voice = {
      role,
      note,
      frequency: midiFrequency(note),
      velocity: clamp(Number(message.velocity) || .7, 0, 1),
      duration,
      regionId: String(message.regionId || "global"),
      pan: clamp(Number(message.pan) || 0, -1, 1),
      brightness: clamp(Number(controls.brightness ?? visual.brightness) || 0, 0, 1),
      saturation: clamp(Number(controls.harmonicIntensity ?? visual.saturation) || 0, 0, 1),
      texture: clamp(Number(controls.harmonicIntensity ?? visual.texture) || 0, 0, 1),
      hue: controls.harmonicIntensity == null ? clamp(Number(visual.hue) || 0, 0, 1) : .5,
      speed: clamp(Number(controls.movement ?? message.speed) || 0, 0, 1),
      harmonicIntensity: clamp(Number(controls.harmonicIntensity) || 0, 0, 1),
      attackControl: clamp(Number(controls.attack) || 0, 0, 1),
      releaseControl: clamp(Number(controls.release) || 0, 0, 1),
      chorus: clamp(Number(controls.chorus) || 0, 0, 1),
      kind: String(message.kind || "note"),
      startFrame: this.frame + Math.round(delay * sampleRate),
      phases: [0, 0, 0, 0],
      feedbackSample: 0,
      filterState: 0,
      seed: ((note + 1) * 1103515245 + this.frame) >>> 0,
    };
    if (role === "percussion_texture") voice.frequency = 190 + Math.max(0, note - 36) * 72;
    const patch = PATCHES[role];
    voice.release = patch.amp[3];
    if (role === "drums") voice.release = note === 46 ? .42 : .22;
    if (voice.kind === "boundary") voice.release = .035;
    if (this.voices.length >= MAX_VOICES) {
      let index = this.voices.findIndex((candidate) => {
        const age = (this.frame - candidate.startFrame) / sampleRate;
        return age > candidate.duration;
      });
      if (index < 0) index = 0;
      this.voices.splice(index, 1);
    }
    this.voices.push(voice);
  }

  random(voice) {
    voice.seed = (Math.imul(1664525, voice.seed) + 1013904223) >>> 0;
    return voice.seed / 4294967296 * 2 - 1;
  }

  regionLevel(id) {
    const mix = this.regionMix.get(id);
    return mix ? mix.value : 1;
  }

  operatorPhases(voice, patch, vibrato) {
    const detune = voice.texture * .0007 + voice.chorus * .0018;
    for (let index = 0; index < 4; index++) {
      const alternating = index % 2 ? detune : -detune;
      // Keep the operator ratios close to whole-number relationships so the
      // perceived fundamental survives visual modulation. Hue still colours
      // the spectrum, but no longer pushes upper operators far enough away
      // from their harmonic ratios to create a noise-like cluster.
      const hueWarp = index === 0 ? 1 : 1 + (voice.hue - .5) * .0025 * index;
      voice.phases[index] = (
        voice.phases[index]
        + TAU * voice.frequency * patch.ratios[index] * hueWarp * (1 + alternating + vibrato) / sampleRate
      ) % TAU;
    }
  }

  pitchedSample(voice, time) {
    const patch = PATCHES[voice.role] || PATCHES.lead_synth;
    const isPresence = voice.kind === "presence";
    const presenceEnvelope = voice.kind === "presence"
      ? (["pad", "strings"].includes(voice.role) ? [.12, .32, .74, .25] : [.025, .12, .68, .18])
      : [
        clamp(patch.amp[0] * (.5 + voice.attackControl * 1.85), .001, 1.5),
        patch.amp[1],
        patch.amp[2],
        clamp(patch.amp[3] * (.5 + voice.releaseControl * 1.75), .025, 2.5),
      ];
    const amp = envelope(time, voice.duration, presenceEnvelope);
    // At the very first sample an attack envelope is legitimately zero. That
    // is silence at the start of a note, not the end of the voice. Previously
    // every event note/chord was removed at time === 0, leaving only the
    // continuous presence layer audible.
    const releaseStart = Math.max(presenceEnvelope[0] + presenceEnvelope[1], voice.duration);
    const finished = time >= releaseStart + presenceEnvelope[3];
    if (amp <= 0) return [0, finished];
    const vibratoDepth = patch.vibrato[0] + voice.chorus * .08 + voice.speed * .025;
    const vibrato = vibratoDepth
      ? Math.sin(TAU * patch.vibrato[1] * time) * vibratoDepth / 12
      : 0;
    this.operatorPhases(voice, patch, vibrato);
    // Visual features shape timbre inside a restrained range. Event voices
    // retain enough FM movement to identify each instrument, while the quiet
    // presence layer stays almost carrier-like and cannot mask melody/chords.
    const colourIndex = isPresence
      ? .18 + voice.brightness * .16 + voice.saturation * .08
      : .46 + voice.brightness * .38 + voice.saturation * .16
        + voice.speed * .28 + voice.harmonicIntensity * .34;
    const modSustain = voice.role === "pad" || voice.role === "strings" ? .42 : .04;
    const index1 = patch.indices[1] * colourIndex * modulationEnvelope(time, patch.modDecay[1], modSustain);
    const index2 = patch.indices[2] * colourIndex * modulationEnvelope(time, patch.modDecay[2], modSustain);
    const index3 = patch.indices[3] * colourIndex * modulationEnvelope(time, patch.modDecay[3], modSustain);
    const p = voice.phases;
    let sample = 0;
    if (patch.algorithm === "serial") {
      const o4 = Math.sin(p[3] + voice.feedbackSample * patch.feedback);
      const o3 = Math.sin(p[2] + o4 * index3);
      const o2 = Math.sin(p[1] + o3 * index2);
      sample = Math.sin(p[0] + o2 * index1);
      voice.feedbackSample = o4;
    } else if (patch.algorithm === "parallel") {
      const a = Math.sin(p[0] + Math.sin(p[1]) * index1);
      const b = Math.sin(p[2] + Math.sin(p[3]) * index3);
      sample = a * .62 + b * .48;
    } else if (patch.algorithm === "branch") {
      const branch = Math.sin(p[2]) * index2 + Math.sin(p[3]) * index3;
      const middle = Math.sin(p[1] + branch);
      sample = Math.sin(p[0] + middle * index1);
    } else if (patch.algorithm === "carriers") {
      const textured = Math.sin(p[2] + Math.sin(p[3]) * index3);
      sample = Math.sin(p[0]) * .42 + Math.sin(p[1]) * .3 + textured * .38;
    } else {
      const o4 = Math.sin(p[3] + voice.feedbackSample * (patch.feedback + voice.texture * .8));
      const o3 = Math.sin(p[2] + o4 * index3);
      const o2 = Math.sin(p[1] + o3 * index2);
      sample = Math.sin(p[0] + o2 * index1);
      voice.feedbackSample = o4;
    }
    if (patch.noise && !isPresence) sample += this.random(voice) * patch.noise * (.24 + voice.texture * .55);
    // A direct carrier anchors every pitched FM voice to the actual MIDI note.
    // This makes melodic intervals and chord voicings remain audible even when
    // the visual data increases modulation depth.
    const fundamental = Math.sin(p[0]);
    sample = isPresence
      ? fundamental * .88 + sample * .12
      : fundamental * .36 + sample * .72;
    const cutoff = patch.cutoff[0] + (patch.cutoff[1] - patch.cutoff[0]) * voice.brightness;
    const coefficient = Math.exp(-TAU * cutoff / sampleRate);
    voice.filterState = (1 - coefficient) * sample + coefficient * voice.filterState;
    const driven = Math.tanh(
      voice.filterState * patch.drive * (1 + voice.saturation * .45 + voice.harmonicIntensity * .35),
    );
    return [driven * amp * patch.level * voice.velocity, false];
  }

  drumSample(voice, time) {
    const note = Math.round(voice.note);
    const velocity = voice.velocity;
    if (voice.kind === "boundary") {
      const env = Math.exp(-time * 85);
      const metallic = Math.sin(TAU * 1700 * time + Math.sin(TAU * 2630 * time) * 2.6);
      return [metallic * env * .1 * velocity, time > .07];
    }
    if (note === 36) {
      const env = Math.exp(-time * 10.5);
      const frequency = 46 + 118 * Math.exp(-time * 34);
      voice.phases[0] += TAU * frequency / sampleRate;
      const click = this.random(voice) * Math.exp(-time * 95) * .16;
      return [(Math.sin(voice.phases[0]) + click) * env * .28 * velocity, time > .75];
    }
    if (note === 38) {
      const env = Math.exp(-time * 14);
      const tone = Math.sin(TAU * 185 * time + Math.sin(TAU * 317 * time) * 1.4);
      const noise = this.random(voice) * .85;
      return [(tone * .35 + noise) * env * .18 * velocity, time > .5];
    }
    if (note === 39) {
      const pulses = Math.exp(-time * 35) + (time > .018 ? Math.exp(-(time - .018) * 45) : 0) + (time > .038 ? Math.exp(-(time - .038) * 55) : 0);
      return [this.random(voice) * pulses * .095 * velocity, time > .32];
    }
    if (note === 42 || note === 46) {
      const decay = note === 46 ? 8 : 28;
      const env = Math.exp(-time * decay);
      const metallic = [1, 1.414, 1.73, 2.37].reduce((sum, ratio, index) => (
        sum + Math.sin(TAU * (2180 * ratio) * time + voice.phases[index])
      ), 0) * .19;
      return [(metallic + this.random(voice) * .24) * env * .11 * velocity, time > (note === 46 ? .75 : .24)];
    }
    const env = Math.exp(-time * 12);
    const frequency = 95 + (note - 37) * 18 + 65 * Math.exp(-time * 25);
    voice.phases[0] += TAU * frequency / sampleRate;
    return [Math.sin(voice.phases[0] + Math.sin(voice.phases[0] * 1.47) * 1.2) * env * .2 * velocity, time > .55];
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const mixSmoothing = 1 - Math.exp(-1 / (sampleRate * .028));
    for (const mix of this.regionMix.values()) mix.value += (mix.target - mix.value) * mixSmoothing * left.length;

    for (let sampleIndex = 0; sampleIndex < left.length; sampleIndex++) {
      let leftSample = 0;
      let rightSample = 0;
      for (let index = this.voices.length - 1; index >= 0; index--) {
        const voice = this.voices[index];
        const absoluteFrame = this.frame + sampleIndex;
        if (absoluteFrame < voice.startFrame) continue;
        const time = (absoluteFrame - voice.startFrame) / sampleRate;
        const [sample, finished] = voice.role === "drums" || voice.kind === "boundary"
          ? this.drumSample(voice, time)
          : this.pitchedSample(voice, time);
        if (finished) {
          this.voices.splice(index, 1);
          continue;
        }
        const regionGain = this.regionLevel(voice.regionId);
        const angle = (voice.pan + 1) * Math.PI / 4;
        leftSample += sample * Math.cos(angle) * regionGain;
        rightSample += sample * Math.sin(angle) * regionGain;
      }
      for (const [id, voice] of this.presences) {
        const smoothing = 1 - Math.exp(-1 / (sampleRate * .045));
        voice.gain += (voice.targetGain - voice.gain) * smoothing;
        voice.frequency += (voice.targetFrequency - voice.frequency) * smoothing;
        voice.velocity += (voice.targetVelocity - voice.velocity) * smoothing;
        voice.pan += (voice.targetPan - voice.pan) * smoothing;
        const [sample] = this.pitchedSample(voice, voice.ageFrames / sampleRate);
        voice.ageFrames++;
        const angle = (voice.pan + 1) * Math.PI / 4;
        const presenceSample = sample * voice.gain * .22;
        leftSample += presenceSample * Math.cos(angle);
        rightSample += presenceSample * Math.sin(angle);
        if (voice.targetGain === 0 && voice.gain < .0005) this.presences.delete(id);
      }
      left[sampleIndex] = clamp(leftSample, -1.2, 1.2);
      right[sampleIndex] = clamp(rightSample, -1.2, 1.2);
    }
    this.frame += left.length;
    return true;
  }
}

registerProcessor("street-art-fm", StreetArtFMProcessor);
