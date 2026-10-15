# GitHub Pages 404 修復紀錄

日期：2026-10-15（台灣）

## 已確認的現象
- 正式網址 https://derliang.github.io/teacher-hub/ 顯示 404：There isn't a GitHub Pages site here.
- Pages 設定為 Deploy from a branch，來源 main / (root)，未設定自訂網域。
- main 根目錄已有 index.html、site.json，首頁使用相對路徑載入版本資訊。
- 修復前 Actions workflow_runs 為 0，沒有任何成功發布的證據。

## 處理
透過已登入的 GitHub 網頁直接提交本紀錄，觸發分支來源的 Pages 建置。保留既有首頁內容、設計、三項工具與 v1.1.0 版本資訊；本次只處理發布。

## 驗證與判斷
已確認的直接問題是尚未完成任何 Pages 部署，並非首頁檔案不存在。先前提交未觸發建置的確切原因尚未確認，不推定為權杖或程式錯誤。
本提交後需確認 Actions 的 pages build and deployment 成功，並實際開啟正式網址；結果會補記於本檔。

## 維護
提交成功不等於部署成功。後續更新需追蹤 Pages 部署完成並驗證正式網址。維持 Settings → Pages → Deploy from a branch → main / (root)。
