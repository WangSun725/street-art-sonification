import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildScanRoute, insertScanRange, planRegionScan, planScanAccompaniment, quantizePassages, scanPoint, scanProximity } from "./static/scan-path.mjs";
import { scanEdgeProfile } from "./static/artwork-composition.mjs";

const tinyArtwork = Uint8ClampedArray.from([50, 52, 140, 55, 90, 50, 110, 108, 200]
  .flatMap((gray, index) => [gray, gray, gray, index % 3 === 2 ? 0 : 255]));
assert.deepEqual(scanEdgeProfile({ data: tinyArtwork, width: 3, height: 3 }), {
  columns: [{ edges: 3, pairs: 7 }, { edges: 3, pairs: 7 }, null], min: 3 / 7, max: 3 / 7,
});
const edgeProfile = { min: 0, max: .4, columns: Array.from({ length: 40 }, (_, index) => ({
  edges: index < 16 ? 0 : 40, pairs: 100,
})) };
const forwardPlan = planScanAccompaniment(edgeProfile, buildScanRoute("forward", [], [0, 1], 10), 10, 5);
assert.deepEqual(forwardPlan, [
  { startBar: 0, endBar: 4, count: 1 },
  { startBar: 4, endBar: 8, count: 5 },
  { startBar: 8, endBar: 10, count: 5 },
]);
const reversePath = buildScanRoute("reverse", [], [0, 1], 10);
assert.deepEqual(planScanAccompaniment(edgeProfile, reversePath, 10, 5).map(block => block.count), [5, 3, 3]);
assert.deepEqual(planScanAccompaniment(edgeProfile, reversePath, 10, 5, forwardPlan, 2).map(block => block.count), [1, 3, 3]);
assert.deepEqual(planScanAccompaniment(edgeProfile, reversePath, 10, 0), []);
assert.deepEqual(planScanAccompaniment({ min: .15, max: .154, columns: edgeProfile.columns }, reversePath, 10, 5)
  .map(block => block.count), [1, 1, 1]);
assert.equal(planScanAccompaniment(edgeProfile, buildScanRoute("forward", [], [0, 1], 2), 2, 5).length, 1);
const pixelBoundaryProfile = { min: 0, max: 1, columns: Array.from({ length: 640 }, (_, index) => ({
  edges: index % 2, pairs: 1,
})) };
const sameSpanPlan = direction => planScanAccompaniment(
  pixelBoundaryProfile, buildScanRoute(direction, [], [0, .2], 4), 4, 5,
);
assert.deepEqual(sameSpanPlan("forward"), sameSpanPlan("reverse"));

const roundTrip = buildScanRoute("roundtrip", [], [0, 1], 15);
assert.deepEqual(roundTrip.map(({ startBar, endBar }) => [startBar, endBar]), [[0, 8], [8, 15]]);
assert.equal(scanPoint(roundTrip, 8 / 15).index, 1);
assert.equal(scanPoint(roundTrip, 1).x, 0);
const partialBars = 30 * 110 / 240;
const partialRoute = buildScanRoute("roundtrip", [], [0, 1], partialBars);
assert.equal(partialRoute.at(-1).endBar, 13);
assert.ok(partialRoute.at(-1).end < 1);
assert.equal(scanPoint(partialRoute, 1).x, 0);
assert.equal(buildScanRoute("roundtrip", [], [0, 1], 1.5).length, 0);
assert.deepEqual(quantizePassages([{ from: 7 / 15, to: 8 / 15 }, { from: 8.1 / 15, to: 8.2 / 15 }], 15, 15), [{ from: 7, to: 9 }]);

const firstLivePath = insertScanRange(roundTrip, { from: .8, to: .2 }, 2, 15);
const secondLivePath = insertScanRange(firstLivePath, { from: .3, to: .6 }, 2, 15);
assert.deepEqual(secondLivePath.slice(0, 2), firstLivePath.slice(0, 2));
assert.equal(scanPoint(secondLivePath, 1 / 15).x, scanPoint(roundTrip, 1 / 15).x);
assert.deepEqual(secondLivePath.map(({ from, to }) => [from, to]), [
  [0, .25], [.8, .2], [.3, .6], [.25, 1], [1, 0],
]);
assert.equal(secondLivePath[2].startBar, secondLivePath[1].endBar);
assert.equal(secondLivePath.at(-1).endBar, 15);
assert.ok(secondLivePath.every((segment, i) => segment.endBar > segment.startBar
  && (i === 0 || segment.startBar === secondLivePath[i - 1].endBar)));
const liveWithTail = insertScanRange(partialRoute, { from: .7, to: .4 }, 3, partialBars);
assert.equal(liveWithTail.at(-1).end, partialRoute.at(-1).end);
assert.equal(scanPoint(liveWithTail, 1).x, scanPoint(partialRoute, 1).x);
assert.equal(insertScanRange(partialRoute, { from: .7, to: .4 }, 12, partialBars), null);
assert.equal(insertScanRange(roundTrip, { from: .5, to: .5 }, 3, 15), null);

const seamColumns = new Uint32Array(100).fill(3);
seamColumns[49] = 0;
for (const direction of ["forward", "reverse"]) {
  const route = buildScanRoute(direction, []);
  assert.equal(planRegionScan(route, seamColumns, [50]).passages.length, 1);
  assert.equal(planRegionScan(route, seamColumns).passages.length, 2);
}
assert.equal(seamColumns[49], 0);
seamColumns.fill(0, 47, 54);
assert.equal(planRegionScan(buildScanRoute("forward", []), seamColumns, [50]).passages.length, 2);

const ranges = buildScanRoute("custom", [{ from: 0, to: .25 }, { from: 1, to: .75 }]);
const regionColumns = new Uint32Array(100).fill(1, 20, 25);
const { passages } = planRegionScan(ranges, regionColumns);
const filter = seconds => scanProximity(passages, seconds / 30, 30);
assert.equal(filter(8.4), 0);
assert.ok(Math.abs(filter(10.25) - .5) < 1e-9);
assert.equal(filter(12), 1);
assert.equal(filter(15), 1);
assert.ok(Math.abs(filter(17.25) - .5) < 1e-9, "Filter continues to close after the route jumps");
assert.ok(filter(19.5) < 1e-9);

const source = fs.readFileSync(new URL("./static/app.js", import.meta.url), "utf8")
  .split("scanPlay.addEventListener")[0];
let now = 1000;
const epoch = 1800000000000;
const context = vm.createContext({
  assert,
  console,
  document: {
    querySelector: () => ({ getContext() {}, closest() {}, value: 70 }),
    querySelectorAll: () => [],
  },
  window: {},
  location: { protocol: "http:", host: "localhost" },
  performance: { now: () => now, timeOrigin: epoch },
  tick: (value) => { now = value; },
});
vm.runInContext(fs.readFileSync(new URL("./static/music-templates.js", import.meta.url), "utf8"), context);
vm.runInContext(source, context);
vm.runInContext(`
state.arrangement.choice = "acid_drive_01";
state.mode = "scan";
soundEngine.enabled = true;
const visual = { brightness: .5, saturation: .5, hue: .4, texture: .5 };
state.regions = ["lead_synth", "counter_synth", "bass", "drums"].map((id, index) => ({
  id, type: "figure", index: index + 1, label: id, area_ratio: .2, color_rgb: [90, 150, 200],
  instrument: INSTRUMENT_ROLES.find(role => role.id === id),
}));
for (const bpm of [40, 118, 200]) {
  state.music = { bpm, root: "D", mode: "major" };
  state.scan.playing = true;
  state.scan.startedAt = 1000;
  state.scan.startedFrom = 0;
  const all = [];
  const jitter = [50, 67, 40, 92, 113, 53, 130];
  let elapsed = 0;
  let frame = 0;
  while (elapsed < 32 * 60000 / bpm) {
    tick(1000 + elapsed);
    state.scan.seconds = Math.max(0, (elapsed - 40) / 1000);
    state.scan.regions = state.regions.map(region => ({
      region, intensity: .8, centroidY: .5,
      ...visual, texture: .5 + .25 * Math.sin(frame),
    }));
    const beat = musicBeatPosition(true);
    assert.ok(Math.abs(beat - elapsed * bpm / 60000) < 1e-8);
    const voices = activeMusicVoices(true, null, state.scan.regions, null, beat);
    const scheduled = scheduleMusicEvents(voices, beat);
    for (const event of scheduled.scheduledEvents) {
      const expected = performance.timeOrigin + 1000 + event.onsetBeat * 60000 / bpm + 180;
      assert.ok(Math.abs(event.scheduledAtMs - expected) < .001);
      assert.ok(event.scheduledAtMs > performance.timeOrigin + performance.now());
      all.push(event);
    }
    elapsed += jitter[frame++ % jitter.length];
  }
  const keys = all.map(event => event.eventId);
  assert.equal(new Set(keys).size, keys.length, "An onset must never be scheduled twice");
  for (const role of ["bass", "counter_synth"]) {
    const steps = all.filter(event => event.instrumentId === role).map(event => Math.round(event.onsetBeat * 4));
    assert.equal(steps[0], 0);
    assert.equal(steps.length, steps.at(-1) + 1, role + " must keep every sixteenth under UI jitter");
  }
}
const before = state.scheduler.session;
state.scan.startedAt = 50000;
tick(50000);
state.scan.startedFrom = 3;
const beat = musicBeatPosition(true);
const voices = activeMusicVoices(true, null, state.scan.regions, null, beat);
scheduleMusicEvents(voices, beat);
assert.ok(state.scheduler.session > before, "Seeking must invalidate pending notes");
state.mode = "pointer";
state.musicTimeline = { running: true, startedAt: 1000, elapsed: 0, duration: 600 };
tick(1000);
state.pointer.regions = state.regions.map(region => ({
  region, intensity: 1, x: .5, y: .5, visual,
}));
const pointerVoices = activeMusicVoices(false, null, []);
const pointerEvents = scheduleMusicEvents(pointerVoices, musicBeatPosition(false)).scheduledEvents;
assert.ok(pointerEvents.length >= 3);
assert.ok(pointerEvents.every(event => event.scheduledAtMs === pointerEvents[0].scheduledAtMs));
scheduleMusicEvents([], 0);
assert.ok(scheduleMusicEvents(pointerVoices, 0).scheduledEvents.length, "A region must sound again after toggling it off and on");
console.log("Shared clock: no drift, duplicate onsets, or missing sixteenths at 40/118/200 BPM");
`, context);
