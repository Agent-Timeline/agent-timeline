import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoConfig} from '../shared/demo-config';
import {parseRunnerConfig} from '../shared/runner-config';
const scenario=JSON.parse(readFileSync(new URL('../scenarios/cancel-late-result.json',import.meta.url),'utf8'));
test('cancellation edits become shared actions, provider data and assertions',()=>{
 const edited={...scenario,cancelAtMs:500,assertion:{...scenario.assertion,text:'forbidden'}};
 const config=demoConfig('http://127.0.0.1:4417',4438,{kind:'cancel',mode:'fixed',scenario:edited});
 assert.equal(config.actions[1].atMs,500);assert.equal(config.assertions[0].text,'forbidden');assert.deepEqual(config.proxy.scenario,edited);
 assert.deepEqual(parseRunnerConfig(JSON.parse(JSON.stringify(config))),config);
});
test('recovery preserves distinct partial and retry streams plus intermediate checks',()=>{
 const config=demoConfig('http://127.0.0.1:4417',4438,{kind:'recovery',mode:'fixed',timing:{partial:100,disconnect:400,checkpoint:700,reconnect:900,retry:1000,response:1200,complete:1300,end:1800}});
 assert.equal(config.proxy.requests?.[0].expectedOutcome,'aborted');
 assert.deepEqual(config.proxy.requests?.[1].scenario?.events,[{atMs:200,type:'text',text:'Draft recovered'},{atMs:300,type:'complete'}]);
 assert.equal(config.assertions[0].type,'textEquals');assert.equal(config.assertions[0].atMs,700);
 assert.throws(()=>parseRunnerConfig({...config,proxy:{...config.proxy,scenario:undefined,upstream:'http://127.0.0.1:1234'}}));
});

test('gallery contracts preserve empty results, checkpoints and delivery identities',()=>{
 const build=(preset:string)=>demoConfig('http://127.0.0.1:4417',4438,{kind:'gallery',preset,mode:'fixed'});
 const navigation=build('navigation');assert.ok(navigation.assertions.some(a=>a.type==='textEquals'&&a.text===''));
 const deletion=build('delete-item');assert.ok(deletion.assertions.some(a=>a.type==='textEquals'&&a.text==='Item deleted'));
 const failure=build('partial-error');assert.ok(failure.assertions.some(a=>a.type==='textEquals'&&a.atMs===700&&a.text==='Error: Connection lost'));
 const duplicate=build('duplicate');assert.equal(duplicate.evidence.length,3);assert.notEqual(duplicate.evidence[0].text,duplicate.evidence[1].text);
 assert.throws(()=>build('unknown'));
 const invalid=structuredClone(navigation);invalid.assertions=[{type:'textAbsent',selector:'div',text:'',fromMs:0}];assert.throws(()=>parseRunnerConfig(invalid));
});
