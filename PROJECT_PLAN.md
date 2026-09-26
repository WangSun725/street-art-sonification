# Street Art Touch Sonification — Project Plan

## 1. Project statement

Build a local, browser-based instrument that lets a visitor explore a completed
street artwork by moving a pointer or finger across semantic regions. Entering a
region produces a short low-frequency pulse and outline flash; crossing a
boundary produces a click; movement inside a region continuously changes the
sound. A long press reveals the artist's explanation for that part of the work.

The system does **not** infer or replay the original painting order. It analyzes
only the final artwork and treats its figures, lettering, outlines, fills, wall
surface, damage, and overpainting as playable regions.

## 2. Design goals

- Make the relationship between image, artist statement, and sound traceable.
- Make street art specific through wall, gesture, lettering, layering, public
  voice, and material decay rather than generic image mood.
- Run the classroom performance locally and offline after preparation.
- Use open-source models and require no model training.
- Keep pointer interaction audio-rate responsive; no model inference occurs
  while the visitor is moving.
- Support mouse and trackpad now, touch and external haptics later.

## 3. Inputs and outputs

### Inputs

- One completed street-art image.
- A short artist statement (approximately 3–8 sentences).
- Optional manual corrections to proposed regions and labels.

### Preparation outputs

- `regions.json`: region type, artist-statement link, visual descriptors, and
  sound mapping.
- `masks/*.png`: one indexed mask per playable region.
- `preview.png`: segmentation overlay for verification.

### Performance outputs

- Real-time Web Audio from the browser.
- Visual boundary and region feedback.
- A recorded performance audio file.
- A session JSON containing the pointer path and region events.
- Optional later outputs: MIDI, OSC, and Android vibration patterns.

## 4. System architecture

```text
Artwork + artist statement
          |
          v
Local preparation service
  Qwen3-VL 2B (street-art labels and text-region relationships)
  SAM 2 Tiny (pixel masks)
  OpenCV (color, texture, edges, geometry)
          |
          v
regions.json + mask PNGs + verification preview
          |
          v
Local browser instrument
  Canvas/SVG hit testing
  Pointer Events
  Web Audio synthesis
  MediaRecorder + session event log
          |
          +--> live audio
          +--> recorded performance
          +--> optional MIDI / OSC bridge
```

## 5. Street-art region vocabulary

The first version uses 6–10 approved regions selected from these types:

- `wall`: brick, concrete, cracks, shutters, and architectural boundaries.
- `figure`: people, characters, animals, and emblematic subjects.
- `lettering`: tags, slogans, signatures, and stylized writing.
- `outline`: strong contour and framing marks.
- `fill`: colored painted areas and repeated patterns.
- `drip`: paint runs and gravity-driven marks.
- `overpaint`: occlusion, erasure, pasted layers, and older marks.
- `decay`: fading, peeling, dirt, and damage.

The vision model proposes labels; the artist or researcher approves them. The
system must not invent a painting history when the image does not provide one.

## 6. Interaction and sound grammar

### Boundary events

- Enter region: short low-frequency pulse and outline flash.
- Cross boundary: short click whose brightness follows edge sharpness.
- Exit region: fast release or short reverse pulse.
- Enter an overlap: double pulse and two-layer crossfade.

### Continuous control inside a region

- Horizontal pointer position: stereo position or phrase position.
- Vertical pointer position: pitch/register or filter cutoff.
- Pointer speed: event or grain rate.
- Distance to contour: resonance and roughness.
- Dwell time: gradually reveals a fuller musical layer.
- Long press: ducks the music and plays or displays artist explanation.

### Region-to-sound roles

- Wall: filtered noise, resonance, and structural pulse.
- Figure: melodic motif.
- Lettering/tag: rhythmic or speech-like articulation.
- Outline: bass and accent layer.
- Fill: harmony, drone, and color-dependent filtering.
- Drip: descending glide.
- Overpaint: old/new layer crossfade and echo.
- Decay: granular breakup and intermittent events.

## 7. Model and runtime choices

### SAM 2 Tiny

- Purpose: turn approved points or boxes into accurate masks; optionally propose
  automatic masks.
- License: Apache 2.0.
- Approximate checkpoint size: 150–160 MB.
- Runtime: existing Python 3.11/PyTorch environment; CPU fallback is acceptable
  because processing happens before the performance.

### Qwen3-VL 2B Instruct, 4-bit MLX

- Purpose: produce a street-art-specific structured description and propose
  semantic regions/bounding boxes tied to the artist statement.
- License: Apache 2.0.
- Approximate model size: 1.8 GB.
- Runtime: Apple MLX on M1 Pro; no training.

### Browser audio

- Web Audio API performs synthesis and mixing in real time.
- No generative music model is required for the classroom prototype.
- This keeps latency low, makes the mapping explainable, and avoids downloading
  another multi-gigabyte model.

## 8. Classroom demo flow

1. Start the local server and open the artwork in a browser.
2. Press `Start` to unlock browser audio.
3. Move over the artwork; boundaries flash and produce clicks/pulses.
4. Explore regions to change timbre, pitch, stereo position, and density.
5. Long-press a region to reveal its linked artist statement.
6. Start and stop recording.
7. Replay the recorded exploration and show the path/region event summary.

The prepared demo must remain fully functional if both models are unavailable
during class.

## 9. Implementation stages

### Stage A — classroom prototype

- Prepare one artwork and artist statement.
- Generate or manually approve 6–10 masks.
- Build the local browser instrument.
- Add synthesized pulses, clicks, and region-specific sound layers.
- Add recording and an offline launch script.

### Stage B — reusable authoring workflow

- Add image and statement upload.
- Run Qwen3-VL and SAM 2 through a local Python endpoint.
- Add a mask/label review editor before publishing an artwork.
- Export and import complete artwork projects.

### Stage C — accessibility and installation version

- Add keyboard and screen-reader region navigation.
- Add layered audio description.
- Add Android vibration or an external Web Serial haptic motor.
- Add MIDI/OSC routing and multi-user interaction.
- Co-design and evaluate with blind/low-vision participants.

## 10. Risks and fallbacks

- Automatic masks may be too fragmented: merge and manually approve a small
  number of meaningful regions.
- Stylized lettering may defeat OCR: use the artist statement and manual label.
- VLM labels may hallucinate: retain confidence, provenance, and human approval.
- Browser vibration is unavailable on macOS: use low-frequency audio, boundary
  clicks, and outline flashes in the classroom version.
- Model inference may be slow: ship prepared masks and JSON with the demo.
- Audio overload: limit simultaneous active voices and apply compression.

## 11. Success criteria for the first demo

- Starts locally without internet.
- Pointer-to-sound latency feels immediate.
- At least six regions have visibly and audibly distinct behavior.
- Every semantic region can show its source artist sentence.
- Boundary crossings are perceivable without looking continuously at the screen.
- A full exploration can be recorded and replayed.
