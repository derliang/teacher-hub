<!--
Copyright (c) 2026 derliang. All rights reserved.
Non-commercial use only. See LICENSE.md.
Authorization inquiries: derliang@gmail.com
-->
# 自助部署：前端介面與後端的分工

> 狀態：定案（2026-10-25，擁有者裁示）。**Teacher Hub（本 repo，公開）是前端；私人 repo `derliang/gas-deploy-helper` 是後端。** 使用者看得到、點得到的一切，都在這裡。

## 1. 一張圖看懂

```
老師的瀏覽器
   │  打開 https://derliang.github.io/teacher-hub/deploy/
   ▼
【前端介面】本 repo（公開）                         【後端】私人 repo gas-deploy-helper（不公開）
  deploy/index.html、deploy/admin/index.html        selfservice/gate/*.gs  ← 授權閘門（GAS Web App）
  deploy/assets/*.css、*.js                           · 驗證 Google 登入與學校網域
  · 顯示畫面、導覽、精靈                              · 教師白名單與逐產品授權
  · 取得老師自己的 Google 授權                        · 取得與驗證「已核准的正式版」發布包
  · 直接呼叫 Apps Script API 在老師帳號建立／更新 GAS    · 稽核紀錄、鎖
        │                                                  ▲
        └──────── POST（deploy/config.json 的 gateUrl）─────┘
```

- **前端不保管任何秘密**：沒有 token、金鑰、白名單。Google 授權只存在老師那個分頁裡。
- **後端不碰成績資料**：平台只發布與更新程式，不讀寫老師的試算表。
- **`deploy/config.json` 的 `gateUrl` 是上線開關**：留空時，頁面只顯示「平台尚未開放」，不能登入、安裝或更新。通過真實 Google 驗收、擁有者說「發佈網頁」之後才填入。

## 2. 哪些東西放哪裡

| 內容 | 位置 |
|---|---|
| 畫面、樣式、導覽、精靈、`deploy/assets/*` | **本 repo** `deploy/` |
| 外觀規範（tokens、元件、頁面清冊、模擬頁） | **本 repo** `docs/design/` |
| 前端實作指引、精靈規範 | **本 repo** `docs/deploy/`（這個資料夾） |
| 前端測試、設計檢查、假閘門 | **本 repo** `scripts/` |
| 授權閘門、產品 manifest、發布包、白名單、稽核 | 私人 repo `selfservice/gate/` |
| 安裝／更新的功能與安全規則、真實 Google 驗收步驟 | 私人 repo `docs/self-service/`（`SELF_SERVICE_SPEC_V1.md`、`GATE_ARCHITECTURE.md`、`SETUP_GUIDE.md`） |
| 引擎邏輯的單元測試（`core.js`、`engine.js`、`gs-check.js`） | 私人 repo `test/`（讀取本 repo 的 `deploy/assets/`，見第 4 節） |

## 3. 兩個指令

- 說「**push git**」：提交私人 repo（後端）。
- 說「**發佈網頁**」：更新本 repo 的 `main`（GitHub Pages）。**前端一合併到 `main` 就是公開的**，所以沒有擁有者同意不要合併。

## 4. 引擎檔案是前端程式，但與後端有約定

`deploy/assets/` 裡的 `core.js`、`engine.js`、`gs-check.js` 是在瀏覽器執行的程式，所以放在前端；但它們的邏輯（版本比對、更新阻擋條件、錯誤訊息）與後端、本機版共用規則，並由私人 repo 的測試把關：

- `gs-check.js` 的掃描段（BEGIN／END 之間）必須與私人 repo 的 `src/gs-syntax.mjs` **逐字相同**。
- 私人 repo 的測試會讀取本 repo 的這三個檔案。測試找本 repo 的順序：環境變數 `TEACHER_HUB_REPO`，否則同層資料夾 `../teacher-hub`；找不到就略過那幾項。
- 改這三個檔案前，先看私人 repo 的 `docs/self-service/UNIVERSAL_ENGINE_DECISIONS.md`，並兩邊測試都要通過。

## 5. 本機驗收（不連真實 Google）

```bash
node scripts/dev/fake-gate.mjs        # 首頁 http://localhost:8790/ ，自助部署 /deploy/ ，管理頁 /deploy/admin/
```

它提供假閘門、假 Google 登入，連 Apps Script API 也是假的（記憶體裡的假專案），所以安裝與更新的成功、失敗、阻擋、已是最新、多部署、登入過期都能走完。情境用網址切換，說明在該檔檔頭（例如 `/__set?update=blocked&delay=1500`、`/__set?notready=1`、`/__reset`）。所有資料都是假的（`example.edu.tw`）。

## 6. 改前端前先讀

1. [../../CLAUDE.md](../../CLAUDE.md)
2. [DESIGN_SPEC.md](DESIGN_SPEC.md)：每個畫面長什麼樣、元件命名、不能做的事
3. [WIZARD_SPEC.md](WIZARD_SPEC.md)：精靈（分步安裝與更新）的實作規則（**尚未實作**）
4. [../design/DESIGN.md](../design/DESIGN.md)、[../design/PAGES.md](../design/PAGES.md)

提 PR 前跑：

```bash
python scripts/check_design.py
python scripts/test_check_design.py
node --test scripts/test_deploy_frontend.mjs scripts/test_wizard_contract.mjs
```
