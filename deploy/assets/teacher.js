/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/** teacher.js — 老師自助安裝／更新頁 */
import { requestScriptAccess, ScriptApi, fetchVerifiedBundle, runInstall, analyzeUpdate, runUpdate, maskId, FlowError } from './engine.js';
import { compareVersions, parseScriptIdInput } from './core.js';
import { $, esc, show, notice, fmtTime, stepList, failRunningStep, boot, signIn, signOut, errorHtml } from './ui.js';

const state = { gate: null, info: null, me: null, idPayload: null, access: null, busy: false };
const wantProduct = new URLSearchParams(location.search).get('product') || '';

const flow = $('#flowPanel');
const statusEl = $('#status');

/** 產品 id → 首頁同一張插畫（發布後在 ../images/cards/<檔名>.svg）。沒有對應就不顯示縮圖，不用 emoji 或符號代替。 */
const PRODUCT_ART = { 'pingshi-grade-helper': 'grade' };

/**
 * 執行中鎖住所有操作鈕；結束時只還原「這次被鎖住的」按鈕。
 * ⛔ 不可一律設回可按：確認勾選前的「開始安裝／開始更新」本來就是停用的，結束忙碌時若一起解鎖，
 *    等於跳過確認（瀏覽器實測抓到過）。
 */
function setBusy(on) {
  state.busy = on;
  document.querySelectorAll('button[data-lock]').forEach((b) => {
    if (on && !b.disabled) { b.disabled = true; b.dataset.busyLocked = '1'; }
    if (!on && b.dataset.busyLocked === '1') { b.disabled = false; delete b.dataset.busyLocked; }
  });
}

async function api() {
  if (!state.access || state.access.expiresAt < Date.now()) {
    state.access = await requestScriptAccess({ clientId: state.info.clientId, email: state.me.email });
  }
  return new ScriptApi(state.access.token);
}

// ── 開場 ──────────────────────────────────────────────

async function start() {
  try {
    statusEl.innerHTML = notice('info', '正在連線部署平台…');
    const { gate, info } = await boot('./');
    state.gate = gate; state.info = info;
    statusEl.innerHTML = '';
    show($('#signInPanel'));
    const { idToken, payload } = await signIn($('#signInBtn'), info);
    state.gate.idToken = idToken; state.idPayload = payload;
    show($('#signInPanel'), false);
    await loadMe();
  } catch (e) {
    statusEl.innerHTML = e.code === 'NOT_READY'
      ? notice('warn', `<b>平台尚未開放</b><br>${esc(e.message)}目前只能瀏覽說明，無法登入或部署。`)
      : errorHtml(e);
  }
}

async function loadMe() {
  statusEl.innerHTML = notice('info', '正在確認你的授權…');
  const me = await state.gate.call('me');
  state.me = { ...me, sub: state.idPayload.sub };
  $('#whoEmail').textContent = me.email;
  show($('#who'));
  statusEl.innerHTML = '';
  renderProducts();
}

$('#signOutBtn').addEventListener('click', signOut);

// ── 產品卡片 ──────────────────────────────────────────

function renderProducts() {
  const me = state.me;
  let list = me.products.filter((p) => p.granted);
  if (wantProduct) list = list.filter((p) => p.product.id === wantProduct);
  if (me.role === 'none' || !list.length) {
    $('#products').innerHTML = notice('warn', `<b>你的帳號（${esc(me.email)}）還沒有${wantProduct ? '這個系統的' : '任何系統的'}使用授權。</b><br>請把這個 Email 告訴管理員，開通後重新整理本頁即可。`);
    return;
  }
  $('#products').innerHTML = list.map((p) => productCard(p)).join('');
  list.forEach((p) => bindProductCard(p));
}

function productCard(p) {
  const deps = state.me.deployments.filter((d) => d.productId === p.product.id);
  const latest = p.latestRelease;
  const depHtml = deps.length ? `<div class="deps">${deps.map((d) => {
    if (d.status === 'installing') {
      return `<div class="dep"><div><span class="st st-wip">安裝未完成</span> <b>${esc(d.title || '未命名')}</b><div class="u"><span class="mono">${esc(maskId(d.scriptId))}</span></div><small>${fmtTime(d.updatedAt)}</small></div>
        <div class="btns"><button class="btn sm" type="button" data-lock data-act="resume" data-script="${esc(d.scriptId)}">接續安裝</button><button class="btn sm ghost" type="button" data-lock data-act="discard" data-script="${esc(d.scriptId)}">放棄這筆紀錄</button></div></div>`;
    }
    const outdated = latest && d.version && compareVersions(d.version, latest.version) < 0;
    return `<div class="dep"><div><b>${esc(d.title || '我的系統')}</b> <span class="st ${outdated ? 'st-wip' : 'st-ok'}">${esc(d.version || '版本未知')}${outdated ? '・有新版' : '・最新'}</span>
      <div class="u"><a class="mono" href="${esc(d.execUrl)}" target="_blank" rel="noopener">${esc(d.execUrl)}</a></div><small>更新時間 ${fmtTime(d.updatedAt)}</small></div>
      <div class="btns"><button class="btn sm" type="button" data-lock data-act="update" data-script="${esc(d.scriptId)}" data-dep="${esc(d.deploymentId)}">${outdated ? '更新到新版' : '檢查更新'}</button></div></div>`;
  }).join('')}</div>` : '';
  const art = PRODUCT_ART[p.product.id];
  const thumb = art ? `<img src="../images/cards/${esc(art)}.svg" alt="${esc(p.product.name)}插畫" onerror="this.hidden=true;this.parentNode.classList.add('noart')">` : '';
  return `<article class="panel" data-product="${esc(p.product.id)}">
    <div class="prod${art ? '' : ' noart'}">${thumb}<div>
      <h2>${esc(p.product.name)}</h2>
      <p>${latest ? `目前正式版 <b>${esc(latest.version)}</b>（${fmtTime(latest.reviewedAt)} 核准）` : '目前沒有已核准的正式版，暫時無法安裝或更新。'}</p>
    </div></div>
    ${depHtml}
    <div class="btns">
      <button class="btn" type="button" data-lock data-act="install" ${latest ? '' : 'disabled data-force-disabled="1"'}>＋ 首次安裝</button>
      <button class="btn ghost" type="button" data-lock data-act="update-other" ${latest ? '' : 'disabled data-force-disabled="1"'}>更新其他既有的 GAS</button>
    </div>
  </article>`;
}

function bindProductCard(p) {
  const card = document.querySelector(`[data-product="${CSS.escape(p.product.id)}"]`);
  card.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b || state.busy) return;
    const act = b.dataset.act;
    if (act === 'install') openInstall(p);
    if (act === 'resume') openInstall(p, b.dataset.script);
    if (act === 'discard') discardInstalling(p, b.dataset.script);
    if (act === 'update') openUpdate(p, b.dataset.script, b.dataset.dep);
    if (act === 'update-other') openUpdate(p, '', '');
  });
}

async function discardInstalling(p, scriptId) {
  if (!confirm('只會移除這筆「安裝未完成」紀錄，你 Google 帳號裡已建立的 GAS 專案不會被刪除（需要的話請自己到 Apps Script 首頁刪除）。確定嗎？')) return;
  try {
    setBusy(true);
    await state.gate.call('deploy.discardInstalling', { productId: p.product.id, scriptId });
    await loadMe();
  } catch (e) { statusEl.innerHTML = errorHtml(e); } finally { setBusy(false); }
}

function openFlow(html) {
  flow.innerHTML = html;
  show(flow);
  flow.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const PREFLIGHT = `<div class="notice info"><b>開始前請確認一次：</b>你的帳號已開啟「Google Apps Script API」。
  請到 <a href="https://script.google.com/home/usersettings" target="_blank" rel="noopener">Apps Script 使用者設定</a> 把它切成「開啟」（只需要做一次）。</div>`;

// ── 首次安裝 ──────────────────────────────────────────

function openInstall(p, resumeScriptId = '') {
  const prod = p.product;
  const actives = state.me.deployments.filter((d) => d.productId === prod.id && d.status !== 'installing');
  const local = state.me.email.split('@')[0];
  openFlow(`
    <h2>${resumeScriptId ? '接續未完成的安裝' : '首次安裝'}：${esc(prod.name)} ${esc(p.latestRelease.version)}</h2>
    ${PREFLIGHT}
    ${resumeScriptId ? notice('info', `會接續上次已建立的專案（${esc(maskId(resumeScriptId))}），不會另外再建一份。`) : `
    <div><label class="lbl" for="titleInput">GAS 專案名稱（之後在 Apps Script 首頁看到的名稱）</label>
    <input class="inp" type="text" id="titleInput" maxlength="80" value="${esc(`${prod.defaultTitle}－${local}`)}"></div>`}
    ${!resumeScriptId && actives.length ? notice('warn', `<b>你已經安裝過 ${actives.length} 份「${esc(prod.name)}」。</b>想要升級請改按該系統旁的「更新」，網址才會維持不變。再安裝一份會產生新的網址與新的系統，需要重新設定。`) + `
      <label class="chk"><input type="checkbox" id="dupOk"> 我知道已經有安裝，仍要另外再安裝一份新的</label>` : ''}
    <dl class="kv">
      <dt>Google 帳號</dt><dd>${esc(state.me.email)}</dd>
      <dt>安裝版本</dt><dd>${esc(p.latestRelease.version)}（${esc(p.latestRelease.commit.slice(0, 7))}）</dd>
      <dt>網頁存取設定</dt><dd>任何知道網址的人都能開啟頁面；登入與資料權限由系統本身控管</dd>
      <dt>將會產生</dt><dd>一個新的 GAS 專案與一個新的網頁網址</dd>
    </dl>
    <label class="chk"><input type="checkbox" id="installOk"> 我確認要在我的 Google 帳號${resumeScriptId ? '完成這個專案的安裝' : '建立新的 GAS 專案'}並發布成網頁</label>
    <div class="btns"><button class="btn" type="button" id="installGo" data-lock disabled>開始安裝</button><button class="btn ghost" type="button" id="flowCancel" data-lock>取消</button></div>
    <div class="slot" id="installSteps"></div><div class="slot" id="installResult"></div>`);
  const ok = $('#installOk'), dup = $('#dupOk'), go = $('#installGo');
  const sync = () => { go.disabled = state.busy || !ok.checked || (dup && !dup.checked); };
  ok.addEventListener('change', sync); if (dup) dup.addEventListener('change', sync);
  $('#flowCancel').addEventListener('click', () => show(flow, false));
  go.addEventListener('click', () => doInstall(p, resumeScriptId));
}

async function doInstall(p, resumeScriptId) {
  const prod = p.product;
  const title = resumeScriptId ? '' : ($('#titleInput').value || '').trim();
  if (!resumeScriptId && !title) { $('#installResult').innerHTML = notice('bad', '請輸入專案名稱。'); return; }
  const update = stepList($('#installSteps'), [
    ['auth', '取得 Google 授權'], ['bundle', '下載並驗證正式版'], ['create', '建立 GAS 專案'],
    ['upload', '寫入程式'], ['version', '建立版本'], ['deploy', '發布網頁應用程式'], ['record', '登記完成']
  ]);
  $('#installResult').innerHTML = '';
  // 按下後確認勾選與按鈕都作廢：成功不能再按一次（會多建一份），失敗要重新勾選確認才能重試
  const ok = $('#installOk'); ok.checked = false; ok.disabled = true; $('#installGo').disabled = true;
  setBusy(true);
  try {
    update('auth', 'run');
    const scriptApi = await api();
    update('auth', 'done');
    update('bundle', 'run');
    const { release, bundle } = await fetchVerifiedBundle(state.gate, prod.id);
    update('bundle', 'done', `${release.version}，${bundle.files.length} 個檔案，完整性已驗證`);
    const r = await runInstall({ gate: state.gate, api: scriptApi, me: state.me, product: prod, release, bundle, title, resumeScriptId, onStep: update });
    const editor = `https://script.google.com/d/${encodeURIComponent(r.scriptId)}/edit`;
    $('#installResult').innerHTML = notice('ok', `<b>安裝完成！還差最後幾步你要自己完成：</b>`) + `
      <ol class="todo">${prod.setupSteps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
      <dl class="kv"><dt>GAS 編輯器</dt><dd><a href="${esc(editor)}" target="_blank" rel="noopener">開啟編輯器（第 1 步在這裡做）</a></dd>
      <dt>系統網址</dt><dd><a class="mono" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></dd></dl>
      ${notice('info', '還沒完成第 1 步之前，打開系統網址會看到「需要存取權」或 403，這是 Google 的正常限制，不是安裝失敗。')}`;
    await loadMe();
  } catch (e) {
    failRunningStep($('#installSteps'));
    $('#installResult').innerHTML = errorHtml(e) + notice('info', '要重試請重新勾選上方的確認；已經建立的專案會被接續使用，不會多建一份。');
    ok.disabled = false;
  } finally { setBusy(false); }
}

// ── 更新 ──────────────────────────────────────────────

function openUpdate(p, scriptId, deploymentId) {
  const prod = p.product;
  openFlow(`
    <h2>更新：${esc(prod.name)} → ${esc(p.latestRelease.version)}</h2>
    ${PREFLIGHT}
    ${scriptId ? '' : `<div><label class="lbl" for="scriptInput">貼上要更新的 GAS 編輯器網址（或專案 ID）</label>
      <input class="inp" type="text" id="scriptInput" placeholder="https://script.google.com/d/…/edit" autocomplete="off">
      <p class="hint">必須是你自己的帳號擁有、而且確實是「${esc(prod.name)}」的專案；系統會先檢查，不符合就不會動它。</p></div>`}
    <div class="btns"><button class="btn" type="button" id="analyzeBtn" data-lock>檢查這個專案（不會修改任何東西）</button><button class="btn ghost" type="button" id="flowCancel" data-lock>取消</button></div>
    <div class="slot" id="analysis"></div>`);
  $('#flowCancel').addEventListener('click', () => show(flow, false));
  $('#analyzeBtn').addEventListener('click', () => doAnalyze(p, scriptId, deploymentId));
}

async function doAnalyze(p, knownScriptId, knownDeploymentId, chosenDeploymentId) {
  const prod = p.product;
  const out = $('#analysis');
  const scriptId = knownScriptId || parseScriptIdInput($('#scriptInput') && $('#scriptInput').value);
  if (!scriptId) { out.innerHTML = notice('bad', '看不出專案 ID，請貼上 GAS 編輯器網址（https://script.google.com/d/…/edit）。'); return; }
  out.innerHTML = notice('info', '正在讀取你的 GAS 專案與正式版，請稍候…');
  setBusy(true);
  try {
    const scriptApi = await api();
    const { release, bundle } = await fetchVerifiedBundle(state.gate, prod.id);
    const a = await analyzeUpdate({ api: scriptApi, product: prod, release, bundle, scriptId, knownDeploymentId, chosenDeploymentId });
    renderAnalysis(p, { release, bundle, a, knownScriptId: scriptId, knownDeploymentId });
  } catch (e) {
    out.innerHTML = errorHtml(e);
  } finally { setBusy(false); }
}

function renderAnalysis(p, ctx) {
  const { release, a } = ctx;
  const out = $('#analysis');
  const d = a.diff, v = a.verdict, chosen = a.pick.chosen;
  const chooser = a.pick.status === 'choose' ? `
    <h3>選擇要更新的網址</h3>
    <p>這個專案有 ${a.deployments.length} 個網頁部署，請選擇要更新哪一個（其他網址不受影響）。</p>
    <div class="radios">${a.deployments.map((x) => `<label class="${chosen && chosen.deploymentId === x.deploymentId ? 'sel' : ''}">
      <input type="radio" name="dep" value="${esc(x.deploymentId)}" ${chosen && chosen.deploymentId === x.deploymentId ? 'checked' : ''}><span>版本 #${x.versionNumber}　${esc(x.description)}<br><small class="mono">${esc(x.url)}</small><br><small>${esc(x.executeAs)}／${esc(x.access)}　${fmtTime(x.updateTime)}</small></span></label>`).join('')}</div>` : '';
  const changes = d.identical ? '程式內容與正式版完全相同' : `新增 ${d.added.length}、修改 ${d.changed.length}、移除 ${d.removed.length} 個檔案`;
  out.innerHTML = `
    <dl class="kv">
      <dt>專案</dt><dd>${esc(a.title)}（${esc(maskId(a.scriptId))}）</dd>
      <dt>Google 帳號</dt><dd>${esc(state.me.email)}</dd>
      <dt>版本</dt><dd>${esc(d.remoteVersion || '無法辨識')} → <b>${esc(release.version)}</b></dd>
      <dt>程式變更</dt><dd>${esc(changes)}</dd>
      ${chosen ? `<dt>網址（維持不變）</dt><dd class="mono">${esc(chosen.url)}</dd><dt>目前指向</dt><dd>GAS 版本 #${chosen.versionNumber}</dd>` : ''}
    </dl>
    ${chooser}
    ${v.blockers.map((b) => notice('bad', esc(b.message))).join('')}
    ${v.warnings.map((w) => notice('warn', esc(w))).join('')}
    ${v.ok && v.noop ? notice('ok', `<b>已經是最新版 ${esc(release.version)}，不需要更新。</b>`) : ''}
    ${v.ok && !v.noop ? `
      ${notice('info', `更新只替換程式；新版程式執行時可能依新規則讀寫你的試算表，這部分已由管理員確認<b>不需要資料遷移</b>。若更新後有問題，請聯絡管理員協助把網址指回舊版本 #${chosen.versionNumber}。`)}
      <label class="chk"><input type="checkbox" id="updateOk"> 我確認要更新「${esc(a.title)}」到 ${esc(release.version)}（網址不變）</label>
      <div class="btns"><button class="btn" type="button" id="updateGo" data-lock disabled>開始更新</button></div>` : ''}
    <div class="slot" id="updateSteps"></div><div class="slot" id="updateResult"></div>`;
  out.querySelectorAll('input[name=dep]').forEach((r) => r.addEventListener('change', () => doAnalyze(p, ctx.knownScriptId, '', r.value)));
  const ok = $('#updateOk'), go = $('#updateGo');
  if (ok) {
    ok.addEventListener('change', () => { go.disabled = state.busy || !ok.checked; });
    go.addEventListener('click', () => doUpdate(p, ctx));
  }
}

async function doUpdate(p, ctx) {
  const update = stepList($('#updateSteps'), [
    ['verify', '再次核對專案與部署'], ['upload', '寫入新版程式'], ['version', '建立版本'], ['deploy', '原網址指向新版本並回讀驗證'], ['record', '登記完成']
  ]);
  $('#updateResult').innerHTML = '';
  $('#updateGo').disabled = true; $('#updateOk').disabled = true;
  setBusy(true);
  try {
    const scriptApi = await api();
    const r = await runUpdate({ gate: state.gate, api: scriptApi, product: p.product, release: ctx.release, bundle: ctx.bundle, analysis: ctx.a, onStep: update });
    $('#updateResult').innerHTML = notice('ok', `<b>更新完成：${esc(ctx.release.version)}</b><br>網址沒有改變：<a class="mono" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a><br>GAS 版本 #${r.prevVersionNumber} → #${r.versionNumber}。請打開網址確認可以正常登入使用。`);
    await loadMe();
  } catch (e) {
    failRunningStep($('#updateSteps'));
    $('#updateResult').innerHTML = errorHtml(e);
  } finally { setBusy(false); }
}

window.addEventListener('beforeunload', (ev) => { if (state.busy) { ev.preventDefault(); ev.returnValue = ''; } });

start();
export { FlowError };
