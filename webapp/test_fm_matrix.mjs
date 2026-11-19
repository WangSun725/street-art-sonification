import fs from "node:fs";
import vm from "node:vm";
import {
  DRUM_DEFAULTS, DRUM_VOICES, FACTORY_PATCHES, PATCHES, applyFmPatch,
  fmDefaultValue, fmGroups, normalizeDrumPatch, normalizeFmPatch, rebasePreset,
} from "./static/fm-patches.mjs";

const workletUrl = new URL("./static/fm-worklet.js", import.meta.url);
const source = fs.readFileSync(workletUrl, "utf8").replace(/^import .*;\n/, "");
const checks = `
if (Object.keys(ROLE_GEMS_PROFILES).length !== 9) throw new Error("Expected 9 instrument roles");
if (!PATCHES.organ || Object.keys(ROLE_GEMS_PROFILES).some(role => !PATCHES[role])) {
  throw new Error("Expected the artwork organ and all audition instrument patches");
}
for (const parameter of ["saw", "pulse", "fold", "crush", "formant", "comb", "pitchEnv", "stereo", "glitch"]) {
  if (!BANK_PARAMETERS.includes(parameter)) throw new Error("Missing hybrid GEMS parameter: " + parameter);
}
for (const [role, patch] of Object.entries(PATCHES)) {
  const hasDigitalLayer = role === "drums"
    ? patch.fold > 0
    : patch.analogMix > 0 || patch.comb > 0 || patch.formant > 0 || patch.fold > 0;
  if (!hasDigitalLayer) throw new Error(role + " has no hybrid digital layer");
}
for (const [role, profile] of Object.entries(ROLE_GEMS_PROFILES)) {
  if (Object.keys(profile).length !== 9) throw new Error(role + " does not have 9 GEMS profiles");
  for (const name of GEMS_DIMENSIONS) {
    if (!profile[name]) throw new Error(role + " is missing " + name);
    const bank = blendGemsBank({ [name]: 1 }, role);
    for (const parameter of BANK_PARAMETERS) {
      if (!Number.isFinite(bank[parameter])) {
        throw new Error(role + "/" + name + "/" + parameter + " is invalid");
      }
    }
  }
}

const leadPeace = blendGemsBank({ peacefulness: 1 }, "lead_synth");
const leadTension = blendGemsBank({ tension: 1 }, "lead_synth");
if (leadPeace.fold === leadTension.fold || leadPeace.glitch === leadTension.glitch) {
  throw new Error("Contrasting GEMS profiles must produce different digital colour");
}

const Processor = globalThis.__processor;
const edited = new Processor();
edited.handleMessage({
  type: "instrument-patch", role: "lead_synth",
  values: { "amp.0": .2, "indices.1": 2.5, "ratios.1": 3 },
});
edited.handleMessage({ type: "note", role: "lead_synth", note: 60, duration: .4 });
edited.handleMessage({ type: "note", role: "pad", note: 60, duration: .4 });
const [editedLead, unchangedPad] = edited.voices;
if (editedLead.patch.amp[0] !== .2 || editedLead.patch.indices[1] !== 2.5 || editedLead.patch.ratios[1] !== 3) {
  throw new Error("FM editor values must reach the playing voice");
}
if (unchangedPad.patch !== PATCHES.pad || PATCHES.lead_synth.amp[0] === .2) {
  throw new Error("FM edits must be isolated to the selected instrument");
}
edited.handleMessage({ type: "instrument-patch", role: "lead_synth", values: {} });
edited.handleMessage({ type: "note", role: "lead_synth", note: 60, duration: .4 });
if (edited.voices.at(-1).patch !== PATCHES.lead_synth) {
  throw new Error("Reset must restore the original instrument patch for new notes");
}

const kit = new Processor();
kit.handleMessage({ type: "drum-patch", note: 42, values: { decay: 14, "cutoff.1": 2200 } });
for (const note of [42, 46]) kit.handleMessage({ type: "note", role: "drums", note });
const [closed, open] = kit.voices;
if (closed.drumOverrides.decay !== 14 || closed.patch.cutoff[1] !== 2200
  || open.drumOverrides !== DRUM_DEFAULTS[46] || open.patch.cutoff[1] !== 15000 || open.drumOverrides.decay !== 7) {
  throw new Error("Drum piece edits must affect only notes of the corresponding piece");
}
kit.handleMessage({ type: "drum-patch", note: 42, values: {} });
kit.handleMessage({ type: "note", role: "drums", note: 42 });
if (kit.voices.at(-1).drumOverrides !== DRUM_DEFAULTS[42] || kit.voices.at(-1).patch !== PATCHES.drums) {
  throw new Error("Reset must restore the project's drum piece");
}

const bassLfo = new Processor();
bassLfo.handleMessage({ type: "note", role: "bass", regionId: "first", note: 36, onsetBeat: 0, beatSeconds: .5 });
bassLfo.handleMessage({ type: "note", role: "bass", regionId: "second", note: 36, onsetBeat: .25, beatSeconds: .5 });
const [onBeatBass, offBeatBass] = bassLfo.voices;
const peak = bassVolumeGain(onBeatBass, 0);
const trough = bassVolumeGain(onBeatBass, .125);
if (peak < .99 || trough > .29 || Math.abs(trough - bassVolumeGain(offBeatBass, 0)) > .002) {
  throw new Error("Bass amplitude must follow the beat across separate note starts");
}
bassLfo.handleMessage({ type: "instrument-patch", role: "bass", values: { volumeLfoDepth: 0 } });
bassLfo.handleMessage({ type: "note", role: "bass", regionId: "third", note: 36, onsetBeat: .25, beatSeconds: .5 });
if (bassVolumeGain(bassLfo.voices.at(-1), 0) !== 1) {
  throw new Error("Turning the Bass LFO depth to zero must restore a constant gain");
}

const timed = new Processor();
timed.handleMessage({ type: "note", role: "lead_synth", note: 60, duration: .2, time: .01 });
timed.handleMessage({ type: "note", role: "pad", note: 64, duration: .2, time: .01 });
const timedBlock = [[new Float32Array(128), new Float32Array(128)]];
for (let block = 0; block < 3; block++) timed.process([], timedBlock);
if (timed.voices.length) throw new Error("Timestamped notes must wait for their sample frame");
timed.process([], timedBlock);
if (timed.voices.length !== 2 || timed.voices.some(voice => voice.startFrame !== 480)) {
  throw new Error("Independent tracks must start on exactly the same sample frame");
}
timed.handleMessage({ type: "note", role: "bass", note: 36, duration: .2, time: .2 });
timed.handleMessage({ type: "cancel" });
if (timed.pendingNotes.length) throw new Error("Transport changes must cancel pending notes");

// Muting one instrument's send must exclude it from that bus even when both play together.
function renderSends(roles) {
  const processor = new Processor();
  const controls = { brightness: .5, harmonicIntensity: .5, movement: 0, chorus: .2, pan: .5 };
  processor.handleMessage({ type: "mix", regions: roles.map(id => ({ id, mix: 1 })) });
  processor.handleMessage({ type: "expression", regions: roles.map(id => ({
    id, controls: { ...controls, sends: { delay: Number(id === "guitar"), reverb: Number(id === "organ"), chorus: 0 } },
  })) });
  for (const role of roles) processor.handleMessage({
    type: "note", regionId: role, role, note: 60, time: .005, duration: .2, velocity: .6, controls, gemsWeights: "artwork",
  });
  let outputs;
  for (let i = 0; i < 16; i++) {
    outputs = Array.from({ length: 4 }, () => [new Float32Array(128), new Float32Array(128)]);
    processor.process([], outputs);
  }
  return outputs;
}
const stems = renderSends(["guitar", "organ"]);
for (const [effect, role] of [[1, "guitar"], [2, "organ"]]) {
  const solo = renderSends([role]);
  for (const channel of [0, 1]) {
    if (!solo[0][channel].some(sample => Math.abs(sample) > .0001) ||
        !stems[effect][channel].every((sample, i) => Math.abs(sample - solo[0][channel][i]) < .000001)) {
      throw new Error("Wet bus contains the wrong instrument: " + role);
    }
  }
}
if (stems[3].some(channel => channel.some(sample => sample !== 0))) throw new Error("Muted chorus send leaked");

for (const role of [...Object.keys(ROLE_GEMS_PROFILES), "organ"]) {
  const processor = new Processor();
  processor.handleMessage({
    type: "note", role, note: role === "drums" ? 36 : 60, duration: .5,
    velocity: .7, gemsWeights: role === "organ" ? "artwork" : { peacefulness: .6, nostalgia: .4 },
    visual: { brightness: .5, saturation: .4, texture: .2, hue: .5 },
    controls: { attack: .5, release: .5, chorus: .4 },
  });
  let energy = 0;
  for (let block = 0; block < 32; block++) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    processor.process([], [[left, right]]);
    for (const sample of [...left, ...right]) {
      if (!Number.isFinite(sample)) throw new Error(role + " produced a non-finite sample");
      energy += Math.abs(sample);
    }
  }
  if (energy <= 0) throw new Error(role + " produced no audio energy");
}

for (const role of Object.keys(ROLE_GEMS_PROFILES)) {
  for (const emotion of GEMS_DIMENSIONS) {
    const processor = new Processor();
    processor.handleMessage({
      type: "note", role, note: role === "drums" ? 38 : 64, duration: .3,
      velocity: .72, gemsWeights: { [emotion]: 1 },
      visual: { brightness: .68, saturation: .58, texture: .52, hue: .34 },
      controls: { attack: .34, release: .46, chorus: .52, harmonicIntensity: .62 },
    });
    let energy = 0;
    for (let block = 0; block < 16; block++) {
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      processor.process([], [[left, right]]);
      for (const sample of [...left, ...right]) {
        if (!Number.isFinite(sample)) throw new Error(role + "/" + emotion + " produced a non-finite sample");
        if (Math.abs(sample) > 1.201) throw new Error(role + "/" + emotion + " exceeded the output limiter");
        energy += Math.abs(sample);
      }
    }
    if (energy <= .00001) throw new Error(role + "/" + emotion + " produced no audio energy");
  }
}

const acid = new Processor();
const bassNote = { type: "note", role: "bass", note: 36, duration: .20, regionId: "paint", velocity: .8 };
acid.handleMessage(bassNote);
const firstBassVoice = acid.voices[0];
const block = [new Float32Array(128), new Float32Array(128)];
for (let index = 0; index < 40; index++) acid.process([], [block]);
const phase = firstBassVoice.acidPhase;
const frame = firstBassVoice.startFrame;
acid.handleMessage({ ...bassNote, note: 48, duration: .09, slide: true });
if (acid.voices.length !== 1 || firstBassVoice.acidPhase !== phase || firstBassVoice.startFrame !== frame) {
  throw new Error("A bass slide must preserve the playing oscillator and its envelope");
}
acid.process([], [block]);
if (!(firstBassVoice.frequency > midiFrequency(36) && firstBassVoice.frequency < midiFrequency(48))) {
  throw new Error("The bass slide must move gradually toward the target pitch");
}
acid.handleMessage({ ...bassNote, note: 43 });
if (acid.voices.at(-1) === firstBassVoice || acid.voices.at(-1).frequency !== midiFrequency(43)) {
  throw new Error("A detached bass note must start on pitch with its own attack");
}

const lead = new Processor();
lead.handleMessage({
  type: "instrument-patch", role: "lead_synth",
  values: rebasePreset({}, fmGroups("lead_synth", { expanded: true }),
    (control, options) => fmDefaultValue("lead_synth", control, options)),
});
lead.handleMessage({ type: "note", role: "lead_synth", note: 60, duration: .6, pan: 0 });
let stereoDifference = 0;
let stereoEnergy = 0;
for (let index = 0; index < 64; index++) {
  lead.process([], [block]);
  for (let sample = 0; sample < 128; sample++) {
    stereoDifference += (block[0][sample] - block[1][sample]) ** 2;
    stereoEnergy += block[0][sample] ** 2 + block[1][sample] ** 2;
  }
}
if (stereoDifference / stereoEnergy < .05) throw new Error("A centered Supersaw must retain stereo spread");

const continuous = new Processor();
continuous.handleMessage({type:"note", regionId:"paint", role:"pad", note:60, duration:2,
  controls:{brightness:.12,harmonicIntensity:.18,movement:.05,pan:.5}});
const held = continuous.voices[0];
continuous.handleMessage({type:"expression", regions:[{id:"paint",
  controls:{brightness:.9,harmonicIntensity:.8,movement:.75,pan:.85,chorus:.6}}]});
for(let index=0;index<64;index++)continuous.process([], [block]);
if(continuous.voices.length!==1 || continuous.voices[0]!==held || held.note!==60
  || held.brightness<.8 || held.harmonicIntensity<.7 || held.pan<.45){
  throw new Error("A held note must follow image expression without restarting or changing pitch");
}

for (const delayMix of [0, .25, 1]) {
  const buses = Array.from({ length: 4 }, () => [new Float32Array(1), new Float32Array(1)]);
  writeSends(buses, 0, 1, 1, { delay: .5, delayMix, reverb: .25, chorus: .125 });
  if (buses[1][0][0] !== .5 * (1 - delayMix) || buses[1][1][0] !== .5 * delayMix) {
    throw new Error("Delay Mix must distribute a fixed send between the two delay channels");
  }
  if (buses[2][0][0] !== .25 || buses[3][0][0] !== .125) {
    throw new Error("Delay Mix must not affect the monitored reverb and chorus sends");
  }
}

console.log("FM matrix: 81 cells, " + BANK_PARAMETERS.length + " parameters, DSP OK");
`;

const context = {
  DRUM_DEFAULTS, DRUM_VOICES, FACTORY_PATCHES, PATCHES, applyFmPatch, normalizeDrumPatch, normalizeFmPatch,
  fmDefaultValue, fmGroups, rebasePreset,
  sampleRate: 48000,
  AudioWorkletProcessor: class {
    constructor() { this.port = { onmessage: null }; }
  },
  registerProcessor: (_name, processorClass) => { context.__processor = processorClass; },
  console,
};

vm.createContext(context);
vm.runInContext(source + checks, context);
