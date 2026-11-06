import {blankContinuity,evaluatePhone,declareCheck,routeDigest} from './phone-model.mjs';
import {PHONE_COPY,phoneCopy} from './phone-copy.js';
import {EXTRA_COPY} from './extra-copy.js';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const KINDS=['device','cloud','offline','person','account'];
const RESOURCE_STATES=['unknown','declared_ready','unavailable'];
const METHOD_STATES=['unknown','planned','declared_ready'];
const MODES=['unknown','methods','independent'];
const DAYS=[30,90,180,365];
const CAPABILITY_GUARD='aeterna.phone-loss.v1';
const button=(text,attrs='',primary=false)=>'<button type="button" class="core-button'+(primary?' core-primary':'')+'" '+attrs+'>'+h(text)+'</button>';
const checkbox=(id,label,checked,attrs='')=>'<label class="core-check" for="'+h(id)+'"><input id="'+h(id)+'" type="checkbox" '+(checked?'checked ':'')+attrs+'>'+h(label)+'</label>';
const select=(id,label,values,current,labels)=>'<label for="'+h(id)+'">'+h(label)+'</label><select id="'+h(id)+'">'+values.map(value=>'<option value="'+h(value)+'" '+(value===current?'selected':'')+'>'+h(typeof labels==='function'?labels(value):labels[value])+'</option>').join('')+'</select>';
export function phoneAccountLabel(passport,id,locale){
  const row=passport.inventory.find(item=>item.id===id);if(!row)return phoneCopy(locale).unknown;
  const group=passport.inventory.filter(item=>item.service===row.service);
  return EXTRA_COPY[locale].services[row.service]+' '+(group.findIndex(item=>item.id===id)+1);
}
export function phoneResourceLabel(passport,id,locale){
  const continuity=passport.continuity||blankContinuity(),row=continuity.resources.find(item=>item.id===id);
  if(!row)return phoneCopy(locale).unknown;
  if(row.kind==='account')return phoneAccountLabel(passport,row.inventoryId,locale);
  return phoneCopy(locale).kinds[row.kind]+' '+(continuity.resources.filter(item=>item.kind===row.kind).findIndex(item=>item.id===id)+1);
}
function methodsFor(c,id){return c.methods.filter(item=>item.targetId===id);}
function knownDate(value,locale,fallback){return value?new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(value)):fallback;}
function checkSummary(passport,inventoryId,locale,now){
  const cp=phoneCopy(locale),row=passport.continuity.checks.find(check=>check.inventoryId===inventoryId);
  if(!row)return '<p>'+h(cp.checks.unrecorded)+'</p>';
  const due=row.declaredAt?new Date(Date.parse(row.declaredAt)+row.reviewAfterDays*86400000).toISOString():null;
  const expired=due&&Date.parse(now)>=Date.parse(due);
  return '<p><strong>'+h(expired?cp.checks.needs_review:cp.checks[row.status])+'</strong></p>'+
    (row.declaredAt?'<p>'+h(cp.proofDate)+': '+h(knownDate(row.declaredAt,locale,cp.none))+'<br>'+h(cp.reviewDue)+': '+h(knownDate(due,locale,cp.none))+'</p>'+renderPhoneRoute(passport,{methodIds:row.methodIds},locale,cp.declaredRoute):'');
}
export function renderPhoneRoute(passport,result,locale,title=null){
  const cp=phoneCopy(locale),c=passport.continuity;
  if(!result||!result.methodIds.length)return '<p>'+h(cp.proofNotReady)+'</p>';
  const methods=result.methodIds.map(id=>c.methods.find(row=>row.id===id)).filter(Boolean);
  const involved=new Set(methods.flatMap(method=>[method.targetId,...method.requires]));
  const independent=[...involved].map(id=>c.resources.find(row=>row.id===id)).filter(row=>row?.mode==='independent');
  return '<h5>'+h(title||cp.route)+'</h5><ul>'+methods.map(method=>'<li><strong>'+h(cp.purposes[method.purpose])+'</strong>: '+h(phoneResourceLabel(passport,method.targetId,locale))+' '+h(cp.depends)+' '+method.requires.map(id=>h(phoneResourceLabel(passport,id,locale))).join(' + ')+'.</li>').join('')+'</ul><h5>'+h(cp.prerequisites)+'</h5><ul>'+independent.map(row=>'<li>'+h(phoneResourceLabel(passport,row.id,locale))+': '+h(cp.independent)+'.</li>').join('')+'</ul><p>'+h(cp.sourceGuide)+'</p>';
}

// State is only in this panel instance. Loading/rendering does not migrate or save.
// The host owns v4 migration, invalidation and acknowledged profile revisions.
export function createPhonePanel({
  getPassport,getLanguage,updateContinuity,now=()=>new Date().toISOString(),
  rerender=()=>{},onOpenInventory=()=>{},onOpenGuide=()=>{},onExport=()=>{},
  getProfileState=()=>({enabled:false,state:'local'}),getCapabilities=()=>null,
  onStart=()=>false,canDeclare=()=>false
}={}){
  if(typeof getPassport!=='function'||typeof getLanguage!=='function'||typeof updateContinuity!=='function')throw Error('INVALID_PHONE_PANEL');
  let ui={step:'welcome',accountIndex:0,notice:'',focus:false,resourcesOpen:false,resultsOpen:false,resourceId:null,resourceDraft:null,accountDrafts:{},methodId:null,methodTarget:null,methodDraft:null,targetDraft:null,phoneDraft:null,returnStep:'account',proof:null,pending:false};
  let boundRoot=null,epoch=0;
  const lang=()=>getLanguage(),cp=()=>phoneCopy(lang()),p=()=>getPassport(),c=()=>p().continuity||blankContinuity();
  const makeId=prefix=>prefix+crypto.randomUUID();
  const isV4=()=>p().schema==='aeterna.passport.v4';
  function setStep(step){ui.step=step;ui.notice='';ui.focus=true;rerender();}
  function changed(next,after=''){const result=updateContinuity(clone(next));if(result===false)throw Error('invalid');ui.notice='savedChanges';ui.proof=null;if(after)ui.step=after;ui.focus=true;rerender();return result;}
  const labels=()=>({unknown:cp().unknown,declared_ready:cp().ready,unavailable:cp().unavailable,planned:cp().planned});
  const cardTitle=()=>c().targetInventoryIds[ui.accountIndex]||c().targetInventoryIds[0]||null;
  const resourceTitle=row=>row?phoneResourceLabel(p(),row.id,lang()):cp().newResource;
  const accountResource=id=>c().resources.find(row=>row.kind==='account'&&row.inventoryId===id);
  function freshAccount(id){return {id:makeId('resource_'),kind:'account',inventoryId:id,readiness:'unknown',mode:'unknown',methodsComplete:false};}
  function ensureAccount(next,id){let row=next.resources.find(item=>item.kind==='account'&&item.inventoryId===id);if(!row){if(next.resources.length>=24)throw Error('limit');row=freshAccount(id);next.resources.push(row);}return row;}
  function status(){
    if(!isV4())return '';
    const s=getProfileState();
    return '<p class="core-small" data-phone-session-state>'+h(s.enabled&&s.state==='saved'&&!s.pending?cp().remote:cp().local)+'</p>';
  }
  function heading(title,help,step){
    return '<div class="core-section-heading"><p class="core-eyebrow">'+h(cp().title)+(step?' · '+h(cp().step)+' '+step+' '+h(cp().of)+' 4':'')+'</p><h4 id="phone-view-title" tabindex="-1">'+h(title)+'</h4>'+(help?'<p>'+h(help)+'</p>':'')+'</div>';
  }
  function welcome(){
    const capability=getCapabilities(),checking=capability?.state==='loading';
    return heading(cp().title,cp().intro)+
      '<p>'+h(cp().scope)+'</p><p>'+h(cp().legacyProofNote)+'</p>'+
      (checking?'<p role="status">'+h(cp().checking)+'</p>':'')+
      '<div class="core-actions">'+button(cp().entry,'data-phone-start'+(ui.pending?' disabled':''),true)+'</div>';
  }
  function targets(){
    if(ui.targetDraft===null)ui.targetDraft=[...c().targetInventoryIds];
    const ids=ui.targetDraft.filter(id=>p().inventory.some(row=>row.id===id));
    if(!p().inventory.length)return heading(cp().targetsTitle,cp().targetsHelp,1)+'<p>'+h(cp().targetsEmpty)+'</p>'+button(cp().openInventory,'data-phone-inventory');
    return heading(cp().targetsTitle,cp().targetsHelp,1)+'<form id="phone-target-form"><fieldset><legend>'+h(cp().targetsTitle)+'</legend>'+p().inventory.map((row,i)=>checkbox('phone-target-'+i,phoneAccountLabel(p(),row.id,lang()),ids.includes(row.id),'data-phone-target="'+h(row.id)+'"')).join('')+'</fieldset><ol class="phone-selected">'+ids.map((id,i)=>'<li><span>'+h(phoneAccountLabel(p(),id,lang()))+'</span><div class="core-actions">'+button(cp().moveUp,'data-phone-move="'+h(id)+'" data-direction="-1"'+(i===0?' disabled':''))+button(cp().moveDown,'data-phone-move="'+h(id)+'" data-direction="1"'+(i===ids.length-1?' disabled':''))+'</div></li>').join('')+'</ol><div class="core-actions">'+button(cp().back,'data-phone-step="welcome"')+'<button class="core-button core-primary" type="submit">'+h(cp().next)+'</button></div></form>';
  }
  function phone(){
    if(ui.phoneDraft===null)ui.phoneDraft=c().primaryPhoneId||'';
    const devices=c().resources.filter(row=>row.kind==='device');
    return heading(cp().phoneTitle,cp().phoneHelp,2)+'<form id="phone-primary-form">'+
      select('phone-primary',cp().phoneTitle,['',...devices.map(row=>row.id)],ui.phoneDraft,value=>value?phoneResourceLabel(p(),value,lang()):cp().unknown)+
      '<div class="core-actions">'+button(cp().addPhone,'data-phone-add-primary')+button(cp().back,'data-phone-step="targets"')+'<button type="submit" class="core-button core-primary">'+h(cp().next)+'</button></div></form>';
  }
  function resourceForm(row,{account=false}={}){
    const draft=ui.resourceDraft||row,options=account||draft.kind==='account'?['unknown','methods']:MODES;
    return '<form id="phone-resource-form">'+(!account?select('phone-resource-kind',cp().kind,KINDS,draft.kind,value=>cp().kinds[value]):'')+
      (draft.kind==='account'&&!account?select('phone-resource-inventory',cp().accountResource,p().inventory.map(item=>item.id),draft.inventoryId||p().inventory[0]?.id,id=>phoneAccountLabel(p(),id,lang())):'')+
      select('phone-resource-ready',cp().resourceReady,RESOURCE_STATES,draft.readiness,labels())+
      select('phone-resource-mode',cp().mode,options,draft.mode,value=>cp()[value==='independent'?'modeIndependent':value==='methods'?'modeMethods':'modeUnknown'])+
      (draft.mode==='independent'?checkbox('phone-independent-confirm',cp().independentConfirm,Boolean(draft.confirmed)):'')+
      (draft.mode==='methods'?checkbox('phone-resource-complete',cp().complete,Boolean(draft.methodsComplete))+'<p class="core-small">'+h(cp().completeHelp)+'</p>':'')+
      '<div class="core-actions"><button type="submit" class="core-button core-primary">'+h(cp().save)+'</button>'+(!account?button(ui.resourceId?cp().back:cp().cancel,'data-phone-resource-cancel'):'')+'</div></form>';
  }
  function methodList(targetId){
    const methods=methodsFor(c(),targetId);
    return '<h5>'+h(cp().methodsTitle)+'</h5>'+(methods.length?'<ul class="phone-method-list">'+methods.map(method=>'<li><div><strong>'+h(cp().purposes[method.purpose])+'</strong> · '+h(labels()[method.readiness])+'<p>'+h(cp().requires)+': '+method.requires.map(id=>h(phoneResourceLabel(p(),id,lang()))).join(' + ')+'</p></div><div class="core-actions">'+button(cp().edit,'data-phone-edit-method="'+h(method.id)+'"')+button(cp().remove,'data-phone-remove-method="'+h(method.id)+'"')+'</div></li>').join('')+'</ul>':'<p>'+h(cp().noMethods)+'</p>')+button(cp().addMethod,'data-phone-add-method="'+h(targetId)+'"');
  }
  function resourceList(){
    return '<details class="core-secondary phone-resource-details" data-phone-resources'+(ui.resourcesOpen?' open':'')+'><summary>'+h(cp().resourcesTitle)+'</summary><ul>'+c().resources.map(row=>'<li><strong>'+h(phoneResourceLabel(p(),row.id,lang()))+'</strong> · '+h(labels()[row.readiness])+'<div class="core-actions">'+button(cp().edit,'data-phone-edit-resource="'+h(row.id)+'"')+button(cp().remove,'data-phone-remove-resource="'+h(row.id)+'"')+'</div></li>').join('')+'</ul>'+button(cp().addResource,'data-phone-add-resource')+'</details>';
  }
  function account(){
    const target=cardTitle();if(!target)return targets();
    const row=ui.accountDrafts[target]||accountResource(target)||(ui.resourceDraft?.kind==='account'&&ui.resourceDraft.inventoryId===target?ui.resourceDraft:freshAccount(target));
    if(!ui.resourceDraft||ui.resourceDraft.id!==row.id)ui.resourceDraft=clone(row);
    return heading(cp().accountTitle,phoneAccountLabel(p(),target,lang()),3)+'<p>'+h(cp().accessQuestion)+'</p><p>'+h(cp().alternativeQuestion)+'</p><p>'+h(cp().dependencyQuestion)+'</p><p class="core-small">'+h(cp().accountHelp)+'</p>'+
      resourceForm(row,{account:true})+(accountResource(target)?methodList(row.id):'')+resourceList()+
      '<div class="core-actions">'+button(cp().back,'data-phone-account-back')+button(ui.accountIndex<c().targetInventoryIds.length-1?cp().finishAccount:cp().saveAndSimulate,'data-phone-account-next',true)+'</div>';
  }
  function resource(){
    const row=ui.resourceDraft;
    if(!row)return account();
    return heading(cp().resourceTitle,ui.resourceId?resourceTitle(c().resources.find(item=>item.id===ui.resourceId)):cp().newResource,3)+resourceForm(row)+(ui.resourceId&&c().resources.find(item=>item.id===ui.resourceId)?.mode==='methods'?methodList(ui.resourceId):'');
  }
  function method(){
    const row=ui.methodDraft;
    if(!row)return account();
    return heading(cp().methodTitle,phoneResourceLabel(p(),ui.methodTarget,lang()),3)+
      '<form id="phone-method-form">'+select('phone-method-purpose',cp().purpose,['access','recovery'],row.purpose,value=>cp().purposes[value])+
      select('phone-method-ready',cp().methodReady,METHOD_STATES,row.readiness,labels())+
      '<fieldset><legend>'+h(cp().requires)+'</legend><p class="core-small">'+h(cp().requiresHelp)+'</p>'+c().resources.map((res,i)=>checkbox('phone-require-'+i,phoneResourceLabel(p(),res.id,lang()),row.requires.includes(res.id),'data-phone-require="'+h(res.id)+'"')).join('')+'</fieldset>'+
      '<div class="core-actions"><button type="submit" class="core-button core-primary">'+h(cp().saveMethod)+'</button>'+button(cp().cancel,'data-phone-method-cancel')+'</div></form>';
  }
  function resultDetails(result){
    const row=c().resources.find(item=>item.kind==='account'&&item.inventoryId===result.inventoryId);
    const details='<article class="phone-result"><h5>'+h(phoneAccountLabel(p(),result.inventoryId,lang()))+'</h5><p><strong>'+h(cp().outcomes[result.state])+'</strong></p><p>'+h(cp().reasons[result.reason]||cp().reasons.dependency_unknown)+'</p>'+
      (result.state==='path_declared'?'<p>'+h(cp().resultMustTry)+'</p>'+renderPhoneRoute(p(),result,lang()):'')+
      (result.cycles.length?'<p>'+h(cp().cycle)+': '+result.cycles.map(cycle=>cycle.map(id=>h(phoneResourceLabel(p(),id,lang()))).join(' → ')).join('; ')+'</p>':'')+
      (row?'<p class="core-small">'+h(row.methodsComplete?cp().completeList:cp().incomplete)+'</p>':'')+
      checkSummary(p(),result.inventoryId,lang(),now())+
      (result.state==='path_declared'?button(cp().proofTitle,'data-phone-proof="'+h(result.inventoryId)+'"'):'')+'</article>';
    return details;
  }
  function result(){
    const assessment=evaluatePhone(p(),now()),action=assessment.action;
    if(!c().targetInventoryIds.length)return heading(cp().resultTitle,cp().noTargets,4)+button(cp().actions.choose_target,'data-phone-step="targets"',true);
    return heading(cp().resultTitle,cp().resultHelp,4)+'<section class="core-action"><p class="core-eyebrow">'+h(cp().nextAction)+'</p><h5>'+h(cp().actions[action.code])+'</h5>'+
      (action.inventoryId?'<p>'+h(phoneAccountLabel(p(),action.inventoryId,lang()))+'</p>':'')+'<p>'+h(cp().reasons[action.reason]||cp().reasons.dependency_unknown)+'</p>'+
      button(cp().openAction,'data-phone-action',true)+
      (action.phase?button(cp().openGuide,'data-phone-guide="'+h(action.phase)+'"'):'')+'</section>'+
      '<details class="core-secondary" data-phone-results'+(ui.resultsOpen?' open':'')+'><summary>'+h(cp().details)+'</summary>'+assessment.results.map(resultDetails).join('')+'</details>'+
      '<p>'+h(cp().limits)+'</p><p class="core-small">'+h(cp().legacyProofNote)+'</p><div class="core-actions">'+button(cp().editMap,'data-phone-step="targets"')+button(cp().export,'data-phone-export')+'</div>';
  }
  function proof(){
    const prepared=ui.proof,assessment=evaluatePhone(p(),now()),found=assessment.results.find(row=>row.inventoryId===prepared?.inventoryId);
    let same=false;
    try{same=Boolean(prepared&&found?.state==='path_declared'&&routeDigest(p(),prepared.inventoryId,prepared.methodIds)===prepared.digest);}catch{}
    if(!same)return heading(cp().proofTitle,cp().proofChanged)+button(cp().back,'data-phone-step="result"');
    const stable=canDeclare();
    return heading(cp().proofTitle,phoneAccountLabel(p(),prepared.inventoryId,lang()))+'<p>'+h(cp().proofIntro)+'</p>'+renderPhoneRoute(p(),{...found,methodIds:prepared.methodIds},lang())+
      '<p class="core-note">'+h(cp().limits)+'</p>'+(!stable?'<p role="status">'+h(cp().proofNeedSave)+'</p>':'')+
      '<form id="phone-proof-form">'+checkbox('phone-proof-confirm',cp().proofConfirm,Boolean(prepared.confirmed),stable?'':'disabled')+
      select('phone-proof-days',cp().reviewDays,DAYS,prepared.days,value=>value+' '+cp().days)+
      '<div class="core-actions"><button class="core-button core-primary" type="submit" name="outcome" value="declared_success" '+(!stable?'disabled':'')+'>'+h(cp().proofSuccess)+'</button><button class="core-button" type="submit" name="outcome" value="declared_failure" '+(!stable?'disabled':'')+'>'+h(cp().proofFailure)+'</button>'+button(cp().editMap,'data-phone-step="targets"')+button(cp().back,'data-phone-step="result"')+'</div></form>';
  }
  function render(){
    for(const [selector,key] of [['[data-phone-resources]','resourcesOpen'],['[data-phone-results]','resultsOpen']]){
      const detail=boundRoot?.querySelector(selector);
      if(typeof detail?.open==='boolean')ui[key]=detail.open;
    }
    phoneCopy(lang());
    if(!isV4())ui.step='welcome';
    const renders={welcome,targets,phone,account,resource,method,result,proof};
    return '<section class="core-card phone-panel" data-phone-panel aria-labelledby="phone-view-title">'+status()+
      '<p class="core-feedback" role="status" aria-live="polite" data-phone-feedback>'+h(ui.notice?cp()[ui.notice]||cp().invalid:'')+'</p>'+
      (renders[ui.step]||welcome)()+'</section>';
  }
  function saveResourceFrom(root){
    const next=clone(c()),draft=ui.resourceDraft;if(!draft)throw Error('invalid');
    const kind=root.querySelector('#phone-resource-kind')?.value||draft.kind;
    const account=kind==='account',inventoryId=account?(root.querySelector('#phone-resource-inventory')?.value||draft.inventoryId):null;
    const readiness=root.querySelector('#phone-resource-ready').value,mode=root.querySelector('#phone-resource-mode').value;
    const associated=methodsFor(next,draft.id);
    if(mode!=='methods'&&associated.length)throw Error('resourceModeBlocked');
    if(mode==='independent'&&!root.querySelector('#phone-independent-confirm')?.checked)throw Error('invalid');
    if(account&&next.resources.some(row=>row.id!==draft.id&&row.kind==='account'&&row.inventoryId===inventoryId))throw Error('invalid');
    const value={id:draft.id,kind,inventoryId,readiness,mode,methodsComplete:mode==='independent'?true:mode==='unknown'?false:Boolean(root.querySelector('#phone-resource-complete')?.checked)};
    const idx=next.resources.findIndex(row=>row.id===value.id);
    if(idx<0){if(next.resources.length>=24)throw Error('limit');next.resources.push(value);}else next.resources[idx]=value;
    ui.resourceDraft=clone(value);if(value.kind==='account')delete ui.accountDrafts[value.inventoryId];if(ui.step==='resource')ui.resourceId=value.id;
    changed(next,ui.step==='resource'?'resource':'account');
  }
  function saveMethodFrom(root){
    const next=clone(c()),draft=ui.methodDraft,requires=[...root.querySelectorAll('[data-phone-require]:checked')].map(el=>el.dataset.phoneRequire);
    if(!requires.length)throw Error('required');
    const value={id:draft.id,targetId:ui.methodTarget,purpose:root.querySelector('#phone-method-purpose').value,readiness:root.querySelector('#phone-method-ready').value,requires};
    const idx=next.methods.findIndex(row=>row.id===value.id),resource=next.resources.find(row=>row.id===value.targetId);
    if(!resource)throw Error('invalid');
    resource.mode='methods';
    if(idx<0){if(next.methods.length>=48)throw Error('limit');next.methods.push(value);}else next.methods[idx]=value;
    if(resource.kind==='account')delete ui.accountDrafts[resource.inventoryId];ui.resourceDraft=null;changed(next,ui.returnStep);
  }
  function openResource(id){
    const row=id?c().resources.find(item=>item.id===id):null;
    ui.returnStep=ui.step==='resource'?'account':ui.step;ui.resourceId=id||null;
    ui.resourceDraft=clone(row||{id:makeId('resource_'),kind:'device',inventoryId:null,readiness:'unknown',mode:'unknown',methodsComplete:false});
    setStep('resource');
  }
  function openMethod(target,id=null){
    const row=id?c().methods.find(item=>item.id===id):null;
    ui.returnStep=ui.step;ui.methodId=id;ui.methodTarget=target;ui.methodDraft=clone(row||{id:makeId('method_'),targetId:target,purpose:'access',readiness:'unknown',requires:[]});
    setStep('method');
  }
  function captureDraft(root){
    if(ui.step==='targets')ui.targetDraft=[...ui.targetDraft.filter(id=>root.querySelector('[data-phone-target="'+id+'"]')?.checked),...[...root.querySelectorAll('[data-phone-target]:checked')].map(el=>el.dataset.phoneTarget).filter(id=>!ui.targetDraft.includes(id))];
    if(ui.step==='phone')ui.phoneDraft=root.querySelector('#phone-primary')?.value||'';
    if((ui.step==='resource'||ui.step==='account')&&ui.resourceDraft){
      const draft=ui.resourceDraft;
      draft.kind=root.querySelector('#phone-resource-kind')?.value||draft.kind;
      draft.inventoryId=draft.kind==='account'?(root.querySelector('#phone-resource-inventory')?.value||draft.inventoryId):null;
      draft.readiness=root.querySelector('#phone-resource-ready')?.value||draft.readiness;
      draft.mode=root.querySelector('#phone-resource-mode')?.value||draft.mode;
      draft.methodsComplete=Boolean(root.querySelector('#phone-resource-complete')?.checked);
      draft.confirmed=Boolean(root.querySelector('#phone-independent-confirm')?.checked);
      if(ui.step==='account'&&draft.kind==='account')ui.accountDrafts[draft.inventoryId]=clone(draft);
    }
    if(ui.step==='method'&&ui.methodDraft){
      ui.methodDraft.purpose=root.querySelector('#phone-method-purpose')?.value||ui.methodDraft.purpose;
      ui.methodDraft.readiness=root.querySelector('#phone-method-ready')?.value||ui.methodDraft.readiness;
      ui.methodDraft.requires=[...root.querySelectorAll('[data-phone-require]:checked')].map(el=>el.dataset.phoneRequire);
    }
    if(ui.step==='proof'&&ui.proof){ui.proof.confirmed=Boolean(root.querySelector('#phone-proof-confirm')?.checked);ui.proof.days=Number(root.querySelector('#phone-proof-days')?.value||ui.proof.days);}
  }
  function guarded(fn){return event=>{try{fn(event);}catch(error){ui.notice=Object.hasOwn(cp(),error?.message)?error.message:'invalid';ui.focus=true;rerender();}};}
  function bind(root){
    boundRoot=root;
    for(const [selector,key] of [['[data-phone-resources]','resourcesOpen'],['[data-phone-results]','resultsOpen']]){
      const detail=root.querySelector(selector);
      detail?.addEventListener('toggle',()=>{ui[key]=detail.open;});
    }
    const q=(selector,fn)=>root.querySelectorAll(selector).forEach(el=>el.addEventListener('click',guarded(event=>fn(el,event))));
    q('[data-phone-start]',async()=>{
      const version=epoch;ui.pending=true;ui.notice='';rerender();
      try{const accepted=await onStart();if(version!==epoch)return;if(accepted===false||!isV4()){ui.notice='notAvailable';rerender();return;}ui.targetDraft=null;setStep('targets');}
      catch{if(version===epoch){ui.notice='notAvailable';rerender();}}
      finally{if(version===epoch){ui.pending=false;rerender();}}
    });
    q('[data-phone-inventory]',()=>onOpenInventory());
    q('[data-phone-step]',el=>{if(el.dataset.phoneStep==='targets')ui.targetDraft=null;if(el.dataset.phoneStep==='phone')ui.phoneDraft=null;setStep(el.dataset.phoneStep);});
    q('[data-phone-move]',el=>{
      captureDraft(root);const i=ui.targetDraft.indexOf(el.dataset.phoneMove),j=i+Number(el.dataset.direction);
      if(i>=0&&j>=0&&j<ui.targetDraft.length)[ui.targetDraft[i],ui.targetDraft[j]]=[ui.targetDraft[j],ui.targetDraft[i]];
      ui.focus=true;rerender();
    });
    root.querySelectorAll('[data-phone-target]').forEach(el=>el.addEventListener('change',guarded(()=>{
      const previous=[...ui.targetDraft];captureDraft(root);
      if(ui.targetDraft.length>5){ui.targetDraft=previous;ui.notice='targetLimit';rerender();}
    })));
    root.querySelector('#phone-target-form')?.addEventListener('submit',guarded(event=>{
      event.preventDefault();captureDraft(root);if(ui.targetDraft.length<1)throw Error('noTargets');if(ui.targetDraft.length>5)throw Error('targetLimit');
      const next=clone(c());next.targetInventoryIds=[...ui.targetDraft];ui.phoneDraft=null;changed(next,'phone');
    }));
    root.querySelector('#phone-primary-form')?.addEventListener('submit',guarded(event=>{
      event.preventDefault();captureDraft(root);const next=clone(c());next.primaryPhoneId=ui.phoneDraft||null;ui.accountIndex=0;ui.resourceDraft=null;changed(next,'account');
    }));
    q('[data-phone-add-primary]',()=>{
      const next=clone(c());if(next.resources.length>=24)throw Error('limit');
      const row={id:makeId('resource_'),kind:'device',inventoryId:null,readiness:'unknown',mode:'unknown',methodsComplete:false};next.resources.push(row);next.primaryPhoneId=row.id;ui.phoneDraft=row.id;changed(next,'phone');
    });
    q('[data-phone-account-back]',()=>{captureDraft(root);ui.resourceDraft=null;if(ui.accountIndex>0){ui.accountIndex--;setStep('account');}else setStep('phone');});
    q('[data-phone-account-next]',()=>{
      saveResourceFrom(root);
      ui.resourceDraft=null;if(ui.accountIndex<c().targetInventoryIds.length-1){ui.accountIndex++;setStep('account');}else setStep('result');
    });
    root.querySelector('#phone-resource-form')?.addEventListener('submit',guarded(event=>{event.preventDefault();saveResourceFrom(root);}));
    ['phone-resource-kind','phone-resource-mode'].forEach(id=>root.querySelector('#'+id)?.addEventListener('change',guarded(()=>{captureDraft(root);ui.focus=false;rerender();})));
    root.querySelector('#phone-resource-form')?.addEventListener('change',()=>captureDraft(root));
    q('[data-phone-add-resource]',()=>openResource(null));
    q('[data-phone-edit-resource]',el=>openResource(el.dataset.phoneEditResource));
    q('[data-phone-resource-cancel]',()=>{ui.resourceDraft=null;setStep(ui.returnStep==='resource'?'account':ui.returnStep);});
    q('[data-phone-remove-resource]',el=>{
      const id=el.dataset.phoneRemoveResource,next=clone(c()),row=next.resources.find(item=>item.id===id);
      if(id===next.primaryPhoneId||next.methods.some(method=>method.targetId===id||method.requires.includes(id))||row?.kind==='account'&&next.targetInventoryIds.includes(row.inventoryId))throw Error('inventoryReferenced');
      next.resources=next.resources.filter(item=>item.id!==id);changed(next);
    });
    q('[data-phone-add-method]',el=>openMethod(el.dataset.phoneAddMethod));
    q('[data-phone-edit-method]',el=>{const method=c().methods.find(row=>row.id===el.dataset.phoneEditMethod);if(method)openMethod(method.targetId,method.id);});
    q('[data-phone-remove-method]',el=>{const next=clone(c());next.methods=next.methods.filter(row=>row.id!==el.dataset.phoneRemoveMethod);changed(next);});
    root.querySelector('#phone-method-form')?.addEventListener('submit',guarded(event=>{event.preventDefault();saveMethodFrom(root);}));
    root.querySelector('#phone-method-form')?.addEventListener('change',()=>captureDraft(root));
    q('[data-phone-method-cancel]',()=>{ui.methodDraft=null;setStep(ui.returnStep);});
    q('[data-phone-guide]',el=>onOpenGuide(el.dataset.phoneGuide));
    q('[data-phone-export]',()=>{if(c().targetInventoryIds.length)onExport();});
    q('[data-phone-action]',()=>{
      const action=evaluatePhone(p(),now()).action;
      if(action.code==='choose_target'){ui.targetDraft=null;setStep('targets');}
      else if(action.code==='choose_phone'){ui.phoneDraft=null;setStep('phone');}
      else if(action.code==='prepare_check'||action.code==='repeat_check')openProof(action.inventoryId);
      else if(action.code==='export_or_review')onExport();
      else {ui.accountIndex=Math.max(0,c().targetInventoryIds.indexOf(action.inventoryId));ui.resourceDraft=null;setStep('account');}
    });
    const openProof=inventoryId=>{
      const result=evaluatePhone(p(),now()).results.find(row=>row.inventoryId===inventoryId);
      if(result?.state!=='path_declared')throw Error('proofNotReady');
      ui.proof={inventoryId,methodIds:[...result.methodIds],digest:routeDigest(p(),inventoryId,result.methodIds),days:p().care?.review?.cadenceDays||90,confirmed:false};setStep('proof');
    };
    q('[data-phone-proof]',el=>openProof(el.dataset.phoneProof));
    root.querySelector('#phone-proof-form')?.addEventListener('change',()=>captureDraft(root));
    root.querySelector('#phone-proof-form')?.addEventListener('submit',guarded(event=>{
      event.preventDefault();captureDraft(root);
      if(!canDeclare())throw Error('proofNeedSave');
      if(!ui.proof?.confirmed)throw Error('invalid');
      if(routeDigest(p(),ui.proof.inventoryId,ui.proof.methodIds)!==ui.proof.digest)throw Error('proofChanged');
      const outcome=event.submitter?.value;if(!['declared_success','declared_failure'].includes(outcome))throw Error('invalid');
      const next=declareCheck(p(),ui.proof.inventoryId,outcome,ui.proof.methodIds,ui.proof.days,now());
      changed(next,'result');ui.notice='recorded';rerender();
    }));
    if(ui.focus){ui.focus=false;root.querySelector('#phone-view-title')?.focus();}
  }
  function printable({exportedAt=now()}={}){
    const passport=p();if(passport.schema!=='aeterna.passport.v4'||!passport.continuity.targetInventoryIds.length)return '';
    const cp=phoneCopy(lang()),assessment=evaluatePhone(passport,exportedAt),next=assessment.action,continuity=passport.continuity;
    const dependencies=continuity.resources.map(resource=>{
      const methods=methodsFor(continuity,resource.id);
      const mode=resource.mode==='independent'?cp.independent:resource.mode==='unknown'?cp.unknown:resource.methodsComplete?cp.completeList:cp.incomplete;
      return '<li><strong>'+h(phoneResourceLabel(passport,resource.id,lang()))+'</strong>: '+h(labels()[resource.readiness])+'. '+h(mode)+
        (methods.length?'<ul>'+methods.map(method=>'<li>'+h(cp.purposes[method.purpose])+': '+h(labels()[method.readiness])+'. '+h(cp.depends)+' '+method.requires.map(id=>h(phoneResourceLabel(passport,id,lang()))).join(' + ')+'.</li>').join('')+'</ul>':'')+'</li>';
    }).join('');
    return '<section class="phone-export"><h2>'+h(cp.title)+'</h2><p>'+h(cp.exportAt)+': '+h(knownDate(exportedAt,lang(),cp.none))+'</p><p>'+h(cp.scenario)+': '+h(cp.title)+'. '+h(cp.excluded)+': '+h(continuity.primaryPhoneId?phoneResourceLabel(passport,continuity.primaryPhoneId,lang()):cp.phoneMissing)+'.</p><h3>'+h(cp.selected)+'</h3><ol>'+continuity.targetInventoryIds.map(id=>'<li>'+h(phoneAccountLabel(passport,id,lang()))+'</li>').join('')+'</ol><h3>'+h(cp.resourcesTitle)+'</h3><ul>'+dependencies+'</ul><h3>'+h(cp.details)+'</h3>'+assessment.results.map(result=>'<section><h4>'+h(phoneAccountLabel(passport,result.inventoryId,lang()))+'</h4><p><strong>'+h(cp.outcomes[result.state])+'</strong></p><p>'+h(cp.reasons[result.reason]||cp.reasons.dependency_unknown)+'</p>'+(result.state==='path_declared'?'<p>'+h(cp.resultMustTry)+'</p>'+renderPhoneRoute(passport,result,lang()):'')+checkSummary(passport,result.inventoryId,lang(),exportedAt)+'</section>').join('')+'<h3>'+h(cp.nextAction)+'</h3><p><strong>'+h(cp.actions[next.code])+'</strong></p><p>'+h(cp.reasons[next.reason]||cp.reasons.dependency_unknown)+'</p><p>'+h(cp.sourceGuide)+'</p><p>'+h(cp.limits)+'</p><p>'+h(cp.scope)+'</p><p>'+h(cp.legacyProofNote)+'</p><p>'+h(cp.exportLimit)+'</p></section>';
  }
  return Object.freeze({render,bind,printable,title:()=>cp().title,copy:()=>cp(),reset(){epoch++;ui={step:'welcome',accountIndex:0,notice:'',focus:false,resourcesOpen:false,resultsOpen:false,resourceId:null,resourceDraft:null,accountDrafts:{},methodId:null,methodTarget:null,methodDraft:null,targetDraft:null,phoneDraft:null,returnStep:'account',proof:null,pending:false};boundRoot=null;},getUiState:()=>clone(ui)});
}

