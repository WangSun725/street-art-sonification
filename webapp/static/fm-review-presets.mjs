const patch = (id, name, description, values) => ({ id, name, description, values });

export const playedPresets = {
  lead_synth: [
    patch("lead-silk", "Silk Mono", "Rounded solo tone with light vibrato and a short glide.", {
      "waveforms.0": "triangle", "ratios.1": 2, "indices.1": .33, "indices.2": .12,
      "amp.0": .018, "amp.2": .82, "amp.3": .15, "cutoff.1": 3100,
      analogMix: .08, sawBlend: .07, unison: .027, "vibrato.0": .15, "vibrato.1": 5.4, fold: 0,
    }),
    patch("lead-sync-brass", "Sync Brass", "Bright saw brass with a firm attack that rounds off.", {
      "waveforms.0": "sawtooth", "waveforms.1": "square", "ratios.1": 1,
      "indices.1": 2.05, "indices.2": .43, "modDecay.1": .079, modSustain: .12,
      "amp.0": .006, "amp.1": .16, "amp.2": .54, "amp.3": .09,
      "cutoff.0": 950, "cutoff.1": 5700, analogMix: .55, sawBlend: .42,
      resonance: .47, drive: 1.85, "vibrato.0": 0,
    }),
    patch("lead-velcro-pulse", "Velcro Pulse", "Narrow pulse with a focused, sharply defined edge.", {
      "waveforms.0": "square", "waveforms.1": "sine", "ratios.1": 2,
      "indices.1": .18, "indices.2": .08, "amp.0": .003, "amp.2": .84, "amp.3": .064,
      "cutoff.0": 2300, "cutoff.1": 6700, analogMix: .20, pulseMix: .86, sawBlend: .24,
      unison: 0, "vibrato.0": .025, fold: .04, crush: .06,
    }),
    patch("lead-halo", "Wide Halo", "Wide stereo lead with a bright sustained harmonic layer.", {
      "waveforms.0": "sawtooth", "ratios.1": 3, "indices.1": .48,
      "amp.0": .028, "amp.2": .9, "amp.3": .31, "cutoff.1": 8100,
      analogMix: 1.05, sawBlend: .87, analogDetune: 57, unison: .31,
      "motion.0": .7, "motion.1": .24, "vibrato.0": .065, drive: 1.38,
    }),
    patch("lead-nasal-reed", "Nasal Reed", "Electronic reed with a pronounced nasal resonance.", {
      "waveforms.0": "triangle", "waveforms.1": "square", "ratios.1": 1,
      "indices.1": .9, "indices.2": .65, modSustain: .42,
      "amp.0": .037, "amp.2": .7, "amp.3": .13, "cutoff.1": 4400,
      formant: .52, formantFrequency: 1250, analogMix: .04, sawBlend: .03,
      "vibrato.0": .24, "vibrato.1": 6.3, resonance: .37,
    }),
  ],
  counter_synth: [
    patch("arp-glass", "Glass Pins", "Bright glass-like notes with short tails.", {
      "ratios.1": 3.02, "ratios.3": 5.31, "indices.1": 2.75, "indices.3": 1.45,
      "amp.0": .003, "amp.1": .077, "amp.2": .075, "amp.3": .12,
      "modDecay.1": .076, analogMix: 0, "cutoff.1": 11200, formant: .015,
    }),
    patch("arp-pocket", "Pocket Pulse", "Short square-wave notes with a retro step-sequencer character.", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.2": 2,
      "indices.1": .055, "indices.3": .09, "amp.0": .002, "amp.1": .09,
      "amp.2": .37, "amp.3": .046, analogMix: 0, "cutoff.1": 5600, formant: 0, unison: 0,
    }),
    patch("arp-wood", "Muted Pluck", "Dark pluck with clear gaps between notes.", {
      "waveforms.0": "triangle", "waveforms.2": "triangle", "indices.1": .62, "indices.3": .22,
      "amp.0": .004, "amp.1": .052, "amp.2": .045, "amp.3": .07,
      analogMix: .04, "cutoff.0": 560, "cutoff.1": 2600, comb: .45, combFeedback: .57,
      drive: 1.34, transient: .32,
    }),
    patch("arp-ember", "Ember Saw", "Saw arpeggio with an audible filter sweep.", {
      "waveforms.0": "sawtooth", "waveforms.2": "triangle", "indices.1": 1.5, "indices.3": .64,
      "amp.0": .006, "amp.1": .12, "amp.2": .29, "amp.3": .15,
      analogMix: .88, pulseMix: .14, analogDetune: 17, "cutoff.0": 800, "cutoff.1": 5400,
      resonance: .60, "motion.0": 5.3, "motion.1": .64, drive: 1.67,
    }),
    patch("arp-moon", "Octave Droplets", "Octave layer that rings out behind each note.", {
      "waveforms.2": "sine", "ratios.2": 2, "ratios.1": 1, "ratios.3": 6,
      "indices.1": .22, "indices.3": 1.2, "amp.0": .013, "amp.1": .16,
      "amp.2": .19, "amp.3": .25, analogMix: .02, "cutoff.1": 7200, unison: .06,
    }),
  ],
  bass: [
    patch("bass-deep", "Round Sub", "Round sine bass with a steady low foundation.", {
      acidWaveform: "sine", analogMix: .6, pulseMix: 0, cleanSub: 1.1, octaveBody: .08,
      "cutoff.0": 98, "cutoff.1": 490, resonance: .16, drive: 1.1,
      bassSweepDepth: 60, volumeLfoRate: 1, volumeLfoDepth: .19, "amp.2": .93, "amp.3": .055,
    }),
    patch("bass-needle", "Needle Acid", "Bright acid bass with a pronounced resonant sweep.", {
      acidWaveform: "sawtooth", analogMix: .95, pulseMix: .08, cleanSub: .42, octaveBody: .32,
      "cutoff.0": 200, "cutoff.1": 1740, resonance: .85, drive: 2.19,
      bassSweep: 1.9, bassSweepDepth: 1180, volumeLfoDepth: .37, "amp.1": .11,
    }),
    patch("bass-hollow", "Hollow Pulse", "Hollow square-wave bass over a weighty sub.", {
      acidWaveform: "square", analogMix: 1.03, pulseMix: .18, cleanSub: .73, octaveBody: .17,
      "cutoff.0": 140, "cutoff.1": 905, resonance: .63, drive: 1.58,
      bassSweep: .32, bassSweepDepth: 430, volumeLfoRate: 2, volumeLfoDepth: .51,
    }),
    patch("bass-rubber", "Rubber Wobble", "Triangular bass with a fast, elastic pulse.", {
      acidWaveform: "triangle", analogMix: .77, pulseMix: .1, cleanSub: .66, octaveBody: .34,
      "cutoff.0": 120, "cutoff.1": 1310, resonance: .65, drive: 2.05,
      bassSweep: 5.5, bassSweepDepth: 1460, volumeLfoRate: 4, volumeLfoDepth: .71,
    }),
    patch("bass-broken", "Octave Growl", "Rough octave layer over a strong low register.", {
      acidWaveform: "sawtooth", analogMix: 1.14, pulseMix: .57, cleanSub: .62, octaveBody: .67,
      "cutoff.0": 230, "cutoff.1": 1920, resonance: .42, drive: 2.7,
      bassSweepDepth: 570, volumeLfoRate: .5, volumeLfoDepth: .32, "amp.3": .058, level: .29,
    }),
  ],
  guitar: [
    patch("guitar-nylon", "Soft Nylon", "Warm nylon-style pluck with a resonant string tail.", {
      "waveforms.0": "triangle", "indices.1": .65, "indices.2": .5,
      "amp.0": .008, "amp.1": .2, "amp.2": .14, "amp.3": .32,
      "cutoff.0": 870, "cutoff.1": 3600, comb: .57, combFeedback: .64,
      analogMix: .036, transient: .14, fold: .015, drive: 1.02,
    }),
    patch("guitar-palm-muted", "Palm Mute", "Short, dark electric pluck suited to syncopation.", {
      "waveforms.0": "triangle", "indices.1": 1.35, "indices.2": .79,
      "amp.0": .002, "amp.1": .065, "amp.2": .04, "amp.3": .065,
      "cutoff.0": 600, "cutoff.1": 2250, comb: .25, combFeedback: .34,
      analogMix: .03, transient: .41, drive: 1.54,
    }),
    patch("guitar-steel", "Steel Pick", "Bright steel-string pluck with a ringing body.", {
      "waveforms.0": "triangle", "waveforms.1": "triangle", "ratios.1": 3, "indices.1": 1.75,
      "indices.2": .68, "modDecay.1": .21, "amp.0": .004, "amp.1": .28, "amp.2": .22,
      "amp.3": .61, "cutoff.0": 1950, "cutoff.1": 7600, comb: .72, combFeedback: .77,
      analogMix: .07, transient: .41, drive: 1.11,
    }),
    patch("guitar-bridge", "Clean Bridge", "Clean electric pluck with a bright bridge-like edge.", {
      "waveforms.0": "sawtooth", "waveforms.1": "triangle", "ratios.1": 1,
      "indices.1": .42, "indices.2": .51, "amp.0": .004, "amp.1": .23, "amp.2": .34, "amp.3": .21,
      "cutoff.1": 6300, comb: .47, combFeedback: .49, analogMix: .12, drive: 1.32, fold: .03,
      "vibrato.0": .115, "vibrato.1": 4.2,
    }),
    patch("guitar-fuzz", "Fuzz Electric", "Driven electric tone with a distinct pick attack.", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.1": 2,
      "indices.1": 1.19, "indices.2": 1.64, "amp.0": .003, "amp.1": .21, "amp.2": .56, "amp.3": .15,
      "cutoff.0": 1400, "cutoff.1": 4600, comb: .34, combFeedback: .5,
      analogMix: .22, fold: .44, drive: 3.19, transient: .33, level: .108,
    }),
  ],
  pad: [
    patch("pad-cloud", "Soft Cloud", "Soft sustained chords that fade in slowly.", {
      "waveforms.0": "sine", "waveforms.2": "triangle", "indices.1": .21, "indices.3": .12,
      "amp.0": .36, "amp.2": .87, "amp.3": .88, "cutoff.0": 690, "cutoff.1": 2450,
      analogMix: .11, sawBlend: .16, unison: .16, "motion.1": .15, fold: 0,
    }),
    patch("pad-airloom", "Wide Sawscape", "Broad stereo saw chords with brighter upper harmonics.", {
      "waveforms.0": "sawtooth", "waveforms.2": "triangle", "indices.1": .35, "indices.3": .53,
      "amp.0": .15, "amp.2": .8, "amp.3": .68, analogMix: 1.14,
      sawBlend: .87, analogDetune: 59, unison: .36, "cutoff.1": 8450, level: .13,
    }),
    patch("pad-choir", "Hollow Choir", "Vowel-like resonance over sustained harmony.", {
      "waveforms.0": "square", "waveforms.2": "sine", "ratios.1": 2,
      "indices.1": .28, "indices.3": .65, "amp.0": .43, "amp.3": .96,
      "cutoff.0": 930, "cutoff.1": 4200, analogMix: .16, sawBlend: .12,
      formant: .57, formantFrequency: 960, comb: .09, "motion.0": .44, "motion.1": .25,
    }),
    patch("pad-tides", "Tidal Motion", "Slow changes in harmonics within a held chord.", {
      "waveforms.0": "triangle", "waveforms.2": "sine", "ratios.1": 2.011, "ratios.3": 4.02,
      "indices.1": 2.2, "indices.3": 2.05, modSustain: .81, "amp.0": .22, "amp.3": .79,
      "motion.0": 1.37, "motion.1": .88, "cutoff.0": 970, "cutoff.1": 7200,
      resonance: .48, analogMix: .09, sawBlend: .12, unison: .09,
    }),
    patch("pad-ribbon", "Dark Ribbon", "Dark, thick low mids with gentle string-like motion.", {
      "waveforms.0": "triangle", "waveforms.2": "sawtooth", "ratios.2": 1.006,
      "indices.1": .32, "indices.3": .34, "amp.0": .61, "amp.1": .34, "amp.2": .94, "amp.3": 1.2,
      "cutoff.0": 490, "cutoff.1": 1760, analogMix: .53, sawBlend: .58, analogDetune: 29,
      "vibrato.0": .29, "vibrato.1": 3.6, "motion.1": .11, fold: .025,
    }),
  ],
  organ: [
    patch("organ-flute", "Flute Stop", "Rounded pipe-organ tone with an even sustain.", {
      "waveforms.0": "sine", "waveforms.2": "sine", "ratios.2": 2, "indices.1": .06, "indices.3": .04,
      "amp.0": .026, "amp.2": .98, "amp.3": .095, "cutoff.0": 760, "cutoff.1": 3200,
      analogMix: 0, "vibrato.0": .035, drive: 1.01,
    }),
    patch("organ-drawbars", "Wide Drawbars", "Thick drawbar tone with octave and fifth layers.", {
      "waveforms.0": "triangle", "waveforms.2": "sine", "ratios.0": .5, "ratios.2": 3,
      "indices.1": .3, "indices.3": .095, "amp.0": .008, "amp.2": .85, "amp.3": .085,
      "cutoff.0": 870, "cutoff.1": 4600, analogMix: .028, unison: .067,
    }),
    patch("organ-reeds", "Harmonium Reed", "Focused reed-organ tone with a nasal edge.", {
      "waveforms.0": "square", "waveforms.2": "triangle", "ratios.2": 2,
      "indices.1": .26, "indices.3": .16, "amp.0": .039, "amp.2": .92, "amp.3": .12,
      "cutoff.0": 960, "cutoff.1": 3950, formant: .45, formantFrequency: 1420, drive: 1.36,
    }),
    patch("organ-pipes", "Cathedral Pipes", "Layered pipes that take a little longer to speak.", {
      "waveforms.0": "sine", "waveforms.2": "sawtooth", "ratios.0": 1, "ratios.2": 2,
      "indices.1": .2, "indices.3": 1.3, "modDecay.3": .22, modSustain: .72,
      "amp.0": .12, "amp.2": .88, "amp.3": .32, "cutoff.1": 6100, analogMix: .07, "motion.1": .24,
    }),
    patch("organ-combo", "Combo Organ", "Bright transistor-style organ with sharp staccato edges.", {
      "waveforms.0": "square", "waveforms.2": "square", "ratios.2": 4,
      "indices.1": .025, "indices.3": .03, "amp.0": .003, "amp.2": .95, "amp.3": .055,
      "cutoff.0": 1850, "cutoff.1": 7200, "vibrato.0": .29, "vibrato.1": 6.5, drive: 1.53, level: .089,
    }),
  ],
  keys_mallet: [
    patch("keys-rosewood", "Rosewood Mallet", "Warm wooden mallet attack with a short tail.", {
      "waveforms.1": "triangle", "ratios.1": 4.02, "indices.1": 1.19, "indices.2": .42,
      "amp.0": .006, "amp.1": .108, "amp.2": .03, "amp.3": .13,
      "cutoff.0": 820, "cutoff.1": 3550, transient: .31, comb: .19, fold: 0, analogMix: 0,
    }),
    patch("keys-tines", "Suitcase Tines", "Electric piano with bright tines and a softer sustain.", {
      "waveforms.1": "triangle", "ratios.1": 1, "ratios.2": 3, "indices.1": 1.48, "indices.2": .28,
      "amp.0": .005, "amp.1": .49, "amp.2": .32, "amp.3": .38, "modDecay.1": .31, modSustain: .09,
      "cutoff.0": 1320, "cutoff.1": 6450, comb: 0, formant: 0, "motion.1": .13,
    }),
    patch("keys-crystal", "Glass Celeste", "Bright glassy overtones with a longer bell tail.", {
      "waveforms.1": "sine", "ratios.1": 2.75, "ratios.2": 5.36, "ratios.3": 8.12,
      "indices.1": 3.02, "indices.2": 2.6, "indices.3": .51, "modDecay.1": .4,
      "amp.0": .003, "amp.1": .29, "amp.2": .11, "amp.3": .72, "cutoff.1": 12000,
      comb: .27, formant: 0, transient: .16,
    }),
    patch("keys-clavi", "Muted Clav", "Short, wiry keyboard pluck suited to syncopation.", {
      "waveforms.0": "square", "waveforms.1": "triangle", "ratios.1": 1, "indices.1": .57,
      "indices.2": .27, "amp.0": .002, "amp.1": .064, "amp.2": .12, "amp.3": .058,
      "cutoff.0": 1000, "cutoff.1": 4900, transient: .48, comb: .11, drive: 1.53, fold: .075,
    }),
    patch("keys-vibes", "Night Vibes", "Rounded vibraphone tone with a gentle shimmer.", {
      "waveforms.0": "sine", "ratios.1": 2, "ratios.2": 4.2, "indices.1": .71, "indices.2": 1.18,
      "amp.0": .014, "amp.1": .34, "amp.2": .35, "amp.3": .82, "modDecay.1": .18,
      "cutoff.0": 880, "cutoff.1": 4300, "vibrato.0": .18, "vibrato.1": 3.8,
      "motion.0": 3.4, "motion.1": .53, analogMix: 0, transient: .10, fold: 0,
    }),
  ],
  percussion_texture: [
    patch("perc-sand", "Fine Sand", "Bright granular shaker with a fine, sandy texture.", {
      "amp.0": .009, "amp.1": .08, "amp.2": .72, "amp.3": .066,
      "cutoff.0": 6600, "cutoff.1": 14800, resonance: .14, drive: 1.05,
    }),
    patch("perc-wood", "Wood Rim", "Dark, short wooden rim strikes.", {
      "amp.0": .001, "amp.1": .019, "amp.2": .08, "amp.3": .028,
      "cutoff.0": 690, "cutoff.1": 3050, resonance: .48, drive: 1.25, level: .26,
    }),
    patch("perc-skin", "Hand Drum", "Low-mid skin-drum body for a weightier percussion layer.", {
      "amp.0": .005, "amp.1": .088, "amp.2": .48, "amp.3": .135,
      "cutoff.0": 175, "cutoff.1": 995, resonance: .31, drive: 1.36, level: .25,
    }),
    patch("perc-rattle", "Filtered Rattle", "Longer rattle with a noticeable midrange resonance.", {
      "amp.0": .027, "amp.1": .13, "amp.2": .51, "amp.3": .094,
      "cutoff.0": 1780, "cutoff.1": 4620, resonance: .76, drive: 1.42,
    }),
    patch("perc-grit", "Gritty Rim", "Short, rough-edged rim sound with a little overdrive.", {
      "amp.0": .001, "amp.1": .038, "amp.2": .22, "amp.3": .038,
      "cutoff.0": 3060, "cutoff.1": 9610, resonance: .6, drive: 3.5, level: .14,
    }),
  ],
};

export const drumReviewPresets = {
  36: [
    patch("kick-felt", "Felt Kick", "Dark rounded kick with a soft beater.", {
      fundamental: 45, sweep: 83, sweepRate: 78, decay: 39, click: .31, "cutoff.1": 2200, level: .91,
    }),
    patch("kick-club", "Club Punch", "Weighty low end with a sharp broadband strike.", {
      fundamental: 52, sweep: 178, sweepRate: 104, decay: 35, click: 1.47, level: .87,
    }),
    patch("kick-sub", "Sub Drop", "Deep kick with a longer low-frequency body.", {
      fundamental: 37, sweep: 112, sweepRate: 93, decay: 18, click: .54, level: .90,
    }),
    patch("kick-tight", "Tight Beater", "Hard beater and a very short body.", {
      waveform: "triangle", fundamental: 57, sweep: 108, sweepRate: 63, decay: 54, click: 1.72, level: .99,
    }),
    patch("kick-saturated", "Saturated Club", "Saturated club kick with a contained high end.", {
      waveform: "sawtooth", fundamental: 43, sweep: 124, sweepRate: 94, decay: 29, click: .88,
      "cutoff.1": 3150, resonance: .16, drive: 2.87, level: .69,
    }),
  ],
  38: [
    patch("snare-dry", "Dry Crack", "Short, crisp snare with a prominent noise layer.", {
      waveform: "triangle", fundamental: 161, decay: 38, body: .43, noise: .88, "cutoff.1": 7500, level: .24,
    }),
    patch("snare-deep", "Deep Shell", "Lower, thicker snare with a stronger drumhead body.", {
      fundamental: 114, decay: 16, body: .66, noise: .72, "cutoff.1": 5200, level: .26,
    }),
    patch("snare-white", "White Burst", "Bright noise burst with a very light drumhead tone.", {
      fundamental: 209, decay: 22, body: .14, noise: 1.13, "cutoff.1": 14200, level: .19,
    }),
    patch("snare-snap", "High Snap", "High electronic snare with a sharp head snap.", {
      waveform: "square", fundamental: 255, decay: 43, body: .77, noise: .47,
      "cutoff.1": 8500, resonance: .37, level: .22,
    }),
    patch("snare-dust", "Dusty Backbeat", "Darker, overdriven backbeat with a rough texture.", {
      waveform: "triangle", fundamental: 193, decay: 26, body: .58, noise: .91,
      "cutoff.1": 3100, resonance: .29, drive: 2.85, level: .18,
    }),
  ],
  39: [
    patch("clap-tight", "Tight Hands", "Closely spaced handclap bursts.", {
      decay: 84, spacing: .45, "cutoff.1": 10700, level: .13,
    }),
    patch("clap-room", "Wide Hands", "Several handclap bursts with wider gaps.", {
      decay: 21, spacing: 1.88, "cutoff.1": 7500, level: .106,
    }),
    patch("clap-dark", "Dusty Hands", "Dark handclap with a short midrange edge.", {
      decay: 47, spacing: .94, "cutoff.1": 3700, resonance: .64, drive: 1.28, level: .13,
    }),
    patch("clap-air", "Air Snap", "Bright, airy handclap with a clear decay.", {
      decay: 30, spacing: .75, "cutoff.1": 15000, resonance: .09, level: .087,
    }),
    patch("clap-crush", "Crushed Stack", "Driven clap with distinct stacked hits.", {
      decay: 57, spacing: 1.35, "cutoff.1": 9000, resonance: .32, drive: 3.88, level: .087,
    }),
  ],
  42: [
    patch("closed-tick", "Needle Tick", "Thin, metallic tick with a very fast decay.", {
      decay: 86, metalPitch: 1.3, metal: .28, noise: .11, "cutoff.1": 12300, level: .13,
    }),
    patch("closed-dust", "Dust Hat", "Noise-forward closed hat with a sandy texture.", {
      decay: 41, metalPitch: .93, metal: .065, noise: .65, "cutoff.1": 9500, level: .13,
    }),
    patch("closed-brass", "Brass Tick", "Warm, weightier metallic tick in a lower register.", {
      decay: 48, metalPitch: .59, metal: .44, noise: .18, "cutoff.1": 4950, level: .085,
    }),
    patch("closed-air", "Air Cut", "Bright upper band with space for fast repeating hits.", {
      decay: 66, metalPitch: 1.78, metal: .22, noise: .47, "cutoff.1": 15500, level: .105,
    }),
    patch("closed-foot", "Loose Pedal", "Looser pedal closure with a longer sandy edge.", {
      decay: 22, metalPitch: .86, metal: .19, noise: .48, "cutoff.1": 7200, level: .11,
    }),
  ],
  46: [
    patch("open-silver", "Silver Splash", "Bright open hat with a longer metallic ring.", {
      decay: 5.4, metalPitch: 1.61, metal: .38, noise: .35, "cutoff.1": 15300, level: .088,
    }),
    patch("open-noise", "Air Wash", "Long airy wash with very light metallic overtones.", {
      decay: 4.4, metalPitch: .89, metal: .065, noise: .7, "cutoff.1": 11800, level: .12,
    }),
    patch("open-half", "Half-Open Brass", "Shorter, warm half-open hat with a distinct grain.", {
      decay: 14.5, metalPitch: .71, metal: .36, noise: .29, "cutoff.1": 6800, level: .114,
    }),
    patch("open-dark", "Dark Metal", "Dark open hat with a heavier metallic tail.", {
      decay: 7.4, metalPitch: .57, metal: .49, noise: .16, "cutoff.1": 5150, resonance: .39, level: .089,
    }),
    patch("open-cut", "Bright Cut", "Bright open hat with a crisp strike and shorter wash.", {
      decay: 11, metalPitch: 1.19, metal: .21, noise: .51, "cutoff.1": 13200, drive: 2.31, level: .103,
    }),
  ],
};

const tomPresets = (prefix, pitch) => [
  patch(prefix + "-felt", "Felt Head", "Soft mallet strike with a short, dark drumhead.", {
    fundamental: pitch - 5, sweep: 24, decay: 36, noise: .09, "cutoff.1": 2500, level: .32,
  }),
  patch(prefix + "-tight", "Tight Head", "Tighter head with a brighter strike and shorter decay.", {
    waveform: "triangle", fundamental: pitch + 20, sweep: 49, decay: 47, noise: .23, "cutoff.1": 9000, level: .37,
  }),
  patch(prefix + "-deep", "Deep Shell", "Loose head with a longer shell resonance.", {
    fundamental: pitch - 15, sweep: 37, decay: 16, noise: .08, "cutoff.1": 5200, level: .27,
  }),
  patch(prefix + "-electro", "Electro Drop", "Pronounced pitch drop with a drum-machine character.", {
    waveform: "triangle", fundamental: pitch + 4, sweep: 105, decay: 27, noise: .14, "cutoff.1": 6200, level: .30,
  }),
  patch(prefix + "-stick", "Stick on Skin", "Hard stick attack with a rougher drumhead texture.", {
    waveform: "sawtooth", fundamental: pitch, sweep: 57, decay: 31, noise: .51,
    "cutoff.1": 6100, drive: 2.01, resonance: .25, level: .30,
  }),
];

drumReviewPresets[43] = tomPresets("low-tom", 78);
drumReviewPresets[47] = tomPresets("mid-tom", 110);
drumReviewPresets[50] = tomPresets("high-tom", 148);

export const reviewPresets = [
  ...Object.entries(playedPresets).flatMap(([role, presets]) => presets.map(preset => ({ ...preset, role }))),
  ...Object.entries(drumReviewPresets).flatMap(([note, presets]) => presets.map(preset => ({
    ...preset, role: "drums", note: Number(note),
  }))),
];
