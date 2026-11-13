import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const skill=await readFile(new URL('./strategy.md',import.meta.url),'utf8');
export const skillHash=createHash('sha256').update(skill).digest('hex');
export const PROMPT=`Run the Universal Brand Marketing Strategist.

Research the business, audit its marketing, identify its target audience, evaluate competitors, check current brand-aligned trends, and create a complete marketing strategy and 30-day content plan.

Mark unverified information clearly.
Do not publish or schedule anything.`;
export function auditPrompt(links){return '/audit\n\n'+links.map(l=>l.label+': '+l.url).join('\n')+'\n\n'+PROMPT;}
