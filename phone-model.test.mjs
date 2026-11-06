import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {blankJourney,validateJourney} from './web/core-model.mjs';
import {blankCare,validateCare} from './web/care-model.mjs';
import * as M from './web/phone-model.mjs';

const fixtureUrl=fs.existsSync(new URL('./phone-fixtures.json',import.meta.url))?new URL('./phone-fixtures.json',import.meta.url):new URL('./tests/phone-fixtures.json',import.meta.url);
const F=JSON.parse(fs.readFileSync(fixtureUrl,'utf8'));
const NOW=F.now,LATER='2026-11-06T12:01:00.000Z';
const copy=v=>structuredClone(v);
const oracle=s=>createHash('sha256').update(s,'utf8').digest('hex');
const from=name=>{const v=F.scenarios.find(v=>v.name===name);return {schema:'aeterna.passport.v4',updatedAt:NOW,journey:blankJourney(NOW),inventory:copy(v.inventory),delegations:[],care:blankCare(),continuity:copy(v.continuity)};};
const valid=p=>M.validateContinuity(p.continuity,p.inventory,p.updatedAt);
const outcome=p=>M.evaluatePhone(p,p.updatedAt);
const declare=(p,status='declared_success',now=NOW)=>{const next=copy(p),r=outcome(p).results[0];next.updatedAt=now;next.continuity=M.declareCheck(p,r.inventoryId,status,r.methodIds,90,now);return next;};
const mutate=(p,fn)=>{const next=copy(p);next.updatedAt=LATER;fn(next);const invalidated=M.invalidateContinuity(p,next);next.continuity=invalidated.continuity;for(const row of next.inventory)if(invalidated.inventoryIds.includes(row.id))row.testedAt=null;return {next,invalidated};};
const iid=n=>'item_account-'+String(n).padStart(8,'0');
const rid=n=>'resource_'+String(n).padStart(8,'0');
const mid=n=>'method_'+String(n).padStart(8,'0');
const resource=(n,kind,inventoryId=null,mode='independent')=>({id:rid(n),kind,inventoryId,readiness:'declared_ready',mode,methodsComplete:true});
const method=(n,targetId,requires,overrides={})=>({id:mid(n),targetId,purpose:'recovery',readiness:'declared_ready',requires,...overrides});

test('empty continuity is a closed, fresh category-only model',()=>{
  const c=M.blankContinuity();assert.deepEqual(Object.keys(c),['schema','primaryPhoneId','targetInventoryIds','resources','methods','checks']);
  assert.deepEqual(M.validateContinuity(c,[],NOW),c);c.targetInventoryIds.push(iid(1));assert.equal(M.blankContinuity().targetInventoryIds.length,0);
  assert.doesNotMatch(JSON.stringify(c),/emailAddress|passwordValue|otp|session|token|verified|plan/);
});

test('shared narrative fixtures use real current journey/care objects',()=>{
  assert.equal(F.schema,'aeterna.phone-fixtures.v1');
  assert.deepEqual(F.passportBase.journey,blankJourney(NOW));assert.deepEqual(F.passportBase.care,blankCare());
  for(const fixture of F.scenarios){const p=from(fixture.name);assert.deepEqual(validateJourney(p.journey),p.journey);assert.deepEqual(validateCare(p.care,NOW),p.care);valid(p);assert.deepEqual(outcome(p).results.map(r=>r.state),fixture.expectedStates,fixture.name);}
});

test('canonical path fixtures match independent Node SHA-256 and exact UTF-8 basis',()=>{
  for(const fixture of F.canonical){const p={updatedAt:NOW,inventory:fixture.inventory,continuity:fixture.continuity};assert.equal(M.routeBasis(p,fixture.targetInventoryId,fixture.methodIds),fixture.basis);assert.equal(M.routeDigest(p,fixture.targetInventoryId,fixture.methodIds),fixture.digest);assert.equal(oracle(fixture.basis),fixture.digest);}
  for(const text of ['', 'abc','AETERNA € à français','x'.repeat(10000)])assert.equal(M.sha256(text),oracle(text));
});

test('phone missing and account resource missing never produce optimistic outcomes',()=>{
  const p=from('missing_primary_phone');assert.equal(outcome(p).action.code,'choose_phone');assert.equal(outcome(p).results[0].reason,'primary_phone_missing');
  assert.equal(outcome(from('missing_account_resource')).results[0].reason,'account_resource_missing');
  const empty=copy(p);empty.continuity.targetInventoryIds=[];assert.deepEqual(outcome(empty).results,[]);assert.equal(outcome(empty).action.code,'choose_target');
});

test('AND requirements, alternatives and planned methods have distinct effects',()=>{
  assert.equal(outcome(from('and_needs_phone')).results[0].state,'blocked_in_model');
  assert.equal(outcome(from('independent_second_device')).results[0].state,'path_declared');
  assert.equal(outcome(from('planned_method_not_access')).results[0].state,'blocked_in_model');
  assert.equal(outcome(from('unknown_method')).results[0].state,'unknown');
});

test('an unknown or unavailable resource cannot enter declared reachability',()=>{
  const unknown=from('independent_second_device');unknown.continuity.resources.find(r=>r.id===rid(3)).readiness='unknown';assert.equal(outcome(unknown).results[0].state,'unknown');
  unknown.continuity.resources.find(r=>r.id===rid(3)).readiness='unavailable';assert.equal(outcome(unknown).results[0].state,'blocked_in_model');
  assert.equal(outcome(from('unavailable_independent')).results[0].state,'blocked_in_model');
});

test('complete empty methods mean blocked in this model; incomplete means unknown',()=>{
  const p=from('phone_only');p.continuity.methods=[];assert.equal(outcome(p).results[0].state,'blocked_in_model');p.continuity.resources.find(r=>r.kind==='account').methodsComplete=false;assert.equal(outcome(p).results[0].state,'unknown');
});

test('a full cycle has no entry; incomplete cycle stays unknown; independent alternative works',()=>{
  const blocked=outcome(from('email_cloud_cycle')).results[0];assert.equal(blocked.state,'blocked_in_model');assert.equal(blocked.reason,'circular_dependency');assert.deepEqual(blocked.cycles,[[rid(2),rid(4)]]);
  assert.equal(outcome(from('incomplete_cycle')).results[0].state,'unknown');
  const independent=outcome(from('offline_breaks_cycle')).results[0];assert.equal(independent.state,'path_declared');assert.deepEqual(independent.methodIds,[mid(3)]);assert.deepEqual(independent.resourceIds,[rid(2),rid(5)]);assert.equal(independent.cycles.length,1);
});

test('readiness never changes the stored primary phone during a simulation',()=>{
  const p=from('phone_only'),before=JSON.stringify(p);outcome(p);assert.equal(JSON.stringify(p),before);assert.equal(p.continuity.resources[0].readiness,'declared_ready');
});

test('array permutations preserve outcomes, canonical paths and SCC explanations',()=>{
  for(const fixture of F.scenarios){const p=from(fixture.name),q=copy(p);q.inventory.reverse();q.continuity.resources.reverse();q.continuity.methods.reverse();for(const m of q.continuity.methods)m.requires.reverse();assert.deepEqual(outcome(q),outcome(p),fixture.name);}
});

test('first reachability levels choose finite shortest-level paths then lexical method IDs',()=>{
  const p=from('independent_second_device');p.continuity.resources.push(resource(6,'offline'),resource(8,'cloud',null,'methods'));p.continuity.methods.push(method(9,rid(2),[rid(8)]),method(8,rid(8),[rid(6)]));
  assert.deepEqual(outcome(p).results[0].methodIds,[mid(2)]);
  const q=copy(p);q.continuity.methods.reverse();q.continuity.resources.reverse();assert.deepEqual(outcome(q).results[0].methodIds,[mid(2)]);
});

test('one priority uses selected account order, not array or resource order',()=>{
  const p=from('phone_only');p.inventory.push({id:iid(2),service:'bank',access:'unknown',recovery:'unknown',testedAt:null});p.continuity.targetInventoryIds.push(iid(2));p.continuity.resources.push(resource(8,'account',iid(2),'methods'));
  assert.equal(outcome(p).action.inventoryId,iid(1));p.continuity.targetInventoryIds.reverse();assert.equal(outcome(p).action.inventoryId,iid(2));assert.equal(outcome(p).action.code,'address_blocked');
});

test('one priority prefers failure/blocked to unknown, review and unrecorded',()=>{
  const p=declare(from('independent_second_device'),'declared_failure');p.inventory.push({id:iid(2),service:'cloud',access:'unknown',recovery:'unknown',testedAt:null});p.continuity.targetInventoryIds.unshift(iid(2));assert.equal(outcome(p).action.code,'address_failure');assert.equal(outcome(p).action.inventoryId,iid(1));
});

test('simulation/guide evaluation creates no check or date; only declaration does',()=>{
  const p=from('independent_second_device');assert.equal(outcome(p).action.code,'prepare_check');assert.deepEqual(p.continuity.checks,[]);
  const success=declare(p);assert.equal(outcome(success).action.code,'export_or_review');assert.equal(success.continuity.checks[0].declaredAt,NOW);assert.deepEqual(p.continuity.checks,[]);
  const failure=declare(p,'declared_failure');assert.equal(outcome(failure).action.code,'address_failure');
});

test('recorded cadence fixes the review boundary and does not assert provider failure',()=>{
  const p=declare(from('independent_second_device')),due=new Date(Date.parse(NOW)+90*86400000).toISOString(),before=new Date(Date.parse(due)-1).toISOString();
  assert.equal(M.evaluatePhone(p,before).action.code,'export_or_review');assert.equal(M.evaluatePhone(p,due).action.reason,'review_due');assert.equal(p.continuity.checks[0].status,'declared_success');p.care.reminder={days:365};assert.equal(M.evaluatePhone(p,due).action.reason,'review_due');
});

test('declarations reject unselected accounts, unready paths and unapproved cadences',()=>{
  const p=from('independent_second_device'),methods=outcome(p).results[0].methodIds;
  for(const status of ['verified','provider_verified','operator_verified','unrecorded'])assert.throws(()=>M.declareCheck(p,iid(1),status,methods,90,NOW));
  for(const days of [0,1,90.5,'90',366])assert.throws(()=>M.declareCheck(p,iid(1),'declared_success',methods,days,NOW));
  assert.throws(()=>M.declareCheck(from('phone_only'),iid(1),'declared_success',[mid(1)],90,NOW));
  const q=copy(p);q.continuity.targetInventoryIds=[];assert.throws(()=>M.declareCheck(q,iid(1),'declared_success',methods,90,NOW));
});

test('exact paths reject extraneous, duplicate, cyclic and missing method justifications',()=>{
  const p=from('independent_second_device');
  for(const methods of [[],[mid(2),mid(2)],[mid(1)],[mid(1),mid(2)],[mid(99)]])assert.throws(()=>M.routeBasis(p,iid(1),methods));
  const cycle=from('email_cloud_cycle');assert.throws(()=>M.routeBasis(cycle,iid(1),[mid(1),mid(2)]));
  const validPath=outcome(p).results[0].methodIds;p.continuity.resources.push(resource(8,'cloud',null,'methods'),resource(9,'offline'));p.continuity.methods.push(method(8,rid(8),[rid(9)]));assert.throws(()=>M.routeBasis(p,iid(1),[...validPath,mid(8)]));
});

test('access and recovery purpose remain explicit and affect the declared basis',()=>{
  const p=from('independent_second_device'),r=outcome(p).results[0];assert.deepEqual(r.purposes,['recovery']);const before=M.routeDigest(p,iid(1),r.methodIds);p.continuity.methods.find(m=>m.id===mid(2)).purpose='access';assert.deepEqual(outcome(p).results[0].purposes,['access']);assert.notEqual(M.routeDigest(p,iid(1),r.methodIds),before);
});

test('used dependency edits invalidate stale proofs before checking the next digest',()=>{
  const p=declare(from('independent_second_device'));p.inventory[0].testedAt=NOW;
  const {next,invalidated}=mutate(p,q=>q.continuity.resources.find(r=>r.id===rid(3)).readiness='unknown');
  assert.deepEqual(next.continuity.checks[0],{inventoryId:iid(1),status:'needs_review',declaredAt:null,reviewAfterDays:null,basisDigest:null,methodIds:[]});assert.deepEqual(invalidated.inventoryIds,[iid(1)]);assert.equal(next.inventory[0].testedAt,null);assert.equal(outcome(next).action.code,'complete_dependency');
});

test('reverting a dependency cannot resurrect the cleared declaration',()=>{
  const original=declare(from('independent_second_device'));
  const first=mutate(original,q=>q.continuity.methods.find(m=>m.id===mid(2)).purpose='access').next;
  const restored=copy(first);restored.updatedAt='2026-11-06T12:02:00.000Z';restored.continuity.methods.find(m=>m.id===mid(2)).purpose='recovery';restored.continuity=M.invalidateContinuity(first,restored).continuity;
  assert.equal(restored.continuity.checks[0].status,'needs_review');assert.equal(outcome(restored).action.code,'repeat_check');
});

test('an unused alternative, including a new shorter one, preserves concrete proof/date',()=>{
  const p=from('independent_second_device');p.continuity.methods[1].id=mid(20);const proven=declare(p);proven.inventory[0].testedAt=NOW;
  const before=copy(proven.continuity.checks[0]),{next,invalidated}=mutate(proven,q=>{q.continuity.resources.push(resource(8,'offline'));q.continuity.methods.push(method(2,rid(2),[rid(8)]));});
  assert.deepEqual(outcome(next).results[0].methodIds,[mid(2)]);assert.deepEqual(next.continuity.checks[0],before);assert.equal(next.inventory[0].testedAt,NOW);assert.deepEqual(invalidated.inventoryIds,[]);valid(next);
});

test('account configuration in an exact path invalidates the dependent target proof',()=>{
  const p=from('independent_second_device');p.inventory.push({id:iid(2),service:'cloud',access:'provider',recovery:'other_device',testedAt:null});p.continuity.resources.push(resource(8,'account',iid(2),'methods'));p.continuity.methods.push(method(8,rid(8),[rid(3)]));p.continuity.methods.find(m=>m.id===mid(2)).requires=[rid(8)];const proven=declare(p);
  const {next,invalidated}=mutate(proven,q=>q.inventory[1].access='passkey');assert.equal(next.continuity.checks[0].status,'needs_review');assert.deepEqual(invalidated.inventoryIds,[iid(1),iid(2)]);
});

test('unrelated account, dates, preferences, target order and checks do not enter a proof digest',()=>{
  const p=from('independent_second_device'),methods=outcome(p).results[0].methodIds,before=M.routeDigest(p,iid(1),methods);
  p.updatedAt=LATER;p.inventory[0].testedAt=NOW;p.inventory.push({id:iid(9),service:'bank',access:'unknown',recovery:'unknown',testedAt:null});p.journey.preferences.representation='discuss';p.care=blankCare();p.continuity.targetInventoryIds.unshift(iid(9));assert.equal(M.routeDigest(p,iid(1),methods),before);
});

test('configuration basis is stable across proof/date/array-order changes but includes mapping and priority',()=>{
  const p=from('independent_second_device'),q=declare(p);q.updatedAt=LATER;q.inventory[0].testedAt=NOW;q.continuity.methods.reverse();q.continuity.resources.reverse();assert.equal(M.configurationBasis(p),M.configurationBasis(q));q.continuity.resources.find(r=>r.id===rid(3)).readiness='unknown';assert.notEqual(M.configurationBasis(p),M.configurationBasis(q));
});

test('legacy dates outside this map stay intact; mapped legacy dates use conservative closure',()=>{
  const p=from('independent_second_device');p.inventory[0].testedAt=NOW;p.inventory.push({id:iid(9),service:'bank',access:'unknown',recovery:'unknown',testedAt:NOW});
  const {next,invalidated}=mutate(p,q=>q.continuity.resources.find(r=>r.id===rid(3)).readiness='unknown');assert.deepEqual(invalidated.inventoryIds,[iid(1)]);assert.equal(next.inventory[1].testedAt,NOW);
  const unscoped=mutate(p,q=>q.inventory[1].access='passkey');assert.deepEqual(unscoped.invalidated.inventoryIds,[iid(9)]);
});

test('changing the selected phone invalidates exact checks but never invents providers being unavailable',()=>{
  const p=declare(from('independent_second_device'));const {next}=mutate(p,q=>{q.continuity.resources.push(resource(9,'device'));q.continuity.primaryPhoneId=rid(9);});assert.equal(next.continuity.checks[0].status,'needs_review');assert.equal(outcome(next).results[0].state,'path_declared');
});

test('removing a referenced resource fails; explicit coherent removal invalidates its check',()=>{
  const p=declare(from('independent_second_device')),broken=copy(p);broken.continuity.resources=broken.continuity.resources.filter(r=>r.id!==rid(3));assert.throws(()=>valid(broken));
  const {next}=mutate(p,q=>{q.continuity.resources=q.continuity.resources.filter(r=>r.id!==rid(3));q.continuity.methods=q.continuity.methods.filter(m=>m.id!==mid(2));});assert.equal(next.continuity.checks[0].status,'needs_review');assert.equal(outcome(next).results[0].state,'blocked_in_model');
});

test('importing active declarations forces review and preserves only map/descriptive state',()=>{
  const p=declare(from('independent_second_device')),before=JSON.stringify(p.continuity),imported=M.invalidateImportedContinuity(p.continuity);assert.equal(imported.checks[0].status,'needs_review');assert.equal(imported.checks[0].declaredAt,null);assert.equal(JSON.stringify(p.continuity),before);assert.deepEqual(imported.resources,p.continuity.resources);assert.deepEqual(imported.methods,p.continuity.methods);
});

test('strict closed fields, readiness and proof states reject forged rights and secrets',()=>{
  const p=from('independent_second_device');
  for(const field of ['password','email','accountId','plan','verified','notes']){const q=copy(p);q.continuity[field]='x';assert.throws(()=>valid(q));const r=copy(p);r.continuity.resources[0][field]='x';assert.throws(()=>valid(r));const s=copy(p);s.continuity.methods[0][field]='x';assert.throws(()=>valid(s));}
  for(const state of ['verified','provider_verified','operator_verified']){const q=declare(p);q.continuity.checks[0].status=state;assert.throws(()=>valid(q));}
  const q=copy(p);q.continuity.resources[0].methodsComplete='true';assert.throws(()=>valid(q));q.continuity.resources[0].methodsComplete=1;assert.throws(()=>valid(q));
});

test('strict references and resource modes reject ambiguous or fabricated entry points',()=>{
  const base=from('independent_second_device');
  for(const mutate of [p=>p.continuity.primaryPhoneId=rid(2),p=>p.continuity.targetInventoryIds.push(iid(99)),p=>p.continuity.resources[1].mode='independent',p=>p.continuity.resources[0].inventoryId=iid(1),p=>p.continuity.methods[0].requires=[],p=>p.continuity.methods[0].requires=[rid(99)],p=>p.continuity.methods[1].requires=[rid(3),rid(3)],p=>p.continuity.resources.push({...p.continuity.resources[1],id:rid(22)}),p=>p.continuity.resources[1].mode='unknown']){const p=copy(base);mutate(p);assert.throws(()=>valid(p));}
});

test('getters, prototype changes, sparse lists and unknown array properties are rejected without execution',()=>{
  const p=from('independent_second_device');let executed=false;Object.defineProperty(p.continuity.resources[0],'readiness',{get(){executed=true;return 'declared_ready';}});assert.throws(()=>valid(p));assert.equal(executed,false);
  const proto=from('independent_second_device');Object.setPrototypeOf(proto.continuity,{secret:'x'});assert.throws(()=>valid(proto));
  const sparse=from('independent_second_device');delete sparse.continuity.resources[0];assert.throws(()=>valid(sparse));
  const annotated=from('independent_second_device');annotated.continuity.methods.extra=true;assert.throws(()=>valid(annotated));
});

test('dates and active proof digests have valid chronology without coercion',()=>{
  const p=declare(from('independent_second_device'));
  for(const date of ['1969-12-31T23:59:59.000Z','2026-11-07T12:00:00.000Z','2026-02-30T12:00:00.000Z','2026-11-06T12:00:00Z']){const q=copy(p);q.continuity.checks[0].declaredAt=date;assert.throws(()=>valid(q));}
  const q=copy(p);q.continuity.checks[0].basisDigest='0'.repeat(64);assert.throws(()=>valid(q));q.continuity.checks[0].basisDigest=null;assert.throws(()=>valid(q));
  assert.throws(()=>M.evaluatePhone(p,'2026-11-06T11:59:59.000Z'));
});

test('five selected targets do not narrow the existing twelve-account inventory',()=>{
  const p=from('independent_second_device');for(let n=2;n<=12;n++)p.inventory.push({id:iid(n),service:'other',access:'unknown',recovery:'unknown',testedAt:null});p.continuity.targetInventoryIds=p.inventory.slice(0,5).map(v=>v.id);assert.equal(valid(p).targetInventoryIds.length,5);assert.equal(p.inventory.length,12);p.continuity.targetInventoryIds.push(iid(6));assert.throws(()=>valid(p));
});

test('maximum realistic graph/check population fits forty kilobytes without truncation',t=>{
  const p={schema:'aeterna.passport.v4',updatedAt:NOW,journey:blankJourney(NOW),care:blankCare(),delegations:[],inventory:[],continuity:M.blankContinuity()};
  for(let n=1;n<=12;n++){p.inventory.push({id:iid(n),service:'email',access:'password_mfa',recovery:'offline',testedAt:null});p.continuity.resources.push(resource(n,'account',iid(n),'methods'));}
  p.continuity.resources.push(resource(13,'device'));p.continuity.primaryPhoneId=rid(13);
  for(let n=14;n<=24;n++)p.continuity.resources.push(resource(n,'offline'));
  for(let n=1;n<=48;n++)p.continuity.methods.push(method(n,rid(1+(n-1)%12),[rid(14+(n-1)%11)]));
  p.continuity.targetInventoryIds=p.inventory.slice(0,5).map(v=>v.id);
  for(let n=1;n<=12;n++){p.continuity.targetInventoryIds=[iid(n)];p.continuity=M.declareCheck(p,iid(n),'declared_success',[mid(n)],90,NOW);}
  p.continuity.targetInventoryIds=p.inventory.slice(0,5).map(v=>v.id);valid(p);assert.equal(p.continuity.checks.length,12);assert.equal(p.continuity.resources.length,24);assert.equal(p.continuity.methods.length,48);const bytes=new TextEncoder().encode(JSON.stringify(p)).length;assert.ok(bytes<40000,`realistic maximum: ${bytes} bytes`);t.diagnostic(`realistic full passport compact UTF-8: ${bytes} bytes`);
  const extra=copy(p);extra.continuity.resources.push(resource(25,'offline'));assert.throws(()=>valid(extra));
  const extraMethod=copy(p);extraMethod.continuity.methods.push(method(49,rid(1),[rid(14)]));assert.throws(()=>valid(extraMethod));
});

test('worst allowed relation density can exceed byte limit and must be rejected by enclosing passport validator',t=>{
  const p=from('independent_second_device');p.continuity.resources=[];p.continuity.methods=[];
  for(let n=1;n<=24;n++)p.continuity.resources.push({id:'resource_'+String(n).padStart(40,'0'),kind:n===1?'account':'device',inventoryId:n===1?iid(1):null,readiness:'declared_ready',mode:'methods',methodsComplete:true});
  p.continuity.primaryPhoneId=p.continuity.resources[1].id;for(let n=1;n<=48;n++)p.continuity.methods.push({id:'method_'+String(n).padStart(40,'0'),targetId:p.continuity.resources[(n-1)%24].id,purpose:'access',readiness:'unknown',requires:p.continuity.resources.map(r=>r.id)});
  valid(p);const bytes=new TextEncoder().encode(JSON.stringify(p)).length;assert.ok(bytes>40000);t.diagnostic(`dense graph full passport compact UTF-8: ${bytes} bytes`);
});


