import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleRequest } from '../server.mjs';

async function request(url, body, extraHeaders = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req,{url,method:body === undefined ? 'GET' : 'POST', headers:{host:'localhost:3000',...extraHeaders}});
  let status, payload;
  await handleRequest(req,{writeHead(code){status=code;},end(data){payload=String(data);}});
  return {status,payload};
}
test('homepage serves the application', async () => {
  const r=await request('/'); assert.equal(r.status,200); assert.match(r.payload,/Your measurements/);
});
test('chart parsing and fit comparison work through request handlers', async () => {
  const parsed=await request('/api/parse',{text:'Size,Chest,Shoulder,Length\nM,106,46,71',unit:'cm'});
  const {chart}=JSON.parse(parsed.payload);
  const r=await request('/api/check',{profile:{chest:100,shoulder:44,length:71},chart,category:'tops',basis:'garment',preference:'regular'});
  assert.equal(r.status,200); assert.equal(JSON.parse(r.payload).results[0].label,'Excellent fit');
});
test('rejects private product URLs before making an outbound request', async () => {
  const r=await request('/api/import',{url:'https://127.0.0.1'});
  assert.equal(r.status,400); assert.match(r.payload,/cannot be imported/);
});
test('rejects requests from a different origin', async () => {
  const r=await request('/api/parse',{text:''},{origin:'https://unrelated.example'});
  assert.equal(r.status,403);
});
test('accepts same-host HTTPS origin behind a TLS proxy', async () => {
  const r=await request('/api/parse',{text:'Size,Chest\nM,106'},{host:'fitcheck.example',origin:'https://fitcheck.example'});
  assert.equal(r.status,200); assert.equal(JSON.parse(r.payload).chart[0].chest,'106');
});
test('rejects HTTPS origin with a different port', async () => {
  const r=await request('/api/parse',{text:''},{host:'fitcheck.example',origin:'https://fitcheck.example:8443'});
  assert.equal(r.status,403);
});
test('serves the shared parsing and scoring modules to the browser', async () => {
  for (const path of ['/extract.mjs','/fit.mjs']) {
    const r=await request(path); assert.equal(r.status,200); assert.match(r.payload,/export /);
  }
});
test('chart recovery editor is visible from the start', async () => {
  const r=await request('/'); assert.match(r.payload,/<div id="chart-details">/);
});
test('rejects non-HTTPS product links', async () => {
  const r=await request('/api/import',{url:'http://example.com/product'});
  assert.equal(r.status,400); assert.match(r.payload,/HTTPS/);
});


