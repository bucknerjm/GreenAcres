import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Response,Headers,Request,URL,TextEncoder,TextDecoder,crypto,console,Uint8Array,atob,btoa});
vm.runInContext(source.split('const dashboardAssets=')[0]+'\nglobalThis.api={repeatRule,repeatDue,repeatLabel,materialize,masterEvents,ensureRepeatColumn};',ctx);
const api=ctx.api;
const tail=source.split('const dashboardAssets=')[1];let assets;for(let i=tail.lastIndexOf('}');i>=0;i--)try{assets=JSON.parse(tail.slice(0,i+1));break}catch{}
const client=await import('data:text/javascript;base64,'+Buffer.from(assets['/repeat-schedule.js'].body).toString('base64'));
const cases=[
 [{unit:'day',interval:3,anchor:'2026-10-21'},['2026-10-21','2026-10-24','2026-11-02'],['2026-10-20','2026-10-22']],
 [{unit:'week',interval:2,anchor:'2026-10-19',weekdays:[1,3]},['2026-10-19','2026-10-21','2026-11-02','2026-11-04'],['2026-10-26','2026-10-28','2026-11-03']],
 [{unit:'month',interval:1,anchor:'2026-01-31',month_day:31},['2026-01-31','2026-02-28','2026-03-31','2026-04-30'],['2026-02-27','2026-03-28']],
 [{unit:'month',interval:2,anchor:'2026-01-31',month_day:'last'},['2026-01-31','2026-03-31','2026-05-31'],['2026-02-28','2026-04-30']],
 [{unit:'month',interval:1,anchor:'2028-01-31',month_day:'last'},['2028-02-29'],['2028-02-28']],
 [{unit:'year',interval:1,anchor:'2024-02-29'},['2025-02-28','2028-02-29'],['2028-02-28','2025-03-01']],
 [{unit:'year',interval:2,anchor:'2026-10-21'},['2028-10-21'],['2027-10-21']]
];
for(const [rule,yes,no] of cases)for(const side of [api,client]){const r=side.repeatRule(rule);for(const day of yes)assert(side.repeatDue(r,day),JSON.stringify({rule,day}));for(const day of no)assert(!side.repeatDue(r,day),JSON.stringify({rule,day}));}
for(const interval of [0,-1,1.5,366])assert.throws(()=>api.repeatRule({unit:'week',interval,anchor:'2026-10-21',weekdays:[3]}));
assert.throws(()=>api.repeatRule({unit:'week',interval:1,anchor:'2026-10-21',weekdays:[]}));
assert.throws(()=>api.repeatRule({unit:'month',interval:1,anchor:'2026-02-30',month_day:31}));
assert.equal(client.storedRepeat({start_date:'2026-10-01',weekdays:'[1,2,3,4,5]'}).unit,'week');
assert.equal(client.storedRepeat({anchor_date:'2026-10-16',interval_days:4}).interval,4);
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,active INTEGER);INSERT INTO users VALUES('ben',1);
CREATE TABLE task_templates(id TEXT PRIMARY KEY,title TEXT,active INTEGER,start_date TEXT,end_date TEXT,weekdays TEXT,instructions TEXT,room_id TEXT,assignee_id TEXT,assignee_ids_json TEXT);
CREATE TABLE tasks(id TEXT PRIMARY KEY,template_id TEXT,task_date TEXT,title TEXT,room_id TEXT,assignee_id TEXT,assignee_ids_json TEXT,instructions TEXT,updated_by TEXT);
CREATE TABLE audit_events(id TEXT PRIMARY KEY,actor_id TEXT,entity_type TEXT,entity_id TEXT,action TEXT,next_json TEXT);`);
function prepared(sql,params=[]){return {bind(...values){return prepared(sql,values)},async all(){return {results:sqlite.prepare(sql).all(...params)}},async run(){return sqlite.prepare(sql).run(...params)}}}
const db={prepare:sql=>prepared(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
await Promise.all([api.ensureRepeatColumn(db,'task_templates'),api.ensureRepeatColumn(db,'task_templates')]);
assert(sqlite.prepare('PRAGMA table_info(task_templates)').all().some(c=>c.name==='recurrence_json'));
const insert=sqlite.prepare('INSERT INTO task_templates VALUES(?,?,1,?,NULL,?,\'Instructions\',NULL,\'ben\',\'["ben"]\',?)');
insert.run('weekly','Biweekly task','2026-10-01','[0,1,2,3,4,5,6]',JSON.stringify({unit:'week',interval:2,anchor:'2026-10-19',weekdays:[3]}));
insert.run('monthly','Bimonthly task','2026-01-01','[0,1,2,3,4,5,6]',JSON.stringify({unit:'month',interval:2,anchor:'2026-01-31',month_day:'last'}));
insert.run('legacy','Original Tuesday task','2026-01-01','[2]',null);
for(const day of ['2026-10-21','2026-10-21','2026-10-28','2026-11-04','2026-03-31','2026-02-28','2026-10-20'])await api.materialize(db,day);
const dates=id=>sqlite.prepare('SELECT task_date FROM tasks WHERE template_id=? ORDER BY task_date').all(id).map(x=>x.task_date);
assert.deepEqual(dates('weekly'),['2026-10-21','2026-11-04']);
assert.deepEqual(dates('monthly'),['2026-03-31']);
assert.deepEqual(dates('legacy'),['2026-03-31','2026-10-20']);
assert.equal(sqlite.prepare('SELECT count(*) n FROM tasks').get().n,sqlite.prepare('SELECT count(*) n FROM audit_events').get().n);
const preserved=api.masterEvents([],[{id:'ipm',title:'IPM',anchor_date:'2026-10-16',interval_days:4,recurrence_json:JSON.stringify({unit:'month',interval:2,anchor:'2026-10-21',month_day:21})}],[{id:'ipm:2026-10-20',due_date:'2026-10-20',status:'completed',version:1}],'2026-12-31');
assert(preserved.some(e=>e.id==='ipm:2026-10-20'&&e.status==='completed'));
assert(preserved.some(e=>e.date==='2026-12-21'&&e.basis==='Every 2 months · day 21'));
assert(!preserved.some(e=>e.date==='2026-11-21'));
console.log('PASS: day/week/month/year intervals, leap years, short months, legacy timing, schema migration, real SQLite task generation, idempotency and completed history.');
