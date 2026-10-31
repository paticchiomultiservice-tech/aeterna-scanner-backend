/**
 * AETERNA CORE journey model, v1.
 * Local organisational declarations only. Never an entitlement or proof of safety.
 * This module performs no storage, network, authentication or provider operations.
 */
export const SCHEMA = 'aeterna.journey.v1';
export const EXPORT_SCHEMA = 'aeterna.journey-export.v1';
export const MAX_IMPORT_BYTES = 65536;
export const MAX_DIARY_ENTRIES = 50;
export const REVIEW_DAYS = 90;
export const GOALS = Object.freeze(['protection','access','family','legacy','business','ai','complete']);
export const CLIENTS = Object.freeze(['Privato','Professionista','Creator / Influencer','PMI','Azienda Enterprise']);
export const PHASES = Object.freeze(['map','access','recovery','backup','verify','people','permissions','legacy','memory','review']);
export const DIMENSIONS = Object.freeze(['identity','inventory','trust','ai','legacy']);
export const STATES = Object.freeze(['todo','declared','tested','review']);
export const PREFERENCES = Object.freeze({
  representation:Object.freeze(['undecided','no_replica','discuss']),
  helper:Object.freeze(['undecided','considered','review']),
  agent:Object.freeze(['undecided','review','documented'])
});
export const PHASE_DIMENSIONS = Object.freeze({
  map:'inventory',access:'identity',recovery:'identity',backup:'inventory',
  verify:'trust',people:'trust',permissions:'ai',legacy:'legacy',memory:'legacy',review:'inventory'
});
const SCENARIOS = Object.freeze({
  phone:Object.freeze(['access','recovery','people','permissions','review']),
  cloud:Object.freeze(['map','backup','recovery','legacy','review']),
  helper:Object.freeze(['people','recovery','legacy','memory','review'])
});
const GOAL_PHASES = Object.freeze({
  protection:['verify','access','recovery'],
  access:['access','recovery','backup'],
  family:['people','verify','legacy'],
  legacy:['legacy','memory','backup','people'],
  business:['map','permissions','recovery','people','backup'],
  ai:['permissions','verify','legacy'],
  complete:PHASES
});
const CONTEXT_GOALS=Object.freeze({Privato:['access'],Professionista:['business'],'Creator / Influencer':['protection','ai'],PMI:['business'],'Azienda Enterprise':['business','ai']});
const MS_DAY = 86400000;
const TOP_KEYS = ['schema','createdAt','updatedAt','clientType','goals','phases','preferences','diary'];

function fail() { throw new Error('INVALID_JOURNEY'); }
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const prototype=Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  return value;
}
function exact(value, keys) {
  plain(value);
  const own=Reflect.ownKeys(value);
  if (own.length!==keys.length || own.some(key=>typeof key!=='string'||!keys.includes(key))) fail();
  // Do not execute accessors on objects passed directly by callers.
  if (Object.values(Object.getOwnPropertyDescriptors(value)).some(item=>!Object.hasOwn(item,'value'))) fail();
  return value;
}
function list(value, choices, max=choices.length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || value.length>max) fail();
  if (Reflect.ownKeys(value).length!==value.length+1 || Object.values(Object.getOwnPropertyDescriptors(value)).some(item=>!Object.hasOwn(item,'value'))) fail();
  if (Reflect.ownKeys(value).some(key=>key!=='length'&&!/^(0|[1-9]\d*)$/.test(String(key)))) fail();
  if (new Set(value).size!==value.length || value.some(item=>!choices.includes(item))) fail();
  return choices.filter(item=>value.includes(item));
}
function time(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) fail();
  const parsed=Date.parse(value);
  if (!Number.isFinite(parsed)) fail();
  const canonical=new Date(parsed).toISOString();
  if (canonical !== (value.includes('.')?value:value.replace('Z','.000Z'))) fail();
  return canonical;
}
function monotonic(state, now) {
  const normalized=time(now);
  if (Date.parse(normalized)<Date.parse(state.updatedAt)) fail();
  return normalized;
}

export function blankJourney(nowISO=new Date().toISOString()) {
  const now=time(nowISO);
  return {
    schema:SCHEMA,createdAt:now,updatedAt:now,clientType:'Privato',goals:[],
    phases:Object.fromEntries(PHASES.map(id=>[id,{status:'todo',updatedAt:null}])),
    preferences:{representation:'undecided',helper:'undecided',agent:'undecided'},diary:[]
  };
}

/** Returns a freshly allocated, strict allowlisted value; never returns the input. */
export function validateJourney(input) {
  exact(input,TOP_KEYS);
  if (input.schema!==SCHEMA || !CLIENTS.includes(input.clientType)) fail();
  const createdAt=time(input.createdAt),updatedAt=time(input.updatedAt);
  const created=Date.parse(createdAt),updated=Date.parse(updatedAt);
  if (updated<created) fail();
  const goals=list(input.goals,GOALS);
  exact(input.phases,PHASES);
  const phases=Object.fromEntries(PHASES.map(id=>{
    const phase=exact(input.phases[id],['status','updatedAt']);
    if (!STATES.includes(phase.status)) fail();
    if (phase.updatedAt===null) {
      if (phase.status!=='todo') fail();
      return [id,{status:'todo',updatedAt:null}];
    }
    const date=time(phase.updatedAt),stamp=Date.parse(date);
    if (stamp<created || stamp>updated) fail();
    return [id,{status:phase.status,updatedAt:date}];
  }));
  exact(input.preferences,Object.keys(PREFERENCES));
  const preferences=Object.fromEntries(Object.entries(PREFERENCES).map(([key,choices])=>{
    if (!choices.includes(input.preferences[key])) fail();
    return [key,input.preferences[key]];
  }));
  if (!Array.isArray(input.diary) || Object.getPrototypeOf(input.diary)!==Array.prototype || input.diary.length>MAX_DIARY_ENTRIES) fail();
  if (Reflect.ownKeys(input.diary).length!==input.diary.length+1 || Object.values(Object.getOwnPropertyDescriptors(input.diary)).some(item=>!Object.hasOwn(item,'value'))) fail();
  if (Reflect.ownKeys(input.diary).some(key=>key!=='length'&&!/^(0|[1-9]\d*)$/.test(String(key)))) fail();
  let previous=created;
  const latest={};
  const diary=input.diary.map(entry=>{
    exact(entry,['phase','status','time']);
    if (!PHASES.includes(entry.phase)||!STATES.includes(entry.status)) fail();
    const stamp=time(entry.time),numeric=Date.parse(stamp);
    if (numeric<previous || numeric>updated) fail();
    previous=numeric;
    const item={phase:entry.phase,status:entry.status,time:stamp};
    latest[item.phase]=item;
    return item;
  });
  // Older entries may be omitted by the bounded diary, but any latest included
  // event must agree with its current phase; imports cannot claim two outcomes.
  for (const [id,event] of Object.entries(latest)) {
    if (phases[id].status!==event.status || phases[id].updatedAt!==event.time) fail();
  }
  return {schema:SCHEMA,createdAt,updatedAt,clientType:input.clientType,goals,phases,preferences,diary};
}

export function setGoal(input,goal,selected,nowISO=new Date().toISOString()) {
  const state=validateJourney(input),now=monotonic(state,nowISO);
  if (!GOALS.includes(goal)||typeof selected!=='boolean') fail();
  state.goals=GOALS.filter(id=>id===goal?selected:state.goals.includes(id));
  state.updatedAt=now;
  return state;
}
export function setClient(input,client,nowISO=new Date().toISOString()) {
  const state=validateJourney(input),now=monotonic(state,nowISO);
  if (!CLIENTS.includes(client)) fail();
  state.clientType=client;state.updatedAt=now;
  return state;
}
export function recordPhase(input,id,status,nowISO=new Date().toISOString()) {
  const state=validateJourney(input),now=monotonic(state,nowISO);
  if (!PHASES.includes(id)||!STATES.includes(status)) fail();
  state.phases[id]={status,updatedAt:now};state.updatedAt=now;
  state.diary=[...state.diary,{phase:id,status,time:now}].slice(-MAX_DIARY_ENTRIES);
  return state;
}
export function setPreference(input,key,value,nowISO=new Date().toISOString()) {
  const state=validateJourney(input),now=monotonic(state,nowISO);
  if (!Object.hasOwn(PREFERENCES,key)||!PREFERENCES[key].includes(value)) fail();
  state.preferences[key]=value;state.updatedAt=now;
  return state;
}

/** 'tested' is a user declaration, never provider verification or a safety claim. */
export function effectivePhaseStatus(input,id,nowISO=input.updatedAt) {
  const state=validateJourney(input);
  if (!PHASES.includes(id)) fail();
  const now=time(nowISO),phase=state.phases[id];
  if (phase.status==='tested' && Date.parse(now)-Date.parse(phase.updatedAt)>=REVIEW_DAYS*MS_DAY) return 'review';
  return phase.status;
}
export function suggestedPhases(input,nowISO=input.updatedAt) {
  const state=validateJourney(input);time(nowISO);
  const chosen=state.goals.length?state.goals:CONTEXT_GOALS[state.clientType];
  const order=[...new Set(chosen.flatMap(goal=>GOAL_PHASES[goal]).concat('map','review',PHASES))];
  const status=id=>effectivePhaseStatus(state,id,nowISO);
  return order.filter(id=>status(id)==='review')
    .concat(order.filter(id=>status(id)==='todo'),order.filter(id=>status(id)==='declared'))
    .slice(0,3);
}
export function simulate(input,scenario,nowISO=input.updatedAt) {
  const state=validateJourney(input);time(nowISO);
  if (!Object.hasOwn(SCENARIOS,scenario)) fail();
  const affected=[...SCENARIOS[scenario]];
  const open=affected.filter(id=>effectivePhaseStatus(state,id,nowISO)!=='tested');
  return {scenario,affected,open,next:open.slice(0,3)};
}

export function exportJourney(input,nowISO=new Date().toISOString()) {
  const journey=validateJourney(input),exportedAt=monotonic(journey,nowISO);
  return JSON.stringify({schema:EXPORT_SCHEMA,exportedAt,journey},null,2);
}
export function importJourney(text,nowISO=new Date().toISOString()) {
  if (typeof text!=='string' || new TextEncoder().encode(text).length>MAX_IMPORT_BYTES) fail();
  let value;
  try { value=JSON.parse(text); } catch { fail(); }
  exact(value,['schema','exportedAt','journey']);
  if (value.schema!==EXPORT_SCHEMA) fail();
  const exportedAt=time(value.exportedAt),journey=validateJourney(value.journey),current=time(nowISO);
  if (Date.parse(exportedAt)<Date.parse(journey.updatedAt) || Date.parse(exportedAt)>Date.parse(current)) fail();
  return journey;
}
