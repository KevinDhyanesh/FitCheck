import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestApi} from '../public/api-client.mjs';
import {parseChart} from '../extract.mjs';

test('offline API errors explain how to restart the server', async () => {
  await assert.rejects(requestApi('import', {}, async () => { throw new TypeError('Failed to fetch'); }), /npm.cmd start/);
});
test('a static server response is distinguished from an unreadable chart', async () => {
  await assert.rejects(requestApi('import', {}, async () => ({json:async()=>{throw new SyntaxError();}})), /Fitcheck API/);
});
test('store connection errors survive the API wrapper', async () => {
  await assert.rejects(requestApi('import', {}, async () => ({ok:false,json:async()=>({error:'Store unavailable'})})), /Store unavailable/);
});
test('transposed charts retain sizes and measurements', () => {
  assert.deepEqual(parseChart('Size,S,M,L\nChest,100,106,112\nLength,68,71,74'), [
    {size:'S',chest:'100',length:'68'}, {size:'M',chest:'106',length:'71'}, {size:'L',chest:'112',length:'74'}
  ]);
});
test('sleeve length cannot overwrite garment length', () => {
  assert.deepEqual(parseChart('Size,Chest,Body_length,Sleeve_length\nS,100,68,22'), [{size:'S',chest:'100',length:'68'}]);
});
