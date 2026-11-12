import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import {watchAppUpdates} from './appUpdates';
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/building-manager/sw.js',{updateViaCache:'none'}).catch(() => {}));
}
if(import.meta.env.PROD)watchAppUpdates();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// Keep the brand visible briefly on launch, then release all interactions.
const splash=document.getElementById('samou-splash');
if(splash){window.setTimeout(()=>{splash.classList.add('splash-done');window.setTimeout(()=>splash.remove(),550);},1600);}
