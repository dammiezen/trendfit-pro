import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

const text=(value,max=2000)=>typeof value==='string'?value.trim().slice(0,max):'';
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
const clone=value=>structuredClone(value);
const safeDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))?value:null;
const validLink=value=>{if(typeof value!=='string'||!value)return '';try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};

export function createStore(directory=process.env.DATA_DIR||'.data'){
  const root=resolve(directory);mkdirSync(root,{recursive:true,mode:0o700});
  const file=join(root,'workspace.json');
  let db={version:1,profiles:[],audits:[]};
  try{const found=JSON.parse(readFileSync(file,'utf8'));if(found.version!==1||!Array.isArray(found.profiles)||!Array.isArray(found.audits))throw Error('Unsupported store format');db=found;}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const save=()=>{
    const temp=join(root,'.workspace-'+randomUUID()+'.tmp');
    writeFileSync(temp,JSON.stringify(db),{mode:0o600,flag:'wx'});
    renameSync(temp,file);
  };
  const getProfile=id=>db.profiles.find(p=>p.id===id);
  const profiles=()=>clone(db.profiles).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const upsertProfile=(data,id)=>{
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid profile');
    const name=text(data.name,120);if(!name)throw Error('Client name is required');
    const links=(Array.isArray(data.links)?data.links:[]).slice(0,6).map(item=>({label:text(item.label,40),url:validLink(item.url)})).filter(x=>x.label&&x.url);
    const now=new Date().toISOString();
    let p=id?getProfile(id):null;if(id&&!p)throw Error('Client profile not found');
    if(p){Object.assign(p,{name,links,region:text(data.region,120),objective:text(data.objective,500),notes:text(data.notes,20000),voice:text(data.voice,3000),audience:text(data.audience,3000),approvedContext:text(data.approvedContext,10000),updatedAt:now});}
    else{p={id:randomUUID(),name,links,region:text(data.region,120),objective:text(data.objective,500),notes:text(data.notes,20000),voice:text(data.voice,3000),audience:text(data.audience,3000),approvedContext:text(data.approvedContext,10000),createdAt:now,updatedAt:now};db.profiles.push(p);}
    save();return clone(p);
  };
  const removeProfile=id=>{const p=getProfile(id);if(!p)return false;db.profiles=db.profiles.filter(x=>x.id!==id);/* Preserve audit history for provenance, even after profile removal. */db.audits.forEach(a=>{if(a.profileId===id)a.profileId=null;});save();return true;};
  const addAudit=(profileId,result)=>{
    if(profileId&&!getProfile(profileId))throw Error('Client profile not found');
    const record={id:randomUUID(),profileId:profileId||null,createdAt:new Date().toISOString(),result:clone(result)};
    db.audits.push(record);save();return {id:record.id,profileId:record.profileId,createdAt:record.createdAt};
  };
  const listAudits=(profileId)=>{
    return db.audits.filter(a=>!profileId||a.profileId===profileId)
      .map(a=>({id:a.id,profileId:a.profileId,createdAt:a.createdAt,brandName:a.result?.report?.brandName||'Brand audit',startDate:a.result?.startDate,days:a.result?.report?.calendar?.length||0}))
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  };
  const getAudit=id=>db.audits.find(a=>a.id===id);
  const updateDay=(auditId,dayNumber,patch)=>{
    const a=getAudit(auditId);if(!a)throw Error('Audit not found');
    const day=a.result?.report?.calendar?.find(d=>d.day===dayNumber);if(!day)throw Error('Calendar day not found');
    const allowed=['topic','caption','copy','creativeInstructions','cta','link','platform','format','selectedHook','status'];
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid calendar edit');
    const out={};
    for(const key of allowed)if(Object.hasOwn(patch,key)){
      if(typeof patch[key]!=='string'||patch[key].length>20000)throw Error('Invalid '+key);
      if(key==='status'&&!['Draft','In Review','Approved','Scheduled','Published','Needs Client Confirmation'].includes(patch[key]))throw Error('Invalid status');
      out[key]=patch[key].trim();
    }
    if(!Object.keys(out).length)throw Error('No editable fields supplied');
    Object.assign(day,out);a.updatedAt=new Date().toISOString();save();return clone(day);
  };
  const removeAudit=id=>{if(!getAudit(id))return false;db.audits=db.audits.filter(a=>a.id!==id);save();return true;};
  return {profiles,getProfile:id=>clone(getProfile(id)||null),upsertProfile,removeProfile,addAudit,listAudits,getAudit:id=>clone(getAudit(id)||null),updateDay,removeAudit};
}
