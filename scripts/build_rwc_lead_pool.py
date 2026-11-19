#!/usr/bin/env python3
"""Extract four-bar vocal phrases using the RWC Pop melody, key, beat and chord annotations."""
import argparse
from bisect import bisect_right
import csv
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SCALES = {"major": {0, 2, 4, 5, 7, 9, 11}, "minor": {0, 2, 3, 5, 7, 8, 10}}
PITCHES = dict(zip("C D E F G A B".split(), (0, 2, 4, 5, 7, 9, 11)))
SOURCE = "https://github.com/instr3/rwc-pop-annotations"
BEATS = "https://github.com/rwc-music/rwc-annotations"
LICENSE = "https://creativecommons.org/licenses/by-nc/4.0/"


def pitch_class(name):
    return (PITCHES[name[0]] + name.count("#") - name.count("b")) % 12


def table(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file, delimiter=";"))


def lab(path):
    return [line.split() for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def intervals(rows):
    return [(float(row[0]), float(row[1]), row[2:]) for row in rows]


def beat_at(time, times):
    index = min(len(times) - 2, max(0, bisect_right(times, time) - 1))
    return index + (time - times[index]) / (times[index + 1] - times[index])


def phrase_key(keys, start, end):
    # Identical labels can be divided into multiple consecutive segments.
    relevant = {
        (pitch_class(tonic), mode)
        for lo, hi, (tonic, mode) in keys if mode in SCALES and hi > start + .08 and lo < end - .08
    }
    return next(iter(relevant)) if len(relevant) == 1 else None


def source_chord(chords, starts, time, tonic):
    index = bisect_right(starts, time) - 1
    if index < 0 or time >= chords[index][1]:
        return None
    match = re.match(r"^([A-G][b#]*):([a-z]+)", chords[index][2])
    if not match:
        return None
    root, quality = match.groups()
    if quality not in {"maj", "min", "dim", "aug", "sus", "hdim"}:
        return None
    return [(pitch_class(root) - tonic) % 12, quality]


def extract_song(row, rwc, vocals):
    piece = row["RWCID"]
    song = int(row["PieceNo"])
    cache = rwc / "01_annotations_preprocessed"
    beats = table(cache / "beats/RWC-P" / (piece + ".csv"))
    times = [float(beat["t"]) for beat in beats]
    numbers = [int(beat["beat"]) for beat in beats]
    path = vocals / "melody/vocal" / f"{song - 1:03d}.lab"
    notes = sorted((lo, hi, int(pitch[0])) for lo, hi, pitch in intervals(lab(path)))
    note_starts = [lo for lo, _, _ in notes]
    keys = intervals(lab(vocals / "key" / f"RM-P{song:03d}.lab"))
    chord_rows = table(cache / "chords/RWC-P" / (piece + ".csv"))
    chords = [(float(c["t_start"]), float(c["t_end"]), c["chord"]) for c in chord_rows]
    chord_starts = [c[0] for c in chords]
    for first in range(0, len(times) - 16):
        if numbers[first:first + 17] != [1, 2, 3, 4] * 4 + [1]:
            continue
        start, end = times[first], times[first + 16]
        key = phrase_key(keys, start, end)
        if not key:
            continue
        tonic, mode = key
        idx = bisect_right(note_starts, start - .03)
        stop = bisect_right(note_starts, end - .055)
        segment = notes[idx:stop]
        if not 6 <= len(segment) <= 42 or (idx and notes[idx - 1][1] > start + .14):
            continue
        if segment[-1][1] > end + .24:
            continue

        # Apply one octave shift to the entire phrase; transpose by intervals from the tonic.
        center = sorted(note for _, _, note in segment)[len(segment) // 2]
        source_tonic = tonic + 12 * round((center - tonic) / 12)
        events = []
        for i, (lo, hi, note) in enumerate(segment):
            onset = max(0.0, round(beat_at(lo, times) - first, 3))
            next_start = segment[i + 1][0] if i + 1 < len(segment) else end
            duration = round(min(16 - onset, beat_at(min(hi, next_start), times) - first - onset), 3)
            if duration < .07 or note < 40 or note > 90:
                break
            events.append([onset, duration, note - source_tonic])
        if len(events) != len(segment) or len({event[2] for event in events}) < 3:
            continue
        if max(e[2] for e in events) - min(e[2] for e in events) > 19:
            continue
        if any(offset % 12 not in SCALES[mode] for _, _, offset in events):
            continue
        if (len({int(event[0] // 4) for event in events}) < 3 or events[0][0] >= 2.5
                or events[-1][0] + events[-1][1] < 12.5
                or sum(duration for _, duration, _ in events) < 4.0):
            continue
        if max(b[0] - a[0] - a[1] for a, b in zip(events, events[1:])) > 5:
            continue

        band = "sparse" if len(events) <= 13 else "medium" if len(events) <= 22 else "dense"
        original = [
            source_chord(chords, chord_starts, (times[first + bar * 4 + 1] + times[first + bar * 4 + 2]) / 2, tonic)
            for bar in range(4)
        ]
        yield {
            "id": f"rwc-p{song:03d}-beat{first + 1}",
            "title": row["Title"],
            "mode": mode,
            "densityBand": band,
            "source": {
                "track": piece,
                "artist": row["Artist"],
                "composer": row["Composer"] or None,
                "startSeconds": start,
                "endSeconds": end,
                "startBeat": first + 1,
                "key": next(label for lo, hi, label in keys
                            if hi > start + .08 and lo < end - .08 and label[1] == mode
                            and pitch_class(label[0]) == tonic),
                "chords": original,
                "melodyFile": f"melody/vocal/{song - 1:03d}.lab",
            },
            "events": events,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rwc", type=Path, default=ROOT / "third_party/rwc-annotations")
    parser.add_argument("--vocals", type=Path, default=ROOT / "third_party/rwc-pop-annotations")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    metadata = table(args.rwc / "metadata.csv")
    phrases = []
    # The vocal annotations flag two alignment outliers without settling whether the IDs are zero- or one-based.
    alignment_outliers = {"RWC_P063", "RWC_P064", "RWC_P098", "RWC_P099"}
    for row in metadata:
        if row["CollID"] != "P" or row["RWCID"] in alignment_outliers:
            continue
        phrases.extend(extract_song(row, args.rwc, args.vocals))
    output = {"melodyAnnotations": SOURCE, "beatAndChordAnnotations": BEATS,
              "license": LICENSE, "phrases": phrases}
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Extracted {len(phrases)} four-bar phrases from {len({p['source']['track'] for p in phrases})} songs.")


if __name__ == "__main__":
    main()
