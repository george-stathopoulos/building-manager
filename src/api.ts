export type Apartment = {id:string;code:string;heating_share:number;common_share:number};
export type Expense = {id:string;month:string;category:string;description:string;amount_cents:number;created_at:string};
export type Payment = {id:string;apartment_code:string;kind:'common'|'heating';amount_cents:number;paid_on:string};
export type HeatingReading = {id:string;apartment_code:string;reading:number;measured_on:string};
export type FuelDelivery = {id:string;delivered_on:string;liters:number;cost_cents:number;note:string};
export type Overview = {fuel_deliveries:FuelDelivery[];apartments:Apartment[];expenses:Expense[];payments:Payment[];readings:HeatingReading[];tank:{measured_on:string;centimeters:number}|null;role:'admin'|'resident';email:string;my_apartments:string[]};
const origin=(import.meta.env.VITE_API_URL as string|undefined)?.replace(/\/$/,'') ?? '';
let token=sessionStorage.getItem('building_manager_token')||'';
export const configured=Boolean(origin);
export function authenticated(){return Boolean(token);}
export function saveToken(t:string){token=t;sessionStorage.setItem('building_manager_token',t);}
export function clearToken(){token='';sessionStorage.removeItem('building_manager_token');}
export async function request<T>(path:string, options:RequestInit={}):Promise<T>{
 if(!configured)throw Error('Η υπηρεσία δεδομένων δεν έχει συνδεθεί.');
 const res=await fetch(origin+'/api'+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{}),...options.headers},cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Πρόβλημα επικοινωνίας'}));
 if(!res.ok)throw Error(data.error||'Η ενέργεια απέτυχε.');
 return data as T;
}
