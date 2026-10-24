import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Code-only deployment. Do not use the shutdown Wrangler configuration to deploy.
// Cloudflare retains existing binding values server-side, including secrets.
export function deploymentMetadata(settings){
 const bindings=settings.bindings||[];
 if(!bindings.some(b=>b.type==='d1'&&b.name==='DB'))throw Error('Existing Green Acres DB binding is missing. No deployment performed. Existing binding names/types: '+bindings.map(b=>b.name+':'+b.type).join(', ')+'');
 if(bindings.some(b=>b.name==='SCHEDULED_WORK'&&b.text==='enabled'))throw Error('Scheduled work is enabled. Review this setting before automatic deployment.');
 const metadata={main_module:'worker.js',keep_bindings:[...new Set([...bindings.map(b=>b.type),'secret_text','plain_text'])],bindings:bindings.filter(b=>b.type!=='secret_text').map(b=>b.type==='d1'?{type:b.type,name:b.name,id:b.id}:b),keep_assets:true};
 for(const key of ['compatibility_date','compatibility_flags','usage_model','limits','logpush','observability','placement','tail_consumers'])if(settings[key]!==undefined)metadata[key]=settings[key];
 return metadata;
}
export async function deploy({accountId,token,source,request=fetch,log=console.log}){
 if(!/^[a-f0-9]{32}$/i.test(accountId||''))throw Error('Set the CLOUDFLARE_ACCOUNT_ID repository secret to your Cloudflare account ID.');
 accountId=accountId?.trim();token=token?.trim();
 if(token&&!/^[A-Za-z0-9_-]{20,256}$/.test(token))throw Error('CLOUDFLARE_API_TOKEN has an unexpected format. Save only the token value, without quotes, Bearer, or a curl command.');
 if(!token)throw Error('Set the CLOUDFLARE_API_TOKEN repository secret. Do not put the token in source code.');
 const base=`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/green-acres`;
 async function api(path,init={}){
  const response=await request(base+path,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:AbortSignal.timeout(60000)});
  let result;try{result=await response.json();}catch{throw Error(`Cloudflare returned HTTP ${response.status}.`);}
  if(!response.ok||!result.success)throw Error(`Cloudflare request failed (HTTP ${response.status}; codes ${(result.errors||[]).map(e=>e.code).join(',')||'unknown'}). Check token scope and account ID (endpoint: ${path||'code upload'}).`);
  return result.result;
 }
 const verification=await request('https://api.cloudflare.com/client/v4/user/tokens/verify',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
 const verified=await verification.json();
 if(!verification.ok||!verified.success||verified.result?.status!=='active')throw Error(`Cloudflare rejected the API token (HTTP ${verification.status}; codes ${(verified.errors||[]).map(e=>e.code).join(',')||'unknown'}). Replace the API token secret with the active token value.`);
 let before=await api('/settings');
 if(!(before.bindings||[]).some(b=>b.type==='d1'&&b.name==='DB')){
  const domainResponse=await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains?hostname=greenacresaz.com`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
  const domains=await domainResponse.json();
  const live=domains.success&&Array.isArray(domains.result)?domains.result.filter(d=>d.hostname==='greenacresaz.com').map(d=>d.service).join(', '):'lookup unavailable';
  if(live!=='green-acres')throw Error('Expected Green Acres custom-domain mapping not found. No deployment performed.');
  // Restore only the existing database already configured for this worker; no database is created or queried.
  before={...before,bindings:[...(before.bindings||[]),{type:'d1',name:'DB',id:'104cf1b5-8bcd-4038-87ac-74e04f68efeb'}]};
  log('Restoring DB connection to the existing green-acres-db database.');
 }
 const metadata=deploymentMetadata(before);
 const schedules=await api('/schedules');
 if((schedules.schedules||schedules||[]).length)throw Error('Cron triggers are present. Review them before automatic deployment; no changes made.');
 const body=new FormData();body.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));body.set('worker.js',new Blob([source],{type:'application/javascript+module'}),'worker.js');
 await api('',{method:'PUT',body});
 const after=await api('/settings');
 const canonical=value=>JSON.stringify((value.bindings||[]).map(b=>Object.fromEntries(Object.entries(b).filter(([key,value])=>!(b.type==='d1'&&key==='database_id'&&value===b.id)).sort())).sort((a,b)=>a.name.localeCompare(b.name)));
 if(canonical(before)!==canonical(after))throw Error('Code uploaded, but binding verification differs. Check Cloudflare before another deployment.');
 for(const key of ['compatibility_date','compatibility_flags','usage_model','limits','logpush','observability','placement','tail_consumers'])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error(`Code uploaded, but ${key} changed. Check Cloudflare settings.`);
 const version=source.match(/const APP_VERSION\s*=\s*(\d+)/)?.[1]||'unknown';
 log(`Deployed Green Acres v${version}. Existing bindings and runtime settings verified; routes and schedules were not changed.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await deploy({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,source:await readFile(new URL('../worker.js',import.meta.url),'utf8')});}
 catch(error){console.error(error.message);process.exitCode=1;}
}
