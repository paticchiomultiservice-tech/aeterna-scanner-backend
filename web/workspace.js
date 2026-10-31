import {GOALS,CLIENTS,PHASES,DIMENSIONS,STATES,PREFERENCES,PHASE_DIMENSIONS,blankJourney,setGoal,setClient,recordPhase,setPreference,effectivePhaseStatus,suggestedPhases,simulate,exportJourney,importJourney,MAX_IMPORT_BYTES} from './core-model.mjs';
import {CORE_COPY,SOURCES} from './core-copy.js';
import {SERVICE_CATALOG,ACCOUNT_PLANS} from './service-catalog.js';

const CONFIGURATOR='https://paticchiomultiservice-tech.github.io/aeterna-guardian-configurator/';
const SUPPORT='mailto:info@aeternadigitallegacy.com';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const views=['today','plan','protocol','passport','simulator'];
const copyKeys={intro:'subtitle',sessionNote:'privacyNotice',todayTitle:'today',goalsHelp:'goalHelp',clientLabel:'clientTitle',clientHelp:'scopeNote',nextTitle:'nextAction',openAction:'openGuide',progressTitle:'progressLabel',progressNote:'selfReported',planTitle:'plan',planIntro:'planNote',commandPlan:'legacyCommand',assistedNote:'serviceMode',orderLinkNote:'addonsNote',contactSupport:'support',openConfigurator:'configure',protocolTitle:'protocol',statusLabel:'stateLabel',statusNote:'selfReported',sourceTitle:'source',sourceChecked:'checkedOn',passportTitle:'passport',importSuccess:'importOk',cleared:'clearDone',reviewCalendar:'downloadIcs',calendarNote:'icsHelp',diaryEmpty:'emptyDiary',simulatorTitle:'simulator',simulatorIntro:'simulationIntro',affectedTitle:'simulationResult',openTitle:'simulationOpen',noOpen:'noPendingNotSafe',scenarioNote:'simulationIntro',saveSuccess:'actionSaved',preferenceTitle:'preferencesTitle',notRecorded:'notSet'};

export function createWorkspace({root,getLocale=()=> 'it'}={}) {
  if(!root)throw new Error('Missing journey root');
  let account=null,journey=null,view='today',activePhase=null,scenario='phone',locale='it',feedback='',serial=0;
  const urls=new Set();
  const now=()=>new Date().toISOString();
  const language=()=>Object.hasOwn(CORE_COPY,locale)?locale:'it';
  const copy=()=>{
    const source=CORE_COPY[language()];
    return {...source,dimensions:Object.fromEntries(DIMENSIONS.map(key=>[key,{title:source.dimensions[key],help:source.dimensionsIntro[key]}])),preferences:Object.fromEntries(Object.keys(PREFERENCES).map(key=>[key,{label:source.ui[key],options:source.ui.preferenceValues}]))};
  };
  const ui=key=>{
    const current=copy(),value={todoCount:current.ui.states.todo,testedCount:current.ui.states.tested,reviewCount:current.ui.states.review}[key]??current.ui[copyKeys[key]||key];
    if(typeof value!=='string')throw new Error('Missing CORE translation: '+language()+'.'+key);
    return value;
  };
  const itemText=value=>typeof value==='string'?value:value?.title??value?.label??value?.name??'';
  const title=id=>itemText(copy().phases?.[id])||id;
  const stateLabel=status=>itemText(copy().ui.states?.[status])||status;
  const date=value=>value?new Intl.DateTimeFormat(language(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):ui('notRecorded');
  const button=(label,attrs='',extra='')=>`<button type="button" class="core-button${extra?' '+extra:''}" ${attrs}>${escape(label)}</button>`;
  const sourceLinks=ids=>(ids||[]).filter(id=>SOURCES[id]).map(id=>{const source=SOURCES[id];return `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title||source.label||id)} <span aria-hidden="true">↗</span></a>`;}).join('');
  function statusOf(id){return effectivePhaseStatus(journey,id,now());}
  function phaseCard(id,compact=false){
    const phase=copy().phases?.[id]||{},status=statusOf(id);
    return `<article class="core-action core-state-${escape(status)}"><div class="core-action-top"><span class="core-index">${String(PHASES.indexOf(id)+1).padStart(2,'0')}</span><span class="core-status core-state-${escape(status)}">${escape(stateLabel(status))}</span></div><h4>${escape(title(id))}</h4><p>${escape(phase.intro||phase.description||'')}</p>${button(ui('openAction'),`data-core-open="${escape(id)}"`,'core-action-button')}${compact?'':`<small>${escape(ui('dateLabel'))}: ${escape(date(journey.phases[id].updatedAt))}</small>`}</article>`;
  }
  function sectionHeading(key){return `<div class="core-section-heading"><p class="core-eyebrow">AETERNA CORE · PULSE365</p><h3 id="core-view-title" tabindex="-1">${escape(ui(key))}</h3></div>`;}
  function renderToday(){
    const statusCounts=Object.fromEntries(STATES.map(s=>[s,PHASES.filter(id=>statusOf(id)===s).length]));
    const next=suggestedPhases(journey,now());
    return sectionHeading('todayTitle')+`<div class="core-metrics" aria-label="${escape(ui('progressTitle'))}"><div><strong>${statusCounts.todo+statusCounts.declared}</strong><span>${escape(ui('todoCount'))}</span></div><div><strong>${statusCounts.tested}</strong><span>${escape(ui('testedCount'))}</span></div><div><strong>${statusCounts.review}</strong><span>${escape(ui('reviewCount'))}</span></div></div><p class="core-note">${escape(ui('progressNote'))}</p><div class="core-grid"><section class="core-card"><h4>${escape(ui('goalsTitle'))}</h4><p>${escape(ui('goalsHelp'))}</p><div class="core-goals">${GOALS.map(id=>`<label class="core-choice"><input type="checkbox" data-core-goal="${escape(id)}" ${journey.goals.includes(id)?'checked':''}><span>${escape(itemText(copy().goals?.[id])||id)}</span></label>`).join('')}</div><label for="core-client">${escape(ui('clientLabel'))}</label><select id="core-client">${CLIENTS.map(client=>`<option value="${escape(client)}" ${journey.clientType===client?'selected':''}>${escape(itemText(copy().clients?.[client])||client)}</option>`).join('')}</select><p class="core-small">${escape(ui('clientHelp'))}</p></section><section class="core-card"><h4>${escape(ui('nextTitle'))}</h4>${next.length?next.map(id=>phaseCard(id,true)).join(''):`<p>${escape(ui('allDone'))}</p>${button(ui('protocolTitle'),'data-core-nav="protocol"')}`}</section></div>`;
  }
  function renderPlan(){
    const key=ACCOUNT_PLANS[account.plan],plan=key?SERVICE_CATALOG[language()]?.plans?.[key]:null;
    return sectionHeading('planTitle')+`<p>${escape(ui('planIntro'))}</p><div class="core-grid"><section class="core-card"><p class="core-eyebrow">${escape(account.level||account.plan)}</p><h4>${escape(plan?.name||'Pulse365 · '+(account.level||account.plan))}</h4>${plan?`<p>${escape(plan.description)}</p><h5>${escape(ui('servicesTitle'))}</h5><ul>${plan.services.map(service=>`<li>${escape(service)}</li>`).join('')}</ul><p class="core-small">${escape(plan.duration||'')}</p>`:`<p>${escape(ui(account.plan==='pulse365_command'?'commandPlan':'unknownPlan'))}</p>`}<a class="core-button core-primary" href="#scanner-title">${escape(ui('scanner'))} ↗</a></section><section class="core-card"><h4>${escape(ui('assistedNote'))}</h4><p>${escape(ui('orderLinkNote'))}</p><div class="core-actions"><a class="core-button" href="${SUPPORT}">${escape(ui('contactSupport'))}</a><a class="core-button" href="${CONFIGURATOR}" target="_blank" rel="noopener noreferrer">${escape(ui('openConfigurator'))} ↗</a></div></section></div>`;
  }
  function renderProtocol(){
    const id=activePhase&&PHASES.includes(activePhase)?activePhase:null;
    const list=`<div class="core-protocol-list">${PHASES.map(key=>phaseCard(key)).join('')}</div>`;
    if(!id)return sectionHeading('protocolTitle')+`<p>${escape(ui('protocolIntro'))}</p><p class="core-note">${escape(ui('statusNote'))}</p>`+list;
    const phase=copy().phases[id],record=journey.phases[id];
    return sectionHeading('protocolTitle')+`<article class="core-guide"><div class="core-guide-heading"><span class="core-index">${String(PHASES.indexOf(id)+1).padStart(2,'0')}</span><div><h4>${escape(title(id))}</h4><p>${escape(phase.intro||phase.description||'')}</p></div></div><h5>${escape(ui('stepsTitle'))}</h5><ol>${phase.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><div class="core-grid"><div class="core-card"><h5>${escape(ui('evidenceTitle'))}</h5><p>${escape(phase.proof||phase.evidence||'')}</p></div><div class="core-card"><h5>${escape(ui('avoidTitle'))}</h5><p>${escape(phase.avoid||'')}</p></div></div><label for="core-phase-status">${escape(ui('statusLabel'))}</label><select id="core-phase-status" data-phase="${escape(id)}">${STATES.map(state=>`<option value="${state}" ${record.status===state?'selected':''}>${escape(stateLabel(state))}</option>`).join('')}</select><p class="core-small">${escape(ui('statusNote'))}</p><p class="core-small">${escape(ui('dateLabel'))}: ${escape(date(record.updatedAt))}${statusOf(id)!==record.status?' · '+escape(ui('reviewDue')):''}</p>${phase.sourceIds?.length?`<h5>${escape(ui('sourceTitle'))}</h5><div class="core-sources">${sourceLinks(phase.sourceIds)}</div><p class="core-small">${escape(ui('sourceChecked'))}: 31/10/2026</p>`:''}<div class="core-actions">${button(ui('protocolTitle'),'data-core-list="true"')}${button(ui('passportTitle'),'data-core-nav="passport"')}</div></article>`;
  }
  function dimensionCards(){return DIMENSIONS.map(id=>{const dimension=copy().dimensions?.[id];return `<section class="core-card"><p class="core-eyebrow">${escape(id==='ai'?'AI DELEGATION':id==='legacy'?'LEGACY HANDOVER':id==='trust'?'TRUST GRAPH':id==='identity'?'IDENTITY ROOT':'LIFE INVENTORY')}</p><h4>${escape(itemText(dimension)||id)}</h4><p>${escape(dimension?.help||dimension?.description||'')}</p><ul class="core-passport-list">${PHASES.filter(phase=>PHASE_DIMENSIONS[phase]===id).map(phase=>`<li><span>${escape(title(phase))}</span><strong class="core-state-${escape(statusOf(phase))}">${escape(stateLabel(statusOf(phase)))}</strong></li>`).join('')}</ul></section>`;}).join('');}
  function renderPreferences(){return `<section class="core-card core-preferences"><h4>${escape(ui('preferenceTitle'))}</h4>${Object.entries(PREFERENCES).map(([key,values])=>{const pref=copy().preferences?.[key]||{};return `<label for="core-pref-${key}">${escape(pref.label||pref.title||key)}</label><select id="core-pref-${key}" data-core-preference="${key}">${values.map(value=>`<option value="${value}" ${journey.preferences[key]===value?'selected':''}>${escape(itemText(pref.options?.[value])||value)}</option>`).join('')}</select>`;}).join('')}<p class="core-small">${escape(ui('passportIntro'))}</p></section>`;}
  function renderPassport(){return sectionHeading('passportTitle')+`<p>${escape(ui('passportIntro'))}</p><p class="core-note">${escape(ui('sessionNote'))}</p><div class="core-passport-grid">${dimensionCards()}</div>${renderPreferences()}<section class="core-card"><h4>${escape(ui('saveFirst'))}</h4><p>${escape(ui('exportWarning'))}</p><div class="core-actions">${button(ui('exportJson'),'data-core-export="json"')}${button(ui('exportHtml'),'data-core-export="html"')}<label class="core-button core-file-label" for="core-import">${escape(ui('importJson'))}<input id="core-import" type="file" accept="application/json,.json"></label>${button(ui('reviewCalendar'),'data-core-export="calendar"')}${button(ui('clearJourney'),'data-core-clear="true"')}</div><p class="core-small">${escape(ui('calendarNote'))}</p></section><section class="core-card"><h4>${escape(ui('diaryTitle'))}</h4>${journey.diary.length?`<ol class="core-diary">${journey.diary.slice().reverse().map(entry=>`<li><span>${escape(title(entry.phase))}</span><strong>${escape(stateLabel(entry.status))}</strong><time datetime="${escape(entry.time)}">${escape(date(entry.time))}</time></li>`).join('')}</ol>`:`<p>${escape(ui('diaryEmpty'))}</p>`}<p class="core-small">${escape(ui('statusNote'))}</p></section>`;}
  function renderSimulator(){
    const result=simulate(journey,scenario,now());
    return sectionHeading('simulatorTitle')+`<p>${escape(ui('simulatorIntro'))}</p><div class="core-scenario-choice">${['phone','cloud','helper'].map(id=>button(itemText(copy().scenarios?.[id])||id,`data-core-scenario="${id}" aria-pressed="${scenario===id}"`)).join('')}</div><article class="core-card"><h4>${escape(itemText(copy().scenarios?.[scenario])||scenario)}</h4><p>${escape(copy().scenarios?.[scenario]?.intro||copy().scenarios?.[scenario]?.description||'')}</p><div class="core-grid"><div><h5>${escape(ui('affectedTitle'))}</h5><ul>${result.affected.map(id=>`<li>${escape(title(id))}</li>`).join('')}</ul></div><div><h5>${escape(ui('openTitle'))}</h5>${result.open.length?`<ul>${result.open.map(id=>`<li>${escape(title(id))} · ${escape(stateLabel(statusOf(id)))}</li>`).join('')}</ul>`:`<p>${escape(ui('noOpen'))}</p>`}</div></div><div class="core-actions">${result.next.map(id=>button(title(id),`data-core-open="${id}"`)).join('')}</div><p class="core-note">${escape(ui('scenarioNote'))}</p></article>`;
  }
  function render({focus=false,keepFocus=false}={}){
    if(!account||!journey){root.replaceChildren();return;}
    const focused=keepFocus&&root.contains(document.activeElement)?document.activeElement?.id:null;
    root.className='core-workspace';
    const pages={today:renderToday,plan:renderPlan,protocol:renderProtocol,passport:renderPassport,simulator:renderSimulator};
    root.innerHTML=`<section aria-labelledby="core-title"><header class="core-header"><div><p class="core-eyebrow">AETERNA CORE · PULSE365</p><h2 id="core-title">${escape(ui('title'))}</h2><p>${escape(ui('intro'))}</p></div><span class="core-local-label">${escape(ui('loadedDeclaration'))}</span></header><nav class="core-nav" aria-label="AETERNA CORE">${views.map(id=>button(itemText(copy().nav?.[id])||ui(id+'Title'),`data-core-nav="${id}" aria-pressed="${view===id}"`)).join('')}<a class="core-button" href="#scanner-title">${escape(itemText(copy().nav?.scanner)||ui('scanner'))} ↗</a></nav><p class="core-session-note">${escape(ui('sessionNote'))}</p><p id="core-feedback" class="core-feedback" role="status" aria-live="polite">${escape(feedback)}</p><div class="core-view">${pages[view]()}</div></section>`;
    const capability=document.createElement('p');capability.className='core-session-note';capability.textContent=ui('noAi');root.querySelector('section').append(capability);
    if(view==='plan'&&account.plan==='scanner_10'){const notice=document.createElement('p');notice.className='core-note';notice.textContent=ui('scannerOnly')+' '+ui('upgradeNote');root.querySelector('.core-section-heading').after(notice);}
    root.querySelectorAll('[data-core-goal]').forEach(el=>{el.id='core-goal-'+el.dataset.coreGoal;});
    bind();
    if(focus)root.querySelector('#core-view-title')?.focus({preventScroll:true});
    else if(focused)root.querySelector('#'+focused)?.focus({preventScroll:true});
  }
  function change(callback){try{journey=callback();feedback=ui('saveSuccess');render({keepFocus:true});}catch{feedback=ui('importError');render({keepFocus:true});}}
  function switchView(next){if(!views.includes(next))return;view=next;feedback='';render({focus:true});root.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  function openPhase(id){if(!PHASES.includes(id))return;activePhase=id;switchView('protocol');}
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));urls.add(url);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},15000);}
  function printable(){
    const dimensionSections=DIMENSIONS.map(id=>{
      const dimension=copy().dimensions[id];
      return '<section><h2>'+escape(dimension.title)+'</h2><p>'+escape(dimension.help)+'</p><ul>'+PHASES.filter(phase=>PHASE_DIMENSIONS[phase]===id).map(phase=>'<li>'+escape(title(phase))+': '+escape(stateLabel(statusOf(phase)))+'</li>').join('')+'</ul></section>';
    }).join('');
    return '<!doctype html><html lang="'+language()+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>AETERNA · Continuity Passport</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:900px;margin:32px auto;padding:20px;color:#1b1b1b}h1,h2,h3{color:#765512}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #bbb}p,li{overflow-wrap:anywhere}small{font-size:13px}@media print{body{margin:0}h2{break-after:avoid}}</style></head><body><h1>AETERNA · Continuity Passport</h1><p>'+escape(ui('loadedDeclaration'))+' · '+escape(date(now()))+'</p><p>'+escape(ui('passportIntro'))+'</p><p>'+escape(ui('exportWarning'))+'</p><h2>'+escape(ui('goalsTitle'))+'</h2><ul>'+journey.goals.map(id=>'<li>'+escape(itemText(copy().goals[id]))+'</li>').join('')+'</ul>'+dimensionSections+'<h2>'+escape(ui('statusLabel'))+'</h2><table><thead><tr><th>'+escape(ui('protocolTitle'))+'</th><th>'+escape(ui('statusLabel'))+'</th><th>'+escape(ui('dateLabel'))+'</th></tr></thead><tbody>'+PHASES.map(id=>'<tr><td>'+escape(title(id))+'</td><td>'+escape(stateLabel(statusOf(id)))+'</td><td>'+escape(date(journey.phases[id].updatedAt))+'</td></tr>').join('')+'</tbody></table><h2>'+escape(ui('preferenceTitle'))+'</h2><ul>'+Object.entries(journey.preferences).map(([key,value])=>'<li>'+escape(copy().preferences[key].label)+': '+escape(itemText(copy().preferences[key].options[value]))+'</li>').join('')+'</ul><p>'+escape(ui('statusNote'))+'</p><p>'+escape(ui('scenarioNote'))+'</p><p>'+escape(ui('sessionNote'))+'</p><p>'+escape(ui('noAi'))+'</p><small>AETERNA CORE · aeterna.journey.v1 · '+escape(ui('sourceChecked'))+' 31/10/2026</small></body></html>';
  }
  function calendar(){
    const stamp=now().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const review=new Date(Date.now()+90*86400000).toISOString().slice(0,10).replace(/-/g,'');
    const next=new Date(Date.now()+91*86400000).toISOString().slice(0,10).replace(/-/g,'');
    const text=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AETERNA Digital Legacy//CORE Pulse365//'+language().toUpperCase(),'CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:aeterna-review-'+crypto.randomUUID()+'@aeternadigitallegacy.com','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+review,'DTEND;VALUE=DATE:'+next,'SUMMARY:'+text(ui('icsTitle')),'DESCRIPTION:'+text(ui('icsDescription')),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
  }
  function bind(){
    root.querySelectorAll('[data-core-nav]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.coreNav==='protocol')activePhase=null;switchView(el.dataset.coreNav);}));
    root.querySelectorAll('[data-core-open]').forEach(el=>el.addEventListener('click',()=>openPhase(el.dataset.coreOpen)));
    root.querySelector('[data-core-list]')?.addEventListener('click',()=>{activePhase=null;render({focus:true});});
    root.querySelectorAll('[data-core-goal]').forEach(el=>el.addEventListener('change',()=>change(()=>setGoal(journey,el.dataset.coreGoal,el.checked,now()))));
    root.querySelector('#core-client')?.addEventListener('change',event=>change(()=>setClient(journey,event.target.value,now())));
    root.querySelector('#core-phase-status')?.addEventListener('change',event=>change(()=>recordPhase(journey,event.target.dataset.phase,event.target.value,now())));
    root.querySelectorAll('[data-core-preference]').forEach(el=>el.addEventListener('change',()=>change(()=>setPreference(journey,el.dataset.corePreference,el.value,now()))));
    root.querySelectorAll('[data-core-scenario]').forEach(el=>el.addEventListener('click',()=>{scenario=el.dataset.coreScenario;render({focus:true});}));
    root.querySelectorAll('[data-core-export]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.coreExport==='json')download('AETERNA-CORE-percorso.json',exportJourney(journey,now()),'application/json;charset=utf-8');if(el.dataset.coreExport==='html')download('AETERNA-Continuity-Passport.html',printable(),'text/html;charset=utf-8');if(el.dataset.coreExport==='calendar')download('AETERNA-riesame-90-giorni.ics',calendar(),'text/calendar;charset=utf-8');}));
    root.querySelector('[data-core-clear]')?.addEventListener('click',()=>{if(window.confirm(ui('clearConfirm'))){journey=blankJourney(now());feedback=ui('cleared');render({focus:true});}});
    root.querySelector('#core-import')?.addEventListener('change',async event=>{const file=event.target.files?.[0],version=serial;event.target.value='';if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw new Error();const text=await file.text();if(version!==serial||!account)return;const restored=importJourney(text);if(!window.confirm(ui('importWarning')))return;journey=restored;feedback=ui('importSuccess');render({focus:true});}catch{if(version!==serial||!account)return;feedback=ui('importError');render({focus:true});}});
  }
  function safeAccount(value){if(!value||typeof value.plan!=='string'||typeof value.unlimited!=='boolean')throw new Error('Invalid account');return {plan:value.plan,level:typeof value.level==='string'?value.level:'',unlimited:value.unlimited,scans_remaining:value.scans_remaining,expires_at:value.expires_at};}
  return Object.freeze({
    setAccount(value){serial++;account=safeAccount(value);locale=getLocale();journey=blankJourney(now());view='today';activePhase=null;feedback='';render();},
    refreshAccount(value){if(!account)return;account=safeAccount(value);},
    setLocale(value){locale=Object.hasOwn(CORE_COPY,value)?value:'it';if(account)render();},
    clear(){serial++;account=null;journey=null;activePhase=null;feedback='';for(const url of urls)URL.revokeObjectURL(url);urls.clear();root.replaceChildren();}
  });
}
