import { reviewPresets } from "./fm-review-presets.mjs?v=1";
import { DRUM_VOICES } from "./fm-patches.mjs?v=electronic-patches1";
import { PRESET_BANK_FORMAT, PRESET_BANK_STORAGE, readPresetBank, snapshotBankPreset } from "./fm-preset-bank.mjs?v=electronic-patches1";

const requestedRound = new URLSearchParams(location.search).get("round");
const leadReview = requestedRound === "lead";
const round = ["2", "3", "4"].includes(requestedRound) ? Number(requestedRound) : 1;
const hasPrevious = leadReview || round > 1;
const levelMatchedReview = leadReview || round >= 3;
const firstRoundAudio = "/runtime/fm-preset-review/audio/";
const reviewRoot = leadReview ? "/runtime/fm-preset-review-lead/" : `/runtime/fm-preset-review-round${round}/`;
const saveStatus = document.querySelector("#save-status");

async function leadMaterials() {
  const [response, { leadReviewPresets }] = await Promise.all([
    fetch("./fm-performance-bank.json?v=lead-selection1"), import("./fm-review-presets-lead.mjs?v=1"),
  ]);
  if (!response.ok) throw new Error("Could not load the current Lead preset bank.");
  const descriptions = {
    "lead-silk": "Rounded, smooth and centered.",
    "r2-lead-whistle": "A long, high, whistle-like tone with a soft onset.",
    "r4-lead-pwm": "A crisp square-pulse lead with moving harmonics.",
    "r4-lead-gate": "Wide detuned lead with a rhythmic gate that chops held notes into pulses.",
  };
  for (const { id, description } of leadReviewPresets) descriptions[id] = description;
  const previous = readPresetBank(await response.json()).presets.filter(preset => preset.role === "lead_synth")
    .map(preset => ({ ...preset, description: descriptions[preset.id] }));
  const current = new Set(previous.map(preset => preset.id));
  return { previous, candidates: leadReviewPresets.filter(preset => !current.has(preset.id)) };
}

async function continuingMaterials() {
  const response = await fetch(reviewRoot + "kept-bank.json");
  if (!response.ok) throw new Error("Could not load the previously kept bank.");
  const keptBank = readPresetBank(await response.json());
  const { roundTwoPresets } = await import("./fm-review-presets-round2.mjs?v=2");
  const { roundThreePresets } = levelMatchedReview ? await import("./fm-review-presets-round3.mjs?v=1") : { roundThreePresets: [] };
  const originals = new Map([...reviewPresets, ...roundTwoPresets, ...roundThreePresets].map(item => [item.id, item]));
  const previous = keptBank.presets.map(item => ({ ...item, description: originals.get(item.id)?.description ?? "" }));
  const candidates = round === 4 ? (await import("./fm-review-presets-round4.mjs?v=1")).roundFourPresets
    : round === 3 ? roundThreePresets : roundTwoPresets;
  return { previous, candidates };
}

const { previous, candidates } = hasPrevious ? await (leadReview ? leadMaterials() : continuingMaterials()).catch(error => {
  saveStatus.textContent = error.message;
  throw error;
}) : { previous: [], candidates: reviewPresets };
const selectable = leadReview ? [...previous, ...candidates] : candidates;

const names = {
  lead_synth: "Lead Synth", counter_synth: "Arp Synth", bass: "Acid Bass", guitar: "Guitar",
  pad: "Pad", organ: "FM Organ", keys_mallet: "Keys / Mallet", percussion_texture: "Percussion / Texture",
};
const drumOrder = [36, 38, 39, 42, 46, 50, 47, 43];
const groupId = ({ role, note }) => note ? String(note) : role;
const groups = new Map([...Object.entries(names), ...drumOrder.map(note => [String(note), DRUM_VOICES[note].label])]
  .map(([key, name]) => [key, {
    name, items: candidates.filter(preset => groupId(preset) === key),
    kept: previous.filter(preset => groupId(preset) === key),
  }]));

const voices = document.querySelector("#voices");
const presets = document.querySelector("#presets");
const heading = document.querySelector("#selection-title");
const filter = document.querySelector("#filter");
const save = document.querySelector("#save-bank");
const empty = document.querySelector("#empty");
const progress = document.querySelector("#progress");
const carried = document.querySelector("#carried");
const carriedTitle = document.querySelector("#carried-title");
const candidatesTitle = document.querySelector("#candidates-title");
const ratingStorage = `street-art-fm-audition-ratings${leadReview ? "-lead" : hasPrevious ? `-round${round}` : ""}-v1`;
let selection = "lead_synth";
let decisions = {};
let playing;

if (hasPrevious) {
  document.title = leadReview ? "Lead Preset Review" : `FM Preset Review · Round ${round}`;
  document.querySelector("#review-title").textContent = document.title;
  document.querySelector("#review-description").textContent = `${previous.length} ${leadReview ? "current" : "previously kept"} · ${candidates.length} new sounds`;
  document.querySelector("#filter-label").textContent = leadReview ? "Show" : "Show new";
  document.querySelector("#carried-section").hidden = false;
  candidatesTitle.hidden = false;
  save.textContent = leadReview ? "Export Lead selections" : "Save updated bank";
  if (leadReview) {
    voices.hidden = true;
    voices.parentElement.classList.add("lead-review");
  }
}

try {
  decisions = JSON.parse(localStorage.getItem(ratingStorage) || "{}") || {};
} catch (_) { /* Selection is usable until the page closes. */ }

function decisionOf(id) {
  const decision = decisions[id];
  return decision === "keep" || decision === "reject" ? decision : "pending";
}

function updateView() {
  const visible = leadReview ? [...carried.children, ...presets.children] : [...presets.children];
  for (const card of visible) {
    const decision = decisionOf(card.dataset.preset);
    card.hidden = filter.value !== "all" && filter.value !== decision;
    if (card.hidden && playing === card.querySelector("audio")) playing.pause();
    for (const button of card.querySelectorAll("[data-decision]")) {
      button.setAttribute("aria-pressed", String(button.dataset.decision === decision));
    }
  }
  empty.hidden = visible.some(card => !card.hidden);
  for (const button of voices.querySelectorAll("[data-group]")) {
    const group = groups.get(button.dataset.group);
    const reviewed = group.items.filter(item => decisionOf(item.id) !== "pending").length;
    button.setAttribute("aria-current", String(button.dataset.group === selection));
    if (levelMatchedReview) {
      const totalKept = group.kept.length + group.items.filter(item => decisionOf(item.id) === "keep").length;
      button.lastElementChild.textContent = `${totalKept} / 5 kept`;
    } else {
      button.lastElementChild.textContent = `${reviewed} / ${group.items.length}`;
    }
  }
  const kept = selectable.filter(item => decisionOf(item.id) === "keep").length;
  const rejected = selectable.filter(item => decisionOf(item.id) === "reject").length;
  const summary = `${kept} kept · ${rejected} rejected · ${selectable.length - kept - rejected} unreviewed`;
  progress.textContent = hasPrevious && !leadReview ? `${previous.length} carried over · ${summary}` : summary;
  save.disabled = (leadReview ? 0 : previous.length) + kept === 0;
}

function textElement(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function cardFor(preset, previouslyKept = false) {
  const card = document.createElement("article");
  card.className = "preset";
  card.dataset.preset = preset.id;
  const description = document.createElement("div");
  description.append(textElement("h3", preset.name));
  if (preset.description) description.append(textElement("p", preset.description));
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = levelMatchedReview ? "metadata" : "none";
  const directory = levelMatchedReview || (round === 2 && !previouslyKept) ? reviewRoot + "audio/" : firstRoundAudio;
  audio.src = directory + preset.id + ".mp3";
  audio.setAttribute("aria-label", preset.name + " audio preview");
  audio.addEventListener("play", () => {
    if (playing && playing !== audio) playing.pause();
    playing = audio;
  });
  audio.addEventListener("error", () => {
    saveStatus.textContent = "Could not load this audio preview.";
  });
  const actions = document.createElement("div");
  actions.className = "actions";
  card.append(description, audio, actions);
  if (previouslyKept && !leadReview) {
    const label = textElement("span", "Kept");
    label.className = "saved-label";
    actions.append(label);
    return card;
  }
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-label", "Rate " + preset.name);
  for (const [value, label] of [["keep", "Keep"], ["reject", "Reject"]]) {
    const button = textElement("button", label);
    button.type = "button";
    button.dataset.decision = value;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (decisions[preset.id] === value) delete decisions[preset.id];
      else decisions[preset.id] = value;
      try { localStorage.setItem(ratingStorage, JSON.stringify(decisions)); }
      catch (_) { saveStatus.textContent = "Save your bank before closing this page."; }
      updateView();
    });
    actions.append(button);
  }
  return card;
}

function showGroup(id) {
  playing?.pause();
  playing = null;
  selection = id;
  const group = groups.get(id);
  heading.textContent = group.name;
  if (hasPrevious) {
    carriedTitle.textContent = `${leadReview ? "Current presets" : "Previously kept"} · ${group.kept.length}`;
    carried.replaceChildren(...group.kept.map(item => cardFor(item, true)));
    candidatesTitle.textContent = `New candidates · ${group.items.length}`;
  }
  presets.replaceChildren(...group.items.map(item => cardFor(item)));
  updateView();
}

for (const [label, ids] of [["Instruments", Object.keys(names)], ["Drum pieces", drumOrder.map(String)]]) {
  const section = document.createElement("section");
  const list = document.createElement("div");
  list.className = "voice-list";
  for (const id of ids) {
    if (levelMatchedReview && !groups.get(id).items.length) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.group = id;
    button.append(textElement("span", groups.get(id).name), document.createElement("span"));
    button.addEventListener("click", () => showGroup(id));
    list.append(button);
  }
  section.append(textElement("h2", label), list);
  voices.append(section);
}

filter.addEventListener("change", updateView);
save.addEventListener("click", () => {
  const kept = selectable.filter(item => decisionOf(item.id) === "keep");
  const bank = {
    format: PRESET_BANK_FORMAT,
    version: 1,
    name: leadReview ? "Street Art FM · Selected Lead Presets" : "Street Art FM · Selected Presets",
    presets: (leadReview ? kept : [...previous, ...kept]).map(snapshotBankPreset),
  };
  const json = JSON.stringify(bank, null, 2) + "\n";
  if (leadReview) {
    saveStatus.textContent = `Downloaded ${kept.length} selected Lead presets.`;
  } else {
    try {
      localStorage.setItem(PRESET_BANK_STORAGE, json);
      saveStatus.textContent = `Saved ${bank.presets.length} presets in the FM Patch Editor and downloaded a JSON copy.`;
    } catch (_) {
      saveStatus.textContent = "Import the downloaded JSON in the FM Patch Editor to use this bank.";
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = leadReview ? "street-art-lead-choices.json" : `street-art-fm-preset-bank${hasPrevious ? `-round${round}` : ""}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

showGroup(selection);
