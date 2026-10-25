// GAS 自助部署前端（deploy/）｜設計規範測試
//
// 依 docs/deploy/DESIGN_SPEC.md 第 9 節，把「不走樣」變成自動檢查：
//   1. app.css 的三個 token 區塊與 docs/design/tokens.css逐一相同，沒有多出來的 token
//   2. 沒有寫死色碼（html 內聯 style、css、js 產生的 HTML 字串都檢查）
//   3. 圓角不超過 4px、沒有漸層、字型只走 token
//   4. 沒有標示用的 emoji（✓ ✕ 例外）
//   5. 每個 html 的骨架：lang、viewport、title、版權檔頭、nav.nav、nav.crumbs、單一 footer
//   6. stepList 產出 ol.prog，狀態只有 done／run／fail
// 另外鎖住兩件「改版時最容易悄悄壞掉」的事：舊 class 沒有殘留、js 用到的 id 都真的存在。
// 外觀的權威在 docs/design/；本檔核對 deploy/ 的實作有沒有照做（另有 scripts/check_design.py 檢查整個網站）。
// 執行：node --test scripts/test_deploy_frontend.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'deploy');
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');

const HTML = [path.join(web, 'index.html'), path.join(web, 'admin', 'index.html')];
const CSS = [path.join(web, 'assets', 'app.css')];
const JS = fs.readdirSync(path.join(web, 'assets')).filter((f) => f.endsWith('.js')).map((f) => path.join(web, 'assets', f));
const ALL = [...HTML, ...CSS, ...JS];
const UI_JS = ['teacher.js', 'admin.js', 'ui.js'].map((f) => path.join(web, 'assets', f));

// ── token 區塊解析（與 teacher-hub 的 scripts/check_design.py 同一套規則）──
const BLOCK_LIGHT = /:root\{([^}]*)\}/;
const BLOCK_DARK_MEDIA = /@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}\}/;
const BLOCK_DARK_ATTR = /:root\[data-theme="dark"\]\{([^}]*)\}/;
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function parseProps(body) {
  const props = {};
  for (const part of body.split(';')) {
    const m = part.match(/^\s*--([\w-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m) props[m[1]] = m[2].replace(/\s+/g, '').toLowerCase();
  }
  return props;
}
function tokenBlocks(css) {
  css = stripComments(css);
  const dm = css.match(BLOCK_DARK_MEDIA), da = css.match(BLOCK_DARK_ATTR);
  const rest = css.replace(BLOCK_DARK_MEDIA, '').replace(BLOCK_DARK_ATTR, '');
  const lm = rest.match(BLOCK_LIGHT);
  return { light: lm ? parseProps(lm[1]) : {}, darkMedia: dm ? parseProps(dm[1]) : {}, darkAttr: da ? parseProps(da[1]) : {} };
}
function cssWithoutTokens(css) {
  css = stripComments(css).replace(BLOCK_DARK_MEDIA, '').replace(BLOCK_DARK_ATTR, '');
  return css.replace(BLOCK_LIGHT, '');
}

const CANON = tokenBlocks(read(path.join(root, 'docs', 'design', 'tokens.css')));

/** 取出某個檔案裡「該掃描」的文字：css 去掉 token 區塊；html 去掉 theme-color meta（它必須等於 --bg，另外檢查）。 */
function scannable(file) {
  const text = read(file);
  if (file.endsWith('.css')) return cssWithoutTokens(text);
  if (file.endsWith('.html')) return text.replace(/<meta name="theme-color"[^>]*>/g, '');
  return text;
}

test('app.css 的 token 與 docs/design/tokens.css 逐一相同', () => {
  const got = tokenBlocks(read(CSS[0]));
  for (const [label, key] of [['淺色 :root', 'light'], ['深色 media', 'darkMedia'], ['深色 data-theme', 'darkAttr']]) {
    assert.ok(Object.keys(got[key]).length, `${label} 區塊不存在或是空的`);
    assert.deepEqual(got[key], CANON[key], `${label} 的 token 與 docs/design/tokens.css 不同（要改 token 請先改 tokens.css 並取得擁有者同意）`);
  }
});

test('app.css 沒有在 token 區塊之外另宣告 custom property', () => {
  const rest = cssWithoutTokens(read(CSS[0]));
  const extra = rest.match(/(^|[;{\s])--[\w-]+\s*:/g);
  assert.equal(extra, null, `token 區塊以外不可宣告新的 --變數：${extra}`);
});

test('沒有寫死色碼（html 內聯 style、css、js 產生的 HTML 都檢查）', () => {
  for (const f of ALL) {
    const hit = scannable(f).match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|hwb)\(/);
    assert.equal(hit, null, `${rel(f)} 寫死色碼或色彩函式：${hit && hit[0]}（要用 var(--token)）`);
  }
});

test('theme-color 等於 --bg 的淺色與深色值', () => {
  for (const f of HTML) {
    const metas = [...read(f).matchAll(/<meta name="theme-color" content="(#[0-9a-fA-F]{6})"([^>]*)>/g)];
    assert.equal(metas.length, 2, `${rel(f)} 需要淺色與深色兩個 theme-color`);
    const values = metas.map((m) => m[1].toLowerCase()).sort();
    assert.deepEqual(values, [CANON.light.bg, CANON.darkMedia.bg].sort(), `${rel(f)} 的 theme-color 必須等於 --bg`);
  }
});

test('圓角不超過 4px（圓點可用 50%）、沒有漸層', () => {
  for (const f of ALL) {
    const text = scannable(f);
    for (const m of text.matchAll(/border-radius\s*:\s*([^;}"'`]+)/g)) {
      for (const [, n, unit] of m[1].matchAll(/([\d.]+)(px|%|em|rem)/g)) {
        if (unit === 'px') assert.ok(Number(n) <= 4, `${rel(f)} 圓角超過 4px：${m[1].trim()}`);
        else assert.ok(unit === '%' && Number(n) === 50, `${rel(f)} 圓角只允許 px 或 50%：${m[1].trim()}`);
      }
    }
    assert.equal(/gradient\(/.test(text), false, `${rel(f)} 不得使用漸層`);
  }
});

test('字型只走 token（--serif、--sans）或等寬字型', () => {
  for (const f of ALL) {
    for (const m of scannable(f).matchAll(/font-family\s*:\s*([^;}"'`]+)/g)) {
      const v = m[1].trim();
      assert.ok(/^(var\(--serif\)|var\(--sans\)|ui-monospace|inherit$)/.test(v), `${rel(f)} 字型沒有走 token：${v.slice(0, 50)}`);
    }
  }
});

test('沒有標示用的 emoji 或圖示字元（✓ ✕ 與頁尾版權的 © 例外）', () => {
  for (const f of ALL) {
    let text = read(f).replace(/[✓✕©]/g, '');
    // 規範管的是畫面上看得到的標示；給開發者看的程式註解（例如 ⛔ 警語）不算，也不能為此去改 gs-check.js（它要與私人 repo 的本機版逐字相同）
    if (f.endsWith('.js')) text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hit = text.match(/[\p{Extended_Pictographic}️⃣]/u);
    assert.equal(hit, null, `${rel(f)} 出現 emoji 或圖示字元 U+${hit ? hit[0].codePointAt(0).toString(16).toUpperCase() : ''}`);
  }
});

test('每個 html 具備規範骨架：語言、viewport、標題、版權檔頭、導覽、麵包屑、單一頁尾', () => {
  for (const f of HTML) {
    const html = read(f), name = rel(f);
    assert.match(html, /<html[^>]*\blang="zh-Hant"/, `${name} 缺少 lang="zh-Hant"`);
    assert.match(html, /<meta charset="utf-8">/i, `${name} 缺少 charset`);
    assert.match(html, /<meta name="viewport" content="width=device-width, ?initial-scale=1/, `${name} 缺少 viewport`);
    assert.match(html, /<title>[^<]+<\/title>/, `${name} 缺少 title`);
    assert.ok(html.slice(0, 600).includes('Copyright (c) 2026 derliang'), `${name} 檔頭缺少版權註解`);
    assert.match(html, /<meta name="referrer" content="no-referrer">/, `${name} 要保留 referrer no-referrer`);
    assert.match(html, /<nav class="nav"/, `${name} 缺少頂端導覽 nav.nav`);
    assert.match(html, /<nav class="crumbs" aria-label="所在位置"[^>]*>[\s\S]*?<b aria-current="page">[^<]+<\/b>[\s\S]*?<\/nav>/, `${name} 缺少麵包屑或最後一項沒標 aria-current="page"`);
    assert.equal((html.match(/<footer\b/g) || []).length, 1, `${name} 頁尾必須剛好一個 <footer>`);
    assert.equal((html.match(/© 2026 derliang/g) || []).length, 1, `${name} 版權句「© 2026 derliang」必須剛好出現一次`);
    assert.ok(html.includes('LICENSE.md') && html.includes('授權說明'), `${name} 頁尾缺少授權說明連結`);
    assert.equal(/<iframe\b/.test(html), false, `${name} 不得使用 iframe`);
    assert.match(html, /<main\b|<div class="wrap/, `${name} 缺少內容區`);
  }
  assert.match(read(HTML[1]), /<meta name="robots" content="noindex">/, '管理頁要保留 noindex');
});

test('導覽：品牌連回首頁、「GAS 部署」標出所在區段、麵包屑連回上層', () => {
  const home = read(HTML[0]), admin = read(HTML[1]);
  assert.match(home, /<a class="brand" href="\.\.\/">/);
  assert.match(home, /<a href="\.\.\/#gas" aria-current="true">GAS 部署/);
  assert.match(home, /<a href="\.\.\/#usable">立即可用/);
  assert.match(home, /<nav class="crumbs"[^>]*><a href="\.\.\/">Teacher Hub 首頁<\/a>[\s\S]*?<a href="\.\.\/#gas">GAS 部署<\/a>/);
  assert.match(admin, /<a class="brand" href="\.\.\/\.\.\/">/);
  assert.match(admin, /<a href="\.\.\/\.\.\/#gas" aria-current="true">GAS 部署/);
  assert.match(admin, /<nav class="crumbs"[^>]*><a href="\.\.\/\.\.\/">Teacher Hub 首頁<\/a>[\s\S]*?<a href="\.\.\/\.\.\/#gas">GAS 部署<\/a>/);
});

test('頁面載入 app.css 與設計用的網頁字型', () => {
  for (const f of HTML) {
    const html = read(f);
    assert.match(html, /<link rel="stylesheet" href="(\.\.\/)?assets\/app\.css">/, `${rel(f)} 沒有載入 app.css`);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+TC[^"]*Noto\+Serif\+TC/, `${rel(f)} 沒有載入 Noto Sans TC／Noto Serif TC`);
  }
});

test('舊版 class 沒有殘留（改版後只留規範內的元件）', () => {
  const legacy = {
    'brand-icon': '.mark', 'nav-home': '品牌與麵包屑', trail: 'nav.crumbs', eyebrow: '.kicker', badge: '.st', 'table-wrap': '.tw', grid2: '.opts',
    check: '.chk', field: '.lbl', steps: 'ol.prog', dot: '.d', list: '.deps／.rel', item: '.dep', row: '.btns', small: '.btn.sm', who: '.acct', top: 'nav.nav', url: '.mono'
  };
  for (const f of [...HTML, ...CSS, ...UI_JS]) {
    const text = f.endsWith('.css') ? cssWithoutTokens(read(f)) : read(f);
    const used = new Set();
    if (f.endsWith('.css')) for (const m of text.matchAll(/\.([A-Za-z_][\w-]*)/g)) used.add(m[1]);
    else for (const m of text.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
    for (const [cls, now] of Object.entries(legacy)) assert.equal(used.has(cls), false, `${rel(f)} 還有舊 class「${cls}」（改為 ${now}）`);
    if (f.endsWith('.html')) assert.equal(/<header\b/.test(text), false, `${rel(f)} 還有 <header>（改為 nav.nav）`);
  }
});

test('js 內不留內聯樣式（版面一律走 class）', () => {
  for (const f of UI_JS) {
    const hit = read(f).match(/\bstyle="[^"]*"/);
    assert.equal(hit, null, `${rel(f)} 產生的 HTML 帶有內聯 style：${hit && hit[0]}（改用 app.css 的 class）`);
  }
});

test('js 用 $(\'#id\') 取用的元素真的存在（骨架改版不可弄丟）', () => {
  const pairs = [[path.join(web, 'assets', 'teacher.js'), HTML[0]], [path.join(web, 'assets', 'admin.js'), HTML[1]], [path.join(web, 'assets', 'ui.js'), null]];
  for (const [jsFile, htmlFile] of pairs) {
    const js = read(jsFile);
    const html = htmlFile ? read(htmlFile) : '';
    for (const [, id] of js.matchAll(/\$\('#([\w-]+)'\)/g)) {
      const inHtml = new RegExp(`\\bid="${id}"`).test(html);
      const inJs = new RegExp(`\\bid="${id}"`).test(js);
      assert.ok(inHtml || inJs, `${rel(jsFile)} 取用 #${id}，但 ${htmlFile ? rel(htmlFile) : 'js 模板'} 裡沒有這個 id`);
    }
  }
});

test('stepList 產出 ol.prog，狀態 class 只有 done、run、fail', async () => {
  const { stepList, failRunningStep } = await import('../deploy/assets/ui.js');
  const stubs = {};
  const mk = (key) => {
    const li = { className: '', parts: { '.d': { textContent: '·' }, small: { textContent: '' } }, querySelector(sel) { return this.parts[sel]; } };
    stubs[key] = li; return li;
  };
  const container = {
    innerHTML: '',
    querySelector(sel) {
      const m = sel.match(/^\[data-step="(\w+)"\]$/);
      if (m) return stubs[m[1]] || (new RegExp(`data-step="${m[1]}"`).test(this.innerHTML) ? mk(m[1]) : null);
      if (sel === 'li.run') return Object.values(stubs).find((l) => l.className === 'run') || null;
      return null;
    }
  };
  const update = stepList(container, [['a', '第一步'], ['b', '第二步']]);
  assert.match(container.innerHTML, /^<ol class="prog">/);
  assert.equal((container.innerHTML.match(/<li data-step=/g) || []).length, 2);
  assert.match(container.innerHTML, /<span class="d">/);
  assert.equal(/class="steps"|class="dot"/.test(container.innerHTML), false);
  update('a', 'run');
  assert.equal(stubs.a.className, 'run');
  update('a', 'done', '完成了');
  assert.equal(stubs.a.className, 'done');
  assert.equal(stubs.a.parts['.d'].textContent, '✓');
  assert.equal(stubs.a.parts.small.textContent, '完成了');
  update('b', 'run');
  failRunningStep(container);
  assert.equal(stubs.b.className, 'fail');
  assert.ok(['done', 'run', 'fail'].includes(stubs.a.className));
  // 樣式表要有對應的三種狀態
  const css = read(CSS[0]);
  for (const s of ['done', 'run', 'fail']) assert.match(css, new RegExp(`\\.prog\\s+\\.${s}\\b|\\.prog\\s+li\\.${s}\\b`), `app.css 缺少 .prog 的 ${s} 狀態`);
});

test('無障礙與觸控：按鈕與輸入至少 44px、動畫在 prefers-reduced-motion 時關閉', () => {
  const css = stripComments(read(CSS[0]));
  assert.match(css, /\.btn\{[^}]*min-height:44px/, '.btn 要有 min-height:44px');
  assert.match(css, /\.btn\.sm\{(?![^}]*min-height:3)/, '.btn.sm 仍須維持 44px 高（不可縮小）');
  assert.match(css, /prefers-reduced-motion:\s*reduce/, '缺少 prefers-reduced-motion 設定');
  assert.match(css, /:focus-visible\{[^}]*outline:2px solid var\(--brass-line\)/, '焦點框要是 2px --brass-line');
});

test('deploy/ 是公開檔案：不得含 token、OAuth Client Secret、私鑰、真實 Email', () => {
  const patterns = [
    [/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
    [/GOCSPX-[A-Za-z0-9_-]{10,}/, 'OAuth Client Secret'],
    [/ya29\.[A-Za-z0-9_-]{20,}/, 'Google access token'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私鑰'],
    [/"client_secret"\s*:/, 'client_secret 欄位'],
    [/[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.(?:edu\.tw|com|org|net)\b/, 'Email 位址']
  ];
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(f); } })(web);
  assert.ok(files.length >= 10, '找不到 deploy/ 的檔案');
  for (const f of files) {
    // 檔頭授權聯絡信箱是 LICENSE.md 規定公開的，不算洩漏
    const text = read(f).replaceAll('derliang@gmail.com', '');
    for (const [re, label] of patterns) assert.equal(re.test(text), false, `${rel(f)} 含有 ${label}`);
  }
  const cfg = JSON.parse(read(path.join(web, 'config.json')));
  assert.deepEqual(Object.keys(cfg), ['gateUrl'], 'config.json 只能有 gateUrl（公開設定）');
});
