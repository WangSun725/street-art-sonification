#!/usr/bin/env python3
"""Build the second listening library from independently published CC0 MIDI."""
from __future__ import annotations

from collections import defaultdict
import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
import mido

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "third_party/genre-midi"
OGA = "https://opengameart.org"
ROLES = "lead_synth counter_synth drums bass guitar pad strings keys_mallet percussion_texture".split()
GEMS = "wonder transcendence tenderness nostalgia peacefulness power joyful_activation tension sadness".split()
KITS = {35:36, 40:38, 44:42, 22:42, 26:46}
# URL and checksum apply to the upstream file, prior to any transformations.
FILES = {
    "cyberculture.zip":"4eac583777b180d262b5dc529983b93cdaa9003949eb1df283bb882a8b5ba8e1",
    "junglequick.mid":"a97bc7fbd1ea6109002f3ce85d27caea13389299cdb2d7dcb952c731934714d0",
    "menu_loop.mid":"ffd18404597fe248d269ef74f091eaf50618496e673955ae11b7028cb0fad92d",
    "empacotatron.mid":"2f68e55b57216c5515615a276b35ffe0808af11fdd7449597df3335bbe7921bc",
    "derelict_0.mid":"fd73980ab72d743d455bd2f016059e868a624ddc3366df841bc282a52a88f118",
    "9047c64style3.mid":"30589cbaf31786a35f7619494dedaf45b12cd361dbd6447ca115d063edc2c7ac",
    "9106c64rythymdrums4.mid":"e5576fd32d32fd08883fd8c6e0785e7346e44089d6d24f851bc7fe4bc8210023",
    "mechancial_golem.mid":"e10dcaaabb03fc456367d25e1730931fd62449d02e81ee38147d0aa78a59c470",
    "xenon_phoenix.mid":"c8d5e73c16a08f696ad70aff6b9fcbf9c2fd3164b68504042833419d9c5d9c77",
}
SOURCES = {
    "junglequick.mid":("Odd Style","Tozan","odd-style", {1:"bass",2:"counter_synth",3:"lead_synth",6:"keys_mallet",7:"guitar",8:"pad"},7,"major",2),
    "menu_loop.mid":("Menu Loop","Umplix","menu-loop-0", {1:"lead_synth",2:"bass",3:"pad",5:"drums",6:"percussion_texture"},0,"major",1),
    "empacotatron.mid":("Empacotatron","Fupi","empacotatron", {0:"lead_synth"},9,"minor",2),
    "derelict_0.mid":("Derelict","northivanastan","derelict", {1:"keys_mallet",2:"counter_synth",3:"guitar",4:"percussion_texture",5:"pad",6:"strings"},10,"minor",1),
    "9047c64style3.mid":("C64 Style 3","Tozan","midi-pack-1-24-new-tunes", {1:"lead_synth",2:"bass",3:"drums"},3,"minor",1),
    "9106c64rythymdrums4.mid":("C64 Rhythm Drums 4","Tozan","midi-pack-3-35-so-far", {1:"bass",2:"counter_synth",3:"drums",5:"lead_synth"},9,"minor",1),
    "mechancial_golem.mid":("Mechanical Golem","Umplix","mechanical-golem", {1:"lead_synth",2:"bass",3:"drums",4:"percussion_texture"},2,"minor",1),
    "xenon_phoenix.mid":("Xenon Phoenix (MIDI)","continuum.mid","xenon-phoenix", {1:"pad",3:"guitar",5:"lead_synth",6:"bass",7:"drums",9:"counter_synth"},0,"minor",1),
}
# These GEMS prototypes select music for the artwork. They are authored design
# mappings and are not emotion labels assigned to any of the source music.
FAMILIES = {
    "psytrance":("Psytrance", [138,152], [1,2,0,0,0,8,7,6,0], [.25,.17,.45,.75], "Rolling bass, acid accents, straight kick"),
    "techno":("Techno", [132,166], [1,0,0,0,0,7,2,9,1], [.18,.10,.22,.5], "Dry kick, cycling bass, short machine lead"),
    "jungle":("Jungle", [154,178], [2,0,1,3,0,5,9,3,0], [.29,.13,.21,.5], "Broken drums, syncopated bass and overlapping melodic lines"),
    "dubstep":("Dubstep", [116,142], [0,0,0,1,0,9,2,6,3], [.24,.11,.24,.75], "Half-time accents and filter-modulated bass"),
    "chiptune":("Chiptune", [108,155], [7,0,1,4,0,1,8,1,0], [.09,.04,.10,.5], "Pulse and square voices with short envelopes"),
    "dark_ambient":("Dark Ambient", [70,120], [1,7,3,2,8,0,0,3,8], [.86,.58,.54,1], "Slow, wide drones and sparse metallic attacks"),
    "synthwave":("Synthwave", [104,128], [4,2,3,9,2,4,3,1,2], [.47,.55,.30,.75], "Wide saw synths and steady electronic drums"),
    "electro_rock":("Electro Rock", [90,116], [1,1,1,4,0,8,4,5,4], [.30,.18,.18,.5], "Driven guitar-like lead, bass and live-kit feel"),
}
# Excerpt starts are in bars on the adapted beat grid. Each item retains
# aligned parts from the same source, with drums added only where noted below.
SECTIONS = {
    "techno":[("empacotatron.mid",b) for b in (0,4,8,12,16,20,24,32)],
    "jungle":[("junglequick.mid",b) for b in (0,3,6,9,12,15,18,21)],
    "dubstep":[("menu_loop.mid",b) for b in (12,18,23,30,36,48,57,68)],
    "chiptune":[(f,b) for f in ("9047c64style3.mid","9106c64rythymdrums4.mid") for b in (4,12,20,36)],
    "dark_ambient":[("derelict_0.mid",b) for b in (4,12,20,28,36,44,52,60)],
    "synthwave":[("mechancial_golem.mid",b) for b in (0,4,8,12,16,20,24,32)],
    "electro_rock":[("xenon_phoenix.mid",b) for b in (4,8,12,16,20,24,32,40)],
}
PSY = "goa/goa-anjuna.mid psy/psy-nightfilter.mid psy/psy-minor.mid fullon/fullon-sunrise.mid fullon/fullon-snap.mid progressive/prog-longroad.mid forest/forest-circuit.mid now/now-rolling.mid".split()
GARAGE_SEEDS = "proto/proto-ibiza.mid proto/proto-frankfurt.mid proto/proto-ritual.mid goa/goa-chai.mid goa/goa-ladder.mid progressive/prog-push.mid progressive/prog-grey.mid fullon/fullon-bounce.mid".split()
RANGES = {"lead_synth":(54,91),"counter_synth":(52,88),"bass":(30,54),"guitar":(44,85),"pad":(42,80),"strings":(49,83),"keys_mallet":(53,96)}
BAR_TICKS = 48  # Same 1/12-beat grid used by the interactive app.
BARS = 8
DRUMS = {"drums","percussion_texture"}


def get_file(name, url, expected):
    CACHE.mkdir(exist_ok=True, parents=True)
    path = CACHE / name
    if not path.exists():
        with urlopen(url,timeout=30) as response:
            path.write_bytes(response.read())
    contents = path.read_bytes()
    if sha256(contents).hexdigest() != expected:
        raise ValueError(f"Source checksum differs: {name}")
    return contents


def read_tracks(raw, mapping, factor):
    midi = mido.MidiFile(file=BytesIO(raw))
    output = defaultdict(list)
    tempo = next((msg.tempo for t in midi.tracks for msg in t if msg.type=="set_tempo"),500000)
    for index,role in mapping.items():
        tick = 0
        active = {}
        for msg in midi.tracks[index]:
            tick += msg.time
            if msg.type not in ("note_on","note_off"):
                continue
            key = msg.channel,msg.note
            old = active.pop(key,None)
            if old is not None:
                start, velocity = old
                output[role].append((start*factor/midi.ticks_per_beat, (tick-start)*factor/midi.ticks_per_beat, msg.note, velocity))
            if msg.type=="note_on" and msg.velocity:
                active[key] = tick,msg.velocity
    return output, round(mido.tempo2bpm(tempo)*factor)


def drums_for(family,version):
    """Companion drum machine parts for sources that did not publish drums."""
    result = []
    for bar in range(BARS):
        if family == "techno":
            parts = {36:[0,1,2,3],39:[1,3],42:[.5,1.5,2.5,3.5]}
            if (bar+version)%4==3: parts[46] = [3.75]
        else:
            kicks = ([0,2.5],[0,.75,2.5],[0,2.25,3.5],[0,1.75,2.75])
            parts = {36:kicks[(bar+version)%4],38:[1,3],42:[.25,.5,.75,1.5,2,2.25,3.25,3.75]}
            if bar%2: parts[38] = [1,2.75,3.5]
        for note,times in parts.items():
            result.extend((bar*4+beat,.13,note,105 if note==36 else 91 if note in (38,39) else 66+round(9*beat)%15) for beat in times)
    return result


def pitch_range(note,role,transpose=0):
    low,high = RANGES[role]
    note += transpose
    while note<low: note+=12
    while note>high: note-=12
    return note


def pack_patterns(tracks, start, family):
    output = {role:[[] for _ in range(BARS)] for role in ROLES}
    for role, notes in tracks.items():
        buckets = defaultdict(list)
        for at,duration,note,velocity in notes:
            # Preserve a held-in chord when a new excerpt begins.
            if at < start and at + duration > start and role not in DRUMS:
                duration -= start-at
                at = start
            tick = round((at-start)*12)
            if 0 <= tick < BARS*BAR_TICKS:
                buckets[tick].append((note,velocity,max(1,round(duration*12))))
        for tick,group in sorted(buckets.items()):
            bar, in_bar = divmod(tick,BAR_TICKS)
            pitches = sorted(set(KITS.get(n,n) if role in DRUMS else pitch_range(n,role) for n,_,_ in group))
            length = min(BARS*BAR_TICKS-tick, sorted(d for _,_,d in group)[len(group)//2])
            velocity = max(v for _,v,_ in group)
            if role == "bass" and family in ("psytrance","techno","synthwave","dubstep"):
                length = min(length,next((t-tick for t in range(tick+1,min(tick+length+1,BARS*BAR_TICKS)) if t in buckets),length))
            event = {"at":round(in_bar/12,6),"duration":round(length/12,6),
                     "notes" if role in DRUMS else "sourceNotes":pitches,
                     "sourceVelocity":velocity}
            if role == "bass" and family in ("psytrance","techno","synthwave","dubstep"):
                event["accent"] = velocity>=95
                event["slide"] = family in ("techno","synthwave") and in_bar%12 in (3,9)
            output[role][bar].append(event)
    return output


def prepare(garage):
    archive = get_file("cyberculture.zip","https://cyberculture.pt/static/midi/cyberculture-psy-patterns-cc0.zip",FILES["cyberculture.zip"])
    with ZipFile(BytesIO(archive)) as z:
        psy = {entry:z.read("cyberculture-psy-patterns/"+entry) for entry in PSY + (GARAGE_SEEDS if garage else [])}
    raw_sources = {name:get_file(name, OGA+"/sites/default/files/"+name,FILES[name]) for name in SOURCES}
    return psy,raw_sources


def build(garage=False):
    psy,raw_sources = prepare(garage)
    templates, families = [],[]
    families_to_build = dict(FAMILIES)
    if garage:
        del families_to_build["electro_rock"]
        families_to_build["garage_2step"] = (
            "2-Step Garage", [126,138], [2,0,2,4,1,2,8,1,1], [.22,.29,.38,.75],
            "Syncopated kicks, shuffled tops and short organ stabs",
        )
    for fid,(name,bpm_range,gems,fx,description) in families_to_build.items():
        families.append({"id":fid,"name":name,"bpmRange":bpm_range,"gems":dict(zip(GEMS,gems)),"description":description})
        archive_entries = PSY if fid == "psytrance" else GARAGE_SEEDS if fid == "garage_2step" else []
        for i, (filename,start) in enumerate([(f,0) for f in archive_entries] or SECTIONS[fid]):
            if archive_entries:
                raw = psy[filename]
                title = filename.split("/")[-1].removesuffix(".mid").replace("-"," ").title()
                author,url = "Cyberculture","https://cyberculture.pt/en/machine"
                mapping = {1:"bass",2:"counter_synth",3:"drums"}
                tracks,tempo = read_tracks(raw,mapping,1)
                tonic = max(set(n%12 for _,_,n,_ in tracks["bass"]),key=lambda pc:sum(n%12==pc for _,_,n,_ in tracks["bass"]))
                mode = "minor"
                # The pack publishes bass, acid and drums together. Its acid
                # notes are played by the counter role, not turned into chords.
                if not tracks["counter_synth"]:
                    raise ValueError(f"Expected acid track: {filename}")
                if fid == "garage_2step":
                    # Use the source's acid notes as a pitch seed for offbeat
                    # organ stabs, without importing its original drum pattern.
                    tracks["keys_mallet"] = []
                    for bar in range(BARS):
                        pitches = [note for at,_,note,_ in tracks["counter_synth"] if bar*4 <= at < bar*4+4]
                        if pitches:
                            for j, at in enumerate((.5, 2.25, 3.5)):
                                note = pitches[(j*3+bar) % len(pitches)]
                                tracks["keys_mallet"].append((bar*4+at,.30,note,92-j*5))
                    del tracks["counter_synth"]
                    tempo = 128 + 2 * (i % 4)
            else:
                raw = raw_sources[filename]
                title,author,slug,mapping,tonic,mode,factor = SOURCES[filename]
                url = OGA+"/content/"+slug
                tracks,tempo = read_tracks(raw,mapping,factor)
                if fid=="techno":
                    # The original MIDI is a single keyboard track; give its
                    # low-register part a dedicated instrument, without making
                    # up a new bass progression.
                    low = [event for event in tracks["lead_synth"] if event[2]<60]
                    tracks["bass"] = low
                    tracks["lead_synth"] = [event for event in tracks["lead_synth"] if event[2]>=60]
            patterns = pack_patterns(tracks,start*4,fid)
            supplemental = []
            if fid in ("techno","jungle"):
                patterns["drums"] = pack_patterns({"drums":drums_for(fid,i)},0,fid)["drums"]
                supplemental.append("drums")
            active = [role for role,bars in patterns.items() if any(bars)]
            if not any(r not in DRUMS for r in active):
                raise ValueError(f"Empty pitched excerpt: {fid} {i+1}")
            source = {"title":title,"author":author,"url":url,"license":"CC0 1.0",
                      "file":filename,"sha256":sha256(raw).hexdigest(),"startBar":start+1,"bars":BARS,
                      "sourceRoles":[r for r in active if r not in supplemental],
                      "supplementalRoles":supplemental}
            if archive_entries:
                source["downloadUrl"]="https://cyberculture.pt/static/midi/cyberculture-psy-patterns-cc0.zip"
            else:
                source["downloadUrl"]=OGA+"/sites/default/files/"+filename
            templates.append({"id":f"{fid}_{i+1:02}","familyId":fid,"name":f"{name} {i+1:02}",
                "version":i+1,"bpmRange":bpm_range,"previewBpm":max(bpm_range[0],min(bpm_range[1],tempo)),
                "source":source,"sourceTonic":tonic,"sourceMode":mode,"activeRoles":active,
                "patterns":patterns,"fx":dict(zip(("reverb","chorus","delay","delayBeats"),fx)),
                "color":{"brightness":0,"attack":0,"release":0}})
    seen = {}
    for t in templates:
        fingerprint = json.dumps(t["patterns"],sort_keys=True)
        if fingerprint in seen: raise ValueError(f"Duplicate source phrase: {t['id']} / {seen[fingerprint]}")
        seen[fingerprint] = t["id"]
    assert len(templates)==64
    return {"schema":2,"families":families,"templates":templates}


if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--garage", action="store_true")
    garage = parser.parse_args().garage
    target = ROOT / ("webapp/static/genre-templates-garage.js" if garage else "webapp/static/genre-templates.js")
    target.write_text("// Generated by scripts/build_genre_templates.py. See GENRE_MIDI.md.\nwindow.StreetArtGenreTemplates = "+json.dumps(build(garage),separators=(",",":"))+";\n")
    print(f"Built 64 source MIDI arrangements ({target.stat().st_size:,} bytes)")
