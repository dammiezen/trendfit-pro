import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../server/store.js';

test('profiles persist, audits survive restart and calendars can be edited',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trendfit-workspace-'));
 try{
  let store=createStore(dir);
  const p=store.upsertProfile({name:'BSCN',region:'Australia',voice:'British English; third-person',links:[{label:'Website',url:'https://example.org'}]});
  assert.equal(store.profiles()[0].name,'BSCN');
  const report={report:{brandName:'BSCN',calendar:[{day:1,topic:'Introductions',caption:'Old caption',status:'Draft'}]},startDate:'2026-11-23'};
  const saved=store.addAudit(p.id,report);
  store=createStore(dir);
  assert.equal(store.getProfile(p.id).voice,'British English; third-person');
  assert.equal(store.listAudits(p.id).length,1);
  const edited=store.updateDay(saved.id,1,{caption:'New caption',status:'In Review'});
  assert.equal(edited.caption,'New caption');
  assert.throws(()=>store.updateDay(saved.id,1,{status:'Automatically posted'}));
  assert.equal(createStore(dir).getAudit(saved.id).result.report.calendar[0].status,'In Review');
  assert.equal(JSON.parse(readFileSync(join(dir,'workspace.json'),'utf8')).audits.length,1);
  assert.equal(store.removeProfile(p.id),true);
  assert.equal(store.listAudits().length,1);
  assert.equal(store.removeAudit(saved.id),true);
  assert.equal(createStore(dir).listAudits().length,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid profile links and edits do not modify the store',()=>{
 const dir=mkdtempSync(join(tmpdir(),'trendfit-workspace-'));
 try{
  const store=createStore(dir);
  assert.throws(()=>store.upsertProfile({name:''}));
  const p=store.upsertProfile({name:'Client',links:[{label:'Website',url:'http://insecure.example'}]});
  assert.deepEqual(p.links,[]);
  const audit=store.addAudit(p.id,{report:{calendar:[{day:1,status:'Draft'}]}});
  assert.throws(()=>store.updateDay(audit.id,1,{caption:{unsafe:true}}));
  assert.equal(store.getAudit(audit.id).result.report.calendar[0].status,'Draft');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
