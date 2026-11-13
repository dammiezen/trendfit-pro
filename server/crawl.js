import https from 'node:https';
import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import {load} from 'cheerio';
import robotsParser from 'robots-parser';

const AGENT = 'TrendFitAudit/2.0';
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function validateUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a complete public HTTPS URL.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') ||
      (ipaddr.isValid(host) && !publicAddress(host))) throw new Error('Only public HTTPS websites without credentials or custom ports are supported.');
  if (raw.length > 2048) throw new Error('The URL is too long.');
  url.hash = '';
  return url;
}

// Resolve, validate and pin the connection to prevent DNS rebinding and private-network requests.
export async function getPublic(raw, {maxBytes = 1_000_000, redirects = 4, allowedHost, beforeRequest} = {}) {
  const url = validateUrl(raw);
  if (allowedHost && url.hostname.replace(/^www\./,'') !== allowedHost.replace(/^www\./,'')) throw new Error('Cross-domain redirect was skipped.');
  if(beforeRequest && !await beforeRequest(url.href))throw new Error('The page disallows automated reading.');
  const addresses = await Promise.race([lookup(url.hostname, {all:true}), new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), 6000); timer.unref();
  })]);
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('This address is not a public website.');
  const address = addresses[0];
  const result = await new Promise((resolve, reject) => {
    const req = https.request(url, {
      method:'GET', agent:false, headers:{'User-Agent':AGENT, 'Accept':'text/html,text/plain;q=0.9', 'Accept-Encoding':'identity'},
      lookup:(_host, options, cb) => options.all ? cb(null, [address]) : cb(null, address.address, address.family)
    }, res => {
      const chunks = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) req.destroy(new Error('Page exceeds the reading limit.')); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({status:res.statusCode, headers:res.headers, text:Buffer.concat(chunks).toString('utf8'), url:url.href}));
    });
    const deadline = setTimeout(() => req.destroy(new Error('Website took too long to respond.')), 12000);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', reject); req.end();
  });
  if ([301,302,303,307,308].includes(result.status)) {
    if (!redirects || !result.headers.location) throw new Error('Too many redirects.');
    return getPublic(new URL(result.headers.location, url).href, {maxBytes, redirects:redirects-1, allowedHost, beforeRequest});
  }
  return result;
}

export function extract(html, url) {
  const $ = load(html);
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const links = [];
  $('a[href]').each((_, el) => {try {
    const target = new URL($(el).attr('href'), url);
    if (target.protocol === 'https:') links.push({url:target.href, label:$(el).text().replace(/\s+/g,' ').trim().slice(0,120)});
  } catch { /* Non-web link. */ }});
  $('script,style,noscript,svg,iframe,template,[hidden],[aria-hidden="true"]').remove();
  $('p,div,section,article,li,h1,h2,h3,br').append(' ');
  const text = $('body').text().replace(/\s+/g,' ').trim().slice(0,14000);
  return {title, description, text, links:links.slice(0,250), headings:$('h1,h2,h3').map((_,e)=>$(e).text().trim()).get().slice(0,30)};
}
export function isSocial(url) {
  return /(^|\.)(instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)$/.test(new URL(url).hostname);
}
export async function crawl(raw, {fetcher = getPublic, limit = 5} = {}) {
  const initial = validateUrl(raw);
  const sources = [], coverage = [], policies = new Map(), seen = new Set();
  async function allowed(url) {
    const u = new URL(url);
    if (!policies.has(u.origin)) {
      try {
        const r = await fetcher(u.origin+'/robots.txt', {maxBytes:200000, allowedHost:u.hostname});
        policies.set(u.origin, r.status === 404 ? null : r.status === 200 ? robotsParser(u.origin+'/robots.txt',r.text) : false);
      } catch { policies.set(u.origin, false); }
    }
    const p = policies.get(u.origin);
    return p !== false && (!p || p.isAllowed(url, AGENT) !== false);
  }
  const queue = [initial.href];
  while (queue.length && coverage.length < limit) {
    const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
    try {
      if (!await allowed(url)) throw new Error('Reading is restricted by robots.txt, or its policy could not be checked.');
      // Same-host redirects prevent leaving a site's checked crawl policy.
      const r = await fetcher(url, {allowedHost:new URL(url).hostname,beforeRequest:allowed});
      if (r.status !== 200) throw new Error('Website returned HTTP '+r.status+'.');
      if (!/text\/html/i.test(r.headers['content-type'] || '')) throw new Error('This link is not an HTML page.');
      if (!await allowed(r.url)) throw new Error('The redirected page disallows reading.');
      const page = extract(r.text, r.url);
      if (page.text.length < 160 || /^(just a moment|access denied|log in|login|sign in)/i.test(page.title)) throw new Error('Only a login, access check, or insufficient readable content was available.');
      const source = {id:'S'+(sources.length+1),url:r.url,title:page.title,kind:isSocial(r.url)&&/\/(p|reel|posts|status|videos)\//.test(new URL(r.url).pathname)?'public_post':'public_page',checkedAt:new Date().toISOString(),text:[page.title,page.description,page.text].join('\n'),headings:page.headings};
      sources.push(source); coverage.push({url:r.url,status:'read',detail:'Read public page text; images, video and hidden analytics were not inspected.'});
      if (sources.length === 1) {
        const candidates = page.links.filter(l=> {
          const u = new URL(l.url);
          if(isSocial(initial.href))return u.origin===initial.origin && /\/(p|reel|posts|status|videos)\//.test(u.pathname);
          return u.origin === initial.origin && !u.search && !/\.(pdf|zip|png|jpg|mp4)$/i.test(u.pathname) && !/(logout|delete|checkout|cart|login|sign-in)/i.test(u.pathname) && /about|service|product|contact|pricing|case|blog/i.test(u.pathname+' '+l.label);
        }).sort((a,b)=>Number(/about|service|product|contact|pricing/i.test(b.url))-Number(/about|service|product|contact|pricing/i.test(a.url)));
        for (const c of candidates) {const u=new URL(c.url);u.hash='';if(!queue.includes(u.href)&&!seen.has(u.href))queue.push(u.href);if(queue.length>=limit-1)break;}
      }
    } catch (error) { coverage.push({url,status:'unavailable',detail:error.message}); }
  }
  return {sources,coverage};
}
