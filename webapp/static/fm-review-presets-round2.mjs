const patch = (id, name, description, values) => ({ id, name, description, values });

const instruments = {
  lead_synth: [
    patch("r2-lead-glassblade", "Glass Blade", "A firm, narrow lead with a bright inharmonic edge that fades into a clear note.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 2.73, "ratios.2": 5.4, "ratios.3": 8.08,
      "indices.1": 2.75, "indices.2": 1.9, "indices.3": .48, "modDecay.1": .071, modSustain: .10,
      "amp.0": .004, "amp.1": .14, "amp.2": .68, "amp.3": .19, analogMix: 0, sawBlend: .025,
      "cutoff.0": 2150, "cutoff.1": 9200, "vibrato.0": .075, unison: .025, fold: .02,
    }),
    patch("r2-lead-whistle", "Ribbon Whistle", "A clean high-register synth whistle with a soft onset and long phrasing.", {
      "waveforms.0": "sine", "ratios.0": 2, "ratios.1": 4, "indices.1": .13, "indices.2": .03,
      "amp.0": .15, "amp.1": .31, "amp.2": .94, "amp.3": .39, analogMix: .015, sawBlend: .01, unison: 0,
      "cutoff.0": 1050, "cutoff.1": 2880, "vibrato.0": .31, "vibrato.1": 4.05, fold: 0, drive: 1.01,
    }),
    patch("r2-lead-divider", "Octave Divider", "A low octave under the melody and a bright chopped upper edge.", {
      "waveforms.0": "square", "waveforms.1": "triangle", "ratios.0": .5, "ratios.1": 1, "ratios.2": 3,
      "indices.1": .83, "indices.2": .31, "amp.0": .002, "amp.1": .085, "amp.2": .57, "amp.3": .046,
      "cutoff.0": 670, "cutoff.1": 2230, resonance: .62, analogMix: .48, pulseMix: .76, sawBlend: .43,
      fold: .24, crush: .12, "vibrato.0": 0, "motion.0": 7.2, "motion.1": .28,
    }),
    patch("r2-lead-sweep", "Resonant Sweep", "An edgy lead with a strong moving formant and a longer release.", {
      "waveforms.0": "triangle", "waveforms.1": "sawtooth", "ratios.1": 2, "indices.1": 3.3,
      "indices.2": .87, "modDecay.1": .29, modSustain: .56, "amp.0": .048, "amp.2": .62, "amp.3": .42,
      "cutoff.0": 620, "cutoff.1": 4300, formant: .59, formantFrequency: 2500, drive: 1.64,
      analogMix: .045, sawBlend: .04, resonance: .72, "motion.0": 3.1, "motion.1": .85,
    }),
  ],
  counter_synth: [
    patch("r2-arp-stereo-mallet", "Double Mallets", "Soft high and low mallets with space between the steps and a small octave bloom.", {
      "waveforms.0": "sine", "waveforms.2": "triangle", "ratios.0": .5, "ratios.2": 1.5, "ratios.1": 4.1,
      "indices.1": .92, "indices.3": .12, "amp.0": .057, "amp.1": .14, "amp.2": .39, "amp.3": .33,
      "cutoff.0": 590, "cutoff.1": 2320, analogMix: .16, analogDetune: 51, unison: .43, formant: 0,
    }),
  ],
  bass: [
    patch("r2-bass-plucked", "Plucked Sub Bass", "Fast, dry attacks with a heavy octave and quick filter closure.", {
      acidWaveform: "triangle", analogMix: 1.1, pulseMix: .28, cleanSub: .39, octaveBody: .82,
      "amp.0": .002, "amp.1": .029, "amp.2": .24, "amp.3": .031, "cutoff.0": 260, "cutoff.1": 2370,
      resonance: .32, drive: 2.24, volumeLfoDepth: .05, bassSweep: 0, bassSweepDepth: 140,
    }),
    patch("r2-bass-slow-pulse", "Slow-Arc Acid", "Deep, slowly gated notes with a wide sweep into the low mids.", {
      acidWaveform: "square", analogMix: .62, pulseMix: .21, cleanSub: .87, octaveBody: .59,
      "amp.0": .069, "amp.1": .33, "amp.2": .9, "amp.3": .122, "cutoff.0": 76, "cutoff.1": 1960,
      resonance: .88, drive: 2.69, volumeLfoRate: .25, volumeLfoDepth: .87, bassSweep: 1.06, bassSweepDepth: 1920,
    }),
  ],
  guitar: [
    patch("r2-guitar-resonator", "Resonator Strings", "Metal-bodied plucks with a long, bright resonating string.", {
      "waveforms.0": "sine", "waveforms.1": "sawtooth", "ratios.1": 1.914, "ratios.2": 4.79, "ratios.3": 5.77,
      "indices.1": 4.75, "indices.2": 2.43, "indices.3": 1.37, "modDecay.1": .165, "modDecay.2": .215,
      "amp.0": .003, "amp.1": .17, "amp.2": .48, "amp.3": .91,
      "cutoff.0": 1700, "cutoff.1": 11100, comb: .81, combFeedback: .91, resonance: .54,
      analogMix: .018, transient: .56, drive: 1.13, formant: .63, formantFrequency: 3900,
    }),
    patch("r2-guitar-hollowbody", "Hollowbody Jazz", "Rounded finger attack with an electric guitar's low-mid body.", {
      "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 1, "indices.1": .49, "indices.2": .22,
      "amp.0": .027, "amp.1": .39, "amp.2": .52, "amp.3": .24, "cutoff.0": 540, "cutoff.1": 1860,
      comb: .42, combFeedback: .48, formant: .27, formantFrequency: 690,
      analogMix: .095, transient: .065, drive: 1.38, fold: .014, "vibrato.0": .19, "vibrato.1": 3.9,
    }),
    patch("r2-guitar-harmonics", "Pinch Harmonics", "Thin, high ringing string harmonics with a strong pick edge.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.0": 2, "ratios.1": 4, "ratios.2": 6,
      "indices.1": .79, "indices.2": .77, "indices.3": .32, "amp.0": .003, "amp.1": .22, "amp.2": .12,
      "amp.3": .34, "cutoff.0": 1940, "cutoff.1": 9300, comb: .52, combFeedback: .61, analogMix: .035,
      unison: .42, transient: .27, drive: 1.13, formant: .02, fold: .005,
    }),
  ],
  pad: [
    patch("r2-pad-granular-breath", "Breathing Glass Pad", "An airy sustain with slow inharmonic movement around a clear chord.", {
      "waveforms.0": "sine", "waveforms.2": "triangle", "ratios.1": 3.17, "ratios.2": 2, "ratios.3": 7.93,
      "indices.1": 2.85, "indices.3": 1.89, "modDecay.1": .88, "modDecay.3": .37, modSustain: .64,
      "amp.0": .79, "amp.2": .92, "amp.3": 1.34, "cutoff.0": 1900, "cutoff.1": 8620,
      analogMix: .035, sawBlend: .02, "motion.0": .48, "motion.1": .61, comb: .52, combFeedback: .65, level: .112,
    }),
  ],
  organ: [
    patch("r2-organ-keyclick", "Keyclick Drawbar", "The short key strike stands out over a steady octave-and-fifth organ sound.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "waveforms.2": "triangle", "ratios.2": 3,
      "indices.1": 1.08, "modDecay.1": .028, "indices.3": .19, modSustain: .085, transient: .58,
      "amp.0": .002, "amp.1": .083, "amp.2": .82, "amp.3": .074, "cutoff.1": 7800, analogMix: .035, drive: 1.48,
    }),
    patch("r2-organ-chapel", "Chapel Octaves", "Pure higher registers rise slowly above the held organ tones.", {
      "waveforms.0": "sine", "waveforms.2": "sine", "ratios.0": 1, "ratios.2": 4, "ratios.3": 6,
      "indices.1": .06, "indices.3": .18, "amp.0": .208, "amp.1": .25, "amp.2": .97,
      "amp.3": .44, "cutoff.0": 1950, "cutoff.1": 6810, drive: .98, analogMix: 0, "vibrato.0": .008,
    }),
    patch("r2-organ-rotary", "Gospel Tremulant", "A held, bright organ tone with strong cyclic movement in the harmonics.", {
      "waveforms.0": "triangle", "waveforms.2": "sawtooth", "ratios.1": 1.498, "ratios.2": 5,
      "indices.1": 1.25, "indices.3": .84, modSustain: .74, "amp.0": .052, "amp.2": .9, "amp.3": .18,
      "cutoff.0": 1790, "cutoff.1": 8620, "motion.0": 5.4, "motion.1": .9, "vibrato.0": .47,
      "vibrato.1": 5.44, analogMix: .14, analogDetune: 27, unison: .2, drive: 1.71,
    }),
    patch("r2-organ-grit", "Driven Theatre Organ", "A low drawbar foundation with a gritty midrange and confident sustain.", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.0": .5, "ratios.2": 1,
      "indices.1": .25, "indices.3": .36, modSustain: .4, "amp.0": .013, "amp.2": .93, "amp.3": .19,
      "cutoff.0": 610, "cutoff.1": 2370, resonance: .43, drive: 3.1, fold: .28, analogMix: .3, transient: .16, level: .083,
    }),
  ],
  keys_mallet: [
    patch("r2-keys-piano", "FM Hammer Keys", "A hammer-like attack with a bright initial strike and a quickly darkening body.", {
      "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 1, "ratios.2": 4, "indices.1": 2.15,
      "indices.2": .91, "indices.3": .18, "modDecay.1": .092, "modDecay.2": .061, modSustain: .15,
      "amp.0": .004, "amp.1": .25, "amp.2": .25, "amp.3": .34, "cutoff.0": 1870, "cutoff.1": 8050,
      transient: .69, analogMix: 0, comb: 0, fold: .015, "vibrato.0": 0,
    }),
    patch("r2-keys-tubular", "Tubular Mallet", "A tuned metal tube with a rounded strike and ringing partials.", {
      "waveforms.0": "triangle", "ratios.0": 1, "ratios.1": 1.41, "ratios.2": 3.17, "ratios.3": 9.49,
      "indices.1": 3.35, "indices.2": 2.45, "indices.3": .48,
      "modDecay.1": .47, "modDecay.2": .33, "amp.0": .038, "amp.1": .48, "amp.2": .21, "amp.3": 1.05,
      "cutoff.0": 1100, "cutoff.1": 7400, comb: .58, combFeedback: .59, analogMix: 0, transient: .07,
    }),
  ],
  percussion_texture: [
    patch("r2-perc-heavy", "Low Drum Dust", "Damped skin strikes with a strong low resonance.", {
      "amp.0": .029, "amp.1": .064, "amp.2": .38, "amp.3": .06, "cutoff.0": 65, "cutoff.1": 245,
      resonance: .83, drive: 3.2, level: .33,
    }),
    patch("r2-perc-pinhole", "Pinpoint Ticks", "Very short sharp taps with quick gaps between them.", {
      "amp.0": .001, "amp.1": .008, "amp.2": .04, "amp.3": .026, "cutoff.0": 7600, "cutoff.1": 15600,
      resonance: .39, drive: 1.48, level: .34,
    }),
    patch("r2-perc-pocket", "Soft Scrape", "A softer scrape with a slow onset and little initial click.", {
      "amp.0": .071, "amp.1": .124, "amp.2": .61, "amp.3": .09,
      "cutoff.0": 415, "cutoff.1": 2840, resonance: .17, drive: 1.35, level: .35,
    }),
  ],
};

const drums = {
  36: [
    patch("r2-kick-damped", "Damped Skin Kick", "A low, tightly damped kick with a soft broadband beater.", {
      fundamental: 35, sweep: 91, sweepRate: 121, decay: 62, click: .73, "cutoff.1": 1570, resonance: .075, level: .98,
    }),
    patch("r2-kick-taut", "Taut Club Kick", "A higher punch and a darker, medium-length body.", {
      fundamental: 65, sweep: 91, sweepRate: 91, decay: 25, click: .44,
      "cutoff.1": 980, resonance: .21, drive: 1.35, level: .8,
    }),
  ],
  38: [
    patch("r2-snare-rattle", "Rattle Tail", "Long, mostly unpitched wire noise from a bright snare.", {
      fundamental: 158, body: .12, noise: 1.14, decay: 7.9, "cutoff.1": 10700, resonance: .065, level: .18,
    }),
    patch("r2-snare-tight", "Piccolo Wire", "An especially short, high drumhead and a bright little snap.", {
      waveform: "triangle", fundamental: 309, body: .63, noise: .67, decay: 61, "cutoff.1": 15000, resonance: .45, level: .22,
    }),
    patch("r2-snare-torn", "Torn Drumhead", "A darker snare with a low resonant head and rough wire snap.", {
      waveform: "square", fundamental: 98, body: .86, noise: .82, decay: 19.5,
      "cutoff.1": 1900, resonance: .68, drive: 2.6, level: .24,
    }),
  ],
  39: [
    patch("r2-clap-flam", "Slow Flam Clap", "A clearly spaced series of hand strikes with a longer final wash.", {
      decay: 10.1, spacing: 2.49, "cutoff.1": 7890, resonance: .1, level: .095,
    }),
    patch("r2-clap-short", "Staggered Bright Clap", "Short, bright palm attacks with a clear gap between them.", {
      decay: 121, spacing: 2.23, "cutoff.1": 16000, resonance: .06, drive: .88, level: .13,
    }),
    patch("r2-clap-palm", "Cupped Palms", "Low-mid weighted claps, with space between the successive strikes.", {
      decay: 56, spacing: 1.75, "cutoff.1": 1680, resonance: .71, drive: 3.16, level: .15,
    }),
  ],
  42: [
    patch("r2-closed-mini", "Miniature Brass Hat", "A short, high-density metallic step with little surrounding noise.", {
      decay: 89, metalPitch: .53, metal: .52, noise: .035, "cutoff.1": 6600, resonance: .43, level: .095,
    }),
    patch("r2-closed-velvet", "Velvet Pedal", "A darker closed hat with an audible but tightly limited noise tail.", {
      decay: 28, metalPitch: 1.68, metal: .06, noise: .74, "cutoff.1": 4400, resonance: .67, level: .15,
    }),
  ],
  46: [
    patch("r2-open-sizzle", "Long Sizzle", "A long, somewhat rough open-hat layer with a strong high-mid wash.", {
      decay: 3.1, metalPitch: .94, metal: .12, noise: .77, "cutoff.1": 11200, resonance: .53, drive: 3.22, level: .1,
    }),
    patch("r2-open-choke", "Choked Bright Hat", "A bright open strike that closes quickly enough for busy passages.", {
      decay: 24.5, metalPitch: 1.82, metal: .42, noise: .16, "cutoff.1": 15800, resonance: .31, level: .09,
    }),
  ],
  43: [
    patch("r2-low-tom-floor", "Damped Floor Tom", "A floor-tom thud with a low tuning, a defined stick, and little ring.", {
      waveform: "square", fundamental: 49, sweep: 22, decay: 42.5, noise: .31,
      "cutoff.1": 1550, resonance: .46, drive: 2.25, level: .37,
    }),
  ],
  47: [
    patch("r2-mid-tom-rim", "Rack Tom Rim", "A bright rack-tom attack followed by a short but clear drumhead.", {
      waveform: "square", fundamental: 118, sweep: 12, decay: 55, noise: .59,
      "cutoff.1": 8740, resonance: .30, drive: 1.8, level: .37,
    }),
  ],
  50: [
    patch("r2-high-tom-wood", "Studio Rim High Tom", "A pronounced stick strike with an even, longer high head tone.", {
      waveform: "triangle", fundamental: 154, sweep: 0, decay: 13, noise: .51,
      "cutoff.1": 4600, resonance: .72, drive: 2.45, level: .32,
    }),
    patch("r2-high-tom-pop", "Crisp High Tom", "A very high, short tom pop with minimal shell resonance.", {
      waveform: "square", fundamental: 192, sweep: 15, decay: 59.5, noise: .45,
      "cutoff.1": 9950, resonance: .27, drive: 2.58, level: .31,
    }),
  ],
};

export const roundTwoPresets = [
  ...Object.entries(instruments).flatMap(([role, presets]) => presets.map(preset => ({ ...preset, role }))),
  ...Object.entries(drums).flatMap(([note, presets]) => presets.map(preset => ({
    ...preset, role: "drums", note: Number(note),
  }))),
];
