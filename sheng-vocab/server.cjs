const http=require('http'),fs=require('fs'),path=require('path');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/auth.js':'auth.js','/classroom.js':'classroom.js','/classroom.css':'classroom.css','/bookshelf.js':'bookshelf.js','/bookshelf.css':'bookshelf.css'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{const f=files[new URL(req.url,'http://localhost').pathname];if(!f){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',types[path.extname(f)]);res.setHeader('Cache-Control','no-store');fs.createReadStream(path.join(__dirname,f)).pipe(res);}).listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('Vocabulary preview server started'));

