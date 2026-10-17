/* Owned wrapper: the page can terminate it, including during OCR initialisation. */
let busy=false;
self.onmessage=async(event)=>{
  if(busy)return;
  busy=true;
  let image=null;
  let worker=null;
  try{
    const data=event.data;
    const language=["ita","eng","fra","spa","por"].includes(data?.language)?data.language:"ita";
    if(!(data?.image instanceof ArrayBuffer)||data.image.byteLength>8*1024*1024)throw new Error("invalid");
    image=new Uint8Array(data.image);
    importScripts("/assets/vendor/tesseract.min.js");
    worker=await Tesseract.createWorker(language==="eng"?"eng":`${language}+eng`,1,{
      workerPath:"/assets/vendor/worker.min.js",corePath:"/assets/vendor/core",langPath:"/assets/vendor/lang",workerBlobURL:false,cacheMethod:"none",gzip:true,
      logger:message=>{if(typeof message.progress==="number")self.postMessage({type:"progress",progress:Math.max(0,Math.min(1,message.progress))});}
    });
    const result=await worker.recognize(image);
    image=null;
    const text=typeof result?.data?.text==="string"?result.data.text.trim():"";
    self.postMessage(text.length>20000?{type:"error",code:"OCR_TOO_LONG"}:{type:"result",text});
  }catch{
    self.postMessage({type:"error",code:"OCR_FAILED"});
  }finally{
    image=null;
    if(worker)await worker.terminate();
    busy=false;
    self.close();
  }
};
