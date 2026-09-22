import { chromium } from '@playwright/test';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createStreamProxy } from './proxy.js';
import { parseRunnerConfig, type RunnerConfig, type BrowserAction, type RunReport, type RunEvent } from '../shared/runner-config.js';

export async function runConfiguredApp(input:RunnerConfig, options:{signal?:AbortSignal;onEvent?:(event:RunEvent)=>void;id?:string}={}):Promise<RunReport>{
  const config=parseRunnerConfig(input),id=options.id??crypto.randomUUID();
  const events:RunEvent[]=[];let started=performance.now();let recording=false;let requests=0,completed=0,aborted=0;const observed=new Map<number,Set<string>>();
  const emit=(kind:string,message:string)=>{const event={atMs:Math.max(0,Math.round(performance.now()-started)),kind,message};events.push(event);options.onEvent?.(event)};
  const controller=new AbortController();const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const signal=controller.signal;const budget=setTimeout(abort,config.observeUntilMs+30000);
  const proxy=createStreamProxy({...config.proxy,upstream:config.proxy.upstream?new URL(config.proxy.upstream):undefined,onEvent:(kind,request)=>{if(recording){const kinds=observed.get(request)??new Set<string>();kinds.add(kind);observed.set(request,kinds);if(kind==='request')requests++;if(kind==='complete')completed++;if(kind==='aborted')aborted++;emit('proxy',`request ${request}: ${kind}`)}}});
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  const report=(kind:RunReport['kind'],message:string,assertions:RunReport['assertions']=[]):RunReport=>({id,kind,message,events,assertions});
  const stopBrowser=()=>{void browser?.close();proxy.close()};signal.addEventListener('abort',stopBrowser,{once:true});
  try{
    if(signal.aborted)throw new Error('Stopped');
    proxy.server.listen(config.proxy.port,'127.0.0.1');await once(proxy.server,'listening',{signal});
    browser=await chromium.launch();if(signal.aborted)throw new Error('Stopped');
    const context=await browser.newContext({serviceWorkers:'block'});let blocked=false;
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(config.appUrl).origin)return route.continue();blocked=true;return route.abort()});
    const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.goto(config.appUrl,{waitUntil:'domcontentloaded',timeout:10000});
    const action=async(a:BrowserAction)=>{const element=page.locator(a.selector);if(await element.count()!==1)throw new Error(`Action must match one element: ${a.selector}`);if(a.type==='click')await element.click();else if(a.type==='fill')await element.fill(a.value!);else await element.selectOption(a.value!);};
    for(const step of config.setup)await action(step);
    // Assertions use CSS selectors. Missing elements are errors, not absence successes.
    for(const a of [...config.assertions,...config.evidence])if(await page.locator(a.selector).count()!==1)throw new Error(`Check must match one element: ${a.selector}`);
    await page.evaluate(`(() => {
      const assertions = ${JSON.stringify(config.assertions)};
      const state={start:performance.now(),violations:assertions.map(()=>false),missing:false};
      window.__agentTimeline=state;
      const inspect=()=>{const elapsed=performance.now()-state.start;assertions.forEach((a,i)=>{const nodes=document.querySelectorAll(a.selector);if(nodes.length!==1){state.missing=true;return}if(a.type==='textAbsent'&&elapsed>=a.fromMs&&nodes[0].textContent?.includes(a.text))state.violations[i]=true})};
      const observer=new MutationObserver(inspect);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
      const interval=setInterval(inspect,10);inspect();
      window.__agentTimelineRead=()=>{inspect();observer.disconnect();clearInterval(interval);return state};
    })()`);
    started=performance.now();recording=true;emit('run','Started');
    const checkpoints = new Map<number,boolean>();
    const inspectText = async (a: {selector:string;text:string;type:string}) => {
      const target=page.locator(a.selector);
      if(await target.count()!==1)throw new Error(`Check must match one element: ${a.selector}`);
      const text=await target.textContent();
      return a.type==='textEquals'?text===a.text:text?.includes(a.text)===true;
    };
    const schedule = [
      ...config.actions.map(step=>({atMs:step.atMs, action:step, assertion:-1})),
      ...config.assertions.flatMap((a,i)=>a.type!=='textAbsent'&&a.atMs!==undefined?[{atMs:a.atMs,action:undefined,assertion:i}]:[]),
    ].sort((a,b)=>a.atMs-b.atMs);
    for(const step of schedule){
      await delay(Math.max(0,step.atMs-(performance.now()-started)),undefined,{signal});
      if(performance.now()-started>=config.observeUntilMs)throw new Error('Action or checkpoint missed observation deadline');
      if(step.action){await action(step.action);emit('action',`${step.action.type} ${step.action.selector}`)}
      else {const a=config.assertions[step.assertion];const passed=await inspectText(a);checkpoints.set(step.assertion,passed);emit('checkpoint',`${passed?'PASS':'FAIL'} ${a.type} ${a.selector} (scheduled ${step.atMs}ms)`)}
    }
    await delay(Math.max(0,config.observeUntilMs-(performance.now()-started)),undefined,{signal});
    const state=await page.evaluate(()=>(window as any).__agentTimelineRead());
    if(state.missing)throw new Error('An assertion target disappeared during observation');
    for(const e of config.evidence){if(!(await page.locator(e.selector).textContent())?.includes(e.text))throw new Error(`Missing delivery evidence: ${e.selector}`);emit('evidence',e.text)}
    if(blocked)throw new Error('App attempted a request outside its configured origin');
    if(config.proxy.requests){
      if(requests!==config.proxy.requests.length)throw new Error('Expected request plan count not observed');
      for(const [index,plan] of config.proxy.requests.entries()){
        const kinds=observed.get(index+1);
        if(!kinds?.has(plan.expectedOutcome)||(plan.disconnectMs!==undefined&&!kinds.has('disconnect')))throw new Error(`Request ${index+1}: expected fault/outcome not observed`);
      }
    }else{
      const expected=config.proxy.expectedRequests??1;
      if(requests!==expected||(config.proxy.expectedOutcome==='aborted'?aborted!==expected:completed!==expected))throw new Error('Expected proxy request count/outcome not observed');
    }
    const assertions=[];
    for(const [i,a] of config.assertions.entries()){const passed=a.type==='textAbsent'?!state.violations[i]:a.atMs!==undefined?checkpoints.get(i)===true:await inspectText(a);assertions.push({description:`${a.type}: ${a.selector} / ${a.text}`,passed});emit('assertion',`${passed?'PASS':'FAIL'} ${a.type} ${a.selector}`)}
    return report(assertions.every(a=>a.passed)?'pass':'fail',assertions.every(a=>a.passed)?'All configured assertions passed.':'A configured assertion failed.',assertions);
  }catch(error){return report(options.signal?.aborted?'stopped':'error',options.signal?.aborted?'Stopped; observation incomplete.':error instanceof Error?error.message:String(error));}
  finally{recording=false;clearTimeout(budget);options.signal?.removeEventListener('abort',abort);signal.removeEventListener('abort',stopBrowser);controller.abort();proxy.close();await browser?.close();}
}
