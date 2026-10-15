# Local eye-tracking assets

This directory vendors the browser runtime required by the optional eye-tracking mode so the installation does not depend on a CDN during use.

- `webeyetrack.js`: WebEyeTrack `0.0.2`, built from the official npm package and patched only to load its model and MediaPipe assets from `/static/`.
- `mediapipe/wasm/`: MediaPipe Tasks Vision `0.10.3` WebAssembly runtime from the official npm package.
- `mediapipe/face_landmarker.task`: official MediaPipe Face Landmarker float16 model.
- `../eye-model/`: the official WebEyeTrack BlazeGaze TensorFlow.js model and weight shard.

WebEyeTrack is distributed under the MIT License. MediaPipe is distributed under the Apache License 2.0. The corresponding license files and the generated bundle's third-party notices are stored beside these assets.
