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
> **2026-10-25 更新**：擁有者已同意整體改版，視覺與版面以 [docs/design/DESIGN.md](docs/design/DESIGN.md) 為準，見第 19 節。下文的功能保留要求（卡片整張可點、搜尋、版本同步等）仍然有效。

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
- [ ] 多人同時使用的工具已有 GAS 或線上資料庫後端（第 17 節）。
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
- 新增工具上架時，同時：① 在 `tools.json` 加一筆（`id`、`version`、`releaseDate`、`source` 為 `https://github.com/derliang/<repo>`、`versionJson` 為 `https://derliang.github.io/<repo>/version.json`，需為本人帳號下的網址）；② 卡片 `.app-meta` 加 `data-tool="<id>"`。通用規則：版號讀 `version.json`，發布日取「第一個把 version.json 改成現版」的提交的台灣日期。若新工具沒有 `version.json`，須先經擁有者同意擴充腳本，否則該工具同步會失敗（不影響其他工具）。
- 新增工具也必須新增其版本資料；未確認版本或日期時，先維持不上架狀態供審核。不得以版本資訊需求為由修改原工具 Repo。

## 9. GitHub Actions 自動同步（2026-10-15 新增）
- Workflow：`.github/workflows/sync-tool-releases.yml`，排程**每 3 小時**一次（臺灣時間 01:17、04:17、07:17、10:17、13:17、16:17、19:17、22:17；2026-10-18 由每日一次改為每 3 小時），也可在 Actions 頁面點 **Sync tool releases → Run workflow** 手動執行。
- 同步程式：`scripts/sync_tool_releases.py`，同步名單就是 `tools.json` 內的工具（2026-10-19 起；原先寫死三個）。**規則：工具經擁有者核准上架時，必須同時加入 `tools.json` 並納入自動同步**，不得從所有 Repository 自動發現並上架。目前名單：`seat-helper`、`cleaning-helper`、`exam-helper-clock`（各有專用版本規則），以及 `teacher-notes-web`（老師隨手記，通用規則）。（`lunch-helper-web` 於 2026-10-24 上架當天即下架，見第 17 節。）
- 座位小幫手以 `index.html` 的 `APP_VERSION`（不再讀 `<title>`，2026-10-15 起）和 README 內同版號日期交叉確認；掃地小幫手以 HTML 版號和吻合同一版號的發布提交日期確認；段考小幫手以 `APP_VERSION` 和 `APP_DATE` 確認，不能取過期的 HTML title。
- **沒有可靠資訊即不更新**，某個工具的版本查證失敗時，該工具維持原記錄、其他工具照常同步，且該次執行仍標示為失敗以便察覺（2026-10-19 起，原為整批不寫入）；不得以檢查日期或任意 commit 日期代替。掃地小幫手發布日以發布提交的台灣日期（UTC+8）為準，提交訊息為「Bump version to vX」或以「vX」開頭皆可辨識。拒絕上游版本倒退、拒絕新增未核准工具。
- 只有真的偵測到新版，才更新 `tools.json` 與 HTML 備援內容、由 `github-actions[bot]` 提交；不修改工具程式、不修改卡片連結、不自動變更首頁本身的 v1.x 版號。
- 若 GitHub Actions 回報沒有寫入權限，請到 Repository → Settings → Actions → General → Workflow permissions 選擇 **Read and write permissions**；如組織政策禁止，需由管理員協助。不放個人存取 Token 在程式碼中。
- 檢查失敗請在 GitHub → Actions → Sync tool releases 查看日誌；修復原始版本資料或同步腳本後重新執行，勿硬填資料。新工具需擁有者先核准，再由維護者有意識地擴充白名單與驗證策略。
- GitHub Actions 的 `schedule` 可能略微延遲；靜態網頁沒有即時推播，每 3 小時同步是定期檢查，不是發布瞬間就同步；實測 GitHub 排程常延遲數小時（2026-10-16／17 設定 09:17，實際約 13:40 才執行）。

## 10. 第四張施工中卡片與特別授權（2026-10-15）
- 使用者已明確核准第四張「平時成績小幫手」，連結本站 `/grade-deploy/`，僅為標示「🚧 施工中」的自助部署原型，不代表程式已可安裝／更新。
- 桌面首頁每行**最多三張卡片**；平板最多二張，手機一張。保留前三張既有功能與連結。
- 第四張是前述「只收錄正式公開小工具」規則的**具體例外**，不得因此擴大其他未核准項目；前三張工具的版本追蹤白名單維持不變。
- 自助部署前端原始碼、規格、測試與後端在私人 `derliang/gas-deploy-helper`；這裡只放公開靜態前台。
- 使用者說 **push git** 預設是提交私人 `gas-deploy-helper`；說 **發佈網頁** 才是更新公開 `teacher-hub`。接手前請讀私人 repo 的 `AGENTS.md`。
- 本施工頁沒有可確認的平時成績小幫手正式版本與發布日，不可虛構。

## 11. GAS 候選佔位卡片（2026-10-15）
- 使用者要求在首頁先展示 GitHub 既有 GAS 專案，供後續挑選；目前新增四張**純佔位**卡片：晨練成績系統（`morning-practice-grade-system`）、線上共筆成績系統（`collaborative-grade-system`）、午餐小幫手（`Lunch-Helper`）、老師隨手記（`teacher-notes`）。
- 這四張沒有 href、不能點擊，不連私人 Repository、不連 GAS、未有 OAuth 或部署功能；統一標示「🚧 正式版尚未推出，敬請期待」。是否正式納入自助部署平台仍須擁有者核准。
- 原四張卡片維持原功能：前三張直接使用；第四張平時成績小幫手進入已核准的施工中展示頁。
- 桌面每行最多三張卡片，平板二張、手機一張。候選卡片不列入 `tools.json` 的已發布程式版本自動追蹤清單，不捏造版號及發布日期。
- 另有 `grade-system`（GitHub Pages + Supabase）、`class-swap`（本機前端）、`seat-helper-gas-test`（GAS 測試副本）、`gas-deploy-helper`（部署平台本身），不要當成候選正式 GAS 教師工具。
- **管理後台架構**：現有 Windows 本機管理台位於 `gas-deploy-helper` 並僅本機 `127.0.0.1:4173`；未來雲端管理後台的開發原始碼在 Private `gas-deploy-helper`，實際操作前台可發布於 Teacher Hub 中經後端 OAuth/RBAC 保護的管理頁（例如 `/grade-deploy/admin/`，正式路徑待定）；管理 API/白名單/憑證必須留在受保護的 HTTPS 後端，**雲端後台尚未實作**。

## 12. 使用者最終挑選的 GAS 佔位名單（2026-10-15，優先於先前第四張連結／候選說明）
- 正式三工具保留原本可點擊的卡片與原連結。
- 唯四張 GAS 佔位卡片：`pingshi-grade-helper`（平時成績小幫手）、`morning-practice-grade-system`（晨練成績系統）、`Lunch-Helper`（午餐小幫手）、`teacher-notes`（老師隨手記）。四者均**無任何 href**，並顯示「🚧 正式版尚未推出，敬請期待」。
- 使用者明確排除 `collaborative-grade-system`（線上共筆成績系統，已停止開發），不得重新加入首頁。
- 舊的 `/grade-deploy/` 原型檔仍保留作既有網頁資源，但首頁**不再連到它**；要再次上架或開放操作，須使用者另行授權。
- 桌面每行最多三張，平板最多兩張，手機一張；`tools.json` 僅追蹤三個已正式公開小工具。

## 13. 兩類工具卡片與導航（最新定案，優先於第 12 節）
- **直接線上執行型**：座位小幫手、掃地小幫手、段考小幫手，整張卡片直接開啟可使用的程式。
- **線上自助部署型**：目前平時成績小幫手作為通用 GAS 引擎的**第一個開發試點**，首頁卡片必須可點擊進入本站 `/grade-deploy/` 操作原型；網頁明確標示施工中，未接上安全後端前不可宣稱能真正安裝或更新 GAS。
- 任何自助部署型子頁都必須提供明顯的 **返回 Teacher Hub 首頁**連結或共用導航列，避免使用者迷失。連結應對應 GitHub Pages 子路徑（目前為 `../`），不能直接跳私人 Repo。
- 其餘三個已挑選 GAS 候選（晨練成績系統、午餐小幫手、老師隨手記）先維持不可點擊佔位，顯示「正式版尚未推出，敬請期待」。（2026-10-19 老師隨手記經擁有者核准改為可開啟的網頁版 Beta 卡片，網址為其 GitHub Pages；午餐小幫手 2026-10-24 曾短暫上架網頁版，同日下架恢復佔位，見第 17 節；晨練成績系統維持佔位。）
- 第 12 節把平時成績卡片列為不可點擊已被本次使用者修正，**以第 13 節為準**。

## 14. 管理後台原型（2026-10-15）
- 已建立 `/admin/` 公開靜態展示頁，原始碼權威為 private `gas-deploy-helper/prototype/self-service/admin/index.html`。此頁**沒有實際 Google OAuth、管理員驗證或 API**，所有寫入功能停用；不蒐集或顯示真實教師授權紀錄。
- 公開 GitHub Pages 無法保護前端檔案本身。將來若要可用的管理後台，必須先建安全的雲端 API，在**每次請求**驗證 Workspace 身分及管理員 RBAC；不能僅靠頁面隱藏或前端條件判斷。
- 管理頁有固定「返回 Teacher Hub 首頁」連結。正式路線的管理員登入／教師 CRUD／部署紀錄尚未實作，不可對外宣稱上線。

## 15. 後台 Workspace 認證與逐產品授權（2026-10-15）
- 管理員並非只核准一個全產品通用的教師白名單；應依**教師 × GAS 產品**逐項決定可安裝與更新的 GAS 工具。不同 GAS 工具的授權需在後端獨立核對。
- 已在公開 `/admin/` 頁加入 Google Identity Services 登入入口和逐產品授權設定 UI，需另部署私人 `gas-deploy-helper/cloud/self-service-auth` HTTPS 後端與前台 `admin/auth-config.json`（只放公開 Client ID、API base URL）才可線上實測。
- **目前未提供 OAuth Client ID、Cloud Run URL、正式授權資料庫，故認證尚未實際測通**。絕不得用填寫 Email 當作登入成功。未配置時保持關閉。
- 此階段不具真正 GAS 安裝更新能力，不得進行測試性 Google 寫入。完整規格見私人 `gas-deploy-helper/docs/self-service/AUTH_AND_PRODUCT_GRANTS.md`。

## 16. 七張卡片插畫（2026-10-15）
- 首頁改用 `/images/cards/{seat,cleaning,exam,grade,morning,lunch,notes}.svg` 靜態插畫；原三張直接執行工具與四張 GAS 卡片的功能與互動不變。
- 現階段上架的是可由 GitHub 純文字 API 提交的配色協調向量插畫，**不是對話中產生的高解析度 PNG 原圖**；將來若要換成原圖，可在有二進位上傳工具的環境另行替換，並驗證負載與尺寸。

## 17. 多人同時使用的工具必須有後端（2026-10-24）
- **判斷標準**：工具若是「一個人建立資料、很多人各自在自己手機上操作同一份資料」（例如同學各自點餐、各自投票、各自登入看自己的紀錄），就一定要有伺服端：GAS Web App 搭配試算表，或線上資料庫。純靜態網頁（GitHub Pages）加「存裝置／存自己的雲端硬碟」只適合**一個人用**的工具（老師隨手記就是），做不到多人同時使用。
- **實例**：午餐小幫手網頁版 `lunch-helper-web`（2026-10-24）用模擬的 GAS 在瀏覽器執行，資料存使用者自己的雲端硬碟，結果同學沒辦法自己點餐，只能負責人代點，失去這個工具的意義。當天從首頁下架，卡片恢復「GAS 自助部署候選」佔位，`tools.json` 移除該筆；公開 repo 與 GitHub Pages 保留不刪，供日後參考。
- **上架前多一條檢查**：上架任何工具前先問「使用者是一個人還是一群人？」一群人而工具沒有後端的，不得上架，也不得以「負責人代點」這類變通說成可以用。
- 午餐小幫手的正式版是 GAS 版（私有 repo `Lunch-Helper`，需自行部署）；要在首頁提供可用的入口，須先經擁有者決定提供方式（自助部署平台或其他），本節不授權任何一種。

## 18. 版權維護規範（2026-10-24 版權任務導入）
- **現況**：根目錄 `LICENSE.md`（非營利、限校使用授權）、README「著作權與使用授權」小節、首頁頁尾一行低調版權句、`index.html`／`admin/auth.js`／`scripts/sync_tool_releases.py` 檔頭版權註解。授權政策：聖功女中師生免費、**所有使用者限非營利**、其他學校須寄信 derliang@gmail.com 並取得作者 Email 明確同意。
- **後續開發守則**：不得移除或改寫上述版權標示；首頁只維持**單一**頁尾版權句（整合在既有 `<footer>`，不另加第二個頁尾）；新增獨立頁面／腳本時，主要自有入口檔補相同檔頭；不得擅自改成 MIT 等開源授權。
- **範圍**：本 repo 的授權只涵蓋本 repo 的原創內容；首頁連到的各工具（座位、掃地、段考、隨手記等）各有自己的 repo 與授權狀態，不因本首頁而變更。`scripts/sync_tool_releases.py` 只改版號與日期，不得動到頁尾版權句。
- **已確認事項（2026-10-24）**：著作權人為「黃德亮」（公開識別 derliang）。
- `admin/index.html`、`grade-deploy/index.html` 為施工中原型，已（使用者同意）只補檔頭 HTML 註解，未加頁尾版權句。
- **發布前檢查清單補充**：確認首頁頁尾版權句仍存在、授權連結可開啟、`LICENSE.md` 未被覆蓋。

## 19. 設計規範與上下架規範（2026-10-25）
- **設計規範**：[docs/design/DESIGN.md](docs/design/DESIGN.md) 是視覺、版面、導覽與文案語氣的唯一來源，定案模擬頁在 `docs/design/mockups/`。2026-10-25 擁有者同意整體改版（學院編輯風；首頁分「立即可用」「GAS 部署」兩區；自助部署採精靈式），第 3 節「不經同意不得更換設計風格」由此放寬為「以 DESIGN.md 為準」。要偏離，先更新 DESIGN.md 並取得擁有者確認。
- **上架與下架**：[docs/PUBLISHING.md](docs/PUBLISHING.md) 是上架、改狀態、下架的唯一流程，與第 5、6 節重疊處以它為準。核心規則：先分區、先問「一個人還是一群人」、沒有擁有者明確同意不得上架或下架、下架不刪公開 repo。
- **兩區對應第 13 節的兩類工具**：「立即可用」＝直接線上執行型；「GAS 部署」＝自助部署型。GAS 區在平台通過真實 Google 驗收前只能是「候選」或「施工中・可預覽」。
- **自助部署路徑**：`gas-deploy-helper` 的 `selfservice/publish.mjs` 預定發佈到本站 `/deploy/` 與 `/deploy/admin/`，之後取代第 10、14 節的 `/grade-deploy/` 與 `/admin/` 原型。在「發佈網頁」之前，原型維持原狀。
- **實作狀態**：本節只記錄規範。首頁與兩個原型頁的實際改版是後續獨立工作，改版時依 DESIGN.md 並對照 `docs/design/mockups/`。
