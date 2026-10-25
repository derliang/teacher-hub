// GAS 自助部署前端（deploy/）｜精靈（方案 2B）契約測試
//
// 目的：讓 docs/deploy/WIZARD_SPEC.md 的硬性規則「不照做就變紅」，而不是只靠實作端自己讀文件。
// 這份是契約，不是精靈本身的完整測試：精靈的行為測試仍由實作端寫在 scripts/test_wizard.mjs（規範第 6 節 A 組）。
//
// 運作方式（依實作進度分三關，精靈還沒開始做時這些關卡不啟動、不影響其他檢查）：
//   常駐   規範與入口文件互相指得到（CLAUDE.md、DESIGN_SPEC、README）
//   第 1 關 只要 deploy/assets/wizard.js 存在（規範步驟 A）：匯出介面、核心轉移規則、精靈測試檔都要在
//   第 2 關 只要 app.css 出現 .wiz 樣式或 index.html 出現 #crumbs／#pagehead／#does（步驟 B）：樣式與 id 要齊
//   第 3 關 只要 teacher.js 開始引用 wizard.js 或產生 #wizRail 等（步驟 C～E）：接線要齊，不可自己再寫一份狀態機
// 要改本檔放寬規則，請先改 WIZARD_SPEC.md 並取得擁有者同意。
// 執行：node --test scripts/test_wizard_contract.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(root, ...a);
const read = (f) => fs.readFileSync(f, 'utf8');
const WIZARD = p('deploy', 'assets', 'wizard.js');
const TEACHER = p('deploy', 'assets', 'teacher.js');
const INDEX = p('deploy', 'index.html');
const CSS = p('deploy', 'assets', 'app.css');
const WIZARD_TEST = p('scripts', 'test_wizard.mjs');

const has = fs.existsSync(WIZARD);
const css = read(CSS);
const html = read(INDEX);
const teacher = read(TEACHER);
const ui = read(p('deploy', 'assets', 'ui.js'));
const stage1 = has;
const stage2 = /\.wiz\s*\{/.test(css) || /id="(crumbs|pagehead|does)"/.test(html);
const stage3 = /wizard\.js/.test(teacher) || /wizRail|wizBody|wizHead|wizMini/.test(teacher) || /class="(wiz|rail|mini)"|步驟\s*<b>/.test(teacher);
const skip = (on, why) => (on ? false : why);

// ── 常駐：文件互相指得到 ──────────────────────────────

test('規範與入口文件互相指得到（CLAUDE.md、DESIGN_SPEC、README）', () => {
  assert.ok(fs.existsSync(p('docs', 'deploy', 'WIZARD_SPEC.md')), '缺少 docs/deploy/WIZARD_SPEC.md');
  const claude = read(p('CLAUDE.md'));
  assert.match(claude, /docs\/deploy\/WIZARD_SPEC\.md/, 'CLAUDE.md 沒有指向 docs/deploy/WIZARD_SPEC.md');
  assert.match(claude, /docs\/deploy\/DESIGN_SPEC\.md/, 'CLAUDE.md 沒有指向 docs/deploy/DESIGN_SPEC.md');
  assert.match(claude, /test_wizard_contract\.mjs/, 'CLAUDE.md 沒有要求跑精靈契約測試');
  assert.match(read(p('docs', 'deploy', 'DESIGN_SPEC.md')), /WIZARD_SPEC\.md/, 'DESIGN_SPEC.md 沒有指向 WIZARD_SPEC.md');
  assert.match(read(p('docs', 'deploy', 'README.md')), /WIZARD_SPEC\.md/, 'docs/deploy/README.md 沒有指向 WIZARD_SPEC.md');
});

test('規範本身仍寫著硬性規則（防止有人悄悄刪規範來讓測試過關）', () => {
  const spec = read(p('docs', 'deploy', 'WIZARD_SPEC.md'));
  for (const must of ['createFlow', 'reduce', 'view', 'canStart', 'busy', 'wizRail', 'wizBody', 'wizHead', 'wizMini', 'test_wizard_contract.mjs', 'data-busy-locked', 'leave', 'dispatch', 'ctx']) {
    assert.ok(spec.includes(must), `WIZARD_SPEC.md 少了「${must}」（這是契約測試依賴的規則，要改請先取得擁有者同意）`);
  }
});

// ── 第 1 關：wizard.js 與核心規則 ─────────────────────

test('只要樣式、id 或畫面接線已開始，wizard.js 就必須存在（步驟 A 先於 B、C）', { skip: skip(stage2 || stage3, '精靈尚未開始實作') }, () => {
  assert.ok(has, '已經開始做精靈的樣式或畫面，但沒有 deploy/assets/wizard.js；規範要求先做步驟 A（純邏輯＋測試）再接線');
});

test('第 1 關：wizard.js 匯出規範的介面', { skip: skip(stage1, '精靈尚未開始實作（沒有 wizard.js）') }, async () => {
  const w = await import(pathToFileURL(WIZARD).href);
  for (const name of ['FLOWS', 'createFlow', 'reduce', 'view', 'canStart']) assert.ok(name in w, `wizard.js 沒有匯出 ${name}`);
  assert.deepEqual(Object.keys(w.FLOWS).sort(), ['install', 'update']);
  assert.deepEqual([...w.FLOWS.install.steps], ['開始前', '確認', '安裝中', '完成後設定']);
  assert.deepEqual([...w.FLOWS.update.steps], ['選擇專案', '檢查結果', '確認更新', '完成']);
  assert.equal(w.FLOWS.install.crumb, '首次安裝');
  assert.equal(w.FLOWS.update.crumb, '更新');
});

test('第 1 關：必須有精靈行為測試檔，且測的是 wizard.js', { skip: skip(stage1, '精靈尚未開始實作') }, () => {
  assert.ok(fs.existsSync(WIZARD_TEST), '缺少 scripts/test_wizard.mjs（規範第 6 節 A 組，要先寫測試）');
  const t = read(WIZARD_TEST);
  assert.match(t, /wizard\.js/, 'scripts/test_wizard.mjs 沒有引用 wizard.js');
  assert.ok((t.match(/^\s*test\(/gm) || []).length >= 12, '精靈測試至少要 12 項（規範第 6 節 A 組）');
});

test('第 1 關：安裝流程的核心轉移規則（busy 鎖定、失敗回確認、完成後只能 finish）', { skip: skip(stage1, '精靈尚未開始實作') }, async () => {
  const { createFlow, reduce } = await import(pathToFileURL(WIZARD).href);
  const f0 = Object.freeze(createFlow('install'));
  assert.equal(f0.step, 1);
  assert.equal(f0.busy, false);
  const f2 = reduce(f0, { type: 'next' });
  assert.equal(f2.step, 2);
  assert.equal(f0.step, 1, 'reduce 不可修改傳入的物件');
  const f3 = reduce(f2, { type: 'start' });
  assert.equal(f3.step, 3);
  assert.equal(f3.busy, true);
  for (const type of ['back', 'cancel', 'leave', 'next', 'start', 'finish']) assert.equal(reduce(f3, { type }), f3, `執行中不可接受 ${type}（非法事件要回傳同一個物件）`);
  assert.equal(reduce(f3, { type: 'analyzed', result: 'ok' }), f3, '安裝流程不接受 analyzed');
  assert.equal(reduce(f0, { type: 'leave' }).closed, true, '步 1 可以 leave');
  assert.equal(reduce(f2, { type: 'leave' }).closed, true, '步 2 可以 leave');
  const failed = reduce(f3, { type: 'fail' });
  assert.equal(failed.step, 3);
  assert.equal(failed.busy, false);
  assert.equal(failed.failed, true);
  const back = reduce(failed, { type: 'back' });
  assert.equal(back.step, 2);
  assert.equal(back.failed, false);
  assert.equal(reduce(failed, { type: 'leave' }).closed, true, '安裝失敗後（步 3、非 busy）仍可 leave（麵包屑「上一層永遠可用，執行中除外」）');
  assert.equal(reduce(failed, { type: 'cancel' }), failed, '步 3 沒有 cancel');
  const done = reduce(f3, { type: 'succeed' });
  assert.equal(done.step, 4);
  assert.equal(done.busy, false);
  for (const type of ['back', 'cancel', 'next', 'start']) assert.equal(reduce(done, { type }), done, `完成後不可接受 ${type}`);
  assert.equal(reduce(done, { type: 'finish' }).closed, true);
  assert.equal(reduce(done, { type: 'leave' }).closed, true, '步 4 可以 leave');
  const closed = reduce(done, { type: 'finish' });
  for (const type of ['next', 'back', 'start', 'leave', 'finish']) assert.equal(reduce(closed, { type }), closed, `closed 之後不可接受 ${type}`);
  assert.equal(reduce(f0, { type: 'back' }), f0, '步 1 不能 back');
});

test('第 1 關：更新流程的核心轉移規則（分析結果決定能不能下一步、專案已知時 back 即關閉）', { skip: skip(stage1, '精靈尚未開始實作') }, async () => {
  const { createFlow, reduce } = await import(pathToFileURL(WIZARD).href);
  const known = createFlow('update', { skipFirst: true });
  assert.equal(known.step, 2);
  assert.equal(known.startedAt, 2);
  const analyzing = reduce(known, { type: 'analyze' });
  assert.equal(analyzing.busy, true);
  assert.equal(analyzing.analysis, 'loading');
  for (const result of ['blocked', 'noop', 'error']) {
    const r = reduce(analyzing, { type: 'analyzed', result });
    assert.equal(r.busy, false);
    assert.equal(r.analysis, result);
    assert.equal(reduce(r, { type: 'next' }), r, `分析結果 ${result} 時不可進下一步`);
  }
  const ok = reduce(analyzing, { type: 'analyzed', result: 'ok' });
  assert.equal(reduce(ok, { type: 'back' }).closed, true, '專案已知（skipFirst）時步 2 的 back 要關閉流程');
  const s3 = reduce(ok, { type: 'next' });
  assert.equal(s3.step, 3);
  const run = reduce(s3, { type: 'start' });
  assert.equal(run.busy, true);
  assert.equal(reduce(run, { type: 'back' }), run);
  const failed = reduce(run, { type: 'fail' });
  const retry = reduce(failed, { type: 'back' });
  assert.equal(retry.step, 2);
  assert.equal(retry.analysis, null, '更新失敗後回到步 2 必須清掉舊分析（呼叫端要重新分析）');
  const normal = createFlow('update');
  assert.equal(normal.step, 1);
  const n2 = reduce(reduce(normal, { type: 'analyze' }), { type: 'analyzed', result: 'ok' });
  assert.equal(reduce(n2, { type: 'back' }).step, 1, '一般進入的步 2 back 回步 1');
});

test('第 1 關：canStart 真值表與 view() 衍生資料', { skip: skip(stage1, '精靈尚未開始實作') }, async () => {
  const { createFlow, reduce, view, canStart } = await import(pathToFileURL(WIZARD).href);
  assert.equal(canStart({ confirmed: false }), false);
  assert.equal(canStart({ confirmed: true }), true);
  assert.equal(canStart({ confirmed: true, needDupConfirm: true, dupConfirmed: false }), false);
  assert.equal(canStart({ confirmed: true, needDupConfirm: true, dupConfirmed: true }), true);
  assert.equal(canStart({ confirmed: true, busy: true }), false);
  const v = view(reduce(createFlow('install'), { type: 'next' }));
  assert.deepEqual(v.rail.map((r) => r.state), ['done', 'cur', '', '']);
  assert.deepEqual(v.rail.map((r) => r.label), ['開始前', '確認', '安裝中', '完成後設定']);
  assert.equal(v.mini.current, 2);
  assert.equal(v.mini.total, 4);
  assert.equal(v.mini.label, '確認');
  assert.equal(v.mini.text, '步驟 2／4｜確認');
  assert.deepEqual([v.canBack, v.canCancel, v.canNext], [true, true, false], '安裝步 2：可上一步、可取消、沒有 next（只有 start）');
});

// ── 第 2 關：樣式與 id ───────────────────────────────

test('第 2 關：app.css 有精靈樣式、index.html 有 #crumbs／#pagehead／#does 且 #flowPanel 不是面板', { skip: skip(stage2, '精靈樣式與 id 尚未開始') }, () => {
  for (const sel of ['.wiz', '.rail', '.mini', '.wizbody']) assert.match(css, new RegExp(`${sel.replace('.', '\\.')}\\s*\\{`), `app.css 缺少 ${sel} 規則（WIZARD_SPEC 第 4 節）`);
  assert.match(css, /\.rail li\.cur/, 'app.css 缺少 .rail li.cur');
  assert.match(css, /\.mini \.bar i\.on/, 'app.css 缺少 .mini .bar i.on');
  for (const id of ['crumbs', 'pagehead', 'does']) assert.match(html, new RegExp(`id="${id}"`), `index.html 缺少 id="${id}"（WIZARD_SPEC 第 3.2 節）`);
  const flowTag = html.match(/<section[^>]*id="flowPanel"[^>]*>/);
  assert.ok(flowTag, 'index.html 找不到 #flowPanel');
  assert.equal(/class="[^"]*\bpanel\b/.test(flowTag[0]), false, '#flowPanel 不可再有 .panel（精靈不是面板）');
  assert.equal(/aria-live/.test(flowTag[0]), false, '#flowPanel 要拿掉 aria-live（改用焦點管理）');
});

// ── 第 3 關：接線 ────────────────────────────────────

test('第 3 關：teacher.js 用 wizard.js 管步驟，不可自己再寫一份狀態機', { skip: skip(stage3, '精靈尚未接線') }, () => {
  assert.match(teacher, /from\s+['"]\.\/wizard\.js['"]/, 'teacher.js 沒有 import ./wizard.js');
  assert.match(teacher, /function\s+dispatch\s*\(|const\s+dispatch\s*=/, 'teacher.js 缺少 dispatch()（busy 與步驟狀態的單一入口，WIZARD_SPEC 3.5）');
  for (const fn of ['createFlow', 'reduce', 'view', 'canStart']) assert.ok(new RegExp(`\\b${fn}\\b`).test(teacher), `teacher.js 沒有使用 wizard.js 的 ${fn}`);
  for (const id of ['wizRail', 'wizBody', 'wizHead', 'wizMini']) assert.ok(teacher.includes(id), `teacher.js 沒有產生 #${id}（WIZARD_SPEC 第 3.3 節）`);
  assert.equal(/\bstate\.step\s*=|\bflowStep\s*=|let\s+step\s*=/.test(teacher), false, 'teacher.js 不可自己維護步驟變數（步驟只能由 wizard.js 的 reduce 決定）');
});

test('第 3 關：規範第 3.1 節的 id 與屬性在接線後仍然存在', { skip: skip(stage3, '精靈尚未接線') }, () => {
  const all = html + '\n' + teacher + '\n' + ui;
  const ids = ['flowPanel', 'status', 'products', 'signInPanel', 'signInBtn', 'who', 'whoEmail', 'signOutBtn', 'titleInput', 'installOk', 'dupOk', 'installGo', 'flowCancel',
    'installSteps', 'installResult', 'scriptInput', 'analyzeBtn', 'analysis', 'updateOk', 'updateGo', 'updateSteps', 'updateResult'];
  for (const id of ids) assert.match(all, new RegExp(`id="${id}"`), `缺少 id="${id}"（現有程式與測試依賴它）`);
  for (const attr of ['data-lock', 'data-act', 'data-script', 'data-dep', 'data-force-disabled', 'data-step']) assert.ok(all.includes(attr), `缺少屬性 ${attr}`);
});

test('第 3 關：不可破壞的行為仍在程式裡（setBusy 只還原自己鎖的、beforeunload 只在執行中提醒）', { skip: skip(stage3, '精靈尚未接線') }, () => {
  assert.match(teacher, /busyLocked\s*===\s*'1'/, 'setBusy 必須只還原「這次被鎖住的」按鈕（data-busy-locked）');
  assert.match(teacher, /dataset\.busyLocked\s*=\s*'1'/, 'setBusy 鎖按鈕時要標記 busyLocked');
  assert.match(teacher, /beforeunload[\s\S]{0,120}state\.busy/, '執行中離開頁面要有 beforeunload 提醒');
  assert.match(teacher, /dispatch\(\s*\{\s*type:\s*['"](succeed|fail|analyzed)['"]/, '寫入與分析流程結束時要用 dispatch 發出 succeed／fail／analyzed（解除忙碌）');
  assert.match(teacher, /finally/, '寫入與分析流程要以 try/catch/finally 保證一定發出結束事件');
});
