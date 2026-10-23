const $ = (selector) => document.querySelector(selector);

const canvas = $("#artCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const canvasShell = $("#canvasShell");
const setupScreen = $("#setupScreen");
const modeScreen = $("#modeScreen");
const performanceScreen = $("#performanceScreen");
const setupProgress = $("#setupProgress");
const setupProgressBar = $("#setupProgressBar");
const setupPercent = $("#setupPercent");
const setupProgressMessage = $("#setupProgressMessage");
const setupPreview = $("#setupPreview");
const statementInput = $("#statement");
const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const analyzeButton = $("#analyzeButton");
const statusText = $("#statusText");
const analysisOverlay = $("#analysisOverlay");
const progressBar = $("#progressBar");
const analysisPercent = $("#analysisPercent");
const analysisMessage = $("#analysisMessage");
const regionList = $("#regionList");
const regionBadge = $("#regionBadge");
const outputJson = $("#outputJson");
const maskToggle = $("#maskToggle");
const soundToggle = $("#soundToggle");
const volumeSlider = $("#volumeSlider");
const volumeValue = $("#volumeValue");
const musicBpm = $("#musicBpm");
const musicRoot = $("#musicRoot");
const musicMode = $("#musicMode");
const scanPlay = $("#scanPlay");
const scanReset = $("#scanReset");
const scanTimeline = $("#scanTimeline");
const scanTime = $("#scanTime");
const scanReadout = $("#scanReadout");
const scanDuration = $("#scanDuration");
const pointerMode = $("#pointerMode");
const scanMode = $("#scanMode");
const interactionModeSwitch = $("#interactionModeSwitch");
const pointerControls = $("#pointerControls");
const scanControls = $("#scanControls");
const pointerFullscreen = $("#pointerFullscreen");
const scanFullscreen = $("#scanFullscreen");
const fullscreenExit = $("#fullscreenExit");
const mouseSource = $("#mouseSource");
const eyeToggle = $("#eyeToggle");
const eyeCalibrate = $("#eyeCalibrate");
const eyeStatus = $("#eyeStatus");
const eyeVideo = $("#eyeVideo");
const gazeCursor = $("#gazeCursor");
const calibrationOverlay = $("#calibrationOverlay");
const calibrationTarget = $("#calibrationTarget");
const calibrationProgress = $("#calibrationProgress");
const calibrationCancel = $("#calibrationCancel");
const logicOverlay = $("#logicOverlay");
const logicOpen = $("#logicOpen");
const logicClose = $("#logicClose");
const externalEnabled = $("#externalEnabled");
const externalStatus = $("#externalStatus");
const externalMessage = $("#externalMessage");
const mappingList = $("#mappingList");
const midiPort = $("#midiPort");
const outputModeButtons = [...document.querySelectorAll("[data-output-mode]")];

const DEFAULT_SCAN_DURATION = 3 * 60;
const MAX_MUSIC_DURATION = 10 * 60;
const SCAN_PROFILE_BINS = 360;
const EYE_CALIBRATION_SAMPLE_MIN = 8;
const EYE_REGION_DWELL_MS = 135;
const EYE_REGION_RELEASE_MS = 190;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MUSIC_MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
};

// Progressions are stored as scale degrees, so every candidate works in all
// twelve keys. The artwork chooses a primary and contrasting progression
// deterministically; the visitor never has to select chords in advance.
const MAJOR_PROGRESSION_POOL = [
  { name: "I–V–vi–IV", degrees: [1, 5, 6, 4] },
  { name: "I–vi–IV–V", degrees: [1, 6, 4, 5] },
  { name: "I–IV–V–I", degrees: [1, 4, 5, 1] },
  { name: "vi–IV–I–V", degrees: [6, 4, 1, 5] },
  { name: "I–iii–IV–V", degrees: [1, 3, 4, 5] },
  { name: "I–V–IV–IV", degrees: [1, 5, 4, 4] },
  { name: "ii–V–I–vi", degrees: [2, 5, 1, 6] },
  { name: "I–IV–ii–V", degrees: [1, 4, 2, 5] },
  { name: "I–ii–IV–V", degrees: [1, 2, 4, 5] },
  { name: "I–vi–ii–V", degrees: [1, 6, 2, 5] },
  { name: "IV–I–V–vi", degrees: [4, 1, 5, 6] },
  { name: "I–iii–vi–IV", degrees: [1, 3, 6, 4] },
  { name: "I–IV–vi–V", degrees: [1, 4, 6, 5] },
  { name: "vi–ii–V–I", degrees: [6, 2, 5, 1] },
  { name: "I–V–ii–IV", degrees: [1, 5, 2, 4] },
  { name: "I–ii–vi–IV–V", degrees: [1, 2, 6, 4, 5] },
  { name: "I–IV–I–V–vi–iii–IV–V", degrees: [1, 4, 1, 5, 6, 3, 4, 5] },
  { name: "I–iii–IV–I–ii–V–I", degrees: [1, 3, 4, 1, 2, 5, 1] },
];

const MINOR_PROGRESSION_POOL = [
  { name: "i–VI–III–VII", degrees: [1, 6, 3, 7] },
  { name: "i–VII–VI–VII", degrees: [1, 7, 6, 7] },
  { name: "i–iv–VI–V", degrees: [1, 4, 6, 5] },
  { name: "i–VI–iv–V", degrees: [1, 6, 4, 5] },
  { name: "i–III–VII–VI", degrees: [1, 3, 7, 6] },
  { name: "VI–VII–i–i", degrees: [6, 7, 1, 1] },
  { name: "i–v–VI–iv", degrees: [1, 5, 6, 4] },
  { name: "i–iv–VII–III", degrees: [1, 4, 7, 3] },
  { name: "i–iiø–V–i", degrees: [1, 2, 5, 1] },
  { name: "i–VI–iiø–V", degrees: [1, 6, 2, 5] },
  { name: "i–VII–III–VI", degrees: [1, 7, 3, 6] },
  { name: "i–III–iv–V", degrees: [1, 3, 4, 5] },
  { name: "i–iv–i–VII", degrees: [1, 4, 1, 7] },
  { name: "i–VI–VII–i", degrees: [1, 6, 7, 1] },
  { name: "iv–i–VI–V", degrees: [4, 1, 6, 5] },
  { name: "i–III–VI–iv–V", degrees: [1, 3, 6, 4, 5] },
  { name: "i–VII–VI–V–i–III–iv–V", degrees: [1, 7, 6, 5, 1, 3, 4, 5] },
  { name: "i–iv–VII–III–VI–iiø–V–i", degrees: [1, 4, 7, 3, 6, 2, 5, 1] },
];

// All starts and lengths are expressed in beats. The library deliberately
// mixes long notes, rests, quarters, eighths, sixteenths, dotted values and
// triplets instead of forcing every role onto one repeating 16-step loop.
const ROLE_PATTERN_LIBRARY = {
  lead_synth: [
    [{ at: 0, duration: .75 }, { at: 1, duration: .5 }, { at: 1.75, duration: .25 }, { at: 2.5, duration: .75 }, { at: 3.5, duration: .42 }],
    [{ at: 0, duration: 1.5 }, { at: 2, duration: .5 }, { at: 2.75, duration: .75 }],
    [{ at: 0, duration: 1 / 3 }, { at: 2 / 3, duration: 1 / 3 }, { at: 4 / 3, duration: .55 }, { at: 2, duration: 1 }, { at: 3.25, duration: .5 }],
    [{ at: .5, duration: .75 }, { at: 1.5, duration: 1.25 }, { at: 3, duration: .5 }, { at: 3.75, duration: .2 }],
  ],
  counter_synth: [
    [{ at: 1, duration: .75 }, { at: 2.75, duration: 1 }],
    [{ at: .5, duration: .5 }, { at: 1.5, duration: .25 }, { at: 3, duration: .8 }],
    [{ at: 2 / 3, duration: 2 / 3 }, { at: 2 + 1 / 3, duration: 1 / 3 }, { at: 3 + 1 / 3, duration: .55 }],
    [{ at: 0, duration: 1.75 }, { at: 2.5, duration: .5 }],
  ],
  bass: [
    [{ at: 0, duration: 1.5 }, { at: 2, duration: 1 }, { at: 3.5, duration: .45 }],
    [{ at: 0, duration: .75 }, { at: .75, duration: .5 }, { at: 2, duration: 1.25 }, { at: 3.5, duration: .4 }],
    [{ at: .5, duration: .5 }, { at: 1.5, duration: .75 }, { at: 2.75, duration: 1 }],
    [{ at: 0, duration: 2.5 }, { at: 3, duration: .75 }],
  ],
  guitar: [
    [{ at: 0, duration: .7, kind: "chord" }, { at: 1.5, duration: .4 }, { at: 2.5, duration: .75, kind: "chord" }, { at: 3.5, duration: .35 }],
    [{ at: 0, duration: .35 }, { at: 2 / 3, duration: .35 }, { at: 4 / 3, duration: .35 }, { at: 2, duration: 1.1, kind: "chord" }, { at: 3.5, duration: .35 }],
    [{ at: .5, duration: 1.25, kind: "chord" }, { at: 2.5, duration: 1, kind: "chord" }],
    [{ at: 0, duration: .5, kind: "chord" }, { at: 1, duration: .25 }, { at: 1.75, duration: .25 }, { at: 2.75, duration: .5, kind: "chord" }, { at: 3.75, duration: .2 }],
  ],
  pad: [
    [{ at: 0, duration: 3.8, kind: "chord" }],
    [{ at: 0, duration: 2.25, kind: "chord" }, { at: 2.75, duration: 1.1, kind: "chord" }],
    [{ at: .5, duration: 3.35, kind: "chord" }],
    [{ at: 0, duration: 1.5, kind: "chord" }, { at: 2, duration: 1.85, kind: "chord" }],
  ],
  strings: [
    [{ at: 0, duration: 2.5, kind: "chord" }, { at: 2.75, duration: 1.1, kind: "chord" }],
    [{ at: 0, duration: 3.85, kind: "chord" }],
    [{ at: .5, duration: 1.5, kind: "chord" }, { at: 2.5, duration: 1.35, kind: "chord" }],
    [{ at: 0, duration: 1, kind: "chord" }, { at: 4 / 3, duration: 2 / 3, kind: "chord" }, { at: 2 + 2 / 3, duration: 1.1, kind: "chord" }],
  ],
  keys_mallet: [
    [{ at: 0, duration: .5, kind: "chord" }, { at: 1, duration: .35 }, { at: 1.75, duration: .25 }, { at: 2.5, duration: .6, kind: "chord" }, { at: 3.5, duration: .35 }],
    [{ at: 0, duration: 1.25 }, { at: 1.75, duration: .5, kind: "chord" }, { at: 3, duration: .75 }],
    [{ at: 0, duration: 1 / 3 }, { at: 2 / 3, duration: 1 / 3 }, { at: 4 / 3, duration: 1 / 3 }, { at: 2, duration: .75, kind: "chord" }, { at: 3.25, duration: .5 }],
    [{ at: .5, duration: .75, kind: "chord" }, { at: 2, duration: .5 }, { at: 2.75, duration: 1, kind: "chord" }],
  ],
  drums: [
    [{ at: 0, duration: .16, notes: [36, 42] }, { at: .75, duration: .12, notes: [42] }, { at: 1, duration: .16, notes: [38] }, { at: 2, duration: .16, notes: [36, 42] }, { at: 2.5, duration: .12, notes: [42] }, { at: 3, duration: .16, notes: [38] }, { at: 3.75, duration: .14, notes: [46] }],
    [{ at: 0, duration: .16, notes: [36] }, { at: 2 / 3, duration: .12, notes: [42] }, { at: 1, duration: .16, notes: [38] }, { at: 1 + 2 / 3, duration: .12, notes: [42] }, { at: 2.5, duration: .16, notes: [36] }, { at: 3, duration: .16, notes: [38, 42] }, { at: 3 + 2 / 3, duration: .14, notes: [46] }],
    [{ at: 0, duration: .16, notes: [36, 42] }, { at: .5, duration: .12, notes: [42] }, { at: 1, duration: .16, notes: [38] }, { at: 1.5, duration: .12, notes: [42] }, { at: 2.25, duration: .16, notes: [36] }, { at: 2.75, duration: .12, notes: [42] }, { at: 3, duration: .16, notes: [38] }, { at: 3.5, duration: .12, notes: [39] }, { at: 3.75, duration: .12, notes: [42] }],
    [{ at: 0, duration: .2, notes: [36] }, { at: 1, duration: .18, notes: [38] }, { at: 2, duration: .2, notes: [36] }, { at: 3, duration: .18, notes: [38] }],
  ],
  percussion_texture: [
    [{ at: .5, duration: .12, notes: [37] }, { at: 1.5, duration: .12, notes: [39] }, { at: 2.75, duration: .12, notes: [37] }, { at: 3.5, duration: .12, notes: [46] }],
    [{ at: 0, duration: .1, notes: [39] }, { at: 2 / 3, duration: .1, notes: [37] }, { at: 4 / 3, duration: .1, notes: [39] }, { at: 2 + 2 / 3, duration: .1, notes: [46] }, { at: 3 + 1 / 3, duration: .1, notes: [37] }],
    [{ at: .25, duration: .1, notes: [37] }, { at: .75, duration: .1, notes: [39] }, { at: 1.75, duration: .1, notes: [37] }, { at: 2.5, duration: .1, notes: [46] }, { at: 3.75, duration: .1, notes: [39] }],
    [{ at: 0, duration: .18, notes: [37] }, { at: 2, duration: .18, notes: [39] }],
  ],
};

const INSTRUMENT_ROLES = [
  { id: "lead_synth", label: "Lead Synth", behavior: "Beat-synced melody", slot: 1, midiChannel: 1 },
  { id: "counter_synth", label: "Counter Synth", behavior: "Melodic response", slot: 2, midiChannel: 2 },
  { id: "drums", label: "Drums", behavior: "Quantized drum pattern", slot: 3, midiChannel: 3 },
  { id: "bass", label: "Bass", behavior: "Root and fifth bass line", slot: 4, midiChannel: 4 },
  { id: "guitar", label: "Guitar", behavior: "Chord hits, motifs and broken voicings", slot: 5, midiChannel: 5 },
  { id: "pad", label: "Pad", behavior: "Open extended chord voicings", slot: 6, midiChannel: 6 },
  { id: "strings", label: "Strings", behavior: "Wide sustained voice leading", slot: 7, midiChannel: 7 },
  { id: "keys_mallet", label: "Keys / Mallet", behavior: "Chord stabs and varied note phrases", slot: 8, midiChannel: 8 },
  { id: "percussion_texture", label: "Percussion / Texture", behavior: "Movement-driven rhythm", slot: 9, midiChannel: 9 },
];

const INSTRUMENT_PREFERENCES = {
  figure: ["lead_synth", "strings", "counter_synth", "guitar"],
  face: ["lead_synth", "counter_synth", "keys_mallet", "strings"],
  gesture: ["guitar", "counter_synth", "lead_synth", "keys_mallet"],
  lettering: ["drums", "keys_mallet", "percussion_texture", "counter_synth"],
  wall: ["pad", "strings", "bass", "percussion_texture"],
  fill: ["bass", "pad", "strings", "counter_synth"],
  texture: ["percussion_texture", "drums", "pad", "strings"],
  drip: ["percussion_texture", "keys_mallet", "drums", "pad"],
  symbol: ["keys_mallet", "counter_synth", "guitar", "lead_synth"],
  detail: ["keys_mallet", "counter_synth", "lead_synth", "guitar"],
};

// These files ship with the project, so the performance does not depend on a
// CDN or network connection. Pitched instruments use the nearest recorded
// note and transpose it at playback time, like a compact Tone.Sampler bank.
const LOCAL_SAMPLE_MANIFEST = {
  bass: [
    [28, "/static/samples/bass/E1.mp3"],
    [40, "/static/samples/bass/E2.mp3"],
    [52, "/static/samples/bass/E3.mp3"],
    [64, "/static/samples/bass/E4.mp3"],
  ],
  guitar: [
    [40, "/static/samples/guitar/E2.mp3"],
    [52, "/static/samples/guitar/E3.mp3"],
    [64, "/static/samples/guitar/E4.mp3"],
    [72, "/static/samples/guitar/C5.mp3"],
  ],
  strings: [
    [55, "/static/samples/strings/G3.mp3"],
    [67, "/static/samples/strings/G4.mp3"],
    [79, "/static/samples/strings/G5.mp3"],
    [91, "/static/samples/strings/G6.mp3"],
  ],
  keys_mallet: [
    [67, "/static/samples/mallet/G4.mp3"],
    [79, "/static/samples/mallet/G5.mp3"],
    [91, "/static/samples/mallet/G6.mp3"],
    [103, "/static/samples/mallet/G7.mp3"],
  ],
  drums: [
    [36, "/static/samples/drums/kick.wav"],
    [37, "/static/samples/drums/tom.wav"],
    [38, "/static/samples/drums/snare.wav"],
    [39, "/static/samples/drums/clap.wav"],
    [42, "/static/samples/drums/hihat-closed.wav"],
    [46, "/static/samples/drums/hihat-open.wav"],
  ],
};

function assignInstrumentRoles(regions) {
  const unused = new Set(INSTRUMENT_ROLES.map((role) => role.id));
  return regions.slice(0, INSTRUMENT_ROLES.length).map((region) => {
    const preferences = INSTRUMENT_PREFERENCES[region.type] || INSTRUMENT_ROLES.map((role) => role.id);
    const roleId = preferences.find((id) => unused.has(id)) || [...unused][0];
    unused.delete(roleId);
    const role = INSTRUMENT_ROLES.find((item) => item.id === roleId) || INSTRUMENT_ROLES[0];
    return { ...region, instrument: { ...role } };
  });
}

const state = {
  manifest: null,
  image: null,
  imagePixels: null,
  selectedFile: null,
  regions: [],
  activeRegion: null,
  mode: "pointer",
  outputMode: "midi",
  setupComplete: false,
  masksVisible: true,
  analyzing: false,
  music: { bpm: 72, root: "D", mode: "dorian" },
  harmony: { signature: null, plan: null },
  musicTimeline: {
    duration: MAX_MUSIC_DURATION,
    elapsed: 0,
    startedAt: 0,
    running: false,
  },
  pointer: {
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    speed: 0,
    lastTime: 0,
    source: "mouse",
    regions: [],
    regionMix: new Map(),
    lastMixAt: 0,
  },
  eye: {
    active: false,
    starting: false,
    ready: false,
    calibrated: false,
    sessionId: 0,
    webcamClient: null,
    tracker: null,
    smoothX: null,
    smoothY: null,
    lastResultAt: 0,
    calibrationIndex: 0,
    calibrationReady: false,
    calibrationSamples: [],
    calibrationPairs: [],
    calibrationTargets: [],
    calibrationModel: null,
    calibrationCollectingAt: 0,
    calibrationTimer: 0,
    startupTimer: 0,
    rawHistory: [],
    candidateRegionId: null,
    candidateSince: 0,
    outsideSince: 0,
  },
  enteredAt: 0,
  lastSentAt: 0,
  lastOutput: null,
  scan: {
    engaged: false,
    playing: false,
    duration: DEFAULT_SCAN_DURATION,
    position: 0,
    seconds: 0,
    startedAt: 0,
    startedFrom: 0,
    lastFrameAt: 0,
    animationFrame: 0,
    regions: [],
    manualRegionId: null,
    regionMix: new Map(),
    lastMixAt: 0,
  },
};

const subscribers = new Set();
window.StreetArtOutput = {
  endpoint: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/events`,
  subscribe(callback) {
    if (typeof callback !== "function") throw new TypeError("callback must be a function");
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  getState() { return state.lastOutput ? structuredClone(state.lastOutput) : null; },
};

let socket;
function connectSocket() {
  socket = new WebSocket(window.StreetArtOutput.endpoint);
  socket.addEventListener("open", () => {
    $("#socketStatus").classList.remove("offline");
    $("#socketStatus").lastChild.textContent = " Connected";
  });
  socket.addEventListener("close", () => {
    $("#socketStatus").classList.add("offline");
    $("#socketStatus").lastChild.textContent = " Reconnecting";
    setTimeout(connectSocket, 1400);
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function musicRootMidi() {
  return 36 + Math.max(0, NOTE_NAMES.indexOf(state.music.root));
}

function regionMidiNote(region, nx, ny) {
  if (!region) return musicRootMidi() + 12;
  const scale = MUSIC_MODES[state.music.mode] || MUSIC_MODES.dorian;
  const horizontalDegreeShift = [0, 2, 1, 3, 0][Math.min(4, Math.floor(Math.max(0, Math.min(.999, nx)) * 5))];
  const verticalDegreeShift = Math.round((1 - Math.max(0, Math.min(1, ny))) * 7);
  const slot = region.instrument?.slot || region.index || 1;
  const degree = Math.max(0, slot - 1 + horizontalDegreeShift + verticalDegreeShift);
  const octave = Math.floor(degree / scale.length);
  const semitone = scale[degree % scale.length] + octave * 12;
  const roleOffset = {
    lead_synth: 12,
    counter_synth: 12,
    drums: 0,
    bass: -12,
    guitar: 5,
    pad: 0,
    strings: 7,
    keys_mallet: 12,
    percussion_texture: 0,
  }[region.instrument?.id] || 0;
  return Math.max(24, Math.min(108, musicRootMidi() + semitone + roleOffset));
}

function snapMidiToMode(note) {
  const scale = MUSIC_MODES[state.music.mode] || MUSIC_MODES.dorian;
  const root = NOTE_NAMES.indexOf(state.music.root);
  let nearest = Math.round(note);
  let distance = Infinity;
  for (let candidate = Math.floor(note) - 6; candidate <= Math.ceil(note) + 6; candidate++) {
    const relative = ((candidate - root) % 12 + 12) % 12;
    if (!scale.includes(relative)) continue;
    const candidateDistance = Math.abs(candidate - note);
    if (candidateDistance < distance) {
      nearest = candidate;
      distance = candidateDistance;
    }
  }
  return Math.max(0, Math.min(127, nearest));
}

function scaleStep(note, steps) {
  const direction = Math.sign(steps) || 1;
  let result = snapMidiToMode(note);
  for (let index = 0; index < Math.abs(steps); index++) {
    do { result += direction; } while (snapMidiToMode(result) !== result);
  }
  return Math.max(0, Math.min(127, result));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hashMusicText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function regionMusicSeed(region, salt = "") {
  const color = Array.isArray(region?.color_rgb) ? region.color_rgb.join(",") : "";
  return hashMusicText(`${region?.id || "region"}|${region?.label || ""}|${region?.type || ""}|${color}|${region?.area_ratio || 0}|${salt}`);
}

function fallbackRegionVisual(region) {
  const color = Array.isArray(region?.color_rgb) ? region.color_rgb : [128, 128, 128];
  const hsv = rgbToHsv(color[0], color[1], color[2]);
  return {
    hue: hsv.hue,
    saturation: hsv.saturation,
    brightness: (.2126 * color[0] + .7152 * color[1] + .0722 * color[2]) / 255,
    texture: Math.max(0, Math.min(1, Number(region?.texture || 0))),
  };
}

function harmonyScale() {
  // Minor pentatonic remains available to melody, while harmony needs seven
  // degrees in order to build functional minor progressions.
  if (state.music.mode === "minorPentatonic") return MUSIC_MODES.minor;
  return MUSIC_MODES[state.music.mode] || MUSIC_MODES.dorian;
}

function harmonyIsMinor() {
  return ["minor", "dorian", "phrygian", "minorPentatonic"].includes(state.music.mode);
}

function harmonySignature() {
  const regions = state.regions.map((region) => `${region.id}:${region.type}:${(region.color_rgb || []).join("-")}:${region.area_ratio || 0}`).join("|");
  return `${state.music.root}:${state.music.mode}:${regions}`;
}

function ensureHarmonyPlan() {
  const signature = harmonySignature();
  if (state.harmony.signature === signature && state.harmony.plan) return state.harmony.plan;
  const pool = harmonyIsMinor() ? MINOR_PROGRESSION_POOL : MAJOR_PROGRESSION_POOL;
  const seed = hashMusicText(signature || `${state.music.root}:${state.music.mode}`);
  const primaryIndex = seed % pool.length;
  let contrastIndex = (primaryIndex + 3 + ((seed >>> 7) % Math.max(1, pool.length - 1))) % pool.length;
  if (contrastIndex === primaryIndex) contrastIndex = (contrastIndex + 1) % pool.length;
  const plan = {
    seed,
    primary: pool[primaryIndex],
    contrast: pool[contrastIndex],
  };
  state.harmony = { signature, plan };
  return plan;
}

function harmonyPlanSummary() {
  const plan = ensureHarmonyPlan();
  return `Auto harmony · ${plan.primary.name} / ${plan.contrast.name}`;
}

function harmonyDegreeMidi(scaleIndex) {
  const scale = harmonyScale();
  const octave = Math.floor(scaleIndex / scale.length);
  const index = positiveModulo(scaleIndex, scale.length);
  return musicRootMidi() + 12 + scale[index] + octave * 12;
}

function harmonyAt(beatPosition) {
  const plan = ensureHarmonyPlan();
  const barIndex = Math.max(0, Math.floor(beatPosition / 4));
  const sectionBar = barIndex % 16;
  const progression = sectionBar >= 8 && sectionBar < 12 ? plan.contrast : plan.primary;
  const chordIndex = barIndex % progression.degrees.length;
  const degree = progression.degrees[chordIndex];
  const scaleIndex = degree - 1;
  const tones = [0, 2, 4, 6, 8, 10, 12].map((offset) => harmonyDegreeMidi(scaleIndex + offset));

  // A major dominant in minor modes creates a stronger V–i cadence while
  // the rest of the chord still comes from the selected mode.
  if (harmonyIsMinor() && degree === 5 && tones[1] - tones[0] === 3) tones[1] += 1;
  return {
    barIndex,
    sectionBar,
    chordIndex,
    degree,
    progression: progression.name,
    progressionRole: progression === plan.primary ? "primary" : "contrast",
    tones,
  };
}

function shiftVoicingIntoRange(notes, low, high) {
  const shifted = [...notes];
  while (Math.min(...shifted) < low) shifted.forEach((_, index) => { shifted[index] += 12; });
  while (Math.max(...shifted) > high && Math.min(...shifted) - 12 >= low) shifted.forEach((_, index) => { shifted[index] -= 12; });
  return shifted.map((note) => Math.max(0, Math.min(127, note))).sort((a, b) => a - b);
}

function chordVoicing(chord, role, visual, seed, alternate = false) {
  const saturation = Math.max(0, Math.min(1, Number(visual?.saturation ?? .35)));
  let toneCount = role === "pad" || role === "strings" ? 4 : 3;
  if (saturation > .3 || (seed & 1)) toneCount = Math.max(toneCount, 4); // seventh
  if (saturation > .52 || seed % 5 === 0) toneCount = Math.max(toneCount, 5); // ninth
  if (saturation > .74 && seed % 3 !== 1) toneCount = Math.max(toneCount, 6); // eleventh
  if (saturation > .9 && seed % 4 === 0) toneCount = 7; // thirteenth

  let notes = chord.tones.slice(0, toneCount);
  const inversionLimit = Math.min(4, notes.length);
  const inversion = positiveModulo(seed + (alternate ? 1 : 0), inversionLimit);
  for (let index = 0; index < inversion; index++) notes[index] += 12;
  notes.sort((a, b) => a - b);

  // Alternate chord tones are displaced by octaves to create open, drop-style
  // voicings instead of a compact root-position stack.
  const wideRole = ["guitar", "pad", "strings", "keys_mallet"].includes(role);
  if (wideRole) {
    notes = notes.map((note, index) => note + ((index + seed) % 2 ? 12 : 0)).sort((a, b) => a - b);
    for (let index = 1; index < notes.length; index++) {
      if (notes[index] - notes[index - 1] < 4 && index % 2 === 1) notes[index] += 12;
    }
    notes.sort((a, b) => a - b);
  }

  const ranges = {
    guitar: [40, 88],
    pad: [43, 96],
    strings: [45, 100],
    keys_mallet: [48, 104],
  };
  const [low, high] = ranges[role] || [45, 96];
  notes = shiftVoicingIntoRange(notes, low, high);
  return {
    notes: [...new Set(notes)].slice(0, 7),
    inversion,
    tension: toneCount >= 7 ? "13th" : (toneCount === 6 ? "11th" : (toneCount === 5 ? "9th" : (toneCount === 4 ? "7th" : "triad"))),
    spread: wideRole ? "open" : "close",
  };
}

function nearestChordTone(note, tones) {
  let best = note;
  let distance = Infinity;
  for (const tone of tones.slice(0, 5)) {
    for (let octave = -4; octave <= 4; octave++) {
      const candidate = tone + octave * 12;
      const candidateDistance = Math.abs(candidate - note);
      if (candidateDistance < distance) {
        best = candidate;
        distance = candidateDistance;
      }
    }
  }
  return Math.max(0, Math.min(127, best));
}

const MOTIF_CONTOURS = [
  [0, 2, 4, 3, 1, 5, 4],
  [0, 1, 3, 5, 2, 4, 1],
  [0, 4, 2, 5, 3, 1, 2],
  [0, -1, 2, 4, 3, 6, 4],
  [0, 3, 1, 4, 2, 5, 1],
  [0, 2, -1, 3, 5, 4, 2],
];

function melodicNoteForEvent(region, root, chord, event, eventIndex, seed) {
  const contour = MOTIF_CONTOURS[seed % MOTIF_CONTOURS.length];
  const variation = chord.barIndex % 4;
  let degree = contour[(eventIndex + Math.floor(chord.barIndex / 4)) % contour.length];
  if (variation === 1 && eventIndex % 2) degree += 1;
  if (variation === 2) degree = -degree + 4;
  if (variation === 3 && eventIndex === contour.length - 1) degree = 0;
  let note = scaleStep(root, degree);
  const strongBeat = Math.abs(event.at - Math.round(event.at)) < .08;
  if (strongBeat) note = nearestChordTone(note, chord.tones);
  return note;
}

function patternEventAt(events, beatInBar) {
  const triggerWindow = .24;
  let selected = null;
  let selectedIndex = -1;
  events.forEach((event, index) => {
    const distance = beatInBar - event.at;
    if (distance >= 0 && distance < triggerWindow && (!selected || event.at > selected.at)) {
      selected = event;
      selectedIndex = index;
    }
  });
  return selected ? { event: selected, index: selectedIndex } : null;
}

function musicEventForRegion(region, nx, ny, beatPosition, speed = 0, intensity = 1, forceStart = false, visual = null) {
  const role = region.instrument?.id || "lead_synth";
  const chord = harmonyAt(beatPosition);
  const beatInBar = positiveModulo(beatPosition, 4);
  const regionVisual = visual || fallbackRegionVisual(region);
  const seed = regionMusicSeed(region, `${state.music.root}:${state.music.mode}`);
  const density = Math.max(0, Math.min(1, (regionVisual.texture || 0) * .5 + (regionVisual.saturation || 0) * .25 + Math.min(1, speed) * .25));
  const library = ROLE_PATTERN_LIBRARY[role] || ROLE_PATTERN_LIBRARY.lead_synth;
  const phraseVariation = [0, 1, 2, 0][chord.barIndex % 4];
  const patternIndex = positiveModulo((seed % library.length) + phraseVariation + Math.floor(density * 2), library.length);
  const pattern = library[patternIndex];
  const selected = patternEventAt(pattern, beatInBar);
  const root = regionMidiNote(region, nx, ny);
  const voicing = chordVoicing(chord, role, regionVisual, seed + chord.barIndex, selected?.index % 2 === 1);
  const velocity = Math.max(28, Math.min(127, Math.round(52 + intensity * 45 + Math.min(1, speed) * 16 + (regionVisual.saturation || 0) * 8)));
  let notes = [];
  let durationBeats = selected?.event.duration ?? .5;
  let eventKind = selected?.event.kind || "note";

  if (selected) {
    const event = selected.event;
    if (role === "drums" || role === "percussion_texture") {
      notes = [...(event.notes || [])];
      if (role === "percussion_texture" && speed > .62 && notes.length === 1 && (seed + selected.index) % 3 === 0) notes.push(42);
    } else if (role === "pad" || role === "strings" || event.kind === "chord") {
      notes = [...voicing.notes];
    } else if (role === "guitar") {
      notes = [voicing.notes[(selected.index + chord.barIndex) % voicing.notes.length]];
    } else if (role === "bass") {
      const bassChoices = [0, 2, 0, 1, 0, 2, 1];
      const toneIndex = bassChoices[(selected.index + chord.barIndex + seed) % bassChoices.length];
      notes = [Math.max(24, chord.tones[toneIndex] - 12)];
    } else {
      notes = [melodicNoteForEvent(region, root, chord, event, selected.index, seed)];
      if (role === "lead_synth" && selected.index === pattern.length - 1 && chord.barIndex % 4 === 3 && regionVisual.saturation > .58) {
        notes.push(nearestChordTone(notes[0] + 4, chord.tones));
        eventKind = "dyad";
      }
    }
  }

  if (forceStart && !notes.length) {
    eventKind = "entry";
    if (["guitar", "pad", "strings", "keys_mallet"].includes(role)) notes = [...voicing.notes];
    else if (role === "counter_synth") notes = [nearestChordTone(root + 4, chord.tones)];
    else if (role === "drums") notes = [36, 42];
    else if (role === "bass") notes = [Math.max(24, chord.tones[(seed % 3)] - 12)];
    else if (role === "percussion_texture") notes = [39];
    else notes = [nearestChordTone(root, chord.tones)];
    durationBeats = ["pad", "strings"].includes(role) ? 2.5 : (role === "guitar" || role === "keys_mallet" ? .75 : .5);
  }

  const eventId = selected
    ? `${region.id}:bar-${chord.barIndex}:pattern-${patternIndex}:event-${selected.index}`
    : (forceStart ? `${region.id}:entry-${Math.round(state.enteredAt)}` : `${region.id}:bar-${chord.barIndex}:rest`);
  return {
    eventId,
    patternStep: selected?.index ?? -1,
    patternPositionBeats: selected ? Number(selected.event.at.toFixed(3)) : null,
    rhythmFamily: ["A", "A′", "B", "A"][chord.barIndex % 4],
    eventKind,
    behavior: region.instrument?.behavior || "Beat-synced melody",
    notes,
    note: notes[0] ?? root,
    velocity,
    durationBeats,
    harmony: {
      progression: chord.progression,
      progressionRole: chord.progressionRole,
      degree: chord.degree,
      chordIndex: chord.chordIndex,
      bar: chord.barIndex + 1,
      tension: voicing.tension,
      inversion: voicing.inversion,
      spread: voicing.spread,
    },
    timbre: {
      brightness: Number(regionVisual.brightness || 0),
      saturation: Number(regionVisual.saturation || 0),
      hue: Number(regionVisual.hue || 0),
      texture: Number(regionVisual.texture || 0),
    },
  };
}

function activeMusicVoices(scanning, region, scanRegions, pointerVisual = null) {
  const entries = scanning
    ? scanRegions.slice(0, 5).map((item) => ({
      region: item.region,
      x: state.scan.position,
      y: item.centroidY ?? .5,
      intensity: item.intensity ?? 1,
      visual: item,
    }))
    : (state.pointer.regions.length
      ? state.pointer.regions.map((item) => ({
        region: item.region,
        x: item.x,
        y: item.y,
        intensity: item.intensity,
        visual: item.visual,
      }))
      : (region ? [{ region, x: state.pointer.nx, y: state.pointer.ny, intensity: 1, visual: pointerVisual }] : []));
  const beatPosition = musicBeatPosition(scanning);
  return entries.map((entry) => ({
    regionId: entry.region.id,
    mix: Number(Math.max(0, Math.min(1, entry.intensity)).toFixed(4)),
    instrument: entry.region.instrument?.label || "Lead Synth",
    instrumentId: entry.region.instrument?.id || "lead_synth",
    slot: entry.region.instrument?.slot || 1,
    channel: entry.region.instrument?.midiChannel || 1,
    ...musicEventForRegion(
      entry.region,
      entry.x,
      entry.y,
      beatPosition,
      scanning ? entry.intensity : state.pointer.speed,
      entry.intensity,
      (!scanning && performance.now() - state.enteredAt < 90)
        || (scanning && !state.scan.playing && state.scan.manualRegionId === entry.region.id),
      entry.visual || null,
    ),
  }));
}

function musicBeatPosition(scanning = state.mode === "scan") {
  const seconds = scanning ? state.scan.seconds : pointerMusicSeconds();
  return seconds * state.music.bpm / 60;
}

function pointerMusicSeconds() {
  const timeline = state.musicTimeline;
  if (!timeline.running) return timeline.elapsed;
  const elapsed = timeline.elapsed + Math.max(0, (performance.now() - timeline.startedAt) / 1000);
  return elapsed % Math.max(1, timeline.duration);
}

function startPointerMusicTimeline(reset = false) {
  const timeline = state.musicTimeline;
  if (reset) timeline.elapsed = 0;
  if (timeline.running) return;
  timeline.startedAt = performance.now();
  timeline.running = true;
}

function pausePointerMusicTimeline() {
  const timeline = state.musicTimeline;
  if (!timeline.running) return;
  timeline.elapsed = pointerMusicSeconds();
  timeline.startedAt = 0;
  timeline.running = false;
}

function resetPointerMusicTimeline() {
  state.musicTimeline.duration = MAX_MUSIC_DURATION;
  state.musicTimeline.elapsed = 0;
  state.musicTimeline.startedAt = 0;
  state.musicTimeline.running = false;
}

async function ensurePerformanceOutput() {
  if (state.outputMode === "web" && !soundEngine.enabled) await soundEngine.toggle();
  if (state.mode === "pointer" && (state.outputMode === "midi" || soundEngine.enabled)) {
    startPointerMusicTimeline();
  }
}

const externalSources = [
  ["normalized.x", "Horizontal position"],
  ["normalized.y", "Vertical position"],
  ["speed", "Movement speed"],
  ["edgeProximity", "Boundary proximity"],
  ["texture", "Texture"],
  ["color.hue", "Colour hue"],
  ["color.saturation", "Colour saturation"],
  ["color.brightness", "Brightness"],
  ["scan.progress", "Scan progress"],
  ["scan.primaryIntensity", "Primary region intensity"],
  ["music.bpm", "Music BPM"],
  ["music.rootMidi", "Music root note"],
  ["music.modeIndex", "Music mode"],
  ["music.beatPhase", "Music beat phase"],
  ["region.enter", "Enter region (trigger)"],
];
const externalSourceRanges = {
  "music.bpm": [40, 200],
  "music.rootMidi": [36, 47],
  "music.modeIndex": [0, Object.keys(MUSIC_MODES).length - 1],
};

let externalConfig = null;
let externalDependencies = null;

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function field(label, control, className = "") {
  const wrapper = document.createElement("label");
  if (className) wrapper.className = className;
  const caption = document.createElement("span");
  caption.textContent = label;
  wrapper.append(caption, control);
  return wrapper;
}

function renderMidiPorts(ports = [], selected = "__virtual__") {
  midiPort.replaceChildren(option("__virtual__", "Street Art Sonification (virtual)"));
  ports.forEach((name) => midiPort.append(option(name, name)));
  if (![...midiPort.options].some((item) => item.value === selected) && selected !== "__virtual__") {
    midiPort.append(option(selected, `${selected} (unavailable)`));
  }
  midiPort.value = selected || "__virtual__";
}

function updateMappingRow(row) {
  const protocol = row.querySelector(".mapping-protocol").value;
  const source = row.querySelector(".mapping-source").value;
  const target = row.querySelector(".mapping-target-input");
  const channel = row.querySelector(".channel-field");
  const currentProtocol = row.dataset.protocol;
  if (currentProtocol && currentProtocol !== protocol) {
    target.value = protocol === "osc" ? "/streetart/value" : (source === "region.enter" ? "60" : "74");
    row.querySelector(".mapping-min").value = "0";
    row.querySelector(".mapping-max").value = protocol === "osc" ? "1" : "127";
  }
  row.dataset.protocol = protocol;
  row.dataset.source = source;
  target.previousElementSibling.textContent = protocol === "osc" ? "OSC" : (source === "region.enter" ? "NOTE" : "CC");
  target.type = protocol === "osc" ? "text" : "number";
  target.min = protocol === "osc" ? "" : "0";
  target.max = protocol === "osc" ? "" : "127";
  channel.hidden = protocol !== "midi";
  row.classList.toggle("disabled", !row.querySelector(".mapping-enabled").checked);
}

function createMappingRow(mapping = {}) {
  const row = document.createElement("div");
  row.className = "mapping-row";
  row.dataset.id = mapping.id || `mapping-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "mapping-enabled";
  enabled.checked = mapping.enabled !== false;
  const enabledLabel = field("ON", enabled, "mapping-check");

  const source = document.createElement("select");
  source.className = "mapping-source";
  externalSources.forEach(([value, label]) => source.append(option(value, label)));
  source.value = mapping.source || "normalized.x";

  const protocol = document.createElement("select");
  protocol.className = "mapping-protocol";
  protocol.append(option("osc", "OSC"), option("midi", "MIDI"));
  protocol.value = mapping.protocol || "osc";

  const remove = document.createElement("button");
  remove.className = "mapping-delete";
  remove.type = "button";
  remove.title = "Remove mapping";
  remove.setAttribute("aria-label", "Remove mapping");
  remove.textContent = "×";

  const targetGroup = document.createElement("div");
  targetGroup.className = "mapping-target";
  const target = document.createElement("input");
  target.className = "mapping-target-input";
  target.value = mapping.target ?? "/streetart/value";
  const minimum = document.createElement("input");
  minimum.className = "mapping-min";
  minimum.type = "number";
  minimum.step = "any";
  minimum.value = mapping.outputMin ?? 0;
  const maximum = document.createElement("input");
  maximum.className = "mapping-max";
  maximum.type = "number";
  maximum.step = "any";
  maximum.value = mapping.outputMax ?? (protocol.value === "midi" ? 127 : 1);
  const channel = document.createElement("input");
  channel.className = "mapping-channel";
  channel.type = "number";
  channel.min = "1";
  channel.max = "16";
  channel.value = mapping.channel ?? 1;
  const invert = document.createElement("input");
  invert.className = "mapping-invert";
  invert.type = "checkbox";
  invert.checked = Boolean(mapping.invert);
  targetGroup.append(
    field("OSC", target),
    field("MIN", minimum),
    field("MAX", maximum),
    field("CHANNEL", channel, "channel-field"),
    field("INVERT", invert, "invert-field"),
  );
  row.append(enabledLabel, field("SOURCE", source), field("SEND AS", protocol), remove, targetGroup);

  enabled.addEventListener("change", () => updateMappingRow(row));
  protocol.addEventListener("change", () => updateMappingRow(row));
  source.addEventListener("change", () => updateMappingRow(row));
  remove.addEventListener("click", () => {
    row.remove();
    $("#mappingCount").textContent = mappingList.children.length;
  });
  updateMappingRow(row);
  return row;
}

function renderMappings(mappings) {
  mappingList.replaceChildren(...mappings.map((mapping) => createMappingRow(mapping)));
  $("#mappingCount").textContent = mappings.length;
}

function collectExternalConfig() {
  const previous = externalConfig || {};
  return {
    enabled: externalEnabled.checked,
    osc: { host: $("#oscHost").value.trim(), port: Number($("#oscPort").value) },
    midi: { port: midiPort.value, virtualName: previous.midi?.virtualName || "Street Art Sonification" },
    mappings: [...mappingList.querySelectorAll(".mapping-row")].map((row) => {
      const source = row.querySelector(".mapping-source").value;
      const protocol = row.querySelector(".mapping-protocol").value;
      const earlier = previous.mappings?.find((item) => item.id === row.dataset.id);
      const sourceRange = externalSourceRanges[source] || [0, 1];
      const keepEarlierRange = earlier?.source === source;
      return {
        id: row.dataset.id,
        enabled: row.querySelector(".mapping-enabled").checked,
        source,
        protocol,
        target: row.querySelector(".mapping-target-input").value,
        message: source === "region.enter" ? (protocol === "midi" ? "note" : "trigger") : (protocol === "midi" ? "cc" : "value"),
        channel: Number(row.querySelector(".mapping-channel").value || 1),
        inputMin: keepEarlierRange ? earlier.inputMin : sourceRange[0],
        inputMax: keepEarlierRange ? earlier.inputMax : sourceRange[1],
        outputMin: Number(row.querySelector(".mapping-min").value),
        outputMax: Number(row.querySelector(".mapping-max").value),
        invert: row.querySelector(".mapping-invert").checked,
        smoothingMs: earlier?.smoothingMs ?? (source === "region.enter" ? 0 : 70),
      };
    }),
  };
}

function setExternalState(kind, message) {
  externalStatus.classList.toggle("active", kind === "active");
  externalStatus.classList.toggle("error", kind === "error");
  externalStatus.lastChild.textContent = ` ${kind === "active" ? "Active" : kind === "error" ? "Error" : "Off"}`;
  if (message) externalMessage.textContent = message;
}

async function loadExternalOutput() {
  try {
    const response = await fetch("/api/external-output", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not load external output");
    externalConfig = payload.config;
    externalDependencies = payload.dependencies;
    externalEnabled.checked = externalConfig.enabled;
    $("#oscHost").value = externalConfig.osc.host;
    $("#oscPort").value = externalConfig.osc.port;
    renderMidiPorts(payload.dependencies.midi.ports, externalConfig.midi.port);
    renderMappings(externalConfig.mappings);
    const missing = ["osc", "midi"].filter((name) => !payload.dependencies[name].available);
    if (missing.length) setExternalState("error", `${missing.join(" and ").toUpperCase()} support is not installed.`);
    else setExternalState(externalConfig.enabled ? "active" : "off", externalConfig.enabled ? "Mapped control is being sent." : "Settings are stored on this Mac.");
  } catch (error) {
    setExternalState("error", error.message);
  }
}

async function saveExternalOutput(announce = true) {
  const button = $("#saveExternal");
  button.disabled = true;
  try {
    const response = await fetch("/api/external-output", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectExternalConfig()),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not save the output settings");
    externalConfig = payload.config;
    setExternalState(externalConfig.enabled ? "active" : "off", externalConfig.enabled ? "Mapped control is being sent." : "Settings saved. External output is off.");
    if (announce) showToast("External output settings saved");
    return true;
  } catch (error) {
    setExternalState("error", error.message);
    showToast(error.message);
    return false;
  } finally {
    button.disabled = false;
  }
}

async function testExternalOutput(protocol) {
  if (!await saveExternalOutput(false)) return;
  try {
    const response = await fetch(`/api/external-output/test/${protocol}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `Could not test ${protocol.toUpperCase()}`);
    const destination = protocol === "osc" ? `${externalConfig.osc.host}:${externalConfig.osc.port}` : (midiPort.selectedOptions[0]?.textContent || "MIDI");
    externalMessage.textContent = `${protocol.toUpperCase()} test sent to ${destination}.`;
    showToast(`${protocol.toUpperCase()} test sent`);
  } catch (error) {
    setExternalState("error", error.message);
    showToast(error.message);
  }
}

function safeName(name) {
  return name.length > 34 ? `${name.slice(0, 28)}…${name.split(".").pop()}` : name;
}

function rgb(region, alpha = 1) {
  return `rgba(${region.color_rgb[0]}, ${region.color_rgb[1]}, ${region.color_rgb[2]}, ${alpha})`;
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = ((hue / 6) + 1) % 1;
  }
  return { hue, saturation: max ? delta / max : 0, value: max };
}

function readImagePixels(image) {
  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = image.naturalWidth;
  imageCanvas.height = image.naturalHeight;
  const imageContext = imageCanvas.getContext("2d", { willReadFrequently: true });
  imageContext.drawImage(image, 0, 0);
  return {
    data: imageContext.getImageData(0, 0, imageCanvas.width, imageCanvas.height).data,
    width: imageCanvas.width,
    height: imageCanvas.height,
  };
}

function sampleVisualAt(nx, ny) {
  const pixels = state.imagePixels;
  if (!pixels || !Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const centerX = Math.max(0, Math.min(pixels.width - 1, Math.round(nx * (pixels.width - 1))));
  const centerY = Math.max(0, Math.min(pixels.height - 1, Math.round(ny * (pixels.height - 1))));
  const radius = Math.max(4, Math.min(44, Math.round(Math.min(pixels.width, pixels.height) * .026)));
  const step = Math.max(1, Math.floor(radius / 8));
  const reds = [];
  const greens = [];
  const blues = [];
  const luminance = [];
  for (let dy = -radius; dy <= radius; dy += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = Math.max(0, Math.min(pixels.width - 1, centerX + dx));
      const y = Math.max(0, Math.min(pixels.height - 1, centerY + dy));
      const index = (y * pixels.width + x) * 4;
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      reds.push(red);
      greens.push(green);
      blues.push(blue);
      luminance.push((.2126 * red + .7152 * green + .0722 * blue) / 255);
    }
  }
  if (!reds.length) return null;
  const red = median(reds);
  const green = median(greens);
  const blue = median(blues);
  const hsv = rgbToHsv(red, green, blue);
  const brightness = (.2126 * red + .7152 * green + .0722 * blue) / 255;
  const luminanceMean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const contrast = Math.sqrt(luminance.reduce((sum, value) => sum + (value - luminanceMean) ** 2, 0) / luminance.length);
  return {
    hue: hsv.hue,
    hueFamilyIndex: Math.floor(((hsv.hue + 1 / 16) % 1) * 8),
    saturation: hsv.saturation,
    brightness,
    texture: Math.min(1, contrast * 4.5),
    colorRgb: [red, green, blue],
  };
}

function buildScanProfile(hitData, width, height, imagePixels) {
  const profile = [];
  const yStep = Math.max(1, Math.floor(height / 260));
  const halfSpan = Math.max(1, Math.floor(width / SCAN_PROFILE_BINS / 2));
  for (let bin = 0; bin < SCAN_PROFILE_BINS; bin++) {
    const centerX = Math.min(width - 1, Math.round(bin / (SCAN_PROFILE_BINS - 1) * (width - 1)));
    const xs = [Math.max(0, centerX - halfSpan), centerX, Math.min(width - 1, centerX + halfSpan)];
    let insideCount = 0;
    let sampleCount = 0;
    let yTotal = 0;
    let transitions = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let brightnessTotal = 0;
    let saturationTotal = 0;
    let hueCos = 0;
    let hueSin = 0;
    let hueWeight = 0;
    const hueBins = new Array(8).fill(0);
    for (const x of xs) {
      let previousInside = false;
      for (let y = 0; y < height; y += yStep) {
        const inside = hitData[(y * width + x) * 4] > 80;
        if (inside) {
          insideCount++;
          yTotal += y;
          const imageX = Math.min(imagePixels.width - 1, Math.round(x / Math.max(1, width - 1) * (imagePixels.width - 1)));
          const imageY = Math.min(imagePixels.height - 1, Math.round(y / Math.max(1, height - 1) * (imagePixels.height - 1)));
          const imageIndex = (imageY * imagePixels.width + imageX) * 4;
          const red = imagePixels.data[imageIndex];
          const green = imagePixels.data[imageIndex + 1];
          const blue = imagePixels.data[imageIndex + 2];
          const hsv = rgbToHsv(red, green, blue);
          const brightness = (.2126 * red + .7152 * green + .0722 * blue) / 255;
          const colorWeight = hsv.saturation * (.35 + hsv.value * .65);
          redTotal += red;
          greenTotal += green;
          blueTotal += blue;
          brightnessTotal += brightness;
          saturationTotal += hsv.saturation;
          hueCos += Math.cos(hsv.hue * Math.PI * 2) * colorWeight;
          hueSin += Math.sin(hsv.hue * Math.PI * 2) * colorWeight;
          hueWeight += colorWeight;
          const hueBin = Math.floor(((hsv.hue + 1 / 16) % 1) * 8);
          hueBins[hueBin] += colorWeight;
        }
        if (inside !== previousInside) transitions++;
        previousInside = inside;
        sampleCount++;
      }
    }
    const divisor = Math.max(1, insideCount);
    const dominantHueWeight = Math.max(...hueBins, 0);
    profile.push({
      coverage: insideCount / Math.max(1, sampleCount),
      centroidY: insideCount ? yTotal / insideCount / height : .5,
      texture: Math.min(1, transitions / 22),
      brightness: brightnessTotal / divisor,
      saturation: saturationTotal / divisor,
      hueCos: hueWeight ? hueCos / hueWeight : 1,
      hueSin: hueWeight ? hueSin / hueWeight : 0,
      hueBins: hueBins.map((weight) => dominantHueWeight ? weight / dominantHueWeight : 0),
      colorRgb: [redTotal / divisor, greenTotal / divisor, blueTotal / divisor],
    });
  }
  return profile;
}

async function prepareMask(region, imagePixels) {
  const [visualImage, hitImage] = await Promise.all([
    imageFromUrl(region.visual_mask_url),
    imageFromUrl(region.hit_mask_url),
  ]);
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = hitImage.naturalWidth;
  hitCanvas.height = hitImage.naturalHeight;
  const hitContext = hitCanvas.getContext("2d", { willReadFrequently: true });
  hitContext.drawImage(hitImage, 0, 0);
  const hitData = hitContext.getImageData(0, 0, hitCanvas.width, hitCanvas.height).data;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = visualImage.naturalWidth;
  maskCanvas.height = visualImage.naturalHeight;
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  maskContext.drawImage(visualImage, 0, 0);
  const maskData = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;

  // Draw only the inner boundary of the mask. The artwork itself remains
  // untouched while the active shape receives a precise, luminous contour.
  const outlineCanvas = document.createElement("canvas");
  outlineCanvas.width = maskCanvas.width;
  outlineCanvas.height = maskCanvas.height;
  const outlineContext = outlineCanvas.getContext("2d");
  const outline = outlineContext.createImageData(maskCanvas.width, maskCanvas.height);
  const radius = Math.max(2, Math.round(Math.min(maskCanvas.width, maskCanvas.height) / 360));
  const [red, green, blue] = region.color_rgb;
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= maskCanvas.width || y >= maskCanvas.height) return false;
    return maskData[(y * maskCanvas.width + x) * 4] > 80;
  };
  for (let y = 0; y < maskCanvas.height; y++) {
    for (let x = 0; x < maskCanvas.width; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - radius, y) && inside(x + radius, y) && inside(x, y - radius) && inside(x, y + radius)) continue;
      const index = (y * maskCanvas.width + x) * 4;
      outline.data[index] = red;
      outline.data[index + 1] = green;
      outline.data[index + 2] = blue;
      outline.data[index + 3] = 255;
    }
  }
  outlineContext.putImageData(outline, 0, 0);

  return {
    ...region,
    visualImage,
    hitCanvas,
    hitContext,
    hitData,
    scanProfile: buildScanProfile(hitData, hitCanvas.width, hitCanvas.height, imagePixels),
    outlineCanvas,
  };
}

function fitCanvas() {
  if (!state.image) return;
  canvas.width = state.image.naturalWidth;
  canvas.height = state.image.naturalHeight;
  drawCanvas();
}

function drawCanvas() {
  if (!state.image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  if (state.masksVisible) {
    const visibleRegions = state.mode === "scan"
      ? state.scan.regions.slice(0, 4)
      : (state.activeRegion ? [{ region: state.activeRegion, intensity: 1 }] : []);
    for (const item of visibleRegions) {
      const region = item.region;
      ctx.save();
      ctx.globalAlpha = state.mode === "scan" ? .32 + item.intensity * .55 : .96;
      ctx.shadowColor = rgb(region, .72);
      ctx.shadowBlur = state.mode === "scan" ? 6 : 9;
      ctx.drawImage(region.outlineCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (state.mode === "pointer" && state.activeRegion && maskValue(state.activeRegion, state.pointer.nx, state.pointer.ny)) {
      const region = state.activeRegion;
      const size = Math.max(13, Math.min(canvas.width, canvas.height) * .018);
      ctx.save();
      ctx.strokeStyle = rgb(region, .9);
      ctx.lineWidth = Math.max(1.5, canvas.width / 700);
      ctx.setLineDash([size * .42, size * .28]);
      ctx.beginPath();
      ctx.arc(state.pointer.nx * canvas.width, state.pointer.ny * canvas.height, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (state.mode === "scan") {
    const x = state.scan.position * canvas.width;
    const bandWidth = Math.max(12, canvas.width * .035);
    const gradient = ctx.createLinearGradient(x - bandWidth, 0, x + bandWidth, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(.5, "rgba(255,255,255,.22)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(x - bandWidth, 0, bandWidth * 2, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,.96)";
    ctx.shadowColor = "rgba(227,107,79,.95)";
    ctx.shadowBlur = Math.max(8, canvas.width / 80);
    ctx.lineWidth = Math.max(1.5, canvas.width / 800);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(227,107,79,.98)";
    ctx.fillRect(x - Math.max(1, canvas.width / 1000), 0, Math.max(2, canvas.width / 500), canvas.height);
    ctx.restore();
  }
}

function renderRegionList() {
  regionList.replaceChildren();
  $("#regionCount").textContent = state.regions.length;
  for (const region of state.regions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-chip";
    button.style.setProperty("--chip-color", rgb(region));
    button.dataset.region = region.id;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<i></i><span><strong>${region.label}</strong><small>${region.instrument?.label || "Lead Synth"} · CH ${region.instrument?.midiChannel || 1}</small></span>`;
    button.title = region.instrument?.behavior || "Beat-synced melody";
    button.addEventListener("click", async () => {
      if (state.mode === "scan" && state.scan.playing) {
        showToast("Pause the scan to audition an individual region");
        return;
      }
      await ensurePerformanceOutput();
      const togglingOff = state.activeRegion?.id === region.id;
      if (state.mode === "scan") {
        state.scan.manualRegionId = togglingOff ? null : region.id;
        state.scan.regions = togglingOff ? [] : [manualScanItem(region)];
        if (togglingOff) clearActiveRegion(false);
        else activateRegion(region, false, false);
        if (togglingOff) soundEngine.stopScan();
        publishOutput(true);
        return;
      }
      if (togglingOff) {
        clearActiveRegion();
        publishOutput(true);
      } else {
        activateRegion(region, true);
      }
    });
    regionList.append(button);
  }
}

async function loadAnalysis(manifest) {
  resetScan(false);
  resetPointerCrossfade();
  soundEngine.clearRegionVoices();
  state.manifest = manifest;
  state.activeRegion = null;
  setAnalysisProgress(92, "Preparing the interactive regions…");
  const loadedImage = await imageFromUrl(`${manifest.image_url}${manifest.image_url.includes("?") ? "&" : "?"}v=${Date.now()}`);
  const imagePixels = readImagePixels(loadedImage);
  const loadedRegions = await Promise.all(manifest.regions.slice(0, INSTRUMENT_ROLES.length).map((region) => prepareMask(region, imagePixels)));
  state.image = loadedImage;
  state.imagePixels = imagePixels;
  state.regions = assignInstrumentRoles(loadedRegions);
  resetPointerMusicTimeline();
  const musicPlan = manifest.music_plan || null;
  if (musicPlan) {
    musicBpm.value = String(Math.max(40, Math.min(200, Math.round(Number(musicPlan.bpm) || 72))));
    musicRoot.value = NOTE_NAMES.includes(musicPlan.root) ? musicPlan.root : "D";
    musicMode.value = MUSIC_MODES[musicPlan.mode] ? musicPlan.mode : "dorian";
    applyMusicSettings(false);
  }
  $("#musicSourceStatus").textContent = harmonyPlanSummary();
  $("#thumbImage").src = manifest.image_url;
  fitCanvas();
  renderRegionList();
  clearActiveRegion();
  updateScanControls();
  statusText.textContent = `${loadedRegions.length} regions are ready. Move across the image to explore.`;
  const preparationWarnings = manifest.preprocessing?.warnings || [];
  if (preparationWarnings.length) showToast(preparationWarnings[0]);
  publishOutput(true);
}

function maskValue(region, nx, ny) {
  const x = Math.max(0, Math.min(region.hitCanvas.width - 1, Math.floor(nx * region.hitCanvas.width)));
  const y = Math.max(0, Math.min(region.hitCanvas.height - 1, Math.floor(ny * region.hitCanvas.height)));
  return region.hitData[(y * region.hitCanvas.width + x) * 4] > 80;
}

function edgeProximity(region, nx, ny) {
  if (!maskValue(region, nx, ny)) return 0;
  const radii = [2, 5, 9, 15, 23];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [-.707, .707], [.707, -.707], [-.707, -.707]];
  for (let ri = 0; ri < radii.length; ri++) {
    const r = radii[ri];
    for (const [dx, dy] of directions) {
      const px = nx + dx * r / region.hitCanvas.width;
      const py = ny + dy * r / region.hitCanvas.height;
      if (px < 0 || py < 0 || px > 1 || py > 1 || !maskValue(region, px, py)) {
        return Number((1 - ri / radii.length * .82).toFixed(3));
      }
    }
  }
  return 0;
}

function regionAt(nx, ny) {
  for (let index = state.regions.length - 1; index >= 0; index--) {
    if (maskValue(state.regions[index], nx, ny)) return state.regions[index];
  }
  return null;
}

function regionAtGaze(nx, ny) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return regionAt(nx, ny);
  const radius = 32;
  const offsets = [
    [0, 0], [.45, 0], [-.45, 0], [0, .45], [0, -.45],
    [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  let best = null;
  let bestScore = 0;
  for (let index = 0; index < state.regions.length; index++) {
    const region = state.regions[index];
    let hits = 0;
    for (const [ox, oy] of offsets) {
      const px = nx + ox * radius / rect.width;
      const py = ny + oy * radius / rect.height;
      if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && maskValue(region, px, py)) hits++;
    }
    const centerBonus = maskValue(region, nx, ny) ? 1.8 : 0;
    const specificity = Math.max(0, 1 - Number(region.area_ratio || .5)) * .45;
    const score = hits + centerBonus + specificity + index * .0001;
    if (hits >= 2 && score > bestScore) {
      best = region;
      bestScore = score;
    }
  }
  return best;
}

function scanProfileAt(region, nx) {
  const position = Math.max(0, Math.min(SCAN_PROFILE_BINS - 1, nx * (SCAN_PROFILE_BINS - 1)));
  const left = Math.floor(position);
  const right = Math.min(SCAN_PROFILE_BINS - 1, left + 1);
  const mix = position - left;
  const a = region.scanProfile[left];
  const b = region.scanProfile[right];
  const hueCos = a.hueCos + (b.hueCos - a.hueCos) * mix;
  const hueSin = a.hueSin + (b.hueSin - a.hueSin) * mix;
  const hueBins = a.hueBins.map((value, index) => value + (b.hueBins[index] - value) * mix);
  return {
    coverage: a.coverage + (b.coverage - a.coverage) * mix,
    centroidY: a.centroidY + (b.centroidY - a.centroidY) * mix,
    texture: a.texture + (b.texture - a.texture) * mix,
    brightness: a.brightness + (b.brightness - a.brightness) * mix,
    saturation: a.saturation + (b.saturation - a.saturation) * mix,
    hue: ((Math.atan2(hueSin, hueCos) / (Math.PI * 2)) + 1) % 1,
    hueFamilyIndex: hueBins.indexOf(Math.max(...hueBins)),
    colorRgb: a.colorRgb.map((value, index) => value + (b.colorRgb[index] - value) * mix),
  };
}

const HUE_FAMILIES = ["red", "orange", "yellow", "green", "cyan", "blue", "violet", "magenta"];

function colorDescriptor(sample) {
  if (sample.saturation < .12) {
    const family = sample.brightness < .22 ? "dark" : (sample.brightness > .82 ? "white" : "neutral");
    return { family, index: -1 };
  }
  const index = Math.max(0, Math.min(7, sample.hueFamilyIndex));
  return { family: HUE_FAMILIES[index], index };
}

function scanRegionsAt(nx) {
  const specificity = { outline: .24, lettering: .2, face: .18, detail: .16, symbol: .16, gesture: .13, drip: .1, texture: .08, figure: .04, fill: 0, wall: -.03 };
  return state.regions
    .map((region) => {
      const sample = scanProfileAt(region, nx);
      const intensity = Math.min(1, Math.sqrt(sample.coverage * 3.2));
      return { region, ...sample, intensity, score: intensity + (specificity[region.type] || 0) };
    })
    .filter((item) => item.coverage > .006)
    .sort((a, b) => b.score - a.score || b.texture - a.texture);
}

function resetScanCrossfade() {
  state.scan.regionMix.clear();
  state.scan.lastMixAt = 0;
}

function resetPointerCrossfade() {
  state.pointer.regionMix.clear();
  state.pointer.regions = [];
  state.pointer.lastMixAt = 0;
}

function advancePointerCrossfade() {
  if (state.mode !== "pointer") return false;
  const now = performance.now();
  const elapsed = state.pointer.lastMixAt ? (now - state.pointer.lastMixAt) / 1000 : 1 / 30;
  const delta = Math.max(1 / 120, Math.min(.12, elapsed));
  state.pointer.lastMixAt = now;
  const region = state.activeRegion;
  const target = region ? {
    region,
    x: state.pointer.nx,
    y: state.pointer.ny,
    intensity: 1,
    visual: sampleVisualAt(state.pointer.nx, state.pointer.ny) || fallbackRegionVisual(region),
  } : null;
  const regionIds = new Set([...state.pointer.regionMix.keys(), ...(target ? [target.region.id] : [])]);
  const mixed = [];
  let changing = false;

  for (const regionId of regionIds) {
    const previous = state.pointer.regionMix.get(regionId);
    const isTarget = target?.region.id === regionId;
    const targetLevel = isTarget ? 1 : 0;
    const currentLevel = previous?.intensity || 0;
    const fadeSeconds = targetLevel > currentLevel ? .18 : .42;
    const difference = targetLevel - currentLevel;
    const step = Math.min(Math.abs(difference), delta / fadeSeconds);
    const intensity = currentLevel + Math.sign(difference) * step;
    const item = isTarget ? target : previous?.item;
    if (!item || (intensity <= .001 && !isTarget)) {
      state.pointer.regionMix.delete(regionId);
      continue;
    }
    const mixedItem = { ...item, intensity, crossfade: isTarget ? "in" : "out" };
    state.pointer.regionMix.set(regionId, { intensity, item: mixedItem });
    mixed.push(mixedItem);
    if (Math.abs(targetLevel - intensity) > .001) changing = true;
  }
  state.pointer.regions = mixed.sort((a, b) => b.intensity - a.intensity);
  return changing;
}

function crossfadedScanRegionsAt(nx) {
  const now = performance.now();
  const elapsed = state.scan.lastMixAt ? (now - state.scan.lastMixAt) / 1000 : 1 / 30;
  const delta = Math.max(1 / 120, Math.min(.12, elapsed));
  state.scan.lastMixAt = now;
  const rawRegions = scanRegionsAt(nx).slice(0, 5);
  const targets = new Map(rawRegions.map((item) => [item.region.id, item]));
  const regionIds = new Set([...state.scan.regionMix.keys(), ...targets.keys()]);
  const mixed = [];

  for (const regionId of regionIds) {
    const target = targets.get(regionId);
    const previous = state.scan.regionMix.get(regionId);
    const targetLevel = target?.intensity || 0;
    const currentLevel = previous?.intensity || 0;
    const fadeSeconds = targetLevel > currentLevel ? .18 : .42;
    const difference = targetLevel - currentLevel;
    const step = Math.min(Math.abs(difference), delta / fadeSeconds);
    const intensity = currentLevel + Math.sign(difference) * step;
    const item = target || previous?.item;
    if (!item || (intensity < .008 && !target)) {
      state.scan.regionMix.delete(regionId);
      continue;
    }
    const mixedItem = {
      ...item,
      intensity,
      score: intensity + ((item.score || 0) - (item.intensity || 0)),
      crossfade: target ? "in" : "out",
    };
    state.scan.regionMix.set(regionId, { intensity, item: mixedItem });
    mixed.push(mixedItem);
  }
  return mixed.sort((a, b) => b.score - a.score || b.texture - a.texture).slice(0, 5);
}

function manualScanItem(region) {
  const sample = scanProfileAt(region, state.scan.position);
  const fallback = fallbackRegionVisual(region);
  return {
    region,
    ...sample,
    coverage: Math.max(sample.coverage, Number(region.area_ratio || .08)),
    centroidY: Number.isFinite(sample.centroidY) ? sample.centroidY : .5,
    brightness: sample.coverage ? sample.brightness : fallback.brightness,
    saturation: sample.coverage ? sample.saturation : fallback.saturation,
    hue: sample.coverage ? sample.hue : fallback.hue,
    texture: sample.coverage ? sample.texture : fallback.texture,
    colorRgb: sample.coverage ? sample.colorRgb : (region.color_rgb || [128, 128, 128]),
    intensity: 1,
    score: 1,
  };
}

function syncRegionButtons() {
  const activeIds = state.mode === "scan" && state.scan.playing
    ? new Set(state.scan.regions.filter((item) => item.intensity > .06).slice(0, 5).map((item) => item.region.id))
    : new Set(state.activeRegion ? [state.activeRegion.id] : []);
  document.querySelectorAll(".region-chip").forEach((chip) => {
    const active = activeIds.has(chip.dataset.region);
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  });
}

function activateRegion(region, fromList = false, triggerSound = true) {
  const changed = state.activeRegion?.id !== region?.id;
  state.activeRegion = region;
  if (changed) {
    state.enteredAt = performance.now();
    if (triggerSound) {
      soundEngine.enter(region, state.pointer.nx, state.pointer.ny);
      if (navigator.vibrate) navigator.vibrate(9);
    }
  }
  if (state.mode === "pointer") advancePointerCrossfade();
  syncRegionButtons();
  if (region) {
    regionBadge.hidden = false;
    regionBadge.style.setProperty("--region-color", rgb(region));
    $("#regionType").textContent = `${region.instrument?.label || "Lead Synth"} · CH ${region.instrument?.midiChannel || 1}`.toUpperCase();
    $("#regionName").textContent = region.label;
    $("#currentRegion").textContent = region.label;
  }
  drawCanvas();
  if (fromList) publishOutput(true);
}

function clearActiveRegion(stopSound = true) {
  state.activeRegion = null;
  state.enteredAt = 0;
  regionBadge.hidden = true;
  const direction = state.pointer.source === "gaze" ? "Look across the artwork" : "Move over the artwork";
  $("#currentRegion").textContent = state.regions.length ? direction : "Waiting for analysis";
  syncRegionButtons();
  if (state.mode === "pointer") advancePointerCrossfade();
  if (stopSound) soundEngine.leave();
  drawCanvas();
}

function outputPayload() {
  const region = state.activeRegion;
  const scanPrimary = state.scan.regions[0] || null;
  const scanning = state.mode === "scan";
  const pointerVisual = !scanning && region ? sampleVisualAt(state.pointer.nx, state.pointer.ny) : null;
  return {
    type: scanning ? "scan_state" : "pointer_state",
    source: scanning ? "scan" : state.pointer.source,
    outputMode: state.outputMode,
    analysisId: state.manifest?.analysis_id || null,
    region: region ? {
      id: region.id,
      label: region.label,
      type: region.type,
      index: region.index,
      instrument: region.instrument?.label || "Lead Synth",
      instrumentId: region.instrument?.id || "lead_synth",
      instrumentSlot: region.instrument?.slot || 1,
      midiChannel: region.instrument?.midiChannel || 1,
      musicalBehavior: region.instrument?.behavior || "Beat-synced melody",
    } : null,
    normalized: {
      x: Number((scanning ? state.scan.position : state.pointer.nx).toFixed(4)),
      y: Number((scanning ? (scanPrimary?.centroidY ?? .5) : state.pointer.ny).toFixed(4)),
    },
    speed: Number((scanning ? (state.scan.playing ? 1 / state.scan.duration : 0) : state.pointer.speed).toFixed(3)),
    edgeProximity: scanning ? 0 : (region ? edgeProximity(region, state.pointer.nx, state.pointer.ny) : 0),
    texture: Number((scanning ? (scanPrimary?.texture ?? 0) : (pointerVisual?.texture ?? 0)).toFixed(3)),
    color: (scanning ? scanPrimary : pointerVisual) ? {
      family: colorDescriptor(scanning ? scanPrimary : pointerVisual).family,
      hue: Number((scanning ? scanPrimary.hue : pointerVisual.hue).toFixed(3)),
      saturation: Number((scanning ? scanPrimary.saturation : pointerVisual.saturation).toFixed(3)),
      brightness: Number((scanning ? scanPrimary.brightness : pointerVisual.brightness).toFixed(3)),
      rgb: (scanning ? scanPrimary.colorRgb : pointerVisual.colorRgb).map((value) => Math.round(value)),
    } : null,
    dwellMs: region && state.enteredAt ? Math.round(performance.now() - state.enteredAt) : 0,
    scan: scanning ? {
      playing: state.scan.playing,
      seconds: Number(state.scan.seconds.toFixed(2)),
      duration: state.scan.duration,
      progress: Number(state.scan.position.toFixed(4)),
      activeRegions: state.scan.regions.slice(0, 5).map((item) => ({
        id: item.region.id,
        label: item.region.label,
        type: item.region.type,
        intensity: Number(item.intensity.toFixed(3)),
        colorFamily: colorDescriptor(item).family,
        brightness: Number(item.brightness.toFixed(3)),
        saturation: Number(item.saturation.toFixed(3)),
      })),
    } : null,
    eyeTracking: !scanning ? {
      enabled: state.eye.active,
      calibrated: state.eye.calibrated,
      model: state.eye.active ? "WebEyeTrack" : null,
    } : null,
    music: {
      source: "realtime-algorithm",
      masterDurationSeconds: MAX_MUSIC_DURATION,
      playbackSeconds: Number((scanning ? state.scan.seconds : pointerMusicSeconds()).toFixed(3)),
      bpm: state.music.bpm,
      root: state.music.root,
      rootMidi: musicRootMidi(),
      mode: state.music.mode,
      modeIndex: Math.max(0, Object.keys(MUSIC_MODES).indexOf(state.music.mode)),
      progressionPlan: {
        primary: ensureHarmonyPlan().primary.name,
        contrast: ensureHarmonyPlan().contrast.name,
        selection: "automatic-from-artwork",
      },
      beatPosition: Number(musicBeatPosition(scanning).toFixed(3)),
      beatPhase: Number((musicBeatPosition(scanning) % 1).toFixed(3)),
      activeVoices: activeMusicVoices(scanning, region, state.scan.regions, pointerVisual),
    },
    timestamp: Date.now(),
  };
}

function publishOutput(force = false) {
  const now = performance.now();
  if (!force && now - state.lastSentAt < 45) return;
  state.lastSentAt = now;
  const payload = outputPayload();
  state.lastOutput = payload;
  outputJson.textContent = JSON.stringify(payload, null, 2);
  $("#xValue").textContent = payload.normalized.x.toFixed(3);
  $("#yValue").textContent = payload.normalized.y.toFixed(3);
  $("#speedValue").textContent = payload.speed.toFixed(2);
  $("#edgeValue").textContent = payload.edgeProximity.toFixed(2);
  subscribers.forEach((callback) => callback(payload));
  window.dispatchEvent(new CustomEvent("streetart:control", { detail: payload }));
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  if (state.mode === "scan") {
    soundEngine.updateScan(
      state.scan.regions,
      state.scan.position,
      state.scan.seconds,
      state.scan.playing,
      payload.music.activeVoices,
    );
  }
  else soundEngine.update(payload);
}

class LocalSampleBank {
  constructor(context) {
    this.context = context;
    this.buffers = new Map();
    this.loadPromise = null;
    this.failures = [];
  }
  async load() {
    if (this.loadPromise) return this.loadPromise;
    const entries = Object.entries(LOCAL_SAMPLE_MANIFEST).flatMap(([instrument, samples]) => (
      samples.map(([note, url]) => ({ instrument, note, url }))
    ));
    this.loadPromise = Promise.allSettled(entries.map(async ({ instrument, note, url }) => {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(`${instrument}:${note}`, { note, buffer });
    })).then((results) => {
      this.failures = results.filter((result) => result.status === "rejected");
      return { loaded: this.buffers.size, failed: this.failures.length };
    });
    return this.loadPromise;
  }
  nearest(instrument, note) {
    const candidates = (LOCAL_SAMPLE_MANIFEST[instrument] || [])
      .map(([sampleNote]) => this.buffers.get(`${instrument}:${sampleNote}`))
      .filter(Boolean);
    if (!candidates.length) return null;
    return candidates.reduce((nearest, candidate) => (
      Math.abs(candidate.note - note) < Math.abs(nearest.note - note) ? candidate : nearest
    ));
  }
  exact(instrument, note) {
    return this.buffers.get(`${instrument}:${note}`) || null;
  }
}

class SoundEngine {
  constructor() {
    this.enabled = false;
    this.outputLevel = Number(volumeSlider.value) / 100;
    this.context = null;
    this.oscillator = null;
    this.gain = null;
    this.filter = null;
    this.panner = null;
    this.masterGain = null;
    this.compressor = null;
    this.musicBus = null;
    this.delay = null;
    this.delayFeedback = null;
    this.regionVoices = new Map();
    this.regionMixBuses = new Map();
    this.noiseBuffer = null;
    this.colorStates = new Map();
    this.activeColorRegions = new Set();
    this.lastTick = 0;
    this.lastRegion = null;
    this.lastSeekAccent = 0;
    this.lastPointerEventId = null;
    this.lastVoiceEvents = new Map();
    this.clockOrigin = 0;
    this.sampleBank = null;
    this.samplesReady = false;
  }
  setOutputLevel(value) {
    this.outputLevel = Math.max(0, Math.min(1, value));
    // A full slider now reaches 3× the previous master level. The compressor
    // below catches brief peaks from overlapping region and edge sounds.
    const gain = this.outputLevel * 3;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(gain, this.context.currentTime, .025);
    }
  }
  async toggle() {
    if (!this.context) this.setup();
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.samplesReady) {
      const previousStatus = $("#outputModeStatus").textContent;
      $("#outputModeStatus").textContent = "Loading local instruments…";
      const result = await this.sampleBank.load();
      this.samplesReady = result.loaded > 0;
      if (result.failed) console.warn(`${result.failed} local instrument samples could not be loaded.`);
      $("#outputModeStatus").textContent = previousStatus;
    }
    this.enabled = !this.enabled;
    soundToggle.classList.toggle("active", this.enabled);
    soundToggle.setAttribute("aria-pressed", String(this.enabled));
    this.gain.gain.setTargetAtTime(0, this.context.currentTime, .04);
    if (!this.enabled) this.stopScan();
    if (this.enabled && state.mode === "scan") {
      this.updateScan(state.scan.regions, state.scan.position, state.scan.seconds, state.scan.playing);
    }
    if (this.enabled && state.mode === "pointer" && state.activeRegion) {
      this.enter(state.activeRegion, state.pointer.nx, state.pointer.ny);
    }
    if (this.enabled) this.pulse(240, .07, .045);
  }
  async setEnabled(enabled) {
    if (this.enabled === enabled) return;
    await this.toggle();
  }
  setup() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    this.clockOrigin = this.context.currentTime;
    this.musicBus = this.context.createGain();
    this.musicBus.gain.value = 1;
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1000;
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.panner = this.context.createStereoPanner();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.outputLevel * 3;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .18;
    this.delay = this.context.createDelay(1.2);
    this.delay.delayTime.value = .285;
    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = .24;
    const delayWet = this.context.createGain();
    delayWet.gain.value = .22;
    const convolver = this.context.createConvolver();
    const reverbSeconds = 1.8;
    const impulse = this.context.createBuffer(2, this.context.sampleRate * reverbSeconds, this.context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.8);
      }
    }
    convolver.buffer = impulse;
    const reverbWet = this.context.createGain();
    reverbWet.gain.value = .13;
    this.oscillator = this.context.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = 120;
    this.oscillator.connect(this.filter).connect(this.gain).connect(this.panner).connect(this.musicBus);
    this.musicBus.connect(this.masterGain);
    this.musicBus.connect(this.delay).connect(delayWet).connect(this.masterGain);
    this.delay.connect(this.delayFeedback).connect(this.delay);
    this.musicBus.connect(convolver).connect(reverbWet).connect(this.masterGain);
    this.masterGain.connect(this.compressor).connect(this.context.destination);
    this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    this.sampleBank = new LocalSampleBank(this.context);
    this.oscillator.start();
  }
  beatSeconds() {
    return 60 / state.music.bpm;
  }
  resetMusicalClock() {
    if (this.context) this.clockOrigin = this.context.currentTime;
    this.lastVoiceEvents.clear();
    this.resetScanEvents();
  }
  quantizedDelay(divisionsPerBeat = 4) {
    if (!this.context) return 0;
    const step = this.beatSeconds() / divisionsPerBeat;
    const elapsed = Math.max(0, this.context.currentTime - this.clockOrigin);
    const next = Math.ceil((elapsed + .002) / step) * step;
    return Math.max(0, next - elapsed);
  }
  snapFrequency(frequency) {
    const scale = MUSIC_MODES[state.music.mode] || MUSIC_MODES.dorian;
    const root = NOTE_NAMES.indexOf(state.music.root);
    const midi = 69 + 12 * Math.log2(Math.max(1, frequency) / 440);
    let nearest = Math.round(midi);
    let distance = Infinity;
    for (let candidate = Math.floor(midi) - 7; candidate <= Math.ceil(midi) + 7; candidate++) {
      const relative = ((candidate - root) % 12 + 12) % 12;
      if (!scale.includes(relative)) continue;
      const candidateDistance = Math.abs(candidate - midi);
      if (candidateDistance < distance) {
        nearest = candidate;
        distance = candidateDistance;
      }
    }
    return 440 * Math.pow(2, (nearest - 69) / 12);
  }
  frequency(region, nx, ny) {
    const midi = regionMidiNote(region, nx, ny);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  enter(region, nx, ny) {
    if (!this.enabled || !region) return;
    this.lastPointerEventId = null;
    this.lastVoiceEvents.delete(region.id);
    this.lastRegion = region.id;
  }
  leave() {
    if (!this.context) return;
    this.gain.gain.setTargetAtTime(0, this.context.currentTime, .08);
    this.lastPointerEventId = null;
  }
  update(payload) {
    if (!this.enabled) return;
    const now = this.context.currentTime;
    const activeIds = new Set();
    for (const item of state.pointer.regions) {
      activeIds.add(item.region.id);
      const bus = this.ensureRegionMixBus(item.region);
      bus.gain.setTargetAtTime(Math.max(0, Math.min(1, item.intensity)), now, .025);
    }
    for (const [id, bus] of this.regionMixBuses) {
      if (!activeIds.has(id)) bus.gain.setTargetAtTime(0, now, .08);
    }
    this.playSharedEvents(payload.music?.activeVoices || [], payload.normalized.x, payload.speed);
    if (!payload.region) return;
    const region = state.activeRegion;
    if (payload.edgeProximity > .56 && performance.now() - this.lastTick > 110 - payload.edgeProximity * 55) {
      const frequency = this.frequency(region, payload.normalized.x, payload.normalized.y);
      const edgeType = region.instrument?.id === "percussion_texture" ? "square" : "triangle";
      this.pulse(
        frequency * 2,
        .022,
        .017,
        edgeType,
        0,
        payload.normalized.x * 1.6 - .8,
        0,
        this.ensureRegionMixBus(region),
      );
      this.lastTick = performance.now();
    }
  }
  playSharedEvents(events, nx, speed) {
    const activeRegionIds = new Set();
    for (const event of events) {
      const region = state.regions.find((candidate) => candidate.id === event.regionId);
      if (!region || !event.eventId) continue;
      activeRegionIds.add(region.id);
      if (this.lastVoiceEvents.get(region.id) === event.eventId) continue;
      this.lastVoiceEvents.set(region.id, event.eventId);
      if (event.notes?.length) this.playPatternEvent(region, event, nx, speed);
    }
    for (const regionId of this.lastVoiceEvents.keys()) {
      if (!activeRegionIds.has(regionId)) this.lastVoiceEvents.delete(regionId);
    }
  }
  playPatternEvent(region, event, nx, speed) {
    const role = region.instrument?.id || "lead_synth";
    const destination = this.ensureRegionMixBus(region);
    const pan = Math.max(-.82, Math.min(.82, nx * 1.64 - .82));
    const duration = Math.max(.045, event.durationBeats * this.beatSeconds());
    const velocity = Math.max(.35, Math.min(1, event.velocity / 127));
    const brightness = Math.max(0, Math.min(1, event.timbre?.brightness ?? .5));
    const saturation = Math.max(0, Math.min(1, event.timbre?.saturation ?? .35));
    const texture = Math.max(0, Math.min(1, event.timbre?.texture ?? 0));
    const visualCutoff = 650 + brightness * 4300 + saturation * 800 + texture * 1000;
    const frequencies = event.notes.map((note) => 440 * Math.pow(2, (note - 69) / 12));
    if (role === "drums") {
      for (const note of event.notes) {
        if (!this.playSample("drums", note, duration, .34 * velocity, 0, pan, 10000, destination)) {
          if (note === 36) this.pulse(54, duration * 1.5, .065 * velocity, "sine", 0, pan, 330, destination);
          else if (note === 38) this.noiseBurst(duration * 1.3, .035 * velocity, 1900, 0, pan, event.patternStep + 3, destination);
          else this.noiseBurst(duration * .62, .018 * velocity, 6900, 0, pan, event.patternStep + 8, destination);
        }
      }
      return;
    }
    if (role === "percussion_texture") {
      const cutoff = visualCutoff + Math.min(1, speed) * 2400;
      for (const note of event.notes) {
        if (!this.playSample("drums", note, duration, (.18 + Math.min(1, speed) * .2) * velocity, 0, pan, cutoff, destination)) {
          this.noiseBurst(duration, (.018 + Math.min(1, speed) * .025) * velocity, cutoff, 0, pan, event.patternStep + region.index, destination);
        }
      }
      return;
    }
    const patches = {
      lead_synth: { wave: "sawtooth", companion: "triangle", level: .034, cutoff: 3600, attack: .018, release: .13 },
      counter_synth: { wave: "triangle", companion: "sine", level: .03, cutoff: 2800, attack: .035, release: .2 },
      bass: { wave: "square", companion: "sine", level: .046, cutoff: 820, attack: .018, release: .16 },
      guitar: { wave: "triangle", companion: "sawtooth", level: .035, cutoff: 3900, attack: .006, release: .24 },
      pad: { wave: "sine", companion: "triangle", level: .024, cutoff: 2100, attack: .28, release: .55 },
      strings: { wave: "sawtooth", companion: "triangle", level: .019, cutoff: 2450, attack: .2, release: .48 },
      keys_mallet: { wave: "sine", companion: "triangle", level: .038, cutoff: 5600, attack: .004, release: .2 },
    };
    const patch = patches[role] || patches.lead_synth;
    const chordScale = frequencies.length > 1 ? .72 / Math.sqrt(frequencies.length) : 1;
    frequencies.forEach((frequency, index) => {
      const midiNote = event.notes[index];
      const sampleLevel = {
        bass: .34,
        guitar: .32,
        strings: .25,
        keys_mallet: .3,
      }[role];
      if (sampleLevel && this.playSample(
        role,
        midiNote,
        duration,
        sampleLevel * velocity * chordScale,
        0,
        Math.max(-.9, Math.min(.9, pan + (index - (frequencies.length - 1) / 2) * .09)),
        event.timbre ? visualCutoff : patch.cutoff + (1 - state.pointer.ny) * 1200,
        destination,
      )) return;
      this.envelopeTone(
        frequency,
        duration,
        patch.level * velocity * chordScale,
        patch.wave,
        patch.companion,
        0,
        Math.max(-.9, Math.min(.9, pan + (index - (frequencies.length - 1) / 2) * .09)),
        event.timbre ? visualCutoff : patch.cutoff + (1 - state.pointer.ny) * 1200,
        patch.attack,
        patch.release,
        destination,
      );
    });
  }
  playSample(instrument, note, duration, volume, delay = 0, pan = 0, cutoff = 10000, destination = null) {
    if (!this.enabled || !this.context || !this.samplesReady) return false;
    const sample = instrument === "drums"
      ? this.sampleBank.exact(instrument, note)
      : this.sampleBank.nearest(instrument, note);
    if (!sample) return false;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const start = this.context.currentTime + delay;
    const playbackRate = instrument === "drums" ? 1 : Math.pow(2, (note - sample.note) / 12);
    const availableDuration = sample.buffer.duration / playbackRate;
    const naturalOneShot = instrument === "drums" || instrument === "guitar" || instrument === "keys_mallet";
    const audibleDuration = Math.max(.045, Math.min(availableDuration, naturalOneShot
      ? Math.max(duration, Math.min(availableDuration, 1.4))
      : duration));
    const release = Math.min(.16, audibleDuration * .28);
    source.buffer = sample.buffer;
    source.playbackRate.value = playbackRate;
    filter.type = "lowpass";
    filter.frequency.value = Math.max(180, Math.min(12000, cutoff));
    panner.pan.value = pan;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .008);
    gain.gain.setValueAtTime(Math.max(.0002, volume * .9), Math.max(start + .008, start + audibleDuration - release));
    gain.gain.exponentialRampToValueAtTime(.0001, start + audibleDuration);
    source.connect(filter).connect(gain).connect(panner).connect(destination || this.musicBus);
    source.start(start);
    source.stop(start + audibleDuration + .025);
    return true;
  }
  voiceSettings(region) {
    const settings = {
      lead_synth: { wave: "sawtooth", waveB: "triangle", octave: 1, ratio: 2, level: .019, filter: 2500, attack: .035, sustain: true, companion: .22, q: 2.2, harmonics: [.0028, .0018, .001, .0006] },
      counter_synth: { wave: "triangle", waveB: "sine", octave: 1, ratio: 1.5, level: .016, filter: 2100, attack: .055, sustain: true, companion: .2, q: 1.8, harmonics: [.0022, .0014, .0008, .0004] },
      drums: { wave: "sine", waveB: "square", octave: .5, ratio: 2, level: .006, filter: 900, attack: .012, sustain: false, companion: .08, q: 1.1, harmonics: [0, 0, 0, 0] },
      bass: { wave: "square", waveB: "sine", octave: .5, ratio: 2, level: .026, filter: 780, attack: .035, sustain: true, companion: .38, q: 1.5, harmonics: [.0015, .0007, 0, 0] },
      guitar: { wave: "triangle", waveB: "sawtooth", octave: 1, ratio: 2, level: .011, filter: 2900, attack: .018, sustain: false, companion: .16, q: 3.4, harmonics: [.0018, .0013, .0007, .0003] },
      pad: { wave: "sine", waveB: "triangle", octave: .5, ratio: 1.5, level: .021, filter: 1500, attack: .28, sustain: true, companion: .3, q: 1.15, harmonics: [.0025, .0016, .001, .0007] },
      strings: { wave: "sawtooth", waveB: "triangle", octave: 1, ratio: 2, level: .015, filter: 1950, attack: .16, sustain: true, companion: .24, q: 2.7, harmonics: [.0021, .0015, .001, .0005] },
      keys_mallet: { wave: "sine", waveB: "triangle", octave: 1, ratio: 2, level: .009, filter: 3600, attack: .012, sustain: false, companion: .12, q: 4.1, harmonics: [.0015, .001, .0007, .0003] },
      percussion_texture: { wave: "square", waveB: "sawtooth", octave: 1, ratio: 3, level: .005, filter: 3200, attack: .01, sustain: false, companion: .08, q: 5.2, harmonics: [0, 0, 0, 0] },
    };
    return settings[region.instrument?.id] || settings.lead_synth;
  }
  instrumentAccent(region, frequency, nx) {
    const role = region.instrument?.id || "lead_synth";
    const pan = nx * 1.6 - .8;
    const beat = this.beatSeconds();
    const delay = this.quantizedDelay(4);
    if (role === "drums") {
      this.pulse(Math.max(42, frequency * .5), beat * .16, .055, "sine", delay, pan, 420);
      this.noiseBurst(beat * .11, .025, 2200, delay + beat * .125, pan, region.index);
    } else if (role === "bass") {
      this.pulse(frequency, beat * .32, .038, "square", delay, pan, 820);
    } else if (role === "guitar") {
      this.pulse(frequency, beat * .34, .032, "triangle", delay, pan, 3200);
      this.pulse(frequency * 1.5, beat * .22, .014, "sine", delay + beat * .06, pan, 4200);
    } else if (role === "keys_mallet") {
      this.pulse(frequency, beat * .28, .034, "sine", delay, pan, 5200);
      this.pulse(frequency * 2, beat * .16, .015, "sine", delay, pan, 6200);
    } else if (role === "percussion_texture") {
      this.noiseBurst(beat * .14, .03, 3600, delay, pan, region.index);
      this.pulse(frequency * 2, beat * .09, .016, "square", delay, pan, 4600);
    } else {
      const type = role === "lead_synth" || role === "strings" ? "sawtooth" : "triangle";
      this.pulse(frequency * 2, beat * .14, .02, type, delay, pan, 3800);
    }
  }
  ensureRegionVoice(region) {
    if (this.regionVoices.has(region.id)) return this.regionVoices.get(region.id);
    const settings = this.voiceSettings(region);
    const oscillatorA = this.context.createOscillator();
    const oscillatorB = this.context.createOscillator();
    const companionGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillatorA.type = settings.wave;
    oscillatorB.type = settings.waveB;
    oscillatorB.detune.value = region.index % 2 ? 7 : -7;
    companionGain.gain.value = settings.companion;
    filter.type = "lowpass";
    filter.Q.value = settings.q;
    gain.gain.value = 0;
    oscillatorA.connect(filter);
    oscillatorB.connect(companionGain).connect(filter);
    const harmonicOscillators = [];
    const harmonicGains = [];
    for (let harmonic = 2; harmonic <= 5; harmonic++) {
      const oscillator = this.context.createOscillator();
      const harmonicGain = this.context.createGain();
      oscillator.type = "sine";
      harmonicGain.gain.value = 0;
      oscillator.connect(harmonicGain).connect(filter);
      oscillator.start();
      harmonicOscillators.push(oscillator);
      harmonicGains.push(harmonicGain);
    }
    filter.connect(gain).connect(panner).connect(this.musicBus);
    oscillatorA.start();
    oscillatorB.start();
    const voice = { oscillatorA, oscillatorB, harmonicOscillators, harmonicGains, filter, gain, panner, settings };
    this.regionVoices.set(region.id, voice);
    return voice;
  }
  ensureRegionMixBus(region) {
    if (this.regionMixBuses.has(region.id)) return this.regionMixBuses.get(region.id);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.connect(this.musicBus);
    this.regionMixBuses.set(region.id, gain);
    return gain;
  }
  updateScan(regions, nx, seconds, playing = true, events = []) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    this.gain.gain.setTargetAtTime(0, now, .05);
    const activeIds = new Set();
    for (const item of regions) {
      activeIds.add(item.region.id);
      const bus = this.ensureRegionMixBus(item.region);
      bus.gain.setTargetAtTime(Math.max(0, Math.min(1, item.intensity)), now, .035);
    }
    for (const [id, bus] of this.regionMixBuses) {
      if (!activeIds.has(id)) bus.gain.setTargetAtTime(0, now, .1);
    }
    // The browser renderer receives the exact activeVoices event list placed
    // in the WebSocket frame. MIDI Out consumes that same list server-side,
    // so pitches, chords, note lengths and rhythmic steps stay identical.
    this.playSharedEvents(events, nx, state.scan.playing ? 1 / Math.max(1, state.scan.duration) : 0);
    for (const [id, voice] of this.regionVoices) {
      if (!activeIds.has(id)) voice.gain.gain.setTargetAtTime(0, now, .2);
    }
    if (!playing && regions[0] && performance.now() - this.lastSeekAccent > 90) {
      this.lastSeekAccent = performance.now();
    }
  }
  maybeColorEvent(item, base, seconds, now) {
    const descriptor = colorDescriptor(item);
    const brightnessBand = Math.min(3, Math.floor(item.brightness * 4));
    const saturationBand = item.saturation < .28 ? 0 : (item.saturation < .6 ? 1 : 2);
    const signature = `${descriptor.family}:${brightnessBand}:${saturationBand}`;
    const previous = this.colorStates.get(item.region.id);
    const entering = !this.activeColorRegions.has(item.region.id);
    const changed = !previous || previous.signature !== signature;
    if ((entering || changed) && now >= (previous?.nextAt || 0)) {
      if (entering) {
        const panPosition = item.region.index / Math.max(1, state.regions.length - 1);
        this.instrumentAccent(item.region, base, panPosition);
      }
      this.colorEvent(item, base, seconds, descriptor);
      this.colorStates.set(item.region.id, {
        signature,
        nextAt: now + this.beatSeconds() * (item.saturation > .6 ? .5 : 1),
      });
    }
  }
  colorEvent(item, base, seconds, descriptor) {
    const { region, intensity, brightness, saturation, texture } = item;
    const pan = Math.max(-.8, Math.min(.8, (region.index / Math.max(1, state.regions.length - 1)) * 1.6 - .8));
    const register = brightness < .28 ? .5 : (brightness > .72 ? 2 : 1);
    const root = Math.max(38, Math.min(1800, base * register));
    const level = (.009 + intensity * .015) * (.78 + saturation * .38);
    const cutoff = 650 + brightness * 4800 + saturation * 900;
    const beat = this.beatSeconds();
    const gridDelay = this.quantizedDelay(4);
    const stagger = (region.index % 4) * beat / 32;
    const note = (ratio, durationBeats, volume, type = "sine", delayBeats = 0, filter = cutoff) => {
      this.pulse(this.snapFrequency(root * ratio), beat * durationBeats, level * volume, type, gridDelay + stagger + beat * delayBeats, pan, filter);
    };
    switch (descriptor.family) {
      case "red":
        note(.5, .42, 1.25, saturation > .55 ? "sawtooth" : "triangle", 0, cutoff * .55);
        note(1, .16, .7, "triangle", .25);
        break;
      case "orange":
        note(1, .22, 1, "triangle");
        note(1.25, .18, .75, "triangle", .25);
        note(1.5, .16, .55, "sine", .5);
        break;
      case "yellow":
        note(2, .14, .8, "square", 0, cutoff * 1.25);
        note(3, .3, .62, "sine", .25, cutoff * 1.45);
        note(4, .2, .42, "sine", .5, cutoff * 1.5);
        break;
      case "green":
        note(1, .32, 1, "triangle");
        note(1.5, .24, .68, "triangle", .5);
        break;
      case "cyan":
        note(1.5, .42, .72, "sine");
        note(2, .5, .62, "sine", .25);
        note(2.5, .36, .42, "sine", .75);
        break;
      case "blue":
        note(.5, .7, 1.05, "sine", 0, cutoff * .65);
        note(1.5, .48, .58, "sine", .75);
        break;
      case "violet":
        note(1, .3, .85, "triangle");
        note(1.5, .38, .62, "triangle", .25);
        note(2.25, .28, .45, "sine", .75);
        break;
      case "magenta":
        note(1, .22, .82, "sawtooth", 0, cutoff * .8);
        note(2, .16, .5, "triangle", .5);
        this.noiseBurst(beat * (.08 + texture * .1), level * .72, cutoff, gridDelay + stagger + beat * .25, pan, seconds + region.index);
        break;
      case "white":
        note(2, .42, .62, "sine");
        note(3, .55, .46, "sine", .25, cutoff * 1.35);
        note(5, .34, .28, "sine", .75, cutoff * 1.5);
        break;
      case "dark":
        note(.5, .8, 1.25, "sine", 0, cutoff * .45);
        note(1, .28, .48, "triangle", .75, cutoff * .65);
        break;
      default:
        note(1, .3, .7, "triangle", 0, cutoff * .75);
        this.noiseBurst(beat * (.055 + texture * .08), level * .45, cutoff * .7, gridDelay + stagger + beat * .25, pan, seconds + region.index);
    }
  }
  noiseBurst(duration, volume, cutoff, delay = 0, pan = 0, offsetSeed = 0, destination = null) {
    if (!this.enabled || !this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = Math.max(80, Math.min(10000, cutoff));
    filter.Q.value = 3.5;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(gain).connect(panner).connect(destination || this.musicBus);
    const offset = Math.abs(Math.sin(offsetSeed * 12.9898)) * 1.5;
    source.start(now, offset, duration + .02);
  }
  stopScan() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.regionVoices.values()) voice.gain.gain.setTargetAtTime(0, now, .12);
    for (const bus of this.regionMixBuses.values()) bus.gain.setTargetAtTime(0, now, .12);
  }
  resetScanEvents() {
    this.colorStates.clear();
    this.activeColorRegions.clear();
  }
  clearRegionVoices() {
    for (const voice of this.regionVoices.values()) {
      for (const oscillator of [voice.oscillatorA, voice.oscillatorB, ...voice.harmonicOscillators]) {
        try { oscillator.stop(); } catch (_) { /* The oscillator may already be stopped. */ }
        oscillator.disconnect();
      }
    }
    this.regionVoices.clear();
    for (const bus of this.regionMixBuses.values()) bus.disconnect();
    this.regionMixBuses.clear();
    this.lastPointerEventId = null;
    this.lastVoiceEvents.clear();
    this.resetScanEvents();
  }
  envelopeTone(frequency, duration, volume, type = "sine", companionType = null, delay = 0, pan = 0, cutoff = 0, attack = .01, release = .14, destination = null) {
    if (!this.enabled || !this.context) return;
    const oscillator = this.context.createOscillator();
    const companion = companionType ? this.context.createOscillator() : null;
    const companionGain = companion ? this.context.createGain() : null;
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();
    const start = this.context.currentTime + delay;
    const end = start + Math.max(duration, attack + release + .02);
    oscillator.type = type;
    oscillator.frequency.value = Math.max(28, Math.min(7200, frequency));
    if (companion) {
      companion.type = companionType;
      companion.frequency.value = oscillator.frequency.value;
      companion.detune.value = 7;
      companionGain.gain.value = .22;
    }
    filter.type = "lowpass";
    filter.frequency.value = Math.max(120, Math.min(12000, cutoff || 4200));
    filter.Q.value = 1.5;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + Math.max(.004, attack));
    gain.gain.setValueAtTime(Math.max(.0002, volume * .82), Math.max(start + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(filter);
    if (companion) companion.connect(companionGain).connect(filter);
    filter.connect(gain).connect(panner).connect(destination || this.musicBus);
    oscillator.start(start);
    oscillator.stop(end + .03);
    if (companion) {
      companion.start(start);
      companion.stop(end + .03);
    }
  }
  pulse(frequency, duration, volume, type = "sine", delay = 0, pan = 0, cutoff = 0, destination = null) {
    if (!this.enabled || !this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = cutoff ? this.context.createBiquadFilter() : null;
    const start = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = Math.max(28, Math.min(7200, frequency));
    panner.pan.value = pan;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    if (filter) {
      filter.type = "lowpass";
      filter.frequency.value = Math.max(120, Math.min(12000, cutoff));
      oscillator.connect(filter).connect(gain);
    } else {
      oscillator.connect(gain);
    }
    gain.connect(panner).connect(destination || this.musicBus);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }
}
const soundEngine = new SoundEngine();

function formatTime(seconds) {
  const value = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function parseDuration(value) {
  const text = String(value).trim();
  let seconds;
  if (/^\d+:\d{1,2}$/.test(text)) {
    const [minutes, remainder] = text.split(":").map(Number);
    seconds = minutes * 60 + remainder;
  } else if (/^\d+(?:\.\d+)?$/.test(text)) {
    seconds = Number(text);
  }
  if (!Number.isFinite(seconds)) return null;
  return Math.max(5, Math.min(MAX_MUSIC_DURATION, Math.round(seconds)));
}

function setScanDuration(value, announce = true) {
  const duration = parseDuration(value);
  if (duration === null) {
    scanDuration.value = formatTime(state.scan.duration);
    showToast("Use MM:SS, for example 00:30, 01:00, or 10:00");
    return;
  }
  const progress = state.scan.duration ? state.scan.seconds / state.scan.duration : 0;
  state.scan.duration = duration;
  state.scan.seconds = Math.min(duration, progress * duration);
  scanDuration.value = formatTime(duration);
  scanTimeline.max = String(duration);
  if (state.mode === "scan") $("#modeInstruction").textContent = `Scan the complete image over ${formatTime(duration)}`;
  if (state.scan.playing) {
    state.scan.startedAt = performance.now();
    state.scan.startedFrom = state.scan.seconds;
  }
  setScanPosition(state.scan.seconds, true);
  if (announce) statusText.textContent = `Scan duration set to ${formatTime(duration)}.`;
}

function updateScanControls() {
  scanPlay.disabled = !state.regions.length || state.analyzing;
  scanReset.disabled = !state.regions.length || state.analyzing;
  scanPlay.classList.toggle("playing", state.scan.playing);
  scanPlay.setAttribute("aria-pressed", String(state.scan.playing));
  scanPlay.querySelector("span").textContent = state.scan.playing
    ? "Pause"
    : (state.scan.seconds > 0 ? "Resume" : "Start");
  scanReadout.hidden = state.mode !== "scan";
  canvasShell.classList.toggle("scanning", state.mode === "scan");
}

function setScanPosition(seconds, forcePublish = false) {
  state.scan.seconds = Math.max(0, Math.min(state.scan.duration, Number(seconds) || 0));
  state.scan.position = state.scan.seconds / state.scan.duration;
  if (state.scan.playing) {
    state.scan.regions = crossfadedScanRegionsAt(state.scan.position);
  } else if (state.scan.manualRegionId) {
    const manualRegion = state.regions.find((region) => region.id === state.scan.manualRegionId);
    state.scan.regions = manualRegion ? [manualScanItem(manualRegion)] : [];
  } else {
    state.scan.regions = [];
  }
  const primary = state.scan.regions[0]?.region || null;
  if (primary) activateRegion(primary, false, false);
  else clearActiveRegion(false);
  scanTimeline.value = String(state.scan.seconds);
  const fill = `${state.scan.position * 100}%`;
  scanTimeline.style.setProperty("--scan-fill", fill);
  const current = formatTime(state.scan.seconds);
  scanTime.textContent = `${current} / ${formatTime(state.scan.duration)}`;
  $("#canvasScanTime").textContent = current;
  drawCanvas();
  publishOutput(forcePublish);
}

function scanFrame(now) {
  if (!state.scan.playing) return;
  if (now - state.scan.lastFrameAt < 32) {
    state.scan.animationFrame = requestAnimationFrame(scanFrame);
    return;
  }
  state.scan.lastFrameAt = now;
  const elapsed = (now - state.scan.startedAt) / 1000;
  const seconds = state.scan.startedFrom + elapsed;
  if (seconds >= state.scan.duration) {
    setScanPosition(state.scan.duration, true);
    pauseScan();
    statusText.textContent = `The ${formatTime(state.scan.duration)} scan is complete.`;
    return;
  }
  setScanPosition(seconds);
  state.scan.animationFrame = requestAnimationFrame(scanFrame);
}

async function playScan() {
  if (!state.regions.length || state.analyzing) return;
  if (state.mode !== "scan") setInteractionMode("scan");
  await ensurePerformanceOutput();
  if (state.scan.seconds >= state.scan.duration) {
    state.scan.seconds = 0;
    soundEngine.resetScanEvents();
  }
  state.scan.engaged = true;
  state.scan.manualRegionId = null;
  resetScanCrossfade();
  state.scan.playing = true;
  state.scan.startedAt = performance.now();
  state.scan.startedFrom = state.scan.seconds;
  state.scan.lastFrameAt = 0;
  updateScanControls();
  setScanPosition(state.scan.seconds, true);
  statusText.textContent = `Scanning from left to right over ${formatTime(state.scan.duration)}.`;
  cancelAnimationFrame(state.scan.animationFrame);
  state.scan.animationFrame = requestAnimationFrame(scanFrame);
}

function pauseScan() {
  state.scan.playing = false;
  state.scan.manualRegionId = null;
  state.scan.regions = [];
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  resetScanCrossfade();
  clearActiveRegion(false);
  updateScanControls();
  publishOutput(true);
}

function resetScan(showMessage = true) {
  state.scan.playing = false;
  state.scan.engaged = state.mode === "scan";
  state.scan.position = 0;
  state.scan.seconds = 0;
  state.scan.regions = [];
  state.scan.manualRegionId = null;
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  soundEngine.resetScanEvents();
  resetScanCrossfade();
  scanTimeline.value = "0";
  scanTimeline.style.setProperty("--scan-fill", "0%");
  scanTime.textContent = `00:00 / ${formatTime(state.scan.duration)}`;
  $("#canvasScanTime").textContent = "00:00";
  updateScanControls();
  clearActiveRegion();
  publishOutput(true);
  if (showMessage && state.regions.length) statusText.textContent = "The scan is reset at the left edge.";
}

function setInteractionMode(mode) {
  if (!['pointer', 'scan'].includes(mode)) return;
  if (mode === "scan" && (state.eye.active || state.eye.starting)) stopEyeTracking(false);
  if (mode === "pointer") {
    pauseScan();
    state.scan.engaged = false;
    state.mode = "pointer";
    resetPointerCrossfade();
    clearActiveRegion();
    if (state.outputMode === "midi" || soundEngine.enabled) startPointerMusicTimeline();
    statusText.textContent = state.pointer.source === "gaze"
      ? "Eye tracking is active. Look across the artwork."
      : "Pointer exploration is active. Move across the artwork.";
  } else {
    pausePointerMusicTimeline();
    state.mode = "scan";
    state.scan.engaged = true;
    state.scan.manualRegionId = null;
    state.pointer.source = "mouse";
    clearActiveRegion();
    resetPointerCrossfade();
    setScanPosition(state.scan.seconds, true);
    statusText.textContent = `Set a duration, then start the ${formatTime(state.scan.duration)} scan.`;
  }
  pointerMode.classList.toggle("active", mode === "pointer");
  scanMode.classList.toggle("active", mode === "scan");
  pointerMode.setAttribute("aria-pressed", String(mode === "pointer"));
  scanMode.setAttribute("aria-pressed", String(mode === "scan"));
  performanceScreen.classList.toggle("pointer-mode", mode === "pointer");
  performanceScreen.classList.toggle("scan-mode", mode === "scan");
  pointerControls.hidden = mode !== "pointer";
  scanControls.hidden = mode !== "scan";
  $("#modeEyebrow").textContent = mode === "pointer" ? "POINTER / GAZE" : "LEFT-TO-RIGHT SCAN";
  $("#modeInstruction").textContent = mode === "pointer"
    ? "Move across the image with a mouse or your eyes"
    : `Scan the complete image over ${formatTime(state.scan.duration)}`;
  $("#signalLabel").textContent = mode === "pointer"
    ? `ACTIVE REGION · ${state.pointer.source.toUpperCase()}`
    : "ACTIVE REGION · SCAN";
  interactionModeSwitch.querySelector("span").textContent = mode === "pointer" ? "Left-to-Right" : "Mouse / Eye";
  interactionModeSwitch.title = mode === "pointer" ? "Switch to Left-to-Right Scan" : "Switch to Mouse / Eye Tracking";
  interactionModeSwitch.setAttribute("aria-label", interactionModeSwitch.title);
  updateScanControls();
  drawCanvas();
  publishOutput(true);
}

scanPlay.addEventListener("click", () => state.scan.playing ? pauseScan() : playScan());
scanReset.addEventListener("click", () => resetScan());
scanTimeline.addEventListener("input", async () => {
  if (!state.regions.length) return;
  await ensurePerformanceOutput();
  const seconds = Number(scanTimeline.value);
  if (state.scan.playing) {
    state.scan.startedAt = performance.now();
    state.scan.startedFrom = seconds;
  }
  updateScanControls();
  setScanPosition(seconds, true);
  if (!state.scan.playing) statusText.textContent = `Previewing the artwork at ${formatTime(seconds)}.`;
});
scanDuration.addEventListener("change", () => setScanDuration(scanDuration.value));
scanDuration.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    setScanDuration(scanDuration.value);
    scanDuration.blur();
  }
});
pointerMode.addEventListener("click", (event) => {
  event.stopPropagation();
  setInteractionMode("pointer");
  setSetupVisible(false);
  showToast("Mouse / Eye Tracking mode ready");
});
scanMode.addEventListener("click", (event) => {
  event.stopPropagation();
  setInteractionMode("scan");
  setSetupVisible(false);
  showToast("Left-to-Right mode ready");
});
interactionModeSwitch.addEventListener("click", () => {
  const nextMode = state.mode === "pointer" ? "scan" : "pointer";
  setInteractionMode(nextMode);
  showToast(nextMode === "pointer" ? "Mouse / Eye Tracking mode ready" : "Left-to-Right mode ready");
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = (event.clientX - rect.left) / rect.width;
  const ny = (event.clientY - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx, ny };
}

function updateExplorePosition(nx, ny, source) {
  if (!state.regions.length || state.analyzing || state.mode !== "pointer") return;
  const now = performance.now();
  const delta = Math.max(16, now - state.pointer.lastTime);
  const distance = Math.hypot(nx - state.pointer.nx, ny - state.pointer.ny);
  const sensitivity = source === "gaze" ? 430 : 950;
  state.pointer.speed = Math.min(source === "gaze" ? .72 : 1, distance / delta * sensitivity);
  state.pointer.nx = nx;
  state.pointer.ny = ny;
  state.pointer.lastTime = now;
  state.pointer.source = source;
  $("#signalLabel").textContent = `ACTIVE REGION · ${source.toUpperCase()}`;
  const region = source === "gaze" ? regionAtGaze(nx, ny) : regionAt(nx, ny);
  if (source === "gaze") updateGazeRegion(region, now);
  else if (region?.id !== state.activeRegion?.id) region ? activateRegion(region) : clearActiveRegion();
  advancePointerCrossfade();
  publishOutput();
}

function resetEyeRegionStability() {
  state.eye.candidateRegionId = null;
  state.eye.candidateSince = 0;
  state.eye.outsideSince = 0;
}

function updateGazeRegion(region, now = performance.now()) {
  if (region?.id === state.activeRegion?.id) {
    resetEyeRegionStability();
    return;
  }
  if (!region) {
    state.eye.candidateRegionId = null;
    state.eye.candidateSince = 0;
    if (!state.activeRegion) return;
    if (!state.eye.outsideSince) state.eye.outsideSince = now;
    if (now - state.eye.outsideSince >= EYE_REGION_RELEASE_MS) {
      clearActiveRegion();
      state.eye.outsideSince = 0;
    }
    return;
  }
  state.eye.outsideSince = 0;
  if (state.eye.candidateRegionId !== region.id) {
    state.eye.candidateRegionId = region.id;
    state.eye.candidateSince = now;
    return;
  }
  if (now - state.eye.candidateSince >= EYE_REGION_DWELL_MS) {
    activateRegion(region);
    resetEyeRegionStability();
  }
}

canvas.addEventListener("pointermove", (event) => {
  if (state.eye.active || state.mode !== "pointer") return;
  const position = pointerPosition(event);
  if (!position) return;
  updateExplorePosition(position.nx, position.ny, "mouse");
});
canvas.addEventListener("pointerleave", () => {
  if (state.mode !== "pointer" || state.eye.active) return;
  clearActiveRegion();
  publishOutput(true);
});
canvas.addEventListener("pointerdown", async (event) => {
  if (state.eye.active) {
    event.stopPropagation();
    return;
  }
  await ensurePerformanceOutput();
  if (state.mode === "scan") {
    const position = pointerPosition(event);
    if (!position) return;
    const seconds = position.nx * state.scan.duration;
    if (state.scan.playing) {
      state.scan.startedAt = performance.now();
      state.scan.startedFrom = seconds;
    }
    setScanPosition(seconds, true);
  }
});

function updateEyeButtons() {
  const active = state.eye.active || state.eye.starting;
  eyeToggle.classList.toggle("active", active);
  eyeToggle.setAttribute("aria-pressed", String(active));
  mouseSource.classList.toggle("active", !active);
  mouseSource.setAttribute("aria-pressed", String(!active));
  eyeCalibrate.disabled = !state.eye.ready || !state.eye.active;
  eyeVideo.hidden = !active;
}

function createEyeTrackerWithoutGlobalClickLearning(webcamClient) {
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function addEventListenerWithoutEyeClickPollution(type, listener, options) {
    if (type === "click") return;
    return originalAddEventListener.call(window, type, listener, options);
  };
  try {
    return new window.WebEyeTrackProxy(webcamClient);
  } finally {
    window.addEventListener = originalAddEventListener;
  }
}

function gazeToArtwork(result) {
  if (!state.eye.active || state.mode !== "pointer" || result.gazeState === "closed") return;
  const rawX = result.normPog[0] + .5;
  const rawY = result.normPog[1] + .5;
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
  recordCalibrationSample(rawX, rawY);
  if (!calibrationOverlay.hidden) {
    gazeCursor.hidden = true;
    return;
  }
  state.eye.rawHistory.push([rawX, rawY]);
  if (state.eye.rawHistory.length > 5) state.eye.rawHistory.shift();
  const filteredRawX = median(state.eye.rawHistory.map((point) => point[0]));
  const filteredRawY = median(state.eye.rawHistory.map((point) => point[1]));
  const calibrated = applyEyeCalibration(filteredRawX, filteredRawY);
  const targetX = calibrated.x * window.innerWidth;
  const targetY = calibrated.y * window.innerHeight;
  const normalizedDistance = state.eye.smoothX === null ? 1 : Math.hypot(
    (targetX - state.eye.smoothX) / Math.max(1, window.innerWidth),
    (targetY - state.eye.smoothY) / Math.max(1, window.innerHeight),
  );
  const smoothing = state.eye.smoothX === null ? 1 : Math.max(.12, Math.min(.52, .12 + normalizedDistance * 3.2));
  state.eye.smoothX = state.eye.smoothX === null ? targetX : state.eye.smoothX + (targetX - state.eye.smoothX) * smoothing;
  state.eye.smoothY = state.eye.smoothY === null ? targetY : state.eye.smoothY + (targetY - state.eye.smoothY) * smoothing;
  state.eye.lastResultAt = performance.now();
  const shellRect = canvasShell.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const shellX = state.eye.smoothX - shellRect.left;
  const shellY = state.eye.smoothY - shellRect.top;
  const insideShell = shellX >= 0 && shellX <= shellRect.width && shellY >= 0 && shellY <= shellRect.height;
  gazeCursor.hidden = !insideShell;
  if (insideShell) {
    gazeCursor.style.left = `${shellX}px`;
    gazeCursor.style.top = `${shellY}px`;
  }
  const nx = (state.eye.smoothX - canvasRect.left) / canvasRect.width;
  const ny = (state.eye.smoothY - canvasRect.top) / canvasRect.height;
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) updateExplorePosition(nx, ny, "gaze");
  else if (state.activeRegion) {
    updateGazeRegion(null, performance.now());
    publishOutput(true);
  }
}

async function startEyeTracking() {
  if (state.eye.active || state.eye.starting) return;
  if (!window.WebcamClient || !window.WebEyeTrackProxy) {
    showToast("The local eye-tracking model could not be loaded");
    return;
  }
  if (state.mode !== "pointer") setInteractionMode("pointer");
  await ensurePerformanceOutput();
  const sessionId = ++state.eye.sessionId;
  state.eye.starting = true;
  state.eye.active = true;
  state.eye.ready = false;
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  state.eye.rawHistory = [];
  resetEyeRegionStability();
  state.pointer.source = "gaze";
  eyeStatus.textContent = "Loading WebEyeTrack · allow camera access";
  $("#signalLabel").textContent = "ACTIVE REGION · GAZE";
  updateEyeButtons();
  try {
    const webcamClient = new window.WebcamClient("eyeVideo");
    const tracker = createEyeTrackerWithoutGlobalClickLearning(webcamClient);
    state.eye.webcamClient = webcamClient;
    state.eye.tracker = tracker;
    tracker.onGazeResults = (result) => {
      if (sessionId !== state.eye.sessionId || !state.eye.active) return;
      if (!state.eye.ready) {
        state.eye.ready = true;
        state.eye.starting = false;
        clearTimeout(state.eye.startupTimer);
        eyeStatus.textContent = state.eye.calibrated ? "WebEyeTrack · calibrated" : "WebEyeTrack ready · calibration recommended";
        updateEyeButtons();
        showToast("Eye tracking is ready");
      }
      gazeToArtwork(result);
    };
    statusText.textContent = "Allow camera access, then keep your face centred in the preview.";
    window.setTimeout(() => {
      if (sessionId === state.eye.sessionId && state.eye.starting) eyeStatus.textContent = "Starting camera and local model…";
    }, 1200);
    state.eye.startupTimer = window.setTimeout(() => {
      if (sessionId !== state.eye.sessionId || state.eye.ready || !state.eye.active) return;
      eyeStatus.textContent = "No camera feed · allow access or try Chrome / Safari";
      statusText.textContent = "The eye model loaded, but no camera feed was found. Allow camera access or open this address in Chrome or Safari.";
    }, 6500);
  } catch (error) {
    stopEyeTracking(false);
    eyeStatus.textContent = "Camera unavailable";
    showToast(error.message || "Could not start eye tracking");
  }
}

function stopEyeTracking(showMessage = true) {
  state.eye.sessionId++;
  state.eye.webcamClient?.stopWebcam();
  state.eye.tracker?.worker?.terminate?.();
  state.eye.webcamClient = null;
  state.eye.tracker = null;
  state.eye.active = false;
  state.eye.starting = false;
  state.eye.ready = false;
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  state.eye.rawHistory = [];
  resetEyeRegionStability();
  state.pointer.source = "mouse";
  gazeCursor.hidden = true;
  calibrationOverlay.hidden = true;
  clearTimeout(state.eye.calibrationTimer);
  clearTimeout(state.eye.startupTimer);
  eyeStatus.textContent = "Mouse active · camera off";
  $("#signalLabel").textContent = "ACTIVE REGION · MOUSE";
  updateEyeButtons();
  clearActiveRegion();
  publishOutput(true);
  if (showMessage) statusText.textContent = "Mouse exploration is active.";
}

const CALIBRATION_COLS = 3;
const CALIBRATION_ROWS = 4;
const CALIBRATION_INSET = 30;

function buildCalibrationTargets() {
  const rect = canvas.getBoundingClientRect();
  const left = Math.max(0, rect.left) + CALIBRATION_INSET;
  const right = Math.min(window.innerWidth, rect.right) - CALIBRATION_INSET;
  const top = Math.max(0, rect.top) + CALIBRATION_INSET;
  const bottom = Math.min(window.innerHeight, rect.bottom) - CALIBRATION_INSET;
  const usable = right - left > 120 && bottom - top > 120;
  const bounds = usable
    ? { left, right, top, bottom }
    : { left: window.innerWidth * .12, right: window.innerWidth * .88, top: window.innerHeight * .14, bottom: window.innerHeight * .86 };
  const targets = [];
  for (let row = 0; row < CALIBRATION_ROWS; row++) {
    for (let column = 0; column < CALIBRATION_COLS; column++) {
      const screenX = bounds.left + (bounds.right - bounds.left) * column / (CALIBRATION_COLS - 1);
      const screenY = bounds.top + (bounds.bottom - bounds.top) * row / (CALIBRATION_ROWS - 1);
      targets.push({
        screenX,
        screenY,
        targetX: screenX / window.innerWidth,
        targetY: screenY / window.innerHeight,
      });
    }
  }
  return targets;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-8) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let cell = column; cell <= size; cell++) rows[column][cell] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let cell = column; cell <= size; cell++) rows[row][cell] -= factor * rows[column][cell];
    }
  }
  return rows.map((row) => row[size]);
}

function fitEyeCalibration(pairs) {
  if (pairs.length < 6) return null;
  const normal = Array.from({ length: 3 }, () => new Array(3).fill(0));
  const targetX = new Array(3).fill(0);
  const targetY = new Array(3).fill(0);
  for (const pair of pairs) {
    const features = [pair.rawX, pair.rawY, 1];
    for (let row = 0; row < 3; row++) {
      targetX[row] += features[row] * pair.targetX;
      targetY[row] += features[row] * pair.targetY;
      for (let column = 0; column < 3; column++) normal[row][column] += features[row] * features[column];
    }
  }
  for (let index = 0; index < 3; index++) normal[index][index] += 1e-6;
  const x = solveLinearSystem(normal, targetX);
  const y = solveLinearSystem(normal, targetY);
  if (!x || !y) return null;
  const squaredError = pairs.reduce((sum, pair) => {
    const predictedX = x[0] * pair.rawX + x[1] * pair.rawY + x[2];
    const predictedY = y[0] * pair.rawX + y[1] * pair.rawY + y[2];
    return sum + (predictedX - pair.targetX) ** 2 + (predictedY - pair.targetY) ** 2;
  }, 0);
  return { x, y, rmsError: Math.sqrt(squaredError / pairs.length), points: pairs.length };
}

function applyEyeCalibration(rawX, rawY) {
  const model = state.eye.calibrationModel;
  if (!model) return { x: rawX, y: rawY };
  return {
    x: model.x[0] * rawX + model.x[1] * rawY + model.x[2],
    y: model.y[0] * rawX + model.y[1] * rawY + model.y[2],
  };
}

function recordCalibrationSample(rawX, rawY) {
  if (calibrationOverlay.hidden || performance.now() < state.eye.calibrationCollectingAt) return;
  if (rawX < -.35 || rawX > 1.35 || rawY < -.35 || rawY > 1.35) return;
  state.eye.calibrationSamples.push([rawX, rawY]);
  if (state.eye.calibrationSamples.length > 90) state.eye.calibrationSamples.shift();
}

function armCalibrationTarget() {
  const count = state.eye.calibrationSamples.length;
  if (count >= EYE_CALIBRATION_SAMPLE_MIN) {
    state.eye.calibrationReady = true;
    calibrationTarget.classList.add("ready");
    calibrationTarget.querySelector("span").textContent = "CLICK";
    return;
  }
  calibrationTarget.querySelector("span").textContent = "KEEP STILL";
  state.eye.calibrationTimer = window.setTimeout(armCalibrationTarget, 300);
}

function showCalibrationPoint() {
  const target = state.eye.calibrationTargets[state.eye.calibrationIndex];
  calibrationTarget.style.left = `${target.screenX}px`;
  calibrationTarget.style.top = `${target.screenY}px`;
  calibrationProgress.textContent = `Point ${state.eye.calibrationIndex + 1} of ${state.eye.calibrationTargets.length}`;
  calibrationTarget.classList.remove("ready");
  calibrationTarget.querySelector("span").textContent = "HOLD";
  state.eye.calibrationReady = false;
  state.eye.calibrationSamples = [];
  state.eye.calibrationCollectingAt = performance.now() + 280;
  clearTimeout(state.eye.calibrationTimer);
  state.eye.calibrationTimer = window.setTimeout(armCalibrationTarget, 1050);
}

function startCalibration(event) {
  event?.stopPropagation();
  if (!state.eye.ready || !state.eye.active) return;
  state.eye.calibrationIndex = 0;
  state.eye.calibrationPairs = [];
  state.eye.calibrationTargets = buildCalibrationTargets();
  state.eye.rawHistory = [];
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  calibrationOverlay.hidden = false;
  showCalibrationPoint();
}

function finishCalibration() {
  const model = fitEyeCalibration(state.eye.calibrationPairs);
  if (!model || model.rmsError > .18) {
    calibrationOverlay.hidden = true;
    eyeStatus.textContent = state.eye.calibrated
      ? "WebEyeTrack · previous calibration kept"
      : "Calibration failed · try again";
    showToast("Gaze samples were not stable enough · please recalibrate");
    return;
  }
  state.eye.calibrationModel = model;
  calibrationOverlay.hidden = true;
  state.eye.calibrated = true;
  state.eye.rawHistory = [];
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  resetEyeRegionStability();
  eyeStatus.textContent = "WebEyeTrack · calibrated";
  statusText.textContent = "Eye tracking is calibrated. Look across the artwork to hear its regions.";
  showToast("Eye calibration complete");
}

mouseSource.addEventListener("click", (event) => { event.stopPropagation(); stopEyeTracking(); });
eyeToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (state.eye.active || state.eye.starting) stopEyeTracking();
  else startEyeTracking();
});
eyeVideo.addEventListener("playing", () => {
  if (state.eye.active && !state.eye.ready) eyeStatus.textContent = "Camera live · local model initializing";
});
eyeCalibrate.addEventListener("click", startCalibration);
calibrationCancel.addEventListener("click", (event) => {
  event.stopPropagation();
  calibrationOverlay.hidden = true;
  clearTimeout(state.eye.calibrationTimer);
});
calibrationTarget.addEventListener("click", () => {
  if (!state.eye.calibrationReady) return;
  state.eye.calibrationReady = false;
  const target = state.eye.calibrationTargets[state.eye.calibrationIndex];
  state.eye.calibrationPairs.push({
    rawX: median(state.eye.calibrationSamples.map((point) => point[0])),
    rawY: median(state.eye.calibrationSamples.map((point) => point[1])),
    targetX: target.targetX,
    targetY: target.targetY,
  });
  state.eye.calibrationIndex++;
  if (state.eye.calibrationIndex >= state.eye.calibrationTargets.length) finishCalibration();
  else showCalibrationPoint();
});

function setSetupVisible(visible) {
  setupScreen.hidden = !visible;
  modeScreen.hidden = true;
  performanceScreen.hidden = visible;
  document.body.classList.toggle("setup-active", visible);
  document.body.classList.remove("mode-active");
  if (visible) {
    state.setupComplete = false;
  } else {
    state.setupComplete = true;
    requestAnimationFrame(() => {
      fitCanvas();
      drawCanvas();
    });
  }
}

function showModeSelection() {
  setupScreen.hidden = true;
  modeScreen.hidden = false;
  performanceScreen.hidden = true;
  document.body.classList.remove("setup-active");
  document.body.classList.add("mode-active");
  state.setupComplete = false;
}

function updateSessionSummary() {
  const statement = $("#statement").value.trim();
  $("#currentArtName").textContent = state.selectedFile ? safeName(state.selectedFile.name) : "Untitled artwork";
  $("#currentStatement").textContent = statement || "No artist statement";
}

function setupCollapsibleSections() {
  document.querySelectorAll("[data-collapsible]").forEach((section, index) => {
    const heading = section.querySelector(":scope > .collapsible-heading");
    const actions = heading?.querySelector(".section-heading-actions");
    const content = section.querySelector(":scope > .collapsible-content");
    if (!heading || !actions || !content) return;
    const title = heading.querySelector("h2, strong, label")?.textContent?.trim() || `Section ${index + 1}`;
    const contentId = content.id || `panel-section-${index + 1}`;
    content.id = contentId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-collapse-toggle";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", contentId);
    button.setAttribute("aria-label", `Collapse ${title}`);
    button.title = `Collapse ${title}`;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
    button.addEventListener("click", () => {
      const collapsed = section.classList.toggle("section-collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${title}`);
      button.title = button.getAttribute("aria-label");
    });
    actions.append(button);
  });
}

function updateAnalysisSteps(progress) {
  const order = ["prepare", "vision", "segment", "music", "ready"];
  const activeIndex = progress < 12 ? 0 : progress < 40 ? 1 : progress < 65 ? 2 : progress < 96 ? 3 : 4;
  document.querySelectorAll("[data-analysis-step]").forEach((element) => {
    const index = order.indexOf(element.dataset.analysisStep);
    element.classList.toggle("complete", index < activeIndex || progress >= 100);
    element.classList.toggle("active", index === activeIndex && progress < 100);
  });
}

function setAnalyzing(value) {
  state.analyzing = value;
  analysisOverlay.hidden = !value || !state.setupComplete;
  setupProgress.hidden = !value;
  analyzeButton.disabled = value || !state.selectedFile || !statementInput.value.trim();
  analyzeButton.querySelector("span").textContent = value ? "Preparing…" : "Enter";
  updateScanControls();
}

function setAnalysisProgress(progress, message) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  progressBar.style.width = `${value}%`;
  analysisPercent.textContent = `${Math.round(value)}%`;
  analysisMessage.textContent = message;
  setupProgressBar.style.width = `${value}%`;
  setupPercent.textContent = `${Math.round(value)}%`;
  setupProgressMessage.textContent = message;
  updateAnalysisSteps(value);
  statusText.textContent = message;
}

async function pollAnalysis(jobId) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 950));
    const response = await fetch(`/api/analyze/${jobId}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not read the analysis status");
    setAnalysisProgress(payload.progress, payload.message);
    if (payload.status === "ready") return payload.result || payload;
    if (payload.status === "error") throw new Error(payload.message || "Analysis failed");
  }
}

async function runAnalysis() {
  if (state.analyzing) return;
  if (!state.selectedFile) {
    statusText.hidden = false;
    statusText.textContent = "Choose an artwork before entering.";
    return;
  }
  if (!statementInput.value.trim()) {
    statusText.hidden = false;
    statusText.textContent = "Add an artist statement before entering.";
    statementInput.focus();
    return;
  }
  resetScan(false);
  setAnalyzing(true);
  setAnalysisProgress(5, "Preparing the artwork…");
  try {
    const form = new FormData();
    form.append("image", state.selectedFile);
    form.append("statement", statementInput.value.trim());
    const response = await fetch("/api/analyze", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Could not start the analysis");
    const manifest = payload.status === "ready" ? payload : await pollAnalysis(payload.analysis_id);
    await loadAnalysis(manifest);
    setAnalysisProgress(100, "The playable regions are ready.");
    updateSessionSummary();
    await new Promise((resolve) => setTimeout(resolve, 420));
    showModeSelection();
    setAnalyzing(false);
    showToast(`${state.regions.length} playable regions ready · choose an interaction`);
  } catch (error) {
    setAnalyzing(false);
    statusText.hidden = false;
    statusText.textContent = error.message;
    showToast(`Analysis failed: ${error.message}`);
  }
}

function useFile(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showToast("Choose a JPG, PNG, or WebP image");
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast("The image must be smaller than 16 MB");
    return;
  }
  state.selectedFile = null;
  updateEntryReadiness();
  const url = URL.createObjectURL(file);
  setupPreview.src = url;
  setupPreview.hidden = false;
  dropZone.classList.add("has-preview");
  imageFromUrl(url).then((image) => {
    const pixelCount = image.naturalWidth * image.naturalHeight;
    if (pixelCount > 40_000_000) {
      state.selectedFile = null;
      updateEntryReadiness();
      statusText.hidden = false;
      statusText.textContent = `This image is ${(pixelCount / 1_000_000).toFixed(1)} MP. Please use an image below 40 MP.`;
      $("#fileMeta").textContent = `${(pixelCount / 1_000_000).toFixed(1)} MP · too large`;
      showToast("Image exceeds the 40 MP limit");
      return;
    }
    state.selectedFile = file;
    $("#fileMeta").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · ready`;
    resetScan(false);
    state.regions = [];
    state.manifest = null;
    clearActiveRegion();
    state.image = image;
    fitCanvas();
    $("#thumbImage").src = url;
    updateEntryReadiness();
    if (Math.min(image.naturalWidth, image.naturalHeight) < 480 || pixelCount < 300_000) {
      statusText.hidden = false;
      statusText.textContent = "This image is low resolution; fine contours may be less accurate.";
    } else {
      statusText.hidden = true;
    }
  }).catch(() => {
    state.selectedFile = null;
    updateEntryReadiness();
    statusText.hidden = false;
    statusText.textContent = "The selected image could not be opened.";
  });
  $("#fileName").textContent = safeName(file.name);
  $("#fileMeta").textContent = "Checking image…";
  renderRegionList();
}

fileInput.addEventListener("change", () => useFile(fileInput.files[0]));
analyzeButton.addEventListener("click", runAnalysis);
function updateEntryReadiness() {
  analyzeButton.disabled = state.analyzing || !state.selectedFile || !statementInput.value.trim();
}
statementInput.addEventListener("input", updateEntryReadiness);

for (const target of [dropZone]) {
  target.addEventListener("dragenter", (event) => { event.preventDefault(); target.classList.add("dragging"); });
  target.addEventListener("dragover", (event) => { event.preventDefault(); });
  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) target.classList.remove("dragging");
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    target.classList.remove("dragging");
    useFile(event.dataTransfer.files[0]);
  });
}

maskToggle.addEventListener("click", () => {
  state.masksVisible = !state.masksVisible;
  maskToggle.classList.toggle("active", state.masksVisible);
  maskToggle.setAttribute("aria-pressed", String(state.masksVisible));
  drawCanvas();
});
soundToggle.addEventListener("click", async () => {
  if (state.outputMode === "midi") {
    showToast("Switch to Web Audio to hear browser sound");
    return;
  }
  await soundEngine.toggle();
  if (state.mode === "pointer") {
    if (soundEngine.enabled) startPointerMusicTimeline();
    else pausePointerMusicTimeline();
  }
  $("#outputModeStatus").textContent = soundEngine.enabled ? "Browser sound on" : "Browser sound · press Sound";
});
volumeSlider.addEventListener("input", () => {
  const value = Number(volumeSlider.value);
  volumeValue.textContent = `${value}%`;
  volumeSlider.style.setProperty("--volume-fill", `${value}%`);
  soundEngine.setOutputLevel(value / 100);
});

function applyMusicSettings(announce = true) {
  const bpm = Math.max(40, Math.min(200, Math.round(Number(musicBpm.value) || 72)));
  const root = NOTE_NAMES.includes(musicRoot.value) ? musicRoot.value : "D";
  const mode = MUSIC_MODES[musicMode.value] ? musicMode.value : "dorian";
  state.music = { bpm, root, mode };
  musicBpm.value = String(bpm);
  musicRoot.value = root;
  musicMode.value = mode;
  try { localStorage.setItem("streetart:music", JSON.stringify(state.music)); } catch (_) { /* Storage is optional. */ }
  soundEngine.resetMusicalClock();
  if (state.mode === "scan") soundEngine.updateScan(state.scan.regions, state.scan.position, state.scan.seconds, state.scan.playing);
  else if (state.lastOutput) soundEngine.update(state.lastOutput);
  publishOutput(true);
  $("#musicSourceStatus").textContent = state.regions.length ? harmonyPlanSummary() : "Automatic harmony";
  if (announce) {
    const label = musicMode.options[musicMode.selectedIndex]?.textContent || mode;
    statusText.textContent = `Music set to ${bpm} BPM · ${root} ${label}.`;
    showToast(`${bpm} BPM · ${root} ${label}`);
  }
}

function restoreMusicSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("streetart:music") || "null");
    if (saved && typeof saved === "object") {
      musicBpm.value = String(saved.bpm || 72);
      musicRoot.value = NOTE_NAMES.includes(saved.root) ? saved.root : "D";
      musicMode.value = MUSIC_MODES[saved.mode] ? saved.mode : "dorian";
    }
  } catch (_) { /* Keep the defaults when storage is unavailable. */ }
  applyMusicSettings(false);
}

musicBpm.addEventListener("change", () => applyMusicSettings());
musicBpm.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyMusicSettings();
    musicBpm.blur();
  }
});
musicRoot.addEventListener("change", () => applyMusicSettings());
musicMode.addEventListener("change", () => applyMusicSettings());

function nativeFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function artworkIsFullscreen() {
  return nativeFullscreenElement() === canvasShell || canvasShell.classList.contains("fullscreen-fallback");
}

function syncFullscreenState() {
  const active = artworkIsFullscreen();
  pointerFullscreen.setAttribute("aria-pressed", String(active));
  scanFullscreen.setAttribute("aria-pressed", String(active));
  fullscreenExit.setAttribute("aria-hidden", String(!active));
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  state.eye.rawHistory = [];
  resetEyeRegionStability();
  drawCanvas();
}

async function toggleArtworkFullscreen() {
  if (artworkIsFullscreen()) {
    if (nativeFullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document);
    } else {
      canvasShell.classList.remove("fullscreen-fallback");
      document.body.classList.remove("fullscreen-fallback-active");
      syncFullscreenState();
    }
    return;
  }
  try {
    const request = canvasShell.requestFullscreen || canvasShell.webkitRequestFullscreen;
    if (request) await request.call(canvasShell);
    else {
      canvasShell.classList.add("fullscreen-fallback");
      document.body.classList.add("fullscreen-fallback-active");
      syncFullscreenState();
    }
  } catch (error) {
    showToast(error.message || "Fullscreen is unavailable in this browser");
  }
}

pointerFullscreen.addEventListener("click", toggleArtworkFullscreen);
scanFullscreen.addEventListener("click", toggleArtworkFullscreen);
fullscreenExit.addEventListener("click", toggleArtworkFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenState);
document.addEventListener("webkitfullscreenchange", syncFullscreenState);
volumeSlider.style.setProperty("--volume-fill", `${volumeSlider.value}%`);
scanTimeline.style.setProperty("--scan-fill", "0%");
updateScanControls();

$("#endpointUrl").textContent = window.StreetArtOutput.endpoint;
$("#copyEndpoint").addEventListener("click", async () => {
  await navigator.clipboard.writeText(window.StreetArtOutput.endpoint);
  showToast("WebSocket endpoint copied");
});

function setLogicVisible(visible) {
  logicOverlay.hidden = !visible;
  document.body.classList.toggle("logic-visible", visible);
  if (visible) logicClose.focus();
  else logicOpen.focus();
}

logicOpen.addEventListener("click", () => setLogicVisible(true));
logicClose.addEventListener("click", () => setLogicVisible(false));
logicOverlay.addEventListener("click", (event) => {
  if (event.target === logicOverlay) setLogicVisible(false);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !logicOverlay.hidden) setLogicVisible(false);
  if (event.key === "Escape" && canvasShell.classList.contains("fullscreen-fallback")) toggleArtworkFullscreen();
});

$("#addMapping").addEventListener("click", () => {
  mappingList.append(createMappingRow());
  $("#mappingCount").textContent = mappingList.children.length;
  mappingList.lastElementChild.querySelector(".mapping-source").focus();
});
$("#saveExternal").addEventListener("click", () => saveExternalOutput());
$("#oscTest").addEventListener("click", () => testExternalOutput("osc"));
$("#midiTest").addEventListener("click", () => testExternalOutput("midi"));
$("#midiRefresh").addEventListener("click", async () => {
  await loadExternalOutput();
  showToast("MIDI ports refreshed");
});
externalEnabled.addEventListener("change", () => {
  setExternalState(externalEnabled.checked ? "active" : "off", "Select Apply & save to use this change.");
});

function ensureMidiModeMappings() {
  const rows = [...mappingList.querySelectorAll(".mapping-row")];
  const hasRegionNote = rows.some((row) => (
    row.querySelector(".mapping-protocol")?.value === "midi"
    && row.querySelector(".mapping-source")?.value === "region.enter"
  ));
  if (!hasRegionNote) {
    mappingList.append(createMappingRow({
      id: "performance-region-note",
      enabled: true,
      source: "region.enter",
      protocol: "midi",
      target: "60",
      message: "note",
      channel: 1,
      inputMin: 0,
      inputMax: 1,
      outputMin: 92,
      outputMax: 112,
      smoothingMs: 0,
    }));
    $("#mappingCount").textContent = mappingList.children.length;
  }
}

async function setOutputMode(mode, { announce = true, enableWebSound = false } = {}) {
  if (!["web", "midi"].includes(mode)) return;
  state.outputMode = mode;
  performanceScreen.classList.toggle("midi-output", mode === "midi");
  outputModeButtons.forEach((button) => {
    const active = button.dataset.outputMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (mode === "midi") {
    await soundEngine.setEnabled(false);
    if (!externalConfig) await loadExternalOutput();
    externalEnabled.checked = true;
    const saved = await saveExternalOutput(false);
    const portLabel = midiPort.selectedOptions[0]?.textContent || "MIDI output";
    const available = externalDependencies?.midi?.available !== false;
    if (state.mode === "pointer") startPointerMusicTimeline();
    $("#outputModeStatus").textContent = available && saved ? portLabel : "MIDI needs setup";
    soundToggle.title = "Browser sound is off while MIDI Out is selected";
    if (announce) showToast(available && saved ? `9-channel MIDI · ${portLabel}` : "MIDI Out selected · check External Output");
  } else {
    $("#outputModeStatus").textContent = soundEngine.enabled ? "Browser sound on" : "Browser sound · press Sound";
    soundToggle.title = "Turn browser sound on or off";
    if (enableWebSound) await soundEngine.setEnabled(true);
    if (state.mode === "pointer") {
      if (soundEngine.enabled) startPointerMusicTimeline();
      else pausePointerMusicTimeline();
    }
    if (soundEngine.enabled) $("#outputModeStatus").textContent = "Browser sound on";
    if (announce) showToast(soundEngine.enabled ? "Web Audio on" : "Web Audio selected");
  }
  try { localStorage.setItem("streetart:output-mode", mode); } catch (_) { /* Storage is optional. */ }
  publishOutput(true);
}

outputModeButtons.forEach((button) => {
  button.addEventListener("click", () => setOutputMode(button.dataset.outputMode, {
    enableWebSound: button.dataset.outputMode === "web",
  }));
});

async function startOver() {
  clearTimeout(showToast.timer);
  $("#toast").classList.remove("show");
  $("#toast").textContent = "";
  resetScan(false);
  if (state.eye.active || state.eye.starting) stopEyeTracking();
  await soundEngine.setEnabled(false);
  state.selectedFile = null;
  state.image = null;
  state.imagePixels = null;
  resetPointerMusicTimeline();
  resetPointerCrossfade();
  state.manifest = null;
  state.regions = [];
  state.activeRegion = null;
  fileInput.value = "";
  setupPreview.hidden = true;
  setupPreview.removeAttribute("src");
  dropZone.classList.remove("has-preview", "dragging");
  $("#fileName").textContent = "Drop artwork";
  $("#fileMeta").textContent = "Click to choose · JPG, PNG or WebP";
  $("#statement").value = "";
  $("#musicSourceStatus").textContent = "Real-time algorithm";
  analyzeButton.disabled = true;
  statusText.hidden = true;
  statusText.textContent = "";
  setAnalyzing(false);
  setupProgress.hidden = true;
  renderRegionList();
  setSetupVisible(true);
  dropZone.focus?.();
}

$("#newArtwork").addEventListener("click", startOver);
$("#modeStartOver").addEventListener("click", startOver);

window.addEventListener("resize", drawCanvas);
setupCollapsibleSections();
restoreMusicSettings();
connectSocket();
setSetupVisible(true);
analyzeButton.disabled = true;

// MIDI Out is the intentional start-up state. It also guarantees that an old
// saved Web Audio preference cannot turn the browser sound back on.
loadExternalOutput().then(() => setOutputMode("midi", { announce: false }));

// Keep beat-based pointer and gaze patterns running even when the pointer is
// held still. The same frames drive Web Audio, MIDI, OSC, and the live JSON.
window.setInterval(() => {
  if (!state.setupComplete || state.mode !== "pointer" || state.analyzing) return;
  if (!state.activeRegion && !state.pointer.regions.length) return;
  if (performance.now() - state.pointer.lastTime > 70) state.pointer.speed *= .82;
  advancePointerCrossfade();
  publishOutput(true);
}, 50);
