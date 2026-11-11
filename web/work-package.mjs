// One private snapshot for Passport and Capsule. The portable ZIP is stored,
// not compressed: no external dependency, network, filesystem or browser API.
import {exportPassport,MAX_BYTES as MAX_PASSPORT_EXPORT_BYTES} from './extra-model.mjs';
import {importDocument,MAX_DOCUMENT_BYTES} from './document-format.mjs';
import {BACKUP_SCHEMA,MAX_BACKUP_BYTES,exportCapsuleBackup,importCapsuleBackup} from './capsule-backup.mjs';
import {MAX_COPIES} from './capsule-model.mjs';

export const WORK_BACKUP_SCHEMA='aeterna.work-backup.v1';
export const WORK_FOLDER_NAME='AETERNA Digital Legacy';
export const WORK_BACKUP_NAME='Riprendi il mio lavoro.json';
export const WORK_READABLE_NAME='Apri il mio lavoro.html';
export const WORK_INDEX_NAME='APRI QUI.html';
export const MAX_WORK_BACKUP_BYTES=MAX_BACKUP_BYTES+MAX_PASSPORT_EXPORT_BYTES+1024;
export const MAX_WORK_HTML_BYTES=MAX_WORK_BACKUP_BYTES+MAX_DOCUMENT_BYTES;
export const MAX_WORK_INDEX_BYTES=65536;
export const MAX_WORK_CARD_BYTES=262144;
export const MAX_WORK_CARDS_BYTES=2*1024*1024;
export const MAX_WORK_GUIDE_BYTES=16384;
export const MAX_WORK_ZIP_BYTES=MAX_WORK_BACKUP_BYTES+MAX_WORK_HTML_BYTES+MAX_WORK_INDEX_BYTES+MAX_WORK_CARDS_BYTES+MAX_WORK_GUIDE_BYTES+16384;
const GUIDE='AETERNA Digital Legacy\n\nApri il mio lavoro.html: Passaporto da leggere o stampare.\nRiprendi il mio lavoro.json: riapre Passaporto e Capsula nell’area clienti.\nGli eventuali file Capsula sono le schede stampabili.\n\nLa copia completa non è cifrata: custodiscila in un posto privato.\n';
const encoder=new TextEncoder();
const fail=(code='INVALID_WORK_BACKUP')=>{const error=Error(code);error.code=code;throw error;};

function exact(value,keys,code){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail(code);
 const own=Reflect.ownKeys(value);
 if(own.length!==keys.length||own.some(key=>!keys.includes(key))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail(code);
}
function bounded(value,max,invalid='INVALID_WORK_BACKUP',oversized='WORK_BACKUP_TOO_LARGE'){
 if(typeof value!=='string'||!value.length)fail(invalid);
 if(value.length>max)fail(oversized);
 const bytes=encoder.encode(value).length;if(bytes>max)fail(oversized);return bytes;
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)<0)fail();
 return value;
}
function checkCopyDates(copies,at){
 if(copies.some(copy=>copy.createdAt>at||copy.events.some(event=>event.at>at)))fail();
}
function rethrow(error){if(/TOO_LARGE/.test(error?.code||error?.message||''))fail('WORK_BACKUP_TOO_LARGE');fail();}

export function exportWorkBackup(value,{at=new Date().toISOString()}={}){
 exact(value,['passport','capsule']);timestamp(at);if(Date.parse(at)>Date.now())fail();
 let passport,capsule;
 try{
  const exported=exportPassport(value.passport,at);bounded(exported,MAX_PASSPORT_EXPORT_BYTES);passport=JSON.parse(exported);
  capsule=JSON.parse(exportCapsuleBackup(value.capsule));
 }catch(error){rethrow(error);}
 // Read back the canonical snapshot's validated timestamps; never inspect a
 // caller-owned mutable array again after serialising it.
 checkCopyDates(capsule.parts.flatMap(part=>JSON.parse(part).copies),at);
 const text=JSON.stringify({schema:WORK_BACKUP_SCHEMA,createdAt:at,passport,capsule});
 bounded(text,MAX_WORK_BACKUP_BYTES);return text;
}

export function importWorkBackup(text,{now=new Date().toISOString()}={}){
 bounded(text,MAX_WORK_BACKUP_BYTES);timestamp(now);
 let value;try{value=JSON.parse(text);}catch{fail();}
 exact(value,['schema','createdAt','passport','capsule']);
 if(value.schema!==WORK_BACKUP_SCHEMA)fail();
 const createdAt=timestamp(value.createdAt);if(createdAt>now)fail();
 if(!['aeterna.passport-export.v3','aeterna.passport-export.v4'].includes(value.passport?.schema)||value.passport.exportedAt!==createdAt||value.capsule?.schema!==BACKUP_SCHEMA)fail();
 let passport,capsule;
 try{
  // Reuse the existing importer so v4 continuity declarations are reviewed,
  // just like a Passport opened by itself. Capsule uses the same rule.
  passport=importDocument(JSON.stringify(value.passport),now);
  capsule=importCapsuleBackup(JSON.stringify(value.capsule));
 }catch(error){rethrow(error);}
 checkCopyDates(capsule.copies,createdAt);
 return {passport,capsule,createdAt};
}

export function workPackageEntries({backupText,passportHtml,capsuleHtmls=[],guide=GUIDE,indexHtml}={}){
 const {capsule}=importWorkBackup(backupText),invalid='INVALID_WORK_PACKAGE',oversized='WORK_PACKAGE_TOO_LARGE';
 bounded(passportHtml,MAX_WORK_HTML_BYTES,invalid,oversized);
 bounded(guide,MAX_WORK_GUIDE_BYTES,invalid,oversized);
 if(!Array.isArray(capsuleHtmls)||Object.getPrototypeOf(capsuleHtmls)!==Array.prototype||capsuleHtmls.length>MAX_COPIES||Reflect.ownKeys(capsuleHtmls).length!==capsuleHtmls.length+1||Object.values(Object.getOwnPropertyDescriptors(capsuleHtmls)).some(d=>!Object.hasOwn(d,'value')))fail(invalid);
 const known=new Set(capsule.copies.map(copy=>copy.id)),seen=new Set();
 const entries=[];
 if(indexHtml!==undefined){bounded(indexHtml,MAX_WORK_INDEX_BYTES,invalid,oversized);entries.push({name:WORK_INDEX_NAME,text:indexHtml});}
 entries.push({name:WORK_BACKUP_NAME,text:backupText},{name:WORK_READABLE_NAME,text:passportHtml},{name:'LEGGIMI.txt',text:guide});
 let cardBytes=0;
 for(const row of capsuleHtmls){
  exact(row,['name','html'],invalid);
  const id=typeof row.name==='string'?/^Capsula-([a-f0-9]{12})\.html$/.exec(row.name)?.[1]:null;
  if(!id||!known.has(id)||seen.has(id))fail(invalid);
  cardBytes+=bounded(row.html,MAX_WORK_CARD_BYTES,invalid,oversized);if(cardBytes>MAX_WORK_CARDS_BYTES)fail(oversized);
  seen.add(id);entries.push({name:row.name,text:row.html});
 }
 return entries;
}

const CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{
 let value=n;for(let i=0;i<8;i++)value=(value&1)?(0xedb88320^(value>>>1)):(value>>>1);return value>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function dosTimestamp(at){
 const date=new Date(at),year=Math.max(1980,Math.min(date.getUTCFullYear(),2107));
 return {date:((year-1980)<<9)|((date.getUTCMonth()+1)<<5)|date.getUTCDate(),time:(date.getUTCHours()<<11)|(date.getUTCMinutes()<<5)|(date.getUTCSeconds()>>1)};
}

export function buildWorkZip(value){
 const entries=workPackageEntries(value),stamp=dosTimestamp(JSON.parse(value.backupText).createdAt);
 const root=WORK_FOLDER_NAME+'/';
 const records=[{name:root,text:'',directory:true},...entries.map(({name,text})=>({name:root+name,text,directory:false}))].map(record=>{
  const name=encoder.encode(record.name),data=encoder.encode(record.text);return {name,data,directory:record.directory,crc:crc32(data),offset:0};
 });
 const localSize=records.reduce((sum,row)=>sum+30+row.name.length+row.data.length,0);
 const centralSize=records.reduce((sum,row)=>sum+46+row.name.length,0);
 const archive=new Uint8Array(localSize+centralSize+22),view=new DataView(archive.buffer);
 const word=(offset,value)=>view.setUint16(offset,value,true),dword=(offset,value)=>view.setUint32(offset,value,true);
 const utf8Flag=0x0800;let cursor=0;
 for(const row of records){
  row.offset=cursor;dword(cursor,0x04034b50);word(cursor+4,20);word(cursor+6,utf8Flag);
  word(cursor+10,stamp.time);word(cursor+12,stamp.date);dword(cursor+14,row.crc);dword(cursor+18,row.data.length);dword(cursor+22,row.data.length);word(cursor+26,row.name.length);
  archive.set(row.name,cursor+30);archive.set(row.data,cursor+30+row.name.length);cursor+=30+row.name.length+row.data.length;
 }
 for(const row of records){
  dword(cursor,0x02014b50);word(cursor+4,20);word(cursor+6,20);word(cursor+8,utf8Flag);
  word(cursor+12,stamp.time);word(cursor+14,stamp.date);dword(cursor+16,row.crc);dword(cursor+20,row.data.length);dword(cursor+24,row.data.length);word(cursor+28,row.name.length);
  dword(cursor+38,row.directory?0x10:0x20);dword(cursor+42,row.offset);archive.set(row.name,cursor+46);cursor+=46+row.name.length;
 }
 dword(cursor,0x06054b50);word(cursor+8,records.length);word(cursor+10,records.length);dword(cursor+12,centralSize);dword(cursor+16,localSize);
 return archive;
}

// Read only the bounded, uncompressed package produced above. All entries,
// including the files not opened by the app, are checked without executing or
// extracting anything. Ordinary third-party ZIPs are outside this contract;
// the JSON inside an extracted copy remains independently importable.
export function readWorkZip(input){
 const invalid=()=>fail('INVALID_WORK_ZIP');
 if(!(input instanceof Uint8Array)&&!(input instanceof ArrayBuffer))invalid();
 if(input.byteLength>MAX_WORK_ZIP_BYTES)fail('WORK_ZIP_TOO_LARGE');
 if(input.byteLength<22)invalid();
 const bytes=input instanceof Uint8Array?new Uint8Array(input):new Uint8Array(input).slice();
 const view=new DataView(bytes.buffer),decoder=new TextDecoder('utf-8',{fatal:true});
 const word=offset=>view.getUint16(offset,true),dword=offset=>view.getUint32(offset,true);
 const text=(start,end)=>{try{return decoder.decode(bytes.subarray(start,end));}catch{invalid();}};
 const end=bytes.length-22,root=WORK_FOLDER_NAME+'/';
 if(dword(end)!==0x06054b50||word(end+4)||word(end+6)||word(end+20))invalid();
 const count=word(end+10),centralSize=dword(end+12),centralStart=dword(end+16);
 if(count!==word(end+8)||count<4||count>MAX_COPIES+5||centralStart+centralSize!==end)invalid();
 const limits=new Map([[WORK_BACKUP_NAME,MAX_WORK_BACKUP_BYTES],[WORK_READABLE_NAME,MAX_WORK_HTML_BYTES],[WORK_INDEX_NAME,MAX_WORK_INDEX_BYTES],['LEGGIMI.txt',MAX_WORK_GUIDE_BYTES]]);
 const names=new Set(),cardIds=[];let local=0,central=centralStart,cardBytes=0,backupText='';
 for(let i=0;i<count;i++){
  if(central+46>end||dword(central)!==0x02014b50||word(central+4)!==20||word(central+6)!==20||word(central+8)!==0x0800||word(central+10)||word(central+30)||word(central+32)||word(central+34)||word(central+36))invalid();
  const size=dword(central+24),nameSize=word(central+28),nextCentral=central+46+nameSize,crc=dword(central+16);
  if(nameSize<1||nameSize>160||nextCentral>end||dword(central+20)!==size||dword(central+42)!==local)invalid();
  const name=text(central+46,nextCentral),directory=i===0;
  if(names.has(name))invalid();names.add(name);
  if(directory){if(name!==root||size!==0||dword(central+38)!==0x10)invalid();}
  else{
   if(!name.startsWith(root)||!size||dword(central+38)!==0x20)invalid();
   const leaf=name.slice(root.length),id=/^Capsula-([a-f0-9]{12})\.html$/.exec(leaf)?.[1];
   if(id){cardIds.push(id);cardBytes+=size;if(cardBytes>MAX_WORK_CARDS_BYTES||size>MAX_WORK_CARD_BYTES)invalid();}
   else if(!limits.has(leaf)||size>limits.get(leaf)||(leaf===WORK_INDEX_NAME&&i!==1))invalid();
  }
  if(local+30>centralStart||dword(local)!==0x04034b50||word(local+4)!==20||word(local+6)!==0x0800||word(local+8)||word(local+10)!==word(central+12)||word(local+12)!==word(central+14)||dword(local+14)!==crc||dword(local+18)!==size||dword(local+22)!==size||word(local+26)!==nameSize||word(local+28))invalid();
  const dataStart=local+30+nameSize,nextLocal=dataStart+size;
  if(nextLocal>centralStart||text(local+30,dataStart)!==name||crc32(bytes.subarray(dataStart,nextLocal))!==crc)invalid();
  if(!directory){const decoded=text(dataStart,nextLocal);if(name===root+WORK_BACKUP_NAME)backupText=decoded;}
  local=nextLocal;central=nextCentral;
 }
 if(local!==centralStart||central!==end||!backupText||!names.has(root+WORK_READABLE_NAME)||!names.has(root+'LEGGIMI.txt'))invalid();
 const {capsule}=importWorkBackup(backupText),known=new Set(capsule.copies.map(copy=>copy.id));
 if(cardIds.some(id=>!known.has(id)))invalid();
 return backupText;
}
