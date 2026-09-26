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

const state = {
  manifest: null,
  image: null,
  selectedFile: null,
  regions: [],
  activeRegion: null,
  masksVisible: true,
  analyzing: false,
  pointer: { x: 0, y: 0, nx: 0, ny: 0, speed: 0, lastTime: 0 },
  enteredAt: 0,
  lastSentAt: 0,
  lastOutput: null,
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

async function prepareMask(region) {
  const [visualImage, hitImage] = await Promise.all([
    imageFromUrl(region.visual_mask_url),
    imageFromUrl(region.hit_mask_url),
  ]);
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = hitImage.naturalWidth;
  hitCanvas.height = hitImage.naturalHeight;
  const hitContext = hitCanvas.getContext("2d", { willReadFrequently: true });
  hitContext.drawImage(hitImage, 0, 0);

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
    hitData: hitContext.getImageData(0, 0, hitCanvas.width, hitCanvas.height).data,
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
  if (!state.masksVisible || !state.activeRegion) return;
  const region = state.activeRegion;
  ctx.save();
  ctx.globalAlpha = .96;
  ctx.shadowColor = rgb(region, .72);
  ctx.shadowBlur = 9;
  ctx.drawImage(region.outlineCanvas, 0, 0, canvas.width, canvas.height);
  if (maskValue(region, state.pointer.nx, state.pointer.ny)) {
    const size = Math.max(13, Math.min(canvas.width, canvas.height) * .018);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgb(region, .9);
    ctx.lineWidth = Math.max(1.5, canvas.width / 700);
    ctx.setLineDash([size * .42, size * .28]);
    ctx.beginPath();
    ctx.arc(state.pointer.nx * canvas.width, state.pointer.ny * canvas.height, size, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
    button.addEventListener("click", () => activateRegion(region, true));
    regionList.append(button);
  }
}

async function loadAnalysis(manifest) {
  state.manifest = manifest;
  state.activeRegion = null;
  setAnalysisProgress(92, "Preparing the interactive regions…");
  const loadedImage = await imageFromUrl(`${manifest.image_url}${manifest.image_url.includes("?") ? "&" : "?"}v=${Date.now()}`);
  const loadedRegions = await Promise.all(manifest.regions.map(prepareMask));
  state.image = loadedImage;
  state.regions = loadedRegions;
  $("#thumbImage").src = manifest.image_url;
  fitCanvas();
  renderRegionList();
  clearActiveRegion();
  statusText.textContent = `${loadedRegions.length} regions are ready. Move across the image to explore.`;
  setAnalyzing(false);
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

function activateRegion(region, fromList = false) {
  const changed = state.activeRegion?.id !== region?.id;
  state.activeRegion = region;
  if (changed) {
    state.enteredAt = performance.now();
    soundEngine.enter(region, state.pointer.nx, state.pointer.ny);
    if (navigator.vibrate) navigator.vibrate(9);
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

function clearActiveRegion() {
  state.activeRegion = null;
  state.enteredAt = 0;
  regionBadge.hidden = true;
  $("#currentRegion").textContent = state.regions.length ? "Move over the artwork" : "Waiting for analysis";
  document.querySelectorAll(".region-chip").forEach((chip) => chip.classList.remove("active"));
  soundEngine.leave();
  drawCanvas();
}

function outputPayload() {
  const region = state.activeRegion;
  return {
    type: "pointer_state",
    analysisId: state.manifest?.analysis_id || null,
    region: region ? {
      id: region.id,
      label: region.label,
      type: region.type,
      index: region.index,
    } : null,
    normalized: {
      x: Number(state.pointer.nx.toFixed(4)),
      y: Number(state.pointer.ny.toFixed(4)),
    },
    speed: Number(state.pointer.speed.toFixed(3)),
    edgeProximity: region ? edgeProximity(region, state.pointer.nx, state.pointer.ny) : 0,
    dwellMs: region && state.enteredAt ? Math.round(performance.now() - state.enteredAt) : 0,
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
  soundEngine.update(payload);
}

class SoundEngine {
  constructor() {
    this.enabled = false;
    this.outputLevel = Number(volumeSlider.value) / 100;
    this.context = null;
    this.oscillator = null;
    this.gain = null;
    this.filter = null;
    this.masterGain = null;
    this.compressor = null;
    this.lastTick = 0;
    this.lastRegion = null;
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
    this.gain.gain.setTargetAtTime(this.enabled && state.activeRegion ? .055 : 0, this.context.currentTime, .04);
    if (this.enabled) this.pulse(240, .07, .045);
  }
  setup() {
    this.context = new AudioContext();
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1000;
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.outputLevel * 3;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .18;
    this.oscillator = this.context.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = 120;
    this.oscillator.connect(this.filter).connect(this.gain).connect(this.masterGain);
    this.masterGain.connect(this.compressor).connect(this.context.destination);
    this.oscillator.start();
  }
  frequency(region, nx, ny) {
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
    const semitone = scale[(region.index - 1) % scale.length] + Math.round((1 - ny) * 7);
    return 55 * Math.pow(2, semitone / 12) * (1 + nx * .16);
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
    this.filter.frequency.setTargetAtTime(320 + (1 - payload.normalized.y) * 2600 + payload.speed * 1200, now, .04);
    this.gain.gain.setTargetAtTime(.035 + Math.min(payload.speed, 1) * .035, now, .05);
    if (payload.edgeProximity > .56 && performance.now() - this.lastTick > 110 - payload.edgeProximity * 55) {
      this.pulse(950 + region.index * 85, .018, .018, "square");
      this.lastTick = performance.now();
    }
  }
  pulse(frequency, duration, volume, type = "sine") {
    if (!this.enabled || !this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.masterGain);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration + .02);
  }
}
const soundEngine = new SoundEngine();

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const nx = (event.clientX - rect.left) / rect.width;
  const ny = (event.clientY - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx, ny };
}

canvas.addEventListener("pointermove", (event) => {
  if (!state.regions.length || state.analyzing) return;
  const position = pointerPosition(event);
  if (!position) return;
  const now = performance.now();
  const delta = Math.max(16, now - state.pointer.lastTime);
  const distance = Math.hypot(position.nx - state.pointer.nx, position.ny - state.pointer.ny);
  state.pointer.speed = Math.min(1, distance / delta * 950);
  state.pointer.nx = position.nx;
  state.pointer.ny = position.ny;
  state.pointer.lastTime = now;
  const region = regionAt(position.nx, position.ny);
  if (region?.id !== state.activeRegion?.id) region ? activateRegion(region) : clearActiveRegion();
  publishOutput();
});
canvas.addEventListener("pointerleave", () => { clearActiveRegion(); publishOutput(true); });
canvas.addEventListener("pointerdown", async () => {
  if (!soundEngine.enabled) await soundEngine.toggle();
});

function setAnalyzing(value) {
  state.analyzing = value;
  analysisOverlay.hidden = !value;
  analyzeButton.disabled = value;
  analyzeButton.querySelector("span").textContent = value ? "Analysing…" : "Analyse image";
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

$("#endpointUrl").textContent = window.StreetArtOutput.endpoint;
$("#copyEndpoint").addEventListener("click", async () => {
  await navigator.clipboard.writeText(window.StreetArtOutput.endpoint);
  showToast("WebSocket endpoint copied");
});

window.addEventListener("resize", drawCanvas);
connectSocket();
runAnalysis();
