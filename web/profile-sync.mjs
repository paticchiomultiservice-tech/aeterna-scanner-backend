import {validatePassport} from './extra-model.mjs';

// Confirmed server revisions, never browser storage, determine whether a copy is saved.
export function createProfileSync({request,onRemote=()=>{},onStatus=()=>{},delay=800}={}){
  let epoch=0,revision=null,enabled=false,state='loading',current=null,ack='',timer=null,inflight=null,edited=false;
  const fingerprint=p=>JSON.stringify(validatePassport(p));
  function report(next){state=next;onStatus({state,revision,enabled,pending:enabled&&current!==null&&fingerprint(current)!==ack});}
  function check(data){if(data?.ok!==true||!Number.isSafeInteger(data.revision)||data.revision<0||!(data.saved_at===null||typeof data.saved_at==='string')||!(data.passport===null||typeof data.passport==='object'))throw Error('INVALID_RESPONSE');return data.passport===null?null:validatePassport(data.passport);}
  async function start(initial,{replace=false}={}){
    const version=++epoch;clearTimeout(timer);enabled=false;revision=null;edited=false;current=validatePassport(initial);ack='';report('loading');
    try{const data=await request('/api/workspace'),remote=check(data);if(version!==epoch)return;revision=data.revision;
      if(remote&&edited){report('conflict');return;}
      if(remote){current=remote;ack=fingerprint(remote);enabled=true;onRemote(remote);report('saved');}
      else report('local');
    }catch{if(version===epoch)report('error');}
  }
  function changed(value){current=validatePassport(value);edited=true;if(enabled){report('pending');clearTimeout(timer);timer=setTimeout(()=>void flush(),delay);} }
  async function flush(){
    clearTimeout(timer);if(!enabled||revision===null||current===null)return false;
    if(inflight){await inflight;return enabled&&current!==null&&fingerprint(current)===ack;}
    const version=epoch;
    const run=async()=>{while(version===epoch&&enabled&&current!==null&&fingerprint(current)!==ack){
      const value=validatePassport(current),snapshot=fingerprint(value);report('saving');
      try{const data=await request('/api/workspace',{body:{expected_revision:revision,passport:value}});check(data);if(version!==epoch)return false;
        if(data.revision!==revision+1||data.passport===null||fingerprint(data.passport)!==snapshot)throw Error('INVALID_RESPONSE');
        revision=data.revision;ack=snapshot;report(fingerprint(current)===ack?'saved':'pending');
      }catch(error){if(version!==epoch)return false;if(error?.code==='WORKSPACE_CONFLICT'){enabled=false;report('conflict');}else report('error');return false;}
    }return version===epoch&&enabled;};
    const job=run();inflight=job;try{return await job;}finally{if(inflight===job)inflight=null;}
  }
  async function enable(){if(revision===null||state==='conflict'||state==='loading')return false;enabled=true;report('pending');return flush();}
  function clear(){epoch++;clearTimeout(timer);enabled=false;revision=null;current=null;ack='';inflight=null;edited=false;state='local';}
  return Object.freeze({start,changed,flush,enable,clear,getState:()=>({state,revision,enabled,pending:enabled&&current!==null&&fingerprint(current)!==ack})});
}
