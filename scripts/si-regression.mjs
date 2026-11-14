import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import gateway,{validateAnswer,BudgetDO,unsupportedSafetyPremise} from '../infra/worker.js';
if (!globalThis.crypto) Object.defineProperty(globalThis,"crypto",{value:webcrypto});
const record={id:'PSI-69',objective:'Investigate flame dynamics in microgravity.',approach:'Planned pressure range is 0.5-1.5 atm.',teamSummary:'Flame spread in microgravity and fire prevention.'};
const claim='The planned range is 0.5-1.5 atm [approach].';
const valid={summary:'An interpretation.',keyFindings:[claim,claim,claim],fireSafetyRelevance:'Research only.',limitations:['Not certification.','Planned is not measured.'],uncertainty:'Measurements limited.',evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:1}))};
const check=(a,finish='stop',kind='investigate')=>validateAnswer(JSON.stringify(a),finish,kind,[record]);
assert.ok(check(valid));
// The server attaches the exact verbatim passage text to accepted citations.
{const okd=check(valid);assert.ok(okd);assert.equal(okd.evidence[0].quote,record.approach);}
assert.equal(check(valid,'length'),null);
assert.equal(validateAnswer('{"summary":"trunc','stop','investigate',[record]),null);
for(const bad of [ {...valid,evidence:[]}, {...valid,evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:2}))}, {...valid,evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:0}))}, {...valid,evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'notAField',passage:1}))}, {...valid,keyFindings:[]}, {...valid,keyFindings:[claim.replace('[approach]','[objective]'),claim,claim]} ]) assert.equal(check(bad),null);
// Numbers must appear verbatim in a cited passage; typography in the record must not break citation.
assert.equal(check({...valid,keyFindings:['The planned range is 3.5 atm [approach].',claim,claim]}),null);
// Unit fidelity: 21% must not validate against a 0.21 mole-fraction passage (validation_18).
{const fracRecord={...record,approach:'Oxygen mole fraction 0.21 recorded for the oxidizer stream.'};
 const wrongUnit={...valid,keyFindings:['Oxygen was 21% [approach].',claim,claim],evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:1}))};
 assert.equal(validateAnswer(JSON.stringify(wrongUnit),'stop','investigate',[fracRecord]),null);
 const fracClaim='Oxygen mole fraction was 0.21 [approach].';
 const rightUnit={...valid,keyFindings:[fracClaim,fracClaim,fracClaim]};
 assert.ok(validateAnswer(JSON.stringify(rightUnit),'stop','investigate',[fracRecord]));}
// Sign fidelity: a negated value must not validate against an unsigned passage (validation_19).
{const posRecord={...record,objective:'Chamber pressure was held at 2.5 atm during the recorded runs reported here.'};
 const negClaim='Chamber pressure was -2.5 atm [objective].';
 const signBad={...valid,keyFindings:[negClaim,claim,claim],evidence:[{id:'PSI-69',claimIndex:0,field:'objective',passage:1},{id:'PSI-69',claimIndex:1,field:'approach',passage:1},{id:'PSI-69',claimIndex:2,field:'approach',passage:1}]};
 assert.equal(validateAnswer(JSON.stringify(signBad),'stop','investigate',[posRecord]),null);
 const posClaim='Chamber pressure was 2.5 atm [objective].';
 assert.ok(validateAnswer(JSON.stringify({...signBad,keyFindings:[posClaim,claim,claim]}),'stop','investigate',[posRecord]));}
// Dropped sign: an unsigned claim must not validate against a passage whose only occurrence is negative (unicode minus).
{const negPassageRecord={...record,objective:'Blowdown reached \u22122.5 atm during the recorded transient reported here.'};
 const dropped={...valid,keyFindings:['Blowdown reached 2.5 atm [objective].',claim,claim],evidence:[{id:'PSI-69',claimIndex:0,field:'objective',passage:1},{id:'PSI-69',claimIndex:1,field:'approach',passage:1},{id:'PSI-69',claimIndex:2,field:'approach',passage:1}]};
 assert.equal(validateAnswer(JSON.stringify(dropped),'stop','investigate',[negPassageRecord]),null);
 const keptClaim='Blowdown reached \u22122.5 atm [objective].';
 assert.ok(validateAnswer(JSON.stringify({...dropped,keyFindings:[keptClaim,claim,claim]}),'stop','investigate',[negPassageRecord]));}
// Range separators are not signs: a range claim validates against a range passage.
{const rangeRecord={...record,approach:'Planned pressure range is 0.5 - 1.5 atm for the matrix.'};
 const rangeClaim='The planned range is 0.5-1.5 atm [approach].';
 const rangeOk={...valid,keyFindings:[rangeClaim,rangeClaim,rangeClaim],evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:1}))};
 assert.ok(validateAnswer(JSON.stringify(rangeOk),'stop','investigate',[rangeRecord]));}
// Real PSI-69 structured table passage: unit in a column key, numbers in an array.
{const tblRecord={...record,conditionTables:[{file:'PSI-69_Experimental table_FLEX.csv',rows:274,fuels:['Heptane','Methanol'],oxygen:[],flowCmsRange:null,pressureRange:{mmHg:[526.3,2319.9]}}]};
 const tblClaim='Recorded chamber pressures spanned 526.3-2319.9 mmHg [conditions table: PSI-69_Experimental table_FLEX.csv].';
 const tbl={...valid,keyFindings:[tblClaim,tblClaim,tblClaim],evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'conditionTables',passage:1}))};
 const checkTbl=a=>validateAnswer(JSON.stringify(a),'stop','investigate',[tblRecord]);
 assert.ok(checkTbl(tbl));
 // Spaced range variant is not misread as signs.
 assert.ok(checkTbl({...tbl,keyFindings:[tblClaim.replace('526.3-2319.9','526.3 - 2319.9'),tblClaim,tblClaim]}));
 // Wrong unit rejected (numbers present, unit absent from the same passage).
 assert.equal(checkTbl({...tbl,keyFindings:[tblClaim.replace('mmHg','atm'),tblClaim,tblClaim]}),null);
 // Invented numbers rejected.
 assert.equal(checkTbl({...tbl,keyFindings:[tblClaim.replace('526.3-2319.9','999-1000'),tblClaim,tblClaim]}),null);}
const unicodeRecord={...record,approach:'Planned pressure range is 0.5\u22121.5 atm.'};
{const u={...valid,evidence:[0,1,2].map(claimIndex=>({id:'PSI-69',claimIndex,field:'approach',passage:1}))};
 const oku=validateAnswer(JSON.stringify(u),'stop','investigate',[unicodeRecord]);
 assert.ok(oku);assert.equal(oku.evidence[0].quote,unicodeRecord.approach);}
// Multi-sentence fields segment deterministically; a later passage is citable.
{const longRecord={...record,objective:'First sentence about flames in microgravity and their relevance to spacecraft fire safety research. Second sentence about pressure 2.5 atm in the planned matrix. Third sentence about fuels and chamber geometry.'};
 const c3='Pressure 2.5 atm appears in objective [objective].';
 const multi={...valid,keyFindings:[c3,claim,claim],evidence:[{id:'PSI-69',claimIndex:0,field:'objective',passage:2},{id:'PSI-69',claimIndex:1,field:'approach',passage:1},{id:'PSI-69',claimIndex:2,field:'approach',passage:1}]};
 const okm=validateAnswer(JSON.stringify(multi),'stop','investigate',[longRecord]);
 assert.ok(okm);assert.equal(okm.evidence[0].quote,'Second sentence about pressure 2.5 atm in the planned matrix.');
 assert.equal(validateAnswer(JSON.stringify({...multi,evidence:[{...multi.evidence[0],passage:3},...multi.evidence.slice(1)]}),'stop','investigate',[longRecord]),null);}
const rankClaim='PSI-69 appears relevant to flame spread [team annotation].';
const rank={ranking:[{id:'PSI-69',why:rankClaim,evidenceFields:['teamSummary']}],note:'Research relevance.',uncertainty:'Not a safe design.',evidence:[{id:'PSI-69',claimIndex:0,field:'teamSummary',passage:1}]};
assert.ok(check(rank,'stop','rank'));assert.equal(check({...rank,ranking:[{...rank.ranking[0],id:'PSI-999'}]},'stop','rank'),null);
// Index answers must not drop the team-annotation tag, cite NASA record fields, or carry NASA-field tags.
assert.equal(check({...rank,ranking:[{...rank.ranking[0],why:'PSI-69 appears relevant to flame spread.'}]},'stop','rank'),null);
assert.equal(check({...rank,evidence:[{...rank.evidence[0],field:'objective',passage:1}]},'stop','rank'),null);
assert.equal(check({...rank,evidence:[{...rank.evidence[0],passage:9}]},'stop','rank'),null);
assert.equal(check({...rank,ranking:[{...rank.ranking[0],why:rankClaim.replace('[team annotation]','[objective]')}]},'stop','rank'),null);
const syn={themes:['A','B','C'],crossCuttingInsights:[rankClaim,rankClaim,rankClaim],coverageGaps:['No certification.','No habitat validation.'],uncertainty:'Only a team index.',evidence:[0,1,2].map(claimIndex=>({...rank.evidence[0],claimIndex}))};
assert.ok(check(syn,'stop','synthesize'));
assert.equal(check({...syn,evidence:[]},'stop','synthesize'),null);
const mem=new Map();let queue=Promise.resolve();
const tx={get:async k=>mem.get(k),put:async(k,v)=>mem.set(k,v)};
const storage={transaction:fn=>{const p=queue.then(()=>fn(tx));queue=p.catch(()=>{});return p;}};
const obj=new BudgetDO({storage},{SI_DAILY_REQUESTS:3});
const op=async body=>(await obj.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
const day=new Date().toISOString().slice(0,10);
const reservations=await Promise.all(Array.from({length:12},(_,i)=>op({op:'reserve',id:`${day}:r${i}`,ip:'same',amount:1})));
assert.equal(reservations.filter(r=>r.ok).length,3);assert.equal(mem.get('preq:'+day),3);
await op({op:'reserve',id:`${day}:r0`,ip:'same',amount:1});assert.equal(mem.get('preq:'+day),3);
await op({op:'settle',id:`${day}:r0`,amount:1,promptTokens:40,completionTokens:12,totalTokens:52});await op({op:'settle',id:`${day}:r0`,amount:1});assert.equal(mem.get('preq:'+day),3);
assert.equal(mem.get('ptok:'+day),40);assert.equal(mem.get('ctok:'+day),12);assert.equal(mem.get('ttok:'+day),52);
await op({op:'settle',id:`${day}:r1`,amount:0});assert.equal(mem.get('preq:'+day),2);
await op({op:'reserve',id:`${day}:rh`,ip:'same',amount:1,tokenEstimate:1000});assert.equal(mem.get('tokhold:'+day),1000);
await op({op:'settle',id:`${day}:rh`,amount:1,promptTokens:10,completionTokens:5,totalTokens:15});assert.equal(mem.get('tokhold:'+day),0);
// Measured total beats prompt+candidates: settle with totalTokenCount 70 vs 40+12 -> ttok accumulates the measured total.
{const tm=new Map();const t3={get:async k=>tm.get(k),put:async(k,v)=>tm.set(k,v)};
 const d3=new BudgetDO({storage:{transaction:async fn=>fn(t3)}},{SI_DAILY_REQUESTS:9,SI_DAILY_TOKENS:100000});
 const o3=async body=>(await d3.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
 await o3({op:'reserve',id:`${day}:tot`,ip:'x',amount:1,tokenEstimate:900});
 await o3({op:'settle',id:`${day}:tot`,amount:1,promptTokens:40,completionTokens:12,totalTokens:70});
 assert.equal(tm.get('ttok:'+day),70);assert.equal(tm.get('tokhold:'+day),0);}
// Missing usage after a provider call retains the conservative hold instead of releasing to assumed zero.
{const km=new Map();const kt={get:async k=>km.get(k),put:async(k,v)=>km.set(k,v)};
 const kd=new BudgetDO({storage:{transaction:async fn=>fn(kt)}},{SI_DAILY_REQUESTS:9,SI_DAILY_TOKENS:100000});
 const ko=async body=>(await kd.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
 await ko({op:'reserve',id:`${day}:kh`,ip:'x',amount:1,tokenEstimate:700});
 await ko({op:'settle',id:`${day}:kh`,amount:1,keepHold:true});
 assert.equal(km.get('tokhold:'+day),700);assert.equal(km.get('ttok:'+day)??0,0);}
{const pm=new Map();const pt={get:async k=>pm.get(k),put:async(k,v)=>pm.set(k,v)};
 const paceDO=new BudgetDO({storage:{transaction:async fn=>fn(pt)}},{SI_DAILY_REQUESTS:50,SI_RPM:2,SI_TPM:5000});
 const pop=async body=>(await paceDO.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
 assert.equal((await pop({op:'reserve',id:`${day}:p0`,ip:'x',amount:1,tokenEstimate:2000})).ok,true);
 assert.equal((await pop({op:'reserve',id:`${day}:p1`,ip:'x',amount:1,tokenEstimate:2000})).ok,true);
 const pRpm=await pop({op:'reserve',id:`${day}:p2`,ip:'x',amount:1,tokenEstimate:2000});
 assert.equal(pRpm.ok,false);assert.match(pRpm.error,/pace/);}
// Per-model pace windows: independent budgets per model, fresh provider
// x-ratelimit-remaining snapshots tighten admission, and settle replaces the
// pace estimate with the measured total in the reserve minute.
{const mm=new Map();const mt={get:async k=>mm.get(k),put:async(k,v)=>mm.set(k,v)};
 const mdo=new BudgetDO({storage:{transaction:async fn=>fn(mt)}},{SI_DAILY_REQUESTS:50,SI_RPM:50,SI_TPM:8000});
 const mop=async body=>(await mdo.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
 const minute=new Date().toISOString().slice(0,16);
 assert.equal((await mop({op:'reserve',id:`${day}:m0`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-a',paceTokens:7500})).ok,true);
 const mTpm=await mop({op:'reserve',id:`${day}:m1`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-a',paceTokens:7500});
 assert.equal(mTpm.ok,false);assert.match(mTpm.error,/pace/);
 assert.equal((await mop({op:'reserve',id:`${day}:m2`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-b',paceTokens:7500})).ok,true);
 await mop({op:'limits',model:'groq-b',remainingRequests:20,remainingTokens:3000});
 const mRl=await mop({op:'reserve',id:`${day}:m3`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-b',paceTokens:7500});
 assert.equal(mRl.ok,false);assert.match(mRl.error,/pace/);
 // Remaining-requests header is the DAILY RPD window: its exhaustion is not
 // a minute-pace condition and must not carry short-wait copy.
 await mop({op:'limits',model:'groq-c',remainingRequests:0,remainingTokens:9000});
 const mRpd=await mop({op:'reserve',id:`${day}:m5`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-c',paceTokens:7500});
 assert.equal(mRpd.ok,false);assert.match(mRpd.error,/per-day/);assert.doesNotMatch(mRpd.error,/pace/);
 await mop({op:'settle',id:`${day}:m0`,amount:1,promptTokens:40,completionTokens:12,totalTokens:52});
 assert.equal(mm.get('tpm:'+day+':'+minute+':groq-a'),52);
 assert.equal(mm.get('tpm:'+day+':'+minute+':groq-b'),7500);
 assert.equal((await mop({op:'reserve',id:`${day}:m4`,ip:'x',amount:1,tokenEstimate:9000,model:'groq-a',paceTokens:7500})).ok,true);}
console.log('PASS: per-model pace windows are independent, fresh provider remaining-tokens snapshots reject over-quota admission, per-day remaining-requests exhaustion is not minute pace, settle replaces the pace estimate with the measured total in the reserve minute. No live inference used.');
{const tm=new Map();const tt={get:async k=>tm.get(k),put:async(k,v)=>tm.set(k,v)};
 const tpmDO=new BudgetDO({storage:{transaction:async fn=>fn(tt)}},{SI_DAILY_REQUESTS:50,SI_RPM:50,SI_TPM:100000,SI_DAILY_TOKENS:5000});
 const top=async body=>(await tpmDO.fetch(new Request('https://local/',{method:'POST',body:JSON.stringify(body)}))).json();
 assert.equal((await top({op:'reserve',id:`${day}:t0`,ip:'x',amount:1,tokenEstimate:2000})).ok,true);
 assert.equal((await top({op:'reserve',id:`${day}:t1`,ip:'x',amount:1,tokenEstimate:2000})).ok,true);
 const pTpm=await top({op:'reserve',id:`${day}:t2`,ip:'x',amount:1,tokenEstimate:2000});
 assert.equal(pTpm.ok,false);assert.match(pTpm.error,/token allowance/);
 await top({op:'settle',id:`${day}:t0`,amount:1,promptTokens:300,completionTokens:100,totalTokens:400});
 assert.equal((await top({op:'reserve',id:`${day}:t3`,ip:'x',amount:1,tokenEstimate:2000})).ok,true);}
await op({op:'putAnswer',key:'test',answer:{ok:true}});assert.deepEqual((await op({op:'getAnswer',key:'test'})).answer,{ok:true});
assert.equal((await op({op:'reserve',id:'2020-01-01:old',ip:'x',amount:1})).ok,false);
const cached=new Map();globalThis.caches={default:{match:async req=>cached.get(req.url)?.clone(),put:async(req,res)=>cached.set(req.url,res.clone())}};
const env={BUDGET:{idFromName:x=>x,get:()=>({fetch:async(_,opts)=>obj.fetch(new Request('https://local/',opts))})}};
const request=body=>new Request('https://local/api/si',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
for(const query of ['Which investigation proves fires cannot start in space?','Certify a safe oxygen threshold']) {
 const r=await gateway.fetch(request({kind:'rank',query}),env);const a=await r.json();assert.equal(r.status,200);assert.equal(a.route,'local-safety-guardrail');assert.deepEqual(a.result.ranking,[]);assert.equal(a.usage.requests,0);
}
for(const body of [{kind:'rank',query:{}},{kind:'rank',query:'a'},{kind:'investigate',id:69},null,[]]) assert.equal((await gateway.fetch(request(body),env)).status,400);
assert.equal((await gateway.fetch(request({kind:'synthesize'}),{})).status,503);
console.log('PASS: kind schemas, truncation, invalid evidence/IDs, source-tag mismatch, numeric provenance, concurrent request budget, replay/settlement idempotency, pre-provider refund / provider-attempt retention, token counters, conservative token-hold reserve+release, measured-total preference, missing-usage hold retention, provider RPM pace rejection, daily token-hold reservation + release on settle, UTC boundary, durable answer retrieval, safety premises, malformed inputs, fail-closed storage. No live inference used.');
let calls=0, responseMode='valid', fallbackStart=0;
const data={investigations:[{...record,summary:record.teamSummary,tables:[]}]};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('raw.githubusercontent.com')) return Response.json(data);
 calls++;
 const groq=(finish,obj)=>({choices:[{finish_reason:finish,message:{content:typeof obj==='string'?obj:JSON.stringify(obj)}}],usage:{prompt_tokens:40,completion_tokens:12,total_tokens:52}});
 if(responseMode==='fallback' && calls===fallbackStart+1) return Response.json(groq('length','{'));
 if(responseMode==='429') return Response.json({error:'free quota exhausted'},{status:429});
 if(responseMode==='diag') return Response.json({error:{code:'invalid_request_error',message:'max_tokens is not supported for this model; use max_completion_tokens'}},{status:400});
 if(responseMode==='invalid') return Response.json(groq('length','{"summary":"truncated'));
 return Response.json(groq('stop',valid));
};
const makeEnv=(cap=10)=>{const m=new Map();const t={get:async k=>m.get(k),put:async(k,v)=>m.set(k,v)};const o=new BudgetDO({storage:{transaction:async fn=>fn(t)}},{SI_DAILY_REQUESTS:cap});return {GROQ_API_KEY:'fixture',GROQ_MODELS:'groq-a,groq-b',BUDGET:{idFromName:x=>x,get:()=>({fetch:async(_,opts)=>o.fetch(new Request('https://local/',opts))})}};};
const fullEnv=makeEnv();
const first=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),fullEnv);assert.equal(first.status,200);const fa=await first.json();assert.deepEqual(fa.usage,{requests:1,promptTokens:40,completionTokens:12,totalTokens:52});assert.equal(fa.provider,'groq');assert.equal(fa.model,'groq-a');const firstCount=calls;
const second=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),fullEnv);assert.equal((await second.json()).cached,true);assert.equal(calls,firstCount);
responseMode='429';const before429=calls;const failed=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),makeEnv());assert.equal(failed.status,503);assert.equal(calls,before429+2);
responseMode='diag';const warns=[];const origWarn=console.warn;console.warn=(...a)=>warns.push(a.join(' '));
const diagResp=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),makeEnv());console.warn=origWarn;const dj=await diagResp.json();
assert.equal(diagResp.status,503);assert.match((dj.failures||[]).join(' '),/invalid_request_error/);assert.ok(!JSON.stringify(dj).includes('max_tokens is not supported'));assert.ok(!JSON.stringify(dj).includes('Bearer'));assert.ok(warns.some(w=>w.includes('max_tokens is not supported')));assert.ok(!warns.join(' ').includes('Bearer'));
console.log('PASS: provider HTTP error code public in failure diagnostics, sanitized message server-side only (console); no message/template echo, credentials or prompts in the public response. No live inference used.');
// rank/synthesize admission at production-size index payload: a 22.4K-char
// prompt class paces at ~7.6K with the 1536 output bound (admitted) but
// ~8.2K with the old 2048 bound (deterministically rejected at admission,
// zero provider calls). Provider contact below proves admission happened.
{const saved=data.investigations;
 data.investigations=Array.from({length:24},(_,i)=>({id:`PSI-${100+i}`,acronym:'TST',title:'Test record title',type:'Completed',subArea:'Combustion',platform:'ISS',summary:'X'.repeat(450),safetyFunctions:['Detection'],fuelClasses:['Gas'],tables:[{rows:12,fuels:['Methane']}],psiUrl:'https://psi.nasa.gov/'}));
 const beforePad=calls;responseMode='invalid';
 await gateway.fetch(request({kind:'rank',query:'habitat fire prevention criterion'}),makeEnv());
 assert.ok(calls>beforePad);
 responseMode='valid';data.investigations=saved;}
console.log('PASS: production-size rank/synthesize prompt class (22.4K chars) is admitted with the 1536 output bound; the 2048 bound blocked this class deterministically. No live inference used.');
responseMode='invalid';const beforeInvalid=calls;assert.equal((await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),makeEnv())).status,503);assert.ok(calls>beforeInvalid);
responseMode='valid';const beforeCap=calls;const exhausted=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),makeEnv(0));assert.equal(exhausted.status,503);assert.equal(calls,beforeCap);
console.log('PASS: mocked full HTTP path valid -> durable hit, measured request+token telemetry, provider quota 429 exhausts every tier then fails closed, truncated output never returned as ok, zero-budget fail-closed before provider. No live inference used.');

assert.equal(unsupportedSafetyPremise('Which investigations cannot be compared directly because their rigs differ?'),false);
const beginEnv=new BudgetDO({storage:{transaction:async fn=>fn(tx)}},{});
for(let i=0;i<6;i++) assert.equal((await beginEnv.fetch(new Request('https://x/',{method:'POST',body:JSON.stringify({op:'begin',id:`${day}:begin${i}`,ip:'fair'})}))).status,200);
const seventh=await (await beginEnv.fetch(new Request('https://x/',{method:'POST',body:JSON.stringify({op:'begin',id:`${day}:begin7`,ip:'fair'})}))).json();assert.equal(seventh.ok,false);
const falseTagRank={...rank, ranking:[{...rank.ranking[0],why:'PSI-69 did this [objective].'}], evidence:[{...rank.evidence[0],claim:'PSI-69 did this [objective].'}]};assert.equal(check(falseTagRank,'stop','rank'),null);
assert.equal(check({...valid,keyFindings:[claim.replace('[approach]','[conditions table: PSI-69_Experimental table_FLEX.csv]'),claim,claim]}),null);
console.log('PASS: request-level fairness, benign negation not blocked.');

{const nm=new Map();const nt={get:async k=>nm.get(k),put:async(k,v)=>nm.set(k,v)};
 const nd=new BudgetDO({storage:{transaction:async fn=>fn(nt)}},{SI_DAILY_REQUESTS:9});
 const nEnv={GROQ_API_KEY:'fixture',GROQ_MODELS:'groq-a',BUDGET:{idFromName:x=>x,get:()=>({fetch:async(_,opts)=>nd.fetch(new Request('https://local/',opts))})}};
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('raw.githubusercontent.com')) return Response.json(data);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(valid)}}],usage:{prompt_tokens:40,completion_tokens:12}});};
 const nr=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),nEnv);const nj=await nr.json();
 assert.equal(nr.status,200);assert.equal(nj.usage,null);
 assert.ok((nm.get('tokhold:'+day)||0)>0);assert.equal(nm.get('ttok:'+day)??0,0);
 globalThis.fetch=savedFetch;}
console.log('PASS: usage without total_tokens is unmeasured: answer served with usage null, conservative hold retained, no assumed-zero release. No live inference used.');
responseMode='fallback';fallbackStart=calls;const fallback=await gateway.fetch(request({kind:'investigate',id:'PSI-69'}),makeEnv());const fb=await fallback.json();assert.equal(fallback.status,200);assert.equal(fb.model,'groq-b');assert.equal(fb.fallbacks.length,1);assert.equal(fb.usage.requests,2);assert.equal(fb.usage.promptTokens,80);assert.equal(fb.usage.totalTokens,104);assert.equal(calls,fallbackStart+2);
console.log('PASS: full HTTP fallback path admits primary + tier-2 in one visitor request, usage counts both provider attempts (2 requests, 80 prompt tokens); no per-IP tier starvation.');
