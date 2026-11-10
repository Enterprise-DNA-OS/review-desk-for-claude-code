import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {execute} from './reviews.mjs';
export async function seed(db){
 const existing=await db.query('select code from locations');
 if(existing.some(x=>!['HARBOUR','RIVER','HILL'].includes(x.code)))throw Error('Seed refuses a database containing non-demo locations');
 await db.exec(fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));
 for(const location of ['HARBOUR','RIVER'])await execute(db,'import',{file:path.join(REPO_ROOT,'fixtures/grade-us.csv'),map:path.join(REPO_ROOT,'fixtures/grade-us-map.json'),location,source:'synthetic-demo','exported-at':'2026-11-01T00:00:00Z',actor:'Demo'},['grade-us']);
 const r=(await db.query("select r.id from reviews r join locations l on l.id=r.location_id where l.code='HARBOUR' and external_id='DEMO-1'"))[0];
 if(!(await db.query('select id from actions where review_id=$1',[r.id])).length)await execute(db,'add-action',{review:r.id,title:'Check the cancelled class notice',owner:'Rae Morgan','due-on':'2026-10-24',actor:'Demo'});
 const current=await execute(db,'detail',{review:r.id});
 if(!current.reply_id){
  await execute(db,'assess',{review:r.id,finding:'checked',relationship:'none-known',incentive:'none-known',evidence:'Synthetic cancellation record checked',actor:'Demo author'});
  const draft=await execute(db,'draft-reply',{review:r.id,file:path.join(REPO_ROOT,'fixtures/reply.txt'),evidence:'Synthetic cancellation record supports this private response',actor:'Demo author'});
  await execute(db,'approve-reply',{reply:draft.id,evidence:'Synthetic second-person review of the exact reply','privacy-checked':true,actor:'Demo reviewer'});
 }
 const reconciled=(await db.query("select id,disposition from v_reviews where location='HARBOUR' and external_id='DEMO-2'"))[0];
 if(reconciled.disposition==='open')await execute(db,'reconcile-response',{review:reconciled.id,evidence:'Synthetic comparison with the source response',actor:'Demo reviewer'});
 const concern=(await db.query("select id,finding from v_reviews where location='HARBOUR' and external_id='DEMO-4'"))[0];
 if(!concern.finding)await execute(db,'assess',{review:concern.id,finding:'uncertain',relationship:'unknown',incentive:'unknown',evidence:'Synthetic record lacks disclosure evidence',actor:'Demo reviewer'});
 return {locations:3,reviews:8};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const db=await getDb();try{if(db.mode==='postgres'&&process.env.ALLOW_DEMO_SEED!=='yes')throw Error('Shared database seed requires ALLOW_DEMO_SEED=yes on a disposable database');console.log(await seed(db));}finally{await db.close();}
}
