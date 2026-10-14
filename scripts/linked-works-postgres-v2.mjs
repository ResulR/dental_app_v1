// Isolated v2 reception only. Never use a production connection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
const root="/var/lib/dental-lab-bootstrap-reception";
const clients=new Set(), checks=[];
const ids={source:"40000000-0000-4000-8000-000000000001",a:"40000000-0000-4000-8000-000000000003",b:"40000000-0000-4000-8000-000000000004"};
const clinic="20000000-0000-4000-8000-000000000001", actor="10000000-0000-4000-8000-000000000002";
async function connect(){
 const c=new pg.Client({host:root+"/socket",port:55432,user:"postgres",database:"dental_lab_links",connectionTimeoutMillis:3000,query_timeout:12000});
 c.on("error",()=>{});await c.connect();clients.add(c);
 const {rows:[r]}=await c.query("SELECT current_setting('data_directory') d,current_setting('port') p,current_database() db,pg_backend_pid() pid");
 assert.equal(r.d,root+"/pgdata");assert.equal(r.p,"55432");assert.equal(r.db,"dental_lab_links");
 await c.query("SET statement_timeout='10s';SET lock_timeout='8s';SET idle_in_transaction_session_timeout='15s'");
 return {c,pid:r.pid};
}
async function begin(c,role="dental_lab_app"){assert.ok(["dental_lab_app","dental_lab_migrator"].includes(role));await c.query("BEGIN;SET LOCAL ROLE "+role);}
const link=(c,key)=>c.query("INSERT INTO public.work_links(source_order_id,child_order_id,clinic_id,kind,intervention_kind,child_current_status,source_revision,source_status_at_creation,created_by) VALUES($1,$2,$3,'retouch','retouch','pending',1,'delivered',$4)",[ids.source,ids[key],clinic,actor]);
const status=(c,key,s)=>c.query("UPDATE public.orders SET status=$2,manufacturing_version_id=current_version_id WHERE id=$1",[ids[key],s]);
async function snapshot(c){
 const {rows}=await c.query("SELECT o.id,o.status,w.child_current_status FROM public.orders o LEFT JOIN public.work_links w ON w.child_order_id=o.id WHERE o.id=ANY($1::uuid[]) ORDER BY o.id",[[ids.a,ids.b]]);
 const {rows:[r]}=await c.query("SELECT count(*)::int n FROM public.active_retouch_slots WHERE source_order_id=$1",[ids.source]);
 for(const row of rows)if(row.child_current_status!==null)assert.equal(row.status,row.child_current_status);
 assert.ok(r.n<=1);return {rows,active:r.n};
}
async function rejected(c,sql,params,code,constraint){
 await c.query("SAVEPOINT expected_failure");
 let e;try{await c.query(sql,params);}catch(x){e=x;}
 await c.query("ROLLBACK TO SAVEPOINT expected_failure;RELEASE SAVEPOINT expected_failure");
 assert.equal(e?.code,code);if(constraint)assert.equal(e.constraint,constraint);
}
async function resetFixture(c){
 // Only after a passed scenario; never in finally or after failure.
 await begin(c,"dental_lab_migrator");
 await c.query("DELETE FROM public.work_links WHERE source_order_id=$1",[ids.source]);
 await c.query("UPDATE public.orders SET status='pending',manufacturing_version_id=current_version_id WHERE id=ANY($1::uuid[])",[[ids.a,ids.b]]);
 await c.query("COMMIT");
}
async function race(observer,name,first,second,finish,expected,active){
 const a=await connect(),b=await connect();
 await begin(a.c);await begin(b.c);await first(a.c);
 const outcome=second(b.c).then(()=>({ok:true}),e=>({ok:false,code:e.code,constraint:e.constraint}));
 let blocked=false;
 for(let i=0;i<60;i++){
  const {rows:[r]}=await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[b.pid]);
  if(r?.wait_event_type==="Lock"){blocked=true;break;}await delay(25);
 }
 assert.ok(blocked,name+": real lock wait required");
 await a.c.query(finish);
 const result=await outcome;
 if(expected==="success"){assert.equal(result.ok,true);await b.c.query("COMMIT");}
 else{assert.equal(result.code,"23505");assert.equal(result.constraint,"work_links_one_active_retouch_idx");await b.c.query("ROLLBACK");}
 await a.c.end();clients.delete(a.c);await b.c.end();clients.delete(b.c);
 const fresh=await connect();const state=await snapshot(fresh.c);assert.equal(state.active,active);
 checks.push({name,blocked:true,result:expected,state});await fresh.c.end();clients.delete(fresh.c);
}
try{
 assert.equal(process.env.DENTAL_LINKED_WORKS_TEST_APPROVED,"isolated-v2");
 assert.ok(![0,1002,994,103].includes(process.getuid()));
 const {c}=await connect();
 await begin(c,"dental_lab_migrator");
 await c.query(await readFile(new URL("../tests/postgres/linked-works-v2-seed.sql",import.meta.url),"utf8"));
 await c.query("COMMIT");
 // App role transitions, permissions and transactional rollback.
 await begin(c);await link(c,"a");
 for(const s of ["pending","correction_requested","accepted","manufacturing","completed"]){await status(c,"a",s);assert.equal((await snapshot(c)).active,1);}
 for(const s of ["rejected","cancelled","delivered"]){
  await status(c,"a",s);assert.equal((await snapshot(c)).active,0);
  await status(c,"a","completed");assert.equal((await snapshot(c)).active,1);
 }
 await rejected(c,"UPDATE public.work_links SET child_current_status='cancelled'",[],"42501");
 await rejected(c,"UPDATE public.work_links SET source_revision=2",[],"42501");
 await rejected(c,"UPDATE public.orders SET clinic_id=$1 WHERE id=$2",[clinic,ids.a],"42501");
 await status(c,"a","delivered");await link(c,"b");
 await rejected(c,"UPDATE public.orders SET status='completed' WHERE id=$1",[ids.a],"23505","work_links_one_active_retouch_idx");
 assert.equal((await snapshot(c)).rows[0].status,"delivered");
 await c.query("ROLLBACK");assert.equal((await snapshot(c)).active,0);
 checks.push({name:"app_transitions_reactivation_permissions_rollback",passed:true});
 // Schema-level integrity independent of application permissions.
 await begin(c,"dental_lab_migrator");await link(c,"a");
 await rejected(c,"UPDATE public.work_links SET child_current_status='cancelled'",[],"23503","work_links_child_status_fk");
 await rejected(c,"UPDATE public.work_links SET kind='supplement',intervention_kind=NULL",[],"23503","work_links_child_kind_fk");
 await rejected(c,"UPDATE public.work_links SET source_order_id=child_order_id",[],"23514");
 await rejected(c,"UPDATE public.work_links SET source_order_id='40000000-0000-4000-8000-000000000002'",[],"23503");
 await rejected(c,"UPDATE public.work_links SET child_order_id='40000000-0000-4000-8000-000000000002'",[],"23503");
 await rejected(c,"UPDATE public.work_links SET source_status_at_creation='accepted'",[],"23514");
 await rejected(c,"UPDATE public.work_links SET intervention_kind=NULL",[],"23514");
 await c.query("ROLLBACK");checks.push({name:"schema_type_clinic_source_status_integrity",passed:true});
 for(const finish of ["COMMIT","ROLLBACK"]){
  await resetFixture(c);
  await race(c,"two_creations_"+finish,x=>link(x,"a"),x=>link(x,"b"),finish,finish==="COMMIT"?"23505":"success",1);
 }
 for(const finish of ["COMMIT","ROLLBACK"]){
  await resetFixture(c);await begin(c);await link(c,"a");await c.query("COMMIT");
  await race(c,"release_vs_creation_"+finish,x=>status(x,"a","delivered"),x=>link(x,"b"),finish,finish==="COMMIT"?"success":"23505",1);
 }
 for(const finish of ["COMMIT","ROLLBACK"]){
  await resetFixture(c);await begin(c);await link(c,"a");await status(c,"a","delivered");await c.query("COMMIT");
  await race(c,"reactivation_vs_creation_"+finish,x=>status(x,"a","completed"),x=>link(x,"b"),finish,finish==="COMMIT"?"23505":"success",1);
 }
 assert.equal(checks.length,8);
 console.log(JSON.stringify({test:"linked_works_postgres_v2",result:"passed",checks,fixture:"retained_in_isolated_cluster"}));
}catch(e){console.error(JSON.stringify({result:"failed",message:e.message,code:e.code,checks}));process.exitCode=1;}
finally{await Promise.allSettled([...clients].map(c=>c.end()));}
