import { drumPresets, instrumentPresets } from "./fm-editor-presets.mjs?v=patch-editor3";

export const FACTORY_PATCHES = {
  drums: {
    algorithm: "feedback", ratios: [1, 1.414, 2.37, 3.91], indices: [0, 1, 1, 1],
    amp: [.001, .04, 0, .3], modDecay: [.1, .1, .1, .1], feedback: .25,
    level: .16, cutoff: [500, 12000], drive: 1.8, vibrato: [0, 0], motion: [6.2, .08],
    noise: .2, resonance: .34, filterMode: "lowpass", unison: 0, transient: .75,
    fold: .34, crush: .08, glitch: .08,
  },
  lead_synth: {
    algorithm: "serial", ratios: [1, 2, 3, 4], indices: [0, .5, .54, .35],
    amp: [.006, .08, .62, .085], modDecay: [.8, .15, .14, .12], feedback: .045,
    level: .145, cutoff: [1800, 7000], drive: 1.28, vibrato: [.025, 5.2], motion: [.32, .13],
    resonance: .32, filterMode: "lowpass", unison: .10, transient: .09, glide: .018,
    analogMix: .70, pulseMix: .045, analogDetune: 33, pitchEnvelope: [.55, .018],
    sawWidth: .96, sawBlend: .72, duckDepth: .34,
    fold: .1, crush: .012, glitch: .02,
  },
  counter_synth: {
    algorithm: "parallel", ratios: [1, 2, 1.002, 4], indices: [0, 1.28, 0, .54],
    amp: [.0025, .085, .18, .09], modDecay: [1, .08, 1, .05], feedback: .04,
    level: .104, cutoff: [2400, 9300], drive: 1.25, vibrato: [.025, 4.7], motion: [.36, .24],
    resonance: .38, filterMode: "lowpass", unison: .12, transient: .13,
    analogMix: .55, pulseMix: .32, analogDetune: 18, pitchEnvelope: [1, .016], duckDepth: .26,
    fold: .10, crush: .014, glitch: .024, formant: .19, formantFrequency: 2350,
  },
  bass: {
    amp: [.003, .065, .82, .032],
    level: .40, cutoff: [155, 1280], resonance: .77, drive: 1.50,
    analogMix: .68, pulseMix: .24, cleanSub: .70, octaveBody: .43, duckDepth: .43,
    bassSweep: .24, bassSweepDepth: 560,
    volumeLfoRate: 2, volumeLfoDepth: .72,
  },
  guitar: {
    algorithm: "branch", ratios: [1, 2, 3, 5.04], indices: [0, 1.45, 2.2, 1.35],
    amp: [.004, .11, .16, .28], modDecay: [.8, .12, .075, .18], feedback: .08,
    level: .145, cutoff: [1700, 7800], drive: 1.65, vibrato: [.04, 5.7], motion: [.42, .12],
    resonance: .4, filterMode: "lowpass", unison: .075, transient: .42,
    analogMix: .16, pulseMix: .3, analogDetune: 7, pitchEnvelope: [3.2, .038],
    fold: .16, crush: .025, glitch: .035, formant: .1, formantFrequency: 2350,
    comb: .58, combFeedback: .68,
  },
  pad: {
    algorithm: "parallel", ratios: [1, 1.5, 1.003, 2.01], indices: [0, .72, 0, .52],
    amp: [.12, .36, .82, .42], modDecay: [1, 1.8, 1, 2.1], feedback: .025,
    level: .15, cutoff: [1700, 9000], drive: 1.35, vibrato: [.03, 3.6], motion: [.12, .28],
    resonance: .22, filterMode: "lowpass", unison: .34, transient: .02,
    analogMix: 1.08, pulseMix: .035, analogDetune: 42,
    sawWidth: 1, sawBlend: .89, duckDepth: .71,
    fold: .07, crush: .008, glitch: .012, formant: .05, formantFrequency: 1480,
  },
  strings: {
    algorithm: "carriers", ratios: [1, 1.004, .997, 2], indices: [0, 0, 0, .48],
    amp: [.19, .62, .76, .7], modDecay: [1, 1, 1, 1.4], feedback: .035,
    level: .085, cutoff: [1200, 6100], drive: 1.18, vibrato: [.2, 5.1], motion: [.16, .22],
    resonance: .3, filterMode: "lowpass", unison: .38, transient: .035,
    analogMix: .84, pulseMix: .12, analogDetune: 24, pitchEnvelope: [0, .1],
    sawWidth: .79, sawBlend: .64, duckDepth: .53,
    fold: .08, crush: .01, glitch: .015, formant: .14, formantFrequency: 1720,
  },
  organ: {
    algorithm: "parallel", ratios: [1, 2, 2, 1], indices: [0, .22, 0, .19],
    amp: [.009, .085, .84, .075], modDecay: [1, .16, 1, .18], modSustain: .74, feedback: 0,
    level: .106, cutoff: [1550, 4900], drive: 1.08, resonance: .14, filterMode: "lowpass",
    vibrato: [.018, 4.8], motion: [.75, .07], transient: .02, analogMix: .03, duckDepth: .18,
  },
  keys_mallet: {
    algorithm: "serial", ratios: [1, 3, 5.7, 8.2], indices: [0, 2.2, 3.4, 2.4],
    amp: [.003, .065, .2, .25], modDecay: [.7, .09, .045, .03], feedback: .1,
    level: .16, cutoff: [2600, 11000], drive: 1.35, vibrato: [0, 0], motion: [.5, .1],
    resonance: .46, filterMode: "lowpass", unison: .045, transient: .52,
    analogMix: .08, pulseMix: .3, analogDetune: 5, pitchEnvelope: [5.5, .026],
    fold: .12, crush: .035, glitch: .04, formant: .2, formantFrequency: 3100,
    comb: .32, combFeedback: .55,
  },
  percussion_texture: {
    amp: [.001, .045, .22, .045],
    level: .20, cutoff: [2300, 8800], drive: 1.18, resonance: .14,
    filterMode: "lowpass", transient: .18, fold: .025,
  },
};

export const PROJECT_PRESET_NAMES = {
  instruments: {
    lead_synth: "Velvet Lead",
    bass: "Your exported patch",
    guitar: "Nylon Pluck",
    pad: "Soft Mist",
    organ: "Pipe Registration",
    keys_mallet: "Wood Mallet",
    percussion_texture: "Bright Sand",
  },
  drums: {
    38: "Dry Snare",
    39: "Tight Clap",
    42: "Loose Hat",
    46: "Bright Open Hat",
  },
};

function selectedPresets(names, library) {
  return Object.fromEntries(Object.entries(names).map(([id, name]) =>
    [id, library[id].find(preset => preset.name === name).values]));
}

const instrumentDefaults = selectedPresets(PROJECT_PRESET_NAMES.instruments, instrumentPresets);
const drumDefaults = selectedPresets(PROJECT_PRESET_NAMES.drums, drumPresets);
export const PATCHES = Object.fromEntries(Object.entries(FACTORY_PATCHES).map(([role, patch]) =>
  [role, applyFmPatch(patch, instrumentDefaults[role])]));
export const DRUM_DEFAULTS = {
  ...drumDefaults,
  // Raise Dry Snare's level for the project without changing its audition preset.
  38: { ...drumDefaults[38], level: .23 },
};

const field = (key, label, min, max, step, unit = "", fallback) =>
  ({ key, label, min, max, step, unit, fallback });

const envelopeFields = [
  field("amp.0", "Attack", .001, 1.5, .001, "s"),
  field("amp.1", "Decay", .001, 2, .001, "s"),
  field("amp.2", "Sustain", 0, 1, .01),
  field("amp.3", "Release", .025, 2.5, .001, "s"),
];
const operators = [
  ...Array.from({ length: 4 }, (_, i) => field(`ratios.${i}`, `Operator ${i + 1} ratio`, .25, 16, .001, "×")),
  ...Array.from({ length: 3 }, (_, i) => field(`indices.${i + 1}`, `Operator ${i + 2} index`, 0, 10, .01)),
  ...Array.from({ length: 3 }, (_, i) => field(`modDecay.${i + 1}`, `Operator ${i + 2} decay`, .006, 4, .001, "s")),
  field("modAttack", "Modulation attack", .001, .5, .001, "s", .004),
  field("modSustain", "Modulation sustain", 0, 1, .01),
  field("feedback", "Feedback", 0, 1.2, .01),
];
const filter = [
  field("cutoff.0", "Dark cutoff", 60, 12000, 1, "Hz"),
  field("cutoff.1", "Bright cutoff", 60, 16000, 1, "Hz"),
  field("resonance", "Resonance", 0, .9, .01),
  field("drive", "Drive", .2, 4, .01, "×"),
];
const motion = [
  field("vibrato.0", "Vibrato depth", 0, .6, .001),
  field("vibrato.1", "Vibrato rate", 0, 16, .01, "Hz"),
  field("motion.1", "Timbre LFO depth", 0, 1, .01),
  field("motion.0", "Timbre LFO rate", 0, 16, .01, "Hz"),
];

const level = field("level", "Voice level", .01, .6, .001);
const WAVEFORM_CHOICES = {
  sine: "Sine", triangle: "Triangle", sawtooth: "Sawtooth", square: "Square",
};
const waveform = (key, label, fallback = "sine") => ({
  key, label, options: WAVEFORM_CHOICES, fallback,
});
const oscillatorBlend = [
  field("analogMix", "Analog layer", 0, 1.5, .01, "×", 0),
  field("pulseMix", "Pulse blend", 0, 1, .01, "", 0),
  field("analogDetune", "Analog detune", 0, 65, 1, "¢", 0),
  field("unison", "FM unison", 0, .65, .01, "", 0),
];
const shaping = [
  field("transient", "Transient", 0, 1, .01, "", 0),
  field("fold", "Wavefold", 0, .8, .01, "", 0),
  field("crush", "Bit crush", 0, .6, .01, "", 0),
  field("formant", "Formant mix", 0, .75, .01, "", 0),
  field("formantFrequency", "Formant frequency", 500, 6500, 1, "Hz", 1800),
  field("comb", "Comb mix", 0, .85, .01, "", 0),
  field("combFeedback", "Comb feedback", 0, .95, .01, "", .55),
];

export function fmGroups(role, { expanded = false } = {}) {
  if (!Object.hasOwn(PATCHES, role)) return [];
  const patch = PATCHES[role];
  const groups = [{ label: "Amplitude ADSR", fields: envelopeFields }];
  if (role === "bass") {
    groups.push(
      { label: "Filter", fields: [
        { ...filter[0], label: "Base cutoff" },
        { ...filter[1], label: "Brightness range" },
        ...filter.slice(2),
      ] },
      { label: "Modulation", fields: [
        field("volumeLfoRate", "Volume LFO rate", .25, 8, .25, "×/beat"),
        field("volumeLfoDepth", "Volume LFO depth", 0, 1, .01),
        field("bassSweep", "Filter sweep rate", 0, 16, .01, "Hz"),
        field("bassSweepDepth", "Filter sweep depth", 0, 2200, 1, "Hz"),
      ] },
    );
  } else if (role === "drums") {
    groups.push({ label: "Filter", fields: [{ ...filter[1], label: "Cutoff", min: 600 }, ...filter.slice(2)] });
  } else if (role === "percussion_texture") {
    groups.push({ label: "Filter", fields: filter });
  } else {
    const unused = patch.algorithm === "parallel" ? ["indices.2", "modDecay.2", "feedback"]
      : patch.algorithm === "carriers" ? ["indices.1", "indices.2", "modDecay.1", "modDecay.2", "feedback"]
      : patch.algorithm === "branch" ? ["feedback"] : [];
    groups.push(
      { label: "Operators and modulation", fields: operators.filter(control => !unused.includes(control.key)) },
      { label: "Filter", fields: filter },
      { label: "LFO", fields: motion },
    );
  }
  if (expanded && role !== "drums") {
    groups[0] = { ...groups[0], fields: [...envelopeFields, level] };
    if (role === "bass") {
      groups.push({ label: "Oscillator blend", fields: [
        waveform("acidWaveform", "Main waveform", "sawtooth"),
        ...oscillatorBlend.slice(0, 2),
        field("cleanSub", "Clean sub", 0, 1.25, .01),
        field("octaveBody", "Octave body", 0, 1, .01),
      ] });
    } else if (role !== "percussion_texture") {
      groups.unshift({ label: "Operator waveforms", fields: Array.from({ length: 4 }, (_, index) =>
        waveform(`waveforms.${index}`, `Operator ${index + 1} waveform`)) });
      groups.push(
        { label: "Oscillator blend", fields: patch.sawWidth
          ? [...oscillatorBlend, field("sawBlend", "Stereo saw blend", 0, 1, .01, "", 0)]
          : oscillatorBlend },
        { label: "Wave shaping", fields: shaping },
      );
    }
  }
  return groups;
}

export function fmDefaultValue(role, control, { factory = false } = {}) {
  const patch = (factory ? FACTORY_PATCHES : PATCHES)[role];
  const [property, index] = control.key.split(".");
  const value = index === undefined ? patch[property] : patch[property]?.[Number(index)];
  if (control.key === "modSustain" && value === undefined) return role === "pad" || role === "strings" ? .42 : .04;
  return value ?? control.fallback;
}

export function normalizeFmPatch(role, values) {
  return normalizeValues(fmGroups(role, { expanded: true }), values,
    control => fmDefaultValue(role, control));
}

function normalizeValues(groups, values, defaultValue) {
  if (!values || typeof values !== "object") return {};
  const result = {};
  for (const { fields } of groups) {
    for (const control of fields) {
      const value = values[control.key];
      if (control.options) {
        if (typeof value === "string" && Object.hasOwn(control.options, value) && value !== defaultValue(control)) {
          result[control.key] = value;
        }
        continue;
      }
      if (!Number.isFinite(value)) continue;
      const normalized = Math.min(control.max, Math.max(control.min, value));
      if (normalized !== defaultValue(control)) result[control.key] = normalized;
    }
  }
  return result;
}

const decay = (min, max) => field("decay", "Decay rate", min, max, .1, "s⁻¹");
const mix = (key, label, max = 1) => field(key, label, 0, max, .01);
const hz = (key, label, min, max) => field(key, label, min, max, 1, "Hz");
const drumVoice = (label, defaults, fields) => ({
  label, defaults,
  groups: [
    { label: "Drum voice", fields },
    { label: "Filter and drive", fields: [{ ...filter[1], label: "Cutoff", min: 600 }, ...filter.slice(2)] },
  ],
});

export const DRUM_VOICES = {
  36: drumVoice("Kick", { fundamental: 51, sweep: 142, sweepRate: 49, decay: 15, click: 1, level: .84 }, [
    waveform("waveform", "Body waveform"),
    hz("fundamental", "Body pitch", 30, 110),
    hz("sweep", "Pitch drop", 0, 400),
    field("sweepRate", "Pitch drop rate", 12, 125, 1, "s⁻¹"),
    decay(4, 65), mix("click", "Attack click", 2), mix("level", "Level", 1.2),
  ]),
  38: drumVoice("Snare", { fundamental: 185, decay: 14, body: .35, noise: .85, level: .18 }, [
    waveform("waveform", "Body waveform"),
    hz("fundamental", "Body pitch", 75, 480),
    decay(5, 65), mix("body", "Tone body", 1.2), mix("noise", "Noise", 1.2), mix("level", "Level", .6),
  ]),
  39: drumVoice("Clap", { decay: 35, spacing: 1, level: .095 }, [
    decay(8, 125), field("spacing", "Burst spacing", .4, 2.5, .01, "×"),
    field("level", "Level", 0, .4, .001),
  ]),
  42: drumVoice("Closed Hi-Hat", { decay: 28, metalPitch: 1, metal: .19, noise: .24, level: .11 }, hatFields()),
  46: drumVoice("Open Hi-Hat", { decay: 8, metalPitch: 1, metal: .19, noise: .24, level: .11 }, hatFields()),
};

function hatFields() {
  return [
    decay(3, 90), field("metalPitch", "Metal pitch", .35, 2, .01, "×"),
    mix("metal", "Metal mix", .8), mix("noise", "Noise", .8), mix("level", "Level", .45),
  ];
}

export function drumDefaultValue(note, control, { factory = false } = {}) {
  const drum = DRUM_VOICES[note];
  const value = factory ? undefined : DRUM_DEFAULTS[note]?.[control.key];
  return value ?? drum?.defaults[control.key] ?? fmDefaultValue("drums", control);
}

export function normalizeDrumPatch(note, values, options) {
  return normalizeValues(DRUM_VOICES[note]?.groups || [], values,
    control => drumDefaultValue(note, control, options));
}

export function rebasePreset(values, groups, defaultValue) {
  // Library presets and older drafts store only differences from the original patches.
  const patch = {};
  for (const { fields } of groups) {
    for (const control of fields) {
      const factoryValue = defaultValue(control, { factory: true });
      if (factoryValue !== defaultValue(control)) patch[control.key] = factoryValue;
    }
  }
  return normalizeValues(groups, { ...patch, ...values }, defaultValue);
}

export function applyFmPatch(base, values) {
  if (!values || !Object.keys(values).length) return base;
  const patch = { ...base };
  for (const [key, value] of Object.entries(values)) {
    const [property, index] = key.split(".");
    if (index === undefined) {
      patch[property] = value;
    } else {
      if (patch[property] === base[property]) patch[property] = [...(base[property] ?? [])];
      patch[property][Number(index)] = value;
    }
  }
  return patch;
}
