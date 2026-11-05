import {useEffect,useState} from 'react';
import {request} from './api';
function decodeKey(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export function PushSettings({onContinue,firstSetup=false}:{onContinue?:()=>void;firstSetup?:boolean}){
 const [ready,setReady]=useState(false);
 const [configured,setConfigured]=useState(false);
 const [publicKey,setPublicKey]=useState('');
 const [permission,setPermission]=useState(typeof Notification!=='undefined'?Notification.permission:'unsupported');
 const [subscribed,setSubscribed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const supported=typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 useEffect(()=>{let active=true;(async()=>{try{
  const config=await request<{enabled:boolean;public_key:string|null}>('/push/config');
  if(!active)return;
  setConfigured(config.enabled);setPublicKey(config.public_key||'');
  if(supported){const reg=await navigator.serviceWorker.getRegistration('/building-manager/');if(active&&reg)setSubscribed(Boolean(await reg.pushManager.getSubscription()));}
 }catch(e){if(active)setMessage((e as Error).message);}finally{if(active)setReady(true);}})();return()=>{active=false;};},[supported]);
 async function enable(){setBusy(true);setMessage('');try{
  if(!supported)throw Error('Η συσκευή ή το πρόγραμμα περιήγησης δεν υποστηρίζει ειδοποιήσεις push.');
  if(!configured||!publicKey)throw Error('Η υπηρεσία ειδοποιήσεων δεν έχει ενεργοποιηθεί ακόμη.');
  const permissionResult=await Notification.requestPermission();setPermission(permissionResult);
  if(permissionResult!=='granted')throw Error('Δεν δόθηκε άδεια ειδοποιήσεων. Μπορείτε να συνεχίσετε χωρίς αυτές.');
  const reg=await navigator.serviceWorker.register('/building-manager/sw.js');
  const subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)});
  await request('/push/subscribe',{method:'POST',body:JSON.stringify({subscription:subscription.toJSON()})});
  setSubscribed(true);setMessage('Οι ειδοποιήσεις ενεργοποιήθηκαν σε αυτή τη συσκευή.');
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function disable(){setBusy(true);setMessage('');try{
  const reg=await navigator.serviceWorker.getRegistration('/building-manager/');
  const sub=await reg?.pushManager.getSubscription();
  if(sub){await request('/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();}
  setSubscribed(false);setMessage('Οι ειδοποιήσεις απενεργοποιήθηκαν σε αυτή τη συσκευή.');
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel" aria-label="Ρυθμίσεις ειδοποιήσεων"><h3>🔔 Ειδοποιήσεις push</h3><p className="muted">{firstSetup?'Επιλέξτε αν θέλετε να λαμβάνετε ειδοποιήσεις στη συσκευή σας. Η άδεια δίνεται από το πρόγραμμα περιήγησης.':'Λάβετε ειδοποιήσεις για πληρωμές και ανακοινώσεις στη συσκευή σας.'}</p><p role="status">{!ready?'Έλεγχος διαθεσιμότητας…':!supported?'Η συσκευή δεν υποστηρίζει ειδοποιήσεις push. Σε iPhone εγκαταστήστε πρώτα την εφαρμογή στην Αρχική οθόνη.':!configured?'Η υπηρεσία ειδοποιήσεων δεν είναι ακόμη διαθέσιμη.':subscribed?'✓ Οι ειδοποιήσεις είναι ενεργές σε αυτή τη συσκευή.':permission==='denied'?'Οι ειδοποιήσεις έχουν αποκλειστεί από τις ρυθμίσεις της συσκευής.':'Οι ειδοποιήσεις δεν είναι ενεργές σε αυτή τη συσκευή.'}</p>{message&&<p role="status" className="muted">{message}</p>}<div className="form-grid">{subscribed?<button type="button" disabled={busy} onClick={disable}>Απενεργοποίηση ειδοποιήσεων</button>:<button type="button" disabled={busy||!ready||!supported||!configured||permission==='denied'} onClick={enable}>Ενεργοποίηση ειδοποιήσεων</button>}{onContinue&&<button type="button" disabled={busy} onClick={onContinue}>Συνέχεια στην εφαρμογή</button>}</div></section>;
}
