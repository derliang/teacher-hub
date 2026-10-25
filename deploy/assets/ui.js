/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/** ui.js — 兩個頁面共用的小工具（DOM、跳脫、Google 登入狀態）。 */
import { Gate, loadConfig, loadGis, renderSignIn, FlowError } from './engine.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function show(el, on = true) { el.classList.toggle('hidden', !on); }

export function notice(kind, html) {
  return `<div class="notice ${kind}" role="${kind === 'bad' ? 'alert' : 'status'}">${html}</div>`;
}

export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** 步驟清單：keys＝[[key, 標題], …]；回傳 update(key, state, msg)。 */
export function stepList(container, keys) {
  container.innerHTML = `<ol class="prog">${keys.map(([k, t]) => `<li data-step="${k}"><span class="d">·</span><span>${esc(t)}<small></small></span></li>`).join('')}</ol>`;
  return (key, state, msg) => {
    const li = container.querySelector(`[data-step="${key}"]`);
    if (!li) return;
    li.className = state;
    li.querySelector('.d').textContent = state === 'done' ? '✓' : state === 'fail' ? '!' : state === 'run' ? '…' : '·';
    if (msg !== undefined) li.querySelector('small').textContent = msg || '';
  };
}

export function failRunningStep(container) {
  const li = container.querySelector('li.run');
  if (li) { li.className = 'fail'; li.querySelector('.d').textContent = '!'; }
}

/**
 * 共用開場：讀設定 → 連閘門 → 載入 Google 登入。
 * 回傳 { gate, info }；設定不完整時丟 FlowError('NOT_READY')。
 */
export async function boot(configBase) {
  const cfg = await loadConfig(configBase);
  if (!cfg.gateUrl) throw new FlowError('NOT_READY', '部署平台還沒有完成設定（缺少後端網址）。');
  const gate = new Gate(cfg.gateUrl);
  const info = await gate.bootstrap();
  if (!info.configured || !info.clientId) throw new FlowError('NOT_READY', '部署平台後端尚未完成設定（缺少 Google 登入設定或管理員）。');
  await loadGis();
  return { gate, info };
}

/** 顯示登入按鈕，登入成功後 resolve(idToken, payload)。 */
export function signIn(el, info) {
  return new Promise((resolve) => {
    renderSignIn(el, { clientId: info.clientId, hd: info.domains.length === 1 ? info.domains[0] : undefined, onCredential: (t, p) => resolve({ idToken: t, payload: p }) });
  });
}

export function signOut() {
  try { google.accounts.id.disableAutoSelect(); } catch { /* 未載入時忽略 */ }
  location.reload();
}

/** 失敗訊息：登入過期時引導重新登入（本機版第四輪巡檢 G-43 的教訓）。 */
export function errorHtml(e) {
  const relogin = e && (e.code === 'LOGIN_EXPIRED' || e.code === 'LOGIN_REQUIRED');
  return notice('bad', `<b>${esc(e && e.message || '發生未預期的錯誤')}</b>${relogin ? '　<button class="btn sm ghost" type="button" onclick="location.reload()">重新登入</button>' : ''}${e && e.code ? `<br><small class="mono">${esc(e.code)}</small>` : ''}`);
}
