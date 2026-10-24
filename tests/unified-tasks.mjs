import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const tail=source.split('const dashboardAssets=')[1];
let assets;for(let i=tail.lastIndexOf('}');i>=0;i--){try{assets=JSON.parse(tail.slice(0,i+1));break;}catch{}}
assert(assets,'Embedded frontend assets must parse');
const repeatURL='data:text/javascript;base64,'+Buffer.from(assets['/repeat-schedule.js'].body).toString('base64');
const master=assets['/master-calendar-ui.js'].body.replace('/repeat-schedule.js?v=__APP_VERSION__',repeatURL);
const {today,click}=await import('data:text/javascript;base64,'+Buffer.from(master).toString('base64'));
assert.match(assets['/app.js'].body,/masterUI.today\(\{\.\.\.operationsContext\(\),tasks:manager\(\)\?tasks:visible,taskTable/);
assert.doesNotMatch(assets['/app.js'].body,/growStatus\(operationsContext\(\)\)\+overdueTaskGroups/);

const events=[{id:'r:2026-10-20',kind:'recurring',rule_id:'r',date:'2026-10-20',title:'IPM',basis:'Every 4 days',status:'open',assignee_id:'ben'}, {id:'done',kind:'milestone',date:'2026-10-21',title:'Completed scheduled work',status:'completed'}, {id:'future',kind:'milestone',date:'2026-11-20',title:'Outside window'}, {id:'dry',kind:'dry',date:'2026-10-21',title:'Drying'}];
let rows,editor,save,posted,refreshes=0;
const c={day:'2026-10-21',manager:true,user:{id:'owner'},users:[],tasks:[{id:'manual',title:'Daily task',task_date:'2026-10-21',status:'open'}],includeGrow:false,roomName:()=>'',taskTable:r=>{rows=r;return '<table>'+r.map(x=>x.master_row||x.title).join('')+'</table>';},api:async(path,method,data)=>{if(method){posted=data;return {}}return path.startsWith('ops/master-calendar')?{events,plans:[],rules:[{id:'r',title:'IPM',interval_days:4,anchor_date:'2026-10-16',version:3}],warnings:[],people:[{id:'ben',display_name:'Ben'}]}:{};},refresh:async()=>{refreshes++},toast:()=>{},showEditor:(title,fields,values,callback)=>{editor=fields;save=callback}};
let html=await today(c);
assert.equal((html.match(/<table>/g)||[]).length,1);assert.deepEqual(rows.map(r=>r.id),['r:2026-10-20','manual']);assert.match(html,/data-master-rule="r"/);assert.match(html,/data-master-task/);assert.match(html,/data-master-assign/);assert.match(html,/overdue/);assert.doesNotMatch(html,/Next work across|Daily checklist/);
await click({hasAttribute:n=>n==='data-show-completed-tasks'},c);await today(c);assert(rows.some(r=>r.id==='done'));assert(!rows.some(r=>r.id==='future'||r.id==='dry'));
await click({hasAttribute:()=>false,dataset:{masterRule:'r'}},c);assert.match(editor,/repeat_interval/);await save({repeat_unit:'week',repeat_interval:'2',repeat_anchor:'2026-10-22',repeat_days:[4]});assert.deepEqual(posted,{title:'IPM',recurrence:{unit:'week',interval:2,anchor:'2026-10-22',weekdays:[4]},action:'rule',id:'r',version:3});assert.equal(refreshes,2);
console.log('Unified task table: mixed work, sorting, controls, completed toggle and repeat save passed');
c.user.role='manager';assert.doesNotMatch(await today(c),/data-delete-overdue/);
c.user.role='employee';assert.doesNotMatch(await today(c),/data-delete-overdue/);
c.user.role='owner';assert.match(await today(c),/data-delete-overdue/);
console.log('PASS: only the owner sees the overdue deletion button.');

// Calendar checklist projections must not duplicate the saved task on Today.
const cloneTask={id:'daily:clones:2026-10-23',title:'Clones — weigh, rotate, and feed as needed',task_date:'2026-10-23',priority:'routine',status:'open',template_id:'clones',assignee_id:'ben'};
c.day='2026-10-23';c.tasks=[cloneTask];events.push({...cloneTask,id:'checklist:'+cloneTask.id,task_id:cloneTask.id,kind:'checklist',date:cloneTask.task_date},{...cloneTask,id:'checklist:tomorrow',task_id:'tomorrow',date:'2026-10-24',kind:'checklist',status:'completed'});
await today(c);assert.equal(rows.filter(r=>r.title===cloneTask.title&&r.task_date===cloneTask.task_date).length,1);const shown=rows.find(r=>r.id===cloneTask.id);assert.equal(shown.priority,'routine');assert.equal(shown.status,'open');assert.equal(shown.master_row,undefined);assert(rows.some(r=>r.id==='tomorrow'&&r.status==='completed'&&!r.master_row));
c.tasks=[{...cloneTask,status:'completed'}];await today(c);assert.equal(rows.filter(r=>r.id===cloneTask.id).length,1);assert.equal(rows.find(r=>r.id===cloneTask.id).status,'completed');
console.log('PASS: saved checklist and calendar copy display once on Today, saved routine priority/status retained, completion not reset, future checklist remains visible with ordinary task controls.');
