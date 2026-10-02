import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRunnerApi} from '../backend/runner-api';

test('setup works without a configured file and keeps configuration in memory',async()=>{
 const api=createRunnerApi(undefined);
 const server=createServer((req,res)=>{void api.handle(req,res)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 try{
  const config=JSON.parse(await readFile('examples/proxy/host.config.json','utf8'));
  const response=await fetch(`${base}/api/runner/setup`,{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Timeline':'1'},body:JSON.stringify(config)});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),config);
  assert.deepEqual(await (await fetch(`${base}/api/runner/config`)).json(),config);
  const changed={...config,appUrl:'http://127.0.0.1:9999'};
  const run=await fetch(`${base}/api/runner/run`,{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Timeline':'1'},body:JSON.stringify(changed)});
  assert.equal(run.status,400);assert.match(await run.text(),/cannot change/);
 }finally{api.close();server.close();await once(server,'close')}
});
