import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
describe('installed PWA identity',()=>{
 it('keeps the original installed names stable',()=>{
  expect(manifest.name).toBe('Διαχείριση Πολυκατοικίας');
  expect(manifest.short_name).toBe('Πολυκατοικία');
 });
 it('uses the legacy start URL as its explicit ID without changing launch or scope',()=>{
  const origin='https://george-stathopoulos.github.io';
  expect(manifest.start_url).toBe('/building-manager/');
  expect(manifest.scope).toBe('/building-manager/');
  expect(new URL(manifest.id,origin).href).toBe(new URL(manifest.start_url,origin).href);
 });
 it('preserves the currently deployed icon descriptor',()=>{
  expect(manifest.icons).toEqual([{src:'icon.svg?v=2',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]);
 });
});
