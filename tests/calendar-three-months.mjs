import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8'),tail=source.split('const dashboardAssets=')[1];let assets;for(let i=tail.lastIndexOf('}');i>=0;i--)try{assets=JSON.parse(tail.slice(0,i+1));break}catch{}
const repeat='data:text/javascript;base64,'+Buffer.from(assets['/repeat-schedule.js'].body).toString('base64');
const code=assets['/master-calendar-ui.js'].body.replace('/repeat-schedule.js?v=__APP_VERSION__',repeat);
const ui=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const preferences=new Map();globalThis.localStorage={getItem:key=>preferences.get(key),setItem:(key,value)=>preferences.set(key,value)};
const requested=[];let selected;
const c={day:'2026-12-15',user:{id:'owner',today:'2026-12-15',role:'owner'},users:[],manager:false,roomName:()=>'',refresh:async()=>{},setDay:async day=>{selected=day;c.day=day},api:async path=>{requested.push(path);return path.startsWith('ops/master-calendar')?{events:[{id:'feb',title:'Third-month work',kind:'milestone',date:'2027-02-12',status:'open'}],plans:[],rules:[],warnings:[],people:[],sources:[]}:{group:{label:'Crop',started_date:'2026-12-01'},snapshot:{trays:[],count:0}}}};
let html=await ui.render(c);assert.equal((html.match(/class="master-month-panel"/g)||[]).length,1);
await ui.click({dataset:{calendarView:'3'},hasAttribute:()=>false},c);html=await ui.render(c);
assert.equal((html.match(/class="master-month-panel"/g)||[]).length,3);
assert.match(html,/December 2026/);assert.match(html,/January 2027/);assert.match(html,/February 2027/);assert.match(html,/Third-month work/);
assert.equal((html.match(/data-master-date=/g)||[]).length,90);assert(requested.some(path=>path.includes('month=2026-12&months=3')));
await ui.click({dataset:{masterMonth:'1'},hasAttribute:()=>false},c);html=await ui.render(c);assert.match(html,/January 2027/);assert.match(html,/March 2027/);assert(!html.includes('December 2026'));assert.match(html,/data-master-month="-1"/);assert.match(html,/data-master-month="1"/);
await ui.click({dataset:{masterMonth:'-1'},hasAttribute:()=>false},c);
globalThis.document={getElementById:()=>null};await ui.click({dataset:{masterDate:'2027-02-12'},hasAttribute:()=>false},c);assert.equal(selected,'2027-02-12');html=await ui.render(c);assert.match(html,/Third-month work/);assert.match(html,/February 2027/);
await ui.click({dataset:{calendarView:'1'},hasAttribute:()=>false},c);html=await ui.render(c);assert.equal((html.match(/class="master-month-panel"/g)||[]).length,1);
const rangeLine=source.split('\n').find(line=>line.includes("const url=new URL(req.url),day=date(url.searchParams.get('date')||today),month="));assert(rangeLine);
const range=new Function('req','today','date','choice','shiftMasterDay',rangeLine+';return through;');
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),choice=(x,options)=>{if(!options.includes(x))throw Error('Invalid range');return x};
assert.equal(range(new Request('https://example.com/?date=2027-12-01&month=2027-12&months=3'),'2027-12-01',x=>x,choice,shift),'2028-02-29');
assert.throws(()=>range(new Request('https://example.com/?date=2027-12-01&month=2027-12&months=5'),'2027-12-01',x=>x,choice,shift),/Invalid range/);
console.log('PASS: one/three-month toggle, saved preference, year rollover, all day cells, third-month events, navigation, day selection, leap-year API coverage and range validation.');

c.today=()=> '2027-04-09';await ui.goToday(c);assert.equal(selected,'2027-04-09');html=await ui.render(c);assert.match(html,/April 2027/);assert(requested.some(path=>path.includes('date=2027-04-09&month=2027-04')));console.log('PASS: Today uses the current facility date and resets the calendar month and date selector together.');
// Checklist tasks share the calendar display and Show tasks toggle without unsafe crop-drag actions.
const checklistContext={...c,manager:true,api:async path=>path.startsWith('ops/master-calendar')?{events:[{id:'checklist:test',task_id:'test',title:'Mix nutrients',kind:'checklist',date:'2027-04-09',status:'open',assignee_id:'owner'}],plans:[],rules:[],warnings:[],people:[],sources:[]}:{group:{label:'Crop',started_date:'2026-12-01'},snapshot:{trays:[],count:0}}};
html=await ui.render(checklistContext);assert.match(html,/Mix nutrients/);assert.match(html,/Open task list/);assert(!html.includes('data-master-task="checklist:test"'));assert(!html.includes('data-master-event="checklist:test"'));
await ui.click({dataset:{},hasAttribute:n=>n==='data-calendar-tasks'},checklistContext);html=await ui.render(checklistContext);assert(!html.includes('Mix nutrients'));
assert.match(source,/for\(const task of checklist\)events.push/);
console.log('PASS: checklist tasks appear by due date with full titles, use ordinary task actions, obey Show tasks, and are excluded from crop drag handling.');
// Completed tasks are hidden by default but can be reviewed without hiding actual crop phase dates.
preferences.set('green-acres-calendar-tasks:owner','on');const completionContext={...checklistContext,api:async path=>path.startsWith('ops/master-calendar')?{events:[{id:'done',title:'Finished checklist',kind:'checklist',date:'2027-04-09',status:'completed'},{id:'phase',title:'Actual Flower start',kind:'phase',phase:'flower',date:'2027-04-09',status:'completed',group_id:'crop'}],plans:[],rules:[],warnings:[],people:[],sources:[]}:{group:{label:'Crop',started_date:'2026-12-01'},snapshot:{trays:[],count:0}}};
html=await ui.render(completionContext);assert(!html.includes('Finished checklist'));assert.match(html,/Actual Flower start/);assert.match(html,/Show completed: Off/);await ui.click({dataset:{},hasAttribute:n=>n==='data-calendar-completed'},completionContext);html=await ui.render(completionContext);assert.match(html,/Finished checklist/);assert.match(html,/Show completed: On/);assert.equal(preferences.get('green-acres-calendar-completed:owner'),'on');
console.log('PASS: calendar completed tasks hidden by default, review toggle persists, actual crop dates retained.');
