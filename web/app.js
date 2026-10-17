import {MESSAGES,normaliseLocale,translate} from "./translations.js";
import {composeScan,validateScan,createGeneration,legacyClean,cleanAddress,isTerminalClear,validResult,formatExpiry,MAX_SCAN_CHARACTERS,imageDimensions,safeImageDimensions,displayPlan} from "./portal-core.js";

const $=(id)=>document.getElementById(id);
const generation=createGeneration();
const state={locale:"it",csrf:null,account:null,challenge:null,operation:null,remoteUncertain:false,scanController:null,clearController:null,authController:null,logoutBusy:false,authBusy:false,scanning:false,clearing:false,ocrWorker:null,ocrPending:null,ocrBusy:false,ocrTimer:null,blobUrls:new Set(),statusKeys:new Map()};
const LOCALE_KEY="aeterna.core.locale";
const timeout=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
class ApiError extends Error{constructor(code,status=0){super(code);this.code=code;this.status=status;}}
const t=(key)=>translate(state.locale,key)||"";

// Strip old bearer credentials immediately. They are never used for authentication.
cleanAddress(window.location,window.history);
let legacyCleanOk=true;
for(const name of ["localStorage","sessionStorage"]){try{if(!legacyClean(window[name]).ok)legacyCleanOk=false;}catch{legacyCleanOk=false;}}
try{state.locale=normaliseLocale(localStorage.getItem(LOCALE_KEY)||navigator.language);}catch{state.locale=normaliseLocale(navigator.language);}

function status(id,key,kind=""){const el=$(id);state.statusKeys.set(id,{key,kind});el.textContent=key?t(key):"";el.classList.remove("error","success","warning");if(kind)el.classList.add(kind);}
function errorStatus(id,error){const key=`errors.${error?.code}`;status(id,translate(state.locale,key)?key:"networkError","error");}
function announceError(error){errorStatus("scan-status",error);}
function setAuthBusy(value){state.authBusy=value;$("send-code").disabled=value;$("verify-code").disabled=value;$("change-email").disabled=value;}
function updateControls(){const permitted=!!state.account&&(state.account.unlimited===true||Number(state.account.scans_remaining)>0);$("scan-button").disabled=!permitted||state.scanning||state.clearing||state.logoutBusy||state.ocrBusy||state.remoteUncertain;$("ocr-button").disabled=!state.account||state.scanning||state.clearing||state.ocrBusy||state.logoutBusy;$("scan-image").disabled=state.ocrBusy||state.scanning;$("scan-form").setAttribute("aria-busy",String(state.scanning||state.ocrBusy));$("logout").disabled=state.logoutBusy;$("clear-button").disabled=state.clearing;}
function showLoggedOut(){state.account=null;state.csrf=null;$("protected-area").hidden=true;$("login-panel").hidden=false;$("logout").hidden=true;$("account-plan").textContent="—";$("account-expires").textContent="—";$("account-credits").textContent="—";updateControls();}
function showAuthenticated(payload){if(payload?.authenticated!==true||typeof payload.csrf_token!=="string"||!payload.account)throw new ApiError("INVALID_RESPONSE");state.csrf=payload.csrf_token;state.account=payload.account;state.remoteUncertain=false;state.challenge=null;$("email").value="";$("code").value="";$("code-form").hidden=true;$("email-form").hidden=false;$("login-panel").hidden=true;$("protected-area").hidden=false;$("logout").hidden=false;status("auth-status","");status("global-status","signedIn","success");renderAccount();updateControls();}
function renderAccount(){if(!state.account)return;const account=state.account;$("account-plan").textContent=displayPlan(account.plan)||t("unknown");$("account-expires").textContent=formatExpiry(account.expires_at,state.locale)||t("unknown");$("account-credits").textContent=account.unlimited===true?t("unlimited"):Number.isInteger(account.scans_remaining)&&account.scans_remaining>=0?new Intl.NumberFormat(state.locale).format(account.scans_remaining):t("unknown");updateControls();}
function translatePage(){document.documentElement.lang=state.locale;$("language").value=state.locale;for(const el of document.querySelectorAll("[data-i18n]")){const value=t(el.dataset.i18n);if(value)el.textContent=value;}$("language").setAttribute("aria-label",t("language"));for(const [id,item]of state.statusKeys)status(id,item.key,item.kind);for(const el of document.querySelectorAll("[data-result-key]")){el.textContent=t(el.dataset.resultKey)||t(el.dataset.fallback||"unknownIndicator");}renderAccount();updateCounter();}
async function request(path,{body,signal,csrf=state.csrf,timeoutMs=15000,keepalive=false}={}){
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)controller.abort();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const headers={"Accept":"application/json"};if(body!==undefined){headers["Content-Type"]="application/json";if(csrf)headers["X-CSRF-Token"]=csrf;}
    const response=await fetch(path,{method:body===undefined?"GET":"POST",headers,body:body===undefined?undefined:JSON.stringify(body),credentials:"same-origin",cache:"no-store",referrerPolicy:"no-referrer",redirect:"error",signal:controller.signal,keepalive});
    if(!response.headers.get("content-type")?.includes("application/json"))throw new ApiError("INVALID_RESPONSE",response.status);
    const text=await response.text();if(text.length>131072)throw new ApiError("INVALID_RESPONSE",response.status);let data;try{data=JSON.parse(text);}catch{throw new ApiError("INVALID_RESPONSE",response.status);}
    if(!response.ok||data?.ok!==true)throw new ApiError(typeof data?.error?.code==="string"?data.error.code:"INVALID_RESPONSE",response.status);return data;
  }finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
function readFields(){return {url:$("scan-url").value,sender:$("scan-sender").value,payment:$("scan-payment").value,message:$("scan-message").value};}
function updateCounter(){const count=validateScan(readFields()).length;$("text-counter").textContent=`${new Intl.NumberFormat(state.locale).format(count)} / ${new Intl.NumberFormat(state.locale).format(MAX_SCAN_CHARACTERS)}`;$("text-counter").setAttribute("aria-label",`${t("counterLabel")}: ${count} / ${MAX_SCAN_CHARACTERS}`);$("text-counter").classList.toggle("over",count>MAX_SCAN_CHARACTERS);}
function clearResult(){for(const id of ["result-band","result-score","result-engine","result-indicators","result-recommendations","result-limitations"]){$(id).replaceChildren();delete $(id).dataset.resultKey;delete $(id).dataset.fallback;}$("result-panel").hidden=true;delete $("result-panel").dataset.band;}
function localClear(){generation.next();state.scanController?.abort();state.scanController=null;state.clearController?.abort();state.clearController=null;state.clearing=false;state.scanning=false;state.ocrWorker?.terminate();state.ocrWorker=null;state.ocrPending=null;state.ocrBusy=false;clearTimeout(state.ocrTimer);state.ocrTimer=null;for(const value of state.blobUrls)URL.revokeObjectURL(value);state.blobUrls.clear();$("scan-form").reset();clearResult();status("scan-status","");status("ocr-status","");updateCounter();updateControls();}
async function remoteClear(operation,csrf,ui=true){
  state.remoteUncertain=true;
  const controller=new AbortController();state.clearController?.abort();state.clearController=controller;
    if(ui){state.clearing=true;status("clear-status","clearChecking");updateControls();}
  try{let data;for(let attempt=0;attempt<4;attempt++){data=await request(`/api/scans/${encodeURIComponent(operation)}/clear`,{body:{},csrf,signal:controller.signal,timeoutMs:12000});if(state.clearController!==controller)return false;if(isTerminalClear(data)){if(state.operation===operation)state.operation=null;state.remoteUncertain=false;if(ui){status("clear-status",data.worker_termination_verified===true?"clearConfirmed":"clearNotObserved",data.worker_termination_verified===true?"success":"warning");try{const session=await request("/api/session",{signal:controller.signal,timeoutMs:12000});if(state.account&&session.authenticated===true){state.account=session.account;state.csrf=session.csrf_token;renderAccount();}}catch{/* Cleanup confirmation remains scoped; account refresh is best effort. */}}return true;}if(data.status!=="cancellation_requested")throw new ApiError("INVALID_RESPONSE");if(ui)status("clear-status","clearRequested","warning");if(attempt<3)await timeout(450);}
    return false;
  }catch{if(ui&&state.clearController===controller)status("clear-status","clearUncertain","warning");return false;}
  finally{if(state.clearController===controller){state.clearController=null;state.clearing=false;updateControls();}}
}
async function clearAnalysis(){const operation=state.operation;const csrf=state.csrf;localClear();if(operation&&csrf){await remoteClear(operation,csrf);}else {state.remoteUncertain=false;status("clear-status","clearLocal","success");}}
function resultItem(container,key,fallback){const li=document.createElement("li");li.dataset.resultKey=key;li.dataset.fallback=fallback;li.textContent=t(key)||t(fallback);container.append(li);}
function renderResult(result){clearResult();const panel=$("result-panel");panel.dataset.band=["low","medium","high","critical"].includes(result.band)?result.band:"medium";$("result-band").dataset.resultKey=`band.${panel.dataset.band}`;$("result-band").textContent=t(`band.${panel.dataset.band}`);$("result-score").textContent=String(Math.round(result.score));$("result-engine").textContent="AETERNA Civil Shield™ · 2026-10-17";
  for(const item of result.indicators.slice(0,40)){const key=typeof item?.key==="string"&&/^[a-z_]+$/.test(item.key)?item.key:"unknown";resultItem($("result-indicators"),`indicators.${key}`,"unknownIndicator");}
  if(!result.indicators.length)resultItem($("result-indicators"),"noIndicators","noIndicators");for(const item of result.recommendations.slice(0,20)){const key=typeof item==="string"&&/^[a-z_]+$/.test(item)?item:"unknown";resultItem($("result-recommendations"),`recommendations.${key}`,"unknownRecommendation");}for(const item of result.limitations.slice(0,20)){const key=typeof item==="string"&&/^[a-z_]+$/.test(item)?item:"unknown";resultItem($("result-limitations"),`limitations.${key}`,"unknownLimitation");}panel.hidden=false;panel.focus({preventScroll:true});panel.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"});}

$("email-form").addEventListener("submit",async(event)=>{event.preventDefault();if(state.authBusy)return;if(!$("email").checkValidity()){status("auth-status","invalidEmail","error");$("email").focus();return;}setAuthBusy(true);status("auth-status","sending");const controller=new AbortController();state.authController=controller;try{const data=await request("/api/auth/start",{body:{email:$("email").value.trim(),locale:state.locale},csrf:null,signal:controller.signal,timeoutMs:25000});if(typeof data.challenge_id!=="string")throw new ApiError("INVALID_RESPONSE");state.challenge=data.challenge_id;$("email").value="";$("email-form").hidden=true;$("code-form").hidden=false;status("auth-status","codeSent");$("code").focus();}catch(error){errorStatus("auth-status",error);}finally{state.authController=null;setAuthBusy(false);}});
$("code-form").addEventListener("submit",async(event)=>{event.preventDefault();if(state.authBusy)return;const code=$("code").value.trim();if(!/^\d{8}$/.test(code)||!state.challenge){status("auth-status","invalidCode","error");return;}setAuthBusy(true);status("auth-status","verifying");const controller=new AbortController();state.authController=controller;try{const data=await request("/api/auth/verify",{body:{challenge_id:state.challenge,code},csrf:null,signal:controller.signal,timeoutMs:25000});showAuthenticated(data);}catch(error){$("code").value="";errorStatus("auth-status",error);}finally{state.authController=null;setAuthBusy(false);}});
$("change-email").addEventListener("click",()=>{state.challenge=null;$("code").value="";$("email-form").hidden=false;$("code-form").hidden=true;status("auth-status","");$("email").focus();});
$("code").addEventListener("input",()=>{$("code").value=$("code").value.replace(/[^0-9]/g,"").slice(0,8);});
$("scan-form").addEventListener("submit",async(event)=>{event.preventDefault();if(state.scanning||state.clearing||state.ocrBusy||state.remoteUncertain||!state.csrf||!state.account)return;const validation=validateScan(readFields());if(!validation.valid){status("scan-status",validation.error,"error");return;}if(state.account.unlimited!==true&&!(Number(state.account.scans_remaining)>0)){status("scan-status","noCredits","error");return;}const id=crypto.randomUUID();const version=generation.next();const controller=new AbortController();state.operation=id;state.scanController=controller;state.scanning=true;clearResult();status("clear-status","");status("scan-status","scanning");updateControls();let body={operation_id:id,message:composeScan(readFields()),locale:state.locale};try{const data=await request("/api/scans",{body,signal:controller.signal,timeoutMs:45000});body=null;if(!generation.isCurrent(version))return;if(data.operation_id!==id||!validResult(data.result))throw new ApiError("INVALID_RESPONSE");if(data.account){state.account=data.account;renderAccount();}renderResult(data.result);status("scan-status","scanComplete","success");}catch(error){body=null;if(!generation.isCurrent(version))return;if(error.code==="UNAUTHORIZED"||error.status===401){localClear();state.operation=null;state.remoteUncertain=false;showLoggedOut();status("global-status","sessionEnded","warning");return;}state.remoteUncertain=true;if(error.name==="AbortError")status("scan-status","scanTimeout","warning");else announceError(error);}finally{body=null;if(generation.isCurrent(version)){state.scanController=null;state.scanning=false;updateControls();}}});
$("scan-form").addEventListener("input",updateCounter);
$("clear-button").addEventListener("click",clearAnalysis);
$("ocr-button").addEventListener("click",async()=>{
  if(state.ocrBusy||state.scanning||state.clearing||!state.account)return;
  let file=$("scan-image").files?.[0];
  if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024||file.size===0){status("ocr-status","ocrInvalid","error");return;}
  const version=generation.next();state.ocrBusy=true;status("ocr-status","ocrWorking");updateControls();
  const finish=(key,kind="")=>{if(!generation.isCurrent(version))return;state.ocrWorker?.terminate();state.ocrWorker=null;state.ocrBusy=false;state.ocrPending=null;clearTimeout(state.ocrTimer);state.ocrTimer=null;$("scan-image").value="";status("ocr-status",key,kind);updateControls();};
  try{
    // Own the wrapper before any asynchronous image reading or library initialisation.
    const worker=new Worker("/assets/ocr-worker.js");state.ocrWorker=worker;
    worker.onmessage=event=>{if(!generation.isCurrent(version))return;const data=event.data;if(data?.type==="progress")return;if(data?.type==="result"){
      const extracted=typeof data.text==="string"?data.text.trim():"";if(!extracted){finish("ocrEmpty","warning");return;}
      const fields=readFields();fields.message=fields.message.trim()?`${fields.message.trim()}\n\n${extracted}`:extracted;
      if(!validateScan(fields).valid){finish("ocrTooLong","warning");return;}
      $("scan-message").value=fields.message;updateCounter();finish("ocrDone","success");
    }else if(data?.type==="error")finish(data.code==="OCR_TOO_LONG"?"ocrTooLong":"ocrFailed","warning");};
    worker.onerror=()=>finish("ocrFailed","warning");
    state.ocrTimer=setTimeout(()=>finish("ocrFailed","warning"),90000);
    let image=await file.arrayBuffer();file=null;if(!generation.isCurrent(version)){image=null;return;}
    if(!safeImageDimensions(imageDimensions(image))){image=null;finish("ocrInvalid","warning");return;}
    const language={it:"ita",en:"eng",fr:"fra",es:"spa",pt:"por"}[state.locale];
    worker.postMessage({image,language},[image]);image=null;
  }catch{file=null;finish("ocrFailed","warning");}
});
$("logout").addEventListener("click",async()=>{if(state.logoutBusy)return;state.logoutBusy=true;const operation=state.operation;const csrf=state.csrf;localClear();state.authController?.abort();$("email").value="";$("code").value="";state.challenge=null;$("protected-area").hidden=true;status("global-status","logoutWorking");updateControls();if(operation&&csrf)await remoteClear(operation,csrf,false);try{await request("/api/auth/logout",{body:{},csrf,timeoutMs:18000});state.operation=null;showLoggedOut();status("global-status","logoutDone","success");}catch{showLoggedOut();state.csrf=csrf;$("logout").hidden=false;status("global-status","logoutUncertain","warning");}finally{state.logoutBusy=false;updateControls();}});
$("language").addEventListener("change",()=>{state.locale=normaliseLocale($("language").value);try{localStorage.setItem(LOCALE_KEY,state.locale);}catch{}translatePage();});
async function restoreSession(){status("global-status","checking");try{const payload=await request("/api/session",{timeoutMs:20000});if(payload.authenticated===true)showAuthenticated(payload);else{showLoggedOut();status("global-status","ready");}}catch(error){showLoggedOut();if(error.status===401||error.status===403)status("global-status",translate(state.locale,`errors.${error.code}`)?`errors.${error.code}`:"sessionEnded","warning");else errorStatus("global-status",error);}if(!legacyCleanOk)status("global-status","storageWarning","warning");}
window.addEventListener("pagehide",()=>{const operation=state.operation;const csrf=state.csrf;localClear();$("email").value="";$("code").value="";state.challenge=null;state.authController?.abort();if(operation&&csrf){fetch(`/api/scans/${encodeURIComponent(operation)}/clear`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:"{}",keepalive:true}).catch(()=>{});}});
window.addEventListener("pageshow",event=>{if(event.persisted){localClear();showLoggedOut();restoreSession();}});
translatePage();restoreSession();
