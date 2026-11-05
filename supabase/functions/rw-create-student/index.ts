const origin = 'https://6v8nhmyrfj-art.github.io'
const headers = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'}
const reply = (text:string,status:number)=>new Response(JSON.stringify({message:text}),{status,headers})
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers})
  if(req.method!=='POST')return reply('只支持提交表单',405)
  const base=Deno.env.get('SUPABASE_URL')!
  const admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization=req.headers.get('Authorization')||''
  const session=await fetch(base+'/auth/v1/user',{headers:{apikey:admin,Authorization:authorization}})
  if(!session.ok)return reply('请重新登录',401)
  const {id}=await session.json()
  const privileged={apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'}
  const member=await fetch(base+'/rest/v1/rw_members?user_id=eq.'+encodeURIComponent(id)+'&role=eq.teacher&select=user_id',{headers:{apikey:admin,Authorization:authorization}})
  if(!member.ok||(await member.json()).length!==1)return reply('仅教师可创建账号',403)
  const {number,name,password}=await req.json()
  if(typeof number!=='string'||!/^[a-z0-9_-]{1,24}$/.test(number)||typeof name!=='string'||!name.trim()||name.length>30||typeof password!=='string'||password.length<10||password.length>72)return reply('请检查学号、姓名和密码长度',400)
  const result=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:privileged,body:JSON.stringify({email:number+'@students.recitewords.invalid',password,email_confirm:true,app_metadata:{rw_student_name:name.trim()}})})
  if(!result.ok)return reply('创建失败，请检查学号是否已使用及密码强度',result.status===422?409:400)
  return reply('学生账号已创建',201)
})