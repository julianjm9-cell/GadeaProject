/* In-memory answer outbox. Only drafts are retried automatically, never grading or finishing. */
(()=>{
 window.profesorCreateLiveSync=function({transport,onResult=()=>{},onStatus=()=>{},schedule=setTimeout,cancel=clearTimeout}){
  const drafts=new Map();let serial=Promise.resolve(),timer=null,retry=null,version=0,inFlight=0,failures=0,error=null,disposed=false;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const state=()=>({state:error?(retryable(error)?'pending':'blocked'):inFlight||drafts.size?'saving':'saved',pending:drafts.size+inFlight,error});
  const notify=()=>{if(!disposed)onStatus(state())};
  const retryable=err=>!err.status||err.status===429||err.status>=500;
  function retryLater(err){error=err;failures++;cancel(retry);retry=null;if(retryable(err)&&drafts.size&&!disposed)retry=schedule(()=>flush().catch(()=>{}),Math.min(30000,1500*2**Math.min(failures,4)));notify()}
  function queue(work){const result=serial.catch(()=>{}).then(work);serial=result;return result}
  async function wire(move){inFlight++;notify();try{const result=await transport(copy(move));onResult(result,move);return result}finally{inFlight--;notify()}}
  async function drain(){
   while(drafts.size&&!disposed){const [index,row]=drafts.entries().next().value;
    await wire({action:'draft',question_index:index,value:row.value});
    if(drafts.get(index)?.version===row.version)drafts.delete(index);
   }
   error=null;failures=0;cancel(retry);retry=null;notify();
  }
  function stage(index,value){if(disposed)return;drafts.set(index,{value:copy(value),version:++version});error=null;cancel(timer);timer=schedule(()=>flush().catch(()=>{}),400);notify()}
  function flush(){cancel(timer);timer=null;return queue(async()=>{try{await drain()}catch(err){retryLater(err);throw err}})}
  function send(move){cancel(timer);timer=null;return queue(async()=>{
   try{await drain();const result=await wire(move);error=null;failures=0;notify();return result}
   catch(err){retryLater(err);throw err}
  })}
  return {stage,flush,send,status:state,entries:()=>[...drafts].map(([index,row])=>[index,copy(row.value)]),
   resume:()=>drafts.size?flush():Promise.resolve(),
   dispose(){disposed=true;cancel(timer);cancel(retry);drafts.clear()}};
 };
})();
