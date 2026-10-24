import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Response,Headers,Request,URL,TextEncoder,TextDecoder,crypto,console,Uint8Array,atob,btoa});
vm.runInContext(source.split('const dashboardAssets=')[0]+'\nglobalThis.api={resolvedTaskConnection,defaultDateConnections,nextCropDates,calendarPhaseMove,calendarMovePatch,masterEvents,ensureCalendarMoveColumn,updateVersioned,shiftMasterDay};',ctx);const api=ctx.api;
const owner={id:'owner',role:'owner'},event={id:'ipm:2026-10-20',date:'2026-10-20',kind:'recurring',status:'blocked'},old={version:2,notes:'Original blocker'};
const request={version:2,from_date:'2026-10-20',target_date:'2026-10-22'};
assert.throws(()=>api.calendarMovePatch({id:'worker',role:'employee'},event,old,request),/Manager permission/);
assert.throws(()=>api.calendarMovePatch(owner,{...event,status:'completed'},old,request),/unfinished/);
assert.throws(()=>api.calendarMovePatch(owner,event,old,{...request,version:1}),/changed/);
assert.throws(()=>api.calendarMovePatch(owner,event,old,{...request,from_date:'2026-10-19'}),/changed/);
const patch=api.calendarMovePatch(owner,event,old,request);assert.equal(patch.rescheduled_date,'2026-10-22');assert.equal(patch.status,'blocked');assert.equal(patch.notes,'Original blocker');
const rules=[{id:'ipm',title:'Spray IPM — Veg and Mothers',anchor_date:'2026-10-20',interval_days:4}];
let events=api.masterEvents([],rules,[{id:event.id,...patch}],'2026-10-31');assert(!events.some(e=>e.date==='2026-10-20'));assert(events.some(e=>e.id===event.id&&e.date==='2026-10-22'));assert(events.some(e=>e.date==='2026-10-24'));
events=api.masterEvents([],rules,[{id:'ipm:2026-12-23',due_date:'2026-10-22',rescheduled_date:'2026-10-22',status:'open',version:1}],'2026-10-31');assert(events.some(e=>e.id==='ipm:2026-12-23'&&e.date==='2026-10-22'));
const plans=[{id:'crop',label:'North Crop',room_id:'north',dates:{flower:{planned:'2026-10-17'}}}];
events=api.masterEvents(plans,[],[{id:'crop:flower:63',due_date:'2026-12-30',rescheduled_date:'2026-12-30',status:'open',version:1},{id:'crop:flower:3',due_date:'2026-10-20',status:'completed',version:1}],'2027-01-31');
const day=id=>events.find(e=>e.id===id).date;assert.equal(day('crop:flower:63'),'2026-12-30');assert.equal(day('crop:flower:64'),'2026-12-31');assert.equal(day('crop:dry:0'),'2026-12-31');assert.equal(day('crop:dry:4'),'2027-01-04');assert.equal(day('crop:flower:69'),'2027-01-05');assert.equal(day('crop:flower:72'),'2027-01-08');assert.equal(day('crop:flower:3'),'2026-10-20');
const tail=source.split('const dashboardAssets=')[1];let assets;for(let i=tail.lastIndexOf('}');i>=0;i--)try{assets=JSON.parse(tail.slice(0,i+1));break}catch{}
const repeat='data:text/javascript;base64,'+Buffer.from(assets['/repeat-schedule.js'].body).toString('base64');
const ui=await import('data:text/javascript;base64,'+Buffer.from(assets['/master-calendar-ui.js'].body.replace('/repeat-schedule.js?v=__APP_VERSION__',repeat)).toString('base64'));
const calls=[];let save,fields,refreshes=0;const calendarEvent={id:'ipm:2026-10-20',date:'2026-10-20',title:'Spray IPM — Veg and Mothers',kind:'recurring',critical:true,status:'open',state_version:2};
const c={manager:true,user:{id:'owner',role:'owner',today:'2026-10-21'},day:'2026-10-21',users:[],roomName:()=>'',refresh:async()=>refreshes++,showEditor:(title,html,values,callback)=>{fields=html;save=callback},toast:()=>{},api:async(path,method,data)=>{if(method){calls.push(data);return data.preview?{target_date:data.target_date,token:'reviewed',changes:[{id:calendarEvent.id,title:calendarEvent.title,old_date:calendarEvent.date,new_date:data.target_date,primary:true}]}:{}}return path.startsWith('ops/master-calendar')?{events:[calendarEvent,{...calendarEvent,id:'done',status:'completed'},{...calendarEvent,id:'dry',kind:'dry'}],plans:[],rules:[],people:[],warnings:[],sources:[]}:{group:{label:'Crop',started_date:'2026-10-01'},snapshot:{trays:[],count:0}}}};
let html=await ui.render(c);assert.equal((html.match(/draggable="true"/g)||[]).length,1);c.manager=false;html=await ui.render(c);assert(!html.includes('draggable="true"'));c.manager=true;await ui.render(c);
const listeners={};const root={addEventListener:(name,fn)=>listeners[name]=fn,querySelectorAll:()=>[]};globalThis.document={querySelector:selector=>selector==='.master-calendar-months'?root:null};ui.bindCalendarDrag(c);
const chip={dataset:{masterEvent:calendarEvent.id}},cell={dataset:{masterDate:'2026-10-25'},classList:{add:()=>{},remove:()=>{}},contains:()=>false};
listeners.dragstart({target:{closest:()=>chip},dataTransfer:{setData:()=>{}}});let prevented=false;listeners.dragover({target:{closest:()=>cell},dataTransfer:{},preventDefault:()=>{prevented=true}});assert(prevented);
listeners.drop({target:{closest:()=>cell},preventDefault:()=>{},stopPropagation:()=>{}});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls.length,1);assert.equal(calls[0].preview,true);assert.match(fields,/Only this item changes/);assert.match(fields,/2026-10-25/);
await assert.rejects(()=>save({target_date:'2026-10-26'}),/updated date list/);await save({target_date:'2026-10-25'});assert.equal(calls[1].action,'move');assert.equal(calls[1].id,calendarEvent.id);assert.equal(calls[1].from_date,'2026-10-20');assert.equal(calls[1].target_date,'2026-10-25');assert.equal(calls[1].version,2);assert.equal(calls[1].preview_token,'reviewed');assert.equal(refreshes,1);
console.log('PASS: drag/drop confirmation and save payload, permissions, stale-edit protection, recurring occurrence overrides across month ranges, fixed completions and chop-dependent dates.');

const sqlite=new DatabaseSync(':memory:');sqlite.exec("CREATE TABLE master_task_states(id TEXT PRIMARY KEY,due_date TEXT,status TEXT,notes TEXT,version INTEGER,mutation_id TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,actor_id TEXT,entity_type TEXT,entity_id TEXT,action TEXT,previous_json TEXT,next_json TEXT);");
function statement(sql,params=[]){return {bind(...values){return statement(sql,values)},async all(){return {results:sqlite.prepare(sql).all(...params)}},async first(){return sqlite.prepare(sql).get(...params)||null},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}}}}}
const db={prepare:sql=>statement(sql),batch:async commands=>{sqlite.exec('BEGIN');try{const rows=[];for(const command of commands)rows.push(await command.run());sqlite.exec('COMMIT');return rows}catch(e){sqlite.exec('ROLLBACK');throw e}}};
await Promise.all([api.ensureCalendarMoveColumn(db),api.ensureCalendarMoveColumn(db)]);
sqlite.prepare('INSERT INTO master_task_states(id,due_date,status,notes,version) VALUES(?,?,?,?,?)').run(event.id,event.date,event.status,old.notes,old.version);
const stored=sqlite.prepare('SELECT * FROM master_task_states WHERE id=?').get(event.id);
const moved=await api.updateVersioned(db,owner,'master_task_states',stored,api.calendarMovePatch(owner,event,stored,request),'calendar_task_moved');assert.equal(moved.rescheduled_date,'2026-10-22');assert.equal(moved.version,3);assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,1);
await assert.rejects(()=>api.updateVersioned(db,owner,'master_task_states',stored,api.calendarMovePatch(owner,event,stored,request),'calendar_task_moved'),/changed/);assert.equal(sqlite.prepare('SELECT count(*) n FROM audit_events').get().n,1);
assert(api.masterEvents([],rules,sqlite.prepare('SELECT * FROM master_task_states').all(),'2026-10-31').some(e=>e.id===event.id&&e.date==='2026-10-22'));
const begin=source.indexOf('async function masterPlans('),end=source.indexOf('async function operationsRoutes(',begin);
const originalPlans=[{id:'a',label:'Crop A',room_id:'north',version:1,dates_json:JSON.stringify({flower:{actual:'2026-10-17'}})},{id:'b',label:'Crop B',room_id:'north',version:1,dates_json:JSON.stringify({flower:{planned:'2026-12-22'},layin:{planned:'2026-12-21'}})}];
const rows=new Map(originalPlans.map(p=>[p.id,p]));
const getPlans=new Function('db','all','manager','u','updateVersioned','create','today','shiftMasterDay','defaultGrowAssignee','nextCropDates','connections',source.slice(begin,end).replace(' const manager=manage(u);','')+';return options=>masterPlans(db,u,today,connections,options);')({},async(db,sql)=>sql.includes('master_crop_plans')?[...rows.values()].map(p=>({...p})):[{id:'a:flower:63',due_date:'2026-12-30',rescheduled_date:'2026-12-30',status:'open'}],true,owner,async(db,u,table,old,patch)=>{const row={...old,...patch,version:old.version+1};rows.set(row.id,row);return row},()=>{throw Error('Unexpected forecast creation')},'2026-10-21',api.shiftMasterDay,()=>null,api.nextCropDates,api.defaultDateConnections);
let result=await getPlans();assert.equal(result.find(p=>p.id==='b').dates.flower.planned,'2027-01-02');
const b=rows.get('b'),dates=JSON.parse(b.dates_json);dates.flower={planned:'2027-01-10',basis:'Moved on calendar from 2027-01-02'};dates.layin={planned:'2027-01-09',basis:'Day before Flower Day 0'};b.dates_json=JSON.stringify(dates);
result=await getPlans();assert.equal(result.find(p=>p.id==='b').dates.flower.planned,'2027-01-10');assert.equal(result.find(p=>p.id==='b').dates.layin.planned,'2027-01-09');
console.log('PASS: real SQLite migration, audited persistent move, concurrent-save rejection, following-crop recalculation and manual crop dates surviving refresh.');

// Preview uses the same dependency calculations without writing any plans.
const baseline=await getPlans(),snapshot=JSON.stringify([...rows.values()]);
const projected=await getPlans({plans:baseline,states:[{id:'a:flower:63',due_date:'2027-01-05',rescheduled_date:'2027-01-05',status:'open'}],preview:true});
assert.equal(JSON.stringify([...rows.values()]),snapshot);
assert.equal(projected.find(p=>p.id==='b').dates.flower.planned,'2027-01-10'); // manually pinned date
const unpinned=structuredClone(baseline);unpinned.find(p=>p.id==='b').dates={flower:{planned:'2027-01-02'},layin:{planned:'2027-01-01'}};
const movedPlans=await getPlans({plans:unpinned,states:[{id:'a:flower:63',due_date:'2027-01-05',rescheduled_date:'2027-01-05',status:'open'}],preview:true});
assert.equal(movedPlans.find(p=>p.id==='b').dates.flower.planned,'2027-01-08');assert.equal(JSON.stringify([...rows.values()]),snapshot);
const beginPreview=source.indexOf('    const before=masterEvents(plans,[],states,'),endPreview=source.indexOf("    if(event.kind==='phase'){\n     const plan=plans.find",beginPreview);
const previewFn=new (Object.getPrototypeOf(async function(){}).constructor)('plans','states','event','target','today','getPlans','masterEvents','shiftMasterDay','calendarMovePatch','calendarPhaseMove','u','b','num','fail','digest','json','id','from','connections','ensureTaskDeletion','ensureTaskConnections','visibleConnectedTasks','db','resolvedTaskConnection',source.slice(beginPreview,endPreview));
const chop=api.masterEvents(unpinned,[],[],'2027-12-31').find(e=>e.id==='a:flower:63');
const args=[unpinned,[],chop,'2027-01-05','2026-10-21',getPlans,api.masterEvents,api.shiftMasterDay,api.calendarMovePatch,api.calendarPhaseMove,owner,{preview:true,version:0,from_date:chop.date,target_date:'2027-01-05'},x=>x,message=>{throw Error(message)},async x=>x,x=>x,chop.id,chop.date,api.defaultDateConnections,async()=>{},async()=>{},async()=>[{id:'independent',title:'Inspect after chop',status:'open',connection_json:JSON.stringify({group_id:'a',source:'m63',days:1})}],{},api.resolvedTaskConnection];
const preview=await previewFn(...args);assert(preview.changes.some(e=>e.id==='independent:independent'&&e.new_date==='2027-01-06'));assert(preview.changes.some(e=>e.id==='a:flower:64'&&e.new_date==='2027-01-06'));assert(preview.changes.some(e=>e.id==='b:phase:flower'&&e.new_date==='2027-01-08'));assert(preview.changes.some(e=>e.kind==='dry'||e.id==='a:dry:0'));
args[11]={...args[11],preview:false,preview_token:'stale'};await assert.rejects(()=>previewFn(...args),/Connected dates changed/);
console.log('PASS: preview lists downstream crop and drying dates, does not write, respects manual pins, and rejects unreviewed saves.');
