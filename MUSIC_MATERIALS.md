# Musical arrangement library

The offline library contains **64 arrangements: eight musical families with eight
four-bar variations each**. They are compact coordinated arrangements assembled
from source material and authored parts, not 64 recordings, trained models, or
64 independently hand-composed songs. No additional model or dataset download is
needed to use them. Browser playback and MIDI Out use the same arrangement,
notes, velocities, durations, chord plan and timestamped transport.

## Source material and attribution

**Groove MIDI Dataset (GMD), Google LLC, CC BY 4.0.**
Source: https://magenta.withgoogle.com/datasets/groove
License: https://creativecommons.org/licenses/by/4.0/
Gillick, Roberts, Engel, Eck and Bamman, *Learning to Groove with Inverse Sequence
Transformations*, ICML 2019.

The library adapts four-bar drum excerpts from actual performances. Each
arrangement's `grooveSource` records the original file, its SHA-256, original BPM,
style and one-indexed starting bar. Microtiming is quantized to sixteenths;
TD-11 articulations are collapsed to kick 36, snare 38, side-stick/clap 39,
closed hat 42 and open hat 46. Simultaneous hit velocities are averaged.
Acid Drive substitutes a four-on-the-floor kick; Dark Pulse and Halftime Drift
substitute a half-time snare. The other retained hits come from the source.
These modifications are part of the adaptation, not claims about the originals.

**SHLD Free MIDI Chord Packs / chords2midi, Ludovic Drolez, MIT.**
Source: https://github.com/ldrolez/free-midi-chords
Pinned revision: `95533fae2c1a2aae032211b9abed0441ac8ba298`.

The library uses diatonic degree sequences from `chords.py` and expands the
`pop`, `pop2`, `hiphop2`, `basic2`, `alt2`, `long`, `hiphop3` and `soul` patterns
from `c2mpatterns.py`. Chords are transposed into the selected root/mode; their
extensions, inversions and spacing use this project's shared voicing engine.
SHLD emotion tags are not imported or treated as GEMS annotations.

**The Endless Acid Banger, David Whiting (Vitling), CC BY 4.0.**
Source: https://github.com/vitling/acid-banger
License: https://creativecommons.org/licenses/by/4.0/

Its root-weighted acid phrases, accents and glide behavior informed the authored
bass patterns. This is a design reference: no Acid Banger samples, source code
or generated audio are copied into the app. Bass pitches follow this project's
shared chord plan rather than Acid Banger's random chromatic note sets.

Lead/keys motifs, call-and-response placement, bass/arp coordination, musical
family profiles, template selection and effects settings are authored here.
GMD and SHLD do not provide aligned nine-track compositions or validated GEMS-9
labels for these arrangements.

## Selection and variation

Qwen separately estimates the unchanged nine GEMS weights from the artwork and
the Artist Statement. The existing analysis combines normalized weights as
**45% image + 55% statement**. The app compares that vector with eight authored
family prototype vectors by cosine similarity and chooses the highest score.
These prototypes express design decisions; similarity is not a confidence score
or a validated psychological inference about a listener.

| Family | Most emphasized GEMS dimensions | Tempo range | Musical character |
| --- | --- | --- | --- |
| Acid Drive | Power, Tension, Joyful Activation | 112–144 | Four-on-the-floor, continuous acid bass, fast arp |
| Electro Breaks | Tension, Power, Joyful Activation | 100–138 | Broken kicks, syncopated bass, answering phrases |
| Glass Pop | Wonder, Joyful Activation, Tenderness | 100–140 | Bright motifs, chord stabs, clear backbeat |
| Garage Motion | Joyful Activation, Nostalgia, Power | 112–140 | Offbeat bass, syncopation, short responses |
| Slow Bloom | Tenderness, Peacefulness, Nostalgia | 64–100 | Spacious chord rhythm, longer notes |
| Dream Circuit | Transcendence, Wonder, Peacefulness | 76–114 | Slow harmony, repeating arp, spacious effects |
| Dark Pulse | Tension, Sadness, Power | 90–128 | Half-time snare, restrained upper voices |
| Halftime Drift | Nostalgia, Sadness, Peacefulness | 70–108 | Half-time groove, sparse bass, delayed phrases |

The chosen family's variation number is:

`1 + 4 × [brightness ≥ 0.50] + 2 × [saturation ≥ 0.45] + [edge energy ≥ 0.30]`.

Here brackets mean 1 if true, otherwise 0. The features come from the processed
artwork, not its surrounding photograph. Old manifests lacking global features
use region-average visual features. A variation changes the source drum phrase,
bass/arp contour, lead response, SHLD chord rhythm, degree progression and effect
settings. All nine parts belong to the same four-bar phrase; every part follows
the same current chord. Primary and contrasting progressions occupy eight bars
each. Slow Bloom and Dream Circuit hold each chord for two bars; other families
use one bar. The existing image/GEMS-derived BPM is clamped to the family's range
on analysis. Root and mode retain the existing analysis mapping. All remain
editable; manually selecting another arrangement preserves the current BPM/key.

`Global System → Arrangement → Why this arrangement?` exposes the matches,
visual measurements and source groove. Any of the 64 options can be selected
manually, or the visitor can return to Auto. The same picture and statement
produce the same initial choice. This does not guarantee a different song for
every possible image: region geometry, pitch/register, timbre, activation and
live controls provide further variation within a template.

## Effects and external output

Web Audio retains the existing nine-role hybrid FM engine and 9×9 GEMS timbre
matrix. Template color offsets shape brightness/attack/release. A stereo chorus
uses two LFO-modulated delay lines; a high-pass on its wet input protects the low
bass/kick. Reverb has a 2.1-second stereo impulse; delay is BPM-synchronized with
filtered feedback. All returns are smoothed and bounded. Pixel brightness,
saturation, motion, GEMS weights and active region expression continuously
shape effect amounts. Effect control follows active voices even between note
onsets, in both Pointer/Gaze and Scan modes.

MIDI Out sends the corresponding normalized control values as CC91 (reverb),
CC93 (chorus), and CC94 (delay), alongside the same notes and timings. Ableton
must map these CCs to its own devices; sending a CC does not instantiate a
plugin. The template's exact delay beat subdivision is also exposed in
`music.arrangement.effects.delayBeats`. MIDI CC alone cannot guarantee that an
external effect's time, curve or timbre matches the browser.

## Rebuild

Run `.interaction-env/bin/python scripts/build_music_templates.py` from the
project root. It needs `mido` and network access for the first download. Raw
sources stay in ignored `third_party/`; the app ships only the generated
`webapp/static/music-templates.js` (about 663 kB) and attribution. GMD archive
SHA-256 is verified; SHLD is pinned to the revision above.

## MIT notice for the SHLD-derived material

Copyright (c) 2019 Ludovic Drolez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
