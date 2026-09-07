# Screen Inventory（頁面 → 元件反向索引）

> **用途：** 以「頁面」為主鍵列出每頁使用的元件，與 [inventory.md](inventory.md)（「元件 → 出現頁面」）互為反向索引，作為前端 feature 開發時的元件 checklist、前端交接矩陣與路由／權限／狀態測試矩陣依據。
>
> **本檔為 generated view——請勿手動編輯。** 唯一生成來源是 [inventory-manifest.json](inventory-manifest.json)；改完 manifest 後執行 `node scripts/gen-screen-inventory.mjs` 重新產生，並以 `bash scripts/inventory-tests.sh` 驗證。元件規格唯一正典是 [MASTER.md](MASTER.md)；行為規格在 `specs/<module>/`；token 實作在 `design/prototype/assets/tokens.css`。
>
> **Prototype 來源 commit：** `8fe47117a5f6`（2026-09-07）——`design/prototype/pages` · `design/prototype/index.html` 的最後一次變更。
> 本檔若落後於該 commit，`node scripts/gen-screen-inventory.mjs --check` 會失敗。

---

## 維護時機

所有變更一律改 `inventory-manifest.json` 後重新產生，不得直接編輯本檔。

| 觸發 | 動作 |
|------|------|
| Prototype 新增／移除畫面 | 在 manifest `screens` 增刪該筆（漏了會被覆蓋率檢查擋下） |
| 既有畫面新增／移除元件 | 更新該畫面 `components`；出現次數統計會自動重算 |
| 頁面新增 URL 參數視圖 | 在 manifest `screenViews` 加入該視圖 |
| Spec、page design、prototype 測試路徑異動 | 更新 `specs` / `design` / `tests`（失效引用會被驗證擋下） |
| 路由於 `routes/paths.ts` 落地 | 將該畫面 `routeKey` 由 `null` 改為對應鍵 |

## 前端開發用法

1. **元件建置優先序**＝「出現次數統計」的降冪排序——出現在 6 個以上畫面者進 `frontend/src/shared/`，先補 Storybook story 再開頁面（ADR-016）。
2. **Feature 元件 checklist**＝「畫面 × 元件」表中該頁的列——每開一個 `frontend/src/features/<module>/`，以該頁元件清單為 checklist，缺的元件先補 story。
3. **前端交接矩陣**＝下方「前端交接矩陣」表——spec/FR/SC、page design、prototype 測試、route、角色、UI 狀態、`data-testid` 數、React ownership 與 Storybook scope 一列到底。
4. **路由 × 權限 × 狀態測試矩陣**＝「同頁多重視圖」表——36 個視圖可直接轉成正式 e2e 的 Playwright spec 清單（目錄位置見 ADR-034）。

---

## 元件出現次數統計（建置優先序）

依 manifest 的 15 個畫面計算：

| 出現頁數 | 元件 | 出現頁面（編號） |
|:---:|------|------|
| 15 | Language Toggle 語言切換 | 全部 |
| 15 | Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | 全部 |
| 11 | Navbar / Sidebar（共用側欄） | 05–15 |
| 8 | Card 卡片 | 01–06, 09, 15 |
| 8 | Table 表格 | 06, 07, 09, 10, 12–15 |
| 6 | Input 輸入框 | 01–05, 08 |
| 6 | Modal 對話框 | 06, 07, 09, 11–13 |
| 5 | Mini Button 列內小按鈕 | 07, 09–12 |
| 5 | Status Badge 狀態徽章 | 05–07, 09, 12 |
| 5 | Pagination 分頁 | 07, 09, 10, 12, 14 |
| 5 | Link（Inline / Action） | 01–04, 06 |
| 4 | Chip（VA / 分類 / Cause…） | 08, 09, 11, 15 |
| 3 | Task Type / Run Mode Badge | 07, 09, 14 |
| 3 | Toolbar（搜尋＋篩選＋清除） | 07, 10, 14 |
| 3 | Desktop Content Tabs 內容頁籤 | 09, 12, 13 |
| 3 | Color Dot 色點 | 08, 09, 15 |
| 3 | Divider 分隔線 | 01, 05, 06 |
| 2 | State Panel 狀態面板 | 03, 04 |
| 2 | Breadcrumb 麵包屑 | 09, 15 |
| 2 | Avatar 頭像 | 05, 06 |
| 2 | Skeleton 載入佔位 | 05, 09 |
| 1 | Status Pill（無框軟底） | 10 |
| 1 | Alert Banner 警示橫幅 | 01 |
| 1 | Toast 浮動提示 | 05 |
| 1 | Activity List 活動清單 | 06 |
| 1 | Step Indicator 步驟指示 | 08 |
| 1 | Upload Zone 上傳區 | 08 |
| 1 | Tag Input / Pill 標籤輸入 | 08 |
| 1 | Toggle Switch 開關 | 08 |
| 1 | Code Editor（Schema） | 08 |
| 1 | Accordion 手風琴 | 08 |
| 1 | State Switcher ⚠ prototype-only | 06 |

> 建議第一批（`frontend/src/shared/`）：Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only）、Navbar / Sidebar（共用側欄）、Card 卡片、Table 表格、Input 輸入框、Modal 對話框——出現 6 頁以上的元件全數在列。

## 畫面 × 元件（15 頁）

| # | 頁面 | Module | 使用元件 | 備註 |
|---|------|--------|----------|------|
| 01 | 登入 `account/login.html` | account | Card 卡片、Language Toggle 語言切換、Input 輸入框、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only）、Alert Banner 警示橫幅、Divider 分隔線、Link（Inline / Action） | 另有 Logo + Wordmark、Eye Toggle、Inline Field Error（auth family 專用，未進共用元件庫） |
| 02 | 註冊 `account/register.html` | account | Card 卡片、Language Toggle 語言切換、Input 輸入框、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only）、Link（Inline / Action） | 另有 Field Hint、Required Indicator、Eye Toggle（auth family 專用） |
| 03 | 忘記密碼 `account/forgot-password.html` | account | Card 卡片、Language Toggle 語言切換、Input 輸入框、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only）、State Panel 狀態面板、Link（Inline / Action） | Loading Status 以 `aria-live` 播報 |
| 04 | 重設密碼 `account/reset-password.html` | account | Card 卡片、Language Toggle 語言切換、Input 輸入框、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only）、State Panel 狀態面板、Link（Inline / Action） | State Panel 同時承載 Success 與 Token Error 兩種結果 |
| 05 | 個人資料 `account/profile.html` | account | Navbar / Sidebar（共用側欄）、Card 卡片、Divider 分隔線、Avatar 頭像、Status Badge 狀態徽章、Input 輸入框、Toast 浮動提示、Skeleton 載入佔位、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Avatar 為 Large（可上傳）變體；Role Badge 由 Status Badge 家族提供 |
| 06 | 儀表板 `dashboard/dashboard.html` | dashboard | Navbar / Sidebar（共用側欄）、Card 卡片、Table 表格、Activity List 活動清單、Status Badge 狀態徽章、Avatar 頭像、Modal 對話框、State Switcher ⚠ prototype-only、Divider 分隔線、Link（Inline / Action）、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Summary Card 為 KPI 變體；另有 Mobile Bottom Tab Bar；Scenario Switcher 僅 prototype 使用 |
| 07 | 任務列表 `task-management/task-list.html` | task-management | Navbar / Sidebar（共用側欄）、Toolbar（搜尋＋篩選＋清除）、Table 表格、Status Badge 狀態徽章、Task Type / Run Mode Badge、Pagination 分頁、Modal 對話框、Mini Button 列內小按鈕、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Badge 同時承載 Task Status、Task Type 與 Run Mode 三組語意 |
| 08 | 建立任務 `task-management/task-new.html` | task-management | Navbar / Sidebar（共用側欄）、Step Indicator 步驟指示、Upload Zone 上傳區、Tag Input / Pill 標籤輸入、Toggle Switch 開關、Code Editor（Schema）、Chip（VA / 分類 / Cause…）、Accordion 手風琴、Color Dot 色點、Input 輸入框、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Chip 兼作輸出型態選取與 Bypass 互斥開關；Step 1/2 設定與 task-detail 共用 task-config.* 引擎 |
| 09 | 任務詳情 `task-management/task-detail.html` | task-management | Navbar / Sidebar（共用側欄）、Breadcrumb 麵包屑、Desktop Content Tabs 內容頁籤、Table 表格、Pagination 分頁、Chip（VA / 分類 / Cause…）、Task Type / Run Mode Badge、Color Dot 色點、Skeleton 載入佔位、Modal 對話框、Mini Button 列內小按鈕、Card 卡片、Status Badge 狀態徽章、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | 5 個 fetch partials（task-detail.panels/）；Table 具 expandable rows |
| 10 | 標記任務列表 `annotation/annotation-list.html` | annotation | Navbar / Sidebar（共用側欄）、Toolbar（搜尋＋篩選＋清除）、Table 表格、Status Pill（無框軟底）、Pagination 分頁、Mini Button 列內小按鈕、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | ⚠ 尚無專屬正典 spec；行為目前只由 page design 與 prototype 測試定義（issue #375 追蹤） |
| 11 | 標記工作區 `annotation/annotation-workspace.html` | annotation | Navbar / Sidebar（共用側欄）、Chip（VA / 分類 / Cause…）、Mini Button 列內小按鈕、Modal 對話框、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | 閱讀面板使用 Atkinson Hyperlegible；標記面板為 config-driven，涵蓋 8 種 output type（ADR-029） |
| 12 | 使用者管理 `admin/user-management.html` | admin | Navbar / Sidebar（共用側欄）、Desktop Content Tabs 內容頁籤、Table 表格、Status Badge 狀態徽章、Pagination 分頁、Mini Button 列內小按鈕、Modal 對話框、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Mini Button 具 primary 與 danger 兩種列內變體 |
| 13 | 角色設定 `admin/role-settings.html` | admin | Navbar / Sidebar（共用側欄）、Desktop Content Tabs 內容頁籤、Table 表格、Modal 對話框、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | 刪除走 Modal/Destructive（`role="alertdialog"`）＋ Button/Danger |
| 14 | 資料集分析列表 `dataset/dataset-analysis-list.html` | dataset | Navbar / Sidebar（共用側欄）、Toolbar（搜尋＋篩選＋清除）、Table 表格、Task Type / Run Mode Badge、Pagination 分頁、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Toast 為 5 秒自動關閉（已知 e2e 競態，見 issue #180 finding register） |
| 15 | 資料集分析詳情 `dataset/dataset-analysis-detail.html` | dataset | Navbar / Sidebar（共用側欄）、Breadcrumb 麵包屑、Color Dot 色點、Chip（VA / 分類 / Cause…）、Table 表格、Card 卡片、Language Toggle 語言切換、Button（CTA / Primary / Secondary / Ghost / Danger / OAuth / Icon-only） | Stats / Quality partials 共 8 型態 × 2；Status Dot 由 Color Dot 家族提供；Cause Tag 由 Chip 家族提供 |

## 前端交接矩陣

每列即一個畫面的實作契約。`FR` / `SC` 數量由所連 canonical spec 直接讀出（點連結看完整條列），`data-testid` 由該畫面的 prototype 原始檔統計，Storybook scope 由出現次數推導——三者皆不可手寫。

| # | 畫面 | Spec（FR / SC） | Page design | Prototype 測試 | Route | 角色 | UI 狀態 | `data-testid`（自有） | React ownership | Storybook scope |
|---|------|-----------------|-------------|----------------|-------|------|---------|:---:|-----------------|-----------------|
| 01 | 登入 | [`001-login-email-password`](../../specs/account/001-login-email-password/spec.md) FR ×18 · SC ×7<br>[`002-login-google-sso`](../../specs/account/002-login-google-sso/spec.md) FR ×7 · SC ×5 | [`pages/login.md`](pages/login.md) | `account/login.spec.ts`<br>`account/auth-*.spec.ts`（4 檔） | ⚠ 未定義 | 未登入訪客 | default、驗證錯誤、送出中、登入失敗（Alert Banner） | 10 | `features/account` | `shared/`：4 · `features/account/`：3 |
| 02 | 註冊 | [`003-register-email-password`](../../specs/account/003-register-email-password/spec.md) FR ×19 · SC ×7 | [`pages/register.md`](pages/register.md) | `account/register.spec.ts`（1 檔） | ⚠ 未定義 | 未登入訪客 | default、欄位提示、驗證錯誤、送出中 | 14 | `features/account` | `shared/`：4 · `features/account/`：1 |
| 03 | 忘記密碼 | [`004-forgot-reset-password`](../../specs/account/004-forgot-reset-password/spec.md) FR ×15 · SC ×8 | [`pages/forgot-password.md`](pages/forgot-password.md) | `account/forgot-password.spec.ts`（1 檔） | ⚠ 未定義 | 未登入訪客 | default、驗證錯誤、送出中、寄送成功（State Panel） | 7 | `features/account` | `shared/`：4 · `features/account/`：2 |
| 04 | 重設密碼 | [`004-forgot-reset-password`](../../specs/account/004-forgot-reset-password/spec.md) FR ×15 · SC ×8 | [`pages/reset-password.md`](pages/reset-password.md) | `account/reset-password.spec.ts`（1 檔） | ⚠ 未定義 | 未登入訪客（持 reset token） | default、驗證錯誤、重設成功（State Panel）、Token 失效（State Panel） | 10 | `features/account` | `shared/`：4 · `features/account/`：2 |
| 05 | 個人資料 | [`005-profile-settings`](../../specs/account/005-profile-settings/spec.md) FR ×35 · SC ×15<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/profile.md`](pages/profile.md) | `account/profile-*.spec.ts`（3 檔） | ⚠ 未定義 | 全部已登入角色 | default、載入中（Skeleton）、儲存成功（Toast）、儲存失敗（Toast）、唯讀欄位 | 0 | `features/account` | `shared/`：5 · `features/account/`：5 |
| 06 | 儀表板 | [`012-dashboard`](../../specs/dashboard/012-dashboard/spec.md) FR ×70 · SC ×34<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/dashboard.md`](pages/dashboard.md) | `dashboard/*.spec.ts`（12 檔） | ⚠ 未定義 | super_admin / project_leader / annotator / reviewer | default、空狀態 CTA、載入中（Skeleton） | 13 | `features/dashboard` | `shared/`：6 · `features/dashboard/`：6 |
| 07 | 任務列表 | [`010-task-list`](../../specs/task-management/010-task-list/spec.md) FR ×12 · SC ×15<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/task-list.md`](pages/task-list.md) | `task-management/task-list-*.spec.ts`<br>`task-management/issue-194-status-sync.spec.ts`（4 檔） | ⚠ 未定義 | project_leader / annotator / reviewer | default、空狀態、載入失敗（`?view=error`） | 0 | `features/task-management` | `shared/`：5 · `features/task-management/`：5 |
| 08 | 建立任務 | [`013-task-new`](../../specs/task-management/013-task-new/spec.md) FR ×9 · SC ×6<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/task-new.md`](pages/task-new.md) | `task-management/task-new-*.spec.ts`（15 檔） | ⚠ 未定義 | project_leader | Step 1 / Step 2 / Step 3、草稿警告、驗證錯誤 | 5 | `features/task-management` | `shared/`：4 · `features/task-management/`：8 |
| 09 | 任務詳情 | [`014-task-detail`](../../specs/task-management/014-task-detail/spec.md) FR ×16 · SC ×38<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/task-detail.md`](pages/task-detail.md) | `task-management/task-detail-*.spec.ts`（20 檔） | ⚠ 未定義 | project_leader / reviewer | default、載入中（Skeleton）、找不到任務（TASK_NOT_FOUND）、唯讀（reviewer） | 5 | `features/task-management` | `shared/`：6 · `features/task-management/`：9 |
| 10 | 標記任務列表 | [`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/annotation-list.md`](pages/annotation-list.md) | `annotation/annotation-list-*.spec.ts`（7 檔） | ⚠ 未定義 | annotator / reviewer | default、空佇列、未提交樣本 | 8 | `features/annotation` | `shared/`：4 · `features/annotation/`：4 |
| 11 | 標記工作區 | [`015-annotation-workspace`](../../specs/annotation/015-annotation-workspace/spec.md) FR ×151 · SC ×40<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/annotation-workspace.md`](pages/annotation-workspace.md) | `annotation/annotation-workspace-*.spec.ts`（31 檔） | ⚠ 未定義 | annotator / reviewer | default、唯讀（已定稿）、提交驗證錯誤、空審核單元 | 57 | `features/annotation` | `shared/`：4 · `features/annotation/`：2 |
| 12 | 使用者管理 | [`006-user-management`](../../specs/admin/006-user-management/spec.md) FR ×13 · SC ×12<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/user-management.md`](pages/user-management.md) | `admin/user-management.spec.ts`（1 檔） | ⚠ 未定義 | super_admin | default、空狀態 | 0 | `features/admin` | `shared/`：5 · `features/admin/`：4 |
| 13 | 角色設定 | [`007-role-settings`](../../specs/admin/007-role-settings/spec.md) FR ×10 · SC ×10<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/role-settings.md`](pages/role-settings.md) | `admin/role-settings.spec.ts`（1 檔） | ⚠ 未定義 | super_admin | default、刪除確認（alertdialog） | 0 | `features/admin` | `shared/`：5 · `features/admin/`：1 |
| 14 | 資料集分析列表 | [`016-dataset-analysis-list`](../../specs/dataset/016-dataset-analysis-list/spec.md) FR ×20 · SC ×12<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/dataset-analysis-list.md`](pages/dataset-analysis-list.md) | `dataset/dataset-analysis-list-*.spec.ts`（4 檔） | ⚠ 未定義 | project_leader / super_admin | default、空狀態、Toast 提示 | 0 | `features/dataset` | `shared/`：4 · `features/dataset/`：3 |
| 15 | 資料集分析詳情 | [`017-dataset-analysis-detail`](../../specs/dataset/017-dataset-analysis-detail/spec.md) FR ×60 · SC ×32<br>[`008-sidebar-navbar-shared`](../../specs/shared/008-sidebar-navbar-shared/spec.md) FR ×48 · SC ×34 | [`pages/dataset-analysis-detail.md`](pages/dataset-analysis-detail.md) | `dataset/dataset-analysis-detail-*.spec.ts`（11 檔） | ⚠ 未定義 | project_leader / super_admin | default、空狀態（`?s_state=empty`）、IAA 未達標 | 0 | `features/dataset` | `shared/`：5 · `features/dataset/`：3 |

> Route 欄全數為「⚠ 未定義」代表 `frontend/src/routes/paths.ts` 目前只有 foundation 的 `healthCheck`；每個畫面的路由在該 feature 落地時回填 manifest `routeKey`，生成器會驗證該鍵確實存在。
>
> `data-testid` 欄只計該畫面自有原始檔（頁面 HTML、`<畫面>.*` 同名資產、`.partials/`／`.panels/`）；另有 5 個 testid 位於不屬於單一畫面的共用檔（`pages/shared/`、`task-config.*`）。計為 0 的畫面代表其 prototype 測試目前以 id／role 選取，尚未具備穩定 `data-testid`——依 Frontend Ready Gate 應在該 feature 實作前補齊。

## 同頁多重視圖（36 視圖）

同一 HTML 依 URL 參數／頁內狀態切換的視圖清單。每列可直接對應一條正式 e2e 測試（路由 × 權限 × 狀態）。

### 入口 `index.html`

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V00 | 入口導向頁 | （無） | Meta refresh 自動導向 `pages/account/login.html` |

### 儀表板 `dashboard/dashboard.html`（4 角色視角，⚠ 切換器 prototype-only）

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V01 | 系統管理員 | `?scenario=super_admin_data` | 平台總覽 KPI、使用者管理捷徑 |
| V02 | 專案負責人 | `?scenario=project_leader` | 空狀態 CTA「建立第一個任務」 |
| V03 | 標記員 | `?scenario=annotator` | 待辦標記清單 |
| V04 | 審核員 | `?scenario=reviewer` | 審查佇列 |

### 任務列表 `task-management/task-list.html`

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V05 | 專案負責人視角 | `?task_role=project_leader` | 建立任務 CTA、run materialization |
| V06 | 標記員視角 | `?task_role=annotator` | 唯讀列表 |
| V07 | 審核員視角 | `?task_role=reviewer` | 審查導向列操作 |
| V08 | 載入失敗 | `?view=error` | Alert Banner + 重試 |

### 任務詳情 `task-management/task-detail.html`（5 tabs + 角色）

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V09 | 標記進度 | `?tab=annotation-progress` | 進度表格 + Pagination |
| V10 | 標記結果 | `?tab=annotation-results` | Expandable rows、VA scoring chips |
| V11 | 成員管理 | `?tab=member-management` | md-chip、密集列操作 |
| V12 | 工時紀錄 | `?tab=work-log` | 工時表格 + Pagination |
| V13 | 審核員角色 | `?task_role=reviewer` | 成員管理 tab 隱藏 |

### 標記清單 `annotation/annotation-list.html`

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V14 | 審核員佇列 | `?role=reviewer` | 審查單元（sample × annotator × run_type）、unit 狀態 pill |

### 標記工作區 `annotation/annotation-workspace.html`（8 種輸出型態 + 組合 + 審查，ADR-029）

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V15 | single_label | `?task_id=T001&…&task_type=single_label` | 分類 chips（radio） |
| V16 | multi_label | `?task_id=T002&…&task_type=multi_label` | 多選 chips（checkbox） |
| V17 | single_dim | `?task_id=T004&…&task_type=single_dim` | 評分滑桿 |
| V18 | multi_dim | `?task_id=T005&…&task_type=multi_dim` | 多維度滑桿 |
| V19 | sequence_tagging | `?task_id=T006&…&task_type=sequence_tagging` | Token 級標記（BIO）、Color Dot |
| V20 | entity_recognition | `?task_id=T007&…&task_type=entity_recognition` | Span 選取高亮 |
| V21 | relation_identification | `?task_id=T008&…&task_type=relation_identification` | 實體對關係連結 |
| V22 | free_text | `?task_id=T009&…&task_type=free_text` | Textarea 生成式輸入 |
| V23 | 組合輸出 ABSA | `?task_id=T013&sample_id=absa-001&…` | ER + RI + multi_dim 整合面板 |
| V24 | 審查模式 | `?task_id=T001&role=reviewer&…` | Approve/Reject、答案 diff |

### 資料集分析詳情 `dataset/dataset-analysis-detail.html`（型態 × tab）

| # | 視圖 | URL 參數 | 說明 |
|---|------|----------|------|
| V25 | single_label 統計 | `?task_id=T001&tab=stats` | 標籤分佈 |
| V26 | multi_label 統計 | `?task_id=T002&tab=stats` | 共現統計 |
| V27 | single_dim 統計 | `?task_id=T004&tab=stats` | 分數分佈直方 |
| V28 | multi_dim 統計 | `?task_id=T005&tab=stats` | 各維度分佈 |
| V29 | sequence_tagging 統計 | `?task_id=T006&tab=stats` | Tag/token 統計 |
| V30 | entity_recognition 統計 | `?task_id=T007&tab=stats` | Entity 型別統計 |
| V31 | relation_identification 統計 | `?task_id=T008&tab=stats` | IAA fail：Status Dot（紅） |
| V32 | free_text 統計 | `?task_id=T009&tab=stats` | 長度分佈 |
| V33 | 品質監控（single_label） | `?task_id=T001&tab=quality` | IAA 門檻、Cause Tag |
| V34 | 品質監控（組合輸出） | `?task_id=T013&tab=quality` | 三輸出品質分區 |
| V35 | 空狀態 | `?task_id=T001&tab=stats&s_state=empty` | Empty state CTA |
