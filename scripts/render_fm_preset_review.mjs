import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as fm from "../webapp/static/fm-patches.mjs";
import { bankPatchValues, fmTakePatches, readPresetBank, snapshotBankPreset } from "../webapp/static/fm-preset-bank.mjs";
import { reviewPresets } from "../webapp/static/fm-review-presets.mjs";
import { roundTwoPresets } from "../webapp/static/fm-review-presets-round2.mjs";
import { roundThreePresets } from "../webapp/static/fm-review-presets-round3.mjs";
import { retainedFromRoundThree, roundFourPresets } from "../webapp/static/fm-review-presets-round4.mjs";
import { leadReviewPresets } from "../webapp/static/fm-review-presets-lead.mjs";
import currentGains from "../webapp/static/fm-performance-gains.mjs";

const sampleRate = 48000;
const beatSeconds = .5;
const roundTwo = process.argv[2] === "--round2";
const roundThree = process.argv[2] === "--round3";
const roundFour = process.argv[2] === "--round4";
const leadReview = process.argv[2] === "--lead-review";
const levelMatchedReview = roundThree || roundFour || leadReview;
const calibrate = process.argv[2] === "--calibrate";
const calibrateLead = process.argv[2] === "--calibrate-lead";
const auditCalibration = process.argv[2] === "--audit-calibration";
const sourcePresets = roundTwo ? roundTwoPresets : reviewPresets;
const output = new URL(
  `../webapp/runtime/fm-preset-review${leadReview ? "-lead" : roundFour ? "-round4" : roundThree ? "-round3" : roundTwo ? "-round2" : ""}/audio/`, import.meta.url,
);
const staticDir = new URL("../webapp/static/", import.meta.url);
const loadPerformanceBank = () => readPresetBank(JSON.parse(fs.readFileSync(new URL("fm-performance-bank.json", staticDir), "utf8")));
const groupForPreset = preset => preset.note ?? preset.role;
const worklet = fs.readFileSync(new URL("../webapp/static/fm-worklet.js", import.meta.url), "utf8").replace(/^import .*;\n/, "");
const bindings = [
  "DRUM_DEFAULTS", "DRUM_VOICES", "FACTORY_PATCHES", "PATCHES", "applyFmPatch", "normalizeDrumPatch", "normalizeFmPatch",
];
const Processor = new Function(...bindings, "sampleRate", "AudioWorkletProcessor", "registerProcessor",
  worklet + "\nreturn StreetArtFMProcessor;")(
  ...bindings.map(key => fm[key]), sampleRate, class { constructor() { this.port = {}; } }, () => {},
);

// Beat, note(s), length in beats and velocity. Each group uses one fixed performance.
const phrases = {
  lead_synth: [[0, 60, .75, .84], [1, 63, .48, .74], [1.75, 67, .62, .82],
    [2.5, 70, 1.32, .85], [4, 67, .6, .78], [4.75, 65, .58, .76], [5.5, 60, 1.7, .85]],
  counter_synth: [60, 63, 67, 70, 72, 70, 67, 63, 56, 60, 63, 67, 68, 67, 63, 60]
    .map((note, index) => [index * .41 + (index > 7 ? .45 : 0), note, .31, index % 4 === 0 ? .85 : .72]),
  bass: [[0, 36, 1.1, .87], [1.25, 36, .64, .72], [2, 43, .7, .81], [2.75, 36, .9, .77],
    [4, 32, 1.65, .85], [5.5, 39, .51, .8, true], [6.25, 36, 1.22, .82]],
  guitar: [[0, 55, .44, .8], [.5, 60, .46, .73], [1, 63, .62, .83], [1.75, 67, .66, .74],
    [2.5, [55, 60, 63, 67], 1.2, .69], [4, [56, 60, 63, 68], 1.5, .71], [6, 67, .51, .82]],
  pad: [[0, [48, 55, 60, 63], 4.75, .72], [5, [44, 55, 60, 63], 4.2, .72]],
  organ: [[0, [55, 60, 63], .53, .74], [.75, [55, 60, 63], .57, .71],
    [1.75, [55, 60, 63], 1.65, .74], [4, [56, 60, 63], 1.28, .76], [5.5, [56, 60, 65], 1.2, .72]],
  keys_mallet: [[0, 60, .78, .82], [1, 67, .48, .68], [1.75, 72, .67, .79],
    [2.75, [60, 63, 67], .8, .7], [4, 63, .55, .72], [4.75, 67, .59, .82], [5.75, [56, 60, 63], 1.33, .74]],
  percussion_texture: [[0, 42, .25, .81], [.5, 37, .23, .76], [1.25, 45, .3, .81], [2, 42, .25, .73],
    [2.5, 46, .3, .69], [3, 39, .23, .79], [3.75, 47, .31, .85], [4.25, 42, .24, .78]],
};

function auditionEvents({ role, note }) {
  if (leadReview) {
    return [[0, 60, .65, .84], [1, 62, .5, .76], [1.5, 64, .5, .78], [2, 67, 1.65, .83],
      [4, 69, .25, .82], [4.5, 67, .25, .76], [5, 64, .5, .82], [5.75, 62, 1.75, .79],
      [8, 60, .55, .84], [8.75, 64, .5, .79], [9.25, 65, .5, .78], [9.75, 67, 1.75, .84],
      [12, 71, .68, .86], [13, 67, .55, .75], [14, 60, 1.8, .82]];
  }
  if (levelMatchedReview && role === "lead_synth") {
    return [[0, 60, .5, .84], [.5, 62, .5, .78], [1, 65, .72, .80],
      [2, 67, .20, .83], [2.5, 67, .24, .74], [3, 65, .5, .81], [3.5, 62, 1.5, .84]];
  }
  if (role !== "drums") return phrases[role];
  const closedHat = note === 42;
  const positions = note === 46 ? [0, 1.8, 3.6, 5.4] : closedHat ? [0, .52, 1.04, 2, 2.5, 3.41] : [0, 1.13, 2.05, 3.29];
  const velocities = [.92, .61, .82, .72, .87, .64];
  return positions.map((beat, index) => [beat, note, .22, velocities[index]]);
}

const calibrationProfiles = [
  { transpose: -5, bassTranspose: -1, tempo: 92, velocity: .82, length: 1.12 },
  { transpose: 0, bassTranspose: 0, tempo: 120, velocity: 1, length: 1 },
  { transpose: 7, bassTranspose: 4, tempo: 146, velocity: .94, length: .87 },
  { transpose: 3, bassTranspose: 2, tempo: 108, velocity: .9, length: 1, alternate: true },
];

function calibrationEvents(preset, profile) {
  const { role } = preset;
  const pitched = role !== "drums" && role !== "percussion_texture";
  const transpose = role === "bass" ? profile.bassTranspose : pitched ? profile.transpose : 0;
  return auditionEvents(preset).map(([beat, notes, duration, velocity, slide], index) => {
    let keys = [].concat(notes).map(note => note + transpose);
    if (profile.alternate && pitched && keys.length > 1 && index % 2 === 0) {
      keys = [...keys.slice(1), keys[0] + 12];
    }
    return [beat, keys, duration * profile.length, velocity * profile.velocity, slide];
  });
}

function render(preset, playback = false, gain = 1, profile = null) {
  const { role, note } = preset;
  const processor = new Processor();
  if (playback) {
    processor.handleMessage({ type: "performance-patches", takes: fmTakePatches({ A: [preset], B: [] }, { [preset.id]: gain }) });
  } else {
    const values = bankPatchValues(preset);
    processor.handleMessage(role === "drums" ? { type: "drum-patch", note, values }
      : { type: "instrument-patch", role, values });
  }
  const events = profile ? calibrationEvents(preset, profile) : auditionEvents(preset);
  assert.ok(events.length);
  const secondsPerBeat = profile ? 60 / profile.tempo : beatSeconds;
  const drum = role === "drums" || role === "percussion_texture";
  const sustained = role === "pad";
  const controls = profile ? {
    brightness: .27 + .36 * .36, harmonicIntensity: .31 + .24 * .36,
    attack: sustained ? .475 : drum ? .065 : .135,
    release: (sustained ? .48 : drum ? .08 : .19) + .56 * .31, movement: 0, chorus: .27,
  } : { brightness: .45, harmonicIntensity: .42, attack: .27, release: .30, movement: 0, chorus: .2 };
  const leadIn = .055;
  for (const [index, [beat, notes, duration, velocity, slide]] of events.entries()) {
    const next = events[index + 1];
    const legatoToBeat = levelMatchedReview && role === "lead_synth" && next && next[1] !== notes
      && Math.abs(next[0] - beat - duration) < 1e-7 ? next[0] : undefined;
    const keys = [].concat(notes);
    const chordScale = profile && keys.length > 1 ? .86 / Math.sqrt(keys.length) : 1;
    for (const [keyIndex, key] of keys.entries()) processor.handleMessage({
      type: "note", role, note: key, time: leadIn + beat * secondsPerBeat, onsetBeat: beat,
      duration: duration * secondsPerBeat, velocity: velocity * chordScale, beatSeconds: secondsPerBeat,
      slide, accent: beat === 0 || beat === 4,
      ...(playback && { reverseTake: false, leadLegato: role === "lead_synth", legatoToBeat }),
      pan: profile ? .09 * (keyIndex - (keys.length - 1) / 2) : 0, controls, gemsWeights: "artwork",
    });
  }
  const seconds = leadIn + Math.max(...events.map(([beat, , length]) => (beat + length) * secondsPerBeat))
    + (role === "pad" ? 1.85 : role === "drums" ? .87 : 1.06);
  const frames = Math.ceil(seconds * sampleRate);
  const samples = new Float32Array(frames * 2);
  const channels = [new Float32Array(128), new Float32Array(128)];
  let peak = 0;
  const shortRms = [];
  let shortPower = 0;
  const window = Math.round(.035 * sampleRate);
  for (let offset = 0; offset < frames; offset += channels[0].length) {
    processor.process([], [channels]);
    for (let index = 0; index < Math.min(channels[0].length, frames - offset); index++) {
      const frame = offset + index;
      for (let channel = 0; channel < 2; channel++) {
        const value = channels[channel][index];
        assert.ok(Number.isFinite(value), preset.id);
        samples[frame * 2 + channel] = value;
        peak = Math.max(peak, Math.abs(value));
        shortPower += value * value;
      }
      if ((frame + 1) % window === 0) {
        shortRms.push(Math.sqrt(shortPower / (window * 2)));
        shortPower = 0;
      }
    }
  }
  const maxRms = Math.max(...shortRms);
  const active = shortRms.filter(level => level > maxRms * .10).sort((a, b) => a - b);
  assert.ok(peak > (profile ? .001 : .008) && active.length >= 3, "Silent preview: " + preset.id);
  const level = active[Math.floor((active.length - 1) * .72)];
  return { samples, peak, level, seconds };
}

function writePreview(preset, rendered = render(preset), targetLevel = .08) {
  const { role, note } = preset;
  const { samples, peak, level, seconds } = rendered;
  // Compare timbres without letting a louder patch win by default.
  const gain = Math.min(targetLevel / level, .82 / peak);
  for (let index = 0; index < samples.length; index++) samples[index] *= gain;
  const target = fileURLToPath(new URL(preset.id + ".mp3", output));
  const pcm = new URL(`.preview-${process.pid}.f32`, output);
  try {
    fs.writeFileSync(pcm, Buffer.from(samples.buffer));
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "f32le",
      "-ar", String(sampleRate), "-ac", "2", "-i", fileURLToPath(pcm), "-c:a", "libmp3lame", "-b:a", "160k", target],
    { encoding: "utf8", timeout: 20000 });
    assert.equal(result.status, 0, result.stderr || String(result.error));
  } finally {
    fs.rmSync(pcm, { force: true });
  }
  return { id: preset.id, role, ...(note && { note }), seconds, peak: peak * gain, comparisonLevel: level * gain };
}

function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function biquad(b0, b1, b2, a1, a2) {
  let first = 0;
  let second = 0;
  return sample => {
    const filtered = b0 * sample + first;
    first = b1 * sample - a1 * filtered + second;
    second = b2 * sample - a2 * filtered;
    return filtered;
  };
}

function kWeight() {
  // ITU-R BS.1770-5, Annex 1, Tables 1 and 2. The renderer runs at 48 kHz.
  const shelf = biquad(1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, .73248077421585);
  const highpass = biquad(1, -2, 1, -1.99004745483398, .99007225036621);
  return sample => highpass(shelf(sample));
}

function measureLoudness(samples) {
  const filterLeft = kWeight();
  const filterRight = kWeight();
  const hop = sampleRate / 10;
  const blocks = [];
  const hops = new Float64Array(4);
  let sum = 0;
  for (let frame = 0; frame < samples.length / 2; frame++) {
    sum += filterLeft(samples[frame * 2]) ** 2 + filterRight(samples[frame * 2 + 1]) ** 2;
    if ((frame + 1) % hop !== 0) continue;
    const blockNumber = (frame + 1) / hop;
    hops[(blockNumber - 1) % 4] = sum;
    if (blockNumber >= 4) {
      const power = (hops[0] + hops[1] + hops[2] + hops[3]) / (hop * 4);
      if (power > 10 ** ((-70 + .691) / 10)) blocks.push(power);
    }
    sum = 0;
  }
  const mean = values => values.reduce((total, value) => total + value, 0) / values.length;
  const relativeGate = mean(blocks) / 10;
  const power = mean(blocks.filter(value => value > relativeGate));
  assert.ok(Number.isFinite(power) && power > 0, "Could not measure an audible signal");
  return -.691 + 10 * Math.log10(power);
}

function renderCalibration(preset, gain = 1) {
  return calibrationProfiles.map(profile => {
    const { samples, peak } = render(preset, true, gain, profile);
    return { peak, loudness: measureLoudness(samples) };
  });
}

function calibratePlayback({ auditOnly = false, leadOnly = false } = {}) {
  const { presets } = loadPerformanceBank();
  const groups = new Map();
  for (const preset of presets) {
    if (leadOnly && preset.role !== "lead_synth") continue;
    const group = groupForPreset(preset);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(preset);
  }
  const gains = { ...currentGains };
  const db = gain => 20 * Math.log10(gain);
  const referenceProfiles = calibrationProfiles.length - 1;
  const spread = levels => Math.max(...levels) - Math.min(...levels);
  const maxSpread = (renders, first, last) => Math.max(...calibrationProfiles.slice(first, last).map((_, index) =>
    spread(renders.map(results => results[first + index].loudness))));
  console.log("Instrument / Drum note     Previous → Matched (max dB across 3 passages)    Independent passage");
  for (const [group, groupPresets] of groups) {
    const original = groupPresets.map(preset => renderCalibration(preset, currentGains[preset.id] ?? 1));
    let matched = original;
    if (!auditOnly) {
      const raw = groupPresets.map(preset => renderCalibration(preset));
      const retained = leadOnly ? original.filter((_, index) => Object.hasOwn(currentGains, groupPresets[index].id)) : original;
      const reference = retained.length ? retained : original;
      const targets = calibrationProfiles.slice(0, referenceProfiles).map((_, index) =>
        median(reference.map(results => results[index].loudness)));
      const offsets = raw.map(results => median(targets.map((target, index) => target - results[index].loudness)));
      // If a patch needs peak headroom, shift the whole instrument together.
      const headroom = Math.min(0, ...raw.map((results, index) =>
        db(.82 / Math.max(...results.map(({ peak }) => peak))) - offsets[index]));
      groupPresets.forEach((preset, index) => {
        if (leadOnly && Object.hasOwn(currentGains, preset.id)) return;
        gains[preset.id] = Number((10 ** ((offsets[index] + headroom) / 20)).toFixed(6));
      });
      matched = groupPresets.map(preset => renderCalibration(preset, gains[preset.id]));
    }
    assert.ok(matched.every(results => results.every(({ peak }) => peak < .821)), "Playback peaks exceeded headroom for " + group);
    const comparison = (first, last) =>
      `${maxSpread(original, first, last).toFixed(2)} → ${maxSpread(matched, first, last).toFixed(2)}`;
    console.log(`${String(group).padEnd(24)}   ${comparison(0, referenceProfiles)} dB                    ${comparison(referenceProfiles)} dB`);
  }
  if (!auditOnly) fs.writeFileSync(new URL("fm-performance-gains.mjs", staticDir),
    "// Generated by node scripts/render_fm_preset_review.mjs --calibrate\nexport default " + JSON.stringify(gains, null, 2) + ";\n");
}

function renderLevelMatchedReview() {
  const keptPath = new URL("../kept-bank.json", output);
  const laterCandidates = new Set((roundFour ? roundFourPresets : [...roundThreePresets, ...roundFourPresets])
    .map(preset => preset.id));
  const bank = fs.existsSync(keptPath)
    ? readPresetBank(JSON.parse(fs.readFileSync(keptPath, "utf8"))) : loadPerformanceBank();
  bank.presets = bank.presets.filter(preset => !laterCandidates.has(preset.id));
  const kept = bank.presets;
  if (roundFour && !kept.some(preset => preset.id === retainedFromRoundThree)) {
    kept.push(snapshotBankPreset(roundThreePresets.find(preset => preset.id === retainedFromRoundThree)));
  }
  const previous = roundFour ? [...reviewPresets, ...roundTwoPresets, ...roundThreePresets] : [...reviewPresets, ...roundTwoPresets];
  const previousIds = new Set(previous.map(preset => preset.id));
  const newPresets = (roundFour ? roundFourPresets : roundThreePresets).map(snapshotBankPreset);
  assert.equal(new Set(newPresets.map(preset => preset.id)).size, newPresets.length);
  assert.ok(newPresets.every(preset => !previousIds.has(preset.id)), "Candidates must be new sounds");
  const groups = new Map();
  for (const preset of newPresets) {
    const group = groupForPreset(preset);
    if (!groups.has(group)) groups.set(group, kept.filter(item => groupForPreset(item) === group));
    groups.get(group).push(preset);
  }
  const manifest = [];
  for (const group of groups.values()) {
    const comparison = group.map(preset => ({ preset, rendered: render(preset, true) }));
    const target = Math.min(.08, ...comparison.map(({ rendered: { peak, level } }) => .82 * level / peak));
    for (const { preset, rendered } of comparison) manifest.push(writePreview(preset, rendered, target));
    console.log(`${groupForPreset(group[0])} · ${group.length} level-matched previews`);
  }
  fs.writeFileSync(new URL("../manifest.json", output), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(keptPath, JSON.stringify(bank, null, 2) + "\n");
}

function renderLeadReview() {
  const current = loadPerformanceBank().presets.filter(preset => preset.role === "lead_synth");
  const currentIds = new Set(current.map(preset => preset.id));
  const candidates = leadReviewPresets.filter(preset => !currentIds.has(preset.id)).map(snapshotBankPreset);
  const presets = [...current, ...candidates];
  assert.equal(new Set(presets.map(preset => preset.id)).size, presets.length);
  const previews = presets.map(preset => {
    const rendered = render(preset, true, currentGains[preset.id] ?? 1);
    return { preset, rendered, gain: 10 ** ((-20 - measureLoudness(rendered.samples)) / 20) };
  });
  const headroom = Math.min(1, ...previews.map(({ rendered, gain }) => .82 / (rendered.peak * gain)));
  const manifest = previews.map(({ preset, rendered, gain }) =>
    writePreview(preset, rendered, rendered.level * gain * headroom));
  fs.writeFileSync(new URL("../manifest.json", output), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${current.length} current Lead patches and ${candidates.length} new candidates rendered.`);
}

if (calibrate || calibrateLead || auditCalibration) {
  calibratePlayback({ auditOnly: auditCalibration, leadOnly: calibrateLead });
} else {
  fs.mkdirSync(output, { recursive: true });
  if (leadReview) {
    renderLeadReview();
  } else if (levelMatchedReview) {
    renderLevelMatchedReview();
  } else {
    const manifest = sourcePresets.map(source => {
      const result = writePreview(snapshotBankPreset(source));
      console.log(result.id, result.seconds.toFixed(2), result.peak.toFixed(3));
      return result;
    });
    assert.equal(new Set(manifest.map(item => item.id)).size, sourcePresets.length);
    fs.writeFileSync(new URL("../manifest.json", output), JSON.stringify(manifest, null, 2) + "\n");
  }
}
