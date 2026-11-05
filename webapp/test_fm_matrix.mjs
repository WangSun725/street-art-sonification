import fs from "node:fs";
import vm from "node:vm";

const workletUrl = new URL("./static/fm-worklet.js", import.meta.url);
const source = fs.readFileSync(workletUrl, "utf8");
const checks = `
if (Object.keys(ROLE_GEMS_PROFILES).length !== 9) throw new Error("Expected 9 instrument roles");
if (Object.keys(PATCHES).length !== 9) throw new Error("Expected 9 hybrid instrument patches");
for (const parameter of ["saw", "pulse", "fold", "crush", "formant", "comb", "pitchEnv", "stereo", "glitch"]) {
  if (!BANK_PARAMETERS.includes(parameter)) throw new Error("Missing hybrid GEMS parameter: " + parameter);
}
for (const [role, patch] of Object.entries(PATCHES)) {
  const hasDigitalLayer = role === "drums"
    ? patch.fold > 0
    : patch.analogMix > 0 || patch.comb > 0 || patch.formant > 0 || patch.fold > 0;
  if (!hasDigitalLayer) throw new Error(role + " has no hybrid digital layer");
}
for (const [role, profile] of Object.entries(ROLE_GEMS_PROFILES)) {
  if (Object.keys(profile).length !== 9) throw new Error(role + " does not have 9 GEMS profiles");
  for (const name of GEMS_DIMENSIONS) {
    if (!profile[name]) throw new Error(role + " is missing " + name);
    const bank = blendGemsBank({ [name]: 1 }, role);
    for (const parameter of BANK_PARAMETERS) {
      if (!Number.isFinite(bank[parameter])) {
        throw new Error(role + "/" + name + "/" + parameter + " is invalid");
      }
    }
  }
}

const leadPeace = blendGemsBank({ peacefulness: 1 }, "lead_synth");
const leadTension = blendGemsBank({ tension: 1 }, "lead_synth");
if (leadPeace.fold === leadTension.fold || leadPeace.glitch === leadTension.glitch) {
  throw new Error("Contrasting GEMS profiles must produce different digital colour");
}

const Processor = globalThis.__processor;
for (const role of Object.keys(ROLE_GEMS_PROFILES)) {
  const processor = new Processor();
  processor.handleMessage({
    type: "note", role, note: role === "drums" ? 36 : 60, duration: .5,
    velocity: .7, gemsWeights: { peacefulness: .6, nostalgia: .4 },
    visual: { brightness: .5, saturation: .4, texture: .2, hue: .5 },
    controls: { attack: .5, release: .5, chorus: .4 },
  });
  let energy = 0;
  for (let block = 0; block < 32; block++) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    processor.process([], [[left, right]]);
    for (const sample of [...left, ...right]) {
      if (!Number.isFinite(sample)) throw new Error(role + " produced a non-finite sample");
      energy += Math.abs(sample);
    }
  }
  if (energy <= 0) throw new Error(role + " produced no audio energy");
}

for (const role of Object.keys(ROLE_GEMS_PROFILES)) {
  for (const emotion of GEMS_DIMENSIONS) {
    const processor = new Processor();
    processor.handleMessage({
      type: "note", role, note: role === "drums" ? 38 : 64, duration: .3,
      velocity: .72, gemsWeights: { [emotion]: 1 },
      visual: { brightness: .68, saturation: .58, texture: .52, hue: .34 },
      controls: { attack: .34, release: .46, chorus: .52, harmonicIntensity: .62 },
    });
    let energy = 0;
    for (let block = 0; block < 16; block++) {
      const left = new Float32Array(128);
      const right = new Float32Array(128);
      processor.process([], [[left, right]]);
      for (const sample of [...left, ...right]) {
        if (!Number.isFinite(sample)) throw new Error(role + "/" + emotion + " produced a non-finite sample");
        if (Math.abs(sample) > 1.201) throw new Error(role + "/" + emotion + " exceeded the output limiter");
        energy += Math.abs(sample);
      }
    }
    if (energy <= .00001) throw new Error(role + "/" + emotion + " produced no audio energy");
  }
}

console.log("FM matrix: 81 cells, " + BANK_PARAMETERS.length + " parameters, DSP OK");
`;

const context = {
  sampleRate: 48000,
  AudioWorkletProcessor: class {
    constructor() { this.port = { onmessage: null }; }
  },
  registerProcessor: (_name, processorClass) => { context.__processor = processorClass; },
  console,
};

vm.createContext(context);
vm.runInContext(source + checks, context);
