import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import pool from "./static/midi-candidate-pool.mjs";
import { addedClips } from "./static/phrase-expansion.mjs";
import { expandedRhythmClips } from "./static/rhythm-pool-expansion.mjs";
import { rwcLeadPhrases } from "./static/rwc-lead-pool.mjs";
import { rankLeadPhrases } from "./static/lead-chord-fit.mjs";
import * as composition from "./static/artwork-composition.mjs";
import * as scan from "./static/scan-path.mjs";

const materialPool = [...pool.clips, ...addedClips, ...expandedRhythmClips]
  .filter(clip => !["strings", "lead_synth"].includes(clip.role));
const nonLead = [...new Set(materialPool.map(clip => clip.role))];
assert.equal(new Set(expandedRhythmClips.map(clip => `${clip.source.file}:${clip.source.bar}`)).size, 96);
const acceptedDrumIds = new Set([
  "drums-03", "drums-05", "drums-gmd-02", "drums-gmd-04", "drums-gmd-05",
  "drums-new-2", "drums-new-3", "drums-new-4", "drums-new-5", "drums-new-6",
]);
const tomNotes = new Set([43, 47, 50]);
const brokenBeatDrums = composition.pickPhrase("drums", .2, 4);
const matchingBass = composition.pickBassForDrums(.1, 2, brokenBeatDrums);
const kickBeats = new Set(brokenBeatDrums.flatMap((clip, bar) => clip.groups
  .filter(group => group.events.some(event => event.note === 36)).map(group => bar * 4 + group.beat)));
const kickOverlap = phrase => {
  const beats = phrase.flatMap((clip, bar) => clip.groups.map(group => bar * 4 + group.beat));
  return beats.filter(beat => kickBeats.has(beat)).length / beats.length;
};
assert.ok(kickOverlap(matchingBass) >= kickOverlap(composition.pickPhrase("bass", .1, 2)));
assert.ok(matchingBass.every(clip => clip.densityBand === "medium"));
for (let seed = 0; seed < 26; seed++) {
  const phrase = composition.pickPhrase("bass", .1, seed);
  assert.ok(phrase.flatMap(clip => clip.groups).every(group => Number.isInteger(group.beat * 4)));
}
for (const role of nonLead) {
  const material = materialPool.filter(clip => clip.role === role);
  for (const band of ["sparse", "medium", "dense"]) {
    assert.equal(expandedRhythmClips.filter(clip => clip.role === role && clip.densityBand === band).length, 4);
  }
  if (role === "drums") {
    assert.equal(material.length, 22);
    assert.ok([...acceptedDrumIds].every(id => material.some(clip => clip.id === id)));
  } else assert.equal(material.length, 26);
  const discovered = new Set();
  for (const [density, band] of [[0, "sparse"], [.1, "medium"], [.2, "dense"]]) for (let seed = 0; seed < material.length; seed++) {
    const phrase = composition.pickPhrase(role, density, seed);
    assert.equal(phrase.length, 4);
    assert.equal(phrase[0], phrase[2]);
    assert.notEqual(phrase[1].id, phrase[3].id);
    const alternative = composition.pickPhrase(role, density, seed, phrase);
    const rhythm = clips => clips.map(clip => clip.groups.map(group => [
      Math.round(group.beat * 8), group.events.map(event => Math.round(event.duration * 4)),
    ]));
    assert.notDeepEqual(rhythm(phrase), rhythm(alternative), role + " reused the same phrase");
    assert.ok([...phrase, ...alternative].every(clip => clip.densityBand === band));
    if (role === "organ") {
      assert.ok(phrase.every(clip => clip.groups.length >= 1 && clip.groups.length <= 2));
      assert.ok(phrase.every(clip => clip.events.every(event => event.duration < .6)));
    }
    if (role === "drums") {
      for (const [bar, clip] of phrase.entries()) {
        assert.equal(clip.groups[0].beat, 0);
        assert.ok(clip.groups[0].events.some(event => event.note === 36));
        const toms = clip.events.filter(event => tomNotes.has(event.note));
        if (bar === 3) {
          assert.ok(toms.length >= 2 && toms.length <= 4);
          assert.ok(toms.every(event => event.beat >= 3 && event.beat + event.duration <= 4));
          assert.equal(toms.at(-1).note, 43);
        } else assert.equal(toms.length, 0);
        const original = material.find(source => source.id === (clip.sourceClipId ?? clip.id));
        if (original.source.title === "Google Magenta Groove MIDI Dataset") {
          const hats = events => events.filter(event => event.note === 42 || event.note === 46);
          assert.deepEqual(hats(clip.events), hats(original.events).filter(event => bar !== 3 || event.beat < 3));
          assert.ok(clip.events.filter(event => event.note === 38 && event.velocity >= 100)
            .every(event => [1, 2, 3].includes(event.beat)));
        }
      }
      assert.ok(alternative[3].events.some(event => tomNotes.has(event.note)));
    }
    for (const clip of phrase) discovered.add(clip.sourceClipId ?? clip.id);
  }
  assert.deepEqual(discovered, new Set(material.map(clip => clip.id)), role + " lost an available pattern");
}
for (const { role, events } of [...addedClips, ...expandedRhythmClips]) for (const event of events) {
  assert.ok(event.beat >= 0 && event.duration > 0 && event.beat + event.duration <= 4);
  assert.ok(event.velocity > 0 && event.velocity <= 127);
  if (role === "drums" || role === "percussion_texture") assert.ok(Number.isInteger(event.note));
}
const allLeadPhrases = rwcLeadPhrases;
assert.equal(allLeadPhrases.length, 260);
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
      const reverse = composition.pickLeadPhrase(density, seed, chords, 0, mode, phrase);
      assert.equal(reverse.mode, mode);
      assert.equal(reverse.densityBand, band);
      assert.notEqual(reverse.id, phrase.id);
      assert.notDeepEqual(leadContour(reverse.events), leadContour(phrase.events));
      const excluded = leadContour(phrase.events).join(",");
      const eligible = ranked.filter(entry => leadContour(entry.phrase.events).join(",") !== excluded);
      assert.ok(eligible.find(entry => entry.phrase.id === reverse.id).score >= eligible[0].score - .01800001);
    }
  }
}

for (const [density, band] of [[0, "sparse"], [.1, "medium"], [.2, "dense"]]) {
  for (let seed = 0; seed < 26; seed++) {
    const drumA = composition.pickPhrase("drums", density, seed);
    const drumB = composition.pickPhrase("drums", density, seed, drumA);
    const bassA = composition.pickBassForDrums(density, seed, drumA);
    const bassB = composition.pickBassForDrums(density, seed, drumB, bassA);
    assert.ok([...bassA, ...bassB].every(clip => clip.densityBand === band));
    assert.notDeepEqual(bassA.map(clip => clip.id), bassB.map(clip => clip.id));
  }
}

const chordRoles = ["guitar", "keys_mallet", "organ", "pad"];
const chordOnsets = bars => bars.flatMap((clip, bar) => clip.groups.map(group => bar * 4 + group.beat));
const overlapScore = (bars, reference) => {
  const attacks = chordOnsets(bars);
  const anchors = chordOnsets(reference);
  return [attacks.filter(beat => anchors.some(anchor => Math.abs(anchor - beat) <= .0625)).length / attacks.length,
    attacks.length];
};
const rhythmShape = bars => JSON.stringify(bars.map(clip => clip.groups.map(group =>
  [Math.round(group.beat * 8), group.events.map(event => Math.round(event.duration * 4))])));
for (const role of chordRoles) {
  for (const density of [.02, .1, .19]) {
    const candidates = Array.from({ length: 26 }, (_, seed) => composition.pickPhrase(role, density, seed));
    for (const referenceRole of chordRoles.filter(item => item !== role)) {
      const reference = composition.pickPhrase(referenceRole, density, 2);
      const forward = composition.pickChordRhythm(role, density, 5, reference);
      const reverseReference = composition.pickPhrase(referenceRole, density, 2, reference);
      const reverse = composition.pickChordRhythm(role, density, 5, reverseReference, forward);
      for (const [chosen, anchor, excluded] of [[forward, reference, null], [reverse, reverseReference, forward]]) {
        assert.ok(candidates.some(candidate => candidate.every((clip, index) => clip === chosen[index])));
        if (excluded) assert.notEqual(rhythmShape(chosen), rhythmShape(excluded));
        const [overlap, attacks] = overlapScore(chosen, anchor);
        for (const candidate of candidates) {
          if (excluded && rhythmShape(candidate) === rhythmShape(excluded)) continue;
          const [alternative, alternativeAttacks] = overlapScore(candidate, anchor);
          assert.ok(overlap > alternative || (overlap === alternative && attacks <= alternativeAttacks));
        }
      }
    }
  }
}

const source = fs.readFileSync(new URL("./static/app.js", import.meta.url), "utf8").split("scanPlay.addEventListener")[0];
const context = vm.createContext({
  assert, composition,
  resumeFixture: rwcLeadPhrases.find(phrase => phrase.id === "rwc-p011-beat133"),
  window: { StreetArtComposition: composition, StreetArtStudio: { scan } },
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
const leadArticulation = { rhythmPhrase: [{ groups: [
  { beat: 0, events: [{ semitoneOffset: 0, duration: .48 }] },
  { beat: .5, events: [{ semitoneOffset: 2, duration: .25 }] },
  { beat: 1, events: [{ semitoneOffset: 4, duration: .48 }] },
  { beat: 1.5, events: [{ semitoneOffset: 4, duration: .5 }] },
] }] };
assert.equal(leadLegatoGate(leadArticulation, 0, 0, 4, false, true, 500), .5);
assert.equal(leadLegatoGate(leadArticulation, 0, 0, 4, false, true, 800), null);
assert.equal(leadLegatoGate(leadArticulation, 0, 0, .5, false, true, 500), null);
assert.equal(leadLegatoGate(leadArticulation, 0, 1, 4, false, true, 500), null);
assert.equal(leadLegatoGate(leadArticulation, 0, 2, 4, false, true, 500), null);
assert.equal(leadLegatoGate(leadArticulation, 0, 3, 4, false, true, 500), null);
const musicalSetup = (root, mode, hue) => {
  state.artworkMusic = { hueIndex: hue };
  state.music = { bpm: 120, root, mode };
  for (const region of state.regions) applyArtworkInstrument(region, INSTRUMENTS_BY_ID.get(region.id));
  rebuildArtworkArrangements();
};
const leadNotes = () => lead.rhythmPhrase.flatMap((clip, bar) => clip.groups.map((group, i) => {
  const event = clipEvent(lead, .2, .7, bar * 4 + group.beat, i, visual);
  assert.equal(event.notes.length, 1);
  const [note] = event.notes;
  assert.equal(note, musicRootMidi() + 24 + group.events[0].semitoneOffset);
  assert.equal(event.noteDurations[note], group.events[0].duration);
  return note;
}));
const originalRandom = Math.random;
let chordDraws = 0;
Math.random = () => { chordDraws++; return .51; };
musicalSetup("C", "major", 0);
assert.equal(state.chordRhythmRole, "organ");
const reference = state.regions.find(region => region.instrument.id === state.chordRhythmRole);
for (const region of state.regions.filter(region => CHORD_RHYTHM_ROLES.has(region.instrument.id) && region !== reference)) {
  const role = region.instrument.id;
  const seed = regionMusicSeed(region);
  const forward = composition.pickChordRhythm(role, region.rhythmDensity, seed, reference.rhythmPhrase);
  const reverse = composition.pickChordRhythm(role, region.rhythmDensity, seed, reference.reverseTake.bars, forward);
  assert.deepEqual(region.rhythmPhrase, forward);
  assert.deepEqual(region.reverseTake.bars, reverse);
}
rebuildArtworkArrangements();
assert.equal(chordDraws, 1);
assert.equal(state.chordRhythmRole, "organ");
Math.random = originalRandom;
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
const redSends = artworkControls("lead_synth", 0, 1, false, red).sends;
const cyanSends = artworkControls("lead_synth", 0, 1, false, cyan).sends;
assert.equal(redSends.delayMix, 0);
assert.equal(cyanSends.delayMix, 1);
assert.equal(redSends.delay, cyanSends.delay);
for (const sample of [red, cyan, null]) {
  const { delay, delayMix, reverb, chorus } = artworkControls("bass", 0, 1, false, sample).sends;
  assert.deepEqual([delay, delayMix, reverb], [0, 0, 0]);
  assert.ok(chorus > 0);
}
assert.ok(Math.abs(red.contrast - .6) < 1e-9);
assert.equal(colorForEffects([128, 128, 128], [.5]), null);
for (const [feature, control, value] of [
  ["hue", "delayMix", .25], ["value", "reverb", .5],
  ["contrast", "chorus", .1], ["saturation", "tremolo", .4],
]) {
  const changed = artworkControls("lead_synth", 0, 1, false, { ...red, [feature]: value }).sends;
  assert.deepEqual(Object.keys(changed).filter(key => changed[key] !== redSends[key]), [control]);
}
assert.equal(assignArtworkRoles([{ type: "abstract_shape", default_instrument: "strings" }])[0].instrument.id, "organ");
const guitar = state.regions.find(region => region.instrument.id === "guitar");
assert.equal(fmInstrumentVolume(guitar), FM_SOUND.guitar.volume);
const renderedNotes = [];
const stereoEngine = new SoundEngine();
stereoEngine.fmNode = { port: { postMessage: message => renderedNotes.push(message) } };
for (const [role, notes, expected] of [
  ["lead_synth", [60, 64], [0, 0]], ["bass", [36], [0]], ["drums", [36, 38, 42], [0, 0, -.20]],
  ["guitar", [60, 67], [-.36, -.36]], ["keys_mallet", [64], [.32]], ["percussion_texture", [39], [.42]],
]) {
  const region = state.regions.find(region => region.instrument.id === role);
  for (const x of [.01, .99]) {
    stereoEngine.playPatternEvent(region, { notes, durationBeats: .25, velocity: 92 }, x, .1);
    assert.deepEqual(renderedNotes.splice(0).map(message => message.pan), expected);
  }
}
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

musicalSetup("C", "major", 1);
rebuildArtworkArrangements();
const frameGaps = [48, 69, 160, 50, 83, 107, 112, 146, 52];
const reverseBars = new Set([3, 4]);
state.scan.route = [
  { from: 0, to: 1, endBar: 3 },
  { from: 1, to: 0, endBar: 5 },
  { from: 0, to: 1, endBar: 8 },
];
for (const bpm of [40, 101, 113, 144, 200]) {
  state.music.bpm = bpm;
  const beatMs = 60000 / bpm;
  for (const startBar of [0, 3]) {
    state.scan.startedAt = 10000;
    state.scan.startedFrom = startBar * 4 * beatMs / 1000;
    state.scheduler.signature = null;
    const ensemble = state.regions.map(region => ({
      region, intensity: .8, x: .5, centroidY: .5, ...visual, windows: [{ from: 0, to: 32 }],
    }));
    const expected = new Map();
    const turnaroundBars = [3, 5].filter(bar => bar > startBar);
    for (const region of state.regions) {
      for (let bar = startBar; bar < 8; bar++) {
        const reverse = reverseBars.has(bar);
        const clip = phraseClipAtBar(region, bar, reverse);
        const turn = turnaroundBars.includes(bar);
        const role = region.instrument.id;
        for (const group of clip.groups) {
          if (turn && ["drums", "bass"].includes(role) && group.beat < 1) continue;
          expected.set(region.id + ":" + (bar * 4 + group.beat).toFixed(6), clip.id);
        }
        if (turn && role === "drums") {
          const outgoing = phraseClipAtBar(region, bar, !reverse);
          for (const group of outgoing.groups.filter(group => group.beat < 1)) {
            expected.set(region.id + ":" + (bar * 4 + group.beat).toFixed(6), outgoing.id);
          }
        } else if (turn && role === "bass") {
          expected.set(region.id + ":" + (bar * 4).toFixed(6), clip.id);
        }
      }
    }
    const queuedBars = [];
    for (let elapsed = 0, frame = 0; elapsed < (32 - startBar * 4) * beatMs + 160;
      elapsed += frameGaps[frame++ % frameGaps.length]) {
      const now = state.scan.startedAt + elapsed;
      const beat = musicBeatPosition(true, now);
      const voices = activeMusicVoices(true, null, ensemble, null, beat);
      const scheduled = scheduleMusicEvents(voices, beat, now);
      queuedBars.push(...scheduled.musicBars);
      for (const event of scheduled.scheduledEvents) {
        const key = event.regionId + ":" + event.onsetBeat.toFixed(6);
        assert.equal(event.rhythmClip, expected.get(key), "Only the active take may supply this onset");
        expected.delete(key);
        const bar = Math.floor(event.onsetBeat / 4);
        const joinsAtDownbeat = event.instrumentId === "bass" && turnaroundBars.includes(bar) && event.onsetBeat === bar * 4;
        assert.equal(Boolean(event.turnaroundBass), joinsAtDownbeat);
        if (joinsAtDownbeat) {
          assert.deepEqual(event.notes, [24 + harmonyAt(event.onsetBeat).tones[0] % 12]);
          assert.equal(event.durationBeats, .85);
          assert.equal(event.slide, false);
          assert.equal(event.reverseTake, reverseBars.has(bar));
        }
        assert.equal(event.harmony.bar, Math.floor(event.onsetBeat / 4) + 1);
        assert.ok(event.scheduledAtMs >= now, "Every track must reach the audio queue before its onset");
        assert.ok(Math.abs(event.scheduledAtMs - (state.scan.startedAt + (event.onsetBeat - startBar * 4) * beatMs + MUSIC_EVENT_BUFFER_MS)) < .001);
        for (const boundary of [12, 20, 32]) {
          if (event.onsetBeat < boundary) assert.ok(event.onsetBeat + event.durationBeats <= boundary + 1e-7);
        }
      }
    }
    assert.equal(expected.size, 0, "Every track must keep all its planned onsets under frame jitter");
    assert.deepEqual(queuedBars.map(item => item.reverse), Array.from({ length: 8 - startBar },
      (_, index) => reverseBars.has(startBar + index)));
    assert.deepEqual(Array.from(queuedBars, (item, index) => item.turnaround ? startBar + index : undefined)
      .filter(bar => bar !== undefined), turnaroundBars);
  }
}

state.music = { bpm: 101, root: "C", mode: "minor" };
state.scan.startedAt = 20000;
state.scan.startedFrom = 240 / 101;
rebuildArtworkArrangements();
lead.leadPhrase = composition.prepareLeadPhrase(resumeFixture);
lead.rhythmPhrase = lead.leadPhrase.bars;
const resumeEvents = (from, route) => {
  state.scan.route = route;
  state.scheduler.signature = null;
  const voices = activeMusicVoices(true, null, [{
    region: lead, intensity: .8, x: .5, centroidY: .5, ...visual, windows: [{ from, to: 16 }],
  }]);
  return scheduleMusicEvents(voices, musicBeatPosition(true, 20000), 20000).scheduledEvents;
};
const forwardOnly = [{ from: 0, to: 1, endBar: 4 }];
const [held] = resumeEvents(0, forwardOnly);
assert.equal(held.continued, true);
assert.equal(held.onsetBeat, 4);
assert.equal(held.harmony.bar, 2);
assert.equal(held.scheduledAtMs, 20000 + MUSIC_EVENT_BUFFER_MS);
assert.ok(Math.abs(held.durationBeats - .472) < 1e-7);
assert.equal(held.note, musicRootMidi() + 24 + 3);
assert.ok(resumeEvents(4, forwardOnly).every(event => !event.continued));
assert.ok(resumeEvents(0, [{ from: 0, to: 1, endBar: 1 }, { from: 1, to: 0, endBar: 4 }])
  .every(event => !event.continued));

state.regions = state.regions.filter(region => !["drums", "bass"].includes(region.instrument.id));
state.music.bpm = 120;
state.scan.startedAt = 1000;
state.scan.startedFrom = 0;
state.scan.beatOffset = 4;
state.scan.duration = 24;
state.scan.route = STUDIO.scan.buildScanRoute("forward", [], [0, 1], 12);
state.scan.detailProfile = { min: 0, max: .4, columns: Array.from({ length: 30 }, (_, index) => ({
  edges: index >= 10 && index < 20 ? 40 : 0, pairs: 100,
})) };
rebuildBackingDrum();
rebuildArtworkArrangements();
assert.deepEqual(state.scan.accompaniment.map(item => item.region.instrument.id), ["drums", "bass"]);
assert.deepEqual(Array.from(state.scan.accompanimentBlocks, block => block.count), [1, 2, 1]);
assert.deepEqual(scanAccompanimentAt(19.9).map(item => item.region.instrument.id), ["drums"]);
assert.deepEqual(scanAccompanimentAt(20).map(item => item.region.instrument.id), ["drums", "bass"]);
assert.deepEqual(scanAccompanimentAt(36).map(item => item.region.instrument.id), ["drums"]);
const [backingDrum, backingBass] = state.scan.accompaniment;
const scheduleBacking = beat => {
  const now = state.scan.startedAt + (beat - state.scan.beatOffset) * 500;
  return scheduleMusicEvents(activeMusicVoices(true, null, scanAccompanimentForScheduling(beat), null, beat), beat, now);
};
state.scheduler.signature = null;
const entering = scheduleBacking(19.8);
assert.ok(entering.scheduledEvents.some(event => event.regionId === backingDrum.region.id && event.onsetBeat === 20));
assert.ok(entering.scheduledEvents.some(event => event.regionId === backingBass.region.id && event.onsetBeat === 20));
assert.deepEqual(entering.musicBars[0].accompaniment, [backingDrum.region.id, backingBass.region.id]);
const leaving = scheduleBacking(35.8);
assert.deepEqual(leaving.musicBars[0].accompaniment, [backingDrum.region.id]);
assert.ok(leaving.scheduledEvents.every(event => event.regionId !== backingBass.region.id || event.onsetBeat < 36));
assert.equal(scanAccompanimentAt(28).length, 2, "Seeking inside a four-bar block must restore its accompaniment");

state.regions = state.regions.filter(region => !CHORD_RHYTHM_ROLES.has(region.instrument.id));
for (const region of state.regions) {
  region.scanColumns = new Uint8Array(30).fill(1);
  region.scanProfile = Array.from({ length: SCAN_PROFILE_BINS }, () => ({
    coverage: .5, centroidY: .5, texture: .3, brightness: .5, saturation: .2,
    hueCos: 1, hueSin: 0, hueBins: [1], colorRgb: [100, 120, 140],
  }));
}
state.chordRhythmRole = null;
state.scan.route = STUDIO.scan.buildScanRoute("custom", [{ from: 0, to: .3 }], [0, 1], 12);
rebuildArtworkArrangements();
assert.equal(state.chordRhythmRole, null);
Math.random = () => .51;
setScanRoute(STUDIO.scan.buildScanRoute("custom", [{ from: .35, to: .6 }], [0, 1], 12), 4);
assert.equal(state.chordRhythmRole, "keys_mallet");
const chordBacking = state.scan.accompaniment.find(item => item.region.instrument.id === state.chordRhythmRole);
assert.equal(chordBacking.bars[0].from, 4);
setScanRoute(STUDIO.scan.buildScanRoute("custom", [{ from: .3, to: 0 }], [0, 1], 12));
assert.equal(state.chordRhythmRole, "keys_mallet");
Math.random = originalRandom;
`, context);
console.log("Nine pools, chord rhythm alignment, Lead choice, key transposition, and all-track bar scheduling OK");
