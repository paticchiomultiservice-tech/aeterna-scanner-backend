import {WORK_COPY} from './work-copy.js';
import {exportCapsuleBackup,importCapsuleBackup,MAX_BACKUP_BYTES} from './capsule-backup.mjs';
import {blankCapsuleDraft,buildCapsule,capsuleBasis,reviewCapsules,recordCapsuleEvent,exportCapsuleRegister,importCapsuleRegister,capsuleRegisterBudget,exportCapsuleRegisterParts,MAX_QR_BYTES} from './capsule-model.mjs';
import {CAPSULE_COPY} from './capsule-copy.js';
import {compileContinuity} from './continuity-compiler.mjs';
import {qrcodegen} from './qrcodegen.mjs';
import {EXTRA_COPY} from './extra-copy.js';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function capsuleSvg(text){
 const bytes=new TextEncoder().encode(text);if(bytes.length>MAX_QR_BYTES)throw Error('CAPSULE_TOO_LARGE');
 const segments=[qrcodegen.QrSegment.makeEci(26),qrcodegen.QrSegment.makeBytes(Array.from(bytes))];
 const qr=qrcodegen.QrCode.encodeSegments(segments,qrcodegen.QrCode.Ecc.MEDIUM),border=4,size=qr.size+border*2;
 const paths=[];for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))paths.push(`M${x+border},${y+border}h1v1h-1z`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${paths.join('')}" fill="black"/></svg>`;
}

export function capsuleHtml(copy){
 const locale=Object.hasOwn(CAPSULE_COPY,copy.locale)?copy.locale:'it',c=CAPSULE_COPY[locale];
 return `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AETERNA · ${h(c.title)}</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#151515;background:white;margin:24px auto;padding:20px;max-width:800px}h1{font-size:24px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;border-top:2px solid #333;padding-top:16px}svg{width:76mm;height:76mm;display:block;max-width:100%;margin:20px auto}small{display:block;margin-top:20px}h1,svg,pre{break-inside:avoid}@media print{body{margin:0;padding:10mm}}</style><h1>AETERNA · ${h(c.title)}</h1><p>${h(c.publicNotice||c.warning)}</p><pre>${h(copy.text)}</pre>${capsuleSvg(copy.text)}<small>${h(c.plain.network)}</small></html>`;
}

export function createCapsulePanel({getPassport,getLanguage=()=> 'it',now=()=>new Date().toISOString(),rerender=()=>{},getDeviceStore=()=>null,getDeviceAvailability=()=> 'unavailable',getFolder=()=>null}){
 let draft=blankCapsuleDraft(),copies=[],opened=false,approved=false,message='',preview=null,epoch=0,phoneDefaultApplied=false,pendingRegister='',advancedOpen=false,registerParts=[],partSnapshot='',downloadedParts=new Set(),confirmedArchive='';
 const snapshot=()=>JSON.stringify({draft,copies});
 let savedRegister=snapshot();
 let device=null,deviceRevision=null,deviceSavedSnapshot='',deviceSavedAt=null,deviceEnabled=false,deviceStatus='idle',deviceWorkFound=false,deviceEpoch=0,deviceQueue=Promise.resolve(),deviceBusy=0,lastRoot=null,deviceUnsubscribe=null;
 let folder=null,folderBusy=false,folderEpoch=0,folderRows=[],folderMessage='';
 const urls=new Set();
 const locale=()=>Object.hasOwn(CAPSULE_COPY,getLanguage())?getLanguage():'it';
 const c=()=>CAPSULE_COPY[locale()],e=()=>c().plain,w=()=>WORK_COPY[locale()];
 const fieldKeys=['name','contact','instruction'];
 const button=(label,attrs='',disabled=false)=>`<button type="button" class="core-button" ${attrs} ${disabled?'disabled':''}>${h(label)}</button>`;
 function update(){
  const p=getPassport();if(!p)return;
  if(!phoneDefaultApplied&&draft.scenario==='phone'&&p.continuity?.primaryPhoneId){
   const pristine=snapshot()===savedRegister&&!copies.length&&JSON.stringify(draft)===JSON.stringify(blankCapsuleDraft());
   if(draft.scenario==='phone'&&p.continuity?.primaryPhoneId)draft.excludedResourceIds=[p.continuity.primaryPhoneId];
   phoneDefaultApplied=true;
   // A proposed initial value is not a deliberate edit. Later edits still compare against this baseline.
   if(pristine)savedRegister=snapshot();
  }
  const beforeReview=snapshot();copies=reviewCapsules(copies,p,draft,locale());if(snapshot()!==beforeReview)persistDevice();
  try{
   const basis=capsuleBasis(draft,p,locale());
   if(!preview||preview.sourceBasis!==basis){preview=buildCapsule(draft,p,{id:crypto.randomUUID().replaceAll('-','').slice(0,12),createdAt:now(),locale:locale()});approved=false;}
  }catch{preview=null;}
 }
 function download(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));urls.add(url);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},10000);
 }
 function deviceError(error){
  deviceEnabled=false;deviceSavedSnapshot='';
  const invalid=['CAPSULE_DEVICE_INVALID','CAPSULE_DEVICE_TOO_LARGE'].includes(error?.code);if(invalid){deviceRevision=null;deviceWorkFound=true;}
  deviceStatus=error?.code==='CAPSULE_DEVICE_CONFLICT'?'conflict':invalid?'invalid':'error';
 }
 function restoreDevice(record){
  draft=record.draft;copies=record.copies;deviceRevision=record.revision;deviceSavedAt=record.savedAt;phoneDefaultApplied=true;
  approved=false;preview=null;invalidateArchive();opened=true;deviceEnabled=true;deviceWorkFound=true;
  deviceSavedSnapshot=snapshot();deviceStatus='resumed';message='';
 }
 function checkDevice(){
  const available=getDeviceStore();if(!available||available===device)return;
  deviceUnsubscribe?.();device=available;deviceRevision=null;deviceEnabled=false;deviceSavedSnapshot='';deviceStatus='idle';
  try{
   const record=device.load();deviceWorkFound=Boolean(record);
   if(record){deviceRevision=record.revision;deviceSavedAt=record.savedAt;
    const pristine=snapshot()===savedRegister&&!copies.length&&!draft.selected.length&&!draft.inventoryIds.length&&fieldKeys.every(key=>draft.values[key]==='');
    if(pristine)restoreDevice(record);else deviceStatus='found';
   }
  }catch(error){deviceWorkFound=error?.code==='CAPSULE_DEVICE_INVALID';deviceError(error);}
  const version=deviceEpoch;
  deviceUnsubscribe=device.subscribe?.(()=>{if(version!==deviceEpoch)return;deviceEnabled=false;deviceSavedSnapshot='';deviceWorkFound=true;deviceStatus='conflict';refreshDevice();})||null;
 }
 function deviceText(){
  if(!device)return getDeviceAvailability()==='loading'?e().deviceLoading:e().deviceUnavailable;
  return ({idle:e().deviceIntro,found:e().deviceFound,saving:e().deviceSaving,saved:e().deviceSaved,resumed:e().deviceResumed,conflict:e().deviceConflict,invalid:e().deviceInvalid,error:e().deviceError,forgotten:e().deviceForgotten})[deviceStatus]||e().deviceIntro;
 }
 function deviceControls(){return '<h5>'+h(e().deviceTitle)+'</h5><p id="capsule-device-feedback" role="status" aria-live="polite">'+h(deviceText())+'</p><p class="core-small">'+h(e().devicePrivacy)+'</p><div class="core-actions">'+button(e().deviceSave,'data-capsule-device-save',!device||deviceBusy>0)+(deviceWorkFound?button(e().deviceResume,'data-capsule-device-resume',!device||deviceBusy>0)+button(e().deviceForget,'data-capsule-device-forget',!device||deviceBusy>0):'')+'</div>';}
 function refreshDevice(){if(!lastRoot)return;const box=lastRoot.querySelector('#capsule-device-box');if(box){box.innerHTML=deviceControls();bindDevice(lastRoot);}}
 function persistDevice(){
  if(!deviceEnabled||!device)return;
  const store=device,version=deviceEpoch,state=snapshot(),value=JSON.parse(state);deviceBusy++;deviceStatus='saving';refreshDevice();
  deviceQueue=deviceQueue.catch(()=>{}).then(async()=>{
   if(version!==deviceEpoch||!deviceEnabled)return;
   if(state===deviceSavedSnapshot)return;
   const result=await store.save(value,{expectedRevision:deviceRevision});
   if(version!==deviceEpoch)return;
   deviceRevision=result.revision;deviceSavedAt=result.savedAt;deviceSavedSnapshot=state;deviceWorkFound=true;deviceStatus='saved';
  }).catch(error=>{if(version===deviceEpoch)deviceError(error);}).finally(()=>{if(version===deviceEpoch){deviceBusy--;refreshDevice();}});
 }
 function bindDevice(root){
  root.querySelector('[data-capsule-device-save]')?.addEventListener('click',async()=>{
   if(!device||deviceBusy)return;const version=deviceEpoch;
   try{
    const record=await device.load();if(version!==deviceEpoch)return;
    if(record&&(!deviceEnabled||record.revision!==deviceRevision)&&!window.confirm(e().deviceReplaceConfirm))return;
    deviceRevision=record?.revision??null;deviceEnabled=true;deviceWorkFound=Boolean(record);persistDevice();
   }catch(error){if(version===deviceEpoch){deviceError(error);refreshDevice();}}
  });
  root.querySelector('[data-capsule-device-resume]')?.addEventListener('click',async()=>{
   if(!device||deviceBusy)return;const version=deviceEpoch;
   try{
    const record=await device.load();if(version!==deviceEpoch)return;
    if(!record){deviceWorkFound=false;deviceEnabled=false;deviceSavedSnapshot='';deviceStatus='forgotten';refreshDevice();return;}
    if(snapshot()!==deviceSavedSnapshot&&(copies.length||fieldKeys.some(key=>draft.values[key]))&&!window.confirm(e().deviceResumeConfirm))return;
    restoreDevice(record);rerender();
   }catch(error){if(version===deviceEpoch){deviceError(error);refreshDevice();}}
  });
  root.querySelector('[data-capsule-device-forget]')?.addEventListener('click',async()=>{
   if(!device||deviceBusy||!window.confirm(e().deviceForgetConfirm))return;const version=deviceEpoch;deviceBusy++;refreshDevice();
   try{await device.remove({expectedRevision:deviceRevision});if(version!==deviceEpoch)return;deviceEnabled=false;deviceSavedSnapshot='';deviceRevision=null;deviceWorkFound=false;deviceStatus='forgotten';}
   catch(error){if(version===deviceEpoch)deviceError(error);}
   finally{if(version===deviceEpoch){deviceBusy--;refreshDevice();}}
  });
 }
 function folderControls(){
  folder=getFolder();const state=folder?.getState();
  const status=(folderMessage||(state?.connected?e().folderConnected:e().folderIntro))+(state?.connected&&!state?.remembered?' '+e().folderTemporary:'');
  return '<h5>'+h(e().folderTitle)+'</h5><p id="capsule-folder-feedback" role="status" aria-live="polite">'+h(folder?status:e().folderUnsupported)+'</p><div class="core-actions">'+button(state?.connected?e().folderReconnect:e().folderConnect,'data-capsule-folder-connect',!folder||folderBusy)+button(e().folderSave,'data-capsule-folder-save',!folder||folderBusy)+button(e().folderList,'data-capsule-folder-list',!folder||folderBusy)+'</div><p class="core-small">'+h(e().folderHelp)+'</p><div id="capsule-backup-list">'+(folderRows.length?folderRows.map(row=>'<article class="capsule-copy"><strong>'+h(e().folderBackup)+' · '+h(new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'medium'}).format(new Date(row.lastModified)))+' · '+h(row.name.slice(-13,-5))+'</strong><p class="core-small">'+h(row.name)+'</p>'+button(e().folderOpen,'data-capsule-folder-open="'+h(row.name)+'"',folderBusy)+'</article>').join(''):'')+'</div>';
 }
 function refreshFolder(){if(!lastRoot)return;const box=lastRoot.querySelector('#capsule-folder-box');if(box){box.innerHTML=folderControls();bindFolder(lastRoot);}}
 function folderError(error){folderMessage=error?.code==='CAPSULE_FOLDER_CANCELLED'?e().folderCancelled:error?.code==='CAPSULE_FOLDER_PERMISSION'?e().folderPermission:e().folderError;}
 async function connectFolder(){
  folder=getFolder();if(!folder||folderBusy)return;const version=folderEpoch;
  // Calling connect starts the native picker before any asynchronous UI work.
  const operation=folder.connect();folderBusy=true;refreshFolder();
  try{await operation;if(version!==folderEpoch)return;folderRows=[];folderMessage=e().folderConnected;}
  catch(error){if(version===folderEpoch)folderError(error);}
  finally{if(version===folderEpoch){folderBusy=false;refreshFolder();}}
 }
 async function saveFolder(){
  folder=getFolder();if(!folder||folderBusy)return;const current=folder,version=folderEpoch;
  try{
   update();const state=snapshot(),text=exportCapsuleBackup({draft,copies});
   // First setup is a deliberate user action, and starts at Desktop.
   const connect=current.getState().connected?null:current.connect();folderBusy=true;folderMessage=e().folderSaving;refreshFolder();
   if(connect)await connect;if(version!==folderEpoch)return;
   const saved=await current.save(text);if(version!==folderEpoch)return;
   let rows=[];try{rows=await current.list();}catch{}if(version!==folderEpoch)return;folderRows=rows;
   pendingRegister=state;partSnapshot=state;registerParts=[];downloadedParts.clear();folderMessage=e().folderSaved+' '+saved.name;message=e().folderSaved;opened=true;rerender();
  }catch(error){if(version===folderEpoch)folderError(error);}
  finally{if(version===folderEpoch){folderBusy=false;refreshFolder();}}
 }
 async function listFolder(){
  folder=getFolder();if(!folder||folderBusy)return;const current=folder,version=folderEpoch;
  const connect=current.getState().connected?null:current.connect();folderBusy=true;refreshFolder();
  try{if(connect)await connect;if(version!==folderEpoch)return;const rows=await current.list();if(version!==folderEpoch)return;folderRows=rows;folderMessage=folderRows.length?e().folderChoose:e().folderEmpty;}
  catch(error){if(version===folderEpoch)folderError(error);}
  finally{if(version===folderEpoch){folderBusy=false;refreshFolder();}}
 }
 function adoptBackup(parsed){
  draft=parsed.draft;copies=parsed.copies;phoneDefaultApplied=true;approved=false;preview=null;invalidateArchive();savedRegister=snapshot();persistDevice();message=c().imported;opened=true;
 }
 function bindFolder(root){
  root.querySelector('[data-capsule-folder-connect]')?.addEventListener('click',()=>void connectFolder());
  root.querySelector('[data-capsule-folder-save]')?.addEventListener('click',()=>void saveFolder());
  root.querySelector('[data-capsule-folder-list]')?.addEventListener('click',()=>void listFolder());
  root.querySelectorAll('[data-capsule-folder-open]').forEach(el=>el.onclick=async()=>{
   const name=el.dataset.capsuleFolderOpen;if(folderBusy||!folder||!folderRows.some(row=>row.name===name))return;const version=folderEpoch;folderBusy=true;refreshFolder();
   try{const text=await folder.read(name);if(version!==folderEpoch)return;const parsed=importCapsuleBackup(text);if(!window.confirm(e().importConfirm+' '+e().register))return;adoptBackup(parsed);folderMessage=e().folderOpened;rerender();}
   catch(error){if(version===folderEpoch)folderError(error);}
   finally{if(version===folderEpoch){folderBusy=false;refreshFolder();}}
  });
  root.querySelector('[data-capsule-backup-open]')?.addEventListener('click',()=>{if(getFolder())void listFolder();else root.querySelector('#capsule-register-import')?.click();});
  root.querySelector('[data-capsule-backup-other]')?.addEventListener('click',async()=>{
   const current=getFolder();if(!current){root.querySelector('#capsule-register-import')?.click();return;}
   const version=folderEpoch;try{const file=await current.pick();if(version!==folderEpoch)return;const parsed=importCapsuleBackup(file.text);if(!window.confirm(e().importConfirm+' '+e().register))return;adoptBackup(parsed);rerender();}catch(error){if(version===folderEpoch){folderError(error);refreshFolder();}}
  });
 }
 function missingReferences(){
  const p=getPassport();return {inventory:draft.inventoryIds.filter(id=>!p?.inventory.some(row=>row.id===id)),resources:draft.excludedResourceIds.filter(id=>!p?.continuity?.resources.some(row=>row.id===id))};
 }
 function hasMissingReferences(){const refs=missingReferences();return refs.inventory.length+refs.resources.length>0;}
 function invalidateArchive(){pendingRegister='';registerParts=[];partSnapshot='';downloadedParts.clear();confirmedArchive='';}
 function accept(nextDraft,nextCopies){
  const reviewed=reviewCapsules(nextCopies,getPassport(),nextDraft,locale());
  if(!capsuleRegisterBudget({draft:nextDraft,copies:reviewed}).fits){message=e().budgetFull;return false;}
  draft=nextDraft;copies=reviewed;invalidateArchive();persistDevice();return true;
 }
 function feedback(root){const el=root.querySelector('#capsule-feedback');if(el)el.textContent=message;}
 function repairControl(){return hasMissingReferences()?'<div class="core-note" role="status"><p>'+h(e().repairHelp)+'</p>'+button(e().repairAction,'data-capsule-repair')+'</div>':'';}
 function partsControls(){return registerParts.length>1?'<p>'+h(e().partsHelp)+'</p><div class="core-actions">'+registerParts.map((part,index)=>button(e().part+' '+(index+1)+' / '+registerParts.length+(downloadedParts.has(index)?' · '+e().partDownloaded:''),'data-capsule-register-part="'+index+'"')).join('')+'</div>':'';}
 function budgetText(){const budget=capsuleRegisterBudget({draft,copies});return e().registerSpace+': '+Math.ceil(budget.safeBytes/budget.limit*100)+'%. '+(budget.fits?e().budgetHelp:e().budgetFull);}
 function canRotate(){return copies.length>0&&confirmedArchive===snapshot()&&savedRegister===snapshot();}
 const labelInventory=(p,id)=>{const row=p.inventory.find(v=>v.id===id);return row?`${EXTRA_COPY[locale()].services[row.service]} · ${p.inventory.indexOf(row)+1}`:id;};
 const readableDate=value=>new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 function copyList(){
  if(!copies.length)return '<p>'+h(e().noCopies)+'</p>';
  return copies.map(copy=>{
   const stale=copy.needsReview,state=c().copyStates[copy.copyState],proof=c().proofStates[copy.proof.status];
   const next=copy.copyState==='generated'?'printed':copy.copyState==='printed'?'delivered':null;
   return '<article class="capsule-copy '+(stale?'capsule-stale':'')+'"><strong>'+h(c().copyId)+' '+h(copy.id)+'</strong><p>'+h(state)+' · '+h(proof)+'</p><small>'+h(e().copyDate)+': '+h(readableDate(copy.createdAt))+(copy.events?.length?' · '+h(e().lastEvent)+': '+h(readableDate(copy.events.at(-1).at)):'')+'</small><p>'+h(stale?c().reviewNeeded:e().copyHints[copy.copyState])+'</p><div class="core-actions">'+(next?button(c().actions[next],'data-capsule-event="'+next+'" data-capsule-id="'+copy.id+'"',stale):'')+(copy.copyState==='delivered'?['success','failure','unknown'].map(event=>button(c().actions[event],'data-capsule-event="'+event+'" data-capsule-id="'+copy.id+'"',stale)).join(''):'')+(copy.copyState!=='replaced'?button(c().actions.replaced,'data-capsule-event="replaced" data-capsule-id="'+copy.id+'"'):'')+'</div></article>';
  }).join('');
 }
 const stepHeading=index=>'<div class="capsule-step-heading"><span aria-hidden="true">'+(index+1)+'</span><div><h5 id="capsule-step-'+(index+1)+'" tabindex="-1">'+h(e().steps[index].title)+'</h5><p>'+h(e().steps[index].help)+'</p></div></div>';
 function render(){
  checkDevice();update();const p=getPassport();if(!p)return '';
  const fields=fieldKeys.map(key=>{
   const help=e().fieldHelp[key],base='capsule-help-'+key;
   return '<div class="capsule-field"><label class="capsule-include-label"><input id="capsule-include-'+key+'" type="checkbox" data-capsule-include="'+key+'" aria-describedby="'+base+' '+base+'-example" '+(draft.selected.includes(key)?'checked':'')+'> <span>'+h(c().labels[key])+' <small>'+h(e().optional)+'</small></span></label><div class="capsule-field-entry"><p id="'+base+'">'+h(help.write)+' '+h(help.why)+'</p><input id="capsule-value-'+key+'" data-capsule-value="'+key+'" type="text" maxlength="'+({name:60,contact:100,instruction:160}[key])+'" value="'+h(draft.values[key])+'" aria-label="'+h(c().labels[key])+'" aria-describedby="'+base+' '+base+'-example" autocomplete="off" spellcheck="false"><p id="'+base+'-example" class="capsule-example">'+h(e().exampleLabel)+': '+h(help.example)+'</p></div></div>';
  }).join('');
  const advanced='<details class="capsule-advanced" id="capsule-advanced" '+(advancedOpen?'open':'')+'><summary>'+h(e().advancedTitle)+'</summary><p>'+h(e().advancedHelp)+'</p><fieldset><legend>'+h(c().inventoryTitle)+'</legend><p id="capsule-inventory-help">'+h(e().inventoryHelp)+'</p>'+p.inventory.map(row=>'<label class="capsule-target"><input type="checkbox" data-capsule-target="'+row.id+'" aria-describedby="capsule-inventory-help" '+(draft.inventoryIds.includes(row.id)?'checked':'')+'> '+h(labelInventory(p,row.id))+'</label>').join('')+'</fieldset><label for="capsule-resource">'+h(e().selection)+'</label><p id="capsule-resource-help">'+h(e().resourceHelp)+'</p><select id="capsule-resource" aria-describedby="capsule-resource-help"><option value="">'+h(e().none)+'</option>'+(p.continuity?.resources||[]).map((row,index)=>'<option value="'+row.id+'" '+(draft.excludedResourceIds.includes(row.id)?'selected':'')+'>'+h(e().kind[row.kind])+' '+(index+1)+(row.inventoryId?' · '+h(labelInventory(p,row.inventoryId)):'')+'</option>').join('')+'</select><p class="core-small">'+h(e().model)+'</p><div id="capsule-analysis"></div></details>';
  return '<section class="core-card capsule-panel" aria-labelledby="capsule-title"><p class="core-eyebrow">AETERNA · '+h(c().title)+'</p><h4 id="capsule-title">'+h(c().title)+'</h4><p>'+h(c().intro)+'</p><p class="core-note">'+h(c().warning)+'</p><details id="capsule-device-tools" class="work-tools"><summary>'+h(w().device)+'</summary><section id="capsule-device-box" class="capsule-device-box" aria-label="'+h(e().deviceTitle)+'">'+deviceControls()+'</section></details><details id="capsule-file-tools" class="work-tools"><summary>'+h(w().capsuleTools)+'</summary><section id="capsule-folder-box" class="capsule-device-box" aria-label="'+h(e().folderTitle)+'">'+folderControls()+'</section></details>'+button(opened?e().close:e().open,'data-capsule-toggle aria-expanded="'+opened+'" aria-controls="capsule-builder"')+(opened?'<div class="capsule-builder" id="capsule-builder"><p class="capsule-session">'+h(e().session)+'</p><ol class="capsule-roadmap">'+e().steps.map((step,index)=>'<li>'+h((index+1)+'. '+step.title)+'</li>').join('')+'</ol><section class="capsule-step">'+stepHeading(0)+'<label for="capsule-scenario">'+h(e().scenarioTitle)+'</label><p id="capsule-scenario-help">'+h(e().scenarioHelp)+' '+h(e().scenarioExample)+'</p><select id="capsule-scenario" aria-describedby="capsule-scenario-help">'+Object.entries(c().scenarios).map(([id,label])=>'<option value="'+id+'" '+(draft.scenario===id?'selected':'')+'>'+h(label)+'</option>').join('')+'</select><p class="capsule-selection-help">'+h(c().selectFields)+'</p>'+fields+'<div id="capsule-repair">'+repairControl()+'</div>'+advanced+'<div class="core-actions">'+button(e().nextPreview,'data-capsule-jump="2"')+'</div></section><section class="capsule-step">'+stepHeading(1)+'<h6>'+h(c().previewTitle)+'</h6><pre id="capsule-preview" class="capsule-preview"></pre><div class="capsule-meter"><label for="capsule-space">'+h(e().spaceUsed)+'</label><progress id="capsule-space" max="'+MAX_QR_BYTES+'" value="0" aria-describedby="capsule-byte-count"></progress><p id="capsule-byte-count" aria-live="polite"></p></div><details class="capsule-technical" id="capsule-technical"><summary>'+h(e().technicalTitle)+'</summary><p>'+h(e().technicalHelp)+'</p><p id="capsule-byte-detail" class="core-small"></p></details><label class="capsule-approval"><input id="capsule-approve" type="checkbox" '+(approved?'checked':'')+'> '+h(e().approval)+'</label><div class="core-actions">'+button(e().backWrite,'data-capsule-jump="1"')+button(e().nextSave,'data-capsule-jump="3"')+'</div></section><section class="capsule-step">'+stepHeading(2)+'<p>'+h(e().downloadHelp)+'</p><div class="core-actions">'+button(w().save,'data-work-save-capsule')+button(c().actions.generate,'data-capsule-generate',!approved||!preview)+'</div><details id="capsule-advanced-save" class="work-tools"><summary>'+h(w().capsuleTools)+'</summary><p>'+h(e().saveHelp)+'</p><p id="capsule-register-budget" class="core-note">'+h(budgetText())+'</p><div class="core-actions">'+button(c().actions.export,'data-capsule-register-export')+(pendingRegister?button(e().confirmSaved,'data-capsule-register-confirm'):'')+button(c().actions.import,'data-capsule-backup-open')+button(e().folderOther,'data-capsule-backup-other')+'<input id="capsule-register-import" type="file" accept="application/json,.json" aria-label="'+h(e().folderOther)+'" class="capsule-file"></div><p class="core-note">'+h(e().register)+'</p><div id="capsule-register-parts">'+partsControls()+'</div><p>'+h(e().rotateHelp)+'</p>'+button(e().rotateAction,'data-capsule-register-rotate',!canRotate())+'<p id="capsule-feedback" role="status" aria-live="polite">'+h(message)+'</p></details><div class="core-actions">'+button(e().nextTest,'data-capsule-jump="4"')+'</div></section><section class="capsule-step">'+stepHeading(3)+'<h6>'+h(c().registerTitle)+'</h6><p>'+h(c().registerHelp)+'</p><p>'+h(e().check)+'</p><div id="capsule-copies">'+copyList()+'</div></section></div>':'')+'</section>';
 }
 function updatePreview(root){
  update();const area=root.querySelector('#capsule-preview'),count=root.querySelector('#capsule-byte-count');
  let error='';if(!preview){try{buildCapsule(draft,getPassport(),{id:'000000000000',createdAt:now(),locale:locale()});}catch(err){error=err.message;}}
  const previewError=hasMissingReferences()?e().repairHelp:error==='CAPSULE_TOO_LARGE'?c().tooLarge:error==='CAPSULE_EMPTY'?c().empty:e().error;
  if(area)area.textContent=preview?.text||previewError;
  const bytes=preview?new TextEncoder().encode(preview.text).length:0,percent=Math.ceil(bytes/MAX_QR_BYTES*100);
  if(count)count.textContent=preview?e().spaceUsed+': '+percent+'%. '+(percent>=85?e().spaceNear:e().spaceRoom):previewError;
  const meter=root.querySelector('#capsule-space');if(meter)meter.value=bytes;
  const detail=root.querySelector('#capsule-byte-detail');if(detail)detail.textContent=preview?bytes+' / '+MAX_QR_BYTES+' '+c().bytesLabel:'';
  const check=root.querySelector('#capsule-approve');if(check)check.checked=approved;
  const generate=root.querySelector('[data-capsule-generate]');if(generate)generate.disabled=!approved||!preview;
  const analysis=root.querySelector('#capsule-analysis');
  if(analysis&&!draft.excludedResourceIds.length){analysis.textContent=e().selection+' — '+e().none;}else if(analysis){try{const a=compileContinuity(getPassport(),{targetInventoryIds:draft.inventoryIds,excludedResourceIds:draft.excludedResourceIds});analysis.innerHTML=a.results.map(row=>`<p>${h(labelInventory(getPassport(),row.inventoryId))}: <strong>${h(({declared_route:e().route,unknown:e().unknown,blocked:e().blocked})[row.status])}</strong></p>`).join('');}catch{analysis.textContent=e().error;}}
  const budget=root.querySelector('#capsule-register-budget');if(budget)budget.textContent=budgetText();
  const repair=root.querySelector('#capsule-repair');if(repair){repair.innerHTML=repairControl();bindRepair(root);}
  const parts=root.querySelector('#capsule-register-parts');if(parts){parts.innerHTML=partsControls();bindParts(root);}
  const rotate=root.querySelector('[data-capsule-register-rotate]');if(rotate)rotate.disabled=!canRotate();
  const confirm=root.querySelector('[data-capsule-register-confirm]');if(confirm)confirm.disabled=!pendingRegister;
  feedback(root);
  const list=root.querySelector('#capsule-copies');if(list){list.innerHTML=copyList();bindCopyEvents(root);}
 }
 function bindCopyEvents(root){root.querySelectorAll('[data-capsule-event]').forEach(el=>el.onclick=()=>{
  if(!window.confirm(e().confirm))return;
  try{const next=copies.map(copy=>copy.id===el.dataset.capsuleId?recordCapsuleEvent(copy,el.dataset.capsuleEvent,now()):copy);if(accept(draft,next))message='';rerender();}catch{message=e().error;rerender();}
 });}
 function bindRepair(root){root.querySelector('[data-capsule-repair]')?.addEventListener('click',()=>{
  const missing=missingReferences(),next={...draft,inventoryIds:draft.inventoryIds.filter(id=>!missing.inventory.includes(id)),excludedResourceIds:draft.excludedResourceIds.filter(id=>!missing.resources.includes(id))};
  if(accept(next,copies)){approved=false;preview=null;message=e().repairDone;}rerender();
 });}
 function bindParts(root){root.querySelectorAll('[data-capsule-register-part]').forEach(el=>el.onclick=()=>{
  if(partSnapshot!==snapshot()){message=e().exportAgain;rerender();return;}
  const index=Number(el.dataset.capsuleRegisterPart);if(!Number.isInteger(index)||!registerParts[index])return;
  download('AETERNA-registro-capsule-parte-'+String(index+1).padStart(2,'0')+'-di-'+registerParts.length+'.json',registerParts[index],'application/json;charset=utf-8');
  downloadedParts.add(index);pendingRegister=downloadedParts.size===registerParts.length?partSnapshot:'';message=e().partsHelp;rerender();
 });}
 function changeDraft(next,root,restore){
  if(accept(next,copies)){approved=false;message='';}else restore?.();
  updatePreview(root);
 }
 function bind(root){
  lastRoot=root;bindDevice(root);bindFolder(root);
  root.querySelector('[data-capsule-toggle]')?.addEventListener('click',()=>{opened=!opened;rerender();});
  if(!opened)return;
  root.querySelector('#capsule-advanced')?.addEventListener('toggle',event=>{advancedOpen=event.target.open;});
  root.querySelectorAll('[data-capsule-jump]').forEach(el=>el.onclick=()=>{const target=root.querySelector('#capsule-step-'+el.dataset.capsuleJump);target?.focus?.({preventScroll:true});target?.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  root.querySelector('#capsule-scenario')?.addEventListener('change',ev=>{const next={...draft,scenario:ev.target.value,excludedResourceIds:ev.target.value==='phone'&&getPassport()?.continuity?.primaryPhoneId?[getPassport().continuity.primaryPhoneId]:[]};if(accept(next,copies)){phoneDefaultApplied=true;approved=false;message='';}rerender();});
  root.querySelectorAll('[data-capsule-include]').forEach(el=>el.onchange=()=>{const key=el.dataset.capsuleInclude;const next={...draft,selected:el.checked?[...new Set([...draft.selected,key])]:draft.selected.filter(v=>v!==key)};changeDraft(next,root,()=>{el.checked=draft.selected.includes(key);});});
  root.querySelectorAll('[data-capsule-value]').forEach(el=>el.oninput=()=>{const key=el.dataset.capsuleValue,next={...draft,values:{...draft.values,[key]:el.value}};changeDraft(next,root,()=>{el.value=draft.values[key];});});
  root.querySelectorAll('[data-capsule-target]').forEach(el=>el.onchange=()=>{const id=el.dataset.capsuleTarget;if(el.checked&&draft.inventoryIds.length>=3){el.checked=false;return;}const next={...draft,inventoryIds:el.checked?[...new Set([...draft.inventoryIds,id])]:draft.inventoryIds.filter(v=>v!==id)};changeDraft(next,root,()=>{el.checked=draft.inventoryIds.includes(id);});});
  root.querySelector('#capsule-resource')?.addEventListener('change',ev=>{const next={...draft,excludedResourceIds:ev.target.value?[ev.target.value]:[]};const previous=draft;changeDraft(next,root,()=>{ev.target.value=draft.excludedResourceIds[0]||'';});if(draft!==previous)phoneDefaultApplied=true;});
  root.querySelector('#capsule-approve')?.addEventListener('change',ev=>{approved=ev.target.checked;const b=root.querySelector('[data-capsule-generate]');if(b)b.disabled=!approved||!preview;});
  root.querySelector('[data-capsule-generate]')?.addEventListener('click',()=>{
   update();if(!approved||!preview)return;
   try{if(!copies.some(row=>row.id===preview.id)){if(copies.length>=20){message=e().budgetFull;rerender();return;}if(!accept(draft,[...copies,preview])){rerender();return;}}download(`AETERNA-Capsula-${preview.id}.html`,capsuleHtml(preview),'text/html;charset=utf-8');message=e().generated;rerender();}catch{message=e().error;rerender();}
  });
  root.querySelector('[data-capsule-register-export]')?.addEventListener('click',exportRegister);
  root.querySelector('[data-capsule-register-confirm]')?.addEventListener('click',()=>{if(!pendingRegister||pendingRegister!==snapshot())return;savedRegister=pendingRegister;confirmedArchive=pendingRegister;pendingRegister='';message=e().archiveSaved;rerender();});
  root.querySelector('[data-capsule-register-rotate]')?.addEventListener('click',()=>{if(!canRotate()||!window.confirm(e().rotateConfirm))return;copies=[];approved=false;preview=null;invalidateArchive();persistDevice();message=e().rotated;rerender();});
  root.querySelector('#capsule-register-import')?.addEventListener('change',async ev=>{
   const file=ev.target.files?.[0],version=++epoch;ev.target.value='';if(!file)return;
   try{if(file.size>MAX_BACKUP_BYTES)throw Error('Size');const parsed=importCapsuleBackup(await file.text());if(version!==epoch||!getPassport())return;if(!window.confirm(e().importConfirm+' '+e().register))return;draft=parsed.draft;copies=parsed.copies;phoneDefaultApplied=true;approved=false;preview=null;invalidateArchive();savedRegister=snapshot();persistDevice();message=capsuleRegisterBudget({draft,copies}).fits?c().imported:e().importParts;rerender();}catch{if(version!==epoch)return;message=e().error;rerender();}
  });
  bindRepair(root);bindParts(root);bindCopyEvents(root);updatePreview(root);
 }
 function exportRegister(){opened=true;if(getFolder()){void saveFolder();return;}try{
  update();registerParts=exportCapsuleRegisterParts({draft,copies});partSnapshot=snapshot();downloadedParts.clear();pendingRegister='';
  if(registerParts.length===1){download('AETERNA-registro-capsule.json',registerParts[0],'application/json;charset=utf-8');downloadedParts.add(0);pendingRegister=partSnapshot;message=e().saveDownloaded;}
  else message=e().partsHelp;
  rerender();
 }catch{message=e().error;rerender();}}
 function captureWork(){
  checkDevice();update();const key=snapshot();let archived=copies;
  if(approved&&preview&&!copies.some(row=>row.id===preview.id)&&copies.length<20){
   const next=[...copies,preview];if(capsuleRegisterBudget({draft,copies:next}).fits)archived=next;
  }
  return {key,...JSON.parse(JSON.stringify({draft,copies:archived}))};
 }
 function acceptWorkSave(capture){
  if(!capture||snapshot()!==capture.key)return false;
  copies=capture.copies;invalidateArchive();savedRegister=snapshot();confirmedArchive=savedRegister;persistDevice();return true;
 }
 function restoreWork(value){epoch++;folderEpoch++;folderBusy=false;adoptBackup(value);}
 function reset(){folderEpoch++;folder=null;folderBusy=false;folderRows=[];folderMessage='';deviceEpoch++;deviceUnsubscribe?.();deviceUnsubscribe=null;device=null;deviceRevision=null;deviceEnabled=false;deviceSavedSnapshot='';deviceSavedAt=null;deviceStatus='idle';deviceWorkFound=false;deviceBusy=0;deviceQueue=Promise.resolve();lastRoot=null;epoch++;draft=blankCapsuleDraft();copies=[];opened=false;approved=false;preview=null;message='';phoneDefaultApplied=false;invalidateArchive();advancedOpen=false;savedRegister=snapshot();for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
 return {render,bind,reset,exportRegister,captureWork,acceptWorkSave,restoreWork,hasUnsavedChanges:()=>snapshot()!==savedRegister&&snapshot()!==deviceSavedSnapshot};
}
