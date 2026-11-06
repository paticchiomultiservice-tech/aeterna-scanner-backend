// Deterministic organisational model. No provider access, DOM, storage or network.
export const CONTINUITY_SCHEMA='aeterna.phone-continuity.v1';
export const SCENARIO='phone_unavailable';
export const GUARD='aeterna.phone-loss.v1';
export const RESOURCE_KINDS=['account','device','cloud','offline','person'];
export const RESOURCE_READINESS=['declared_ready','unknown','unavailable'];
export const RESOURCE_MODES=['independent','unknown','methods'];
export const METHOD_READINESS=['declared_ready','unknown','planned'];
export const METHOD_PURPOSES=['access','recovery'];
export const CHECK_STATES=['unrecorded','needs_review','declared_success','declared_failure'];
export const REVIEW_DAYS=[30,90,180,365];
const ACTIVE=new Set(['declared_success','declared_failure']);
const INV_ID=/^item_[a-z0-9-]{8,40}$/;
const RES_ID=/^resource_[a-z0-9-]{8,40}$/;
const METHOD_ID=/^method_[a-z0-9-]{8,40}$/;
const EPOCH=Date.parse('1970-01-01T00:00:00.000Z');
const fail=()=>{throw Error('INVALID_CONTINUITY');};
const sort=values=>[...values].sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function exact(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(k=>!keys.includes(k))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail();
  return value;
}
function arr(value,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)fail();
  const own=Reflect.ownKeys(value);
  if(own.length!==value.length+1||own.some(k=>k!=='length'&&(typeof k!=='string'||!/^(0|[1-9][0-9]*)$/.test(k)))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail();
  return value;
}
function choice(value,allowed){if(!allowed.includes(value))fail();return value;}
function id(value,pattern){if(typeof value!=='string'||!pattern.test(value))fail();return value;}
function ids(value,max,pattern){const result=arr(value,max).map(v=>id(v,pattern));if(new Set(result).size!==result.length)fail();return result;}
function iso(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)<EPOCH)fail();
  return value;
}
function inventoryRows(value,upper){
  const rows=arr(value,12).map(v=>{
    exact(v,['id','service','access','recovery','testedAt']);
    const row={id:id(v.id,INV_ID),service:choice(v.service,['email','apple','google','microsoft','bank','social','cloud','business','other']),access:choice(v.access,['unknown','passkey','password_mfa','password_only','provider']),recovery:choice(v.recovery,['unknown','same_device','other_device','offline','trusted_contact','provider']),testedAt:v.testedAt===null?null:iso(v.testedAt)};
    if(row.testedAt&&Date.parse(row.testedAt)>Date.parse(upper))fail();return row;
  });
  if(new Set(rows.map(v=>v.id)).size!==rows.length)fail();return rows;
}
export function blankContinuity(){return {schema:CONTINUITY_SCHEMA,primaryPhoneId:null,targetInventoryIds:[],resources:[],methods:[],checks:[]};}
function parse(value,inventory,upper,proofs=true){
  iso(upper);const inv=inventoryRows(inventory,upper),invIds=new Set(inv.map(v=>v.id));
  exact(value,['schema','primaryPhoneId','targetInventoryIds','resources','methods','checks']);
  if(value.schema!==CONTINUITY_SCHEMA)fail();
  const primaryPhoneId=value.primaryPhoneId===null?null:id(value.primaryPhoneId,RES_ID);
  const targetInventoryIds=ids(value.targetInventoryIds,5,INV_ID);if(targetInventoryIds.some(v=>!invIds.has(v)))fail();
  const resources=arr(value.resources,24).map(v=>{
    exact(v,['id','kind','inventoryId','readiness','mode','methodsComplete']);
    if(typeof v.methodsComplete!=='boolean')fail();
    const row={id:id(v.id,RES_ID),kind:choice(v.kind,RESOURCE_KINDS),inventoryId:v.inventoryId===null?null:id(v.inventoryId,INV_ID),readiness:choice(v.readiness,RESOURCE_READINESS),mode:choice(v.mode,RESOURCE_MODES),methodsComplete:v.methodsComplete};
    if(row.kind==='account'?(row.inventoryId===null||!invIds.has(row.inventoryId)||row.mode==='independent'):row.inventoryId!==null)fail();
    if(row.mode==='unknown'&&row.methodsComplete||row.mode==='independent'&&!row.methodsComplete)fail();return row;
  });
  const byRes=new Map(resources.map(v=>[v.id,v]));
  if(byRes.size!==resources.length||new Set(resources.filter(v=>v.kind==='account').map(v=>v.inventoryId)).size!==resources.filter(v=>v.kind==='account').length)fail();
  if(primaryPhoneId!==null&&byRes.get(primaryPhoneId)?.kind!=='device')fail();
  const methods=arr(value.methods,48).map(v=>{
    exact(v,['id','targetId','purpose','readiness','requires']);
    const row={id:id(v.id,METHOD_ID),targetId:id(v.targetId,RES_ID),purpose:choice(v.purpose,METHOD_PURPOSES),readiness:choice(v.readiness,METHOD_READINESS),requires:ids(v.requires,24,RES_ID)};
    if(!row.requires.length||!byRes.has(row.targetId)||byRes.get(row.targetId).mode!=='methods'||row.requires.some(k=>!byRes.has(k)))fail();return row;
  });
  if(new Set(methods.map(v=>v.id)).size!==methods.length)fail();
  const checks=arr(value.checks,12).map(v=>{
    exact(v,['inventoryId','status','declaredAt','reviewAfterDays','basisDigest','methodIds']);
    const row={inventoryId:id(v.inventoryId,INV_ID),status:choice(v.status,CHECK_STATES),declaredAt:v.declaredAt,reviewAfterDays:v.reviewAfterDays,basisDigest:v.basisDigest,methodIds:ids(v.methodIds,48,METHOD_ID)};
    if(!invIds.has(row.inventoryId))fail();
    if(!ACTIVE.has(row.status)){if(row.declaredAt!==null||row.reviewAfterDays!==null||row.basisDigest!==null||row.methodIds.length)fail();}
    else {iso(row.declaredAt);if(Date.parse(row.declaredAt)>Date.parse(upper)||!REVIEW_DAYS.includes(row.reviewAfterDays)||!Number.isSafeInteger(row.reviewAfterDays)||typeof row.basisDigest!=='string'||!/^[a-f0-9]{64}$/.test(row.basisDigest)||!row.methodIds.length)fail();}
    return row;
  });
  if(new Set(checks.map(v=>v.inventoryId)).size!==checks.length)fail();
  const c={schema:CONTINUITY_SCHEMA,primaryPhoneId,targetInventoryIds,resources,methods,checks};
  if(proofs)for(const check of checks)if(ACTIVE.has(check.status)&&routeDigestRaw({inventory:inv,continuity:c},check.inventoryId,check.methodIds)!==check.basisDigest)fail();
  return c;
}
export function validateContinuity(value,inventory,updatedAt){return parse(value,inventory,updatedAt,true);}
function model(passport,proofs=true){
  if(!passport||typeof passport!=='object')fail();const updatedAt=iso(passport.updatedAt);
  const inventory=inventoryRows(passport.inventory,updatedAt),continuity=parse(passport.continuity,inventory,updatedAt,proofs);
  return {updatedAt,inventory,continuity};
}
function maps(p){
  const byRes=new Map(p.continuity.resources.map(v=>[v.id,v])),byMethod=new Map(p.continuity.methods.map(v=>[v.id,v])),byTarget=new Map();
  for(const method of p.continuity.methods){if(!byTarget.has(method.targetId))byTarget.set(method.targetId,[]);byTarget.get(method.targetId).push(method);}
  for(const list of byTarget.values())list.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return {byRes,byMethod,byTarget};
}
function routeRaw(p,targetInventoryId,methodIds){
  id(targetInventoryId,INV_ID);const selected=ids(methodIds,48,METHOD_ID);
  if(!selected.length||p.continuity.primaryPhoneId===null)fail();
  const {byRes,byMethod}=maps(p),target=p.continuity.resources.find(r=>r.kind==='account'&&r.inventoryId===targetInventoryId);
  if(!target)fail();
  const byTarget=new Map();for(const mid of selected){const method=byMethod.get(mid);if(!method||byTarget.has(method.targetId))fail();byTarget.set(method.targetId,method);}
  const resources=new Set(),used=new Set(),visiting=new Set(),done=new Set();
  function visit(rid){
    if(visiting.has(rid))fail();if(done.has(rid))return;
    const r=byRes.get(rid);if(!r||rid===p.continuity.primaryPhoneId||r.readiness!=='declared_ready')fail();
    resources.add(rid);visiting.add(rid);
    if(r.mode!=='independent'){
      const m=byTarget.get(rid);if(r.mode!=='methods'||!m||m.readiness!=='declared_ready')fail();
      used.add(m.id);for(const req of m.requires)visit(req);
    }else if(byTarget.has(rid))fail();
    visiting.delete(rid);done.add(rid);
  }
  visit(target.id);if(used.size!==selected.length)fail();
  return {resourceIds:sort(resources),methodIds:sort(used),purposes:sort(new Set([...used].map(mid=>byMethod.get(mid).purpose)))};
}
function basisRaw(p,targetInventoryId,methodIds){
  const route=routeRaw(p,targetInventoryId,methodIds),{byRes,byMethod}=maps(p),byInv=new Map(p.inventory.map(v=>[v.id,v]));
  const involved=route.resourceIds.map(rid=>byRes.get(rid));
  const accounts=sort(new Set(involved.filter(r=>r.kind==='account').map(r=>r.inventoryId))).map(k=>{const r=byInv.get(k);if(!r)fail();return [r.id,r.service,r.access,r.recovery];});
  const resources=involved.map(r=>[r.id,r.kind,r.inventoryId,r.readiness,r.mode,r.methodsComplete]);
  const methods=route.methodIds.map(mid=>{const m=byMethod.get(mid);return [m.id,m.targetId,m.purpose,m.readiness,sort(m.requires)];});
  return JSON.stringify(['aeterna.phone-loss-basis.v1',SCENARIO,p.continuity.primaryPhoneId,targetInventoryId,accounts,resources,methods]);
}
// SHA-256 on UTF-8. Kept synchronous so strict document validation remains pure.
export function sha256(text){
  if(typeof text!=='string')fail();
  const input=new TextEncoder().encode(text),length=input.length,total=Math.ceil((length+9)/64)*64,data=new Uint8Array(total);data.set(input);data[length]=128;
  const bits=length*8,view=new DataView(data.buffer);view.setUint32(total-8,Math.floor(bits/4294967296));view.setUint32(total-4,bits>>>0);
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<total;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+s1+ch+K[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)>>>0);
  }
  return [...H].map(v=>v.toString(16).padStart(8,'0')).join('');
}
function routeDigestRaw(p,inventoryId,methodIds){return sha256(basisRaw(p,inventoryId,methodIds));}
export function routeBasis(passport,inventoryId,methodIds){return basisRaw(model(passport,false),inventoryId,methodIds);}
export function routeDigest(passport,inventoryId,methodIds){return sha256(routeBasis(passport,inventoryId,methodIds));}
function reach(p){
  const {byRes,byTarget}=maps(p),K=new Set(),P=new Set(),levels=new Map();
  const allowed=r=>r.id!==p.continuity.primaryPhoneId&&r.readiness!=='unavailable';
  for(const r of p.continuity.resources){if(!allowed(r))continue;if(r.mode==='independent'&&r.readiness==='declared_ready'){K.add(r.id);levels.set(r.id,0);}if(r.mode==='independent'||r.mode==='unknown'||!r.methodsComplete)P.add(r.id);}
  let changed=true;
  while(changed){changed=false;const added=[];for(const r of p.continuity.resources){if(K.has(r.id)||!allowed(r)||r.readiness!=='declared_ready'||r.mode!=='methods')continue;const options=(byTarget.get(r.id)||[]).filter(m=>m.readiness==='declared_ready'&&m.requires.every(k=>K.has(k)));if(options.length)added.push([r.id,Math.min(...options.map(m=>1+Math.max(...m.requires.map(k=>levels.get(k)))))]);}for(const [rid,level] of added){K.add(rid);levels.set(rid,level);changed=true;}}
  changed=true;while(changed){changed=false;const added=[];for(const r of p.continuity.resources){if(P.has(r.id)||!allowed(r)||r.mode!=='methods')continue;if((byTarget.get(r.id)||[]).some(m=>m.readiness!=='planned'&&m.requires.every(k=>P.has(k))))added.push(r.id);}for(const rid of added){P.add(rid);changed=true;}}
  return {K,P,levels,byRes,byTarget};
}
function proposed(p,rid,reachability){
  const {byRes,byTarget,levels}=reachability,selected=new Set(),seen=new Set();
  function walk(id){if(seen.has(id))return;seen.add(id);const r=byRes.get(id);if(r.mode==='independent')return;const m=(byTarget.get(id)||[]).find(m=>m.readiness==='declared_ready'&&m.requires.every(req=>levels.has(req)&&levels.get(req)<levels.get(id))&&1+Math.max(...m.requires.map(req=>levels.get(req)))===levels.get(id));if(!m)fail();selected.add(m.id);for(const req of m.requires)walk(req);}
  walk(rid);const inv=byRes.get(rid).inventoryId;return routeRaw(p,inv,sort(selected));
}
function graphClosure(p,root){
  const {byRes,byTarget}=maps(p),resources=new Set(),methods=new Set();
  function walk(id){if(resources.has(id))return;resources.add(id);for(const m of byTarget.get(id)||[]){methods.add(m.id);for(const req of m.requires)walk(req);}}
  walk(root);return {resources,methods,byRes};
}
function cyclesFor(p,root){
  const {resources}=graphClosure(p,root),{byTarget}=maps(p),index=new Map(),low=new Map(),stack=[],onStack=new Set(),components=[];let next=0;
  const deps=id=>sort(new Set((byTarget.get(id)||[]).flatMap(m=>m.requires)));
  function connect(id){index.set(id,next);low.set(id,next++);stack.push(id);onStack.add(id);for(const req of deps(id)){if(!index.has(req)){connect(req);low.set(id,Math.min(low.get(id),low.get(req)));}else if(onStack.has(req))low.set(id,Math.min(low.get(id),index.get(req)));}if(low.get(id)===index.get(id)){const component=[];let value;do{value=stack.pop();onStack.delete(value);component.push(value);}while(value!==id);component.sort();if(component.length>1||deps(id).includes(id))components.push(component);}}
  for(const id of sort(resources))if(!index.has(id))connect(id);return components.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}
export function evaluatePhone(passport,now=passport.updatedAt){
  const p=model(passport,true);iso(now);if(Date.parse(now)<Date.parse(p.updatedAt))fail();
  const c=p.continuity,graph=reach(p),results=[];
  for(const inventoryId of c.targetInventoryIds){
    const target=c.resources.find(r=>r.kind==='account'&&r.inventoryId===inventoryId),base={inventoryId,state:'unknown',reason:'dependency_unknown',methodIds:[],resourceIds:[],purposes:[],cycles:[]};
    if(c.primaryPhoneId===null){results.push({...base,reason:'primary_phone_missing'});continue;}
    if(!target){results.push({...base,reason:'account_resource_missing'});continue;}
    base.cycles=cyclesFor(p,target.id);
    if(graph.K.has(target.id)){results.push({...base,...proposed(p,target.id,graph),state:'path_declared',reason:'path_declared'});continue;}
    if(graph.P.has(target.id)){results.push(base);continue;}
    const closure=graphClosure(p,target.id);results.push({...base,state:'blocked_in_model',reason:base.cycles.length?'circular_dependency':[...closure.resources].some(k=>k===c.primaryPhoneId||graph.byRes.get(k).readiness==='unavailable')?'unavailable_dependency':'no_declared_method'});
  }
  const action=(code,inventoryId,reason,phase='recovery')=>({code,inventoryId,reason,phase});
  let chosen;
  if(!c.targetInventoryIds.length)chosen=action('choose_target',null,'no_targets','map');
  else if(c.primaryPhoneId===null)chosen=action('choose_phone',null,'primary_phone_missing');
  else {
    const candidates=[];
    results.forEach((r,order)=>{
      const check=c.checks.find(v=>v.inventoryId===r.inventoryId),expired=check&&ACTIVE.has(check.status)&&Date.parse(now)>=Date.parse(check.declaredAt)+check.reviewAfterDays*86400000;
      if(check?.status==='declared_failure')candidates.push({rank:2,order,a:action('address_failure',r.inventoryId,'declared_failure')});
      else if(r.state==='blocked_in_model')candidates.push({rank:2,order,a:action('address_blocked',r.inventoryId,r.reason)});
      else if(r.state==='unknown')candidates.push({rank:3,order,a:action('complete_dependency',r.inventoryId,r.reason)});
      else if(check?.status==='needs_review'||expired)candidates.push({rank:4,order,a:action('repeat_check',r.inventoryId,expired?'review_due':'needs_review','review')});
      else if(!check||check.status==='unrecorded')candidates.push({rank:5,order,a:action('prepare_check',r.inventoryId,'unrecorded')});
    });
    candidates.sort((a,b)=>a.rank-b.rank||a.order-b.order||(a.a.inventoryId<b.a.inventoryId?-1:a.a.inventoryId>b.a.inventoryId?1:0));
    chosen=candidates[0]?.a||action('export_or_review',null,'no_open_action','review');
  }
  return {scenario:SCENARIO,results,action:chosen};
}
function clearCheck(inventoryId,status='needs_review'){return {inventoryId,status,declaredAt:null,reviewAfterDays:null,basisDigest:null,methodIds:[]};}
export function declareCheck(passport,inventoryId,status,methodIds,reviewAfterDays,now){
  const p=model(passport,true);iso(now);if(Date.parse(now)<Date.parse(p.updatedAt)||!ACTIVE.has(status)||!REVIEW_DAYS.includes(reviewAfterDays)||!p.continuity.targetInventoryIds.includes(inventoryId))fail();
  const path=routeRaw(p,inventoryId,methodIds),c=p.continuity,check={inventoryId,status,declaredAt:now,reviewAfterDays,basisDigest:routeDigestRaw(p,inventoryId,path.methodIds),methodIds:path.methodIds};
  const index=c.checks.findIndex(v=>v.inventoryId===inventoryId);if(index<0)c.checks.push(check);else c.checks[index]=check;
  return parse(c,p.inventory,now,true);
}
export function invalidateImportedContinuity(value){
  // Called only after validating the source document's shape and old proofs.
  const c=JSON.parse(JSON.stringify(value));c.checks=c.checks.map(v=>ACTIVE.has(v.status)?clearCheck(v.inventoryId):v);return c;
}
const invTuple=v=>[v.id,v.service,v.access,v.recovery];
const resourceTuple=v=>[v.id,v.kind,v.inventoryId,v.readiness,v.mode,v.methodsComplete];
const methodTuple=v=>[v.id,v.targetId,v.purpose,v.readiness,sort(v.requires)];
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function configurationBasis(passport){
  const p=model(passport,false),c=p.continuity;
  return JSON.stringify([c.schema,c.primaryPhoneId,c.targetInventoryIds,p.inventory.slice().sort(byId).map(invTuple),c.resources.slice().sort(byId).map(resourceTuple),c.methods.slice().sort(byId).map(methodTuple)]);
}
function legacyBasis(p,inventoryId){
  const target=p.continuity.resources.find(r=>r.kind==='account'&&r.inventoryId===inventoryId);if(!target)return null;
  const closure=graphClosure(p,target.id),{byMethod}=maps(p),invIds=new Set([...closure.resources].map(k=>closure.byRes.get(k)).filter(r=>r.kind==='account').map(r=>r.inventoryId));
  return JSON.stringify([p.continuity.primaryPhoneId,p.inventory.filter(v=>invIds.has(v.id)).sort(byId).map(invTuple),sort(closure.resources).map(k=>resourceTuple(closure.byRes.get(k))),sort(closure.methods).map(k=>methodTuple(byMethod.get(k)))]);
}
export function invalidateContinuity(previousPassport,nextPassport){
  const old=model(previousPassport,true),next=model(nextPassport,false),affected=new Set(),c=next.continuity;
  for(const oldCheck of old.continuity.checks){
    if(!ACTIVE.has(oldCheck.status))continue;
    let valid=false;try{valid=routeDigestRaw(next,oldCheck.inventoryId,oldCheck.methodIds)===oldCheck.basisDigest;}catch{}
    if(!valid){affected.add(oldCheck.inventoryId);const idx=c.checks.findIndex(v=>v.inventoryId===oldCheck.inventoryId);if(idx>=0)c.checks[idx]=clearCheck(oldCheck.inventoryId);else if(next.inventory.some(v=>v.id===oldCheck.inventoryId))c.checks.push(clearCheck(oldCheck.inventoryId));}
  }
  for(const row of old.inventory){
    const current=next.inventory.find(v=>v.id===row.id);if(!current)continue;
    if(['service','access','recovery'].some(k=>row[k]!==current[k])){affected.add(row.id);continue;}
    if(row.testedAt===null)continue;
    const check=old.continuity.checks.find(v=>v.inventoryId===row.id&&ACTIVE.has(v.status));
    if(check){try{if(routeDigestRaw(next,row.id,check.methodIds)!==check.basisDigest)affected.add(row.id);}catch{affected.add(row.id);}}
    else if(!eq(legacyBasis(old,row.id),legacyBasis(next,row.id)))affected.add(row.id);
  }
  return {continuity:parse(c,next.inventory,next.updatedAt,true),inventoryIds:sort(affected)};
}
