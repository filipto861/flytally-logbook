import "server-only";

export async function measureServerTask<T>(label:string,task:()=>Promise<T>,slowMs=750):Promise<T>{
  const started=performance.now();
  try{return await task()}
  finally{
    const duration=Math.round(performance.now()-started);
    if(duration>=slowMs)console.warn("slow-server-task",{label,durationMs:duration});
  }
}
