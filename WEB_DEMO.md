# Street Art Sonification — Local Web Demo

## Start

From the project directory, run:

```bash
./start_web_demo.sh
```

Then open <http://127.0.0.1:8765>.

Upload a JPG, PNG or WebP image, add an artist statement, and select **Enter**. Qwen3-VL proposes regions, then SAM 3 and SAM 2.1 build the masks the browser uses for interaction, contours, and sound. Keep the terminal open during analysis.

Choose **Mouse / Eye Tracking** and move onto the artwork, or choose **Scan** and click **Start**. Use **Output volume** to adjust the sound.

## Sound level

Use **Output volume** in the right panel to control the overall level of the browser’s FM synthesizer. The control defaults to 70%; its maximum provides roughly three times the original prototype's master output. A dynamics compressor limits brief peaks when multiple sounds overlap.
