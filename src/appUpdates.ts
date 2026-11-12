/** Check the published entry script directly; the service worker must bypass no-store requests. */
export async function checkForAppUpdate(){
 if(!navigator.onLine)return;
 const current=document.querySelector<HTMLScriptElement>('script[type="module"][src]');
 if(!current)return;
 try{
  // The query also bypasses the old v1 worker, which ignored Request.cache.
  const url=new URL(import.meta.env.BASE_URL,location.origin);
  url.searchParams.set('__app_update',String(Date.now()));
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)return;
  const next=new DOMParser().parseFromString(await response.text(),'text/html').querySelector<HTMLScriptElement>('script[type="module"][src]');
  if(next&&new URL(next.getAttribute('src')!,response.url||location.href).href!==current.src)location.reload();
 }catch{/* Keep the current app usable when offline or the update check fails. */}
}

export function watchAppUpdates(){
 let checking=false;
 const check=async()=>{
  if(document.visibilityState!=='visible'||checking)return;
  checking=true;
  try{
   // Also discover worker changes when an installed app resumes without a navigation.
   if('serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).catch(()=>undefined);
    void registration?.update().catch(()=>{});
   }
   await checkForAppUpdate();
  }finally{checking=false;}
 };
 window.addEventListener('pageshow',check);
 window.addEventListener('online',check);
 document.addEventListener('visibilitychange',check);
 void check();
 return()=>{
  window.removeEventListener('pageshow',check);
  window.removeEventListener('online',check);
  document.removeEventListener('visibilitychange',check);
 };
}
