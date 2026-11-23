#!/usr/bin/env python3
"""Extract one-bar rhythm candidates from the source MIDI files used by the project."""
import argparse
from collections import defaultdict
import csv
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tarfile
import zipfile

import mido
from build_genre_templates import ROOT, CACHE, OGA, SOURCES, read_tracks

GROOVE = ROOT / "third_party/groove/groove"
GROOVE_URL = "https://magenta.withgoogle.com/datasets/groove"
CYBERDECK_URL = "https://cyberculture.pt/en/machine"
NRG_URL = "https://zenodo.org/records/15304989"
BANDS = ("sparse", "medium", "dense")
ROLES = ("drums", "bass", "counter_synth", "guitar", "pad", "organ", "keys_mallet", "percussion_texture")
KIT = {35: 36, 36: 36, 37: 39, 38: 38, 40: 38, 42: 42, 44: 42, 46: 46, 22: 42, 26: 46}
PERCUSSION = {37: 37, 42: 42, 44: 42, 43: 45, 45: 45, 47: 47, 48: 47, 50: 47}
candidates = defaultdict(list)


def note(beat, duration, velocity, **fields):
    start = round(beat, 6)
    return dict(beat=start, duration=round(min(duration, 4 - start), 6), velocity=velocity, **fields)


def bars(notes):
    result = defaultdict(list)
    for onset, duration, pitch, velocity in sorted(notes):
        bar = int(onset // 4)
        result[bar].append((onset % 4, duration, pitch, velocity))
    return result


def density(count, sparse_max, medium_max):
    return BANDS[0 if count <= sparse_max else 1 if count <= medium_max else 2]


def add(role, band, source, bar, events, adaptation):
    events = sorted((event for event in events if event["duration"] > 0), key=lambda e: e["beat"])
    if not events:
        return
    source = {**source, "bar": bar + 1, "adaptation": adaptation}
    candidates[role, band].append({"role": role, "densityBand": band, "lengthBeats": 4,
        "title": f'{Path(source["file"].split(" track ")[0]).stem} · bar {bar + 1}',
        "source": source, "events": events})


def source_info(title, url, license_name, filename, raw, **details):
    return {"title": title, "url": url, "license": license_name, "file": filename,
        "sha256": sha256(raw).hexdigest(), **details}


def read_groove():
    with (GROOVE / "info.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        style = row["style"].split("/")[0]
        if row["time_signature"] != "4-4" or row["beat_type"] != "beat" or style not in {
            "funk", "soul", "dance", "breakbeat", "hiphop", "rock", "afrobeat", "latin",
        }:
            continue
        filename = row["midi_filename"]
        raw = (GROOVE / filename).read_bytes()
        midi = mido.MidiFile(file=BytesIO(raw))
        tick = 0
        hits = defaultdict(list)
        for message in mido.merge_tracks(midi.tracks):
            tick += message.time
            if message.type == "note_on" and message.velocity:
                beat = tick / midi.ticks_per_beat
                bar = int((beat + .04) // 4)
                hits[bar].append((max(0, beat - bar * 4), message.note, message.velocity))
        source = source_info("Google Magenta Groove MIDI Dataset", GROOVE_URL, "CC BY 4.0",
            filename, raw, style=row["style"], originalBpm=int(row["bpm"]))
        for bar in range(2, min(max(hits, default=0), 16)):
            hits_here = hits[bar]
            kit = [(beat, KIT[pitch], velocity) for beat, pitch, velocity in hits_here if pitch in KIT]
            count = len({round(beat * 4) for beat, _, _ in kit})
            if 4 <= count <= 13 and any(beat < .12 and pitch == 36 for beat, pitch, _ in kit) and any(
                pitch in (38, 39) and velocity >= 65 for _, pitch, velocity in kit
            ):
                add("drums", density(count, 6, 9), source, bar,
                    [note(beat, .12, velocity, note=pitch) for beat, pitch, velocity in kit],
                    "Kit hits rebinned at the recorded downbeat and mapped to the project drum voices.")
            texture = [(beat, PERCUSSION[pitch], velocity) for beat, pitch, velocity in hits_here if pitch in PERCUSSION]
            count = len({round(beat * 4) for beat, _, _ in texture})
            if 3 <= count <= 14 and any(pitch != 42 for _, pitch, _ in texture):
                add("percussion_texture", density(count, 4, 8), source, bar,
                    [note(beat, .12, min(105, velocity), note=pitch) for beat, pitch, velocity in texture],
                    "Isolated rim, tom and hat notes with the original placements.")
            if style == "funk":
                kicks = {min(3.75, round(beat * 4) / 4): velocity
                    for beat, pitch, velocity in kit if pitch == 36}
                if 3 <= len(kicks) <= 10 and 0 in kicks:
                    add_bass(list(kicks.items()), source, bar, "Funk kick onsets mapped to the bass voice.")


def add_bass(kicks, source, bar, adaptation):
    kicks = sorted(kicks)
    events = [note(beat, min(.56, (kicks[i + 1][0] - beat) * .85) if i + 1 < len(kicks) else .40,
        velocity, chordDegree=0) for i, (beat, velocity) in enumerate(kicks)]
    add("bass", density(len(events), 4, 6), source, bar, events, adaptation)


def read_cyberdeck():
    with zipfile.ZipFile(CACHE / "cyberculture.zip") as archive:
        for filename in sorted(archive.namelist()):
            if not filename.endswith(".mid"):
                continue
            raw = archive.read(filename)
            parts, bpm = read_tracks(raw, {1: "bass", 2: "counter_synth"}, 1)
            for role, track, track_notes in (("bass", 1, parts["bass"]), ("counter_synth", 2, parts["counter_synth"])):
                source = source_info("Cyberculture Cyberdeck", CYBERDECK_URL, "CC0 1.0",
                    f"{filename} track {track}", raw, originalBpm=bpm)
                for bar, events in bars(track_notes).items():
                    groups = {beat: (duration, pitch, velocity) for beat, duration, pitch, velocity in events}
                    if not 3 <= len(groups) <= 15:
                        continue
                    if role == "bass" and 0 in groups:
                        add_bass([(beat, min(115, event[2])) for beat, event in groups.items()], source, bar,
                            "Sequenced bass onset and accent pattern, with chord-relative pitch at playback.")
                    if role == "counter_synth":
                        add_arp(source, bar, groups)


def add_arp(source, bar, groups):
    if not 3 <= len(groups) <= 16:
        return
    pitches = sorted({pitch for _, pitch, _ in groups.values()})
    degrees = (0, 2, 4, 7)
    add("counter_synth", density(len(groups), 5, 9), source, bar, [
        note(beat, min(length, .55), velocity,
            chordDegree=degrees[round(pitches.index(pitch) * 3 / max(1, len(pitches) - 1))])
        for beat, (length, pitch, velocity) in groups.items()],
        "Sequencer rhythm and relative contour remapped to the current chord.")


def chord_parts(role, bar, events, source):
    groups = defaultdict(list)
    for beat, duration, pitch, velocity in events:
        groups[round(beat * 12) / 12].append((duration, pitch, velocity))
    groups.pop(4, None)
    if not groups:
        return
    count = len(groups)
    if role == "organ":
        if count > 2 or (count == 2 and all(beat % 1 < .20 for beat in groups)):
            return
        shortest = min(duration for tones in groups.values() for duration, _, _ in tones)
        band = "sparse" if count == 1 else "dense" if shortest < .32 else "medium"
        material = []
        for beat, tones in groups.items():
            if len(tones) < 2:
                return
            for duration, pitch, velocity in sorted(tones, key=lambda row: row[1])[:3]:
                material.append(note(beat, min(.52, duration), velocity, previewNote=pitch))
        add(role, band, source, bar, material, "Chord attacks kept, with durations shortened for FM Organ.")
        return
    limits = {"pad": (1, 2, 4), "keys_mallet": (2, 5, 10), "guitar": (2, 5, 12)}
    sparse, medium, maximum = limits[role]
    if count > maximum or (role == "pad" and max(d for d, _, _ in sum(groups.values(), [])) < .60):
        return
    band = density(count, sparse, medium)
    add(role, band, source, bar, [
        note(beat, duration, velocity, previewNote=pitch)
        for beat, tones in groups.items()
        for duration, pitch, velocity in sorted(tones, key=lambda row: row[1])[:4]
    ], "Onsets, lengths and velocities from the MIDI. Pitches guide chord voicing at playback.")


def read_chords(nrg_path):
    with tarfile.open(nrg_path, "r|gz") as archive:
        for index, item in enumerate(entry for entry in archive if entry.name.endswith(".mid")):
            if index % 9:
                continue
            raw = archive.extractfile(item).read()
            parts, bpm = read_tracks(raw, {1: "chords"}, 1)
            source = source_info("WaivOps and Patchbanks NRG-CP", NRG_URL, "CC BY 4.0",
                item.name, raw, originalBpm=bpm)
            for bar, events in bars(parts["chords"]).items():
                for role in ("organ", "pad", "keys_mallet", "guitar"):
                    chord_parts(role, bar, events, source)

    for filename, role, track in [
        ("xenon_phoenix.mid", "guitar", 3), ("junglequick.mid", "guitar", 7),
        ("derelict_0.mid", "keys_mallet", 1), ("junglequick.mid", "keys_mallet", 6),
        ("menu_loop.mid", "pad", 3),
        ("xenon_phoenix.mid", "counter_synth", 9), ("empacotatron.mid", "counter_synth", 0),
    ]:
        title, artist, slug, _, _, _, factor = SOURCES[filename]
        raw = (CACHE / filename).read_bytes()
        parts, bpm = read_tracks(raw, {track: role}, factor)
        source = source_info(f"{title} by {artist}", f"{OGA}/content/{slug}", "CC0 1.0",
            f"{filename} track {track}", raw, originalBpm=bpm)
        for bar, events in bars(parts[role]).items():
            if role == "counter_synth":
                groups = {beat: (duration, pitch, velocity) for beat, duration, pitch, velocity in events}
                add_arp(source, bar, groups)
            else:
                chord_parts(role, bar, events, source)


def fingerprint(clip):
    percussive = clip["role"] in ("drums", "percussion_texture")
    step = 8 if clip["role"] == "organ" else 4
    length_step = 8 if clip["role"] == "organ" else 2
    return {(round(event["beat"] * step), event.get("note") if percussive
        else round(event["duration"] * length_step)) for event in clip["events"]}


def existing_clips():
    code = """import pool from './webapp/static/midi-candidate-pool.mjs';
import {addedClips} from './webapp/static/phrase-expansion.mjs';
process.stdout.write(JSON.stringify([...pool.clips, ...addedClips]));"""
    return json.loads(subprocess.check_output(["node", "--input-type=module", "-e", code], cwd=ROOT))


def select_clips():
    existing = existing_clips()
    result = []
    used_bars = {(clip["source"].get("file"), clip["source"].get("bar")) for clip in existing}
    for role in ROLES:
        known = [clip for clip in existing if clip["role"] == role]
        used = {clip["source"].get("file") for clip in known}
        full = [fingerprint(clip) for clip in known]
        for band in BANDS:
            choices = [(fingerprint(clip), clip) for clip in candidates[role, band]]
            print(role, band, len(choices))
            for index in range(4):
                options = [(fp, clip) for fp, clip in choices if fp not in full
                    and (clip["source"]["file"], clip["source"]["bar"]) not in used_bars]
                def rating(item):
                    fp, clip = item
                    difference = min((1 - len(fp & other) / len(fp | other) for other in full), default=1)
                    new_file = .2 if clip["source"]["file"] not in used else 0
                    guitar_track = .25 if role == "guitar" and clip["source"]["url"].startswith(OGA) else 0
                    return difference + new_file + guitar_track
                if not options:
                    raise ValueError(f"Need more distinct material for {role} {band}")
                fp, clip = max(options, key=rating)
                full.append(fp)
                used.add(clip["source"]["file"])
                used_bars.add((clip["source"]["file"], clip["source"]["bar"]))
                result.append({"id": f"{role}-source-{band}-{index + 1}", **clip})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("nrg_archive", type=Path, help="WaivOps NRG-CP MIDI tarball from Zenodo")
    args = parser.parse_args()
    read_groove()
    read_cyberdeck()
    read_chords(args.nrg_archive)
    clips = select_clips()
    target = ROOT / "webapp/static/rhythm-pool-expansion.mjs"
    body = ",\n".join("  " + json.dumps(clip, ensure_ascii=False, separators=(",", ":")) for clip in clips)
    target.write_text("// Generated by scripts/build_rhythm_pool_expansion.py.\n"
        f"export const expandedRhythmClips = [\n{body}\n];\n", encoding="utf-8")
    print(f"Wrote {len(clips)} one-bar candidates to {target}")


if __name__ == "__main__":
    main()
