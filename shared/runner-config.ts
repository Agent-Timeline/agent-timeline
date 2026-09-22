import { parseScenario, type Scenario } from './engine.js';
export type BrowserAction = { atMs:number; type:'click'|'fill'|'select'; selector:string; value?:string };
export interface RequestPlan { expectedOutcome: 'complete' | 'aborted'; delayMs?: number; disconnectMs?: number }
export interface RunnerConfig {
  version:1; name:string; appUrl:string;
  proxy:{requests?:RequestPlan[];expectedOutcome?:'complete'|'aborted'; expectedRequests?:number;port:number; path:string; scenario?:Scenario; upstream?:string; delayMs?:number; disconnectMs?:number};
  setup:BrowserAction[]; actions:BrowserAction[]; observeUntilMs:number;
  assertions:({type:'textAbsent';selector:string;text:string;fromMs:number}|{type:'textContains'|'textEquals';selector:string;text:string;atMs?:number})[];
  evidence:{selector:string;text:string}[];
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<4096;
const time=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=60000;
export function localUrl(value:unknown):string {
  if(!text(value))throw new Error('URL is required');const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('Use a loopback development URL without credentials');
  return url.href;
}
export function parseRunnerConfig(input:unknown):RunnerConfig {
  if(!obj(input)||input.version!==1||!text(input.name)||!obj(input.proxy)||!time(input.observeUntilMs)||input.observeUntilMs<1)throw new Error('Invalid runner metadata');
  localUrl(input.appUrl);const p=input.proxy;
  if(!Number.isInteger(p.port)||Number(p.port)<1||Number(p.port)>65535||!text(p.path)||!/^\/[a-zA-Z0-9/_-]+$/.test(p.path)||p.path==='/health')throw new Error('Invalid proxy port/path');
  if(p.expectedOutcome!==undefined&&!['complete','aborted'].includes(String(p.expectedOutcome)))throw new Error('Invalid expected proxy outcome');
  if(p.expectedRequests!==undefined&&(!Number.isInteger(p.expectedRequests)||Number(p.expectedRequests)<1||Number(p.expectedRequests)>100))throw new Error('Invalid expected request count');
  if(p.requests!==undefined){
    if(!Array.isArray(p.requests)||p.requests.length<1||p.requests.length>100)throw new Error('Invalid request plan');
    if(['expectedRequests','expectedOutcome','delayMs','disconnectMs'].some(key=>p[key]!==undefined))throw new Error('Use request plans or global proxy settings, not both');
    for(const request of p.requests){
      if(!obj(request)||!['complete','aborted'].includes(String(request.expectedOutcome)))throw new Error('Invalid request outcome');
      for(const key of ['delayMs','disconnectMs'])if(request[key]!==undefined&&!time(request[key]))throw new Error('Invalid request fault time');
      if(request.disconnectMs!==undefined&&request.expectedOutcome!=='aborted')throw new Error('A disconnected request must expect abortion');
    }
  }
  if(!!p.scenario===!!p.upstream)throw new Error('Choose proxy scenario or upstream');
  if(p.scenario)parseScenario(p.scenario);if(p.upstream)localUrl(p.upstream);
  for(const key of ['delayMs','disconnectMs'])if(p[key]!==undefined&&!time(p[key]))throw new Error('Invalid fault time');
  for(const key of ['setup','actions']){
    if(!Array.isArray(input[key])||input[key].length>100)throw new Error('Invalid actions');let last=-1;
    for(const a of input[key]){if(!obj(a)||!time(a.atMs)||a.atMs<last||(key==='setup'&&a.atMs!==0)||a.atMs>=input.observeUntilMs||!['click','fill','select'].includes(String(a.type))||!text(a.selector)||((a.type==='fill'||a.type==='select')&&typeof a.value!=='string'))throw new Error('Invalid action');last=a.atMs;}
  }
  if(!Array.isArray(input.assertions)||input.assertions.length<1||input.assertions.length>100||!Array.isArray(input.evidence)||input.evidence.length<1||input.evidence.length>100)throw new Error('Assertions and delivery evidence are required');
  for(const a of input.assertions){if(!obj(a)||!text(a.selector)||!text(a.text)||!['textAbsent','textContains','textEquals'].includes(String(a.type))||(a.type==='textAbsent'&&(!time(a.fromMs)||a.fromMs>=input.observeUntilMs)))throw new Error('Invalid assertion');if(a.atMs!==undefined&&(a.type==='textAbsent'||!time(a.atMs)||a.atMs>=input.observeUntilMs))throw new Error('Invalid assertion checkpoint');}
  for(const e of input.evidence)if(!obj(e)||!text(e.selector)||!text(e.text))throw new Error('Invalid evidence');
  return structuredClone(input) as unknown as RunnerConfig;
}
export interface RunEvent { atMs:number; kind:string; message:string }
export interface RunReport { id:string; kind:'pass'|'fail'|'error'|'stopped'; message:string; events:RunEvent[]; assertions:{description:string;passed:boolean}[] }
