/**
 * Category-only continuity care. These are personal declarations, not legal
 * powers, contact records, stored memories, notifications or provider actions.
 * No network, storage, account, payment or entitlement operations occur here.
 */
export const ROLE_TYPES=Object.freeze(['partner','child','relative','friend','colleague','professional','other']);
export const ROLE_SCOPES=Object.freeze(['contacts','access','archives','business','future']);
export const FUTURE_KEYS=Object.freeze(['voice','face','style']);
export const FUTURE_CHOICES=Object.freeze(['undecided','avoid','discuss']);
export const MEMORY_TOPICS=Object.freeze(['undecided','photo','story','values','instructions']);
export const REVIEW_DAYS=Object.freeze([30,90,180,365]);
export const MAX_ROLES=6;

function fail(){throw new Error('INVALID_CARE');}
function exact(value,keys){
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)fail();
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(key=>typeof key!=='string'||!keys.includes(key)))fail();
  if(Object.values(Object.getOwnPropertyDescriptors(value)).some(item=>!Object.hasOwn(item,'value')))fail();
  return value;
}
function iso(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail();
  return value;
}
function dateAtOrBefore(value,upper){const stamp=iso(value);if(Date.parse(stamp)>Date.parse(upper))fail();return stamp;}
function choice(value,values){if(!values.includes(value))fail();return value;}
function bool(value){if(typeof value!=='boolean')fail();return value;}
function itemId(value){if(typeof value!=='string'||!/^item_[a-z0-9-]{8,40}$/.test(value))fail();return value;}
function roleRecord(input){const row=exact(input,['id','role','scope','alternate']);return {id:itemId(row.id),role:choice(row.role,ROLE_TYPES),scope:choice(row.scope,ROLE_SCOPES),alternate:bool(row.alternate)};}
function rolesArray(value){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>MAX_ROLES)fail();
  const keys=Reflect.ownKeys(value);
  if(keys.length!==value.length+1||keys.some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key))))fail();
  if(Object.values(Object.getOwnPropertyDescriptors(value)).some(item=>!Object.hasOwn(item,'value')))fail();
  const rows=value.map(roleRecord);if(new Set(rows.map(row=>row.id)).size!==rows.length)fail();return rows;
}

export function blankCare(){return {roles:[],future:{voice:'undecided',face:'undecided',style:'undecided'},memory:{topic:'undecided',prepared:false,updatedAt:null},review:{cadenceDays:90,lastCheckedAt:null}};}

/** Fresh strict clone. upperTimestamp is the enclosing document/operation time. */
export function validateCare(input,upperTimestamp){
  const upper=iso(upperTimestamp),care=exact(input,['roles','future','memory','review']);
  const roles=rolesArray(care.roles),f=exact(care.future,FUTURE_KEYS);
  const future=Object.fromEntries(FUTURE_KEYS.map(key=>[key,choice(f[key],FUTURE_CHOICES)]));
  const m=exact(care.memory,['topic','prepared','updatedAt']),topic=choice(m.topic,MEMORY_TOPICS),prepared=bool(m.prepared);
  if(prepared&&topic==='undecided')fail();
  if(prepared?m.updatedAt===null:m.updatedAt!==null)fail();
  const updatedAt=prepared?dateAtOrBefore(m.updatedAt,upper):null;
  const r=exact(care.review,['cadenceDays','lastCheckedAt']),cadenceDays=choice(r.cadenceDays,REVIEW_DAYS);
  const lastCheckedAt=r.lastCheckedAt===null?null:dateAtOrBefore(r.lastCheckedAt,upper);
  return {roles,future,memory:{topic,prepared,updatedAt},review:{cadenceDays,lastCheckedAt}};
}

export function saveRole(input,row,now=new Date().toISOString()){
  const care=validateCare(input,now),next=roleRecord(row),index=care.roles.findIndex(item=>item.id===next.id);
  if(index<0)care.roles.push(next);else care.roles[index]=next;
  return validateCare(care,now);
}
export function removeRole(input,id,now=new Date().toISOString()){
  const care=validateCare(input,now),wanted=itemId(id);care.roles=care.roles.filter(row=>row.id!==wanted);return care;
}
export function setFuture(input,key,value,now=new Date().toISOString()){
  const care=validateCare(input,now);choice(key,FUTURE_KEYS);care.future[key]=choice(value,FUTURE_CHOICES);return care;
}
export function setMemory(input,topic,prepared,now=new Date().toISOString()){
  const care=validateCare(input,now);care.memory={topic:choice(topic,MEMORY_TOPICS),prepared:bool(prepared),updatedAt:prepared?iso(now):null};return validateCare(care,now);
}
export function setReview(input,cadence,checked,now=new Date().toISOString()){
  const care=validateCare(input,now);care.review={cadenceDays:choice(cadence,REVIEW_DAYS),lastCheckedAt:bool(checked)?iso(now):null};return care;
}
