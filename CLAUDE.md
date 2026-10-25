# Teacher Hub 專案指引

開始任何工作前先讀 [MAINTENANCE.md](MAINTENANCE.md)（交接、授權、版權、自動同步規則）。超出其中原則的調整，須先取得擁有者（derliang）同意。

## 設計規範（改頁面前必讀）

- 本專案的設計規範在 [docs/design/DESIGN.md](docs/design/DESIGN.md)，定案的模擬頁在 `docs/design/mockups/`。一切頁面、版面、元件、樣式的工作以它為準。
- 新增、改版、調整任何頁面前，先讀它。沿用其中的 tokens 與元件規則，不寫死色碼與間距。
- 新頁面或大改版使用 `設計` 技能（輸入 `/設計`）：先在對話中出設計稿給使用者確認，定案後把規範與模擬頁更新回 `docs/design/`，和程式放在同一個 PR。
- 要偏離規範，先更新 DESIGN.md 並取得使用者確認，不要只改程式。

## 工具上架與下架

- 上架、改狀態、下架的唯一流程在 [docs/PUBLISHING.md](docs/PUBLISHING.md)。先分區（「立即可用」或「GAS 部署」），再照該區的檢查清單做。
- 沒有擁有者在對話中明確同意，不得上架、改狀態或下架任何工具；不得因為搜尋到某個 repo 就自行收錄。
- 上架前先問「使用者是一個人還是一群人」；多人同時使用的工具沒有後端，不得上架。
- 每次發布同步 `site.json`、`CHANGELOG.md` 與 `index.html` 備援版本文字；工具版本以 `tools.json` 為唯一來源。

## 兩個容易混淆的指令

- 說「push git」：指私人 repo `derliang/gas-deploy-helper` 的提交，不是這個 repo。
- 說「發佈網頁」：才是更新這個公開 repo（GitHub Pages）。合併 `main` 前仍要先確認，並驗證 Pages 已發布。

## 不可動的東西

- 頁尾單一版權句、授權連結、`LICENSE.md`（MAINTENANCE 第 18 節）。
- 卡片整張可點、一次點擊直接開啟、不用 iframe（MAINTENANCE 第 2 節）。
- 圖片不得含真實學生個資；公開檔案不得含 token、密鑰或教師名單。
