# Local eye-tracking assets

The current eye-tracking mode uses WebGazer 3.5.3 and its MediaPipe Face Mesh assets. The browser loads both from the local application server.

- `webgazer/webgazer.js` and `webgazer/mediapipe/face_mesh/` come from the [WebGazer 3.5.3 npm archive](https://registry.npmjs.org/webgazer/-/webgazer-3.5.3.tgz). The [corresponding upstream source and build configuration](https://github.com/brownhci/WebGazer/tree/b12701dd7b6d7b00d4b8dbebf87fdec840c24999) are available from the commit recorded by npm.
- The local JavaScript changes the HTTP development warning in [`src/index.mjs`](https://github.com/brownhci/WebGazer/blob/b12701dd7b6d7b00d4b8dbebf87fdec840c24999/src/index.mjs#L626-L629) by adding `&& window.location.hostname !== '127.0.0.1'` after the localhost comparison. Apply that edit at the pinned commit and run `npm run build` after installing the upstream dependencies. The browser copy omits the source-map reference. The application configures the Face Mesh asset path when starting the tracker.
- The WebGazer notices and GPL-3.0 text are under `webgazer/`. The MediaPipe Apache-2.0 text is under `webgazer/mediapipe/`.

The older WebEyeTrack bundle and MediaPipe Tasks Vision files remain here with their original notices.
