import {blankJourney,validateJourney,importJourney,suggestedPhases,effectivePhaseStatus} from './core-model.mjs';
import {blankCare,validateCare} from './care-model.mjs';
import {blankContinuity,validateContinuity,invalidateContinuity,invalidateImportedContinuity} from './phone-model.mjs';

// Organisational categories only. No identifiers, credentials, purchased rights,
// provider tokens or biometric/medical data are accepted by this document.
export const SCHEMA='aeterna.passport.v3';
export const PHONE_SCHEMA='aeterna.passport.v4';
export const MAX_PASSPORT_BYTES=40000;
export const MAX_BYTES=65536;
export const SERVICES=['email','apple','google','microsoft','bank','social','cloud','business','other'];
export const ACCESS=['unknown','passkey','password_mfa','password_only','provider'];
export const RECOVERY=['unknown','same_device','other_device','offline','trusted_contact','provider'];
export const AGENTS=['chatgpt','copilot','gemini','claude','other'];
export const PURPOSES=['personal','family','work','creative'];
export const DELEGATION_STATES=['planned','declared','withdrawn'];
const fail=()=>{throw Error('INVALID_PASSPORT');};
function exact(o,keys){if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length||Reflect.ownKeys(o).some(k=>!keys.includes(k))||Object.values(Object.getOwnPropertyDescriptors(o)).some(v=>!Object.hasOwn(v,'value')))fail();return o;}
function iso(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail();return v;}
function array(v,max){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max||Reflect.ownKeys(v).length!==v.length+1||Reflect.ownKeys(v).some(k=>k!=='length'&&(typeof k!=='string'||!/^(0|[1-9]\d*)$/.test(k)))||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!Object.hasOwn(d,'value')))fail();return v;}
function choice(v,values){if(!values.includes(v))fail();return v;}
function id(v){if(typeof v!=='string'||!/^item_[a-z0-9-]{8,40}$/.test(v))fail();return v;}
function date(v){if(v==='')return v;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)!==v)fail();return v;}
function inventoryItem(value){const v=exact(value,['id','service','access','recovery','testedAt']);return {id:id(v.id),service:choice(v.service,SERVICES),access:choice(v.access,ACCESS),recovery:choice(v.recovery,RECOVERY),testedAt:v.testedAt===null?null:iso(v.testedAt)};}
function delegationItem(value){const v=exact(value,['id','agent','purpose','read','draft','externalAction','confirmation','until','state']);for(const k of ['read','draft','externalAction'])if(typeof v[k]!=='boolean')fail();if(v.confirmation!==true)fail();return {id:id(v.id),agent:choice(v.agent,AGENTS),purpose:choice(v.purpose,PURPOSES),read:v.read,draft:v.draft,externalAction:v.externalAction,confirmation:true,until:date(v.until),state:choice(v.state,DELEGATION_STATES)};}
export function blankPassport(now=new Date().toISOString()){return {schema:SCHEMA,updatedAt:iso(now),journey:blankJourney(now),inventory:[],delegations:[],care:blankCare()};}
export function validatePassport(input){const phone=input?.schema===PHONE_SCHEMA,p=exact(input,['schema','updatedAt','journey','inventory','delegations','care',...(phone?['continuity']:[])]);if(![SCHEMA,PHONE_SCHEMA].includes(p.schema))fail();const updatedAt=iso(p.updatedAt),journey=validateJourney(p.journey);if(Date.parse(journey.updatedAt)>Date.parse(updatedAt))fail();const inventory=array(p.inventory,12).map(inventoryItem),delegations=array(p.delegations,8).map(delegationItem),care=validateCare(p.care,updatedAt);if(new Set(inventory.map(x=>x.id)).size!==inventory.length||new Set(delegations.map(x=>x.id)).size!==delegations.length)fail();if(inventory.some(x=>x.testedAt&&Date.parse(x.testedAt)>Date.parse(updatedAt)))fail();const result={schema:p.schema,updatedAt,journey,inventory,delegations,care};if(phone){result.continuity=validateContinuity(p.continuity,inventory,updatedAt);if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_PASSPORT_BYTES)fail();}return result;}
export function upgradePassport(p){const copy=validatePassport(p);return copy.schema===PHONE_SCHEMA?copy:validatePassport({...copy,schema:PHONE_SCHEMA,continuity:blankContinuity()});}
function reconcileContinuity(previous,next){if(next.schema!==PHONE_SCHEMA)return next;const result=invalidateContinuity(upgradePassport(previous),next);next.continuity=result.continuity;for(const item of next.inventory)if(result.inventoryIds.includes(item.id))item.testedAt=null;return next;}
export function withContinuity(p,continuity,now=new Date().toISOString()){const previous=validatePassport(p),copy=changed(upgradePassport(previous),now);copy.continuity=continuity;return validatePassport(reconcileContinuity(previous,copy));}
function changed(p,now){const copy=validatePassport(p);iso(now);if(Date.parse(now)<Date.parse(copy.updatedAt))fail();copy.updatedAt=now;return copy;}
export function withJourney(p,journey,now=new Date().toISOString()){const copy=changed(p,now);copy.journey=validateJourney(journey);return validatePassport(copy);}
export function withCare(p,care,now=new Date().toISOString()){const copy=changed(p,now);copy.care=validateCare(care,now);const choices=Object.values(copy.care.future);copy.journey.preferences.representation=choices.every(v=>v==='avoid')?'no_replica':choices.every(v=>v==='discuss')?'discuss':'undecided';copy.journey.updatedAt=now;return validatePassport(copy);}
// A proof belongs to the exact service/access/recovery combination that was
// tested. Changing that combination always clears the proof, even if a stale
// form submits its checked box (or a caller submits a fresh timestamp). A new
// confirmation must be a separate operation against the saved combination.
function invalidateChangedInventoryProof(previous,next){
  if(previous&&['service','access','recovery'].some(key=>previous[key]!==next[key]))next.testedAt=null;
  return next;
}
export function saveRecord(p,kind,item,now=new Date().toISOString()){if(!['inventory','delegations'].includes(kind))fail();const previous=validatePassport(p),copy=changed(previous,now),value=kind==='inventory'?inventoryItem(item):delegationItem(item);const index=copy[kind].findIndex(x=>x.id===value.id);if(kind==='inventory'){if(value.testedAt&&Date.parse(value.testedAt)>Date.parse(now))fail();invalidateChangedInventoryProof(index<0?null:copy.inventory[index],value);}if(index<0)copy[kind].push(value);else copy[kind][index]=value;return validatePassport(reconcileContinuity(previous,copy));}
export function removeRecord(p,kind,itemId,now=new Date().toISOString()){if(!['inventory','delegations'].includes(kind))fail();const copy=changed(p,now),checkedId=id(itemId);if(kind==='inventory'&&copy.schema===PHONE_SCHEMA&&(copy.continuity.targetInventoryIds.includes(checkedId)||copy.continuity.resources.some(row=>row.inventoryId===checkedId)||copy.continuity.checks.some(row=>row.inventoryId===checkedId)))throw Error('INVENTORY_IN_CONTINUITY');copy[kind]=copy[kind].filter(x=>x.id!==checkedId);return validatePassport(copy);}
export function exportPassport(p,now=new Date().toISOString()){const passport=validatePassport(p);iso(now);if(Date.parse(now)<Date.parse(passport.updatedAt))fail();return JSON.stringify({schema:passport.schema===PHONE_SCHEMA?'aeterna.passport-export.v4':'aeterna.passport-export.v3',exportedAt:now,passport},null,passport.schema===PHONE_SCHEMA?0:2);}
export function importPassport(text,now=new Date().toISOString()){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)fail();iso(now);let raw;try{raw=JSON.parse(text);}catch{fail();}
  const legacyCare=journey=>{const care=blankCare(),value=journey?.preferences?.representation;if(value==='no_replica'||value==='discuss')care.future={voice:value==='no_replica'?'avoid':'discuss',face:value==='no_replica'?'avoid':'discuss',style:value==='no_replica'?'avoid':'discuss'};return care;};
  if(raw?.schema==='aeterna.journey-export.v1'){const journey=importJourney(text,now);return {schema:SCHEMA,updatedAt:journey.updatedAt,journey,inventory:[],delegations:[],care:legacyCare(journey)};}
  exact(raw,['schema','exportedAt','passport']);let candidate;
  if(raw.schema==='aeterna.passport-export.v2'){const old=exact(raw.passport,['schema','updatedAt','journey','inventory','delegations']);if(old.schema!=='aeterna.passport.v2')fail();candidate={...old,schema:SCHEMA,care:legacyCare(old.journey)};}
  else if(raw.schema==='aeterna.passport-export.v3'&&raw.passport?.schema===SCHEMA)candidate=raw.passport;
  else if(raw.schema==='aeterna.passport-export.v4'&&raw.passport?.schema===PHONE_SCHEMA)candidate=raw.passport;else fail();
  const p=validatePassport(candidate),exported=iso(raw.exportedAt);if(Date.parse(exported)<Date.parse(p.updatedAt)||Date.parse(exported)>Date.parse(now))fail();if(p.schema===PHONE_SCHEMA)p.continuity=invalidateImportedContinuity(p.continuity);return validatePassport(p);
}
export function primaryAction(p,now=p.updatedAt){const state=validatePassport(p).journey,suggestions=suggestedPhases(state,now);const review=suggestions.find(k=>effectivePhaseStatus(state,k,now)==='review');if(review)return review;const declared=Object.keys(state.phases).filter(k=>effectivePhaseStatus(state,k,now)==='declared').sort((a,b)=>Date.parse(state.phases[b].updatedAt)-Date.parse(state.phases[a].updatedAt))[0];return declared||suggestions[0]||'review';}
export function dependencyWarnings(p,scenario){const state=validatePassport(p);if(!['phone','cloud','helper'].includes(scenario))fail();return state.inventory.filter(item=>item.recovery==='unknown'||scenario==='phone'&&item.recovery==='same_device'||scenario==='helper'&&item.recovery==='trusted_contact'||scenario==='cloud'&&item.recovery==='provider').map(item=>({id:item.id,service:item.service,recovery:item.recovery}));}
