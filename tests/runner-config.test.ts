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
