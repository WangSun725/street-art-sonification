import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import pool from "./static/midi-candidate-pool.mjs";
import { addedClips } from "./static/phrase-expansion.mjs";
import { rwcLeadPhrases, rwcReverseLeadPhrases } from "./static/rwc-lead-pool.mjs";
import { rankLeadPhrases } from "./static/lead-chord-fit.mjs";
import * as composition from "./static/artwork-composition.mjs";

const materialPool = [...pool.clips.filter(clip => clip.role !== "strings"), ...addedClips];
const nonLead = [...new Set(materialPool.map(clip => clip.role))].filter(role => role !== "lead_synth");
for (const role of nonLead) {
  const material = materialPool.filter(clip => clip.role === role);
  assert.equal(material.length, 14);
  const discovered = new Set();
  for (const density of [0, .1, .2]) for (let seed = 0; seed < material.length; seed++) {
    const phrase = composition.pickPhrase(role, density, seed);
    assert.equal(phrase.length, 4);
    assert.equal(phrase[0], phrase[2]);
    assert.notEqual(phrase[1].id, phrase[3].id);
    if (role === "organ") {
      assert.ok(phrase.every(clip => clip.groups.length >= 1 && clip.groups.length <= 2));
      assert.ok(phrase.every(clip => clip.events.every(event => event.duration < .6)));
    }
    for (const clip of phrase) discovered.add(clip.id);
  }
  assert.deepEqual(discovered, new Set(material.map(clip => clip.id)), role + " lost an available pattern");
}
for (const { role, events } of addedClips) for (const event of events) {
  assert.ok(event.beat >= 0 && event.duration > 0 && event.beat + event.duration <= 4);
  assert.ok(event.velocity > 0 && event.velocity <= 127);
  if (role === "drums" || role === "percussion_texture") assert.ok(Number.isInteger(event.note));
}
const allLeadPhrases = [...rwcLeadPhrases, ...rwcReverseLeadPhrases];
assert.equal(new Set(allLeadPhrases.map(phrase => phrase.id)).size, allLeadPhrases.length);
const scales = { major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10] };
for (const phrase of allLeadPhrases) {
  assert.match(phrase.source.track, /^RWC_P[0-9]{3}$/);
  assert.ok(phrase.events.every(([beat, duration, offset], index) =>
    beat >= 0 && duration > 0 &&
    beat + duration <= (phrase.events[index + 1]?.[0] ?? 16) + .00101 &&
    scales[phrase.mode].includes((offset % 12 + 12) % 12)));
}
const leadContour = events => {
  const chromaticOffsets = events.map(([, , pitch]) => pitch);
  return chromaticOffsets.filter((pitch, index) => pitch !== chromaticOffsets[index - 1])
    .map(pitch => pitch - chromaticOffsets[0]);
};
for (const [mode, scale] of Object.entries(scales)) for (let hue = 0; hue < 12; hue++) {
  const chords = composition.harmonyForHue(hue, mode).degrees.map(degree =>
    [0,2,4,6].map(offset => scale[(degree - 1 + offset) % 7] + 12 * Math.floor((degree - 1 + offset) / 7)));
  for (const [density, band] of [[0, "sparse"], [.1, "medium"], [.2, "dense"]]) {
    const pool = rwcLeadPhrases.filter(phrase => phrase.mode === mode && phrase.densityBand === band);
    const ranked = rankLeadPhrases(pool, chords);
    for (let seed = 0; seed < 5; seed++) {
      const phrase = composition.pickLeadPhrase(density, seed, chords, 0, mode);
      assert.equal(phrase.bars.length, 4);
      assert.equal(phrase.mode, mode);
      assert.ok(ranked.find(entry => entry.phrase.id === phrase.id).score >= ranked[0].score - .01800001);
      const [reverse] = composition.selectReverseArrangement([{
        instrument: { id: "lead_synth" }, rhythmDensity: density, rhythmPhrase: phrase.bars, leadPhrase: phrase,
      }], chords, 0, mode);
      const [selected] = rankLeadPhrases([reverse.lead], chords);
      assert.equal(reverse.lead.mode, mode);
      assert.notEqual(reverse.lead.source.track, phrase.source.track);
      assert.notDeepEqual(leadContour(reverse.lead.events), leadContour(phrase.events));
      assert.notDeepEqual(leadContour(reverse.lead.events.filter(([beat]) => beat < 4)),
        leadContour(phrase.events.filter(([beat]) => beat < 4)));
      assert.ok(selected.score >= ranked[0].score - .075, "Contrasting Lead should still fit the shared chords");
    }
  }
}

for (const density of [0, .1, .2]) for (let seed = 0; seed < 14; seed++) {
  const rhythmPhrase = composition.pickPhrase("counter_synth", density, seed);
  const [reverse] = composition.selectReverseArrangement([
    { instrument: { id: "counter_synth" }, rhythmDensity: density, rhythmPhrase },
  ], [], 0, "major");
  const onsets = clip => clip.groups.map(group => Math.round(group.beat * 12));
  for (const [bar, clip] of rhythmPhrase.entries()) {
    assert.notDeepEqual(onsets(clip), onsets(reverse.bars[bar]), "Reverse Arp needs a distinct rhythm in every bar");
  }
}

const source = fs.readFileSync(new URL("./static/app.js", import.meta.url), "utf8").split("scanPlay.addEventListener")[0];
const context = vm.createContext({
  assert, composition,
  window: { StreetArtComposition: composition },
  document: { querySelector: () => ({ getContext() {}, closest() {}, value: 70 }), querySelectorAll: () => [] },
  location: { protocol: "http:", host: "localhost" },
  performance: { now: () => 100, timeOrigin: 0 },
});
vm.runInContext(source, context);
vm.runInContext(`
const roleIds = ["lead_synth", "bass", "counter_synth", "guitar", "pad", "organ", "keys_mallet", "drums", "percussion_texture"];
state.regions = roleIds.map((id, i) => ({ id, label: id, index: i + 1, area_ratio: .1, rhythmDensity: .1 }));
const lead = state.regions[0];
const visual = { brightness: .5, saturation: .4, hue: .3, texture: .5 };
const musicalSetup = (root, mode, hue) => {
  state.artworkMusic = { hueIndex: hue };
  state.music = { bpm: 120, root, mode };
  for (const region of state.regions) applyArtworkInstrument(region, INSTRUMENTS_BY_ID.get(region.id));
};
const leadNotes = () => lead.rhythmPhrase.flatMap((clip, bar) => clip.groups.map((group, i) => {
  const event = clipEvent(lead, .2, .7, bar * 4 + group.beat, i, visual);
  assert.equal(event.notes.length, 1);
  const [note] = event.notes;
  assert.equal(note, musicRootMidi() + 24 + group.events[0].semitoneOffset);
  assert.equal(event.noteDurations[note], group.events[0].duration);
  return note;
}));
musicalSetup("C", "major", 0);
const vivid = { brightness: 1, saturation: 1, texture: 1, edgeDensity: 1, hue: .8 };
const dark = { brightness: 0, saturation: 0, texture: 0, edgeDensity: 0, hue: 0 };
for (const region of state.regions) {
  const controls = sample => performanceControls(region, sample, .5, .2, 1);
  assert.deepEqual(controls(vivid), controls(dark), region.id + " changed FM or sends with local pixels");
  const sends = FM_SOUND[region.id].sends;
  const initial = sends.delay;
  sends.delay = 0;
  assert.deepEqual(controls(vivid).sends, sends);
  sends.delay = initial;
}
const red = colorForEffects([220, 30, 30], [.2, .2, .5, .8, .8]);
const cyan = colorForEffects([30, 220, 220], [.2, .2, .5, .8, .8]);
const redSends = artworkControls("lead_synth", .5, 0, 1, false, red).sends;
const cyanSends = artworkControls("lead_synth", .5, 0, 1, false, cyan).sends;
assert.equal(redSends.delayMix, 0);
assert.equal(cyanSends.delayMix, 1);
assert.equal(redSends.delay, cyanSends.delay);
assert.ok(Math.abs(red.contrast - .6) < 1e-9);
assert.equal(colorForEffects([128, 128, 128], [.5]), null);
for (const [feature, control, value] of [
  ["hue", "delayMix", .25], ["value", "reverb", .5],
  ["contrast", "chorus", .1], ["saturation", "tremolo", .4],
]) {
  const changed = artworkControls("lead_synth", .5, 0, 1, false, { ...red, [feature]: value }).sends;
  assert.deepEqual(Object.keys(changed).filter(key => changed[key] !== redSends[key]), [control]);
}
assert.equal(assignArtworkRoles([{ type: "abstract_shape", default_instrument: "strings" }])[0].instrument.id, "organ");
const first = lead.leadPhrase.id;
const original = leadNotes();
musicalSetup("D", "major", 0);
assert.equal(lead.leadPhrase.id, first, "Pure transposition preserves the winning melody");
assert.deepEqual(leadNotes(), original.map(n => n + 2));
musicalSetup("C", "major", 8);
assert.notEqual(lead.leadPhrase.id, first, "Different shared chords can select a different melody");
musicalSetup("C", "minor", 0);
assert.notEqual(lead.leadPhrase.id, first, "Re-evaluate the melody against natural-minor harmony");
leadNotes();

state.mode = "scan";
state.scan.playing = true;
state.scan.startedAt = 100;
state.scan.startedFrom = 0;
state.scan.voiceMode = "backing";
const schedule = enabled => {
  soundEngine.enabled = enabled;
  const all = [];
  const ensemble = state.regions.map(region=>({ region, intensity: .8, x: .5, centroidY: .5, ...visual, window: { from: 0, to: 32 } }));
  for (let beat = 0; beat < 32; beat += .045) {
    const voices = activeMusicVoices(true, null, ensemble, null, beat);
    all.push(...scheduleMusicEvents(voices, beat, 100 + beat * 500).scheduledEvents);
  }
  return all.map(e => [e.instrumentId, e.onsetBeat, e.notes, e.noteDurations, e.noteVelocities]);
};
assert.deepEqual(schedule(false), []);
const web = schedule(true);
assert.equal(new Set(web.map(([id]) => id)).size, roleIds.length);
for (const [id, beat, notes, durations] of web) {
  const triad = harmonyAt(beat).tones.slice(0, 3).map(n => n % 12);
  if (id !== "lead_synth") assert.ok(Object.values(durations).every(d => d + beat <= (Math.floor(beat / 4) + 1) * 4 + 1e-7));
  if (id === "bass") assert.ok(notes.every(n => n % 12 === triad[0] || n % 12 === triad[2]));
  if (id === "counter_synth") assert.ok(notes.every(n => triad.includes(n % 12)));
  if (id === "organ") {
    assert.ok(notes.length >= 2 && notes.length <= 3);
    assert.ok(notes.every(n => n >= 50 && n <= 67 && triad.includes(n % 12)));
    assert.ok(notes.some(n => n % 12 === triad[1]));
    assert.ok(notes.some(n => n % 12 === triad[2]));
  }
}
`, context);
console.log("Nine pools, chord-specific Lead choice, key transposition, and Web Audio scheduling OK");
