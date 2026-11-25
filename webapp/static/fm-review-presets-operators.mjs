const adsr = (operator, attack, decay, sustain, release) => {
  const index = operator - 1;
  return {
    [`operatorEnvelope.${index}`]: "adsr", [`operatorAttack.${index}`]: attack,
    [`operatorDecay.${index}`]: decay, [`operatorSustain.${index}`]: sustain,
    [`operatorRelease.${index}`]: release,
  };
};
const fixed = (operator, hz) => ({
  [`operatorTuning.${operator - 1}`]: "fixed", [`operatorHz.${operator - 1}`]: hz,
});
const patch = (id, name, description, values) => ({ id: `op-${id}`, name, description, values });

const instruments = {
  lead_synth: [
    patch("lead-glass", "Glass to Sine", "A sharp glass strike falls away into a rounded, steady lead.", {
      algorithm: "parallel", "waveforms.0": "sine", "waveforms.1": "sine", "ratios.2": 1.002,
      ...fixed(2, 769), ...adsr(2, .001, .085, .012, .065), "indices.1": 6.1, "indices.3": .18,
      "operatorGain.2": .27, "amp.0": .002, "amp.1": .12, "amp.2": .68, "amp.3": .23,
      analogMix: 0, sawBlend: 0, unison: .04, transient: .02, fold: 0, drive: 1.08,
      "cutoff.0": 2590, "cutoff.1": 9200,
    }),
    patch("lead-reed", "Reed Swell", "Held notes open from soft to buzzy as the modulator swells.", {
      algorithm: "branch", "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 1,
      "ratios.2": 3.02, "ratios.3": 5.01, "indices.1": 4.5, "indices.2": 1.3, "indices.3": .38,
      ...adsr(2, .28, .21, .83, .09), ...adsr(3, .014, .19, .28, .14),
      "amp.0": .022, "amp.1": .10, "amp.2": .84, "amp.3": .24,
      analogMix: 0, sawBlend: 0, fold: .085, "cutoff.0": 1250, "cutoff.1": 4930,
      formant: .42, formantFrequency: 1430, "vibrato.0": .016, "motion.1": .16, drive: 1.26,
    }),
  ],
  counter_synth: [
    patch("arp-mirror", "Mirror Arp", "A fixed, bright tick over an octave tone that retains the note pitch.", {
      algorithm: "parallel", "waveforms.0": "sine", "waveforms.2": "triangle", "ratios.2": 2,
      ...fixed(2, 1337), ...adsr(2, .001, .033, .025, .03), ...adsr(3, .005, .09, .26, .095),
      "indices.1": 4.95, "indices.3": .18, "operatorGain.2": .56, analogMix: 0,
      "amp.0": .002, "amp.1": .13, "amp.2": .32, "amp.3": .12, "cutoff.0": 2850, "cutoff.1": 9700,
      drive: 1.14, resonance: .18, fold: .04,
    }),
    patch("arp-bubble", "Vacuum Arp", "Hollow square tones open briefly and then shut with a dry, rounded pulse.", {
      algorithm: "carriers", "waveforms.0": "square", "waveforms.1": "sine", "waveforms.2": "triangle",
      "ratios.1": .5, "ratios.2": 1.5, "ratios.3": 2,
      "operatorGain.1": .8, "operatorGain.2": .55, "indices.3": 2.6,
      ...adsr(1, .019, .07, .35, .045), ...adsr(4, .038, .04, .08, .035),
      "amp.0": .004, "amp.1": .068, "amp.2": .34, "amp.3": .04,
      "cutoff.0": 700, "cutoff.1": 2620, resonance: .71, analogMix: .02, drive: .91,
    }),
  ],
  bass: [
    patch("bass-sting", "Copper Sting Bass", "A clean low center with a short, bright FM bite on each attack.", {
      acidWaveform: "sine", cleanSub: 1.02, analogMix: .59, pulseMix: .08, octaveBody: .02,
      bassFmAmount: .92, bassFmRatio: 5.19, bassFmIndex: 4.25, bassFmDecay: .041,
      "amp.0": .004, "amp.1": .075, "amp.2": .74, "amp.3": .075, "cutoff.0": 115, "cutoff.1": 390,
      resonance: .21, drive: .91, bassSweep: .5, bassSweepDepth: 135, volumeLfoDepth: .025,
    }),
    patch("bass-rubber", "Hollow Frequency Bass", "A slower, hollow FM overtone over a dark pulse and firm low notes.", {
      acidWaveform: "triangle", cleanSub: .89, analogMix: .69, pulseMix: .13, octaveBody: .19,
      bassFmAmount: .66, bassFmRatio: 2.01, bassFmIndex: 2.82, bassFmDecay: .46,
      "amp.0": .012, "amp.1": .24, "amp.2": .68, "amp.3": .105, "cutoff.0": 90, "cutoff.1": 365,
      resonance: .39, drive: .84, bassSweep: 1.2, bassSweepDepth: 180, volumeLfoRate: 2, volumeLfoDepth: .22,
    }),
  ],
  guitar: [
    patch("guitar-bridge", "Bridge Harmonic", "A bright wire pluck with a sharp harmonic that drops back into the string body.", {
      algorithm: "parallel", "waveforms.0": "triangle", "waveforms.2": "sine", "ratios.1": 2,
      "ratios.2": 3, "ratios.3": 2.01, "indices.1": 2.6, "indices.3": 3.5,
      ...adsr(2, .001, .082, .04, .04), ...adsr(3, .002, .16, .07, .20),
      "operatorGain.2": .75, "amp.0": .003, "amp.1": .24, "amp.2": .28, "amp.3": .24,
      comb: .30, combFeedback: .76, formant: 0, transient: .28, analogMix: 0,
      "cutoff.0": 2430, "cutoff.1": 7300, drive: 1.19,
    }),
    patch("guitar-e-bow", "Soft E-Bow", "A short string attack grows into a soft bowed resonance on held notes.", {
      algorithm: "branch", "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 2.005,
      "ratios.2": 3.05, "ratios.3": 5, "indices.1": 3.4, "indices.2": 2.15, "indices.3": .29,
      ...adsr(2, .23, .22, .74, .15), ...adsr(3, .007, .17, .29, .09),
      "amp.0": .026, "amp.1": .21, "amp.2": .57, "amp.3": .32,
      comb: .63, combFeedback: .77, "cutoff.0": 880, "cutoff.1": 3920, transient: .08,
      formant: .24, formantFrequency: 1180, analogMix: 0, drive: 1.08,
    }),
  ],
  pad: [
    patch("pad-ceramic", "Ceramic Halo", "Dark sustained chords with a slow, distant chime above them.", {
      algorithm: "parallel", "waveforms.0": "sine", "waveforms.2": "triangle", "ratios.1": 2,
      "ratios.2": 2.001, ...fixed(4, 604), "indices.1": .56, "indices.3": 4.4,
      ...adsr(3, .83, .5, .51, .72), ...adsr(4, .54, .47, .35, .30),
      "operatorGain.2": .7, "amp.0": .23, "amp.1": .48, "amp.2": .86, "amp.3": 1.06,
      analogMix: 0, sawBlend: 0, unison: .24, formant: .18, formantFrequency: 1640,
      "cutoff.0": 990, "cutoff.1": 5600, "motion.0": .21, "motion.1": .36, drive: .96,
    }),
    patch("pad-current", "Harmonic Current", "A low soft layer holds steady while upper partials take turns swelling.", {
      algorithm: "carriers", "waveforms.0": "triangle", "waveforms.1": "sine", "waveforms.2": "sawtooth",
      "ratios.1": .5, "ratios.2": 1.005, "ratios.3": 2.98, "indices.3": 3.25,
      ...adsr(2, .115, .55, .51, .50), ...adsr(3, .54, .62, .72, .94), ...adsr(4, .11, .74, .1, .19),
      "operatorGain.1": .76, "operatorGain.2": .86, "amp.0": .17, "amp.1": .51, "amp.2": .88, "amp.3": 1.20,
      analogMix: .27, sawBlend: .14, analogDetune: 47, unison: .39,
      "cutoff.0": 720, "cutoff.1": 4200, "motion.0": .37, "motion.1": .74, drive: .92,
    }),
  ],
  organ: [
    patch("organ-glass", "Glass Registration", "A clean octave organ with a short upper chime on each chord.", {
      algorithm: "carriers", "waveforms.0": "sine", "waveforms.1": "sine", "waveforms.2": "triangle",
      "ratios.1": 2, "ratios.2": 4, "ratios.3": 1.5, "indices.3": 2.2,
      ...adsr(3, .002, .105, .15, .038), ...adsr(4, .002, .076, .09, .035),
      "operatorGain.1": 1.25, "operatorGain.2": 1.05,
      "amp.0": .004, "amp.1": .106, "amp.2": .92, "amp.3": .075,
      "cutoff.0": 2480, "cutoff.1": 8700, transient: 0, analogMix: 0, drive: .97,
    }),
    patch("organ-reed", "Stopped Reed Organ", "A hollow held organ chord with a slow, reedy middle register.", {
      algorithm: "parallel", "waveforms.0": "triangle", "waveforms.2": "square", "ratios.1": 3,
      "ratios.2": 1, "ratios.3": 2.99, "indices.1": .7, "indices.3": 1.95,
      ...adsr(3, .15, .24, .78, .19), ...adsr(4, .085, .21, .47, .085), "operatorGain.2": .7,
      "amp.0": .035, "amp.1": .13, "amp.2": .82, "amp.3": .21,
      "cutoff.0": 735, "cutoff.1": 2650, formant: .35, formantFrequency: 990,
      "motion.0": 3.65, "motion.1": .51, analogMix: 0, drive: 1.13,
    }),
  ],
  keys_mallet: [
    patch("keys-celesta", "Tin Celesta", "A fixed-frequency strike over a clear key tone, with a short metallic tail.", {
      algorithm: "parallel", "waveforms.0": "sine", "waveforms.2": "sine", "ratios.2": 2.01, "ratios.3": 3.53,
      ...fixed(2, 988), ...adsr(2, .001, .105, .03, .052), ...adsr(3, .002, .29, .12, .25),
      "indices.1": 6.15, "indices.3": 2.2, "operatorGain.2": .65,
      "amp.0": .002, "amp.1": .31, "amp.2": .18, "amp.3": .35,
      "cutoff.0": 2850, "cutoff.1": 9400, comb: .08, analogMix: 0, transient: .08, drive: 1.03,
    }),
    patch("keys-clavi", "Muted Clavi", "A dry, narrow pluck with a little reed buzz that cuts off quickly.", {
      algorithm: "branch", "waveforms.0": "triangle", "waveforms.1": "square", "ratios.1": 2,
      "ratios.2": 3, "indices.1": 3.5, "indices.2": 1.8, "indices.3": .17,
      ...adsr(2, .002, .078, .13, .028), ...adsr(3, .001, .033, .04, .025),
      "amp.0": .002, "amp.1": .078, "amp.2": .14, "amp.3": .043,
      "cutoff.0": 970, "cutoff.1": 4250, resonance: .45, comb: .32, combFeedback: .44,
      formant: .19, formantFrequency: 1110, fold: .09, transient: .19, analogMix: 0, drive: 1.3,
    }),
  ],
  percussion_texture: [
    patch("perc-grain", "Sand Relay", "Grainy, almost unpitched bursts with a dry, close tail.", {
      circuit: "steps", circuitMix: .87, circuitRate: 790, "amp.0": .001, "amp.1": .07, "amp.2": .22,
      "amp.3": .065, "cutoff.0": 780, "cutoff.1": 6820, resonance: .27, drive: 1.82, level: .32,
    }),
    patch("perc-bloom", "Suction Pop", "Small reversed-feeling hits that swell briefly and cut off.", {
      circuit: "bloom", circuitMix: .95, circuitRate: 31, "amp.0": .014, "amp.1": .10, "amp.2": .58,
      "amp.3": .042, "cutoff.0": 1690, "cutoff.1": 7100, resonance: .52, drive: 2.48, level: .35,
    }),
  ],
};

const drums = {
  36: [
    patch("kick-sub", "Round Floor Kick", "A low, rounded thump with a long body and very little beater.", {
      waveform: "sine", fundamental: 42, sweep: 42, sweepRate: 108, decay: 15, click: .038, level: .86,
    }),
    patch("kick-stub", "Dead Stop Kick", "A tight short punch with a brief noise edge and a fast low-end cutoff.", {
      waveform: "sine", fundamental: 54, sweep: 69, sweepRate: 103, decay: 46, click: .6, level: .91,
    }),
  ],
  38: [
    patch("snare-side", "Side-Stick Snap", "A light, short click with a little high shell ring.", {
      waveform: "triangle", fundamental: 307, decay: 58, body: .39, noise: .39, level: .28,
      "cutoff.1": 5020, resonance: .28, drive: 1.68,
    }),
    patch("snare-air", "Airbrush Snare", "A wider wash of filtered noise over a soft, low drumhead.", {
      waveform: "sine", fundamental: 118, decay: 12, body: .12, noise: 1.06, level: .22,
      "cutoff.1": 3470, resonance: .42, circuit: "bloom", circuitMix: .36, circuitRate: 31,
    }),
  ],
  39: [
    patch("clap-flam", "Split Handclap", "A clearly separated double-feeling clap with a quick fade.", {
      decay: 70, spacing: 2.03, level: .17, "cutoff.1": 8450, resonance: .24, drive: 1.2,
    }),
    patch("clap-room", "Folded Room Clap", "A low, dense clap with a short compressed edge and soft tail.", {
      decay: 21, spacing: .73, level: .11, "cutoff.1": 2840,
      resonance: .56, circuit: "clip", circuitMix: .48, drive: 1.72,
    }),
  ],
  42: [
    patch("hat-foil", "Foil Tick", "An extremely short, thin metal tick with sparse noise.", {
      decay: 79, metalPitch: 1.63, metal: .57, noise: .11, level: .17, "cutoff.1": 12200, drive: 1.15,
    }),
    patch("hat-brush", "Brush Hat", "A soft dry brush of noise with almost no metallic ringing.", {
      decay: 24, metalPitch: .77, metal: .028, noise: .8, level: .13, "cutoff.1": 6110, resonance: .16,
    }),
  ],
  46: [
    patch("open-sand", "Wide Brush Open Hat", "A longer soft noise wash with a muted metal core.", {
      decay: 5.6, metalPitch: .71, metal: .068, noise: .8, level: .092, "cutoff.1": 6980, drive: 1.08,
    }),
    patch("open-choke", "Relay Open Hat", "A dark metallic open hat with a subtle flutter in the tail.", {
      decay: 12.8, metalPitch: .46, metal: .38, noise: .32, level: .13, "cutoff.1": 4120,
      circuit: "gate", circuitMix: .67, circuitRate: 34, resonance: .33,
    }),
  ],
  43: [
    patch("tom-low-felt", "Damped Floor Tom", "A deep, very soft body with a quick dry cutoff.", {
      waveform: "sine", fundamental: 54, sweep: 20, decay: 55, noise: .04, level: .42, "cutoff.1": 1520,
    }),
    patch("tom-low-rim", "Low Rim Relay", "An electronic floor tom with an audible woody rim and pitch fall.", {
      waveform: "triangle", fundamental: 79, sweep: 84, decay: 23, noise: .38, level: .38,
      circuit: "steps", circuitMix: .56, circuitRate: 3350, "cutoff.1": 5100,
    }),
  ],
  47: [
    patch("tom-mid-ring", "Hollow Rack Tom", "A hollow rack tom with a longer springy body and a gentle strike.", {
      waveform: "triangle", fundamental: 104, sweep: 64, decay: 14, noise: .1, level: .35, "cutoff.1": 2490,
    }),
    patch("tom-mid-block", "Dry Rack Block", "A short noisy tap with a small falling body and little ring.", {
      waveform: "sine", fundamental: 119, sweep: 28, decay: 61, noise: .49, level: .37,
      "cutoff.1": 4840, resonance: .37, drive: 1.43,
    }),
  ],
  50: [
    patch("tom-high-press", "Tight Skin Tom", "A high, mostly dry skin tap with minimal noise and a tight decay.", {
      waveform: "sine", fundamental: 172, sweep: 31, decay: 54, noise: .07, level: .42, "cutoff.1": 2710,
    }),
    patch("tom-high-ceramic", "Ceramic Drop Tom", "A longer high tom with a falling, slightly ceramic edge.", {
      waveform: "triangle", fundamental: 189, sweep: 103, decay: 19, noise: .21, level: .36,
      circuit: "ring", circuitMix: .34, circuitRate: 107, "cutoff.1": 7000, drive: 1.39,
    }),
  ],
};

export const operatorReviewPresets = [
  ...Object.entries(instruments).flatMap(([role, presets]) => presets.map(preset => ({ ...preset, role }))),
  ...Object.entries(drums).flatMap(([note, presets]) => presets.map(preset => ({ ...preset, role: "drums", note: Number(note) }))),
];
