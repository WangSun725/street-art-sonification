"""Local PCM output to a multichannel Core Audio device."""

import asyncio
from math import ceil
from queue import Empty, Full, Queue
from threading import Event

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/multitrack")
CHANNELS = 22
BLOCK_FRAMES = 1024
BLOCK_BYTES = CHANNELS * BLOCK_FRAMES * 4
SILENCE = bytes(BLOCK_BYTES)
active_devices: set[int] = set()


def sounddevice_module():
    try:
        import sounddevice
    except (ImportError, OSError) as error:
        raise RuntimeError("The local audio bridge needs sounddevice and PortAudio.") from error
    return sounddevice


def output_devices():
    sd = sounddevice_module()
    try:
        devices = sd.query_devices()
    except sd.PortAudioError as error:
        raise RuntimeError(f"Could not list audio devices: {error}") from error
    return [
        {"id": index, "name": entry["name"], "channels": entry["max_output_channels"]}
        for index, entry in enumerate(devices)
        if entry["max_output_channels"] >= CHANNELS
    ]


@router.get("/devices")
def list_devices():
    try:
        return output_devices()
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


class PlaybackBuffer:
    def __init__(self, sample_rate):
        self.prebuffer = ceil(sample_rate * 2 / BLOCK_FRAMES)
        self.blocks = Queue(maxsize=self.prebuffer * 2)
        self.playing = False
        self.draining = False
        self.finished = Event()
        self.dropouts = 0

    def render(self, output, frames, _time, status):
        if frames != BLOCK_FRAMES:
            output[:] = bytes(len(output))
            self.dropouts += 1
            return
        if status.output_underflow and self.playing:
            self.dropouts += 1
        if not self.playing:
            if not self.draining and self.blocks.qsize() < self.prebuffer:
                output[:] = SILENCE
                return
            self.playing = True
        try:
            output[:] = self.blocks.get_nowait()
        except Empty:
            self.playing = False
            output[:] = SILENCE
            if self.draining:
                self.finished.set()
            else:
                self.dropouts += 1


@router.websocket("/stream")
async def stream_audio(socket: WebSocket):
    origin_scheme = "https" if socket.url.scheme == "wss" else "http"
    if socket.headers.get("origin") != f"{origin_scheme}://{socket.headers.get('host')}":
        await socket.close(code=1008)
        return

    await socket.accept()
    stream = None
    reserved_device = None
    try:
        setup = await asyncio.wait_for(socket.receive_json(), 5)
        device = setup.get("device")
        rate = setup.get("sampleRate")
        if type(device) is not int or type(rate) is not int or not 22050 <= rate <= 96000:
            raise ValueError("Select an output device and a supported sample rate.")
        devices = await asyncio.to_thread(output_devices)
        if not any(item["id"] == device for item in devices):
            raise ValueError(f"Select a device with at least {CHANNELS} output channels.")
        if device in active_devices:
            raise ValueError("This device is already connected in another tab.")
        active_devices.add(device)
        reserved_device = device

        sd = sounddevice_module()
        buffer = PlaybackBuffer(rate)
        try:
            stream = await asyncio.to_thread(
                sd.RawOutputStream, device=device, samplerate=rate, channels=CHANNELS,
                blocksize=BLOCK_FRAMES, dtype="float32", latency=.06, callback=buffer.render,
            )
            await asyncio.to_thread(stream.start)
        except sd.PortAudioError as error:
            raise RuntimeError(f"Could not open the audio device: {error}") from error
        await socket.send_json({"type": "ready", "channels": CHANNELS})
        reported_dropouts = 0
        while True:
            packet = await socket.receive()
            if packet["type"] == "websocket.disconnect":
                return
            if packet.get("text") == "stop":
                buffer.draining = True
                if not await asyncio.to_thread(buffer.finished.wait, 5):
                    raise RuntimeError("The audio device stopped before the buffer drained.")
                # Wait for the last block submitted to Core Audio to reach the device.
                await asyncio.sleep(stream.latency)
                await socket.send_json({"type": "stopped", "dropouts": buffer.dropouts})
                await socket.close()
                return
            block = packet.get("bytes")
            if block is None or len(block) != BLOCK_BYTES:
                raise ValueError("The audio packet had an invalid size.")
            try:
                buffer.blocks.put_nowait(block)
            except Full as error:
                raise RuntimeError("The audio device could not keep up with the stream. Reconnect to resume.") from error
            if reported_dropouts != buffer.dropouts:
                reported_dropouts = buffer.dropouts
                await socket.send_json({"type": "dropout", "count": reported_dropouts})
    except WebSocketDisconnect:
        pass
    except (ValueError, RuntimeError, OSError, TimeoutError, AttributeError, KeyError) as error:
        await socket.send_json({"type": "error", "message": str(error) or "The audio connection timed out."})
        await socket.close(code=1011)
    finally:
        try:
            if stream is not None:
                await asyncio.to_thread(stream.close)
        finally:
            if reserved_device is not None:
                active_devices.discard(reserved_device)
