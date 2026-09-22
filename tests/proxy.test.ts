import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createStreamProxy } from '../backend/proxy.js';
import type { Scenario } from '../shared/engine.js';
const scenario: Scenario = { version:1,id:'proxy-test',prompt:'Test',cancelAtMs:5,observeUntilMs:200,events:[{atMs:10,type:'text',text:'late'},{atMs:100,type:'complete'}],assertion:{type:'textAbsentAfterCancel',text:'late'} };
async function listen(server: ReturnType<typeof createServer>) { server.listen(0,'127.0.0.1'); await once(server,'listening'); return `http://127.0.0.1:${(server.address() as {port:number}).port}`; }
const post = (base:string,id='test') => fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id})});
test('proxy simulation isolates requests, applies delay, and validates configuration',async()=>{
 assert.throws(()=>createStreamProxy({})); assert.throws(()=>createStreamProxy({scenario,delayMs:-1}));
 const proxy=createStreamProxy({scenario,delayMs:50});const base=await listen(proxy.server);
 try {
  const start=performance.now();const response=await post(base);assert.ok(performance.now()-start>=40);
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(events[1].text,'late');assert.equal(events.at(-1).type,'complete');
  const [a,b]=await Promise.all([post(base,'a').then(r=>r.text()),post(base,'b').then(r=>r.text())]);assert.ok(a.includes('"requestId":"a"'));assert.ok(!a.includes('"requestId":"b"'));assert.ok(b.includes('"requestId":"b"'));
  assert.equal((await fetch(base+'/other')).status,404);
  assert.equal((await post(base,'invalid space')).status,400);
 }finally{proxy.close()}
});
test('forwarding preserves streamed bytes and status and strips credentials',async()=>{
 let auth: string|undefined;
 const upstream=createServer((req,res)=>{auth=req.headers.authorization;res.writeHead(201,{'Content-Type':'text/event-stream'});res.write('data: first\n\n');setTimeout(()=>res.end('data: last\n\n'),50)});
 const target=await listen(upstream);const proxy=createStreamProxy({upstream:new URL(target+'/stream'),delayMs:20});const base=await listen(proxy.server);
 try{const response=await fetch(base+'/api/generate',{method:'POST',headers:{Authorization:'do-not-forward'},body:'{}'});assert.equal(response.status,201);assert.equal(response.headers.get('content-type'),'text/event-stream');assert.equal(await response.text(),'data: first\n\ndata: last\n\n');assert.equal(auth,undefined)}finally{proxy.close();upstream.close();upstream.closeAllConnections()}
});
test('disconnect interrupts a stream rather than fabricating completion',async()=>{
 const proxy=createStreamProxy({scenario,disconnectMs:40});const base=await listen(proxy.server);
 try{const response=await post(base);await assert.rejects(response.text())}finally{proxy.close()}
});
test('downstream abort closes the upstream stream',async()=>{
 let closed!:()=>void;const ended=new Promise<void>(resolve=>closed=resolve);
 const upstream=createServer((_req,res)=>{res.writeHead(200);res.write('start');res.on('close',closed)});
 const target=await listen(upstream);const proxy=createStreamProxy({upstream:new URL(target)});const base=await listen(proxy.server);
 try{const controller=new AbortController();const response=await fetch(base+'/api/generate',{method:'POST',body:'{}',signal:controller.signal});const reader=response.body!.getReader();await reader.read();controller.abort();await Promise.race([ended,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Upstream not closed')),1000))]);await reader.cancel().catch(()=>{})}finally{proxy.close();upstream.close();upstream.closeAllConnections()}
});

for(const mode of ['simulate','forward'] as const)test(`${mode}: disconnect first request, complete retry, reject extra requests`,async()=>{
 const upstream=createServer((_req,res)=>{res.writeHead(200);res.write('partial');const timer=setTimeout(()=>res.end(' finished'),100);res.on('close',()=>clearTimeout(timer))});
 const target=await listen(upstream);const observations:string[]=[];
 const proxy=createStreamProxy({...(mode==='simulate'?{scenario}:{upstream:new URL(target)}),requests:[{disconnectMs:40,expectedOutcome:'aborted'},{expectedOutcome:'complete'}],onEvent:(kind,request)=>observations.push(`${request}:${kind}`)});
 const base=await listen(proxy.server);
 try{
  const first=await post(base);await assert.rejects(first.text());
  const second=await post(base);assert.equal(second.status,200);assert.match(await second.text(),mode==='simulate'?/complete/:/finished/);
  assert.equal((await post(base)).status,503);
  assert.ok(observations.includes('1:disconnect'));assert.ok(observations.includes('1:aborted'));
  assert.ok(observations.includes('2:complete'));assert.ok(!observations.includes('2:disconnect'));
  assert.ok(observations.includes('3:unexpected-request'));
 }finally{proxy.close();upstream.close();upstream.closeAllConnections()}
});
