import pool from "./midi-candidate-pool.mjs?v=drum-fill1";
import { addedClips } from "./phrase-expansion.mjs?v=drum-fill1";
import { expandedRhythmClips } from "./rhythm-pool-expansion.mjs?v=same-band2";
import { rwcLeadPhrases } from "./rwc-lead-pool.mjs?v=same-band2";
import { rankLeadPhrases } from "./lead-chord-fit.mjs?v=rwc-lead1";

const palette = [
  ["red", "#ff0000", "scarlet crimson vermilion maroon burgundy wine brick-red 红 红色"],
  ["orange", "#ffa500", "amber tangerine coral peach rust 橙 橙色"],
  ["yellow", "#ffff00", "gold golden mustard lemon 黄 黄色"],
  ["yellow-green", "#7fff00", "chartreuse lime olive 黄绿 黄绿色"],
  ["green", "#008000", "emerald forest-green mint-green 绿 绿色"],
  ["spring-green", "#00ff7f", "mint sea-green aquamarine 春绿 薄荷绿"],
  ["cyan", "#00ffff", "aqua turquoise teal 青 青色"],
  ["blue-cyan", "#1e90ff", "dodgerblue azure 蓝青"],
  ["blue", "#0000ff", "sky-blue light-blue dark-blue deep-blue navy cobalt royal-blue ultramarine 蓝 蓝色 天蓝 天蓝色 浅蓝 深蓝"],
  ["blue-violet", "#8a2be2", "purple violet indigo lavender lilac 紫 紫色 蓝紫"],
  ["magenta", "#ff00ff", "fuchsia 紫红 品红"],
  ["rose", "#ff1493", "pink hot-pink rose-pink 玫红 粉 粉色"],
  ["black", "#000000", "jet-black 黑 黑色"],
  ["white", "#ffffff", "off-white ivory cream 白 白色"],
  ["gray", "#808080", "grey silver charcoal 灰 灰色"],
  ["brown", "#a52a2a", "tan beige sepia umber chocolate ochre 褐 褐色 棕 棕色"],
];
const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Major and natural minor, in the same order as the twelve hue sectors above.
const hueProgressions = [
  { major: [1, 5, 6, 4], minor: [1, 6, 3, 7] }, // Red
  { major: [1, 6, 4, 5], minor: [1, 4, 7, 1] }, // Orange
  { major: [1, 4, 1, 5], minor: [1, 3, 7, 6] }, // Yellow
  { major: [1, 2, 4, 5], minor: [1, 7, 4, 1] }, // Yellow-green
  { major: [1, 4, 6, 5], minor: [1, 6, 4, 5] }, // Green
  { major: [1, 6, 2, 5], minor: [1, 7, 6, 5] }, // Spring green
  { major: [1, 1, 4, 4], minor: [1, 1, 4, 4] }, // Cyan
  { major: [1, 3, 4, 5], minor: [1, 4, 6, 7] }, // Blue-cyan
  { major: [1, 6, 4, 1], minor: [1, 6, 3, 1] }, // Blue
  { major: [1, 4, 2, 5], minor: [1, 5, 6, 4] }, // Blue-violet
  { major: [1, 5, 4, 4], minor: [1, 7, 1, 6] }, // Magenta
  { major: [1, 6, 5, 4], minor: [1, 3, 4, 7] }, // Rose
];
const chordSymbols = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"],
};

export function harmonyForHue(hueIndex, mode) {
  const family = mode === "minor" ? "minor" : "major";
  const degrees = (hueProgressions[hueIndex] ?? hueProgressions[0])[family];
  return { degrees, name: degrees.map(degree => chordSymbols[family][degree - 1]).join("–") };
}

const gray = (r,g,b) => (.299*r + .587*g + .114*b);
const strength = (r,g,b) => (gray(r,g,b) + Math.max(r,g,b) - Math.min(r,g,b)) / 510;
const canonical = (value) => String(value || "").toLowerCase().trim().replace(/[\s–—]+/g, "-");
const aliases = new Map(palette.flatMap(([name,,words], i) => [name, ...words.split(" ")].map(word => [word, i])));
const aliasPattern = new RegExp([...aliases.keys()].sort((a,b)=>b.length-a.length).map(word => /[^\x00-\x7f]/.test(word)
  ? word : "\\b" + word.replaceAll("-", "[-\\s]+") + "\\b").join("|"), "giu");
function colorWords(statement, hints) {
  const input = String(statement || "");
  const found = new Map();
  for (const match of input.matchAll(aliasPattern)) {
    const index = aliases.get(canonical(match[0]));
    if (index === undefined) continue;
    const previous = input.slice(Math.max(0, match.index - 38), match.index);
    const after = input.slice(match.index + match[0].length, match.index + match[0].length + 44);
    // A colour word next to an explicit indication of importance gets double weight.
    const emphasized = /\b(?:primarily|mainly|dominant|main|most important|key colour|key color)\s*(?:(?:the|is|was|a)\s+)?$/i.test(previous)
      || /^\s+(?:(?:is|was)\s+)?(?:the\s+)?(?:main|dominant|most important)\b/i.test(after)
      || /(?:主要是?|主色是?|最重要的是?)\s*$/.test(previous);
    const hint = Array.isArray(hints) && hints.find(item => canonical(item?.name) === canonical(match[0]));
    found.set(index, Math.max(found.get(index) || 1, emphasized || hint?.emphasis === true ? 2 : 1));
  }
  return found;
}
function hueIndex(r,g,b,max,chroma) {
  const offset = max === r ? (g-b)/chroma : max === g ? 2+(b-r)/chroma : 4+(r-g)/chroma;
  return (Math.floor((offset*60+375)/30))%12;
}
function fromHex(hex) { return [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)); }

export function artworkSettings({data,width,height}, statement = "", hints = []) {
  const bins = palette.map(() => ({count:0, gray:0, strength:0}));
  const hues = Array.from({length:12}, () => ({count:0,gray:0}));
  let sum = 0, total = 0;
  for (let i=0, end=width*height*4; i<end; i+=4) {
    if (data[i+3] < 128) continue;
    const r=data[i], g=data[i+1], b=data[i+2], lum=gray(r,g,b);
    const max=Math.max(r,g,b), chroma=max-Math.min(r,g,b);
    sum+=lum; total++;
    let index;
    if (chroma < 15 || (max && chroma/max < .12)) index=lum<48?12:lum>=216?13:14;
    else {
      index=hueIndex(r,g,b,max,chroma);
      hues[index].count++; hues[index].gray+=lum;
      if ((index===1 || index===2 || index===0) && lum<146 && max<200) index=15;
    }
    bins[index].count++; bins[index].gray+=lum; bins[index].strength+=(lum+chroma)/510;
  }
  const rank = (items) => items.map((_,index)=>index).filter(i=>items[i].count).sort((a,b) =>
    items[b].count-items[a].count || items[b].gray/items[b].count-items[a].gray/items[a].count || a-b);
  const leadHue = rank(hues)[0];
  const mentioned = colorWords(statement,hints);
  const entries = mentioned.size ? [...mentioned] : rank(bins).slice(0,2).map(i=>[i,bins[i].count]);
  let weighted=0, weightSum=0;
  const colors = entries.map(([index,weight]) => {
    const bin=bins[index];
    const score=bin.count ? bin.strength/bin.count : strength(...fromHex(palette[index][1]));
    weighted+=weight*score; weightSum+=weight;
    return {name:palette[index][0], weight, source:bin.count?"artwork":"reference RGB"};
  });
  const grayscale=total ? sum/total : 127.5;
  return {
    bpm: Math.round(72+72*(weightSum ? weighted/weightSum : .5)),
    root:names[leadHue ?? 0], mode:grayscale>=127.5-1e-9?"major":"minor",
    grayscale, dominantHue:leadHue==null?null:palette[leadHue][0],
    hueIndex:leadHue ?? 0, colors, tempoSource:mentioned.size?"Artist Statement":"Artwork colors",
  };
}

export function detailDensity(mask, width, height, pixels) {
  let edges=0, total=0;
  // Masks and artwork are normally aligned after cropping. Handle older saved analyses too.
  const xs = Array.from({length:width}, (_,x)=>Math.min(pixels.width-1,Math.floor(x*pixels.width/width))*4);
  const ys = Array.from({length:height}, (_,y)=>Math.min(pixels.height-1,Math.floor(y*pixels.height/height))*pixels.width*4);
  const p=pixels.data;
  const value=(x,y)=>{const i=ys[y]+xs[x]; return gray(p[i],p[i+1],p[i+2]);};
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const index=(y*width+x)*4;
    if(mask[index]<=80) continue;
    const v=value(x,y);
    if(x+1<width && mask[index+4]>80) { total++; if(Math.abs(v-value(x+1,y))>=20) edges++; }
    if(y+1<height && mask[index+width*4]>80) { total++; if(Math.abs(v-value(x,y+1))>=20) edges++; }
  }
  return total ? edges/total : 0;
}

export function scanEdgeProfile({ data, width, height }) {
  const grayscale = new Float64Array(width * height);
  for (let pixel = 0; pixel < grayscale.length; pixel++) {
    const i = pixel * 4;
    grayscale[pixel] = data[i + 3] >= 128 ? gray(data[i], data[i + 1], data[i + 2]) : -1;
  }
  const edges = new Uint32Array(width);
  const pairs = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const value = grayscale[pixel];
      if (value < 0) continue;
      if (x + 1 < width && grayscale[pixel + 1] >= 0) {
        pairs[x]++;
        if (Math.abs(value - grayscale[pixel + 1]) >= 20) edges[x]++;
      }
      if (y + 1 < height && grayscale[pixel + width] >= 0) {
        pairs[x]++;
        if (Math.abs(value - grayscale[pixel + width]) >= 20) edges[x]++;
      }
    }
  }
  let min = Infinity;
  let max = -Infinity;
  const columns = Array.from({ length: width }, (_, x) => {
    if (!pairs[x]) return null;
    let edgeCount = 0;
    let pairCount = 0;
    for (let i = Math.max(0, x - 2); i < Math.min(width, x + 3); i++) {
      edgeCount += edges[i];
      pairCount += pairs[i];
    }
    const density = edgeCount / pairCount;
    min = Math.min(min, density);
    max = Math.max(max, density);
    return { edges: edgeCount, pairs: pairCount };
  });
  return { columns, min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
}

function eventGroups(events) {
  const groups=new Map();
  for(const event of events) {
    if(!groups.has(event.beat)) groups.set(event.beat,[]);
    groups.get(event.beat).push(event);
  }
  return [...groups].sort((a,b)=>a[0]-b[0]).map(([beat,events])=>({beat,events}));
}

function prepareGrooveDrums(events) {
  const kicks = events.filter(event => event.note === 36);
  const lateKick = kicks.length === 1 && kicks[0].beat >= 3.75 ? kicks[0] : null;
  const prepared = events.map(event => {
    if (event.note === 36) {
      const beat = event === lateKick ? 0 : Math.min(3.75, Math.round(event.beat * 4) / 4);
      return { ...event, beat };
    }
    if ((event.note === 38 || event.note === 39) && event.velocity >= 100) {
      // Anchor the backbeat and retain the original hat and ghost-note timings.
      const beat = Math.max(1, Math.min(3, Math.round(event.beat)));
      return { ...event, beat };
    }
    return event;
  });
  if (!prepared.some(event => event.note === 36 && event.beat === 0)) {
    prepared.push({ beat: 0, duration: .12, note: 36, velocity: 110 });
  }
  return prepared.sort((a, b) => a.beat - b.beat);
}

const clipsByRole = new Map();
for (const clip of [...pool.clips, ...addedClips, ...expandedRhythmClips]) {
  if (clip.role === "strings" || clip.role === "lead_synth") continue;
  if (!clipsByRole.has(clip.role)) clipsByRole.set(clip.role, []);
  let events = clip.events;
  if (clip.role === "drums" && clip.source.title === "Google Magenta Groove MIDI Dataset") {
    events = prepareGrooveDrums(events);
  } else if (clip.role === "bass" && clip.source.title.startsWith("Groove MIDI Dataset")) {
    // These parts reuse a drummer's kick timing. Snap only near-grid hits so
    // the bass and the sequencer's quantized kick agree on those attacks.
    events = events.map(event => {
      const beat = Math.min(3.75, Math.round(event.beat * 4) / 4);
      return Math.abs(beat - event.beat) <= 1 / 16 ? { ...event, beat } : event;
    });
  }
  clipsByRole.get(clip.role).push({ ...clip, events, groups: eventGroups(events) });
}
const densityBand = density => density < .05 ? "sparse" : density <= .15 ? "medium" : "dense";

const TOM_ENDINGS = {
  sparse: [[3.25, 47, 82], [3.75, 43, 98]],
  medium: [[3.25, 50, 80], [3.5, 47, 88], [3.75, 43, 103]],
  dense: [[3, 50, 78], [3.25, 47, 86], [3.5, 47, 75], [3.75, 43, 104]],
};

function withTomEnding(clip) {
  // Leave the final backbeat intact and clear room after it for the toms.
  const events = clip.events.filter(({ beat, note }) => beat < 3 || (beat === 3 && [36, 38, 39].includes(note)));
  for (const [beat, note, velocity] of TOM_ENDINGS[clip.densityBand]) {
    events.push({ beat, note, velocity, duration: .12 });
  }
  return { ...clip, id: clip.id + "-tom-fill", sourceClipId: clip.id, events, groups: eventGroups(events) };
}

function assemblePhrase(ranked, variant) {
  const start = ((variant % ranked.length) + ranked.length) % ranked.length;
  const motif = ranked[start];
  const answer = ranked[(start + 1) % ranked.length];
  const ending = ranked[(start + 2) % ranked.length];
  return [motif, answer, motif, motif.role === "drums" ? withTomEnding(ending) : ending];
}

function rhythmSignature(phrase) {
  return JSON.stringify(phrase.map(clip => clip.groups.map(group => [
    Math.round(group.beat * 8),
    group.events.map(event => Math.round(event.duration * 4)),
  ])));
}

function* rhythmCandidates(role, density, variant, previous) {
  const clips = (clipsByRole.get(role) ?? []).filter(clip => clip.densityBand === densityBand(density));
  const excluded = previous ? rhythmSignature(previous) : null;
  for (let offset = 0; offset < clips.length; offset++) {
    const phrase = assemblePhrase(clips, variant + offset);
    if (excluded === null || rhythmSignature(phrase) !== excluded) yield phrase;
  }
}

export function pickPhrase(role, density, variant, previous = null) {
  return rhythmCandidates(role, density, variant, previous).next().value ?? previous;
}

export function pickChordRhythm(role, density, variant, reference, previous = null) {
  const onsetTolerance = 1 / 16; // Beats. Small timing differences can still share an attack.
  let best = previous;
  let bestOverlap = -1;
  let fewestOnsets = Infinity;
  for (const phrase of rhythmCandidates(role, density, variant, previous)) {
    let matchingOnsets = 0;
    let onsets = 0;
    for (const [bar, clip] of phrase.entries()) {
      const referenceGroups = reference[bar].groups;
      onsets += clip.groups.length;
      for (const { beat } of clip.groups) {
        if (referenceGroups.some(group => Math.abs(group.beat - beat) <= onsetTolerance)) matchingOnsets++;
      }
    }
    const overlap = matchingOnsets / Math.max(1, onsets);
    if (overlap > bestOverlap || (overlap === bestOverlap && onsets < fewestOnsets)) {
      best = phrase;
      bestOverlap = overlap;
      fewestOnsets = onsets;
    }
  }
  return best;
}

export function pickBassForDrums(density, variant, drums, previous = null) {
  let best = previous;
  let score = -Infinity;
  for (const phrase of rhythmCandidates("bass", density, variant, previous)) {
    const fit = grooveFit(drums, phrase);
    if (fit > score + 1e-8) {
      best = phrase;
      score = fit;
    }
  }
  return best;
}

const leadByModeAndBand = new Map();
for (const phrase of rwcLeadPhrases) {
  const key = `${phrase.mode}:${phrase.densityBand}`;
  if (!leadByModeAndBand.has(key)) leadByModeAndBand.set(key, []);
  leadByModeAndBand.get(key).push(phrase);
}

export function prepareLeadPhrase(phrase) {
  const measures = Array.from({ length: 4 }, () => []);
  for (const [onset, duration, semitoneOffset] of phrase.events) {
    const bar = Math.floor(onset / 4);
    const beat = onset - bar * 4;
    measures[bar].push({ beat, duration, semitoneOffset, velocity: beat < .12 ? 91 : 80 });
  }
  return {
    ...phrase,
    bars: measures.map((events, i) => ({
      id: `${phrase.id}-bar-${i + 1}`,
      densityBand: phrase.densityBand,
      groups: eventGroups(events),
    })),
  };
}

function melodySignature(phrase) {
  const firstPitch = phrase.events[0][2];
  return phrase.events.map(([, , pitch]) => pitch - firstPitch)
    .filter((pitch, index, pitches) => pitch !== pitches[index - 1]).join(",");
}

export function pickLeadPhrase(density, variant, chordNotes, tonic, mode, previous = null) {
  const matching = leadByModeAndBand.get(`${mode}:${densityBand(density)}`) ?? [];
  const excluded = previous ? melodySignature(previous) : null;
  const eligible = excluded === null ? matching : matching.filter(phrase => melodySignature(phrase) !== excluded);
  if (!eligible.length) return previous;
  const ranked = rankLeadPhrases(eligible, chordNotes, tonic);
  const best = ranked[0].score;
  const shortlist = ranked.slice(0, 5).filter(item => item.score >= best - .018);
  return prepareLeadPhrase(shortlist[variant % shortlist.length].phrase);
}

function grooveFit(drums, bass) {
  const kicks = drums.flatMap((clip, bar) => clip.groups
    .filter(group => group.events.some(event => event.note === 36 || event.note === 35))
    .map(group => bar * 4 + group.beat));
  const hits = bass.flatMap((clip, bar) => clip.groups.map(group => bar * 4 + group.beat));
  const matches = offset => hits.filter(beat => kicks.some(kick => Math.abs(kick + offset - beat) < .09));
  const unison = matches(0);
  const downbeats = unison.filter(beat => Math.abs(beat - 4 * Math.round(beat / 4)) < .09);
  return (.65 * unison.length + .15 * matches(.5).length) / Math.max(1, hits.length)
    + .20 * downbeats.length / bass.length;
}

export function scanWindows(profile, threshold, totalBeats) {
  const result=[];
  if(!profile.length || totalBeats<4) return result;
  // The last partial bar is kept as an outro. A late region enters at the last full bar.
  const lastFullBar=Math.max(0,Math.floor((totalBeats+1e-8)/4)-1)*4;
  for(let i=0;i<profile.length;) {
    if(profile[i].coverage<=threshold){i++; continue;}
    const first=i++;
    while(i<profile.length && profile[i].coverage>threshold) i++;
    const start=first*totalBeats/profile.length, end=i*totalBeats/profile.length;
    const from=Math.min(lastFullBar, Math.round(start/4)*4);
    const to=Math.min(totalBeats, Math.max(from+4, Math.ceil(end/4)*4));
    const next={from,to,first,last:i-1};
    const previous=result.at(-1);
    if(previous && from<=previous.to){
      previous.to=Math.max(previous.to,to); previous.last=i-1;
    } else result.push(next);
  }
  return result;
}
