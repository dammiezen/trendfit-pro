const $=id=>document.getElementById(id);
let current=null, busy=false, ready=false, authenticated=false;
let clients=[];
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function list(items){const ul=node('ul',undefined,'list');items.forEach(x=>ul.append(node('li',x)));return ul;}
function section(title,items){const c=node('section',undefined,'card');c.append(node('h3',title),list(items));return c;}
function para(parent,label,text){if(!text)return;parent.append(node('h4',label,'subhead'),node('p',text,'body-text'));}
function link(text,url){const a=node('a',text,'source-link');try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return node('span',text);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{return node('span',text);}return a;}
function cite(parent,evidence){for(const e of evidence){const source=current.sources.find(s=>s.id===e.sourceId);if(!source)continue;const q=node('div',undefined,'evidence-quote');q.append(node('p',e.quote));q.append(source.url?link(source.id+' · '+(source.kind==='web_research'?'Cited research summary':source.title),source.url):node('span','Client-provided context · not independently verified'));parent.append(q);}}
function pill(parent,values){const div=node('div',undefined,'pills');values.filter(Boolean).forEach(v=>div.append(node('span',v)));parent.append(div);}
function setPanel(id,focus=false){document.querySelectorAll('[role="tab"]').forEach(b=>{const selected=b.dataset.panel===id;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;$(b.dataset.panel).hidden=!selected;if(selected&&focus)b.focus();});}
document.querySelectorAll('[role="tab"]').forEach((b,i,all)=>{b.onclick=()=>setPanel(b.dataset.panel);b.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%all.length;if(e.key==='ArrowLeft')n=(i-1+all.length)%all.length;if(e.key==='Home')n=0;if(e.key==='End')n=all.length-1;if(n!==undefined){e.preventDefault();setPanel(all[n].dataset.panel,true);}};});
function clearReport(){current=null;$('results').hidden=true;$('empty').hidden=false;['overview','strategy','actions','content','evidence','metrics'].forEach(id=>$(id).replaceChildren());}
$('clear').onclick=clearReport;
function render(data){
  current=data;const r=data.report;
  $('results').hidden=false;$('empty').hidden=true;$('sample-notice').hidden=!data.demo;
  $('report-title').textContent=r.brandName;
  $('report-meta').textContent=(data.demo?'Fictional sample':data.url)+' · '+new Date(data.createdAt).toLocaleString();
  $('report-summary').textContent=r.summary;
  ['overview','strategy','actions','content','evidence','metrics'].forEach(id=>$(id).replaceChildren());
  const counts=[[(data.coverage||[]).filter(c=>c.status==='read').length,'Pages read'],[r.findings.filter(f=>f.category==='strength').length,'Observed strengths'],[r.findings.filter(f=>f.category==='gap').length,'Gaps to address'],[r.actions.length,'Recommended actions']];
  counts.forEach(([n,label])=>{const c=node('div',undefined,'metric');c.append(node('strong',String(n)),node('span',label));$('metrics').append(c);});
  const grid=node('div',undefined,'finding-grid');
  for(const [type,title] of [['strength','What looks strong'],['gap','What needs work'],['unknown','What we cannot confirm']]){
    const col=node('div',undefined,'finding-column');col.append(node('h3',title));
    const found=r.findings.filter(f=>f.category===type);
    if(!found.length)col.append(node('p','No supported findings in this category.','body-text'));
    found.forEach(f=>{const card=node('article',undefined,'finding '+type);card.append(node('h4',f.title),node('p',f.assessment));cite(card,f.evidence);para(card,'Recommended next step',f.recommendation);pill(card,[f.priority+' priority']);col.append(card);});grid.append(col);
  }
  $('overview').append(grid,section('Before we finalise the strategy',r.questions),section('Still unknown',r.unknowns));
  r.modules.forEach(m=>{const details=node('details',undefined,'module');const summary=node('summary');const title=node('span');title.append(node('span',String(m.id).padStart(2,'0'),'number'),document.createTextNode(m.title));summary.append(title,node('span',m.status,'status'));details.append(summary);para(details,'Evidence and observations',m.observations);cite(details,m.evidence);details.append(node('h4','Recommended approach','subhead'),list(m.plan));para(details,'Tailored deliverable · draft',m.deliverable);$('strategy').append(details);});
  if(r.trends.length){const c=node('section',undefined,'card');c.append(node('h3','Current opportunities · recheck before publishing'));r.trends.forEach(t=>{const a=node('article',undefined,'finding');a.append(node('h4',t.name));pill(a,[t.total+'/100',t.decision,'Evidence date: '+t.publicationDate]);para(a,'Why this fits',t.reason);para(a,'Original angle',t.angle);a.append(list(t.hooks));para(a,'Execution',[t.format,t.funnelStage,t.cta,t.urgency].join(' · '));para(a,'Risk and uncertainty',t.risk);for(const id of t.sourceIds){const s=data.sources.find(s=>s.id===id);if(s)a.append(link(s.title,s.url),node('br'));}c.append(a);});$('strategy').append(c);}else $('strategy').append(section('Trend status',['No evidence-backed current trends are included in this report. Use the research plan in Module 6.']));
  r.actions.forEach((a,i)=>{const c=node('article',undefined,'card');const head=node('div',undefined,'action-head');const text=node('div');text.append(node('h3',a.title),node('p',a.why,'body-text'));head.append(node('span',String(i+1).padStart(2,'0'),'number'),text);c.append(head);pill(c,[a.timing,'Suggested owner: '+a.owner]);c.append(list(a.steps));para(c,'Measure',a.kpi);para(c,'Depends on',a.dependency);$('actions').append(c);});
  $('content').append(node('p','30 dated drafts — not approved, scheduled or published. Verify claims, destinations, voice, current trends and production capacity before approval.','notice'));
  const tableWrap=node('div',undefined,'card table-wrap');tableWrap.append(node('h3','30-day content calendar'));
  const table=node('table',undefined,'calendar'),thead=node('thead'),tr=node('tr');['Date','Topic / platform','Funnel job','Status'].forEach(x=>tr.append(node('th',x)));thead.append(tr);table.append(thead);const tbody=node('tbody');r.calendar.forEach(d=>{const row=node('tr');[d.date,d.topic+' · '+d.platform,d.funnelStage,d.status].forEach(v=>row.append(node('td',v)));tbody.append(row);});table.append(tbody);tableWrap.append(table);$('content').append(tableWrap);
  r.calendar.forEach(d=>{const c=node('details',undefined,'module calendar-entry');const heading=node('summary');heading.append(node('span','Day '+d.day+' · '+d.date+' — '+d.topic),node('span',d.format,'status'));c.append(heading);pill(c,[d.platform,d.funnelStage,d.pillar,d.status]);para(c,'Target buyer',d.buyerPersona);c.append(node('h4','Hook options','subhead'),list(d.hooks));para(c,'Selected hook',d.selectedHook);para(c,'Full content copy',d.copy);para(c,'Creative and production instructions',d.creativeInstructions);para(c,'Caption',d.caption);para(c,'CTA',d.cta);para(c,'Destination',d.link);para(c,'Hashtags',d.hashtags.join(' '));c.append(node('h4','Required assets','subhead'),list(d.requiredAssets));para(c,'Primary KPI',d.kpi);c.append(node('h4','Needs client confirmation','subhead'),list(d.confirmationNeeded));
  if(!data.demo && data.savedAuditId){
    const edit=node('div',undefined,'calendar-edit');edit.append(node('h4',"Edit and save this day's draft"));
    const field=(name,value,multi=false)=>{
      const label=node('label',name), control=node(multi?'textarea':'input');
      control.value=value||'';if(multi)control.rows=4;else control.type='text';
      label.append(control);edit.append(label);return control;
    };
    const caption=field('Caption',d.caption,true),copy=field('Full content copy',d.copy,true),
      creative=field('Creative instructions',d.creativeInstructions,true),cta=field('CTA',d.cta),
      destination=field('Destination',d.link),topic=field('Topic',d.topic);
    const status=node('select');['Draft','Needs Client Confirmation','In Review','Approved','Scheduled','Published'].forEach(x=>{const option=node('option',x);option.value=x;status.append(option);});
    status.value=['Draft','Needs Client Confirmation','In Review','Approved','Scheduled','Published'].includes(d.status)?d.status:'Draft';
    const statusLabel=node('label','Workflow status');statusLabel.append(status);edit.append(statusLabel);
    const save=node('button','Save calendar changes','button');save.type='button';edit.append(save);
    const message=node('p','','hint');edit.append(message);
    save.onclick=async()=>{
      save.disabled=true;message.textContent='';
      try{
        const updated=await workspaceRequest('history/'+data.savedAuditId+'/calendar/'+d.day,'PATCH',{
          caption:caption.value,copy:copy.value,creativeInstructions:creative.value,
          cta:cta.value,link:destination.value,topic:topic.value,status:status.value
        });
        Object.assign(d,updated.day);message.textContent='Saved. Reopen the audit to refresh the full report.';
      }catch(error){message.textContent=error.message;}finally{save.disabled=false;}
    };
    c.append(edit);
  }
  $('content').append(c);});
  if(r.competitors?.length){const c=node('section',undefined,'card');c.append(node('h3','Competitor evidence'));r.competitors.forEach(x=>{const a=node('article',undefined,'finding');a.append(node('h4',x.name),link(x.url,x.url));for(const key of ['positioning','audience','offer','content','proof','cta','differentiators','opportunity','limitations'])para(a,key,x[key]);c.append(a);});$('strategy').append(c);}
  $('evidence').append(section('Scope and limitations',data.limitations));
  const cov=node('section',undefined,'card');cov.append(node('h3','Access coverage'));cov.append(list(data.coverage.map(c=>c.status.toUpperCase()+' · '+c.url+'\n'+c.detail)));$('evidence').append(cov);
  data.sources.forEach(s=>{const c=node('article',undefined,'source-card');c.append(node('h3',s.id+' · '+s.title),node('p',s.kind.replaceAll('_',' ')+' · Checked '+new Date(s.checkedAt).toLocaleString()));if(s.url)c.append(link(s.url,s.url));if(s.kind==='web_research')c.append(node('p','Evidence excerpts from this source are AI research summaries with citations, not original-source quotations.'));$('evidence').append(c);});
  $('evidence').append(section('Default workflow and skill version',[data.command||'/audit', 'Skill SHA-256: '+(data.skillHash||'Illustrative sample')]));
  setPanel('overview');$('report-title').focus();
}
function showError(message,coverage=[]){$('error').textContent=message+(coverage.length?'\n\n'+coverage.map(c=>c.url+' — '+c.detail).join('\n'):'');$('error').hidden=false;}
function setBusy(value){busy=value;$('progress').hidden=!value;$('run').disabled=value||!ready||!authenticated;$('sample').disabled=value;$('audit-form').querySelectorAll('input,select,textarea,details').forEach(el=>{if('disabled' in el)el.disabled=value;});$('run').textContent=value?'Preparing your audit…':'Audit this brand ↗';}
async function api(path,body){const response=await fetch('api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(300000)});let data;try{data=await response.json();}catch{throw new Error('The private audit service is unavailable. Follow the setup guide to start it.');}if(!response.ok){const e=new Error(data.error||'Something went wrong.');e.coverage=data.coverage;e.status=response.status;throw e;}return data;}
async function status(){try{const s=await api('status');ready=s.ready;authenticated=s.authenticated;}catch{ready=false;authenticated=false;}$('workspace').hidden=!authenticated;if(authenticated)loadWorkspace().catch(error=>$('workspace-message').textContent=error.message);$('setup').hidden=ready;$('unlock').hidden=!ready||authenticated;$('logout').hidden=!authenticated;$('connection').textContent=!ready?'Setup required':authenticated?'● Workspace unlocked':'● Private workspace';$('run').disabled=!ready||!authenticated||busy;}
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-message').textContent='';try{await api('login',{password:$('password').value});$('password').value='';await status();}catch(error){$('login-message').textContent=error.message;}};
$('logout').onclick=async()=>{try{await api('logout',{});clearReport();await status();}catch(error){showError(error.message);}};
$('audit-form').onsubmit=async e=>{e.preventDefault();if(busy||!ready||!authenticated)return;
  const links=[['url','Website'],['instagram','Instagram'],['facebook','Facebook'],['linkedin','LinkedIn'],['other','Other social profile']].filter(([id])=>$(id).value.trim()).map(([id,label])=>({label,url:$(id).value.trim()}));
  if(!links.length){showError('Add at least one official website or social profile.');$('url').focus();return;}
  clearReport();$('error').hidden=true;setBusy(true);
  try{const started=await api('audit',{links,objective:$('objective').value,region:$('region').value.trim()||'Not supplied — research and confirm',notes:[$('notes').value.trim(),...selectedClientContext()].filter(Boolean).join('\n\n').slice(0,20000),startDate:$('start-date').value,consent:$('consent').checked,clientId:$('client-select').value||null});
    const deadline=Date.now()+40*60000;
    while(Date.now()<deadline){const job=await api('audit/'+started.id);$('progress-title').textContent=job.stage||'Preparing your audit';if(job.state==='complete'){render(job.result);loadWorkspace().catch(()=>{});return;}if(job.state==='failed'){const error=new Error(job.error);error.coverage=job.coverage;throw error;}await new Promise(resolve=>setTimeout(resolve,2500));}
    throw new Error('The audit has exceeded the waiting limit. Ask the app owner to check the service before retrying.');
  }catch(error){showError(error.name==='TimeoutError'?'The connection timed out. The audit may still be finishing; check the service before retrying.':error.message,error.coverage);if(error.status===401)await status();}finally{setBusy(false);}
};
const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);$('start-date').value=[tomorrow.getFullYear(),String(tomorrow.getMonth()+1).padStart(2,'0'),String(tomorrow.getDate()).padStart(2,'0')].join('-');
$('sample').onclick=async()=>{if(busy)return;$('error').hidden=true;try{const response=await fetch('sample.json');if(!response.ok)throw Error();render(await response.json());}catch{showError('The sample report could not be loaded.');}};
// Input edits cannot leave a previous brand's report labelled as the new audit.
['url','instagram','facebook','linkedin','other','objective','region','notes','start-date'].forEach(id=>$(id).addEventListener('input',()=>{if(current)clearReport();}));
function fullText(data){
  const r=data.report;const lines=[data.demo?'ILLUSTRATIVE SAMPLE — NOT A LIVE AUDIT':'TRENDFIT PRO — BRAND AUDIT',r.brandName,data.url,data.createdAt,'Status: Draft for review. Nothing has been published.','',r.summary];
  const add=(heading,content)=>lines.push('',heading.toUpperCase(),...(Array.isArray(content)?content:[content]));
  add('Scope and limitations',data.limitations);add('Access coverage',data.coverage.map(c=>c.url+' — '+c.status+': '+c.detail));
  for(const f of r.findings)add(f.category+': '+f.title,[f.assessment,...f.evidence.map(e=>'Evidence '+e.sourceId+': '+e.quote),'Recommendation: '+f.recommendation,'Priority: '+f.priority]);
  for(const m of r.modules)add(m.id+'. '+m.title,[m.status,m.observations,...m.evidence.map(e=>'Evidence '+e.sourceId+': '+e.quote),...m.plan.map(p=>'• '+p),m.deliverable]);
  for(const t of r.trends)add('Trend: '+t.name,[JSON.stringify(t,null,2)]);
  for(const a of r.actions)add('Action: '+a.title,[a.why,...a.steps,'Owner: '+a.owner,'Timing: '+a.timing,'KPI: '+a.kpi,'Dependency: '+a.dependency]);
  add('Competitors',r.competitors.map(c=>JSON.stringify(c,null,2)));
  add('Reusable brand profile — proposals, not approvals',JSON.stringify(r.brandProfile,null,2));
  for(const d of r.calendar)add('Day '+d.day+' · '+d.date+' · '+d.topic,[d.platform+' · '+d.format+' · '+d.funnelStage,'Pillar: '+d.pillar,'Buyer: '+d.buyerPersona,'Status: '+d.status,'Hooks:',...d.hooks,'Selected hook: '+d.selectedHook,'Full copy:',d.copy,'Creative instructions:',d.creativeInstructions,'Caption:',d.caption,'CTA: '+d.cta,'Link: '+d.link,'Hashtags: '+d.hashtags.join(' '),'Required assets:',...d.requiredAssets,'KPI: '+d.kpi,'Needs client confirmation:',...d.confirmationNeeded]);
  add('Workflow',data.command||'/audit');add('Skill SHA-256',data.skillHash||'Illustrative sample');
  add('Questions',r.questions);add('Unknowns',r.unknowns);add('Sources',data.sources.map(s=>s.id+' · '+s.title+' · '+s.kind+' · '+(s.url||'Client context')+' · '+s.checkedAt));return lines.join('\n');
}
$('export').onclick=()=>{if(!current)return;const url=URL.createObjectURL(new Blob([fullText(current)],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download='trendfit-'+(current.demo?'sample':'audit')+'-'+new Date(current.createdAt).toISOString().slice(0,10)+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let beforePrint=[];
window.addEventListener('beforeprint',()=>{beforePrint=[...document.querySelectorAll('#results details')].map(d=>[d,d.open]);beforePrint.forEach(([d])=>d.open=true);});
window.addEventListener('afterprint',()=>beforePrint.forEach(([d,open])=>d.open=open));
$('print').onclick=()=>window.print();

function selectedClientContext(){
 const p=clients.find(x=>x.id===$('client-select').value);
 if(!p)return [];
 return [p.voice&&'Brand voice rules: '+p.voice,p.audience&&'Target audience: '+p.audience,p.approvedContext&&'Client-approved context (verify currency before use): '+p.approvedContext].filter(Boolean);
}
async function workspaceRequest(path,method='GET',body){
 const response=await fetch('api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 if(response.status===204)return {};
 const data=await response.json().catch(()=>({error:'Unexpected server response'}));
 if(!response.ok)throw new Error(data.error||'Unable to update workspace');
 return data;
}
function fillClient(){
 const p=clients.find(x=>x.id===$('client-select').value);
 $('client-name').value=p?.name||'';$('client-voice').value=p?.voice||'';
 $('client-audience').value=p?.audience||'';$('client-approved').value=p?.approvedContext||'';
 if(p){
   const links=p.links||[];
   for(const [id,label] of [['url','Website'],['instagram','Instagram'],['facebook','Facebook'],['linkedin','LinkedIn'],['other','Other social profile']]){
     $(id).value=links.find(x=>x.label===label)?.url||'';
   }
   $('region').value=p.region||'';
   if(p.objective && [...$('objective').options].some(x=>x.value===p.objective))$('objective').value=p.objective;
   $('notes').value=p.notes||'';
   if(current)clearReport();
 }
 refreshHistory().catch(error=>$('workspace-message').textContent=error.message);
}
async function refreshHistory(){
 const clientId=$('client-select').value;
 const data=await workspaceRequest('history'+(clientId?'?clientId='+encodeURIComponent(clientId):''));
 const menu=$('history-select');menu.replaceChildren(new Option('Choose a previous audit',''));
 for(const a of data.audits)menu.add(new Option(a.brandName+' · '+new Date(a.createdAt).toLocaleString()+' · '+a.days+' days',a.id));
}
async function loadWorkspace(){
 const selected=$('client-select').value;
 const data=await workspaceRequest('clients');clients=data.clients;
 const menu=$('client-select');menu.replaceChildren(new Option('New / unsaved client',''));
 for(const p of clients)menu.add(new Option(p.name,p.id));
 if(clients.some(x=>x.id===selected))menu.value=selected;
 await refreshHistory();
}
$('client-select').onchange=fillClient;
$('refresh-workspace').onclick=()=>loadWorkspace().catch(error=>$('workspace-message').textContent=error.message);
$('new-client').onclick=()=>{$('client-select').value='';fillClient();$('client-name').focus();};
$('save-client').onclick=async()=>{
 const id=$('client-select').value;
 const links=[['url','Website'],['instagram','Instagram'],['facebook','Facebook'],['linkedin','LinkedIn'],['other','Other social profile']].filter(([x])=>$(x).value.trim()).map(([x,label])=>({label,url:$(x).value.trim()}));
 const payload={name:$('client-name').value,links,objective:$('objective').value,region:$('region').value,notes:$('notes').value,voice:$('client-voice').value,audience:$('client-audience').value,approvedContext:$('client-approved').value};
 try{const response=await workspaceRequest(id?'clients/'+id:'clients',id?'PUT':'POST',payload);await loadWorkspace();$('client-select').value=response.client.id;$('workspace-message').textContent='Client profile saved.';await refreshHistory();}
 catch(error){$('workspace-message').textContent=error.message;}
};
$('delete-client').onclick=async()=>{
 const id=$('client-select').value;if(!id||!confirm('Delete this profile? Existing audits remain in history.'))return;
 try{await workspaceRequest('clients/'+id,'DELETE');$('client-select').value='';await loadWorkspace();fillClient();$('workspace-message').textContent='Profile deleted; audit history preserved.';}catch(error){$('workspace-message').textContent=error.message;}
};
$('open-history').onclick=async()=>{
 if(!$('history-select').value)return;
 try{const a=await workspaceRequest('history/'+$('history-select').value);a.result.savedAuditId=a.id;render(a.result);$('workspace-message').textContent='Loaded saved audit.';}catch(error){$('workspace-message').textContent=error.message;}
};
$('delete-history').onclick=async()=>{
 const id=$('history-select').value;if(!id||!confirm('Permanently delete this saved audit and calendar?'))return;
 try{await workspaceRequest('history/'+id,'DELETE');if(current?.savedAuditId===id)clearReport();await refreshHistory();$('workspace-message').textContent='Audit deleted.';}catch(error){$('workspace-message').textContent=error.message;}
};

status();
