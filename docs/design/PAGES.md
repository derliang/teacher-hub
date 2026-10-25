<!--
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
-->
# 頁面清冊與防走樣機制

> 狀態：定案。最後更新：2026-10-25。目的：讓這個網站「每一層、每一頁」都套用同一套設計，新增或改版時不會悄悄走樣。
> 外觀規則見 [DESIGN.md](DESIGN.md)；上架下架見 [../PUBLISHING.md](../PUBLISHING.md)。機器可讀的清冊是 [pages.json](pages.json)，唯一的 token 來源是 [tokens.css](tokens.css)。

## 1. 三道防線

| 防線 | 內容 | 誰執行 |
|---|---|---|
| **登記** | repo 內每個 `.html` 都要登記在 `pages.json`，並對應一張模擬頁。沒登記的頁面檢查直接失敗。 | `scripts/check_design.py` |
| **自動檢查** | tokens 與 `tokens.css` 相同、不寫死色碼、圓角、字型、沒有 emoji、圖片替代文字、頁尾、導覽與麵包屑、計數與版本一致、文字對比 ≥ 4.5:1。 | `python scripts/check_design.py` |
| **人工檢查** | 自動檢查看不到的：實際版面、橫向捲動、三種寬度、鍵盤操作。見第 5 節。 | 做事的人，PR 說明要寫看過什麼 |

**每個改到頁面的 PR 都要先跑 `python scripts/check_design.py`，全部通過才能提 PR。** 不通過就修頁面；真的要偏離，先改 DESIGN.md、`tokens.css` 並取得擁有者同意，不要改檢查來遷就頁面。

## 2. 層級

| 層級 | 說明 | 頁面 |
|---|---|---|
| L0 | 首頁，含兩區（`#usable`、`#gas`） | `index.html` |
| L1 | 站內功能入口與 GAS 工具預覽頁 | `deploy/index.html`（自助部署）、`gas/<工具 id>/index.html`（預覽頁） |
| L2 | 平台內頁 | `deploy/admin/index.html`（部署管理） |
| 外部 | 各工具自己的 GitHub Pages | 不在本站規範內，只管首頁卡片如何連過去 |

自助部署的精靈步驟（開始前、確認、安裝中、完成後設定、更新各步）都在 `deploy/index.html` 同一頁內切換，不是獨立頁面；它們的長相以 `mockups/自助部署.html` 的畫面為準。

## 3. 頁面清冊

| 路徑 | 層級 | 類型 | 狀態 | 模擬頁 |
|---|---|---|---|---|
| `index.html` | L0 | 首頁 | 上線 | `mockups/首頁.html` |
| `deploy/index.html` | L1 | 自助部署（老師端，前端介面） | 上線（閘門網址未設定時只顯示「平台尚未開放」） | `mockups/自助部署.html` |
| `deploy/admin/index.html` | L2 | 部署管理（前端介面） | 上線（同上） | `mockups/部署管理.html` |
| `gas/*/index.html` | L1 | GAS 工具預覽頁（每個候選或施工中的工具一頁） | 規則已定，尚無頁面 | `mockups/GAS工具預覽頁.html` |
| `grade-deploy/index.html` | L1 | 舊連結轉址頁（原平時成績部署原型） | **過渡頁（例外）** | 無 |
| `admin/index.html` | L2 | 管理後台原型 | **舊風格過渡頁（例外）** | 無 |
| `docs/design/mockups/*.html` | — | 模擬頁（只有假資料） | 設計參考 | 本身 |

### 例外：舊風格過渡頁
- `grade-deploy/` 現在只是舊連結的自動轉址頁（原型已由 `deploy/` 取代）；`admin/` 是尚未取代的舊管理後台原型。兩者被列為**例外**，只做最低限度檢查：檔頭版權、返回首頁連結、明確標示「施工中」。
- 到期條件：`grade-deploy/` 在舊連結不再有人使用時刪除；`admin/` 在 `deploy/admin/` 通過真實 Google 驗收並取代它時刪除。刪除時同步移除 `pages.json` 的例外。
- 在到期前，不得再新增新的例外，也不得把例外頁當成新頁面的範本。

## 4. 每一層必備的東西

| 項目 | 首頁 | 自助部署與管理頁 | GAS 工具預覽頁 |
|---|---|---|---|
| 頂端導覽（品牌、區段、目前所在） | 必備，含搜尋 | 必備，「GAS 部署」為目前項目 | 必備，「GAS 部署」為目前項目 |
| 麵包屑（`Teacher Hub 首頁 › …`） | 不需要 | 必備 | 必備 |
| 回上一層的連結 | 不需要 | 麵包屑；精靈有「上一步」 | 頁尾區有「← 返回 GAS 部署區」 |
| 狀態橫幅 | 兩扇門標示「施工中」 | 平台未開放時顯示「平台尚未開放」 | 必備（候選或施工中） |
| 登入、安裝、授權按鈕 | 不適用 | 依平台功能 | **不得有**（見 DESIGN.md） |
| 頁尾（單一版權句、授權連結） | 必備，含首頁版本與日期 | 必備 | 必備 |
| 深色模式、44px 點擊區、焦點框 | 必備 | 必備 | 必備 |

## 5. 人工檢查（自動檢查看不到的）

PR 說明要寫「看過什麼」。至少：
1. 手機 390、iPad 820、桌機 1280 各看一次：沒有橫向捲動、文字沒有被切掉、卡片沒有落單。
2. 淺色與深色各看一次。
3. 只用鍵盤 Tab 走一遍：焦點框看得到、順序合理。
4. 首頁：搜尋兩區都找得到、點每張可點的卡片都到對的地方。
5. 子頁：麵包屑每一層都能回去，「返回首頁」可用。

## 6. 新增、移動、刪除頁面的流程

1. **先登記**：在 `pages.json` 與本文件第 3 節加上這個頁面（路徑、層級、類型、狀態、對應模擬頁）。
2. **先有模擬頁**：新頁面用 `/設計` 在對話中出設計稿，擁有者同意後，把模擬頁存進 `docs/design/mockups/`。
3. **再實作**：只用 `tokens.css` 的 token 與 DESIGN.md 的元件，不複製貼上別頁的 CSS 再改色。
4. **跑檢查**：`python scripts/check_design.py` 全部通過。
5. **人工檢查**（第 5 節），結果寫進 PR 說明。
6. **刪除或搬移頁面**：同步改 `pages.json`、本文件與所有連到它的卡片、麵包屑；到期的例外一併移除。

## 7. 自助部署的前端與後端

`/deploy/` 與 `/deploy/admin/` 是**前端介面**，原始碼就在本 repo（`deploy/`）；它們執行時呼叫的**後端**（授權閘門等）在私人 repo `derliang/gas-deploy-helper`，不公開。分工與本機驗收方法見 [../deploy/README.md](../deploy/README.md)。

- 這些頁面的樣式可以放在外部樣式表（例如 `<link rel="stylesheet" href="assets/app.css">`），`check_design.py` 會讀取頁面引用的本地樣式表並套用同樣的規則；Google Fonts 等外部網址不在檢查範圍。
- 這些頁面**以本 repo 的 DESIGN.md 與 tokens.css 為準**：`deploy/assets/app.css` 的 token 區塊必須與 `tokens.css` 逐字相同，不得保留自己的一套色彩。
- 改動前端後，跑 `python scripts/check_design.py`，以及自助部署前端專用的 `node --test scripts/test_deploy_frontend.mjs scripts/test_wizard_contract.mjs`（舊 class 不殘留、js 不含內聯樣式、id 都存在、不含機密、精靈契約等），通過才可合併。
- 安裝與更新的功能規則、授權與安全邊界由私人 repo 決定；外觀與介面行為由本 repo 決定。
- `deploy/config.json` 的 `gateUrl` 是上線開關：留空時頁面只顯示「平台尚未開放」。填入前必須通過真實 Google 驗收並取得擁有者同意。
- 「push git」與「發佈網頁」的區別不變。

## 8. 檢查項目清單（`check_design.py` 目前會查的）

| 範圍 | 檢查 |
|---|---|
| 全部頁面 | 已登記；`lang="zh-Hant"`、charset、viewport、title；檔頭版權；沒有 iframe |
| 樣式 | `:root` 與兩個深色區塊的 token 與 `tokens.css` 逐一相同；不寫死色碼或色彩函式；圓角 ≤ 4px（圓點 50%）；字型只走 `--serif`、`--sans`、等寬；沒有漸層；`theme-color` 等於 `--bg` |
| 內容 | 沒有 emoji（✓ ✕ 例外）；圖片有替代文字且檔案存在；頁尾剛好一個，版權句剛好一次，有授權說明連結 |
| 首頁 | 頂端導覽、兩扇門、兩區；「立即可用」區只放即開即用與 Beta 且直接連到作者的 GitHub Pages；候選卡是 `<article>` 無連結；施工中卡只連預覽頁、舊原型或 deploy/；狀態標籤文字在規範內；兩扇門、導覽、區段的件數與實際卡片數相符 |
| 版本 | 頁尾版本與 `site.json` 一致；`CHANGELOG.md` 有該版本；`tools.json` 與卡片備援版本一致；`data-tool` 都在 `tools.json` |
| 子頁 | 頂端導覽；麵包屑第一層是「Teacher Hub 首頁」並有 `aria-current="page"` |
| GAS 工具預覽頁 | 沒有按鈕、登入或授權；有候選或施工中橫幅；有「返回 GAS 部署區」 |
| tokens | 淺色與深色下，文字與底色的對比都 ≥ 4.5:1 |
| 例外頁 | 檔頭版權、返回首頁連結、「施工中」標示 |
| 自助部署前端（`node --test scripts/test_deploy_frontend.mjs`） | token 與 `tokens.css` 一致、無寫死色碼／emoji／內聯樣式、舊 class 不殘留、導覽連結、`$('#id')` 都存在、`stepList` 行為、不含機密 |
| 精靈契約（`node --test scripts/test_wizard_contract.mjs`） | 精靈開始實作後，強制檢查 `docs/deploy/WIZARD_SPEC.md` 的硬性規則 |

要加檢查項目時，連同本表一起更新。
