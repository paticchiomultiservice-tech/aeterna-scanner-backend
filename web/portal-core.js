export const MAX_SCAN_CHARACTERS=20000;
export const LEGACY_SECRET_KEYS=Object.freeze(["civilShieldManualToken","civilShieldManualEmail"]);
export function displayPlan(plan){
  const plans={scanner_10:"Scanner 10",pulse365_light:"Pulse 365™ · Light",pulse365_standard:"Pulse 365™ · Standard",pulse365_advanced:"Pulse 365™ · Advanced",pulse365_elite:"Pulse 365™ · Elite",pulse365_command:"Pulse 365™ · Command"};
  return typeof plan==="string"&&Object.hasOwn(plans,plan)?plans[plan]:null;
}
export function composeScan(fields){
  return [["link",fields.url],["sender",fields.sender],["payment",fields.payment],["message",fields.message]]
    .filter(([,value])=>typeof value==="string"&&value.trim())
    .map(([key,value])=>`[${key}]\n${value.trim()}`).join("\n\n");
}
export function characterCount(value){return Array.from(value).length;}
export function imageDimensions(buffer){
  const bytes=new Uint8Array(buffer);const view=new DataView(buffer);const ascii=(at,length)=>String.fromCharCode(...bytes.subarray(at,at+length));
  if(bytes.length>=24&&bytes[0]===137&&ascii(1,3)==="PNG"&&ascii(12,4)==="IHDR")return {width:view.getUint32(16),height:view.getUint32(20)};
  if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
    let pos=2;const markers=new Set([192,193,194,195,197,198,199,201,202,203,205,206,207]);
    while(pos+3<bytes.length){if(bytes[pos]!==255)return null;while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===217||marker===218)return null;if(marker===1||marker>=208&&marker<=215)continue;if(pos+2>bytes.length)return null;const length=view.getUint16(pos);if(length<2||pos+length>bytes.length)return null;if(markers.has(marker)){if(length<7)return null;return {width:view.getUint16(pos+5),height:view.getUint16(pos+3)};}pos+=length;}
  }
  if(bytes.length>=30&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP"){
    const chunk=ascii(12,4);
    if(chunk==="VP8X")return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    if(chunk==="VP8 "&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
    if(chunk==="VP8L"&&bytes[20]===47)return {width:1+bytes[21]+((bytes[22]&63)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
  }
  return null;
}
export function safeImageDimensions(value){return !!value&&Number.isInteger(value.width)&&Number.isInteger(value.height)&&value.width>0&&value.height>0&&value.width<=8000&&value.height<=8000&&value.width*value.height<=16000000;}
export function validateScan(fields){const text=composeScan(fields);return !text?{valid:false,error:"emptyText",length:0}:characterCount(text)>MAX_SCAN_CHARACTERS?{valid:false,error:"tooLong",length:characterCount(text)}:{valid:true,length:characterCount(text)};}
export function createGeneration(){let value=0;return Object.freeze({next:()=>++value,current:()=>value,isCurrent:(candidate)=>candidate===value});}
export function legacyClean(storage){
  if(!storage)return {ok:false};
  try{
    const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(Boolean);
    for(const key of keys){if(LEGACY_SECRET_KEYS.includes(key)||key.startsWith("civilShieldEmail_"))storage.removeItem(key);}
    const raw=storage.getItem("aeternaPulse365State");
    if(raw){
      // Never delete a whole legacy diary: preserve explicitly voluntary memories.
      if(raw.length>1500000)return {ok:false};
      const state=JSON.parse(raw);
      if(state&&typeof state==="object"&&!Array.isArray(state)){
        delete state.lastResult;
        if(Array.isArray(state.actions))state.actions=state.actions.filter(action=>!["PULSE_SCAN","PULSE_RESULT_SAVE"].includes(action?.type));
        storage.setItem("aeternaPulse365State",JSON.stringify(state));
      }
    }
    return {ok:true};
  }catch{return {ok:false};}
}
export function cleanAddress(locationApi,historyApi){
  try{const url=new URL(locationApi.href);for(const key of [...url.searchParams.keys()])if(/^(token|email|client_?token|access_?token|code|session)$/i.test(key))url.searchParams.delete(key);if(/token|email|access_token|session=/i.test(url.hash))url.hash="";historyApi.replaceState(null,"",url.pathname+url.search+url.hash);return true;}catch{return false;}
}
export function isTerminalClear(response){
  if(response?.ok!==true||response.scope!=="application"||response.platform_logs_deleted!==false)return false;
  if(["cancelled","completed"].includes(response.status))return response.worker_termination_verified===true;
  return response.status==="not_running"&&response.worker_termination_verified===false&&["completed","cancelled","not_found"].includes(response.reservation_status);
}
export function validResult(result){return !!result&&Number.isFinite(result.score)&&result.score>=0&&result.score<=100&&typeof result.band==="string"&&Array.isArray(result.indicators)&&Array.isArray(result.recommendations)&&Array.isArray(result.limitations);}
export function formatExpiry(value,locale){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))return null;
  const date=new Date(value.length===10?`${value}T12:00:00Z`:value);
  if(!Number.isFinite(date.getTime()))return null;
  return new Intl.DateTimeFormat(locale,{day:"2-digit",month:"long",year:"numeric",timeZone:"Europe/Rome"}).format(date);
}
