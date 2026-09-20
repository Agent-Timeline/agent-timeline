import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { parseRunnerConfig } from '../shared/runner-config.js';
import { runConfiguredApp } from './runner.js';
try{
 const {values}=parseArgs({options:{config:{type:'string'},report:{type:'string'}}});
 if(!values.config)throw new Error('Usage: npm run run:app -- --config FILE [--report FILE]');
 const config=parseRunnerConfig(JSON.parse(await readFile(values.config,'utf8')));
 const controller=new AbortController();for(const sig of ['SIGINT','SIGTERM'] as const)process.once(sig,()=>controller.abort());
 const result=await runConfiguredApp(config,{signal:controller.signal});const json=JSON.stringify(result,null,2)+'\n';
 if(values.report)await writeFile(values.report,json);console.log(json);process.exitCode=result.kind==='pass'?0:result.kind==='fail'?1:2;
}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=2}
