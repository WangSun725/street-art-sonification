const base = "/runtime/rhythm-review/";
const $ = id => document.getElementById(id);
const patterns = $("patterns");
const status = $("status");
const audio = $("audio");
const density = $("density");
const material = $("material");
const instruments = $("instruments");
let selected;
let activeClip;

function textNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function clipTitle(clip) {
  return clip.title || clip.id;
}

function isPlaying(clip) {
  return activeClip?.id === clip.id && !audio.paused && !audio.ended;
}

function stepGrid(clip) {
  const grid = document.createElement("div");
  grid.className = "steps";
  grid.setAttribute("role", "img");
  const noteStarts = clip.steps.flatMap((velocity, index) => velocity
    ? [`${Math.floor(index / 4) + 1}${["", "e", "&", "a"][index % 4]}`] : []);
  grid.setAttribute("aria-label", `First bar starts on ${noteStarts.join(", ")}`);

  for (let beat = 0; beat < 4; beat++) {
    const subdivision = document.createElement("div");
    subdivision.className = "beat";
    for (const velocity of clip.steps.slice(beat * 4, beat * 4 + 4)) {
      const cell = document.createElement("span");
      cell.className = "slot";
      cell.dataset.hit = String(velocity > 0);
      cell.dataset.accent = String(velocity >= 100);
      subdivision.append(cell);
    }
    grid.append(subdivision);
  }
  return grid;
}

function updatePlaybackLabels() {
  for (const row of patterns.children) {
    const playing = row.dataset.id === activeClip?.id && !audio.paused && !audio.ended;
    row.dataset.playing = String(playing);
    const button = row.querySelector("button");
    button.textContent = playing ? "Pause" : "Play";
    button.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${row.dataset.title}`);
  }
}

async function togglePlayback(clip) {
  if (isPlaying(clip)) {
    audio.pause();
    return;
  }
  if (activeClip?.id !== clip.id) {
    activeClip = clip;
    audio.src = base + clip.file;
    $("playing-title").textContent = `${selected.label} · ${clipTitle(clip)}`;
    $("download").href = audio.src;
    $("download").download = clip.id + ".m4a";
    $("playback").hidden = false;
  }
  try {
    await audio.play();
  } catch (error) {
    if (activeClip?.id === clip.id && error.name !== "AbortError") {
      status.textContent = `Could not play ${clipTitle(clip)}.`;
    }
  }
}

function clipRow(clip) {
  const row = document.createElement("article");
  row.className = "pattern";
  row.dataset.id = clip.id;
  row.dataset.title = clipTitle(clip);
  const description = document.createElement("div");
  description.append(textNode("h3", clipTitle(clip)));
  const details = textNode("p", `${clip.band[0].toUpperCase() + clip.band.slice(1)} · ${clip.attacks} starts in bar 1${clip.added ? " · Latest addition" : ""}`);
  description.append(details);

  const source = document.createElement("p");
  if (clip.source.url) {
    const link = textNode("a", clip.source.title);
    link.href = clip.source.url;
    link.target = "_blank";
    link.rel = "noopener";
    source.append(link);
  } else {
    source.textContent = "Written for this project";
  }
  description.append(source);

  const button = textNode("button", "Play");
  button.type = "button";
  button.addEventListener("click", () => void togglePlayback(clip));
  row.append(description, stepGrid(clip), button);
  return row;
}

function showPatterns() {
  const visible = selected.clips.filter(clip =>
    (density.value === "all" || clip.band === density.value) &&
    (material.value === "all" || clip.added === (material.value === "added")));
  patterns.replaceChildren(...visible.map(clipRow));
  status.textContent = visible.length ? `${visible.length} of ${selected.clips.length} patterns` : "No patterns match these filters.";
  updatePlaybackLabels();
}

function showInstrument(group) {
  if (selected === group) return;
  audio.pause();
  activeClip = null;
  audio.removeAttribute("src");
  audio.load();
  $("playback").hidden = true;
  selected = group;
  $("instrument-title").textContent = group.label;
  $("patch").textContent = `FM sound · ${group.patch}`;
  for (const button of instruments.children) button.setAttribute("aria-pressed", String(button.dataset.id === group.id));
  showPatterns();
}

for (const event of ["play", "pause", "ended"]) audio.addEventListener(event, updatePlaybackLabels);
density.addEventListener("change", () => { if (selected) showPatterns(); });
material.addEventListener("change", () => { if (selected) showPatterns(); });

async function load() {
  try {
    const response = await fetch(base + "manifest.json", { cache: "no-store" });
    if (!response.ok) throw Error("The rendered library is unavailable.");
    const data = await response.json();
    $("summary").textContent = `${data.total} patterns · ${data.bpm} BPM · ${data.chords.join(" → ")}`;
    for (const group of data.library) {
      const button = textNode("button", group.label);
      button.type = "button";
      button.dataset.id = group.id;
      button.append(textNode("small", group.clips.length));
      button.addEventListener("click", () => showInstrument(group));
      instruments.append(button);
    }
    $("guide").hidden = false;
    showInstrument(data.library[0]);
  } catch {
    status.textContent = "Could not load the rendered library. Reload to try again.";
  }
}

void load();
