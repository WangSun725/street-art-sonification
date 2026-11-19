#!/usr/bin/env node
// Reuse the live note generator and AudioWorklet DSP; never compose a second
// version of the music just for the review recordings.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { productionTemplate, buildPerformanceCatalog } from "../webapp/static/genre-production.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = path.join(ROOT,"webapp/static");
const appSource = fs.readFileSync(path.join(STATIC,"app.js"),"utf8");
const workletSource = fs.readFileSync(path.join(STATIC,"fm-worklet.js"),"utf8");
const sourceLibrary = isMainThread ? process.argv.includes("--genre") : workerData.sourceLibrary;
const production = isMainThread ? process.argv.includes("--production") : workerData.production;
const performanceRound = isMainThread ? process.argv.includes("--performance") : workerData.performanceRound;
const catalogSource = fs.readFileSync(path.join(STATIC,performanceRound ? "genre-templates-garage.js" : sourceLibrary ? "genre-templates.js" : "music-templates.js"),"utf8");
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const SAMPLE_RATE = 48000;

function applicationContext(override = null) {
  const ctx=vm.createContext({
    document:{querySelector:()=>({getContext(){},closest(){},value:70}),querySelectorAll:()=>[]},
    window:{},location:{protocol:"http:",host:"localhost"},
    performance:{now:()=>0,timeOrigin:0},console,
  });
  vm.runInContext(catalogSource,ctx);
  if(sourceLibrary)ctx.window.StreetArtTemplates=ctx.window.StreetArtGenreTemplates;
  if(performanceRound) {
    if(override)ctx.window.StreetArtTemplates.templates=[override];
    else ctx.window.StreetArtTemplates=buildPerformanceCatalog(ctx.window.StreetArtTemplates);
  } else if(production)ctx.window.StreetArtTemplates.templates=ctx.window.StreetArtTemplates.templates.map(productionTemplate);
  vm.runInContext(appSource.split("scanPlay.addEventListener")[0],ctx);
  return ctx;
}

function writeJSON(file,value) {
  const tmp=file+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(value,null,2));
  fs.renameSync(tmp,file);
}

function buildEventScore(template,mode,bars) {
  const ctx=applicationContext(performanceRound ? template : null);
  ctx.previewTemplate=template;
  ctx.previewMode=mode;
  ctx.previewBars=bars;
  return vm.runInContext(`(()=>{
    state.arrangement.choice=previewTemplate.id;
    const family=TEMPLATE_CATALOG.families.find(f=>f.id===previewTemplate.familyId);
    const maxWeight=Math.max(...Object.values(family.gems),1);
    const weights=Object.fromEntries(Object.entries(family.gems).map(([key,value])=>[key,value/maxWeight]));
    state.gems=normalizeGemsProfile({weights});
    const bpm=previewTemplate.previewBpm??Math.round((family.bpmRange[0]+family.bpmRange[1])/4)*2;
    state.music={bpm,root:'C',mode:previewMode};
    const visual={brightness:.5,saturation:.55,hue:.4,texture:.3};
    const production=previewTemplate.production;
    const positions={
      lead_synth:[.5,.34],counter_synth:[.62,.46],drums:[.5,.55],bass:[.45,.82],
      guitar:[.25,.5],pad:[.5,.65],strings:[.75,.45],keys_mallet:[.65,.25],percussion_texture:[.35,.62],
    };
    const regions=INSTRUMENT_ROLES.filter(instrument=>!previewTemplate.activeRoles||previewTemplate.activeRoles.includes(instrument.id)).map((instrument,index)=>({
      id:'preview_'+instrument.id,index:index+1,label:instrument.label,type:'figure',
      area_ratio:1/9,color_rgb:[128,152,166],instrument,
    }));
    state.regions=regions;
    const messages=[],events=[];
    const engine=new SoundEngine();
    engine.audioEpochMs=0;
    engine.fmNode={port:{postMessage:m=>messages.push(m)}};
    function cueAt(region,beat){
      const [x]=positions[region.instrument.id];
      if(!production)return {x,visual,speed:0};
      const section=Math.min(3,Math.floor(beat/8));
      const opening=[.15,.68,.24,.83][section];
      const wave=.5-.5*Math.cos(beat*Math.PI/4);
      return {
        x:clampUnit(x+(wave-.5)*(production.dense?.24:.16)),
        visual:{
          brightness:clampUnit(opening+wave*.16+(production.bright?.07:-.07)),
          saturation:clampUnit([.22,.66,.42,.78][section]+(production.dense?.1:-.1)),
          hue:.4,
          texture:clampUnit([.19,.56,.32,.79][section]+(production.broken?.12:-.08)),
        },
        speed:clampUnit([.05,.42,.15,.62][section]+wave*.18),
      };
    }
    function controlsAt(region,beat,accent=false){
      const cue=cueAt(region,beat);
      return performanceControls(region,cue.visual,cue.x,cue.speed,1,accent);
    }
    for(let bar=0;bar<previewBars;bar++)for(const region of regions){
      const role=region.instrument.id;
      const [,y]=positions[role];
      const library=previewTemplate.patterns[role];
      for(const pattern of library[bar%library.length]){
        const beat=bar*4+pattern.at;
        const cue=cueAt(region,beat);
        const event=musicEventForRegion(region,cue.x,y,beat+1e-7,cue.speed,1,false,cue.visual);
        if(!event.notes.length)continue;
        const controls=controlsAt(region,beat,event.accent);
        const item={...event,regionId:region.id,instrumentId:role,channel:region.instrument.midiChannel,
          onsetBeat:beat,scheduledAtMs:beat*60000/bpm,controls,mix:1};
        events.push(item);
        engine.playPatternEvent(region,item,cue.x,cue.speed);
      }
    }
    const controlFrame=beat=>regions.flatMap(region=>{
      if(previewTemplate.chordGuide && !events.some(event=>event.regionId===region.id &&
        event.onsetBeat<=beat+.35 && event.onsetBeat+event.durationBeats>=beat-.20))return [];
      return [{regionId:region.id,mix:1,controls:controlsAt(region,beat)}];
    });
    const controls=controlFrame(0);
    const automation=production?Array.from({length:previewBars*8},(_,index)=>{
      const beat=index*.5;
      return {seconds:beat*60/bpm,events:controlFrame(beat)};
    }):null;
    return {bpm,root:'C',mode:previewMode,bars:previewBars,musicSeconds:previewBars*4*60/bpm,
      totalSeconds:previewBars*4*60/bpm+4,events,messages,controls,automation,
      gemsWeights:state.gems.weights,regions:regions.map(r=>({id:r.id,mix:1})),
      template:{id:previewTemplate.id,fx:previewTemplate.fx,production:previewTemplate.production}};
  })()`,ctx);
}

function encodeMidi(score) {
  const ppq=9600;
  const vlq=value=>{
    const bytes=[value&127];
    while((value>>>=7)>0)bytes.unshift((value&127)|128);
    return Buffer.from(bytes);
  };
  const chunk=(type,body)=>{
    const size=Buffer.alloc(4);size.writeUInt32BE(body.length);
    return Buffer.concat([Buffer.from(type),size,body]);
  };
  const meta=(type,text)=>{const b=Buffer.from(text);return Buffer.concat([Buffer.from([255,type]),vlq(b.length),b]);};
  const track=events=>{
    events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
    let previous=0;
    return chunk("MTrk",Buffer.concat([...events.map(e=>{
      const delta=vlq(Math.max(0,e.tick-previous));previous=e.tick;return Buffer.concat([delta,e.data]);
    }),Buffer.from([0,255,47,0])]));
  };
  const tempo=Buffer.alloc(3);tempo.writeUIntBE(Math.round(60000000/score.bpm),0,3);
  const tracks=[track([
    {tick:0,order:0,data:meta(3,"Arrangement audition - C "+score.mode)},
    {tick:0,order:1,data:Buffer.concat([Buffer.from([255,81,3]),tempo])},
    {tick:0,order:2,data:Buffer.from([255,88,4,4,2,24,8])},
    {tick:0,order:3,data:Buffer.from([255,89,2,score.mode==="minor"?253:0,score.mode==="minor"?1:0])},
  ])];
  const ccMap={movement:1,pan:10,expression:11,harmonicIntensity:71,release:72,attack:73,brightness:74,reverb:91,chorus:93,delay:94};
  for(let channel=1;channel<=9;channel++){
    const notes=score.events.filter(e=>e.channel===channel);
    const events=[{tick:0,order:0,data:meta(3,notes[0]?.instrumentId||"track_"+channel)}];
    const controlFrames=score.automation && notes.length
      ? score.automation.map(frame=>({tick:Math.round(frame.seconds*score.bpm/60*ppq),
          controls:frame.events.find(event=>event.regionId===notes[0].regionId)?.controls}))
      : [{tick:0,controls:notes[0]?.controls}];
    const previousControls=new Map();
    for(const frame of controlFrames)for(const [name,number] of Object.entries(ccMap)){
      const value=Math.round((frame.controls?.[name]??0)*127);
      if(previousControls.get(number)===value)continue;
      previousControls.set(number,value);
      events.push({tick:frame.tick,order:1,data:Buffer.from([175+channel,number,value])});
    }
    for(const event of notes)for(const note of event.notes){
      events.push({tick:Math.round(event.onsetBeat*ppq),order:3,data:Buffer.from([143+channel,note,event.noteVelocities?.[note]??event.velocity])});
      events.push({tick:Math.round((event.onsetBeat+event.durationBeats)*ppq),order:2,data:Buffer.from([127+channel,note,0])});
    }
    tracks.push(track(events));
  }
  const header=Buffer.alloc(6);header.writeUInt16BE(1,0);header.writeUInt16BE(tracks.length,2);header.writeUInt16BE(ppq,4);
  return Buffer.concat([chunk("MThd",header),...tracks]);
}

function renderDry(job,folder,bars) {
  const begin=Date.now();
  const score=buildEventScore(job.template,job.mode,bars);
  const messages=score.messages;
  let randomState=Number.parseInt(sha(job.id).slice(0,8),16)||1;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const math=Object.create(Math);math.random=random;
  // Compile trusted local worklet code with lexical Web Audio globals. Keeping
  // millions of DSP Math calls outside a VM proxy makes batch rendering fast.
  const Processor=new Function("sampleRate","AudioWorkletProcessor","registerProcessor","Math",workletSource+"\nreturn StreetArtFMProcessor;")(
    SAMPLE_RATE,class{constructor(){this.port={onmessage:null};}},()=>{},math,
  );
  const processor=new Processor();
  processor.handleMessage({type:"mix",regions:score.regions});
  for(const message of messages)processor.handleMessage(message);
  const frames=Math.ceil(score.totalSeconds*SAMPLE_RATE);
  const pcm=Buffer.alloc(frames*8);
  const block=[new Float32Array(128),new Float32Array(128)];
  let peak=0,energy=0;
  let automationIndex=0;
  for(let frame=0;frame<frames;frame+=128){
    if(score.automation){
      const current=score.automation[automationIndex];
      if(current && current.seconds*SAMPLE_RATE<=frame){
        processor.handleMessage({type:"expression",regions:current.events.map(event=>({id:event.regionId,controls:event.controls}))});
        automationIndex++;
      }
    }
    processor.process([],[block]);
    for(let i=0;i<Math.min(128,frames-frame);i++)for(let channel=0;channel<2;channel++){
      const value=block[channel][i];
      if(!Number.isFinite(value))throw new Error(job.id+": non-finite audio");
      peak=Math.max(peak,Math.abs(value));energy+=value*value;
      pcm.writeFloatLE(value,(frame+i)*8+channel*4);
    }
  }
  const header=Buffer.alloc(44);header.write("RIFF");header.writeUInt32LE(pcm.length+36,4);header.write("WAVEfmt ",8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(3,20);header.writeUInt16LE(2,22);header.writeUInt32LE(SAMPLE_RATE,24);
  header.writeUInt32LE(SAMPLE_RATE*8,28);header.writeUInt16LE(8,32);header.writeUInt16LE(32,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(path.join(folder,"dry",job.id+".wav"),Buffer.concat([header,pcm]));
  fs.writeFileSync(path.join(folder,"midi",job.id+".mid"),encodeMidi(score));
  writeJSON(path.join(folder,"scores",job.id+".json"),score);
  return {id:job.id,seconds:score.totalSeconds,bpm:score.bpm,dryPeak:peak,dryRms:Math.sqrt(energy/(frames*2)),eventCount:score.events.length,noteCount:messages.length,renderSeconds:(Date.now()-begin)/1000};
}

function writeNativeEffects(folder) {
  // Extract the live Web Audio graph and automation methods. Offline rendering
  // only injects OfflineAudioContext and replaces the FM worklet with the exact
  // dry waveform rendered above; the effects/returns/master are unchanged.
  let setup=appSource.slice(appSource.indexOf("  async setupAudioGraph() {"),appSource.indexOf("  beatSeconds() {",appSource.indexOf("  async setupAudioGraph() {")));
  setup=setup.replace(/    const AudioContextClass = window.AudioContext \|\| window.webkitAudioContext;\n    this.context = new AudioContextClass\(\);\n/,"");
  setup=setup.replace(/    await this.context.audioWorklet.addModule[\s\S]*?    this.fmNode.connect\(this.musicBus\);\n/,"");
  if(setup.includes("AudioWorkletNode")||setup.includes("new AudioContextClass"))throw new Error("Live graph extraction needs updating");
  const control=appSource.slice(appSource.indexOf("  applyControlFrame(events) {"),appSource.indexOf("  update(payload) {",appSource.indexOf("  applyControlFrame(events) {")))
    .replace("const now = this.context.currentTime;","const now = this.controlTime ?? this.context.currentTime;");
  fs.writeFileSync(path.join(folder,"render-graph.js"),`// Extracted from app.js ${sha(appSource)}\nwindow.createPreviewGraph = async function(context,score){
    const clampUnit=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
    const currentArrangement=()=>score.template;
    class PreviewGraph {
      constructor(){this.context=context;this.outputLevel=.7;this.chorusDepths=[];this.effectMemory={reverb:.3,chorus:.3,delay:.3,movement:0,feedback:.32,chorusDepth:.3,effectTone:.5};}
      beatSeconds(){return 60/score.bpm;}
      ${setup}\n${control}
    }
    const graph=new PreviewGraph();await graph.setupAudioGraph();
    return graph;
  };\n`);
}

async function main() {
  const args=process.argv.slice(2);
  const get=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
  const round=Number(get("--round","1"));
  if(!Number.isInteger(round)||round<1||round>99)throw new Error("Round must be 1-99");
  const bars=Number(get("--bars","16"));
  if(![4,8,16].includes(bars))throw new Error("Use 4, 8 or 16 bars");
  if(performanceRound&&!production)throw new Error("--performance requires --production");
  if(production&&(!sourceLibrary||bars!==8))throw new Error("--production requires --genre --bars 8");
  const workers=Math.max(1,Math.min(4,Number(get("--workers","2"))));
  const roundName="round-"+String(round).padStart(2,"0");
  const base=path.join(ROOT,"webapp/runtime/arrangement-review");
  const folder=path.join(base,roundName);
  for(const sub of ["dry","audio","midi","scores"])fs.mkdirSync(path.join(folder,sub),{recursive:true});
  const ctx=applicationContext();
  const catalog=vm.runInContext("TEMPLATE_CATALOG",ctx);
  const prefix="/runtime/arrangement-review/"+roundName;
  const jobs=catalog.templates.flatMap((base,index)=>["major","minor"].map(mode=>{
    const template=base.modeVariants?.[mode] || base;
    return {
    id:template.id+"-"+mode,templateId:template.id,name:template.name,familyId:template.familyId,
    familyName:catalog.families.find(f=>f.id===template.familyId).name,index:index+1,
    version:template.version,revision:round,mode,root:"C",bars,
    bpm:template.previewBpm??Math.round((template.bpmRange[0]+template.bpmRange[1])/4)*2,
    ...(template.source?{source:template.source,parts:template.activeRoles.length}:{}),
    ...(template.production?{production:template.production}:{}),
    dryUrl:prefix+"/dry/"+template.id+"-"+mode+".wav",
    scoreUrl:prefix+"/scores/"+template.id+"-"+mode+".json",
    audioUrl:prefix+"/audio/"+template.id+"-"+mode+".mp3",
    midiUrl:prefix+"/midi/"+template.id+"-"+mode+".mid",
    template,
  };}));
  const manifestPath=path.join(folder,"manifest.json");
  const prior=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,"utf8")):null;
  const fingerprints={app:sha(appSource),fm:sha(workletSource),catalog:sha(catalogSource),
    ...(production?{production:sha(fs.readFileSync(new URL("../webapp/static/genre-production.mjs",import.meta.url),"utf8")),
      renderer:sha(fs.readFileSync(fileURLToPath(import.meta.url),"utf8"))}:{})};
  if(prior&&JSON.stringify(prior.fingerprints)!==JSON.stringify(fingerprints))throw new Error("Source changed: use a new round to preserve reviewed audio");
  const manifest={round,createdAt:prior?.createdAt||new Date().toISOString(),fingerprints,sampleRate:SAMPLE_RATE,bars,
    conditions:{root:"C",modes:["major","minor"],parts:sourceLibrary?"source-dependent, nine output channels":9,regionGating:false,visual:{brightness:.5,saturation:.55,hue:.4,texture:.3},gems:"family prototype",masterVolume:.7,effects:"live native Web Audio graph",exportLimiterDb:-1,...(sourceLibrary?{library:"CC0 source MIDI"}:{})},
    families:catalog.families,items:jobs.map(({template,...item})=>item)};
  if(production){
    manifest.conditions.production=true;
    manifest.conditions.performance=performanceRound;
    manifest.conditions.visual="Scripted performance over eight bars";
    manifest.selection=vm.runInContext("TEMPLATE_VARIANT_FEATURES",ctx);
  }
  writeJSON(manifestPath,manifest);
  if(!args.includes("--no-activate"))writeJSON(path.join(base,"current.json"),{round,folder:roundName});
  writeNativeEffects(folder);
  const limit=Number(get("--limit","0"));
  const ids=get("--ids","").split(",").filter(Boolean);
  let queue=jobs.filter(job=>(!ids.length||ids.includes(job.id))&&!fs.existsSync(path.join(folder,"audio",job.id+".mp3"))&&!fs.existsSync(path.join(folder,"dry",job.id+".wav")));
  if(sourceLibrary)queue.sort((a,b)=>a.version-b.version||a.index-b.index);
  if(limit>0)queue=queue.slice(0,limit);
  let complete=jobs.filter(job=>fs.existsSync(path.join(folder,"audio",job.id+".mp3"))||fs.existsSync(path.join(folder,"dry",job.id+".wav"))).length;
  const progressFile=path.join(folder,"dry-progress.json");
  writeJSON(progressFile,{total:jobs.length,ready:complete,running:true});
  async function runner(){
    while(queue.length){
      const job=queue.shift();
      const result=await new Promise((resolve,reject)=>{
        const worker=new Worker(fileURLToPath(import.meta.url),{workerData:{job,folder,bars,sourceLibrary,production,performanceRound}});
        worker.once("message",resolve);worker.once("error",reject);worker.once("exit",code=>{if(code)reject(new Error("Renderer exited "+code));});
      });
      complete++;
      writeJSON(progressFile,{total:jobs.length,ready:complete,running:queue.length>0,last:result});
      process.stdout.write(JSON.stringify(result)+"\n");
    }
  }
  await Promise.all(Array.from({length:workers},runner));
  const ready=jobs.filter(j=>fs.existsSync(path.join(folder,"dry",j.id+".wav"))||fs.existsSync(path.join(folder,"audio",j.id+".mp3"))).length;
  writeJSON(progressFile,{total:jobs.length,ready,running:false});
  console.log(`Dry previews ready: ${ready}/${jobs.length}. Render the native effects at /review/render.`);
}

if(isMainThread)await main();
else parentPort.postMessage(renderDry(workerData.job,workerData.folder,workerData.bars));
