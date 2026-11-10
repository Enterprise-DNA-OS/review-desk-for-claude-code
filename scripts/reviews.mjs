#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';

const READS={
 locations:'select code,name,owner,response_days,policy_review_on,retention_review_on from locations order by code',
 reviews:'select id,location,external_id,platform,rating,reviewer,owner,disposition,sequence from v_reviews order by location,external_id',
 'response-queue':'select * from v_response_queue order by overdue_days desc,due_on,external_id',
 'location-health':'select code,name,reviews,awaiting_response,overdue,low_rating_open,imported_average,latest_export from v_location_health order by code',
 'owner-load':"select owner,count(*)::integer awaiting_response,count(*) filter(where overdue_days>0)::integer overdue from v_reviews where disposition='open' group by owner order by overdue desc,owner",
 attention:"select location,external_id,owner,due_on,overdue_days from v_reviews where disposition='open' and (overdue_days>0 or last_activity<now()-interval '7 days') order by overdue_days desc,external_id",
 compliance:'select * from v_compliance order by location,rule,review_id',
 actions:'select a.id,l.code location,r.external_id,a.title,a.owner,a.due_on,a.status,a.evidence from actions a join reviews r on r.id=a.review_id join locations l on l.id=r.location_id order by a.due_on,a.id',
 imports:'select i.id,l.code location,i.source,i.exported_at,i.row_count,i.sha256,i.actor from imports i join locations l on l.id=i.location_id order by exported_at,id',
 'source-freshness':"select code,name,latest_export,case when latest_export is null then 'no export loaded' when latest_export<now()-interval '7 days' then 'refresh needed' else 'recent export' end freshness from v_location_health order by code",
 audit:'select * from events order by created_at,id',
};
const FLAGS={
 help:[],...Object.fromEntries(Object.keys(READS).map(k=>[k,[]])),
 'weekly-review':[],detail:['review'],history:['review'],
 'add-location':['code','name','owner','response-days','policy-url','security-evidence','policy-review-on','retention-review-on','purpose','actor'],
 policy:['location','policy-url','security-evidence','policy-review-on','retention-review-on','purpose','actor'],
 assign:['review','owner','due-on','actor'],assess:['review','finding','relationship','incentive','evidence','actor'],
 'no-response':['review','reason','actor'],reopen:['review','reason','actor'],
 'reconcile-response':['review','evidence','actor'],
 'draft-reply':['review','file','evidence','actor'], 'approve-reply':['reply','evidence','privacy-checked','actor'],
 'record-posting':['reply','url','posted-at','evidence','actor'],
 'add-action':['review','title','owner','due-on','actor'], 'close-action':['action','evidence','actor'],
 log:['review','note','actor'],import:['file','map','location','source','exported-at','actor','dry-run'],export:['out'],
};
export const COMMANDS=Object.keys(FLAGS);
const hash=v=>createHash('sha256').update(v).digest('hex');
const required=(o,k)=>{const v=o[k];if(typeof v!=='string'||!v.trim())throw Error(`--${k} is required`);return v.trim();};
function day(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`Invalid calendar date: ${v}`);return v;}
function instant(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Timestamp needs ISO date, time and timezone');day(v.slice(0,10));if(Date.parse(v)>Date.now()+60000)throw Error('Timestamp is in the future');return new Date(v).toISOString();}
function http(v){try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{throw Error('Use an http or https URL without credentials');}return v;}
function choice(v,allowed){if(!allowed.includes(v))throw Error(`Expected one of: ${allowed.join(', ')}`);return v;}
async function match(db,kind,q){
 const definitions={locations:['code','name'],reviews:['external_id'],replies:[],actions:['title']};
 const cols=definitions[kind];if(!cols)throw Error('Unknown record type');
 const rows=await db.query(`select * from ${kind}`); const norm=String(q).toLowerCase();
 let found=rows.filter(r=>r.id===q||cols.some(k=>String(r[k]).toLowerCase()===norm));
 if(!found.length)found=rows.filter(r=>r.id.toLowerCase().startsWith(norm)||cols.some(k=>String(r[k]).toLowerCase().includes(norm)));
 if(found.length!==1)throw Error(`${found.length?'Ambiguous':'No matching'} ${kind}: ${q}\n${(found.length?found:rows).map(r=>[r.id,...cols.map(k=>r[k])].join(' | ')).join('\n')}`);
 return found[0];
}
async function event(db,review,actor,action,detail){await db.query('insert into events(review_id,actor,action,detail) values($1,$2,$3,$4)',[review||null,actor,action,JSON.stringify(detail)]);}
async function current(db,id){return (await db.query('select * from v_reviews where id=$1',[id]))[0];}
async function lockReview(db,o){const r=await match(db,'reviews',required(o,'review'));await db.query('select id from reviews where id=$1 for update',[r.id]);return current(db,r.id);}
async function replyCurrent(db,o){const p=await match(db,'replies',required(o,'reply'));await db.query('select id from reviews where id=$1 for update',[p.review_id]);const r=await current(db,p.review_id);if(r.version_id!==p.version_id||r.reply_id!==p.id)throw Error('Reply is superseded: draft and approve against the current review');return {p,r};}
function privateWrite(file,body){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,body,{mode:0o600,flag:'wx'});return file;}

async function importReviews(db,o){
 const l=await match(db,'locations',required(o,'location'));
 await db.query('select id from locations where id=$1 for update',[l.id]);
 const source=required(o,'source'),actor=required(o,'actor'),time=instant(required(o,'exported-at'));
 const raw=fs.readFileSync(required(o,'file'),'utf8');const map=JSON.parse(fs.readFileSync(required(o,'map'),'utf8'));
 const keys=['external_id','platform','reviewer','rating','reviewed_on','body','review_url','source_reply','source_status','source_notes'];
 if(!map||Array.isArray(map)||Object.keys(map).some(k=>!keys.includes(k))||Object.values(map).some(v=>typeof v!=='string'||!v.trim()))throw Error('Mapping must map supported field names to CSV column names');
 for(const k of ['external_id','platform','rating','reviewed_on','body'])if(!map[k])throw Error(`Mapping missing ${k}`);
 if(new Set(Object.values(map).map(v=>v.toLowerCase())).size!==Object.values(map).length)throw Error('Each mapping must use a different column');
 const rows=parseCsv(raw);if(!rows.length)throw Error('No review rows found');
 for(const v of Object.values(map))if(!Object.hasOwn(rows[0],v))throw Error(`CSV column not found: ${v}. Check the mapping against your export.`);
 const digest=hash(raw+JSON.stringify(map));
 const previous=await db.query('select id from imports where location_id=$1 and source=$2 and sha256=$3',[l.id,source,digest]);
 if(previous.length)return {duplicate:true,import_id:previous[0].id,rows:rows.length};
 const [latest]=await db.query('select max(exported_at) latest from imports where location_id=$1 and source=$2',[l.id,source]);
 if(latest.latest&&Date.parse(time)<=Date.parse(latest.latest))throw Error('Changed exports require a later exported-at timestamp');
 const seen=new Set();
 const records=rows.map((row,i)=>{
  const r=Object.fromEntries(keys.map(k=>[k,map[k]?row[map[k]]:'']));
  for(const k of ['external_id','platform','body'])if(!r[k].trim())throw Error(`Row ${i+2}: empty ${k}`);
  r.external_id=r.external_id.trim();if(seen.has(r.external_id))throw Error(`Duplicate review ID ${r.external_id} within this source and location`);seen.add(r.external_id);
  if(!/^[1-5]$/.test(r.rating.trim()))throw Error(`Row ${i+2}: rating must be an integer from 1 to 5`);r.rating=Number(r.rating);
  r.reviewed_on=day(r.reviewed_on.trim());if(r.reviewed_on>time.slice(0,10))throw Error('Review date is after the export date');
  if(r.review_url)http(r.review_url);
  return {...r,content_hash:hash(JSON.stringify(r)),raw_record:row};
 });
 let added=0,changed=0,unchanged=0;const plan=[];
 for(const r of records){const [existing]=await db.query('select * from reviews where location_id=$1 and source=$2 and external_id=$3',[l.id,source,r.external_id]);const v=existing?await current(db,existing.id):null;
  const same=v&&(await db.query('select content_hash from review_versions where id=$1',[v.version_id]))[0].content_hash===r.content_hash;
  if(same)unchanged++;else if(existing)changed++;else added++;plan.push({r,existing,v,same});
 }
 if(o['dry-run'])return {dry_run:true,rows:rows.length,added,changed,unchanged};
 const [batch]=await db.query('insert into imports(location_id,source,sha256,exported_at,actor,raw_csv,mapping,row_count) values($1,$2,$3,$4,$5,$6,$7,$8) returning id',[l.id,source,digest,time,actor,raw,JSON.stringify(map),rows.length]);
 for(const {r,existing,v,same} of plan){
  if(same)continue;
  const due=new Date(`${r.reviewed_on}T00:00:00Z`);due.setUTCDate(due.getUTCDate()+l.response_days);
  const record=existing||(await db.query('insert into reviews(location_id,source,external_id,owner,due_on) values($1,$2,$3,$4,$5) returning *',[l.id,source,r.external_id,l.owner,due.toISOString().slice(0,10)]))[0];
  await db.query('insert into review_versions(review_id,import_id,sequence,content_hash,platform,reviewer,rating,reviewed_on,body,review_url,source_reply,source_status,source_notes,raw_record) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[record.id,batch.id,(v?.sequence||0)+1,r.content_hash,r.platform,r.reviewer,r.rating,r.reviewed_on,r.body,r.review_url,r.source_reply,r.source_status,r.source_notes,JSON.stringify(r.raw_record)]);
  if(existing)await db.query("update reviews set disposition='open',disposition_reason='' where id=$1",[record.id]);
  await event(db,record.id,actor,existing?'source-revised':'source-imported',{import_id:batch.id,external_id:r.external_id});
 }
 await event(db,null,actor,'import',{import_id:batch.id,added,changed,unchanged});
 return {import_id:batch.id,rows:rows.length,added,changed,unchanged};
}

export async function execute(db,cmd,o={},pos=[]){
 if(!FLAGS[cmd])throw Error(`Unknown command ${cmd}. Use help.`);
 for(const k of Object.keys(o))if(k!=='json'&&!FLAGS[cmd].includes(k))throw Error(`Unknown option --${k} for ${cmd}`);
 for(const k of ['json','dry-run','privacy-checked'])if(Object.hasOwn(o,k)&&o[k]!==true)throw Error(`--${k} is a switch without a value`);
 if(pos.length&&(cmd!=='import'||pos.length!==1||pos[0]!=='grade-us'))throw Error('Only import accepts a positional argument: grade-us');
 if(cmd==='import'&&pos[0]!=='grade-us')throw Error('Use import grade-us');
 if(cmd==='help')return COMMANDS.map(command=>({command,options:FLAGS[command].map(k=>`--${k}`).join(' ')}));
 if(READS[cmd])return db.query(READS[cmd]);
 if(cmd==='weekly-review')return {response_queue:await execute(db,'response-queue'),location_health:await execute(db,'location-health'),compliance:await execute(db,'compliance'),actions:await execute(db,'actions')};
 if(cmd==='detail'){const r=await match(db,'reviews',required(o,'review'));return current(db,r.id);}
 if(cmd==='history'){const r=await match(db,'reviews',required(o,'review'));return {versions:await db.query('select * from review_versions where review_id=$1 order by sequence',[r.id]),events:await db.query('select * from events where review_id=$1 order by created_at,id',[r.id]),replies:await db.query('select * from replies where review_id=$1 order by created_at,id',[r.id]),assessments:await db.query('select * from assessments where review_id=$1 order by created_at,id',[r.id])};}
 if(cmd==='export'){
  const out={format:'review-desk-v1',exported_at:new Date().toISOString(),records:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{for(const t of ['locations','imports','reviews','review_versions','replies','approvals','postings','assessments','actions','events'])out.records[t]=await db.query(`select * from ${t} order by id`);await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}
  if(o.out){const file=privateWrite(path.resolve(o.out),JSON.stringify(out,null,2)+'\n');return {file,counts:Object.fromEntries(Object.entries(out.records).map(([k,v])=>[k,v.length]))};}return out;
 }
 const actor=required(o,'actor');let result;
 await db.exec('BEGIN');
 try{
  if(cmd==='import')result=await importReviews(db,o);
  else if(cmd==='add-location'){
   const days=Number(o['response-days']||3);if(!Number.isInteger(days)||days<1||days>90)throw Error('response-days must be an integer 1 to 90');
   const code=required(o,'code').toUpperCase();if(!/^[A-Z0-9-]+$/.test(code))throw Error('Code uses letters, digits and hyphens');
   result=(await db.query('insert into locations(code,name,owner,response_days,policy_url,security_evidence,policy_review_on,retention_review_on,purpose) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[code,required(o,'name'),required(o,'owner'),days,o['policy-url']?http(o['policy-url']):'',o['security-evidence']||'',day(required(o,'policy-review-on')),day(required(o,'retention-review-on')),required(o,'purpose')]))[0];
   await event(db,null,actor,cmd,{location_id:result.id});
  }else if(cmd==='policy'){
   const l=await match(db,'locations',required(o,'location'));
   result=(await db.query('update locations set policy_url=$2,security_evidence=$3,policy_review_on=$4,retention_review_on=$5,purpose=$6 where id=$1 returning *',[l.id,http(required(o,'policy-url')),required(o,'security-evidence'),day(required(o,'policy-review-on')),day(required(o,'retention-review-on')),required(o,'purpose')]))[0];
   await event(db,null,actor,cmd,{location_id:l.id,before:l,after:result});
  }else if(cmd==='close-action'){
   const a=await match(db,'actions',required(o,'action'));
   result=(await db.query("update actions set status='done',evidence=$2 where id=$1 returning *",[a.id,required(o,'evidence')]))[0];await event(db,a.review_id,actor,cmd,{action_id:a.id,evidence:o.evidence});
  }else if(['approve-reply','record-posting'].includes(cmd)){
   const {p,r}=await replyCurrent(db,o);if(r.disposition!=='open')throw Error('Review is closed; reopen with a reason first');
   if(cmd==='approve-reply'){
    if(actor.toLowerCase()===p.author.toLowerCase())throw Error('A different named reviewer must approve');
    if(o['privacy-checked']!==true)throw Error('Confirm --privacy-checked after inspecting the exact reply');
    if(r.finding!=='checked'||!['none-known','disclosed'].includes(r.relationship)||!['none-known','disclosed'].includes(r.incentive))throw Error('Complete the source and disclosure assessment before approval');
    const findings=await db.query("select * from v_compliance where location=$1 and review_id is null",[r.location]);if(findings.length)throw Error('Location policy, access or retention review needs attention');
    result=(await db.query('insert into approvals(reply_id,actor,evidence,privacy_checked) values($1,$2,$3,true) returning *',[p.id,actor,required(o,'evidence')]))[0];
   }else{
    const [a]=await db.query('select * from approvals where reply_id=$1',[p.id]);if(!a)throw Error('Exact reply must be approved first');
    if(r.finding!=='checked'||!['none-known','disclosed'].includes(r.relationship)||!['none-known','disclosed'].includes(r.incentive))throw Error('Review assessment changed; resolve it before recording a posting');
    const when=instant(required(o,'posted-at'));if(Date.parse(when)<Date.parse(a.created_at))throw Error('Posting time must follow approval');
    result=(await db.query('insert into postings(reply_id,actor,posted_at,url,evidence) values($1,$2,$3,$4,$5) returning *',[p.id,actor,when,http(required(o,'url')),required(o,'evidence')]))[0];
    await db.query("update reviews set disposition='responded',disposition_reason='Manual posting recorded' where id=$1",[r.id]);
   }
   await event(db,r.id,actor,cmd,{reply_id:p.id,record:result});
  }else{
   const r=await lockReview(db,o);
   switch(cmd){
    case 'assign': result=(await db.query('update reviews set owner=$2,due_on=$3 where id=$1 returning *',[r.id,required(o,'owner'),day(required(o,'due-on'))]))[0];break;
    case 'assess':result=(await db.query('insert into assessments(review_id,version_id,finding,relationship,incentive,evidence,actor) values($1,$2,$3,$4,$5,$6,$7) returning *',[r.id,r.version_id,choice(required(o,'finding'),['checked','uncertain','concern']),choice(required(o,'relationship'),['none-known','disclosed','undisclosed','unknown']),choice(required(o,'incentive'),['none-known','disclosed','undisclosed','unknown']),required(o,'evidence'),actor]))[0];break;
    case 'draft-reply':{
     if(r.disposition!=='open')throw Error('Review is closed; reopen with a reason first');
     const body=fs.readFileSync(required(o,'file'),'utf8').trim();if(!body||body.length>10000)throw Error('Reply must contain 1 to 10000 characters');
     result=(await db.query('insert into replies(review_id,version_id,body,author,evidence) values($1,$2,$3,$4,$5) returning *',[r.id,r.version_id,body,actor,required(o,'evidence')]))[0];break;
    }
    case 'no-response': case 'reopen':result=(await db.query('update reviews set disposition=$2,disposition_reason=$3 where id=$1 returning *',[r.id,cmd==='reopen'?'open':'no-response',required(o,'reason')]))[0];break;
    case 'reconcile-response':if(!r.source_reply)throw Error('No reply exists in this source version');result=(await db.query("update reviews set disposition='responded',disposition_reason=$2 where id=$1 returning *",[r.id,required(o,'evidence')]))[0];break;
    case 'add-action':result=(await db.query('insert into actions(review_id,title,owner,due_on) values($1,$2,$3,$4) returning *',[r.id,required(o,'title'),required(o,'owner'),day(required(o,'due-on'))]))[0];break;
    case 'log':result={review_id:r.id,note:required(o,'note')};break;
    default:throw Error('Command not implemented');
   }
   await event(db,r.id,actor,cmd,{before:{owner:r.owner,due_on:r.due_on,disposition:r.disposition},record:result});
   // Activity includes evidence and drafts, while due dates remain the operator's commitment.
   await db.query('update reviews set updated_at=now() where id=$1',[r.id]);
  }
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');
 }catch(e){await db.exec('ROLLBACK');throw e;}
 if(cmd==='draft-reply'){
  const file=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',`${result.id}.txt`);
  try{privateWrite(file,`PRIVATE DRAFT. Not sent.\nReply: ${result.id}\nReview: ${result.review_id}\nVersion: ${result.version_id}\n\n${result.body}\n`);result.file=file;}catch(e){result.file_error=`Draft saved in database; file could not be written: ${e.message}`;}
 }
 return result;
}
export function parseArgs(args){const o={},pos=[];const cmd=args.shift()||'help';for(let i=0;i<args.length;i++){const arg=args[i];if(!arg.startsWith('--')){pos.push(arg);continue;}const eq=arg.indexOf('=');const k=arg.slice(2,eq<0?undefined:eq);if(Object.hasOwn(o,k))throw Error(`Duplicate --${k}`);o[k]=eq>=0?arg.slice(eq+1):['json','dry-run','privacy-checked'].includes(k)?true:args[++i];}return {cmd,o,pos};}
export function human(value){if(Array.isArray(value)){if(!value.length)return '(none)';return table(value,Object.keys(value[0]).map(key=>({key,label:key,width:key==='id'||key.endsWith('_id')?10:55,format:v=>v instanceof Date?v.toISOString():v&&typeof v==='object'?JSON.stringify(v):String(v??'').replace(/[\r\n\t]/g,' ')})));}if(value&&typeof value==='object'&&Object.values(value).some(Array.isArray))return Object.entries(value).map(([k,v])=>`${k}\n${human(v)}`).join('\n\n');return JSON.stringify(value,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{const {cmd,o,pos}=parseArgs(process.argv.slice(2));db=await getDb();const result=await execute(db,cmd,o,pos);console.log(o.json?JSON.stringify(result,null,2):human(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}
}
