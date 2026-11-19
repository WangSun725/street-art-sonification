// Each variant corresponds to the three feature thresholds in selectArrangement.
const names = {
  psytrance: ["Sub Tunnel", "Acid Stabs", "Rolling Gate", "Forest Cuts", "Glass Acid", "Goa Triggers", "Full-on Lift", "Peak Drive"],
  techno: ["Concrete", "Machine Cuts", "Warehouse", "Hard Sync", "Chrome", "Metal Stabs", "Pressure Rise", "Peak Tool"],
  jungle: ["Deep Roller", "Ragged Break", "Dubwise", "Chopped Break", "Airwave", "Jungle Cuts", "Liquid Rush", "Rave Break"],
  dubstep: ["Sub Chamber", "Broken Wobble", "Deep Halfstep", "Bass Switch", "Hollow Lead", "Stutter Lead", "Wide Drop", "Peak Drop"],
  chiptune: ["Soft Pulse", "Bit Jumps", "Low Cartridge", "Arcade Cuts", "Pixel Lead", "Pulse Sprint", "Stereo Cartridge", "Boss Stage"],
  dark_ambient: ["Low Room", "Distant Shards", "Submerged", "Cavern Pulses", "Cold Light", "Shimmer Cuts", "Wide Drift", "Signal Storm"],
  synthwave: ["Night Drive", "Tape Stabs", "Low Neon", "Motor Pulse", "Chrome Lead", "Neon Cuts", "Wide Chorus", "Afterburn"],
  electro_rock: ["Low Voltage", "Riff Cuts", "Heavy Floor", "Broken Amp", "Bright Amp", "Lead Break", "Wide Riff", "Overdrive"],
  garage_2step: ["Side Street", "Shuffle Cuts", "Organ Cellar", "Skippy Bass", "Glass Organ", "Chopped Stabs", "Club Shuffle", "Late Garage"],
};

const backbeats = {
  jungle: [
    [[0, 1.75, 2.5], [1, 2.75, 3], [.25,.5,.75,1.5,2,2.25,3.5]],
    [[0, .75, 2.25, 3.5], [1, 1.75, 3, 3.75], [.25,.5,1.5,2,2.5,2.75,3.25]],
    [[0, 2.5], [1, 3], [.5,.75,1.5,2,2.25,3.5,3.75]],
    [[0, 1.5, 2.25, 3.25], [1, 2.75, 3.5], [.25,.5,1.25,1.75,2.5,3,3.75]],
  ],
  dubstep: [
    [[0, 1.5], [2], [.5,1,1.75,2.5,3.5]],
    [[0, .75, 2.75], [2], [.25,.5,1.5,2.25,3,3.5,3.75]],
    [[0, 1.75, 3.25], [2], [.5,1,2.5,3,3.75]],
    [[0, 1.25, 2.5, 3.5], [2, 3.75], [.25,.75,1.5,2.25,3,3.25]],
  ],
  synthwave: [
    [[0, 2, 2.75], [1, 3], [0,.5,1,1.5,2,2.5,3,3.5]],
    [[0, .75, 2.5], [1, 3], [.5,1.5,2.25,2.75,3.5]],
    [[0, 1, 2, 3], [1, 3], [.5,1.5,2.5,3.5]],
    [[0, 1.5, 2, 3.25], [1, 3, 3.75], [.5,.75,1.5,2.5,3.5]],
  ],
  garage_2step: [
    [[0, 1.75, 2.5], [1, 3], [.5,.83,1.5,2.5,2.83,3.5]],
    [[0, .75, 2.67], [1, 3], [.33,.5,1.67,2.33,2.5,3.67]],
    [[0, 1.67, 2.33, 3.5], [1, 3], [.5,1.5,1.83,2.5,3.5,3.83]],
    [[0, .83, 2.5, 3.67], [1, 3], [.33,.5,1.5,2.33,2.5,3.5]],
  ],
};

function drumBar(family, bright, dense, broken, bar) {
  const choice = (Number(dense) * 2 + Number(broken) + (broken ? bar % 2 : 0)) % 4;
  const groove = backbeats[family][choice];
  const groups = new Map();
  for (const [i, note] of [36, 38, 42].entries()) {
    for (const [hit, position] of groove[i].entries()) {
      const at = Math.round(position * 12) / 12;
      if (note === 42 && !dense && hit % 2) continue;
      const velocity = note === 36 ? (hit ? 105 : 120)
        : note === 38 ? (at === 1 || at === 2 || at === 3 ? 114 : 68)
        : (hit % 2 ? 57 : bright ? 87 : 72);
      // Keep velocities separate when hats and drums hit together.
      const event = groups.get(at);
      if (event) {
        event.notes.push(note);
        event.noteVelocities[note] = velocity;
      } else {
        groups.set(at, { at, duration: .125, notes: [note], noteVelocities: { [note]: velocity }, sourceVelocity: velocity });
      }
    }
  }
  if (dense && bar % 2 === 1 && !groups.has(3.5)) {
    groups.set(3.5, { at: 3.5, duration: .17, notes: [46], sourceVelocity: 83 });
  }
  return [...groups.values()].sort((a, b) => a.at - b.at);
}

function addHit(events, beat, note, velocity) {
  const hit = events.find(event => Math.abs(event.at-beat)<.00001);
  if (hit) {
    if (!hit.notes.includes(note)) {
      hit.noteVelocities ||= Object.fromEntries(hit.notes.map(n=>[n,hit.sourceVelocity]));
      hit.notes.push(note);
      hit.noteVelocities[note] = velocity;
    }
  } else {
    events.push({at:beat,duration:.125,notes:[note],sourceVelocity:velocity});
  }
}

function dubstepDrums(bar, minor, dense, broken) {
  const hits = [];
  const kicks = minor ? [[0,1.5],[0,2.75],[0,.75,2.5],[0,1.25,2.75]]
    : [[0,1.75,3.5],[0,.75,2.5],[0,1.5,2.75],[0,2.5,3.5]];
  for (const [index, beat] of kicks[(bar+Number(broken))%4].entries()) addHit(hits,beat,36,index?111:124);
  addHit(hits,2,38,126);
  if (bar===4) return [{at:2,duration:.125,notes:[38],sourceVelocity:84}];
  const hats = minor ? [.5,1.5,2.5,3.5] : [.5,1,1.5,2.5,3,3.5];
  for (const [i,beat] of hats.entries()) addHit(hits,beat,42,i%2?62:83);
  if (dense || bar>=6) addHit(hits,bar%2?3.25:1.5,46,92);
  if (bar===0 || bar===6) addHit(hits,0,49,92);
  if (bar%2===1 && (dense || broken)) {
    for(const [index,beat] of [3.25,3.5,3.75].entries()) addHit(hits,beat,index===2?38:42,64+index*13);
  }
  return hits.sort((a,b)=>a.at-b.at);
}

function dubstepBass(events, bar, minor, broken) {
  if (!events.length) return [];
  const last = events.at(-1);
  const choices = minor ? [[0,1.5,2.75],[0,.75,2.5],[0,1.25,3]] : [[0,1.75,2.75],[0,1.25,2.5,3.5],[.25,1.5,2.75]];
  const positions = bar===4 ? [0] : choices[(bar+Number(broken))%3];
  const wobble = broken ? [4,8,2,4] : minor ? [2,4,1,2] : [1,2,4,2];
  return positions.map((at,index)=>{
    const source = events.findLast(event=>event.at<=at) ?? events[0] ?? last;
    const end = positions[index+1]??4;
    return {at,duration:Math.max(.125,end-at-(index%2 ? .15 : .09)),
      sourceNotes:[source.sourceNotes[0]],sourceVelocity:index?105:121,
      accent:index===0, wobbleRate:wobble[(bar+index)%wobble.length]};
  });
}

export function performanceVariant(template, mode) {
  const {familyId,production} = template;
  const minor = mode==="minor";
  const {bright,dense,broken} = production;
  const patterns = Object.fromEntries(Object.entries(template.patterns).map(([role,bars])=>[
    role,
    bars.map((events,bar)=>{
      if(familyId==="dubstep"){
        if(role==="drums")return dubstepDrums(bar,minor,dense,broken);
        if(role==="bass")return dubstepBass(events,bar,minor,broken);
        if(role==="percussion_texture")return []; // Drum voices carry the hats.
      }
      if(!events.length)return events;
      const section = Math.floor(bar/2);
      const phase = (bar+template.version+section)%4;
      if(role==="drums"||role==="percussion_texture"){
        const edited=structuredClone(events);
        if(role==="drums" && (minor || bar%2===1)){
          // Preserve the core kick pattern and add different offbeat gestures.
          addHit(edited,minor ? (bar%2 ? 3.75 : 1.75) : 3.5,minor&&bar%2 ? 38 : 42,minor?76:86);
        }else if(role==="percussion_texture"){
          return edited.filter((_,i)=>i===0 || (i+phase)%(minor?3:2)!==0);
        }
        return edited.sort((a,b)=>a.at-b.at);
      }
      const sustain = role==="pad"||role==="strings";
      const edited = events.flatMap((event,index)=>{
        if(sustain){
          const notes = event.sourceNotes.map((note,i)=>i===0&&minor&&event.sourceNotes.length>1?note-12:note);
          return [{...event,sourceNotes:notes,duration:event.duration*(minor ? 1 : .82)}];
        }
        // A periodic breath lets the source riff answer itself. Keep the
        // pitches from this bar so ornaments still belong to its harmony.
        if(index>0 && (index+phase)%(minor?5:7)===0 && events.length>=5)return [];
        const next=events[index+1]?.at??4;
        const duration=Math.min(event.duration*(minor?.75:1.12),next-event.at,4-event.at);
        const main={...event,duration:Math.max(.06,duration),slide:false};
        if(!minor && role==="bass" && index===0 && bar%2===1 && next-event.at>=.33){
          const at=Math.round((event.at+1/6)*12)/12;
          return [{...main,duration:1/8},{...main,at,duration:Math.min(.12,next-at),sourceVelocity:Math.max(50,event.sourceVelocity-18)}];
        }
        if(minor&&role!=="bass"&&index===events.length-1&&bar%2===1&&event.at<3.65){
          const at=Math.min(3.75,Math.round((event.at+.25)*12)/12);
          const answer=events.find(other=>other.sourceNotes[0]!==event.sourceNotes[0])??event;
          return [{...main,duration:Math.min(main.duration,.19)},{...main,at,duration:.14,
            sourceNotes:[answer.sourceNotes[0]],sourceVelocity:Math.max(50,event.sourceVelocity-20)}];
        }
        return [main];
      });
      return edited;
    }),
  ]));
  const activeRoles=template.activeRoles.filter(role=>patterns[role].some(bar=>bar.length));
  const source={...template.source,
    sourceRoles:template.source.sourceRoles.filter(role=>activeRoles.includes(role)),
    supplementalRoles:template.source.supplementalRoles.filter(role=>activeRoles.includes(role))};
  return {...template,patterns,activeRoles,source,
    production:{...production,mode,metalBass:familyId==="dubstep"},
    fx:{...template.fx,reverb:Math.min(1,template.fx.reverb+(minor?.07:0))}};
}

export function productionTemplate(template) {
  const id = template.familyId;
  const bits = template.version - 1;
  const bright = Boolean(bits & 4);
  const dense = Boolean(bits & 2);
  const broken = Boolean(bits & 1);
  const name = names[id][bits];
  const fx = {
    reverb: Math.min(1, template.fx.reverb * .72 + (dense ? .27 : .05)),
    chorus: Math.min(1, template.fx.chorus * .78 + (bright ? .24 : .08)),
    delay: Math.min(1, template.fx.delay * .64 + (broken ? .34 : .12)),
    delayBeats: broken ? .75 : dense ? 1 : .5,
  };

  const foreground = ["lead_synth", "counter_synth", "guitar", "keys_mallet"]
    .find((role) => template.activeRoles.includes(role));
  const patterns = Object.fromEntries(Object.entries(template.patterns).map(([role, bars]) => [
    role,
    bars.map((events, bar) => {
      const drum = role === "drums" || role === "percussion_texture";
      const texture = role === "pad" || role === "strings";
      // Opening, entrance, breakdown and return, two bars apiece.
      if (role === foreground && bar < (dense ? 1 : 2)) return [];
      if (drum && bar === 4) return [];
      if (texture && !dense && bar < 4) return [];
      if (role === "drums" && backbeats[id]) return drumBar(id, bright, dense, broken, bar);
      if (drum && broken && bar % 2 === 1) {
        const fill = [3.25, 3.5, 3.75].filter(at => !events.some(event => Math.abs(at - event.at) < .001));
        return [...events, ...fill.map((at, i) => ({at, duration:.12, notes:[i === fill.length - 1 ? 38 : 42],
          sourceVelocity:78 + i * 10}))].sort((a, b) => a.at - b.at);
      }
      if (drum) return events;
      return events.flatMap((event, index) => {
        const length = event.duration;
        const next = events[index + 1]?.at ?? 4;
        const octave = bright && role === foreground && dense && event.sourceNotes.length === 1 && bar >= 6 && index % 2 === 0;
        const notes = octave ? [...event.sourceNotes, event.sourceNotes[0] + 12] : event.sourceNotes;
        const articulated = broken && (role === "bass" || role === foreground) && length > .45;
        const step = id === "jungle" ? 1/6 : .25;
        const duration = articulated ? Math.min(length, step * .72) : length;
        const first = {...event, sourceNotes: notes, duration};
        if (!articulated) return [first];
        const hits = [first];
        for (let offset = step; offset < Math.min(length, next - event.at) - .05; offset += step) {
          const at = Math.round((event.at + offset) * 12) / 12;
          hits.push({...first, at, sourceVelocity: Math.max(42, event.sourceVelocity - 12), slide:false});
        }
        return hits;
      });
    }),
  ]));
  const activeRoles = template.activeRoles.filter(role => patterns[role].some(bar => bar.length));
  const description = [
    bright ? "open filter and brighter lead" : "darker filter and heavier low end",
    dense ? "layered return" : "space between parts",
    broken ? "chopped notes and drum fills" : "longer notes and steadier rhythm",
  ].join(" · ");
  const drumEdit = backbeats[id] ? "Drum track rebuilt for this round."
    : broken && activeRoles.includes("drums") ? "Drum fills added to source arrangement." : "";
  const source = {...template.source, sourceRoles:template.source.sourceRoles.filter(role => activeRoles.includes(role)
    && (role !== "drums" || !backbeats[id])),
    supplementalRoles:[...new Set([...template.source.supplementalRoles, ...(backbeats[id] ? ["drums"] : [])])]
      .filter(role => activeRoles.includes(role))};
  return {
    ...template, activeRoles, source, patterns, fx,
    name: `${template.name} · ${name}`,
    production: {bright, dense, broken, description, drumEdit},
  };
}

const visualProfiles = {
  psytrance: [.69,.57,.75,.56], techno: [.67,.42,.51,.73], jungle: [.77,.62,.64,.84],
  dubstep: [.59,.31,.53,.66], chiptune: [.46,.82,.82,.34], dark_ambient: [.18,.26,.28,.23],
  synthwave: [.38,.58,.65,.28], garage_2step: [.49,.56,.45,.49],
};

// Derive a harmonic guide from notes that overlap each two-beat window.
// A riff with little pitch evidence keeps its bass anchor and an open texture.
function harmonyGuide(patterns) {
  const shapes = [[0,4,7],[0,3,7],[0,2,7],[0,5,7],[0,3,6],[0,7]];
  return Array.from({length:16}, (_, i) => {
    const bar = i >> 1, at = (i % 2) * 2;
    const counts = Array(12).fill(0), bass = Array(12).fill(0);
    for (const [role, bars] of Object.entries(patterns)) {
      for (const event of bars[bar] || []) {
        const overlap = Math.min(event.at+event.duration,at+2)-Math.max(event.at,at);
        if (overlap<=0 || !event.sourceNotes) continue;
        for (const note of event.sourceNotes) {
          const pc = (note % 12 + 12) % 12;
          counts[pc] += overlap / Math.sqrt(event.sourceNotes.length);
          if (role==="bass") bass[pc] += overlap;
        }
      }
    }
    const present = counts.map((value, pc) => ({value,pc})).filter(item=>item.value>.035).sort((a,b)=>b.value-a.value);
    if (!present.length) return null;
    const candidates = [];
    for (const {pc:root} of present) for (const shape of shapes) {
      const notes=shape.map(interval=>(root+interval)%12);
      if (notes.slice(1).some(note=>counts[note]<.07)) continue;
      const score=notes.reduce((sum,note)=>sum+counts[note],0)+bass[root]*1.7;
      candidates.push({root,notes,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const best=candidates[0];
    if (!best || present.length<2) {
      const root=bass.some(Boolean)?bass.indexOf(Math.max(...bass)):present[0].pc;
      return {root,notes:[root]};
    }
    const {root,notes}=best;
    const extension=[10,11,2].map(interval=>(root+interval)%12)
      .find(note=>!notes.includes(note)&&counts[note]>=Math.max(.18,present[0].value*.24));
    return {root,notes:extension===undefined?notes:[...notes,extension]};
  });
}

const supportingRoles = {
  psytrance:["lead_synth","pad","percussion_texture"], techno:["keys_mallet","percussion_texture","pad"],
  jungle:["strings","keys_mallet","pad"], dubstep:["counter_synth","percussion_texture","pad","lead_synth"],
  chiptune:["counter_synth","keys_mallet","pad","lead_synth"], dark_ambient:["strings","keys_mallet","pad","counter_synth"],
  synthwave:["pad","strings","keys_mallet","counter_synth"], garage_2step:["pad","percussion_texture","counter_synth","strings"],
};

function supportingPart(guide, template, mode, role) {
  const {familyId,version,production}=template;
  const minor=mode==="minor";
  const chordRole=role==="pad" || role==="strings";
  let previous = [];
  return Array.from({length:8}, (_, bar) => {
    // Supporting parts enter after the opening, then leave space around the
    // breakdown. Dubstep keeps harmony behind the bass drop.
    if (bar===0 || (bar===1&&!production.dense) || (familyId==="dubstep" && chordRole && ![2,4,5,7].includes(bar))) return [];
    if (role==="percussion_texture") {
      const positions=familyId==="garage_2step" ? [.83,2.33,3.67]
        : familyId==="dubstep" ? [1.25,3.25] : [.5,1.75,3.5];
      if (familyId==="dubstep" && bar!==3 && bar!==7) return [];
      return positions.filter((_,i)=>!minor || (i+bar)%3!==1).map((at,i)=>({
        at:Math.round(at*12)/12,duration:.14,notes:[i===0?75:82],sourceVelocity:57+i*9,
      }));
    }
    return [0,1].flatMap(half=>{
      const chord=guide[bar*2+half] || guide.find(Boolean);
      if (!chord) return [];
      const intervals=template.sourceMode==="major"?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
      const fifth=(chord.root+7)%12;
      const supportsFifth=intervals.includes((fifth-template.sourceTonic+12)%12);
      const anchors=chord.notes.length>1?chord.notes:supportsFifth?[chord.root,fifth]:chord.notes;
      if (chordRole) {
        if (half===0 && bar%2===0 && role==="strings") return [];
        const notes=anchors.map((pc,i)=>{
          const options=[48+pc,60+pc,72+pc].filter(n=>n>=48+i*4&&n<=67+i*5);
          const target=previous[i]??(i===0&&minor?52:57+i*5);
          return options.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
        });
        previous=notes;
        const garage=familyId==="garage_2step";
        return [{at:half*2+(garage?(minor?.75:.5):0),duration:garage?.39:(minor?1.9:1.56),
          sourceNotes:notes,sourceVelocity:familyId==="dubstep"?54:64}];
      }
      const onsets=familyId==="dark_ambient"?[1.5]:familyId==="dubstep"?[1.25]
        : familyId==="garage_2step"?[.75,1.67]:minor?[.75,1.5]:[.25,1.33,1.75];
      return onsets.slice(0,bar%3===1?1:undefined).map((offset,i)=>({
        at:half*2+Math.round(offset*12)/12,
        duration:familyId==="dark_ambient"?.42:Math.min(2-offset,minor?.29:.14),
        sourceNotes:[(role==="counter_synth"?60:72)+anchors[(i+half+version+bar)%anchors.length]],
        sourceVelocity:Math.min(80,60+bar*2+i*5),
      }));
    });
  });
}

export function buildPerformanceCatalog(catalog) {
  const families = catalog.families.map(family => ({
    ...family, visualProfile:visualProfiles[family.id],
    ...(family.id==="dubstep"?{bpmRange:[138,146]}:{}),
  }));
  const templates = catalog.templates.map(raw => {
    const production = productionTemplate(raw);
    if (raw.familyId==="dubstep") {
      production.bpmRange=[138,146];
      production.previewBpm=140+2*((raw.version-1)%3);
    }
    const modeVariants=Object.fromEntries(["major","minor"].map(mode=>{
      const variant=performanceVariant(production,mode);
      variant.chordGuide=harmonyGuide(variant.patterns);
      for (const role of supportingRoles[variant.familyId]) {
        if (variant.activeRoles.length>=6 || variant.activeRoles.includes(role)) continue;
        const bars=supportingPart(variant.chordGuide,variant,mode,role);
        if (bars.some(events=>events.length)) {
          variant.patterns[role]=bars;
          variant.activeRoles.push(role);
          variant.source.supplementalRoles=[...new Set([...variant.source.supplementalRoles,role])];
        }
      }
      return [mode,variant];
    }));
    return {...production,modeVariants};
  });
  return {...catalog,families,templates};
}
