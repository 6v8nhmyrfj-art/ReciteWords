'use strict';
window.newRecordId = () => {
 if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
 if (!globalThis.crypto?.getRandomValues) throw new Error('浏览器不支持生成记录编号');
 const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
 const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
};
