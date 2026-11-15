import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseChart} from '../extract.mjs';
import {scoreSizes} from '../fit.mjs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const context=vm.createContext({document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}})})}});
vm.runInContext(source.slice(source.indexOf('function photoTableFromWords'),source.indexOf('function normalizePhotoTable')),context);
const word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+70,y1:y+50}});
test('numeric cell rereading recovers letters and falls back without replacing correct decimals',async()=>{
 let mode;let calls=0;
 const worker={setParameters:async p=>{mode=p.tessedit_pageseg_mode??mode;},recognize:async()=>{calls++;return {data:{text:mode==='13'?'':'31'}};}};
 const words=[word('SIZE',0,0),word('LENGTH',500,0),word('il',500,100),word('31.5',500,200)];
 const result=await context.rereadNumericCells(worker,{},words);
 assert.equal(result[2].text,'31');assert.equal(result[3].text,'31.5');assert.equal(calls,2);
});
test('recovered photo positions retain every size and convert inches before scoring',()=>{
 const words=[word('SIZE',0,0),word('CHEST',500,0),word('LENGTH',800,0),word('SLEEVE',1100,0)];
 const sizes=['S','M','L','XL','XXL'];
 const chest=[45,47,50,52,54],length=[29,30,30.5,31,31.5];
 sizes.forEach((size,i)=>words.push(word(size,0,100+i*100),word(String(chest[i]),500,100+i*100),word(String(length[i]),800,100+i*100),word('9',1100,100+i*100)));
 const chart=parseChart(context.photoTableFromWords(words),'in');
 assert.deepEqual(chart.map(r=>r.size),sizes);
 assert.deepEqual(chart.map(r=>r.chest),['114.3','119.4','127','132.1','137.2']);
 assert.equal(context.completePhotoSizes(chart,new Set(sizes)),true);
 const results=scoreSizes({chest:98},chart);assert.equal(results[0].size,'S');assert.equal(results[0].score,62);
});
test('missing observed sizes cannot silently produce a recommendation',()=>{
 assert.equal(context.completePhotoSizes([{size:'L'},{size:'XXL'}],new Set(['S','M','L','XL','XXL'])),false);
});
