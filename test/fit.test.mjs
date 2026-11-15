import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSizes } from '../fit.mjs';
import { parseChart, extractProduct } from '../extract.mjs';
test('a balanced top outranks a tight top', () => {
  const r = scoreSizes({chest:100,shoulder:44,length:71},[{size:'S',chest:98,shoulder:42,length:68},{size:'M',chest:106,shoulder:46,length:71}]);
  assert.equal(r[0].size,'M'); assert.equal(r[0].label,'Excellent fit'); assert.ok(r[1].score < 55);
});
test('body ranges and garment ease use separate interpretations', () => {
  const p = {waist:86,hip:100}; const chart = [{size:'M',waist:'84-88',hip:'98-102'}];
  assert.equal(scoreSizes(p,chart,{category:'bottoms',basis:'body'})[0].score,100);
});
test('no shared measurements gives no fabricated rating', () => {
  assert.equal(scoreSizes({height:180},[{size:'L',chest:110}])[0].score,null);
});
test('severely tight waist prevents a recommendation despite good hips', () => {
  const r = scoreSizes({waist:92,hip:100},[{size:'M',waist:80,hip:106}],{category:'bottoms'});
  assert.ok(r[0].score < 30);
});
test('inch tables and ranges convert to centimetres', () => {
  assert.deepEqual(parseChart('Size,Waist,Hip\nM,32-34,40', 'in'),[{size:'M',waist:'81.3-86.4',hip:'101.6'}]);
});
test('extracts actual HTML tables and metadata', () => {
  const p = extractProduct('<meta property="og:title" content="Cotton Tee"><table><tr><th>Size</th><th>Chest (cm)</th></tr><tr><td>M</td><td>106</td></tr></table>','https://example.com/item');
  assert.equal(p.title,'Cotton Tee'); assert.equal(p.chart[0].chest,'106');
});
test('dual-unit tables require manual review rather than ambiguous conversion', () => {
  const p = extractProduct('<table><tr><th>Size</th><th>Chest cm / inches</th></tr><tr><td>M</td><td>106 / 41.7</td></tr></table>','https://example.com');
  assert.equal(p.chart.length,0);
});
