# Street Art Sonification

Street Art Sonification is a local, interactive artwork explorer. It divides a street-art image into meaningful regions, then responds with sound, contour feedback, and a live interaction signal through pointer, webcam gaze, or timed scanning.

> [!IMPORTANT]
> **macOS only. Apple Silicon is required.**
> This version supports M1, M2, M3, and M4 Macs. Windows, Linux, and Intel Macs are not currently supported.

## What you can do

- Explore an included sample artwork immediately.
- Drop in a JPG, PNG, or WebP image of your own.
- Add an optional artist statement explaining the work and its context.
- Analyse the image into six to ten playable regions.
- Choose between two separate interaction modes: **Pointer / Gaze** and **Left-to-Right Scan**.
- Hear different responses inside different regions with a mouse or webcam-based gaze tracking.
- Calibrate the local eye tracker with nine on-screen points and follow its visible gaze cursor.
- Hear a click at boundaries and see the active contour.
- Set the left-to-right scan to any duration from 5 seconds to 60 minutes.
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
- At least 8 GB of free disk space.
- An internet connection for the first installation.
- Headphones or speakers.
- A built-in or external webcam for eye tracking.

The first installation downloads approximately 1.9 GB of model weights, plus the local Python environments. Nothing is uploaded to a cloud model during normal use.

## First-time installation

1. Download the latest macOS release ZIP from the GitHub **Releases** page.
2. Double-click the ZIP file to extract it.
3. Open the extracted folder.
4. Right-click **`Install & Start.command`** and choose **Open**.
5. If macOS asks for confirmation, choose **Open** again.
6. Keep the Terminal window open while the installation runs.
7. Wait for the browser to open automatically.

The first installation can take several minutes because it downloads Python packages and two open-source models. The progress is shown in the Terminal window.

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

### Explore with a mouse

1. Select **Pointer / Gaze**, then **Mouse**.
2. Click **Sound** near the top of the artwork.
3. Move the pointer slowly across the image.
4. Listen for region tones and boundary clicks.
5. Watch the active region name and contour.
6. Use **Output volume** on the right to change the sound level.

Browsers require a click before they allow a webpage to play sound. If the page is silent, click **Sound** first.

### Explore with eye tracking

1. Open `http://127.0.0.1:8765` in Chrome or Safari.
2. Select **Pointer / Gaze**, then **Eye tracking**.
3. Allow access to the webcam when the browser asks.
4. Keep your face centred in the small camera preview.
5. When **Calibrate** becomes available, select it.
6. Look at each target, hold still, then click the target. Repeat for all nine points.
7. Look across the artwork. The visible gaze cursor activates the same regions and sounds as the mouse.

WebEyeTrack, MediaPipe, and the camera feed run locally in the browser. Camera frames are not sent to the Python server or an external service. Ordinary webcams are less precise than dedicated infrared eye trackers, so stable lighting and a steady head position improve the result.

### Play a left-to-right scan

1. Select **Left-to-Right Scan**.
2. Enter a duration in `MM:SS` format, such as `00:30`, `01:00`, or `10:00`.
3. Select **Start**.
4. The scan line moves from the left edge to the right edge over the selected duration.
5. The regions under the scan line become layered musical voices. Vertical position controls pitch, while the artwork's real brightness opens or closes additional harmonics.
6. A short sound event is created when a region's dominant colour changes. Red, orange, yellow, green, cyan, blue, violet, magenta, dark, neutral, and white areas use different event patterns and timbres.
7. Select **Pause** to hold the current position.
8. Drag the timeline or click a horizontal position on the artwork to preview another moment.
9. Select **Reset** to return the scan to the left edge.

The scan is synthesised in real time in the browser. It does not wait for an audio-generation model while it is playing.

### Analyse your own artwork

1. Drag a JPG, PNG, or WebP image onto the artwork area, or click **Drop an image**.
2. Optionally enter a short **Artist statement**:
   - What is the work about?
   - Why was it created?
   - What social, personal, or cultural context is important?
3. Click **Analyse image**.
4. Keep the page open while Qwen3-VL and SAM 2.1 process the image.
5. When the progress reaches 100%, move the pointer across the new region map.

Images must be smaller than 16 MB. The first analysis after starting the app may take longer because the models need to load into memory.

## What the system uses

```text
Artwork image + artist statement
                ↓
Qwen3-VL 2B Instruct 4-bit
                ↓
SAM 2.1 Hiera Tiny
                ↓
Interactive region masks
                ↓
Mouse / WebEyeTrack / timed scan
                ↓
Web Audio + interaction signal
                ↓
Editable Mapping Engine
        ↙               ↘
      MIDI              OSC
```

- **Qwen3-VL 2B Instruct 4-bit** identifies street-art-specific subjects, lettering, symbols, wall material, paint fields, and weathered textures.
- **SAM 2.1 Hiera Tiny** converts the proposed locations into pixel-level masks.
- **WebEyeTrack** uses a lightweight BlazeGaze CNN, MediaPipe face landmarks, head-pose compensation, and local calibration to estimate a screen gaze point.
- **Web Audio** produces the responsive sound directly in the browser.
- **Mido + python-rtmidi** send MIDI notes and controller values through CoreMIDI.
- **python-osc** sends OSC messages to a local or network receiver.

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

- Confirm that the image is JPG, PNG, or WebP and smaller than 16 MB.
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
5. Turn on **Send mapped control**, then select **Apply & save**.

The default OSC mappings include `/streetart/position/x`, `/streetart/brightness`, and `/streetart/region/enter`. A region-enter message also carries the region ID, label, and type.

### Receive MIDI

1. Open **External Output → MIDI** and select **Street Art Sonification (virtual)**, or choose an existing CoreMIDI/IAC destination.
2. Select **Send test note**. The project sends middle C on MIDI channel 1.
3. In Ableton Live or another host, select **Street Art Sonification** as a MIDI input and enable Track or Remote as appropriate.
4. Add a MIDI mapping, choose a visual source, enter a CC number or note number, set the output range and channel, then select **Apply & save**.
5. Turn on **Send mapped control**.

Continuous values such as position, speed, brightness, and scan progress become MIDI CC values or OSC numbers. **Enter region** becomes a short MIDI note or OSC trigger. Web Audio is independent, so it can remain on, be turned off, or play together with the external output.

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

The small browser eye-tracking assets are included for reliable local use. The much larger Qwen3-VL and SAM model weights are not included; the installer downloads them from their official sources.

The project is a research and artistic prototype. Confirm that you have permission to use and redistribute any artwork included in a public exhibition or release.
