const assetRoot = "/runtime/mix-review/";
const volumeStorage = "streetart:fm-instrument-volumes";
const instruments = [
  ["lead_synth", "Lead Synth"], ["counter_synth", "Arp Synth"],
  ["drums", "Drums"], ["bass", "Acid Bass"], ["guitar", "Guitar"],
  ["pad", "Pad"], ["organ", "FM Organ"], ["keys_mallet", "Keys / Mallet"],
  ["percussion_texture", "Percussion / Texture"],
];
const $ = id => document.getElementById(id);
const playButton = $("play");
const restartButton = $("restart");
const position = $("position");
const time = $("time");
const status = $("status");
const saveButton = $("save");
const revertButton = $("revert");
const downloadButton = $("download");
const exampleButtons = new Map();
const channels = new Map();
let saved = readMix();
let levels = { ...saved };
let context;
let master;
let selected;
let cursor = 0;
let playing = null;
let request = null;
let scrubbing = false;
const bufferCache = new Map();

function readMix(raw) {
  let data;
  try {
    data = JSON.parse(raw ?? localStorage.getItem(volumeStorage) ?? "{}");
  } catch {
    data = {};
  }
  return Object.fromEntries(instruments.map(([id]) => {
    const level = data?.[id] ?? (id === "organ" ? data?.strings : undefined);
    return [id, Number.isFinite(level) ? Math.round(Math.min(1, Math.max(0, level)) * 100) / 100 : 1];
  }));
}

function dirty() {
  return instruments.some(([id]) => levels[id] !== saved[id]);
}

function updateSaveButtons() {
  saveButton.disabled = !dirty();
  revertButton.disabled = !dirty();
}

function showLevel(id) {
  const { input, output } = channels.get(id);
  input.value = Math.round(levels[id] * 100);
  output.value = `${input.value}%`;
  const node = playing?.gains.get(id);
  if (node) node.gain.setTargetAtTime(levels[id], context.currentTime, .02);
}

for (const [id, name] of instruments) {
  const row = document.createElement("div");
  row.className = "channel";
  const label = document.createElement("label");
  label.htmlFor = `gain-${id}`;
  label.textContent = name;
  const unused = document.createElement("span");
  unused.className = "unused";
  unused.textContent = "Silent in this scan";
  unused.hidden = true;
  label.append(unused);
  const input = document.createElement("input");
  input.type = "range";
  input.id = label.htmlFor;
  input.min = "0";
  input.max = "100";
  const output = document.createElement("output");
  output.htmlFor = input.id;
  row.append(label, input, output);
  $("channels").append(row);
  channels.set(id, { row, unused, input, output });
  showLevel(id);
  input.addEventListener("input", () => {
    levels[id] = Number(input.value) / 100;
    showLevel(id);
    updateSaveButtons();
    status.textContent = dirty() ? "Unsaved mix changes." : "";
  });
}
updateSaveButtons();

saveButton.addEventListener("click", () => {
  try {
    localStorage.setItem(volumeStorage, JSON.stringify(levels));
  } catch {
    status.textContent = "This browser could not save the mix. Download a copy to keep these levels.";
    return;
  }
  saved = { ...levels };
  updateSaveButtons();
  status.textContent = "Saved. The project uses these instrument levels in this browser.";
});

revertButton.addEventListener("click", () => {
  levels = { ...saved };
  for (const [id] of instruments) showLevel(id);
  updateSaveButtons();
  status.textContent = "Restored the last saved levels.";
});

downloadButton.addEventListener("click", () => {
  const file = new Blob([JSON.stringify(levels, null, 2) + "\n"], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "street-art-instrument-mix.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

window.addEventListener("storage", event => {
  if (event.key !== volumeStorage || event.storageArea !== localStorage) return;
  const edited = dirty();
  saved = readMix(event.newValue ?? "{}");
  if (!edited) {
    levels = { ...saved };
    for (const [id] of instruments) showLevel(id);
  }
  updateSaveButtons();
});

function audioGraph() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 2.1;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 10;
    compressor.ratio.value = 5;
    compressor.attack.value = .003;
    compressor.release.value = .12;
    master.connect(compressor).connect(context.destination);
  }
  if (context.state !== "running") return context.resume();
  return Promise.resolve();
}

function decodedTracks(example) {
  if (!bufferCache.has(example.id)) {
    const ready = Promise.all(example.tracks.map(async ({ role, file }) => {
      const response = await fetch(assetRoot + file);
      if (!response.ok) throw new Error("A rendered part is unavailable.");
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return { role, buffer };
    })).catch(error => {
      bufferCache.delete(example.id);
      throw error;
    });
    bufferCache.set(example.id, ready);
  }
  return bufferCache.get(example.id);
}

function elapsed() {
  return playing
    ? Math.min(selected.duration, playing.offset + Math.max(0, context.currentTime - playing.at))
    : cursor;
}

function clock(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function showTime(seconds = elapsed()) {
  if (!scrubbing) position.value = seconds;
  time.value = `${clock(seconds)} / ${clock(selected?.duration ?? 30)}`;
}

function stopPlayback(nextCursor = elapsed()) {
  request = null;
  cursor = nextCursor;
  const previous = playing;
  playing = null;
  if (previous) {
    cancelAnimationFrame(previous.raf);
    for (const source of previous.sources) source.stop();
  }
  playButton.textContent = "Play";
  playButton.disabled = !selected;
  showTime();
}

function startPlayback(tracks) {
  const at = context.currentTime + .035;
  const offset = cursor >= selected.duration ? 0 : cursor;
  const performance = { at, offset, sources: [], gains: new Map(), raf: 0 };
  playing = performance;
  for (const { role, buffer } of tracks) {
    const gain = context.createGain();
    gain.gain.value = levels[role];
    gain.connect(master);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(at, offset);
    source.stop(at + selected.duration - offset);
    performance.sources.push(source);
    performance.gains.set(role, gain);
  }
  playButton.textContent = "Pause";
  playButton.disabled = false;
  status.textContent = "";
  function tick() {
    if (playing !== performance) return;
    if (elapsed() >= selected.duration) {
      stopPlayback(selected.duration);
      return;
    }
    if (!scrubbing) showTime();
    performance.raf = requestAnimationFrame(tick);
  }
  tick();
}

async function play() {
  if (!selected || request) return;
  const token = request = {};
  const example = selected;
  playButton.textContent = "Loading…";
  playButton.disabled = true;
  try {
    await audioGraph();
    if (request !== token) return;
    const tracks = await decodedTracks(example);
    if (request !== token) return;
    startPlayback(tracks);
    request = null;
  } catch (error) {
    if (request === token || (selected === example && playing)) {
      stopPlayback(cursor);
      status.textContent = error.message || "The rendered audio could not play.";
    }
  }
}

function selectExample(example) {
  stopPlayback(0);
  selected = example;
  for (const [id, button] of exampleButtons) button.setAttribute("aria-pressed", String(example.id === id));
  const audible = new Set(example.tracks.map(track => track.role));
  for (const [id, { row, unused }] of channels) {
    row.dataset.present = String(audible.has(id));
    unused.hidden = audible.has(id);
  }
  restartButton.disabled = position.disabled = playButton.disabled = false;
  position.max = example.duration;
  showTime();
  status.textContent = `${audible.size} instruments in this scan.`;
}

playButton.addEventListener("click", () => playing ? stopPlayback() : void play());
restartButton.addEventListener("click", () => {
  stopPlayback(0);
  void play();
});
position.addEventListener("input", () => {
  scrubbing = true;
  showTime(Number(position.value));
});
position.addEventListener("change", () => {
  scrubbing = false;
  const resume = Boolean(playing || request);
  const offset = Number(position.value);
  stopPlayback(offset);
  if (resume && offset < selected.duration) void play();
});

async function loadExamples() {
  try {
    const response = await fetch(assetRoot + "manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("The rendered scans are unavailable.");
    const { examples } = await response.json();
    for (const example of examples) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "example";
      const image = new Image();
      image.src = assetRoot + example.image;
      image.alt = "";
      const title = document.createElement("strong");
      title.textContent = example.title;
      const details = document.createElement("small");
      details.textContent = `${example.bpm} BPM · ${example.key} ${example.mode} · ${example.direction}`;
      button.append(image, title, details);
      button.addEventListener("click", () => {
        if (selected !== example) selectExample(example);
      });
      exampleButtons.set(example.id, button);
      $("examples").append(button);
    }
    selectExample(examples[0]);
  } catch {
    status.textContent = "Could not load the rendered scans. Reload to try again.";
  }
}
void loadExamples();
