import {parseRunnerConfig,type RunnerConfig} from '../shared/runner-config';
export const libraryKey='agent-timeline.scenarios.v1';
export interface SavedScenario {id:string;name:string;config:RunnerConfig}
export function readLibrary():SavedScenario[]{
 const raw=localStorage.getItem(libraryKey);if(!raw)return [];
 const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.items))throw Error('Saved library is unreadable. Existing data has not been changed.');
 return data.items.map((item:SavedScenario)=>{if(typeof item.id!=='string'||typeof item.name!=='string'||!item.name.trim())throw Error('Invalid saved scenario');return {...item,config:parseRunnerConfig(item.config)}});
}
export function writeLibrary(items:SavedScenario[]){localStorage.setItem(libraryKey,JSON.stringify({version:1,items}))}
export function confirmScenarioChange(){return window.dispatchEvent(new Event('timeline-before-replace',{cancelable:true}))}
export async function compileScenario(input:unknown):Promise<RunnerConfig>{const response=await fetch('/api/runner/compile',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Timeline':'1'},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw Error(data.error);return parseRunnerConfig(data)}
