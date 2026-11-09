import {describe,it,expect} from 'vitest';
import {calculateFuelAccounts} from './fuel-model';

describe('fuel inventory costing',()=>{
 const base={apartments:[{id:'a',code:'A1',heating_share_bp:10000}],readings:[{apartment_id:'a',measured_on:'2026-01-01',reading:0},{apartment_id:'a',measured_on:'2026-02-01',reading:10}],tank:[{measured_on:'2026-01-01',centimeters:15},{measured_on:'2026-02-01',centimeters:20}],payments:[],openings:[],settings:{liters_per_cm:20,price_cents_per_liter:100},settledThrough:'2025-12-31'};
 it('uses the weighted average of initial inventory and actual new delivery',()=>{
  const r=calculateFuelAccounts({...base,deliveries:[{delivered_on:'2026-01-15',liters:500,cost_cents:65000}]});
  // Initial 300L at €1 plus 500L at €1.30 = 800L costing €950; 400L consumed.
  expect(r.accounts[0].periods[0].liters).toBe(400);
  expect(r.accounts[0].periods[0].cost_cents).toBe(47500);
 });
 it('does not use the baseline price for a priced delivery',()=>{
  const r=calculateFuelAccounts({...base,settings:{liters_per_cm:20,price_cents_per_liter:80},deliveries:[{delivered_on:'2026-01-15',liters:500,cost_cents:65000}]});
  expect(r.accounts[0].periods[0].cost_cents).toBe(44500);
 });
 it('values remaining credit using weighted inventory after mixed-price refill',()=>{
  const r=calculateFuelAccounts({...base,deliveries:[{delivered_on:'2026-01-15',liters:500,cost_cents:73500}],openings:[{apartment_id:'a',as_of:'2025-12-31',deposited_cents:5967,estimated_consumed_cents:0,note:'carry forward'}],payments:[{apartment_id:'a',paid_on:'2026-01-20',amount_cents:25000}]});
  // 300 L at €1 + 500 L at €1.47 => €1035/800 L = €1.29375/L.
  // 400 L consumed leaves 400 L at the same weighted unit price.
  expect(r.inventory_price_cents_per_liter).toBeCloseTo(129.375,3);
  expect(r.accounts[0].deposits_cents).toBe(30967);
  expect(r.accounts[0].estimated_balance_cents).toBe(0); // consumption exceeds credit
 });
 it('keeps historical credit and adds new deposit without converting either to fixed liters',()=>{
  const r=calculateFuelAccounts({...base,tank:[{measured_on:'2026-01-01',centimeters:15}],readings:[],deliveries:[],openings:[{apartment_id:'a',as_of:'2025-12-31',deposited_cents:50000,estimated_consumed_cents:44033,note:'historical'}],payments:[{apartment_id:'a',paid_on:'2026-01-15',amount_cents:25000}]});
  expect(r.accounts[0].estimated_balance_cents).toBe(30967);
 });
});
