import pool from "./midi-candidate-pool.mjs?v=groove-v2";
import { addedClips } from "./phrase-expansion.mjs?v=rwc-lead1";
import { rwcLeadPhrases, rwcReverseLeadPhrases } from "./rwc-lead-pool.mjs?v=directional1";
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

function eventGroups(events) {
  const groups=new Map();
  for(const event of events) {
    if(!groups.has(event.beat)) groups.set(event.beat,[]);
    groups.get(event.beat).push(event);
  }
  return [...groups].sort((a,b)=>a[0]-b[0]).map(([beat,events])=>({beat,events}));
}
const clipsByRole = new Map();
for (const clip of [...pool.clips, ...addedClips]) {
  if (clip.role === "strings" || clip.role === "lead_synth") continue;
  if (!clipsByRole.has(clip.role)) clipsByRole.set(clip.role, []);
  clipsByRole.get(clip.role).push({ ...clip, groups: eventGroups(clip.events) });
}
const densityBand = density => density < .05 ? "sparse" : density <= .15 ? "medium" : "dense";

function assemblePhrase(ranked, variant) {
  const start = ((variant % ranked.length) + ranked.length) % ranked.length;
  const motif = ranked[start];
  const answer = ranked[(start + 1) % ranked.length];
  // The sparse band has two clips. Leave room at the end of its answer
  // so the fourth bar has its own ending without moving to a denser band.
  const ending = ranked.length > 2 ? ranked[(start + 2) % ranked.length] : {
    ...answer,
    groups: answer.groups.length > 1 ? answer.groups.slice(0, -1) : answer.groups.map(group => ({
      ...group, events: group.events.map(event => ({ ...event, duration: event.duration * .5 })),
    })),
  };
  return [motif, answer, motif, ending];
}

export function pickPhrase(role, density, variant) {
  const clips = clipsByRole.get(role);
  if (!clips?.length) return null;
  const choices = clips.filter(clip => clip.densityBand === densityBand(density));
  return assemblePhrase(choices.length ? choices : clips, variant);
}

const leadByModeAndBand = new Map();
for (const phrase of rwcLeadPhrases) {
  const key = `${phrase.mode}:${phrase.densityBand}`;
  if (!leadByModeAndBand.has(key)) leadByModeAndBand.set(key, []);
  leadByModeAndBand.get(key).push(phrase);
}

const reverseLeadByMode = new Map();
for (const phrase of [...rwcLeadPhrases, ...rwcReverseLeadPhrases]) {
  if (!reverseLeadByMode.has(phrase.mode)) reverseLeadByMode.set(phrase.mode, []);
  reverseLeadByMode.get(phrase.mode).push(phrase);
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

export function pickLeadPhrase(density, variant, chordNotes, tonic, mode) {
  const matching = leadByModeAndBand.get(`${mode}:${densityBand(density)}`);
  if (!matching?.length) return null;
  const ranked = rankLeadPhrases(matching, chordNotes, tonic);
  const best = ranked[0].score;
  const shortlist = ranked.slice(0, 5).filter(item => item.score >= best - .018);
  return prepareLeadPhrase(shortlist[variant % shortlist.length].phrase);
}

function differsAcrossBars(forward, reverse) {
  const signature = clip => JSON.stringify(clip.groups.map(group => [
    Math.round(group.beat * 8),
    group.events.map(event => Math.round(event.duration * 4)),
  ]));
  return forward.filter((clip, index) => signature(clip) !== signature(reverse[index])).length >= 2;
}

function leadPitchContours(phrase) {
  const bars = [[], [], [], []];
  for (const [beat, , pitch] of phrase.events) bars[Math.floor(beat / 4)].push(pitch);
  // Repeated hits and transposition do not make a new melodic contour.
  const contour = pitches => pitches
    .filter((pitch, index) => pitch !== pitches[index - 1])
    .map(pitch => pitch - pitches[0]).join(",");
  return { phrase: contour(bars.flat()), bars: bars.map(contour) };
}

function pickReverseLeadPhrase(forward, chordNotes, tonic, mode) {
  const original = leadPitchContours(forward);
  const ranked = rankLeadPhrases(reverseLeadByMode.get(mode), chordNotes, tonic);
  const distinct = ranked.filter(({ phrase }) => {
    if (phrase.source.track === forward.source.track) return false;
    const next = leadPitchContours(phrase);
    return next.phrase !== original.phrase && next.bars[0] !== original.bars[0]
      && next.bars.filter((bar, index) => bar !== original.bars[index]).length >= 3;
  });
  const band = forward.densityBand;
  const baseline = rankLeadPhrases(leadByModeAndBand.get(`${mode}:${band}`), chordNotes, tonic)[0].score;
  const best = distinct.find(({ phrase, score }) => phrase.densityBand === band && score >= baseline - .018)
    ?? distinct[0];
  return best ? prepareLeadPhrase(best.phrase) : null;
}

function reverseOptions(region, chordNotes, tonic, mode) {
  const forward = region.rhythmPhrase;
  const role = region.instrument.id;
  const band = densityBand(region.rhythmDensity);
  if (role === "lead_synth" && region.leadPhrase) {
    const lead = pickReverseLeadPhrase(region.leadPhrase, chordNotes, tonic, mode);
    return lead ? [{ bars: lead.bars, lead }] : [];
  }
  const clips = clipsByRole.get(role) ?? [];
  const matching = clips.filter(clip => clip.densityBand === band);
  const first = matching.findIndex(clip => clip.id === forward[0]?.id);
  return matching.map((_, index) => assemblePhrase(matching, first + index + 1))
    .filter(bars => differsAcrossBars(forward, bars))
    .map(bars => ({ bars, lead: null }));
}

function grooveFit(drums, bass) {
  const kicks = drums.flatMap((clip, bar) => clip.groups
    .filter(group => group.events.some(event => event.note === 36 || event.note === 35))
    .map(group => bar * 4 + group.beat));
  const hits = bass.flatMap((clip, bar) => clip.groups.map(group => bar * 4 + group.beat));
  return Math.max(...[0, .5].map(offset => hits.filter(beat =>
    kicks.some(kick => Math.abs(kick + offset - beat) < .09)).length)) / Math.max(1, hits.length);
}

function arpRhythmContrast(forward, reverse) {
  return Math.min(...forward.map((clip, bar) => {
    const a = clip.groups;
    const b = reverse[bar].groups;
    const shared = a.filter(group => b.some(other => Math.abs(group.beat - other.beat) < .07)).length;
    return 1 - 2 * shared / (a.length + b.length);
  }));
}

function reverseArpOptions(region, sameBand) {
  const forward = region.rhythmPhrase;
  const contrast = take => arpRhythmContrast(forward, take.bars);
  const candidates = sameBand.filter(take => contrast(take) >= .35);
  if (candidates.length) return candidates;
  const clips = clipsByRole.get("counter_synth");
  const otherBands = clips.filter(clip => clip.densityBand !== densityBand(region.rhythmDensity));
  const alternatives = otherBands.map((_, index) => ({ bars: assemblePhrase(otherBands, index), lead: null }));
  return [...sameBand, ...alternatives];
}

export function selectReverseArrangement(regions, chordNotes, tonic, mode) {
  const options = regions.map(region => {
    let alternatives = region.rhythmPhrase ? reverseOptions(region, chordNotes, tonic, mode) : [];
    if (region.rhythmPhrase && region.instrument.id === "counter_synth") {
      alternatives = reverseArpOptions(region, alternatives);
    }
    return alternatives.length ? alternatives : [{ bars: region.rhythmPhrase, lead: region.leadPhrase }];
  });
  const selected = options.map(items => items[0]);
  const drums = regions.findIndex(region => region.instrument.id === "drums");
  const bass = regions.findIndex(region => region.instrument.id === "bass");
  if (drums >= 0 && bass >= 0) {
    let best = -1;
    for (const drumTake of options[drums]) for (const bassTake of options[bass]) {
      const fit = grooveFit(drumTake.bars, bassTake.bars);
      if (fit > best) {
        best = fit;
        selected[drums] = drumTake;
        selected[bass] = bassTake;
      }
    }
  }
  const attackSlots = take => (take?.bars ?? []).flatMap((clip, bar) => clip.groups
    .map(group => bar * 8 + Math.floor(group.beat * 2)));
  const fitAround = (index, slots, contrast = () => 0) => {
    const overlaps = take => {
      const hits = attackSlots(take);
      return hits.filter(slot => slots.has(slot)).length / Math.max(1, hits.length);
    };
    selected[index] = options[index].reduce((best, take) => {
      const difference = contrast(take) - contrast(best);
      return difference > 1e-8 || (Math.abs(difference) < 1e-8 && overlaps(take) < overlaps(best)) ? take : best;
    });
  };
  const chordHits = new Set();
  const lead = regions.findIndex(region => region.instrument.id === "lead_synth");
  const leadHits = new Set(attackSlots(selected[lead]));
  const drumHits = new Set(attackSlots(selected[drums]));
  regions.forEach((region, index) => {
    const role = region.instrument.id;
    if (["pad", "organ", "guitar", "keys_mallet"].includes(role)) {
      fitAround(index, chordHits);
      for (const slot of attackSlots(selected[index])) chordHits.add(slot);
    } else if (role === "counter_synth" && region.rhythmPhrase) {
      fitAround(index, leadHits, take => arpRhythmContrast(region.rhythmPhrase, take.bars));
    }
    else if (role === "percussion_texture") fitAround(index, drumHits);
  });
  return selected;
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
