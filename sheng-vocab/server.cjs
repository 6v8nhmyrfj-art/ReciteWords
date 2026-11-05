const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const allowed=new Set(['index.html','class.html','class-api.mjs','class-ui.mjs','student.mjs','student.css','teacher.mjs','teacher.css','style.css','app.js','auth.js','classroom.js','classroom.css','bookshelf.js','bookshelf.css','compat.js','单词库导入模板.csv']);
const types={'.mjs':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch{res.writeHead(400);return res.end('Bad request');}
 if(!allowed.has(name)){res.writeHead(404);return res.end('Not found');}
 fs.readFile(path.join(__dirname,name),(err,data)=>{if(err){res.writeHead(500);return res.end('File unavailable');}res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
});
server.on('error',err=>{console.error('启动失败：'+err.message);process.exitCode=1;});
if(require.main===module)server.listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>console.log('打开 http://127.0.0.1:'+server.address().port));
module.exports=server;
