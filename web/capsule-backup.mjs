// A single explicit backup file around the unchanged bounded v1 registers.
// No network, browser storage, filesystem or automatic persistence.
import {exportCapsuleRegisterParts,importCapsuleRegister,REGISTER_SCHEMA,MAX_REGISTER_BYTES,MAX_COPIES} from './capsule-model.mjs';

export const BACKUP_SCHEMA='aeterna.capsule-backup.v1';
export const MAX_BACKUP_BYTES=2*MAX_REGISTER_BYTES*(MAX_COPIES+1)+4096;
const bytes=value=>new TextEncoder().encode(value).length;
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const invalid=()=>fail('INVALID_CAPSULE_BACKUP');
const tooLarge=()=>fail('CAPSULE_BACKUP_TOO_LARGE');
function exact(value,keys){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)invalid();
 const own=Reflect.ownKeys(value);
 if(own.length!==keys.length||own.some(key=>!keys.includes(key))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))invalid();
}
function partsFor(value){
 try{return exportCapsuleRegisterParts(value);}
 catch(error){if(/TOO_LARGE/.test(error?.message||''))tooLarge();invalid();}
}

export function exportCapsuleBackup(value){
 const parts=partsFor(value),text=JSON.stringify({schema:BACKUP_SCHEMA,parts});
 if(bytes(text)>MAX_BACKUP_BYTES)tooLarge();
 return text;
}

export function importCapsuleBackup(text){
 if(typeof text!=='string')invalid();
 if(bytes(text)>MAX_BACKUP_BYTES)tooLarge();
 let parsed;try{parsed=JSON.parse(text);}catch{invalid();}
 if(parsed?.schema===REGISTER_SCHEMA){
  // Legacy registers retain their original 64 KiB guard and proof invalidation.
  try{return importCapsuleRegister(text);}catch(error){if(/TOO_LARGE/.test(error?.message||''))tooLarge();invalid();}
 }
 exact(parsed,['schema','parts']);
 if(parsed.schema!==BACKUP_SCHEMA||!Array.isArray(parsed.parts)||parsed.parts.length<1||parsed.parts.length>MAX_COPIES+1)invalid();
 const originals=[],restored=[];
 for(const part of parsed.parts){
  if(typeof part!=='string'||bytes(part)>MAX_REGISTER_BYTES)invalid();
  try{restored.push(importCapsuleRegister(part));originals.push(JSON.parse(part));}catch{invalid();}
 }
 // Validate the complete logical register, not only the parts separately. This
 // checks aggregate count/IDs and accepts only the exact lossless partition
 // layout emitted by this version, including the private-draft-only fallback.
 const original={draft:originals[0].draft,copies:originals.flatMap(part=>part.copies)};
 const canonical=partsFor(original);
 if(JSON.stringify(canonical)!==JSON.stringify(parsed.parts))invalid();
 return {draft:restored[0].draft,copies:restored.flatMap(part=>part.copies)};
}
