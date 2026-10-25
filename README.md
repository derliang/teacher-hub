# Teacher Hub｜教師小幫手

作者已公開 GitHub Pages 小程式的簡潔入口首頁。

- 線上首頁：https://derliang.github.io/teacher-hub/
- **交接／新增工具前必讀：[MAINTENANCE.md](MAINTENANCE.md)**
- **改頁面前必讀：[設計規範](docs/design/DESIGN.md)**（模擬頁在 `docs/design/mockups/`）
- **上架、下架工具：[docs/PUBLISHING.md](docs/PUBLISHING.md)**
- 入口版本：[site.json](site.json)
- 歷史：[CHANGELOG.md](CHANGELOG.md)

目前收錄：座位小幫手、掃地工作小幫手、段考小幫手、老師隨手記。整張卡片直接導覽至原本 GitHub Pages 操作頁面。

不自動收錄其他 Repo，不收錄私人、GAS 或被排除的專案。

## 自動同步個別工具版本

每日臺灣時間 09:17 由 [GitHub Actions](.github/workflows/sync-tool-releases.yml) 檢查已核准三個工具的版本與日期；只有確認新資訊時更新首頁卡片及 [tools.json](tools.json)。也可手動執行。操作詳見 [MAINTENANCE.md](MAINTENANCE.md) 第 9 節。

## 著作權與使用授權

© 2026 derliang. All rights reserved.

本程式免費提供聖功女中師生於非營利教育用途使用；**所有使用者均限非營利使用**。其他學校或機構請先寄信至 [derliang@gmail.com](mailto:derliang@gmail.com) 申請，並取得作者 Email 回覆同意。程式碼重製、修改、散布、再發布及商業使用均須另行授權。

完整條款請參閱 [LICENSE.md](./LICENSE.md)。
