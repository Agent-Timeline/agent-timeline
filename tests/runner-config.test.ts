import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRunnerConfig } from '../shared/runner-config.js';
const fixture=()=>JSON.parse(readFileSync('examples/proxy/host.config.json','utf8'));
test('runner configuration validates host, actions, faults and assertion evidence',()=>{
 assert.equal(parseRunnerConfig(fixture()).actions.length,2);
 for(const mutate of [
  (c:any)=>c.appUrl='https://example.com',
  (c:any)=>c.evidence=[],
  (c:any)=>c.actions[0].type='execute-script',
  (c:any)=>c.assertions[0].fromMs=99999,
  (c:any)=>c.proxy.port=-1,
  (c:any)=>c.setup[0].atMs=12,
 ]){const config=fixture();mutate(config);assert.throws(()=>parseRunnerConfig(config))}
});

test('recovery plans validate ordered outcomes and checkpoint boundaries',()=>{
 const recovery=()=>JSON.parse(readFileSync('examples/proxy/recovery.config.json','utf8'));
 assert.equal(parseRunnerConfig(recovery()).proxy.requests?.length,2);
 for(const mutate of [
  (c:any)=>c.proxy.requests=[],
  (c:any)=>c.proxy.requests[0].disconnectMs=-1,
  (c:any)=>c.proxy.requests[0].expectedOutcome='complete',
  (c:any)=>c.proxy.expectedRequests=2,
  (c:any)=>c.proxy.disconnectMs=400,
  (c:any)=>c.assertions[0].atMs=c.observeUntilMs,
 ]){const config=recovery();mutate(config);assert.throws(()=>parseRunnerConfig(config))}
});
