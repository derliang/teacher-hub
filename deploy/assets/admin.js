/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/** admin.js — 部署平台管理頁（教師授權、正式版匯入與核准、紀錄） */
import { canonicalBundleString } from './core.js';
import { sha256Hex, maskId } from './engine.js';
import { gsBlockers } from './gs-check.js';
import { $, $$, esc, show, notice, fmtTime, boot, signIn, signOut, errorHtml } from './ui.js';

const state = { gate: null, info: null, tab: 'teachers' };
const body = $('#tabBody');
const statusEl = $('#status');

async function start() {
  try {
    statusEl.innerHTML = notice('info', '正在連線部署平台…');
    const { gate, info } = await boot('../');
    state.gate = gate; state.info = info;
    statusEl.innerHTML = '';
    show($('#signInPanel'));
    const { idToken } = await signIn($('#signInBtn'), info);
    gate.idToken = idToken;
    show($('#signInPanel'), false);
    const me = await gate.call('me');
    $('#whoEmail').textContent = me.email; show($('#who'));
    if (me.role !== 'admin') { statusEl.innerHTML = notice('bad', `<b>${esc(me.email)} 不是管理員。</b>`); return; }
    show($('#tabs'));
    openTab('teachers');
  } catch (e) {
    statusEl.innerHTML = e.code === 'NOT_READY' ? notice('warn', `<b>平台尚未完成設定</b><br>${esc(e.message)}`) : errorHtml(e);
  }
}

$('#signOutBtn').addEventListener('click', signOut);
$('#tabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-tab]'); if (b) openTab(b.dataset.tab); });

function openTab(tab) {
  state.tab = tab;
  $$('#tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  statusEl.innerHTML = '';
  body.innerHTML = notice('info', '載入中…');
  ({ teachers: loadTeachers, releases: loadReleases, deployments: loadDeployments, audit: loadAudit })[tab]()
    .catch((e) => { body.innerHTML = errorHtml(e); });
}

function flash(kind, html) { statusEl.innerHTML = notice(kind, html); statusEl.scrollIntoView({ block: 'nearest' }); }

// ── 教師授權 ──────────────────────────────────────────

async function loadTeachers() {
  const { products, teachers } = await state.gate.call('admin.teachers.list');
  const pcheck = (name, selected = []) => products.map((p) => `<label class="chk"><input type="checkbox" name="${name}" value="${esc(p.id)}" ${selected.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('');
  body.innerHTML = `
    <div class="panel">
      <h2>新增或批次匯入教師</h2>
      <p>每行一個學校 Email（可直接從試算表貼上整欄）。老師第一次登入時會自動綁定 Google 帳號識別碼，之後改用別的帳號冒用同一個 Email 會被擋下。</p>
      <textarea class="inp" id="newEmails" placeholder="teacher1@${esc(state.info.domains[0] || 'school.edu.tw')}&#10;teacher2@${esc(state.info.domains[0] || 'school.edu.tw')}"></textarea>
      <div><b class="lbl">開放的系統：</b><div class="checks">${pcheck('newProducts')}</div></div>
      <div class="btns"><button class="btn" type="button" id="addTeachers">新增／更新這些教師</button></div>
    </div>
    <div class="panel">
      <h2>教師名單（${teachers.length}）</h2>
      ${teachers.length ? `<div class="tw"><table><thead><tr><th>Email</th><th>帳號綁定</th><th>狀態</th>${products.map((p) => `<th>${esc(p.name)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${teachers.map((t, i) => {
        const granted = String(t.products || '').split(',').filter(Boolean);
        return `<tr data-row="${i}" data-email="${esc(t.email)}">
          <td>${esc(t.email)}<br><small>${esc(t.note || '')}</small></td>
          <td>${t.sub ? `<span class="st st-ok">已綁定</span><br><button class="btn sm ghost" type="button" data-reset>解除綁定</button>` : '<span class="st st-gray">尚未登入</span>'}</td>
          <td><select class="inp" data-status><option value="active" ${t.status === 'active' ? 'selected' : ''}>啟用</option><option value="disabled" ${t.status !== 'active' ? 'selected' : ''}>停用</option></select></td>
          ${products.map((p) => `<td><input type="checkbox" data-product="${esc(p.id)}" ${granted.includes(p.id) ? 'checked' : ''} aria-label="${esc(t.email)} 使用 ${esc(p.name)}"></td>`).join('')}
          <td><button class="btn sm" type="button" data-save disabled>儲存</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<p>還沒有任何教師。</p>'}
    </div>`;

  $('#addTeachers').addEventListener('click', async () => {
    const emails = $('#newEmails').value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const prods = $$('input[name=newProducts]:checked').map((x) => x.value);
    if (!emails.length) return flash('bad', '請至少輸入一個 Email。');
    try {
      const r = await state.gate.call('admin.teachers.upsert', { teachers: emails.map((email) => ({ email, products: prods, status: 'active' })) });
      flash('ok', `已新增 ${r.added} 位、更新 ${r.updated} 位。`);
      loadTeachers();
    } catch (e) { statusEl.innerHTML = errorHtml(e); }
  });

  $$('tr[data-row]').forEach((tr) => {
    const save = tr.querySelector('[data-save]');
    tr.addEventListener('change', () => { save.disabled = false; });
    save.addEventListener('click', async () => {
      const t = { email: tr.dataset.email, status: tr.querySelector('[data-status]').value, products: [...tr.querySelectorAll('[data-product]:checked')].map((x) => x.dataset.product) };
      try {
        save.disabled = true;
        await state.gate.call('admin.teachers.upsert', { teachers: [t] });
        flash('ok', `已儲存 ${esc(t.email)}。`);
      } catch (e) { save.disabled = false; statusEl.innerHTML = errorHtml(e); }
    });
    const reset = tr.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', async () => {
      if (!confirm(`解除 ${tr.dataset.email} 的帳號綁定？下次以這個 Email 登入的 Google 帳號會重新綁定。只有在老師換帳號或綁錯時才需要。`)) return;
      try { await state.gate.call('admin.teachers.resetBinding', { email: tr.dataset.email }); flash('ok', '已解除綁定。'); loadTeachers(); } catch (e) { statusEl.innerHTML = errorHtml(e); }
    });
  });
}

// ── 正式版 ────────────────────────────────────────────

const STATUS_BADGE = { pending: ['st-wip', '待審核'], approved: ['st-ok', '已核准'], retired: ['st-gray', '已下架'] };

async function loadReleases() {
  const { products, releases } = await state.gate.call('admin.releases.list');
  body.innerHTML = `
    <div class="panel">
      <h2>從 GitHub 匯入新版本</h2>
      <p>匯入會把指定分支或 tag 解析成固定的 commit，抓取受管理的程式檔存成不可變的快照（狀態「待審核」）。老師要等你核准後才拿得到。</p>
      <div class="opts">
        <div><label class="lbl" for="impProduct">系統</label><select class="inp" id="impProduct">${products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
        <div><label class="lbl" for="impRef">分支、tag 或 commit</label><input class="inp" type="text" id="impRef" value="main"></div>
      </div>
      <div class="btns"><button class="btn" type="button" id="impGo">匯入</button></div>
    </div>
    <div class="panel">
      <h2>版本清單</h2>
      ${releases.length ? `<div class="deps">${releases.map((r, i) => {
        const [k, label] = STATUS_BADGE[r.status] || ['gray', r.status];
        const pname = (products.find((p) => p.id === r.productId) || {}).name || r.productId;
        return `<div class="rel" data-rel="${i}">
          <div class="relhead"><div><b>${esc(pname)} ${esc(r.version)}</b>　<span class="st ${k}">${label}</span>
            ${r.requiresMigration === 'yes' ? '<span class="st st-bad">需資料遷移・只供首次安裝</span>' : ''}<br>
            <small class="mono">${esc(r.commit.slice(0, 12))}</small>　<small>${r.fileCount} 檔・匯入 ${fmtTime(r.importedAt)}（${esc(r.importedBy)}）${r.reviewedAt ? `・審核 ${fmtTime(r.reviewedAt)}（${esc(r.reviewedBy)}）` : ''}</small>
            ${r.notes ? `<br><small>${esc(r.notes)}</small>` : ''}</div>
            <div class="btns"><button class="btn sm" type="button" data-check>檢查${r.status === 'pending' ? '並審核' : ''}</button>${r.status === 'approved' ? '<button class="btn sm danger" type="button" data-retire>下架</button>' : ''}</div></div>
          <div class="slot" data-review></div></div>`;
      }).join('')}</div>` : '<p>還沒有匯入任何版本。</p>'}
    </div>`;

  $('#impGo').addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = '匯入中…（約 10～40 秒）';
    try {
      const r = await state.gate.call('admin.releases.import', { productId: $('#impProduct').value, ref: $('#impRef').value.trim() || 'main' });
      flash(r.duplicated ? 'warn' : 'ok', r.duplicated ? `這個 commit 已經匯入過（${esc(r.release.version)}）。` : `已匯入 ${esc(r.release.version)}，請按「檢查並審核」。`);
      loadReleases();
    } catch (e) { statusEl.innerHTML = errorHtml(e); b.disabled = false; b.textContent = '匯入'; }
  });

  $$('[data-rel]').forEach((el) => {
    const r = releases[Number(el.dataset.rel)];
    el.querySelector('[data-check]').addEventListener('click', () => checkRelease(r, el.querySelector('[data-review]')));
    const retire = el.querySelector('[data-retire]');
    if (retire) retire.addEventListener('click', async () => {
      if (!confirm(`下架 ${r.version}？下架後老師就不會再收到這個版本；已經安裝的系統不受影響。`)) return;
      try { await state.gate.call('admin.releases.review', { productId: r.productId, commit: r.commit, status: 'retired' }); flash('ok', '已下架。'); loadReleases(); } catch (e) { statusEl.innerHTML = errorHtml(e); }
    });
  });
}

async function checkRelease(r, box) {
  box.innerHTML = notice('info', '下載快照並檢查中…');
  try {
    const { release, bundle } = await state.gate.call('admin.releases.bundle', { productId: r.productId, commit: r.commit });
    const hashOk = (await sha256Hex(canonicalBundleString(bundle))) === release.sha256;
    const blockers = gsBlockers(bundle.files);
    if (!hashOk) blockers.unshift('快照雜湊不符，檔案可能被改動過，請勿核准。');
    const counts = bundle.files.reduce((m, f) => { m[f.type] = (m[f.type] || 0) + 1; return m; }, {});
    box.innerHTML = `
      <dl class="kv"><dt>版本</dt><dd>${esc(bundle.version)}</dd><dt>commit</dt><dd class="mono">${esc(bundle.commit)}</dd>
      <dt>檔案</dt><dd>伺服器程式 ${counts.SERVER_JS || 0}、HTML ${counts.HTML || 0}、設定 ${counts.JSON || 0}</dd>
      <dt>SHA-256</dt><dd class="mono">${esc(release.sha256)}</dd></dl>
      ${blockers.length ? blockers.map((b) => notice('bad', esc(b))).join('') : notice('ok', '程式檢查通過：語法正確、沒有跨檔同名宣告、完整性相符。')}
      ${r.status === 'pending' && !blockers.length ? `
        <fieldset class="mig">
          <legend>這個版本更新時是否涉及資料遷移？（必選）</legend>
          <label class="chk"><input type="radio" name="mig-${esc(r.commit)}" value="no"> 否：產品方已確認舊資料可直接使用，開放老師自助更新</label>
          <label class="chk"><input type="radio" name="mig-${esc(r.commit)}" value="yes"> 是／不確定：只開放首次安裝，既有系統的自助更新會被擋下</label>
        </fieldset>
        <div><label class="lbl">最低可升級的來源版本（選填，例如 1.0.90）</label><input class="inp" type="text" data-min maxlength="30"></div>
        <div><label class="lbl">備註（選填）</label><input class="inp" type="text" data-notes maxlength="200"></div>
        <div class="btns"><button class="btn" type="button" data-approve disabled>核准為正式版</button></div>` : ''}`;
    const approve = box.querySelector('[data-approve]');
    if (approve) {
      box.querySelectorAll('input[type=radio]').forEach((x) => x.addEventListener('change', () => { approve.disabled = false; }));
      approve.addEventListener('click', async () => {
        const mig = box.querySelector('input[type=radio]:checked');
        if (!mig) return;
        try {
          approve.disabled = true;
          await state.gate.call('admin.releases.review', { productId: r.productId, commit: r.commit, status: 'approved', requiresMigration: mig.value, minFromVersion: box.querySelector('[data-min]').value.trim(), notes: box.querySelector('[data-notes]').value.trim() });
          flash('ok', `已核准 ${esc(r.version)}。老師重新整理自助部署頁就會看到新版。`);
          loadReleases();
        } catch (e) { approve.disabled = false; box.insertAdjacentHTML('beforeend', errorHtml(e)); }
      });
    }
  } catch (e) { box.innerHTML = errorHtml(e); }
}

// ── 紀錄 ──────────────────────────────────────────────

async function loadDeployments() {
  const { deployments } = await state.gate.call('admin.deployments.list');
  body.innerHTML = `<div class="panel"><h2>部署紀錄（${deployments.length}）</h2>${deployments.length ? `<div class="tw"><table>
    <thead><tr><th>教師</th><th>系統</th><th>專案</th><th>版本</th><th>網址</th><th>更新時間</th></tr></thead><tbody>
    ${deployments.map((d) => `<tr><td>${esc(d.email)}</td><td>${esc(d.productId)}</td><td>${esc(d.title)}<br><small class="mono">${esc(maskId(d.scriptId))}</small>${d.status === 'installing' ? '<br><span class="st st-wip">安裝未完成</span>' : ''}</td>
      <td>${esc(d.version)}<br><small>GAS #${esc(d.versionNumber)}</small></td><td>${d.execUrl ? `<a class="mono" href="${esc(d.execUrl)}" target="_blank" rel="noopener">開啟</a>` : ''}</td><td>${fmtTime(d.updatedAt)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p>還沒有任何部署。</p>'}</div>`;
}

async function loadAudit() {
  const { audit } = await state.gate.call('admin.audit.list');
  body.innerHTML = `<div class="panel"><h2>稽核紀錄（最近 ${audit.length} 筆）</h2><div class="tw"><table>
    <thead><tr><th>時間</th><th>帳號</th><th>動作</th><th>結果</th><th>說明</th></tr></thead><tbody>
    ${audit.map((a) => `<tr><td>${fmtTime(a.time)}</td><td>${esc(a.email)}</td><td class="mono">${esc(a.action)}<br><small>${esc(a.productId)} ${esc(maskId(a.scriptId))}</small></td>
      <td><span class="st ${a.result === 'ok' ? 'st-ok' : a.result === 'denied' || a.result === 'failed' ? 'st-bad' : 'st-wip'}">${esc(a.result)}</span></td><td>${esc(a.detail)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

start();
