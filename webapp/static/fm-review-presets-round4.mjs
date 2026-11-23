export const retainedFromRoundThree = "r3-perc-paper";

const patch = (id, name, description, values) => ({ id: `r4-${id}`, name, description, values });

const instruments = {
  lead_synth: [
    patch("lead-pwm", "Pulse Wire", "A lean, square-edged lead with a moving pulse width and a short release.", {
      algorithm: "carriers", "waveforms.0": "square", "waveforms.1": "triangle", "waveforms.2": "sine",
      "ratios.1": 1.004, "ratios.2": 2, "indices.3": .12, analogMix: .98, pulseMix: .94, sawBlend: .81, pulseWidthMotion: .28,
      "motion.0": 3.6, "motion.1": .86, "amp.0": .002, "amp.1": .075, "amp.2": .76, "amp.3": .053,
      "cutoff.0": 1820, "cutoff.1": 5790, resonance: .67, fold: .025, drive: 1.49,
    }),
    patch("lead-ring", "Ring Alloy", "Metallic sidebands around a clear lead, with a pitched center that stays audible through glides.", {
      algorithm: "parallel", "waveforms.0": "triangle", "waveforms.2": "sine", "ratios.1": 2.5,
      "ratios.2": 2.0, "ratios.3": 4.17, "indices.1": 1.78, "indices.3": 1.3, modSustain: .48,
      ringMix: .7, ringRatio: 1.48, "amp.0": .011, "amp.2": .84, "amp.3": .096, "cutoff.0": 3400,
      "cutoff.1": 9400, analogMix: 0, sawBlend: 0, unison: 0, fold: .04, drive: 1.22,
    }),
    patch("lead-vowel", "Talkbox Laser", "A pointed vowel sweep that bends and then holds a bright, vocal edge.", {
      algorithm: "feedback", "waveforms.0": "sawtooth", "waveforms.1": "triangle", "ratios.1": 1,
      "ratios.2": 2, "ratios.3": 4.31, "indices.1": 2.4, "indices.2": 3.4, "indices.3": .82,
      feedback: .82, modSustain: .44, formant: .74, formantFrequency: 1820, "motion.0": 4.7, "motion.1": .95,
      "cutoff.0": 740, "cutoff.1": 3190, resonance: .53, "amp.0": .012, "amp.2": .73, "amp.3": .083,
      analogMix: .07, sawBlend: 0, fold: .19, drive: 1.86,
    }),
    patch("lead-digital", "Arcade Clipper", "A sharp, stair-stepped mono lead with clipped harmonics and a blunt cutoff.", {
      algorithm: "branch", "waveforms.0": "square", "waveforms.1": "square", "waveforms.2": "triangle",
      "ratios.1": .5, "ratios.2": 1, "ratios.3": 7, "indices.1": .91, "indices.2": .73, "indices.3": .31,
      crush: .59, fold: .41, drive: 2.42, analogMix: 0, sawBlend: 0, unison: 0, "vibrato.0": 0,
      "amp.0": .002, "amp.1": .035, "amp.2": .91, "amp.3": .028, "cutoff.0": 4700, "cutoff.1": 11000,
    }),
    patch("lead-gate", "Broken Beam", "A long synth note turns into short, beat-locked bursts with a wide detuned edge.", {
      algorithm: "parallel", "waveforms.0": "triangle", "ratios.1": 1, "ratios.2": 1.006,
      "indices.1": .47, "indices.3": .78, analogMix: 1.20, analogDetune: 55, sawBlend: .9, unison: .56,
      gateDepth: .92, gateRate: 4, "amp.0": .019, "amp.1": .30, "amp.2": .85, "amp.3": .155,
      "cutoff.0": 1390, "cutoff.1": 8300, "vibrato.0": .04, fold: .06, drive: 1.2,
    }),
  ],
  bass: [
    patch("bass-sub", "Sub Relay", "A nearly clean low sine that opens and closes abruptly in sync with the beat.", {
      acidWaveform: "sine", cleanSub: 1.23, analogMix: .64, pulseMix: 0, octaveBody: .025,
      "amp.0": .004, "amp.1": .12, "amp.2": .87, "amp.3": .045, "cutoff.0": 91, "cutoff.1": 178,
      resonance: .15, drive: .85, bassSweep: 0, bassSweepDepth: 0, volumeLfoDepth: .10,
      gateDepth: .86, gateRate: 2,
    }),
    patch("bass-squelch", "Rubber Circuit", "A resonant square bass with a quick filter sweep and ring-modulated bite above the low register.", {
      acidWaveform: "square", cleanSub: .88, analogMix: 1.02, pulseMix: .74, octaveBody: .27,
      "amp.0": .006, "amp.1": .172, "amp.2": .48, "amp.3": .043, "cutoff.0": 95, "cutoff.1": 1320,
      resonance: .88, drive: 1.87, bassSweep: 4.1, bassSweepDepth: 1650, volumeLfoDepth: .06,
      ringMix: .37, ringRatio: 3.11,
    }),
  ],
  guitar: [
    patch("guitar-fuzz", "Fuzz DI", "A tight electric pick that opens into clipped, buzzy power-chord harmonics.", {
      algorithm: "carriers", "waveforms.0": "triangle", "waveforms.1": "square", "waveforms.2": "sawtooth",
      "ratios.1": 1, "ratios.2": 2, "ratios.3": 2.98, "indices.3": 1.1, analogMix: .24, comb: .31,
      "amp.0": .002, "amp.1": .24, "amp.2": .31, "amp.3": .13, "cutoff.0": 1650, "cutoff.1": 5660,
      formant: .57, formantFrequency: 1050, transient: .41, fold: .37, drive: 3.2,
    }),
    patch("guitar-wah", "Pixel Wah", "Short picked notes move through a pronounced electronic wah with a crunchy string tail.", {
      algorithm: "feedback", "waveforms.0": "triangle", "waveforms.1": "sine", "ratios.1": 3, "ratios.2": 4.01,
      "indices.1": 3.38, "indices.2": 2.25, "indices.3": .92, feedback: .62, modSustain: .31,
      "motion.0": 8.55, "motion.1": .93, "amp.0": .004, "amp.1": .139, "amp.2": .19, "amp.3": .175,
      resonance: .77, "cutoff.0": 480, "cutoff.1": 6050, formant: .62, formantFrequency: 2260,
      comb: .62, combFeedback: .68, crush: .38, drive: 2.04,
    }),
  ],
  pad: [
    patch("pad-grid", "Grid Shutter", "Wide held chords become a rhythmic wall of bright, almost fully gated pulses.", {
      algorithm: "carriers", "waveforms.0": "sawtooth", "waveforms.1": "triangle", "waveforms.2": "sawtooth",
      "ratios.1": .997, "ratios.2": 1.008, "indices.3": .8, analogMix: 1.28, analogDetune: 62,
      sawBlend: .91, unison: .57, gateDepth: .94, gateRate: 2, "amp.0": .13, "amp.2": .90, "amp.3": .68,
      "cutoff.0": 2310, "cutoff.1": 9630, fold: .05, drive: 1.39,
    }),
    patch("pad-orbit", "Orbital Choir", "A slow choral swell with moving ring-modulated color and a long, airy release.", {
      algorithm: "feedback", "waveforms.0": "sine", "waveforms.1": "triangle", "ratios.1": 1.501,
      "ratios.2": 2.011, "ratios.3": 5.07, "indices.1": 2.13, "indices.2": 2.3, "indices.3": .91,
      feedback: .65, modAttack: .47, modSustain: .58, ringMix: .71, ringRatio: .75,
      "amp.0": .85, "amp.1": .8, "amp.2": .91, "amp.3": 1.53, analogMix: .06, sawBlend: .05,
      formant: .73, formantFrequency: 1200, "cutoff.0": 1120, "cutoff.1": 5200,
      "motion.0": .73, "motion.1": .71, "vibrato.0": .12, comb: .31, drive: 1.26,
    }),
  ],
  organ: [
    patch("organ-chip", "Chip Drawbars", "A bright, sharply stepped electronic organ with audible octave registrations.", {
      algorithm: "carriers", "waveforms.0": "square", "waveforms.1": "square", "waveforms.2": "triangle",
      "ratios.1": 4, "ratios.2": 8, "indices.3": .06, "amp.0": .003, "amp.2": .95, "amp.3": .037,
      "cutoff.0": 6800, "cutoff.1": 12800, crush: .595, transient: .045, drive: 1.9,
    }),
    patch("organ-rotor", "Rotary Overload", "A saturated organ chord with an audible rotary shimmer and a heavy lower registration.", {
      algorithm: "feedback", "waveforms.0": "triangle", "waveforms.1": "sawtooth", "ratios.1": .5,
      "ratios.2": 3, "ratios.3": 4, "indices.1": 1.21, "indices.2": .78, "indices.3": .43, feedback: .82,
      "vibrato.0": .59, "vibrato.1": 6.2, "motion.0": 6.1, "motion.1": .93, "amp.2": .9,
      ringMix: .24, ringRatio: .46,
      "cutoff.0": 1020, "cutoff.1": 5800, analogMix: .21, formant: .38, formantFrequency: 850, fold: .24, drive: 2.58,
    }),
    patch("organ-repeat", "Repeat Stop", "A thin reed-organ chord with rapid pulses that stay locked to the bar.", {
      "waveforms.0": "triangle", "waveforms.1": "square", "waveforms.2": "sine", "ratios.1": 3,
      "ratios.2": 4, "ratios.3": 2, "indices.1": .87, "indices.3": 1.67, gateDepth: .93, gateRate: 3,
      ringMix: .26, ringRatio: 2, "amp.0": .006, "amp.2": .94, "amp.3": .083,
      "cutoff.0": 1580, "cutoff.1": 8300, resonance: .59, drive: 1.22,
    }),
  ],
  keys_mallet: [
    patch("keys-bit", "Bit Mallet", "An electronic mallet with a short, grainy impact and a hard cutoff.", {
      algorithm: "branch", "waveforms.0": "square", "waveforms.1": "sine", "ratios.1": 3.981,
      "ratios.2": 8.37, "ratios.3": 5.43, "indices.1": 3.3, "indices.2": 3.5, "indices.3": 2.4,
      "modDecay.1": .022, modSustain: .055, crush: .6, fold: .43, analogMix: 0,
      "amp.0": .002, "amp.1": .088, "amp.2": .11, "amp.3": .096, "cutoff.0": 2380, "cutoff.1": 11200,
      transient: .37, drive: 1.71,
    }),
    patch("keys-orbit", "Ring Tines", "An electric-piano strike with a long, inharmonic ring that remains distinct in chords.", {
      algorithm: "parallel", "waveforms.0": "sine", "waveforms.2": "sine", "ratios.1": 5.41,
      "ratios.2": 1.009, "ratios.3": 9.19, "indices.1": 2.39, "indices.3": 1.24, "modDecay.1": .069,
      modSustain: .19, ringMix: .69, ringRatio: 1.57, "amp.0": .012, "amp.1": .62, "amp.2": .48,
      "amp.3": .41, "cutoff.0": 3070, "cutoff.1": 9350, transient: .29, comb: .12, drive: 1.19,
    }),
    patch("keys-swell", "Reverse Keys", "A soft attack rises into a clipped electric key tone, then drops away quickly.", {
      algorithm: "carriers", "waveforms.0": "triangle", "waveforms.1": "sine", "waveforms.2": "sawtooth",
      "ratios.1": 1, "ratios.2": 1.998, "indices.3": .36, "amp.0": .22, "amp.1": .027,
      "amp.2": .73, "amp.3": .029, "cutoff.0": 800, "cutoff.1": 5800, analogMix: .61, pulseMix: .81,
      formant: .38, formantFrequency: 910, transient: .02, fold: .13, drive: 1.49,
    }),
  ],
  percussion_texture: [
    patch("perc-spray", "Digital Spray", "Unpitched noise reduced to short, coarse digital bursts.", {
      circuit: "steps", circuitMix: .92, circuitRate: 1850,
      "amp.0": .001, "amp.1": .058, "amp.2": .41, "amp.3": .079,
      "cutoff.0": 3340, "cutoff.1": 8900, resonance: .15, drive: 2.85, level: .36,
    }),
    patch("perc-rattle", "Shutter Rattle", "Noise and low hits break into a tight run of electronic rattles.", {
      circuit: "gate", circuitMix: .96, circuitRate: 41,
      "amp.0": .004, "amp.1": .095, "amp.2": .62, "amp.3": .084,
      "cutoff.0": 1130, "cutoff.1": 6170, resonance: .19, drive: 2.63, level: .34,
    }),
    patch("perc-thin-air", "Vacuum Hit", "A quiet start swells into a short suction-like percussion accent.", {
      circuit: "bloom", circuitMix: 1, circuitRate: 14,
      "amp.0": .016, "amp.1": .093, "amp.2": .73, "amp.3": .131,
      "cutoff.0": 3180, "cutoff.1": 12000, resonance: .21, drive: 3.25, level: .53,
    }),
  ],
};

const drums = {
  36: [
    patch("kick-pressure", "Sub Pressure Kick", "A deep, long electronic kick with almost no top end and a heavy low tail.", {
      waveform: "sine", fundamental: 36, sweep: 89, sweepRate: 114, decay: 9.6,
      click: .13, "cutoff.1": 600, resonance: .01, drive: .93, level: .96,
    }),
    patch("kick-driver", "Overdriven Driver", "A dense, clipped low kick with a quick sweep and very little beater click.", {
      waveform: "sine", fundamental: 46, sweep: 198, sweepRate: 121, decay: 27,
      click: .28, "cutoff.1": 970, resonance: .025, drive: 2.57, level: 1.04, circuit: "clip", circuitMix: .95,
    }),
  ],
  38: [
    patch("snare-data", "8-Bit Backbeat", "A pixelated snare with audible sample-and-hold crunch and a tight backbeat.", {
      waveform: "triangle", fundamental: 199, decay: 23, body: .31, noise: .95, "cutoff.1": 8200,
      resonance: .16, drive: 2.78, level: .31, circuit: "steps", circuitRate: 1500, circuitMix: 1,
    }),
    patch("snare-gated", "Gate Break Snare", "A wide noise crack chopped into a burst with a hard electronic cutoff.", {
      waveform: "sine", fundamental: 166, decay: 13, body: .36, noise: 1.12, "cutoff.1": 9320,
      resonance: .31, drive: 1.76, level: .33, circuit: "gate", circuitRate: 17, circuitMix: .97,
    }),
    patch("snare-ring", "Alloy Backbeat", "A short wired snare with strong, non-tonal sidebands around the head strike.", {
      waveform: "triangle", fundamental: 172, decay: 31, body: .76, noise: .65, "cutoff.1": 6100,
      resonance: .25, drive: 2.22, level: .32, circuit: "ring", circuitRate: 437, circuitMix: .90,
    }),
  ],
  39: [
    patch("clap-byte", "Cache Clap", "Three jagged digital bursts with a narrow, crunchy tail.", {
      decay: 69, spacing: 1.73, "cutoff.1": 7400, resonance: .18, drive: 2.78, level: .29,
      circuit: "steps", circuitRate: 1380, circuitMix: .98,
    }),
    patch("clap-reverse", "Reverse Stack Clap", "A soft lead-in swells into a bright stack of handclap bursts.", {
      decay: 29, spacing: 2.4, "cutoff.1": 11600, resonance: .57, drive: 2.03, level: .28,
      circuit: "bloom", circuitRate: 11, circuitMix: 1,
    }),
    patch("clap-room", "Stutter Clap", "A broad electronic clap divided into hard rhythmic bursts inside each hit.", {
      decay: 18, spacing: .61, "cutoff.1": 3040, resonance: .82, drive: 2.68, level: .23,
      circuit: "gate", circuitRate: 39, circuitMix: .97,
    }),
  ],
  42: [
    patch("closed-volt", "Voltage Tick", "A thin closed hat with a sharp ring-modulated circuit tick.", {
      decay: 60, metalPitch: 1.71, metal: .42, noise: .43, "cutoff.1": 13800,
      resonance: .22, drive: 1.96, level: .19, circuit: "ring", circuitRate: 2780, circuitMix: .94,
    }),
    patch("closed-bit", "Bit Shutter Hat", "A dry closed hat with stepped transients and a brief digital rattle.", {
      decay: 34, metalPitch: .65, metal: .17, noise: .77, "cutoff.1": 9600,
      resonance: .37, drive: 2.67, level: .23, circuit: "steps", circuitRate: 5100, circuitMix: .96,
    }),
  ],
  46: [
    patch("open-gate", "Shutter Wash", "An open hat with a flickering, gated wash and a defined first strike.", {
      decay: 5.7, metalPitch: 1.54, metal: .24, noise: .73, "cutoff.1": 13700,
      resonance: .29, drive: 1.57, level: .143, circuit: "gate", circuitRate: 29, circuitMix: .98,
    }),
    patch("open-reverse", "Reverse Chrome", "A thin start swells into a bright electronic cymbal with a long tail.", {
      decay: 4.1, metalPitch: 1.86, metal: .22, noise: .71, "cutoff.1": 14900,
      resonance: .65, drive: 2.32, level: .18, circuit: "bloom", circuitRate: 5.5, circuitMix: 1,
    }),
  ],
  43: [
    patch("low-tom-zap", "Modular Drop Tom", "A low tom with a fast electronic pitch dive and a short, distorted body.", {
      waveform: "triangle", fundamental: 56, sweep: 137, decay: 19, noise: .15, "cutoff.1": 2230,
      resonance: .31, drive: 2.46, level: .44, circuit: "clip", circuitMix: .84,
    }),
    patch("low-tom-split", "Split Head Tom", "A struck low tom with an off-center ring-modulated tail.", {
      waveform: "sine", fundamental: 87, sweep: 50, decay: 15, noise: .37, "cutoff.1": 3560,
      resonance: .14, drive: 1.61, level: .44, circuit: "ring", circuitRate: 109, circuitMix: .68,
    }),
  ],
};

export const roundFourPresets = [
  ...Object.entries(instruments).flatMap(([role, presets]) => presets.map(preset => ({ ...preset, role }))),
  ...Object.entries(drums).flatMap(([note, presets]) => presets.map(preset => ({ ...preset, role: "drums", note: Number(note) }))),
];
