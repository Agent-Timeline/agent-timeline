import './style.css';
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const form=element<HTMLFormElement>('chat'),send=element<HTMLButtonElement>('send'),cancel=element<HTMLButtonElement>('cancel'),mode=element<HTMLSelectElement>('mode');
const output=element('response'),events=element('events'),status=element('status');
let cancelled=false;
cancel.onclick=()=>{cancelled=true;cancel.disabled=true;status.textContent='Cancelled';events.textContent+='Cancel requested\n'};
form.onsubmit=async event=>{
 event.preventDefault();if(send.disabled)return;
 cancelled=false;send.disabled=true;cancel.disabled=false;mode.disabled=true;output.textContent='';events.textContent='';status.textContent='Connecting';
 const fixed=mode.value==='fixed';let done=false;
 try{
  const response=await fetch('/timeline/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'synthetic-model',stream:true,messages:[{role:'user',content:element<HTMLTextAreaElement>('prompt').value}]})});
  if(!response.ok||!response.body)throw Error(`HTTP ${response.status}`);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try{while(true){const result=await reader.read();buffer+=decoder.decode(result.value,{stream:!result.done});let boundary;
   while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)continue;
    if(data==='[DONE]'){done=true;events.textContent+='Stream ended\n';if(!fixed||!cancelled)status.textContent='Completed';continue}
    const chunk=JSON.parse(data);if(chunk.error)throw Error(chunk.error.message);
    const text=chunk.choices?.[0]?.delta?.content;
    if(text){events.textContent+=`Text received: ${text}\n`;if(!fixed||!cancelled){output.textContent+=text;status.textContent='Streaming'}}
   }
   if(result.done)break;
  }
  if(!done)throw Error('Stream ended without completion');
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 }catch(error){status.textContent=`Error: ${String(error)}`;events.textContent+='Stream error\n'}
 finally{send.disabled=false;cancel.disabled=true;mode.disabled=false}
};
