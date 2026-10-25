<!--
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
-->
# 自助部署前端｜設計規範與實作指引

> 狀態：定案（2026-10-25，擁有者已選定方案 2B 精靈式；同日裁示前端原始碼放在本 repo）。適用：`deploy/` 的老師頁（`/deploy/`）與管理頁（`/deploy/admin/`）。
> 目的：之後的實作一律照這份做，不重工，也不讓網站走樣。**這份只管外觀、版面、導覽與前台互動結構；安裝與更新的功能規則、授權、安全邊界在私人 repo（`AGENTS.md`、`SELF_SERVICE_SPEC_V1.md`、`GATE_ARCHITECTURE.md`），分工見 [README.md](README.md)。**
> **實作進度**：階段 1（樣式換 token、頁面骨架、移除 emoji、設計測試）已完成，老師頁的安裝與更新流程**仍是舊的單頁流程**；精靈（第 5 節）**尚未實作**，實作規則見 [WIZARD_SPEC.md](WIZARD_SPEC.md)。

## 0. 開工前先讀（順序）

1. [../../CLAUDE.md](../../CLAUDE.md)（「push git」與「發佈網頁」是兩件事；自助部署前端的規則）。
2. [README.md](README.md)：前端與後端的分工。
3. 本文件。
4. `docs/design/mockups/自助部署.html`、`部署管理.html`：用瀏覽器直接開，拉寬窄視窗看手機、iPad、桌機。**畫面長相以它們為準。**
5. `docs/design/tokens.css`：所有顏色與字型。
6. `docs/design/DESIGN.md`、`docs/design/PAGES.md`：完整規範。
7. 要做精靈：[WIZARD_SPEC.md](WIZARD_SPEC.md)。

## 1. 誰說了算

| 事項 | 權威 | 說明 |
|---|---|---|
| 外觀：色彩、字型、間距、元件、斷點、導覽、頁面層級、文案語氣 | 本 repo 的 `docs/design/` | 前端與外觀規範在同一個 repo，沒有快照要同步 |
| 功能：安裝與更新規則、授權、安全、資料邊界、錯誤碼、文字內容 | 私人 repo `gas-deploy-helper` | 外觀改版不得改變這些 |
| 兩者衝突 | 外觀依本 repo，功能依私人 repo | 要偏離外觀：先更新 `docs/design/DESIGN.md` 並取得擁有者同意，**不要只改程式** |

## 2. 範圍

**要改（只動外觀與前台結構）**：`deploy/index.html`、`deploy/admin/index.html`、`deploy/assets/app.css`，以及 `teacher.js`、`admin.js`、`ui.js` 裡產生 HTML 的部分（class、結構、標示用的 emoji）。

**不能動**：`engine.js`、`core.js`、`gs-check.js` 的邏輯；錯誤碼與錯誤訊息文字；私人 repo 的後端、本機管理台與舊原型。

**文字原則**：現有文案（會做／不會做、確認句、錯誤訊息、安裝完成後的步驟）原樣保留，只拿掉當標示用的 emoji（見 4.3）。

## 3. 必做畫面對照表

以下畫面都有模擬頁，實作必須逐一做到；模擬頁沒有的狀態，沿用元件並照第 7 節回報。

### 老師頁（`/deploy/`，模擬頁 `自助部署.html`，畫面標題即下列名稱）

| 畫面 | 觸發（現有程式） |
|---|---|
| 平台尚未開放（後端未設定） | `boot()` 丟 `NOT_READY` |
| 登入前（會做／不會做、登入） | `signIn` 顯示 Google 登入 |
| 登入後但沒有任何授權 | `renderProducts()` 的無授權分支 |
| 我的系統（產品卡、已安裝清單：有新版、安裝未完成） | `renderProducts()`、`productCard()` |
| 首次安裝 第 1 步：開始前 | `openInstall()` 前半（提示開啟 Apps Script API、專案名稱） |
| 首次安裝 第 2 步：確認 | `openInstall()` 後半（kv、勾選確認、重複安裝勾選） |
| 首次安裝 第 3 步：安裝中、失敗時 | `doInstall()` 的 `stepList` |
| 首次安裝 第 4 步：完成後設定 | `doInstall()` 成功後的結果與 `setupSteps` |
| 更新 第 1 步：選擇專案 | `openUpdate()` |
| 更新 第 2 步：檢查結果 | `doAnalyze()`、`renderAnalysis()`（含多部署選擇、阻擋、警示） |
| 更新 第 3 步：確認更新（按下開始後） | `renderAnalysis()` 的確認勾選與 `doUpdate()` |
| 更新 第 4 步：完成 | `doUpdate()` 成功後 |

### 管理頁（`/deploy/admin/`，模擬頁 `部署管理.html`）

| 畫面 | 說明 |
|---|---|
| 教師授權 | 新增或批次匯入、教師名單表格（帳號綁定、狀態、逐產品勾選） |
| 正式版審核 | 從 GitHub 匯入、版本清單、檢查並審核、資料遷移表態、核准或退回 |
| 部署紀錄、稽核紀錄 | **沒有模擬頁**：沿用 `.tw` 表格元件與 `.atabs` 分頁，欄位維持現有 |
| 非管理員登入被拒 | **沒有模擬頁**：一則 bad 訊息，不顯示分頁 |

## 4. 外觀對照（舊 → 新）

### 4.1 頁面骨架

| 現在 | 改成 |
|---|---|
| `header.top` 含 `.brand`、`.brand-icon`（✦）、`.nav-home`、`.who` | `nav.nav` > `.wrap`：品牌（`.mark` 深色方塊加襯線 T，文字「Teacher Hub／教師小幫手」連到 `../`）、`.links`（「立即可用」連 `../#usable`、「GAS 部署」連 `../#gas` 並加 `aria-current`）、已登入時 `.acct`（Email 加「登出」`.lo`）。手機另有 `.tabs` 兩段切換。**不再有獨立的「返回首頁」按鈕**，回首頁由品牌、麵包屑與導覽負責 |
| `.trail` | `nav.crumbs`（`aria-label="所在位置"`）：`Teacher Hub 首頁 › GAS 部署 › 自助部署`（精靈內再加 `› 首次安裝` 或 `› 更新`）；最後一項 `<b aria-current="page">`。管理頁為 `Teacher Hub 首頁 › GAS 部署 › 部署平台管理`，其連結為 `../../` |
| `.eyebrow` + `h1` + `p` | `.pagehead`：`.kicker`（黃銅小標）、`h1`（襯線）、`p` |
| `main` | `.wrap.narrow`（老師頁，最大 960px）；管理頁用 `.wrap` |
| `footer` | `footer.foot-site`：品牌句、`首頁版本` 不放（只有首頁有）、**單一版權句** `© 2026 derliang｜保留所有權利｜限非營利使用｜授權說明`（連到 本 repo 的 `LICENSE.md`）、「回到頂端」；現有的平台說明句保留為一行 |
| 檔頭 | 兩個 html 最前面加版權註解（`Copyright (c) 2026 derliang. All rights reserved.` 等，格式照 本 repo 的 `index.html`）；保留 `referrer no-referrer`，管理頁保留 `robots noindex` |
| `theme-color` | 兩個 meta：淺色 `#f2f0ea`、深色 `#0c1524`（等於 `--bg`） |
| 深色模式 | 依 `prefers-color-scheme` 自動切換；只用 token，不在 JS 或 HTML 裡寫色碼 |

### 4.2 元件

| 現在的 class | 改成 | 備註 |
|---|---|---|
| `.panel` | `.panel` | 紙面底、1px 外框、4px 圓角、**不加陰影** |
| `.does` | `.does` | 兩個面板；清單項前用 `✓`／`✕`（CSS 產生），不用 emoji |
| `.notice.info/.warn/.bad/.ok` | 同名 | 底色與文字走 `--chip-live-*`、`--brass-*`、`--bad-*`、`--ok-*` |
| `button`、`.btn` | `.btn` | 實心主色；44px 高 |
| `.ghost` | `.btn.ghost` | 透明底、主色字、細外框 |
| `.small` | `.btn.sm` | **仍是 44px 高**（現在的 34px 要改），只縮字級與左右留白 |
| `.danger` | `.btn.danger` | 透明底、`--bad` 字與外框，不用實心紅 |
| `.badge`（藍） | `.st.st-live` | |
| `.badge.ok` | `.st.st-ok` | |
| `.badge.warn` | `.st.st-wip` | 黃銅淡底 |
| `.badge.bad` | `.st.st-bad` | |
| `.badge.gray` | `.st.st-gray` | 細外框、灰字 |
| `.list` + `.item` | `.deps` + `.dep` | 已安裝清單；版本清單用 `.rel` |
| `.item.sel`（多部署選擇） | `.radios` 的 `label` | 選擇時外框用 `--brass-line` |
| `.row`（按鈕列） | `.btns` | |
| `.kv`、`.mono`、`.url` | `.kv`、`.mono` | 網址一律 `.mono` 並可換行 |
| `.steps` + `.dot`（`stepList`） | `ol.prog` > `li.done／.run／.fail` > `.d` | `ui.js` 的 `stepList(container, keys)` 介面不變，只換產出的 HTML；失敗是 `.fail`（紅圈、紅粗體） |
| `.tabs button[aria-selected]`（管理頁） | `.atabs` | 手機可橫向捲動 |
| `.table-wrap` + `table` | `.tw` + `table` | 最小寬 600px，在自己的容器內橫向捲動 |
| `label.field`、`input`、`textarea` | `.lbl`、`.inp` | 46px 高 |
| `.check` | `.chk` | 勾選框 22px，`accent-color: var(--primary)` |
| `.product` + `.icon`（📊） | `.prod` + `<img>` | 見 4.3 |
| `.grid2` | `.does` 或 `.opts` | |
| `.hidden` | `[hidden]` 或保留 `.hidden` | 行為不變 |
| （新增）狀態橫幅 | `.banner` | 只在「施工中」類頁面使用；老師頁不需要 |

### 4.3 要拿掉的 emoji 與符號（標示用的，位置已清查）

| 位置 | 現在 | 改成 |
|---|---|---|
| `teacher.js`、`admin.js` 的「平台尚未開放」「平台尚未完成設定」提示 | 🚧 | 拿掉，標題文字「平台尚未開放」保留 |
| `teacher.js` 安裝完成訊息 | 🎉 | 拿掉，「安裝完成！」保留 |
| `teacher.js` 更新完成訊息 | ✅ | 拿掉，「更新完成：…」保留 |
| `teacher.js` 產品卡 | 📊 方塊 | 改為產品插畫（4.4） |
| `index.html` 「會做／不會做」標題 | ✅、🚫 | 拿掉，由 `✓`／`✕` 清單標記取代 |
| `.brand-icon` | ✦ | `.mark` 的襯線 T |

### 4.4 產品插畫

產品卡（`.prod`）使用該產品在首頁的同一張插畫，發布後路徑為 `../images/cards/<檔名>.svg`。前台用一個小對照表（例如 `PRODUCT_ART = { 'pingshi-grade-helper': 'grade' }`），**沒有對應就不顯示縮圖，不用 emoji 或符號代替**。縮圖是裝飾，載入失敗要自動隱藏（`onerror` 設 `hidden`），本機預覽時沒有圖片也不能破版。

### 4.5 階段 1 新增的版面輔助 class（取代原本散在程式裡的內聯樣式）

這些只負責排版間距，不帶顏色或新外觀；先在這裡登記，擁有者可在第 12 節否決或改名。

| class | 用途 |
|---|---|
| `.stack`、`.vstack` | 頁面主區塊／一組面板的垂直間距（16px） |
| `.slot` | 流程裡由程式填入內容的容器（`#analysis`、`#installSteps`…），內部垂直間距 14px；**空的時候自動隱藏** |
| `.checks` | 一排勾選項（管理頁「開放的系統」） |
| `.mig` | 管理頁審核的「資料遷移」欄位組（`fieldset`） |
| `.relhead` | 版本清單每一列的標題列（標籤與按鈕左右分開） |
| `.u` | 已安裝清單中的網址列 |
| `.noart`（加在 `.prod`） | 該產品沒有插畫或插畫載入失敗時，收掉縮圖欄 |
| `.em`（在 `.acct` 內） | 導覽列的 Email，窄螢幕可換行 |

另一處與模擬頁**刻意不同**：`.does li` 改用 grid，並把文字包進一個 `<span>`。模擬頁用 flex，句子中間的粗體（`<b>`）會變成獨立的欄位而被拆開（「網址不變」跑到右邊）；實測發現後在這裡修掉。同樣的缺陷也在 teacher-hub 的模擬頁，見第 12 節。

## 5. 精靈（方案 2B）的結構

> **實作規則（狀態機、DOM 約定、CSS、無障礙、測試、驗收）見 [WIZARD_SPEC.md](WIZARD_SPEC.md)；下面是每一步的內容。**

**原則：保留現有函式與語意，只改成一次一步。** 下面列出每一步用到的現有函式，改動限於「顯示哪一段 HTML」。

### 首次安裝（四步）

| 步 | 內容 | 現有程式 | 要求 |
|---|---|---|---|
| ① 開始前 | 提示開啟 Apps Script API、輸入專案名稱 | `openInstall()` 前半、`PREFLIGHT` | 接續安裝（`resume`）時略過名稱，顯示「會接續上次已建立的專案」 |
| ② 確認 | kv（帳號、版本、網頁存取設定、將會產生）、確認勾選；已安裝過時另有「仍要另外再安裝一份」勾選 | `openInstall()` 後半 | 兩個勾選沒勾齊，「開始安裝」不可按；**按下後勾選與按鈕立即作廢** |
| ③ 安裝中 | 進度列表 | `doInstall()`、`stepList` | 不可返回、不可取消；`beforeunload` 防呆保留；失敗停在失敗那一步，其餘維持等待，顯示 `errorHtml()`，並提示「要重試請重新勾選確認；已經建立的專案會被接續使用，不會多建一份」，提供回到 ② 的按鈕（勾選歸零） |
| ④ 完成後設定 | 完成訊息、編輯器連結、系統網址、`setupSteps` 清單、403 說明 | `doInstall()` 成功分支 | 「回到我的系統」呼叫 `loadMe()`；`setupSteps` 用 `.todo` 編號清單 |

### 更新（四步）

| 步 | 內容 | 現有程式 | 要求 |
|---|---|---|---|
| ① 選擇專案 | 從「我的系統」進來時略過；「更新其他既有的 GAS」要貼編輯器網址或專案 ID | `openUpdate()`、`parseScriptIdInput` | 按鈕文字維持「檢查這個專案（不會修改任何東西）」；這一步**零寫入** |
| ② 檢查結果 | kv、多部署選擇、阻擋、警示、資料遷移說明 | `doAnalyze()`、`renderAnalysis()` | 有阻擋條件時停在這一步，不顯示「下一步」；已是最新版時顯示 ok 訊息，不顯示「下一步」 |
| ③ 確認更新 | 確認勾選、開始更新、進度列表 | `renderAnalysis()` 的 `updateOk`、`doUpdate()` | 同安裝：沒勾不可按、按下後作廢、執行中不可返回 |
| ④ 完成 | 更新完成訊息、網址未變、GAS 版本 #前 → #後、提醒打開網址確認 | `doUpdate()` 成功分支 | 「回到我的系統」呼叫 `loadMe()` |

### 不可破壞的行為（現有程式與測試已鎖住的事）

1. `setBusy()`：執行中鎖住操作鈕，結束時**只還原這次被鎖住的按鈕**，不可把「尚未勾選確認的開始鈕」一起解鎖（瀏覽器實測抓過）。
2. 確認勾選每次歸零；成功後不可再按一次（會多建一份）；失敗要重新勾選才能重試。
3. 更新分析階段零寫入；寫入前重讀內容雜湊與部署狀態，不同就停（`REMOTE_CHANGED`）。
4. 登入過期時 `errorHtml()` 顯示「重新登入」鈕。
5. `?product=` 參數、授權過濾（只顯示被授權的產品）、`NOT_READY` 與無授權的訊息文字。
6. 導覽與麵包屑的「上一層」永遠可用，**執行中除外**（執行中離開要有 `beforeunload` 提醒）。

## 6. 版面、斷點與無障礙（摘要，完整見 本 repo 的 DESIGN.md）

- 斷點：手機 < 600、平板 600–1023、桌機 ≥ 1024；精靈左軌在寬度 ≥ 760 顯示，否則改頂部進度條。
- 左右留白 20／36／48px；內容最大 960px（老師頁）／1160px（管理頁）。不得出現橫向捲動，只有表格可在自己的容器內橫向捲動。
- 文字對比 ≥ 4.5:1（淺深色都要）；點擊區 ≥ 44px；焦點框 2px `--brass-line`；整頁只用 `--serif`、`--sans`、等寬三種字型，皆走 token。
- 圓角只有 3px（按鈕、輸入）與 4px（面板），圓點可用 50%；不用漸層、不用陰影（卡片 hover 例外且前台沒有可點卡片）。
- 動態：`prefers-reduced-motion` 時關閉；進度「進行中」的閃爍動畫可以保留但要在此設定下關閉。

## 7. 沒有模擬頁的狀態怎麼辦

遇到模擬頁沒涵蓋的畫面（例如新的錯誤情境、管理頁的紀錄分頁細節）：
1. 先沿用第 4.2 的元件，不要自創新元件或新顏色。
2. 實在需要新元件：**先到 teacher-hub 更新 `DESIGN.md` 與模擬頁並取得擁有者同意**，合併後依第 8 節同步，再實作。
3. 在 PR 說明寫出「用了哪個現有元件替代」或「已向 teacher-hub 提出新增」。

## 8. 設計快照（已不需要）

前端與設計規範現在在同一個 repo：`deploy/assets/app.css` 的 token 區塊直接與 `docs/design/tokens.css` 比對（`scripts/check_design.py` 與 `scripts/test_deploy_frontend.mjs` 都會查），不再有快照與同步腳本。要改 token：先改 `docs/design/tokens.css` 並取得擁有者同意，再同步改 `app.css`。

## 9. 實作時要一併完成的測試（驗收的一部分）

新增 `scripts/test_deploy_frontend.mjs`（比照既有的 parity 測試），至少檢查 `deploy/` 下所有 html、css、js：

1. `assets/app.css` 的 `:root`、深色 media、深色 `data-theme` 三個區塊，宣告的 token 與 `docs/design/tokens.css` 逐一相同，沒有多出規範沒有的 token。
2. 沒有寫死色碼（`#rrggbb`、`rgb(`、`hsl(`、`oklch(`），包含 html 內聯 `style` 與 js 產生的 HTML 字串；`theme-color` meta 例外且必須等於 `--bg`。
3. `border-radius` 不超過 4px（圓點可用 50%）；沒有漸層；`font-family` 只走 `var(--serif)`、`var(--sans)`、等寬字型。
4. 沒有標示用的 emoji（`✓`、`✕` 例外）。
5. 每個 html 有 `lang="zh-Hant"`、viewport、`<title>`、檔頭版權註解、`nav.nav`、`nav.crumbs`（含 `aria-current="page"`）、單一 `footer`。
6. `stepList` 產出 `ol.prog`，狀態 class 只有 `done`、`run`、`fail`。

這個測試要在**第一次改樣式時就加入**（先紅後綠）。

> 已實作：`scripts/test_deploy_frontend.mjs`（16 項，涵蓋上面 1～6，另加舊 class 不殘留、js 不含內聯 style、`$('#id')` 取用的元素都存在、44px 與 reduced-motion、`deploy/` 不含機密）。emoji 檢查只看畫面會出現的字串，**不含程式註解**（`gs-check.js` 要與本機版逐字相同，不能為此修改）；頁尾的 `©` 與 `✓`、`✕` 放行。

## 10. 上線前的驗收順序

1. 本機：`python scripts/check_design.py`、`python scripts/test_check_design.py`、`node --test scripts/test_deploy_frontend.mjs scripts/test_wizard_contract.mjs` 全部通過。
2. 假閘門：`node scripts/dev/fake-gate.mjs`，逐一看第 3 節每個畫面：手機 390、iPad 820、桌機 1280、淺色與深色，沒有橫向捲動（情境切換見該檔檔頭）。
3. 真實 Google 驗收（私人 repo 的 `SETUP_GUIDE.md` 第 D 節）通過，才由擁有者決定填入 `deploy/config.json` 的 `gateUrl`（上線開關；留空時頁面只顯示「平台尚未開放」）。
4. 首頁「平時成績小幫手」卡片目前連 `deploy/?product=pingshi-grade-helper` 並標「施工中・可預覽」；驗收通過後才改標「即開即用」，並刪除舊過渡頁（PAGES.md 第 3 節）。
5. **擁有者說「發佈網頁」才合併到 `main`**；合併後驗證 GitHub Pages 已發布。

## 11. 不要做的事

- 不改引擎、閘門、錯誤碼與錯誤訊息文字；不為了好看改變安裝與更新的規則。
- 不在 `deploy/` 另外發明顏色、字型、圓角或元件；不複製 teacher-hub 其他頁面的 CSS 再改色。
- 不用 emoji 當標示；不替未驗收的功能做出「可以用」的樣子（平台未開放時一律顯示「平台尚未開放」）。
- 不直接編輯 `docs/design/`（快照）。
- 不在 `prototype/self-service/` 上做新設計。
- 不把真實 Email、教師名單或 token 放進任何公開檔案或模擬頁。

## 12. 待擁有者確認

1. **頁尾授權句**：公開站頁尾一律用本站的「© 2026 derliang｜保留所有權利｜限非營利使用｜授權說明」（連到本 repo 的 `LICENSE.md`）。私人 repo 的 `COPYRIGHT.md` 寫的是聖功女中校內使用，範圍不同；若擁有者要改公開站的句子，請明說。
2. 管理頁「部署紀錄」「稽核紀錄」是否需要另做模擬頁（目前沿用表格元件）。
3. 第 4.5 節的版面輔助 class 是否接受（它們只管間距，不含顏色）。
4. ~~模擬頁 `.does li` 排版缺陷（句中粗體被拆成獨立欄位）~~：已於 v1.13.0 在模擬頁與 `deploy/` 修正（改用 grid 並把文字包進 `<span>`）。
5. 手機上登入後的頂端導覽有三列（品牌、Email／登出、兩段切換）且固定在頂端，約佔畫面高度 19%。目前照規範做；若覺得太擠，可改為只在 ≥ 600px 固定、手機隨頁捲動（需先改 teacher-hub 的規範）。

## 13. 決策紀錄

| 日期 | 決定 | 原因 |
|---|---|---|
| 2026-10-25 | 自助部署採方案 2B 精靈式；外觀以 本 repo 的 DESIGN.md 為準 | 老師非技術人員，一頁一件事降低出錯；整站一致 |
| 2026-10-25 | （已被本表最後一列取代）曾經在私人 repo 保存設計快照與同步腳本 | 前端搬進本 repo 後不再需要 |
| 2026-10-25 | 實作時同步新增 `selfservice-design` 測試 | 讓走樣在發布前就被擋下，不靠人記得 |
| 2026-10-25 | 實作分兩階段：先做低風險的樣式、骨架、emoji、設計測試（不動流程邏輯）；精靈另寫 `WIZARD_SPEC.md` 規範，由實作端照做 | 精靈會動到安裝與更新流程，而老師頁邏輯幾乎沒有自動測試；先把規則與測試寫清楚再動程式 |
| 2026-10-25 | `WIZARD_SPEC.md` 經乾淨上下文代理試讀後重寫（補流程資料、`leave`／`analyze` 事件、重畫與忙碌的單一規則、每步文案、可執行的驗收）；新增 `scripts/test_wizard_contract.mjs`，精靈開始實作後強制檢查規範的硬性規則；`AGENTS.md` 必讀清單加入 WIZARD_SPEC | 規範只靠文件指引沒有強制力；試讀找出 6 處高嚴重度的矛盾與缺漏，若留到實作時才發現會變成各自猜測 |
| 2026-10-25 | 新增 `scripts/dev/fake-gate.mjs`（假閘門＋假 Google 登入，只在本機用） | 沒有真實 Google 也能在瀏覽器驗收畫面與流程；放在 `scripts/dev/`，不屬於 `deploy/` |
| 2026-10-25 | 前端原始碼搬到本 repo 的 `deploy/`；設計快照與同步腳本不再需要（擁有者裁示：teacher-hub 是前端、私人 repo 是後端） | 使用者看到的介面與規範在同一個 repo，避免「發布輸出」與快照造成的走樣與誤會 |
