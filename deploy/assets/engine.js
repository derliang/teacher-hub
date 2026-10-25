/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/**
 * engine.js — 瀏覽器端：閘門連線、Google 登入／授權、Apps Script API 與安裝／更新流程
 *
 * 安全邊界：
 * - 老師的 Apps Script 存取權杖只存在這個分頁的記憶體，不送到閘門、不寫入儲存空間。
 * - 閘門只收到 Google ID Token（身分證明）與部署 metadata。
 * - 每個寫入步驟前都重新讀取並比對遠端狀態；結果不明時停下，不自動重試。
 */
import {
  canonicalBundleString, diffContent, webAppDeployments, pickDeployment, evaluateUpdate,
  explainApiError, explainGateError, foreignFilesForResume
} from './core.js';
import { gsBlockers } from './gs-check.js';

export const SCRIPT_SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments'
];

export class FlowError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

// ── 設定 ──────────────────────────────────────────────

export async function loadConfig(base = './') {
  try {
    const r = await fetch(`${base}config.json`, { cache: 'no-store' });
    if (!r.ok) return { gateUrl: '' };
    const c = await r.json();
    return { gateUrl: String(c.gateUrl || '').trim() };
  } catch { return { gateUrl: '' }; }
}

// ── 閘門 ──────────────────────────────────────────────

/** 組閘門請求：action／idToken 一定放最後，payload 裡同名欄位不能蓋掉它們。 */
export function gateRequestBody(action, idToken, payload = {}) {
  if ('action' in payload || 'idToken' in payload) throw new FlowError('BAD_PAYLOAD', `內部錯誤：請求內容不可含保留欄位（${action}）。`);
  return { ...payload, action, idToken };
}

export class Gate {
  constructor(url) { this.url = url; this.idToken = ''; }

  async call(action, payload = {}) {
    let resp;
    try {
      resp = await fetch(this.url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(gateRequestBody(action, this.idToken, payload))
      });
    } catch (e) {
      throw new FlowError('GATE_UNREACHABLE', '無法連線到部署平台後端，請檢查網路後再試。');
    }
    let body;
    try { body = await resp.json(); } catch { throw new FlowError('GATE_BAD_RESPONSE', '部署平台後端回應格式錯誤。'); }
    if (!body.ok) throw new FlowError(body.error, explainGateError(body.error, body.detail), { status: body.status });
    return body.data;
  }

  bootstrap() { return this.call('bootstrap'); }
}

// ── Google 登入（身分）與授權（Apps Script API）──────────

export function loadGis() {
  if (window.google && google.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new FlowError('GIS_LOAD_FAILED', '無法載入 Google 登入元件。'));
    document.head.appendChild(s);
  });
}

/** 渲染 Google 登入按鈕；成功時呼叫 onCredential(idToken, payload)。 */
export function renderSignIn(el, { clientId, hd, onCredential }) {
  google.accounts.id.initialize({
    client_id: clientId, hd, auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_prompt: true,
    callback: (r) => onCredential(r.credential, decodeJwt(r.credential))
  });
  google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'zh-TW' });
}

export function decodeJwt(t) {
  try {
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(p).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch { return {}; }
}

/** 取得 Apps Script API 存取權杖（彈出 Google 授權視窗）。 */
export function requestScriptAccess({ clientId, email }) {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCRIPT_SCOPES.join(' '), hint: email, prompt: '',
      callback: (r) => {
        if (r.error) return reject(new FlowError('OAUTH_DENIED', '沒有完成 Google 授權，無法安裝或更新。'));
        if (!SCRIPT_SCOPES.every((s) => google.accounts.oauth2.hasGrantedAllScopes(r, s))) {
          return reject(new FlowError('SCOPES_MISSING', '授權時需要勾選「管理 Apps Script 專案」與「管理部署」兩項權限。'));
        }
        resolve({ token: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) - 60) * 1000 });
      },
      error_callback: () => reject(new FlowError('OAUTH_DENIED', '授權視窗被關閉或被瀏覽器擋下，請允許彈出視窗後再試。'))
    });
    client.requestAccessToken();
  });
}

// ── Apps Script API ──────────────────────────────────

export class ScriptApi {
  constructor(token) { this.token = token; }

  async req(method, path, body) {
    const resp = await fetch(`https://script.googleapis.com/v1/${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await resp.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: { message: text.slice(0, 200) } }; }
    if (!resp.ok) {
      const e = explainApiError(resp.status, json);
      throw new FlowError(e.code, e.message, { status: resp.status });
    }
    return json;
  }

  createProject(title) { return this.req('POST', 'projects', { title }); }
  getProject(id) { return this.req('GET', `projects/${id}`); }
  getContent(id) { return this.req('GET', `projects/${id}/content`); }
  updateContent(id, files) { return this.req('PUT', `projects/${id}/content`, { files: files.map(({ name, type, source }) => ({ name, type, source })) }); }
  createVersion(id, description) { return this.req('POST', `projects/${id}/versions`, { description }); }
  async listDeployments(id) {
    let out = [], token = '';
    do {
      const r = await this.req('GET', `projects/${id}/deployments?pageSize=50${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
      out = out.concat(r.deployments || []); token = r.nextPageToken || '';
    } while (token);
    return out;
  }
  getDeployment(id, depId) { return this.req('GET', `projects/${id}/deployments/${depId}`); }
  createDeployment(id, versionNumber, description) {
    return this.req('POST', `projects/${id}/deployments`, { versionNumber, manifestFileName: 'appsscript', description });
  }
  updateDeployment(id, depId, versionNumber, description) {
    return this.req('PUT', `projects/${id}/deployments/${depId}`, { deploymentConfig: { scriptId: id, versionNumber, manifestFileName: 'appsscript', description } });
  }
}

// ── 共用 ──────────────────────────────────────────────

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 從閘門取正式版並在瀏覽器重算雜湊。 */
export async function fetchVerifiedBundle(gate, productId) {
  const { release, bundle } = await gate.call('release.bundle', { productId });
  const hash = await sha256Hex(canonicalBundleString(bundle));
  if (hash !== release.sha256 || bundle.productId !== productId || bundle.version !== release.version) {
    throw new FlowError('RELEASE_INTEGRITY_FAILED', '正式版檔案完整性檢查失敗，已停止。請聯絡管理員。');
  }
  const blockers = gsBlockers(bundle.files);
  if (blockers.length) throw new FlowError('RELEASE_CODE_INVALID', `正式版程式檢查沒有通過，已停止（${blockers[0]}）。請聯絡管理員。`);
  return { release, bundle };
}

function webAppOf(dep) {
  const ep = (dep.entryPoints || []).find((e) => e.entryPointType === 'WEB_APP');
  return ep && ep.webApp ? { url: ep.webApp.url, ...(ep.webApp.entryPointConfig || {}) } : null;
}

const PENDING_KEY = (email, productId) => `gasdeploy.pending.${email}.${productId}`;

export function readPendingInstall(email, productId) {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY(email, productId)) || 'null'); } catch { return null; }
}
function writePendingInstall(email, productId, obj) {
  try { obj ? localStorage.setItem(PENDING_KEY(email, productId), JSON.stringify(obj)) : localStorage.removeItem(PENDING_KEY(email, productId)); } catch { /* 私密視窗等情況可忽略 */ }
}

// ── 首次安裝 ──────────────────────────────────────────

/**
 * 建立老師自己的獨立 GAS 並發布為網頁應用程式。
 * 中斷後若本機記得已建立的 scriptId，會接續那個專案，不會再建第二份。
 */
export async function runInstall({ gate, api, me, product, release, bundle, title, resumeScriptId, onStep }) {
  const step = (k, s, msg) => onStep && onStep(k, s, msg);
  const pending = readPendingInstall(me.email, product.id);
  let scriptId = resumeScriptId || (pending && pending.scriptId) || '';
  const lockTarget = scriptId || `new:${product.id}:${me.sub}`;
  const lock = await gate.call('lock.acquire', { target: lockTarget });
  try {
    step('create', 'run');
    if (scriptId) {
      const proj = await api.getProject(scriptId);
      const current = await api.getContent(scriptId);
      const foreign = foreignFilesForResume(product, current.files || []);
      if (foreign.length) {
        throw new FlowError('RESUME_FOREIGN_FILES', `上次未完成的專案「${proj.title}」裡有不屬於「${product.name}」的檔案（${foreign.slice(0, 5).join('、')}），為避免覆蓋已停止。請聯絡管理員。`);
      }
      if (!resumeScriptId) {
        await gate.call('deploy.record', { productId: product.id, kind: 'install', phase: 'start', scriptId, title: proj.title, toVersion: release.version });
      }
      title = proj.title;
      step('create', 'done', `接續上次已建立的專案「${proj.title}」`);
    } else {
      const p = await api.createProject(title);
      scriptId = p.scriptId;
      writePendingInstall(me.email, product.id, { scriptId, title, startedAt: Date.now() });
      await gate.call('deploy.record', { productId: product.id, kind: 'install', phase: 'start', scriptId, title, toVersion: release.version });
      step('create', 'done', `已建立「${title}」`);
    }

    step('upload', 'run');
    await api.updateContent(scriptId, bundle.files);
    step('upload', 'done', `已寫入 ${bundle.files.length} 個程式檔`);

    step('version', 'run');
    const v = await api.createVersion(scriptId, `${product.name} ${release.version}（${release.commit.slice(0, 7)}）自助安裝`);
    step('version', 'done', `GAS 版本 #${v.versionNumber}`);

    step('deploy', 'run');
    const dep = await api.createDeployment(scriptId, v.versionNumber, `${product.name} ${release.version}`);
    const wa = webAppOf(dep) || webAppOf(await api.getDeployment(scriptId, dep.deploymentId));
    if (!wa || !wa.url) throw new FlowError('NO_WEBAPP_URL', '部署已建立，但 Google 沒有回傳網頁網址。請到 GAS 編輯器確認。', { scriptId });
    if (wa.executeAs !== product.webApp.executeAs || wa.access !== product.webApp.access) {
      throw new FlowError('ACCESS_POLICY', `Google 實際套用的權限（${wa.executeAs}／${wa.access}）與正式版要求不同，可能是學校管理政策限制。已停止，請聯絡管理員。`, { scriptId });
    }
    step('deploy', 'done', '已發布網頁應用程式');

    step('record', 'run');
    await gate.call('deploy.record', {
      productId: product.id, kind: 'install', phase: 'done', scriptId, title, deploymentId: dep.deploymentId, execUrl: wa.url,
      toVersion: release.version, sha256: release.sha256, versionNumber: v.versionNumber
    });
    writePendingInstall(me.email, product.id, null);
    step('record', 'done');
    return { scriptId, deploymentId: dep.deploymentId, url: wa.url, versionNumber: v.versionNumber };
  } catch (e) {
    if (scriptId) {
      gate.call('deploy.record', { productId: product.id, kind: 'install', phase: 'failed', scriptId, error: e.code || 'ERROR' }).catch(() => {});
    }
    throw e;
  } finally {
    gate.call('lock.release', { target: lockTarget, lease: lock.lease }).catch(() => {});
  }
}

// ── 更新（唯讀分析）───────────────────────────────────

export async function analyzeUpdate({ api, product, release, bundle, scriptId, knownDeploymentId, chosenDeploymentId }) {
  const project = await api.getProject(scriptId);
  const content = await api.getContent(scriptId);
  const remoteFiles = content.files || [];
  const diff = diffContent(product, remoteFiles, bundle);
  const list = webAppDeployments(await api.listDeployments(scriptId));
  let pick = pickDeployment(list, knownDeploymentId);
  if (pick.status === 'choose' && chosenDeploymentId) {
    pick = { ...pick, chosen: list.find((d) => d.deploymentId === chosenDeploymentId) || null };
  }
  const verdict = evaluateUpdate({ product, release, diff, deploymentPick: pick });
  return {
    scriptId, title: project.title, remoteFiles, remoteHash: await sha256Hex(JSON.stringify(remoteFiles.map((f) => [f.name, f.type, f.source]))),
    diff, deployments: list, pick, verdict
  };
}

// ── 更新（寫入）───────────────────────────────────────

/**
 * 同網址更新：updateContent → versions.create → deployments.update（原 deploymentId）→ 回讀驗證。
 * 寫入前重讀遠端內容，與分析時不同就停止（避免覆蓋剛被改過的程式）。
 * 部署切換前失敗：把 HEAD 程式內容還原成更新前的檔案，正式網址從未改變。
 */
export async function runUpdate({ gate, api, product, release, bundle, analysis, onStep }) {
  const step = (k, s, msg) => onStep && onStep(k, s, msg);
  const { scriptId } = analysis;
  const dep = analysis.pick.chosen;
  if (!analysis.verdict.ok || !dep) throw new FlowError('NOT_ALLOWED', '更新前檢查沒有通過。');
  const lock = await gate.call('lock.acquire', { target: scriptId });
  let contentWritten = false, switched = false;
  const base = { productId: product.id, kind: 'update', scriptId, title: analysis.title, deploymentId: dep.deploymentId, fromVersion: analysis.diff.remoteVersion, toVersion: release.version };
  try {
    step('verify', 'run');
    const fresh = await api.getContent(scriptId);
    const freshHash = await sha256Hex(JSON.stringify((fresh.files || []).map((f) => [f.name, f.type, f.source])));
    if (freshHash !== analysis.remoteHash) throw new FlowError('REMOTE_CHANGED', '分析之後 GAS 程式又被修改過，為安全起見已停止。請重新分析。');
    const before = (await api.getDeployment(scriptId, dep.deploymentId));
    const beforeWa = webAppOf(before);
    if (!beforeWa || beforeWa.url !== dep.url || before.deploymentConfig.versionNumber !== dep.versionNumber) {
      throw new FlowError('REMOTE_CHANGED', '部署狀態在分析之後有變動，已停止。請重新分析。');
    }
    await gate.call('deploy.record', { ...base, phase: 'start', prevVersionNumber: dep.versionNumber });
    step('verify', 'done', `目前部署指向 GAS 版本 #${dep.versionNumber}`);

    let versionNumber;
    if (analysis.diff.identical) {
      step('upload', 'done', '程式內容已與正式版相同，不需重寫');
    } else {
      step('upload', 'run');
      await api.updateContent(scriptId, bundle.files);
      contentWritten = true;
      step('upload', 'done', `已更新 ${analysis.diff.changed.length + analysis.diff.added.length} 個、移除 ${analysis.diff.removed.length} 個檔案`);
    }

    step('version', 'run');
    const v = await api.createVersion(scriptId, `${product.name} ${release.version}（${release.commit.slice(0, 7)}）自助更新，原版本 #${dep.versionNumber}`);
    versionNumber = v.versionNumber;
    step('version', 'done', `GAS 版本 #${versionNumber}`);

    step('deploy', 'run');
    try {
      await api.updateDeployment(scriptId, dep.deploymentId, versionNumber, `${product.name} ${release.version}`);
      switched = true;
    } catch (e) {
      // 結果不明：回讀判斷是否其實已切換
      const now = await api.getDeployment(scriptId, dep.deploymentId).catch(() => null);
      if (now && now.deploymentConfig.versionNumber === versionNumber) switched = true;
      else throw e;
    }
    const after = await api.getDeployment(scriptId, dep.deploymentId);
    const afterWa = webAppOf(after);
    if (after.deploymentId !== dep.deploymentId || !afterWa || afterWa.url !== dep.url || after.deploymentConfig.versionNumber !== versionNumber) {
      throw new FlowError('VERIFY_FAILED', '更新後回讀的部署與預期不符，請勿關閉頁面，並聯絡管理員。', { unknown: true });
    }
    step('deploy', 'done', '網址不變，已指向新版本');

    step('record', 'run');
    await gate.call('deploy.record', { ...base, phase: 'done', execUrl: dep.url, sha256: release.sha256, versionNumber, prevVersionNumber: dep.versionNumber });
    step('record', 'done');
    return { url: dep.url, versionNumber, prevVersionNumber: dep.versionNumber };
  } catch (e) {
    if (!switched && contentWritten) {
      try {
        await api.updateContent(scriptId, analysis.remoteFiles);
        gate.call('deploy.record', { ...base, phase: 'restored', error: e.code || 'ERROR' }).catch(() => {});
        e.message += '（已把程式內容還原成更新前的狀態；正式網址一直指向原版本，沒有受影響。）';
      } catch {
        e.message += '（自動還原程式內容失敗；正式網址仍指向原版本，使用者不受影響，但請聯絡管理員。）';
      }
    } else if (switched) {
      gate.call('deploy.record', { ...base, phase: 'unknown', error: e.code || 'ERROR' }).catch(() => {});
    } else {
      gate.call('deploy.record', { ...base, phase: 'failed', error: e.code || 'ERROR' }).catch(() => {});
    }
    throw e;
  } finally {
    gate.call('lock.release', { target: scriptId, lease: lock.lease }).catch(() => {});
  }
}

export function maskId(id) {
  const s = String(id || '');
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
