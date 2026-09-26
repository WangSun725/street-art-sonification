# Street Art Sonification

Street Art Sonification is a local, interactive artwork explorer. It divides a street-art image into meaningful regions, then responds with sound, contour feedback, and a live interaction signal as the pointer moves across the work.

> [!IMPORTANT]
> **macOS only. Apple Silicon is required.**
> This version supports M1, M2, M3, and M4 Macs. Windows, Linux, and Intel Macs are not currently supported.

## What you can do

- Explore an included sample artwork immediately.
- Drop in a JPG, PNG, or WebP image of your own.
- Add an optional artist statement explaining the work and its context.
- Analyse the image into six to ten playable regions.
- Hear different responses inside different regions.
- Hear a click at boundaries and see the active contour.
- Adjust the overall output volume.
- Send the current interaction data to another local program through WebSocket.

The models only analyse the image. Once the regions are ready, pointer movement and sound are handled by the browser for immediate feedback.

## Before you begin

You need:

- A Mac with an Apple Silicon processor: M1, M2, M3, or M4.
- macOS 13 or later.
- At least 16 GB of memory recommended.
- At least 8 GB of free disk space.
- An internet connection for the first installation.
- Headphones or speakers.

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

### Explore the sample

1. Click **Sound** near the top of the artwork.
2. Move the pointer slowly across the image.
3. Listen for region tones and boundary clicks.
4. Watch the active region name and contour.
5. Use **Output volume** on the right to change the sound level.

Browsers require a click before they allow a webpage to play sound. If the page is silent, click **Sound** first.

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
Web Audio + interaction signal
```

- **Qwen3-VL 2B Instruct 4-bit** identifies street-art-specific subjects, lettering, symbols, wall material, paint fields, and weathered textures.
- **SAM 2.1 Hiera Tiny** converts the proposed locations into pixel-level masks.
- **Web Audio** produces the responsive sound directly in the browser.

No model training is required.

## Privacy

- Model inference runs locally on the Mac.
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

### Image analysis fails

- Confirm that the image is JPG, PNG, or WebP and smaller than 16 MB.
- Confirm that the Mac has at least 8 GB of free disk space.
- Run **`Install & Start.command`** again. It safely checks the installation and downloads anything missing.
- Keep the Terminal window open and read the final error message.

### The first analysis is slow

This is expected. Qwen3-VL and SAM load only when a new image is analysed. Sound and pointer interaction are real time after analysis finishes.

## Interaction Signal

The page publishes the current pointer state at approximately 20 Hz:

```text
ws://127.0.0.1:8765/ws/events
```

The current state is also available at:

```text
http://127.0.0.1:8765/api/state
```

This output can later control MIDI, OSC, Ableton Live, lighting, vibration hardware, or another interactive system. MIDI and OSC conversion are not included in the current version.

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
webapp/static/app.js          Interaction, sound, and live data
requirements-interaction.txt  Qwen and server dependencies
requirements-sam.txt          SAM dependencies
```

More technical notes are available in [`WEB_DEMO.md`](WEB_DEMO.md) and [`INTERACTION_SETUP.md`](INTERACTION_SETUP.md).

## Models and credits

- Qwen3-VL 2B Instruct, Apache 2.0.
- SAM 2.1 Hiera Tiny by Meta, Apache 2.0.
- MLX-VLM, MIT License.

The repository does not include model weights. The installer downloads them from their official sources.

The project is a research and artistic prototype. Confirm that you have permission to use and redistribute any artwork included in a public exhibition or release.
