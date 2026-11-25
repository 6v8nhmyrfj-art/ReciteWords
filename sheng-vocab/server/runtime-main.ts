const allowed=new Set(['rw-oral','rw-daily-oral','rw-create-student']);
Deno.serve(async req=>{
 const name=new URL(req.url).pathname.split('/')[1];
 if(!allowed.has(name))return new Response('Not found',{status:404});
 try {
  const worker=await EdgeRuntime.userWorkers.create({servicePath:'/home/deno/functions/'+name,memoryLimitMb:192,workerTimeoutMs:120000,noModuleCache:false,envVars:Object.entries(Deno.env.toObject())});
  return await worker.fetch(req);
 }catch(e){console.error('Function unavailable',name,e.name);return Response.json({error:'服务暂时不可用，请重试'},{status:503});}
});
