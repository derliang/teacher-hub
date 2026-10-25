#!/usr/bin/env node
// Copyright (c) 2026 derliang. All rights reserved.
// Non-commercial use only. See LICENSE.md.
// Authorization inquiries: derliang@gmail.com
//
// fake-gate.mjs — 自助部署前台的本機目視／行為驗收工具（只在自己電腦用，不發佈、不連真實 Google）
//
//   node scripts/dev/fake-gate.mjs     → 首頁 http://localhost:8790/ 、自助部署 /deploy/ 、管理頁 /deploy/admin/
//
// 它提供三樣假的東西，讓真正的 teacher.js／admin.js／engine.js 原封不動地跑起來：
//   1. 假閘門（POST /gate）：bootstrap、me、release.bundle（雜湊真的算過）、lock.*、deploy.*、admin.*
//   2. 假 Google 登入：頁面上的「（示意）以 Google 帳號登入」按一下就登入；admin 頁自動以管理員身分
//   3. 假 Apps Script API：把 https://script.googleapis.com/v1/* 的 fetch 轉到本機記憶體裡的假專案
//      （建立專案、寫入內容、建版本、建立／更新部署都真的有效，所以安裝與更新的「成功路徑」可以走完）
//
// 情境切換（全域、只有一位使用者；用瀏覽器或 curl 打都可以，改完重新整理頁面）：
//   /__set?update=ok|noop|blocked|multi   更新分析的結果：可更新／已是最新／被阻擋（有不屬於產品的檔案）／有多個部署要選
//   /__set?fail=none|bundle|expired|upload|deploy
//                                         失敗注入：下載正式版失敗／流程中途登入過期（LOGIN_EXPIRED，要顯示「重新登入」鈕）／寫入程式失敗（500）／建立部署失敗（403）
//   /__set?delay=800                      每個假呼叫延遲毫秒（讓「執行中」的畫面停得住，預設 600）
//   /__set?me=ok|none|expired             登入後的授權：正常／沒有任何授權／登入已過期（LOGIN_EXPIRED）
//   /__set?notready=1                     後端未設定（頁面顯示「平台尚未開放」）；notready=0 取消
//   /__reset                              全部還原成預設並重建假專案與部署紀錄
//   /__state                              看目前情境與假專案（JSON）
// 例：http://localhost:8790/__set?update=blocked&delay=1500   （可同時帶多個參數）
//
// 不做的事：不連真實 Google、不寫檔、只監聽 127.0.0.1。真實 Google 驗收見私人 repo gas-deploy-helper 的 docs/self-service/SETUP_GUIDE.md 第 D 節。
// 所有資料都是示範用假資料（example.edu.tw），不放真實教師或學生資料。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const web = path.join(root, 'deploy');
const { canonicalBundleString } = await import(pathToFileURL(path.join(web, 'assets', 'core.js')).href);
const { gsBlockers } = await import(pathToFileURL(path.join(web, 'assets', 'gs-check.js')).href);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (email) => `${b64({ alg: 'none' })}.${b64({ sub: '1234567890', email })}.sig`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

// ── 假產品與正式版 ───────────────────────────────────
const VERSION = 'v2.8.0', OLD_VERSION = 'v2.7.0';
const product = {
  id: 'pingshi-grade-helper', name: '平時成績小幫手', defaultTitle: '平時成績小幫手',
  managedFiles: ['*.gs', 'appsscript.json'], generatedFiles: [], derivedFiles: [],
  versionResolver: { file: 'Code.gs', pattern: 'APP_VERSION = "([^"]+)"' },
  webApp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
  setupSteps: [
    '開啟 GAS 編輯器，在上方函式選單選「doGet」後按「執行」，依畫面以自己的學校帳號完成 Google 權限授權（只有第一次需要）。',
    '開啟系統網址，依初始化畫面建立或連結自己的成績試算表。',
    '確認能以系統內的帳號密碼登入後，再把網址分享給需要的人。'
  ]
};
const codeFile = (v) => ({ name: 'Code', type: 'SERVER_JS', source: `const APP_VERSION = "${v}";\nfunction doGet() { return HtmlService.createHtmlOutput('ok'); }\n` });
const manifest = { name: 'appsscript', type: 'JSON', source: '{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}' };
const bundle = { productId: product.id, version: VERSION, commit: '4be21a7c0ffee00112233445566778899aabbccd', files: [codeFile(VERSION), manifest] };
const sha256 = crypto.createHash('sha256').update(canonicalBundleString(bundle)).digest('hex');
const release = { version: VERSION, commit: bundle.commit, sha256, reviewedAt: '2026-10-20T08:00:00Z', requiresMigration: 'no', minFromVersion: '' };
const blockers = gsBlockers(bundle.files);
if (blockers.length) throw new Error('fake-gate 的示範正式版沒有通過 gs-check：' + blockers.join('；'));

// ── 可變狀態 ─────────────────────────────────────────
const KNOWN = '1AbCdEfGhIjKlMnOpQrStUvWxYz', INSTALLING = '1ZzYyXxWwVvUuTtSsRrQqPpOoNn', DEP = 'AKfycbxFAKEFAKEFAKE';
let scenario, projects, deployments, counter;

const depObj = (scriptId, id, versionNumber, description = '') => ({
  deploymentId: id, updateTime: now(),
  deploymentConfig: { scriptId, versionNumber, description, manifestFileName: 'appsscript' },
  entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: `https://script.google.com/macros/s/${id}/exec`, entryPointConfig: { ...product.webApp } } }]
});

function reset() {
  scenario = { update: 'ok', fail: 'none', delay: 600, me: 'ok', notready: 0 };
  counter = 100;
  projects = {
    [KNOWN]: { title: '平時成績小幫手－teacher01', files: [codeFile(OLD_VERSION), manifest], versions: 7, deps: { [DEP]: depObj(KNOWN, DEP, 7, `${product.name} ${OLD_VERSION}`) } },
    [INSTALLING]: { title: '平時成績小幫手－測試', files: [manifest, { name: 'Code', type: 'SERVER_JS', source: 'function myFunction() {\n}\n' }], versions: 0, deps: {} }
  };
  deployments = [
    { productId: product.id, status: 'active', title: projects[KNOWN].title, scriptId: KNOWN, version: OLD_VERSION, versionNumber: 7, execUrl: `https://script.google.com/macros/s/${DEP}/exec`, deploymentId: DEP, updatedAt: '2026-10-18T06:32:00Z', email: 'teacher01@example.edu.tw' },
    { productId: product.id, status: 'installing', title: projects[INSTALLING].title, scriptId: INSTALLING, updatedAt: '2026-10-17T01:05:00Z', email: 'teacher01@example.edu.tw' }
  ];
}
function applyUpdateScenario() {
  const p = projects[KNOWN];
  if (scenario.update === 'noop') { p.files = [codeFile(VERSION), manifest]; }
  else p.files = [codeFile(OLD_VERSION), manifest];
  if (scenario.update === 'blocked') p.files.push({ name: 'notes', type: 'HTML', source: '<p>老師自己加的檔案</p>' });
  p.deps = { [DEP]: depObj(KNOWN, DEP, 7, `${product.name} ${scenario.update === 'noop' ? VERSION : OLD_VERSION}`) };
  if (scenario.update === 'multi') p.deps.AKfycbxSECONDSECOND = depObj(KNOWN, 'AKfycbxSECONDSECOND', 5, '舊的測試網址');
}
reset();

const err = (res, status, message) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message } })); };
const json = (res, data) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

// ── 假閘門動作 ───────────────────────────────────────
const productEntry = () => ({ granted: true, product, latestRelease: release });
const emailOf = (b) => JSON.parse(Buffer.from(String(b.idToken).split('.')[1], 'base64url').toString()).email;
const gate = {
  bootstrap: () => (scenario.notready ? { configured: false } : { configured: true, clientId: 'fake-client', domains: ['example.edu.tw'] }),
  me: (b) => {
    if (scenario.me === 'expired') throw Object.assign(new Error('x'), { gateCode: 'LOGIN_EXPIRED' });
    const email = emailOf(b);
    const admin = email.startsWith('admin');
    return { email, role: scenario.me === 'none' && !admin ? 'none' : admin ? 'admin' : 'teacher', products: scenario.me === 'none' && !admin ? [] : [productEntry()], deployments: deployments.filter((d) => d.email === email || admin) };
  },
  'release.bundle': () => {
    if (scenario.fail === 'bundle') throw Object.assign(new Error('x'), { gateCode: 'NO_APPROVED_RELEASE' });
    if (scenario.fail === 'expired') throw Object.assign(new Error('x'), { gateCode: 'LOGIN_EXPIRED' });
    return { release, bundle };
  },
  'lock.acquire': () => ({ lease: 'lease-' + (++counter) }),
  'lock.release': () => ({}),
  'deploy.discardInstalling': (b) => { deployments = deployments.filter((d) => !(d.scriptId === b.scriptId && d.status === 'installing')); return {}; },
  'deploy.record': (b) => {
    const email = emailOf(b);
    if (b.phase === 'start' && b.kind === 'install') {
      if (!deployments.some((d) => d.scriptId === b.scriptId)) deployments.push({ productId: b.productId, status: 'installing', title: b.title, scriptId: b.scriptId, updatedAt: now(), email });
    } else if (b.phase === 'done') {
      const i = deployments.findIndex((d) => d.scriptId === b.scriptId);
      const row = { productId: b.productId, status: 'active', title: b.title, scriptId: b.scriptId, version: b.toVersion, versionNumber: b.versionNumber, execUrl: b.execUrl, deploymentId: b.deploymentId, updatedAt: now(), email };
      if (i >= 0) deployments[i] = row; else deployments.push(row);
    }
    return {};
  },
  'admin.teachers.list': () => ({ products: [{ id: product.id, name: product.name }], teachers: [
    { email: 'teacher01@example.edu.tw', sub: '1234', status: 'active', products: product.id, note: '國文科' },
    { email: 'teacher02@example.edu.tw', sub: '', status: 'active', products: '', note: '' },
    { email: 'teacher03@example.edu.tw', sub: '5678', status: 'disabled', products: product.id, note: '已離職' }] }),
  'admin.releases.list': () => ({ products: [{ id: product.id, name: product.name }], releases: [
    { productId: product.id, version: VERSION, commit: bundle.commit, status: 'pending', fileCount: 2, importedAt: '2026-10-20T07:00:00Z', importedBy: 'admin@example.edu.tw', requiresMigration: '', notes: '' },
    { productId: product.id, version: OLD_VERSION, commit: '9d1c3b2a0ffee00112233445566778899aabbccd', status: 'approved', fileCount: 2, importedAt: '2026-10-10T07:00:00Z', importedBy: 'admin@example.edu.tw', reviewedAt: '2026-10-11T07:00:00Z', reviewedBy: 'admin@example.edu.tw', requiresMigration: 'no', notes: '修正期中計算' },
    { productId: product.id, version: 'v2.5.0', commit: '1a2b3c4d0ffee00112233445566778899aabbccd', status: 'retired', fileCount: 2, importedAt: '2026-09-01T07:00:00Z', importedBy: 'admin@example.edu.tw', requiresMigration: 'yes', notes: '' }] }),
  'admin.deployments.list': () => ({ deployments: deployments.map((d) => ({ ...d, versionNumber: d.versionNumber || 0 })) }),
  'admin.audit.list': () => ({ audit: [
    { time: '2026-10-20T07:10:00Z', email: 'admin@example.edu.tw', action: 'admin.releases.import', productId: product.id, scriptId: '', result: 'ok', detail: `匯入 ${VERSION}` },
    { time: '2026-10-19T03:00:00Z', email: 'teacher09@gmail.com', action: 'me', productId: '', scriptId: '', result: 'denied', detail: '非學校帳號' }] })
};

// ── 假 Apps Script API ───────────────────────────────
function scriptApi(method, rest, body, res) {
  const parts = rest.split('?')[0].split('/').filter(Boolean);       // projects[/id[/content|versions|deployments[/depId]]]
  if (parts[0] !== 'projects') return err(res, 404, 'unknown');
  if (method === 'POST' && parts.length === 1) {
    const id = 'NEWPROJECT' + String(++counter).padStart(20, '0');
    projects[id] = { title: body.title, files: [manifest, { name: 'Code', type: 'SERVER_JS', source: 'function myFunction() {\n}\n' }], versions: 0, deps: {} };
    return json(res, { scriptId: id, title: body.title });
  }
  const p = projects[parts[1]];
  if (!p) return err(res, 404, 'Requested entity was not found.');
  const sub = parts[2];
  if (!sub && method === 'GET') return json(res, { scriptId: parts[1], title: p.title });
  if (sub === 'content' && method === 'GET') return json(res, { scriptId: parts[1], files: p.files });
  if (sub === 'content' && method === 'PUT') {
    if (scenario.fail === 'upload') return err(res, 500, '示範用：寫入程式失敗');
    p.files = body.files.map((f) => ({ name: f.name, type: f.type, source: f.source }));
    return json(res, { scriptId: parts[1], files: p.files });
  }
  if (sub === 'versions' && method === 'POST') return json(res, { scriptId: parts[1], versionNumber: ++p.versions, description: body.description });
  if (sub === 'deployments') {
    if (method === 'GET' && !parts[3]) return json(res, { deployments: Object.values(p.deps) });
    if (method === 'GET') return p.deps[parts[3]] ? json(res, p.deps[parts[3]]) : err(res, 404, 'deployment not found');
    if (method === 'POST') {
      if (scenario.fail === 'deploy') return err(res, 403, '示範用：建立部署被學校政策擋下');
      const id = 'AKfycbxNEW' + String(++counter).padStart(12, '0');
      return json(res, (p.deps[id] = depObj(parts[1], id, body.versionNumber, body.description)));
    }
    if (method === 'PUT') {
      const d = p.deps[parts[3]];
      if (!d) return err(res, 404, 'deployment not found');
      d.deploymentConfig.versionNumber = body.deploymentConfig.versionNumber; d.deploymentConfig.description = body.deploymentConfig.description || ''; d.updateTime = now();
      return json(res, d);
    }
  }
  return err(res, 404, 'unknown');
}

// ── 注入頁面的假 Google（登入、授權、並把 Apps Script API 轉到本機）──
function stub(email) {
  return `<script>
window.google={accounts:{id:{initialize(o){window.__cb=o.callback},renderButton(el){el.innerHTML='<button class="btn ghost" id="fakeGoogle" type="button">（示意）以 Google 帳號登入</button>';el.firstChild.onclick=()=>window.__cb({credential:'${jwt(email)}'})},disableAutoSelect(){}},
oauth2:{initTokenClient(o){return{requestAccessToken(){o.callback({access_token:'fake',expires_in:3600})}}},hasGrantedAllScopes(){return true}}}};
(function(){var f=window.fetch.bind(window),B='https://script.googleapis.com/v1/';window.fetch=function(u,o){u=String(u);return u.indexOf(B)===0?f('/__script/'+u.slice(B.length),o):f(u,o)}})();
</script>`;
}

// ── HTTP ─────────────────────────────────────────────
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const readBody = () => new Promise((r) => { let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => { try { r(JSON.parse(raw || '{}')); } catch { r({}); } }); });

  if (u.pathname === '/__reset') { reset(); return json(res, { ok: true, scenario }); }
  if (u.pathname === '/__set') {
    for (const [k, v] of u.searchParams) { if (k in scenario) scenario[k] = ['delay', 'notready'].includes(k) ? Number(v) : v; }
    projects[KNOWN] && applyUpdateScenario();
    return json(res, { ok: true, scenario });
  }
  if (u.pathname === '/__state') return json(res, { scenario, projects, deployments });

  if (u.pathname.startsWith('/__script/')) {
    const body = await readBody();
    await sleep(scenario.delay);
    return scriptApi(req.method, u.pathname.slice('/__script/'.length) + u.search, body, res);
  }
  if (u.pathname === '/gate' && req.method === 'POST') {
    const b = await readBody();
    await sleep(b.action === 'bootstrap' ? 0 : Math.min(scenario.delay, 400));
    res.writeHead(200, { 'content-type': 'application/json' });
    const h = gate[b.action];
    if (!h) return res.end(JSON.stringify({ ok: false, error: 'GATE_UNREACHABLE', detail: '示範用假閘門沒有實作 ' + b.action }));
    try { return res.end(JSON.stringify({ ok: true, data: h(b) })); } catch (e) { return res.end(JSON.stringify({ ok: false, error: e.gateCode || 'GATE_UNREACHABLE', detail: e.gateCode ? '' : String(e.message) })); }
  }
  if (u.pathname === '/deploy/config.json') return json(res, { gateUrl: '/gate' });
  let p = path.resolve(root, '.' + decodeURIComponent(u.pathname));
  if (!p.startsWith(root) || p.split(path.sep).includes('.git')) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(p);
  const rel = path.relative(root, p).split(path.sep).join('/');
  if (rel === 'deploy/index.html' || rel === 'deploy/admin/index.html') {
    body = Buffer.from(body.toString('utf8').replace('<head>', '<head>' + stub(rel === 'deploy/admin/index.html' ? 'admin@example.edu.tw' : 'teacher01@example.edu.tw')));
  }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}).listen(8790, '127.0.0.1', () => console.log('fake gate：首頁 http://localhost:8790/  自助部署 http://localhost:8790/deploy/  （情境切換見檔頭說明，例如 /__set?update=blocked&delay=1500）'));
