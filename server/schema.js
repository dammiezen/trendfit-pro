import Ajv from 'ajv';
export const MODULES = ['Executive brand summary','Sources reviewed and research limitations','Website audit','Social media audit','Marketing funnel audit','SWOT analysis','Competitor analysis','Buyer persona and psychology map','Brand positioning recommendations','Trend intelligence and opportunity ranking','Recommended marketing strategy','Content pillars and funnel plan','Platform-specific recommendations','Lead generation and conversion improvements','First 30-day content calendar','KPI framework','Priority action plan','Client confirmation questions'];
const str = {type:'string'};
const strings = {type:'array',items:str};
const obj = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const arr = items => ({type:'array',items});
const evidence = obj({sourceId:str,quote:str});
const score={type:'integer',minimum:0,maximum:5};
export const schema = obj({
  brandName:str,summary:str,unknowns:strings,questions:strings,
  findings:arr(obj({title:str,category:{type:'string',enum:['strength','gap','unknown']},assessment:str,evidence:arr(evidence),recommendation:str,priority:{type:'string',enum:['high','medium','low']}})),
  modules:arr(obj({id:{type:'integer',minimum:1,maximum:18},status:{type:'string',enum:['evidence available','partial evidence','needs information']},observations:str,evidence:arr(evidence),plan:strings,deliverable:str})),
  actions:arr(obj({title:str,why:str,steps:strings,owner:str,timing:str,kpi:str,dependency:str})),
  competitors:arr(obj({name:str,url:str,sourceIds:strings,positioning:str,audience:str,offer:str,content:str,proof:str,cta:str,differentiators:str,opportunity:str,limitations:str})),
  brandProfile:obj({industry:str,businessModel:str,geography:str,audience:str,offers:str,valueProposition:str,voice:str,pillars:strings,proposedCtas:strings,restrictedClaims:strings,campaignGoals:strings,approvalContact:str,analyticsBaseline:str}),
  trends:arr(obj({name:str,category:{type:'string',enum:['industry','audience','content','platform']},sourceIds:strings,publicationDate:str,observationDate:str,popularityEvidence:str,market:str,reason:str,scores:obj({audience:score,alignment:score,timeliness:score,business:score,credibility:score}),angle:str,hooks:strings,format:str,funnelStage:str,cta:str,urgency:str,risk:str,safety:{type:'string',enum:['clear','review','reject']}}))
});
export const calendarSchema=obj({calendar:arr(obj({day:{type:'integer',minimum:1,maximum:30},date:str,platform:str,pillar:str,buyerPersona:str,funnelStage:{type:'string',enum:['awareness','nurture','lead generation','positioning','conversion']},topic:str,format:str,hooks:strings,selectedHook:str,copy:str,creativeInstructions:str,caption:str,cta:str,link:str,hashtags:strings,requiredAssets:strings,kpi:str,status:{type:'string',enum:['DRAFT — NEEDS APPROVAL']},confirmationNeeded:strings}))});
const ajv=new Ajv({allErrors:true});
const validate=ajv.compile(schema),validateCalendarSchema=ajv.compile(calendarSchema);
export function trendScore(scores){return Math.round(scores.audience*6+scores.alignment*5+scores.timeliness*3+scores.business*4+scores.credibility*2);}
export function validateReport(report,sources){
  if(!validate(report))throw new Error('The analysis returned an incomplete strategy. Please try again.');
  if(report.modules.length!==18||new Set(report.modules.map(m=>m.id)).size!==18)throw new Error('The analysis did not cover all 18 strategy sections. Please try again.');
  const sourceMap=new Map(sources.map(s=>[s.id,s]));
  const normal=s=>s.replace(/\s+/g,' ').trim().toLowerCase();
  const validEvidence=e=>sourceMap.has(e.sourceId)&&e.quote.length>=8&&normal(sourceMap.get(e.sourceId).text).includes(normal(e.quote));
  for(const f of report.findings){f.evidence=f.evidence.filter(validEvidence);if(!f.evidence.length&&f.category!=='unknown'){f.category='unknown';f.assessment='Needs Client Confirmation: '+f.assessment;}}
  for(const m of report.modules){m.evidence=m.evidence.filter(validEvidence);if(!m.evidence.length)m.status='needs information';m.title=MODULES[m.id-1];}
  report.modules.sort((a,b)=>a.id-b.id);
  report.competitors=report.competitors.filter(c=>c.sourceIds.length&&c.sourceIds.every(id=>sourceMap.has(id)));
  const now=Date.now(),oldest=now-90*86400000;
  report.trends=report.trends.filter(t=>{
    const date=Date.parse(t.publicationDate);
    return t.sourceIds.length>0&&t.sourceIds.every(id=>sourceMap.get(id)?.kind==='web_research')&&t.hooks.length>=3&&Number.isFinite(date)&&date>=oldest&&date<=now;
  });
  report.trends.forEach(t=>{t.total=trendScore(t.scores);t.decision=t.safety==='reject'?'Reject — safety risk':t.safety==='review'?'Hold — safety review required':t.total>=80?'Strong candidate':t.total>=60?'Consider controlled testing':'Generally reject or rework';});
  report.trends.sort((a,b)=>b.total-a.total);
  return report;
}
export function validateCalendar(data,startDay,count,startDate){
  if(!validateCalendarSchema(data)||data.calendar.length!==count)throw new Error('The calendar batch is incomplete. Please try again.');
  const expected=Array.from({length:count},(_,i)=>startDay+i);
  if(new Set(data.calendar.map(d=>d.day)).size!==count||data.calendar.some(d=>!expected.includes(d.day)||d.hooks.length<3||!d.copy.trim()||!d.creativeInstructions.trim()))throw new Error('Calendar days or production copy are missing. Please try again.');
  data.calendar.sort((a,b)=>a.day-b.day);
  for(const d of data.calendar){const date=new Date(startDate+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+d.day-1);d.date=date.toISOString().slice(0,10);d.status='DRAFT — NEEDS APPROVAL';}
  return data.calendar;
}
