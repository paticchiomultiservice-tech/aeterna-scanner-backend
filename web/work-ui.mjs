import {WORK_COPY} from './work-copy.js';
import {buildWorkZip,exportWorkBackup,importWorkBackup,readWorkZip,MAX_WORK_BACKUP_BYTES,WORK_BACKUP_NAME,WORK_READABLE_NAME} from './work-package.mjs';
import {importDocument,MAX_DOCUMENT_BYTES} from './document-format.mjs';
import {importCapsuleBackup,MAX_BACKUP_BYTES} from './capsule-backup.mjs';
import {capsuleHtml} from './capsule-panel.js';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=lang=>WORK_COPY[lang]||WORK_COPY.it;
const btn=(label,attrs='',primary=false,disabled=false)=>`<button type="button" class="core-button${primary?' core-primary':''}" ${attrs}${disabled?' disabled':''}>${h(label)}</button>`;
const displayDate=(value,lang)=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
const ZIP_FILE='AETERNA Digital Legacy.zip';
const MAX_INPUT_BYTES=12*1024*1024;

function offlineIndex(copies,lang){
 const c=copy(lang),active=[...copies].filter(item=>item.copyState!=='replaced').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const latest=active[0],card=item=>`Capsula-${item.id}.html`;
 const other=copies.filter(item=>item!==latest);
 return `<!doctype html><html lang="${h(lang)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AETERNA Digital Legacy · ${h(c.title)}</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:700px;margin:40px auto;padding:22px;color:#16241d;background:#f6f2e6}h1{line-height:1.2}a{display:block;color:#16301e;margin:14px 0}nav a{padding:16px;border-radius:12px;background:#e3c567;font-weight:750}a:focus-visible,summary:focus-visible{outline:3px solid #194b30;outline-offset:4px}details{margin:20px 0}small{display:block}</style><h1>AETERNA Digital Legacy</h1><p>${h(c.lead)}</p><nav><a href="${encodeURIComponent(WORK_READABLE_NAME)}">${h(c.readable)}</a>${latest?`<a href="${card(latest)}">${h(c.qr)}</a>${latest.needsReview?`<small>${h(c.review)}</small>`:''}`:`<p>${h(c.noQr)}</p>`}</nav>${other.length?`<details><summary>${h(c.otherCards)}</summary>${other.map(item=>`<a href="${card(item)}">${h(displayDate(item.createdAt,lang))} · ${h(item.id.slice(-6))}</a>`).join('')}</details>`:''}<p>${h(c.instructions)}</p><a href="${encodeURIComponent(WORK_BACKUP_NAME)}">${h(c.restoreFile)}</a><small>${h(c.privacy)}</small></html>`;
}

export function createWorkPanel({getFolder,getSnapshot,acceptSaved,restoreSnapshot,shouldConfirm,download,getLanguage,rerender,isPreparing=()=>false}){
 let busy=false,status='',epoch=0,rows=[],listed=false,pending=null,portable=false;
 const lang=()=>getLanguage(),c=()=>copy(lang());
 function render(){
  const folder=getFolder(),ready=folder?.getState().connected,disabled=busy||isPreparing();
  const folderHint=folder&&!ready&&!disabled&&(!status||portable)?(portable?c().retryFolder:c().setup):'';
  return `<aside class="core-card work-save" aria-label="${h(c().title)}"><div><h4>${h(c().title)}</h4><p>${h(c().lead)}</p></div><div class="core-actions">${btn(c().save,folderHint?'data-work-save aria-describedby="work-save-folder-hint"':'data-work-save',true,disabled)}${btn(c().open,'data-work-open',false,disabled)}</div>${folderHint?`<small id="work-save-folder-hint">${h(folderHint)}</small>`:''}<p id="work-save-status" role="status" aria-live="polite">${h(status||(isPreparing()?c().waiting:''))}</p>${portable?btn(c().download,'data-work-download',false,disabled):''}${pending?btn(c().confirm,'data-work-confirm',false,disabled):''}${listed?`<div id="work-package-list"><p>${h(rows.length?c().choose:c().empty)}</p>${rows.map(row=>`<article class="work-snapshot"><strong>${h(displayDate(row.lastModified,lang()))}</strong><small>${h(row.name.split('-').at(-2)?.slice(0,8)||'')}</small>${btn(c().openThis,`data-work-package-open="${h(row.name)}"`,false,disabled)}</article>`).join('')}${btn(c().openFile,'data-work-file',false,disabled)}</div>`:''}<input id="work-import" type="file" accept=".zip,.json,.html,application/zip,application/json,text/html" hidden></aside>`;
 }
 function build(){
  const snapshot=getSnapshot();
  const backupText=exportWorkBackup({passport:snapshot.passport,capsule:{draft:snapshot.capsule.draft,copies:snapshot.capsule.copies}},{at:snapshot.at});
  return {snapshot,backupText,passportHtml:snapshot.passportHtml,capsuleHtmls:snapshot.capsule.copies.map(item=>({name:`Capsula-${item.id}.html`,html:capsuleHtml(item)})),indexHtml:offlineIndex(snapshot.capsule.copies,lang()),guide:`AETERNA Digital Legacy\n\n${c().instructions}\n\n${c().privacy}\n`};
 }
 function downloadPackage(){
  if(busy||isPreparing())return;
  try{const data=build();download(ZIP_FILE,buildWorkZip(data),'application/zip');pending=data.snapshot;portable=false;status=c().zip;rerender();}
  catch{status=c().error;portable=true;rerender();}
 }
 async function save(){
  if(busy||isPreparing())return;
  const folder=getFolder();if(!folder){downloadPackage();return;}
  const version=epoch;
  try{
   const data=build(),connect=folder.getState().connected?null:folder.connect();
   busy=true;portable=false;status=c().saving;rerender();
   if(connect)await connect;if(version!==epoch)return;
   await folder.saveWorkPackage(data);if(version!==epoch)return;
   pending=null;status=c().saved+(acceptSaved(data.snapshot)?'':' '+c().changed);
  }catch(error){if(version===epoch){status=error?.code==='CAPSULE_FOLDER_CANCELLED'?c().cancelled:c().error;portable=true;}}
  finally{if(version===epoch){busy=false;rerender();}}
 }
 function adopt(data){
  if(shouldConfirm(data)&&!window.confirm(c().restoreAsk))return;
  restoreSnapshot(data);pending=null;status=c().opened;listed=false;rows=[];
 }
 async function open(root){
  if(busy||isPreparing())return;
  const folder=getFolder();if(!folder){root.querySelector('#work-import')?.click();return;}
  const version=epoch,connect=folder.getState().connected?null:folder.connect({create:false});
  busy=true;status='';rerender();
  try{if(connect)await connect;if(version!==epoch)return;const result=await folder.listPackages();if(version!==epoch)return;rows=result;listed=true;}
  catch(error){if(version===epoch){listed=true;rows=[];status=error?.code==='CAPSULE_FOLDER_CANCELLED'?c().cancelled:c().error;}}
  finally{if(version===epoch){busy=false;rerender();}}
 }
 function parseText(text){
  try{return importWorkBackup(text);}catch(error){
   // Explicit backwards compatibility with the existing private files. An
   // invalid whole-work envelope cannot be treated as a different file type.
   if(text.includes('"aeterna.work-backup.v1"'))throw error;
   try{return {passport:importDocument(text)};}catch{}
   if(new TextEncoder().encode(text).length<=MAX_BACKUP_BYTES)return {capsule:importCapsuleBackup(text)};
   throw error;
  }
 }
 function bind(root){
  root.querySelectorAll('[data-work-save],[data-work-save-capsule]').forEach(el=>el.addEventListener('click',()=>void save()));
  root.querySelector('[data-work-open]')?.addEventListener('click',()=>void open(root));
  root.querySelectorAll('[data-work-download]').forEach(el=>el.addEventListener('click',downloadPackage));
  root.querySelector('[data-work-file]')?.addEventListener('click',()=>root.querySelector('#work-import')?.click());
  root.querySelector('[data-work-confirm]')?.addEventListener('click',()=>{if(!pending)return;status=c().confirmed+(acceptSaved(pending)?'':' '+c().changed);pending=null;rerender();});
  root.querySelectorAll('[data-work-package-open]').forEach(el=>el.onclick=async()=>{
   if(busy)return;const name=el.dataset.workPackageOpen,folder=getFolder(),version=epoch;
   if(!folder||!rows.some(row=>row.name===name))return;busy=true;rerender();
   try{const raw=await folder.openPackage(name);if(version===epoch)adopt(importWorkBackup(raw));}
   catch{if(version===epoch)status=c().invalid;}
   finally{if(version===epoch){busy=false;rerender();}}
  });
  root.querySelector('#work-import')?.addEventListener('change',async ev=>{
   const file=ev.target.files?.[0];ev.target.value='';if(!file||busy)return;
   const version=epoch;busy=true;rerender();
   try{
    if(file.size>MAX_INPUT_BYTES)throw Error('WORK_INPUT_TOO_LARGE');
    const zip=/\.zip$/i.test(file.name);
    if(!zip&&file.size>Math.max(MAX_WORK_BACKUP_BYTES,MAX_DOCUMENT_BYTES))throw Error('WORK_INPUT_TOO_LARGE');
    const data=zip?importWorkBackup(readWorkZip(await file.arrayBuffer())):parseText(await file.text());
    if(version===epoch)adopt(data);
   }catch{if(version===epoch)status=c().invalid;}
   finally{if(version===epoch){busy=false;rerender();}}
  });
 }
 function reset(){epoch++;busy=false;status='';rows=[];listed=false;pending=null;portable=false;}
 return Object.freeze({render,bind,save,reset});
}
