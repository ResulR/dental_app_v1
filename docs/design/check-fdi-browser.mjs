/* CDP smoke test of the synthetic local FDI prototype; existing Chromium only. */
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import vm from "node:vm";
import {pathToFileURL} from "node:url";

assert.equal(process.getuid(),1002);
const base = path.resolve("docs/design");
const context = {globalThis:{}};
vm.runInNewContext(fs.readFileSync(path.join(base,"fdi-model.js"),"utf8"),context);
const model=context.globalThis.DentalFdi;
assert.equal(model.fdi.length,32);
assert.equal(new Set(model.fdi).size,32);
for (const tooth of model.fdi) {
  const empty={};
  const normal=model.change(empty,tooth);
  assert.equal(empty[tooth],undefined);
  assert.equal(normal[tooth],"normal");
  const pontic=model.change(normal,tooth);
  assert.equal(pontic[tooth],"pontic");
  assert.deepEqual(Object.keys(model.change(pontic,tooth)),[]);
}
assert.throws(()=>model.change({},19));
assert.throws(()=>model.next("invalid"));
assert.equal(model.entries({}).length,0);
console.log("OK logique synthétique : 32 FDI, cycles, état vide, refus FDI/état invalides, entrée non mutée.");

const qa=path.join(base,".browser-qa");
fs.mkdirSync(qa,{recursive:true,mode:0o700});
const profile=fs.mkdtempSync(path.join(qa,"fdi-"));
fs.chmodSync(profile,0o700);
const chrome=spawn("/usr/bin/chromium",[
  "--headless","--disable-gpu","--disable-background-networking","--disable-component-update",
  "--disable-sync","--disable-default-apps","--disable-extensions","--no-first-run",
  "--no-default-browser-check","--renderer-process-limit=1","--remote-debugging-pipe",
  "--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","pipe","pipe","pipe","pipe"],detached:true});
let stderr="",buffer="",serial=0,exited=false;
const pending=new Map();
chrome.stderr.on("data",x=>{stderr=(stderr+x.toString()).slice(-4000);});
chrome.on("exit",(code,signal)=>{
  exited=true;
  for (const p of pending.values()) {clearTimeout(p.timer);p.reject(new Error("Chromium exited "+code+"/"+signal));}
  pending.clear();
});
chrome.stdio[4].on("data",chunk=>{
  buffer+=chunk.toString();
  while(buffer.includes("\0")){
    const at=buffer.indexOf("\0"),raw=buffer.slice(0,at);buffer=buffer.slice(at+1);
    if(!raw)continue;
    const msg=JSON.parse(raw),p=pending.get(msg.id);
    if(p){clearTimeout(p.timer);pending.delete(msg.id);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}
  }
});
function send(method,params={},sessionId){
  return new Promise((resolve,reject)=>{
    if(exited){reject(new Error("Chromium already exited"));return;}
    const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error("CDP timeout: "+method));},8000);
    pending.set(id,{resolve,reject,timer});
    chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+"\0");
  });
}
let session;
async function evaluate(expression){
  const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true},session);
  if(result.exceptionDetails)throw new Error("Prototype evaluation failed");
  return result.result.value;
}
const deadline=setTimeout(()=>{try{process.kill(-chrome.pid,"SIGTERM");}catch{}},30000);
const report={scope:"synthetic_prototype_only",physical_device_test:false,screen_reader_test:false,logic:"passed",browser:"not_validated",checks:[]};
try{
  const target=await send("Target.createTarget",{url:"about:blank"});
  session=(await send("Target.attachToTarget",{targetId:target.targetId,flatten:true})).sessionId;
  await send("Page.enable",{},session);
  await send("Emulation.setDeviceMetricsOverride",{width:375,height:1200,deviceScaleFactor:1,mobile:true},session);
  await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1},session);
  await send("Page.navigate",{url:pathToFileURL(path.join(base,"fdi-preview.html")).href},session);
  let loaded=false;
  for(let n=0;n<30;n++){
    loaded=await evaluate("document.readyState==='complete' && !!globalThis.DentalFdi && document.querySelectorAll('[data-fdi]').length===32");
    if(loaded)break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(loaded,true);
  async function state(tooth){return evaluate("document.querySelector('[data-fdi=\""+tooth+"\"]').dataset.state");}
  for(const expected of ["normal","pontic","none"]){
    const pt=await evaluate("(()=>{const e=document.querySelector('[data-fdi=\"11\"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...pt,radiusX:1,radiusY:1,force:1,id:1}]},session);
    await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]},session);
    assert.equal(await state(11),expected);
  }
  report.checks.push("three emulated touches: normal/pontic/none once each");
  await evaluate("document.querySelector('[data-fdi=\"21\"]').focus()");
  for(const [key,code,vk,expected] of [["Enter","Enter",13,"normal"],[" ","Space",32,"pontic"],[" ","Space",32,"none"]]){
    await send("Input.dispatchKeyEvent",{type:"keyDown",key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk},session);
    await send("Input.dispatchKeyEvent",{type:"keyUp",key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk},session);
    assert.equal(await state(21),expected);
  }
  report.checks.push("native Enter/Space cycle");
  for(const width of [375,768,1024]){
    await send("Emulation.setDeviceMetricsOverride",{width,height:1200,deviceScaleFactor:1,mobile:width<1024},session);
    const dimensions=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('[data-fdi]')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,label:e.getAttribute('aria-label')}))})");
    assert.ok(dimensions.scroll<=dimensions.width);
    assert.equal(dimensions.targets.length,32);
    assert.ok(dimensions.targets.every(r=>r.w>=44 && r.h>=44 && r.label));
    report.checks.push("layout "+width+": 32 labelled targets >=44px, no horizontal overflow");
  }
  assert.equal(await evaluate("document.querySelectorAll('[data-state=normal],[data-state=pontic]').length"),0);
  assert.equal(await evaluate("document.querySelector('#selection-summary').getAttribute('role')"),"status");
  report.browser="passed_emulation_only";
  console.log("OK navigateur : "+report.checks.join("; "));
}catch(error){
  report.browser="blocked_or_failed";
  report.failure=String(error.message);
  report.chromium_stderr=stderr;
  console.error("BLOCAGE test Chromium avec sandbox conservé : "+error.message);
  console.error(stderr);
  process.exitCode=1;
}finally{
  clearTimeout(deadline);
  if(!exited){try{await send("Browser.close");}catch{}}
  if(!exited){try{process.kill(-chrome.pid,"SIGTERM");}catch{}}
  fs.writeFileSync(path.join(qa,"fdi-result.json"),JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log("Rapport privé : docs/design/.browser-qa/fdi-result.json");
}
