import {backendConfig} from './backend-config.mjs?v=performance-20261106';
const url=backendConfig.baseUrl,key=backendConfig.publishableKey;
export function createClassClient(request, getToken) {
  return async function call(path, method='GET', body) {
    const token=getToken();
    const headers={apikey:key,'Content-Type':'application/json'};
    if(token) headers.Authorization='Bearer '+token;
    const {status,data}=await request(url+path,{method,headers,body});
    if(status<200||status>=300) throw Object.assign(Error(status===401?'登录已过期，请重新登录。':path.includes('/token?')?'账号或密码有误，请重新输入。':'操作失败，请检查网络和权限。'),{status});
    return data;
  };
}
export function loginIdentity(account) {
  const value=account.trim();
  return value.includes('@')?value:value.toLowerCase()+'@students.recitewords.invalid';
}

