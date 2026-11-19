#!/usr/bin/env python3
"""Build the offline arrangement library from attributed, pinned source material.

Run with .interaction-env/bin/python scripts/build_music_templates.py.
Downloads go in ignored third_party/. The app only ships the derived JS asset.
No model training, audio samples, or additional runtime dependencies are needed.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import runpy
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import mido

ROOT = Path(__file__).resolve().parents[1]
THIRD = ROOT / "third_party"
GMD_SHA = "651cbc524ffb891be1a3e46d89dc82a1cecb09a57c748c7b45b844c4841dcc1e"
SHLD_COMMIT = "95533fae2c1a2aae032211b9abed0441ac8ba298"
DIMENSIONS = "wonder transcendence tenderness nostalgia peacefulness power joyful_activation tension sadness".split()
ROLES = "lead_synth counter_synth drums bass guitar pad strings keys_mallet percussion_texture".split()

# Musical families are authored design choices, not extra emotion categories.
# Every prototype uses the complete, unchanged GEMS-9 coordinate system.
FAMILIES = [
    ("acid_drive", "Acid Drive", [112, 144], [.03,.02,.01,.02,.01,.40,.16,.32,.03], ["dance/disco", "dance/breakbeat"], "acid", [.18,.20,.28]),
    ("electro_breaks", "Electro Breaks", [100, 138], [.08,.02,.01,.04,.01,.28,.18,.32,.06], ["dance/breakbeat", "funk"], "broken", [.22,.22,.42]),
    ("glass_pop", "Glass Pop", [100, 140], [.34,.02,.15,.03,.04,.05,.34,.02,.01], ["pop", "dance/disco"], "pop", [.34,.42,.35]),
    ("garage_motion", "Garage Motion", [112, 140], [.09,.02,.04,.12,.02,.12,.52,.05,.02], ["funk", "dance/breakbeat"], "garage", [.26,.32,.42]),
    ("slow_bloom", "Slow Bloom", [64, 100], [.06,.08,.38,.12,.28,.01,.01,.01,.05], ["soul", "pop/soft"], "slow", [.60,.52,.18]),
    ("dream_circuit", "Dream Circuit", [76, 114], [.23,.43,.05,.06,.18,.01,.01,.01,.02], ["pop/soft", "soul"], "dream", [.66,.58,.40]),
    ("dark_pulse", "Dark Pulse", [90, 128], [.02,.03,.01,.05,.02,.12,.01,.43,.31], ["hiphop", "rock/halftime"], "dark", [.37,.18,.33]),
    ("halftime_drift", "Halftime Drift", [70, 108], [.05,.05,.08,.40,.12,.02,.02,.04,.22], ["hiphop", "soul"], "half", [.49,.38,.44]),
]

# Eight shared four-bar motifs. Lead and keys answer the same phrase; bass and
# arpeggio follow that phrase's current chord rather than an unrelated song.
MOTIFS = [[0,2,4,2,1,3,2,0], [0,0,3,4,2,1,2,0], [4,2,1,0,2,3,1,0],
          [0,1,4,3,2,4,2,1], [2,4,3,1,0,2,1,0], [0,3,2,4,1,0,2,0],
          [0,2,1,4,3,2,4,0], [4,3,1,2,0,1,2,0]]
CHORD_PATTERNS = ["pop", "pop2", "hiphop2", "basic2", "alt2", "long", "hiphop3", "soul"]


def acquire():
    THIRD.mkdir(exist_ok=True)
    archive = THIRD / "groove-midionly.zip"
    if not archive.exists():
        urllib.request.urlretrieve("https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip", archive)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == GMD_SHA, "GMD checksum differs"
    if not (THIRD / "groove/groove/info.csv").exists():
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(THIRD / "groove")
    repo = THIRD / "free-midi-chords"
    if not repo.exists():
        subprocess.run(["git", "clone", "https://github.com/ldrolez/free-midi-chords.git", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "checkout", SHLD_COMMIT], check=True)
    actual = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    if actual != SHLD_COMMIT:
        raise RuntimeError(f"Expected SHLD revision {SHLD_COMMIT}; found {actual}. Use that revision to rebuild.")
    return repo


def midi_bars(path):
    midi = mido.MidiFile(path)
    tick = 0
    bars = {}
    for message in mido.merge_tracks(midi.tracks):
        tick += message.time
        if message.type != "note_on" or message.velocity == 0:
            continue
        # Collapse TD-11 edge/head articulations to the project's Drum Rack notes.
        note = {36:36,38:38,40:38,37:39,42:42,22:42,44:42,46:46,26:46}.get(message.note)
        if note is None:
            continue
        beat = tick / midi.ticks_per_beat
        # Preserve the performed rhythm/accents, quantize microtiming to the
        # common sixteenth grid so all tracks share exactly one transport.
        step = int(math.floor(beat * 4 + .5))
        bar, pos = divmod(step, 16)
        hits = bars.setdefault(bar, {}).setdefault(pos, {})
        hits[note] = max(hits.get(note, 0), message.velocity)
    return bars


def extract_grooves():
    folder = THIRD / "groove/groove"
    rows = list(csv.DictReader((folder / "info.csv").open()))
    rows = [row for row in rows if row["beat_type"] == "beat" and row["time_signature"] == "4-4"]
    cache = {}
    result = {}
    for fid, _, bpm, _, styles, *_ in FAMILIES:
        ordered = sorted(rows, key=lambda row: (next((i for i,s in enumerate(styles) if row["style"].startswith(s)), 99), abs(float(row["bpm"]) - sum(bpm)/2), row["midi_filename"]))
        variants = []
        seen = set()
        for row in ordered:
            name = row["midi_filename"]
            if name not in cache:
                cache[name] = midi_bars(folder / name)
            bars = cache[name]
            # Start after the count-in. Prefer complete four-bar source phrases.
            for start in range(1, max(bars, default=0) - 2, 4):
                phrase = [bars.get(start+i, {}) for i in range(4)]
                if any(len(bar) < 3 for bar in phrase):
                    continue
                fingerprint = json.dumps(phrase, sort_keys=True)
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                variants.append({"bars": phrase, "file": name, "startBar": start + 1, "bpm": int(row["bpm"]), "style": row["style"], "sha256": hashlib.sha256((folder / name).read_bytes()).hexdigest()})
                break  # Different performances first, before reusing another phrase.
            if len(variants) == 8:
                break
        assert len(variants) == 8, fid
        result[fid] = variants
    return result


def e(at, duration, **kwargs):
    return {"at": round(at, 6), "duration": round(duration, 4), **kwargs}


def chord_rhythm(tokens):
    """Expand the MIT SHLD onset/rest pattern into four one-bar event lists."""
    events = [[] for _ in range(4)]
    position = 0.0
    while position < 16 - 1e-6:
        for token in tokens:
            match = re.fullmatch(r"([0-9.]*)([NSX])", token)
            duration = float(match[1] or 1)
            if position >= 16:
                break
            if match[2] != "X":
                events[int(position // 4)].append(e(position % 4, min(duration*.87, 4-position%4), kind="chord"))
            position += duration
    return events


def patterns_for(family, version, groove, chord_patterns):
    fid, _, _, _, _, style, _ = family
    family_index = next(i for i,item in enumerate(FAMILIES) if item[0] == fid)
    result = {role: [] for role in ROLES}
    rhythm_name = CHORD_PATTERNS[version]
    chord_hits = chord_rhythm(chord_patterns[rhythm_name])
    busy = style in ("acid", "broken", "garage")
    slow = style in ("slow", "dream", "half")
    for bar, raw in enumerate(groove["bars"]):
        hits = {int(step): dict(notes) for step,notes in raw.items()}
        if style == "acid":
            # Adapt GMD hats/snare to a coherent four-on-the-floor foundation.
            for notes in hits.values():
                notes.pop(36, None)
            for step in (0,4,8,12):
                hits.setdefault(step, {})[36] = 108 if step in (0,8) else 100
        elif style in ("dark", "half"):
            # Deliberate half-time backbeat, retaining the source kick/hat phrase.
            for notes in hits.values():
                notes.pop(38, None)
            hits.setdefault(8, {})[38] = 104
        result["drums"].append([e(step/4, .14, notes=sorted(notes), velocityGain=round(sum(notes.values())/len(notes)/100, 3)) for step,notes in sorted(hits.items()) if notes])
        kicks = sorted(step for step,notes in hits.items() if 36 in notes)
        # Bass and arp are authored together with this groove. Acid Banger's
        # weighted root repetition + independent accent/glide informs this part;
        # its chromatic note sets/random global retuning are deliberately absent.
        bass_steps = list(range(16)) if style == "acid" else sorted(set(kicks + ([2,6,10,14] if busy else [0,8,14] if not slow else [0,6,10])))
        bass = []
        for i,step in enumerate(bass_steps):
            tone = [0,0,1,3,0,2,0,1][(i+version+family_index+(bar%2)*2)%8]
            slide = i > 0 and step - bass_steps[i-1] == 1 and (step+version)%4 == 3
            joins = i+1 < len(bass_steps) and bass_steps[i+1]-step == 1 and (bass_steps[i+1]+version)%4 == 3
            length = .44 if joins else .215 if busy else .7 if slow else .38
            bass.append(e(step/4, length, kind="acid", tone=tone, accent=step in kicks, slide=slide))
        result["bass"].append(bass)
        arp_step = .25 if busy else .5 if not slow else (2/3 if version%2 else 1)
        arp_times = [i*arp_step for i in range(math.ceil(4/arp_step))]
        arp_contour = [0,2,1,3,4,2,1,2] if version%2 == 0 else [4,2,1,0,3,1,2,4]
        result["counter_synth"].append([e(t, arp_step*.85, kind="arp", tone=arp_contour[(i+version+family_index+bar)%8], accent=i%4==0) for i,t in enumerate(arp_times)])
        # One call / answer grid shared by lead, guitar and keys; sustained parts
        # leave space underneath rather than all retriggering on every onset.
        lead_times = ([0,.75,2,2.75] if bar%2==0 else [.5,1.5,3.25]) if not slow else ([0,2.5] if bar%2==0 else [1,3])
        if version%3 == 1:
            lead_times = [0,2/3,2,3+1/3] if bar%2==0 else [1,2.5]
        elif version%3 == 2:
            lead_times = [0,1.5,3.5] if bar%2==0 else [.75,2.25,3]
        result["lead_synth"].append([e(t, min(1.4 if slow else .65, (lead_times[i+1]-t)*.8 if i+1<len(lead_times) else .38), degree=MOTIFS[version][(i+bar*2)%8]) for i,t in enumerate(lead_times)])
        result["guitar"].append(chord_hits[bar] or [e(2.5,.6,kind="chord")])
        result["keys_mallet"].append([e(t,.7 if slow else .35, degree=MOTIFS[version][(i+bar*2+4)%8], kind="chord" if (i+bar+version)%3==0 else "note") for i,t in enumerate(([1.5,3.5] if bar%2==0 else [0,2.5]))])
        result["pad"].append([e(0,3.85,kind="chord")])
        result["strings"].append([e(.5 if bar%2 else 0,3.35 if bar%2 else 3.85,kind="chord")])
        result["percussion_texture"].append([e(t,.12,notes=[note]) for t,note in ([([.75,2.75][bar%2],37),(3.5,39)] if busy else [(3.5 if bar%2 else 1.5,37)])])
    return result


def main():
    repo = acquire()
    chord_source = runpy.run_path(str(repo / "chords.py"))
    pattern_source = runpy.run_path(str(repo / "src/chords2midi/c2mpatterns.py"))["patterns"]
    # Only plain diatonic degree sequences are transposed into the visitor's
    # selected mode. Quality/extensions stay in the common voice-leading layer.
    progressions = {}
    numerals = {"i":1,"ii":2,"iii":3,"iv":4,"v":5,"vi":6,"vii":7}
    for mode,key in (("major","prog_maj"),("minor","prog_min")):
        pool = []
        for entry in chord_source[key]:
            tokens = entry.split("=")[0].strip().split()
            if len(tokens)==4 and all(token.lower() in numerals for token in tokens):
                pool.append({"name":"–".join(tokens),"degrees":[numerals[token.lower()] for token in tokens]})
        progressions[mode] = pool
    grooves = extract_grooves()
    templates = []
    families = []
    for family_index, family in enumerate(FAMILIES):
        fid,name,bpm,prototype,_,style,fx = family
        families.append({"id":fid,"name":name,"bpmRange":bpm,"gems":dict(zip(DIMENSIONS,prototype))})
        for version in range(8):
            source = grooves[fid][version]
            p = {mode:[pool[(version*3+family_index*2)%len(pool)],pool[(version*3+family_index*2+5)%len(pool)]] for mode,pool in progressions.items()}
            templates.append({"id":f"{fid}_{version+1:02d}","familyId":fid,"name":f"{name} {version+1:02d}","version":version+1,"bpmRange":bpm,"barsPerChord":2 if style in ("slow","dream") else 1,
                "progressions":p,"motif":MOTIFS[version],"chordRhythm":CHORD_PATTERNS[version],
                "fx":{"reverb":round(fx[0]+(version%3-1)*.04,3),"chorus":round(fx[1]+(version%4-1.5)*.025,3),"delay":round(fx[2]+(version%2-.5)*.06,3),"delayBeats":[.75,.5,1,.75][version%4]},
                "color":{"brightness":round((family_index%3-1)*.07+(version%4-1.5)*.025,3),"attack":.06 if style in ("slow","dream") else -.02,"release":.08 if style in ("slow","dream") else -.03},
                "grooveSource":{key:value for key,value in source.items() if key!="bars"},
                "patterns":patterns_for(family,version,source,pattern_source)})
    assert len(templates)==64
    assert len({json.dumps(t["patterns"],sort_keys=True) for t in templates})==64
    commit = subprocess.check_output(["git","-C",str(repo),"rev-parse","HEAD"],text=True).strip()
    data = {"schema":1,"families":families,"templates":templates,"sources":{"groove":{"url":"https://magenta.withgoogle.com/datasets/groove","license":"CC BY 4.0","archiveSha256":GMD_SHA},"chords":{"url":"https://github.com/ldrolez/free-midi-chords","license":"MIT","commit":commit},"acid":{"url":"https://github.com/vitling/acid-banger","license":"CC BY 4.0","use":"Design reference for root-weighted acid phrases, accents and slides; no samples copied."}}}
    asset = ROOT / "webapp/static/music-templates.js"
    asset.write_text("// Generated by scripts/build_music_templates.py. See MUSIC_MATERIALS.md for attribution.\nwindow.StreetArtTemplates = "+json.dumps(data,separators=(",",":"))+";\n")
    print(f"Built {len(templates)} arrangements, {len(families)} families, {asset.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
