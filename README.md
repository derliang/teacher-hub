# Teacher Hub｜教師小幫手

作者已公開 GitHub Pages 小程式的簡潔入口首頁。

- 線上首頁：https://derliang.github.io/teacher-hub/
- **交接／新增工具前必讀：[MAINTENANCE.md](MAINTENANCE.md)**
- 入口版本：[site.json](site.json)
- 歷史：[CHANGELOG.md](CHANGELOG.md)

目前收錄：座位小幫手、掃地工作小幫手、段考小幫手、老師隨手記（Beta）、午餐小幫手（Beta）。整張卡片直接導覽至原本 GitHub Pages 操作頁面。

不自動收錄其他 Repo，不收錄私人、GAS 或被排除的專案。

## 自動同步個別工具版本

每日臺灣時間 09:17 由 [GitHub Actions](.github/workflows/sync-tool-releases.yml) 檢查已核准三個工具的版本與日期；只有確認新資訊時更新首頁卡片及 [tools.json](tools.json)。也可手動執行。操作詳見 [MAINTENANCE.md](MAINTENANCE.md) 第 9 節。
