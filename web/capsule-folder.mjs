// Account-scoped, explicitly selected backup folder. No automatic filesystem access.
import {MAX_REGISTER_BYTES,MAX_COPIES} from './capsule-model.mjs';
import {workPackageEntries,WORK_BACKUP_NAME,WORK_READABLE_NAME,WORK_INDEX_NAME,MAX_WORK_BACKUP_BYTES,MAX_WORK_INDEX_BYTES} from './work-package.mjs';

export const CAPSULE_FOLDER_NAME='AETERNA Digital Legacy';
export const CAPSULE_FOLDER_DB='aeterna.capsule.folder.v1';
export const CAPSULE_FOLDER_LIMIT=200;
export const MAX_CAPSULE_FOLDER_BYTES=2*MAX_REGISTER_BYTES*(MAX_COPIES+1)+4096;
export const WORK_FOLDER_MANIFEST='manifest.json';
export const WORK_FOLDER_SCHEMA='aeterna.work-folder.v1';
const WORK_GUIDE='LEGGIMI.txt',CARD_FILENAME=/^Capsula-[a-f0-9]{12}\.html$/;
const MAX_MANIFEST_BYTES=16384,MAX_CARD_BYTES=262144,MAX_CARDS_BYTES=2*1024*1024,MAX_GUIDE_BYTES=16384;
const requiredWorkFiles=[WORK_BACKUP_NAME,WORK_READABLE_NAME,WORK_GUIDE];
const encoder=new TextEncoder(),utf8=value=>encoder.encode(value).length;
const typed=code=>{const error=Error(code);error.code=code;return error;};
const fail=code=>{throw typed(code);};
const ownError=error=>/^CAPSULE_FOLDER_/.test(error?.code||'');
function mapped(error,fallback='CAPSULE_FOLDER_UNAVAILABLE'){
 if(ownError(error))return error;
 if(error?.name==='AbortError')return typed('CAPSULE_FOLDER_CANCELLED');
 if(['NotAllowedError','SecurityError'].includes(error?.name))return typed('CAPSULE_FOLDER_PERMISSION');
 return typed(fallback);
}
const directory=value=>Boolean(value&&value.kind==='directory'&&typeof value.name==='string'&&typeof value.getDirectoryHandle==='function'&&typeof value.getFileHandle==='function');
const ours=value=>directory(value)&&value.name===CAPSULE_FOLDER_NAME;
const exact=(value,keys)=>Boolean(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)));
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fileLimit=name=>name===WORK_BACKUP_NAME?MAX_WORK_BACKUP_BYTES:name===WORK_READABLE_NAME?MAX_WORK_BACKUP_BYTES+262144:name===WORK_INDEX_NAME?MAX_WORK_INDEX_BYTES:name===WORK_GUIDE?MAX_GUIDE_BYTES:CARD_FILENAME.test(name)?MAX_CARD_BYTES:0;
const packageSort=(a,b)=>b.lastModified-a.lastModified||b.name.localeCompare(a.name);

function validateManifest(text,createdAt){
 let value;try{value=JSON.parse(text);}catch{fail('CAPSULE_FOLDER_INVALID');}
 if(!exact(value,['schema','createdAt','files'])||value.schema!==WORK_FOLDER_SCHEMA||value.createdAt!==createdAt||!Array.isArray(value.files)||value.files.length<requiredWorkFiles.length||value.files.length>MAX_COPIES+requiredWorkFiles.length+1)fail('CAPSULE_FOLDER_INVALID');
 const seen=new Set();let cardsBytes=0;
 for(const row of value.files){
  if(!exact(row,['name','size','sha256'])||typeof row.name!=='string'||seen.has(row.name)||!Number.isSafeInteger(row.size)||row.size<1||row.size>fileLimit(row.name)||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256))fail('CAPSULE_FOLDER_INVALID');
  seen.add(row.name);if(CARD_FILENAME.test(row.name))cardsBytes+=row.size;
 }
 if(cardsBytes>MAX_CARDS_BYTES||!requiredWorkFiles.every(name=>seen.has(name)))fail('CAPSULE_FOLDER_INVALID');
 return value;
}


function indexedRegistry(indexedDB){
 async function run(mode,operation){
  if(!indexedDB||typeof indexedDB.open!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
  const db=await new Promise((resolve,reject)=>{
   let request;try{request=indexedDB.open(CAPSULE_FOLDER_DB,1);}catch(error){reject(error);return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('handles'))request.result.createObjectStore('handles');};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||typed('CAPSULE_FOLDER_UNAVAILABLE'));
   request.onblocked=()=>reject(typed('CAPSULE_FOLDER_UNAVAILABLE'));
  });
  try{return await new Promise((resolve,reject)=>{
   let result,tx;try{
    tx=db.transaction('handles',mode);const request=operation(tx.objectStore('handles'));
    request.onsuccess=()=>{result=request.result;};
    request.onerror=()=>reject(request.error||typed('CAPSULE_FOLDER_UNAVAILABLE'));
   }catch(error){reject(error);return;}
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||typed('CAPSULE_FOLDER_UNAVAILABLE'));
   tx.onabort=()=>reject(tx.error||typed('CAPSULE_FOLDER_UNAVAILABLE'));
  });}finally{db.close();}
 }
 return {get:scope=>run('readonly',store=>store.get(scope)),set:(scope,handle)=>run('readwrite',store=>store.put(handle,scope))};
}

export function createCapsuleFolder({browser=globalThis,scope,now=()=>new Date().toISOString(),registry=null}={}){
 if(scope!=='demo'&&!(typeof scope==='string'&&/^[a-f0-9]{64}$/.test(scope)))return null;
 try{
  if(browser.isSecureContext===false||!['http:','https:'].includes(browser.location?.protocol))return null;
  if(browser.location.protocol==='http:'&&!['localhost','127.0.0.1','[::1]','::1'].includes(browser.location.hostname))return null;
  if(typeof browser.showDirectoryPicker!=='function'||typeof browser.showOpenFilePicker!=='function'||typeof browser.crypto?.randomUUID!=='function')return null;
 }catch{return null;}
 let database;try{database=browser.indexedDB;}catch{}
 const records=registry||indexedRegistry(database);
 const prefix='AETERNA-registro-'+scope+'-';
 const filenamePattern=new RegExp('^'+prefix+'[0-9]{8}T[0-9]{9}Z-[a-f0-9]{32}(?:-parte[0-9]{2}-di-[0-9]{2})?\\.json$');
 const packagePattern=new RegExp('^Salvataggio ([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2})-([0-9]{2})-([0-9]{2})-([0-9]{3})-[a-f0-9]{32}-'+scope+'$');
 function packageDate(name){
  if(typeof name!=='string')return null;
  const match=packagePattern.exec(name);if(!match)return null;
  const value=`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  return iso(value)?value:null;
 }
 let folder=null,remembered=false,readyJob=null,generation=0;
 const state=()=>({connected:Boolean(folder),name:CAPSULE_FOLDER_NAME,remembered});
 async function ready(){
  if(!readyJob){const version=generation;readyJob=Promise.resolve().then(()=>records.get(scope)).then(handle=>{
   if(version===generation&&!folder&&ours(handle)){folder=handle;remembered=true;}
  }).catch(()=>{});}
  await readyJob;return state();
 }
 async function permission(handle,mode){
  if(typeof handle?.queryPermission!=='function'||typeof handle?.requestPermission!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
  const options={mode};
  let granted=await handle.queryPermission(options);
  if(granted!=='granted')granted=await handle.requestPermission(options);
  if(granted!=='granted')fail('CAPSULE_FOLDER_PERMISSION');
 }
 async function connect({create=true}={}){
  const version=++generation,mode=create?'readwrite':'read';
  let chosen;
  try{
   // Must be called from the click before any asynchronous registry lookup.
   const pick=browser.showDirectoryPicker({id:'aeterna-backups',startIn:'desktop',mode});
   chosen=await pick;
   if(version!==generation)fail('CAPSULE_FOLDER_CANCELLED');
   if(!directory(chosen))fail('CAPSULE_FOLDER_INVALID');
   await permission(chosen,mode);
   let next=chosen;
   if(chosen.name!==CAPSULE_FOLDER_NAME){
    try{next=await chosen.getDirectoryHandle(CAPSULE_FOLDER_NAME,{create});}
    catch(error){if(!create&&error?.name==='NotFoundError')fail('CAPSULE_FOLDER_NOT_CONNECTED');throw error;}
   }
   if(!ours(next))fail('CAPSULE_FOLDER_INVALID');
   if(version!==generation)fail('CAPSULE_FOLDER_CANCELLED');
   folder=next;remembered=false;
   try{await records.set(scope,next);if(version===generation)remembered=true;}catch{}
   return state();
  }catch(error){throw mapped(error);}
 }
 async function linked(mode){
  await ready();if(!folder)fail('CAPSULE_FOLDER_NOT_CONNECTED');
  await permission(folder,mode);return folder;
 }
 const managed=name=>typeof name==='string'&&filenamePattern.test(name);
 async function fileMeta(handle){const file=await handle.getFile();return {name:handle.name,lastModified:Number.isFinite(file.lastModified)?file.lastModified:0,size:file.size};}
 async function unused(dir,name){
  try{await dir.getFileHandle(name);return false;}catch(error){if(error?.name==='NotFoundError')return true;if(error?.name==='TypeMismatchError')return false;throw error;}
 }
 function stamp(){
  const value=now();if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('CAPSULE_FOLDER_INVALID');
  return value.replace(/[-:.]/g,'');
 }
 async function save(text){
  if(typeof text!=='string'||!text.length)fail('CAPSULE_FOLDER_INVALID');
  if(utf8(text)>MAX_CAPSULE_FOLDER_BYTES)fail('CAPSULE_FOLDER_TOO_LARGE');
  const timestamp=stamp();
  const operation=async()=>{
   const dir=await linked('readwrite');let name=null;
   for(let attempt=0;attempt<12;attempt++){
    const nonce=browser.crypto.randomUUID().replaceAll('-','').toLowerCase();
    if(!/^[a-f0-9]{32}$/.test(nonce))fail('CAPSULE_FOLDER_INVALID');
    const candidate=prefix+timestamp+'-'+nonce+'.json';
    if(await unused(dir,candidate)){name=candidate;break;}
   }
   if(!name)fail('CAPSULE_FOLDER_WRITE_FAILED');
   const handle=await dir.getFileHandle(name,{create:true});let writer;
   try{
    writer=await handle.createWritable({keepExistingData:false,mode:'exclusive'});
    await writer.write(text);await writer.close();writer=null;
    const file=await handle.getFile();
    if(file.size!==utf8(text)||await file.text()!==text)fail('CAPSULE_FOLDER_WRITE_FAILED');
    return {name,lastModified:Number.isFinite(file.lastModified)?file.lastModified:0,size:file.size};
   }catch(error){try{await writer?.abort?.();}catch{}throw mapped(error,'CAPSULE_FOLDER_WRITE_FAILED');}
  };
  try{
   const locks=browser.navigator?.locks;
   return locks&&typeof locks.request==='function'?await locks.request('aeterna.capsule.folder.v1:'+scope,{mode:'exclusive'},operation):await operation();
  }catch(error){throw mapped(error,'CAPSULE_FOLDER_WRITE_FAILED');}
 }
 async function list(){
  try{
   const dir=await linked('read');if(typeof dir.values!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
   const rows=[];let inspected=0;
   for await(const handle of dir.values()){
    if(++inspected>10000)fail('CAPSULE_FOLDER_TOO_MANY_FILES');
    if(handle?.kind!=='file'||!managed(handle.name))continue;
    const row=await fileMeta(handle);if(row.size<1||row.size>MAX_CAPSULE_FOLDER_BYTES)continue;
    rows.push(row);
    // Preserve every file on disk; retain only the newest bounded UI window.
    if(rows.length>CAPSULE_FOLDER_LIMIT){rows.sort((a,b)=>b.lastModified-a.lastModified||b.name.localeCompare(a.name));rows.length=CAPSULE_FOLDER_LIMIT;}
   }
   return rows.sort((a,b)=>b.lastModified-a.lastModified||b.name.localeCompare(a.name));
  }catch(error){throw mapped(error);}
 }
 async function textFrom(handle,limit=MAX_CAPSULE_FOLDER_BYTES){
  if(handle?.kind!=='file'||typeof handle.getFile!=='function')fail('CAPSULE_FOLDER_INVALID');
  const file=await handle.getFile();if(!Number.isFinite(file.size)||file.size<1||file.size>limit)fail('CAPSULE_FOLDER_TOO_LARGE');
  const text=await file.text();if(typeof text!=='string'||utf8(text)>limit)fail('CAPSULE_FOLDER_TOO_LARGE');
  return text;
 }
 async function read(name){
  if(!managed(name))fail('CAPSULE_FOLDER_INVALID');
  try{const dir=await linked('read');return await textFrom(await dir.getFileHandle(name));}
  catch(error){throw mapped(error);}
 }
 async function pick({work=false}={}){
  try{
   // ready() is intentionally not awaited: transient user activation is needed.
   const picked=await browser.showOpenFilePicker({id:'aeterna-backups',startIn:folder||'desktop',multiple:false,excludeAcceptAllOption:true,types:[{description:'AETERNA backup JSON',accept:{'application/json':['.json']}}]});
   if(!Array.isArray(picked)||picked.length!==1)fail('CAPSULE_FOLDER_INVALID');
   return {name:picked[0].name,text:await textFrom(picked[0],work?MAX_WORK_BACKUP_BYTES:MAX_CAPSULE_FOLDER_BYTES)};
  }catch(error){throw mapped(error);}
 }
 // Complete work snapshots are independent of the older flat Capsule JSON files.
 async function packageHash(text){
  if(typeof browser.crypto?.subtle?.digest!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
  const bytes=await browser.crypto.subtle.digest('SHA-256',encoder.encode(text));
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
 }
 async function unusedPackage(dir,name){
  try{await dir.getDirectoryHandle(name);return false;}catch(error){if(error?.name==='NotFoundError')return true;if(error?.name==='TypeMismatchError')return false;throw error;}
 }
 async function packageText(file,limit){
  if(!Number.isSafeInteger(file.size)||file.size<1||file.size>limit)fail('CAPSULE_FOLDER_INVALID');
  const text=await file.text();
  if(typeof text!=='string'||utf8(text)!==file.size)fail('CAPSULE_FOLDER_INVALID');
  return text;
 }
 async function packageFile(dir,name){
  try{return await (await dir.getFileHandle(name)).getFile();}
  catch(error){if(['NotFoundError','TypeMismatchError'].includes(error?.name))fail('CAPSULE_FOLDER_INVALID');throw error;}
 }
 async function writeChecked(handle,text){
  let writer;
  try{
   writer=await handle.createWritable({keepExistingData:false,mode:'exclusive'});
   await writer.write(text);await writer.close();writer=null;
   const result=await handle.getFile();
   if(result.size!==utf8(text)||await result.text()!==text)fail('CAPSULE_FOLDER_WRITE_FAILED');
  }catch(error){try{await writer?.abort?.();}catch{}throw mapped(error,'CAPSULE_FOLDER_WRITE_FAILED');}
 }
 async function writePackageFile(dir,name,text){
  // Probe again inside the fresh directory. Never intentionally overwrite any file.
  if(!await unused(dir,name))fail('CAPSULE_FOLDER_WRITE_FAILED');
  await writeChecked(await dir.getFileHandle(name,{create:true}),text);
 }
 function shortcutText(name){
  return `<!doctype html><html lang="it"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>AETERNA Digital Legacy</title><!-- aeterna.work-shortcut.v1 ${name} --><h1>AETERNA Digital Legacy</h1><p><a href="./${encodeURIComponent(name)}/${encodeURIComponent(WORK_INDEX_NAME)}">Apri l’ultimo lavoro salvato</a></p><p>Per aprire una copia precedente, scegli una cartella Salvataggio.</p></html>`;
 }
 async function updateShortcut(dir,name){
  // This name is shared by account scopes. Do not write without a common lock.
  const locks=browser.navigator?.locks;if(typeof locks?.request!=='function')return false;
  try{return await locks.request('aeterna.work-folder.shortcut.v1',{mode:'exclusive'},async()=>{
   if(await unused(dir,WORK_INDEX_NAME)){await writePackageFile(dir,WORK_INDEX_NAME,shortcutText(name));return true;}
   const old=await packageText(await packageFile(dir,WORK_INDEX_NAME),MAX_WORK_INDEX_BYTES);
   const previous=/<!-- aeterna\.work-shortcut\.v1 ([A-Za-z0-9 ._-]+) -->/.exec(old)?.[1];
   // Compare the whole generated document and its scope. A user file or a
   // shortcut owned by another account is never replaced.
   if(!packageDate(previous)||old!==shortcutText(previous))return false;
   await writeChecked(await dir.getFileHandle(WORK_INDEX_NAME),shortcutText(name));return true;
  });}catch{return false;}
 }
 function packageMetadata(name,manifest){return {name,lastModified:Date.parse(manifest.createdAt),size:manifest.files.reduce((sum,file)=>sum+file.size,0),files:manifest.files};}
 async function readManifest(dir,name){
  const createdAt=packageDate(name);if(!createdAt)fail('CAPSULE_FOLDER_INVALID');
  return validateManifest(await packageText(await packageFile(dir,WORK_FOLDER_MANIFEST),MAX_MANIFEST_BYTES),createdAt);
 }
 async function saveWorkPackage(value){
  let entries;
  try{entries=workPackageEntries(value);}catch(error){fail(/TOO_LARGE/.test(String(error?.code||error?.message||''))?'CAPSULE_FOLDER_TOO_LARGE':'CAPSULE_FOLDER_INVALID');}
  const createdAt=now();if(!iso(createdAt))fail('CAPSULE_FOLDER_INVALID');
  if(typeof browser.crypto?.subtle?.digest!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
  try{
   // A remembered folder may need renewed permission. Ask from this action
   // before computing digests, which can consume its transient activation.
   const dir=await linked('readwrite');
   const files=[];
   for(const {name,text} of entries)files.push({name,size:utf8(text),sha256:await packageHash(text)});
   const manifest={schema:WORK_FOLDER_SCHEMA,createdAt,files},manifestText=JSON.stringify(manifest,null,2);
   validateManifest(manifestText,createdAt);
   if(utf8(manifestText)>MAX_MANIFEST_BYTES)fail('CAPSULE_FOLDER_TOO_LARGE');
   const operation=async()=>{
   let name=null;
   for(let attempt=0;attempt<12;attempt++){
    const nonce=browser.crypto.randomUUID().replaceAll('-','').toLowerCase();
    if(!/^[a-f0-9]{32}$/.test(nonce))fail('CAPSULE_FOLDER_INVALID');
    const candidate=`Salvataggio ${createdAt.slice(0,10)} ${createdAt.slice(11,23).replace(/[:.]/g,'-')}-${nonce}-${scope}`;
    if(await unusedPackage(dir,candidate)){name=candidate;break;}
   }
   if(!name)fail('CAPSULE_FOLDER_WRITE_FAILED');
   const target=await dir.getDirectoryHandle(name,{create:true});
   for(const {name:fileName,text} of entries)await writePackageFile(target,fileName,text);
   // Commit marker: incomplete directories never enter the list.
   await writePackageFile(target,WORK_FOLDER_MANIFEST,manifestText);
   const shortcut=files.some(row=>row.name===WORK_INDEX_NAME)&&await updateShortcut(dir,name);
   return {...packageMetadata(name,manifest),shortcut};
   };
   const locks=browser.navigator?.locks;
   return locks&&typeof locks.request==='function'?await locks.request('aeterna.capsule.folder.v1:'+scope,{mode:'exclusive'},operation):await operation();
  }catch(error){throw mapped(error,'CAPSULE_FOLDER_WRITE_FAILED');}
 }
 async function listPackages(){
  try{
   const dir=await linked('read');if(typeof dir.values!=='function')fail('CAPSULE_FOLDER_UNAVAILABLE');
   const candidates=[];let inspected=0;
   for await(const handle of dir.values()){
    if(++inspected>10000)fail('CAPSULE_FOLDER_TOO_MANY_FILES');
    const createdAt=handle?.kind==='directory'?packageDate(handle.name):null;
    if(createdAt)candidates.push({name:handle.name,lastModified:Date.parse(createdAt),handle});
   }
   candidates.sort(packageSort);const rows=[];
   for(const candidate of candidates){
    try{
     const manifest=await readManifest(candidate.handle,candidate.name);
     // Check presence and size cheaply. The selected snapshot is hashed on open.
     for(const row of manifest.files){const file=await packageFile(candidate.handle,row.name);if(file.size!==row.size)fail('CAPSULE_FOLDER_INVALID');}
     rows.push(packageMetadata(candidate.name,manifest));if(rows.length===CAPSULE_FOLDER_LIMIT)break;
    }catch(error){if(error?.code!=='CAPSULE_FOLDER_INVALID')throw error;}
   }
   return rows;
  }catch(error){throw mapped(error);}
 }
 async function openPackage(name){
  if(!packageDate(name))fail('CAPSULE_FOLDER_INVALID');
  try{
   const dir=await linked('read');let target;
   try{target=await dir.getDirectoryHandle(name);}
   catch(error){if(['NotFoundError','TypeMismatchError'].includes(error?.name))fail('CAPSULE_FOLDER_INVALID');throw error;}
   const manifest=await readManifest(target,name);let backupText=null;
   for(const row of manifest.files){
    const file=await packageFile(target,row.name);if(file.size!==row.size)fail('CAPSULE_FOLDER_INVALID');
    const text=await packageText(file,fileLimit(row.name));
    if(await packageHash(text)!==row.sha256)fail('CAPSULE_FOLDER_INVALID');
    if(row.name===WORK_BACKUP_NAME)backupText=text;
   }
   if(backupText===null)fail('CAPSULE_FOLDER_INVALID');
   return backupText;
  }catch(error){throw mapped(error);}
 }
 return Object.freeze({ready,connect,save,list,read,pick,getState:state,saveWorkPackage,listPackages,openPackage});
}
