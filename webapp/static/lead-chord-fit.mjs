const pitchClass = note => ((note % 12) + 12) % 12;
const chordQuality = ({ triad: [root, third, fifth] }) =>
  fifth === pitchClass(root + 6) ? "dim" : fifth === pitchClass(root + 8) ? "aug"
    : third === pitchClass(root + 3) ? "min" : "maj";

export function describeLeadHarmony(chords, tonic) {
  return chords.map(notes => {
    const triad = notes.slice(0, 3).map(note => pitchClass(note - tonic));
    return { triad, quality: chordQuality({ triad }), root: triad[0],
      seventh: pitchClass(notes[3] - tonic) };
  });
}

export function leadChordFit(phrase, chords) {
  let total = 0, weights = 0, sourceMatch = 0;
  const { events } = phrase;
  for (let index = 0; index < events.length; index++) {
    const [onset, duration, interval] = events[index];
    const next = events[index + 1];
    const pc = pitchClass(interval);
    // Weight by actual overlap so a held note spanning a chord change can clash on either side.
    const finish = onset + duration;
    for (let bar = Math.floor(onset / 4); bar < 4 && bar * 4 < finish - 1e-6; bar++) {
      const chord = chords[bar];
      const overlapStart = Math.max(bar * 4, onset);
      const overlap = Math.min(bar * 4 + 4, finish) - overlapStart;
      const phase = overlapStart - bar * 4;
      const accent = phase < .12 ? .9 : Math.abs(phase - 2) < .12 ? .6 : 0;
      const weight = .24 + Math.min(overlap, 2) * .58 + accent + (!next ? .80 : 0);
      const resolvesByStep = next && next[0] < (bar + 1) * 4 && next[0] - finish <= .24 &&
        next[0] - onset <= 1.15 && Math.abs(next[2] - interval) >= 1 && Math.abs(next[2] - interval) <= 2 &&
        chord.triad.includes(pitchClass(next[2]));
      const fit = chord.triad.includes(pc) ? 1 : resolvesByStep ? .78
        : pc === chord.seventh ? .62 : overlap >= .65 || accent ? .08 : .32;
      total += fit * weight;
      weights += weight;
    }
  }
  chords.forEach(({ root, quality }, index) => {
    const [sourceRoot, sourceQuality] = phrase.source.chords[index] ?? [];
    if (sourceRoot === root && sourceQuality === quality) sourceMatch++;
  });
  return .9 * total / weights + .1 * sourceMatch / chords.length;
}

export function rankLeadPhrases(phrases, chordNotes, tonic = 0) {
  const chords = describeLeadHarmony(chordNotes, tonic);
  return phrases.map(phrase => ({ phrase, score: leadChordFit(phrase, chords) }))
    .sort((a, b) => b.score - a.score || a.phrase.id.localeCompare(b.phrase.id, "en"));
}
