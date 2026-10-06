import type {Scenario} from '../shared/engine.js';

/** Text-only Chat Completions SSE. Request content never controls the fixture. */
export function chatCompletionStream(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected Chat Completions request');
 const request=input as Record<string,unknown>;
 if(request.stream!==true||typeof request.model!=='string'||!request.model||request.model.length>200||!Array.isArray(request.messages)||!request.messages.length)throw Error('Expected model, messages and stream:true');
 if(request.messages.some(m=>!m||typeof m!=='object'||!['user','assistant','system','developer'].includes(m.role)||typeof m.content!=='string'||m.tool_calls))throw Error('Only text messages are supported');
 if((request.n!==undefined&&request.n!==1)||request.tools!==undefined||request.tool_choice!==undefined||request.functions!==undefined||request.function_call!==undefined||request.audio!==undefined||request.modalities!==undefined||request.stream_options!==undefined)throw Error('Only single-choice text streams without usage are supported');
 const metadata={id:`chatcmpl-${crypto.randomUUID()}`,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:request.model};
 const frame=(value:unknown)=>`data: ${JSON.stringify(value)}\n\n`;
 const chunk=(delta:Record<string,string>,finish_reason:string|null=null)=>frame({...metadata,choices:[{index:0,delta,finish_reason}]});
 return {start:chunk({role:'assistant',content:''}),event(event:Scenario['events'][number]){
  if(event.type==='text')return chunk({content:event.text});
  if(event.type==='error')return frame({error:{message:event.message,type:'server_error',code:'simulated_error',param:null}});
  return chunk({},'stop')+'data: [DONE]\n\n';
 }};
}
