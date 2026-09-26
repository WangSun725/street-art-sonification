# Street Art Sonification — Local Web Demo

## Start

From the project directory, run:

```bash
./start_web_demo.sh
```

Then open <http://127.0.0.1:8765>.

The sample artwork and its reviewed regions load immediately. For a new JPG, PNG, or WebP image, add an optional artist statement and select **Analyse image**. The local pipeline is:

1. Qwen3-VL 2B Instruct 4-bit proposes six to ten street-art-specific semantic regions.
2. SAM 2.1 Hiera Tiny refines each proposal into a pixel mask.
3. The browser uses those masks for hit detection, contour feedback, sound, and live interaction data.

The first model run can take longer than loading the prepared sample. Keep the terminal window open during the analysis.

## Sound level

Use **Output volume** in the right panel to control every browser-generated sound, including sustained region tones, entry cues, and boundary clicks. The control defaults to 70%; its maximum provides roughly three times the original prototype's master output. A dynamics compressor limits brief peaks when multiple sounds overlap.

## Interaction Signal

The page publishes the current interaction state at approximately 20 Hz:

```json
{
  "type": "pointer_state",
  "analysisId": "demo",
  "region": {
    "id": "sunglasses",
    "label": "Sunglasses",
    "type": "outline",
    "index": 8
  },
  "normalized": { "x": 0.63, "y": 0.31 },
  "speed": 0.42,
  "edgeProximity": 0.8,
  "dwellMs": 1260,
  "timestamp": 1790260000000
}
```

### Inside the page

```javascript
const unsubscribe = window.StreetArtOutput.subscribe((data) => {
  console.log(data);
});

window.addEventListener("streetart:control", (event) => {
  console.log(event.detail);
});
```

### WebSocket

```text
ws://127.0.0.1:8765/ws/events
```

Another local page or program can connect to this address to receive `pointer_state` messages.

### Current state

```text
GET http://127.0.0.1:8765/api/state
```

These interfaces currently expose structured control data only. MIDI, OSC, and Ableton conversion are intentionally outside this version.
