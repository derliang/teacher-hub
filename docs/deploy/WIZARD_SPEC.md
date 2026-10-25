<!--
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
-->
# 自助部署精靈（方案 2B）實作規範

> 狀態：規範定案，**尚未實作**（2026-10-25；已由乾淨上下文的代理試讀並依其回報修正過一版）。對象：之後負責把 `deploy/` 的老師頁改成精靈的實作者。
> 這份是「照著做」的規格：**外觀**以 [DESIGN_SPEC.md](DESIGN_SPEC.md) 與模擬頁為準；**每步的文案**以本文件第 6 節為準；**狀態機、資料、重畫與忙碌規則、測試、驗收**以本文件為準；功能與安全以 私人 repo 的 `AGENTS.md`、私人 repo 的 `SELF_SERVICE_SPEC_V1.md` 為準。
> 為什麼獨立成一份：精靈是整個改版風險最高的一塊（它會動到安裝與更新的畫面流程），而老師頁的邏輯幾乎沒有自動測試保護，所以先把規則與測試寫清楚，再動程式。
> **自動把關**：`scripts/test_wizard_contract.mjs` 會在精靈開始實作後，強制檢查本文件的硬性規則（見第 7 節）。要放寬它，先改本文件並取得擁有者同意。

## 0. 前提與範圍

- **前提**：階段 1（樣式換 token、骨架、移除 emoji、設計測試）已完成；`scripts/dev/fake-gate.mjs` 已可用。**「檢查全綠」＝** `python scripts/check_design.py` 通過，且 `node --test scripts/test_deploy_frontend.mjs scripts/test_wizard_contract.mjs`（步驟 A 之後再加上 `scripts/test_wizard.mjs`）全過。
- **分支與提交**：從 `main` 開新分支（例如 `feat/deploy-wizard`），第 1 節每一步一個 commit；**本 repo 是公開前端，合併到 `main` 就等於發佈**，所以不 push `main`，除非擁有者說「發佈網頁」。PR 說明要寫人工檢查看過什麼（PAGES.md 第 5 節）。
- **可以動**：`assets/teacher.js`、`assets/ui.js`（只可**新增**輔助函式，不改既有簽名）、`index.html`、`assets/app.css`、新增 `assets/wizard.js`、新增 `scripts/test_wizard.mjs`、依需要擴充 `scripts/dev/fake-gate.mjs`。
- **不能動**：`engine.js`、`core.js`、`gs-check.js`、私人 repo 的後端、錯誤碼與錯誤訊息文字、`admin.js` 與管理頁；現有文案原樣保留，**新增的文案只能用第 6 節列出的**。
- **名稱**：`teacher.js` 現有 `const flow = $('#flowPanel')` 要改名為 `flowEl`；精靈的狀態物件叫 `wiz`；流程資料物件叫 `ctx`。

## 1. 工作順序（一步一個 commit，每步結束檢查全綠）

| 步 | 做什麼 | 結束時要成立 |
|---|---|---|
| A | 新增 `wizard.js`（純函式）與 `scripts/test_wizard.mjs`（第 7 節 A 組）。**先寫測試、先紅、再寫實作變綠** | 狀態機測試與契約測試第 1 關全過；`teacher.js` 尚未改 |
| B | `app.css` 加第 4 節的樣式；`index.html` 加 id、`#flowPanel` 去掉 `.panel` 與 `aria-live` | 設計測試與契約測試第 2 關全過 |
| C | 接線：首次安裝四步 | 第 8 節「安裝」驗收通過；契約測試第 3 關全過 |
| D | 接線：更新四步 | 第 8 節「更新」驗收通過 |
| E | 動態麵包屑、焦點管理、進度條、收尾 | 第 8 節全部勾完、檢查全綠 |

## 2. 純邏輯：`assets/wizard.js`（不碰 DOM，可在 node 測）

目的：把「現在在第幾步、能不能下一步／上一步／取消／離開、執行中怎麼鎖」從 DOM 與網路裡抽出來，讓最容易出錯的規則有測試保護。**步驟只能由這裡決定，`teacher.js` 不可自己維護步驟變數。**

```js
export const FLOWS = {
  install: { crumb: '首次安裝', steps: ['開始前', '確認', '安裝中', '完成後設定'] },
  update:  { crumb: '更新',     steps: ['選擇專案', '檢查結果', '確認更新', '完成'] }
};

/** 回傳全新的 flow 物件。skipFirst：更新從「我的系統」進來（專案已知）時從第 2 步開始。 */
export function createFlow(kind, { skipFirst = false } = {}) {
  return { kind, step: skipFirst ? 2 : 1, startedAt: skipFirst ? 2 : 1, busy: false, failed: false, analysis: null, closed: false };
}

/** 狀態轉移：不修改傳入的物件（可傳入凍結物件）；非法事件回傳「同一個物件」，不丟例外。呼叫端用 `next === flow` 判斷被拒絕。 */
export function reduce(flow, event) { /* 見 2.1 */ }

/** 給畫面用的衍生資料。 */
export function view(flow) {
  // { rail: [{ label, state: 'done'|'cur'|'' }],
  //   mini: { current, total, label, text },     // text 例：'步驟 2／4｜確認'（全形斜線與直線；畫面把「2／4」包進 <b>）
  //   canBack, canCancel, canNext }
}

/** 「開始安裝／開始更新」能不能按。與現有 teacher.js 的 sync() 同一條規則。 */
export function canStart({ confirmed, needDupConfirm = false, dupConfirmed = false, busy = false }) {
  return !busy && Boolean(confirmed) && (!needDupConfirm || Boolean(dupConfirmed));
}
```

### 2.1 事件與轉移表

事件格式 `{ type: '…' }`；`analyzed` 另帶 `result`。**`flow.busy` 為真時，只接受 `succeed`、`fail`、`analyzed`；其餘事件一律拒絕**（這就是「執行中不可返回、不可取消、不可離開」）。`closed` 為真後，所有事件一律拒絕。

事件的意思：`next`／`back` 步驟前後；`cancel` 按「取消」鈕；`leave` 點麵包屑「自助部署」離開流程；`start` 按「開始安裝／開始更新」；`succeed`／`fail` 寫入流程結束；`finish` 按「回到我的系統」；更新專用：`analyze`（開始／重新檢查）、`choose`（多部署時換選一個）、`analyzed`（檢查結束）。

**首次安裝**

| 目前 | 事件 | 結果 |
|---|---|---|
| 步 1 | `next` | 步 2 |
| 步 1、2 | `cancel` | `closed = true` |
| 步 2 | `back` | 步 1 |
| 步 2 | `start` | 步 3、`busy = true`、`failed = false` |
| 步 3（busy） | `succeed` | 步 4、`busy = false` |
| 步 3（busy） | `fail` | 仍在步 3、`busy = false`、`failed = true` |
| 步 3（非 busy、`failed`） | `back` | 步 2、`failed = false` |
| 步 4 | `finish` | `closed = true` |
| 任何步驟（非 busy） | `leave` | `closed = true` |
| 其他組合（含 busy 時的 `analyzed`、步 3 與步 4 的 `cancel`） | — | 拒絕 |

**更新**

| 目前 | 事件 | 結果 |
|---|---|---|
| 步 1（非 busy） | `analyze` | 步 2、`busy = true`、`analysis = 'loading'` |
| 步 2（非 busy，任何 `analysis`） | `analyze` | `busy = true`、`analysis = 'loading'`（進入時自動檢查、「重新檢查」、失敗後重試都用它） |
| 步 2（非 busy） | `choose` | `busy = true`、`analysis = 'loading'`（呼叫端用新選的部署重新分析） |
| 步 2（busy） | `analyzed` + `result`：`'ok'`／`'blocked'`／`'noop'`／`'error'` | `busy = false`、`analysis = result` |
| 步 2（`analysis === 'ok'`） | `next` | 步 3 |
| 步 2 | `back` | `startedAt === 1` → 步 1；`startedAt === 2` → `closed = true` |
| 步 1、2 | `cancel` | `closed = true` |
| 步 3（非 busy） | `start` | `busy = true`、`failed = false`（**仍在步 3**） |
| 步 3（busy） | `succeed` | 步 4、`busy = false` |
| 步 3（busy） | `fail` | 仍在步 3、`busy = false`、`failed = true` |
| 步 3（非 busy、非 failed） | `back` | 步 2（沿用既有分析結果） |
| 步 3（非 busy、`failed`） | `back` | 步 2、`failed = false`、`analysis = null`（呼叫端**立即重新分析**：遠端狀態可能已變） |
| 步 4 | `finish` | `closed = true` |
| 任何步驟（非 busy） | `leave` | `closed = true` |
| 其他組合 | — | 拒絕 |

> 現有程式的更新失敗後，確認勾選會停在「已勾選且停用」，老師無法在原地重試。精靈改為「回到檢查結果並重新分析」，這是**刻意的修正**，不是疏漏（重新分析也符合「寫入前重讀遠端狀態」的原則）。

### 2.2 `view(flow)` 規則

- `rail`：步數 < 目前步 → `done`；等於 → `cur`；其餘空字串。
- `mini`：`{ current: step, total: 4, label: steps[step-1], text: '步驟 ' + step + '／4｜' + label }`。
- `canBack`／`canCancel`／`canNext`：依 2.1 表，「該事件被接受」時為真（`reduce(flow, {type}) !== flow`；更新步 2 的 `canNext` 還要 `analysis === 'ok'`，已含在 reduce 內）。

## 3. 資料、DOM 與重畫

### 3.1 流程資料 `ctx`（由 `teacher.js` 持有，**不放進 DOM**）

每次重畫都會銷毀舊節點，所以輸入值與分析結果一律存在 `ctx`，畫面只是它的投影：

```js
ctx = {
  p,                      // 目前的產品卡資料（含 product、latestRelease）
  resumeScriptId,         // 接續安裝的專案 ID（''＝全新安裝）
  title,                  // 安裝：專案名稱；離開步 1 時從 #titleInput 存進來；步 2 → 步 1 要回填
  scriptId,               // 更新：專案 ID（來自「我的系統」那一筆，或步 1 貼上並通過 parseScriptIdInput）
  knownDeploymentId,      // 更新：「我的系統」那一筆的 deploymentId（貼上網址進來的為 ''）
  chosenDeploymentId,     // 更新：多部署時老師選的那一個（'' ＝尚未選）
  release, bundle, a      // 更新：fetchVerifiedBundle 的結果與 analyzeUpdate 的結果（renderAnalysis 的 ctx）
}
```

規則：安裝步 3 讀 `ctx.title`，**不可**再讀 `#titleInput`；更新步 3 沿用 `ctx.a`；「失敗後回到檢查結果」時 `ctx.a`、`ctx.release`、`ctx.bundle` 清空並重新分析；離開流程（`closed`）時整個 `ctx` 丟棄。

### 3.2 `index.html` 要做的調整

| 項目 | 做法 |
|---|---|
| 新增 id | `nav.crumbs` 加 `id="crumbs"`（`class` 維持第一個、`aria-label` 第二個，`id` 放後面：`<nav class="crumbs" aria-label="所在位置" id="crumbs">`；契約測試與設計測試都依這個順序比對）；`.pagehead` 加 `id="pagehead"`；`.does` 加 `id="does"` |
| `#flowPanel` | 去掉 `.panel`、去掉 `aria-live`（改用焦點管理），保留 `hidden` 的初始狀態（`class="hidden"`） |
| 進入流程 | 用現有的 `show(el, false)`（加 `.hidden` class）隱藏 `#pagehead`、`#does`、`#products`；`show(flowEl)` |
| 離開流程 | 反向恢復；**不再呼叫 `loadMe()`**（`doInstall`／`doUpdate` 成功時已呼叫，保留）；若是 `closed` 前沒有成功就只是重新顯示現有的產品列 |
| `#status` | 流程中維持顯示 |

### 3.3 必須保留的 id 與屬性（現有程式與測試依賴它們）

`flowPanel`、`status`、`products`、`signInPanel`、`signInBtn`、`who`、`whoEmail`、`signOutBtn`；流程內：`titleInput`、`installOk`、`dupOk`、`installGo`、`flowCancel`、`installSteps`、`installResult`、`scriptInput`、`analyzeBtn`、`analysis`、`updateOk`、`updateGo`、`updateSteps`、`updateResult`；屬性 `data-lock`、`data-act`、`data-script`、`data-dep`、`data-force-disabled`、`data-step`。**可以換位置、換所屬步驟，不可改名或拿掉。**

### 3.4 精靈外殼與重畫規則

```html
<div class="wiz">
  <ol class="rail" id="wizRail" aria-label="進度">
    <li class="done">開始前</li>
    <li class="cur" aria-current="step">確認</li>
    <li>安裝中</li>
    <li>完成後設定</li>
  </ol>
  <div class="wizbody" id="wizBody">
    <div class="mini" id="wizMini">
      <div class="bar"><i class="on"></i><i class="on"></i><i></i><i></i></div>
      <p>步驟 <b>2／4</b>｜確認</p>
    </div>
    <h2 id="wizHead" tabindex="-1">確認安裝內容</h2>
    <!-- 這一步的內容（第 6 節） -->
  </div>
</div>
```

- `.rail`（≥ 760）與 `.mini`（< 760）**兩者都輸出**，由 CSS 顯示其一，不用 JS 判斷寬度。
- 步 4 沒有 `h2`：把 `#wizHead` 放在包住 `notice` 的 `<div id="wizHead" tabindex="-1">…</div>` 上（`ui.js` 的 `notice()` 不支援 id，所以外包一層）。

**什麼時候「整片重畫」、什麼時候「只局部更新」（唯一的規則，不要自行發揮）**

| 事件 | 做法 |
|---|---|
| 改變步驟編號的事件（`next`、`back`、`start`（安裝 2→3）、`succeed`、`analyze` 由步 1 進步 2） | 整片重畫 `#flowPanel`，焦點到 `#wizHead` |
| 更新步 2 內的 `analyze`／`choose`／`analyzed` | 只重畫 `#wizBody` 裡「步驟內容」那一段（kv、選擇器、阻擋、警示、按鈕），**外殼、`#wizHead` 不動、焦點不搶** |
| 更新步 3 的 `start`（步驟編號不變） | **不重畫**：把勾選與按鈕設為停用（沿用現有的 `$('#updateGo').disabled = true; $('#updateOk').disabled = true`），在 `#updateSteps` 建立進度列表 |
| 兩種流程的 `fail`（步驟編號不變） | **不重畫**：在 `#installResult`／`#updateResult` 顯示 `errorHtml()` 與重試提示，並**附加**「← 回到確認／回到檢查結果」按鈕；進度列表保留 |
| 執行期間（`busy`） | **一次執行只建立一個 `stepList`**，執行期間不重畫 `#installSteps`／`#updateSteps`（否則 `stepList` 的回呼會指向已被移除的節點） |

### 3.5 busy 的單一入口：`dispatch(event)`

現有程式有 `state.busy` 與 `setBusy()`（鎖住 `button[data-lock]`）；精靈新增 `wiz.busy`。**兩者必須永遠同步**，所以只允許用這個函式改變狀態：

```js
function dispatch(event) {
  const next = reduce(wiz, event);
  if (next === wiz) return false;           // 被拒絕：什麼都不做
  const wasBusy = wiz.busy;
  wiz = next;
  if (wiz.busy !== wasBusy) setBusy(wiz.busy); // 先同步忙碌狀態與鎖定
  render(event);                              // 再依 3.4 的規則畫（局部或整片）
  return true;
}
```

- `setBusy()` 與 `state.busy` **保留現有寫法**（尤其是「結束時只還原這次被鎖住的按鈕」那段），`beforeunload` 也保留現有寫法：**永遠註冊，內部檢查 `state.busy`**。
- 現有的 `doInstall`／`doUpdate`／`doAnalyze` 裡的 `setBusy(true)`／`finally { setBusy(false) }` 改為 `dispatch({type:'start'|'analyze'|'choose'})`、`dispatch({type:'succeed'|'fail'|'analyzed', result})`（用 `try/catch/finally` 保證一定發出結束事件）。商品列表上的「放棄這筆紀錄」（`discardInstalling`）不在精靈裡，維持直接呼叫 `setBusy`。
- 畫面規則：`busy` 時**不輸出**「上一步／下一步／取消」鈕（用 `view().canBack` 等決定要不要輸出，不是輸出後停用）。

## 4. 要加進 `app.css` 的樣式（逐字，全部用 token；加在「管理頁」區塊之前）

```css
/* ===== 精靈（方案 2B）===== */
.wiz{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}
.rail{display:none;list-style:none;margin:0;padding:0;counter-reset:w}
.rail li{counter-increment:w;display:flex;gap:12px;align-items:baseline;padding:12px 0 12px 14px;border-left:2px solid var(--line);font-size:14.5px;color:var(--ink3)}
.rail li::before{content:counter(w);font-family:var(--serif);font-weight:700}
.rail li.done{border-color:var(--brass-line);color:var(--ink2)}
.rail li.done::before{content:"\2713";color:var(--ok)}
.rail li.cur{border-color:var(--primary);color:var(--ink);font-weight:700}
.rail li.cur::before{color:var(--brass)}
.mini{display:grid;gap:8px}
.mini .bar{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.mini .bar i{height:4px;border-radius:2px;background:var(--line)}
.mini .bar i.on{background:var(--brass-line)}
.mini p{margin:0;font-size:13.5px;color:var(--ink2)}
.mini b{color:var(--ink)}
.wizbody{display:grid;gap:16px;min-width:0;align-content:start}
.wizbody>h2{font-family:var(--serif);font-size:24px;line-height:1.35;margin:0}
.wizbody>h2:focus,.wizbody>div[tabindex]:focus{outline:none}
.wizbody h3{font-size:15px;margin:0}
.wizbody p{margin:0;color:var(--ink2);font-size:14.5px}
@media (min-width:760px){.wiz{grid-template-columns:200px minmax(0,1fr);gap:48px}.rail{display:grid;align-content:start}.mini{display:none}}
```

> 來自模擬頁 `自助部署.html`（`.wiz`／`.rail`／`.mini`／`.wizbody`），調整三處：模擬頁寫在 `h2` 上的內聯樣式改成 `.wizbody>h2`；拿掉 `.wiz` 的 `padding-bottom`（外層 `.stack` 已有 56px，會重複）；新增 `.wizbody h3`／`.wizbody p`（`#flowPanel` 去掉 `.panel` 後，選擇器的小標與說明失去 `.panel h3`／`.panel p` 的樣式）。**不要再自行調整間距或字級**；要改外觀請走 DESIGN_SPEC 第 7 節。
> 流程中頁面沒有 `h1`（模擬頁畫面 5～13 就是這樣設計的），`#wizHead` 是第一個標題，它就是頁面標題。

## 5. 互動與無障礙（照做）

1. **每次整片重畫**：焦點移到 `#wizHead`，然後 `flowEl.scrollIntoView({ block: 'start', behavior })`，`behavior` 在 `matchMedia('(prefers-reduced-motion: reduce)').matches` 時為 `'auto'`，否則 `'smooth'`。局部更新不搶焦點、不捲動。
2. `.rail` 的目前步驟 `li` 加 `aria-current="step"`；`.mini` 的文字（`view().mini.text`）是手機上的無障礙進度說明。
3. **鍵盤**：所有操作都是真 `<button>`／`<input>`。**不做「Enter 等於下一步」**（名稱與網址欄位用中文輸入法時，選字的 Enter 會誤觸）。
4. **麵包屑**（進入、離開流程時用 `renderCrumbs(wiz)` 改寫 `#crumbs`）：
   - 非流程：`Teacher Hub 首頁 › GAS 部署 › 自助部署`（最後一項 `<b aria-current="page">`）。
   - 流程中：`Teacher Hub 首頁 › GAS 部署 › 自助部署 › 首次安裝`（或 `更新`），`自助部署` 變成連結 `href="./"`，最後一項為 `<b aria-current="page">`。
   - 流程中點 `自助部署`：`preventDefault()` 後 `dispatch({type:'leave'})`；被拒絕（busy）就什麼都不發生。**`leave` 在任何非 busy 的步驟都有效**（包含失敗後的步 3 與步 4），這是 DESIGN_SPEC 第 5 節「上一層永遠可用，執行中除外」的實作。其他連結（首頁、GAS 部署、頂端導覽）維持真連結，離開頁面靠 `beforeunload`（busy 時才提醒）。
5. `<title>` 不隨步驟變動。
6. 輸入檢查：安裝步 1「下一步」時專案名稱為空 → 留在步 1，顯示 `notice('bad', '請輸入專案名稱。')`，**不發事件**；更新步 1「檢查這個專案」時 `parseScriptIdInput` 回傳 `null` → 留在步 1，顯示現有的「看不出專案 ID…」訊息，**不發事件**。

## 6. 每一步的內容與文案

「沿用」＝用現有函式產生現有 HTML（階段 1 之後 class 已是新名稱）；「新增」＝本節列出的新文案，**只能用這些**（擁有者可改字）。步驟內容的完整畫面見模擬頁 `docs/design/mockups/自助部署.html` 畫面 5～13。

### 首次安裝

| 步 | h2 | 內容 | 按鈕 |
|---|---|---|---|
| 1 | 開始前（新增） | `PREFLIGHT` 提示（沿用）；專案名稱欄位（沿用 `titleInput`，值取 `ctx.title`）；接續安裝時改顯示「會接續上次已建立的專案（…）…」（沿用），不顯示名稱欄位 | 「下一步：確認 →」（新增）、「取消」（沿用文字） |
| 2 | 確認安裝內容（新增） | 導言：「{產品名} {版本}。確認後，系統會在你的 Google 帳號建立專案並發布。」（新增）；`kv`（沿用）；已安裝過的警告與 `dupOk`（沿用）；`installOk`（沿用） | 「← 上一步」（新增）、「開始安裝」（沿用）。**沒有取消鈕**（要離開用「上一步」到步 1 取消，或點麵包屑） |
| 3 | 安裝中（新增） | 提示（新增）：「安裝完成前請保持這個分頁開啟，不要關閉或重新整理。」；進度列表（沿用 `stepList` 的七步）；失敗時 `errorHtml()` ＋ 現有的「要重試請重新勾選上方的確認；已經建立的專案會被接續使用，不會多建一份。」，**把「上方的確認」改成「確認頁的確認」**（新增文字，因為勾選已在步 2） | 失敗時才有：「← 回到確認」（新增） |
| 4 | （無 h2；焦點在成功 `notice`） | 沿用：`安裝完成！還差最後幾步你要自己完成：`、`setupSteps` 清單（`ol.todo`）、`kv`（編輯器與系統網址）、403 說明 | 「回到我的系統」（新增）→ `dispatch({type:'finish'})` |

### 更新

| 步 | h2 | 內容 | 按鈕 |
|---|---|---|---|
| 1 | 選擇要更新的專案（新增） | 導言：「貼上要更新的 GAS 編輯器網址（或專案 ID）。」（新增；**不要**寫模擬頁畫面 10 的「選你已安裝的系統」，現有程式沒有選單）；`PREFLIGHT`（沿用）；`scriptInput` 與說明（沿用） | 「檢查這個專案（不會修改任何東西）」（沿用）、「取消」（沿用） |
| 2 | 檢查結果（新增） | 導言：「這一步只讀取，不會修改你的專案。」（新增）；分析中：`notice('info', '正在讀取你的 GAS 專案與正式版，請稍候…')`（沿用）；`skipFirst` 進入時在分析中與失敗時，內容上方顯示 `PREFLIGHT`；結果：`kv`、**部署選擇器（`renderAnalysis` 的 chooser 放這裡）**、阻擋與警示、「已經是最新版…」、資料遷移說明（全沿用）；分析失敗：`errorHtml()` | 非 `skipFirst`：「← 上一步」（新增）；`skipFirst`：「← 返回我的系統」（新增，事件仍是 `back`）；`analysis === 'ok'` 才有「下一步：確認更新 →」（新增）；`error`／`blocked`／`noop` 時另有「重新檢查」（新增，事件 `analyze`） |
| 3 | 確認更新（新增） | 導言：「按下開始後，系統會依序進行下列步驟，網址不變。」（新增）；`updateOk` 勾選（沿用）；進度列表（沿用 `stepList` 的五步）；失敗時 `errorHtml()` ＋ 提示（新增）：「已停止。要重試請回到檢查結果重新檢查；你的 GAS 狀態可能已經改變，系統會重新讀取。」 | 「← 上一步」（新增，非 busy 時）、「開始更新」（沿用）；失敗後只留「← 回到檢查結果」（新增） |
| 4 | （無 h2；焦點在成功 `notice`） | 沿用：`更新完成：…` 與網址、版本 #前 → #後、提醒 | 「回到我的系統」（新增） |

**分析結果對映**（`doAnalyze` 結束時）：丟出例外 → `'error'`；`!a.verdict.ok` → `'blocked'`（含「有多個部署、尚未選擇」的 `CHOOSE_DEPLOYMENT`：此時選擇器照常顯示，選了之後重新分析）；`a.verdict.ok && a.verdict.noop` → `'noop'`；其餘 → `'ok'`。**多部署的換選**：選擇器的 radio `change` → `ctx.chosenDeploymentId = 值` → `dispatch({type:'choose'})` → 以 `doAnalyze(…, chosenDeploymentId)` 重新分析（等同現有行為）。

## 7. 測試（先寫，先紅）

### A 組：`scripts/test_wizard.mjs`（純邏輯，不需瀏覽器）

至少涵蓋（每條一個 `test`，不得少於 12 項）：

1. `createFlow('install')` 起點為步 1、不 busy；`createFlow('update', { skipFirst: true })` 起點為步 2 且 `startedAt === 2`。
2. 安裝整條路：步 1 → `next` → 步 2 → `start`（busy）→ `succeed` → 步 4 → `finish` → `closed`。
3. **busy 時** `back`、`cancel`、`leave`、`next`、`start`、`finish` 全部被拒絕（回傳同一個物件）；busy 時的 `analyzed` 在安裝流程也被拒絕。
4. 安裝失敗：`start` → `fail` → 仍在步 3、`busy` 為假、`failed` 為真；`back` → 步 2、`failed` 為假。
5. 步 3（非 busy、未失敗不會存在，但 `failed` 時）與步 4 的 `cancel` 被拒絕；步 4 只能 `finish` 或 `leave`。
6. `leave`：步 1、2、失敗後的步 3、步 4 都 → `closed`；busy 時被拒絕。
7. 更新：`analysis` 為 `blocked`／`noop`／`error` 時 `next` 被拒絕；為 `ok` 時 `next` → 步 3。
8. 更新：步 1 `analyze` → 步 2 busy；步 2 任何 `analysis` 下 `analyze` 都被接受（重新檢查）；`choose` 被接受且 `analysis` 回到 `'loading'`。
9. 更新 `skipFirst`：步 2 `back` → `closed`；一般進入的步 2 `back` → 步 1。
10. 更新失敗：步 3 `start`（仍在步 3）→ `fail` → `back` → 步 2 且 `analysis === null`；沒失敗時步 3 的 `back` 保留 `analysis`。
11. `reduce` 不修改傳入的物件（先 `Object.freeze` 再轉移，不丟例外）；`closed` 後所有事件被拒絕。
12. `view()`：4 步各自的 `rail` 狀態、`mini.text`（含全形「／」與「｜」）、`canBack`／`canCancel`／`canNext` 在各步與 busy 時的值。
13. `canStart` 真值表：`confirmed` 為假 → 假；`needDupConfirm` 且 `dupConfirmed` 為假 → 假；`busy` → 假；其餘為真。
14. 流程定義：兩條流程各 4 步，步驟名稱與 DESIGN_SPEC 第 5 節表格一致。

### B 組：契約測試（已存在，不要改弱）

`scripts/test_wizard_contract.mjs` 依實作進度分三關自動啟動，並且常駐檢查入口文件與本規範的關鍵規則（`CLAUDE.md` 要列出本文件）：

- 第 1 關（`wizard.js` 存在）：匯出介面、核心轉移規則（含 `leave`、`mini.text`）、`scripts/test_wizard.mjs` 存在且 ≥ 12 項。
- 第 2 關（樣式或 id 開始出現）：`wizard.js` 必須已存在；`.wiz`／`.rail`／`.mini`／`.wizbody` 樣式、`#crumbs`／`#pagehead`／`#does`、`#flowPanel` 不是面板。
- 第 3 關（`teacher.js` 開始接線）：必須 import `./wizard.js` 並使用 `createFlow`／`reduce`／`view`／`canStart`／`dispatch`；產生 `#wizRail` 等；第 3.3 節的 id 與屬性仍在；`setBusy` 的「只還原自己鎖的」邏輯與 `beforeunload` 提醒仍在。

### C 組：瀏覽器驗收（第 8 節）

`teacher.js` 的畫面接線沒有 DOM 層測試（repo 不引入 jsdom 等相依）。**所以畫面接線必須薄**：所有判斷都呼叫 `wizard.js`，`teacher.js` 只負責「畫」和「綁事件」。第 8 節是必做，不是選做。

## 8. 驗收（用假閘門，不連真實 Google）

```bash
node scripts/dev/fake-gate.mjs        # → http://localhost:8790/deploy/
```

這個假閘門連 Apps Script API 都是假的（記憶體裡的假專案），所以**安裝與更新的成功、失敗、阻擋、已是最新、多部署、登入過期都能真的走完**。情境用網址切換（完整說明見該檔檔頭）：

| 要驗的 | 切換 |
|---|---|
| 一切成功（預設） | `/__reset` |
| 讓「執行中」停得住（驗 busy 時沒有上一步／取消、點麵包屑沒反應） | `/__set?delay=1500`（記得驗完改回 `/__set?delay=600`） |
| 更新：已是最新／被阻擋／多個部署要選 | `/__set?update=noop`、`update=blocked`、`update=multi`（多部署要走「更新其他既有的 GAS」，貼 `https://script.google.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit`） |
| 失敗：下載正式版／寫入程式／建立部署 | `/__set?fail=bundle`、`fail=upload`、`fail=deploy` |
| 流程中途登入過期（要看到「重新登入」鈕） | `/__set?fail=expired` |
| 登入後沒有任何授權 | `/__set?me=none` |
| 平台尚未開放（`NOT_READY`） | `/__set?notready=1`（驗完 `notready=0`） |

**逐項勾完才算完成**（寬度：手機 390、iPad 820、桌機 1280；淺色與深色各看一次）：

**版面與導覽**

- [ ] 每個畫面對照模擬頁畫面 5～13 的**結構與元件**一致：同樣的區塊順序、同樣的 class、≥ 760 左側是 `.rail`、< 760 是 `.mini`；文案以第 6 節為準（與模擬頁的差異只有第 6 節明列的幾處）。
- [ ] 沒有橫向捲動（`document.documentElement.scrollWidth - clientWidth === 0`）；所有 `button`、`a.btn`、`select`、文字輸入框高度 ≥ 44px（勾選框與圓鈕本身例外，`.chk` 的整列約 37px 是與模擬頁一致的已知現況）。
- [ ] 進入流程後麵包屑多一層、最後一項 `aria-current="page"`；點「自助部署」回到我的系統（失敗後的步 3 與步 4 也可以）；busy 時點不動。
- [ ] 整片重畫後焦點在 `#wizHead`（`document.activeElement.id`）；步 4 焦點在包住成功 `notice` 的那一層；局部更新不搶焦點。

**不可破壞的行為（DESIGN_SPEC 第 5 節那 6 條，逐條實測）**

- [ ] **確認勾選前「開始安裝」不可按**；已有安裝時，兩個勾選都勾才可按；取消其中一個又停用。
- [ ] 按下「開始安裝」後：勾選與按鈕立即作廢（步 3 沒有勾選了）；進度列表出現；**此時沒有「上一步」「取消」**；點麵包屑「自助部署」沒有反應；`beforeunload` 會提醒。
- [ ] 失敗後（`fail=upload`）：進度停在失敗那一步、其餘維持等待；顯示錯誤與重試提示；按「← 回到確認」到步 2，**兩個勾選都是未勾**，「開始安裝」停用，專案名稱仍是原本填的（`ctx.title`）；再勾選重試能成功（把 `fail` 設回 `none`），且沒有多建專案（`/__state` 的 `projects` 數量只多一個）。
- [ ] 流程結束後 `document.querySelectorAll('[data-busy-locked]').length === 0`（抓「解鎖時把尚未勾選的開始鈕一起解鎖」的老問題）；安裝成功後不能再按一次「開始安裝」。
- [ ] 更新：`blocked` 時步 2 沒有「下一步」；`noop` 只顯示 ok 訊息、沒有「下一步」；`multi` 時選擇器出現、換選會重新分析、選好後才有「下一步」；更新成功後版本 #前 → #後、網址不變；更新失敗（`fail=upload`）後回到步 2 並自動重新分析，勾選歸零。
- [ ] `fail=expired`：流程中的錯誤訊息出現「重新登入」鈕；`me=none` 與 `notready=1` 的訊息文字與現況相同；`?product=` 過濾與授權過濾不變。

**完成後**：檢查全綠（含新舊所有測試）→ 分別 commit → 回報 commit SHA。

## 9. 不要做的事

- 不改引擎、閘門、錯誤碼、錯誤訊息文字；不為了精靈改變安裝或更新的規則（例如不新增「跳過確認」或「自動重試」）。
- 不把步驟狀態存進 `localStorage`、網址 hash 或後端（重新整理即回到「我的系統」，這是刻意的：安裝中途的接續由後端「安裝未完成」紀錄負責）。
- 不用 `history.pushState` 模擬每一步的網址（瀏覽器「上一頁」會離開本頁；已知限制，接受）。
- 不引入框架、jsdom 或任何新相依；不新增顏色、字型、圓角或元件（要新增先走 DESIGN_SPEC 第 7 節）。
- 不自己維護步驟變數（`let step = …`）；不繞過 `dispatch()` 直接改 `wiz` 或 `setBusy`（`discardInstalling` 例外）。
- 不省略第 8 節的瀏覽器驗收，也不弱化契約測試。

## 10. 需要擁有者回答的事（未決定前，照「預設」做）

| 問題 | 預設（本文件已採用） | 另一個選項 |
|---|---|---|
| 從「我的系統」按「更新到新版／檢查更新」後，要不要直接開始分析？ | **直接分析**（老師已按了更新；步 1 顯示為已完成，`PREFLIGHT` 提示放在步 2 的分析畫面上方） | 先停在步 1 再多按一次「檢查這個專案」（多一次點擊，但「按了才讀取」更保守） |
| 更新失敗後的重試方式 | 回到步 2 並**重新分析** | 留在步 3 重新勾選（遠端狀態可能已變，不建議） |
| 第 6 節標示「新增」的文案 | 照本文件 | 擁有者逐句改字（改字不影響邏輯） |
| 頁尾授權句（公開站 vs 校內） | 沿用 teacher-hub 的「限非營利使用」 | 見 DESIGN_SPEC 第 12 節 |
