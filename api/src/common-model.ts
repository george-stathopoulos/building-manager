// One calculator per request: never share mutable settings between requests.
export function commonCalculator(enabled:boolean){
 const commonCredit=(code:string,gross:number)=>enabled&&code==='A3'?Math.min(1000,gross):0;
 return {commonCredit,netCommonDue:(code:string,gross:number)=>gross-commonCredit(code,gross)};
}
