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
});
