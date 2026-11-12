import {money} from './accounting';
type Allocation={credit_cents?:number;gross_due_cents?:number};
export function statementCreditFields(allocation?:Allocation){
 return (allocation?.credit_cents??0)>0?{credit:money(allocation!.credit_cents!),grossDue:money(allocation?.gross_due_cents??0)}:{};
}
export function CommonCredit({allocation,table=false}:{allocation?:Allocation;table?:boolean}){
 if(!(allocation?.credit_cents&&allocation.credit_cents>0))return null;
 const credit=money(allocation.credit_cents),gross=money(allocation.gross_due_cents??0);
 if(table)return <><tr><th>Αρχική χρέωση</th><td>{gross}</td></tr><tr><th>Πίστωση εφαρμογής</th><td>−{credit}</td></tr></>;
 return <><div className="resident-credit-notice" role="note">Πίστωση εξόδων εφαρμογής: −{credit} ανά μήνα. Η έκπτωση αφαιρείται από τη χρέωση του Α3.</div><div className="resident-line"><span>Αρχική χρέωση Α3</span><span>{gross}</span></div><div className="resident-line"><span>Πίστωση εφαρμογής</span><strong>−{credit}</strong></div></>;
}
