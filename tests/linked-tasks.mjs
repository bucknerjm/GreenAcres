import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const ctx=vm.createContext({Response,Headers,Request,URL,TextEncoder,TextDecoder,crypto,console,Uint8Array,atob,btoa});
vm.runInContext(source.split('const dashboardAssets=')[0]+'\nglobalThis.a={defaultDateConnections,validatedDateConnections,connectedCropDates,masterEvents,calendarMovePatch};',ctx);const a=ctx.a;
const defaults=JSON.parse(JSON.stringify(a.defaultDateConnections)),crop={id:'crop',label:'Crop One',room_id:'north',assignee_id:'ben',dates:{flower:{planned:'2026-10-20'},clone:{actual:'2026-10-01'}}},other={...crop,id:'other',label:'Crop Two'};
const custom={id:'custom_inspect',title:'Inspect after spray',source:'m3',days:2,group_id:'crop',instructions:'Check leaves'},follow={id:'custom_follow',title:'Second check',source:custom.id,days:1,group_id:'crop'};
const rules=a.validatedDateConnections([...defaults,custom,follow]);let events=a.masterEvents([crop,other],[],[],'2027-12-31',rules);
const id='crop:linked:custom_inspect';assert.equal(events.find(e=>e.id===id).date,'2026-10-25');assert.equal(events.find(e=>e.id===id).assignee_id,'ben');assert.equal(events.find(e=>e.id===id).instructions,'Check leaves');assert(!events.some(e=>e.id==='other:linked:custom_inspect'));
let states=[{id:'crop:flower:3',rescheduled_date:'2026-10-26',due_date:'2026-10-26',status:'open'}];events=a.masterEvents([crop],[],states,'2027-12-31',rules);assert.equal(events.find(e=>e.id===id).date,'2026-10-28');assert.equal(events.find(e=>e.connection_id===follow.id).date,'2026-10-29');
states.push({id,status:'completed',due_date:'2026-10-25'});events=a.masterEvents([crop],[],states,'2027-12-31',rules);assert.equal(events.find(e=>e.id===id).date,'2026-10-25');assert.equal(events.find(e=>e.connection_id===follow.id).date,'2026-10-26');
const allRules=a.validatedDateConnections([...defaults,{...custom,group_id:null}]);assert.equal(a.masterEvents([crop,other],[],[],'2027-12-31',allRules).filter(e=>e.connection_id===custom.id).length,2);
const cloneRules=a.validatedDateConnections([...defaults,{...custom,source:'clone',days:21}]);assert.equal(a.masterEvents([{...crop,dates:{clone:{actual:'2026-10-01'}}}],[],[],'2027-12-31',cloneRules).find(e=>e.connection_id===custom.id).date,'2026-10-22');
assert.throws(()=>a.validatedDateConnections([...defaults,custom,{...follow,group_id:null}]),/Invalid source/);
assert.throws(()=>a.validatedDateConnections([...defaults,{...custom,source:follow.id},follow]),/cycle/);
// Exercise linked-task creation action with the same versioned persistence used in production.
const begin=source.indexOf("   if(action==='linked_task'){");const end=source.indexOf("   if(action==='connections'){",begin);const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('b','connectionVersion','connectionRow','connections','needManager','num','fail','text','one','all','db','validatedDateConnections','connectedCropDates','uuid','updateVersioned','create','json','u',"const action='linked_task';"+source.slice(begin,end));
const fail=message=>{throw Error(message)},text=x=>x,one=async()=>({...crop,dates_json:JSON.stringify(crop.dates)});let write;const args=[{title:'Inspect',source:'m3',days:2,group_id:'crop',version:0},0,null,defaults,()=>{},x=>Number(x),fail,text,one,async()=>[],{},a.validatedDateConnections,a.connectedCropDates,()=> 'new-id',async()=>{},async(...params)=>{write=params;return params[3]},x=>x,{id:'owner'}];
await run(...args);assert.equal(write[2],'master_date_connections');assert(JSON.parse(write[3].rules_json).some(r=>r.id==='custom_new-id'&&r.title==='Inspect'));
await assert.rejects(()=>run(...args.map((x,i)=>i===0?{...x,version:2}:x)),/changed/);
await assert.rejects(()=>run(...args.map((x,i)=>i===4?()=>fail('Manager permission required'):x)),/Manager/);
await assert.rejects(()=>run(...args.map((x,i)=>i===0?{...x,source:'veg'}:x)),/no date/);
// Check Add task editor sends the appropriate action for relative versus independent dates.
const tail=source.split('const dashboardAssets=')[1];let assets;for(let i=tail.lastIndexOf('}');i>=0;i--)try{assets=JSON.parse(tail.slice(0,i+1));break}catch{}
const repeat='data:text/javascript;base64,'+Buffer.from(assets['/repeat-schedule.js'].body).toString('base64');const ui=await import('data:text/javascript;base64,'+Buffer.from(assets['/master-calendar-ui.js'].body.replace('/repeat-schedule.js?v=__APP_VERSION__',repeat)).toString('base64'));
let save,fields,sent;globalThis.document={getElementById:()=>null};const c={day:'2026-10-21',user:{id:'owner',role:'owner',today:'2026-10-21'},users:[],manager:true,roomName:()=>'',refresh:async()=>{},toast:()=>{},showEditor:(title,html,values,callback)=>{fields=html;save=callback},api:async(path,method,data)=>{if(method){sent={path,data};return {}}return path.startsWith('ops/master-calendar')?{events:[],plans:[crop],rules:[],warnings:[],people:[],sources:[],connections:defaults,connection_version:0}:{group:{label:'Crop',started_date:'2026-10-01'},snapshot:{trays:[],count:0}}}};
await ui.newTask(c);assert.match(fields,/Schedule relative to another task/);assert.match(fields,/Source task/);assert.match(fields,/Every crop/);await save({schedule_mode:'relative',title:'Inspect',group_id:'crop',source:'m3',days:'2',instructions:'Check'});assert.equal(sent.data.action,'linked_task');assert.equal(sent.data.days,2);assert.equal(sent.data.group_id,'crop');await save({schedule_mode:'date',title:'Other work',task_date:'2026-10-22'});assert.equal(sent.path,'tasks');assert.equal(sent.data.task_date,'2026-10-22');
console.log('PASS: add linked and fixed-date tasks, one/all-crop scope, custom chains, clone-stage sources, source rescheduling, fixed completions, inherited assignees, permissions, stale saves and missing-source-date rejection.');
