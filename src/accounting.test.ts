import { describe, expect, it } from 'vitest';
import {allocateCents} from './accounting';
describe('Κατανομή κοινοχρήστων',()=>{
 it('διατηρεί το συνολικό ποσό',()=>{const a=allocateCents(10001,[{apartment:'A1',weight:1},{apartment:'A2',weight:1},{apartment:'A3',weight:1}]);expect(a.map(x=>x.cents)).toEqual([3334,3334,3333]);});
 it('υποστηρίζει βάρη',()=>{expect(allocateCents(100,[{apartment:'A1',weight:3},{apartment:'A2',weight:1}]).map(x=>x.cents)).toEqual([75,25]);});
 it('απορρίπτει εσφαλμένα ποσά',()=>expect(()=>allocateCents(-10,[{apartment:'A1',weight:1}])).toThrow());
});
