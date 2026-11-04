import {describe,it,expect} from 'vitest';
import {calculateFuelAccounts} from '../api/src/fuel-model';

const apartments=[
 {id:'a',code:'A1',heating_share_bp:2000},
 {id:'b',code:'B1',heating_share_bp:1000}
];
const settings={liters_per_cm:20,price_cents_per_liter:100};
describe('fuel accounting from physical measurements',()=>{
 it('excludes initial meter readings and uses raw hours for litres, weighted hours for costs',()=>{
  const result=calculateFuelAccounts({
   apartments,settings,settledThrough:'2026-01-01',
   readings:[
    {apartment_id:'a',measured_on:'2026-01-01',reading:100},
    {apartment_id:'b',measured_on:'2026-01-01',reading:400},
    {apartment_id:'a',measured_on:'2026-01-10',reading:110},
    {apartment_id:'b',measured_on:'2026-01-10',reading:420}
   ],
   tank:[{measured_on:'2026-01-01',centimeters:90},{measured_on:'2026-01-10',centimeters:80}],
   deliveries:[],payments:[],openings:[{apartment_id:'a',as_of:'2026-01-01',deposited_cents:50000,estimated_consumed_cents:0,note:''}]
  });
  expect(result.periodCount).toBe(1);
  expect(result.accounts[0].hours).toBe(10);
  expect(result.accounts[1].hours).toBe(20);
  expect(result.accounts[0].estimated_liters).toBeCloseTo(200/3,2);
  expect(result.accounts[1].estimated_liters).toBeCloseTo(400/3,2);
  expect(result.accounts[0].estimated_cost_cents).toBe(10000);
  expect(result.accounts[1].estimated_cost_cents).toBe(10000);
  expect(result.accounts[0].estimated_balance_cents).toBe(40000);
  expect(result.accounts[1].estimated_balance_cents).toBeNull();
 });
 it('counts a same-date refill after the start measurement, never as a resident deposit',()=>{
  const result=calculateFuelAccounts({
   apartments,settings,settledThrough:'2026-01-20',
   readings:[
    {apartment_id:'a',measured_on:'2026-01-20',reading:50},
    {apartment_id:'b',measured_on:'2026-01-20',reading:60},
    {apartment_id:'a',measured_on:'2026-03-26',reading:70},
    {apartment_id:'b',measured_on:'2026-03-26',reading:70}
   ],
   tank:[{measured_on:'2026-01-20',centimeters:42},{measured_on:'2026-03-26',centimeters:35}],
   deliveries:[{delivered_on:'2026-01-20',liters:1000}],
   payments:[],openings:[]
  });
  expect(result.accounts.reduce((sum,a)=>sum+a.estimated_liters,0)).toBe(1140);
  expect(result.accounts.reduce((sum,a)=>sum+a.estimated_cost_cents,0)).toBe(114000);
  expect(result.accounts.every(a=>a.deposits_cents===null)).toBe(true);
 });
 it('excludes invalid decreasing meter readings instead of creating consumption',()=>{
  const result=calculateFuelAccounts({
   apartments,settings,
   readings:[
    {apartment_id:'a',measured_on:'2026-01-01',reading:100},
    {apartment_id:'b',measured_on:'2026-01-01',reading:500},
    {apartment_id:'a',measured_on:'2026-01-10',reading:99},
    {apartment_id:'b',measured_on:'2026-01-10',reading:510}
   ],tank:[{measured_on:'2026-01-01',centimeters:90},{measured_on:'2026-01-10',centimeters:80}],
   deliveries:[],payments:[],openings:[]
  });
  expect(result.periodCount).toBe(0);
  expect(result.excluded).toHaveLength(1);
  expect(result.accounts[0].estimated_cost_cents).toBe(0);
 });
 it('keeps all historic consumption settled and starts new estimates only after the frozen baseline',()=>{
  const result=calculateFuelAccounts({
   apartments,settings,settledThrough:'2026-01-10',
   readings:[
    {apartment_id:'a',measured_on:'2026-01-01',reading:100},
    {apartment_id:'b',measured_on:'2026-01-01',reading:100},
    {apartment_id:'a',measured_on:'2026-01-10',reading:110},
    {apartment_id:'b',measured_on:'2026-01-10',reading:120},
    {apartment_id:'a',measured_on:'2026-01-20',reading:120},
    {apartment_id:'b',measured_on:'2026-01-20',reading:130}
   ],
   tank:[{measured_on:'2026-01-01',centimeters:90},{measured_on:'2026-01-10',centimeters:80},{measured_on:'2026-01-20',centimeters:75}],
   deliveries:[],payments:[],openings:[]
  });
  expect(result.periodCount).toBe(1);
  expect(result.accounts[0].historical_periods).toHaveLength(1);
  expect(result.accounts[0].periods).toHaveLength(1);
  expect(result.accounts[0].historical_arrears_cents).toBe(0);
  expect(result.accounts[0].estimated_cost_cents).toBe(6667);
  expect(result.accounts[0].estimated_balance_cents).toBeNull();
 });
});