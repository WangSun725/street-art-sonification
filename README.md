# Street Art Sonification

Street Art Sonification is a local, interactive artwork explorer. It divides a street-art image into meaningful regions, then responds with sound, contour feedback, and a live interaction signal through pointer, webcam gaze, or timed scanning.

> [!IMPORTANT]
> **macOS only. Apple Silicon is required.**
> This version supports M1, M2, M3, and M4 Macs. Windows, Linux, and Intel Macs are not currently supported.

## What you can do

- Drop in a JPG, PNG, or WebP image of your own.
- Add an artist statement explaining the work and its context.
- Analyse the image into a maximum of nine playable regions.
- Choose **Mouse / Eye Tracking**, **Scan**, or use **Link** to combine them on one playback timeline.
- Hear different responses inside different regions with a mouse or webcam-based gaze tracking.
- Calibrate the local eye tracker separately for windowed and fullscreen views and follow its visible gaze cursor.
- See the active region's contour and hear its instrument come into focus.
- Scan forward, in reverse, round trip, or through custom ranges. Set a duration from 5 seconds to 10 minutes.
- Seek to a bar line or draw a new range during playback.
- Adjust the overall volume, individual FM patches, and effects.
- Save and reopen an artwork session with its instrument and scan settings.
- Open the in-page **Interaction logic** guide to see the current mappings.

Once the regions are ready, pointer movement, gaze estimation, the timed scan, and sound are handled locally for immediate feedback.

## Before you begin

You need:

- A Mac with an Apple Silicon processor: M1, M2, M3, or M4.
- macOS 13 or later.
- At least 16 GB of memory recommended.
- At least 10 GB of free disk space.
- An internet connection for the first installation.
- Headphones or speakers.
- A built-in or external webcam for eye tracking.

The first installation downloads approximately 2.7 GB of model weights, plus the local Python environments. Nothing is uploaded to a cloud model during normal use.

## First-time installation

1. [Download the current project ZIP](https://github.com/WangSun725/street-art-sonification/archive/refs/heads/main.zip).
2. Double-click the ZIP file to extract it.
3. Open the extracted folder.
4. Right-click **`Install & Start.command`** and choose **Open**.
5. If macOS asks for confirmation, choose **Open** again.
6. Keep the Terminal window open while the installation runs.
7. Wait for the browser to open automatically.

The first installation can take several minutes. The Terminal shows download and setup progress for Python, Qwen3-VL, SAM 2.1, and SAM 3. The app can use SAM 2.1 if the optional SAM 3 download is unavailable.

You do not need Homebrew, Anaconda, or prior programming experience.

## Starting the project later

After the first installation:

1. Open the project folder.
2. Double-click **`Start Street Art Sonification.command`**.
3. Keep the Terminal window open while using the project.
4. Close that Terminal window when you want to stop the local server.

The browser address is:

```text
http://127.0.0.1:8765
```

This address only works while the local server is running.

## Using the interface

### Start a session

1. Open `http://127.0.0.1:8765` in Chrome or Safari.
2. Drop a JPG, PNG, or WebP image into the opening screen. An artwork is required before **Enter** becomes available.
3. Add an **Artist statement** explaining the meaning, context, or intention behind the work.
4. Select **Enter**.
5. Keep the page open while Qwen3-VL and the SAM models analyse the artwork.
6. When the playable regions are ready, choose **Mouse / Eye Tracking** or **Left-to-Right**.
7. The project then opens the performance interface for that interaction mode.

Images must be smaller than 16 MB and contain no more than 40 megapixels. Phone-photo orientation is corrected automatically. Large images are resized proportionally, extreme panoramas receive temporary analysis padding instead of being stretched, and low-resolution images show a quality warning. The system keeps a full-frame artwork intact; it crops only when the visual reading finds clear unrelated scenery with high confidence. Select **Start over** in either performance interface to clear the current session and return to the opening screen.

Fully transparent vertical strips between detected artwork panels can be removed from the display and scan. When SAM 3 returns one combined mask, the original photo must show two straight panel edges with a darker strip between them. The artwork and region masks are stitched together, and the scan keeps its selected duration.

### Play browser audio

New sessions suggest a **00:30** scan. Click **Start** in Scan or move onto the artwork in Mouse / Eye Tracking. Some browsers need a click on the artwork to enable audio. **Output volume** controls the overall level, and **FM Instruments** controls the sound of each instrument. The stereo mix uses the browser’s built-in compressor before the volume and fade controls.

The [local mix review](http://127.0.0.1:8765/static/mix-review.html) plays complete scan recordings with a fader for each instrument. **Save mix** applies the nine levels to the artwork player in the same browser. **Download mix** exports the levels as JSON.

### Record multitrack audio

Open **Output volume → Multitrack Output**, choose a local device with at least 22 output channels, and click **Connect**. For recording on the same Mac, use a loopback device such as BlackHole 64ch. In the recorder, choose that device as the input and assign one stereo input pair to each audio track. Start recording before the performance.

The panel lists the fixed pairs. Channels 1/2 through 17/18 carry the nine instruments with their live spatial filtering, stereo pan, levels, and performance fades. Channels 19/20 carry the combined delay, reverb, and chorus returns. Channels 21/22 carry the compressed master reference. To hear the original mix while recording, monitor from the browser and mute input monitoring in the recorder.

The recorder's input is buffered by about two seconds. After the performance, click **Disconnect** and wait for the output to finish before stopping the recorder. All pairs use the same buffer and stay aligned with each other.

### Explore with a mouse

1. Choose **Mouse / Eye Tracking**, then keep **Mouse** selected.
2. Move the pointer onto the artwork.
3. The region parts fade in on one beat grid. The region under the pointer opens its low-pass filter while the other parts play as filtered backing.
4. Click a region card to hold its focus. Click it again to release it, or move the pointer onto the artwork to explore freely.
5. In paused **Scan**, a region card plays its loop by itself for auditioning.

Mouse and gaze start with arrangement A. A horizontal move of at least about 8% of the image width chooses A when moving right or B when moving left. The change takes effect on a bar line. The artwork shows the focused region's contour. Use **Output volume** to adjust the sound or set it to 0% to mute it.

### Explore with eye tracking

1. Open `http://127.0.0.1:8765` in Chrome or Safari.
2. Choose **Mouse / Eye Tracking**, then select **Eye tracking**.
3. Allow access to the webcam when the browser asks.
4. Keep your face centred in the small camera preview.
5. Complete the twelve targets in the windowed view. Keep your head still, look at each target, and click it five times. The artwork then enters fullscreen for twelve more targets. Both rounds are required.
6. When both views are ready, fullscreen stays open. Exiting or reopening fullscreen automatically uses the matching calibration. To correct drift, look at a spot on the artwork and click it. Use **Calibrate** in the windowed view to repeat both rounds.
7. Adjust **Gaze stability** if needed: **Responsive** follows faster, while **Stable** reduces visible jitter.
8. Look across the artwork. The visible gaze cursor activates the same regions and sounds as the mouse.

WebGazer, MediaPipe Face Mesh, and the camera feed run locally in the browser. Camera frames are not sent to the Python server or an external service. The adjustable stability control combines a 3–15 frame median window, distance-aware easing, and a dead zone that automatically becomes smaller over small semantic regions. Gaze selection also votes across a small circular neighbourhood instead of trusting a single pixel, which reduces flicker at region boundaries. The local median colour around the mouse or gaze point shapes the sound in Web Audio. Ordinary webcams are less precise than dedicated infrared eye trackers, so stable lighting and a steady head position improve the result.

### Play an artwork scan

1. Choose **Scan** after the artwork analysis finishes. Select a forward, reverse, round-trip, or custom path.
2. Enter a duration in `MM:SS` format, such as `00:30`, `01:00`, or `10:00`.
3. Select **Start**.
4. Forward segments play arrangement A and reverse segments play arrangement B. Both directions use the same selection rules and detail-density band. B excludes the rhythm or Lead melody already chosen for A. Each segment receives at least one whole bar, and all instruments share the bar clock and chord progression. The audio clock drives both note scheduling and the scan position. Any time left after the final whole bar is reserved for the fade and tail.

5. In **Filtered backing**, the voices play at steady levels. For a 30-second scan, each region's low-pass filter starts opening from 900 Hz about 3.5 seconds before the line reaches it. It reaches 20 kHz at the crossing and returns to 900 Hz over about 4.5 seconds after the line leaves.
6. Choose **Regions at scan line** to play the regions the line crosses. Each region's playback window is rounded to whole bars.
7. Select **Pause** to hold the current position.
8. Drag the timeline or click a horizontal position on the artwork to seek to a bar line. Resume starts at the beginning of the paused bar and restores the remaining duration of a lead note already held across that bar line.
9. Select **Reset** to return the scan to the left edge.

During playback, click **Select ranges** and drag left or right across the artwork. Each range queues in drawing order and starts on a bar line. The scan continues its planned path after the new ranges and ends at the selected duration. **Done selecting** returns the mouse or gaze to region focus in Link. Live ranges apply to the current playback and clear when you reset or replay the scan.

When the scan reverses on a bar line, continuing drums play the outgoing pattern for one beat when that pattern has a hit in the first beat. Continuing bass plays the incoming chord root with a short fade between patches. The outgoing lead can fade for up to 120 ms. Chord voices keep their natural release if the harmony stays the same. Starting or seeking to a turnaround begins with the current arrangement.

Each artwork draws one rhythm reference from its region-assigned Guitar, Keys / Mallet, FM Organ and Pad. If only scan accompaniment includes those instruments, the draw uses the parts scheduled to play. In each direction, the other chord parts prefer patterns in their own density band with the highest proportion of matching attacks. Ties favor fewer attacks. Both directions keep the same reference instrument, and artwork presets save that choice.

Scan accompaniment uses instruments that aren't assigned to a region. The app counts neighbouring pixel pairs whose grayscale differs by at least 20, pools counts across five columns, and divides the artwork's minimum-to-maximum density range into one band per available instrument. Each four-bar route segment contributes four samples per beat and selects the same group for all four bars. A final short segment inherits the preceding group. An image whose density varies by less than half a percentage point uses the first band. Live route changes preserve the current group. **Accompaniment** shows these parts during playback.

Accompaniment priority is Drums, Acid Bass, Pad, Guitar, Keys / Mallet, FM Organ, Arp Synth, Percussion / Texture, and Lead Synth, skipping instruments already assigned to regions. Scan gain is 46% for unassigned Drums and 30% for each other accompaniment instrument, multiplied by the instrument's Volume setting and the master level. Standalone Mouse / Eye adds its backing drum when no Region uses Drums.

Each drum pattern starts with a kick on beat one. In clips from the Groove MIDI Dataset, the kick is aligned to the sixteenth-note grid and strong snare or clap hits to the beat. The original hi-hat and ghost-note timing is retained.

The scan is synthesised in real time in the browser. It does not wait for an audio-generation model while it is playing.

### Link the scan with mouse or gaze

Turn on **Link** above the artwork. Mouse or gaze controls the direction while the scan is idle. Click **Start** to add the scan on a downbeat. During playback, the scan path sets the default arrangement. The scan line and the mouse or gaze can each open a region's low-pass filter. When they focus on the same instrument, it uses the more open filter. A clear horizontal gaze movement onto a different region can switch that part alone to A or B at the next available bar. Looking away returns the part to the scan's arrangement on a bar line. Pausing or finishing the scan returns to exploration. Turning Link off during playback returns to Scan at the current time.

### Analyse your own artwork

1. Select **Choose another artwork** to return to the opening screen.
2. Drag a JPG, PNG, or WebP image into the image field, or click it to choose a file.
3. Enter a short **Artist statement**:
   - What is the work about?
   - Why was it created?
   - What social, personal, or cultural context is important?
4. Click **Enter**.
5. Keep the page open while Qwen3-VL and the SAM models analyse the artwork.
6. At 100%, the performance interface opens with the new region map.

Images must be smaller than 16 MB and below 40 megapixels. Low-resolution images remain usable, but fine contours may be less accurate. The first analysis after starting the app may take longer because the models need to load into memory.

## What the system uses

```text
Artwork + artist statement ──→ Qwen3-VL region proposals
                                      ↓
                  SAM 3 / SAM 2.1 and exclusive masks
                                      ↓
                   Qwen3-VL checks each region's type
                                      ↓
                    Fixed instruments + shared harmony
                                      ↓
                    Mouse / WebGazer / timed scan
                                      ↓
                      Notes, timing and sound controls
                                      ↓
                      Hybrid FM synthesis in Web Audio
```

- **Qwen3-VL 2B Instruct 4-bit** names and locates visual elements. It uses the Artist Statement to look for painted subjects the artist highlights and to extract explicitly named colours.
- **SAM 3** finds matching shapes. **SAM 2.1 Hiera Tiny** supplies masks where needed and can retry overlapping shapes with exclusion points. Independent painted elements claim their pixels before grounds and exposed surfaces. A named pigment can constrain a painted ground, and Qwen3-VL checks large gaps for missed elements. The final map assigns each covered pixel to one region for pointer, gaze, contours, and scans.
- **The music engine** uses a shared four-bar progression with one chord per bar in 4/4, selected by dominant hue and average grayscale. Region detail density selects a group of candidates. Non-lead instruments combine patterns into a motif, answer, return and ending. Drums have 22 patterns and cap the fourth bar with a short tom fill. The other seven accompaniment instruments have 26 patterns each. Acid Bass borrows the rhythm and derives pitches from the current chord. Lead selects from a shared pool of 260 four-measure vocal phrases drawn from 72 RWC Popular Music songs. It ranks phrases of the matching mode and density against the artwork’s chord sequence, prioritizing chord fit on accented and sustained notes. Lead preserves each selected phrase’s intervals after transposition. Both takes match Bass to the corresponding Drum pattern. Each B part excludes the rhythm or melody already selected for A and uses the same density band. Colours named in the Artist Statement or found in the artwork set tempo. See [Lead source and attribution](#lead-source-and-attribution).
- **WebGazer** uses MediaPipe Face Mesh and calibrates a ridge regressor from clicks on known screen positions.
- **Web Audio** uses a hybrid four-operator FM engine in an AudioWorklet with instrument patches, envelopes, LFOs, and tempo-synced effects.

Qwen3-VL proposes concrete regions, SAM 3 and SAM 2.1 build their masks, and Qwen3-VL checks the categories against the masked artwork. Each category has a fixed default instrument in both Pointer / Gaze and Scan.

| Region category | Default instrument |
| --- | --- |
| Figure | Drums |
| Figure Part | Arp Synth |
| Depicted Object | Lead Synth |
| Lettering | Keys / Mallet |
| Graphic Line | Guitar |
| Abstract Shape | FM Organ |
| Painted Ground | Acid Bass |
| Paint Texture | Percussion / Texture |
| Exposed Support | Pad |

Detected parts in the same category form one playable region. The browser combines their masks and gives the region one card, one instrument, and one phrase. Separate parts remain separate on the image, and each one can trigger the shared region. Use the instrument menu in **Regions** to change the whole region's assignment. Bare material qualifies as Exposed Support when the artwork visibly incorporates it.

Below six playable categories, analysis checks substantial uncovered areas or a dominant, visually varied painted ground for independent features. New masks must pass category review and preserve the original coverage.

FM Organ plays one or two short chord hits per bar, mostly off the beat. It uses the current chord's third and fifth in the middle register, sometimes adding the root above the bass register. The 26 organ patterns follow the same detail-density and four-bar selection rules as the other accompaniment parts.

The mouse and gaze sample a small circle within the selected region. The scan samples the current pixel column separately for each region. The channel medians give the local HSV color. In Link, mouse or gaze color has priority for its focused instrument.

| Local feature | Effect control |
| --- | --- |
| Hue | Continuous left/right echo mix. Red favors the left eighth-note delay, cyan favors the right quarter-note delay. |
| Saturation | Depth of tremolo at two pulses per beat. |
| HSV value | Reverb send. Darker color sends more. |
| Brightness contrast | Chorus send. The contrast is the 90th minus the 10th percentile of the sampled pixels' HSV values. |

Use **Instrument effects** to set each part's baseline. Delay amount remains a manual level and hue distributes it between the two delays. Neutral colors and missing samples use the manual settings. **Shared FX** adjusts the returns for the whole mix. The arrangement listening review uses the earlier experiments documented in [GENRE_MIDI.md](GENRE_MIDI.md) and [MUSIC_MATERIALS.md](MUSIC_MATERIALS.md).

Kick and Acid Bass bypass the Delay and Reverb sends. The other pieces of the drum kit use the Drums send controls.

The drum phrase replaces late hits in the fourth bar with two to four tom strokes. Low, Mid and High Tom are synthesized drum voices on MIDI notes 43, 47 and 50 and can be auditioned and adjusted in the FM Patch Editor.

**FM Patch Editor → Preset review** opens five synthesized sounds for each instrument and each drum piece. The previews use the same performance within each group and match levels for comparison. Mark sounds **Keep** or **Reject**, then use **Save kept presets** to download a JSON bank and load it in the editor on the same browser. Use **Import preset bank** on another browser. To regenerate the local previews, run `node scripts/render_fm_preset_review.mjs` with `ffmpeg` available.

The local [second preset review](http://127.0.0.1:8765/static/fm-preset-review.html?round=2) places the saved sounds above the new candidates in each group. **Save updated bank** exports the saved sounds and any new sounds marked **Keep**. To regenerate the new previews, pass `--round2` to the same render script. The second review reads the original selection from `webapp/runtime/fm-preset-review-round2/kept-bank.json`.

The local [third preset review](http://127.0.0.1:8765/static/fm-preset-review.html?round=3) adds 34 FM patches for groups with fewer than five sounds. Each group plays its current sounds and the new candidates with the same performance and matched levels. Run `node scripts/render_fm_preset_review.mjs --round3` to render the comparisons. Export adds the new picks to the 60 retained sounds. The artwork player loads its active bank from `webapp/static/fm-performance-bank.json`.

The local [fourth preset review](http://127.0.0.1:8765/static/fm-preset-review.html?round=4) carries over Paper Flick and offers 34 more electronic alternatives, including pulse gating, ring modulation and digital hold. Run `node scripts/render_fm_preset_review.mjs --round4` to generate the previews and the retained bank for this review. **Save updated bank** exports the retained sounds and new selections for the FM Patch Editor.

The artwork player uses the approved fourth-round bank of 73 FM patches, including Paper Flick. Each new analysis draws two different sounds per instrument and per drum piece. Rightward movement uses A and leftward movement uses B, with phrase and patch changes aligned to the same bar line. Both sets are selected once, so returning to A recalls the same sounds. During linked scanning, the scan path sets the default, with the gaze override described above. The patch controls show the A values, and manual edits apply to new notes in both sets. **Save Preset** includes both sets and any edits, and older artwork presets still open with their original settings.

Lead Synth keeps a single envelope across connected notes. Steps up to two semitones glide for 6 ms, and larger leaps go directly to the target pitch. A note after a rest or direction change starts at its own pitch, and repeated pitches get a new attack. The Lead carrier follows the MIDI pitch through the attack with up to four cents of vibrato.

FM playback matches the loudness of presets within each instrument from the rendered dry audio. The calibration uses K-weighted loudness across three register, tempo and velocity combinations, with a fourth passage for validation. Kick, Snare and the other drum pieces are matched separately. Per-preset trims apply before effects sends. **FM Instruments → Volume** sets the level of each instrument in the mix. To regenerate the trims after changing the bank, run `node scripts/render_fm_preset_review.mjs --calibrate`. Use `--audit-calibration` to measure the stored trims.

No model training is required.

## Listen to and review the arrangements

Double-click **Review Arrangements.command** to open the local listening workspace
in Safari at **http://127.0.0.1:8766/review**. Keep its Terminal window open while
reviewing. It uses the existing environment and does not need to load the image models.

The current review contains 64 arrangements in **C Major and C Minor**, giving
128 stereo auditions and matching MIDI files with nine channel slots. The
eight-bar auditions use the same engine as the artwork app and simulate
changes in visual controls. They play the active parts together for comparison;
the live scan plays the parts where the scan crosses their regions.

Use **Keep** or **Redo** separately for each mode, with an optional note. Reviews
are saved automatically to `webapp/runtime/arrangement-review/ratings.json` and
backed up in the browser. **Export feedback** makes a portable JSON copy.
**Download audio + MIDI** downloads the complete pack. Tell Codex when the review
is ready; the next round can focus on the Redo items. Earlier rounds and accepted
recordings are retained rather than overwritten. Musical acceptance is a human
decision; technical export checks do not certify that every arrangement sounds good.

The reproducible export tools are `scripts/render_arrangement_previews.mjs`
(shared live note generation and FM DSP), `/review/render` (native browser effects),
and `scripts/package_arrangement_previews.py` (audio/MIDI integrity and packaging).
[Genre review (Round 2)](http://127.0.0.1:8766/review?round=2) compares eight
real genres using published MIDI excerpts and separate instrument designs.
See [Genre MIDI sources](GENRE_MIDI.md) for credits, processing and rebuild
instructions. It is a separate review library.

Generated audio, MIDI, scores and review files stay under the ignored
`webapp/runtime/arrangement-review/` folder.

## Privacy

- Model inference runs locally on the Mac.
- Eye-tracking camera frames remain inside the browser and are not uploaded.
- Uploaded images are not sent to an external model service.
- The browser communicates only with the local address `127.0.0.1`.
- Temporary analysis files are stored under `webapp/runtime/` on the same computer.
- Model files are downloaded from their official public sources during installation.

## Troubleshooting

### The page no longer opens

The local server stops when its Terminal window is closed or the Mac restarts. Double-click **`Start Street Art Sonification.command`** again.

### macOS will not open a `.command` file

Right-click the file, choose **Open**, then confirm **Open** in the macOS dialog. Use the launcher in the project ZIP downloaded from this repository.

### There is no sound

1. Click the artwork when exploring with the mouse, or click **Start** in Scan.
2. Raise **Output volume**.
3. Check the Mac's system output volume.
4. Confirm that the correct headphones or speakers are selected.

### Eye tracking does not start

1. Use the `http://127.0.0.1:8765` address, not the `file:///.../index.html` file.
2. Open the address in Chrome or Safari and allow camera access.
3. Check macOS **System Settings → Privacy & Security → Camera** and enable access for the browser.
4. Close other applications that may be using the webcam, then select **Eye tracking** again.

### Image analysis fails

- Confirm that the image is JPG, PNG, or WebP, smaller than 16 MB, and below 40 megapixels.
- Confirm that the Mac has at least 8 GB of free disk space.
- Run **`Install & Start.command`** again. It safely checks the installation and downloads anything missing.
- Keep the Terminal window open and read the final error message.

### The first analysis is slow

This is expected. Qwen3-VL and SAM load only when a new image is analysed. Sound and pointer interaction are real time after analysis finishes.

## For developers

Start the already configured project from Terminal:

```bash
./start_web_demo.sh
```

Main files:

```text
webapp/server.py              Local FastAPI server and model pipeline
webapp/analyze_regions.py     SAM 2.1 mask generation
webapp/static/index.html      Interface structure
webapp/static/styles.css      Interface appearance
webapp/static/app.js          Interaction and browser audio
webapp/static/fm-worklet.js   Four-operator FM / hybrid synthesis engine
webapp/static/genre-templates-garage.js  Source MIDI catalog
webapp/static/genre-production.mjs      Performance edits, harmonic guides and style profiles
scripts/build_music_templates.py  Reproducible source-material compiler
requirements-interaction.txt  Qwen and server dependencies
requirements-sam.txt          SAM dependencies
```

More technical notes are available in [`WEB_DEMO.md`](WEB_DEMO.md) and [`INTERACTION_SETUP.md`](INTERACTION_SETUP.md).

## Models and credits

- Qwen3-VL 2B Instruct, Apache 2.0.
- SAM 2.1 Hiera Tiny by Meta, Apache 2.0.
- [SAM 3 MLX 6-bit](https://huggingface.co/mlx-community/sam3-6bit), derived from Meta's SAM 3.
- [WebGazer.js](https://github.com/brownhci/WebGazer) 3.5.3 by the Brown WebGazer Team, GPL-3.0-or-later.
- MediaPipe Face Mesh by Google, Apache 2.0.
- MLX-VLM, MIT License.
- Legacy sample files remain in the repository for backwards compatibility, but the current Web Audio engine does not load them. Their original credits are preserved in [`webapp/static/samples/LICENSES.md`](webapp/static/samples/LICENSES.md).

### Related group prototypes and design references

- [SIREN — Sonification Interface for REmapping Nature](https://github.com/Kizjkre/siren) informed the longer-term direction for editable mappings, session saving, and rendered audio export.
- [Hue Scanner](https://github.com/aumritam/image_color_slider) informed the use of local colour statistics in scan and pointer interaction.
- [Colour Eye Tracking](https://github.com/aumritam/color_eye_tracking) informed the switch to WebGazer, artwork-relative calibration, click-to-correct interaction, circular gaze sampling, and adjustable friction.

These repositories are acknowledged as design references. Their source code was not copied into this project because no explicit licence file was visible when reviewed; the related interaction ideas were implemented independently in the existing architecture.

The small browser eye-tracking assets are included for reliable local use. The larger Qwen3-VL and SAM model weights are not included; the installer downloads them from their official sources.

The project is a research and artistic prototype. Confirm that you have permission to use and redistribute any artwork included in a public exhibition or release.

### Added rhythm sources

The [96 added bars](webapp/static/rhythm-pool-expansion.mjs) contain four additional rhythms in each density band for every accompaniment instrument. Drum and Percussion material comes from Magenta Groove MIDI. Bass uses Funk kick timing and Cyberdeck bass patterns. Arp adapts Cyberdeck sequencer parts and credited MIDI tracks. Guitar, Pad, FM Organ and Keys draw from WaivOps NRG-CP and the credited MIDI tracks in the source file. Every entry records the original filename, bar, licence and adaptation. [The build script](scripts/build_rhythm_pool_expansion.py) reads the local Groove and genre MIDI sources and the NRG-CP tarball.

### Lead source and attribution

Lead phrases are adapted from the **RWC Music Database – Popular Music**, created by Masataka Goto, Hiroki Hashiguchi, Takuichi Nishimura and Ryuichi Oka for the Real World Computing Partnership. The [RWC 2.0 dataset](https://zenodo.org/records/18656623) and its [beat, chord and track annotations](https://github.com/rwc-music/rwc-annotations/tree/0a1a6c31dbe73a7f5d44f7caef8cd0999402a4c2) are released under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), which also applies to the combined Lead excerpts. The [RWC Pop Key and Melody Annotations](https://github.com/instr3/rwc-pop-annotations/tree/f859330e07ebdd495c01115325eea59e21f98255) by instr3 use [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) for the annotations and retain the underlying RWC terms. The [RWC 2.0 release paper](https://doi.org/10.5334/tismir.326) gives the full dataset citation.

The [Lead pool](webapp/static/rwc-lead-pool.mjs) lists the source track, artist, available composer credit, original time span and vocal annotation for each excerpt. The conversion extracts four consecutive 4/4 bars, maps timings from seconds to beats, trims boundary overlaps, and stores pitches relative to the source tonic. The app transposes the whole excerpt when the artwork sets a different root and renders it through the FM Lead Synth. The scripts [extract the annotated excerpts](scripts/build_rwc_lead_pool.py) and [curate candidates against the current progressions](scripts/curate_rwc_lead_pool.mjs).
