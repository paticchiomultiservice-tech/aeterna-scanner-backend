/* AETERNA view transitions. No persistence, network, input reads or focus changes. */
const MOTION_QUERY='(prefers-reduced-motion: reduce)';
const CLASS_NAME='core-flow-enter';
const CLEANUP_MS=240;

/**
 * Call after the workspace has rendered, then retain its normal focus handling.
 * Pass only navigation identifiers (view/phase/scenario), never customer content.
 * Same-identity rerenders, including profile autosave and form edits, do not animate.
 */
export function createFlowMotion(root,{windowObject=root?.ownerDocument?.defaultView??globalThis.window??globalThis}={}){
  if(!root||typeof root.querySelector!=='function')throw new TypeError('Missing flow root');
  const query=typeof windowObject.matchMedia==='function'?windowObject.matchMedia(MOTION_QUERY):null;
  const schedule=typeof windowObject.setTimeout==='function'?(fn,ms)=>windowObject.setTimeout(fn,ms):null;
  const unschedule=typeof windowObject.clearTimeout==='function'?id=>windowObject.clearTimeout(id):null;
  let previous=null,panel=null,timer=null,destroyed=false;

  function finish(){
    if(timer!==null){unschedule?.(timer);timer=null;}
    panel?.classList?.remove(CLASS_NAME);
    panel=null;
  }
  function onPreferenceChange(event){if(event.matches)finish();}
  query?.addEventListener?.('change',onPreferenceChange);

  return Object.freeze({
    afterRender({view,step=null}={}){
      if(destroyed)return false;
      if(typeof view!=='string'||!/^[a-z][a-z0-9_-]{0,48}$/.test(view))return false;
      if(step!==null&&(typeof step!=='string'||step.length>80))return false;
      const next=JSON.stringify([view,step]);
      const changed=previous!==null&&previous!==next;
      previous=next;
      finish();
      const candidate=root.querySelector('.core-view');
      const heading=root.querySelector('#core-view-title');
      if(candidate&&heading?.id&&typeof candidate.setAttribute==='function'){
        candidate.setAttribute('role','region');
        candidate.setAttribute('aria-labelledby',heading.id);
      }
      if(root.dataset){root.dataset.flowReady='true';root.dataset.flowView=view;}
      if(!changed||query?.matches||!candidate?.classList?.add||!schedule)return false;
      panel=candidate;
      panel.classList.add(CLASS_NAME);
      timer=schedule(finish,CLEANUP_MS);
      return true;
    },
    reset(){
      finish();previous=null;
      if(root.dataset){delete root.dataset.flowReady;delete root.dataset.flowView;}
    },
    destroy(){
      finish();previous=null;destroyed=true;
      query?.removeEventListener?.('change',onPreferenceChange);
      if(root.dataset){delete root.dataset.flowReady;delete root.dataset.flowView;}
    }
  });
}
