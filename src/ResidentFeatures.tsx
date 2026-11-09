import {useState} from 'react';
import {money} from './accounting';

export type FuelPeriodView={start:string;end:string;hours:number;liters:number;cost_cents:number};
export type FuelOpeningView={as_of:string;deposited_cents:number;estimated_consumed_cents:number;note:string};
export type FuelLegacyView={as_of:string;reported_deposited_cents:number;reported_estimated_consumed_cents:number};
export type FuelAccountView={
 apartment_code:string;opening:FuelOpeningView|null;legacy:FuelLegacyView|null;deposits_cents:number|null;
 estimated_cost_cents:number;estimated_balance_cents:number|null;hours:number;estimated_liters:number;
 estimated_hourly_cost_cents:number|null;remaining_hours:number|null;periods:FuelPeriodView[];historical_periods:FuelPeriodView[];historical_hours:number;historical_liters:number;historical_cost_cents:number;historical_arrears_cents:number;warnings:string[];
};
export type FuelResponse={
 settlement:{settled_through:string;historical_arrears_cents:number;credit_status:string};settings:{liters_per_cm:number;price_cents_per_liter:number};accounts:FuelAccountView[];
 excluded:string[];period_count:number;inventory_price_cents_per_liter?:number|null;inventory_price_estimated?:boolean;note:string;
};
export type AnnouncementView={
 id:string;title:string;body:string;published_at:string;created_at:string;archived_at:string|null;read:boolean;
};
export type AnnouncementsResponse={announcements:AnnouncementView[];unread_count:number};
const dateGreek=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('el-GR');
const fmtHours=(hours:number)=>hours.toLocaleString('el-GR',{maximumFractionDigits:2})+' ώρες';

export function FuelAccountSummary({account,compact=false,priceCentsPerLiter}:{account:FuelAccountView|null|undefined;compact?:boolean;priceCentsPerLiter?:number}){
 if(!account)return <p className="muted">Δεν υπάρχουν ακόμη στοιχεία κατανάλωσης θέρμανσης.</p>;
 const creditLiters=account.estimated_balance_cents!==null&&priceCentsPerLiter!==undefined&&Number.isFinite(priceCentsPerLiter)&&priceCentsPerLiter>0?account.estimated_balance_cents/priceCentsPerLiter:null;
 return <div className="fuel-account-summary"><p className="fuel-settled-banner">Ιστορική περίοδος: κλειστή · Δεν μεταφέρονται παλαιές οφειλές</p>
  <div className="fuel-metrics">
   <article><small>Μεταφερόμενη πίστωση θέρμανσης</small><strong>{account.opening?money(Math.max(0,account.opening.deposited_cents-account.opening.estimated_consumed_cents)):'—'}</strong><span>{account.opening?'Πίστωση από το ιστορικό αρχείο, προς συμφωνία με τα πραγματικά παραστατικά':'Δεν έχει επιβεβαιωθεί αρχική πίστωση'}</span></article>
   <article><small>Νέες καταθέσεις</small><strong>{account.opening&&account.deposits_cents!==null?money(Math.max(0,account.deposits_cents-account.opening.deposited_cents)):'—'}</strong><span>Πληρωμές μετά τη μεταφορά υπολοίπου</span></article>
   <article><small>Εκτιμώμενη νέα κατανάλωση (€)</small><strong>{money(account.estimated_cost_cents)}</strong><span>Εκτίμηση από κατανάλωση, όχι τιμολόγιο</span></article>
   <article><small>Υπόλοιπο πίστωσης θέρμανσης</small><strong>{account.estimated_balance_cents===null?'—':money(account.estimated_balance_cents)}</strong><span>{account.estimated_balance_cents===null?'Απαιτείται επιβεβαίωση αρχικού υπολοίπου':'Μεταφερόμενη πίστωση + νέες πληρωμές − εκτιμώμενη νέα κατανάλωση'}</span></article>
   <article><small>Εκτιμώμενες ώρες που απομένουν</small><strong>{account.remaining_hours===null?'—':fmtHours(account.remaining_hours)}</strong><span>Με εκτιμώμενη τιμή ανά ώρα από διαθέσιμες μετρήσεις του διαμερίσματος</span></article>
   <article><small>Εκτιμώμενα λίτρα που καλύπτει η πίστωση</small><strong>{creditLiters===null?'—':creditLiters.toLocaleString('el-GR',{maximumFractionDigits:2})+' L'}</strong><span>{creditLiters===null?'Δεν υπάρχει διαθέσιμη αξιόπιστη τιμή €/L ή επιβεβαιωμένη πίστωση':'Υπόλοιπο πίστωσης ÷ εκτιμώμενη μέση τιμή αποθέματος '+(priceCentsPerLiter!/100).toLocaleString('el-GR',{maximumFractionDigits:2})+' €/L. Οικονομική ισοδυναμία, όχι μετρημένο απόθεμα ή ατομική ποσότητα δεξαμενής.'}</span></article>
   <article><small>Νέες ώρες λειτουργίας</small><strong>{fmtHours(account.hours)}</strong><span>Μόνο διαφορές μεταξύ ενδείξεων</span></article>
   <article><small>Νέα εκτιμώμενα λίτρα</small><strong>{account.estimated_liters.toLocaleString('el-GR',{maximumFractionDigits:2})} L</strong><span>Λίτρα που καταναλώθηκαν στη νέα περίοδο, όχι λίτρα που απομένουν από την πίστωση</span></article>
  </div>
  {!account.opening&&<p className="fuel-amber">Το ιστορικό πετρέλαιο έχει εξοφληθεί. Τυχόν αχρησιμοποίητη πίστωση χρειάζεται ξεχωριστή συμφωνία. Οι εκτιμήσεις κατανάλωσης εμφανίζονται, όχι όμως υποθετική πίστωση ή οφειλή.</p>}
  {!compact&&<details className="fuel-period-details"><summary>Εξοφλημένη ιστορική κατανάλωση ({account.historical_periods.length} περίοδοι)</summary><p className="muted">Ιστορική εκτίμηση: {account.historical_hours.toLocaleString('el-GR')} ώρες · {account.historical_liters.toLocaleString('el-GR')} λίτρα · {money(account.historical_cost_cents)}. Καμία εκκρεμής οφειλή.</p></details>}
  {!compact&&<details className="fuel-period-details"><summary>Αναλυτική εκτίμηση ανά περίοδο ({account.periods.length})</summary>
   <div className="table-wrap"><table><thead><tr><th>Περίοδος</th><th>Ώρες</th><th>Λίτρα (εκτ.)</th><th>Κόστος (εκτ.)</th></tr></thead>
    <tbody>{account.periods.map(p=><tr key={p.start+'|'+p.end}><td>{dateGreek(p.start)} – {dateGreek(p.end)}</td><td>{p.hours.toLocaleString('el-GR',{maximumFractionDigits:2})}</td><td>{p.liters.toLocaleString('el-GR',{maximumFractionDigits:2})}</td><td>{money(p.cost_cents)}</td></tr>)}</tbody></table></div>
  </details>}
  {!compact&&<section className="fuel-faq" aria-label="Συχνές ερωτήσεις θέρμανσης">
   <h3>Συχνές ερωτήσεις για τον λογαριασμό θέρμανσης</h3>
   <p className="muted">Οι ώρες, τα λίτρα και τα ποσά κατανάλωσης είναι εκτιμήσεις βάσει διαθέσιμων μετρήσεων. Η πίστωση τηρείται σε ευρώ.</p>
   <details className="fuel-period-details"><summary>Πώς υπολογίζεται το υπόλοιπό μου;</summary><p>Μεταφερόμενη πίστωση σε ευρώ + νέες καταθέσεις − εκτιμώμενο κόστος νέας κατανάλωσης. Η ιστορική πίστωση δεν μετατρέπεται σε σταθερά λίτρα και δεν χρεώνεται ξανά η εξοφλημένη ιστορική κατανάλωση.</p></details>
   <details className="fuel-period-details"><summary>Αν καταθέσω 250 €, προστίθενται στην υπάρχουσα πίστωση;</summary><p>Ναι, μόλις καταχωριστεί η νέα πληρωμή. Για παράδειγμα, πίστωση 59,67 € και νέα κατάθεση 250 € δίνουν 309,67 € πριν από νέα κατανάλωση. Η κατάθεση δεν αγοράζει συγκεκριμένα λίτρα αποκλειστικά για το διαμέρισμα.</p></details>
   <details className="fuel-period-details"><summary>Γιατί αλλάζουν τα λίτρα που καλύπτει η πίστωση;</summary><p>Είναι χρηματική ισοδυναμία: διαθέσιμη πίστωση ÷ εκτιμώμενη μέση τιμή ανά λίτρο του αποθέματος. Η τιμή συνυπολογίζει το παλιό απόθεμα και τις νέες αγορές με τα καταχωρισμένα κόστη. Αν η αρχική τιμή του παλιού αποθέματος δεν είναι γνωστή, χρησιμοποιείται ενδεικτική τιμή και το αποτέλεσμα παραμένει εκτίμηση. Δεν πρόκειται για λίτρα που ανήκουν στο διαμέρισμα ή για μέτρηση της δεξαμενής.</p></details>
   <details className="fuel-period-details"><summary>Αν αγοράσουμε πετρέλαιο με 1,47 €/L, τι αλλάζει;</summary><p>Η νέα αγορά καταχωρίζεται με τα πραγματικά λίτρα και το πραγματικό συνολικό κόστος. Δεν αποτιμάται αυτόματα όλο το παλιό απόθεμα στα 1,47 €/L: υπολογίζεται μέση τιμή βάσει της ποσότητας και της αξίας παλιού και νέου καυσίμου. Το χρηματικό υπόλοιπό σας δεν αλλάζει μόνο επειδή έγινε αγορά πετρελαίου· αλλάζει με τις καταθέσεις και τη χρεωμένη κατανάλωση.</p></details>
   <details className="fuel-period-details"><summary>Πώς υπολογίζονται η κατανάλωση και οι χρεώσεις;</summary><p>Συγκρίνονται οι διαδοχικές ενδείξεις της δεξαμενής και των ωρομετρητών όλων των διαμερισμάτων, μαζί με τις παραδόσεις πετρελαίου. Η συνολική ποσότητα υπολογίζεται από τη μεταβολή της στάθμης, τη μετατροπή εκατοστών σε λίτρα και τις παραδόσεις. Το κόστος κατανέμεται σύμφωνα με τις ώρες λειτουργίας και τον συντελεστή θέρμανσης κάθε διαμερίσματος. Τα εκτιμώμενα λίτρα κατανάλωσης και η χρέωση δεν είναι το ίδιο μέγεθος.</p></details>
   <details className="fuel-period-details"><summary>Γιατί οι ώρες που απομένουν είναι εκτίμηση;</summary><p>Προκύπτουν από την πίστωση και το εκτιμώμενο κόστος ανά ώρα για το διαμέρισμα, με βάση διαθέσιμες μετρήσεις και τον συντελεστή του. Η πραγματική κατανάλωση και η τιμή καυσίμου μπορεί να διαφέρουν. Οι επόμενες πλήρεις μετρήσεις ανανεώνουν την πρόβλεψη.</p></details>
   <details className="fuel-period-details"><summary>Πότε ενημερώνονται τα στοιχεία και τι γίνεται αν λείπει μέτρηση;</summary><p>Οι νέες καταθέσεις εμφανίζονται μετά την καταχώρισή τους. Η νέα κατανάλωση υπολογίζεται όταν υπάρχουν έγκυρες διαδοχικές μετρήσεις δεξαμενής και ωρομετρητών. Περίοδοι με ελλιπή ή ασύμβατα στοιχεία εξαιρούνται από την εκτίμηση και επισημαίνονται για έλεγχο.</p></details>
   <details className="fuel-period-details"><summary>Είναι το εμφανιζόμενο ποσό οριστικός λογαριασμός;</summary><p>Όχι. Οι υπολογισμοί κατανάλωσης και οι προβλέψεις είναι ενημερωτικές εκτιμήσεις. Η οριστική συμφωνία γίνεται με τις πραγματικές μετρήσεις, τις καταθέσεις και τα παραστατικά αγοράς πετρελαίου.</p></details>
  </section>}
  {!compact&&account.warnings.length>0&&<p className="fuel-amber">Απαιτείται έλεγχος ορισμένων περιόδων: {account.warnings.join(' · ')}</p>}
 </div>;
}

export function AnnouncementFeed({items,isAdmin,onRead,onArchive,onDelete}:{
 items:AnnouncementView[];isAdmin:boolean;onRead:(id:string)=>void;onArchive:(id:string)=>void;onDelete:(id:string)=>void;
}){
 const [expanded,setExpanded]=useState<string|null>(null);
 const visible=items.filter(a=>isAdmin||!a.archived_at);
 return <div className="announcement-feed">
  {visible.map(a=><article key={a.id} className={'announcement-entry '+(!a.read?'announcement-entry--unread':'')}>
   <button type="button" className="announcement-trigger" aria-expanded={expanded===a.id} onClick={()=>{setExpanded(v=>v===a.id?null:a.id);if(!a.read)onRead(a.id);}}>
    <span className="announcement-icon" aria-hidden="true">▣</span>
    <span className="announcement-heading"><strong>{a.title}</strong><small>{new Date(a.published_at).toLocaleDateString('el-GR',{day:'numeric',month:'long',year:'numeric'})}</small></span>
    {!a.read&&<span className="unread-dot" role="img" aria-label="Νέα ανακοίνωση"/>}
    {a.archived_at&&<span className="muted">Αρχειοθετημένη</span>}<span className="announcement-chevron" aria-hidden="true">{expanded===a.id?'⌃':'⌄'}</span>
   </button>
   {expanded===a.id&&<div className="announcement-body"><p>{a.body}</p>{isAdmin&&<div className="announcement-admin-actions">{!a.archived_at&&<button type="button" onClick={()=>onArchive(a.id)}>Αρχειοθέτηση</button>}<button type="button" className="announcement-delete-button" onClick={()=>onDelete(a.id)}>Διαγραφή οριστικά</button></div>}</div>}
  </article>)}
  {!visible.length&&<p className="muted">Δεν υπάρχουν ανακοινώσεις ακόμη.</p>}
 </div>;
}
