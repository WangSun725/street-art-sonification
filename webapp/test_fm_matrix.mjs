import fs from "node:fs";
import vm from "node:vm";
import {
  DRUM_DEFAULTS, DRUM_VOICES, FACTORY_PATCHES, PATCHES, OPERATOR_ADSR_DEFAULTS, OPERATOR_FIXED_HZ, applyFmPatch,
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
const brightFilter = new Processor();
const filterVoice = { filterLow: 0, filterBand: 0 };
for (let index = 0; index < 12000; index++) {
  const output = brightFilter.filterSample(filterVoice, index === 0 ? 1 : 0, 15000, .09, "lowpass");
  if (!Number.isFinite(output) || Math.abs(output) > 2) throw new Error("Bright, low-resonance patches must stay stable");
}
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

const independent = new Processor();
independent.handleMessage({ type: "instrument-patch", role: "lead_synth", values: {
  "operatorEnvelope.0": "adsr", "operatorAttack.0": .02, "operatorSustain.0": .8,
  "operatorEnvelope.1": "adsr", "operatorAttack.1": .10, "operatorSustain.1": .6, "operatorRelease.1": .05,
  "operatorTuning.1": "fixed", "operatorHz.1": 317, "operatorGain.2": 0,
} });
for (const note of [60, 72]) independent.handleMessage({
  type: "note", role: "lead_synth", note, duration: .45, gemsWeights: "artwork",
});
const [lower, upper] = independent.voices;
for (const voice of independent.voices) {
  const { patch } = voice;
  if (operatorGainAt(voice, patch, 0, .02) !== 1 || Math.abs(operatorGainAt(voice, patch, 1, .02) - .2) > 1e-8
    || operatorGainAt(voice, patch, 1, .501) !== 0 || operatorGainAt(voice, patch, 0, .501) <= 0
    || operatorGainAt(voice, patch, 2, .10) !== 0) {
    throw new Error("Each operator must have its own ADSR and gain");
  }
  independent.operatorPhases(voice, patch, .02);
  if (Math.abs(voice.phases[1] - TAU * 317 / sampleRate) > 1e-8
    || !(voice.endTime > voice.duration) || envelope(voice.endTime + 1e-6, voice.duration, voice.ampSettings) !== 0) {
    throw new Error("Fixed tuning must be independent of key and vibrato, and the total envelope must still end the note");
  }
}
if (!(upper.phases[0] > lower.phases[0])) throw new Error("Ratio operators must still track the note");
upper.reducedQuality = true;
const fourthPhase = upper.phases[3];
independent.operatorPhases(upper, upper.patch, 0);
if (upper.phases[3] === fourthPhase) throw new Error("Edited operators must remain active when the mix is busy");

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

const tomKit = new Processor();
tomKit.handleMessage({ type: "drum-patch", note: 50, values: { fundamental: 166 } });
for (const note of [43, 47, 50]) tomKit.handleMessage({ type: "note", role: "drums", note, duration: .06 });
const tomBlock = [new Float32Array(128), new Float32Array(128)];
tomKit.process([], [tomBlock]);
const [lowTom, midTom, highTom] = tomKit.voices;
if (tomKit.voices.some(voice => voice.drumSettings.kind !== "tom") ||
    !(lowTom.phases[0] < midTom.phases[0] && midTom.phases[0] < highTom.phases[0]) ||
    highTom.drumOverrides.fundamental !== 166 || lowTom.drumOverrides || midTom.drumOverrides ||
    !tomBlock[0].some(sample => Math.abs(sample) > .0001)) {
  throw new Error("The three toms must have distinct pitches and independently editable patches");
}

function measureKick(overrides) {
  const processor = new Processor();
  if (overrides) processor.handleMessage({ type: "drum-patch", note: 36, values: overrides });
  processor.handleMessage({ type: "note", role: "drums", note: 36, duration: .12, velocity: .87, gemsWeights: "artwork" });
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  let attackPeak = 0;
  let tailEnergy = 0;
  const attack = new Float32Array(1024);
  for (let start = 0; start < sampleRate * .2; start += left.length) {
    processor.process([], [[left, right]]);
    if (start < attack.length) attack.set(left, start);
    for (const [index, sample] of left.entries()) {
      const time = (start + index) / sampleRate;
      if (time < .035) attackPeak = Math.max(attackPeak, Math.abs(sample));
      if (time >= .11 && time < .2) tailEnergy += sample * sample;
    }
  }
  return { attackPeak, tailEnergy, attack };
}
const originalKick = measureKick(DRUM_VOICES[36].defaults);
const defaultKick = measureKick();
if (defaultKick.attackPeak < originalKick.attackPeak * .8 || defaultKick.tailEnergy > originalKick.tailEnergy * .09) {
  throw new Error("The default kick must retain the attack while reducing sustained low-frequency ringing");
}
const withoutClick = measureKick({ click: 0 });
let clickEnergy = 0;
let toneReal = 0;
let toneImaginary = 0;
for (const [index, sample] of defaultKick.attack.entries()) {
  const value = (sample - withoutClick.attack[index]) * Math.sin(Math.PI * index / defaultKick.attack.length) ** 2;
  const phase = 2 * Math.PI * 1490 * index / sampleRate;
  clickEnergy += value * value;
  toneReal += value * Math.cos(phase);
  toneImaginary += value * Math.sin(phase);
}
const pitchedEnergy = 2 * (toneReal ** 2 + toneImaginary ** 2) / defaultKick.attack.length;
if (clickEnergy < .005 || pitchedEnergy > .1 * clickEnergy) {
  throw new Error("The kick's beater must produce an audible click without the old 1.49 kHz tone");
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

const barChange = new Processor();
barChange.handleMessage({ type: "mix", regions: [{ id: "lead", mix: 1 }] });
barChange.handleMessage({ type: "note", role: "lead_synth", regionId: "lead", note: 60, duration: 1, reverseTake: false });
barChange.handleMessage({ type: "music-bar", time: 64 / sampleRate, reverse: false });
barChange.handleMessage({ type: "music-bar", time: 192 / sampleRate, reverse: true });
barChange.handleMessage({ type: "note", role: "lead_synth", regionId: "lead", note: 62, duration: 1,
  time: 192 / sampleRate, reverseTake: true });
barChange.handleMessage({ type: "mix", regions: [{ id: "lead", mix: 1 }] });
barChange.process([], timedBlock);
if (barChange.voices[0].stopFrame != null) throw new Error("Same-take notes must sustain across a bar");
barChange.process([], timedBlock);
if (barChange.voices[0].stopFrame !== 192 || barChange.voices[1]?.startFrame !== 192
  || barChange.voices[1].stopFrame != null) {
  throw new Error("A take change must release the old lead exactly when the new take starts");
}

const turnaround = new Processor();
for (const role of ["lead_synth", "bass", "pad"]) {
  turnaround.addVoice({ role, note: role === "bass" ? 36 : 60, duration: .5, chordDegree: 1, reverseTake: false }, 0);
}
const [oldLead, oldBass, oldPad] = turnaround.voices;
turnaround.startScheduledMessage({ type: "music-bar", turnaround: true, reverse: true, chordDegree: 1 }, 192);
turnaround.addVoice({ role: "lead_synth", note: 62, leadLegato: true, reverseTake: true, duration: .5 }, 192);
turnaround.addVoice({ role: "bass", note: 36, turnaroundBass: true, reverseTake: true, duration: .5 }, 192);
if (oldLead.stopFrame !== 192 || oldLead.stopFadeSeconds !== .12
  || oldBass.stopFrame !== 192 || oldBass.stopFadeSeconds !== .04 || !turnaround.voices.at(-1).turnaroundBass
  || oldPad.stopFrame != null) {
  throw new Error("At a scan turn, the outgoing lead and bass must fade and an unchanged chord must retain its tail");
}
turnaround.startScheduledMessage({ type: "music-bar", turnaround: true, reverse: false, chordDegree: 4 }, 384);
if (oldPad.stopFrame !== 384) throw new Error("A new chord at a scan turn must release the old pad");

const shortEnvelope = [.20, .24, .6, .18];
if (Math.abs(envelope(.10, .10, shortEnvelope) - .5) > 1e-9
  || Math.abs(envelope(.19, .10, shortEnvelope) - .25) > 1e-9
  || envelope(.29, .10, shortEnvelope) !== 0) {
  throw new Error("Releasing a short note during its attack must start from its current level");
}
const gazeTake = new Processor();
gazeTake.addVoice({ role: "lead_synth", regionId: "lead", note: 60, reverseTake: true, duration: 1 }, 0);
gazeTake.addVoice({ role: "pad", regionId: "pad", note: 48, reverseTake: true, duration: 1 }, 0);
gazeTake.startScheduledMessage({ type: "music-bar", reverse: true, gazeTake: { role: "lead_synth", reverse: false } }, 128);
gazeTake.addVoice({ role: "lead_synth", regionId: "lead", note: 64, reverseTake: false, duration: 1 }, 128);
gazeTake.startScheduledMessage({ type: "music-bar", reverse: true, gazeTake: { role: "lead_synth", reverse: false } }, 256);
if (gazeTake.voices[0].stopFrame !== 128 || gazeTake.voices[1].stopFrame != null
  || gazeTake.voices[2].stopFrame != null) {
  throw new Error("A gaze take must release only the old lead and sustain the new lead across a bar");
}
gazeTake.startScheduledMessage({ type: "music-bar", reverse: true }, 384);
if (gazeTake.voices[2].stopFrame !== 384 || gazeTake.voices[1].stopFrame != null) {
  throw new Error("Clearing the gaze take must return only the lead to the scan's take");
}

const sharedChord = new Processor();
sharedChord.handleMessage({ type: "mix", regions: [{ id: "organ", mix: 1 }, { id: "lead", mix: 1 }] });
sharedChord.handleMessage({ type: "note", role: "organ", regionId: "organ", note: 60, duration: 1,
  reverseTake: false, chordDegree: 1 });
sharedChord.handleMessage({ type: "note", role: "lead_synth", regionId: "lead", note: 64, duration: 1,
  reverseTake: false, chordDegree: 1 });
sharedChord.handleMessage({ type: "music-bar", time: 64 / sampleRate, reverse: false, chordDegree: 1 });
sharedChord.handleMessage({ type: "music-bar", time: 192 / sampleRate, reverse: false, chordDegree: 6 });
sharedChord.process([], timedBlock);
if (sharedChord.voices[0].stopFrame != null) throw new Error("Repeated chords should retain their tails");
sharedChord.process([], timedBlock);
if (sharedChord.voices[0].stopFrame !== 192 || sharedChord.voices[1].stopFrame != null) {
  throw new Error("Chord parts must release when the chord changes, while the held lead carries through");
}

const accompanimentChange = new Processor();
accompanimentChange.handleMessage({ type: "mix", regions: [{ id: "extra-pad", mix: .30 }, { id: "figure", mix: 1 }] });
accompanimentChange.handleMessage({ type: "note", role: "pad", regionId: "extra-pad", accompaniment: true, note: 60, duration: 1 });
accompanimentChange.handleMessage({ type: "note", role: "lead_synth", regionId: "figure", note: 67, duration: 1 });
accompanimentChange.handleMessage({ type: "music-bar", time: 192 / sampleRate, accompaniment: [] });
accompanimentChange.process([], timedBlock);
if (accompanimentChange.voices[0].stopFrame != null) throw new Error("Accompaniment must sustain until the bar boundary");
accompanimentChange.process([], timedBlock);
if (accompanimentChange.voices[0].stopFrame !== 192 || accompanimentChange.voices[0].stopFadeSeconds !== .07
    || accompanimentChange.voices[1].stopFrame != null) {
  throw new Error("Only departing accompaniment should fade at the scheduled bar boundary");
}

const legatoLead = new Processor();
const leadNote = { role: "lead_synth", leadLegato: true, regionId: "legato", reverseTake: false,
  duration: .125, gemsWeights: "artwork" };
legatoLead.addVoice({ ...leadNote, note: 60, onsetBeat: 0, legatoToBeat: .25 }, 0);
const originalLead = legatoLead.voices[0];
legatoLead.addVoice({ ...leadNote, note: 62, onsetBeat: .25, legatoToBeat: .5 }, .125 * sampleRate);
if (legatoLead.voices.length !== 1 || originalLead.note !== 62 || originalLead.startFrame !== 0
 || originalLead.frequency !== midiFrequency(60) || originalLead.targetFrequency !== midiFrequency(62)) {
  throw new Error("Connected lead notes must retune a held voice without restarting it");
}
for (let i = 0; i <= Math.ceil(.006 * sampleRate); i++) legatoLead.pitchedSample(originalLead, .125 + i / sampleRate);
if (originalLead.frequency !== midiFrequency(62) || originalLead.leadGlide) {
  throw new Error("Stepwise lead glide must settle exactly on pitch within six milliseconds");
}
legatoLead.addVoice({ ...leadNote, note: 67, onsetBeat: .5 }, .25 * sampleRate);
if (legatoLead.voices.length !== 1 || originalLead.frequency !== midiFrequency(67) || originalLead.leadGlide) {
  throw new Error("Wide lead intervals must change pitch immediately without restarting a connected note");
}
legatoLead.addVoice({ ...leadNote, note: 64, onsetBeat: .8 }, .4 * sampleRate);
if (legatoLead.voices.length !== 2 || legatoLead.voices[1].frequency !== midiFrequency(64)
 || legatoLead.voices[1].glideSeconds !== 0) {
  throw new Error("The first note after a rest must start directly on its own pitch");
}
if (originalLead.stopFrame !== .4 * sampleRate || originalLead.stopFadeSeconds !== .012) {
  throw new Error("A previous lead pitch must fade quickly when the next note starts");
}

const carrierCheck = new Processor();
carrierCheck.handleMessage({ type: "instrument-patch", role: "lead_synth", values: { "vibrato.0": .6 } });
carrierCheck.addVoice({ ...leadNote, note: 69, controls: { chorus: 1, movement: 1 } }, 0);
const carrier = carrierCheck.voices[0];
for (let frame = 1; frame < .12 * sampleRate; frame++) {
  const previousPhase = carrier.phases[0];
  carrierCheck.pitchedSample(carrier, frame / sampleRate);
  const carrierHz = ((carrier.phases[0] - previousPhase + TAU) % TAU) * sampleRate / TAU;
  if (Math.abs(1200 * Math.log2(carrierHz / 440)) > 4.2) {
    throw new Error("Lead carrier must stay within four cents of its target through attack and vibrato");
  }
}

// Muting one instrument's send must exclude it from that bus even when both play together.
function renderSends(roles, { sends, notes } = {}) {
  const processor = new Processor();
  const controls = { brightness: .5, harmonicIntensity: .5, movement: 0, chorus: .2, pan: .5 };
  processor.handleMessage({ type: "mix", regions: roles.map(id => ({ id, mix: 1 })) });
  processor.handleMessage({ type: "expression", regions: roles.map(id => ({
    id, controls: { ...controls, sends: sends ?? { delay: Number(id === "guitar"), reverb: Number(id === "organ"), chorus: 0 } },
  })) });
  for (const role of roles) {
    for (const note of notes?.[role] ?? [60]) processor.handleMessage({
      type: "note", regionId: role, role, note, time: .005, duration: .2, velocity: .6, controls, gemsWeights: "artwork",
    });
  }
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

const sendsOn = { delay: .7, delayMix: .3, reverb: .8, chorus: .5 };
for (const role of ["drums", "bass"]) {
  const [dry, delay, reverb, chorus] = renderSends([role], { sends: sendsOn, notes: { [role]: [36] } });
  if ([...delay, ...reverb].some(channel => channel.some(sample => sample !== 0)) ||
      [dry, chorus].some(bus => !bus[0].some(sample => Math.abs(sample) > .0001))) {
    throw new Error(role + " note 36 must bypass delay and reverb while feeding the dry and chorus buses");
  }
}
const drumSends = notes => renderSends(["drums"], { sends: sendsOn, notes: { drums: notes } });
const otherDrums = drumSends([38, 42]);
const wholeKit = drumSends([36, 38, 42]);
for (const bus of [1, 2]) {
  if (!otherDrums[bus][0].some(sample => Math.abs(sample) > .0001) ||
      wholeKit[bus].some((samples, channel) => samples.some((sample, index) => sample !== otherDrums[bus][channel][index]))) {
    throw new Error("Kick must leave the other drum pieces' delay and reverb sends intact");
  }
}

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
lead.handleMessage({ type: "note", role: "lead_synth", note: 60, duration: .6, pan: 0, fixedPan: true });
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

for (const [role, note, pan] of [
  ["bass", 36, 0], ["drums", 36, 0], ["drums", 38, 0], ["drums", 42, -.20],
  ["guitar", 60, -.36], ["keys_mallet", 60, .32], ["percussion_texture", 39, .42],
]) {
  const processor = new Processor();
  processor.handleMessage({ type: "note", regionId: "test", role, note, pan, fixedPan: true,
    duration: .4, gemsWeights: "artwork" });
  processor.handleMessage({ type: "expression", regions: [{ id: "test", controls: { pan: 1 } }] });
  const energy = [0, 0];
  for (let index = 0; index < 24; index++) {
    processor.process([], [block]);
    for (const channel of [0, 1]) {
      for (const sample of block[channel]) energy[channel] += sample ** 2;
    }
  }
  const [left, right] = energy;
  if (processor.voices[0]?.pan !== pan || left + right === 0
    || (pan === 0 && Math.abs(left - right) / (left + right) > .01)
    || (pan < 0 && left <= right) || (pan > 0 && right <= left)) {
    throw new Error(role + "/" + note + " must keep its stereo placement while expression changes");
  }
}

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

function renderHeldPad(extraVoices) {
  const synth = new Processor();
  const channels = [new Float32Array(128), new Float32Array(128)];
  synth.handleMessage({ type: "mix", regions: [{ id: "muted", mix: 0 }] });
  synth.handleMessage({ type: "note", role: "pad", regionId: "audible", note: 66, duration: 1 });
  for (let i = 0; i < 100; i++) synth.process([], [channels]);
  for (let i = 0; i < extraVoices; i++) {
    synth.handleMessage({ type: "note", role: "keys_mallet", regionId: "muted", note: 48 + i });
  }
  synth.process([], [channels]);
  return channels[0];
}
const heldPad = renderHeldPad(0);
const renderWithMutedNotes = renderHeldPad(12);
if (heldPad.some((sample, i) => sample !== renderWithMutedNotes[i])) {
  throw new Error("Additional muted notes must not change the waveform of a note already playing");
}

for (const delayMix of [0, .25, 1]) {
  const buses = Array.from({ length: 4 }, () => [new Float32Array(1), new Float32Array(1)]);
  writeSends(buses, 0, 1, 1, { delay: .5, delayMix, reverb: .25, chorus: .125 }, { role: "lead_synth" });
  if (buses[1][0][0] !== .5 * (1 - delayMix) || buses[1][1][0] !== .5 * delayMix) {
    throw new Error("Delay Mix must distribute a fixed send between the two delay channels");
  }
  if (buses[2][0][0] !== .25 || buses[3][0][0] !== .125) {
    throw new Error("Delay Mix must not affect the monitored reverb and chorus sends");
  }
}

const stemRoles = ["lead_synth", "counter_synth", "drums", "bass", "guitar", "pad", "organ", "keys_mallet", "percussion_texture"];
for (const [slot, role] of stemRoles.entries()) {
  const processor = new Processor({ processorOptions: { stemRoles } });
  const buses = Array.from({ length: 4 + stemRoles.length }, () => [new Float32Array(128), new Float32Array(128)]);
  processor.handleMessage({ type: "stems", enabled: true });
  processor.handleMessage({ type: "note", role, note: role === "drums" ? 38 : 60, duration: .3 });
  let peak = 0;
  for (let index = 0; index < 16; index++) {
    for (const bus of buses) for (const channel of bus) channel.fill(0);
    processor.process([], buses);
    for (const [port, bus] of buses.entries()) {
      if (port < 4) continue;
      for (const [channel, samples] of bus.entries()) {
        if (port === slot + 4) {
          for (const [frame, sample] of samples.entries()) {
            peak = Math.max(peak, Math.abs(sample));
            if (Math.abs(sample - buses[0][channel][frame]) > 1e-6) {
              throw new Error(role + " stem must match the corresponding sound in the dry mix");
            }
          }
        } else if (samples.some(Boolean)) {
          throw new Error(role + " leaked into another instrument's stem");
        }
      }
    }
  }
  if (peak === 0) throw new Error(role + " has no stem output");
}

function renderBassSidechain(drumNote, drumMix = .72) {
  const processor = new Processor({ processorOptions: { stemRoles: ["bass", "guitar"] } });
  const buses = Array.from({ length: 6 }, () => [new Float32Array(128), new Float32Array(128)]);
  const bass = new Float32Array(128 * 128);
  const guitar = new Float32Array(bass.length);
  processor.handleMessage({ type: "stems", enabled: true });
  processor.handleMessage({ type: "mix", regions: [
    { id: "bass", mix: 1 }, { id: "guitar", mix: 1 }, { id: "kit", mix: drumMix },
  ] });
  for (const role of ["bass", "guitar"]) {
    processor.handleMessage({ type: "note", role, note: role === "bass" ? 36 : 60,
      duration: .4, regionId: role, gemsWeights: "artwork" });
  }
  if (drumNote) {
    processor.handleMessage({ type: "note", role: "drums", note: drumNote, time: .10,
      duration: .12, velocity: .88, regionId: "kit", gemsWeights: "artwork" });
  }
  for (let frame = 0; frame < bass.length; frame += 128) {
    for (const bus of buses) for (const channel of bus) channel.fill(0);
    processor.process([], buses);
    bass.set(buses[4][0], frame);
    guitar.set(buses[5][0], frame);
  }
  return { bass, guitar };
}

const drySidechain = renderBassSidechain();
const keyedSidechain = renderBassSidechain(36);
const hatSidechain = renderBassSidechain(42);
const mutedSidechain = renderBassSidechain(36, 0);
let strongestDuck = 1;
for (const [frame, sample] of drySidechain.bass.entries()) {
  if (sample !== hatSidechain.bass[frame] || sample !== mutedSidechain.bass[frame]
    || drySidechain.guitar[frame] !== keyedSidechain.guitar[frame]) {
    throw new Error("Bass sidechain must respond only to an audible kick and affect only Bass");
  }
  if (Math.abs(sample) < .0001) continue;
  const gain = keyedSidechain.bass[frame] / sample;
  strongestDuck = Math.min(strongestDuck, gain);
  if (gain < 10 ** (-2.5 / 20) - .001 || gain > 1.001) {
    throw new Error("Bass sidechain must stay within its gain reduction limit");
  }
  if (frame < .10 * sampleRate && gain !== 1 || frame > .26 * sampleRate && gain < .97) {
    throw new Error("Bass sidechain must start on the kick and release quickly");
  }
}
if (strongestDuck > .85) throw new Error("An audible kick should briefly lower Bass");

console.log("FM matrix: 81 cells, " + BANK_PARAMETERS.length + " parameters, DSP OK");
`;

const context = {
  DRUM_DEFAULTS, DRUM_VOICES, FACTORY_PATCHES, PATCHES, OPERATOR_ADSR_DEFAULTS, OPERATOR_FIXED_HZ,
  applyFmPatch, normalizeDrumPatch, normalizeFmPatch,
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
