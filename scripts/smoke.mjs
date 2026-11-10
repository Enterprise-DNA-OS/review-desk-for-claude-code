import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,COMMANDS,parseArgs} from './reviews.mjs';
import {parseCsv} from './lib/csv.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'review-desk-test-'));
process.env.DATA_DIR=path.join(dir,'db');process.env.OUTPUT_DIR=path.join(dir,'output');
const schema='test_'+randomUUID().replaceAll('-','');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
if(process.env.TEST_DATABASE_URL){const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=url.toString();}
const db=await getDb();let assertions=0;const used=new Set();
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};const ok=(v)=>{assert.ok(v);assertions++;};
async function run(c,o={},pos=[]){used.add(c);return execute(db,c,o,pos);}
async function fail(c,o,pattern,pos=[]){await assert.rejects(()=>run(c,o,pos),pattern);assertions++;}
const scalar=async sql=>(await db.query(sql))[0].n;
const fixture=path.join(REPO_ROOT,'fixtures/grade-us.csv'),mapping=path.join(REPO_ROOT,'fixtures/grade-us-map.json');
try{
 if(process.env.TEST_DATABASE_URL)await db.exec(`create schema ${schema}`);
 eq((await migrate(db)).ran.length,2);eq((await migrate(db)).ran.length,0);
 await seed(db);await seed(db);eq(await scalar('select count(*)::int n from reviews'),8);eq(await scalar('select count(*)::int n from actions'),1);
 const rr=await db.query("select id,external_id,location from v_reviews where location='HARBOUR' order by external_id");const review=rr[2].id;
 for(const c of ['help','locations','reviews','response-queue','location-health','owner-load','attention','compliance','actions','imports','source-freshness','audit','weekly-review','detail','history'])ok(await run(c,['detail','history'].includes(c)?{review}:{}));
 eq((await run('response-queue')).length,7);ok((await run('compliance')).some(x=>x.rule==='PRIVACY-9'));ok((await run('source-freshness')).some(x=>x.code==='HILL'&&x.freshness==='no export loaded'));
 await fail('detail',{review:'DEMO-1'},/Ambiguous/);await fail('detail',{review:'missing'},/No matching/);
 eq((await run('detail',{review:review.slice(0,10)})).id,review);
 const actor='Rae Morgan';
 await fail('assign',{review,owner:'Jules','due-on':'2026-11-15'},/actor/);
 await fail('assign',{review,owner:'Jules','due-on':'2026-02-30',actor},/Invalid calendar/);
 eq((await run('assign',{review,owner:'Jules','due-on':'2026-11-15',actor})).owner,'Jules');
 eq((await run('log',{review,note:'Checked original cancellation record',actor})).review_id,review);
 await fail('reconcile-response',{review,evidence:'checked',actor},/No reply/);
 await run('reconcile-response',{review:rr[1].id,evidence:'Checked source reply against original export',actor});eq((await run('detail',{review:rr[1].id})).disposition,'responded');
 await run('no-response',{review:rr[2].id,reason:'Separate investigation is open; keep this review in all reports',actor});eq((await run('detail',{review:rr[2].id})).disposition,'no-response');
 await fail('no-response',{review:rr[3].id,actor},/reason/);
 await run('reopen',{review:rr[2].id,reason:'Investigation ready for response',actor});eq((await run('detail',{review:rr[2].id})).disposition,'open');
 const action=await run('add-action',{review,title:'Check class notice',owner:'Jules','due-on':'2026-11-08',actor});await fail('close-action',{action:action.id,actor},/evidence/);await run('close-action',{action:action.id,evidence:'Notice record checked',actor});eq((await run('actions')).find(x=>x.id===action.id).status,'done');
 const p=await run('draft-reply',{review,file:path.join(REPO_ROOT,'fixtures/reply.txt'),evidence:'Cancellation record reviewed; no personal detail in public wording',actor});ok(fs.existsSync(p.file));
 await fail('approve-reply',{reply:p.id,evidence:'checked','privacy-checked':true,actor},/different named/);
 await fail('approve-reply',{reply:p.id,evidence:'checked',actor:'Jules'},/privacy-checked/);
 await fail('approve-reply',{reply:p.id,evidence:'checked','privacy-checked':true,actor:'Jules'},/assessment/);
 await fail('record-posting',{reply:p.id,url:'https://example.org/posted',evidence:'copy', 'posted-at':new Date().toISOString(),actor},/approved first/);
 await run('assess',{review,finding:'uncertain',relationship:'unknown',incentive:'unknown',evidence:'Evidence missing',actor});
 await fail('approve-reply',{reply:p.id,evidence:'checked','privacy-checked':true,actor:'Jules'},/assessment/);
 await run('assess',{review,finding:'checked',relationship:'none-known',incentive:'none-known',evidence:'Source record reviewed, no relationship or incentive known',actor});
 await run('approve-reply',{reply:p.id,evidence:'Inspected exact text against source','privacy-checked':true,actor:'Jules'});
 await assert.rejects(()=>db.query('update replies set body=$2 where id=$1',[p.id,'changed']),/append only/);assertions++;
 await fail('record-posting',{reply:p.id,url:'javascript:alert(1)',evidence:'copy','posted-at':new Date().toISOString(),actor},/http/);
 await fail('record-posting',{reply:p.id,url:'https://example.org/posted',evidence:'copy','posted-at':'2020-01-01T00:00:00Z',actor},/follow approval/);
 await run('record-posting',{reply:p.id,url:'https://example.org/posted',evidence:'Manual posting checked in source console','posted-at':new Date().toISOString(),actor});eq((await run('detail',{review})).disposition,'responded');
 await fail('draft-reply',{review,file:path.join(REPO_ROOT,'fixtures/reply.txt'),evidence:'new',actor},/closed/);
 const opts={file:fixture,map:mapping,location:'HARBOUR',source:'synthetic-demo','exported-at':'2026-11-01T00:00:00Z',actor};
 ok((await run('import',opts,['grade-us'])).duplicate);
 const changedFile=path.join(dir,'changed.csv');fs.writeFileSync(changedFile,fs.readFileSync(fixture,'utf8').replace('course materials.','course materials after another week.'));
 await fail('import',{...opts,file:changedFile},/later exported-at/,['grade-us']);
 const before=await scalar('select count(*)::int n from imports');
 const revised={...opts,file:changedFile,'exported-at':'2026-11-02T00:00:00Z'};
 const dry=await run('import',{...revised,'dry-run':true},['grade-us']);eq(dry.changed,1);eq(dry.unchanged,3);eq(await scalar('select count(*)::int n from imports'),before);
 await run('import',revised,['grade-us']);const latest=await run('detail',{review});eq(latest.sequence,2);eq(latest.disposition,'open');eq(latest.approved_by,null);eq(latest.finding,null);eq((await run('history',{review})).versions.length,2);
 await fail('approve-reply',{reply:p.id,evidence:'bad','privacy-checked':true,actor:'Jules'},/superseded/);
 await fail('record-posting',{reply:p.id,url:'https://example.org',evidence:'copy','posted-at':new Date().toISOString(),actor},/superseded/);
 const d1=await run('draft-reply',{review,file:path.join(REPO_ROOT,'fixtures/reply.txt'),evidence:'First revised draft',actor});
 const d2=await run('draft-reply',{review,file:path.join(REPO_ROOT,'fixtures/reply.txt'),evidence:'Second revised draft',actor});
 eq((await run('detail',{review})).reply_id,d2.id);
 await fail('approve-reply',{reply:d1.id,evidence:'old draft','privacy-checked':true,actor:'Jules'},/superseded/);
 const otherFile=path.join(dir,'new.csv');fs.writeFileSync(otherFile,fs.readFileSync(fixture,'utf8').replaceAll('DEMO-','NEW-'));
 const other={...opts,file:otherFile,location:'HILL',source:'another-source'};
 eq((await run('import',{...other,'dry-run':true},['grade-us'])).added,4);eq(await scalar('select count(*)::int n from reviews'),8);
 await run('import',other,['grade-us']);eq(await scalar('select count(*)::int n from reviews'),12);
 const badFile=path.join(dir,'bad.csv');fs.writeFileSync(badFile,fs.readFileSync(otherFile,'utf8').replace(',4,2026-10-27',',6,2026-10-27'));
 await fail('import',{...other,file:badFile,source:'bad-source'},/rating/,['grade-us']);eq(await scalar('select count(*)::int n from reviews'),12);
 fs.writeFileSync(badFile,fs.readFileSync(otherFile,'utf8').replace('NEW-4','NEW-1'));await fail('import',{...other,file:badFile,source:'bad-source'},/Duplicate review ID/,['grade-us']);
 const badMap=path.join(dir,'map.json');fs.writeFileSync(badMap,JSON.stringify({external_id:'absent',rating:'Rating',platform:'Review Site',reviewed_on:'Review Date',body:'Review Text'}));await fail('import',{...other,map:badMap,source:'bad-source'},/column not found/,['grade-us']);
 await fail('import',{...other,'exported-at':'2026-11-02'},/Timestamp/,['grade-us']);
 await fail('import',{...other,'exported-at':'2099-11-02T00:00:00Z'},/future/,['grade-us']);
 await assert.rejects(()=>db.query('delete from review_versions where review_id=$1',[review]),/append only/);assertions++;
 const loc=await run('add-location',{code:'NEW',name:'<script>alert(1)</script>',owner:'Rae','response-days':'4','policy-review-on':'2026-10-01','retention-review-on':'2026-10-01',purpose:'Test evidence',actor});ok(loc.id);
 await run('policy',{location:'new','policy-url':'https://example.org/policy','security-evidence':'Restricted operators','policy-review-on':'2099-01-01','retention-review-on':'2099-01-01',purpose:'Test only',actor});
 ok(!(await run('compliance')).some(x=>x.location==='NEW'));
 await fail('policy',{location:'new','policy-url':'javascript:alert(1)','security-evidence':'access','policy-review-on':'2099-01-01','retention-review-on':'2099-01-01',purpose:'Test',actor},/http/);
 await fail('reviews',{typo:true},/Unknown option/);
 eq(parseArgs(['detail','--review',review,'--json']).o,{review,json:true});assert.throws(()=>parseArgs(['reviews','--json','--json']),/Duplicate/);assertions++;
 eq(parseCsv('\uFEFFid,text\r\n1,"a,b\nHe said ""yes"""\r\n')[0].text,'a,b\nHe said "yes"');assertions++;
 assert.throws(()=>parseCsv('ID,id\n1,2'),/unique/);assertions++;
 assert.throws(()=>parseCsv('id,text\n1,"bad'),/unclosed/);assertions++;
 assert.throws(()=>parseCsv('id,text\n1,extra,row'),/expected/);assertions++;
 const ex=await run('export');eq(ex.records.reviews.length,12);ok(ex.records.imports.every(x=>x.raw_csv&&x.mapping));ok(ex.records.postings.length===1);
 const exportPath=path.join(dir,'export.json');await run('export',{out:exportPath});eq(JSON.parse(fs.readFileSync(exportPath)).records.review_versions.length,13);await fail('export',{out:exportPath},/EEXIST/);
 const missing=COMMANDS.filter(c=>!used.has(c));eq(missing,[]);
 // A fresh connection exercises the real CLI and render scripts on both database engines.
 await db.close();
 for(const script of ['view.mjs','docs.mjs']){const r=spawnSync(process.execPath,[`scripts/${script}`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(r.status,0);}
 const report=fs.readFileSync(path.join(process.env.OUTPUT_DIR,'docs-out/location-report',`new-${loc.id}.html`),'utf8');ok(report.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));ok(!report.includes('<script>alert(1)</script>'));
 const cli=spawnSync(process.execPath,['scripts/reviews.mjs','response-queue','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(cli.status,0);ok(Array.isArray(JSON.parse(cli.stdout)));
 const ambiguous=spawnSync(process.execPath,['scripts/reviews.mjs','detail','--review=DEMO-1'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(ambiguous.status,1);ok(ambiguous.stderr.includes('Ambiguous'));
 console.log(`PASS: ${assertions} assertions; all ${COMMANDS.length} CLI commands; ${process.env.TEST_DATABASE_URL?'PostgreSQL':'PGlite'}`);
}finally{
 try{await db.close();}catch{}
 if(process.env.TEST_DATABASE_URL){const clean=await getDb();try{await clean.exec(`drop schema if exists ${schema} cascade`);}finally{await clean.close();}}
 fs.rmSync(dir,{recursive:true,force:true});
}
