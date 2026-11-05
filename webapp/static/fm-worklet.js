const TAU = Math.PI * 2;
const MAX_VOICES = 40;
const ANALOG_OFFSETS = [-1, -.48, 0, .48, 1];
const ANALOG_WEIGHTS = [.16, .21, .26, .21, .16];
const ANALOG_ALL = [0, 1, 2, 3, 4];
const ANALOG_TRIO = [0, 2, 4];
const NO_PITCH_ENVELOPE = [0, .05];
const CENT_RATIO = Math.LN2 / 1200;
const SINE_TABLE_SIZE = 4096;
const SINE_TABLE_MASK = SINE_TABLE_SIZE - 1;
const SINE_TABLE_SCALE = SINE_TABLE_SIZE / TAU;
const SINE_TABLE = new Float32Array(SINE_TABLE_SIZE);
const EXP_TABLE_SIZE = 4096;
const EXP_TABLE_MAX = 16;
const EXP_TABLE_SCALE = EXP_TABLE_SIZE / EXP_TABLE_MAX;
const EXP_TABLE = new Float32Array(EXP_TABLE_SIZE);
for (let index = 0; index < SINE_TABLE_SIZE; index++) {
  SINE_TABLE[index] = Math.sin(TAU * index / SINE_TABLE_SIZE);
}
for (let index = 0; index < EXP_TABLE_SIZE; index++) {
  EXP_TABLE[index] = Math.exp(-EXP_TABLE_MAX * index / EXP_TABLE_SIZE);
}

function fastSin(phase) {
  return SINE_TABLE[(phase * SINE_TABLE_SCALE) & SINE_TABLE_MASK];
}

function fastCos(phase) {
  return SINE_TABLE[((phase + Math.PI * .5) * SINE_TABLE_SCALE) & SINE_TABLE_MASK];
}

function fastExpNeg(value) {
  if (value <= 0) return 1;
  if (value >= EXP_TABLE_MAX) return 0;
  return EXP_TABLE[(value * EXP_TABLE_SCALE) | 0];
}

const PATCHES = {
  drums: {
    algorithm: "feedback", ratios: [1, 1.414, 2.37, 3.91], indices: [0, 1, 1, 1],
    amp: [.001, .04, 0, .3], modDecay: [.1, .1, .1, .1], feedback: .25,
    level: .16, cutoff: [500, 12000], drive: 1.8, vibrato: [0, 0], motion: [6.2, .08],
    noise: .2, resonance: .34, filterMode: "lowpass", unison: 0, transient: .75,
    fold: .34, crush: .08, glitch: .08,
  },
  lead_synth: {
    algorithm: "serial", ratios: [1, 2, 3, 4], indices: [0, 1.3, 1.8, 1.25],
    amp: [.012, .16, .68, .22], modDecay: [.8, .55, .34, .2], feedback: .12,
    level: .16, cutoff: [1800, 7600], drive: 1.5, vibrato: [.15, 5.2], motion: [.32, .18],
    resonance: .28, filterMode: "lowpass", unison: .16, transient: .12, glide: .045,
    analogMix: .52, pulseMix: .12, analogDetune: 17, pitchEnvelope: [4.5, .055],
    fold: .2, crush: .018, glitch: .03, formant: .06, formantFrequency: 2550,
  },
  counter_synth: {
    algorithm: "parallel", ratios: [1, 2, 1.005, 3], indices: [0, 1.05, 0, .72],
    amp: [.035, .24, .62, .34], modDecay: [1, .7, 1, .5], feedback: .04,
    level: .12, cutoff: [1300, 5600], drive: 1.2, vibrato: [.11, 4.7], motion: [.25, .22],
    resonance: .32, filterMode: "lowpass", unison: .12, transient: .08, glide: .065,
    analogMix: .14, pulseMix: .38, analogDetune: 11, pitchEnvelope: [2, .07],
    fold: .12, crush: .035, glitch: .045, formant: .42, formantFrequency: 1850,
  },
  bass: {
    algorithm: "parallel", ratios: [.5, 1, 1, 2], indices: [0, .56, 0, .85],
    amp: [.008, .12, .72, .18], modDecay: [1, .18, 1, .26], feedback: .06,
    level: .21, cutoff: [380, 1800], drive: 2.1, vibrato: [0, 0], motion: [.18, .1],
    resonance: .18, filterMode: "lowpass", unison: .035, transient: .18,
    analogMix: .24, pulseMix: .28, analogDetune: 3.5, pitchEnvelope: [1.4, .045],
    fold: .38, crush: .012, glitch: .018, formant: .04, formantFrequency: 780,
  },
  guitar: {
    algorithm: "branch", ratios: [1, 2, 3, 5.04], indices: [0, 1.45, 2.2, 1.35],
    amp: [.004, .11, .16, .28], modDecay: [.8, .12, .075, .18], feedback: .08,
    level: .145, cutoff: [1700, 7800], drive: 1.65, vibrato: [.04, 5.7], motion: [.42, .12],
    resonance: .4, filterMode: "lowpass", unison: .075, transient: .42,
    analogMix: .16, pulseMix: .3, analogDetune: 7, pitchEnvelope: [3.2, .038],
    fold: .16, crush: .025, glitch: .035, formant: .1, formantFrequency: 2350,
    comb: .58, combFeedback: .68,
  },
  pad: {
    algorithm: "parallel", ratios: [1, 1.5, 1.003, 2.01], indices: [0, .72, 0, .52],
    amp: [.34, .8, .78, .85], modDecay: [1, 1.8, 1, 2.1], feedback: .025,
    level: .09, cutoff: [900, 4600], drive: 1.08, vibrato: [.08, 3.6], motion: [.12, .28],
    resonance: .22, filterMode: "lowpass", unison: .34, transient: .02,
    analogMix: .68, pulseMix: .08, analogDetune: 22, pitchEnvelope: [0, .1],
    fold: .07, crush: .008, glitch: .012, formant: .05, formantFrequency: 1480,
  },
  strings: {
    algorithm: "carriers", ratios: [1, 1.004, .997, 2], indices: [0, 0, 0, .48],
    amp: [.19, .62, .76, .7], modDecay: [1, 1, 1, 1.4], feedback: .035,
    level: .085, cutoff: [1200, 6100], drive: 1.18, vibrato: [.2, 5.1], motion: [.16, .22],
    resonance: .3, filterMode: "lowpass", unison: .38, transient: .035,
    analogMix: .61, pulseMix: .2, analogDetune: 12, pitchEnvelope: [0, .1],
    fold: .08, crush: .01, glitch: .015, formant: .14, formantFrequency: 1720,
  },
  keys_mallet: {
    algorithm: "serial", ratios: [1, 3, 5.7, 8.2], indices: [0, 2.2, 3.4, 2.4],
    amp: [.003, .065, .2, .25], modDecay: [.7, .09, .045, .03], feedback: .1,
    level: .16, cutoff: [2600, 11000], drive: 1.35, vibrato: [0, 0], motion: [.5, .1],
    resonance: .46, filterMode: "lowpass", unison: .045, transient: .52,
    analogMix: .08, pulseMix: .3, analogDetune: 5, pitchEnvelope: [5.5, .026],
    fold: .12, crush: .035, glitch: .04, formant: .2, formantFrequency: 3100,
    comb: .32, combFeedback: .55,
  },
  percussion_texture: {
    algorithm: "feedback", ratios: [1, 1.414, 2.37, 3.91], indices: [0, 2.8, 4.2, 5.4],
    amp: [.002, .055, .08, .2], modDecay: [.5, .05, .08, .035], feedback: .58,
    level: .12, cutoff: [1600, 11800], drive: 2.2, vibrato: [0, 0], motion: [1.8, .42],
    noise: .18, resonance: .5, filterMode: "bandpass", unison: .08, transient: .5,
    analogMix: .08, pulseMix: .45, analogDetune: 28, pitchEnvelope: [8, .022],
    fold: .62, crush: .34, glitch: .52, formant: .28, formantFrequency: 2800,
    comb: .36, combFeedback: .52,
  },
};

// GEMS-9 remains intact as the emotional framework. The first layer gives each
// emotion a coherent global character. ROLE_GEMS_PROFILES then gives every
// instrument its own response to every emotion: 9 emotions x 9 instruments.
// Notes, chords, rhythm, and MIDI data remain unchanged.
const GEMS_BANKS = {
  wonder: {
    index: 1.16, feedback: 1.04, cutoff: 1.26, drive: .94,
    attack: .82, release: 1.18, vibrato: 1.16, detune: 1.14, noise: .78,
    resonance: 1.08, modAttack: .8, modDecay: 1.2, lfo1Rate: .9,
    lfo1Depth: 1.12, lfo2Rate: .82, lfo2Depth: 1.18, unison: 1.2,
    transient: 1.08, level: .98, portamento: 1.08,
    saw: 1.14, pulse: .9, fold: .88, crush: .48, formant: 1.08,
    comb: 1.08, pitchEnv: 1.06, stereo: 1.25, glitch: .52,
  },
  transcendence: {
    index: 1.20, feedback: .90, cutoff: 1.10, drive: .90,
    attack: 1.34, release: 1.68, vibrato: 1.32, detune: 1.54, noise: .52,
    resonance: .92, modAttack: 1.3, modDecay: 1.55, lfo1Rate: .7,
    lfo1Depth: 1.3, lfo2Rate: .58, lfo2Depth: 1.28, unison: 1.55,
    transient: .72, level: .9, portamento: 1.28,
    saw: 1.42, pulse: .72, fold: .68, crush: .32, formant: 1.16,
    comb: 1.2, pitchEnv: .74, stereo: 1.52, glitch: .4,
  },
  tenderness: {
    index: .72, feedback: .72, cutoff: .84, drive: .82,
    attack: 1.18, release: 1.42, vibrato: .88, detune: 1.16, noise: .34,
    resonance: .82, modAttack: 1.12, modDecay: 1.34, lfo1Rate: .72,
    lfo1Depth: .78, lfo2Rate: .66, lfo2Depth: .72, unison: 1.12,
    transient: .68, level: 1.02, portamento: 1.12,
    saw: .72, pulse: .74, fold: .58, crush: .26, formant: .92,
    comb: 1.08, pitchEnv: .7, stereo: 1.08, glitch: .28,
  },
  nostalgia: {
    index: .84, feedback: .86, cutoff: .76, drive: .92,
    attack: 1.12, release: 1.52, vibrato: 1.26, detune: 1.42, noise: .54,
    resonance: 1.12, modAttack: 1.08, modDecay: 1.45, lfo1Rate: .76,
    lfo1Depth: 1.22, lfo2Rate: .7, lfo2Depth: 1.08, unison: 1.35,
    transient: .76, level: .98, portamento: 1.36,
    saw: .9, pulse: 1.08, fold: .76, crush: 1.32, formant: 1.12,
    comb: 1.18, pitchEnv: .68, stereo: 1.32, glitch: .72,
  },
  peacefulness: {
    index: .62, feedback: .62, cutoff: .72, drive: .76,
    attack: 1.48, release: 1.62, vibrato: .72, detune: 1.18, noise: .22,
    resonance: .72, modAttack: 1.42, modDecay: 1.58, lfo1Rate: .58,
    lfo1Depth: .62, lfo2Rate: .48, lfo2Depth: .58, unison: 1.22,
    transient: .5, level: 1.04, portamento: 1.22,
    saw: .58, pulse: .62, fold: .4, crush: .16, formant: .78,
    comb: .94, pitchEnv: .55, stereo: 1.12, glitch: .16,
  },
  power: {
    index: 1.16, feedback: 1.18, cutoff: 1.04, drive: 1.34,
    attack: .64, release: .86, vibrato: .72, detune: .86, noise: 1.08,
    resonance: 1.08, modAttack: .62, modDecay: .8, lfo1Rate: .92,
    lfo1Depth: .62, lfo2Rate: .9, lfo2Depth: .82, unison: 1.02,
    transient: 1.45, level: .88, portamento: .64,
    saw: 1.2, pulse: 1.18, fold: 1.48, crush: .8, formant: .78,
    comb: .7, pitchEnv: 1.45, stereo: .9, glitch: .78,
  },
  joyful_activation: {
    index: 1.12, feedback: .96, cutoff: 1.34, drive: 1.08,
    attack: .56, release: .74, vibrato: 1.08, detune: 1.10, noise: .82,
    resonance: 1.02, modAttack: .54, modDecay: .72, lfo1Rate: 1.26,
    lfo1Depth: 1.08, lfo2Rate: 1.3, lfo2Depth: 1.12, unison: 1.12,
    transient: 1.3, level: .94, portamento: .58,
    saw: 1.36, pulse: 1.28, fold: 1.06, crush: .6, formant: .96,
    comb: .88, pitchEnv: 1.3, stereo: 1.2, glitch: .92,
  },
  tension: {
    index: 1.48, feedback: 1.62, cutoff: 1.16, drive: 1.38,
    attack: .52, release: .64, vibrato: 1.24, detune: 1.34, noise: 1.46,
    resonance: 1.52, modAttack: .5, modDecay: .66, lfo1Rate: 1.34,
    lfo1Depth: 1.38, lfo2Rate: 1.44, lfo2Depth: 1.56, unison: 1.18,
    transient: 1.28, level: .78, portamento: .82,
    saw: 1.04, pulse: 1.22, fold: 1.62, crush: 1.5, formant: 1.38,
    comb: 1.42, pitchEnv: 1.58, stereo: 1.35, glitch: 1.62,
  },
  sadness: {
    index: .78, feedback: .82, cutoff: .62, drive: .84,
    attack: 1.26, release: 1.58, vibrato: 1.30, detune: 1.28, noise: .42,
    resonance: .9, modAttack: 1.22, modDecay: 1.5, lfo1Rate: .64,
    lfo1Depth: 1.18, lfo2Rate: .58, lfo2Depth: .86, unison: 1.24,
    transient: .62, level: 1, portamento: 1.42,
    saw: .68, pulse: .78, fold: .58, crush: .86, formant: 1.28,
    comb: 1.2, pitchEnv: .66, stereo: 1.18, glitch: .5,
  },
};
const GEMS_DIMENSIONS = Object.keys(GEMS_BANKS);
const BANK_PARAMETERS = Object.keys(GEMS_BANKS.wonder);

// Sparse role-specific multipliers. Missing values are neutral (1). Every
// role explicitly owns all nine GEMS entries, creating 81 authored response
// cells while keeping the bank readable and maintainable.
const ROLE_GEMS_PROFILES = {
  lead_synth: {
    wonder: { cutoff: 1.12, vibrato: 1.2, unison: 1.18, lfo2Depth: 1.12 },
    transcendence: { attack: 1.2, release: 1.3, vibrato: 1.3, unison: 1.28 },
    tenderness: { index: .82, cutoff: .9, drive: .82, vibrato: .8 },
    nostalgia: { cutoff: .8, vibrato: 1.28, detune: 1.2, release: 1.2 },
    peacefulness: { index: .72, attack: 1.25, lfo1Depth: .72, lfo2Depth: .68 },
    power: { drive: 1.3, attack: .72, transient: 1.22, level: .9 },
    joyful_activation: { cutoff: 1.2, attack: .66, lfo1Rate: 1.24, transient: 1.15 },
    tension: { feedback: 1.26, detune: 1.38, resonance: 1.18, lfo2Depth: 1.3 },
    sadness: { cutoff: .72, release: 1.35, vibrato: 1.25, attack: 1.16 },
  },
  counter_synth: {
    wonder: { index: 1.12, cutoff: 1.18, unison: 1.2, level: .92 },
    transcendence: { attack: 1.35, release: 1.42, detune: 1.25, level: .88 },
    tenderness: { index: .75, attack: 1.18, cutoff: .86, level: .92 },
    nostalgia: { vibrato: 1.34, cutoff: .72, release: 1.26, detune: 1.3 },
    peacefulness: { feedback: .62, lfo1Depth: .6, attack: 1.32, level: .86 },
    power: { index: 1.2, drive: 1.18, attack: .7, release: .76 },
    joyful_activation: { lfo1Rate: 1.35, cutoff: 1.25, transient: 1.12, release: .7 },
    tension: { feedback: 1.4, lfo2Depth: 1.42, detune: 1.3, resonance: 1.24 },
    sadness: { cutoff: .68, vibrato: 1.38, release: 1.42, level: .88 },
  },
  drums: {
    wonder: { cutoff: 1.15, transient: 1.15, resonance: 1.1, noise: .88 },
    transcendence: { transient: .72, release: 1.25, noise: .62, level: .86 },
    tenderness: { drive: .68, transient: .72, cutoff: .78, noise: .72 },
    nostalgia: { cutoff: .72, drive: .84, release: 1.15, noise: .82 },
    peacefulness: { level: .72, transient: .55, drive: .62, noise: .58 },
    power: { drive: 1.48, transient: 1.5, level: 1.12, cutoff: 1.08 },
    joyful_activation: { transient: 1.42, cutoff: 1.34, level: 1.05, noise: 1.12 },
    tension: { noise: 1.42, drive: 1.32, resonance: 1.38, feedback: 1.2 },
    sadness: { cutoff: .6, transient: .68, release: 1.32, level: .76 },
  },
  bass: {
    wonder: { index: 1.08, cutoff: 1.1, unison: 1.08, level: .96 },
    transcendence: { attack: 1.2, release: 1.3, drive: .82, level: .9 },
    tenderness: { drive: .72, cutoff: .8, attack: 1.12, index: .78 },
    nostalgia: { cutoff: .7, release: 1.22, drive: .86, vibrato: 1.1 },
    peacefulness: { index: .62, drive: .7, attack: 1.3, level: .9 },
    power: { drive: 1.55, transient: 1.38, attack: .65, level: 1.12 },
    joyful_activation: { transient: 1.22, cutoff: 1.16, release: .72, lfo2Rate: 1.2 },
    tension: { feedback: 1.22, resonance: 1.35, drive: 1.3, lfo2Depth: 1.22 },
    sadness: { cutoff: .62, drive: .74, release: 1.38, attack: 1.16 },
  },
  guitar: {
    wonder: { cutoff: 1.2, transient: 1.18, unison: 1.12, release: 1.08 },
    transcendence: { release: 1.45, detune: 1.28, attack: 1.08, level: .9 },
    tenderness: { index: .78, drive: .76, cutoff: .88, transient: .82 },
    nostalgia: { cutoff: .74, release: 1.38, detune: 1.32, resonance: 1.18 },
    peacefulness: { transient: .7, drive: .68, release: 1.3, index: .7 },
    power: { drive: 1.35, transient: 1.42, attack: .6, cutoff: 1.08 },
    joyful_activation: { transient: 1.34, cutoff: 1.28, release: .66, lfo2Rate: 1.22 },
    tension: { feedback: 1.3, detune: 1.3, resonance: 1.32, noise: 1.2 },
    sadness: { cutoff: .68, release: 1.42, detune: 1.18, drive: .78 },
  },
  pad: {
    wonder: { unison: 1.32, cutoff: 1.18, release: 1.2, lfo2Depth: 1.18 },
    transcendence: { attack: 1.48, release: 1.6, unison: 1.52, lfo1Depth: 1.3 },
    tenderness: { index: .7, attack: 1.25, release: 1.36, cutoff: .86 },
    nostalgia: { cutoff: .7, vibrato: 1.25, unison: 1.42, release: 1.45 },
    peacefulness: { index: .56, attack: 1.55, release: 1.5, lfo2Rate: .65 },
    power: { drive: 1.18, cutoff: 1.08, attack: .82, level: .92 },
    joyful_activation: { cutoff: 1.25, attack: .8, lfo2Rate: 1.32, lfo2Depth: 1.18 },
    tension: { index: 1.32, feedback: 1.34, detune: 1.46, resonance: 1.3 },
    sadness: { cutoff: .58, attack: 1.35, release: 1.58, vibrato: 1.28 },
  },
  strings: {
    wonder: { unison: 1.28, vibrato: 1.22, cutoff: 1.15, release: 1.14 },
    transcendence: { attack: 1.38, release: 1.5, vibrato: 1.42, unison: 1.4 },
    tenderness: { index: .76, vibrato: .82, attack: 1.2, drive: .78 },
    nostalgia: { vibrato: 1.45, detune: 1.38, cutoff: .72, release: 1.34 },
    peacefulness: { attack: 1.4, lfo1Rate: .68, lfo1Depth: .7, index: .66 },
    power: { attack: .78, drive: 1.2, cutoff: 1.1, level: .96 },
    joyful_activation: { attack: .75, cutoff: 1.2, lfo1Rate: 1.28, release: .78 },
    tension: { detune: 1.5, feedback: 1.28, lfo1Depth: 1.38, resonance: 1.2 },
    sadness: { vibrato: 1.5, cutoff: .64, release: 1.5, attack: 1.25 },
  },
  keys_mallet: {
    wonder: { cutoff: 1.25, transient: 1.2, resonance: 1.15, release: 1.1 },
    transcendence: { release: 1.36, transient: .8, detune: 1.2, level: .88 },
    tenderness: { index: .72, transient: .72, cutoff: .82, drive: .72 },
    nostalgia: { cutoff: .7, release: 1.28, resonance: 1.25, detune: 1.22 },
    peacefulness: { transient: .58, release: 1.35, drive: .62, level: .86 },
    power: { transient: 1.5, drive: 1.25, attack: .55, level: 1.05 },
    joyful_activation: { transient: 1.42, cutoff: 1.35, release: .62, lfo2Rate: 1.3 },
    tension: { feedback: 1.34, resonance: 1.45, noise: 1.18, detune: 1.28 },
    sadness: { cutoff: .62, release: 1.4, transient: .7, resonance: 1.12 },
  },
  percussion_texture: {
    wonder: { noise: .84, cutoff: 1.22, lfo2Depth: 1.24, unison: 1.1 },
    transcendence: { noise: .58, release: 1.4, lfo2Rate: .65, level: .82 },
    tenderness: { noise: .6, feedback: .65, drive: .72, transient: .68 },
    nostalgia: { cutoff: .7, noise: .78, lfo2Rate: .72, release: 1.24 },
    peacefulness: { noise: .42, feedback: .5, drive: .58, level: .68 },
    power: { drive: 1.48, transient: 1.4, noise: 1.2, level: 1.08 },
    joyful_activation: { lfo2Rate: 1.5, transient: 1.35, cutoff: 1.3, noise: 1.16 },
    tension: { feedback: 1.52, noise: 1.5, resonance: 1.42, lfo2Depth: 1.46 },
    sadness: { cutoff: .56, noise: .68, release: 1.38, lfo2Rate: .62 },
  },
};

function blendGemsBank(value, role = "lead_synth") {
  const source = value && typeof value === "object" ? value : {};
  const weights = GEMS_DIMENSIONS.map((name) => clamp(Number(source[name]) || 0, 0, 1));
  let total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    weights[GEMS_DIMENSIONS.indexOf("peacefulness")] = 1;
    total = 1;
  }
  const result = Object.fromEntries(BANK_PARAMETERS.map((parameter) => [parameter, 0]));
  const roleProfiles = ROLE_GEMS_PROFILES[role] || ROLE_GEMS_PROFILES.lead_synth;
  GEMS_DIMENSIONS.forEach((name, index) => {
    const weight = weights[index] / total;
    const bank = GEMS_BANKS[name];
    const roleProfile = roleProfiles[name] || {};
    for (const parameter of BANK_PARAMETERS) {
      result[parameter] += bank[parameter] * (roleProfile[parameter] ?? 1) * weight;
    }
  });
  return result;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function midiFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function envelope(time, duration, settings) {
  const attack = settings[0];
  const decay = settings[1];
  const sustain = settings[2];
  const release = settings[3];
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

function modulationEnvelope(time, decay, sustain, attack = .004) {
  if (time < attack) return time / Math.max(.0005, attack);
  return sustain + (1 - sustain) * fastExpNeg((time - attack) / Math.max(.006, decay));
}

// PolyBLEP keeps the added saw and pulse layers bright without the harsh
// aliasing of naive discontinuous oscillators. FM remains the core voice; the
// virtual-analogue layer supplies the wide, synthetic pop character that sine
// operators alone cannot produce.
function polyBlep(phase, increment) {
  if (phase < increment) {
    const x = phase / increment;
    return x + x - x * x - 1;
  }
  if (phase > 1 - increment) {
    const x = (phase - 1) / increment;
    return x * x + x + x + 1;
  }
  return 0;
}

function bandLimitedSaw(phase, increment) {
  return phase * 2 - 1 - polyBlep(phase, increment);
}

function bandLimitedPulse(phase, increment, width) {
  let sample = phase < width ? 1 : -1;
  sample += polyBlep(phase, increment);
  sample -= polyBlep((phase - width + 1) % 1, increment);
  return sample;
}

function wavefold(sample, amount) {
  const drive = 1 + clamp(amount, 0, 1) * 7;
  const wrapped = ((sample * drive + 1) % 4 + 4) % 4;
  return 1 - Math.abs(wrapped - 2);
}

class StreetArtFMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.presences = new Map();
    this.regionMix = new Map();
    this.lastFrequencyByRole = new Map();
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
      this.lastFrequencyByRole.clear();
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
      const patch = PATCHES[role];
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
          unisonPhases: [0, 0],
          analogPhases: [0, .17, .38, .61, .83],
          feedbackSample: 0,
          filterLow: 0,
          filterBand: 0,
          formantLow: 0,
          formantBand: 0,
          combBuffer: patch.comb ? new Float32Array(2048) : null,
          combIndex: 0,
          combDamp: 0,
          crushCounter: 0,
          crushValue: 0,
          harmonicIntensity: 0,
          attackControl: 0,
          releaseControl: 0,
          chorus: 0,
          gemsBank: blendGemsBank(item.gemsWeights, role),
          targetGemsBank: blendGemsBank(item.gemsWeights, role),
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
      voice.targetGemsBank = blendGemsBank(item.gemsWeights, role);
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
    const targetFrequency = midiFrequency(note);
    const patch = PATCHES[role];
    const previousFrequency = this.lastFrequencyByRole.get(role);
    const voice = {
      role,
      note,
      frequency: patch.glide && previousFrequency ? previousFrequency : targetFrequency,
      targetFrequency,
      glideSeconds: patch.glide || 0,
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
      unisonPhases: [0, 0],
      analogPhases: [0, .17, .38, .61, .83],
      feedbackSample: 0,
      filterLow: 0,
      filterBand: 0,
      formantLow: 0,
      formantBand: 0,
      combBuffer: patch.comb ? new Float32Array(2048) : null,
      combIndex: 0,
      combDamp: 0,
      crushCounter: 0,
      crushValue: 0,
      gemsBank: blendGemsBank(message.gemsWeights, role),
      seed: ((note + 1) * 1103515245 + this.frame) >>> 0,
    };
    const bank = voice.gemsBank;
    voice.ampSettings = [
      clamp(patch.amp[0] * (.5 + voice.attackControl * 1.85) * bank.attack, .001, 1.5),
      patch.amp[1],
      patch.amp[2],
      clamp(patch.amp[3] * (.5 + voice.releaseControl * 1.75) * bank.release, .025, 2.5),
    ];
    voice.endTime = Math.max(voice.ampSettings[0] + voice.ampSettings[1], duration) + voice.ampSettings[3];
    const angle = (voice.pan + 1) * Math.PI / 4;
    voice.panLeft = fastCos(angle);
    voice.panRight = fastSin(angle);
    voice.isDrum = role === "drums" || voice.kind === "boundary";
    if (role === "percussion_texture") voice.frequency = 190 + Math.max(0, note - 36) * 72;
    this.lastFrequencyByRole.set(role, targetFrequency);
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

  operatorPhases(voice, patch, vibrato, pitchScale = 1) {
    const bank = voice.gemsBank || blendGemsBank(null, voice.role);
    const detune = (voice.texture * .0007 + voice.chorus * .0018) * bank.detune * bank.stereo;
    for (let index = 0; index < 4; index++) {
      const alternating = index % 2 ? detune : -detune;
      // Keep the operator ratios close to whole-number relationships so the
      // perceived fundamental survives visual modulation. Hue still colours
      // the spectrum, but no longer pushes upper operators far enough away
      // from their harmonic ratios to create a noise-like cluster.
      const hueWarp = index === 0 ? 1 : 1 + (voice.hue - .5) * .0025 * index;
      const phase = voice.phases[index]
        + TAU * voice.frequency * pitchScale * patch.ratios[index] * hueWarp * (1 + alternating + vibrato) / sampleRate;
      voice.phases[index] = phase < TAU ? phase : phase % TAU;
    }
    const unisonAmount = clamp((patch.unison || 0) * bank.unison, 0, .6);
    const unisonCents = 3 + unisonAmount * 16;
    const unisonRatio = unisonCents * CENT_RATIO;
    const leftPhase = voice.unisonPhases[0]
      + TAU * voice.frequency * pitchScale * (1 - unisonRatio + vibrato) / sampleRate;
    const rightPhase = voice.unisonPhases[1]
      + TAU * voice.frequency * pitchScale * (1 + unisonRatio + vibrato) / sampleRate;
    voice.unisonPhases[0] = leftPhase < TAU ? leftPhase : leftPhase % TAU;
    voice.unisonPhases[1] = rightPhase < TAU ? rightPhase : rightPhase % TAU;
  }

  analogSample(voice, patch, bank, pitchScale, vibrato, isPresence) {
    const baseMix = clamp((patch.analogMix || 0) * bank.saw, 0, 1.2);
    if (baseMix <= .0001) return 0;
    const detuneCents = (patch.analogDetune || 0) * bank.stereo
      * (.62 + voice.chorus * .56 + voice.texture * .18);
    const pulseMix = clamp((patch.pulseMix || 0) * bank.pulse, 0, .82);
    const pulseWidth = clamp(.5 + (voice.hue - .5) * .28, .2, .8);
    const activeIndices = isPresence || this.renderVoiceCount > 12
      ? ANALOG_TRIO
      : ANALOG_ALL;
    let sample = 0;
    for (let slot = 0; slot < activeIndices.length; slot++) {
      const index = activeIndices[slot];
      // The detune range is deliberately small, so the first-order cents
      // conversion is perceptually equivalent and far cheaper than five
      // exponentials for every rendered sample.
      const ratio = 1 + ANALOG_OFFSETS[index] * detuneCents * CENT_RATIO;
      const increment = clamp(voice.frequency * pitchScale * ratio * (1 + vibrato) / sampleRate, .000001, .45);
      const nextPhase = voice.analogPhases[index] + increment;
      const phase = nextPhase < 1 ? nextPhase : nextPhase - 1;
      voice.analogPhases[index] = phase;
      const saw = bandLimitedSaw(phase, increment);
      const pulse = bandLimitedPulse(phase, increment, pulseWidth);
      const weight = activeIndices === ANALOG_TRIO
        ? (slot === 1 ? .44 : .28)
        : ANALOG_WEIGHTS[index];
      sample += (saw * (1 - pulseMix) + pulse * pulseMix) * weight;
    }
    return sample * baseMix * (isPresence ? .22 : 1);
  }

  formantSample(voice, input, frequency, resonance) {
    const normalized = clamp(frequency / sampleRate, .002, .3);
    // Two internal half-steps keep the Chamberlin state-variable filter stable
    // at bright formant frequencies and high resonance.
    const coefficient = clamp(Math.PI * normalized, .002, .94);
    const damping = 1.7 - clamp(resonance, 0, 1) * 1.32;
    for (let step = 0; step < 2; step++) {
      const high = input - voice.formantLow - damping * voice.formantBand;
      voice.formantBand += coefficient * high;
      voice.formantLow += coefficient * voice.formantBand;
    }
    return voice.formantBand;
  }

  combSample(voice, input, frequency, mix, feedback) {
    if (!voice.combBuffer || mix <= .0001) return input;
    const buffer = voice.combBuffer;
    const delaySamples = clamp(Math.round(sampleRate / clamp(frequency, 55, 6000)), 2, buffer.length - 2);
    const offset = voice.combIndex - delaySamples;
    const readIndex = offset < 0 ? offset + buffer.length : offset;
    const delayed = buffer[readIndex];
    voice.combDamp += (delayed - voice.combDamp) * .42;
    buffer[voice.combIndex] = clamp(input + voice.combDamp * feedback, -1.5, 1.5);
    voice.combIndex++;
    if (voice.combIndex === buffer.length) voice.combIndex = 0;
    return input * (1 - mix) + voice.combDamp * mix;
  }

  digitalShape(voice, sample, patch, bank, isPresence = false) {
    const presenceScale = isPresence ? .16 : 1;
    const foldAmount = clamp((patch.fold || 0) * bank.fold
      * (.45 + voice.harmonicIntensity * .42 + voice.saturation * .24) * presenceScale, 0, 1);
    if (foldAmount > .001) {
      sample = sample * (1 - foldAmount * .72) + wavefold(sample, foldAmount) * foldAmount * .72;
    }
    const crushAmount = clamp(
      ((patch.crush || 0) * bank.crush + (patch.glitch || 0) * bank.glitch * voice.texture * .35)
        * presenceScale,
      0,
      .92,
    );
    if (crushAmount > .001) {
      const hold = 1 + Math.floor(crushAmount * crushAmount * 22);
      if (voice.crushCounter <= 0) {
        const levels = Math.max(12, Math.round(256 * (1 - crushAmount) + 16 * crushAmount));
        voice.crushValue = Math.round(sample * levels) / levels;
        voice.crushCounter = hold;
      }
      voice.crushCounter--;
      sample = sample * (1 - crushAmount * .72) + voice.crushValue * crushAmount * .72;
    }
    return sample;
  }

  filterSample(voice, input, cutoff, resonance, mode) {
    const normalized = clamp(cutoff / sampleRate, .001, .42);
    const frequency = clamp(Math.PI * normalized, .002, .94);
    const damping = 1.9 - clamp(resonance, 0, 1) * 1.45;
    let high = 0;
    for (let step = 0; step < 2; step++) {
      high = input - voice.filterLow - damping * voice.filterBand;
      voice.filterBand += frequency * high;
      voice.filterLow += frequency * voice.filterBand;
    }
    if (mode === "bandpass") return voice.filterBand;
    if (mode === "highpass") return high;
    return voice.filterLow;
  }

  pitchedSample(voice, time) {
    const patch = PATCHES[voice.role] || PATCHES.lead_synth;
    const bank = voice.gemsBank || blendGemsBank(null, voice.role);
    if (voice.glideSeconds && voice.targetFrequency) {
      const glideTime = Math.max(.004, voice.glideSeconds * bank.portamento);
      const glideSmoothing = Math.min(1, 1 / (sampleRate * glideTime));
      voice.frequency += (voice.targetFrequency - voice.frequency) * glideSmoothing;
    }
    const isPresence = voice.kind === "presence";
    const ampSettings = isPresence
      ? (voice.role === "pad" || voice.role === "strings"
        ? [.12 * bank.attack, .32, .74, .25 * bank.release]
        : [.025 * bank.attack, .12, .68, .18 * bank.release])
      : voice.ampSettings;
    const amp = envelope(time, voice.duration, ampSettings);
    // At the very first sample an attack envelope is legitimately zero. That
    // is silence at the start of a note, not the end of the voice. Previously
    // every event note/chord was removed at time === 0, leaving only the
    // continuous presence layer audible.
    if (amp <= 0) {
      voice.finished = !isPresence && time >= voice.endTime;
      return 0;
    }
    const vibratoDepth = (patch.vibrato[0] + voice.chorus * .08 + voice.speed * .025)
      * bank.vibrato * bank.lfo1Depth;
    const vibrato = vibratoDepth
      ? fastSin(TAU * patch.vibrato[1] * bank.lfo1Rate * time) * vibratoDepth / 12
      : 0;
    const timbreLfo = fastSin(TAU * patch.motion[0] * bank.lfo2Rate * time)
      * patch.motion[1] * bank.lfo2Depth;
    const pitchEnvelope = patch.pitchEnvelope || NO_PITCH_ENVELOPE;
    const pitchSemitones = pitchEnvelope[0] * bank.pitchEnv
      * fastExpNeg(time / Math.max(.006, pitchEnvelope[1]));
    const pitchRatio = pitchSemitones * Math.LN2 / 12;
    const pitchScale = Math.abs(pitchSemitones) > .001
      ? 1 + pitchRatio + pitchRatio * pitchRatio * .5
      : 1;
    this.operatorPhases(voice, patch, vibrato, pitchScale);
    // Visual features shape timbre inside a restrained range. Event voices
    // retain enough FM movement to identify each instrument, while the quiet
    // presence layer stays almost carrier-like and cannot mask melody/chords.
    const colourIndexBase = isPresence
      ? .18 + voice.brightness * .16 + voice.saturation * .08
      : .46 + voice.brightness * .38 + voice.saturation * .16
        + voice.speed * .28 + voice.harmonicIntensity * .34;
    const colourIndex = colourIndexBase * clamp(1 + timbreLfo, .55, 1.55);
    const modSustain = voice.role === "pad" || voice.role === "strings" ? .42 : .04;
    const modAttack = .004 * bank.modAttack;
    const reducedQuality = this.renderVoiceCount > 12;
    // The reduced algorithms skip operators 3 and 4. Avoid evaluating their
    // envelopes as well, keeping the phase updates for transitions in quality.
    const index1 = patch.algorithm === "carriers" ? 0 : patch.indices[1] * colourIndex * bank.index
      * modulationEnvelope(time, patch.modDecay[1] * bank.modDecay, modSustain, modAttack);
    const index2 = reducedQuality || patch.algorithm === "parallel" || patch.algorithm === "carriers"
      ? 0 : patch.indices[2] * colourIndex * bank.index
      * modulationEnvelope(time, patch.modDecay[2] * bank.modDecay, modSustain, modAttack);
    const index3 = reducedQuality ? 0 : patch.indices[3] * colourIndex * bank.index
      * modulationEnvelope(time, patch.modDecay[3] * bank.modDecay, modSustain, modAttack);
    const p = voice.phases;
    let sample = 0;
    if (patch.algorithm === "serial") {
      if (reducedQuality) {
        sample = fastSin(p[0] + fastSin(p[1]) * index1);
      } else {
        const o4 = fastSin(p[3] + voice.feedbackSample * patch.feedback * bank.feedback);
        const o3 = fastSin(p[2] + o4 * index3);
        const o2 = fastSin(p[1] + o3 * index2);
        sample = fastSin(p[0] + o2 * index1);
        voice.feedbackSample = o4;
      }
    } else if (patch.algorithm === "parallel") {
      const a = fastSin(p[0] + fastSin(p[1]) * index1);
      const b = reducedQuality
        ? fastSin(p[2])
        : fastSin(p[2] + fastSin(p[3]) * index3);
      sample = a * .62 + b * .48;
    } else if (patch.algorithm === "branch") {
      if (reducedQuality) {
        sample = fastSin(p[0] + fastSin(p[1]) * index1);
      } else {
        const branch = fastSin(p[2]) * index2 + fastSin(p[3]) * index3;
        const middle = fastSin(p[1] + branch);
        sample = fastSin(p[0] + middle * index1);
      }
    } else if (patch.algorithm === "carriers") {
      const textured = reducedQuality
        ? fastSin(p[2])
        : fastSin(p[2] + fastSin(p[3]) * index3);
      sample = fastSin(p[0]) * .52 + (reducedQuality ? 0 : fastSin(p[1]) * .22) + textured * .38;
    } else {
      if (reducedQuality) {
        sample = fastSin(p[0] + fastSin(p[1]) * index1);
      } else {
        const o4 = fastSin(p[3] + voice.feedbackSample * (patch.feedback * bank.feedback + voice.texture * .8));
        const o3 = fastSin(p[2] + o4 * index3);
        const o2 = fastSin(p[1] + o3 * index2);
        sample = fastSin(p[0] + o2 * index1);
        voice.feedbackSample = o4;
      }
    }
    const analog = this.analogSample(voice, patch, bank, pitchScale, vibrato, isPresence);
    sample += analog;
    if (patch.noise && !isPresence) sample += this.random(voice) * patch.noise * bank.noise * (.24 + voice.texture * .55);
    if (!isPresence && patch.transient) {
      sample += this.random(voice) * patch.transient * bank.transient * fastExpNeg(time * 72) * .16;
    }
    // A direct carrier anchors every pitched FM voice to the actual MIDI note.
    // This makes melodic intervals and chord voicings remain audible even when
    // the visual data increases modulation depth.
    const fundamental = fastSin(p[0]);
    const unisonAmount = clamp((patch.unison || 0) * bank.unison, 0, .6);
    const unison = reducedQuality && patch.analogMix > .1
      ? 0
      : (fastSin(voice.unisonPhases[0]) + fastSin(voice.unisonPhases[1])) * .5;
    sample = isPresence
      ? fundamental * .88 + sample * .12
      : fundamental * .36 + sample * .72 + unison * unisonAmount * .32;
    sample = this.combSample(
      voice,
      sample,
      voice.frequency * pitchScale,
      clamp((patch.comb || 0) * bank.comb * (isPresence ? .28 : 1), 0, .86),
      clamp((patch.combFeedback || .55) * (.72 + bank.comb * .18), 0, .88),
    );
    const cutoff = clamp(
      (patch.cutoff[0] + (patch.cutoff[1] - patch.cutoff[0]) * voice.brightness)
        * bank.cutoff * clamp(1 + timbreLfo * .32, .62, 1.4),
      80,
      16000,
    );
    let filtered = this.filterSample(
      voice,
      sample,
      cutoff,
      clamp((patch.resonance || .2) * bank.resonance, 0, .92),
      patch.filterMode || "lowpass",
    );
    const formantMix = clamp((patch.formant || 0) * bank.formant * (isPresence ? 0 : 1), 0, .72);
    if (formantMix > .08 && !reducedQuality) {
      const formantFrequency = clamp(
        (patch.formantFrequency || 1800) * (.82 + voice.hue * .34) * bank.formant,
        420,
        7200,
      );
      const formant = this.formantSample(voice, sample, formantFrequency, .62 + voice.texture * .22);
      filtered = filtered * (1 - formantMix) + formant * formantMix * 1.5;
    }
    filtered = this.digitalShape(voice, filtered, patch, bank, isPresence);
    const driven = Math.tanh(
      filtered * patch.drive * bank.drive * (1 + voice.saturation * .45 + voice.harmonicIntensity * .35),
    );
    return driven * amp * patch.level * bank.level * voice.velocity;
  }

  drumSample(voice, time) {
    const note = Math.round(voice.note);
    const velocity = voice.velocity;
    if (voice.kind === "boundary") {
      const env = fastExpNeg(time * 85);
      const metallic = fastSin(TAU * 1700 * time + fastSin(TAU * 2630 * time) * 2.6);
      return this.shapeDrum(voice, metallic * env * .1 * velocity, time, time > .07);
    }
    if (note === 36) {
      const env = fastExpNeg(time * 10.5);
      const frequency = 46 + 118 * fastExpNeg(time * 34);
      voice.phases[0] += TAU * frequency / sampleRate;
      const click = this.random(voice) * fastExpNeg(time * 95) * .16;
      return this.shapeDrum(voice, (fastSin(voice.phases[0]) + click) * env * .28 * velocity, time, time > .75);
    }
    if (note === 38) {
      const env = fastExpNeg(time * 14);
      const tone = fastSin(TAU * 185 * time + fastSin(TAU * 317 * time) * 1.4);
      const noise = this.random(voice) * .85;
      return this.shapeDrum(voice, (tone * .35 + noise) * env * .18 * velocity, time, time > .5);
    }
    if (note === 39) {
      const pulses = fastExpNeg(time * 35)
        + (time > .018 ? fastExpNeg((time - .018) * 45) : 0)
        + (time > .038 ? fastExpNeg((time - .038) * 55) : 0);
      return this.shapeDrum(voice, this.random(voice) * pulses * .095 * velocity, time, time > .32);
    }
    if (note === 42 || note === 46) {
      const decay = note === 46 ? 8 : 28;
      const env = fastExpNeg(time * decay);
      const metallic = (
        fastSin(TAU * 2180 * time + voice.phases[0])
        + fastSin(TAU * 3082.52 * time + voice.phases[1])
        + fastSin(TAU * 3771.4 * time + voice.phases[2])
        + fastSin(TAU * 5166.6 * time + voice.phases[3])
      ) * .19;
      return this.shapeDrum(
        voice,
        (metallic + this.random(voice) * .24) * env * .11 * velocity,
        time,
        time > (note === 46 ? .75 : .24),
      );
    }
    const env = fastExpNeg(time * 12);
    const frequency = 95 + (note - 37) * 18 + 65 * fastExpNeg(time * 25);
    voice.phases[0] += TAU * frequency / sampleRate;
    return this.shapeDrum(
      voice,
      fastSin(voice.phases[0] + fastSin(voice.phases[0] * 1.47) * 1.2) * env * .2 * velocity,
      time,
      time > .55,
    );
  }

  shapeDrum(voice, sample, time, finished) {
    const bank = voice.gemsBank || blendGemsBank(null, voice.role);
    const patch = PATCHES[voice.role] || PATCHES.drums;
    const transient = this.random(voice) * (patch.transient || .4) * bank.transient
      * fastExpNeg(time * 95) * .035;
    const filtered = this.filterSample(
      voice,
      sample + transient,
      clamp(patch.cutoff[1] * bank.cutoff, 600, 16000),
      clamp((patch.resonance || .25) * bank.resonance, 0, .9),
      patch.filterMode || "lowpass",
    );
    const shaped = this.digitalShape(voice, filtered, patch, bank, false);
    voice.finished = finished;
    return Math.tanh(shaped * bank.drive) * bank.level;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    this.renderVoiceCount = this.voices.length + this.presences.size;
    const mixSmoothing = 1 / (sampleRate * .028);
    for (const mix of this.regionMix.values()) mix.value += (mix.target - mix.value) * mixSmoothing * left.length;
    for (const voice of this.voices) voice.renderMix = this.regionLevel(voice.regionId);
    const presenceSmoothing = 1 / (sampleRate * .045);

    for (let sampleIndex = 0; sampleIndex < left.length; sampleIndex++) {
      let leftSample = 0;
      let rightSample = 0;
      for (let index = this.voices.length - 1; index >= 0; index--) {
        const voice = this.voices[index];
        const absoluteFrame = this.frame + sampleIndex;
        if (absoluteFrame < voice.startFrame) continue;
        const time = (absoluteFrame - voice.startFrame) / sampleRate;
        const sample = voice.isDrum ? this.drumSample(voice, time) : this.pitchedSample(voice, time);
        if (voice.finished) {
          this.voices.splice(index, 1);
          continue;
        }
        leftSample += sample * voice.panLeft * voice.renderMix;
        rightSample += sample * voice.panRight * voice.renderMix;
      }
      for (const [id, voice] of this.presences) {
        const smoothing = presenceSmoothing;
        voice.gain += (voice.targetGain - voice.gain) * smoothing;
        voice.frequency += (voice.targetFrequency - voice.frequency) * smoothing;
        voice.velocity += (voice.targetVelocity - voice.velocity) * smoothing;
        voice.pan += (voice.targetPan - voice.pan) * smoothing;
        for (const parameter of BANK_PARAMETERS) {
          voice.gemsBank[parameter] += (voice.targetGemsBank[parameter] - voice.gemsBank[parameter]) * smoothing;
        }
        const sample = this.pitchedSample(voice, voice.ageFrames / sampleRate);
        voice.ageFrames++;
        const angle = (voice.pan + 1) * Math.PI / 4;
        const presenceSample = sample * voice.gain * .22;
        leftSample += presenceSample * fastCos(angle);
        rightSample += presenceSample * fastSin(angle);
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
