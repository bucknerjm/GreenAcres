import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const tail=fs.readFileSync('worker.js','utf8').split('const dashboardAssets=')[1];let assets;for(let i=tail.lastIndexOf('}');i>=0;i--){try{assets=JSON.parse(tail.slice(0,i+1));break;}catch{}}
const source=assets['/operations-ui.js'].body,fn=source.slice(source.indexOf('function cloneDrinkDown('),source.indexOf('function cloneReadingRows('));const ctx={};vm.createContext(ctx);vm.runInContext(fn,ctx);
const rec=(record_date,tray)=>({record_date,data:{tray}});const calc=(previous,current)=>ctx.cloneDrinkDown([rec('2026-10-22',previous),rec('2026-10-23',current)],'2026-10-23')?.grams;
assert.equal(calc({before_g:1177,after_g:1738},{before_g:1430}),308);
assert.equal(calc({before_g:1453},{before_g:1177,after_g:1738}),276);
assert.equal(calc({weight_g:1500},{weight_g:1400}),100);
assert.equal(calc({after_g:0},{before_g:0}),0);
assert.equal(calc({after_g:1200},{before_g:1300}),-100);
assert.equal(calc({after_g:1500},{after_g:1700}),undefined);
assert.equal(calc({},{before_g:1200}),undefined);
assert.equal(ctx.cloneDrinkDown([rec('2026-10-21',{after_g:1738}),rec('2026-10-23',{before_g:1430})],'2026-10-23'),null);
assert.equal(calc({after_g:1500.25},{before_g:1400.1}),100.15);
console.log('PASS: fed and unfed days, tray-weight fallback, zero, negative changes, missing readings, date gaps and decimals.');
