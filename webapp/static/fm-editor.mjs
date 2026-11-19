import {
  DRUM_VOICES, PROJECT_PRESET_NAMES, drumDefaultValue, fmDefaultValue, fmGroups, normalizeDrumPatch,
  normalizeFmPatch, rebasePreset,
} from "./fm-patches.mjs?v=performance-mix1";
import { drumPresets, instrumentPresets } from "./fm-editor-presets.mjs?v=patch-editor3";

const instruments = {
  lead_synth: "Lead Synth",
  counter_synth: "Arp Synth",
  drums: "Drums",
  bass: "Acid Bass",
  guitar: "Guitar",
  pad: "Pad",
  organ: "FM Organ",
  keys_mallet: "Keys / Mallet",
  percussion_texture: "Percussion / Texture",
};
const labels = {
  lead_synth: "Serial FM",
  counter_synth: "Parallel FM",
  bass: "Acid voice · filter and tempo-synced LFO",
  guitar: "Branched FM",
  pad: "Parallel FM",
  organ: "Parallel FM",
  keys_mallet: "Serial FM",
  percussion_texture: "Noise and resonant percussion",
};
const storageKey = "street-art-fm-patch-draft-v2";
const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  "instruments", "patch-title", "patch-info", "reset", "export", "drum-pieces", "play", "play-kit",
  "compare-default", "compare-draft", "loop", "meter", "status", "knobs", "preset", "use-preset",
].map(id => [id, byId(id)]));

const instrumentButtons = {};
const drumButtons = {};
const fieldViews = [];
let role = "lead_synth";
let drumNote = 36;
let compareDefault = false;
let activePreset = null;
let audioPromise;
let audio;
let playback = null;
let previewGeneration = 0;
let audioError = "";
let storedLocally = true;
const overrides = readDraft();

function readDraft() {
  let saved;
  let legacy = false;
  try {
    const current = localStorage.getItem(storageKey);
    legacy = current === null;
    saved = JSON.parse(current ?? localStorage.getItem("street-art-fm-patch-draft-v1"));
  } catch {
    storedLocally = false;
  }
  const result = { instruments: {}, drums: {} };
  for (const id of Object.keys(instruments)) {
    if (id === "drums") continue;
    const source = saved?.instruments?.[id];
    if (!source) continue;
    const values = legacy ? libraryChanges(id, null, source) : normalizeFmPatch(id, source);
    if (Object.keys(values).length) result.instruments[id] = values;
  }
  for (const note of Object.keys(DRUM_VOICES)) {
    const source = saved?.drums?.[note];
    if (!source) continue;
    const values = legacy ? libraryChanges("drums", note, source) : normalizeDrumPatch(note, source);
    if (Object.keys(values).length) result.drums[note] = values;
  }
  return result;
}

function saveDraft() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(overrides));
    storedLocally = true;
  } catch {
    storedLocally = false;
  }
}

function selection() {
  return role === "drums" ? [overrides.drums, drumNote] : [overrides.instruments, role];
}

function baseline(control) {
  return role === "drums" ? drumDefaultValue(drumNote, control) : fmDefaultValue(role, control);
}

function normalise(values) {
  return role === "drums" ? normalizeDrumPatch(drumNote, values) : normalizeFmPatch(role, values);
}

function libraryChanges(id, note, values) {
  if (id === "drums") {
    return rebasePreset(values, DRUM_VOICES[note].groups,
      (control, options) => drumDefaultValue(note, control, options));
  }
  return rebasePreset(values, fmGroups(id, { expanded: true }),
    (control, options) => fmDefaultValue(id, control, options));
}

function status() {
  const [group, id] = selection();
  const name = PROJECT_PRESET_NAMES[role === "drums" ? "drums" : "instruments"][id];
  const defaultStatus = name ? "Project default · " + name : "Using the project defaults.";
  ui.status.textContent = audioError || (activePreset ? "Previewing " + activePreset.name + "."
    : compareDefault ? defaultStatus
    : group[id] ? (storedLocally ? "Draft saved in this browser." : "Draft is available for export.")
    : defaultStatus);
}

function updateButtons() {
  const [group, id] = selection();
  ui.reset.disabled = Boolean(activePreset || !group[id]);
  ui["use-preset"].hidden = !activePreset;
  ui.export.disabled = !Object.keys(overrides.instruments).length && !Object.keys(overrides.drums).length;
  ui["compare-default"].setAttribute("aria-pressed", String(compareDefault));
  ui["compare-draft"].setAttribute("aria-pressed", String(!compareDefault && !activePreset));
  for (const [instrument, button] of Object.entries(instrumentButtons)) {
    button.setAttribute("aria-pressed", String(role === instrument));
    button.lastElementChild.hidden = !(instrument === "drums"
      ? Object.keys(overrides.drums).length : overrides.instruments[instrument]);
  }
  for (const [note, button] of Object.entries(drumButtons)) {
    button.setAttribute("aria-pressed", String(Number(note) === drumNote));
    button.lastElementChild.hidden = !overrides.drums[note];
  }
  status();
}

function refreshFields() {
  const [group, id] = selection();
  const values = activePreset?.values ?? (compareDefault ? {} : group[id] || {});
  for (const view of fieldViews) {
    const value = values[view.control.key];
    view.show(value ?? baseline(view.control), value !== undefined, Boolean(activePreset));
  }
  updateButtons();
}

function setValue(control, value) {
  if (activePreset) return;
  const [group, id] = selection();
  const values = normalise({ ...group[id], [control.key]: value });
  if (Object.keys(values).length) group[id] = values;
  else delete group[id];
  compareDefault = false;
  saveDraft();
  refreshFields();
  syncPatches();
}

function makeKnob(control) {
  const knob = document.createElement("div");
  knob.className = "knob";
  const dial = document.createElement("div");
  dial.className = "dial";
  const range = document.createElement("input");
  range.type = "range";
  range.id = "knob-" + control.key;
  const valueBox = document.createElement("div");
  valueBox.className = "knob-value";
  const number = document.createElement("input");
  number.type = "number";
  number.step = "any";
  number.setAttribute("aria-label", control.label + " value" + (control.unit ? " (" + control.unit + ")" : ""));
  for (const input of [range, number]) {
    input.min = control.min;
    input.max = control.max;
  }
  range.step = control.step;
  const label = document.createElement("label");
  label.htmlFor = range.id;
  label.textContent = control.label;
  dial.append(range);
  valueBox.append(number, control.unit);
  knob.append(dial, valueBox, label);

  let currentValue;
  const span = control.max - control.min;
  const logScale = ["Hz", "s"].includes(control.unit) && control.min > 0 && control.max / control.min > 10;
  const scaleValue = fraction => logScale
    ? control.min * (control.max / control.min) ** fraction
    : control.min + span * fraction;
  const fractionOf = value => logScale
    ? Math.log(value / control.min) / Math.log(control.max / control.min)
    : (value - control.min) / span;
  const show = (value, edited, disabled) => {
    currentValue = value;
    range.value = value;
    number.value = value;
    range.disabled = number.disabled = disabled;
    range.setAttribute("aria-valuetext", (value + " " + control.unit).trim());
    dial.style.setProperty("--dial-angle", fractionOf(value) * 270 + "deg");
    knob.toggleAttribute("data-edited", edited);
  };
  range.addEventListener("input", () => setValue(control, range.valueAsNumber));
  number.addEventListener("change", () => {
    if (Number.isFinite(number.valueAsNumber)) setValue(control, number.valueAsNumber);
    else show(currentValue, knob.hasAttribute("data-edited"));
  });
  number.addEventListener("keydown", event => {
    if (event.key === "Enter") number.blur();
  });
  let drag;
  dial.addEventListener("pointerdown", event => {
    if (event.button !== 0 || range.disabled) return;
    event.preventDefault();
    range.focus();
    dial.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, start: fractionOf(currentValue) };
  });
  dial.addEventListener("pointermove", event => {
    if (!drag) return;
    const distance = drag.y - event.clientY + (event.clientX - drag.x) * .6;
    if (Math.abs(distance) < 1) return;
    const value = scaleValue(Math.max(0, Math.min(1, drag.start + distance / (event.shiftKey ? 1400 : 140))));
    const rounded = Math.round((value - control.min) / control.step) * control.step + control.min;
    setValue(control, Number(rounded.toFixed(4)));
  });
  dial.addEventListener("lostpointercapture", () => { drag = null; });
  dial.addEventListener("dblclick", () => setValue(control, baseline(control)));
  fieldViews.push({ control, show });
  return knob;
}

function makeChoice(control) {
  const container = document.createElement("div");
  container.className = "waveform-select";
  const input = document.createElement("select");
  input.id = "waveform-" + control.key;
  const label = document.createElement("label");
  label.htmlFor = input.id;
  label.textContent = control.label;
  for (const [value, name] of Object.entries(control.options)) input.add(new Option(name, value));
  input.addEventListener("change", () => {
    setValue(control, input.value);
    restartPreview();
  });
  fieldViews.push({
    control,
    show(value, edited, disabled) {
      input.value = value;
      input.disabled = disabled;
      container.toggleAttribute("data-edited", edited);
    },
  });
  container.append(label, input);
  return container;
}

function presetsForSelection() {
  return role === "drums" ? drumPresets[drumNote] : instrumentPresets[role];
}

function renderSelection() {
  const isDrum = role === "drums";
  activePreset = null;
  ui.preset.replaceChildren(
    new Option("Choose a preset", ""),
    ...presetsForSelection().map((preset, index) => new Option(preset.name, String(index))),
  );
  ui["patch-title"].textContent = isDrum ? DRUM_VOICES[drumNote].label : instruments[role];
  ui["patch-info"].textContent = isDrum ? "Drums · MIDI note " + drumNote : labels[role];
  ui["drum-pieces"].hidden = ui["play-kit"].hidden = !isDrum;
  fieldViews.length = 0;
  const groups = isDrum ? DRUM_VOICES[drumNote].groups : fmGroups(role, { expanded: true });
  ui.knobs.replaceChildren(...groups.map(group => {
    const section = document.createElement("section");
    section.className = "panel";
    const heading = document.createElement("h3");
    heading.textContent = group.label;
    const grid = document.createElement("div");
    grid.className = "knob-grid";
    grid.append(...group.fields.map(control => control.options ? makeChoice(control) : makeKnob(control)));
    section.append(heading);
    if (drumNote === 36 && isDrum && group.label === "Filter and drive") {
      const note = document.createElement("p");
      note.className = "panel-note";
      note.textContent = "The kick bypasses this stage until one of these controls is changed.";
      section.append(note);
    }
    section.append(grid);
    return section;
  }));
  refreshFields();
}

function addSelector(container, title, handler) {
  const button = document.createElement("button");
  button.type = "button";
  const dot = document.createElement("span");
  dot.className = "edited-dot";
  dot.setAttribute("aria-label", "Has draft changes");
  button.append(title, dot);
  button.addEventListener("click", handler);
  container.append(button);
  return button;
}

for (const [id, title] of Object.entries(instruments)) {
  instrumentButtons[id] = addSelector(ui.instruments, title, () => {
    if (role === id) return;
    stopPreview();
    role = id;
    audioError = "";
    renderSelection();
  });
}
for (const [note, drum] of Object.entries(DRUM_VOICES)) {
  drumButtons[note] = addSelector(ui["drum-pieces"], drum.label, () => {
    if (drumNote === Number(note)) return;
    stopPreview();
    drumNote = Number(note);
    audioError = "";
    renderSelection();
  });
}

const beatSeconds = .48;
// Beat, MIDI note, duration in beats, velocity.
const phrases = {
  lead_synth: [[0, 60, .7, .82], [1, 64, .4, .72], [1.5, 67, .4, .72], [2, 69, 1.35, .78]],
  counter_synth: [60, 67, 72, 76, 64, 67, 72, 79].map((note, i) => [i * .5, note, .28, i % 2 ? .64 : .78]),
  bass: [[0, 36, .74, .9], [1, 36, .38, .72], [1.5, 43, .4, .67], [2, 36, .88, .8], [3.25, 34, .6, .73]],
  guitar: [[0, 57, .7, .76], [.35, 64, .55, .7], [.7, 67, .6, .66], [1.05, 72, .8, .72], [2.5, 64, 1, .74]],
  pad: [48, 55, 60, 64].map(note => [0, note, 3.3, .65]),
  organ: [60, 64, 67, 72].flatMap(note => [[0, note, 1.4, .64], [2, note + 2, 1.4, .61]]),
  keys_mallet: [[0, 60, .4, .82], [.5, 64, .4, .69], [1.2, 67, .45, .73], [2, 72, 1.2, .72]],
  percussion_texture: [[0, 42, .2, .80], [.75, 37, .2, .72], [1.5, 45, .2, .8], [2, 42, .2, .77], [2.75, 47, .2, .76], [3.5, 39, .2, .67]],
};
const kitPhrase = [
  [0, 36, .2, .9], [0, 42, .2, .68], [.5, 42, .2, .52], [1, 38, .2, .82],
  [1, 42, .2, .59], [1.5, 46, .2, .72], [2, 36, .2, .83], [2, 42, .2, .62],
  [2.5, 42, .2, .55], [2.75, 36, .2, .7], [3, 39, .2, .8], [3, 42, .2, .64], [3.5, 46, .2, .76],
];

async function getAudio() {
  if (!audioPromise) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    const context = new Audio();
    const resumed = context.resume();
    audioPromise = (async () => {
      try {
        await Promise.all([resumed, context.audioWorklet.addModule("./fm-worklet.js?v=performance-mix1")]);
        const voice = new AudioWorkletNode(context, "street-art-fm", {
          numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        });
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -15;
        limiter.ratio.value = 8;
        limiter.attack.value = .003;
        const meter = context.createAnalyser();
        meter.fftSize = 256;
        voice.connect(limiter).connect(meter).connect(context.destination);
        return { context, voice, meter, samples: new Float32Array(meter.fftSize) };
      } catch (error) {
        audioPromise = null;
        context.close().catch(() => {});
        throw error;
      }
    })();
  }
  const engine = await audioPromise;
  if (engine.context.state !== "running") await engine.context.resume();
  return engine;
}

function syncPatches() {
  if (!audio) return;
  if (role === "drums") {
    for (const note of Object.keys(DRUM_VOICES)) {
      audio.voice.port.postMessage({
        type: "drum-patch", note: Number(note),
        values: Number(note) === drumNote && activePreset ? activePreset.values
          : compareDefault ? {} : overrides.drums[note] || {},
      });
    }
  } else {
    audio.voice.port.postMessage({
      type: "instrument-patch", role,
      values: activePreset?.values ?? (compareDefault ? {} : overrides.instruments[role] || {}),
    });
  }
}

function playPhrase(kind, start) {
  const events = kind === "kit" ? kitPhrase : role === "drums"
    ? [[0, drumNote, .2, .84]]
    : phrases[role];
  for (const [beat, note, duration, velocity] of events) {
    audio.voice.port.postMessage({
      type: "note", role, note, duration: duration * beatSeconds, velocity,
      time: start + beat * beatSeconds, onsetBeat: beat, beatSeconds, gemsWeights: "artwork",
      visual: { brightness: .5, saturation: .4, texture: .28, hue: .5 },
      controls: { brightness: .5, harmonicIntensity: .4, attack: .27, release: .29, chorus: .25 },
    });
  }
}

function updateMeter() {
  if (!playback) return;
  audio.meter.getFloatTimeDomainData(audio.samples);
  const peak = audio.samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
  ui.meter.value = peak;
  playback.meterFrame = requestAnimationFrame(updateMeter);
}

function stopPreview() {
  previewGeneration++;
  if (!playback) return;
  clearTimeout(playback.timer);
  cancelAnimationFrame(playback.meterFrame);
  audio.voice.port.postMessage({ type: "cancel" });
  playback = null;
  ui.meter.value = 0;
  ui.play.textContent = "Play";
  ui["play-kit"].textContent = "Play drum kit";
}

async function startPreview(kind) {
  const wasPlaying = playback?.kind === kind;
  stopPreview();
  if (wasPlaying) return;
  const generation = previewGeneration;
  audioError = "";
  status();
  try {
    audio = await getAudio();
    if (generation !== previewGeneration) return;
    syncPatches();
    playback = { kind, timer: 0, meterFrame: 0 };
    const button = kind === "kit" ? ui["play-kit"] : ui.play;
    button.textContent = "Stop";
    const cycle = role === "drums" && kind === "selection" ? .85 : 4 * beatSeconds;
    const tail = role === "drums" && kind === "selection" ? .1 : .65;
    const queue = start => {
      playPhrase(kind, start);
      const check = () => {
        const next = start + cycle;
        if (ui.loop.checked) queue(Math.max(next, audio.context.currentTime + .035));
        else playback.timer = setTimeout(stopPreview, (next + tail - audio.context.currentTime) * 1000);
      };
      playback.timer = setTimeout(check, (start + cycle - audio.context.currentTime - .12) * 1000);
    };
    queue(audio.context.currentTime + .065);
    updateMeter();
  } catch (error) {
    if (generation !== previewGeneration) return;
    stopPreview();
    audioError = "Audio could not start. " + error.message;
    status();
  }
}

function restartPreview() {
  if (playback) {
    const { kind } = playback;
    stopPreview();
    startPreview(kind);
  }
}

function compare(useDefault) {
  compareDefault = useDefault;
  activePreset = null;
  ui.preset.value = "";
  refreshFields();
  restartPreview();
}

ui.play.addEventListener("click", () => startPreview("selection"));
ui["play-kit"].addEventListener("click", () => startPreview("kit"));
ui["compare-draft"].addEventListener("click", () => compare(false));
ui.preset.addEventListener("change", () => {
  if (ui.preset.value === "") {
    compare(false);
    return;
  }
  const { name, values } = presetsForSelection()[Number(ui.preset.value)];
  activePreset = { name, values: libraryChanges(role, drumNote, values) };
  compareDefault = false;
  refreshFields();
  const kind = playback?.kind || "selection";
  stopPreview();
  startPreview(kind);
});
ui["use-preset"].addEventListener("click", () => {
  if (!activePreset) return;
  const [group, id] = selection();
  if (Object.keys(activePreset.values).length) group[id] = { ...activePreset.values };
  else delete group[id];
  saveDraft();
  compare(false);
});
ui["compare-default"].addEventListener("click", () => compare(true));
ui.reset.addEventListener("click", () => {
  const [group, id] = selection();
  delete group[id];
  saveDraft();
  compare(false);
});
ui.export.addEventListener("click", () => {
  const file = {
    format: "street-art-fm-patch",
    version: 1,
    instruments: overrides.instruments,
    drums: overrides.drums,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "street-art-fm-patch.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("pagehide", stopPreview);
renderSelection();
