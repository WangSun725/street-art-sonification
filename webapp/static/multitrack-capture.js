const BLOCK_FRAMES = 1024;

class MultitrackCapture extends AudioWorkletProcessor {
  constructor({ processorOptions: { pairs } }) {
    super();
    this.pairs = pairs;
    this.channels = pairs * 2;
    this.frame = 0;
    this.block = new Float32Array(BLOCK_FRAMES * this.channels);
  }

  process(inputs, outputs) {
    const frames = outputs[0][0].length;
    const controls = inputs[this.pairs]?.[0];
    let offset = 0;
    while (offset < frames) {
      const count = Math.min(frames - offset, BLOCK_FRAMES - this.frame);
      for (let pair = 0; pair < this.pairs; pair++) {
        const [left, right] = inputs[pair];
        const master = pair === this.pairs - 1;
        let channel = this.frame * this.channels + pair * 2;
        for (let i = offset; i < offset + count; i++) {
          const level = master ? 1 : controls?.[i] ?? 0;
          this.block[channel] = (left?.[i] ?? 0) * level;
          this.block[channel + 1] = (right?.[i] ?? 0) * level;
          channel += this.channels;
        }
      }
      this.frame += count;
      offset += count;
      if (this.frame === BLOCK_FRAMES) {
        this.port.postMessage(this.block.buffer, [this.block.buffer]);
        this.block = new Float32Array(BLOCK_FRAMES * this.channels);
        this.frame = 0;
      }
    }
    return true;
  }
}

registerProcessor("multitrack-capture", MultitrackCapture);
