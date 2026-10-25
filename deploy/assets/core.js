/*
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
*/
/**
 * core.js — 通用部署引擎的純邏輯（無 DOM、無網路；瀏覽器與 Node 測試共用）
 *
 * 規則來源：docs/self-service/SELF_SERVICE_SPEC_V1.md、UNIVERSAL_ENGINE_DECISIONS.md。
 * 對應本機版的安全原則（同 deploymentId 更新、未知檔案不覆蓋、內容相同不強推、
 * 多個 deployment 需明確選擇、結果不明時不自動重試）見 docs/self-service/GATE_ARCHITECTURE.md〈本機版對照〉。
 */

export function globMatch(pattern, name) {
  const re = '^' + String(pattern).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$';
  return new RegExp(re).test(String(name));
}

export function apiFileToPath(f) {
  if (f.type === 'JSON') return `${f.name}.json`;
  return f.name + (f.type === 'HTML' ? '.html' : '.gs');
}

/** 某個 Apps Script 檔案是否屬於產品管理範圍（含平台產生的檔案）。 */
export function isManagedFile(product, f) {
  if ((product.generatedFiles || []).includes(f.name)) return true;
  const path = apiFileToPath(f);
  if ((product.derivedFiles || []).includes(path)) return true;
  return product.managedFiles.some((g) => globMatch(g, path));
}

/** Google 新建專案時自動放的範本檔（appsscript.json 與空的 myFunction）。 */
export function isBlankTemplateFile(f) {
  if (f.type === 'JSON' && f.name === 'appsscript') return true;
  return f.type === 'SERVER_JS' && /^\s*function myFunction\(\)\s*\{\s*\}\s*$/.test(f.source || '');
}

/**
 * 接續未完成的首次安裝前，確認那個專案裡只有 Google 範本檔或本產品的檔案，
 * 避免把別的程式覆蓋掉。回傳不屬於本產品的檔名清單（空＝可以接續）。
 */
export function foreignFilesForResume(product, remoteFiles) {
  return remoteFiles.filter((f) => !isManagedFile(product, f) && !isBlankTemplateFile(f)).map(apiFileToPath);
}

export function compareVersions(a, b) {
  const pa = String(a || '').split(/[.\-]/), pb = String(b || '').split(/[.\-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0', y = pb[i] ?? '0';
    const c = /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : (x < y ? -1 : x > y ? 1 : 0);
    if (c !== 0) return c < 0 ? -1 : 1;
  }
  return 0;
}

export function extractVersion(files, resolver) {
  const f = files.find((x) => apiFileToPath(x) === resolver.file);
  if (!f) return null;
  const m = new RegExp(resolver.pattern).exec(f.source || '');
  return m ? m[1] : null;
}

/** 與閘門 canonicalBundleString_ 完全相同的標準字串。 */
export function canonicalBundleString(bundle) {
  const files = bundle.files.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => ({ name: f.name, type: f.type, source: f.source }));
  return JSON.stringify({ productId: bundle.productId, version: bundle.version, commit: bundle.commit, files });
}

/** 從老師貼上的文字取出 scriptId（接受純 ID、編輯器網址）。 */
export function parseScriptIdInput(text) {
  const s = String(text || '').trim();
  const m = /\/(?:d|projects)\/([A-Za-z0-9_-]{20,120})(?:[/?#]|$)/.exec(s);
  const id = m ? m[1] : s;
  return /^[A-Za-z0-9_-]{20,120}$/.test(id) ? id : null;
}

/** 正規化檔案內容比對用（Apps Script 會把 \r\n 存成 \n）。 */
function norm(src) {
  return String(src ?? '').replace(/\r\n/g, '\n');
}

/**
 * 更新前分析（唯讀）：比較老師 GAS 目前內容與正式版快照。
 * 回傳 { unmanaged, added, changed, removed, identical, remoteVersion }。
 */
export function diffContent(product, remoteFiles, bundle) {
  const remote = new Map(remoteFiles.map((f) => [f.name, f]));
  const target = new Map(bundle.files.map((f) => [f.name, f]));
  const unmanaged = remoteFiles.filter((f) => !isManagedFile(product, f)).map(apiFileToPath);
  const added = [], changed = [], removed = [];
  for (const [name, f] of target) {
    const r = remote.get(name);
    if (!r) added.push(apiFileToPath(f));
    else if (r.type !== f.type || norm(r.source) !== norm(f.source)) changed.push(apiFileToPath(f));
  }
  for (const [name, f] of remote) if (!target.has(name) && isManagedFile(product, f)) removed.push(apiFileToPath(f));
  return {
    unmanaged, added, changed, removed,
    identical: !unmanaged.length && !added.length && !changed.length && !removed.length,
    remoteVersion: extractVersion(remoteFiles, product.versionResolver)
  };
}

/** 從 deployments.list 結果找出版本化的 Web App 部署（排除 HEAD 測試部署）。 */
export function webAppDeployments(deployments) {
  return (deployments || []).filter((d) => d.deploymentConfig && d.deploymentConfig.versionNumber
    && (d.entryPoints || []).some((e) => e.entryPointType === 'WEB_APP'))
    .map((d) => {
      const ep = d.entryPoints.find((e) => e.entryPointType === 'WEB_APP');
      return {
        deploymentId: d.deploymentId,
        versionNumber: d.deploymentConfig.versionNumber,
        description: d.deploymentConfig.description || '',
        url: ep.webApp && ep.webApp.url || '',
        executeAs: ep.webApp && ep.webApp.entryPointConfig && ep.webApp.entryPointConfig.executeAs || '',
        access: ep.webApp && ep.webApp.entryPointConfig && ep.webApp.entryPointConfig.access || '',
        updateTime: d.updateTime || ''
      };
    });
}

/**
 * 決定要更新哪一個部署：有已知 deploymentId 就只認它；只有一個時需老師確認；多個時必須老師選。
 * 回傳 { status: 'known'|'single'|'choose'|'none'|'missing', candidates, chosen }。
 */
export function pickDeployment(list, knownId) {
  if (knownId) {
    const hit = list.find((d) => d.deploymentId === knownId);
    return hit ? { status: 'known', candidates: list, chosen: hit } : { status: 'missing', candidates: list, chosen: null };
  }
  if (!list.length) return { status: 'none', candidates: [], chosen: null };
  if (list.length === 1) return { status: 'single', candidates: list, chosen: list[0] };
  return { status: 'choose', candidates: list, chosen: null };
}

/**
 * 更新前的阻擋條件（全部通過才允許按「開始更新」）。
 * 回傳 { ok, blockers: [{code, message}], warnings: [...], noop }。
 */
export function evaluateUpdate({ product, release, diff, deploymentPick }) {
  const blockers = [], warnings = [];
  if (diff.unmanaged.length) blockers.push({ code: 'UNMANAGED_FILES', message: `你的 GAS 有 ${diff.unmanaged.length} 個不屬於「${product.name}」的檔案（${diff.unmanaged.slice(0, 5).join('、')}${diff.unmanaged.length > 5 ? '…' : ''}）。更新會整份替換程式，為避免刪掉你自己加的程式，已停止。請聯絡管理員協助。` });
  if (!diff.remoteVersion) blockers.push({ code: 'NOT_THIS_PRODUCT', message: `在這個 GAS 裡找不到「${product.name}」的版本標記，無法確認它是同一套系統，已停止。` });
  if (release.requiresMigration !== 'no') blockers.push({ code: 'MIGRATION', message: `新版 ${release.version} 涉及資料結構變更或尚未確認相容性，不提供自助更新。請聯絡管理員。` });
  if (diff.remoteVersion && compareVersions(diff.remoteVersion, release.version) > 0) blockers.push({ code: 'DOWNGRADE', message: `你目前的版本 ${diff.remoteVersion} 比正式版 ${release.version} 還新，不會降版。` });
  if (diff.remoteVersion && release.minFromVersion && compareVersions(diff.remoteVersion, release.minFromVersion) < 0) blockers.push({ code: 'TOO_OLD', message: `正式版 ${release.version} 只支援從 ${release.minFromVersion} 以上升級；你目前是 ${diff.remoteVersion}，請聯絡管理員。` });
  if (deploymentPick.status === 'missing') blockers.push({ code: 'DEPLOYMENT_MISSING', message: '原本紀錄的部署已不在這個 GAS 裡，無法保證網址不變，已停止。' });
  if (deploymentPick.status === 'none') blockers.push({ code: 'NO_WEBAPP', message: '這個 GAS 還沒有網頁應用程式部署，無法執行「網址不變」的更新。' });
  if (deploymentPick.status === 'choose' && !deploymentPick.chosen) blockers.push({ code: 'CHOOSE_DEPLOYMENT', message: '這個 GAS 有多個網頁部署，請選擇要更新哪一個網址。' });
  const d = deploymentPick.chosen;
  if (d && (d.executeAs !== product.webApp.executeAs || d.access !== product.webApp.access)) {
    warnings.push(`目前部署的權限設定（${d.executeAs}／${d.access}）與正式版（${product.webApp.executeAs}／${product.webApp.access}）不同，更新後會改成正式版設定。`);
  }
  const noop = diff.identical && d && release.version === diff.remoteVersion;
  return { ok: blockers.length === 0, blockers, warnings, noop: !!noop };
}

/** Apps Script API 錯誤 → 老師看得懂的訊息。 */
export function explainApiError(status, body) {
  const msg = String(body && body.error && body.error.message || body || '');
  if (/Apps Script API|has not enabled|not been used|usersettings/i.test(msg)) {
    return { code: 'API_DISABLED', message: '你的帳號還沒開啟「Google Apps Script API」。請到 https://script.google.com/home/usersettings 把它切成「開啟」，等 1～2 分鐘再試一次。' };
  }
  if (status === 401) return { code: 'AUTH_EXPIRED', message: 'Google 授權已過期，請重新授權後再試。' };
  if (status === 403) return { code: 'FORBIDDEN', message: `Google 拒絕這個操作（可能是學校管理政策或你沒有這個 GAS 的編輯權）：${msg.slice(0, 160)}` };
  if (status === 404) return { code: 'NOT_FOUND', message: '找不到這個 GAS 專案或部署，請確認你登入的帳號是擁有者。' };
  if (status === 429) return { code: 'RATE_LIMITED', message: 'Google 暫時限制操作頻率，請等一分鐘再試。' };
  return { code: 'API_ERROR', message: `Google 回應錯誤（${status}）：${msg.slice(0, 160)}` };
}

const GATE_MESSAGES = {
  LOGIN_REQUIRED: '請先用學校 Google 帳號登入。',
  LOGIN_EXPIRED: '登入已過期，請重新登入。',
  PERSONAL_ACCOUNT_NOT_ALLOWED: '只接受學校 Google Workspace 帳號，個人 Gmail 無法使用。',
  WORKSPACE_NOT_ALLOWED: '這個學校網域尚未開放使用。',
  NOT_APPROVED: '你的帳號尚未獲得授權，請聯絡管理員開通。',
  PRODUCT_NOT_GRANTED: '你尚未獲得這個系統的使用授權，請聯絡管理員。',
  NO_APPROVED_RELEASE: '這個系統目前沒有已核准的正式版。',
  TARGET_LOCKED: '這個 GAS 正在被另一個更新流程使用，請稍後再試。',
  IDENTITY_MISMATCH_CONTACT_ADMIN: '帳號識別資料不一致，請聯絡管理員處理。',
  ADMIN_ONLY: '只有管理員可以使用這個功能。',
  GATE_NOT_CONFIGURED: '部署平台後端尚未完成設定。',
  TOO_MANY_REQUESTS: '操作太頻繁，請稍候一分鐘。',
  RELEASE_INTEGRITY_FAILED: '正式版檔案完整性檢查失敗，已停止。請聯絡管理員。',
  BUSY_TRY_AGAIN: '系統忙碌中，請再試一次。'
};

export function explainGateError(code, detail) {
  return GATE_MESSAGES[code] || `部署平台回應：${code}${detail ? `（${detail}）` : ''}`;
}
