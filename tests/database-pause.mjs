import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const context=vm.createContext({Response,Headers,Request,URL,TextEncoder,TextDecoder,crypto,console,Uint8Array,atob,btoa});
vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
let calls=0;
const DB=new Proxy({},{get(){calls++;throw Error('Database touched while paused');}});
for(const DATABASE_ACCESS of [undefined,'disabled','false','ENABLED']){
 for(const path of ['/','/login','/api/me','/api/tasks','/api/auth/login']){
  const r=await context.worker.fetch(new Request('https://example.com'+path),{DB,DATABASE_ACCESS});
  assert.equal(r.status,503);
  assert.equal((await r.json()).code,'DATABASE_PAUSED');
 }
 context.worker.scheduled({},{DB,DATABASE_ACCESS,SCHEDULED_WORK:'enabled'},{});
}
assert.equal((await context.worker.fetch(new Request('https://example.com'),{DATABASE_ACCESS:'enabled'})).status,503);
context.worker.scheduled({},{DB,DATABASE_ACCESS:'enabled',SCHEDULED_WORK:'disabled'},{});
assert.equal(calls,0);
const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
assert.deepEqual(config.d1_databases,[{binding:'DB',database_name:'green-acres-db',database_id:'104cf1b5-8bcd-4038-87ac-74e04f68efeb'}]);
assert.deepEqual(config.triggers.crons,[]);
console.log('PASS: paused routes and disabled schedules make zero database calls; deployment config uses the existing database and keeps cron disabled.');
