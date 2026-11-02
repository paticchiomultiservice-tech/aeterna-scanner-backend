import {importPassport,MAX_BYTES} from './extra-model.mjs';
export const MAX_DOCUMENT_BYTES=262144;
export function resumeBlock(json){if(typeof json!=='string'||new TextEncoder().encode(json).length>MAX_BYTES)throw Error('INVALID_DOCUMENT');return '<script type="application/json" id="aeterna-resume-data">'+json.replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')+'</script>';}
export function importDocument(text,now=new Date().toISOString()){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_DOCUMENT_BYTES)throw Error('INVALID_DOCUMENT');
  if(text.trimStart().startsWith('{'))return importPassport(text,now);
  // Never render or execute imported markup. Extract one exact inert data block,
  // then revalidate every data key. No DOMParser, eval, network or HTML mounting.
  const marker='<script type="application/json" id="aeterna-resume-data">';
  const start=text.indexOf(marker);if(start<0||text.indexOf(marker,start+marker.length)>=0)throw Error('INVALID_DOCUMENT');
  const end=text.indexOf('</script>',start+marker.length);if(end<0)throw Error('INVALID_DOCUMENT');
  return importPassport(text.slice(start+marker.length,end),now);
}
