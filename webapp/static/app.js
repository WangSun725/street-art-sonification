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
const volumeSlider = $("#volumeSlider");
const volumeValue = $("#volumeValue");
const musicBpm = $("#musicBpm");
const musicRoot = $("#musicRoot");
const musicMode = $("#musicMode");
const musicTemplate = $("#musicTemplate");
const scanPlay = $("#scanPlay");
const scanReset = $("#scanReset");
const scanTimeline = $("#scanTimeline");
const scanTime = $("#scanTime");
const scanReadout = $("#scanReadout");
const scanDuration = $("#scanDuration");
const pointerMode = $("#pointerMode");
const scanMode = $("#scanMode");
const interactionModeSwitch = $("#interactionModeSwitch");
const linkToggle = $("#linkToggle");
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
const gazeStability = $("#gazeStability");
const gazeStabilityValue = $("#gazeStabilityValue");
const gazeCursor = $("#gazeCursor");
const calibrationOverlay = $("#calibrationOverlay");
const calibrationTarget = $("#calibrationTarget");
const calibrationProgress = $("#calibrationProgress");
const calibrationCancel = $("#calibrationCancel");
const logicOverlay = $("#logicOverlay");
const logicOpen = $("#logicOpen");
const logicClose = $("#logicClose");
const DEFAULT_SCAN_DURATION = 30;
const PERFORMANCE_FADE_IN_SECONDS = 2;
const PERFORMANCE_FADE_OUT_SECONDS = 3;
const MAX_MUSIC_DURATION = 10 * 60;
const SCAN_PROFILE_BINS = 360;
const EYE_CALIBRATION_CLICKS = 5;
const EYE_CLICK_MEMORY = 120;
const EYE_RESULT_TIMEOUT_MS = 350;
const EYE_REGION_DWELL_MS = 135;
const EYE_REGION_RELEASE_MS = 190;
const EYE_FILTER_OPEN_SECONDS = .9;
const EYE_FILTER_CLOSE_SECONDS = 1.3;
const FILTERED_BACKING_LEVEL = .88;
const POINTER_DIRECTION_DISTANCE = .08;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MUSIC_MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
};

// The compiled catalog contains coherent nine-part arrangements derived from
// attributed GMD grooves and SHLD harmony/rhythm material. See MUSIC_MATERIALS.md.
const TEMPLATE_CATALOG = window.StreetArtTemplates || {templates:[],families:[]};
const TEMPLATE_BY_ID = new Map(TEMPLATE_CATALOG.templates.map(item => [item.id, item]));
const TEMPLATE_VARIANT_FEATURES = [
  { key: "brightness", label: "Brightness", threshold: .5, increment: 4 },
  { key: "saturation", label: "Saturation", threshold: .45, increment: 2 },
  { key: "edge_energy", label: "Edge density", threshold: .3, increment: 1 },
];

const COMPOSITION = window.StreetArtComposition;
const INSTRUMENT_ROLES = [
  { id: "lead_synth", label: "Lead Synth", behavior: "Short melody on chord tones", slot: 1 },
  { id: "counter_synth", label: "Arp Synth", behavior: "Chord arpeggios and short runs", slot: 2 },
  { id: "drums", label: "Drums", behavior: "Quantized drum pattern", slot: 3 },
  { id: "bass", label: "Acid Bass", behavior: "Syncopated low bass with accents and slides", slot: 4 },
  { id: "guitar", label: "Guitar", behavior: "Chord hits, motifs and broken voicings", slot: 5 },
  { id: "pad", label: "Pad", behavior: "Open extended chord voicings", slot: 6 },
  COMPOSITION
    ? { id: "organ", label: "FM Organ", behavior: "Short chords with room between hits", slot: 7 }
    : { id: "strings", label: "Strings", behavior: "Wide sustained voice leading", slot: 7 },
  { id: "keys_mallet", label: "Keys / Mallet", behavior: "Chord stabs and varied note phrases", slot: 8 },
  { id: "percussion_texture", label: "Percussion / Texture", behavior: "Shaker, rim and hand drum patterns", slot: 9 },
];

const INSTRUMENTS_BY_ID = new Map(INSTRUMENT_ROLES.map(role => [role.id, role]));
const LEGACY_REGION_INSTRUMENTS = new Map(Object.entries({
  figure: "drums", face: "counter_synth", gesture: "counter_synth",
  detail: "lead_synth", lettering: "keys_mallet", outline: "guitar", symbol: "strings", abstract_shape: "strings",
  fill: "bass", wall: "pad", texture: "percussion_texture", drip: "percussion_texture",
}));

const GEMS_LABELS = {
  wonder: "Wonder",
  transcendence: "Transcendence",
  tenderness: "Tenderness",
  nostalgia: "Nostalgia",
  peacefulness: "Peacefulness",
  power: "Power",
  joyful_activation: "Joyful Activation",
  tension: "Tension",
  sadness: "Sadness",
};
const GEMS_DIMENSIONS = Object.keys(GEMS_LABELS);
const DEFAULT_GEMS_WEIGHTS = {
  wonder: .12,
  transcendence: .08,
  tenderness: .10,
  nostalgia: .10,
  peacefulness: .20,
  power: .10,
  joyful_activation: .12,
  tension: .10,
  sadness: .08,
};

function clampUnit(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : fallback));
}

function normalizeGemsWeights(value) {
  const source = value && typeof value === "object" ? value : {};
  const values = Object.fromEntries(GEMS_DIMENSIONS.map((name) => [name, clampUnit(source[name], 0)]));
  let total = GEMS_DIMENSIONS.reduce((sum, name) => sum + values[name], 0);
  if (total <= 0) {
    for (const name of GEMS_DIMENSIONS) values[name] = DEFAULT_GEMS_WEIGHTS[name];
    total = GEMS_DIMENSIONS.reduce((sum, name) => sum + values[name], 0);
  }
  return Object.fromEntries(GEMS_DIMENSIONS.map((name) => [name, Number((values[name] / total).toFixed(6))]));
}

function gemsHigherOrder(weights) {
  return {
    sublimity: Number((weights.wonder + weights.transcendence + weights.tenderness + weights.nostalgia + weights.peacefulness).toFixed(6)),
    vitality: Number((weights.power + weights.joyful_activation).toFixed(6)),
    unease: Number((weights.tension + weights.sadness).toFixed(6)),
  };
}

function normalizeGemsProfile(value) {
  const source = value && typeof value === "object" ? value : {};
  const weights = normalizeGemsWeights(source.weights);
  const ranked = [...GEMS_DIMENSIONS].sort((a, b) => weights[b] - weights[a]);
  const image = source.image && typeof source.image === "object" ? source.image : {};
  const statement = source.statement && typeof source.statement === "object" ? source.statement : {};
  return {
    framework: "GEMS-9",
    weights,
    dominant: GEMS_LABELS[source.dominant] ? source.dominant : ranked[0],
    secondary: GEMS_LABELS[source.secondary] ? source.secondary : ranked[1],
    higher_order: gemsHigherOrder(weights),
    image: {
      weights: normalizeGemsWeights(image.weights),
      evidence: String(image.evidence || "GEMS-9 estimate based on visible artwork features."),
    },
    statement: {
      weights: normalizeGemsWeights(statement.weights),
      evidence: String(statement.evidence || "GEMS-9 estimate based on the Artist Statement."),
    },
    combination: source.combination || { image: .45, statement: .55 },
    rationale: String(source.rationale || "Image and statement profiles were combined deterministically."),
    source: source.source || "qwen3-vl-separate-image-and-statement-gems9",
  };
}

function gemsProfileName(profile = state.gems) {
  const dominant = GEMS_LABELS[profile?.dominant] || "Peacefulness";
  const secondary = GEMS_LABELS[profile?.secondary] || "Wonder";
  return `${dominant} + ${secondary}`;
}

function gemsControlFeatures(profile = state.gems) {
  const weights = profile?.weights || DEFAULT_GEMS_WEIGHTS;
  const activationWeights = {
    wonder: .62, transcendence: .45, tenderness: .25, nostalgia: .32, peacefulness: .15,
    power: .90, joyful_activation: .98, tension: .85, sadness: .20,
  };
  const activation = GEMS_DIMENSIONS.reduce(
    (sum, name) => sum + weights[name] * (activationWeights[name] || 0),
    0,
  );
  return {
    activation: clampUnit(activation),
    sublimity: clampUnit(profile?.higher_order?.sublimity),
    vitality: clampUnit((weights.power + weights.joyful_activation) * 2.8),
    unease: clampUnit((weights.tension + weights.sadness) * 2.8),
    serenity: clampUnit((weights.peacefulness + weights.tenderness + weights.nostalgia) * 2.35),
    radiance: clampUnit((weights.wonder + weights.joyful_activation + weights.power) * 2.25),
    power: clampUnit(weights.power * 5),
    tension: clampUnit(weights.tension * 5),
    sadness: clampUnit(weights.sadness * 5),
  };
}

// Each instrument has its own spatial response to all nine GEMS dimensions.
// Arrays follow GEMS_DIMENSIONS order and remain normalized 0-1 effect sends.
const ROLE_GEMS_EFFECTS = {
  lead_synth: {
    reverb: [.55, .75, .45, .65, .42, .25, .32, .18, .62],
    chorus: [.4, .62, .28, .58, .36, .16, .28, .45, .55],
    delay: [.36, .48, .22, .4, .18, .2, .32, .36, .32],
  },
  counter_synth: {
    reverb: [.62, .8, .52, .7, .55, .22, .38, .32, .68],
    chorus: [.48, .7, .35, .64, .46, .18, .34, .52, .62],
    delay: [.52, .68, .34, .58, .32, .28, .48, .56, .5],
  },
  drums: {
    reverb: [.22, .35, .18, .3, .16, .12, .18, .25, .3],
    chorus: [.08, .12, .06, .1, .05, .04, .06, .14, .08],
    delay: [.16, .28, .1, .22, .08, .08, .14, .24, .18],
  },
  bass: {
    reverb: [.18, .3, .2, .28, .18, .08, .12, .12, .26],
    chorus: [.14, .28, .16, .3, .18, .08, .12, .24, .26],
    delay: [.1, .18, .08, .16, .06, .06, .1, .14, .12],
  },
  guitar: {
    reverb: [.48, .68, .46, .66, .5, .22, .3, .3, .64],
    chorus: [.35, .58, .34, .62, .44, .16, .26, .4, .58],
    delay: [.32, .52, .24, .48, .22, .16, .3, .38, .4],
  },
  pad: {
    reverb: [.72, .92, .72, .86, .82, .42, .58, .64, .84],
    chorus: [.62, .82, .58, .78, .68, .35, .52, .76, .74],
    delay: [.38, .58, .3, .5, .3, .2, .34, .44, .42],
  },
  strings: {
    reverb: [.68, .9, .7, .84, .78, .4, .54, .58, .86],
    chorus: [.58, .8, .54, .76, .62, .3, .46, .72, .78],
    delay: [.3, .48, .24, .42, .24, .16, .28, .4, .38],
  },
  keys_mallet: {
    reverb: [.48, .68, .42, .62, .5, .2, .3, .34, .58],
    chorus: [.26, .42, .22, .4, .28, .12, .2, .34, .36],
    delay: [.38, .58, .28, .5, .24, .2, .42, .48, .42],
  },
  percussion_texture: {
    reverb: [.5, .72, .38, .62, .48, .2, .36, .58, .56],
    chorus: [.36, .56, .28, .5, .34, .14, .3, .64, .46],
    delay: [.48, .7, .32, .58, .28, .22, .5, .72, .52],
  },
};

function roleGemsEffects(role) {
  const profile = ROLE_GEMS_EFFECTS[role] || ROLE_GEMS_EFFECTS.lead_synth;
  const weights = state.gems?.weights || DEFAULT_GEMS_WEIGHTS;
  const blend = (values) => GEMS_DIMENSIONS.reduce(
    (sum, name, index) => sum + (weights[name] || 0) * values[index],
    0,
  );
  return {
    reverb: clampUnit(blend(profile.reverb)),
    chorus: clampUnit(blend(profile.chorus)),
    delay: clampUnit(blend(profile.delay)),
  };
}

function renderGemsProfile() {
  const weights = state.gems.weights;
  const dominant = state.gems.dominant;
  const secondary = state.gems.secondary;
  const percent = (name) => `${Math.round((weights[name] || 0) * 100)}%`;
  $("#gemsSummary").textContent = `${GEMS_LABELS[dominant]} ${percent(dominant)} · ${GEMS_LABELS[secondary]} ${percent(secondary)}`;
  $("#gemsImageEvidence").textContent = state.gems.image.evidence;
  $("#gemsStatementEvidence").textContent = state.gems.statement.evidence;
}

const STUDIO = window.StreetArtStudio;
// Per-instrument send levels. The three shared returns have their own trims.
const INSTRUMENT_SENDS = {
  lead_synth: { delay: .34, reverb: .38, chorus: .32 },
  counter_synth: { delay: .45, reverb: .32, chorus: .24 },
  drums: { delay: .09, reverb: .18, chorus: .04 },
  bass: { delay: .08, reverb: .10, chorus: .12 },
  guitar: { delay: .37, reverb: .39, chorus: .30 },
  pad: { delay: .23, reverb: .54, chorus: .48 },
  organ: { delay: .12, reverb: .25, chorus: .34 },
  keys_mallet: { delay: .39, reverb: .35, chorus: .23 },
  percussion_texture: { delay: .10, reverb: .24, chorus: .06 },
};
function defaultInstrumentSends(role) {
  return { ...(INSTRUMENT_SENDS[role] || INSTRUMENT_SENDS.pad), delayMix: .5, tremolo: 0 };
}

const FM_SOUND = Object.fromEntries(INSTRUMENT_ROLES.map(({id}) => [id, {
  tone: .36, space: .56, volume: 1, sends: defaultInstrumentSends(id), patch: {},
}]));
const FM_VOLUME_STORAGE = "streetart:fm-instrument-volumes";

function fmInstrumentVolume(region) {
  return COMPOSITION ? (FM_SOUND[region.instrument?.id]?.volume ?? 1) : 1;
}

const ARTWORK_MUSIC = {
  id: "artwork-composition", name: "Artwork composition",
  fx: { delayBeats: .75 },
};

function applyArtworkInstrument(region, role) {
  region.instrument = { ...role };
  const seed = regionMusicSeed(region);
  region.leadPhrase = role.id === "lead_synth"
    ? COMPOSITION.pickLeadPhrase(region.rhythmDensity, seed, [0, 4, 8, 12].map(beat => harmonyAt(beat).tones),
      musicRootMidi(), harmonyIsMinor() ? "minor" : "major")
    : null;
  region.rhythmPhrase = region.leadPhrase?.bars ?? COMPOSITION.pickPhrase(role.id, region.rhythmDensity, seed);
  return region;
}

function rebuildReverseArrangement() {
  if (!COMPOSITION || !state.regions.length) return;
  const regions = state.backingDrum ? [...state.regions, state.backingDrum.region] : state.regions;
  const chords = [0, 4, 8, 12].map(beat => harmonyAt(beat).tones);
  const tonic = musicRootMidi();
  const mode = harmonyIsMinor() ? "minor" : "major";
  const reverse = COMPOSITION.selectReverseArrangement(regions, chords, tonic, mode);
  regions.forEach((region, index) => { region.reverseTake = reverse[index]; });
}

function instrumentIdForArtwork(id) {
  return COMPOSITION && id === "strings" ? "organ" : id;
}

function assignArtworkRoles(regions) {
  return regions.map(region => {
    const role = INSTRUMENTS_BY_ID.get(instrumentIdForArtwork(region.default_instrument))
      || INSTRUMENTS_BY_ID.get(instrumentIdForArtwork(LEGACY_REGION_INSTRUMENTS.get(region.type)))
      || INSTRUMENT_ROLES[0];
    const assigned = { ...region, defaultInstrumentId: role.id };
    return COMPOSITION ? applyArtworkInstrument(assigned, role) : { ...assigned, instrument: { ...role } };
  });
}

const state = {
  manifest: null,
  image: null,
  imagePixels: null,
  selectedFile: null,
  artworkName: "",
  regions: [],
  activeRegion: null,
  regionPreview: null,
  backingDrum: null,
  mode: "scan",
  link: { enabled: false, region: null, focus: new Map(), lastAt: 0 },
  effectTrims: { reverb: 1, chorus: 1, delay: 1, feedback: 1, chorusDepth: 1, effectTone: 1 },
  setupComplete: false,
  analyzing: false,
  music: { bpm: 72, root: "C", mode: "major" },
  scheduler: { signature: null, session: 0, seen: new Map(), active: new Set() },
  gems: normalizeGemsProfile(null),
  harmony: { signature: null, plan: null },
  arrangement: { choice: "auto", autoId: null, scores: [], features: null },
  musicTimeline: {
    startedAt: 0,
    running: false,
    directionChanges: new Map(),
  },
  pointer: {
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    speed: 0,
    lastTime: 0,
    source: "mouse",
    insideArtwork: false,
    pinnedRegion: null,
    fadeEndsAt: null,
    regions: [],
    lastMixAt: 0,
    directionAnchor: null,
  },
  eye: {
    active: false,
    starting: false,
    ready: false,
    calibrated: false,
    sessionId: 0,
    tracker: null,
    startupPending: false,
    smoothX: null,
    smoothY: null,
    lastSmoothAt: 0,
    lastResultAt: -Infinity,
    calibrationIndex: 0,
    calibrationClicks: 0,
    calibrationTargets: [],
    previousCalibration: null,
    startupTimer: 0,
    rawHistory: [],
    candidateRegionId: null,
    candidateSince: 0,
    outsideSince: 0,
    outsideArtworkSince: null,
  },
  enteredAt: 0,
  lastPerformanceAt: 0,
  lastControlDisplayAt: -Infinity,
  scan: {
    engaged: false,
    startRequest: null,
    playing: false,
    duration: DEFAULT_SCAN_DURATION,
    position: 0,
    pathMode: "forward",
    voiceMode: "backing",
    ranges: [],
    route: [{ from: 0, to: 1, start: 0, end: 1, index: 0 }],
    segmentIndex: 0,
    editingRanges: false,
    draftRange: null,
    seconds: 0,
    startedAt: 0,
    startedFrom: 0,
    beatOffset: 0,
    skipFadeIn: false,
    lastFrameAt: 0,
    animationFrame: 0,
    regions: [],
    ensemble: [],
    voiceRegions: [],
    regionMix: new Map(),
    lastMixAt: 0,
  },
};

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
  if (COMPOSITION) return `${state.music.root}:${state.music.mode}:${state.artworkMusic?.hueIndex ?? 0}`;
  return `${currentArrangement().id}:${state.music.root}:${state.music.mode}:${state.manifest?.analysis_id || ""}`;
}

function selectArrangement() {
  const weights = state.gems.weights;
  const norm = Math.sqrt(GEMS_DIMENSIONS.reduce((sum, key) => sum + weights[key] ** 2, 0));
  const saved = state.manifest?.music_plan?.features;
  const visuals = state.regions.map(fallbackRegionVisual);
  const mean = key => visuals.length ? visuals.reduce((sum, v) => sum + v[key], 0) / visuals.length : .4;
  const features = {
    brightness: clampUnit(saved?.brightness, mean("brightness")),
    saturation: clampUnit(saved?.saturation, mean("saturation")),
    edge_energy: clampUnit(saved?.edge_energy, mean("texture")),
  };
  features.contrast = clampUnit(saved?.contrast, mean("texture"));
  features.energy = .50 * features.edge_energy + .27 * features.contrast + .23 * features.saturation;
  const scores = TEMPLATE_CATALOG.families.map(family => {
    const target = family.gems;
    const targetNorm = Math.sqrt(GEMS_DIMENSIONS.reduce((sum, key) => sum + target[key] ** 2, 0));
    const emotion = GEMS_DIMENSIONS.reduce((sum, key) => sum + weights[key] * target[key], 0)
      / Math.max(1e-9, norm * targetNorm);
    if (!family.visualProfile) return { id: family.id, name: family.name, score: emotion };
    const vector = [features.energy, features.brightness, features.saturation, features.edge_energy];
    const visual = 1 - family.visualProfile.reduce((sum, value, index) =>
      sum + Math.abs(value - vector[index]) * [.35,.22,.14,.29][index], 0);
    return { id: family.id, name: family.name, score: .75 * visual + .25 * emotion, visual, emotion };
  }).sort((a, b) => b.score - a.score);
  // Three explicit visual decisions select one of eight variations. These
  // thresholds and GEMS prototypes are authored mappings, not clinical facts.
  const version = TEMPLATE_VARIANT_FEATURES.reduce((number, rule) =>
    number + (features[rule.key] >= rule.threshold ? rule.increment : 0), 1);
  state.arrangement.autoId = `${scores[0].id}_${String(version).padStart(2, "0")}`;
  state.arrangement.scores = scores;
  state.arrangement.features = features;
}

function currentArrangement() {
  if (COMPOSITION) return ARTWORK_MUSIC;
  if (!state.arrangement.autoId) selectArrangement();
  const base = TEMPLATE_BY_ID.get(state.arrangement.choice === "auto" ? state.arrangement.autoId : state.arrangement.choice)
    || TEMPLATE_CATALOG.templates[0];
  return base.modeVariants?.[harmonyIsMinor() ? "minor" : "major"] || base;
}

function renderArrangementChoice() {
  const selected = currentArrangement();
  musicTemplate.value = state.arrangement.choice;
  musicTemplate.options[0].textContent = `Auto · ${TEMPLATE_BY_ID.get(state.arrangement.autoId).name}`;
  const features = state.arrangement.features;
  const percent = value => `${Math.round(value * 100)}%`;
  if (selected.source) {
    const automatic = TEMPLATE_BY_ID.get(state.arrangement.autoId);
    const scores = state.arrangement.scores.slice(0, 3).map(item =>
      `${item.name} ${percent(item.score)} (visual ${percent(item.visual)}, GEMS ${percent(item.emotion)})`).join(" · ");
    $("#templateReason").textContent = `Auto: ${automatic.name}. Style score = 75% visual fit + 25% GEMS fit. Visual fit uses energy, brightness, saturation and edge density. ${scores}. `
      + `Variation ${automatic.version}/8: start at 1; add 4 if brightness ${percent(features.brightness)} ≥ 50%, add 2 if saturation ${percent(features.saturation)} ≥ 45%, add 1 if edge density ${percent(features.edge_energy)} ≥ 30%. `
      + `Playing ${selected.name} · ${selected.production?.mode || selected.sourceMode} arrangement. MIDI source: ${selected.source.title}; harmonic guide inferred from source-derived notes.`;
    return;
  }
  $("#templateReason").textContent = `Selected: ${selected.name} (${state.arrangement.choice === "auto" ? "Auto" : "manual"}). Auto suggestion: ${TEMPLATE_BY_ID.get(state.arrangement.autoId).name}. Its family has the closest GEMS-9 profile (image 45%, statement 55%). `
    + `Top matches: ${state.arrangement.scores.slice(0, 3).map(item => `${item.name} ${item.score.toFixed(2)}`).join(" · ")}. `
    + `Variation ${TEMPLATE_BY_ID.get(state.arrangement.autoId).version}/8: brightness ${percent(features.brightness)} (threshold 50%), saturation ${percent(features.saturation)} (45%), edge density ${percent(features.edge_energy)} (30%). `
    + `Each threshold adds 4, 2 or 1 to variation 01. Similarity scores are design matches, not confidence estimates. `
    + `Groove: ${selected.grooveSource.style}, source bars ${selected.grooveSource.startBar}–${selected.grooveSource.startBar + 3}; adapted to the shared clock.`;
}

function ensureHarmonyPlan() {
  const signature = harmonySignature();
  if (state.harmony.signature === signature && state.harmony.plan) return state.harmony.plan;
  if (COMPOSITION) {
    const primary = COMPOSITION.harmonyForHue(state.artworkMusic?.hueIndex ?? 0, state.music.mode);
    const plan = { primary, barsPerChord: 1 };
    state.harmony = { signature, plan };
    return plan;
  }
  const arrangement = currentArrangement();
  const pool = arrangement.progressions[harmonyIsMinor() ? "minor" : "major"];
  const seed = hashMusicText(signature || `${state.music.root}:${state.music.mode}`);
  const plan = {
    seed,
    primary: pool[0],
    contrast: pool[1],
    barsPerChord: arrangement.barsPerChord,
  };
  state.harmony = { signature, plan };
  return plan;
}

function harmonyPlanSummary() {
  const arrangement = currentArrangement();
  if (arrangement.source) return `${arrangement.name} · ${arrangement.production?.mode || arrangement.sourceMode} arrangement`;
  const plan = ensureHarmonyPlan();
  if (!plan.contrast) return plan.primary.name;
  return `${currentArrangement().name} · ${plan.primary.name} / ${plan.contrast.name}`;
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
  const sectionBar = barIndex % (plan.contrast ? 16 : plan.primary.degrees.length * plan.barsPerChord);
  const progression = plan.contrast && sectionBar >= 8 ? plan.contrast : plan.primary;
  const chordIndex = Math.floor((plan.contrast ? sectionBar % 8 : sectionBar) / plan.barsPerChord) % progression.degrees.length;
  const degree = progression.degrees[chordIndex];
  const scaleIndex = degree - 1;
  const tones = [0, 2, 4, 6, 8, 10, 12].map((offset) => harmonyDegreeMidi(scaleIndex + offset));

  // A major dominant in minor modes creates a stronger V–i cadence while
  // the rest of the chord still comes from the selected mode.
  if (!COMPOSITION && harmonyIsMinor() && degree === 5 && tones[1] - tones[0] === 3) tones[1] += 1;
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

function melodicNoteForEvent(region, root, chord, event, eventIndex, seed) {
  const contour = currentArrangement().motif;
  const variation = chord.barIndex % 4;
  let degree = event.degree ?? contour[(eventIndex + Math.floor(chord.barIndex / 4)) % contour.length];
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
    if (distance >= -1e-6 && distance < triggerWindow && (!selected || event.at > selected.at)) {
      selected = event;
      selectedIndex = index;
    }
  });
  return selected ? { event: selected, index: selectedIndex } : null;
}

function sourcePitch(note, arrangement) {
  const source = MUSIC_MODES[arrangement.sourceMode];
  const target = harmonyScale();
  const pc = positiveModulo(note - arrangement.sourceTonic, 12);
  const degree = source.indexOf(pc);
  // One transformation across the entire excerpt. Preserve chromatic passing
  // notes and the original voicing in its native mode.
  const modeShift = degree < 0 ? 0 : target[degree] - source[degree];
  const shift = positiveModulo(musicRootMidi() - arrangement.sourceTonic + 6, 12) - 6;
  return Math.min(127, Math.max(0, note + shift + modeShift));
}

function eventTimbre(visual) {
  return {
    brightness: Number(visual.brightness || 0),
    saturation: Number(visual.saturation || 0),
    hue: Number(visual.hue || 0),
    texture: Number(visual.texture || 0),
  };
}

function sourceMusicEvent(arrangement, region, beatPosition, visual, intensity, forceStart = false) {
  const role = region.instrument?.id || "lead_synth";
  const bar = Math.max(0, Math.floor(beatPosition / 4));
  const library = arrangement.patterns[role];
  const inBar = positiveModulo(beatPosition, 4);
  const pattern = library[bar % library.length];
  const selected = patternEventAt(pattern, inBar);
  const event = forceStart
    ? (selected?.event ?? pattern[0] ?? library.find(events=>events.length)?.[0])
    : selected?.event;
  const toNote = note => {
    const pitch = sourcePitch(note, arrangement);
    return arrangement.production?.metalBass && role === "bass" ? 28 + positiveModulo(pitch - 28, 12) : pitch;
  };
  const notes = event?.sourceNotes ? [...new Set(event.sourceNotes.map(toNote))] : event?.notes || [];
  const guide = arrangement.chordGuide?.[(bar % 8) * 2 + Number(inBar >= 2)];
  const velocityScale = .62 + .38 * intensity;
  return {
    eventId: `${region.id}:source-${bar}:${selected?.index ?? "rest"}`,
    patternStep: selected?.index ?? -1,
    patternPositionBeats: event ? Number(event.at.toFixed(3)) : null,
    rhythmFamily: "Source phrase",
    eventKind: notes.length > 1 ? "chord" : "note",
    templateId: arrangement.id,
    accent: event?.accent || false,
    slide: event?.slide || false,
    wobbleRate: event?.wobbleRate,
    behavior: region.instrument?.behavior,
    notes,
    note: notes[0] ?? musicRootMidi(),
    velocity: Math.min(127, Math.max(1, Math.round((event?.sourceVelocity ?? 80) * velocityScale))),
    ...(event?.noteVelocities ? {noteVelocities: Object.fromEntries(notes.map(note =>
      [note, Math.min(127, Math.max(1, Math.round(event.noteVelocities[note] * velocityScale)))]))} : {}),
    durationBeats: event?.duration ?? .25,
    harmony: { progression: "Source phrase", progressionRole: "source", bar: bar + 1,
      ...(guide ? {guideNotes: guide.notes.map(pc => NOTE_NAMES[positiveModulo(toNote(60+pc),12)])} : {}) },
    // A scan sample also carries the region's pixel mask. Only send sound controls.
    timbre: eventTimbre(visual),
  };
}

function phraseClipAtBar(region, bar, reverse = false) {
  const phrase = (reverse && region.reverseTake?.bars) || region.rhythmPhrase;
  return phrase[bar % phrase.length];
}

function clipEvent(region, nx, ny, onset, groupIndex, visual, maxLength = Infinity, reverse = false) {
  const role = region.instrument.id;
  const chord = harmonyAt(onset);
  const clip = phraseClipAtBar(region, chord.barIndex, reverse);
  const lead = (reverse && region.reverseTake?.lead) || region.leadPhrase;
  const group = clip.groups[groupIndex];
  const endsPhrase = chord.sectionBar === region.rhythmPhrase.length - 1 && groupIndex === clip.groups.length - 1;
  const root = regionMidiNote(region, nx, ny);
  const seed = regionMusicSeed(region);
  const phase = positiveModulo(onset, 4);
  const voice = ["pad","strings","guitar","keys_mallet"].includes(role)
    ? chordVoicing(chord, role, visual, seed, chord.barIndex % 2 === 1) : null;
  const organNotes = role === "organ" ? [
    nearestChordTone(56, [chord.tones[1]]),
    nearestChordTone(60, [chord.tones[2]]),
    nearestChordTone(62, [chord.tones[0]]),
  ] : null;
  const eventList = group?.events || [];
  const firstGuide = clip?.groups[0]?.events[0]?.previewNote ?? 60;
  const anchor = nearestChordTone(root, chord.tones);
  const strong = Math.abs(phase-Math.round(phase))<.16 || groupIndex===0;
  const chordRoot = chord.tones[0];
  const pickScale = (note) => harmonyScale().map(step=>{
    const pitch=musicRootMidi()+step;
    return pitch+12*Math.round((note-pitch)/12);
  }).reduce((best,pitch)=>Math.abs(pitch-note)<Math.abs(best-note)?pitch:best);
  const limit = (note, low, high) => shiftVoicingIntoRange([note],low,high)[0];
  const noteVelocities = {}, noteDurations = {};
  for (const [voiceIndex, event] of eventList.entries()) {
    const guide = event.previewNote ?? firstGuide;
    const contour = guide-firstGuide;
    let note;
    if (role === "drums" || role === "percussion_texture") note = event.note;
    else if (organNotes) note = organNotes[voiceIndex];
    else if (role === "bass") {
      const bassRoot = 24 + positiveModulo(chordRoot, 12);
      const anchorBeat = groupIndex === 0 || Math.abs(phase - 2) < .16 || event.velocity < 50 || endsPhrase;
      const fifth = chord.tones[2] - chordRoot;
      note = bassRoot + (anchorBeat ? 0 : [0, fifth, 0, 12][groupIndex % 4]);
    } else if (role === "counter_synth") {
      if (Number.isFinite(event.chordDegree)) {
        const interval = harmonyDegreeMidi(chord.degree - 1 + event.chordDegree) - chordRoot;
        const target = limit(chordRoot, 55, 66) + interval;
        note = limit(nearestChordTone(target, chord.tones.slice(0, 3)), 55, 91);
      } else {
        const index = [0,1,2,1,2,1,0,2][(groupIndex+seed%3)%8];
        note = limit(chord.tones[index] + (contour>=12?12:0),55,87);
      }
    } else if (role === "lead_synth") {
      note = musicRootMidi() + 24 + event.semitoneOffset;
    } else if (voice && (eventList.length>1 || role==="pad" || role==="strings" || role==="guitar")) {
      const guideRank = [...eventList].sort((a,b)=>(a.previewNote??60)-(b.previewNote??60)).indexOf(event);
      note=voice.notes[(guideRank+(eventList.length===1?groupIndex:0))%voice.notes.length];
    } else {
      const target = anchor + Math.max(-15,Math.min(15,contour));
      note = limit(strong || event.duration>=.85 ? nearestChordTone(target,chord.tones.slice(0,4)) : pickScale(target),55,91);
    }
    const duration = Math.min(event.duration, maxLength, role === "lead_synth" ? Infinity : 4 - phase);
    if (!Number.isFinite(note) || duration<=0) continue;
    noteVelocities[note] = Math.max(noteVelocities[note] || 0, event.velocity);
    noteDurations[note] = Math.max(noteDurations[note] || 0, duration);
  }
  const notes = Object.keys(noteVelocities).map(Number);
  return {
    eventId: `${region.id}:${clip?.id}:${chord.barIndex}:${groupIndex}`,
    rhythmClip: clip?.id, densityBand: clip?.densityBand, behavior: region.instrument.behavior,
    ...(lead ? { leadPhrase: lead.id } : {}),
    patternStep: groupIndex, patternPositionBeats: group?.beat ?? null,
    eventKind: notes.length>1?"chord":"note", accent: eventList.some(e=>e.accent || e.velocity>=107),
    slide: eventList.some(e=>e.slide), notes, note:notes[0]??root, noteVelocities, noteDurations,
    velocity: Math.max(0,...Object.values(noteVelocities)),
    durationBeats: Math.max(0,...Object.values(noteDurations)),
    harmony: {degree: chord.degree, bar: chord.barIndex+1, progression: chord.progression,
      tension:voice?.tension, inversion:voice?.inversion, spread:voice?.spread},
    timbre: eventTimbre(visual),
  };
}

function musicEventForRegion(region, nx, ny, beatPosition, speed = 0, intensity = 1, forceStart = false, visual = null) {
  if (COMPOSITION && region.rhythmPhrase) {
    const bar = Math.max(0, Math.floor(beatPosition / 4));
    const reverse = reverseAtBar(bar);
    const groups = phraseClipAtBar(region, bar, reverse).groups;
    const phase = positiveModulo(beatPosition,4);
    const exact = groups.findIndex(group=>Math.abs(group.beat-phase)<.0001);
    const i = exact>=0 ? exact : forceStart ? 0 : -1;
    return clipEvent(region,nx,ny,beatPosition,i,visual || fallbackRegionVisual(region), Infinity, reverse);
  }
  const arrangement = currentArrangement();
  if (arrangement.source) {
    return sourceMusicEvent(arrangement, region, beatPosition, visual || fallbackRegionVisual(region), intensity, forceStart);
  }
  const role = region.instrument?.id || "lead_synth";
  const chord = harmonyAt(beatPosition);
  const beatInBar = positiveModulo(beatPosition, 4);
  const regionVisual = visual || fallbackRegionVisual(region);
  const seed = regionMusicSeed(region, `${state.music.root}:${state.music.mode}`);
  const library = arrangement.patterns[role] || arrangement.patterns.lead_synth;
  const continuous = role === "bass" || role === "counter_synth";
  const patternIndex = chord.barIndex % library.length;
  const pattern = library[patternIndex];
  const selected = patternEventAt(pattern, beatInBar);
  const root = regionMidiNote(region, nx, ny);
  const voicing = chordVoicing(chord, role, regionVisual, seed + arrangement.version, false);
  const accent = Boolean(selected?.event.accent);
  const slide = Boolean(selected?.event.slide);
  const accentVelocity = continuous ? (accent ? 11 : -13) : 0;
  const velocity = Math.max(28, Math.min(127, Math.round(
    (52 + intensity * 45 + Math.min(1, speed) * 16 + (regionVisual.saturation || 0) * 8 + accentVelocity)
      * (selected?.event.velocityGain ?? 1),
  )));
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
      const toneIndex = [0, 2, 1, 0, 3][event.tone];
      notes = [chord.tones[toneIndex] - (event.tone === 3 ? 0 : 12)];
    } else if (role === "counter_synth") {
      const note = chord.tones[event.tone % 4] + (event.tone >= 4 ? 12 : 0);
      notes = shiftVoicingIntoRange([note], 60, 86);
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
    templateId: arrangement.id,
    ...(continuous ? { accent, slide } : {}),
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
    timbre: eventTimbre(regionVisual),
  };
}

const ROLE_FX = {
  bass:[.23,.23,.32], drums:[.42,.17,.36], percussion_texture:[.34,.12,.18],
  counter_synth:[.80,.79,1.20], lead_synth:[.91,.75,1.15], keys_mallet:[.83,.65,1.10],
  guitar:[.92,1.12,.96], strings:[1.22,1.14,.65], organ:[.54,.42,.34], pad:[1.38,1.38,.77],
};

function artworkControls(role, x, speed, mix, accent, color) {
  const { tone, space, sends } = FM_SOUND[role];
  const width = ROLE_FX[role]?.[1] ?? 1;
  const sustained = ["pad", "strings"].includes(role);
  const drum = ["drums", "percussion_texture"].includes(role);
  return {
    movement: clampUnit(speed), pan: clampUnit(x, .5), expression: clampUnit(mix, 1),
    harmonicIntensity: clampUnit(.31 + .24 * tone),
    brightness: clampUnit(.27 + .36 * tone + (accent && role === "bass" ? .14 : 0)),
    attack: sustained ? .475 : drum ? .065 : .135,
    release: clampUnit((sustained ? .48 : drum ? .08 : .19) + space * .31),
    // The oscillator's stereo detune is part of the dry patch.
    chorus: clampUnit((.124 + space * .26) * width),
    sends: color ? {
      ...sends,
      delayMix: Math.min(color.hue, 1 - color.hue) * 2,
      reverb: clampUnit(sends.reverb * (1.6 - 1.2 * color.value)),
      chorus: clampUnit(sends.chorus * (.7 + 1.5 * color.contrast)),
      tremolo: clampUnit(sends.tremolo + .5 * color.saturation),
    } : { ...sends },
  };
}

function performanceControls(region, visual, x, speed, mix, accent = false, effectColor = null) {
  const role = region.instrument?.id || "lead_synth";
  if (COMPOSITION) return artworkControls(role, x, speed, mix, accent, effectColor);
  const source = visual || fallbackRegionVisual(region);
  const gems = gemsControlFeatures();
  const roleEffects = roleGemsEffects(role);
  const brightness = clampUnit(source.brightness, .5);
  const saturation = clampUnit(source.saturation, .35);
  const texture = clampUnit(source.texture, .25);
  const movement = clampUnit(clampUnit(speed) * .58 + gems.activation * .42);
  const sustained = role === "pad" || role === "strings";
  const plucked = role === "guitar" || role === "keys_mallet";
  const rhythmic = role === "drums" || role === "percussion_texture";
  const arrangement = currentArrangement();
  const color = arrangement.color;
  const [room, width, echo] = ROLE_FX[role] || [1,1,1];
  const liveFx = arrangement.production?.mode ? {
    reverb: clampUnit((arrangement.fx.reverb * .70 + roleEffects.reverb * .14 + (1-brightness)*.28) * room * state.effectTrims.reverb),
    chorus: clampUnit((arrangement.fx.chorus * .63 + roleEffects.chorus * .12 + saturation*.31) * width * state.effectTrims.chorus),
    delay: clampUnit((arrangement.fx.delay * .60 + roleEffects.delay * .12 + movement*.34 + texture*.09) * echo * state.effectTrims.delay),
    feedback: clampUnit((arrangement.fx.delay*.40 + texture*.26 + movement*.25) * state.effectTrims.feedback),
    chorusDepth: clampUnit((arrangement.fx.chorus*.56 + saturation*.33 + movement*.17) * state.effectTrims.chorusDepth),
    effectTone: clampUnit((.20 + brightness*.53 + texture*.20) * state.effectTrims.effectTone),
  } : null;
  return {
    movement: Number(movement.toFixed(4)),
    pan: Number(clampUnit(x, .5).toFixed(4)),
    expression: Number(clampUnit(mix, 1).toFixed(4)),
    harmonicIntensity: Number(clampUnit(
      .06 + gems.unease * .23 + gems.power * .10 + texture * .48 + saturation * .17,
    ).toFixed(4)),
    release: Number(clampUnit(
      .10 + (1 - gems.activation) * .18 + gems.sublimity * .25 + gems.sadness * .10 + (sustained ? .3 : 0) + (plucked ? -.08 : 0) + color.release,
    ).toFixed(4)),
    attack: Number(clampUnit(
      .05 + (1 - gems.activation) * .24 + gems.serenity * .16 + (sustained ? .36 : 0) + (rhythmic || plucked ? -.08 : 0) + color.attack,
    ).toFixed(4)),
    brightness: Number(clampUnit(
      .04 + brightness * .61 + gems.radiance * .17 + saturation * .08 + movement * .1
        + (role === "bass" && accent ? .17 : 0) + color.brightness,
    ).toFixed(4)),
    reverb: Number(clampUnit(
      .03 + roleEffects.reverb * .28 + arrangement.fx.reverb * .48 + (1-brightness) * .20,
    ).toFixed(4)),
    chorus: Number(clampUnit(
      .02 + roleEffects.chorus * .25 + arrangement.fx.chorus * .49 + saturation * .22,
    ).toFixed(4)),
    delay: Number(clampUnit(
      .02 + roleEffects.delay * .24 + arrangement.fx.delay * .45 + movement * .28,
    ).toFixed(4)),
    ...liveFx,
  };
}

function activeMusicVoices(scanning, region, scanRegions, pointerVisual = null, beatPosition = musicBeatPosition(scanning)) {
  const preview = state.regionPreview?.item;
  const exploring = !preview && !scanning;
  const entries = preview || scanning
    ? (preview ? [preview] : COMPOSITION ? scanRegions : scanRegions.slice(0, 5)).map((item) => ({
      region: item.region,
      x: item.x ?? state.scan.position,
      y: item.centroidY ?? .5,
      intensity: item.intensity ?? 1,
      visual: item,
      effectColor: preview ? null : item.effectColor,
      window: item.window,
      windows: item.windows,
    }))
    : pointerMusicLayers().map((item) => ({
        region: item.region,
        x: item.x,
        y: item.y,
        intensity: item.intensity,
        visual: item.visual,
        scanCutoffHz: item.scanCutoffHz,
      }));
  const roles = new Set();
  // When regions share an instrument, the strongest region drives its phrase and controls.
  const sources = exploring ? entries : [...entries].sort((a,b)=>b.intensity-a.intensity).filter(entry => {
      const role=entry.region.instrument?.id;
      if (roles.has(role)) return false;
      roles.add(role);
      return true;
    });
  return sources.map((entry) => {
    const mix = clampUnit(entry.intensity, 1);
    const eventSpeed = preview ? 0 : (scanning ? entry.intensity : state.pointer.speed);
    const visual = entry.visual || fallbackRegionVisual(entry.region);
    const cutoff = entry.scanCutoffHz ?? visual.scanCutoffHz;
    const effectColor = preview ? null : scanning ? entry.effectColor
      : entry.region === region ? pointerVisual?.effectColor ?? visual.effectColor : null;
    const event = musicEventForRegion(
      entry.region,
      entry.x,
      entry.y,
      beatPosition,
      eventSpeed,
      entry.intensity,
      false,
      visual,
    );
    return {
      regionId: entry.region.id,
      ...(entry.region.accompaniment && { accompaniment: true }),
      mix: Number(mix.toFixed(4)),
      instrument: entry.region.instrument?.label || "Lead Synth",
      instrumentId: entry.region.instrument?.id || "lead_synth",
      position: { x: entry.x, y: entry.y },
      window: entry.window,
      windows: entry.windows,
      ...event,
      controls: {
        ...performanceControls(entry.region, visual, entry.x, eventSpeed, mix, event.accent, effectColor),
        ...(cutoff !== undefined && { scanCutoffHz: cutoff }),
      },
    };
  });
}

function usesPointerPlayback() {
  // Link keeps the scan controls visible while the pointer runs its own transport.
  return state.mode === "pointer" || (state.link.enabled && !state.scan.playing);
}

function reverseAtBar(bar, scanning = !usesPointerPlayback()) {
  if (state.regionPreview) return false;
  if (scanning) {
    const localBar = bar - state.scan.beatOffset / 4;
    const route = state.scan.route;
    const segment = route.find(item => localBar < item.endBar) || route.at(-1);
    return Boolean(segment && segment.from > segment.to);
  }
  let reverse = false;
  for (const [changeBar, direction] of state.musicTimeline.directionChanges) {
    if (changeBar > bar) break;
    reverse = direction;
  }
  return reverse;
}

function musicBeatPosition(scanning = !usesPointerPlayback(), now = performance.now()) {
  if (state.regionPreview?.item) {
    return (now - state.regionPreview.startedAt) * state.music.bpm / 60000;
  }
  const seconds = scanning && state.scan.playing
    ? state.scan.startedFrom + (now - state.scan.startedAt) / 1000
    : (scanning ? state.scan.seconds : pointerMusicSeconds(now));
  return seconds * state.music.bpm / 60 + (scanning ? state.scan.beatOffset : 0);
}

function scheduleMusicEvents(voices, beatPosition, now = performance.now()) {
  const scheduler = state.scheduler;
  const scanning = !usesPointerPlayback();
  const preview = state.regionPreview?.item;
  const runningScan = scanning && state.scan.playing;
  const running = Boolean(preview) || (scanning ? runningScan : state.musicTimeline.running);
  const beatMs = 60000 / state.music.bpm;
  const anchor = preview ? state.regionPreview.startedAt : scanning
    ? state.scan.startedAt - state.scan.startedFrom * 1000 - state.scan.beatOffset * beatMs
    : state.musicTimeline.startedAt;
  const enabled = soundEngine.enabled;
  const signature = [state.manifest?.analysis_id, enabled, running, Math.round(anchor), preview?.region.id,
    state.music.bpm, state.music.root, state.music.mode, currentArrangement().id, running ? "" : beatPosition].join("|");
  if (signature !== scheduler.signature) {
    scheduler.signature = signature;
    scheduler.session++;
    scheduler.seen.clear();
    scheduler.active.clear();
  }
  const clockMs = (performance.timeOrigin ?? (Date.now() - now)) + now;
  const firstTick = Math.max(0, Math.ceil((beatPosition - 145 / beatMs) * 12 - 1e-6));
  const lastTick = Math.floor(beatPosition * 12 + 1e-6);
  const events = [];
  const active = new Set();
  const append = (voice, region, event, onset) => {
    const key = `${region.id}:${COMPOSITION ? onset.toFixed(6) : Math.round(onset * 12)}`;
    if (scheduler.seen.has(key)) return;
    scheduler.seen.set(key, { onset, regionId: region.id });
    const { x, y } = voice.position;
    events.push({
      ...voice,
      ...event,
      eventId: `${scheduler.session}:${key}`,
      onsetBeat: onset,
      scheduledAtMs: clockMs + (onset - beatPosition) * beatMs + (COMPOSITION ? 20 : 180),
      controls: {
        ...performanceControls(region, voice.timbre, x, voice.controls.movement, voice.mix, event.accent),
        ...(COMPOSITION && voice.controls.sends && { sends: voice.controls.sends }),
      },
    });
  };
  for (const voice of voices) {
    active.add(voice.regionId);
    const region = findMusicSource(voice.regionId);
    if (!region) continue;
    if (COMPOSITION && region.rhythmPhrase) {
      if (!enabled) continue;
      const {x,y}=voice.position;
      const request = state.scan.startRequest;
      const pointerEnd = !preview && request?.pointerAnchor === state.musicTimeline.startedAt ? request.takeoverBeat : Infinity;
      const windows = runningScan ? (voice.windows ?? (voice.window ? [voice.window] : [])) : [{ from: 0, to: pointerEnd }];
      for (const { from, to } of windows) {
        const scanStartBeat = runningScan ? state.scan.beatOffset + state.scan.startedFrom * 1000 / beatMs : 0;
        const since = Math.max(from, scanStartBeat, beatPosition - 95 / beatMs);
        const through = Math.min(to - 1e-7, beatPosition + 35 / beatMs);
        for (let bar = Math.max(0, Math.floor(since / 4)); bar <= Math.floor(through / 4); bar++) {
          const reverse = reverseAtBar(bar, scanning);
          phraseClipAtBar(region, bar, reverse).groups.forEach((group, i) => {
            const onset = bar * 4 + group.beat;
            if (onset < since - 1e-6 || onset > through + 1e-6 || onset >= to) return;
            const event = clipEvent(region, x, y, onset, i, voice.timbre, to - onset, reverse);
            if (event.notes.length) append(voice, region, event, onset);
          });
        }
      }
      continue;
    }
    let hasOnset = false;
    const { x, y } = voice.position;
    for (let tick = firstTick; tick <= lastTick; tick++) {
      const onset = tick / 12;
      const event = musicEventForRegion(region, x, y, onset + 1e-7,
        voice.controls.movement, voice.mix, false, voice.timbre);
      const inBar = positiveModulo(onset, 4);
      if (!event.notes.length || event.patternPositionBeats == null
        || Math.abs(event.patternPositionBeats - inBar) > .001) continue;
      hasOnset = true;
      append(voice, region, event, onset);
    }
    if (!scheduler.active.has(region.id) && !hasOnset && (!currentArrangement().source || !scanning || !running)) {
      const onset = Math.ceil(beatPosition * 4 - 1e-6) / 4;
      const event = musicEventForRegion(region, x, y, onset + 1e-7,
        voice.controls.movement, voice.mix, true, voice.timbre);
      if (event.notes.length) append(voice, region, event, onset);
    }
  }
  scheduler.active = active;
  for (const [key, event] of scheduler.seen) {
    if (event.onset < beatPosition - 2 || (!runningScan && !active.has(event.regionId))) scheduler.seen.delete(key);
  }
  return { transportId: `${performance.timeOrigin}:${scheduler.session}`, scheduledEvents: events };
}

function pointerMusicSeconds(now = performance.now()) {
  const timeline = state.musicTimeline;
  return timeline.running ? Math.max(0, (now - timeline.startedAt) / 1000) : 0;
}

async function ensurePerformanceSound() {
  const enabled = await soundEngine.setEnabled(true);
  if (enabled && usesPointerPlayback() && !state.regionPreview) updatePerformance(true);
  return enabled;
}

function withAudioTimeout(operation, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
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
    image.onerror = () => reject(new Error(url.startsWith("data:")
      ? "Could not load an image embedded in the preset." : `Could not load ${url}`));
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

function colorForEffects(rgb, values) {
  const hsv = rgbToHsv(...rgb);
  if (hsv.saturation < .12 || Math.max(...rgb) - Math.min(...rgb) < 15) return null;
  values.sort((a, b) => a - b);
  const percentile = fraction => {
    const position = (values.length - 1) * fraction;
    const lower = Math.floor(position);
    return values[lower] + (values[Math.ceil(position)] - values[lower]) * (position - lower);
  };
  return { ...hsv, contrast: percentile(.9) - percentile(.1) };
}

function scanEffectColor(region, nx) {
  const pixels = state.imagePixels;
  if (!pixels) return null;
  const x = Math.min(pixels.width - 1, Math.max(0, Math.floor(nx * pixels.width)));
  const cached = region.scanEffectColor;
  if (cached?.pixels === pixels && cached.x === x) return cached.color;
  const channels = [[], [], []];
  const values = [];
  const center = (x + .5) / pixels.width;
  for (let y = 0; y < pixels.height; y++) {
    const index = (y * pixels.width + x) * 4;
    if (pixels.data[index + 3] < 128 || !maskValue(region, center, (y + .5) / pixels.height)) continue;
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    channels[0].push(red);
    channels[1].push(green);
    channels[2].push(blue);
    values.push(Math.max(red, green, blue) / 255);
  }
  const color = values.length ? colorForEffects(channels.map(median), values) : null;
  region.scanEffectColor = { pixels, x, color };
  return color;
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

function sampleVisualAt(nx, ny, region) {
  const pixels = state.imagePixels;
  if (!pixels || !Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const centerX = Math.max(0, Math.min(pixels.width - 1, Math.round(nx * (pixels.width - 1))));
  const centerY = Math.max(0, Math.min(pixels.height - 1, Math.round(ny * (pixels.height - 1))));
  // The visible gaze ring is 32 CSS pixels across, including in fullscreen.
  const rect = canvas.getBoundingClientRect();
  const rx = Math.max(1, Math.round(16 * pixels.width / (rect.width || pixels.width)));
  const ry = Math.max(1, Math.round(16 * pixels.height / (rect.height || pixels.height)));
  const cached = state.pointer.sampleCache;
  if (cached && cached.pixels === pixels && cached.region === region && cached.x === centerX &&
      cached.y === centerY && cached.rx === rx && cached.ry === ry) return cached.visual;
  const stepX = Math.max(1, Math.ceil(rx / 12));
  const stepY = Math.max(1, Math.ceil(ry / 12));
  const reds = [];
  const greens = [];
  const blues = [];
  const luminance = [];
  const values = [];
  let edgeTotal = 0;
  function grayAt(x, y) {
    if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) return null;
    const index = (y * pixels.width + x) * 4;
    if (pixels.data[index + 3] < 128 || (region && !maskValue(region,
      (x + .5) / pixels.width, (y + .5) / pixels.height))) return null;
    return (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
  }
  for (let dy = -Math.floor(ry / stepY) * stepY; dy <= ry; dy += stepY) {
    for (let dx = -Math.floor(rx / stepX) * stepX; dx <= rx; dx += stepX) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      const x = centerX + dx;
      const y = centerY + dy;
      const gray = grayAt(x, y);
      if (gray === null) continue;
      const index = (y * pixels.width + x) * 4;
      edgeTotal += Math.abs((grayAt(x - 1, y) ?? gray) + (grayAt(x + 1, y) ?? gray)
        + (grayAt(x, y - 1) ?? gray) + (grayAt(x, y + 1) ?? gray) - 4 * gray);
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      reds.push(red);
      greens.push(green);
      blues.push(blue);
      luminance.push((.2126 * red + .7152 * green + .0722 * blue) / 255);
      values.push(Math.max(red, green, blue) / 255);
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
  const visual = {
    hue: hsv.hue,
    hueFamilyIndex: Math.floor(((hsv.hue + 1 / 16) % 1) * 8),
    saturation: hsv.saturation,
    brightness,
    texture: Math.min(1, contrast * 4.5),
    edgeDensity: Math.min(1, edgeTotal / reds.length / 32),
    colorRgb: [red, green, blue],
    effectColor: colorForEffects([red, green, blue], values),
  };
  state.pointer.sampleCache = { pixels, region, x: centerX, y: centerY, rx, ry, visual };
  return visual;
}

function buildScanProfile(hitData, width, height, imagePixels, fineDetail = false) {
  const profile = [];
  const yStep = fineDetail ? 1 : Math.max(1, Math.floor(height / 260));
  const halfSpan = Math.max(1, Math.floor(width / SCAN_PROFILE_BINS / 2));
  for (let bin = 0; bin < SCAN_PROFILE_BINS; bin++) {
    const centerX = Math.min(width - 1, Math.round(bin / (SCAN_PROFILE_BINS - 1) * (width - 1)));
    const xs = [Math.max(0, centerX - halfSpan), centerX, Math.min(width - 1, centerX + halfSpan)];
    let insideCount = 0;
    let sampleCount = 0;
    let yTotal = 0;
    let transitions = 0;
    let localEdges = 0;
    let edgeSamples = 0;
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
      let previousBrightness = 0;
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
          if (previousInside) {
            localEdges += Math.abs(brightness - previousBrightness);
            edgeSamples++;
          }
          previousBrightness = brightness;
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
      texture: Math.min(1, .24 * Math.min(1, transitions / 22)
        + .76 * Math.min(1, localEdges / Math.max(1, edgeSamples) * 5.5)),
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

function groupDetectedRegions(regions) {
  const byType = new Map();
  for (const region of regions) {
    const key = COMPOSITION && region.type ? region.type : region;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(region);
  }
  return [...byType.values()];
}

async function readMaskUnion(regions, urlKey, width, height) {
  const images = await Promise.all(regions.map(region => imageFromUrl(region[urlKey])));
  const canvas = document.createElement("canvas");
  canvas.width = width ?? images[0].naturalWidth;
  canvas.height = height ?? images[0].naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  const read = (image) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const union = read(images[0]);
  for (const image of images.slice(1)) {
    const { data } = read(image);
    // Mask hit testing and outlines both use the red channel.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > union.data[i]) union.data[i] = data[i];
    }
  }
  return union;
}

async function prepareMask(detections, imagePixels) {
  const first = detections[0];
  const merged = detections.length > 1;
  // Same-category masks may have disconnected parts. Keep their exact pixels.
  const alignedWidth = merged ? imagePixels.width : undefined;
  const alignedHeight = merged ? imagePixels.height : undefined;
  const [hitMask, mask] = await Promise.all([
    readMaskUnion(detections, "hit_mask_url", alignedWidth, alignedHeight),
    readMaskUnion(detections, "visual_mask_url", alignedWidth, alignedHeight),
  ]);
  const { data: hitData, width: hitWidth, height: hitHeight } = hitMask;
  const scanColumns = new Uint32Array(hitWidth);
  const colorTotal = [0, 0, 0];
  let area = 0;
  if (COMPOSITION) {
    for (let y = 0; y < hitHeight; y++) {
      for (let x = 0; x < hitWidth; x++) {
        const index = (y * hitWidth + x) * 4;
        if (hitData[index] <= 80) continue;
        scanColumns[x]++;
        if (merged) {
          area++;
          for (let channel = 0; channel < 3; channel++) colorTotal[channel] += imagePixels.data[index + channel];
        }
      }
    }
  }

  const region = merged ? {
    ...first,
    label: first.type_label || first.type.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()),
    color_rgb: area ? colorTotal.map(sum => Math.round(sum / area)) : first.color_rgb,
    area_ratio: area / (hitWidth * hitHeight),
    fine_detail: detections.some(detection => detection.fine_detail),
    sourceDetections: detections.map(({ id, label, default_instrument }) => ({ id, label, default_instrument })),
  } : first;

  // A light rim and a dark outer edge stay visible on both light and dark paint.
  const { data: maskData, width, height } = mask;
  const outlineCanvas = document.createElement("canvas");
  outlineCanvas.width = width;
  outlineCanvas.height = height;
  const outlineContext = outlineCanvas.getContext("2d");
  const outline = outlineContext.createImageData(width, height);
  const radius = Math.max(3, Math.round(Math.max(width, height) / 180));
  const outer = Math.max(1, Math.round(radius * .55));
  const tint = region.color_rgb.map((value, index) => value * .40 + [255, 250, 230][index] * .60);
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return maskData[(y * width + x) * 4] > 80;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (inside(x, y)) {
        const interior = inside(x - radius, y) && inside(x + radius, y)
          && inside(x, y - radius) && inside(x, y + radius);
        outline.data[index] = interior ? tint[0] : 255;
        outline.data[index + 1] = interior ? tint[1] : 249;
        outline.data[index + 2] = interior ? tint[2] : 224;
        outline.data[index + 3] = interior ? 70 : 255;
      } else if (inside(x - outer, y) || inside(x + outer, y)
        || inside(x, y - outer) || inside(x, y + outer)) {
        outline.data[index] = 25;
        outline.data[index + 1] = 22;
        outline.data[index + 2] = 32;
        outline.data[index + 3] = 235;
      }
    }
  }
  outlineContext.putImageData(outline, 0, 0);

  const scanProfile = buildScanProfile(hitData, hitWidth, hitHeight, imagePixels, region.fine_detail);
  const covered = scanProfile.reduce((sum, sample) => sum + sample.coverage, 0);
  const rhythmDensity = scanProfile.reduce((sum, sample) =>
    sum + sample.coverage * (sample.texture * .5 + sample.saturation * .25), 0) / Math.max(.001, covered);
  return {
    ...region,
    hitWidth,
    hitHeight,
    hitData,
    scanColumns,
    scanProfile,
    rhythmDensity: COMPOSITION ? COMPOSITION.detailDensity(hitData, hitWidth, hitHeight, imagePixels) : rhythmDensity,
    outlineCanvas,
  };
}

function fitCanvas() {
  if (!state.image) return;
  canvas.width = state.image.naturalWidth;
  canvas.height = state.image.naturalHeight;
  drawCanvas();
  positionScanOverlay();
}

function drawCanvas() {
  if (!state.image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  const preview = state.regionPreview?.item;
  const visibleRegions = preview ? [preview] : usesPointerPlayback()
    ? (state.activeRegion ? [{ region: state.activeRegion, intensity: 1 }] : [])
    : [...state.scan.regions];
  const linkedRegion = !preview && state.scan.playing && state.link.enabled ? state.link.region : null;
  if (linkedRegion && !visibleRegions.some(({ region }) => region === linkedRegion)) {
    visibleRegions.push({ region: linkedRegion, intensity: 1 });
  }
  for (const item of visibleRegions) {
    const region = item.region;
    ctx.save();
    ctx.globalAlpha = state.mode === "scan" && !COMPOSITION && !preview ? .32 + item.intensity * .55 : 1;
    ctx.drawImage(region.outlineCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  const pointerRegion = linkedRegion || (!preview && usesPointerPlayback() && state.activeRegion);
  if (pointerRegion && maskValue(pointerRegion, state.pointer.nx, state.pointer.ny)) {
    const size = Math.max(13, Math.min(canvas.width, canvas.height) * .018);
    ctx.save();
    ctx.strokeStyle = rgb(pointerRegion, .9);
    ctx.lineWidth = Math.max(1.5, canvas.width / 700);
    ctx.setLineDash([size * .42, size * .28]);
    ctx.beginPath();
    ctx.arc(state.pointer.nx * canvas.width, state.pointer.ny * canvas.height, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (state.mode === "scan" && state.scan.route.length) {
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

function updateRegionInstrumentControls() {
  const regions = new Map(state.regions.map((region) => [region.id, region]));
  for (const select of regionList.querySelectorAll(".region-instrument")) {
    const region = regions.get(select.dataset.region);
    const button = select.previousElementSibling;
    button.title = regionScanTitle(region);
    button.querySelector("small").textContent = region.type_label || region.instrument.label;
    select.value = region.instrument.id;
    for (const option of select.options) {
      const role = INSTRUMENTS_BY_ID.get(option.value);
      option.textContent = role.id === region.defaultInstrumentId ? `Auto · ${role.label}` : role.label;
    }
  }
}

function changeRegionInstrument(region, instrumentId) {
  const role = INSTRUMENT_ROLES.find((instrument) => instrument.id === instrumentId);
  if (!role || role.id === region.instrument.id) return;

  applyArtworkInstrument(region, role);

  // Cancel queued notes for the old instrument.
  state.scheduler.signature = null;
  const preview = state.regionPreview?.item;
  if (preview?.region === region) {
    state.regionPreview.startedAt = performance.now();
  }
  updateRegionInstrumentControls();
  rebuildBackingDrum();
  rebuildReverseArrangement();
  updateScanPathControls();
  if (state.activeRegion) activateRegion(state.activeRegion, false, false);
  if (state.scan.playing) setScanPosition(state.scan.seconds, true);
  else updatePerformance(true);
  showToast(`${region.label} → ${role.label}`);
}

function renderRegionList() {
  regionList.replaceChildren();
  $("#regionCount").textContent = state.regions.length;
  const help = $("#regionInstrumentHelp");
  if (help) help.hidden = !COMPOSITION || !state.regions.length;
  for (const region of state.regions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-chip";
    button.style.setProperty("--chip-color", rgb(region));
    button.dataset.region = region.id;
    button.setAttribute("aria-pressed", "false");
    const description = document.createElement("span");
    const name = document.createElement("strong");
    const instrument = document.createElement("small");
    name.textContent = region.label;
    instrument.textContent = (region.instrument?.label || "Lead Synth");
    description.append(name, instrument);
    button.append(document.createElement("i"), description);
    button.title = regionScanTitle(region);
    button.addEventListener("click", () => {
      if (usesPointerPlayback() && !state.eye.active) void focusMouseRegion(region);
      else void previewRegion(region);
    });
    if (COMPOSITION) {
      const card = document.createElement("div");
      card.className = "region-card";
      const select = document.createElement("select");
      select.className = "region-instrument";
      select.dataset.region = region.id;
      select.setAttribute("aria-label", `Instrument for ${region.label}`);
      select.setAttribute("aria-describedby", "regionInstrumentHelp");
      for (const role of INSTRUMENT_ROLES) {
        select.add(new Option(role.label, role.id));
      }
      select.addEventListener("change", () => changeRegionInstrument(region, select.value));
      card.append(button, select);
      regionList.append(card);
    } else {
      regionList.append(button);
    }
  }
  if (COMPOSITION) updateRegionInstrumentControls();
}

async function loadAnalysis(manifest) {
  setAnalysisProgress(92, "Preparing the interactive regions…");
  const imageUrl = manifest.image_url;
  const loadedImage = await imageFromUrl(imageUrl.startsWith("data:")
    ? imageUrl : `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${Date.now()}`);
  const imagePixels = readImagePixels(loadedImage);
  const groups = groupDetectedRegions(manifest.regions);
  const loadedRegions = await Promise.all(groups.slice(0, INSTRUMENT_ROLES.length)
    .map(detections => prepareMask(detections, imagePixels)));
  resetScan(false);
  resetPointerPlayback(true);
  soundEngine.clearRegionVoices();
  state.activeRegion = null;
  state.manifest = manifest;
  state.image = loadedImage;
  state.imagePixels = imagePixels;
  if (COMPOSITION) state.artworkMusic = COMPOSITION.artworkSettings(imagePixels, manifest.artist_statement, manifest.statement_colors);
  state.regions = assignArtworkRoles(loadedRegions);
  rebuildBackingDrum();
  rebuildScanRoute();
  state.scan.position = state.scan.route[0]?.from ?? 0;
  if (COMPOSITION) {
    const music = state.artworkMusic;
    musicBpm.value=String(music.bpm);
    musicRoot.value=music.root;
    musicMode.value=music.mode;
    applyMusicSettings(false);
    $("#artworkMusicDetails").textContent =
      `Tempo: ${music.tempoSource} · ${music.colors.map(color=>color.name+" ("+color.source+")").join(", ")}. Root: ${music.dominantHue || "no chromatic pixels"}. Average grayscale: ${music.grayscale.toFixed(1)} / 255.`;
  } else {
  state.gems = normalizeGemsProfile(manifest.gems_profile);
  renderGemsProfile();
  state.arrangement.choice = "auto";
  selectArrangement();
  renderArrangementChoice();
  const musicPlan = manifest.music_plan || null;
  if (musicPlan) {
    const [low, high] = currentArrangement().bpmRange;
    musicBpm.value = String(Math.max(low, Math.min(high, Math.round(Number(musicPlan.bpm) || 72))));
    musicRoot.value = NOTE_NAMES.includes(musicPlan.root) ? musicPlan.root : "D";
    musicMode.value = MUSIC_MODES[musicPlan.mode] ? musicPlan.mode : "dorian";
    applyMusicSettings(false);
  }
  $("#musicSourceStatus").textContent = `GEMS-9 · ${gemsProfileName()} · ${harmonyPlanSummary()}`;
  }
  rebuildReverseArrangement();
  $("#thumbImage").src = manifest.image_url;
  fitCanvas();
  renderRegionList();
  clearActiveRegion();
  updateScanControls();
  statusText.textContent = `${loadedRegions.length} regions are ready. Move across the image to explore.`;
  const preparationWarnings = manifest.preprocessing?.warnings || [];
  if (preparationWarnings.length) showToast(preparationWarnings[0]);
  updatePerformance(true);
}

function maskValue(region, nx, ny) {
  const x = Math.max(0, Math.min(region.hitWidth - 1, Math.floor(nx * region.hitWidth)));
  const y = Math.max(0, Math.min(region.hitHeight - 1, Math.floor(ny * region.hitHeight)));
  return region.hitData[(y * region.hitWidth + x) * 4] > 80;
}

function edgeProximity(region, nx, ny) {
  if (!maskValue(region, nx, ny)) return 0;
  const radii = [2, 5, 9, 15, 23];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [-.707, .707], [.707, -.707], [-.707, -.707]];
  for (let ri = 0; ri < radii.length; ri++) {
    const r = radii[ri];
    for (const [dx, dy] of directions) {
      const px = nx + dx * r / region.hitWidth;
      const py = ny + dy * r / region.hitHeight;
      if (px < 0 || py < 0 || px > 1 || py > 1 || !maskValue(region, px, py)) {
        return Number((1 - ri / radii.length * .82).toFixed(3));
      }
    }
  }
  return 0;
}

function regionAt(nx, ny) {
  let best = null;
  let bestScore = -Infinity;
  for (let index = 0; index < state.regions.length; index++) {
    const region = state.regions[index];
    if (!maskValue(region, nx, ny)) continue;
    // New analyses use mutually exclusive masks, so there is normally one
    // candidate. This specificity score is a compatibility fallback for old
    // saved analyses whose dilated masks overlap: a precise region should not
    // be hidden by a full-canvas wall or fill.
    const area = Math.max(.0001, Math.min(1, Number(region.area_ratio || .5)));
    const specificity = 1 - Math.sqrt(area);
    const confidence = Math.max(0, Math.min(1, Number(region.sam_scores?.[0] || 0)));
    const score = specificity * 2 + confidence * .25 + index * .0001;
    if (score > bestScore) {
      best = region;
      bestScore = score;
    }
  }
  return best;
}

function regionAtGaze(nx, ny) {
  const pixels = state.imagePixels;
  if (pixels) {
    const x = Math.min(pixels.width - 1, Math.max(0, Math.floor(nx * pixels.width)));
    const y = Math.min(pixels.height - 1, Math.max(0, Math.floor(ny * pixels.height)));
    if (pixels.data[(y * pixels.width + x) * 4 + 3] < 128) return null;
  }
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
    let nearest = Infinity;
    for (const [ox, oy] of offsets) {
      const px = nx + ox * radius / rect.width;
      const py = ny + oy * radius / rect.height;
      if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && maskValue(region, px, py)) {
        hits++;
        nearest = Math.min(nearest, Math.hypot(ox, oy));
      }
    }
    if (!hits) continue;
    const centerBonus = maskValue(region, nx, ny) ? 3.6 : 0;
    const area = Math.max(.0001, Math.min(1, Number(region.area_ratio || .5)));
    const specificity = 1 - Math.sqrt(area);
    const proximity = 1 - Math.min(1, nearest);
    const coverage = hits / offsets.length;
    const confidence = Math.max(0, Math.min(1, Number(region.sam_scores?.[0] || 0)));
    // Raw hit count previously allowed a large background mask to win every
    // gaze sample. Centre ownership and proximity now dominate; coverage has
    // only a small stabilising influence.
    const score = centerBonus + proximity * 2.2 + specificity * 1.6
      + coverage * .45 + confidence * .2 + index * .0001;
    if (score > bestScore) {
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

function scanCoverageThreshold(region) {
  return region.fine_detail ? .0015 : .006;
}

function regionScanTitle(region) {
  const behavior = region.instrument?.behavior || "Beat-synced melody";
  if (COMPOSITION) {
    const included = state.scan.ensemble.some((item) => item.region === region);
    const playback = usesScanBacking() ? "Low-pass filter opens near the scan line" : "Plays as the scan line crosses the region";
    const phrase = region.leadPhrase ? `\nLead phrase: ${region.leadPhrase.title}` : "";
    const parts = region.sourceDetections?.map(detection => detection.label).join("\n");
    return [behavior, included ? playback : "Outside the scan path", ...(parts ? [parts] : [])].join("\n") + phrase;
  }
  const covered = (sample) => sample.coverage > scanCoverageThreshold(region);
  const first = region.scanProfile.findIndex(covered);
  if (first < 0) return `${behavior}\nNo scan coverage`;
  const last = region.scanProfile.findLastIndex(covered);
  const binSeconds = state.scan.duration / (SCAN_PROFILE_BINS - 1);
  return `${behavior}\nFirst to last mask crossing · ${formatTime(first * binSeconds)}–${formatTime(last * binSeconds)}`;
}

function scanRegionsAt(nx) {
  const specificity = {
    graphic_line: .24, lettering: .2, figure_part: .18, depicted_object: .16, abstract_shape: .16,
    paint_texture: .08, figure: .04, painted_ground: 0, exposed_support: -.03,
    outline: .24, face: .18, detail: .16, symbol: .16, gesture: .13, drip: .1, texture: .08, fill: 0, wall: -.03,
  };
  return state.regions
    .map((region) => {
      const sample = scanProfileAt(region, nx);
      const intensity = Math.min(1, Math.sqrt(sample.coverage * 3.2));
      return { region, ...sample, intensity, score: intensity + (specificity[region.type] || 0) };
    })
    .filter((item) => item.coverage > scanCoverageThreshold(item.region))
    .sort((a, b) => b.score - a.score || b.texture - a.texture);
}

function resetScanCrossfade() {
  state.scan.regionMix.clear();
  state.scan.lastMixAt = 0;
  state.scan.voiceRegions = [];
}

function resetPointerPlayback(clearInput = false) {
  const pointer = state.pointer;
  if (clearInput) {
    pointer.insideArtwork = false;
    pointer.pinnedRegion = null;
  }
  pointer.fadeEndsAt = null;
  pointer.regions = [];
  pointer.lastMixAt = 0;
  state.musicTimeline.startedAt = 0;
  state.musicTimeline.running = false;
  state.musicTimeline.directionChanges.clear();
  pointer.directionAnchor = null;
  soundEngine.setPointerEnvelope(usesPointerPlayback() ? 0 : 1);
}

function backingCutoffHz(opening) {
  return 900 * (20000 / 900) ** opening;
}

function usesScanBacking() {
  return state.link.enabled || state.scan.voiceMode === "backing";
}

function setLinkedRegion(region) {
  if (state.link.region === region) return;
  state.link.region = region;
  syncRegionButtons();
  drawCanvas();
}

function resetLinkedFocus() {
  state.link.region = null;
  state.link.focus.clear();
  state.link.lastAt = 0;
}

function linkedScanVoices(items, now) {
  const link = state.link;
  if (state.eye.active && (!state.eye.calibrated || now - state.eye.lastResultAt >= EYE_RESULT_TIMEOUT_MS ||
      (state.eye.outsideArtworkSince !== null && now - state.eye.outsideArtworkSince >= EYE_REGION_RELEASE_MS))) {
    setLinkedRegion(null);
  }
  const delta = link.lastAt ? Math.min(.12, (now - link.lastAt) / 1000) : 0;
  link.lastAt = now;
  const focusedRole = link.region?.instrument?.id;
  if (focusedRole && !link.focus.has(focusedRole)) link.focus.set(focusedRole, 0);
  for (const [role, value] of link.focus) {
    if (role === focusedRole) link.focus.set(role, Math.min(1, value + delta / EYE_FILTER_OPEN_SECONDS));
    else if (value > delta / EYE_FILTER_CLOSE_SECONDS) link.focus.set(role, value - delta / EYE_FILTER_CLOSE_SECONDS);
    else link.focus.delete(role);
  }
  const local = link.region && sampleVisualAt(state.pointer.nx, state.pointer.ny, link.region);
  const cutoffs = new Map();
  for (const item of items) {
    const role = item.region.instrument?.id;
    const focus = link.focus.get(role) ?? 0;
    const gazeCutoff = backingCutoffHz(focus * focus * (3 - 2 * focus));
    cutoffs.set(role, Math.max(cutoffs.get(role) ?? 0, item.scanCutoffHz ?? 0, gazeCutoff));
  }
  return items.map(item => item.region.accompaniment ? item : {
    ...item,
    scanCutoffHz: cutoffs.get(item.region.instrument?.id),
    effectColor: focusedRole === item.region.instrument?.id && local ? local.effectColor : item.effectColor,
  });
}

function scanColumn(region, x) {
  return Math.min(region.scanColumns.length - 1, Math.floor(x * region.scanColumns.length));
}

function rebuildBackingDrum() {
  if (!COMPOSITION) return;
  const available = state.regions.length > 0 && !state.regions.some(region => region.instrument.id === "drums");
  if (available && !state.backingDrum) {
    const region = applyArtworkInstrument({
      id: "backing-drums",
      label: "Backing Drums",
      accompaniment: true,
      rhythmDensity: .1,
      color_rgb: [128, 128, 128],
    }, INSTRUMENTS_BY_ID.get("drums"));
    const visual = fallbackRegionVisual(region);
    state.backingDrum = { region, ...visual, visual, intensity: .58, x: .5, y: .5, centroidY: .5 };
  }
  if (!available) state.backingDrum = null;
  $("#backingDrumStatus").hidden = !available;
}

function pointerMusicLayers() {
  const drum = state.musicTimeline.running && state.backingDrum;
  return drum ? [...state.pointer.regions, drum] : state.pointer.regions;
}

function findMusicSource(id) {
  return state.regions.find(region => region.id === id)
    || (id === state.backingDrum?.region.id ? state.backingDrum.region : undefined);
}

function rebuildScanRoute() {
  if (!STUDIO) return;
  const bounds = COMPOSITION ? STUDIO.scan.scanRegionBounds(state.regions) : [0, 1];
  const durationBars = state.scan.duration * state.music.bpm / 240;
  setScanRoute(STUDIO.scan.buildScanRoute(state.scan.pathMode, state.scan.ranges, bounds,
    COMPOSITION ? durationBars : undefined));
}

function setScanRoute(route) {
  state.scan.route = route;
  if (!COMPOSITION) return;
  const durationBars = state.scan.duration * state.music.bpm / 240;
  const joins = STUDIO.scan.artworkPanelJoins(state.manifest);
  const endBar = route.at(-1)?.endBar ?? 0;
  state.scan.ensemble = state.regions.map((region) => {
    const { passages, peakColumn } = STUDIO.scan.planRegionScan(route, region.scanColumns, joins);
    const sample = peakColumn < 0 ? regionPeakSample(region)
      : regionPlaybackSample(region, (peakColumn + .5) / region.scanColumns.length);
    return { ...sample, passages, bars: STUDIO.scan.quantizePassages(passages, durationBars, endBar) };
  });
}

function updateScanEnsemble(nx) {
  const now = performance.now();
  const delta = state.scan.lastMixAt ? Math.min(.12, (now - state.scan.lastMixAt) / 1000) : 0;
  state.scan.lastMixAt = now;
  const beatSeconds = 60 / state.music.bpm;
  const offset = state.scan.beatOffset;
  const end = offset + 4 * (state.scan.route.at(-1)?.endBar ?? 0);
  const beat = state.scan.seconds / beatSeconds;
  const progress = state.scan.seconds / state.scan.duration;
  const backing = usesScanBacking();
  const focused = [];
  state.scan.voiceRegions = state.scan.ensemble.flatMap((reference) => {
    const { region } = reference;
    if (!reference.passages.length && !state.link.enabled) return [];
    const passage = reference.passages.find(({ from, to }) => progress >= from && progress < to);
    const coverage = passage ? region.scanColumns[scanColumn(region, nx)] / region.hitHeight : 0;
    const emphasis = Math.min(1, Math.sqrt(coverage * 3.2));
    const proximity = backing ? STUDIO.scan.scanProximity(reference.passages, progress, state.scan.duration) : 1;
    const target = backing ? FILTERED_BACKING_LEVEL : .76 + emphasis * .24;
    const previous = state.scan.regionMix.get(region.id) ?? target;
    const ramp = delta / (target > previous ? .10 : .32);
    const level = previous + Math.sign(target - previous) * Math.min(Math.abs(target - previous), ramp);
    state.scan.regionMix.set(region.id, level);
    let sample = reference;
    if (coverage) {
      const local = scanProfileAt(region, nx);
      sample = { ...(local.coverage ? local : reference), region, x: nx };
      focused.push({ ...sample, intensity: emphasis });
    }
    const windows = backing ? [{ from: offset, to: end }] : reference.bars
      .filter(span => beat + .05 / beatSeconds >= span.from * 4 && beat - .1 / beatSeconds < span.to * 4)
      .map(span => ({ from: offset + span.from * 4, to: offset + span.to * 4 }));
    if (!windows.length) {
      state.scan.regionMix.delete(region.id);
      return [];
    }
    const scanCutoffHz = backing ? backingCutoffHz(proximity) : undefined;
    return [{ ...sample, intensity: level, windows, scanCutoffHz,
      effectColor: scanEffectColor(region, nx) }];
  }).sort((a, b) => b.intensity - a.intensity);
  const drum = state.backingDrum;
  if (drum) state.scan.voiceRegions.push({ ...drum, windows: [{ from: offset, to: end }] });
  state.scan.regions = focused.sort((a, b) => b.intensity - a.intensity);
}

function scanMusicRegions(now = performance.now()) {
  if (!COMPOSITION || !state.scan.playing) return state.scan.regions;
  return state.link.enabled ? linkedScanVoices(state.scan.voiceRegions, now) : state.scan.voiceRegions;
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

function regionPlaybackSample(region, x) {
  const sample = scanProfileAt(region, x);
  const fallback = fallbackRegionVisual(region);
  return {
    region,
    ...sample,
    x,
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

function regionPeakSample(region) {
  const profile = region.scanProfile;
  const peak = profile.reduce((best, sample, index) => sample.coverage > profile[best].coverage ? index : best, 0);
  return regionPlaybackSample(region, profile[peak].coverage ? peak / (profile.length - 1) : .5);
}

async function focusMouseRegion(region) {
  if (state.analyzing) return;
  const pointer = state.pointer;
  if (pointer.pinnedRegion === region) {
    pointer.pinnedRegion = null;
    clearActiveRegion(false);
    updatePerformance(true);
    return;
  }
  stopRegionPreview();
  pointer.pinnedRegion = region;
  pointer.insideArtwork = false;
  pointer.speed = 0;
  const visual = regionPeakSample(region);
  pointer.nx = visual.x;
  pointer.ny = visual.centroidY;
  activateRegion(region, false, false);
  await ensurePerformanceSound();
}

async function previewRegion(region) {
  if (state.analyzing) return;
  if (state.scan.playing || state.scan.startRequest) {
    showToast("Pause the scan to preview a region");
    return;
  }
  if (state.regionPreview?.region === region) {
    stopRegionPreview();
    return;
  }
  const preview = { region, item: null, startedAt: 0 };
  state.regionPreview = preview;
  if (usesPointerPlayback()) resetPointerPlayback(true);
  clearActiveRegion(false);
  updatePerformance(true);
  await ensurePerformanceSound();
  if (state.regionPreview !== preview) return;
  if (!soundEngine.enabled) {
    stopRegionPreview();
    return;
  }
  preview.item = regionPeakSample(region);
  soundEngine.setScanEnvelope();
  if (usesPointerPlayback()) soundEngine.setPointerEnvelope(1);
  activateRegion(region, false, false);
  preview.startedAt = performance.now();
  updatePerformance(true);
}

function stopRegionPreview() {
  if (!state.regionPreview) return;
  state.regionPreview = null;
  if (usesPointerPlayback()) resetPointerPlayback(true);
  clearActiveRegion();
  updatePerformance(true);
}

function syncRegionButtons() {
  const activeIds = state.mode === "scan" && state.scan.playing
    ? new Set(state.scan.regions.filter((item) => COMPOSITION || item.intensity > .06).map((item) => item.region.id))
    : new Set(state.activeRegion ? [state.activeRegion.id] : []);
  if (!state.regionPreview && state.scan.playing && state.link.region) activeIds.add(state.link.region.id);
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
  syncRegionButtons();
  if (region) {
    regionBadge.hidden = false;
    regionBadge.style.setProperty("--region-color", rgb(region));
    $("#regionType").textContent = (region.instrument?.label || "Lead Synth").toUpperCase();
    $("#regionName").textContent = region.label;
    $("#currentRegion").textContent = state.regionPreview?.item ? `Previewing ${region.label}` : region.label;
  }
  drawCanvas();
  if (fromList) updatePerformance(true);
}

function clearActiveRegion(stopSound = true) {
  state.activeRegion = null;
  state.enteredAt = 0;
  regionBadge.hidden = true;
  const direction = usesPointerPlayback()
    ? (state.pointer.source === "gaze" ? "Look across the artwork" : "Move over the artwork")
    : (state.scan.playing ? "No region at the scan line" : "Start the scan or select a region");
  $("#currentRegion").textContent = state.regions.length ? direction : "Waiting for analysis";
  syncRegionButtons();
  if (stopSound) soundEngine.leave();
  drawCanvas();
}

function renderAutomaticControls(voices, now, force = false) {
  if (!state.setupComplete || (!force && now - state.lastControlDisplayAt < 100)) return;
  state.lastControlDisplayAt = now;
  const panel = $("#automaticControls");
  if (!panel || panel.closest(".section-collapsed")) return;
  const focus = state.link.enabled ? state.link.region ?? state.activeRegion : state.activeRegion;
  const first = soundEngine.enabled
    ? voices.find(voice => voice.regionId === focus?.id || voice.instrumentId === focus?.instrument?.id) ?? voices[0]
    : null;
  const active = Boolean(first);
  panel.dataset.active = String(active);
  const status = active ? `${first.instrument} · ${voices.length} active ${voices.length===1?"voice":"voices"}`
    : "Start playback or explore a region to see its controls.";
  const label = $("#automaticControlStatus");
  if (label.textContent !== status) label.textContent = status;
  for (const meter of panel.querySelectorAll("[data-auto-control]")) {
    const name = meter.dataset.autoControl;
    const value = active ? Math.round(100 * clampUnit(
      meter.dataset.autoSource === "fx" ? (first.controls.sends?.[name] ?? soundEngine.effectMemory[name]) : first.controls[name])) : 0;
    if (meter.value !== value) meter.value = value;
    const output = meter.nextElementSibling;
    const text = active ? `${value}%` : "—";
    if (output.textContent !== text) output.textContent = text;
  }
}

function performanceFrame(now = performance.now()) {
  const region = state.activeRegion;
  const preview = state.regionPreview?.item;
  const scanning = !usesPointerPlayback();
  const pointerVisual = !preview && !scanning && region
    ? sampleVisualAt(state.pointer.nx, state.pointer.ny, region)
    : null;
  const x = preview?.x ?? (scanning ? state.scan.position : state.pointer.nx);
  const y = preview?.centroidY ?? (scanning ? (state.scan.regions[0]?.centroidY ?? .5) : state.pointer.ny);
  const speed = preview ? 0 : scanning ? (state.scan.playing ? 1 / state.scan.duration : 0) : state.pointer.speed;
  const edge = !preview && !scanning && region ? edgeProximity(region, state.pointer.nx, state.pointer.ny) : 0;
  const scanRegions = scanMusicRegions(now);
  const beat = musicBeatPosition(scanning, now);
  const activeVoices = activeMusicVoices(scanning, region, scanRegions, pointerVisual, beat);
  const scheduled = scheduleMusicEvents(activeVoices, beat, now);
  return { x, y, speed, edge, preview, scanning, scanRegions, activeVoices, ...scheduled };
}

function updatePerformance(force = false) {
  const now = performance.now();
  if (!force && now - state.lastPerformanceAt < 45) return;
  state.lastPerformanceAt = now;
  if (usesPointerPlayback() && !state.regionPreview) updatePointerPlayback(now);
  const frame = performanceFrame(now);
  updateActiveRegionSource();
  $("#xValue").textContent = frame.x.toFixed(3);
  $("#yValue").textContent = frame.y.toFixed(3);
  $("#speedValue").textContent = frame.speed.toFixed(2);
  $("#edgeValue").textContent = frame.edge.toFixed(2);
  if (frame.preview || frame.scanning) {
    soundEngine.updateScan(
      frame.preview ? [frame.preview] : frame.scanRegions,
      frame.x,
      state.scan.seconds,
      state.scan.playing,
      frame.scheduledEvents,
      frame.transportId,
      frame.activeVoices,
    );
  } else {
    soundEngine.updatePointer(frame);
  }
  renderAutomaticControls(frame.activeVoices, now, force);
}

class SoundEngine {
  constructor() {
    this.enabled = false;
    this.audioStartRequest = null;
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
    this.rightDelay = null;
    this.rightDelayFeedback = null;
    this.delayWet = null;
    this.reverbWet = null;
    this.chorusWet = null;
    this.chorusDepths = [];
    this.effectMemory = { reverb: .3, chorus: .3, delay: .3, movement: 0, feedback: .32, chorusDepth: .3, effectTone: .5 };
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
    this.audioEpochMs = null;
    this.transportId = null;
    this.fmNode = null;
    this.setupPromise = null;
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
  async setEnabled(enabled) {
    if (!enabled) {
      this.audioStartRequest = null;
      return this.applyEnabled(false);
    }
    if (this.enabled && this.context?.state === "running") return true;
    if (this.audioStartRequest) return this.audioStartRequest.promise;
    const request = {};
    this.audioStartRequest = request;
    request.promise = this.startAudio(request);
    return request.promise;
  }
  async startAudio(request) {
    try {
      const ready = this.setup();
      const context = this.context;
      // Call resume during the click, before awaiting the worklet.
      const resume = new Promise((resolve) => {
        resolve(context && context.state !== "running" ? context.resume() : undefined);
      });
      await withAudioTimeout(Promise.all([ready, resume]), 2200, "Browser sound did not start in time");
      if (this.audioStartRequest !== request) return false;
      if (context?.state !== "running") throw new Error("Browser sound is paused");
      this.syncAudioClock();
      return this.applyEnabled(true);
    } catch (error) {
      if (this.audioStartRequest !== request) return false;
      this.applyEnabled(false);
      showToast(`Could not start Web Audio: ${error.message || error}`);
      return false;
    } finally {
      if (this.audioStartRequest === request) this.audioStartRequest = null;
    }
  }
  syncAudioClock() {
    this.audioEpochMs = (performance.timeOrigin ?? (Date.now() - performance.now()))
      + performance.now() - this.context.currentTime * 1000;
    if (state.mode === "scan" && state.scan.playing) {
      this.setScanEnvelope((musicBeatPosition(true) - state.scan.beatOffset) * this.beatSeconds(), true);
    }
  }
  applyEnabled(enabled) {
    if (this.enabled === enabled) return this.enabled;
    this.enabled = enabled;
    if (!this.enabled) this.stopScan();
    if (this.enabled && !usesPointerPlayback()) {
      this.updateScan(scanMusicRegions(), state.scan.position, state.scan.seconds, state.scan.playing);
    }
    if (this.enabled && usesPointerPlayback() && state.activeRegion) {
      this.enter(state.activeRegion, state.pointer.nx, state.pointer.ny);
    }
    if (!this.enabled) {
      this.fmNode?.port.postMessage({ type: "clear" });
    }
    return this.enabled;
  }
  setup() {
    if (this.setupPromise) return this.setupPromise;
    if (this.fmNode) return;
    this.setupPromise = this.setupAudioGraph().catch((error) => {
      const context = this.context;
      this.context = null;
      this.fmNode = null;
      this.masterGain = null;
      if (context && context.state !== "closed") {
        void context.close().catch(() => {});
      }
      throw error;
    }).finally(() => {
      this.setupPromise = null;
    });
    return this.setupPromise;
  }
  async setupAudioGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = this.context = new AudioContextClass();
    context.addEventListener("statechange", () => {
      if (this.context === context && this.enabled && context.state === "running") this.syncAudioClock();
    });
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
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .12;
    this.delayWet = this.context.createGain();
    this.delayWet.gain.value = .16;
    const convolver = this.context.createConvolver();
    const reverbSeconds = 2.1;
    const impulse = this.context.createBuffer(2, this.context.sampleRate * reverbSeconds, this.context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.8);
      }
    }
    convolver.buffer = impulse;
    this.reverbWet = this.context.createGain();
    this.reverbWet.gain.value = .12;
    const wetFilter = this.context.createBiquadFilter();
    wetFilter.type = "highpass";
    wetFilter.frequency.value = 190;
    await withAudioTimeout(
      context.audioWorklet.addModule("/static/fm-worklet.js?v=performance-mix1"),
      2000,
      "The browser sound engine did not load in time",
    );
    this.fmNode = new AudioWorkletNode(this.context, "street-art-fm", {
      numberOfInputs: 0,
      numberOfOutputs: COMPOSITION ? 4 : 1,
      outputChannelCount: COMPOSITION ? [2, 2, 2, 2] : [2],
    });
    this.syncInstrumentPatches();
    this.fmNode.connect(this.musicBus);
    this.musicBus.connect(this.masterGain);
    const connectEffect = (input, sendOutput) => {
      if (COMPOSITION) this.fmNode.connect(input, sendOutput);
      else this.musicBus.connect(input);
    };
    const delayLine = beats => {
      const delay = context.createDelay(2);
      delay.delayTime.value = this.beatSeconds() * beats;
      const feedback = context.createGain();
      feedback.gain.value = .24;
      const damping = context.createBiquadFilter();
      damping.type = "lowpass";
      damping.frequency.value = 4200;
      delay.connect(damping).connect(feedback).connect(delay);
      return { delay, feedback };
    };
    ({ delay: this.delay, feedback: this.delayFeedback } = delayLine(COMPOSITION ? .5 : .75));
    this.delayWet.connect(wetFilter);
    if (COMPOSITION) {
      ({ delay: this.rightDelay, feedback: this.rightDelayFeedback } = delayLine(1));
      const split = context.createChannelSplitter(2);
      const stereo = context.createChannelMerger(2);
      connectEffect(split, 1);
      split.connect(this.delay, 0);
      split.connect(this.rightDelay, 1);
      this.delay.connect(stereo, 0, 0);
      this.rightDelay.connect(stereo, 0, 1);
      stereo.connect(this.delayWet);
    } else {
      connectEffect(this.delay, 1);
      this.delay.connect(this.delayWet);
    }
    connectEffect(convolver, 2);
    convolver.connect(this.reverbWet).connect(wetFilter);
    const wetDamping = this.wetDamping = this.context.createBiquadFilter();
    wetDamping.type = "lowpass";
    wetDamping.frequency.value = 6800;
    wetFilter.connect(wetDamping).connect(this.masterGain);
    // True stereo chorus: two short, independently modulated delay lines.
    // High-passing the wet input protects the mono kick and bass foundation.
    const chorusFilter = this.context.createBiquadFilter();
    chorusFilter.type = "highpass";
    chorusFilter.frequency.value = 500;
    connectEffect(chorusFilter, 3);
    this.chorusWet = this.context.createGain();
    this.chorusWet.gain.value = .035;
    this.chorusWet.connect(this.masterGain);
    this.chorusDepths = [];
    for (const [index, rate] of [.23, .31].entries()) {
      const line = this.context.createDelay(.08);
      line.delayTime.value = .019 + index * .007;
      const lfo = this.context.createOscillator();
      lfo.frequency.value = rate;
      const depth = this.context.createGain();
      depth.gain.value = .0012;
      lfo.connect(depth).connect(line.delayTime);
      const side = this.context.createStereoPanner();
      side.pan.value = index === 0 ? -.85 : .85;
      chorusFilter.connect(line).connect(side).connect(this.chorusWet);
      lfo.start();
      this.chorusDepths.push(depth);
    }
    this.scanGate = this.context.createGain();
    this.pointerGate = this.context.createGain();
    this.pointerGate.gain.value = usesPointerPlayback() ? 0 : 1;
    this.masterGain.connect(this.compressor).connect(this.scanGate).connect(this.pointerGate).connect(this.context.destination);
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
    this.syncFMMixes([]);
    this.lastPointerEventId = null;
  }
  syncFMMixes(items) {
    if (!this.fmNode) return;
    this.fmNode.port.postMessage({
      type: "mix",
      regions: items.map((item) => ({
        id: item.region.id,
        mix: clampUnit(item.intensity) * fmInstrumentVolume(item.region),
        scanCutoffHz: item.scanCutoffHz,
      })),
    });
  }
  applyControlFrame(events) {
    if (!this.context) return;
    const weight = event => Math.max(.001, clampUnit(event.controls?.expression, event.mix ?? 1));
    const total = events.reduce((sum, event) => sum + weight(event), 0);
    const layered = Boolean(COMPOSITION || currentArrangement().production?.mode);
    if (COMPOSITION) {
      // Send levels already travel with individual voices. These are shared return settings.
      Object.assign(this.effectMemory, {
        reverb: state.effectTrims.reverb, chorus: state.effectTrims.chorus, delay: state.effectTrims.delay,
        feedback: .44 * state.effectTrims.feedback, chorusDepth: .42 * state.effectTrims.chorusDepth,
        effectTone: .52 * state.effectTrims.effectTone,
      });
    } else {
      const effectNames = ["reverb", "chorus", "delay", "movement"];
      if (layered) effectNames.push("feedback","chorusDepth","effectTone");
      for (const name of effectNames) {
        if (events.length) this.effectMemory[name] = events.reduce(
          (sum, event) => sum + clampUnit(event.controls?.[name], this.effectMemory[name]) * weight(event), 0,
        ) / total;
      }
    }
    const average = name => this.effectMemory[name];
    const now = this.context.currentTime;
    // Keep wet effects audible during the phrase and let them bloom in gaps.
    const activity = events.length
      ? Math.max(...events.map((event) => clampUnit(event.controls?.expression, event.mix ?? 1)))
      : 0;
    const duck = 1 - activity * .18;
    const reverb = layered ? average("reverb") * .85 * duck : .04 + average("reverb") * .63 * duck;
    const delay = layered ? average("delay") * .80 * duck : .025 + average("delay") * .61 * duck;
    this.reverbWet?.gain.setTargetAtTime(reverb, now, .16);
    this.delayWet?.gain.setTargetAtTime(delay, now, .12);
    this.chorusWet?.gain.setTargetAtTime(layered ? average("chorus") * .54 : .018 + average("chorus") * .32, now, .18);
    if (layered) this.wetDamping?.frequency.setTargetAtTime(800 + 10200 * average("effectTone"), now, .18);
    for (const depth of this.chorusDepths) {
      depth.gain.setTargetAtTime(layered ? .008 * average("chorusDepth") : .0007 + average("chorus") * .005 + average("movement") * .0015, now, .22);
    }
    const delaySeconds = COMPOSITION ? this.beatSeconds() * .5
      : Math.max(.12, Math.min(1.15, this.beatSeconds() * currentArrangement().fx.delayBeats));
    if (this.lastDelaySeconds !== delaySeconds) {
      this.delay?.delayTime.setTargetAtTime(delaySeconds, now, .12);
      this.rightDelay?.delayTime.setTargetAtTime(delaySeconds * 2, now, .12);
      this.lastDelaySeconds = delaySeconds;
    }
    const feedback = layered ? average("feedback") * .68 : .15 + average("delay") * .42;
    this.delayFeedback?.gain.setTargetAtTime(feedback, now, .08);
    this.rightDelayFeedback?.gain.setTargetAtTime(feedback, now, .08);
  }
  syncInstrumentPatches(role = null) {
    if (!this.fmNode) return;
    const roles = role ? [role] : Object.keys(FM_SOUND);
    for (const id of roles) {
      this.fmNode.port.postMessage({ type: "instrument-patch", role: id, values: FM_SOUND[id].patch });
    }
  }
  applyVoiceFrame(events) {
    this.fmNode?.port.postMessage({
      type: "expression",
      regions: events.map(event => ({id:event.regionId, controls:event.controls})),
    });
  }
  updatePointer({ activeVoices, scheduledEvents, x, speed, transportId }) {
    if (!this.enabled) return;
    this.syncFMMixes(pointerMusicLayers());
    this.applyControlFrame(activeVoices);
    this.applyVoiceFrame(activeVoices);
    this.playSharedEvents(scheduledEvents, x, speed, transportId);
  }
  playSharedEvents(events, nx, speed, transportId = null) {
    if (transportId !== this.transportId) {
      this.transportId = transportId;
      this.lastVoiceEvents.clear();
      this.fmNode?.port.postMessage({ type: "cancel" });
    }
    const activeRegionIds = new Set();
    for (const event of events) {
      const region = findMusicSource(event.regionId);
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
    const controls = event.controls || performanceControls(region, event.timbre, nx, speed, event.mix ?? 1);
    const pan = Math.max(-.82, Math.min(.82, clampUnit(controls.pan, nx) * 1.64 - .82));
    const duration = Math.max(.045, event.durationBeats * this.beatSeconds());
    const velocity = Math.max(.08, Math.min(1, event.velocity / 127));
    const chordScale = event.notes.length > 1 ? .86 / Math.sqrt(event.notes.length) : 1;
    const startTime = Number.isFinite(event.scheduledAtMs) && this.audioEpochMs != null
      ? (event.scheduledAtMs - this.audioEpochMs) / 1000 : null;
    event.notes.forEach((note, index) => {
      this.fmNode?.port.postMessage({
        type: "note",
        ...(startTime != null ? { time: startTime } : {}),
        role,
        note,
        onsetBeat: event.onsetBeat,
        duration: event.noteDurations?.[note] != null ? event.noteDurations[note] * this.beatSeconds() : duration,
        velocity: event.noteVelocities
          ? Math.max(.08, Math.min(1, event.noteVelocities[note] / 127)) * (COMPOSITION ? chordScale : 1)
          : velocity * chordScale,
        regionId: region.id,
        pan: Math.max(-.9, Math.min(.9, pan + (index - (event.notes.length - 1) / 2) * .09)),
        speed: Math.max(0, Math.min(1, speed)),
        kind: event.eventKind || "note",
        accent: event.accent,
        slide: event.slide,
        wobbleRate: event.wobbleRate,
        genre: currentArrangement().source ? currentArrangement().familyId : undefined,
        production: currentArrangement().production,
        beatSeconds: this.beatSeconds(),
        ...(!COMPOSITION && { visual: event.timbre ?? { brightness: .5, saturation: .35, texture: 0, hue: 0 } }),
        controls,
        gemsWeights: COMPOSITION ? "artwork" : state.gems.weights,
      });
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
  updateScan(regions, nx, seconds, playing = true, events = [], transportId = null, activeVoices = []) {
    if (!this.enabled || !this.context) return;
    this.syncFMMixes(regions);
    this.applyControlFrame(activeVoices);
    this.applyVoiceFrame(activeVoices);
    // Both outputs use the timestamped events in the WebSocket frame.
    // UI refreshes update region mixes without deciding note-on timing.
    this.playSharedEvents(events, nx, state.scan.playing ? 1 / Math.max(1, state.scan.duration) : 0, transportId);
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
  setScanEnvelope(seconds = null, smooth = false) {
    if (!this.scanGate || !this.context) return;
    const now = this.context.currentTime;
    const gain = this.scanGate.gain;
    const currentLevel = gain.value;
    gain.cancelScheduledValues(now);
    if (seconds === null) {
      gain.setValueAtTime(currentLevel, now);
      gain.setTargetAtTime(1, now, .015);
      return;
    }
    const duration = state.scan.duration;
    const position = Math.min(duration, Math.max(0, seconds));
    const remaining = duration - position;
    const fadeIn = state.scan.skipFadeIn ? 0 : Math.min(PERFORMANCE_FADE_IN_SECONDS, duration / 2);
    const fadeOut = Math.min(PERFORMANCE_FADE_OUT_SECONDS, duration - fadeIn);
    const fadeOutStart = duration - fadeOut;
    // Rejoin the envelope smoothly after a seek without moving the end time.
    const transition = smooth ? Math.min(.025, remaining) : 0;
    const envelopePosition = position + transition;
    const level = clampUnit(Math.min(fadeIn ? envelopePosition / fadeIn : 1, (duration - envelopePosition) / fadeOut));
    if (transition) {
      gain.setValueAtTime(currentLevel, now);
      gain.linearRampToValueAtTime(level, now + transition);
    } else {
      gain.setValueAtTime(level, now);
    }
    if (envelopePosition < fadeIn) gain.linearRampToValueAtTime(1, now + fadeIn - position);
    if (fadeOutStart > fadeIn && envelopePosition < fadeOutStart) {
      gain.setValueAtTime(1, now + fadeOutStart - position);
    }
    if (remaining > transition) gain.linearRampToValueAtTime(0, now + remaining);
  }
  setPointerEnvelope(level, seconds = 0, restart = false) {
    if (!this.pointerGate || !this.context) return;
    const now = this.context.currentTime;
    const gain = this.pointerGate.gain;
    const current = gain.value;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(seconds ? current : level, now);
    if (seconds) {
      const dip = restart && current > 0 ? .025 : 0;
      if (dip) gain.linearRampToValueAtTime(0, now + dip);
      gain.linearRampToValueAtTime(level, now + dip + seconds);
    }
  }
  stopScan() {
    if (!this.context) return;
    this.syncFMMixes([]);
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
    this.fmNode?.port.postMessage({ type: "clear" });
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
  return Math.max(COMPOSITION ? Math.max(5,Math.ceil(240/state.music.bpm)) : 5, Math.min(MAX_MUSIC_DURATION, Math.round(seconds)));
}

function updateScanInstruction() {
  if (state.link.enabled && usesPointerPlayback()) {
    $("#modeEyebrow").textContent = "LINK · EXPLORE";
    $("#modeInstruction").textContent = "Explore with your mouse or eyes. Start the scan to play together.";
    return;
  }
  const path = state.scan.pathMode;
  $("#modeEyebrow").textContent = state.link.enabled ? "LINKED SCAN" : path === "reverse" ? "RIGHT-TO-LEFT SCAN"
    : path === "roundtrip" ? "ROUND-TRIP SCAN" : path === "custom" ? "CUSTOM SCAN" : "LEFT-TO-RIGHT SCAN";
  $("#modeInstruction").textContent = path === "custom"
    ? `Scan the selected ranges over ${formatTime(state.scan.duration)}`
    : `Scan across the detected regions over ${formatTime(state.scan.duration)}`;
}

function updateScanPathControls() {
  if (!STUDIO) return;
  const { pathMode, ranges, editingRanges, playing } = state.scan;
  const custom = pathMode === "custom";
  $("#scanDirection").value = pathMode;
  $("#scanVoiceMode").value = usesScanBacking() ? "backing" : "crossing";
  $("#scanVoiceMode").disabled = state.link.enabled;
  $("#drawScanRanges").setAttribute("aria-pressed", String(editingRanges));
  $("#drawScanRanges").textContent = editingRanges ? "Done selecting" : "Select ranges";
  $("#undoScanRange").hidden = $("#clearScanRanges").hidden = playing || !custom || !ranges.length;
  const status = $("#scanPathStatus");
  status.hidden = !state.image;
  const segmentCount = custom ? ranges.length : pathMode === "roundtrip" ? 2 : 1;
  status.textContent = COMPOSITION && segmentCount && !state.scan.route.length
    ? `Set duration to at least ${formatTime(Math.ceil(segmentCount * 240 / state.music.bpm))} for ${segmentCount} segments.`
    : COMPOSITION && playing && editingRanges ? "Drag left or right to queue a range on a bar line."
    : COMPOSITION && playing ? "Use Select ranges to add a range while the scan plays."
    : !custom ? "Drag across the artwork to draw a custom path."
    : editingRanges || !ranges.length ? "Drag across the artwork to add a range. Click its arrow to reverse it."
    : `${ranges.length} ${ranges.length === 1 ? "range" : "ranges"} · played in selection order`;
  canvasShell.classList.toggle("selecting-scan-ranges", state.mode === "scan" && editingRanges);
}

function setScanPath(mode) {
  if (!STUDIO) return;
  state.scan.pathMode = mode;
  if (mode !== "custom") setScanRangeEditing(false);
  rebuildScanRoute();
  updateRegionInstrumentControls();
  resetScan(false);
  renderScanRanges();
}

function setScanRangeEditing(editing) {
  if (!STUDIO) return;
  state.scan.editingRanges = editing;
  if (editing && state.link.enabled) setLinkedRegion(null);
  if (!editing) cancelScanRange();
  if (editing && !(COMPOSITION && state.scan.playing)) {
    if (state.scan.pathMode !== "custom") setScanPath("custom");
    else if (state.scan.playing || state.scan.startRequest) pauseScan();
  }
  updateScanPathControls();
  renderScanRanges();
}

function positionScanOverlay() {
  if (!STUDIO) return;
  const overlay = $("#scanRangeOverlay");
  if (overlay.hidden) return;
  const image = canvas.getBoundingClientRect();
  const shell = canvasShell.getBoundingClientRect();
  overlay.style.left = `${image.left - shell.left - canvasShell.clientLeft}px`;
  overlay.style.top = `${image.top - shell.top - canvasShell.clientTop}px`;
  overlay.style.width = `${image.width}px`;
  overlay.style.height = `${image.height}px`;
}

function setRangeBounds(element, range) {
  element.style.left = `${Math.min(range.from, range.to) * 100}%`;
  element.style.width = `${Math.abs(range.to - range.from) * 100}%`;
}

function renderScanRanges() {
  if (!STUDIO) return;
  const overlay = $("#scanRangeOverlay");
  const ranges = state.scan.pathMode === "custom" ? state.scan.ranges : [];
  const liveRanges = state.scan.route.filter(range => range.live);
  overlay.hidden = !state.image || state.mode !== "scan"
    || (!state.scan.editingRanges && !ranges.length && !liveRanges.length);
  overlay.replaceChildren();
  if (overlay.hidden) return;
  for (const [index, range] of [...ranges, ...liveRanges].entries()) {
    const band = document.createElement("div");
    band.className = "scan-range-band";
    band.style.setProperty("--range-color", ["#e57253", "#6f9bce", "#d6af4f", "#7db19a"][index % 4]);
    setRangeBounds(band, range);
    const editable = !range.live && !state.scan.playing;
    const direction = document.createElement(editable ? "button" : "span");
    direction.className = "scan-range-direction";
    direction.style.top = `${20 + index % 4 * 32}px`;
    direction.textContent = `${range.live ? `Live ${index - ranges.length + 1}` : index + 1} ${range.to > range.from ? "→" : "←"}`;
    if (editable) {
      direction.type = "button";
      direction.dataset.rangeIndex = String(index);
      direction.title = `Reverse range ${index + 1}`;
      direction.setAttribute("aria-label", `Range ${index + 1}, ${range.to > range.from ? "left to right" : "right to left"}. Reverse direction`);
      direction.addEventListener("click", () => {
        state.scan.ranges[index] = { from: range.to, to: range.from };
        setScanPath("custom");
        overlay.querySelector(`[data-range-index="${index}"]`)?.focus({ preventScroll: true });
      });
    }
    band.append(direction);
    overlay.append(band);
  }
  positionScanOverlay();
}

function beginScanRange(event, position) {
  if (state.scan.draftRange || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  state.scan.draftRange = {
    from: position.nx, to: position.nx, pointerId: event.pointerId,
    clientX: event.clientX, element: null,
  };
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (_) { /* Window listeners still track the drag within the page. */ }
}

function moveScanRange(event) {
  const draft = state.scan.draftRange;
  if (!draft || draft.pointerId !== event.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  draft.to = clampUnit((event.clientX - rect.left) / rect.width);
  if (!draft.element) {
    if (Math.abs(event.clientX - draft.clientX) < 4) return;
    if (!state.scan.playing && state.scan.ranges.length >= STUDIO.scan.MAX_SCAN_RANGES) {
      cancelScanRange();
      showToast("Undo or clear a range before adding more.");
      return;
    }
    if (!state.scan.editingRanges) setScanRangeEditing(true);
    draft.element = document.createElement("div");
    draft.element.className = "scan-range-band scan-range-draft";
    $("#scanRangeOverlay").append(draft.element);
  }
  event.preventDefault();
  setRangeBounds(draft.element, draft);
}

function cancelScanRange() {
  const draft = state.scan.draftRange;
  if (!draft) return;
  state.scan.draftRange = null;
  draft.element?.remove();
  if (canvas.hasPointerCapture(draft.pointerId)) canvas.releasePointerCapture(draft.pointerId);
}

function finishScanRange(event) {
  const draft = state.scan.draftRange;
  if (!draft || draft.pointerId !== event.pointerId) return;
  moveScanRange(event);
  if (state.scan.draftRange !== draft) return;
  cancelScanRange();
  if (!draft.element) {
    if (!state.scan.editingRanges && !usesPointerPlayback()) void seekScanFromArtwork(draft.from);
    return;
  }
  if (Math.abs(draft.from - draft.to) < STUDIO.scan.MIN_SCAN_RANGE) return;
  const range = { from: draft.from, to: draft.to };
  if (COMPOSITION && state.scan.playing) {
    queueLiveScanRange(range);
    return;
  }
  state.scan.ranges.push(range);
  setScanPath("custom");
}

function queueLiveScanRange(range) {
  const { route, duration, startedAt, startedFrom } = state.scan;
  if (route.filter(segment => segment.live).length >= STUDIO.scan.MAX_SCAN_RANGES) {
    showToast("This scan already has the maximum number of live ranges.");
    return;
  }
  const seconds = startedFrom + (performance.now() - startedAt) / 1000;
  const barsPerSecond = state.music.bpm / 240;
  // The scheduler can already have queued notes 35 ms ahead of the playhead.
  const nextBar = Math.floor((seconds + .05) * barsPerSecond) + 1;
  const updated = STUDIO.scan.insertScanRange(route, range, nextBar, duration * barsPerSecond);
  if (!updated) {
    showToast("Too few whole bars remain to add this range.");
    return;
  }
  setScanRoute(updated);
  renderScanRanges();
  setScanPosition(seconds, true);
  showToast(range.from < range.to ? "Left-to-right range queued." : "Right-to-left range queued.");
}

function setScanDuration(value, announce = true) {
  const duration = parseDuration(value);
  if (duration === null) {
    scanDuration.value = formatTime(state.scan.duration);
    showToast("Use MM:SS, for example 00:30, 01:00, or 10:00");
    return;
  }
  const progress = state.scan.duration ? state.scan.seconds / state.scan.duration : 0;
  if (COMPOSITION && (state.scan.playing || state.scan.startRequest)) pauseScan();
  state.scan.duration = duration;
  state.scan.seconds = Math.min(duration, progress * duration);
  if (COMPOSITION) {
    rebuildScanRoute();
    renderScanRanges();
    state.scan.seconds = snapScanSeconds(state.scan.seconds);
  }
  scanDuration.value = formatTime(duration);
  scanTimeline.max = String(duration);
  for (const chip of regionList.querySelectorAll(".region-chip")) {
    const region = state.regions.find((item) => item.id === chip.dataset.region);
    if (region) chip.title = regionScanTitle(region);
  }
  if (state.mode === "scan") updateScanInstruction();
  if (state.scan.playing) {
    state.scan.startedAt = performance.now();
    state.scan.startedFrom = state.scan.seconds;
    soundEngine.setScanEnvelope(state.scan.seconds, true);
  }
  setScanPosition(state.scan.seconds, true);
  updateScanControls();
  if (announce) statusText.textContent = `Scan duration set to ${formatTime(duration)}.`;
}

function snapScanSeconds(seconds, round = Math.round) {
  if (!COMPOSITION || seconds >= state.scan.duration) return seconds;
  const barSeconds = 240 / state.music.bpm;
  const lastBar = state.scan.route.at(-1)?.endBar ?? 0;
  return Math.min(lastBar, round(seconds / barSeconds + 1e-8)) * barSeconds;
}

function updateScanControls() {
  scanPlay.disabled = !state.regions.length || !state.scan.route.length || state.analyzing || Boolean(state.scan.startRequest);
  scanReset.disabled = !state.regions.length || state.analyzing;
  scanPlay.classList.toggle("playing", state.scan.playing);
  scanPlay.setAttribute("aria-pressed", String(state.scan.playing));
  scanPlay.querySelector("span").textContent = state.scan.startRequest ? "Starting…"
    : state.scan.playing
    ? "Pause"
    : (state.scan.seconds > 0 ? "Resume" : "Start");
  scanReadout.hidden = state.mode !== "scan";
  canvasShell.classList.toggle("scanning", state.mode === "scan");
  if (state.mode === "scan") updateScanInstruction();
  updateActiveRegionSource();
  updateScanPathControls();
}

function setScanPosition(seconds, forcePublish = false) {
  state.scan.seconds = Math.max(0, Math.min(state.scan.duration, Number(seconds) || 0));
  const progress = state.scan.seconds / state.scan.duration;
  const point = STUDIO ? STUDIO.scan.scanPoint(state.scan.route, progress) : { x: progress, index: 0 };
  if (!COMPOSITION && state.scan.segmentIndex !== point.index) resetScanCrossfade();
  state.scan.segmentIndex = point.index;
  state.scan.position = point.x;
  if (state.scan.playing) {
    if (COMPOSITION) updateScanEnsemble(state.scan.position);
    else state.scan.regions = crossfadedScanRegionsAt(state.scan.position);
  } else {
    state.scan.regions = [];
  }
  const primary = state.scan.regions[0]?.region || null;
  if (primary) activateRegion(primary, false, false);
  else if (state.regionPreview?.item || usesPointerPlayback()) drawCanvas();
  else clearActiveRegion(false);
  scanTimeline.value = String(state.scan.seconds);
  const fill = `${progress * 100}%`;
  scanTimeline.style.setProperty("--scan-fill", fill);
  const current = formatTime(state.scan.seconds);
  scanTime.textContent = `${current} / ${formatTime(state.scan.duration)}`;
  $("#canvasScanTime").textContent = current;
  updatePerformance(forcePublish);
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
    pauseScan(true);
    statusText.textContent = `The ${formatTime(state.scan.duration)} scan is complete.`;
    return;
  }
  setScanPosition(seconds);
  state.scan.animationFrame = requestAnimationFrame(scanFrame);
}

async function playScan() {
  if (!state.regions.length || !state.scan.route.length || state.analyzing || state.scan.playing || state.scan.startRequest) return;
  if (state.scan.editingRanges) setScanRangeEditing(false);
  if (state.mode !== "scan") setInteractionMode("scan");
  stopRegionPreview();
  const request = {};
  state.scan.startRequest = request;
  updateScanControls();
  const enabled = await ensurePerformanceSound();
  if (state.scan.startRequest !== request) return;
  if (!enabled) {
    state.scan.startRequest = null;
    updateScanControls();
    return;
  }
  let scanStart = performance.now();
  let takeoverBeat = null;
  if (COMPOSITION && state.link.enabled && state.musicTimeline.running) {
    const barMs = 240000 / state.music.bpm;
    request.pointerAnchor = state.musicTimeline.startedAt;
    request.takeoverBeat = 4 * (Math.floor((scanStart + 40 - request.pointerAnchor) / barMs) + 1);
    if (state.pointer.fadeEndsAt !== null) {
      state.pointer.fadeEndsAt = null;
      soundEngine.setPointerEnvelope(1, .08);
    }
    const boundary = request.pointerAnchor + request.takeoverBeat / 4 * barMs;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, boundary - performance.now())));
    if (state.scan.startRequest !== request) return;
    scanStart = performance.now();
    if (state.link.enabled && request.pointerAnchor === state.musicTimeline.startedAt) {
      scanStart = boundary;
      takeoverBeat = request.takeoverBeat;
    }
  }
  state.scan.startRequest = null;
  if (state.scan.seconds >= state.scan.duration) {
    if (state.scan.route.some(segment => segment.live)) rebuildScanRoute();
    state.scan.seconds = 0;
    state.scan.beatOffset = 0;
    soundEngine.resetScanEvents();
  }
  state.scan.seconds = snapScanSeconds(state.scan.seconds, Math.floor);
  const routeBeat = 4 * Math.round(state.scan.seconds * state.music.bpm / 240);
  state.scan.beatOffset = takeoverBeat === null ? state.scan.beatOffset : takeoverBeat - routeBeat;
  state.scan.engaged = true;
  resetScanCrossfade();
  const exploring = usesPointerPlayback();
  state.scan.playing = true;
  if (exploring) {
    state.link.region = state.activeRegion;
    resetPointerPlayback(true);
  }
  state.scan.startedAt = scanStart;
  state.scan.startedFrom = state.scan.seconds;
  state.scan.skipFadeIn = takeoverBeat !== null && state.scan.seconds === 0;
  soundEngine.setScanEnvelope(state.scan.seconds, takeoverBeat !== null);
  state.scan.lastFrameAt = 0;
  updateScanControls();
  renderScanRanges();
  setScanPosition(state.scan.seconds, true);
  statusText.textContent = `Scanning over ${formatTime(state.scan.duration)}.`;
  cancelAnimationFrame(state.scan.animationFrame);
  state.scan.animationFrame = requestAnimationFrame(scanFrame);
}

function pauseScan(completed = false) {
  if (!completed || state.link.enabled) soundEngine.setScanEnvelope();
  if (state.scan.playing && state.scan.editingRanges) setScanRangeEditing(false);
  state.scan.startRequest = null;
  state.scan.playing = false;
  state.regionPreview = null;
  state.scan.regions = [];
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  resetScanCrossfade();
  resetLinkedFocus();
  if (state.link.enabled) resetPointerPlayback(true);
  clearActiveRegion(false);
  updateScanControls();
  renderScanRanges();
  updatePerformance(true);
}

function resetScan(showMessage = true) {
  soundEngine.setScanEnvelope();
  if (state.scan.playing && state.scan.editingRanges) setScanRangeEditing(false);
  state.scan.startRequest = null;
  state.scan.playing = false;
  if (state.scan.route.some(segment => segment.live)) rebuildScanRoute();
  state.scan.engaged = state.mode === "scan";
  state.scan.position = state.scan.route[0]?.from ?? 0;
  state.scan.segmentIndex = state.scan.route.length ? 0 : -1;
  state.scan.seconds = 0;
  state.scan.beatOffset = 0;
  state.scan.skipFadeIn = false;
  state.scan.regions = [];
  state.regionPreview = null;
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  soundEngine.resetScanEvents();
  resetScanCrossfade();
  resetLinkedFocus();
  if (state.link.enabled) resetPointerPlayback(true);
  scanTimeline.value = "0";
  scanTimeline.style.setProperty("--scan-fill", "0%");
  scanTime.textContent = `00:00 / ${formatTime(state.scan.duration)}`;
  $("#canvasScanTime").textContent = "00:00";
  updateScanControls();
  renderScanRanges();
  clearActiveRegion();
  updatePerformance(true);
  if (showMessage && state.regions.length) statusText.textContent = "The scan is reset to the start of the path.";
}

function setInteractionMode(mode) {
  if (!['pointer', 'scan'].includes(mode)) return;
  if (mode === "scan" && !state.link.enabled && (state.eye.active || state.eye.starting)) stopEyeTracking(false);
  if (mode === "pointer") {
    pauseScan();
    setScanRangeEditing(false);
    state.scan.engaged = false;
    state.mode = "pointer";
    resetPointerPlayback(true);
    clearActiveRegion();
    statusText.textContent = state.pointer.source === "gaze"
      ? "Eye tracking is active. Look across the artwork."
      : "Pointer exploration is active. Move across the artwork.";
  } else {
    stopRegionPreview();
    state.mode = "scan";
    state.scan.engaged = true;
    if (!state.link.enabled) {
      state.pointer.source = "mouse";
      clearActiveRegion();
      resetPointerPlayback(true);
    }
    setScanPosition(state.scan.seconds, true);
    statusText.textContent = `Set a duration, then start the ${formatTime(state.scan.duration)} scan.`;
  }
  pointerMode.classList.toggle("active", mode === "pointer");
  scanMode.classList.toggle("active", mode === "scan");
  pointerMode.setAttribute("aria-pressed", String(mode === "pointer"));
  scanMode.setAttribute("aria-pressed", String(mode === "scan"));
  performanceScreen.classList.toggle("pointer-mode", mode === "pointer");
  performanceScreen.classList.toggle("scan-mode", mode === "scan");
  pointerControls.hidden = mode !== "pointer" && !state.link.enabled;
  scanControls.hidden = mode !== "scan";
  if (mode === "pointer") {
    $("#modeEyebrow").textContent = "POINTER / GAZE";
    $("#modeInstruction").textContent = "Move across the image with a mouse or your eyes";
  }
  renderScanRanges();
  interactionModeSwitch.querySelector("span").textContent = mode === "pointer" ? "Scan" : "Mouse / Eye";
  interactionModeSwitch.title = mode === "pointer" ? "Switch to Artwork Scan" : "Switch to Mouse / Eye Tracking";
  interactionModeSwitch.setAttribute("aria-label", interactionModeSwitch.title);
  updateScanControls();
  drawCanvas();
  updatePerformance(true);
}

function setLinkedMode(enabled) {
  const link = state.link;
  if (link.enabled === enabled) return;
  link.enabled = enabled;
  linkToggle.setAttribute("aria-pressed", String(enabled));
  linkToggle.querySelector("span").textContent = enabled ? "Link On" : "Link Off";
  linkToggle.title = enabled
    ? "Turn off Link and return to Scan"
    : "Turn on Link to use mouse or gaze focus during the scan";
  interactionModeSwitch.hidden = link.enabled;
  pointerFullscreen.hidden = link.enabled;
  performanceScreen.classList.toggle("linked-mode", link.enabled);
  if (link.enabled) {
    if (state.mode === "pointer") {
      setInteractionMode("scan");
    } else if (!state.scan.playing) {
      stopRegionPreview();
      resetPointerPlayback(true);
    }
    if (!state.scan.playing) soundEngine.setScanEnvelope();
  } else {
    resetLinkedFocus();
    if (!state.scan.playing) resetPointerPlayback(true);
    if (state.eye.active || state.eye.starting) stopEyeTracking(false);
  }
  pointerControls.hidden = !link.enabled && state.mode !== "pointer";
  updateRegionInstrumentControls();
  updateScanControls();
  setScanPosition(state.scan.seconds, true);
}

scanPlay.addEventListener("click", () => state.scan.playing ? pauseScan() : playScan());
linkToggle?.addEventListener("click", () => {
  const enabled = !state.link.enabled;
  setLinkedMode(enabled);
  if (enabled && !state.scan.playing) void ensurePerformanceSound();
});
scanReset.addEventListener("click", () => resetScan());
if (STUDIO) {
  $("#scanDirection").addEventListener("change", (event) => {
    setScanPath(event.target.value);
    if (event.target.value === "custom" && !state.scan.ranges.length) setScanRangeEditing(true);
  });
  $("#scanVoiceMode").addEventListener("change", ({ target }) => {
    state.scan.voiceMode = target.value === "backing" ? "backing" : "crossing";
    resetScanCrossfade();
    state.scheduler.signature = null;
    updateRegionInstrumentControls();
    updateScanPathControls();
    setScanPosition(state.scan.seconds, true);
  });
  $("#drawScanRanges").addEventListener("click", () => setScanRangeEditing(!state.scan.editingRanges));
  $("#undoScanRange").addEventListener("click", () => {
    state.scan.ranges.pop();
    setScanPath("custom");
  });
  $("#clearScanRanges").addEventListener("click", () => {
    state.scan.ranges = [];
    setScanPath("custom");
    setScanRangeEditing(true);
  });
  window.addEventListener("pointermove", moveScanRange, { passive: false });
  window.addEventListener("pointerup", finishScanRange);
  window.addEventListener("pointercancel", (event) => {
    if (state.scan.draftRange?.pointerId === event.pointerId) cancelScanRange();
  });
  window.addEventListener("blur", cancelScanRange);
  const scanOverlayObserver = new ResizeObserver(positionScanOverlay);
  scanOverlayObserver.observe(canvas);
  scanOverlayObserver.observe(canvasShell);
}
scanTimeline.addEventListener("input", async () => {
  if (!state.regions.length) return;
  const seconds = snapScanSeconds(Number(scanTimeline.value));
  await ensurePerformanceSound();
  if (state.scan.playing) {
    state.scan.startedAt = performance.now();
    state.scan.startedFrom = seconds;
    soundEngine.setScanEnvelope(seconds, true);
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
  void ensurePerformanceSound();
  showToast("Mouse / Eye Tracking mode ready");
});
scanMode.addEventListener("click", (event) => {
  event.stopPropagation();
  setInteractionMode("scan");
  setSetupVisible(false);
  showToast("Artwork Scan mode ready");
});
interactionModeSwitch.addEventListener("click", () => {
  const nextMode = state.mode === "pointer" ? "scan" : "pointer";
  setInteractionMode(nextMode);
  if (nextMode === "pointer") void ensurePerformanceSound();
  showToast(nextMode === "pointer" ? "Mouse / Eye Tracking mode ready" : "Artwork Scan mode ready");
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = (event.clientX - rect.left) / rect.width;
  const ny = (event.clientY - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx, ny };
}

function updateActiveRegionSource() {
  const exploring = usesPointerPlayback();
  const source = exploring ? state.pointer.source.toUpperCase() : state.link.enabled ? "LINK" : "SCAN";
  const playing = exploring ? state.musicTimeline.running : state.scan.playing;
  const bar = Math.floor(musicBeatPosition(!exploring) / 4);
  const take = COMPOSITION && playing && !state.regionPreview ? (reverseAtBar(bar, !exploring) ? " · B ←" : " · A →") : "";
  const label = `ACTIVE REGION · ${source}${take}`;
  const element = $("#signalLabel");
  if (element.textContent !== label) element.textContent = label;
}

function updateExplorePosition(nx, ny, source) {
  const exploring = usesPointerPlayback();
  if (!state.regions.length || state.analyzing || (!exploring && !state.link.enabled) ||
      state.regionPreview || state.scan.editingRanges || state.scan.draftRange) return;
  const now = performance.now();
  const delta = Math.max(16, now - state.pointer.lastTime);
  const distance = Math.hypot(nx - state.pointer.nx, ny - state.pointer.ny);
  const sensitivity = source === "gaze" ? 430 : 950;
  state.pointer.speed = Math.min(source === "gaze" ? .72 : 1, distance / delta * sensitivity);
  state.pointer.nx = nx;
  state.pointer.ny = ny;
  state.pointer.lastTime = now;
  state.pointer.source = source;
  if (source === "mouse" && exploring) {
    state.pointer.insideArtwork = true;
    state.pointer.pinnedRegion = null;
  }
  if (COMPOSITION && exploring) {
    const anchor = state.pointer.directionAnchor ?? nx;
    state.pointer.directionAnchor = anchor;
    if (Math.abs(nx - anchor) >= POINTER_DIRECTION_DISTANCE) {
      state.pointer.directionAnchor = nx;
      if (state.musicTimeline.running) {
        // Allow for the notes already queued just before the next downbeat.
        const nextBar = Math.floor(musicBeatPosition(false, now + 40) / 4) + 1;
        state.musicTimeline.directionChanges.set(nextBar, nx < anchor);
      }
    }
  }
  updateActiveRegionSource();
  const region = source === "gaze" ? regionAtGaze(nx, ny) : regionAt(nx, ny);
  if (source === "gaze") updateGazeRegion(region, now);
  else if (!exploring) setLinkedRegion(region);
  else if (region?.id !== state.activeRegion?.id) region ? activateRegion(region) : clearActiveRegion(false);
  if (exploring) updatePerformance(soundEngine.enabled && !state.musicTimeline.running);
}

function resetEyeRegionStability() {
  state.eye.candidateRegionId = null;
  state.eye.candidateSince = 0;
  state.eye.outsideSince = 0;
}

function updatePointerPlayback(now) {
  if (!soundEngine.enabled || !state.regions.length || (state.eye.active && !state.eye.calibrated)) return;
  const eye = state.eye;
  const pointer = state.pointer;
  const timeline = state.musicTimeline;
  const fresh = now - eye.lastResultAt < EYE_RESULT_TIMEOUT_MS;
  const inside = eye.active ? fresh && eye.outsideArtworkSince === null
    : pointer.insideArtwork || Boolean(pointer.pinnedRegion);
  if (inside && (!timeline.running || pointer.fadeEndsAt !== null)) {
    soundEngine.setPointerEnvelope(1, PERFORMANCE_FADE_IN_SECONDS, pointer.fadeEndsAt !== null);
    pointer.fadeEndsAt = null;
    timeline.directionChanges.clear();
    pointer.directionAnchor = pointer.nx;
    timeline.startedAt = now;
    timeline.running = true;
    pointer.lastMixAt = now;
    pointer.regions = state.regions.map(region => {
      const visual = regionPeakSample(region);
      return { region, visual, x: visual.x, y: visual.centroidY, intensity: FILTERED_BACKING_LEVEL, focus: 0 };
    });
  }
  if (!timeline.running) return;
  const waitingForScan = state.link.enabled && state.scan.startRequest?.pointerAnchor === timeline.startedAt;
  const outside = !inside && !waitingForScan && (!eye.active || !fresh || now - eye.outsideArtworkSince >= EYE_REGION_RELEASE_MS);
  if (outside && pointer.fadeEndsAt === null) {
    pointer.fadeEndsAt = now + PERFORMANCE_FADE_OUT_SECONDS * 1000;
    soundEngine.setPointerEnvelope(0, PERFORMANCE_FADE_OUT_SECONDS);
    clearActiveRegion(false);
  }
  if (pointer.fadeEndsAt !== null) {
    if (now >= pointer.fadeEndsAt) resetPointerPlayback();
    return;
  }
  const delta = Math.min(.12, (now - pointer.lastMixAt) / 1000);
  pointer.lastMixAt = now;
  const focused = state.activeRegion;
  for (const item of pointer.regions) {
    item.focus = item.region === focused
      ? Math.min(1, item.focus + delta / EYE_FILTER_OPEN_SECONDS)
      : Math.max(0, item.focus - delta / EYE_FILTER_CLOSE_SECONDS);
    const opening = item.focus * item.focus * (3 - 2 * item.focus);
    item.scanCutoffHz = backingCutoffHz(opening);
  }
  pointer.regions.sort((a, b) => Number(b.region === focused) - Number(a.region === focused));
}

function updateGazeRegion(region, now = performance.now()) {
  const exploring = usesPointerPlayback();
  const active = exploring ? state.activeRegion : state.link.region;
  if (region?.id === active?.id) {
    resetEyeRegionStability();
    return;
  }
  if (!region) {
    state.eye.candidateRegionId = null;
    state.eye.candidateSince = 0;
    if (!active) return;
    if (!state.eye.outsideSince) state.eye.outsideSince = now;
    if (now - state.eye.outsideSince >= EYE_REGION_RELEASE_MS) {
      if (exploring) clearActiveRegion(false);
      else setLinkedRegion(null);
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
    if (exploring) activateRegion(region);
    else setLinkedRegion(region);
    resetEyeRegionStability();
  }
}

canvas.addEventListener("pointermove", (event) => {
  if (state.eye.active || (state.mode !== "pointer" && !state.link.enabled)) return;
  const position = pointerPosition(event);
  if (!position) return;
  updateExplorePosition(position.nx, position.ny, "mouse");
});
canvas.addEventListener("pointerleave", () => {
  if (state.eye.active || state.regionPreview) return;
  if (!usesPointerPlayback()) {
    if (state.link.enabled) setLinkedRegion(null);
    return;
  }
  state.pointer.insideArtwork = false;
  if (!state.pointer.pinnedRegion) clearActiveRegion(false);
  updatePerformance(true);
});
canvas.addEventListener("click", (event) => {
  if ((state.mode !== "pointer" && !state.link.enabled) || state.scan.editingRanges ||
      !state.eye.active || !state.eye.calibrated || !calibrationOverlay.hidden) return;
  if (!pointerPosition(event) || performance.now() - state.eye.lastResultAt >= EYE_RESULT_TIMEOUT_MS) return;
  state.eye.tracker.recordScreenPosition(event.clientX, event.clientY, "click");
});
async function seekScanFromArtwork(x) {
  if (usesPointerPlayback() || state.scan.editingRanges) return;
  const route = state.scan.route;
  const progress = STUDIO ? STUDIO.scan.scanProgressAtX(
    route, x, state.scan.seconds / state.scan.duration,
  ) : x;
  if (progress === null) return;
  await ensurePerformanceSound();
  if (usesPointerPlayback() || state.scan.editingRanges || state.scan.route !== route) return;
  const seconds = snapScanSeconds(progress * state.scan.duration);
  if (state.scan.playing) {
    state.scan.startedAt = performance.now();
    state.scan.startedFrom = seconds;
    soundEngine.setScanEnvelope(seconds, true);
  }
  setScanPosition(seconds, true);
}

canvas.addEventListener("pointerdown", (event) => {
  if (state.eye.active && !(state.link.enabled && state.scan.editingRanges)) {
    event.stopPropagation();
    return;
  }
  const position = pointerPosition(event);
  if (!position) return;
  if (usesPointerPlayback() && !state.scan.editingRanges) {
    updateExplorePosition(position.nx, position.ny, "mouse");
    void ensurePerformanceSound();
  }
  if (state.mode === "scan") {
    if (STUDIO && (state.scan.editingRanges || (!state.scan.playing && !state.scan.startRequest))) {
      beginScanRange(event, position);
    } else if (!state.link.enabled) {
      void seekScanFromArtwork(position.nx);
    }
  }
});

function updateEyeButtons() {
  const active = state.eye.active || state.eye.starting;
  eyeToggle.classList.toggle("active", active);
  eyeToggle.setAttribute("aria-pressed", String(active));
  mouseSource.classList.toggle("active", !active);
  mouseSource.setAttribute("aria-pressed", String(!active));
  eyeCalibrate.disabled = !state.eye.ready || !state.eye.active;
  gazeStability.disabled = !active;
  eyeVideo.hidden = !active;
}

function gazeStabilityLabel(value) {
  if (value < 34) return "Responsive";
  if (value > 66) return "Stable";
  return "Balanced";
}

function updateGazeStabilityLabel() {
  const label = gazeStabilityLabel(Number(gazeStability.value));
  gazeStabilityValue.textContent = label;
  gazeStability.setAttribute("aria-valuetext", label);
}

function gazeFrictionBase() {
  const friction = Math.max(0, Math.min(1, Number(gazeStability.value) / 100));
  return {
    friction,
    windowSize: 3 + 2 * Math.round(friction * 6),
    tau: .05 * Math.pow(24, friction),
  };
}

function adaptiveGazeDeadZone(friction, targetX, targetY, canvasRect) {
  if (!canvasRect.width || !canvasRect.height) return 0;
  const minDimension = Math.min(canvasRect.width, canvasRect.height);
  let deadZone = Math.min(80 * friction, minDimension * .08);
  const nx = (targetX - canvasRect.left) / canvasRect.width;
  const ny = (targetY - canvasRect.top) / canvasRect.height;
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    const targetRegion = regionAtGaze(nx, ny);
    if (targetRegion) {
      const areaRatio = Math.max(.0001, Math.min(1, Number(targetRegion.area_ratio || .5)));
      const equivalentRadius = Math.sqrt(areaRatio * canvasRect.width * canvasRect.height / Math.PI);
      // A small semantic region gets a much smaller dead zone, so stability
      // never makes it impossible to reach a detail inside a larger region.
      deadZone = Math.min(deadZone, Math.max(3, equivalentRadius * .22));
    }
  }
  return deadZone;
}

function smoothGazePoint(targetX, targetY, now, canvasRect, tau, friction) {
  if (state.eye.smoothX === null || state.eye.smoothY === null) {
    state.eye.smoothX = targetX;
    state.eye.smoothY = targetY;
    state.eye.lastSmoothAt = now;
    return;
  }
  const elapsed = Math.min(.25, Math.max(0, (now - state.eye.lastSmoothAt) / 1000));
  state.eye.lastSmoothAt = now;
  const dx = targetX - state.eye.smoothX;
  const dy = targetY - state.eye.smoothY;
  const distance = Math.hypot(dx, dy);
  const deadZone = adaptiveGazeDeadZone(friction, targetX, targetY, canvasRect);
  // Small involuntary movements creep slowly; deliberate larger movements
  // progressively catch up faster, avoiding a permanently sluggish cursor.
  const effectiveTau = distance <= deadZone
    ? tau * 6
    : tau / (1 + (distance - deadZone) / 150);
  const alpha = 1 - Math.exp(-elapsed / Math.max(.001, effectiveTau));
  state.eye.smoothX += dx * alpha;
  state.eye.smoothY += dy * alpha;
}

function configureGazeTracker(tracker) {
  tracker.params.faceMeshSolutionPath = "/static/vendor/webgazer/mediapipe/face_mesh";
  tracker.params.moveTickSize = 1e9;
  tracker.saveDataAcrossSessions(false);
  tracker.showVideoPreview(false);
  tracker.showPredictionPoints(false);
  tracker.applyKalmanFilter(true);
  expandGazeClickMemory(tracker.getRegression()[0]);
}

function expandGazeClickMemory(regression) {
  // The default holds 50 clicks. Keep all 60 calibration clicks plus corrections.
  for (const key of ["screenXClicksArray", "screenYClicksArray", "eyeFeaturesClicks", "dataClicks"]) {
    regression[key].windowSize = EYE_CLICK_MEMORY;
  }
}

function resetGazePosition() {
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  state.eye.rawHistory = [];
  state.eye.lastResultAt = -Infinity;
  state.eye.outsideArtworkSince = null;
  gazeCursor.hidden = true;
  resetEyeRegionStability();
}

function gazeToArtwork(result) {
  if (!state.eye.active || (state.mode !== "pointer" && !state.link.enabled) || !state.eye.calibrated ||
      !calibrationOverlay.hidden) return;
  const now = performance.now();
  if (!Number.isFinite(result?.x) || !Number.isFinite(result?.y)) {
    if (Number.isFinite(state.eye.lastResultAt) && now - state.eye.lastResultAt >= EYE_RESULT_TIMEOUT_MS) {
      resetGazePosition();
      updatePerformance(true);
    }
    return;
  }
  const friction = gazeFrictionBase();
  state.eye.rawHistory.push([result.x, result.y]);
  while (state.eye.rawHistory.length > friction.windowSize) state.eye.rawHistory.shift();
  const targetX = median(state.eye.rawHistory.map((point) => point[0]));
  const targetY = median(state.eye.rawHistory.map((point) => point[1]));
  const canvasRect = canvas.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return;
  smoothGazePoint(targetX, targetY, now, canvasRect, friction.tau, friction.friction);
  state.eye.lastResultAt = now;
  const shellRect = canvasShell.getBoundingClientRect();
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
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    state.eye.outsideArtworkSince = null;
    updateExplorePosition(nx, ny, "gaze");
  } else if (!state.regionPreview) {
    state.eye.outsideArtworkSince ??= now;
    state.eye.candidateRegionId = null;
    state.eye.candidateSince = 0;
    updatePerformance();
  }
}

gazeStability.addEventListener("input", () => {
  updateGazeStabilityLabel();
  const { windowSize } = gazeFrictionBase();
  if (state.eye.rawHistory.length > windowSize) state.eye.rawHistory.splice(0, state.eye.rawHistory.length - windowSize);
});
updateGazeStabilityLabel();

async function startEyeTracking() {
  if (state.eye.active || state.eye.startupPending) return;
  const tracker = window.webgazer;
  if (!tracker?.begin) {
    showToast("The local eye-tracking model could not be loaded");
    return;
  }
  if (state.mode !== "pointer" && !state.link.enabled) setInteractionMode("pointer");
  stopRegionPreview();
  const sessionId = ++state.eye.sessionId;
  state.eye.startupPending = true;
  state.eye.starting = true;
  state.eye.active = true;
  state.eye.ready = false;
  state.eye.tracker = tracker;
  resetGazePosition();
  if (usesPointerPlayback()) {
    resetPointerPlayback(true);
    clearActiveRegion();
  } else setLinkedRegion(null);
  state.pointer.source = "gaze";
  eyeStatus.textContent = "Loading WebGazer · allow camera access";
  updateActiveRegionSource();
  updateEyeButtons();
  try {
    await ensurePerformanceSound();
    if (sessionId !== state.eye.sessionId) return;
    configureGazeTracker(tracker);
    tracker.setGazeListener((result) => {
      if (sessionId === state.eye.sessionId) gazeToArtwork(result);
    });
    state.eye.startupTimer = window.setTimeout(() => {
      if (sessionId === state.eye.sessionId && state.eye.starting) {
        eyeStatus.textContent = "Waiting for the camera · check browser permission";
      }
    }, 6500);
    await tracker.begin(() => {});
    tracker.removeMouseEventListeners();
    if (sessionId !== state.eye.sessionId) return;
    eyeVideo.srcObject = document.getElementById(tracker.params.videoElementId)?.srcObject ?? null;
    eyeVideo.play().catch(() => {});
    state.eye.ready = true;
    state.eye.starting = false;
    eyeStatus.textContent = state.eye.calibrated ? "WebGazer · calibrated" : "WebGazer · ready to calibrate";
    updateEyeButtons();
    if (!state.eye.calibrated) startCalibration();
  } catch (error) {
    if (sessionId === state.eye.sessionId) {
      stopEyeTracking(false);
      eyeStatus.textContent = "Camera unavailable";
      showToast(error.message || "Could not start eye tracking");
    }
  } finally {
    clearTimeout(state.eye.startupTimer);
    state.eye.startupPending = false;
    if (sessionId !== state.eye.sessionId) releaseGazeTracker(tracker);
  }
}

function releaseGazeTracker(tracker) {
  if (!tracker) return;
  tracker.pause();
  tracker.removeMouseEventListeners();
  tracker.clearGazeListener();
  const { videoElementId, videoContainerId, gazeDotId } = tracker.params;
  const video = document.getElementById(videoElementId);
  for (const track of video?.srcObject?.getTracks() || []) track.stop();
  const container = document.getElementById(videoContainerId);
  if (container && document.getElementById(gazeDotId)) tracker.end();
  else container?.remove();
  eyeVideo.srcObject = null;
}

function stopEyeTracking(showMessage = true) {
  const wasTracking = state.eye.active;
  state.eye.sessionId++;
  if (!calibrationOverlay.hidden) restorePreviousGazeCalibration();
  if (!state.eye.startupPending) releaseGazeTracker(state.eye.tracker);
  state.eye.tracker = null;
  state.eye.active = false;
  state.eye.starting = false;
  state.eye.ready = false;
  resetGazePosition();
  state.pointer.source = "mouse";
  calibrationOverlay.hidden = true;
  clearTimeout(state.eye.startupTimer);
  eyeStatus.textContent = "Mouse active · camera off";
  updateActiveRegionSource();
  updateEyeButtons();
  if (!usesPointerPlayback()) {
    if (state.link.enabled) setLinkedRegion(null);
    if (showMessage) statusText.textContent = "Mouse exploration is active.";
    return;
  }
  if (wasTracking && !state.regionPreview) {
    resetPointerPlayback(true);
    clearActiveRegion();
  }
  updatePerformance(true);
  if (showMessage) statusText.textContent = "Mouse exploration is active.";
}

const CALIBRATION_COLS = 3;
const CALIBRATION_ROWS = 4;

function buildCalibrationTargets() {
  const rect = canvas.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const headerBottom = Math.max(
    calibrationOverlay.querySelector(".calibration-copy").getBoundingClientRect().bottom,
    $("#calibrationCancel").getBoundingClientRect().bottom,
  );
  const safe = {
    left: viewportLeft + 34,
    right: viewportLeft + width - 34,
    top: Math.min(headerBottom + 36, viewportTop + height * .62),
    bottom: viewportTop + height - 54,
  };
  const left = Math.max(safe.left, rect.left + 30);
  const right = Math.min(safe.right, rect.right - 30);
  const top = Math.max(safe.top, rect.top + 30);
  const bottom = Math.min(safe.bottom, rect.bottom - 30);
  const bounds = {
    left: right - left > 120 ? left : safe.left,
    right: right - left > 120 ? right : safe.right,
    top: bottom - top > 120 ? top : safe.top,
    bottom: bottom - top > 120 ? bottom : safe.bottom,
  };
  const targets = [];
  for (let row = 0; row < CALIBRATION_ROWS; row++) {
    for (let column = 0; column < CALIBRATION_COLS; column++) {
      const screenX = bounds.left + (bounds.right - bounds.left) * column / (CALIBRATION_COLS - 1);
      const screenY = bounds.top + (bounds.bottom - bounds.top) * row / (CALIBRATION_ROWS - 1);
      targets.push({
        screenX,
        screenY,
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

function showCalibrationPoint(message = "") {
  const { screenX, screenY } = state.eye.calibrationTargets[state.eye.calibrationIndex];
  const overlay = calibrationOverlay.getBoundingClientRect();
  calibrationTarget.style.left = `${screenX - overlay.left}px`;
  calibrationTarget.style.top = `${screenY - overlay.top}px`;
  calibrationProgress.textContent =
    `Point ${state.eye.calibrationIndex + 1} of ${state.eye.calibrationTargets.length} · ${state.eye.calibrationClicks} / ${EYE_CALIBRATION_CLICKS} clicks${message}`;
  calibrationTarget.querySelector("span").textContent = `${state.eye.calibrationClicks} / ${EYE_CALIBRATION_CLICKS}`;
}

function refreshCalibrationLayout() {
  if (calibrationOverlay.hidden) return;
  state.eye.calibrationTargets = buildCalibrationTargets();
  showCalibrationPoint();
}

function startCalibration() {
  if (!state.eye.ready || !state.eye.active || !calibrationOverlay.hidden) return;
  const regression = state.eye.tracker.getRegression()[0];
  state.eye.previousCalibration = state.eye.calibrated ? regression.getData().slice() : null;
  regression.init();
  expandGazeClickMemory(regression);
  state.eye.calibrated = false;
  state.eye.calibrationIndex = 0;
  state.eye.calibrationClicks = 0;
  resetGazePosition();
  if (!state.regionPreview) {
    if (usesPointerPlayback()) {
      resetPointerPlayback(true);
      clearActiveRegion();
    } else setLinkedRegion(null);
  }
  calibrationOverlay.hidden = false;
  refreshCalibrationLayout();
}

function restorePreviousGazeCalibration() {
  const regression = state.eye.tracker.getRegression()[0];
  regression.init();
  expandGazeClickMemory(regression);
  if (state.eye.previousCalibration) regression.setData(state.eye.previousCalibration);
  state.eye.calibrated = Boolean(state.eye.previousCalibration);
  state.eye.previousCalibration = null;
  calibrationOverlay.hidden = true;
  resetGazePosition();
}

function finishCalibration() {
  state.eye.calibrated = true;
  state.eye.previousCalibration = null;
  calibrationOverlay.hidden = true;
  resetGazePosition();
  eyeStatus.textContent = "WebGazer · calibrated";
  statusText.textContent = "Look across the artwork. Look at a spot and click it to correct the gaze cursor.";
  showToast("Eye calibration complete");
}

mouseSource.addEventListener("click", () => stopEyeTracking());
eyeToggle.addEventListener("click", () => {
  if (state.eye.active) stopEyeTracking();
  else startEyeTracking();
});
eyeCalibrate.addEventListener("click", startCalibration);
calibrationCancel.addEventListener("click", () => {
  restorePreviousGazeCalibration();
  if (!state.eye.calibrated) stopEyeTracking();
});
calibrationTarget.addEventListener("click", () => {
  if (calibrationOverlay.hidden || !state.eye.ready) return;
  const tracker = state.eye.tracker;
  const regression = tracker.getRegression()[0];
  const count = regression.getData().length;
  const { screenX, screenY } = state.eye.calibrationTargets[state.eye.calibrationIndex];
  tracker.recordScreenPosition(screenX, screenY, "click");
  if (regression.getData().length === count) {
    showCalibrationPoint(" · Face not detected. Look at the target and try again.");
    return;
  }
  state.eye.calibrationClicks++;
  if (state.eye.calibrationClicks === EYE_CALIBRATION_CLICKS) {
    state.eye.calibrationIndex++;
    state.eye.calibrationClicks = 0;
  }
  if (state.eye.calibrationIndex === state.eye.calibrationTargets.length) finishCalibration();
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
    requestAnimationFrame(fitCanvas);
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
  $("#currentArtName").textContent = state.artworkName || (state.selectedFile ? safeName(state.selectedFile.name) : "Untitled artwork");
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
    state.artworkName = state.selectedFile.name;
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

let previewUrl = null;

function useFile(file) {
  if (!file || state.analyzing) return;
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
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const url = previewUrl = URL.createObjectURL(file);
  setupPreview.src = url;
  setupPreview.hidden = false;
  dropZone.classList.add("has-preview");
  imageFromUrl(url).then((image) => {
    if (url !== previewUrl) return;
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
    if (url !== previewUrl) return;
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

volumeSlider.addEventListener("input", (event) => {
  const value = Number(volumeSlider.value);
  volumeValue.textContent = `${value}%`;
  volumeSlider.style.setProperty("--volume-fill", `${value}%`);
  soundEngine.setOutputLevel(value / 100);
  if (event.isTrusted && value > 0 && state.regions.length && usesPointerPlayback() && !soundEngine.enabled) {
    void ensurePerformanceSound();
  }
});

function applyMusicSettings(announce = true) {
  const bpm = Math.max(40, Math.min(200, Math.round(Number(musicBpm.value) || 72)));
  const root = NOTE_NAMES.includes(musicRoot.value) ? musicRoot.value : (COMPOSITION ? "C" : "D");
  const mode = MUSIC_MODES[musicMode.value] ? musicMode.value : (COMPOSITION ? "major" : "dorian");
  const tempoChanged = state.music.bpm !== bpm;
  const harmonyChanged = state.music.root !== root || state.music.mode !== mode;
  if (COMPOSITION && tempoChanged) {
    const bar = Math.floor(musicBeatPosition(false) / 4);
    const reverse = reverseAtBar(bar, false);
    state.musicTimeline.directionChanges.clear();
    state.musicTimeline.directionChanges.set(0, reverse);
    state.pointer.directionAnchor = null;
  }
  if (COMPOSITION && (tempoChanged || harmonyChanged) && (state.scan.playing || state.scan.startRequest)) pauseScan();
  state.music = { bpm, root, mode };
  if (COMPOSITION && harmonyChanged) {
    for (const region of state.regions) {
      if (region.instrument.id === "lead_synth") applyArtworkInstrument(region, region.instrument);
    }
    rebuildReverseArrangement();
    if (announce) updateRegionInstrumentControls();
  }
  if (state.regionPreview?.item) state.regionPreview.startedAt = performance.now();
  if (COMPOSITION && tempoChanged) setScanDuration(state.scan.duration, false);
  musicBpm.value = String(bpm);
  musicRoot.value = root;
  musicMode.value = mode;
  try { localStorage.setItem("streetart:music", JSON.stringify(state.music)); } catch (_) { /* Storage is optional. */ }
  if (!COMPOSITION && state.regions.length) renderArrangementChoice();
  soundEngine.resetMusicalClock();
  updatePerformance(true);
  $("#musicSourceStatus").textContent = COMPOSITION
    ? (state.artworkMusic ? `Shared harmony · ${harmonyPlanSummary()}` : "Shared harmony · Region rhythms") : state.regions.length
    ? `GEMS-9 · ${gemsProfileName()} · ${harmonyPlanSummary()}`
    : "Automatic harmony";
  if (announce) {
    const label = musicMode.options[musicMode.selectedIndex]?.textContent || mode;
    statusText.textContent = `Music set to ${bpm} BPM · ${root} ${label}.`;
    showToast(`${bpm} BPM · ${root} ${label}`);
  }
}

function restoreMusicSettings() {
  if (COMPOSITION) return applyMusicSettings(false);
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

if (!COMPOSITION) {
for (const family of TEMPLATE_CATALOG.families) {
  const group = document.createElement("optgroup");
  group.label = family.name;
  for (const template of TEMPLATE_CATALOG.templates.filter(item => item.familyId === family.id)) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    group.append(option);
  }
  musicTemplate.append(group);
}
musicTemplate.addEventListener("change", () => {
  state.arrangement.choice = TEMPLATE_BY_ID.has(musicTemplate.value) ? musicTemplate.value : "auto";
  renderArrangementChoice();
  applyMusicSettings(false);
  showToast(currentArrangement().name);
});
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

function setLogicVisible(visible) {
  logicOverlay.hidden = !visible;
  performanceScreen.inert = visible;
  document.body.classList.toggle("logic-visible", visible);
  if (visible) {
    logicOverlay.firstElementChild.scrollTop = 0;
    logicClose.focus();
  } else logicOpen.focus();
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

async function startOver() {
  clearTimeout(showToast.timer);
  $("#toast").classList.remove("show");
  $("#toast").textContent = "";
  resetScan(false);
  setLinkedMode(false);
  if (state.eye.active || state.eye.starting) stopEyeTracking();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  await soundEngine.setEnabled(false);
  state.selectedFile = null;
  state.artworkName = "";
  state.image = null;
  state.imagePixels = null;
  state.pointer.sampleCache = null;
  resetPointerPlayback(true);
  state.manifest = null;
  setScanRangeEditing(false);
  state.scan.ranges = [];
  if (STUDIO) setScanPath("forward");
  state.gems = normalizeGemsProfile(null);
  state.arrangement = { choice: "auto", autoId: null, scores: [], features: null };
  if (!COMPOSITION) renderGemsProfile();
  state.regions = [];
  rebuildBackingDrum();
  state.activeRegion = null;
  fileInput.value = "";
  setupPreview.hidden = true;
  setupPreview.removeAttribute("src");
  $("#thumbImage").removeAttribute("src");
  dropZone.classList.remove("has-preview", "dragging");
  $("#fileName").textContent = "Drop artwork";
  $("#fileMeta").textContent = "Click to choose · JPG, PNG or WebP";
  $("#statement").value = "";
  state.artworkMusic = null;
  if (COMPOSITION) $("#artworkMusicDetails").textContent = "Waiting for analysis.";
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

function addRotaryControl(input, readout, unit = "", curved = false) {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const decimals = String(step).split(".")[1]?.length || 0;
  const dial = document.createElement("span");
  dial.className = "rotary-dial";
  dial.title = "Drag to turn, or use the arrow keys";
  input.classList.add("rotary-value");
  input.inputMode = "decimal";
  input.before(dial);
  dial.append(input);
  input.closest("label").classList.add("rotary-control");
  if (input.type === "number") {
    input.addEventListener("keydown", event => {
      const value = Number(input.value);
      let next;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") next = value + step;
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft") next = value - step;
      else if (event.key === "Home") next = min;
      else if (event.key === "End") next = max;
      else return;
      event.preventDefault();
      input.value = String(Number(Math.min(max, Math.max(min, next)).toFixed(decimals)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const format = new Intl.NumberFormat("en", { maximumFractionDigits: decimals, useGrouping: false });
  const positionOf = value => {
    const position = clampUnit((value - min) / (max - min));
    return curved ? Math.cbrt(position) : position;
  };
  function refresh() {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const position = positionOf(value);
    dial.style.setProperty("--rotation", `${-135 + 270 * position}deg`);
    dial.style.setProperty("--sweep", `${270 * position}deg`);
    const label = `${format.format(value)}${unit === "%" || !unit ? unit : ` ${unit}`}`;
    readout.textContent = label;
    if (input.type === "range") input.setAttribute("aria-valuetext", label);
  }
  let drag = null;
  input.addEventListener("pointerdown", event => {
    if ((event.pointerType === "mouse" && event.button !== 0) || drag) return;
    event.preventDefault();
    input.focus({ preventScroll: true });
    drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY, position: positionOf(Number(input.value)),
    };
    try {
      input.setPointerCapture(event.pointerId);
    } catch (_) { /* A drag can still be handled while the pointer stays on the dial. */ }
  });
  input.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    const position = clampUnit(drag.position + (event.clientX - drag.x + drag.y - event.clientY) / 160);
    const raw = min + (max - min) * (curved ? position ** 3 : position);
    const value = Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min));
    const next = String(Number(value.toFixed(decimals)));
    if (next === input.value) return;
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const finish = event => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  input.addEventListener("pointerup", finish);
  input.addEventListener("pointercancel", finish);
  input.addEventListener("lostpointercapture", finish);
  input.addEventListener("input", refresh);
  refresh();
  return refresh;
}

const effectKnobs = new Map();
for (const input of document.querySelectorAll("[data-effect-trim]")) {
  const key = input.dataset.effectTrim;
  const refresh = addRotaryControl(input, input.nextElementSibling, "%");
  effectKnobs.set(key, { input, refresh });
  input.addEventListener("input", () => {
    state.effectTrims[key] = Number(input.value) / 100;
    updatePerformance(true);
  });
}
function renderFmPatch(role) {
  const fields = $("#fmPatchFields");
  fields.replaceChildren();
  for (const group of STUDIO.fm.fmGroups(role)) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.label;
    const grid = document.createElement("div");
    grid.className = "knob-grid";
    fieldset.append(legend, grid);
    for (const control of group.fields) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "number";
      input.min = control.min;
      input.max = control.max;
      input.step = control.step;
      const initial = STUDIO.fm.fmDefaultValue(role, control);
      input.value = FM_SOUND[role].patch[control.key] ?? initial;
      input.dataset.fmParameter = control.key;
      label.textContent = control.unit ? `${control.label} (${control.unit})` : control.label;
      const readout = document.createElement("output");
      label.append(input, readout);
      const refresh = addRotaryControl(input, readout, control.unit, control.unit === "s" || control.max >= 2000);
      const apply = () => {
        if (!Number.isFinite(input.valueAsNumber)) return;
        const value = Math.min(control.max, Math.max(control.min, input.valueAsNumber));
        if (value === initial) delete FM_SOUND[role].patch[control.key];
        else FM_SOUND[role].patch[control.key] = value;
        soundEngine.syncInstrumentPatches(role);
      };
      input.addEventListener("input", apply);
      input.addEventListener("change", () => {
        apply();
        input.value = FM_SOUND[role].patch[control.key] ?? initial;
        refresh();
      });
      grid.append(label);
    }
    fields.append(fieldset);
  }
}

function setupFmEditor() {
  const buttons = $("#fmRoleButtons");
  const controls = [
    { input: $("#fmVolume"), output: $("#fmVolumeValue"), key: "volume" },
    { input: $("#fmTone"), output: $("#fmToneValue"), key: "tone" },
    { input: $("#fmSpace"), output: $("#fmSpaceValue"), key: "space" },
  ];
  for (const input of document.querySelectorAll("[data-instrument-send]")) {
    controls.push({ input, output: input.nextElementSibling, key: input.dataset.instrumentSend, send: true });
  }
  for (const control of controls) {
    control.refresh = addRotaryControl(control.input, control.output, "%");
  }
  try {
    const saved = JSON.parse(localStorage.getItem(FM_VOLUME_STORAGE) || "{}");
    for (const id of Object.keys(FM_SOUND)) {
      const volume = saved?.[id] ?? (id === "organ" ? saved?.strings : undefined);
      if (Number.isFinite(volume)) FM_SOUND[id].volume = clampUnit(volume);
    }
  } catch (_) { /* Storage is optional. */ }
  let chosen = INSTRUMENT_ROLES[0].id;
  const refresh = () => {
    for (const button of buttons.children) button.setAttribute("aria-pressed", String(button.dataset.role === chosen));
    for (const { input, refresh: refreshKnob, key, send } of controls) {
      const settings = send ? FM_SOUND[chosen].sends : FM_SOUND[chosen];
      input.value = Math.round(settings[key] * 100);
      refreshKnob();
    }
    if (STUDIO) renderFmPatch(chosen);
  };
  for (const role of INSTRUMENT_ROLES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.role = role.id;
    button.textContent = role.label;
    button.addEventListener("click", () => {
      chosen = role.id;
      refresh();
    });
    buttons.append(button);
  }
  for (const { input, key, send } of controls) {
    input.addEventListener("input", () => {
      const settings = send ? FM_SOUND[chosen].sends : FM_SOUND[chosen];
      settings[key] = Number(input.value) / 100;
      if (key === "volume") {
        try {
          localStorage.setItem(FM_VOLUME_STORAGE, JSON.stringify(
            Object.fromEntries(Object.entries(FM_SOUND).map(([id, settings]) => [id, settings.volume])),
          ));
        } catch (_) { /* Storage is optional. */ }
      }
      updatePerformance(true);
    });
  }
  if (STUDIO) $("#resetFmPatch").addEventListener("click", () => {
    FM_SOUND[chosen].patch = {};
    soundEngine.syncInstrumentPatches(chosen);
    refresh();
  });
  refresh();
  return refresh;
}

function capturePresetSettings() {
  return {
    mode: state.mode,
    link: state.link.enabled,
    music: { ...state.music },
    scan: { duration: state.scan.duration, pathMode: state.scan.pathMode, voiceMode: state.scan.voiceMode,
      ranges: state.scan.ranges.map(range => ({ ...range })) },
    instruments: structuredClone(FM_SOUND),
    regionInstruments: state.regions.map(region => ({ id: region.id, role: region.instrument.id })),
    masterVolume: Number(volumeSlider.value) / 100,
    effects: { ...state.effectTrims },
  };
}

function restorePresetSettings(settings) {
  const { music, scan, instruments } = settings;
  if (Number.isFinite(music?.bpm)) musicBpm.value = String(music.bpm);
  if (NOTE_NAMES.includes(music?.root)) musicRoot.value = music.root;
  if (["major", "minor"].includes(music?.mode)) musicMode.value = music.mode;
  applyMusicSettings(false);

  if (Array.isArray(settings.regionInstruments)) {
    const assignments = new Map(settings.regionInstruments.map(item => [item?.id, instrumentIdForArtwork(item?.role)]));
    for (const region of state.regions) {
      // Older presets stored assignments for each detection. Prefer a saved
      // manual choice, with the first detection breaking ties.
      const manual = region.sourceDetections?.map(detection => {
        const saved = assignments.get(detection.id);
        const detectedRole = instrumentIdForArtwork(detection.default_instrument);
        const defaultRole = INSTRUMENTS_BY_ID.has(detectedRole) ? detectedRole : region.defaultInstrumentId;
        return saved !== defaultRole && INSTRUMENTS_BY_ID.has(saved) ? saved : null;
      }).find(Boolean);
      const role = INSTRUMENTS_BY_ID.get(manual ?? assignments.get(region.id));
      if (role) applyArtworkInstrument(region, role);
    }
    renderRegionList();
  }
  rebuildBackingDrum();
  rebuildReverseArrangement();

  for (const [role, values] of Object.entries(FM_SOUND)) {
    const saved = instruments?.[role];
    const legacyVolume = role === "organ" ? instruments?.strings?.volume : undefined;
    values.volume = clampUnit(saved?.volume ?? legacyVolume, 1);
    values.tone = clampUnit(saved?.tone, .36);
    values.space = clampUnit(saved?.space, .56);
    const defaultSends = defaultInstrumentSends(role);
    for (const [effect, initial] of Object.entries(defaultSends)) {
      values.sends[effect] = Number.isFinite(saved?.sends?.[effect]) ? clampUnit(saved.sends[effect]) : initial;
    }
    values.patch = STUDIO.fm.normalizeFmPatch(role, saved?.patch);
  }
  soundEngine.syncInstrumentPatches();
  refreshFmEditor();
  for (const [key, { input, refresh }] of effectKnobs) {
    const value = settings.effects?.[key];
    state.effectTrims[key] = Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 1;
    input.value = String(Math.round(state.effectTrims[key] * 100));
    refresh();
  }
  if (Number.isFinite(settings.masterVolume)) {
    volumeSlider.value = String(Math.round(clampUnit(settings.masterVolume) * 100));
    volumeSlider.dispatchEvent(new Event("input"));
  }
  setScanRangeEditing(false);
  state.scan.voiceMode = scan?.voiceMode === "crossing" ? "crossing" : "backing";
  state.scan.ranges = STUDIO.scan.validScanRanges(scan?.ranges);
  const pathMode = ["reverse", "roundtrip", "custom"].includes(scan?.pathMode) ? scan.pathMode : "forward";
  setScanPath(pathMode);
  setScanDuration(Number.isFinite(scan?.duration) ? scan.duration : DEFAULT_SCAN_DURATION, false);
}

async function savePerformancePreset() {
  if (!state.manifest || !state.regions.length || state.analyzing) return;
  const button = $("#savePreset");
  button.disabled = true;
  try {
    const name = state.artworkName || $("#currentArtName").textContent || "Artwork";
    const preset = await STUDIO.presets.packPreset(state.manifest, name, capturePresetSettings());
    const blob = new Blob([JSON.stringify(preset)], { type: "application/json" });
    if (blob.size > STUDIO.presets.MAX_PRESET_BYTES) throw new Error("This preset exceeds 100 MB.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-") || "artwork"}.streetart.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("Preset saved");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function openPerformancePreset(file) {
  if (!file || state.analyzing) return;
  setAnalyzing(true);
  $("#newArtwork").disabled = true;
  setAnalysisProgress(12, "Opening preset…");
  try {
    const { name, manifest, settings } = await STUDIO.presets.readPreset(file);
    setLinkedMode(false);
    await loadAnalysis(manifest);
    if (state.eye.active || state.eye.starting) stopEyeTracking(false);
    await soundEngine.setEnabled(false);
    resetPointerPlayback(true);
    state.selectedFile = null;
    state.artworkName = name;
    statementInput.value = manifest.artist_statement;
    restorePresetSettings(settings);
    updateSessionSummary();
    setInteractionMode(settings.link || settings.mode !== "pointer" ? "scan" : "pointer");
    setLinkedMode(settings.link === true);
    setSetupVisible(false);
    showToast(`Opened ${safeName(name)}`);
  } catch (error) {
    statusText.hidden = false;
    statusText.textContent = error.message;
    showToast(error.message);
  } finally {
    $("#newArtwork").disabled = false;
    setAnalyzing(false);
  }
}

const refreshFmEditor = COMPOSITION ? setupFmEditor() : () => {};
if (STUDIO) {
  const presetInput = $("#presetFile");
  for (const button of [$("#openPreset"), $("#openPresetSetup")]) {
    button.addEventListener("click", () => {
      if (!state.analyzing) presetInput.click();
    });
  }
  presetInput.addEventListener("change", () => {
    const file = presetInput.files[0];
    presetInput.value = "";
    void openPerformancePreset(file);
  });
  $("#savePreset").addEventListener("click", savePerformancePreset);
}
window.addEventListener("resize", () => {
  positionScanOverlay();
  refreshCalibrationLayout();
  drawCanvas();
});
window.visualViewport?.addEventListener("resize", refreshCalibrationLayout);
setupCollapsibleSections();
restoreMusicSettings();
setSetupVisible(true);
analyzeButton.disabled = true;

// Keep previews and pointer patterns on the shared scheduler while the image is still.
window.setInterval(() => {
  if (!state.setupComplete || state.analyzing) return;
  if (state.regionPreview) {
    if (state.regionPreview.item) updatePerformance(true);
    return;
  }
  if (!usesPointerPlayback() || !state.musicTimeline.running) return;
  if (!state.eye.active && performance.now() - state.pointer.lastTime > 70) state.pointer.speed *= .82;
  updatePerformance(true);
}, 50);
