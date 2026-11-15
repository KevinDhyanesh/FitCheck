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
test('rejects non-HTTPS product links', async () => {
  const r=await request('/api/import',{url:'http://example.com/product'});
  assert.equal(r.status,400); assert.match(r.payload,/HTTPS/);
});
