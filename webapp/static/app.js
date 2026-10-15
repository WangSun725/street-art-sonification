const $ = (selector) => document.querySelector(selector);

const canvas = $("#artCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const canvasShell = $("#canvasShell");
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
const scanPlay = $("#scanPlay");
const scanReset = $("#scanReset");
const scanTimeline = $("#scanTimeline");
const scanTime = $("#scanTime");
const scanReadout = $("#scanReadout");
const scanDuration = $("#scanDuration");
const pointerMode = $("#pointerMode");
const scanMode = $("#scanMode");
const pointerControls = $("#pointerControls");
const scanControls = $("#scanControls");
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

const DEFAULT_SCAN_DURATION = 10 * 60;
const SCAN_PROFILE_BINS = 360;

const state = {
  manifest: null,
  image: null,
  selectedFile: null,
  regions: [],
  activeRegion: null,
  mode: "pointer",
  masksVisible: true,
  analyzing: false,
  pointer: { x: 0, y: 0, nx: 0, ny: 0, speed: 0, lastTime: 0, source: "mouse" },
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
    calibrationTimer: 0,
    startupTimer: 0,
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
  ["region.enter", "Enter region (trigger)"],
];

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
  target.previousElementSibling.textContent = protocol === "osc" ? "OSC ADDRESS" : (source === "region.enter" ? "NOTE" : "CC");
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
    field("OSC ADDRESS", target),
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
      return {
        id: row.dataset.id,
        enabled: row.querySelector(".mapping-enabled").checked,
        source,
        protocol,
        target: row.querySelector(".mapping-target-input").value,
        message: source === "region.enter" ? (protocol === "midi" ? "note" : "trigger") : (protocol === "midi" ? "cc" : "value"),
        channel: Number(row.querySelector(".mapping-channel").value || 1),
        inputMin: earlier?.inputMin ?? 0,
        inputMax: earlier?.inputMax ?? 1,
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
    button.innerHTML = `<i></i><span><strong>${region.label}</strong><small>${region.type}</small></span>`;
    button.addEventListener("click", () => {
      if (state.mode === "scan") setInteractionMode("pointer");
      activateRegion(region, true);
    });
    regionList.append(button);
  }
}

async function loadAnalysis(manifest) {
  resetScan(false);
  soundEngine.clearRegionVoices();
  state.manifest = manifest;
  state.activeRegion = null;
  setAnalysisProgress(92, "Preparing the interactive regions…");
  const loadedImage = await imageFromUrl(`${manifest.image_url}${manifest.image_url.includes("?") ? "&" : "?"}v=${Date.now()}`);
  const imagePixels = readImagePixels(loadedImage);
  const loadedRegions = await Promise.all(manifest.regions.map((region) => prepareMask(region, imagePixels)));
  state.image = loadedImage;
  state.regions = loadedRegions;
  $("#thumbImage").src = manifest.image_url;
  fitCanvas();
  renderRegionList();
  clearActiveRegion();
  updateScanControls();
  statusText.textContent = `${loadedRegions.length} regions are ready. Move across the image to explore.`;
  setAnalyzing(false);
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
  document.querySelectorAll(".region-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.region === region?.id));
  if (region) {
    regionBadge.hidden = false;
    regionBadge.style.setProperty("--region-color", rgb(region));
    $("#regionType").textContent = region.type.toUpperCase();
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
  document.querySelectorAll(".region-chip").forEach((chip) => chip.classList.remove("active"));
  if (stopSound) soundEngine.leave();
  drawCanvas();
}

function outputPayload() {
  const region = state.activeRegion;
  const scanPrimary = state.scan.regions[0] || null;
  const scanning = state.mode === "scan";
  return {
    type: scanning ? "scan_state" : "pointer_state",
    source: scanning ? "scan" : state.pointer.source,
    analysisId: state.manifest?.analysis_id || null,
    region: region ? {
      id: region.id,
      label: region.label,
      type: region.type,
      index: region.index,
    } : null,
    normalized: {
      x: Number((scanning ? state.scan.position : state.pointer.nx).toFixed(4)),
      y: Number((scanning ? (scanPrimary?.centroidY ?? .5) : state.pointer.ny).toFixed(4)),
    },
    speed: Number((scanning ? (state.scan.playing ? 1 / state.scan.duration : 0) : state.pointer.speed).toFixed(3)),
    edgeProximity: scanning ? 0 : (region ? edgeProximity(region, state.pointer.nx, state.pointer.ny) : 0),
    texture: Number((scanning ? (scanPrimary?.texture ?? 0) : 0).toFixed(3)),
    color: scanning && scanPrimary ? {
      family: colorDescriptor(scanPrimary).family,
      hue: Number(scanPrimary.hue.toFixed(3)),
      saturation: Number(scanPrimary.saturation.toFixed(3)),
      brightness: Number(scanPrimary.brightness.toFixed(3)),
      rgb: scanPrimary.colorRgb.map((value) => Math.round(value)),
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
  if (state.mode === "scan") soundEngine.updateScan(state.scan.regions, state.scan.position, state.scan.seconds, state.scan.playing);
  else soundEngine.update(payload);
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
    this.noiseBuffer = null;
    this.colorStates = new Map();
    this.activeColorRegions = new Set();
    this.lastTick = 0;
    this.lastRegion = null;
    this.lastSeekAccent = 0;
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
    this.enabled = !this.enabled;
    soundToggle.classList.toggle("active", this.enabled);
    soundToggle.setAttribute("aria-pressed", String(this.enabled));
    this.gain.gain.setTargetAtTime(this.enabled && state.activeRegion && state.mode === "pointer" ? .05 : 0, this.context.currentTime, .04);
    if (!this.enabled) this.stopScan();
    if (this.enabled && state.mode === "scan") {
      this.updateScan(state.scan.regions, state.scan.position, state.scan.seconds, state.scan.playing);
    }
    if (this.enabled) this.pulse(240, .07, .045);
  }
  setup() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
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
    this.oscillator.start();
  }
  frequency(region, nx, ny) {
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
    const formShift = [0, 5, 3, 7, 0][Math.min(4, Math.floor(nx * 5))];
    const semitone = scale[(region.index - 1) % scale.length] + Math.round((1 - ny) * 8) + formShift;
    return 55 * Math.pow(2, semitone / 12);
  }
  enter(region, nx, ny) {
    if (!this.enabled || !region) return;
    const frequency = this.frequency(region, nx, ny);
    this.oscillator.frequency.setTargetAtTime(frequency, this.context.currentTime, .055);
    this.gain.gain.setTargetAtTime(.055, this.context.currentTime, .035);
    this.pulse(frequency * 2, .055, .035, region.index % 2 ? "triangle" : "sine");
    this.lastRegion = region.id;
  }
  leave() {
    if (this.context) this.gain.gain.setTargetAtTime(0, this.context.currentTime, .08);
  }
  update(payload) {
    if (!this.enabled || !payload.region) return;
    const region = state.activeRegion;
    const now = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(this.frequency(region, payload.normalized.x, payload.normalized.y), now, .035);
    this.panner.pan.setTargetAtTime(payload.normalized.x * 1.5 - .75, now, .06);
    this.filter.frequency.setTargetAtTime(320 + (1 - payload.normalized.y) * 2600 + payload.speed * 1200, now, .04);
    this.gain.gain.setTargetAtTime(.035 + Math.min(payload.speed, 1) * .035, now, .05);
    if (payload.edgeProximity > .56 && performance.now() - this.lastTick > 110 - payload.edgeProximity * 55) {
      this.pulse(950 + region.index * 85, .018, .018, "square");
      this.lastTick = performance.now();
    }
  }
  voiceSettings(region) {
    const settings = {
      wall: { wave: "sine", octave: .5, level: .022, filter: 720, interval: 2.4 },
      figure: { wave: "triangle", octave: 1, level: .026, filter: 1800, interval: .92 },
      face: { wave: "triangle", octave: 2, level: .021, filter: 2500, interval: .72 },
      gesture: { wave: "sawtooth", octave: 1, level: .018, filter: 2100, interval: .58 },
      lettering: { wave: "square", octave: 2, level: .012, filter: 2900, interval: .34 },
      fill: { wave: "sine", octave: 1, level: .025, filter: 1150, interval: 1.65 },
      drip: { wave: "sine", octave: 2, level: .018, filter: 2200, interval: 1.15 },
      texture: { wave: "sawtooth", octave: .5, level: .012, filter: 1250, interval: .48 },
      symbol: { wave: "triangle", octave: 2, level: .018, filter: 2600, interval: .66 },
      detail: { wave: "triangle", octave: 2, level: .017, filter: 2300, interval: .74 },
    };
    return settings[region.type] || settings.detail;
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
    oscillatorB.type = region.type === "lettering" || region.type === "texture" ? "sawtooth" : "sine";
    oscillatorB.detune.value = region.index % 2 ? 7 : -7;
    companionGain.gain.value = .28;
    filter.type = "lowpass";
    filter.Q.value = 1.4 + region.index % 4;
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
  updateScan(regions, nx, seconds, playing = true) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    this.gain.gain.setTargetAtTime(0, now, .05);
    const activeIds = new Set(regions.slice(0, 5).map((item) => item.region.id));
    for (const [id, voice] of this.regionVoices) {
      if (!activeIds.has(id) || !playing) voice.gain.gain.setTargetAtTime(0, now, .2);
    }
    for (const item of regions.slice(0, 5)) {
      const { region, centroidY, texture, intensity, brightness, saturation } = item;
      const voice = this.ensureRegionVoice(region);
      const base = this.frequency(region, nx, centroidY) * voice.settings.octave;
      voice.oscillatorA.frequency.setTargetAtTime(base, now, .11);
      voice.oscillatorB.frequency.setTargetAtTime(base * (region.index % 3 === 0 ? 1.5 : 2), now, .13);
      const harmonicThresholds = [.16, .34, .52, .7];
      const harmonicLevels = [.24, .16, .105, .07];
      voice.harmonicOscillators.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(base * (index + 2), now, .11 + index * .015);
        const openness = Math.max(0, Math.min(1, (brightness - harmonicThresholds[index]) / .2));
        const harmonicLevel = harmonicLevels[index] * openness * (.72 + saturation * .42);
        voice.harmonicGains[index].gain.setTargetAtTime(harmonicLevel, now, .14);
      });
      voice.filter.frequency.setTargetAtTime(
        voice.settings.filter + (1 - centroidY) * 1100 + texture * 1300 + brightness * 3200 + saturation * 650,
        now,
        .12,
      );
      voice.panner.pan.setTargetAtTime(Math.max(-.85, Math.min(.85, (region.index / Math.max(1, state.regions.length - 1)) * 1.7 - .85)), now, .14);
      const target = playing ? voice.settings.level * (.25 + intensity * .95) : 0;
      voice.gain.gain.setTargetAtTime(target, now, .18);
      if (playing && intensity > .18) this.maybeColorEvent(item, base, seconds, now);
    }
    if (playing) this.activeColorRegions = activeIds;
    if (!playing && regions[0] && performance.now() - this.lastSeekAccent > 90) {
      const item = regions[0];
      this.pulse(this.frequency(item.region, nx, item.centroidY) * 2, .08, .022, "triangle");
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
      this.colorEvent(item, base, seconds, descriptor);
      this.colorStates.set(item.region.id, {
        signature,
        nextAt: now + .28 + (1 - item.saturation) * .18,
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
    const stagger = (region.index % 5) * .014;
    const note = (ratio, duration, volume, type = "sine", delay = 0, filter = cutoff) => {
      this.pulse(root * ratio, duration, level * volume, type, stagger + delay, pan, filter);
    };
    switch (descriptor.family) {
      case "red":
        note(.5, .26, 1.25, saturation > .55 ? "sawtooth" : "triangle", 0, cutoff * .55);
        note(1, .09, .7, "triangle", .075);
        break;
      case "orange":
        note(1, .13, 1, "triangle");
        note(1.25, .11, .75, "triangle", .065);
        note(1.5, .09, .55, "sine", .13);
        break;
      case "yellow":
        note(2, .095, .8, "square", 0, cutoff * 1.25);
        note(3, .18, .62, "sine", .045, cutoff * 1.45);
        note(4, .12, .42, "sine", .1, cutoff * 1.5);
        break;
      case "green":
        note(1, .19, 1, "triangle");
        note(1.5, .15, .68, "triangle", .085);
        break;
      case "cyan":
        note(1.5, .24, .72, "sine");
        note(2, .28, .62, "sine", .055);
        note(2.5, .21, .42, "sine", .12);
        break;
      case "blue":
        note(.5, .36, 1.05, "sine", 0, cutoff * .65);
        note(1.5, .28, .58, "sine", .11);
        break;
      case "violet":
        note(1, .18, .85, "triangle");
        note(1.5, .23, .62, "triangle", .04);
        note(2.25, .17, .45, "sine", .095);
        break;
      case "magenta":
        note(1, .13, .82, "sawtooth", 0, cutoff * .8);
        note(2, .1, .5, "triangle", .07);
        this.noiseBurst(.055 + texture * .055, level * .72, cutoff, stagger + .025, pan, seconds + region.index);
        break;
      case "white":
        note(2, .24, .62, "sine");
        note(3, .31, .46, "sine", .04, cutoff * 1.35);
        note(5, .2, .28, "sine", .09, cutoff * 1.5);
        break;
      case "dark":
        note(.5, .42, 1.25, "sine", 0, cutoff * .45);
        note(1, .16, .48, "triangle", .12, cutoff * .65);
        break;
      default:
        note(1, .18, .7, "triangle", 0, cutoff * .75);
        this.noiseBurst(.035 + texture * .045, level * .45, cutoff * .7, stagger + .04, pan, seconds + region.index);
    }
  }
  noiseBurst(duration, volume, cutoff, delay = 0, pan = 0, offsetSeed = 0) {
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
    source.connect(filter).connect(gain).connect(panner).connect(this.musicBus);
    const offset = Math.abs(Math.sin(offsetSeed * 12.9898)) * 1.5;
    source.start(now, offset, duration + .02);
  }
  stopScan() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.regionVoices.values()) voice.gain.gain.setTargetAtTime(0, now, .12);
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
    this.resetScanEvents();
  }
  pulse(frequency, duration, volume, type = "sine", delay = 0, pan = 0, cutoff = 0) {
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
    gain.connect(panner).connect(this.musicBus);
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
  return Math.max(5, Math.min(60 * 60, Math.round(seconds)));
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
  state.scan.regions = scanRegionsAt(state.scan.position);
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
  if (!soundEngine.enabled) await soundEngine.toggle();
  if (state.scan.seconds >= state.scan.duration) {
    state.scan.seconds = 0;
    soundEngine.resetScanEvents();
  }
  state.scan.engaged = true;
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
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  updateScanControls();
  publishOutput(true);
}

function resetScan(showMessage = true) {
  state.scan.playing = false;
  state.scan.engaged = state.mode === "scan";
  state.scan.position = 0;
  state.scan.seconds = 0;
  state.scan.regions = [];
  cancelAnimationFrame(state.scan.animationFrame);
  soundEngine.stopScan();
  soundEngine.resetScanEvents();
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
  if (!['pointer', 'scan'].includes(mode) || mode === state.mode) return;
  if (mode === "scan" && (state.eye.active || state.eye.starting)) stopEyeTracking(false);
  if (mode === "pointer") {
    pauseScan();
    state.scan.engaged = false;
    state.mode = "pointer";
    clearActiveRegion();
    statusText.textContent = state.pointer.source === "gaze"
      ? "Eye tracking is active. Look across the artwork."
      : "Pointer exploration is active. Move across the artwork.";
  } else {
    state.mode = "scan";
    state.scan.engaged = true;
    state.pointer.source = "mouse";
    clearActiveRegion();
    setScanPosition(state.scan.seconds, true);
    statusText.textContent = `Set a duration, then start the ${formatTime(state.scan.duration)} scan.`;
  }
  pointerMode.classList.toggle("active", mode === "pointer");
  scanMode.classList.toggle("active", mode === "scan");
  pointerMode.setAttribute("aria-pressed", String(mode === "pointer"));
  scanMode.setAttribute("aria-pressed", String(mode === "scan"));
  pointerControls.hidden = mode !== "pointer";
  scanControls.hidden = mode !== "scan";
  $("#modeEyebrow").textContent = mode === "pointer" ? "POINTER / GAZE" : "LEFT-TO-RIGHT SCAN";
  $("#modeInstruction").textContent = mode === "pointer"
    ? "Move across the image with a mouse or your eyes"
    : `Scan the complete image over ${formatTime(state.scan.duration)}`;
  $("#signalLabel").textContent = mode === "pointer"
    ? `ACTIVE REGION · ${state.pointer.source.toUpperCase()}`
    : "ACTIVE REGION · SCAN";
  updateScanControls();
  drawCanvas();
  publishOutput(true);
}

scanPlay.addEventListener("click", () => state.scan.playing ? pauseScan() : playScan());
scanReset.addEventListener("click", () => resetScan());
scanTimeline.addEventListener("input", async () => {
  if (!state.regions.length) return;
  if (!soundEngine.enabled) await soundEngine.toggle();
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
pointerMode.addEventListener("click", (event) => { event.stopPropagation(); setInteractionMode("pointer"); });
scanMode.addEventListener("click", (event) => { event.stopPropagation(); setInteractionMode("scan"); });

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
  const region = regionAt(nx, ny);
  if (region?.id !== state.activeRegion?.id) region ? activateRegion(region) : clearActiveRegion();
  publishOutput();
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
  if (!soundEngine.enabled) await soundEngine.toggle();
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

function gazeToArtwork(result) {
  if (!state.eye.active || state.mode !== "pointer" || result.gazeState === "closed") return;
  const rawX = (result.normPog[0] + .5) * window.innerWidth;
  const rawY = (result.normPog[1] + .5) * window.innerHeight;
  const smoothing = state.eye.smoothX === null ? 1 : .24;
  state.eye.smoothX = state.eye.smoothX === null ? rawX : state.eye.smoothX + (rawX - state.eye.smoothX) * smoothing;
  state.eye.smoothY = state.eye.smoothY === null ? rawY : state.eye.smoothY + (rawY - state.eye.smoothY) * smoothing;
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
    clearActiveRegion();
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
  if (!soundEngine.enabled) await soundEngine.toggle();
  const sessionId = ++state.eye.sessionId;
  state.eye.starting = true;
  state.eye.active = true;
  state.eye.ready = false;
  state.eye.smoothX = null;
  state.eye.smoothY = null;
  state.pointer.source = "gaze";
  eyeStatus.textContent = "Loading WebEyeTrack · allow camera access";
  $("#signalLabel").textContent = "ACTIVE REGION · GAZE";
  updateEyeButtons();
  try {
    const webcamClient = new window.WebcamClient("eyeVideo");
    const tracker = new window.WebEyeTrackProxy(webcamClient);
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
  state.eye.webcamClient = null;
  state.eye.tracker = null;
  state.eye.active = false;
  state.eye.starting = false;
  state.eye.ready = false;
  state.eye.smoothX = null;
  state.eye.smoothY = null;
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

const CALIBRATION_POINTS = [
  [12, 17], [50, 17], [88, 17],
  [12, 50], [50, 50], [88, 50],
  [12, 83], [50, 83], [88, 83],
];

function showCalibrationPoint() {
  const [x, y] = CALIBRATION_POINTS[state.eye.calibrationIndex];
  calibrationTarget.style.left = `${x}%`;
  calibrationTarget.style.top = `${y}%`;
  calibrationProgress.textContent = `Point ${state.eye.calibrationIndex + 1} of ${CALIBRATION_POINTS.length}`;
  calibrationTarget.classList.remove("ready");
  calibrationTarget.querySelector("span").textContent = "HOLD";
  state.eye.calibrationReady = false;
  clearTimeout(state.eye.calibrationTimer);
  state.eye.calibrationTimer = window.setTimeout(() => {
    state.eye.calibrationReady = true;
    calibrationTarget.classList.add("ready");
    calibrationTarget.querySelector("span").textContent = "CLICK";
  }, 1100);
}

function startCalibration(event) {
  event?.stopPropagation();
  if (!state.eye.ready || !state.eye.active) return;
  state.eye.calibrationIndex = 0;
  calibrationOverlay.hidden = false;
  showCalibrationPoint();
}

function finishCalibration() {
  calibrationOverlay.hidden = true;
  state.eye.calibrated = true;
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
  state.eye.calibrationIndex++;
  if (state.eye.calibrationIndex >= CALIBRATION_POINTS.length) finishCalibration();
  else showCalibrationPoint();
});

function setAnalyzing(value) {
  state.analyzing = value;
  analysisOverlay.hidden = !value;
  analyzeButton.disabled = value;
  analyzeButton.querySelector("span").textContent = value ? "Analysing…" : "Analyse image";
  updateScanControls();
}

function setAnalysisProgress(progress, message) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));
  progressBar.style.width = `${value}%`;
  analysisPercent.textContent = `${Math.round(value)}%`;
  analysisMessage.textContent = message;
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
  resetScan(false);
  setAnalyzing(true);
  setAnalysisProgress(5, "Preparing the artwork…");
  try {
    let manifest;
    if (!state.selectedFile) {
      const response = await fetch("/api/demo", { cache: "no-store" });
      manifest = await response.json();
    } else {
      const form = new FormData();
      form.append("image", state.selectedFile);
      form.append("statement", $("#statement").value);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not start the analysis");
      manifest = payload.status === "ready" ? payload : await pollAnalysis(payload.analysis_id);
    }
    await loadAnalysis(manifest);
  } catch (error) {
    setAnalyzing(false);
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
  state.selectedFile = file;
  resetScan(false);
  state.regions = [];
  state.manifest = null;
  clearActiveRegion();
  const url = URL.createObjectURL(file);
  imageFromUrl(url).then((image) => {
    state.image = image;
    fitCanvas();
    $("#thumbImage").src = url;
  });
  $("#fileName").textContent = safeName(file.name);
  $("#fileMeta").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · waiting for analysis`;
  statusText.textContent = "The image is ready. Select Analyse image to continue.";
  renderRegionList();
}

fileInput.addEventListener("change", () => useFile(fileInput.files[0]));
analyzeButton.addEventListener("click", runAnalysis);
$("#clearFile").addEventListener("click", async () => {
  state.selectedFile = null;
  fileInput.value = "";
  $("#fileName").textContent = "the-defiant-one.webp";
  $("#fileMeta").textContent = "Sample artwork · analysed";
  await runAnalysis();
});

for (const target of [dropZone, canvasShell]) {
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
soundToggle.addEventListener("click", () => soundEngine.toggle());
volumeSlider.addEventListener("input", () => {
  const value = Number(volumeSlider.value);
  volumeValue.textContent = `${value}%`;
  volumeSlider.style.setProperty("--volume-fill", `${value}%`);
  soundEngine.setOutputLevel(value / 100);
});
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

window.addEventListener("resize", drawCanvas);
connectSocket();
loadExternalOutput();
runAnalysis();
