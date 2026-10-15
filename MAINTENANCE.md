# Teacher Hub 交接與維護規範
版本：1.0｜建立日期：2026-10-15

## 1. 專案目的與收錄範圍（不得擅自擴大）
本專案**僅用來展示作者自己開發、已公開、能在 GitHub Pages 直接操作的小程式**。不是全 GitHub 專案索引、教學資源平台或課程系統。

已核准、現階段僅收錄：
1. 座位小幫手 https://derliang.github.io/seat-helper/
2. 掃地工作小幫手 https://derliang.github.io/cleaning-helper/
3. 段考小幫手 https://derliang.github.io/exam-helper-clock/

**不加入** `grad-check`（使用者明確排除）、任何私人或尚未公開專案、需要 GAS 部署的系統、測試程式。不得因搜尋到其他 Repository 而自行上架；新增須經專案擁有者同意。

## 2. 卡片導覽硬性要求
整張卡片（縮圖、名稱、介紹、底部提示）就是一個可點擊連結，點選後**直接開啟原程式的 GitHub Pages 操作網址**。不可連到 `github.com` 程式碼頁、README、中介介紹頁，也不可讓使用者再按第二次「開啟工具」。預設同一分頁直接導覽，使用者可透過瀏覽器返回。不要使用 iframe，也不要搬移或重新部署原工具程式。三個工具獨立更新，入口只管理卡片與連結。

## 3. 既有設計與功能
保留目前首頁的文案、配色、卡片縮圖與說明、搜尋、手機與桌機響應式排版，以及現有三個連結。不經同意不得刪減功能、更換設計風格、擴大網站定位。圖片不得含真實學生個資。

## 4. 首頁版本號與更新日期
- 頁尾固定顯示「首頁版本 vX.Y.Z｜更新日期 YYYY-MM-DD」。
- `site.json` 的 `version`、`updated` 是維護資訊的唯一來源；首頁會讀取，讀取失敗時使用 HTML 內與 `site.json` 同步的備援文字。
- 顯示的是 **Teacher Hub 首頁的發布版本及日期**，不是各工具的版本；工具本身更新不會讓首頁日期自動改變。
- 功能／工具新增升 MINOR，Bug／文案修正升 PATCH，不相容結構大改版升 MAJOR；依 SemVer 表示。
- 每次發布同步修改 `site.json`、`CHANGELOG.md`，並讓 HTML 備援文字一致；日期使用台灣日期，不使用使用者瀏覽器當日日期偽裝更新日。
- 更新日期只能對應實際發布變更；不得因為重新整理網站就改變日期。

## 5. 新工具上架標準程序
1. 確認擁有者指定並允許收錄該工具，且原 Repo 已公開、GitHub Pages 有實際可操作的正式頁面。
2. 親自驗證正式網址；不得用 Repo URL 代替，也不能僅憑 `index.html` 存在宣稱已發布。
3. 在 `index.html` 依既有樣式增加一張 **整張都是 `<a href>`** 的卡片，介紹須與原程式一致。
4. 讓搜尋可找到新增卡片；核對卡片數量與所有工具連結，測試電腦及手機版。
5. 版本號依第 4 節遞增；同步更新 `site.json`、`CHANGELOG.md` 及 HTML 備援版本文字。
6. **保留原文和已確認功能**，有其他建議先提出供擁有者審核，未核准不合併。保留歷史 commit，避免覆蓋他人更動。
7. 經審核後合併到 `main`，再確認 GitHub Pages 已發布、首頁能開啟、全部卡片能使用。提交成功不等於 Pages 部署成功。

## 6. 發布前檢查清單
- [ ] 只收錄已核准的三項或擁有者後續核准的新增工具。
- [ ] 不包含 `grad-check`、私人、GAS 或測試專案。
- [ ] 每張卡片點擊一次就進入 GitHub Pages 操作畫面（不是程式碼頁）。
- [ ] 三個既有工具及搜尋功能沒有退化。
- [ ] 桌機／手機正常、無錯誤連結。
- [ ] `site.json`、首頁備援文字及 `CHANGELOG.md` 版本一致。
- [ ] GitHub Pages 實際發布驗證完成，才對外說成功上線。

## 7. 接手入口
- 專案： https://github.com/derliang/teacher-hub
- 頁面： https://derliang.github.io/teacher-hub/
- GitHub Pages：Settings → Pages → Deploy from a branch → main / (root)

**給 AI／協作者：作業前先讀本規範，任何超出原則的調整須先取得擁有者同意。**

## 8. 每張工具卡片的最新版號與發布日期（2026-10-15 起）
- **每張卡片**必須顯示「v版本號｜發布：YYYY-MM-DD」，指該工具本身最近一次正式發布，不是 Teacher Hub 的發布日期。
- `tools.json` 是各工具版本資訊的唯一來源；`index.html` 每張卡片保留對應的備援文字。修改時兩者須一致。
- 來源優先順序：正式版程式的集中版號／版本日期常數，其次該 Repo 的可靠發布紀錄（Release、Tag、README 版本日及與版本發布相符的 commit）。**GitHub 最近 commit 日期不一定是發布日**，不得直接冒充。
- 部分程式的 HTML `<title>` 可能與版本常數不同步（段考小幫手曾因此停在 v2.22.1，已於 v2.28.3 改為由 `APP_VERSION` 產生）；一律以程式的版本常數為準，不看靜態標題。
- 每次原工具正式發版後，接手者核對公開版與 GitHub 原始碼、確認版本日期，再更新 `tools.json` 與 HTML 備援文字；若缺少可靠日期，先查證，**不得填今天日期或憑空推測**。
- 工具版本資訊更新不改變其他卡片，也不代表入口網站功能改版；但入口網站本身有提交變更時，仍應按照第 4 節更新首頁版號、更新紀錄與日期。
- 新增工具也必須新增其版本資料；未確認版本或日期時，先維持不上架狀態供審核。不得以版本資訊需求為由修改原工具 Repo。

## 9. GitHub Actions 自動同步（2026-10-15 新增）
- Workflow：`.github/workflows/sync-tool-releases.yml`，排程每天 **臺灣時間 09:17**，也可在 Actions 頁面點 **Sync tool releases → Run workflow** 手動執行。
- 同步程式：`scripts/sync_tool_releases.py`，僅能讀取三個已核准的公開 Repo：`seat-helper`、`cleaning-helper`、`exam-helper-clock`。不得從所有 Repository 自動發現並上架。
- 座位小幫手以 `index.html` 的 `APP_VERSION`（不再讀 `<title>`，2026-10-15 起）和 README 內同版號日期交叉確認；掃地小幫手以 HTML 版號和吻合同一版號的發布提交日期確認；段考小幫手以 `APP_VERSION` 和 `APP_DATE` 確認，不能取過期的 HTML title。
- **沒有可靠資訊即不更新**，任何一個工具的版本查證失敗時，整批不寫入；不得以檢查日期或任意 commit 日期代替。拒絕上游版本倒退、拒絕新增未核准工具。
- 只有真的偵測到新版，才更新 `tools.json` 與 HTML 備援內容、由 `github-actions[bot]` 提交；不修改工具程式、不修改卡片連結、不自動變更首頁本身的 v1.x 版號。
- 若 GitHub Actions 回報沒有寫入權限，請到 Repository → Settings → Actions → General → Workflow permissions 選擇 **Read and write permissions**；如組織政策禁止，需由管理員協助。不放個人存取 Token 在程式碼中。
- 檢查失敗請在 GitHub → Actions → Sync tool releases 查看日誌；修復原始版本資料或同步腳本後重新執行，勿硬填資料。新工具需擁有者先核准，再由維護者有意識地擴充白名單與驗證策略。
- GitHub Actions 的 `schedule` 可能略微延遲；靜態網頁沒有即時推播，每日同步是定期檢查，不是發布瞬間就同步。

## 10. 第四張施工中卡片與特別授權（2026-10-15）
- 使用者已明確核准第四張「平時成績小幫手」，連結本站 `/grade-deploy/`，僅為標示「🚧 施工中」的自助部署原型，不代表程式已可安裝／更新。
- 桌面首頁每行**最多三張卡片**；平板最多二張，手機一張。保留前三張既有功能與連結。
- 第四張是前述「只收錄正式公開小工具」規則的**具體例外**，不得因此擴大其他未核准項目；前三張工具的版本追蹤白名單維持不變。
- 自助部署前端原始碼、規格、測試與後端在私人 `derliang/gas-deploy-helper`；這裡只放公開靜態前台。
- 使用者說 **push git** 預設是提交私人 `gas-deploy-helper`；說 **發佈網頁** 才是更新公開 `teacher-hub`。接手前請讀私人 repo 的 `AGENTS.md`。
- 本施工頁沒有可確認的平時成績小幫手正式版本與發布日，不可虛構。
