const lead = (id, name, description, values) => ({
  id: `lead5-${id}`, role: "lead_synth", name, description,
  values: { analogMix: 0, sawBlend: 0, unison: 0, crush: 0, "vibrato.0": 0, gateDepth: 0, ...values },
});

export const leadReviewPresets = [
  lead("brass", "Neon Brass", "A full, centered synth-brass attack that opens up and settles into a firm tone.", {
    algorithm: "branch", "waveforms.0": "triangle", "waveforms.1": "sine",
    "ratios.1": 1, "ratios.2": 2, "ratios.3": 4,
    "indices.1": 3.15, "indices.2": 1.22, "indices.3": .48,
    modAttack: .035, modSustain: .35, "modDecay.1": .19,
    "amp.0": .015, "amp.1": .145, "amp.2": .72, "amp.3": .105,
    "cutoff.0": 2050, "cutoff.1": 5900, resonance: .27, drive: 1.4,
  }),
  lead("prism", "Prism Strike", "A thin glass strike at the start of the note, followed by a clear, held sine tone.", {
    algorithm: "parallel", "waveforms.0": "sine", "waveforms.2": "sine",
    "ratios.1": 3.49, "ratios.2": 1, "ratios.3": 6.12,
    "indices.1": 4.6, "indices.3": 2.25, modAttack: .002, modSustain: .007,
    "modDecay.1": .024, "modDecay.3": .045,
    "amp.0": .004, "amp.1": .12, "amp.2": .44, "amp.3": .17,
    "cutoff.0": 6500, "cutoff.1": 13000, resonance: .12, drive: .82,
  }),
  lead("reed", "Hollow Reed", "A dry, narrow lead with odd harmonics and a nasal resonance.", {
    algorithm: "branch", "waveforms.0": "square", "waveforms.1": "triangle",
    "ratios.1": 2, "ratios.2": 3, "ratios.3": 5,
    "indices.1": .63, "indices.2": .81, "indices.3": .34, modSustain: .34,
    "amp.0": .006, "amp.1": .075, "amp.2": .8, "amp.3": .057,
    "cutoff.0": 850, "cutoff.1": 2600, resonance: .55, formant: .57,
    formantFrequency: 1080, drive: 1.29,
  }),
  lead("chip", "Pixel Runner", "A tight, bright digital lead with a clipped edge and crisp separated notes.", {
    algorithm: "carriers", "waveforms.0": "square", "waveforms.1": "triangle", "waveforms.2": "triangle",
    "ratios.1": 2, "ratios.2": 3, "ratios.3": 4, "indices.3": .2,
    "amp.0": .003, "amp.1": .055, "amp.2": .63, "amp.3": .035,
    "cutoff.0": 4000, "cutoff.1": 10500, resonance: .12, drive: 1.7, crush: .35, fold: .13,
  }),
  lead("bow", "Copper Bow", "A slowly rising electronic bow with a faint metallic shimmer on held notes.", {
    algorithm: "feedback", "waveforms.0": "sine", "waveforms.1": "triangle",
    "ratios.1": 1, "ratios.2": 2.002, "ratios.3": 4.12,
    "indices.1": 1.17, "indices.2": 1.47, "indices.3": .61,
    modAttack: .15, modSustain: .47, feedback: .35, ringMix: .38, ringRatio: 1.51,
    "amp.0": .086, "amp.1": .35, "amp.2": .87, "amp.3": .25,
    "cutoff.0": 1200, "cutoff.1": 4900, resonance: .23, "motion.0": 3.05, "motion.1": .72,
    analogMix: .095, drive: 1.14,
  }),
];
