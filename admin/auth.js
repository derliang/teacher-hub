/*
 * Copyright (c) 2026 derliang. All rights reserved.
 * Non-commercial use only. Sheng Kung Girls' High School
 * students and staff may use this software free of charge
 * for non-commercial educational purposes.
 * Other schools must obtain authorization by email.
 * Contact: derliang@gmail.com
 * See LICENSE.md for full terms.
 */
/* Client public data only. Never place client secret or credentials in this file. */
let conf=null,identity=null,token=null,registry=null;
const message=()=>document.querySelector('#auth-message');
async function api(path,method='GET',body=null){
  if(!conf||!token)throw Error('尚未登入');
  const response=await fetch(conf.apiBase.replace(/\/$/,'')+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({error:'HTTP_'+response.status}));
  if(!response.ok)throw Error(data.error||'HTTP_'+response.status);
  return data;
}
window.renderGrants=async function(){
 const root=document.querySelector('#grants-root');if(!root)return;
 if(!identity||identity.role!=='admin'){root.textContent='尚未通過管理員身分驗證。';return}
 root.textContent='正在讀取授權資料…';
 try{
  registry=await api('/api/admin/teachers');
  root.textContent='';
  const info=document.createElement('p');info.className='muted';info.textContent='目前已登記 '+registry.teachers.length+' 位教師。每位教師只能使用已核准勾選的 GAS 工具。';root.append(info);
  const form=document.createElement('form');form.className='teacher-editor';const email=document.createElement('input');email.type='email';email.required=true;email.placeholder='教師 Workspace Email';const sub=document.createElement('input');sub.required=true;sub.placeholder='Google 穩定帳號 ID（sub）';sub.title='測試階段需可信來源取得 sub。未來加入申請核准流程。';const labels=document.createElement('div');labels.className='permissions';
  const checks=registry.products.map(id=>{const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';label.append(cb,document.createTextNode(' '+id));labels.append(label);return {id,cb}});
  const enabled=document.createElement('label'),active=document.createElement('input');active.type='checkbox';active.checked=true;enabled.append(active,document.createTextNode(' 啟用教師帳號'));
  const save=document.createElement('button');save.type='submit';save.className='enabled';save.textContent='儲存這位老師的產品權限';const state=document.createElement('p');state.setAttribute('role','status');
  form.append(email,sub,labels,enabled,save,state);root.append(form);
  form.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;state.textContent='儲存中…';try{await api('/api/admin/teachers','POST',{email:email.value,googleSub:sub.value,products:checks.filter(x=>x.cb.checked).map(x=>x.id),enabled:active.checked});state.textContent='已由伺服器確認儲存。';setTimeout(()=>{if(document.querySelector('#grants-root'))renderGrants()},800)}catch(e){state.textContent='儲存失敗：'+e.message}finally{save.disabled=false}});
  const table=document.createElement('table');table.className='table';const head=document.createElement('thead');head.innerHTML='<tr><th>教師</th><th>授權程式</th><th>狀態</th><th>設定</th></tr>';const body=document.createElement('tbody');for(const t of registry.teachers){const tr=document.createElement('tr');for(const value of [t.email,(t.products||[]).join('、')||'未授權',t.status]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),edit=document.createElement('button');edit.type='button';edit.className='enabled';edit.textContent='編輯權限';edit.addEventListener('click',()=>{email.value=t.email;sub.value=t.id;active.checked=t.status==='active';checks.forEach(x=>x.cb.checked=(t.products||[]).includes(x.id));form.scrollIntoView({behavior:'smooth',block:'center'});state.textContent='編輯 '+t.email+' 的產品授權（尚未儲存）。'});td.append(edit);tr.append(td);body.append(tr)}table.append(head,body);root.append(table);
 }catch(e){root.textContent='讀取失敗：'+e.message}
};
async function login(credential){
 token=credential;
 try{identity=await api('/api/auth/me');if(identity.role!=='admin'){token=null;message().textContent='Google 帳號驗證完成，但沒有管理後台權限。';return}message().textContent='已通過 Workspace 管理員驗證：'+identity.email;document.querySelector('#logout').hidden=false;if(window.currentTab==='teachers'||document.querySelector('#grants-root'))renderGrants();}
 catch(e){token=null;identity=null;message().textContent='登入被拒絕：'+e.message}
}
document.querySelector('#logout').addEventListener('click',()=>{identity=null;token=null;document.querySelector('#logout').hidden=true;message().textContent='已登出後台。';if(window.google?.accounts?.id)google.accounts.id.disableAutoSelect();if(document.querySelector('#grants-root'))renderGrants()});
(async()=>{try{
 const res=await fetch('./auth-config.json',{cache:'no-store'});if(!res.ok)throw Error('設定尚未發布');
 conf=await res.json();if(!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(conf.clientId)||!/^https:\/\//.test(conf.apiBase))throw Error('OAuth Client ID / API URL 尚未設定');
 const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>{google.accounts.id.initialize({client_id:conf.clientId,callback:obj=>login(obj.credential),auto_select:false});google.accounts.id.renderButton(document.querySelector('#google-signin'),{theme:'outline',size:'large',text:'signin_with',locale:'zh_TW'});message().textContent='請以核准的 Workspace 管理員帳號登入；所有權限由後端核對。'};s.onerror=()=>message().textContent='Google 登入元件無法載入。';document.head.append(s)
}catch(e){message().textContent='尚未啟用真實登入測試：'+e.message+'。請先部署驗證後端並設定 Google OAuth Client ID。'}})();
