import {validatePassport} from './extra-model.mjs';
import {configurationBasis} from './phone-model.mjs';

// Confirmed server revisions, never browser storage, determine whether a copy is saved.
export function createProfileSync({request,onRemote=()=>{},onStatus=()=>{},delay=800,capabilities=null}={}){
  let epoch=0,revision=null,enabled=false,state='loading',current=null,ack='',timer=null,inflight=null,edited=false,checkpoints=[];
  const fingerprint=p=>JSON.stringify(validatePassport(p));
  let capability=null,capabilityJob=null;
  const incompatible=new Set(['WORKSPACE_SCHEMA_UNSUPPORTED','WORKSPACE_INVALID_TRANSITION']);
  async function supports(value){if(value.schema!=='aeterna.passport.v4')return;const version=epoch;if(!capability){if(!capabilityJob)capabilityJob=(capabilities?Promise.resolve().then(capabilities):request('/api/workspace/capabilities'));const result=await capabilityJob;if(version!==epoch)throw Error('SESSION_CHANGED');capability=result;capabilityJob=null;}if(capability?.ok!==true||capability.phone_loss!==true||capability.transition_guard!=='aeterna.phone-loss.v1'||!Array.isArray(capability.passport_schemas)||!capability.passport_schemas.includes('aeterna.passport.v4')){const error=Error('WORKSPACE_SCHEMA_UNSUPPORTED');error.code='WORKSPACE_SCHEMA_UNSUPPORTED';throw error;}}
  const needsWrite=()=>current!==null&&(checkpoints.length>0||fingerprint(current)!==ack);
  function report(next){state=next;onStatus({state,revision,enabled,pending:enabled&&needsWrite()});}
  function check(data){if(data?.ok!==true||!Number.isSafeInteger(data.revision)||data.revision<0||!(data.saved_at===null||typeof data.saved_at==='string')||!(data.passport===null||typeof data.passport==='object'))throw Error('INVALID_RESPONSE');return data.passport===null?null:validatePassport(data.passport);}
  async function start(initial,{replace=false}={}){
    const version=++epoch;clearTimeout(timer);enabled=false;revision=null;edited=false;current=validatePassport(initial);ack='';checkpoints=[];inflight=null;capability=null;capabilityJob=null;report('loading');
    try{const data=await request('/api/workspace'),remote=check(data);if(version!==epoch)return;revision=data.revision;
      if(remote&&edited){report('conflict');return;}
      if(remote){current=remote;ack=fingerprint(remote);enabled=true;onRemote(remote);report('saved');}
      else report('local');
    }catch(error){if(version===epoch)report(error?.code==='WORKSPACE_SCHEMA_UNSUPPORTED'?'unsupported':'error');}
  }
  function changed(value){
    const next=validatePassport(value),previous=current;current=next;edited=true;
    if(enabled){
      // The server requires the changed recovery combination to be saved with
      // no proof before accepting a separate new confirmation. Keep the real
      // local invalidation even when both edits happen inside one debounce.
      // Never invent a null proof for an imported/directly changed document.
      if(previous&&next.inventory.some(row=>{const old=previous.inventory.find(item=>item.id===row.id);return old&&row.testedAt===null&&['service','access','recovery'].some(key=>old[key]!==row[key]);}))checkpoints.push(next);
      else if(previous&&next.schema==='aeterna.passport.v4'&&(previous.schema!==next.schema||configurationBasis(previous)!==configurationBasis(next)))checkpoints.push(next);
      report(needsWrite()?'pending':'saved');clearTimeout(timer);if(needsWrite())timer=setTimeout(()=>void flush(),delay);
    }
  }
  async function flush(){
    clearTimeout(timer);if(!enabled||revision===null||current===null)return false;
    if(inflight){await inflight;return enabled&&!needsWrite();}
    const version=epoch;
    const run=async()=>{while(version===epoch&&enabled&&needsWrite()){
      const checkpoint=checkpoints[0],value=validatePassport(checkpoint||current),snapshot=fingerprint(value);report('saving');
      try{if(value.schema==='aeterna.passport.v4')await supports(value);if(version!==epoch)return false;const data=await request('/api/workspace',{body:{expected_revision:revision,passport:value}});check(data);if(version!==epoch)return false;
        if(data.revision!==revision+1||data.passport===null||fingerprint(data.passport)!==snapshot)throw Error('INVALID_RESPONSE');
        revision=data.revision;ack=snapshot;if(checkpoint&&checkpoints[0]===checkpoint)checkpoints.shift();report(needsWrite()?'pending':'saved');
      }catch(error){if(version!==epoch)return false;if(error?.code==='WORKSPACE_CONFLICT'){enabled=false;report('conflict');}else if(incompatible.has(error?.code)){enabled=false;report(error.code==='WORKSPACE_SCHEMA_UNSUPPORTED'?'unsupported':'invalid_transition');}else{capabilityJob=null;report('error');}return false;}
    }return version===epoch&&enabled;};
    const job=run();inflight=job;try{return await job;}finally{if(inflight===job)inflight=null;}
  }
  async function enable(){if(revision===null||['conflict','loading','unsupported','invalid_transition'].includes(state))return false;enabled=true;report('pending');return flush();}
  function clear(){epoch++;clearTimeout(timer);enabled=false;revision=null;current=null;ack='';inflight=null;edited=false;checkpoints=[];capability=null;capabilityJob=null;state='local';}
  return Object.freeze({start,changed,flush,enable,clear,isAcknowledged:(value=current)=>Boolean(value&&enabled&&revision!==null&&state==='saved'&&!checkpoints.length&&fingerprint(value)===ack),getState:()=>({state,revision,enabled,pending:enabled&&needsWrite()})});
}
