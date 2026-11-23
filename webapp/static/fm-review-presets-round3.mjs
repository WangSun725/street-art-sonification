const patch = (id, name, description, values) => ({ id: `r3-${id}`, name, description, values });

const instruments = {
  lead_synth: [
    patch("lead-paper-cone", "Paper Cone Lead", "A dry, forward midrange and a quick, rounded attack for short notes.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 1, "ratios.2": 2, "ratios.3": 3,
      "indices.1": 1.28, "indices.2": .48, "indices.3": .14, "modDecay.1": .057, modSustain: .20,
      "amp.0": .004, "amp.1": .105, "amp.2": .70, "amp.3": .065, "cutoff.0": 800, "cutoff.1": 4700,
      analogMix: 0, sawBlend: 0, unison: 0, "vibrato.0": .018, transient: .11, fold: 0,
    }),
    patch("lead-twin-sine", "Twin Sine Lead", "A stable fundamental with a lightly doubled octave and a medium release.", {
      "waveforms.0": "sine", "waveforms.1": "sine", "waveforms.2": "sine",
      "ratios.0": 1, "ratios.1": 1, "ratios.2": 2, "ratios.3": 2, "indices.1": .21, "indices.2": .41,
      "indices.3": .025, "amp.0": .010, "amp.1": .18, "amp.2": .88, "amp.3": .17,
      "cutoff.0": 1600, "cutoff.1": 4900, analogMix: .022, sawBlend: 0, unison: .19,
      "vibrato.0": .02, "motion.1": .03, drive: .86, fold: 0,
    }),
    patch("lead-vowel", "Vowel Glide", "A soft vocal-like middle register that stays clear while notes slide together.", {
      "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 2, "ratios.2": 4, "ratios.3": 3,
      "indices.1": .44, "indices.2": .10, "indices.3": .05, modSustain: .22,
      "amp.0": .026, "amp.1": .12, "amp.2": .84, "amp.3": .115, "cutoff.0": 640, "cutoff.1": 3950,
      formant: .34, formantFrequency: 860, analogMix: 0, sawBlend: 0, "vibrato.0": .018, resonance: .19,
    }),
    patch("lead-soft-pulse", "Rounded Pulse Lead", "A compact electronic pulse with soft edges and an immediate start.", {
      "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 3, "ratios.2": 2, "ratios.3": 6,
      "indices.1": .40, "indices.2": .23, "indices.3": .06, modSustain: .14,
      "amp.0": .006, "amp.1": .17, "amp.2": .79, "amp.3": .086, "cutoff.0": 480, "cutoff.1": 2650,
      analogMix: .32, pulseMix: .65, sawBlend: 0, analogDetune: 6, drive: 1.4, fold: .015, "vibrato.0": .025,
    }),
    patch("lead-clear-strike", "Clear Strike Lead", "A brief bright strike over an even, pitched body for articulated melodies.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 3, "ratios.2": 2, "ratios.3": 6,
      "indices.1": 2.75, "indices.2": .25, "indices.3": .07, "modDecay.1": .027, modSustain: .035,
      "amp.0": .003, "amp.1": .081, "amp.2": .56, "amp.3": .102, "cutoff.0": 1450, "cutoff.1": 6900,
      analogMix: .026, sawBlend: 0, unison: .032, transient: .23, "vibrato.0": .01, fold: 0,
    }),
  ],
  bass: [
    patch("bass-folded-sine", "Folded Sine Bass", "A clean low foundation with a short, rounded upper accent on the beat.", {
      acidWaveform: "sine", analogMix: .69, pulseMix: .12, cleanSub: 1.02, octaveBody: .54,
      "amp.0": .002, "amp.1": .058, "amp.2": .57, "amp.3": .035, "cutoff.0": 125, "cutoff.1": 1070,
      resonance: .44, drive: 1.75, bassSweep: .3, bassSweepDepth: 300, volumeLfoRate: 1, volumeLfoDepth: .45,
    }),
    patch("bass-two-step", "Two-Step Bass", "A mellow saw bass with a regular twice-per-beat volume pulse and a restrained filter.", {
      acidWaveform: "sawtooth", analogMix: 1.05, pulseMix: .025, cleanSub: .88, octaveBody: .14,
      "amp.0": .005, "amp.1": .125, "amp.2": .83, "amp.3": .055, "cutoff.0": 80, "cutoff.1": 700,
      resonance: .28, drive: 1.23, bassSweep: .42, bassSweepDepth: 200, volumeLfoRate: 2, volumeLfoDepth: .8,
    }),
  ],
  guitar: [
    patch("guitar-flatwound", "Thumbed Flatwound", "A rounded thumb attack and a short, controlled string resonance.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 2, "ratios.2": 3, "ratios.3": 2,
      "indices.1": .83, "indices.2": .34, "indices.3": .19, "modDecay.1": .06, modSustain: .09,
      "amp.0": .004, "amp.1": .105, "amp.2": .09, "amp.3": .18, "cutoff.0": 720, "cutoff.1": 2470,
      comb: .16, formant: .17, formantFrequency: 515, transient: .22, drive: 1.02, fold: 0,
    }),
    patch("guitar-body", "Acoustic Body Pluck", "A clear pick followed by a warm wooden body and a fading string tail.", {
      "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 2, "ratios.2": 5, "ratios.3": 4,
      "indices.1": 1.10, "indices.2": 1.05, "indices.3": .29, "modDecay.1": .11, "modDecay.2": .047,
      "amp.0": .003, "amp.1": .34, "amp.2": .13, "amp.3": .45, "cutoff.0": 1180, "cutoff.1": 4800,
      comb: .31, combFeedback: .48, formant: .29, formantFrequency: 1170, transient: .31, fold: 0,
    }),
  ],
  pad: [
    patch("pad-quartz", "Quartz Chord Bed", "A transparent, slowly emerging chord with a steady high harmonic layer.", {
      "waveforms.0": "sine", "waveforms.2": "sine", "ratios.1": 2, "ratios.2": 2, "ratios.3": 3,
      "indices.1": .59, "indices.3": .25, modSustain: .43, "amp.0": .23, "amp.1": .56,
      "amp.2": .85, "amp.3": .73, "cutoff.0": 1600, "cutoff.1": 5080,
      analogMix: 0, sawBlend: 0, unison: .07, comb: .04, "motion.1": .10, drive: .9,
    }),
    patch("pad-pulse", "Velvet Pulse Pad", "Wide, softly pulsing chords with rounded harmonics and a short tail.", {
      "waveforms.0": "triangle", "waveforms.2": "triangle", "ratios.1": 1, "ratios.2": 2,
      "indices.1": 1.37, "indices.3": .25, modSustain: .74,
      "amp.0": .115, "amp.1": .32, "amp.2": .68, "amp.3": .31, "cutoff.0": 530, "cutoff.1": 3100,
      analogMix: .26, pulseMix: .72, sawBlend: 0, analogDetune: 24, "motion.0": 2.15, "motion.1": .59,
    }),
  ],
  organ: [
    patch("organ-foundation", "Low Drawbar Foundation", "An even low drawbar tone with soft upper registers and a quick cutoff.", {
      "waveforms.0": "triangle", "waveforms.1": "sine", "waveforms.2": "sine", "ratios.0": 1, "ratios.1": 1, "ratios.2": 2,
      "indices.1": .19, "indices.3": .075, "amp.0": .008, "amp.1": .11, "amp.2": .93, "amp.3": .061,
      "cutoff.0": 510, "cutoff.1": 2220, analogMix: 0, drive: .93, transient: .025, "vibrato.0": .01,
    }),
    patch("organ-principal", "Principal Stop", "A quick, steady pipe-organ tone with a clear octave above the chord.", {
      "waveforms.0": "sine", "waveforms.2": "triangle", "ratios.0": 1, "ratios.1": 2, "ratios.2": 2, "ratios.3": 3,
      "indices.1": .29, "indices.3": .15, modSustain: .49, "amp.0": .014, "amp.1": .12,
      "amp.2": .91, "amp.3": .134, "cutoff.0": 980, "cutoff.1": 4960, "vibrato.0": .025, drive: 1.12,
    }),
    patch("organ-soft-chiff", "Soft Chiff Pipes", "A short breath-like accent over a steady pipe chord.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "waveforms.2": "sine", "ratios.1": 8, "ratios.2": 2, "ratios.3": 5,
      "indices.1": 1.76, "indices.3": .34, "modDecay.1": .021, modSustain: .025,
      "amp.0": .006, "amp.1": .15, "amp.2": .9, "amp.3": .108, "cutoff.0": 1850, "cutoff.1": 8100,
      transient: .26, analogMix: 0, "vibrato.0": .018, drive: 1.02,
    }),
  ],
  keys_mallet: [
    patch("keys-felt", "Felt Upright Keys", "A soft hammer strike, a round pitched body, and a damped release.", {
      "waveforms.0": "sine", "waveforms.1": "sine", "ratios.1": 1, "ratios.2": 2.01, "ratios.3": 3,
      "indices.1": .62, "indices.2": .13, "indices.3": .05, "modDecay.1": .135, modSustain: .035,
      "amp.0": .012, "amp.1": .46, "amp.2": .22, "amp.3": .115, "cutoff.0": 460, "cutoff.1": 2390,
      analogMix: 0, comb: .07, transient: .045, "vibrato.0": 0, drive: 1.08,
    }),
    patch("keys-reed", "Reed Electric Keys", "A firm attack that softens into a round electric-piano sustain.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 2, "ratios.2": 3,
      "indices.1": 2.14, "indices.2": .52, "modDecay.1": .078, modSustain: .12,
      "amp.0": .007, "amp.1": .185, "amp.2": .43, "amp.3": .166, "cutoff.0": 580, "cutoff.1": 3650,
      analogMix: 0, formant: .21, formantFrequency: 1220, drive: 1.72, transient: .165,
    }),
    patch("keys-ceramic", "Ceramic Bars", "A soft strike with a bright ceramic overtone and a clean, moderate decay.", {
      "waveforms.0": "sine", "waveforms.1": "sine", "ratios.1": 3.98, "ratios.2": 7.06, "ratios.3": 5.02,
      "indices.1": 1.72, "indices.2": .62, "indices.3": .19, "modDecay.1": .14,
      "amp.0": .009, "amp.1": .39, "amp.2": .08, "amp.3": .24, "cutoff.0": 1250, "cutoff.1": 7750,
      analogMix: 0, transient: .075, comb: .06, drive: 1.13, "vibrato.0": 0,
    }),
  ],
  percussion_texture: [
    patch("perc-paper", "Paper Flick", "Light, dry noise with a soft edge and a compact tail.", {
      "amp.0": .009, "amp.1": .037, "amp.2": .07, "amp.3": .037,
      "cutoff.0": 1810, "cutoff.1": 6500, resonance: .04, drive: 1.24, level: .32,
    }),
    patch("perc-rim", "Rounded Rim Tap", "A short wooden knock with a little low-mid resonance.", {
      "amp.0": .002, "amp.1": .078, "amp.2": .15, "amp.3": .048,
      "cutoff.0": 520, "cutoff.1": 1410, resonance: .57, drive: 2.06, level: .35,
    }),
    patch("perc-grain", "Bristle Shaker", "A grainy attack that expands briefly and stays out of the high metallic range.", {
      "amp.0": .014, "amp.1": .055, "amp.2": .40, "amp.3": .127,
      "cutoff.0": 2180, "cutoff.1": 5300, resonance: .22, drive: 2.31, level: .33,
    }),
  ],
};

const drums = {
  36: [
    patch("kick-studio", "Studio Thump", "Fast pitch drop and a damped low body with a soft noise beater.", {
      waveform: "sine", fundamental: 49, sweep: 197, sweepRate: 122, decay: 43,
      click: .51, "cutoff.1": 1300, resonance: .04, drive: .93, level: .94,
    }),
    patch("kick-rubber", "Rubber Head Kick", "A compact low knock with a little textured weight and a very short top end.", {
      waveform: "triangle", fundamental: 41, sweep: 110, sweepRate: 110, decay: 46,
      click: .19, "cutoff.1": 740, resonance: .06, drive: 1.18, level: .88,
    }),
  ],
  38: [
    patch("snare-maple", "Maple Rim Snare", "A midrange wood-and-wire hit with a dry, defined attack.", {
      waveform: "triangle", fundamental: 214, decay: 32, body: .41, noise: .73,
      "cutoff.1": 4260, resonance: .18, drive: 1.36, level: .24,
    }),
    patch("snare-skin", "Damped Skin Snare", "A soft, low head strike with a compact noise tail.", {
      waveform: "sine", fundamental: 131, decay: 38, body: .61, noise: .44,
      "cutoff.1": 2770, resonance: .12, drive: 1.45, level: .28,
    }),
    patch("snare-brush", "Brush Backbeat", "A medium-length diffuse brush strike with a light drumhead underneath.", {
      waveform: "triangle", fundamental: 167, decay: 15, body: .21, noise: .97,
      "cutoff.1": 6200, resonance: .19, drive: .95, level: .24,
    }),
  ],
  39: [
    patch("clap-one", "Single Palm Clap", "A concentrated clap with closely packed attacks and a dry end.", {
      decay: 70, spacing: .43, "cutoff.1": 5400, resonance: .14, drive: 1.45, level: .13,
    }),
    patch("clap-mid", "Midrange Handclap", "Fast handclap bursts with a warm band of midrange noise.", {
      decay: 40, spacing: .94, "cutoff.1": 2850, resonance: .42, drive: 1.27, level: .14,
    }),
    patch("clap-layered", "Soft Group Clap", "A spread of gentle hand strikes with an audible, rounded decay.", {
      decay: 21, spacing: 1.38, "cutoff.1": 4900, resonance: .15, drive: .71, level: .14,
    }),
  ],
  42: [
    patch("closed-chick", "Pedal Chick", "A compact pedal sound with a short, low-tuned metallic accent.", {
      decay: 73, metalPitch: .86, metal: .15, noise: .31, "cutoff.1": 5800, resonance: .08, drive: 1.18, level: .135,
    }),
    patch("closed-silk", "Silk Hi-Hat", "A softer, noise-led closed hat with very little metallic ring.", {
      decay: 44, metalPitch: .72, metal: .01, noise: .64, "cutoff.1": 8700, resonance: .075, drive: .82, level: .15,
    }),
  ],
  46: [
    patch("open-breath", "Breathing Open Hat", "A long and soft wash centered in the mid highs, with little metal ring.", {
      decay: 4.3, metalPitch: .77, metal: .018, noise: .64, "cutoff.1": 7500, resonance: .085, drive: .82, level: .108,
    }),
    patch("open-brush", "Brushed Open Hat", "A medium-length airy noise stroke with a small bright edge.", {
      decay: 11.3, metalPitch: 1.36, metal: .11, noise: .35, "cutoff.1": 10100, resonance: .17, drive: 1.12, level: .124,
    }),
  ],
  43: [
    patch("low-tom-wood", "Wood Shell Low Tom", "A falling low shell tone with a quick stick attack and a short tail.", {
      waveform: "triangle", fundamental: 61, sweep: 38, decay: 27, noise: .23,
      "cutoff.1": 3050, resonance: .15, drive: 1.31, level: .34,
    }),
    patch("low-tom-ceramic", "Soft Head Low Tom", "A soft, nearly round head tone with room for the rest of a fill.", {
      waveform: "sine", fundamental: 72, sweep: 9, decay: 17, noise: .095,
      "cutoff.1": 2480, resonance: .18, drive: .9, level: .28,
    }),
  ],
};

export const roundThreePresets = [
  ...Object.entries(instruments).flatMap(([role, presets]) => presets.map(preset => ({ ...preset, role }))),
  ...Object.entries(drums).flatMap(([note, presets]) => presets.map(preset => ({ ...preset, role: "drums", note: Number(note) }))),
];
