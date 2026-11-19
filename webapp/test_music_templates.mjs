import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = file => fs.readFileSync(new URL(file, import.meta.url), "utf8");
let now = 1000;
const context = vm.createContext({
  assert, console, setTimeout, clearTimeout,
  document: { querySelector: () => ({ getContext() {}, closest() {}, value: 70 }), querySelectorAll: () => [] },
  window: {}, location: { protocol: "http:", host: "localhost" },
  performance: { timeOrigin: 1800000000000, now: () => now },
  tick: value => { now = value; },
});
vm.runInContext(read("./static/music-templates.js"), context);
vm.runInContext(read("./static/app.js").split("scanPlay.addEventListener")[0], context);
vm.runInContext(`
assert.equal(TEMPLATE_CATALOG.templates.length, 64);
assert.equal(TEMPLATE_CATALOG.families.length, 8);
assert.equal(new Set(TEMPLATE_CATALOG.templates.map(item => JSON.stringify(item.patterns))).size, 64);
for (const family of TEMPLATE_CATALOG.families) {
  state.gems = normalizeGemsProfile({ weights: family.gems });
  selectArrangement();
  assert.equal(state.arrangement.scores[0].id, family.id, "Every authored prototype must select its own family");
}
for (let variation=0; variation<8; variation++) {
  state.manifest = { music_plan: { features: {
    brightness: variation & 4 ? .6 : .4,
    saturation: variation & 2 ? .6 : .3,
    edge_energy: variation & 1 ? .5 : .1,
  } } };
  selectArrangement();
  assert.equal(currentArrangement().version, variation+1, "Visual variation bits must be reproducible");
}
state.mode = "scan";
soundEngine.enabled = true;
state.scan.playing = true;
state.regions = INSTRUMENT_ROLES.map((instrument, index) => ({
  id: instrument.id, instrument, index, label: instrument.label,
  type: "figure", color_rgb: [128,120,180], area_ratio: .1,
}));
const visual = { brightness: .55, saturation: .4, texture: .3, hue: .7 };
for (const template of TEMPLATE_CATALOG.templates) {
  state.arrangement.choice = template.id;
  assert.match(template.grooveSource.sha256, /^[a-f0-9]{64}$/);
  for (const role of INSTRUMENT_ROLES) {
    const bars = template.patterns[role.id];
    assert.equal(bars.length, 4);
    for (const bar of bars) for (const event of bar) {
      assert.ok(event.at >= 0 && event.at < 4 && event.duration > 0);
      assert.ok(Math.abs(event.at*12 - Math.round(event.at*12)) < .001, "All starts must share the scheduler grid");
    }
  }
  // Jittered UI frames must schedule every written onset once, including sparse
  // bass and triplet phrases. A new region may add a single quantized entry.
  state.music = { bpm: 126, root: "F#", mode: "minor" };
  state.scan.startedAt = 1000;
  state.scan.startedFrom = 0;
  const actual = new Map(state.regions.map(region => [region.id, new Set()]));
  let elapsed = 0, frame = 0;
  while (elapsed * 126 / 60000 < 16) {
    tick(1000 + elapsed);
    const beat = musicBeatPosition(true);
    const scanRegions = state.regions.map(region => ({ region, intensity: .8, centroidY: .5, ...visual }));
    const voices = scanRegions.flatMap(item => activeMusicVoices(true, null, [item], null, beat));
    for (const event of scheduleMusicEvents(voices, beat).scheduledEvents) {
      const positions = actual.get(event.regionId);
      const key = Math.round(event.onsetBeat*12);
      assert.ok(!positions.has(key), "No duplicate scheduled onsets");
      positions.add(key);
    }
    elapsed += [50,71,41,108,131,65][frame++%6];
  }
  // Flush the final part of the fourth bar, without entering the next phrase.
  tick(1000+15.999*60000/126);
  const voices = state.regions.flatMap(region=>activeMusicVoices(true,null,[{region,intensity:.8,centroidY:.5,...visual}],null,15.999));
  for (const event of scheduleMusicEvents(voices,15.999).scheduledEvents) actual.get(event.regionId).add(Math.round(event.onsetBeat*12));
  for (const role of INSTRUMENT_ROLES) template.patterns[role.id].forEach((bar,index) => {
    for (const event of bar) assert.ok(actual.get(role.id).has(Math.round((index*4+event.at)*12)), template.id+" lost "+role.id+" onset");
  });
  // Transposition, chord voicing and synthesis controls must stay valid in every
  // root and supported mode, for all nine roles.
  for (const root of NOTE_NAMES) for (const mode of Object.keys(MUSIC_MODES)) {
    state.music = { bpm: 120, root, mode };
    for (const region of state.regions) {
      const event = musicEventForRegion(region,.5,.5,4,0,.8,true,visual);
      assert.ok(event.notes.length > 0);
      assert.ok(event.notes.every(note=>Number.isInteger(note)&&note>=0&&note<=127));
      assert.ok(event.velocity>=1&&event.velocity<=127);
      const controls=performanceControls(region,visual,.5,.5,.8,event.accent);
      assert.ok(Object.values(controls).every(value=>Number.isFinite(value)&&value>=0&&value<=1));
    }
  }
}
console.log("64 arrangements: distinct coordinated phrases, 8 GEMS families, deterministic visual selection, all onsets retained, 12 keys × 6 modes valid");
`, context);

// Exercise the real graph construction and automation against AudioParam mocks.
// Rendering/audition is checked separately in a browser; this catches graph and
// control errors even without a microphone/camera or physical MIDI port.
class Param {
  value = 0;
  targets = [];
  setTargetAtTime(value,time,constant) {
    assert.ok(Number.isFinite(value) && Number.isFinite(time) && constant > 0);
    this.targets.push(value); this.value = value;
  }
}
class Node {
  gain = new Param(); frequency = new Param(); delayTime = new Param(); pan = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  port = { postMessage() {} };
  connections = [];
  connect(target) { this.connections.push(target); return target; }
  start() { this.started = true; }
}
class AudioContext {
  sampleRate = 48000; currentTime = 1;
  destination = new Node();
  audioWorklet = { addModule: async()=>{} };
  addEventListener() {}
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createDelay() { return new Node(); }
  createOscillator() { return new Node(); }
  createConvolver() { return new Node(); }
  createBuffer(channels,length) { return { numberOfChannels:channels, getChannelData:()=>new Float32Array(length) }; }
}
context.window.AudioContext = AudioContext;
context.AudioWorkletNode = Node;
await vm.runInContext(`
(async()=>{
  const engine = new SoundEngine();
  await engine.setupAudioGraph();
  assert.equal(engine.chorusDepths.length,2);
  engine.applyControlFrame([{mix:1,controls:{reverb:.8,chorus:.9,delay:.7,movement:1,expression:1}}]);
  const remembered = {...engine.effectMemory};
  engine.applyControlFrame([]);
  assert.deepEqual(engine.effectMemory,remembered,"Spaces between notes must not reset the effects");
  assert.ok(engine.chorusWet.gain.value > .2 && engine.chorusWet.gain.value < .35);
  assert.ok(engine.chorusDepths.every(node=>node.gain.value>.004 && node.gain.value<.008));
  assert.ok(engine.delayFeedback.gain.value<.6);
  assert.equal(engine.delay.delayTime.targets.length,1,"Delay time only changes when BPM/subdivision changes");
  console.log("Effects: stereo chorus, smooth bounded returns, continuous control memory, stable tempo delay");
})()
`, context);
