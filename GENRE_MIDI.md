# Genre listening review

[Round 4](http://127.0.0.1:8766/review?round=4) shares the live app's arrangement library.
Major and Minor have separate arrangements of the same excerpt, with differences
in rhythm, voicing and FM settings. Half-bar harmony guides describe notes that
actually overlap; a guide can show an open interval or a single anchor on a sparse
riff. Added supporting parts, programmed drum parts and source tracks are marked
on the cards. 2-Step Garage replaces Electro Rock. It adapts eight unused
[Cyberculture CC0 MIDI patterns](https://cyberculture.pt/en/machine) as pitch sources
with newly programmed shuffled drums, bass rhythm and organ stabs. The original
patterns are Psytrance, not Garage recordings.


[Round 3](http://127.0.0.1:8766/review?round=3) is the produced comparison
of the same 64 source excerpts. Each template has an opening, entrance,
breakdown and return. The darker/brighter, sparse/layered and steady/chopped
variants change the orchestration, register, articulation and effect sends.
Dubstep, Jungle and Synthwave use newly programmed drum parts. Every card
can play the matching Round 2 excerpt for comparison. Round 3 sends scripted
visual cues through the same note-expression and effect controls used for
live image input, and writes those changes as MIDI CC automation.

The template-number selector starts at 01, adds 4 at 50% brightness,
2 at 45% saturation and 1 at 30% edge density. These contributions correspond
to the brighter, layered and chopped choices. The numbers select eight
arrangements per family. Major and Minor are two auditions of each one.
The review page accepts example measurements and highlights the matching
card. The artwork app selects from its live arrangement library.

[Round 2](http://127.0.0.1:8766/review?round=2) contains 64 eight-bar MIDI
arrangements, eight per genre. Each has a C Major and C Minor audition. They
are excerpts or variants of independently released material, not 64 separate
songs. [Round 1](http://127.0.0.1:8766/review?round=1) and its ratings are
separate. Round 2 is a listening candidate; the interactive artwork still uses
its current arrangement library and region gating.

| Genre | Original MIDI source | What is reused |
| --- | --- | --- |
| Psytrance | [Cyberculture Cyberdeck CC0 pack](https://cyberculture.pt/en/machine) | Eight published sequencer patterns: aligned bass, acid and drums. These are patterns, rather than transcriptions of released songs. |
| Techno | [Empacotatron — Fupi](https://opengameart.org/content/empacotatron) | One published keyboard track, split by register. An original four-on-the-floor drum part is added. |
| Jungle | [Odd Style — Tozan](https://opengameart.org/content/odd-style) | Pitched parts from the same source MIDI, on a doubled beat grid (80 → 160 BPM without speeding up the phrases). An original breakbeat drum part is added. |
| Dubstep | [Menu Loop — Umplix](https://opengameart.org/content/menu-loop-0) | Lead, main bass, pad and drum tracks. The secondary bass layer is omitted. |
| Chiptune | [C64 Style 3 — Tozan](https://opengameart.org/content/midi-pack-1-24-new-tunes) and [C64 Rhythm Drums 4 — Tozan](https://opengameart.org/content/midi-pack-3-35-so-far) | Lead, bass and drums; counter in the second file. Redundant doubled parts are omitted. |
| Dark Ambient | [Derelict — northivanastan](https://opengameart.org/content/derelict) | Keyboard, harp, pad, strings and percussion parts, including authored echo notes. |
| Synthwave | [Mechanical Golem — Umplix](https://opengameart.org/content/mechanical-golem) | Saw lead, bass and electronic kit. |
| Electro Rock | [Xenon Phoenix — continuum.mid](https://opengameart.org/content/xenon-phoenix) | Aligned synth, guitar, bass, pad and drum tracks. |

All listed source MIDI is published under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The archive and source file checksums are pinned in the builder. Each review
card links to the original download and identifies the source, excerpt and
parts added by this project. Some sections share motifs from the same song.

The project adapts onsets to its shared 1/12-beat grid, folds notes to a useful
register for each instrument, and uses one velocity and gate length for a
group of simultaneous hits. For Techno, the source 84 BPM MIDI is read on a
doubled beat grid and played at the top of the 132–166 BPM audition range.
For sources without a tempo event, the MIDI default is 120 BPM. Major/Minor
auditions apply one common tonic and mode conversion to all pitched parts.
They retain chromatic notes outside the reference mode. A source tonic is a
working reference for this conversion; the original MIDI is available to
compare. Notes are not recomposed independently for each instrument.

FM uses role-specific patches in each genre, e.g. pulse voices for Chiptune,
a beat-synced cutoff LFO for Dubstep bass, and long envelopes and diffuse
effects for Dark Ambient. The music events drive both the MP3 render and the
nine-channel MIDI export. Some channels are empty because the excerpt doesn't
use those instruments. The MIDI file does not carry the browser's FM timbres.
The auditions play the active parts together to make comparison easier.

To rebuild Round 4:

```sh
.interaction-env/bin/python scripts/build_genre_templates.py --garage
node scripts/render_arrangement_previews.mjs --genre --production --performance --round 4 --bars 8 --workers 4 --no-activate
```

Open [the Round 4 render page](http://127.0.0.1:8766/review/render?round=4), then use
`.interaction-env/bin/python scripts/package_arrangement_previews.py --round 4`.
For the original Round 2:


```sh
.interaction-env/bin/python scripts/build_genre_templates.py
node scripts/render_arrangement_previews.mjs --genre --round 2 --bars 8 --workers 4 --no-activate
```

Open [the round's render page](http://127.0.0.1:8766/review/render?round=2) and
select **Render previews**, then run
`.interaction-env/bin/python scripts/package_arrangement_previews.py --round 2`.
Use a new round number if the inputs change after rendering.
