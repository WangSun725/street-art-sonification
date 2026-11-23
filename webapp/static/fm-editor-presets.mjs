const preset = (name, values) => ({ name, values });
const yourPatch = values => preset("Your exported patch", values);

export const instrumentPresets = {
  lead_synth: [
    yourPatch({
      "amp.0": .003, "ratios.1": 2.919, "ratios.3": 10.317, "indices.2": 5.19, "indices.3": 3.39,
      modSustain: .25, "cutoff.0": 2837, "cutoff.1": 12779, "vibrato.0": .138, unison: .28,
      fold: .16, formant: .43, comb: .14,
    }),
    preset("Velvet Lead", {
      "waveforms.0": "triangle", "amp.0": .025, "amp.3": .19, "indices.1": .34,
      "cutoff.0": 900, "cutoff.1": 3700, analogMix: .14, sawBlend: .19, "vibrato.0": .085, fold: 0,
    }),
    preset("Neon Reed", {
      "waveforms.0": "square", "waveforms.1": "triangle", "ratios.1": 1,
      "indices.1": .85, "amp.0": .004, "amp.2": .73, "cutoff.1": 6500,
      analogMix: .19, sawBlend: .13, formant: .27, formantFrequency: 1750, level: .11,
    }),
    preset("Wide Saw Lead", {
      "waveforms.0": "sawtooth", "indices.1": .32, "amp.3": .22, analogMix: .83,
      sawBlend: .58, analogDetune: 43, unison: .28, "cutoff.1": 9000, drive: 1.45,
    }),
  ],
  counter_synth: [
    preset("Glass Arp", {
      "waveforms.3": "triangle", "ratios.1": 3, "ratios.3": 5.01, "indices.1": 2.15,
      "amp.1": .05, "amp.2": .09, "amp.3": .22, analogMix: .025, "cutoff.1": 11200,
    }),
    preset("Pocket Pulse", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.2": 2,
      "indices.1": .1, "indices.3": .14, "amp.2": .38, "amp.3": .05, analogMix: 0,
      "cutoff.0": 1800, "cutoff.1": 6500, formant: 0,
    }),
    preset("Copper Pluck", {
      "waveforms.0": "triangle", "waveforms.1": "square", "waveforms.2": "sawtooth",
      "indices.1": .48, "indices.3": .38, "amp.1": .1, "amp.3": .19, "cutoff.0": 820,
      "cutoff.1": 3900, analogMix: .06, comb: .33, combFeedback: .58, drive: 1.6,
    }),
  ],
  bass: [
    yourPatch({ "cutoff.1": 548 }),
    preset("Round Sub", {
      acidWaveform: "sine", analogMix: .58, pulseMix: 0, cleanSub: 1.06, octaveBody: .09,
      "cutoff.0": 105, "cutoff.1": 430, resonance: .19, drive: 1.18,
      bassSweepDepth: 70, volumeLfoDepth: .28,
    }),
    preset("Hollow Acid", {
      acidWaveform: "square", analogMix: .77, pulseMix: .08, cleanSub: .58, octaveBody: .17,
      "cutoff.0": 165, "cutoff.1": 1080, resonance: .82, drive: 2.14, bassSweepDepth: 770,
    }),
    preset("Triangle Wobble", {
      acidWaveform: "triangle", analogMix: .65, pulseMix: .31, cleanSub: .69, octaveBody: .28,
      "cutoff.0": 130, "cutoff.1": 1120, resonance: .69, drive: 2.25, volumeLfoRate: 4,
      volumeLfoDepth: .56, bassSweep: 1.3, bassSweepDepth: 1300,
    }),
  ],
  guitar: [
    preset("Nylon Pluck", {
      "waveforms.0": "triangle", "indices.1": .72, "indices.2": .64, "amp.3": .32,
      "cutoff.0": 1050, "cutoff.1": 4600, analogMix: .05, transient: .16, drive: 1.04,
    }),
    preset("Clean Bridge", {
      "waveforms.0": "sawtooth", "waveforms.3": "triangle", "indices.1": .52,
      "indices.2": 1.02, "amp.2": .26, "cutoff.1": 6800, analogMix: .1,
      comb: .42, combFeedback: .51, drive: 1.33,
    }),
    preset("Fuzz String", {
      "waveforms.0": "square", "waveforms.2": "triangle", "indices.1": .79,
      "indices.2": 1.15, "amp.2": .4, "amp.3": .16, comb: .2, fold: .35,
      drive: 2.75, "cutoff.1": 4250, level: .106,
    }),
  ],
  pad: [
    preset("Soft Mist", {
      "waveforms.0": "triangle", "waveforms.2": "sine", "amp.0": .3, "amp.3": .65,
      "indices.1": .3, "indices.3": .22, "cutoff.0": 720, "cutoff.1": 3200,
      analogMix: .26, sawBlend: .32, "motion.1": .2, level: .17,
    }),
    preset("Slow Prism", {
      "waveforms.0": "sawtooth", "waveforms.2": "triangle", "waveforms.3": "square",
      "indices.1": .52, "indices.3": .9, "amp.0": .19, "amp.3": .72, sawBlend: .24,
      analogMix: .46, "cutoff.1": 6900, "motion.0": .65, "motion.1": .55,
    }),
    preset("Hollow Choir", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.1": 2, "amp.0": .26,
      "amp.3": .72, "indices.1": .24, "indices.3": .47, analogMix: .28, sawBlend: .19,
      "cutoff.0": 1050, "cutoff.1": 4900, formant: .39, formantFrequency: 1050,
    }),
  ],
  organ: [
    preset("Soft Drawbar", {
      "waveforms.2": "triangle", "ratios.2": 3, "indices.1": .1, "indices.3": .06,
      "cutoff.0": 930, "cutoff.1": 4300, "amp.2": .92, drive: 1, "vibrato.0": .035,
    }),
    preset("Reed Organ", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.2": 2,
      "amp.2": .8, "amp.3": .1, "indices.1": .16, "cutoff.0": 1700,
      "cutoff.1": 5600, formant: .3, formantFrequency: 1650,
    }),
    preset("Pipe Registration", {
      "waveforms.0": "sine", "waveforms.2": "sawtooth", "ratios.2": 1.5,
      "indices.1": .09, "indices.3": .28, "amp.0": .075, "amp.3": .29,
      "cutoff.0": 820, "cutoff.1": 3850, analogMix: .025, "motion.1": .15,
    }),
  ],
  keys_mallet: [
    preset("Wood Mallet", {
      "waveforms.1": "triangle", "ratios.1": 4, "indices.1": 1.45, "indices.2": .65,
      "amp.1": .14, "amp.2": .055, "amp.3": .15, "cutoff.0": 980, "cutoff.1": 4800,
      analogMix: 0, formant: 0, transient: .3, comb: .16, fold: 0,
    }),
    preset("Electric Tines", {
      "waveforms.1": "square", "waveforms.3": "triangle", "ratios.1": 1,
      "ratios.2": 3, "indices.1": 1.8, "indices.2": .48, "indices.3": .65,
      "amp.2": .38, "amp.3": .36, "modDecay.1": .21, comb: 0, "cutoff.1": 7300,
    }),
    preset("Crystal Bells", {
      "waveforms.2": "triangle", "waveforms.3": "square", "ratios.1": 2.76,
      "ratios.2": 5.38, "ratios.3": 8.15, "indices.1": 2.55, "indices.2": 2.3,
      "amp.2": .25, "amp.3": .64, "modDecay.2": .12, "cutoff.1": 12200, comb: .23,
    }),
  ],
  percussion_texture: [
    preset("Dry Wood", {
      "amp.1": .064, "amp.2": .22, "amp.3": .05, "cutoff.0": 520, "cutoff.1": 3400, resonance: .3, drive: 1.12,
    }),
    preset("Bright Sand", {
      "amp.0": .014, "amp.1": .085, "amp.2": .72, "cutoff.0": 7100, "cutoff.1": 14700, resonance: .24, drive: 1.36,
    }),
    preset("Crushed Rim", {
      "amp.1": .037, "amp.2": .42, "cutoff.0": 1000, "cutoff.1": 5100, resonance: .78, drive: 3.35, level: .15,
    }),
  ],
};

export const drumPresets = {
  36: [
    preset("Short Thump", { fundamental: 46, sweep: 146, sweepRate: 84, decay: 32, click: .82 }),
    preset("Sub Kick", { fundamental: 43, sweep: 84, decay: 10, click: .25, level: .88 }),
    preset("Punch Kick", { waveform: "triangle", fundamental: 55, sweep: 190, sweepRate: 72, decay: 23, click: 1.45 }),
    preset("Distorted Kick", { waveform: "sawtooth", fundamental: 47, sweep: 145, decay: 12, drive: 2.9, "cutoff.1": 3700, level: .65 }),
  ],
  38: [
    yourPatch({ fundamental: 189, body: .65, drive: 2.81 }),
    preset("Dry Snare", { waveform: "triangle", fundamental: 169, decay: 24, body: .55, noise: .42, "cutoff.1": 6700 }),
    preset("Drum Machine Snare", { fundamental: 229, decay: 12, body: .52, noise: 1.07, "cutoff.1": 9900, drive: 2.5 }),
    preset("Electric Snap", { waveform: "square", fundamental: 265, decay: 35, body: .76, noise: .55, resonance: .47, level: .19 }),
  ],
  39: [
    yourPatch({ decay: 28.7 }),
    preset("Tight Clap", { decay: 56, spacing: .6, "cutoff.1": 10500, level: .112 }),
    preset("Roomy Clap", { decay: 21, spacing: 1.65, "cutoff.1": 6600, level: .105 }),
    preset("Bright Stack", { decay: 37, spacing: 1.29, "cutoff.1": 15000, drive: 3.3, level: .098 }),
  ],
  42: [
    preset("Dry Tick", { decay: 56, metalPitch: 1.19, metal: .18, noise: .06, "cutoff.1": 7900 }),
    preset("Loose Hat", { decay: 16, metalPitch: .81, metal: .16, noise: .53, level: .12 }),
    preset("Bright Closed Hat", { decay: 35, metalPitch: 1.41, metal: .34, noise: .35, "cutoff.1": 15000 }),
  ],
  46: [
    preset("Short Open Hat", { decay: 15, metalPitch: 1.02, metal: .25, noise: .32 }),
    preset("Soft Wash", { decay: 5.5, metalPitch: .77, metal: .09, noise: .66, "cutoff.1": 7300, level: .105 }),
    preset("Bright Open Hat", { decay: 7, metalPitch: 1.38, metal: .29, noise: .32, "cutoff.1": 15000 }),
  ],
};
