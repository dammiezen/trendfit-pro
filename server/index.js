import express from 'express';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {audit} from './audit.js';
import {validateUrl} from './crawl.js';
import {skillHash} from './workflow.js';

export function createApp(config = {}, runAudit=audit) {
  const app=express();
  const sessions=new Map(), limits=new Map(), jobs=new Map(); let running=0;
  const cleanup=setInterval(()=>{for(const [id,j] of jobs)if(j.expires<Date.now())jobs.delete(id);},60000);cleanup.unref();
  const ready=Boolean(config.key && config.password && config.model);
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'});
    // Legacy calculator has inline script; the new app uses only external scripts.
    res.set('Content-Security-Policy',req.path==='/calculator.html'?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(config.production)res.set('Strict-Transport-Security','max-age=31536000');
    next();
  });
  app.use(express.json({limit:'40kb'}));
  app.use('/api',(req,res,next)=>{
    if(req.method==='POST' && (!config.origin || req.get('origin')!==config.origin))return res.status(403).json({error:'Open the app from its configured address and try again.'});
    next();
  });
  function limited(key,max,window=600000) {
    const now=Date.now();
    for(const [k,v] of limits)if(v.until<now)limits.delete(k);
    const current=limits.get(key)||{count:0,until:now+window};current.count++;limits.set(key,current);return current.count>max;
  }
  function token(req){return /(?:^|; )tf_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];}
  function loggedIn(req){const id=token(req),expires=sessions.get(id);if(expires && expires>Date.now())return id;if(id)sessions.delete(id);return null;}
  app.get('/api/status',(req,res)=>res.json({ready,authenticated:Boolean(loggedIn(req)),workflow:'/audit',skillHash}));
  app.post('/api/login',(req,res)=>{
    if(!ready)return res.status(503).json({error:'The app owner needs to complete the private service setup first.'});
    if(limited('login:'+req.socket.remoteAddress,10))return res.status(429).json({error:'Too many attempts. Please wait ten minutes.'});
    const supplied=typeof req.body?.password==='string'?req.body.password:'';
    const hash=s=>createHash('sha256').update(s).digest();
    if(!timingSafeEqual(hash(supplied),hash(config.password)))return res.status(401).json({error:'Incorrect access password.'});
    for(const [id,expires] of sessions)if(expires<Date.now())sessions.delete(id);
    const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+8*3600000);
    res.set('Set-Cookie',`tf_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${config.production?'; Secure':''}`).json({ok:true});
  });
  app.post('/api/logout',(req,res)=>{sessions.delete(token(req));res.set('Set-Cookie','tf_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0').json({ok:true});});
  app.get('/api/audit/:id',(req,res)=>{
    const session=loggedIn(req),job=jobs.get(req.params.id);
    if(!session)return res.status(401).json({error:'Your workspace session expired. Unlock and start again.'});
    if(!job||job.session!==session||job.expires<Date.now())return res.status(404).json({error:'This audit is unavailable or expired. Please start a new audit.'});
    res.json({state:job.state,stage:job.stage,result:job.result,error:job.error,coverage:job.coverage});
  });
  app.post('/api/audit',async(req,res)=>{
    if(!ready)return res.status(503).json({error:'Automatic auditing is not configured yet. The setup guide explains how to activate it.'});
    const session=loggedIn(req);if(!session)return res.status(401).json({error:'Unlock the workspace before running an audit.'});
    const input=req.body;
    if(!input || !Array.isArray(input.links) || !input.links.length || input.links.length>6 || typeof input.notes!=='string' || input.notes.length>20000 || typeof input.objective!=='string' || input.objective.length>500 || typeof input.region!=='string' || input.region.length>120 || input.consent!==true || typeof input.startDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !Number.isFinite(Date.parse(input.startDate+'T12:00:00Z')) || new Date(input.startDate+'T12:00:00Z').toISOString().slice(0,10)!==input.startDate)return res.status(400).json({error:'Check the links, start date, context fields and analysis consent.'});
    try{for(const item of input.links){if(!item||typeof item.label!=='string'||item.label.length>40||typeof item.url!=='string')throw new Error('Check the supplied links.');item.url=validateUrl(item.url).href;}}catch(error){return res.status(400).json({error:error.message});}
    if(running>=2)return res.status(429).json({error:'Two audits are already running. Please try again shortly.'});
    if(limited('audit:'+session,3,3600000)||limited('audit:global',10,3600000))return res.status(429).json({error:'The hourly audit limit has been reached. Try again later.'});
    const id=randomBytes(24).toString('hex');
    const job={session,state:'running',stage:'Starting /audit',expires:Date.now()+45*60000};jobs.set(id,job);running++;
    res.status(202).json({id,state:job.state});
    try{job.result=await runAudit(input,config,{},stage=>job.stage=stage);job.state='complete';job.stage='Audit and 30-day plan ready';}
    catch(error){job.state='failed';job.error=error.message;job.coverage=error.coverage||[];}
    finally{job.expires=Date.now()+30*60000;running--;}
  });
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{dotfiles:'deny',index:'index.html'}));
  app.use((error,req,res,next)=>res.status(error.status===413?413:400).json({error:error.status===413?'The supplied context is too large.':'The request could not be read.'}));
  return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const config={key:process.env.OPENAI_API_KEY,password:process.env.AUDIT_PASSWORD,model:process.env.OPENAI_MODEL||'gpt-6-astra',origin:process.env.APP_ORIGIN,production:process.env.NODE_ENV==='production'};
  if(config.production && (!config.origin?.startsWith('https://') || !config.password || config.password.length<20))throw new Error('Production requires APP_ORIGIN with HTTPS and an AUDIT_PASSWORD of at least 20 characters.');
  const server=createApp(config).listen(Number(process.env.PORT||3000),()=>console.log('TrendFit Pro listening on port '+(process.env.PORT||3000)));
  server.requestTimeout=300000;
}
