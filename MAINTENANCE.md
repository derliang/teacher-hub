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
