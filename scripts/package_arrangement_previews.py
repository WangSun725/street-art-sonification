#!/usr/bin/env python3
"""Verify all exported auditions and package the listening/MIDI files."""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import zipfile

import mido

ROOT = Path(__file__).resolve().parents[1]


def check_clip(folder, item):
    name = item["id"]
    score = json.loads((folder / "scores" / (name + ".json")).read_text())
    audio = folder / "audio" / (name + ".mp3")
    midi_path = folder / "midi" / (name + ".mid")
    checked = json.loads((folder / "checks" / (name + ".json")).read_text())
    if hashlib.sha256(audio.read_bytes()).hexdigest() != checked["sha256"]:
        raise ValueError(f"Audio changed after rendering: {name}")
    midi = mido.MidiFile(midi_path)
    if len(midi.tracks) != 10:
        raise ValueError(f"Expected conductor plus nine instrument tracks: {name}")
    expected_on = Counter((event["channel"]-1, round(event["onsetBeat"]*midi.ticks_per_beat), note,
                          event.get("noteVelocities", {}).get(str(note), event["velocity"]))
        for event in score["events"] for note in event["notes"])
    expected_off = Counter((event["channel"]-1, round((event["onsetBeat"]+event["durationBeats"])*midi.ticks_per_beat), note)
        for event in score["events"] for note in event["notes"])
    actual_on, actual_off = Counter(), Counter()
    for track in midi.tracks:
        tick = 0
        for message in track:
            tick += message.time
            if message.type == "note_on" and message.velocity > 0:
                actual_on[message.channel,tick,message.note,message.velocity] += 1
            elif message.type == "note_off" or message.type == "note_on" and message.velocity == 0:
                actual_off[message.channel,tick,message.note] += 1
    if actual_on != expected_on or actual_off != expected_off:
        raise ValueError(f"MIDI differs from the shared note events: {name}")
    result = subprocess.run(["ffmpeg","-hide_banner","-nostdin","-i",str(audio),
        "-af","astats=metadata=0:reset=0","-f","null","-"], capture_output=True,text=True,timeout=40,check=True)
    summary = result.stderr.rsplit("Overall",1)[-1]
    def number(label):
        match = re.search(re.escape(label) + r":\s*([-+0-9.einf]+)",summary)
        return float(match[1]) if match else None
    rms, peak = number("RMS level dB"), number("Peak level dB")
    if rms is None or rms < -65:
        raise ValueError(f"Silent or invalid decoded audition: {name}")
    return {"id":name,"seconds":checked["seconds"],"sha256":checked["sha256"],
            "rmsDb":rms,"peakDb":peak,"noteOns":sum(actual_on.values()),"midiMatchesScore":True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--round",type=int,default=1)
    parser.add_argument("--wait",action="store_true")
    args = parser.parse_args()
    if not 1 <= args.round <= 99:
        parser.error("round must be 1-99")
    folder = ROOT / "webapp/runtime/arrangement-review" / f"round-{args.round:02d}"
    manifest = json.loads((folder / "manifest.json").read_text())
    last = -1
    while True:
        ready = sum((folder / "audio" / (item["id"] + ".mp3")).is_file()
                    and (folder / "checks" / (item["id"] + ".json")).is_file() for item in manifest["items"])
        if ready != last:
            print(f"Final audio ready: {ready}/{len(manifest['items'])}",flush=True)
            last = ready
        if ready == len(manifest["items"]):
            break
        if not args.wait:
            raise SystemExit("Wait for the browser effects pass to finish.")
        time.sleep(2)
    with ThreadPoolExecutor(max_workers=3) as pool:
        reports = list(pool.map(lambda item:check_clip(folder,item),manifest["items"]))
    report = {"round":args.round,"clips":len(reports),"allMidiMatchScore":True,"audio":reports,
              "positivePeakCount":sum(item["peakDb"] > 0 for item in reports),"sourceFingerprints":manifest["fingerprints"]}
    (folder / "quality-report.json").write_text(json.dumps(report,indent=2))
    readme = """ARRANGEMENT LISTENING REVIEW

64 arrangements, each in C Major and C Minor: 128 MP3 auditions and 128 MIDI files.
Every audition covers 16 bars plus the sound tails. All nine instrument parts are active.
Tempo follows each family's midpoint. Visual features are fixed, and the family's GEMS
profile controls the FM sounds. This is a controlled listening test, without image-region gating.

Audio uses the project's current note generator, FM AudioWorklet DSP, and native Web Audio
reverb/chorus/delay/master graph. An export limiter provides peak headroom before MP3 encoding.
MIDI contains the same note events, tempo and nine instrument channels. An external player
needs its own instruments and effects, so its timbre can differ from the MP3 recording.

HOW TO REVIEW
Open http://127.0.0.1:8766/review while the local review service is running.
Use Keep or Redo for each mode, and add a note if helpful. Decisions are saved locally.
Export feedback makes a portable JSON copy. Tell Codex when you are ready for the next round.
Earlier rounds remain on disk. Accepted recordings are not overwritten.

If the page stops opening, double-click Review Arrangements.command in the project folder.
You can also listen to these MP3 files directly, or import the MIDI files into your host.

This first round preserves the current harmony rules, including their known limitations.
Technical checks verify audio integrity and note/timing export; musical approval is your decision.
"""
    is_genre_round = manifest["conditions"].get("library") == "CC0 source MIDI"
    if is_genre_round:
        readme = """GENRE LISTENING REVIEW

64 source MIDI arrangements, each in C Major and C Minor. Each covers eight bars
plus audio tails. Original musical parts play together on the same clock, using
separate FM sound designs by genre. Some MIDI channels are empty by design.

The manifest identifies the author, original MIDI link, license, source excerpt
and any parts added by this project. GENRE_MIDI.md documents the adaptations.
MIDI note, timing and velocity data match the shared playback score. The FM
sounds and effects are in the stereo audio, not embedded in the MIDI file.

Open http://127.0.0.1:8766/review to listen and mark Keep or Redo.
Round 1 remains available at /review?round=1. Region gating is off in both
auditions so you can compare their instrumentation and mix.
"""
    if manifest["conditions"].get("performance"):
        readme += """
Round 4 is shared with the live artwork app. Major and Minor have distinct
rhythm, phrasing and orchestration. Effects combine genre and instrument
settings with scripted visual cues. Region gating is disabled for auditioning.
Dubstep has redesigned bass and drums. 2-Step Garage replaces Electro Rock.
"""
    elif manifest["conditions"].get("production"):
        readme += """
Round 3 adds four contrasting sections to each excerpt, track and rhythm
edits described on each card, moving mix and synthesis controls, and new
per-instrument sound designs. Previous round recordings remain separate.
"""
    archive = folder / f"auditions-round-{args.round:02d}.zip"
    temporary = archive.with_suffix(".zip.tmp")
    with zipfile.ZipFile(temporary,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=3) as bundle:
        bundle.writestr("README.txt",readme)
        bundle.writestr("manifest.json",json.dumps(manifest,indent=2))
        if is_genre_round:
            bundle.write(ROOT / "GENRE_MIDI.md","GENRE_MIDI.md")
        bundle.writestr("quality-report.json",json.dumps(report,indent=2))
        for item in manifest["items"]:
            title = item["name"] + " - " + item["mode"].title()
            bundle.write(folder / "audio" / (item["id"] + ".mp3"),"Audio/"+item["familyName"]+"/"+title+".mp3")
            bundle.write(folder / "midi" / (item["id"] + ".mid"),"MIDI/"+item["familyName"]+"/"+title+".mid")
    temporary.replace(archive)
    print(f"Verified {len(reports)} stereo clips and their MIDI. Peak warnings: {report['positivePeakCount']}.",flush=True)
    print(archive,flush=True)


if __name__ == "__main__":
    main()
