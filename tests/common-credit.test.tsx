import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CommonCredit,statementCreditFields} from '../src/CommonCredit';
describe('resident breakdown, print and PDF credit visibility',()=>{
 it('omits all deduction labels and PDF fields when disabled or missing',()=>{
  for(const allocation of [undefined,{credit_cents:0,gross_due_cents:3000}]){
   expect(renderToStaticMarkup(<CommonCredit allocation={allocation}/>)).toBe('');
   expect(renderToStaticMarkup(<table><tbody><CommonCredit allocation={allocation} table/></tbody></table>)).not.toContain('Πίστωση');
   expect(statementCreditFields(allocation)).toEqual({});
  }
 });
 it('includes the actual server credit in breakdown, print and PDF when enabled',()=>{
  const allocation={credit_cents:500,gross_due_cents:500};
  expect(renderToStaticMarkup(<CommonCredit allocation={allocation}/>)).toContain('Πίστωση');
  expect(renderToStaticMarkup(<table><tbody><CommonCredit allocation={allocation} table/></tbody></table>)).toContain('Αρχική χρέωση');
  expect(statementCreditFields(allocation)).toHaveProperty('credit');
 });
});
