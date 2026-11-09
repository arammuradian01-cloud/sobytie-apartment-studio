// Keep the verified mirror usable when the primary host interrupts a large GLB.
export async function downloadModel(urls,expectedHash,timeoutMs=15000){
 let lastError;
 for(const [index,url] of urls.entries()){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),index?60000:timeoutMs);
  try{
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok)throw new Error(`Model HTTP ${response.status}`);
   const bytes=await response.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==expectedHash)throw new Error('Model revision mismatch');
   return bytes;
  }catch(error){lastError=error;}finally{clearTimeout(timer);}
 }
 throw lastError;
}
