import { DRUM_DEFAULTS, DRUM_VOICES, FACTORY_PATCHES, PATCHES, applyFmPatch, normalizeDrumPatch, normalizeFmPatch } from "./fm-patches.mjs?v=performance-mix1";

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

const OPERATOR_TABLE_SIZE = 1024;
const OPERATOR_TABLE_MASK = OPERATOR_TABLE_SIZE - 1;
const OPERATOR_TABLE_SCALE = OPERATOR_TABLE_SIZE / TAU;

function makeWaveformTables(shape) {
  const tables = [];
  const sum = new Float64Array(OPERATOR_TABLE_SIZE);
  for (let harmonic = 1; harmonic <= 64; harmonic++) {
    const odd = harmonic % 2 === 1;
    let gain = 0;
    if (shape === "sawtooth") gain = -2 / (Math.PI * harmonic);
    if (shape === "square" && odd) gain = 4 / (Math.PI * harmonic);
    if (shape === "triangle" && odd) {
      gain = (harmonic % 4 === 1 ? 8 : -8) / (Math.PI * harmonic) ** 2;
    }
    if (gain) {
      for (let i = 0; i < sum.length; i++) {
        const index = (i * harmonic * (SINE_TABLE_SIZE / OPERATOR_TABLE_SIZE)) & SINE_TABLE_MASK;
        sum[i] += gain * SINE_TABLE[index];
      }
    }
    if ((harmonic & (harmonic - 1)) === 0) tables.push(Float32Array.from(sum));
  }
  return tables;
}

const OPERATOR_TABLES = Object.fromEntries(
  ["triangle", "sawtooth", "square"].map(shape => [shape, makeWaveformTables(shape)]),
);

function waveformTable(shape, frequency) {
  if (shape === undefined || shape === "sine") return undefined;
  const bank = OPERATOR_TABLES[shape];
  if (!bank) return undefined;
  // Leave room for modulation sidebands above the unmodulated oscillator.
  const partials = clamp(Math.floor(sampleRate * .38 / Math.max(1, frequency)), 1, 64);
  return bank[31 - Math.clz32(partials)];
}

function oscillatorSample(phase, table) {
  if (!table) return fastSin(phase);
  const position = phase * OPERATOR_TABLE_SCALE;
  const index = Math.floor(position);
  const a = table[index & OPERATOR_TABLE_MASK];
  return a + (table[(index + 1) & OPERATOR_TABLE_MASK] - a) * (position - index);
}

function fastCos(phase) {
  return SINE_TABLE[((phase + Math.PI * .5) * SINE_TABLE_SCALE) & SINE_TABLE_MASK];
}

function fastExpNeg(value) {
  if (value <= 0) return 1;
  if (value >= EXP_TABLE_MAX) return 0;
  return EXP_TABLE[(value * EXP_TABLE_SCALE) | 0];
}

// Genre voices use their own instrument designs; GEMS and visual controls
// continue to vary a patch without changing the MIDI notes.
const GENRE_VOICES = {
  psytrance: {
    bass: { cutoff: [135, 1200], resonance: .70, pulseMix: .34, subMix: .27, duckDepth: .50, amp: [.002,.035,.82,.031] },
    counter_synth: { algorithm: "serial", ratios: [1,2,3,5], indices: [0,.72,.48,.75], analogMix: .91, pulseMix: .65, resonance: .66, amp: [.002,.055,.44,.11] },
    drums: { kick: [53, 133, 22], snareDecay: 23, hatDecay: 1.27 },
  },
  techno: {
    bass: { cutoff: [105, 710], resonance: .84, drive: 2.65, pulseMix: .45, subMix: .36, duckDepth: .57 },
    lead_synth: { algorithm: "feedback", ratios: [1,2,4,6], indices: [0,.46,.25,.50], cutoff: [980,6200], analogMix: .30, pulseMix: .52, fold: .18, amp: [.002,.065,.55,.08], sawWidth: .15, glide: 0 },
    drums: { kick: [48, 156, 12], snareDecay: 21, hatDecay: 1.31 },
  },
  jungle: {
    bass: { cutoff: [115, 690], resonance: .31, analogMix: .42, pulseMix: .06, subMix: .69, drive: 1.35, duckDepth: .25 },
    lead_synth: { algorithm: "parallel", ratios: [1,2,1,4], indices: [0,.32,0,.20], analogMix: .16, pulseMix: .15, sawWidth: .28, amp: [.007,.10,.48,.14], glide: 0 },
    counter_synth: { cutoff: [950,5800], amp: [.012,.14,.50,.29], analogMix: .72, analogDetune: 29 },
    pad: { cutoff: [450,4300], amp: [.11,.32,.78,.48], duckDepth: .18 },
    drums: { kick: [61, 104, 26], snareDecay: 25, hatDecay: 1.44 },
  },
  dubstep: {
    bass: { cutoff: [95, 1300], wobble: .68, pulseMix: .47, subMix: .39, drive: 2.85, resonance: .62, amp: [.003,.06,.83,.09] },
    lead_synth: { cutoff: [1050,8700], analogMix: 1, pulseMix: .40, sawWidth: .43, amp: [.009,.095,.69,.18], glide: .038 },
    pad: { cutoff: [900,5500], amp: [.27,.50,.83,.75], duckDepth: .50 },
    drums: { kick: [43, 176, 11], snareDecay: 11, hatDecay: 1.04 },
  },
  chiptune: {
    lead_synth: { algorithm: "parallel", ratios: [1,2,1,4], indices: [0,.04,0,.03], analogMix: .08, pulseMix: 1.13, analogDetune: 0, sawWidth: 0, unison: 0, glide: 0, vibrato: [0,0], amp: [.003,.036,.68,.045] },
    counter_synth: { algorithm: "parallel", indices: [0,.09,0,.05], analogMix: .10, pulseMix: .97, analogDetune: 0, unison: 0, amp: [.003,.036,.54,.04] },
    bass: { cutoff: [420, 1700], resonance: .14, analogMix: .20, pulseMix: .88, subMix: .02, drive: 1.12, duckDepth: .12, amp: [.003,.035,.72,.043] },
    drums: { kick: [63, 122, 28], snareDecay: 31, hatDecay: 1.62, crush: .29 },
  },
  dark_ambient: {
    pad: { algorithm: "carriers", ratios: [1,1.005,.997,2], indices: [0,0,0,.25], cutoff: [380,2900], amp: [.38,.56,.88,1.1], analogMix: .42, drive: .93, duckDepth: 0 },
    strings: { cutoff: [530,4100], amp: [.38,.61,.82,1.04], vibrato: [.14,3.7], duckDepth: 0 },
    counter_synth: { cutoff: [480,2400], amp: [.023,.34,.37,.9], analogMix: .17, pulseMix: .04 },
    keys_mallet: { ratios: [1,2,4,7], indices: [0,.65,1.05,1.8], amp: [.008,.32,.12,.92], cutoff: [740,3800] },
    guitar: { cutoff: [880,4000], amp: [.015,.19,.32,.65], drive: .95 },
    percussion_texture: { cutoff: [1600,5000], transient: .22, drive: 1.07, fold: .04, crush: .04 },
  },
  synthwave: {
    lead_synth: { analogMix: 1.24, pulseMix: .17, analogDetune: 36, sawWidth: .98, sawBlend: .93, cutoff: [1450,7200], amp: [.035,.15,.78,.29] },
    bass: { cutoff: [145, 1050], resonance: .47, analogMix: .85, pulseMix: .27, subMix: .21, drive: 1.68, duckDepth: .33 },
    drums: { kick: [51, 140, 16], snareDecay: 12, hatDecay: 1.08 },
  },
  garage_2step: {
    keys_mallet: {algorithm:"parallel", ratios:[1,2,3,4], indices:[0,.25,.20,.11],
      amp:[.004,.10,.58,.105], cutoff:[1350,6100], analogMix:.34, pulseMix:.47, level:.25},
    bass: {cutoff:[124,1120], pulseMix:.32, subMix:.74, analogMix:.43, drive:1.65,
      duckDepth:.28, resonance:.46, amp:[.004,.065,.76,.083]},
    drums: {kick:[55,146,20], snareDecay:19, hatDecay:1.42},
  },
  electro_rock: {
    guitar: { algorithm: "branch", ratios: [1,2,3,5], indices: [0,.78,1.20,.64], analogMix: .55, pulseMix: .37, cutoff: [950,4900], amp: [.003,.08,.60,.08], drive: 2.8, comb: .32, transient: .60 },
    lead_synth: { analogMix: .68, pulseMix: .30, sawWidth: .34, amp: [.006,.115,.61,.16], drive: 1.88 },
    bass: { cutoff: [130, 1180], resonance: .27, analogMix: .66, pulseMix: .18, subMix: .49, drive: 1.87, duckDepth: .25 },
    drums: { kick: [57, 113, 21], snareDecay: 17, hatDecay: 1.19 },
  },
};
for (const bank of Object.values(GENRE_VOICES)) {
  for (const [role, patch] of Object.entries(bank)) bank[role] = { ...FACTORY_PATCHES[role], ...patch };
}

function productionPatch(genre, role, production) {
  const base = GENRE_VOICES[genre]?.[role] || (genre ? FACTORY_PATCHES : PATCHES)[role];
  if (!production) return base;
  const {bright, dense, broken, mode, metalBass} = production;
  const minor = mode === "minor";
  if (role === "drums") {
    const kits = {
      jungle: {kick:[56,114,25], kickLevel:.53, snare:[198,21,.49], hatLevel:.18},
      dubstep: {kick:[47,164,16], kickLevel:.67, snare:[174,13,.53], hatLevel:.13},
      synthwave: {kick:[53,116,18], kickLevel:.63, snare:[192,15,.43], hatLevel:.15},
    };
    if (genre==="dubstep" && metalBass) return {...base,kick:[46,186,15],kickLevel:.92,
      snare:[184,17,.88],hatLevel:.19,impactSnare:true};
    return kits[genre] ? {...base,...kits[genre]} : base;
  }
  if (role === "bass") {
    const profiles = {
      jungle: {reese:.71, detune:19, cleanSub:.58, cutoff:[130,1850], resonance:.39, drive:1.9, level:.36, bassSweep:1.6},
      dubstep: {reese:.66, detune:12, cleanSub:.67, cutoff:[110,2350], wobble:.84, resonance:.76, drive:3.3, level:.43, bassSweep:3.3},
      synthwave: {reese:.42, detune:9, cleanSub:.51, cutoff:[150,1450], resonance:.44, drive:2.05, level:.32, bassSweep:.65},
    };
    const patch = {...base,...profiles[genre]};
    return {...patch, metalBass, metalRatio:minor ? (broken ? 3.49 : 2.66) : (broken ? 3.15 : 2.37),
      cutoff:[patch.cutoff[0],patch.cutoff[1] * (bright ? 1.31 : .73) * (minor ? .87 : 1)],
      wobbleRate:broken ? 2.5 : .75, pulseMix:patch.pulseMix * (broken ? 1.27 : .9),
      duckDepth:patch.duckDepth * (dense ? .92 : .72)};
  }
  if (genre === "chiptune" && (role === "lead_synth" || role === "counter_synth")) {
    return mode ? {...base,amp:minor ? [.003,.055,.54,.075] : [...base.amp],
      pulseMix:base.pulseMix*(broken?.72:1),cutoff:base.cutoff.map(hz=>hz*(bright?1.12:.78))} : base;
  }
  const cutoff = base.cutoff.map((hz,i) => hz * (bright ? 1.12 : i ? .69 : .56) * (minor?.87:1));
  const amp = [...base.amp];
  if (broken) {
    amp[0] *= .48;
    amp[3] *= .63;
  } else if (dense) amp[3] *= 1.36;
  return {...base, cutoff, amp, analogDetune:(base.analogDetune || 0) * (dense ? 1.21 : .8),
    indices:base.indices.map(index => index * (bright ? 1.19 : .78) * (minor?1.17:1)),
    unison:(base.unison || 0)*(dense?1.28:.7),
    drive:base.drive*(broken?1.16:.95)};
}

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
  if (value === "artwork") {
    const sustained = role === "pad" || role === "strings";
    const percussion = role === "drums" || role === "percussion_texture";
    const acid = role === "bass";
    return {
      ...Object.fromEntries(BANK_PARAMETERS.map(parameter => [parameter,1])),
      cutoff: acid ? .96 : percussion ? .94 : .78, drive: acid ? 1.10 : .88,
      feedback: acid ? 1.02 : .75, noise: percussion ? .90 : .56, release: sustained ? 1.26 : .99,
      lfo1Rate: acid ? 1.00 : .79, lfo1Depth: sustained ? 1.18 : .86, lfo2Depth: .80,
      detune: sustained ? 1.22 : .99, stereo: sustained ? 1.24 : 1.04, level: .96,
      fold: acid ? .92 : .65, crush: .30, glitch: .35,
    };
  }
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

function bassVolumeGain(voice, time) {
  const { volumeLfoDepth: depth = 0, volumeLfoRate: rate = 2 } = voice.patch || PATCHES.bass;
  if (depth === 0) return 1;
  const beatSeconds = voice.beatSeconds ?? .5;
  const beatAtStart = voice.beatAtStart ?? voice.startFrame / sampleRate / beatSeconds;
  const beat = beatAtStart + time / beatSeconds;
  const phase = TAU * ((beat * rate) % 1);
  return 1 - depth * .5 * (1 - fastCos(phase));
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

// Output zero is the dry stereo mix. Single-output audition hosts still use just that mix.
// Each optional stereo bus receives only the post-filter, post-fader signal sent to it.
function writeSends(outputs, index, left, right, sends) {
  if (sends.delayMix === undefined) {
    outputs[1][0][index] += left * sends.delay;
    outputs[1][1][index] += right * sends.delay;
  } else {
    // The two channels feed independent, hard-panned delay lines.
    const mono = (left + right) * .5 * sends.delay;
    outputs[1][0][index] += mono * (1 - sends.delayMix);
    outputs[1][1][index] += mono * sends.delayMix;
  }
  outputs[2][0][index] += left * sends.reverb;
  outputs[2][1][index] += right * sends.reverb;
  outputs[3][0][index] += left * sends.chorus;
  outputs[3][1][index] += right * sends.chorus;
}

class StreetArtFMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.pendingNotes = [];
    this.presences = new Map();
    this.regionMix = new Map();
    this.expression = new Map();
    this.instrumentPatches = new Map();
    this.drumPatches = new Map();
    this.lastFrequencyByRole = new Map();
    this.frame = 0;
    this.kickEnvelope = 0;
    this.kickDuck = 0;
    this.kickDecay = Math.exp(-1 / (sampleRate * .125));
    this.duckAttack = 1 / (sampleRate * .006);
    this.port.onmessage = (event) => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === "drum-patch" && Object.hasOwn(DRUM_VOICES, message.note)) {
      const note = Number(message.note);
      const values = normalizeDrumPatch(note, message.values);
      if (Object.keys(values).length) {
        this.drumPatches.set(note, normalizeDrumPatch(note, { ...DRUM_DEFAULTS[note], ...values }, { factory: true }));
      } else {
        this.drumPatches.delete(note);
      }
      return;
    }
    if (message.type === "instrument-patch" && Object.hasOwn(PATCHES, message.role)) {
      const values = normalizeFmPatch(message.role, message.values);
      if (Object.keys(values).length) this.instrumentPatches.set(message.role, values);
      else this.instrumentPatches.delete(message.role);
      return;
    }
    if (message.type === "note") {
      const frame = Number.isFinite(message.time)
        ? Math.round(message.time * sampleRate)
        : this.frame + Math.round((Number(message.delay) || 0) * sampleRate);
      if (Number.isFinite(message.time) && frame < this.frame - sampleRate * .08) return;
      if (frame <= this.frame) this.addVoice({ ...message, delay: 0 });
      else {
        this.pendingNotes.push({ frame, message: { ...message, delay: 0 } });
        this.pendingNotes.sort((a, b) => a.frame - b.frame);
      }
    }
    if (message.type === "cancel") {
      this.pendingNotes.length = 0;
      for (const voice of this.voices) voice.stopFrame = this.frame;
    }
    if (message.type === "mix") {
      const active = new Set();
      for (const item of message.regions || []) {
        active.add(String(item.id));
        const id = String(item.id);
        const current = this.regionMix.get(id) || { value: 0, target: 0 };
        current.target = clamp(Number(item.mix) || 0, 0, 1);
        current.cutoffTarget = Number.isFinite(item.scanCutoffHz) ? item.scanCutoffHz : undefined;
        this.regionMix.set(id, current);
      }
      for (const [id, mix] of this.regionMix) {
        if (!active.has(id)) mix.target = 0;
      }
      this.pendingNotes = this.pendingNotes.filter((note) => active.has(String(note.message.regionId || "global")));
    }
    if (message.type === "presence") this.updatePresences(message.regions || []);
    if (message.type === "expression") {
      this.expression = new Map((message.regions || []).map(region => [String(region.id), region.controls]));
    }
    if (message.type === "clear") {
      this.voices.length = 0;
      this.pendingNotes.length = 0;
      this.presences.clear();
      this.expression.clear();
      this.lastFrequencyByRole.clear();
      this.kickEnvelope = 0;
      this.kickDuck = 0;
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
          startFrame: this.frame,
          accentAt: -Infinity,
          acidPhase: 0,
          metalPhase: 0,
          wobbleRate: clamp(Number(item.wobbleRate) || 2, .5, 8),
          acidCutoff: 0,
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

  addVoice(message, onsetFrame = this.frame) {
    const role = PATCHES[message.role] ? message.role : "lead_synth";
    const note = clamp(Number(message.note) || 60, 0, 127);
    const duration = clamp(Number(message.duration) || .25, .025, 12);
    const delay = clamp(Number(message.delay) || 0, 0, 2);
    const visual = message.visual || {};
    const controls = message.controls || {};
    const targetFrequency = midiFrequency(note);
    const drumNote = Math.round(note);
    const drum = role === "drums" && message.kind !== "boundary" ? DRUM_VOICES[drumNote] : null;
    const drumOverrides = drum
      ? this.drumPatches.get(drumNote) ?? (message.genre ? undefined : DRUM_DEFAULTS[drumNote])
      : undefined;
    const overrides = this.instrumentPatches.get(role);
    const drumFilter = drumOverrides && (drumOverrides["cutoff.1"] !== undefined
      || drumOverrides.resonance !== undefined || drumOverrides.drive !== undefined);
    const production = productionPatch(message.genre, role, message.production);
    const base = applyFmPatch(production, overrides);
    const patch = drumFilter ? applyFmPatch(base, Object.fromEntries(
      Object.entries(drumOverrides).filter(([key]) => key === "cutoff.1" || key === "resonance" || key === "drive"),
    )) : base;
    const regionId = String(message.regionId || "global");
    const velocity = clamp(Number(message.velocity) || .7, 0, 1);
    const brightness = clamp(Number(controls.brightness ?? visual.brightness) || 0, 0, 1);
    const harmonicIntensity = clamp(Number(controls.harmonicIntensity) || 0, 0, 1);
    if (role === "bass" && delay === 0) {
      const previous = this.voices.findLast((voice) => voice.role === "bass" && voice.regionId === regionId);
      if (previous) {
        const age = (onsetFrame - previous.startFrame) / sampleRate;
        if (message.slide && previous.stopFrame == null && age >= 0 && age < previous.duration) {
          previous.targetFrequency = targetFrequency;
          previous.glideSeconds = .024;
          previous.targetVelocity = velocity;
          previous.brightness = brightness;
          previous.harmonicIntensity = harmonicIntensity;
          if (message.accent) previous.accentAt = age;
          previous.duration = age + duration;
          previous.endTime = previous.duration + previous.ampSettings[3];
          return;
        }
        if (age >= 0 && age < previous.duration) {
          previous.duration = age;
          previous.endTime = Math.max(age, previous.ampSettings[0] + previous.ampSettings[1]) + previous.ampSettings[3];
        }
      }
    }
    const previousFrequency = this.lastFrequencyByRole.get(role);
    const tableFrequency = patch.glide ? Math.max(targetFrequency, previousFrequency || 0) : targetFrequency;
    const operatorTables = patch.waveforms?.map((shape, index) =>
      waveformTable(shape, tableFrequency * patch.ratios[index] * 1.5));
    const drumWaveform = drumOverrides?.waveform ?? drum?.defaults.waveform;
    const drumBodyTable = drumWaveform ? waveformTable(drumWaveform, note === 36
      ? (drumOverrides?.fundamental ?? patch.kick?.[0] ?? drum.defaults.fundamental)
        + (drumOverrides?.sweep ?? patch.kick?.[1] ?? drum.defaults.sweep)
      : (drumOverrides?.fundamental ?? patch.snare?.[0] ?? drum.defaults.fundamental) + 320) : undefined;
    const beatSeconds = clamp(Number(message.beatSeconds) || .5, .2, 1.5);
    const startedLate = Number.isFinite(message.time)
      ? Math.max(0, onsetFrame / sampleRate - message.time) : 0;
    // Follow the sequencer's beat across retriggers, slides, and seeks.
    const beatAtStart = Number.isFinite(message.onsetBeat)
      ? message.onsetBeat + startedLate / beatSeconds
      : onsetFrame / sampleRate / beatSeconds;
    const percussionEnvelope = message.genre ? production.amp : FACTORY_PATCHES[role].amp;
    const voice = {
      role,
      patch,
      operatorTables,
      drumBodyTable,
      drumSettings: drum?.defaults,
      drumOverrides,
      drumEnvelope: role === "percussion_texture"
        ? patch.amp.some((value, index) => value !== percussionEnvelope[index])
        : role === "drums" && overrides && Object.keys(overrides).some(key => key.startsWith("amp.")),
      drumFilter: drumFilter || (role === "drums" && overrides
        && (overrides["cutoff.1"] !== undefined || overrides.resonance !== undefined || overrides.drive !== undefined)),
      beatSeconds,
      beatAtStart,
      note,
      frequency: patch.glide && previousFrequency ? previousFrequency : targetFrequency,
      targetFrequency,
      glideSeconds: patch.glide || 0,
      velocity,
      targetVelocity: velocity,
      duration,
      regionId,
      pan: clamp(Number(message.pan) || 0, -1, 1) * (role === "bass" || (role === "drums" && note === 36) ? .18 : 1),
      brightness,
      saturation: clamp(Number(controls.harmonicIntensity ?? visual.saturation) || 0, 0, 1),
      texture: clamp(Number(controls.harmonicIntensity ?? visual.texture) || 0, 0, 1),
      hue: controls.harmonicIntensity == null ? clamp(Number(visual.hue) || 0, 0, 1) : .5,
      speed: clamp(Number(controls.movement ?? message.speed) || 0, 0, 1),
      harmonicIntensity,
      expressionPan: clamp(Number(controls.pan ?? .5), 0, 1),
      initialPan: clamp(Number(message.pan) || 0, -1, 1),
      panWidth: role === "bass" || (role === "drums" && note === 36) ? .18 : 1,
      accentAt: message.accent ? 0 : -Infinity,
      acidPhase: 0,
      metalPhase: 0,
      wobbleRate: clamp(Number(message.wobbleRate)||2, .5, 8),
      detunedPhaseA: .17,
      detunedPhaseB: .53,
      acidCutoff: 0,
      sawSide: 0,
      sawSideLow: 0,
      sideSample: 0,
      duckDepth: patch.duckDepth || 0,
      attackControl: clamp(Number(controls.attack) || 0, 0, 1),
      releaseControl: clamp(Number(controls.release) || 0, 0, 1),
      chorus: clamp(Number(controls.chorus) || 0, 0, 1),
      kind: String(message.kind || "note"),
      startFrame: onsetFrame,
      phases: [0, 0, 0, 0],
      unisonPhases: [0, 0],
      analogPhases: [0, .17, .38, .61, .83],
      feedbackSample: 0,
      filterLow: 0,
      filterBand: 0,
      scanLowpass: { main1: 0, main2: 0, side1: 0, side2: 0 },
      formantLow: 0,
      formantBand: 0,
      combBuffer: patch.comb ? new Float32Array(2048) : null,
      combIndex: 0,
      combDamp: 0,
      crushCounter: 0,
      crushValue: 0,
      gemsBank: blendGemsBank(message.gemsWeights, role),
      seed: ((note + 1) * 1103515245 + onsetFrame) >>> 0,
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
    voice.isDrum = role === "drums" || role === "percussion_texture" || voice.kind === "boundary";
    voice.isKick = role === "drums" && note === 36 && voice.kind !== "boundary";
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
    let side = 0;
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
      const pulse = pulseMix > .001 ? bandLimitedPulse(phase, increment, pulseWidth) : 0;
      const weight = activeIndices === ANALOG_TRIO
        ? (slot === 1 ? .44 : .28)
        : ANALOG_WEIGHTS[index];
      const oscillator = (saw * (1 - pulseMix) + pulse * pulseMix) * weight;
      sample += oscillator;
      side += oscillator * ANALOG_OFFSETS[index];
    }
    if (patch.sawWidth && !isPresence) voice.sawSide = side * baseMix;
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

  acidSample(voice, time, amp) {
    const patch = voice.patch || PATCHES.bass;
    const bank = voice.gemsBank;
    voice.velocity += (voice.targetVelocity - voice.velocity) * .006;
    const increment = clamp(voice.frequency / sampleRate, .000001, .45);
    voice.acidPhase += increment;
    if (voice.acidPhase >= 1) voice.acidPhase -= 1;
    const shape = patch.acidWaveform || "sawtooth";
    const saw = shape === "sawtooth" ? bandLimitedSaw(voice.acidPhase, increment)
      : shape === "square" ? bandLimitedPulse(voice.acidPhase, increment, .5)
      : oscillatorSample(TAU * voice.acidPhase, waveformTable(shape, voice.frequency));
    const pulse = bandLimitedPulse(voice.acidPhase, increment, .48);
    const sub = fastSin(TAU * voice.acidPhase);
    if (patch.metalBass) {
      voice.metalPhase = (voice.metalPhase + increment * patch.metalRatio) % 1;
      const basePhase = TAU * voice.acidPhase;
      const metalPhase = TAU * voice.metalPhase;
      const phase = TAU * time * voice.wobbleRate / voice.beatSeconds;
      const gate = Math.pow(.5+.5*fastCos(phase),1.9);
      const sidebands = fastSin(basePhase * 3 + (1.9 + 4.3*voice.harmonicIntensity)*fastSin(metalPhase))
        + .42 * fastSin(basePhase * 5) * fastSin(metalPhase * 2);
      const bite = Math.tanh((sidebands*.71+saw*.22) * 3.6);
      const color = this.filterSample(voice,bite,400+gate*(1500+voice.brightness*1900),
        .52+voice.harmonicIntensity*.35,"bandpass");
      return (.57 * sub + (.08+.82*gate)*color*1.9) * amp * patch.level * bank.level * voice.velocity;
    }
    let sample = saw * patch.analogMix + pulse * patch.pulseMix + (patch.subMix || 0) * sub;
    if (patch.reese) {
      const detune = patch.detune * .00058;
      const incA = increment * (1 - detune);
      const incB = increment * (1 + detune);
      voice.detunedPhaseA = (voice.detunedPhaseA + incA) % 1;
      voice.detunedPhaseB = (voice.detunedPhaseB + incB) % 1;
      sample += (bandLimitedSaw(voice.detunedPhaseA,incA)
        + bandLimitedSaw(voice.detunedPhaseB,incB)) * patch.reese * .5;
    }
    const envelope = fastExpNeg(time * (14 - 7 * voice.harmonicIntensity));
    const accent = fastExpNeg((time - voice.accentAt) * 17);
    const clock = voice.startFrame / sampleRate + time;
    const sweep = .5 + .5 * fastSin(TAU * (patch.bassSweep ?? .17) * clock);
    const wobble = patch.wobble
      ? 1 - patch.wobble * (.5 + .5 * fastCos(TAU * (patch.wobbleRate || 2) * clock / voice.beatSeconds))
      : 1;
    const cutoff = clamp(
      (patch.cutoff[0] + voice.brightness * patch.cutoff[1] + sweep * (patch.bassSweepDepth ?? 360)
        + envelope * (720 + 1750 * voice.harmonicIntensity) + accent * 1250) * bank.cutoff * wobble,
      120, 6600,
    );
    const previousCutoff = voice.acidCutoff || cutoff;
    voice.acidCutoff = previousCutoff + (cutoff - previousCutoff) * .008;
    const frequency = clamp(Math.PI * voice.acidCutoff / sampleRate, .002, .7);
    const damping = 1 - patch.resonance * (.78 + voice.harmonicIntensity * .19);
    for (let step = 0; step < 2; step++) {
      const high = sample - voice.filterLow - damping * voice.filterBand;
      voice.filterBand += frequency * high;
      voice.filterLow += frequency * voice.filterBand;
    }
    const driven = Math.tanh((voice.filterLow * .82 + voice.filterBand * .22) * patch.drive * bank.drive);
    const body = (patch.octaveBody || 0) * fastSin(TAU * voice.acidPhase * 2);
    const output = patch.cleanSub ? driven * .70 + sub * patch.cleanSub * .56 + body : driven;
    return output * amp * patch.level * bank.level * voice.velocity;
  }

  pitchedSample(voice, time) {
    const patch = voice.patch || PATCHES[voice.role] || PATCHES.lead_synth;
    const bank = voice.gemsBank || blendGemsBank(null, voice.role);
    if (voice.glideSeconds && voice.targetFrequency) {
      const glideTime = Math.max(.004, voice.glideSeconds * bank.portamento);
      const glideSmoothing = Math.min(1, 1 / (sampleRate * glideTime));
      voice.frequency += (voice.targetFrequency - voice.frequency) * glideSmoothing;
    }
    const isPresence = voice.kind === "presence";
    const stereoSaw = !isPresence && patch.sawWidth;
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
      if (stereoSaw) voice.sideSample = 0;
      return 0;
    }
    if (voice.role === "bass") return this.acidSample(voice, time, amp) * bassVolumeGain(voice, time);
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
    const modSustain = patch.modSustain ?? (voice.role === "pad" || voice.role === "strings" ? .42 : .04);
    const modAttack = (patch.modAttack ?? .004) * bank.modAttack;
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
    const tables = voice.operatorTables;
    let sample = 0;
    if (patch.algorithm === "serial") {
      if (reducedQuality) {
        sample = oscillatorSample(p[0] + oscillatorSample(p[1], tables?.[1]) * index1, tables?.[0]);
      } else {
        const o4 = oscillatorSample(p[3] + voice.feedbackSample * patch.feedback * bank.feedback, tables?.[3]);
        const o3 = oscillatorSample(p[2] + o4 * index3, tables?.[2]);
        const o2 = oscillatorSample(p[1] + o3 * index2, tables?.[1]);
        sample = oscillatorSample(p[0] + o2 * index1, tables?.[0]);
        voice.feedbackSample = o4;
      }
    } else if (patch.algorithm === "parallel") {
      const a = oscillatorSample(p[0] + oscillatorSample(p[1], tables?.[1]) * index1, tables?.[0]);
      const b = reducedQuality
        ? oscillatorSample(p[2], tables?.[2])
        : oscillatorSample(p[2] + oscillatorSample(p[3], tables?.[3]) * index3, tables?.[2]);
      sample = a * .62 + b * .48;
    } else if (patch.algorithm === "branch") {
      if (reducedQuality) {
        sample = oscillatorSample(p[0] + oscillatorSample(p[1], tables?.[1]) * index1, tables?.[0]);
      } else {
        const branch = oscillatorSample(p[2], tables?.[2]) * index2 + oscillatorSample(p[3], tables?.[3]) * index3;
        const middle = oscillatorSample(p[1] + branch, tables?.[1]);
        sample = oscillatorSample(p[0] + middle * index1, tables?.[0]);
      }
    } else if (patch.algorithm === "carriers") {
      const textured = reducedQuality
        ? oscillatorSample(p[2], tables?.[2])
        : oscillatorSample(p[2] + oscillatorSample(p[3], tables?.[3]) * index3, tables?.[2]);
      sample = oscillatorSample(p[0], tables?.[0]) * .52
        + (reducedQuality ? 0 : oscillatorSample(p[1], tables?.[1]) * .22) + textured * .38;
    } else {
      if (reducedQuality) {
        sample = oscillatorSample(p[0] + oscillatorSample(p[1], tables?.[1]) * index1, tables?.[0]);
      } else {
        const o4 = oscillatorSample(p[3] + voice.feedbackSample * (patch.feedback * bank.feedback + voice.texture * .8), tables?.[3]);
        const o3 = oscillatorSample(p[2] + o4 * index3, tables?.[2]);
        const o2 = oscillatorSample(p[1] + o3 * index2, tables?.[1]);
        sample = oscillatorSample(p[0] + o2 * index1, tables?.[0]);
        voice.feedbackSample = o4;
      }
    }
    const analog = this.analogSample(voice, patch, bank, pitchScale, vibrato, isPresence);
    if (!stereoSaw) sample += analog;
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
    if (stereoSaw) sample = sample * (1 - patch.sawBlend) + analog * patch.sawBlend * 1.38;
    sample = this.combSample(
      voice,
      sample,
      voice.frequency * pitchScale,
      clamp((patch.comb || 0) * bank.comb * (isPresence ? .28 : 1), 0, .86),
      clamp((patch.combFeedback ?? .55) * (.72 + bank.comb * .18), 0, .88),
    );
    const cutoff = clamp(
      (patch.cutoff[0] + (patch.cutoff[1] - patch.cutoff[0]) * voice.brightness ** 1.45)
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
    const level = amp * patch.level * bank.level * voice.velocity;
    if (stereoSaw) {
      voice.sawSideLow += (voice.sawSide - voice.sawSideLow) * clamp(4 * cutoff / sampleRate, .01, .84);
      const side = voice.sawSideLow * patch.sawWidth * patch.sawBlend * 1.8;
      voice.sideSample = side / (1 + Math.abs(side)) * level;
    }
    return driven * level;
  }

  drumSample(voice, time) {
    const note = Math.round(voice.note);
    const velocity = voice.velocity;
    const patch = voice.patch || PATCHES[voice.role] || PATCHES.drums;
    if (voice.kind === "boundary") {
      const env = fastExpNeg(time * 85);
      const metallic = fastSin(TAU * 1700 * time + fastSin(TAU * 2630 * time) * 2.6);
      return this.shapeDrum(voice, metallic * env * .1 * velocity, time, time > .07);
    }
    if (voice.role === "percussion_texture") return this.percussionSample(voice, time);
    const settings = voice.drumSettings;
    const edits = voice.drumOverrides;
    if (note === 36) {
      const base = edits?.fundamental ?? patch.kick?.[0] ?? settings.fundamental;
      const drop = edits?.sweep ?? patch.kick?.[1] ?? settings.sweep;
      const decay = edits?.decay ?? patch.kick?.[2] ?? settings.decay;
      const sweepRate = edits?.sweepRate ?? settings.sweepRate;
      const clickLevel = edits?.click ?? settings.click;
      const level = edits?.level ?? patch.kickLevel ?? settings.level;
      const env = fastExpNeg(time * decay);
      const frequency = base + drop * fastExpNeg(time * sweepRate);
      voice.phases[0] += TAU * frequency / sampleRate;
      const click = (fastSin(TAU * 1490 * time) * .18 + this.random(voice) * .10) * fastExpNeg(time * 155);
      const body = oscillatorSample(voice.phases[0], voice.drumBodyTable) * env;
      voice.finished = time > .48;
      const sample = (body + click * clickLevel) * velocity * level;
      if (voice.drumFilter) return this.shapeDrum(voice, sample, time, voice.finished);
      return Math.tanh(sample * voice.gemsBank.drive) * voice.gemsBank.level;
    }
    if (note === 38) {
      if (patch.snare) {
        const [fundamental, decay, level] = patch.snare;
        const noise = this.random(voice);
        voice.snareLow = (voice.snareLow || 0) + (noise - (voice.snareLow || 0)) * .24;
        const snap = (noise - voice.snareLow) * fastExpNeg(time * (decay + 9));
        const body = oscillatorSample(TAU * fundamental * time + fastSin(TAU * 347 * time) * .7, voice.drumBodyTable)
          * fastExpNeg(time * 19);
        const crack = patch.impactSnare
          ? (noise*.52+fastSin(TAU*385*time)*.20)*fastExpNeg(time*31) : 0;
        return this.shapeDrum(voice, (body * .60 + snap * .68 + crack) * level * velocity, time, time > .45);
      }
      const env = fastExpNeg(time * (edits?.decay ?? (patch.snareDecay || settings.decay)));
      const phase = TAU * (edits?.fundamental ?? settings.fundamental) * time + fastSin(TAU * 317 * time) * 1.4;
      const tone = oscillatorSample(phase, voice.drumBodyTable);
      const noise = this.random(voice) * (edits?.noise ?? settings.noise);
      const sample = (tone * (edits?.body ?? settings.body) + noise) * env * (edits?.level ?? settings.level) * velocity;
      return this.shapeDrum(voice, sample, time, time > .5);
    }
    if (note === 39) {
      const decay = edits?.decay ?? settings.decay;
      const spacing = edits?.spacing ?? settings.spacing;
      const second = .018 * spacing;
      const third = .038 * spacing;
      const pulses = fastExpNeg(time * decay)
        + (time > second ? fastExpNeg((time - second) * (decay + 10)) : 0)
        + (time > third ? fastExpNeg((time - third) * (decay + 20)) : 0);
      return this.shapeDrum(voice, this.random(voice) * pulses * (edits?.level ?? settings.level) * velocity, time, time > .32);
    }
    if (note === 49 && patch.impactSnare) {
      const noise=this.random(voice);
      voice.snareLow=(voice.snareLow||0)+(noise-(voice.snareLow||0))*.28;
      const wash=(noise-voice.snareLow)*.32+fastSin(TAU*4927*time+2.1*fastSin(TAU*1731*time))*.11;
      return this.shapeDrum(voice,wash*fastExpNeg(time*6.6)*velocity,time,time>.82);
    }
    if (note === 42 || note === 46) {
      const decay = edits?.decay ?? (settings.decay * (patch.hatDecay || 1));
      const env = fastExpNeg(time * decay);
      const metalTime = time * (edits?.metalPitch ?? settings.metalPitch);
      const metallic = (
        fastSin(TAU * 2180 * metalTime + voice.phases[0])
        + fastSin(TAU * 3082.52 * metalTime + voice.phases[1])
        + fastSin(TAU * 3771.4 * metalTime + voice.phases[2])
        + fastSin(TAU * 5166.6 * metalTime + voice.phases[3])
      ) * (edits?.metal ?? settings.metal);
      return this.shapeDrum(
        voice,
        (metallic + this.random(voice) * (edits?.noise ?? settings.noise)) * env
          * (edits?.level ?? patch.hatLevel ?? settings.level) * velocity,
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

  percussionSample(voice, time) {
    const { note, patch, velocity } = voice;
    const noise = this.random(voice);
    voice.snareLow = (voice.snareLow || 0) + (noise - (voice.snareLow || 0)) * .25;
    let sample, tail;
    if (note === 42 || note === 46) {
      // Filtered noise gives the shaker a grainy, unpitched sound.
      const attack = Math.min(1, time * 215);
      tail = note === 46 ? .23 : .13;
      sample = (.70 * noise - .52 * voice.snareLow) * attack * fastExpNeg(time * (note === 46 ? 20 : 42)) * .84;
    } else if (note === 37 || note === 39 || note === 38) {
      const rebound = note === 39 && time > .013 ? fastExpNeg((time - .013) * 85) * .46 : 0;
      sample = (noise * .47 + voice.snareLow * .53) * (fastExpNeg(time * 66) + rebound) * .90;
      tail = .12;
    } else {
      // A falling sine with a short noise attack behaves like a struck skin.
      const frequency = (note === 45 ? 178 : 130) + 52 * fastExpNeg(time * 42);
      voice.phases[0] += TAU * frequency / sampleRate;
      sample = fastSin(voice.phases[0]) * fastExpNeg(time * 22) * .82 + noise * fastExpNeg(time * 92) * .33;
      tail = .22;
    }
    const cutoff = patch.cutoff[0] + (patch.cutoff[1] - patch.cutoff[0]) * voice.brightness;
    const filtered = this.filterSample(voice, sample, cutoff, patch.resonance, patch.filterMode);
    voice.finished = time >= tail;
    return Math.tanh(filtered * patch.drive) * velocity * patch.level * voice.gemsBank.level;
  }

  shapeDrum(voice, sample, time, finished) {
    const bank = voice.gemsBank || blendGemsBank(null, voice.role);
    const patch = voice.patch || PATCHES[voice.role] || PATCHES.drums;
    const transient = this.random(voice) * (patch.transient || .4) * bank.transient
      * fastExpNeg(time * 95) * .035;
    const filtered = this.filterSample(
      voice,
      sample + transient,
      clamp(patch.cutoff[1] * bank.cutoff, 600, 16000),
      clamp((patch.resonance ?? .25) * bank.resonance, 0, .9),
      patch.filterMode || "lowpass",
    );
    const shaped = this.digitalShape(voice, filtered, patch, bank, false);
    voice.finished = finished;
    const drive = voice.drumFilter ? patch.drive / PATCHES.drums.drive : 1;
    return Math.tanh(shaped * bank.drive * drive) * bank.level;
  }

  process(_inputs, outputs) {
    if (typeof currentFrame === "number") this.frame = currentFrame;
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    this.renderVoiceCount = this.voices.length + this.presences.size;
    const separateSends = outputs.length === 4;
    const mixSmoothing = 1 / (sampleRate * .028);
    const expressionSmoothing = Math.min(1, left.length / (sampleRate * .042));
    for (const [id, mix] of this.regionMix) {
      mix.value += (mix.target - mix.value) * mixSmoothing * left.length;
      const target = separateSends && this.expression.get(id)?.sends;
      if (target) {
        const sends = mix.sends ??= { ...target };
        sends.delay += (target.delay - sends.delay) * expressionSmoothing;
        sends.reverb += (target.reverb - sends.reverb) * expressionSmoothing;
        sends.chorus += (target.chorus - sends.chorus) * expressionSmoothing;
        if (target.delayMix !== undefined) {
          sends.delayMix ??= target.delayMix;
          sends.delayMix += (target.delayMix - sends.delayMix) * expressionSmoothing;
        }
        if (target.tremolo !== undefined) {
          sends.tremolo ??= target.tremolo;
          sends.tremolo += (target.tremolo - sends.tremolo) * expressionSmoothing;
        }
      }
      if (mix.cutoffTarget === undefined) {
        mix.lowpass = null;
        continue;
      }
      const cutoff = mix.lowpass ??= { hz: mix.cutoffTarget };
      cutoff.hz += (mix.cutoffTarget - cutoff.hz) * expressionSmoothing;
      const angle = TAU * clamp(cutoff.hz, 40, sampleRate * .45) / sampleRate;
      const cosine = Math.cos(angle);
      const alpha = Math.SQRT1_2 * Math.sin(angle);
      const inverse = 1 / (1 + alpha);
      cutoff.b0 = (1 - cosine) * inverse * .5;
      cutoff.a1 = -2 * cosine * inverse;
      cutoff.a2 = (1 - alpha) * inverse;
    }
    for (const voice of this.voices) {
      voice.renderMix = this.regionLevel(voice.regionId);
      voice.scanFilter = this.regionMix.get(voice.regionId)?.lowpass;
      voice.sends = this.regionMix.get(voice.regionId)?.sends;
      const controls = this.expression.get(voice.regionId);
      if (!controls || voice.isDrum) continue;
      const accent = voice.role === "bass" && voice.accentAt >= 0 ? .12 : 0;
      voice.brightness += (clamp(controls.brightness + accent, 0, 1) - voice.brightness) * expressionSmoothing;
      voice.harmonicIntensity += (controls.harmonicIntensity - voice.harmonicIntensity) * expressionSmoothing;
      voice.saturation = voice.texture = voice.harmonicIntensity;
      voice.speed += (controls.movement - voice.speed) * expressionSmoothing;
      voice.chorus += (controls.chorus - voice.chorus) * expressionSmoothing;
      const pan = clamp(voice.initialPan + (controls.pan - voice.expressionPan) * 1.64, -.9, .9) * voice.panWidth;
      voice.pan += (pan - voice.pan) * expressionSmoothing;
      const angle = (voice.pan + 1) * Math.PI / 4;
      voice.panLeft = fastCos(angle);
      voice.panRight = fastSin(angle);
    }
    const presenceSmoothing = 1 / (sampleRate * .045);

    for (let sampleIndex = 0; sampleIndex < left.length; sampleIndex++) {
      let leftSample = 0;
      let rightSample = 0;
      const absoluteFrame = this.frame + sampleIndex;
      while (this.pendingNotes.length && this.pendingNotes[0].frame <= absoluteFrame) {
        const pending = this.pendingNotes.shift();
        this.addVoice(pending.message, absoluteFrame);
        const voice = this.voices.at(-1);
        if (voice) {
          voice.renderMix = this.regionLevel(voice.regionId);
          voice.scanFilter = this.regionMix.get(voice.regionId)?.lowpass;
          voice.sends = this.regionMix.get(voice.regionId)?.sends;
        }
      }
      this.kickEnvelope *= this.kickDecay;
      this.kickDuck += (this.kickEnvelope - this.kickDuck) * this.duckAttack;
      for (let index = this.voices.length - 1; index >= 0; index--) {
        const voice = this.voices[index];
        if (absoluteFrame < voice.startFrame) continue;
        if (voice.isKick && absoluteFrame === voice.startFrame) {
          this.kickEnvelope = Math.max(this.kickEnvelope, voice.velocity * voice.renderMix);
        }
        const time = (absoluteFrame - voice.startFrame) / sampleRate;
        let sample = voice.isDrum ? this.drumSample(voice, time) : this.pitchedSample(voice, time);
        if (voice.drumEnvelope && voice.kind !== "boundary") {
          sample *= envelope(time, voice.duration, voice.ampSettings);
          voice.finished ||= time >= voice.endTime;
        }
        if (voice.finished) {
          this.voices.splice(index, 1);
          continue;
        }
        let side = left === right ? 0 : voice.sideSample;
        const filter = voice.scanFilter;
        if (filter) {
          const memory = voice.scanLowpass;
          const main = filter.b0 * sample + memory.main1;
          memory.main1 = 2 * filter.b0 * sample - filter.a1 * main + memory.main2;
          memory.main2 = filter.b0 * sample - filter.a2 * main;
          sample = main;
          const stereo = filter.b0 * side + memory.side1;
          memory.side1 = 2 * filter.b0 * side - filter.a1 * stereo + memory.side2;
          memory.side2 = filter.b0 * side - filter.a2 * stereo;
          side = stereo;
        }
        const fade = voice.stopFrame == null ? 1 : Math.max(0, 1 - (absoluteFrame - voice.stopFrame) / (sampleRate * .035));
        if (fade === 0) {
          this.voices.splice(index, 1);
          continue;
        }
        let mix = voice.renderMix * (1 - this.kickDuck * voice.duckDepth) * fade;
        const tremolo = voice.sends?.tremolo;
        if (tremolo > 0) {
          const phase = (voice.beatAtStart + time / voice.beatSeconds) * 2;
          mix *= 1 - tremolo * (.5 - .5 * fastCos(TAU * (phase - Math.floor(phase))));
        }
        const l = (sample - side) * voice.panLeft * mix;
        const r = (sample + side) * voice.panRight * mix;
        leftSample += l;
        rightSample += r;
        if (separateSends && voice.sends) writeSends(outputs, sampleIndex, l, r, voice.sends);
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
        const l = presenceSample * fastCos(angle);
        const r = presenceSample * fastSin(angle);
        leftSample += l;
        rightSample += r;
        if (separateSends) {
          const sends = this.regionMix.get(voice.regionId)?.sends;
          if (sends) writeSends(outputs, sampleIndex, l, r, sends);
        }
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
