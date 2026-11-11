// Explicit public selections and local copy declarations. No network, persistence or provider actions.
import {validatePassport,SERVICES} from './extra-model.mjs';
import {compileContinuity} from './continuity-compiler.mjs';
import {CAPSULE_COPY} from './capsule-copy.js';
import {CAPSULE_PUBLIC_V1_COPY} from './capsule-public-v1.mjs';

export const DRAFT_SCHEMA='aeterna.capsule-draft.v1';
export const PUBLIC_SCHEMA='aeterna.capsule.public.v1';
export const REGISTER_SCHEMA='aeterna.capsule-register.v1';
export const MAX_QR_BYTES=600;
export const MAX_REGISTER_BYTES=65536;
export const MAX_COPIES=20;
export const MAX_EVENTS=30;
export const FIELDS=['name','contact','instruction'];
export const SCENARIOS=['phone','network','helper','provider'];
export const COPY_STATES=['generated','printed','delivered','replaced'];
export const PROOF_STATES=['unrecorded','declared_success','declared_failure','declared_unknown','needs_review'];
const LIMITS={name:60,contact:100,instruction:160};
const INVENTORY_ID=/^item_[a-z0-9-]{8,40}$/;
const RESOURCE_ID=/^resource_[a-z0-9-]{8,40}$/;
const COPY_ID=/^[a-f0-9]{12}$/;
const PROOF_EVENT={success:'declared_success',failure:'declared_failure',unknown:'declared_unknown'};
const EVENT_NAMES=['generated','printed','delivered','replaced','success','failure','unknown'];
const utf8=value=>new TextEncoder().encode(value).length;
const fail=(code='INVALID_CAPSULE')=>{throw Error(code);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function exact(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(k=>!keys.includes(k))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail();
  return value;
}
function array(value,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)fail();
  const own=Reflect.ownKeys(value);
  if(own.length!==value.length+1||own.some(k=>k!=='length'&&(typeof k!=='string'||!/^(0|[1-9][0-9]*)$/.test(k)))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail();
  return value;
}
function choice(value,allowed){if(!allowed.includes(value))fail();return value;}
function string(value,max){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(value))fail();
  if(new TextDecoder().decode(new TextEncoder().encode(value))!==value)fail();
  return value;
}
function iso(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)<0||Date.parse(value)>Date.now())fail();
  return value;
}
function identifier(value,pattern){if(typeof value!=='string'||!pattern.test(value))fail();return value;}
function identifiers(value,max,pattern){
  const values=array(value,max).map(v=>identifier(v,pattern));
  if(new Set(values).size!==values.length)fail();
  return [...values].sort();
}
function locale(value){return choice(value,Object.keys(CAPSULE_COPY));}
function publicFields(draft){return FIELDS.filter(key=>draft.selected.includes(key)&&draft.values[key].trim()!=='').map(key=>[key,draft.values[key]]);}
function publicDraft(draft){return {...draft,values:Object.fromEntries(FIELDS.map(key=>[key,draft.selected.includes(key)?draft.values[key]:'']))};}

export function blankCapsuleDraft(){return {schema:DRAFT_SCHEMA,scenario:'phone',selected:[],values:{name:'',contact:'',instruction:''},inventoryIds:[],excludedResourceIds:[]};}
export function validateDraft(value){
  exact(value,['schema','scenario','selected','values','inventoryIds','excludedResourceIds']);
  if(value.schema!==DRAFT_SCHEMA)fail();
  const selected=array(value.selected,3).map(v=>choice(v,FIELDS));
  if(new Set(selected).size!==selected.length)fail();
  exact(value.values,FIELDS);
  return {schema:DRAFT_SCHEMA,scenario:choice(value.scenario,SCENARIOS),selected:FIELDS.filter(key=>selected.includes(key)),
    values:Object.fromEntries(FIELDS.map(key=>[key,string(value.values[key],LIMITS[key])])),
    inventoryIds:identifiers(value.inventoryIds,3,INVENTORY_ID),excludedResourceIds:identifiers(value.excludedResourceIds,24,RESOURCE_ID)};
}

function selection(draft,passport){
  const p=validatePassport(passport);
  const inventory=draft.inventoryIds.map((id,index)=>{
    const row=p.inventory.find(item=>item.id===id);
    if(!row)fail();
    return {id,service:row.service,ordinal:index+1};
  });
  const analysis=compileContinuity(p,{targetInventoryIds:draft.inventoryIds,excludedResourceIds:draft.excludedResourceIds});
  return {inventory,analysis};
}
export function capsuleBasis(value,passport,language='it'){
  const draft=validateDraft(value),lang=locale(language),{inventory,analysis}=selection(draft,passport);
  return JSON.stringify({schema:'aeterna.capsule-basis.v1',locale:lang,scenario:draft.scenario,fields:publicFields(draft),inventory,continuity:analysis.basis});
}
function capsuleText(draft,inventory,lang,id,createdAt){
  const copy=CAPSULE_PUBLIC_V1_COPY[lang],fields=publicFields(draft);
  return [`AETERNA · ${copy.title}`,`${copy.copyId}: ${id}`,`${copy.created}: ${createdAt}`,`${copy.scenarioLabel}: ${copy.scenarios[draft.scenario]}`,
    ...fields.map(([key,text])=>`${copy.labels[key]}: ${text}`),
    ...(inventory.length?[`${copy.inventoryTitle}: ${inventory.map(row=>`${copy.services[row.service]} ${row.ordinal}`).join('; ')}`]:[]),copy.publicNotice].join('\n');
}
export function buildCapsule(value,passport,{id,createdAt,locale:language='it'}={}){
  const draft=validateDraft(value),lang=locale(language);
  identifier(id,COPY_ID);iso(createdAt);
  const fields=publicFields(draft),{inventory}=selection(draft,passport);
  if(!fields.length&&!inventory.length)fail('CAPSULE_EMPTY');
  const text=capsuleText(draft,inventory,lang,id,createdAt);
  if(utf8(text)>MAX_QR_BYTES)fail('CAPSULE_TOO_LARGE');
  return {schema:PUBLIC_SCHEMA,id,createdAt,locale:lang,text,sourceBasis:capsuleBasis(draft,passport,lang),draft:publicDraft(draft),
    copyState:'generated',proof:{status:'unrecorded',declaredAt:null},needsReview:false,events:[{event:'generated',at:createdAt}]};
}

function validateBasis(value,draft,lang){
  string(value,MAX_REGISTER_BYTES);
  let basis;try{basis=JSON.parse(value);}catch{fail();}
  exact(basis,['schema','locale','scenario','fields','inventory','continuity']);
  if(basis.schema!=='aeterna.capsule-basis.v1'||basis.locale!==lang||basis.scenario!==draft.scenario||!equal(basis.fields,publicFields(draft)))fail();
  const rows=array(basis.inventory,3).map((row,index)=>{
    exact(row,['id','service','ordinal']);
    if(row.id!==draft.inventoryIds[index]||row.ordinal!==index+1)fail();
    return {id:identifier(row.id,INVENTORY_ID),service:choice(row.service,SERVICES),ordinal:row.ordinal};
  });
  if(rows.length!==draft.inventoryIds.length)fail();
  string(basis.continuity,MAX_REGISTER_BYTES);
  // A parsed register cannot authenticate this historic compiler state. Imported copies require review.
  if(!basis.continuity)fail();
  return basis;
}
function copyTransition(state,event){
  if(event==='printed'&&state==='generated')return 'printed';
  if(event==='delivered'&&state==='printed')return 'delivered';
  if(event==='replaced'&&state!=='replaced')return 'replaced';
  fail('CAPSULE_TRANSITION');
}
function validateCopy(value){
  exact(value,['schema','id','createdAt','locale','text','sourceBasis','draft','copyState','proof','needsReview','events']);
  if(value.schema!==PUBLIC_SCHEMA)fail();
  const id=identifier(value.id,COPY_ID),createdAt=iso(value.createdAt),lang=locale(value.locale),text=string(value.text,MAX_QR_BYTES);
  if(!text||utf8(text)>MAX_QR_BYTES)fail();
  const draft=validateDraft(value.draft);
  if(!equal(draft,publicDraft(draft)))fail();
  const basis=validateBasis(value.sourceBasis,draft,lang),sourceBasis=value.sourceBasis;
  if(text!==capsuleText(draft,basis.inventory,lang,id,createdAt))fail();
  const copyState=choice(value.copyState,COPY_STATES);
  if(typeof value.needsReview!=='boolean')fail();
  exact(value.proof,['status','declaredAt']);
  const proof={status:choice(value.proof.status,PROOF_STATES),declaredAt:value.proof.declaredAt===null?null:iso(value.proof.declaredAt)};
  const events=array(value.events,MAX_EVENTS).map(entry=>{
    exact(entry,['event','at']);return {event:choice(entry.event,EVENT_NAMES),at:iso(entry.at)};
  });
  if(!events.length||events[0].event!=='generated'||events[0].at!==createdAt)fail();
  let state='generated',declaredStatus='unrecorded',declaredAt=null,last=createdAt;
  for(const entry of events.slice(1)){
    if(Date.parse(entry.at)<Date.parse(last))fail();last=entry.at;
    if(Object.hasOwn(PROOF_EVENT,entry.event)){
      if(state!=='delivered')fail();
      declaredStatus=PROOF_EVENT[entry.event];declaredAt=entry.at;
    }else state=copyTransition(state,entry.event);
  }
  if(state!==copyState||proof.declaredAt!==declaredAt||proof.status!==(value.needsReview?'needs_review':declaredStatus))fail();
  return {schema:PUBLIC_SCHEMA,id,createdAt,locale:lang,text,sourceBasis,draft,copyState,proof,needsReview:value.needsReview,events};
}
function copies(value){
  const rows=array(value,MAX_COPIES).map(validateCopy);
  if(new Set(rows.map(row=>row.id)).size!==rows.length)fail();
  return rows;
}
export function reviewCapsules(value,passport,currentDraft,language='it'){
  const rows=copies(value),draft=validateDraft(currentDraft);locale(language);
  return rows.map(copy=>{
    // Each distributed copy keeps its own scenario and selection. Preparing a
    // different export does not make that earlier card obsolete by itself.
    const candidate={...copy.draft,values:{...copy.draft.values}};
    for(const key of copy.draft.selected)candidate.values[key]=draft.values[key];
    let basis=null;
    try{basis=capsuleBasis(candidate,passport,copy.locale);}catch{}
    const needsReview=copy.needsReview||basis!==copy.sourceBasis;
    return needsReview?{...copy,needsReview:true,proof:{...copy.proof,status:'needs_review'}}:copy;
  });
}
export function recordCapsuleEvent(value,event,at=new Date().toISOString()){
  const copy=validateCopy(value);iso(at);
  if(!EVENT_NAMES.includes(event)||event==='generated'||Date.parse(at)<Date.parse(copy.events.at(-1).at)||copy.events.length>=MAX_EVENTS)fail('CAPSULE_TRANSITION');
  if(copy.needsReview&&event!=='replaced')fail('CAPSULE_TRANSITION');
  let copyState=copy.copyState,proof=copy.proof;
  if(Object.hasOwn(PROOF_EVENT,event)){
    if(copyState!=='delivered')fail('CAPSULE_TRANSITION');
    proof={status:PROOF_EVENT[event],declaredAt:at};
  }else copyState=copyTransition(copyState,event);
  return validateCopy({...copy,copyState,proof,events:[...copy.events,{event,at}]});
}
function register(value){
  exact(value,['draft','copies']);
  return {schema:REGISTER_SCHEMA,draft:validateDraft(value.draft),copies:copies(value.copies)};
}

// Reserve the largest representation of EACH copy, not merely the result of
// reviewing all copies together: some statuses grow while others shrink. This
// keeps any subset of later review invalidations within the accepted budget.
function registerBudget(result){
  const text=JSON.stringify(result),bytes=utf8(text);
  const reservedBytes=result.copies.reduce((total,copy)=>{
    const reviewed={...copy,needsReview:true,proof:{...copy.proof,status:'needs_review'}};
    return total+Math.max(0,utf8(JSON.stringify(reviewed))-utf8(JSON.stringify(copy)));
  },0);
  const safeBytes=bytes+reservedBytes;
  return {bytes,safeBytes,reservedBytes,remainingBytes:Math.max(0,MAX_REGISTER_BYTES-safeBytes),
    limit:MAX_REGISTER_BYTES,copyCount:result.copies.length,copyLimit:MAX_COPIES,fits:safeBytes<=MAX_REGISTER_BYTES};
}

// Pure preflight: callers must run this BEFORE committing an edit, generation
// or event. It also inspects older oversized in-memory registers without losing
// the original state. Malformed data remains an error, never a size warning.
export function capsuleRegisterBudget(value){return registerBudget(register(value));}

export function exportCapsuleRegister(value){
  const result=register(value),text=JSON.stringify(result);
  if(utf8(text)>MAX_REGISTER_BYTES)fail('CAPSULE_REGISTER_TOO_LARGE');
  return text;
}

// Each part is an independently importable v1 register. Copy contents, historic
// source bases and events are never truncated or rewritten. Usually every part
// repeats the current private draft. If a single copy only fits with an empty
// draft, the first part preserves the full draft and the remaining parts carry
// the unchanged history with empty drafts. No merge or deletion is implicit.
export function exportCapsuleRegisterParts(value){
  const original=register(value);
  const pack=draft=>{
    const parts=[];
    let rows=[];
    for(const copy of original.copies){
      const candidate={schema:REGISTER_SCHEMA,draft,copies:[...rows,copy]};
      if(!registerBudget(candidate).fits){
        if(!rows.length)return null;
        parts.push(JSON.stringify({schema:REGISTER_SCHEMA,draft,copies:rows}));
        rows=[];
        if(!registerBudget({schema:REGISTER_SCHEMA,draft,copies:[copy]}).fits)return null;
      }
      rows.push(copy);
    }
    if(rows.length||!parts.length)parts.push(JSON.stringify({schema:REGISTER_SCHEMA,draft,copies:rows}));
    return parts;
  };
  const repeated=pack(original.draft);
  if(repeated)return repeated;
  const history=pack(blankCapsuleDraft());
  if(!history)fail('CAPSULE_REGISTER_COPY_TOO_LARGE');
  return [exportCapsuleRegister({draft:original.draft,copies:[]}),...history];
}

export function importCapsuleRegister(text){
  if(typeof text!=='string'||utf8(text)>MAX_REGISTER_BYTES)fail('CAPSULE_REGISTER_TOO_LARGE');
  let parsed;try{parsed=JSON.parse(text);}catch{fail();}
  exact(parsed,['schema','draft','copies']);
  if(parsed.schema!==REGISTER_SCHEMA)fail();
  const draft=validateDraft(parsed.draft),rows=copies(parsed.copies);
  const result={draft,copies:rows.map(copy=>({...copy,needsReview:true,proof:{...copy.proof,status:'needs_review'}}))};
  // A near-limit imported file may grow when its proofs need review. Ensure a
  // lossless export path exists BEFORE the caller replaces its current state.
  exportCapsuleRegisterParts(result);
  return result;
}
