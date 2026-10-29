# Street Art Sonification

Street Art Sonification is a local, interactive artwork explorer. It divides a street-art image into meaningful regions, then responds with sound, contour feedback, and a live interaction signal through pointer, webcam gaze, or timed scanning.

> [!IMPORTANT]
> **macOS only. Apple Silicon is required.**
> This version supports M1, M2, M3, and M4 Macs. Windows, Linux, and Intel Macs are not currently supported.

## What you can do

- Drop in a JPG, PNG, or WebP image of your own.
- Add an artist statement explaining the work and its context.
- Analyse the image into a maximum of nine playable regions.
- Choose between two separate interaction modes: **Pointer / Gaze** and **Left-to-Right Scan**.
- Hear different responses inside different regions with a mouse or webcam-based gaze tracking.
- Calibrate the local eye tracker with nine on-screen points and follow its visible gaze cursor.
- Hear a click at boundaries and see the active contour.
- Set the left-to-right scan to any duration from 5 seconds to 10 minutes.
- Drag the scan timeline to hear any horizontal position immediately.
- Adjust the overall output volume.
- Open the in-page **Interaction logic** guide to see the current mappings.
- Send the current interaction data to another local program through WebSocket.
- Map visual controls to MIDI CC, MIDI notes, or OSC addresses directly in the interface.

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

The first installation downloads approximately 3.7 GB of model weights, plus the local Python environments. Nothing is uploaded to a cloud model during normal use.

## First-time installation

1. Download the latest macOS release ZIP from the GitHub **Releases** page.
2. Double-click the ZIP file to extract it.
3. Open the extracted folder.
4. Right-click **`Install & Start.command`** and choose **Open**.
5. If macOS asks for confirmation, choose **Open** again.
6. Keep the Terminal window open while the installation runs.
7. Wait for the browser to open automatically.

The first installation can take several minutes because it downloads Python packages and four open-source model components. The progress is shown in the Terminal window.

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
5. Keep the page open while Qwen3-VL and SAM 2.1 complete the progress bar.
6. When the playable regions are ready, choose **Mouse / Eye Tracking** or **Left-to-Right**.
7. The project then opens the performance interface for that interaction mode.

Images must be smaller than 16 MB and contain no more than 40 megapixels. Phone-photo orientation is corrected automatically. Large images are resized proportionally, extreme panoramas receive temporary analysis padding instead of being stretched, and low-resolution images show a quality warning. The system keeps a full-frame artwork intact; it crops only when the visual reading finds clear unrelated scenery with high confidence. Select **Start over** in either performance interface to clear the current session and return to the opening screen.

### Choose the audio output

- New sessions start in **MIDI Out** with browser sound off. The default left-to-right duration is **03:00**.
- Select **Web Audio** to hear the built-in browser sound. Click **Sound** if browser audio is still off.
- Select **MIDI Out** to mute the built-in browser sound and send MIDI notes and controls to the selected CoreMIDI destination.
- MIDI ports and custom MIDI/OSC mappings remain available under **Advanced Control Mapping**.

### Explore with a mouse

1. Choose **Mouse / Eye Tracking**, then keep **Mouse** selected.
2. Click **Sound** near the top of the artwork.
3. Move the pointer slowly across the image.
4. Listen for region tones and boundary clicks.
5. Watch the active region name and contour.
6. Use **Output volume** on the right to change the sound level.

Browsers require a click before they allow a webpage to play sound. If the page is silent, click **Sound** first.

### Explore with eye tracking

1. Open `http://127.0.0.1:8765` in Chrome or Safari.
2. Choose **Mouse / Eye Tracking**, then select **Eye tracking**.
3. Allow access to the webcam when the browser asks.
4. Keep your face centred in the small camera preview.
5. When **Calibrate** becomes available, select it.
6. Look at each target, hold still, then click the target. Repeat for all twelve points arranged over the artwork.
7. Look across the artwork. The visible gaze cursor activates the same regions and sounds as the mouse.

WebEyeTrack, MediaPipe, and the camera feed run locally in the browser. Camera frames are not sent to the Python server or an external service. Gaze selection votes across a small circular neighbourhood instead of trusting a single pixel, which reduces flicker at region boundaries. The local median colour around the mouse or gaze point also shapes the shared Web Audio / MIDI event. Ordinary webcams are less precise than dedicated infrared eye trackers, so stable lighting and a steady head position improve the result.

### Play a left-to-right scan

1. Choose **Left-to-Right** after the artwork analysis finishes.
2. Enter a duration in `MM:SS` format, such as `00:30`, `01:00`, or `10:00`.
3. Select **Start**.
4. The scan line moves from the left edge to the right edge over the selected duration. The algorithm generates the musical events in real time at the selected BPM.
5. The regions under the scan line become layered musical voices. Vertical position controls pitch, while the artwork's real brightness opens or closes additional harmonics.
6. A short sound event is created when a region's dominant colour changes. Red, orange, yellow, green, cyan, blue, violet, magenta, dark, neutral, and white areas use different event patterns and timbres.
7. Select **Pause** to hold the current position.
8. Drag the timeline or click a horizontal position on the artwork to preview another moment.
9. Select **Reset** to return the scan to the left edge.

The scan is synthesised in real time in the browser. It does not wait for an audio-generation model while it is playing.

### Analyse your own artwork

1. Select **Choose another artwork** to return to the opening screen.
2. Drag a JPG, PNG, or WebP image into the image field, or click it to choose a file.
3. Enter a short **Artist statement**:
   - What is the work about?
   - Why was it created?
   - What social, personal, or cultural context is important?
4. Click **Enter**.
5. Keep the page open while Qwen3-VL and SAM 2.1 analyse the artwork.
6. At 100%, the performance interface opens with the new region map.

Images must be smaller than 16 MB and below 40 megapixels. Low-resolution images remain usable, but fine contours may be less accurate. The first analysis after starting the app may take longer because the models need to load into memory.

## What the system uses

```text
Artwork image + artist statement
                ↓
Qwen3-VL 2B Instruct 4-bit
       ↙                    ↘
Street-art region plan    Emotion profile
       ↓                    ↓
SAM 2.1 Hiera Tiny    Visual feature mapping
       ↓                    ↓
Region masks       BPM / root / mode
       ↘                    ↙
          Shared event engine
                 ↓
Mouse / WebEyeTrack / timed scan
                ↓
Region-controlled MIDI events
        ↙               ↘
4-operator FM Audio     MIDI Out
                           ↘
                 Optional OSC / CC mapping
```

- **Qwen3-VL 2B Instruct 4-bit** identifies street-art-specific subjects, lettering, symbols, wall material, paint fields, and weathered textures.
- Qwen3-VL translates the image and Artist Statement into an emotion profile. A deterministic mapping then derives BPM from emotional arousal and visual energy, mode from valence and tension, and root from a stable artwork-and-statement fingerprint. This avoids repeatedly falling back to the same familiar key and tempo while keeping repeated analyses reproducible.
- **SAM 2.1 Hiera Tiny** converts the proposed locations into pixel-level masks.
- The **algorithmic music engine** assigns each region one of nine musical roles, quantises every note to the shared key and tempo, and generates melody, chords, bass, drums, and texture in real time.
- **WebEyeTrack** uses a lightweight BlazeGaze CNN, MediaPipe face landmarks, head-pose compensation, and local calibration to estimate a screen gaze point.
- **Web Audio** uses a shared four-operator FM/phase-modulation engine implemented in an AudioWorklet. Each of the nine roles has a distinct routing algorithm, operator ratios, modulation envelopes, feedback, filtering, drive, and articulation. It renders exactly the same note, chord, rhythm, velocity, duration, crossfade, and control events used by MIDI Out; only the final instrument renderer changes.
- **Mido + python-rtmidi** send MIDI notes and controller values through CoreMIDI.
- **python-osc** sends OSC messages to a local or network receiver.

Each playable region receives one unique musical role. The same role is used by Pointer / Gaze, Left-to-Right Scan, Web Audio, and MIDI Out:

| Role | Pointer / Gaze behavior | MIDI channel |
| --- | --- | ---: |
| Lead Synth | Beat-synchronised short melody | 1 |
| Counter Synth | Sparse melodic response | 2 |
| Drums | Quantised kick, snare, and hi-hat pattern | 3 |
| Bass | Root-and-fifth bass line | 4 |
| Guitar | Chord hits, motifs, and broken open voicings | 5 |
| Pad | Sustained open chords with optional 7th–13th tensions | 6 |
| Strings | Wide sustained chords with inversions and voice leading | 7 |
| Keys / Mallet | Chord stabs and varied note phrases | 8 |
| Percussion / Texture | Movement-controlled rhythmic density | 9 |

When an artwork has fewer than nine regions, the semantic region types determine which subset of roles is used. For example, lettering prefers Drums, wall areas prefer Pad, figures prefer Lead Synth, and textured paint prefers Percussion / Texture.

The system creates notes only while the artwork is being explored. Position selects pitches from the shared scale, region type selects an instrument role, and local colour, brightness, texture, movement, and the image-and-statement emotion profile shape articulation and timbre. The rhythm engine mixes long notes, rests, quarters, eighths, sixteenths, dotted values, syncopation, and triplets in four-bar A–A′–B–A phrases instead of repeating one fixed 16-step pattern. The harmony engine automatically selects primary and contrasting progressions from major or minor Roman-numeral pools, so the same progressions transpose to all twelve keys. Guitar, Pad, Strings, and Keys can play simultaneous chords as well as broken patterns; chord voicings may be inverted, spread across several octaves, and extended with 7ths, 9ths, 11ths, or 13ths. Pointer / Gaze activates one region at a time; Left-to-Right Scan can layer up to five regions under the scan line. Web Audio and MIDI Out consume one shared performance frame, so neither mode adds its own extra notes.

No model training is required.

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

Right-click the file, choose **Open**, then confirm **Open** in the macOS dialog. Only use launchers downloaded from this project's official GitHub release.

### There is no sound

1. Click **Sound** in the page.
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

## Interaction Signal

The page publishes the current mouse, gaze, or scan state at approximately 20 Hz:

```text
ws://127.0.0.1:8765/ws/events
```

The current state is also available at:

```text
http://127.0.0.1:8765/api/state
```

Mouse and gaze messages use `type: "pointer_state"`; the `source` field is `mouse` or `gaze`. Scan messages use `type: "scan_state"` and include the current time, selected duration, progress, dominant colour family, brightness, saturation, RGB values, and up to five active regions.

## External MIDI and OSC output

The **External Output** section converts the same mouse, gaze, and scan data into MIDI or OSC. The routing runs inside the local project, so a receiving application does not need to connect to the WebSocket or run another conversion script.

### Receive OSC

1. In the receiving application, open an OSC input on a port such as `9000`.
2. In **External Output → OSC**, enter the receiver's host and port. Use `127.0.0.1` when both programs run on the same Mac.
3. Select **Send test**. The receiver should get `/streetart/test`.
4. Add or edit mappings. Each OSC mapping has a visual source, an OSC address, an output range, and an optional inverted direction.
5. Turn on **Advanced external routing**, then select **Apply & save**.

The default OSC mappings include `/streetart/position/x`, `/streetart/brightness`, and `/streetart/region/enter`. A region-enter message also carries the region ID, label, and type.

### Receive MIDI

1. Open **External Output → MIDI** and select **Street Art Sonification (virtual)**, or choose an existing CoreMIDI/IAC destination.
2. Select **Send test note**. The project sends middle C on MIDI channel 1.
3. In Ableton Live or another host, select **Street Art Sonification** as a MIDI input and enable Track or Remote as appropriate.
4. The nine instrument roles automatically use MIDI channels 1–9. Create one receiving track per channel when you want separate Ableton instruments.
5. Add optional custom MIDI mappings for visual controls such as Y position or movement speed, then select **Apply & save**.
6. Select **MIDI Out** at the top of the performance controls. This enables the local output route; the advanced switch and mappings can still be adjusted manually.

The shared performance frame also sends a fixed controller set on each active instrument channel: movement/modulation on CC1, pan on CC10, expression/crossfade on CC11, harmonic intensity on CC71, release on CC72, attack on CC73, brightness on CC74, reverb on CC91, and chorus on CC93. Web Audio reads the same normalized values directly. Advanced Control Mapping remains optional for additional OSC or MIDI destinations.

In Pointer / Gaze mode, Web Audio starts or resumes the ten-minute music clock when Sound is enabled; MIDI Out starts or resumes the same clock when that output is selected. Moving or looking into a region gates its assigned generated track at the current global score position rather than restarting it. The browser renderer and MIDI Out both consume the same `music.activeVoices` events, including notes, chords, rhythmic steps, velocities, durations, channels, and `playbackSeconds`. Ableton can therefore replace the embedded timbres without changing the musical performance. Continuous values such as position, speed, brightness, and scan progress can additionally become MIDI CC values or OSC numbers. Selecting **Web Audio** suppresses MIDI messages while keeping optional OSC control available; selecting **MIDI Out** mutes the built-in browser sound and enables MIDI routing.

Recommended Ableton Drum Rack pads for the current algorithm:

| MIDI channel | Note | Suggested sample |
| ---: | ---: | --- |
| 3 — Drums | 36 | Kick |
| 3 — Drums | 38 | Snare |
| 3 — Drums | 39 | Hand clap |
| 3 — Drums | 42 | Closed hi-hat |
| 3 — Drums | 46 | Open hi-hat |
| 9 — Percussion / Texture | 37 | Tom, barrel, or low found-object hit |
| 9 — Percussion / Texture | 39 | Rim, click, paint-can tap, or short found sound |
| 9 — Percussion / Texture | 42 | Closed shaker or short spray-like texture |
| 9 — Percussion / Texture | 46 | Open shaker, metal wash, or longer spray-like texture |

External settings are stored locally in `webapp/runtime/external-output.json`. That runtime file is intentionally excluded from Git because MIDI devices and OSC ports differ between computers.

## For developers

Start the already configured project from Terminal:

```bash
./start_web_demo.sh
```

Main files:

```text
webapp/server.py              Local FastAPI server and model pipeline
webapp/analyze_regions.py     SAM 2.1 mask generation
webapp/output_bridge/         MIDI, OSC, and mapping engine
webapp/static/index.html      Interface structure
webapp/static/styles.css      Interface appearance
webapp/static/app.js          Interaction, sound, and live data
webapp/static/fm-worklet.js   Four-operator FM synthesis engine
requirements-interaction.txt  Qwen and server dependencies
requirements-sam.txt          SAM dependencies
```

More technical notes are available in [`WEB_DEMO.md`](WEB_DEMO.md) and [`INTERACTION_SETUP.md`](INTERACTION_SETUP.md).

## Models and credits

- Qwen3-VL 2B Instruct, Apache 2.0.
- SAM 2.1 Hiera Tiny by Meta, Apache 2.0.
- WebEyeTrack by RedForestAI, MIT License.
- MediaPipe Tasks Vision by Google, Apache 2.0.
- MLX-VLM, MIT License.
- Legacy sample files remain in the repository for backwards compatibility, but the current Web Audio engine does not load them. Their original credits are preserved in [`webapp/static/samples/LICENSES.md`](webapp/static/samples/LICENSES.md).

### Related group prototypes and design references

- [SIREN — Sonification Interface for REmapping Nature](https://github.com/Kizjkre/siren) informed the longer-term direction for editable mappings, session saving, and rendered audio export.
- [Hue Scanner](https://github.com/aumritam/image_color_slider) informed the use of local colour statistics in scan and pointer interaction.
- [Colour Eye Tracking](https://github.com/aumritam/color_eye_tracking) informed artwork-relative calibration and circular gaze sampling.

These repositories are acknowledged as design references. Their source code was not copied into this project because no explicit licence file was visible when reviewed; the related interaction ideas were implemented independently in the existing architecture.

The small browser eye-tracking assets are included for reliable local use. The larger Qwen3-VL and SAM model weights are not included; the installer downloads them from their official sources.

The project is a research and artistic prototype. Confirm that you have permission to use and redistribute any artwork included in a public exhibition or release.
