import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildPerformanceCatalog } from "./static/genre-production.mjs";

const read = file => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const ctx = vm.createContext({
  assert, console, window: {}, location: {protocol:"http:",host:"localhost"},
  document: { querySelector:()=>({getContext(){},closest(){},value:70}),querySelectorAll:()=>[] },
  performance: {now:()=>1000,timeOrigin:0},
});
vm.runInContext(read("./static/genre-templates-garage.js"),ctx);
const catalog = buildPerformanceCatalog(ctx.window.StreetArtGenreTemplates);
assert.equal(catalog.templates.length,64);
assert.ok(catalog.families.some(family=>family.id==="garage_2step"));
assert.ok(!catalog.families.some(family=>family.id==="electro_rock"));
const rhythm = pattern => JSON.stringify(pattern?.map(bar=>bar.map(event=>[event.at,event.duration])));
for (const family of catalog.families) {
  const templates = catalog.templates.filter(template=>template.familyId===family.id);
  assert.equal(new Set(templates.map(t=>JSON.stringify(t.modeVariants.major.patterns))).size,8);
  for (const {id,modeVariants:{major,minor}} of templates) {
    assert.ok(major.activeRoles.some(role=>!["drums","percussion_texture"].includes(role)
      && rhythm(major.patterns[role])!==rhythm(minor.patterns[role])),
      id + " needs a distinct pitched rhythm in each mode");
    for (const variant of [major,minor]) {
      assert.ok(variant.activeRoles.length>=6);
      for (const role of variant.activeRoles) for (const event of variant.patterns[role].flat()) {
        assert.ok(event.at>=0 && event.at<4 && Math.abs(event.at*12-Math.round(event.at*12))<.002);
        assert.ok(event.duration>0);
        assert.ok((event.sourceNotes||event.notes).every(note=>Number.isInteger(note)&&note>=0&&note<128));
      }
    }
  }
}
ctx.window.StreetArtTemplates=catalog;
vm.runInContext(read("./static/app.js").split("scanPlay.addEventListener")[0],ctx);
vm.runInContext(`
  assert.equal(state.scan.duration,30);
  assert.equal(state.mode,"scan");
  state.manifest = {music_plan:{features:{brightness:.61,saturation:.67,edge_energy:.20,contrast:.36}}};
  selectArrangement();
  const first = state.arrangement.scores[0];
  assert.ok(Math.abs(first.score - (.75 * first.visual + .25 * first.emotion))<1e-10);
  assert.ok(state.arrangement.autoId.endsWith("_07"));
  state.arrangement.choice="dubstep_08";
  state.music = {bpm:140,root:"C",mode:"minor"};
  const arrangement = currentArrangement();
  assert.equal(arrangement.production.mode,"minor");
  const makeRegion = id => ({id,type:"figure",index:1,label:id,
    instrument:INSTRUMENT_ROLES.find(r=>r.id===id),area_ratio:.2,color_rgb:[80,140,200]});
  const region = makeRegion("bass");
  const dark = {brightness:.05,saturation:.1,texture:.1};
  const bright = {brightness:.95,saturation:.9,texture:.9};
  const bassEvent = musicEventForRegion(region,.5,.5,.0001,0,1,false,dark);
  assert.ok(bassEvent.notes.every(note=>note>=28&&note<=39));
  assert.ok(bassEvent.wobbleRate>=1);
  const old = performanceControls(region,dark,.4,0,1);
  const moved = performanceControls(region,bright,.8,1,1);
  assert.ok(moved.delay>old.delay && moved.effectTone>old.effectTone);
  // Pixel texture must change within the same region. These two masks are
  // identical; only the texture of the pixels on the right side is different.
  const size=80, pixels=new Uint8ClampedArray(size*size*4), mask=new Uint8ClampedArray(pixels.length).fill(255);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const value=x<size/2 ? 128 : (y%2 ? 224 : 32);
    pixels.fill(value,(y*size+x)*4,(y*size+x)*4+3);
  }
  const profile=buildScanProfile(mask,size,size,{width:size,height:size,data:pixels});
  const smooth=scanProfileAt({scanProfile:profile},.2);
  const rough=scanProfileAt({scanProfile:profile},.8);
  assert.ok(Math.abs(smooth.brightness-rough.brightness)<.01);
  assert.ok(rough.texture>smooth.texture+.5);
  const smoothControls=performanceControls(region,smooth,.2,.3,1);
  const roughControls=performanceControls(region,rough,.8,.3,1);
  assert.ok(roughControls.harmonicIntensity>smoothControls.harmonicIntensity+.25);
  assert.ok(roughControls.feedback>smoothControls.feedback+.1);
  state.effectTrims.delay=0;
  assert.equal(performanceControls(region,bright,.8,1,1).delay,0);
  assert.ok(performanceControls(makeRegion("pad"),dark,.4,0,1).reverb>old.reverb);
  state.regions=[region,makeRegion("drums")];
  state.scan.playing=true;
  state.scan.startedAt=1000;
  soundEngine.enabled=true;
  // Loaded regions hold a pixel mask. Note events should carry only the
  // controls derived from it.
  region.hitData=new Uint8ClampedArray(850*1030*4);
  state.scan.regions=state.regions.map(region=>({region,intensity:1,centroidY:.5,
    hue:.6,hueFamilyIndex:4,colorRgb:region.color_rgb,...bright}));
  const {activeVoices, scheduledEvents: events}=performanceFrame();
  const encoded=JSON.stringify({activeVoices, events});
  assert.ok(encoded.length<16_000, "The note events must stay small");
  assert.ok(!encoded.includes("hitData"), "Note events must never contain image masks");
  assert.equal(activeVoices[0].timbre.brightness,bright.brightness);
  assert.ok(events.some(event=>event.instrumentId==="bass"&&event.notes.length));
  assert.ok(events.some(event=>event.instrumentId==="drums"&&event.notes.includes(36)));
`,ctx);
console.log("64 live arrangements, distinct Major/Minor rhythms, shared grid, style scoring, bass and effects OK");
