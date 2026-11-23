import {
  DRUM_VOICES, PATCHES, drumDefaultValue, fmDefaultValue, fmGroups, normalizeDrumPatch, normalizeFmPatch,
} from "./fm-patches.mjs?v=electronic-patches1";

export const PRESET_BANK_STORAGE = "street-art-fm-preset-bank-v1";
export const PRESET_BANK_FORMAT = "street-art-fm-preset-bank";

function controlsFor(role, note) {
  if (typeof role !== "string") return [];
  if (role === "drums") return Number.isInteger(note) && Object.hasOwn(DRUM_VOICES, note) ? DRUM_VOICES[note].groups : [];
  return role !== "strings" && Object.hasOwn(PATCHES, role) && note == null ? fmGroups(role, { expanded: true }) : [];
}

export function snapshotBankPreset({ id, role, note, name, values }) {
  const groups = controlsFor(role, note);
  if (!groups.length || typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]*$/i.test(id) ||
      typeof name !== "string" || !name.trim() || !values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("A preset has an invalid name, instrument, or patch.");
  }
  const fields = new Map(groups.flatMap(group => group.fields.map(control => [control.key, control])));
  for (const [key, value] of Object.entries(values)) {
    const control = fields.get(key);
    if (!control || (control.options ? !Object.hasOwn(control.options, value)
      : !Number.isFinite(value) || value < control.min || value > control.max)) {
      throw new Error(`Invalid parameter ${key} in ${name}.`);
    }
  }
  const snapshot = {};
  for (const [key, field] of fields) {
    if (field.optional && !Object.hasOwn(values, key)) continue;
    const value = values[key] ?? (role === "drums" ? drumDefaultValue(note, field) : fmDefaultValue(role, field));
    if (value !== undefined) snapshot[key] = value;
  }
  return { id, name: name.trim(), role, ...(role === "drums" && { note }), values: snapshot };
}

export function bankPatchValues({ role, note, values }) {
  return role === "drums" ? normalizeDrumPatch(note, values) : normalizeFmPatch(role, values);
}

export function readPresetBank(bank) {
  if (bank?.format !== PRESET_BANK_FORMAT || bank.version !== 1 ||
      typeof bank.name !== "string" || !bank.name.trim() || !Array.isArray(bank.presets)) {
    throw new Error("Choose a Street Art FM preset bank JSON file.");
  }
  const presets = bank.presets.map(snapshotBankPreset);
  if (new Set(presets.map(preset => preset.id)).size !== presets.length) {
    throw new Error("The preset bank contains duplicate IDs.");
  }
  return { format: PRESET_BANK_FORMAT, version: 1, name: bank.name.trim(), presets };
}

function presetGroup({ role, note }) {
  return role === "drums" ? `drums:${note}` : role;
}

export function drawFmTakes(bank, random = Math.random) {
  const groups = new Map();
  for (const preset of bank.presets) {
    const group = presetGroup(preset);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(preset);
  }
  const takes = { A: [], B: [] };
  for (const options of groups.values()) {
    const first = Math.floor(random() * options.length);
    const remaining = options.filter((_, index) => index !== first);
    takes.A.push(options[first]);
    takes.B.push(remaining[Math.floor(random() * remaining.length)] ?? options[first]);
  }
  return takes;
}

export function readFmTakes(takes) {
  if (takes == null) return null;
  const maxPresets = Object.keys(PATCHES).filter(role => controlsFor(role).length).length
    + Object.keys(DRUM_VOICES).length;
  const readTake = presets => {
    if (!Array.isArray(presets) || !presets.length || presets.length > maxPresets) {
      throw new Error("The saved FM takes contain an invalid preset list.");
    }
    const result = presets.map(snapshotBankPreset);
    if (new Set(result.map(presetGroup)).size !== result.length) {
      throw new Error("The saved FM takes repeat an instrument or drum piece.");
    }
    return result;
  };
  return { A: readTake(takes.A), B: readTake(takes.B) };
}

export function fmTakePatches(takes, gains = {}) {
  if (!takes) return null;
  const indexTake = presets => {
    const take = { instruments: {}, drums: {}, instrumentGains: {}, drumGains: {} };
    for (const preset of presets) {
      const gain = Object.hasOwn(gains, preset.id) ? gains[preset.id] : 1;
      if (preset.role === "drums") {
        take.drums[preset.note] = preset.values;
        take.drumGains[preset.note] = gain;
      } else {
        take.instruments[preset.role] = preset.values;
        take.instrumentGains[preset.role] = gain;
      }
    }
    return take;
  };
  return { A: indexTake(takes.A), B: indexTake(takes.B) };
}
