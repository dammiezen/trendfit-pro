import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicAddress,validateUrl,extract,crawl} from '../server/crawl.js';
import {MODULES,validateReport,validateCalendar,trendScore} from '../server/schema.js';
import {audit,outputText,researchSources} from '../server/audit.js';
import {auditPrompt,skill,skillHash} from '../server/workflow.js';
import {createApp} from '../server/index.js';
const sample=JSON.parse(await readFile(new URL('../public/sample.json',import.meta.url),'utf8'));
function strategy(){const r=structuredClone(sample.report);delete r.calendar;r.modules.forEach(m=>delete m.title);return r;}
const completed=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});

test('public fetch rejects local, credentialled, non-HTTPS and obfuscated targets',()=>{
  for(const url of ['http://example.com','https://127.0.0.1','https://2130706433','https://0x7f000001','https://[::1]','https://[::ffff:127.0.0.1]','https://169.254.169.254','https://10.0.0.1','https://localhost','https://x.local','https://user:password@example.com','https://example.com:8443'])assert.throws(()=>validateUrl(url),url);
  for(const addr of ['127.0.0.1','10.0.0.1','192.168.1.2','169.254.169.254','100.64.0.1','::1','fe80::1','::ffff:10.0.0.1'])assert.equal(publicAddress(addr),false,addr);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(validateUrl('https://example.com/#x').href,'https://example.com/');
});
test('HTML extraction removes scripts, hidden text and collects visible evidence',()=>{
  const page=extract('<html><head><title>Studio</title><meta name="description" content="Design for cafes"></head><body><h1>Brand design</h1><p>Useful text.</p><script>steal()</script><div hidden>Hidden</div><a href="/about">About</a></body></html>','https://example.com/');
  assert.equal(page.title,'Studio');assert.equal(page.description,'Design for cafes');assert(!page.text.includes('steal'));assert(!page.text.includes('Hidden'));assert.equal(page.links[0].url,'https://example.com/about');
});
test('crawler honours robots and reports blocked pages without fake evidence',async()=>{
  const calls=[];const result=await crawl('https://example.com/',{fetcher:async url=>{calls.push(url);return {status:200,headers:{},text:'User-agent: *\nDisallow: /',url};}});
  assert.equal(result.sources.length,0);assert.equal(result.coverage[0].status,'unavailable');assert.equal(calls.length,1);
});
test('crawler bounds scope and reports actual accessible pages',async()=>{
  const html='<html><head><title>Studio</title></head><body><p>'+('Clear design for hospitality founders. '.repeat(10))+'</p><a href="/about">About</a><a href="/contact">Contact</a></body></html>';
  const result=await crawl('https://example.com/',{limit:2,fetcher:async url=>({status:url.endsWith('robots.txt')?404:200,headers:{'content-type':'text/html'},text:html,url})});
  assert.equal(result.sources.length,2);assert.equal(result.coverage.length,2);
});
test('weighted score and safety override follow updated skill',()=>{
  assert.equal(trendScore({audience:5,alignment:5,timeliness:5,business:5,credibility:5}),100);
  assert.equal(trendScore({audience:5,alignment:0,timeliness:0,business:0,credibility:0}),30);
  const r=strategy();r.trends=[{name:'Example',category:'industry',sourceIds:['R1'],publicationDate:new Date().toISOString().slice(0,10),observationDate:new Date().toISOString().slice(0,10),popularityEvidence:'No growth statistics',market:'Example',reason:'Example',scores:{audience:5,alignment:5,timeliness:5,business:5,credibility:5},angle:'Example',hooks:['one','two','three'],format:'Post',funnelStage:'awareness',cta:'Read',urgency:'Review now',risk:'Misleading claim',safety:'reject'}];
  assert.equal(validateReport(r,[{id:'R1',text:'Example evidence',kind:'web_research'}]).trends[0].decision,'Reject — safety risk');
});
test('unsupported evidence becomes unverified and stale trends are not ranked',()=>{
  const r=strategy();r.findings[0].evidence=[{sourceId:'S1',quote:'A quote not present'}];
  const valid=validateReport(r,[{id:'S1',text:'Actual source content',kind:'public_page'}]);assert.equal(valid.findings[0].category,'unknown');assert(valid.findings[0].assessment.startsWith('Needs Client Confirmation'));
  const missing=strategy();missing.modules.pop();assert.throws(()=>validateReport(missing,[]));
});
test('calendar validation prevents omissions, duplicate days and wrong status',()=>{
  const data={calendar:structuredClone(sample.report.calendar.slice(0,5))};
  const days=validateCalendar(data,1,5,'2026-12-29');assert.equal(days[4].date,'2027-01-02');assert.equal(days[0].status,'DRAFT — NEEDS APPROVAL');
  days[1].day=1;assert.throws(()=>validateCalendar(data,1,5,'2026-12-29'));
});
test('default /audit invocation and exact supplied skill are used',()=>{
  const command=auditPrompt([{label:'Website',url:'https://example.com'},{label:'Instagram',url:'https://instagram.com/example'}]);
  assert(command.startsWith('/audit\n\nWebsite:'));assert(command.includes('30-day content plan'));assert(command.includes('Do not publish or schedule anything.'));assert(skill.includes('PHASE 16 — QUALITY CONTROL'));assert.equal(skillHash.length,64);
});
test('AI incomplete/refusal outputs fail instead of showing a success report',()=>{
  assert.throws(()=>outputText({status:'incomplete',output:[]}));assert.throws(()=>outputText({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}));
});
test('research citations must be public links and are explicitly summaries',()=>{
  const r=completed('A source-backed observation about public brand positioning.');r.output[0].content[0].annotations=[{type:'url_citation',url:'https://example.com',title:'Example',start_index:5,end_index:15},{type:'url_citation',url:'javascript:alert(1)',start_index:5,end_index:15}];assert.equal(researchSources(r).length,1);assert.equal(researchSources(r)[0].kind,'web_research');
});
test('complete pipeline executes research, 18-section skill and 6 calendar batches',async()=>{
  const calls=[];let batch=0;
  const input={links:[{label:'Website',url:'https://example.com/'}],notes:'',region:'Australia',objective:'Qualified enquiries',startDate:'2026-12-01'};
  const report=await audit(input,{}, {crawl:async()=>({sources:[{id:'S1',url:'https://example.com/',title:'Example',kind:'public_page',checkedAt:new Date().toISOString(),text:'A useful public brand description.'}],coverage:[{url:'https://example.com/',status:'read',detail:'Read public text'}]}),callModel:async payload=>{calls.push(payload);if(payload.tools)return completed('No verifiable current trends found.');if(payload.text.format.name==='brand_audit')return completed(JSON.stringify(strategy()));const entries=structuredClone(sample.report.calendar.slice(batch*5,++batch*5));return completed(JSON.stringify({calendar:entries}));}});
  assert.equal(calls.length,8);assert.equal(report.report.calendar.length,30);assert.equal(report.report.modules.length,18);assert.equal(report.report.calendar[29].date,'2026-12-30');assert.equal(report.skillHash,skillHash);
  assert(calls.every(c=>c.instructions.includes('UNIVERSAL BRAND MARKETING STRATEGIST')));assert(calls[1].input.includes('/audit'));assert(report.limitations.some(x=>x.includes('no usable citations')));
});
test('no usable evidence stops analysis instead of inventing the brand',async()=>{
  await assert.rejects(()=>audit({links:[{label:'Instagram',url:'https://instagram.com/example'}],notes:'',region:'',objective:'',startDate:'2026-12-01'}, {}, {crawl:async()=>({sources:[],coverage:[{url:'https://instagram.com/example',status:'unavailable',detail:'Blocked'}]}),callModel:async()=>completed('No accessible evidence.')}),/No usable public evidence/);
});

test('private API requires setup, correct origin/session and isolates job access',async t=>{
  const config={key:'test-only-not-a-key',password:'test-password-long-enough',model:'test',origin:'http://localhost:3000'};
  const app=createApp(config,async(input,config,deps,progress)=>{progress('Testing');return {test:true};});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port;
  const post=(path,body,cookie='',origin=config.origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',origin,cookie},body:JSON.stringify(body)});
  assert.equal((await post('/api/login',{password:config.password},'','https://evil.example')).status,403);
  assert.equal((await post('/api/audit',{})).status,401);
  assert.equal((await post('/api/login',{password:'wrong'})).status,401);
  const login=await post('/api/login',{password:config.password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert(login.headers.get('set-cookie').includes('HttpOnly'));
  const body={links:[{label:'Website',url:'https://example.com'}],notes:'',objective:'Leads',region:'Australia',startDate:'2026-12-01',consent:true};
  assert.equal((await post('/api/audit',{...body,consent:false},cookie)).status,400);
  assert.equal((await post('/api/audit',{...body,startDate:'2026-02-31'},cookie)).status,400);
  assert.equal((await post('/api/audit',{...body,links:[{label:'Website',url:'https://127.0.0.1'}]},cookie)).status,400);
  const started=await post('/api/audit',body,cookie);assert.equal(started.status,202);const {id}=await started.json();
  assert.equal((await fetch(base+'/api/audit/'+id)).status,401);
  const login2=await post('/api/login',{password:config.password});const cookie2=login2.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/audit/'+id,{headers:{cookie:cookie2}})).status,404);
  const result=await fetch(base+'/api/audit/'+id,{headers:{cookie}});assert.equal((await result.json()).state,'complete');
  assert.equal((await fetch(base+'/server/strategy.md')).status,404);
  const html=await fetch(base+'/');assert(html.headers.get('content-security-policy').includes("script-src 'self'"));assert((await html.text()).includes('/audit'));
});
