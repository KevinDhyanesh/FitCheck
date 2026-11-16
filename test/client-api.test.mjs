import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseChart} from '../extract.mjs';
import {scoreSizes} from '../fit.mjs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function client(fetch) {
  const context=vm.createContext({parseChart,scoreSizes,fetch,AbortSignal});
  vm.runInContext(source.slice(source.indexOf('async function api('),source.indexOf('function store()')),context);
  return context.api;
}
test('photo text parses and scores even when the API is unavailable',async()=>{
  const api=client(()=>{throw new Error('Network unavailable');});
  const {chart}=await api('parse',{text:'Size,Chest\nS,98\nM,106',unit:'cm'});
  const {results}=await api('check',{profile:{chest:100},chart,category:'tops',basis:'garment',preference:'regular'});
  assert.equal(results[0].size,'M'); assert.equal(results[0].label,'Excellent fit');
});
test('network failure gives an actionable server error',async()=>{
  await assert.rejects(client(async()=>{throw new TypeError('Failed to fetch');})('import',{url:'https://example.com'}),/Cannot reach the Fitcheck server/);
});
test('static preview HTML gives an API configuration error',async()=>{
  await assert.rejects(client(async()=>({ok:true,json:async()=>{throw new SyntaxError();}}))('import',{}),/static preview/);
});
test('retailer failure preserves the specific server message',async()=>{
  await assert.rejects(client(async()=>({ok:false,status:400,json:async()=>({error:'The store blocked access.'})}))('import',{}),/store blocked/);
});
test('successful product import retains the actual chart',async()=>{
  const result={title:'Cotton tee',chart:[{size:'M',chest:'106'}]};
  assert.equal(await client(async()=>({ok:true,json:async()=>result}))('import',{}),result);
});

