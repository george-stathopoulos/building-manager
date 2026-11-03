export type Allocation = { apartment: string; cents: number };
export function allocateCents(total: number, apartments: { apartment: string; weight: number }[]): Allocation[] {
  if (!Number.isSafeInteger(total) || total < 0) throw Error('Μη έγκυρο ποσό');
  if (!apartments.length || apartments.some(a => !Number.isFinite(a.weight) || a.weight <= 0)) throw Error('Μη έγκυρα ποσοστά');
  const sum = apartments.reduce((s,a) => s + a.weight, 0);
  const exact = apartments.map(a => total * a.weight / sum);
  const amounts = exact.map(Math.floor);
  let remainder = total - amounts.reduce((s,a) => s+a,0);
  const order = exact.map((v,i) => ({i, fraction:v-Math.floor(v)})).sort((a,b) => b.fraction-a.fraction || a.i-b.i);
  for (let i=0; i<remainder; i++) amounts[order[i].i]++;
  return apartments.map((a,i) => ({ apartment:a.apartment, cents:amounts[i] }));
}
export const money = (cents:number) => new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(cents/100);
