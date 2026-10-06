import { chromium } from '@playwright/test';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createStreamProxy } from './proxy.js';
import { parseRunnerConfig, type RunnerConfig, type BrowserAction, type RunReport, type RunEvent, type RunDiagnosis } from '../shared/runner-config.js';

export async function runConfiguredApp(input:RunnerConfig, options:{signal?:AbortSignal;onEvent?:(event:RunEvent)=>void;id?:string}={}):Promise<RunReport>{
  const config=parseRunnerConfig(input),id=options.id??crypto.randomUUID();
  const events:RunEvent[]=[];let started=performance.now();let recording=false;let requests=0,completed=0,aborted=0;const observed=new Map<number,Set<string>>();
  const emit=(kind:string,message:string)=>{const event={atMs:Math.max(0,Math.round(performance.now()-started)),kind,message};events.push(event);options.onEvent?.(event)};
  const controller=new AbortController();const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const signal=controller.signal;const budget=setTimeout(abort,config.observeUntilMs+30000);
  const proxy=createStreamProxy({...config.proxy,upstream:config.proxy.upstream?new URL(config.proxy.upstream):undefined,onEvent:(kind,request)=>{if(recording){const kinds=observed.get(request)??new Set<string>();kinds.add(kind);observed.set(request,kinds);if(kind==='request')requests++;if(kind==='complete')completed++;if(kind==='aborted')aborted++;emit('proxy',`request ${request}: ${kind}`)}}});
  let stage='proxy';let targetSelector:string|undefined;let diagnosis:RunDiagnosis|undefined;
  const problem=(code:string,title:string,detail:string,nextStep:string,selector?:string)=>{diagnosis={code,title,detail,nextStep,...(selector?{selector}:{})};return new Error(detail)};
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  const report=(kind:RunReport['kind'],message:string,assertions:RunReport['assertions']=[]):RunReport=>({id,kind,message,events,assertions,...(diagnosis?{diagnosis}:{}),scenario:structuredClone(config)});
  const stopBrowser=()=>{void browser?.close();proxy.close()};signal.addEventListener('abort',stopBrowser,{once:true});
  try{
    if(signal.aborted)throw new Error('Stopped');
    proxy.server.listen(config.proxy.port,'127.0.0.1');await once(proxy.server,'listening',{signal});
    stage='browser';browser=await chromium.launch();if(signal.aborted)throw new Error('Stopped');
    const context=await browser.newContext({serviceWorkers:'block'});let blocked=false;
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(config.appUrl).origin)return route.continue();blocked=true;return route.abort()});
    const page=await context.newPage();page.setDefaultTimeout(5000);
    stage='navigation';await page.goto(config.appUrl,{waitUntil:'domcontentloaded',timeout:10000});
    const action=async(a:BrowserAction)=>{stage='action';targetSelector=a.selector;const element=page.locator(a.selector);await element.first().waitFor({state:'attached'});if(await element.count()!==1)throw new Error(`Action must match one element: ${a.selector}`);if(a.type==='click')await element.click();else if(a.type==='fill')await element.fill(a.value!);else await element.selectOption(a.value!);};
    for(const step of config.setup)await action(step);
    // Assertions use CSS selectors. Missing elements are errors, not absence successes.
    for(const a of [...config.assertions,...config.evidence]){stage='selector';targetSelector=a.selector;if(await page.locator(a.selector).count()!==1)throw new Error(`Check must match one element: ${a.selector}`)}
    stage='observation';targetSelector=undefined;
    await page.exposeFunction('__agentTimelineCapture',(value:unknown)=>{if(recording)emit('ui',JSON.stringify(value))});
    await page.evaluate(`(() => {
      const assertions = ${JSON.stringify(config.assertions)};const capture = ${JSON.stringify(config.capture??{})};let previous='';
      const state={start:performance.now(),violations:assertions.map(()=>false),failures:assertions.map(()=>null),missing:false};
      window.__agentTimeline=state;
      const inspect=()=>{const elapsed=performance.now()-state.start;const values=Object.fromEntries(Object.entries(capture).map(([key,selector])=>[key,document.querySelector(selector)?.textContent??'']));const serialized=JSON.stringify(values);if(serialized!==previous){previous=serialized;window.__agentTimelineCapture({atMs:Math.round(elapsed),values})?.catch(()=>{})}assertions.forEach((a,i)=>{const nodes=document.querySelectorAll(a.selector);if(nodes.length!==1){state.missing=true;return}if(a.type==='textAbsent'&&elapsed>=a.fromMs&&nodes[0].textContent?.includes(a.text)){state.violations[i]=true;state.failures[i]??={actual:nodes[0].textContent??'',atMs:Math.round(elapsed)}}})};
      const observer=new MutationObserver(inspect);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
      const interval=setInterval(inspect,10);inspect();
      window.__agentTimelineRead=()=>{inspect();observer.disconnect();clearInterval(interval);return state};
    })()`);
    started=performance.now();recording=true;emit('run','Started');
    const checkpoints = new Map<number,{passed:boolean;actual:string;atMs:number}>();
    const inspectText = async (a: {selector:string;text:string;type:string}) => {
      stage='selector';targetSelector=a.selector;const target=page.locator(a.selector);
      if(await target.count()!==1)throw new Error(`Check must match one element: ${a.selector}`);
      return target.evaluate((node,a)=>{const actual=node.textContent??'';return {actual,atMs:Math.round(performance.now()-(window as any).__agentTimeline.start),passed:a.type==='textEquals'?actual===a.text:actual.includes(a.text)}},a);
    };
    const schedule = [
      ...config.actions.map(step=>({atMs:step.atMs, action:step, assertion:-1})),
      ...config.assertions.flatMap((a,i)=>a.type!=='textAbsent'&&a.atMs!==undefined?[{atMs:a.atMs,action:undefined,assertion:i}]:[]),
    ].sort((a,b)=>a.atMs-b.atMs);
    for(const step of schedule){
      await delay(Math.max(0,step.atMs-(performance.now()-started)),undefined,{signal});
      if(performance.now()-started>=config.observeUntilMs)throw new Error('Action or checkpoint missed observation deadline');
      if(step.action){await action(step.action);emit('action',`${step.action.type} ${step.action.selector}`)}
      else {const a=config.assertions[step.assertion];const checked=await inspectText(a);const passed=checked.passed;checkpoints.set(step.assertion,checked);emit('checkpoint',`${passed?'PASS':'FAIL'} ${a.type} ${a.selector} (scheduled ${step.atMs}ms)`)}
    }
    stage='observation';targetSelector=undefined;
    await delay(Math.max(0,config.observeUntilMs-(performance.now()-started)),undefined,{signal});
    const state=await page.evaluate(()=>(window as any).__agentTimelineRead());
    if(state.missing)throw new Error('An assertion target disappeared during observation');
    if(blocked)throw problem('origin-blocked','A request was blocked','The app requested a resource outside its configured origin.','Route development API requests through the app’s own origin. Check external scripts and authentication redirects too; the runner uses a fresh browser session.');
    const kinds=[...observed.values()];
    if(kinds.some(k=>k.has('request-rejected')))throw problem('request-rejected','The proxy rejected the request','The request body did not match the selected simulation format.','Check Stream protocol and request payload. NDJSON needs requestId; Chat Completions needs model, text messages and stream:true. Unsupported stream options are rejected.');
    if(kinds.some(k=>k.has('upstream-error')))throw problem('upstream-error','The development upstream failed','The proxy could not finish forwarding the upstream response.','Start the configured local upstream and check its route and logs. Credentials are not forwarded automatically.');
    if(kinds.some(k=>k.has('stream-error')))throw problem('stream-error','The proxy stream failed','The proxy could not finish delivering its scripted stream.','Inspect proxy events and app transport handling. Check whether the app closed the connection unexpectedly.');
    if(requests===0)throw problem('no-proxy-request','No request reached the proxy','No matching POST request reached the configured proxy during observation.','Check the app’s development routing, POST endpoint and proxy port. Confirm Send actually submits a request; increase the observation window if startup is slow.');
    for(const e of config.evidence){stage='selector';targetSelector=e.selector;if(await page.locator(e.selector).count()!==1)throw new Error(`Evidence must match one element: ${e.selector}`);if(!(await page.locator(e.selector).textContent())?.includes(e.text))throw problem('missing-evidence','Delivery evidence was not found',`Missing delivery evidence: ${e.selector}`,'Check the delivery-log selector and expected text. Inspect the app for parsing errors or unfinished streams. Proxy receipt alone does not prove the UI consumed the response.',e.selector);emit('evidence',e.text)}
    stage='outcome';targetSelector=undefined;
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
    for(const [i,a] of config.assertions.entries()){
      const sample=a.type==='textAbsent'?state.failures[i]:a.atMs!==undefined?checkpoints.get(i):await inspectText(a);
      const passed=a.type==='textAbsent'?!state.violations[i]:sample?.passed===true;
      assertions.push({description:`${a.type}: ${a.selector} / ${a.text}`,passed,...(!passed&&sample?{evidence:{selector:a.selector,type:a.type,expected:a.text,actual:sample.actual,atMs:sample.atMs,phase:a.type==='textAbsent'?'first-violation' as const:a.atMs!==undefined?'checkpoint' as const:'final' as const,clock:'browser-observation' as const}}:{})});
      emit('assertion',`${passed?'PASS':'FAIL'} ${a.type} ${a.selector}`);
    }
    return report(assertions.every(a=>a.passed)?'pass':'fail',assertions.every(a=>a.passed)?'All configured assertions passed.':'A configured assertion failed.',assertions);
  }catch(error){
    if(!options.signal?.aborted&&!diagnosis){
      const detail=error instanceof Error?error.message:String(error);
      const hints:Record<string,[string,string,string]>={
        proxy:['proxy-unavailable','The proxy could not start','Check the configured proxy port. Stop a manual proxy using it or choose a free port and update app routing.'],
        browser:['browser-unavailable','The test browser could not start','Run npx playwright install chromium from the checkout and check the browser launch error.'],
        navigation:['app-unreachable','The app page could not load','Start the local app and check its URL. Use a directly reachable page; this test does not reuse your browser login.'],
        action:['action-target','A browser action could not run','Check that this selector is valid and matches exactly one visible, enabled control. For fill/select, check the control type and option value.'],
        selector:['selector-target','A check could not find its target','Use a valid CSS selector matching exactly one element. Keep the response or evidence container mounted during observation.'],
        outcome:['unexpected-outcome','The stream outcome did not match','Compare observed request counts and completion/abort events with the request plan. Check delays, disconnects and observation duration.'],
        observation:['observation-error','Observation could not finish','Check the raw error, observation duration and whether navigation removed the response container.']
      };
      const [code,title,nextStep]=hints[stage]??hints.observation;diagnosis={code,title,detail,nextStep,...(targetSelector?{selector:targetSelector}:{})};
    }
    return report(options.signal?.aborted?'stopped':'error',options.signal?.aborted?'Stopped; observation incomplete.':error instanceof Error?error.message:String(error));}
  finally{recording=false;clearTimeout(budget);options.signal?.removeEventListener('abort',abort);signal.removeEventListener('abort',stopBrowser);controller.abort();proxy.close();await browser?.close();}
}
