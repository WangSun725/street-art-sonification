import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, writeFile, rename } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

import * as composition from "../webapp/static/artwork-composition.mjs";
import pool from "../webapp/static/midi-candidate-pool.mjs";
import { addedClips } from "../webapp/static/phrase-expansion.mjs";
import { expandedRhythmClips } from "../webapp/static/rhythm-pool-expansion.mjs";
import * as fm from "../webapp/static/fm-patches.mjs";
import { fmTakePatches, readPresetBank } from "../webapp/static/fm-preset-bank.mjs";
import gains from "../webapp/static/fm-performance-gains.mjs";

const staticDir = new URL("../webapp/static/", import.meta.url);
const output = fileURLToPath(new URL("../webapp/runtime/rhythm-review/", import.meta.url));
const bpm = 120;
const root = "C";
const mode = "major";
const chords = ["C", "G", "Am", "F"];
const sampleRate = 48000;
const beatSeconds = 60 / bpm;
const leadIn = .045;
const previewSeconds = leadIn + 16 * beatSeconds + .6;
const blockSize = 128;
const densityBands = { sparse: .025, medium: .1, dense: .2 };
const instruments = [
  { id: "drums", label: "Drums", presets: [
    "kick-felt", "snare-dust", "clap-tight", "closed-foot", "open-cut", "low-tom-felt", "mid-tom-felt", "high-tom-tight",
  ] },
  { id: "bass", label: "Acid Bass", presets: ["bass-deep"] },
  { id: "counter_synth", label: "Arp Synth", presets: ["arp-wood"] },
  { id: "guitar", label: "Guitar", presets: ["guitar-nylon"] },
  { id: "pad", label: "Pad", presets: ["pad-cloud"] },
  { id: "organ", label: "FM Organ", presets: ["organ-flute"] },
  { id: "keys_mallet", label: "Keys / Mallet", presets: ["keys-rosewood"] },
  { id: "percussion_texture", label: "Percussion / Texture", presets: ["perc-sand"] },
];

const addedIds = new Set(expandedRhythmClips.map(clip => clip.id));
const clips = [...pool.clips, ...addedClips, ...expandedRhythmClips];
const performanceBank = readPresetBank(JSON.parse(fs.readFileSync(new URL("fm-performance-bank.json", staticDir), "utf8")));
const presets = new Map(performanceBank.presets.map(preset => [preset.id, preset]));

function compileApp() {
  const source = fs.readFileSync(new URL("app.js", staticDir), "utf8").split("scanPlay.addEventListener")[0];
  const context = vm.createContext({
    document: {
      querySelector: () => ({ getContext() {}, closest() {}, value: 70 }),
      querySelectorAll: () => [],
    },
    window: { StreetArtComposition: composition },
    location: { protocol: "http:", host: "localhost" },
    performance: { now: () => 0, timeOrigin: 0 },
  });
  vm.runInContext(source, context);
  return vm.runInContext(`(role, phrase, music, leadIn, beatSeconds) => {
    state.music = music;
    state.artworkMusic = { hueIndex: 0 };
    const instrument = INSTRUMENTS_BY_ID.get(role);
    const region = { instrument, rhythmPhrase: phrase, id: role, label: instrument.label, area_ratio: .1,
      color_rgb: [128, 128, 128] };
    const visual = { brightness: .5, saturation: .4, texture: .3, hue: 0 };
    const x = .5, y = .5;
    const messages = [];
    const engine = new SoundEngine();
    engine.fmNode = { port: { postMessage: message => messages.push(message) } };
    engine.audioEpochMs = 0;
    engine.syncFMMixes([{ region, intensity: 1 }]);
    engine.applyVoiceFrame([{ regionId: region.id, controls: performanceControls(region, visual, x, 0, 1) }]);
    for (const [bar, clip] of phrase.entries()) {
      messages.push({ type: "music-bar", time: leadIn + bar * 4 * beatSeconds,
        chordDegree: harmonyAt(bar * 4).degree, reverse: false });
      for (const [index, group] of clip.groups.entries()) {
        const onsetBeat = bar * 4 + group.beat;
        const event = clipEvent(region, x, y, onsetBeat, index, visual, 4 - group.beat);
        engine.playPatternEvent(region, {
          ...event, onsetBeat, scheduledAtMs: (leadIn + onsetBeat * beatSeconds) * 1000,
          controls: performanceControls(region, visual, x, 0, 1, event.accent),
        }, x, 0);
      }
    }
    return messages;
  }`, context);
}

function compileWorklet() {
  const source = fs.readFileSync(new URL("fm-worklet.js", staticDir), "utf8").replace(/^import .*;\n/, "");
  const bindings = [
    "DRUM_DEFAULTS", "DRUM_VOICES", "FACTORY_PATCHES", "PATCHES", "applyFmPatch", "normalizeDrumPatch", "normalizeFmPatch",
  ];
  return new Function(...bindings, "sampleRate", "AudioWorkletProcessor", "registerProcessor",
    source + "\nreturn StreetArtFMProcessor;")(
    ...bindings.map(name => fm[name]), sampleRate, class { constructor() { this.port = {}; } }, () => {},
  );
}

function render(Processor, patchMessage, messages) {
  const processor = new Processor();
  processor.handleMessage(patchMessage);
  for (const message of messages) processor.handleMessage(message);
  const frames = Math.round(sampleRate * previewSeconds);
  const pcm = new Float32Array(frames * 2);
  const outputs = Array.from({ length: 4 }, () => [new Float32Array(blockSize), new Float32Array(blockSize)]);
  const dry = outputs[0];
  const barPeaks = [0, 0, 0, 0];
  for (let offset = 0; offset < frames; offset += blockSize) {
    for (const channels of outputs) for (const channel of channels) channel.fill(0);
    processor.process([], outputs);
    for (let index = 0; index < Math.min(blockSize, frames - offset); index++) {
      const frame = offset + index;
      pcm[frame * 2] = dry[0][index];
      pcm[frame * 2 + 1] = dry[1][index];
      const bar = Math.min(3, Math.floor(Math.max(0, frame / sampleRate - leadIn) / (4 * beatSeconds)));
      barPeaks[bar] = Math.max(barPeaks[bar], Math.abs(dry[0][index]), Math.abs(dry[1][index]));
    }
  }
  assert.ok(barPeaks.every(peak => Number.isFinite(peak) && peak > .001), "Silent or invalid bar");
  return { pcm, peak: Math.max(...barPeaks) };
}

function renderGroup({ id, label, presets: presetIds }, directory) {
  const score = compileApp();
  const Processor = compileWorklet();
  const take = presetIds.map(presetId => {
    const preset = presets.get(presetId);
    assert.ok(preset && Object.hasOwn(gains, presetId), `Missing calibrated preset ${presetId}`);
    return preset;
  });
  const patchMessage = { type: "performance-patches", takes: fmTakePatches({ A: take, B: take }, gains) };
  const patternBank = clips.filter(clip => clip.role === id);
  const destination = path.join(directory, id);
  fs.mkdirSync(destination);
  const previews = [];
  let peak = 0;

  for (const [band, density] of Object.entries(densityBands)) {
    const count = patternBank.filter(clip => clip.densityBand === band).length;
    for (let index = 0; index < count; index++) {
      const phrase = composition.pickPhrase(id, density, index);
      const motif = phrase[0];
      assert.equal(motif.densityBand, band);
      const messages = score(id, phrase, { bpm, root, mode }, leadIn, beatSeconds);
      const { pcm, peak: clipPeak } = render(Processor, patchMessage, messages);
      const fileBase = path.join(destination, motif.id);
      fs.writeFileSync(fileBase + ".f32", Buffer.from(pcm.buffer));
      peak = Math.max(peak, clipPeak);
      const steps = Array(16).fill(0);
      for (const { beat, events } of motif.groups) {
        const step = Math.min(15, Math.round(beat * 4));
        steps[step] = Math.max(steps[step], ...events.map(event => event.velocity));
      }
      previews.push({
        id: motif.id,
        title: motif.title,
        band,
        steps,
        attacks: motif.groups.length,
        source: motif.source,
        added: addedIds.has(motif.id),
        phrase: phrase.map(clip => clip.sourceClipId ?? clip.id),
        file: path.posix.join(path.basename(directory), id, motif.id + ".m4a"),
      });
    }
  }

  assert.deepEqual(new Set(previews.map(clip => clip.id)), new Set(patternBank.map(clip => clip.id)));
  const playbackGain = Math.min(3, .88 / peak);
  for (const clip of previews) {
    const fileBase = path.join(destination, clip.id);
    const result = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "f32le", "-ar", String(sampleRate),
      "-ac", "2", "-i", fileBase + ".f32", "-af", `volume=${playbackGain.toFixed(6)}`,
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", fileBase + ".m4a",
    ], { encoding: "utf8", timeout: 20000 });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    fs.unlinkSync(fileBase + ".f32");
  }
  return { id, label, patch: id === "drums" ? "Fixed FM kit" : take[0].name, clips: previews };
}

async function main() {
  if (!isMainThread) {
    for (const instrument of workerData.instruments) {
      parentPort.postMessage(renderGroup(instrument, workerData.directory));
    }
    return;
  }
  fs.mkdirSync(output, { recursive: true });
  const directory = await mkdtemp(path.join(output, "take-"));
  const workerCount = Math.min(4, availableParallelism());
  const groups = new Map();
  await Promise.all(Array.from({ length: workerCount }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { directory, instruments: instruments.filter((_, i) => i % workerCount === index) },
    });
    worker.on("message", group => {
      groups.set(group.id, group);
      console.log(`${group.label}: ${group.clips.length} rendered`);
    });
    worker.once("error", reject);
    worker.once("exit", code => code === 0 ? resolve() : reject(Error(`Render worker exited with ${code}`)));
  })));
  assert.equal(groups.size, instruments.length);
  const library = instruments.map(instrument => groups.get(instrument.id));
  const total = library.reduce((sum, group) => sum + group.clips.length, 0);
  const manifest = { bpm, key: "C major", chords, bars: 4, total, library };
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
  await rename(path.join(directory, "manifest.json"), path.join(output, "manifest.json"));
  console.log(`Rendered all ${total} rhythms.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
