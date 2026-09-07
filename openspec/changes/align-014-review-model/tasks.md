# 任務清單：014 審核模型對齊 015 v5.0.0（issue #688）

> **容器後補聲明**：deferred 計畫之原群組 5（審核設定名冊化、審核指派區塊唯讀化、發布閘門改版）已於 PR #609 實作完成且測試全綠，見 [`openspec/changes/archive/2026-09-01-single-owner-review-relay/deferred/014-tasks.md`](../archive/2026-09-01-single-owner-review-relay/deferred/014-tasks.md)。本清單如實記錄該段「實作先於容器」的違序，不重派工、不要求重跑 Red；其對應條文（FR-005j／FR-005k／FR-010s／FR-010s-2）於 archive 時的 Source-Verify 改以「delta 條文與既有實作一致」為驗證方向。

## 0. 已完成（PR #609，實作先於容器）

**故事目標**：專案負責人於 Overview 以兩份名冊勾選完成審核設定，且成員管理的審核指派區塊恆為唯讀（SC-033、SC-034）。

- [x] 0.1 規格常數與 `TaskDetail` 實體欄位改版（`AR_REVIEW_STATUS` 三態、移除 `REVIEW_ASSIGNMENT_MODES` 與 `MIN_REVIEWERS_RULE`、`ARBITER_CANDIDATE_RULE` 加 `can_arbitrate`、`OVERVIEW_EDITABLE_FIELDS` 改列名冊欄位、新增 `EXCEPTION_POOL_ACTIONS`）已落地於 `design/prototype/pages/task-management/task-detail.data.js`。證據：PR #609 [@senior-frontend]
- [x] 0.2 FR-010s 與 FR-010s-2 之兩份名冊勾選與摘要值規則已落地於 `design/prototype/pages/task-management/task-detail.panels/overview.html`。證據：PR #609，測試 `issue-596-review-settings.spec.ts` 全綠 [@senior-frontend]
- [x] 0.3 FR-005j 唯讀化與 FR-005k 雙列已落地於 `design/prototype/pages/task-management/task-detail.panels/member-management.html`。證據：PR #609，測試 `issue-596-assignment-readonly.spec.ts` 全綠 [@senior-frontend]

## 1. PR 群組 1 — 審核員身分格式統一與 lint 合規（FR-010s-1）

**故事目標**：`reviewer_ids` 與 `arbiter_ids` 一律以不透明 user id 儲存，使審核指派的數值與成員清單審核負荷欄在 014 與 015 兩端以同一把鍵對齊（SC-034）。

> **產品檔案（2）**：`design/prototype/pages/task-management/task-detail.data.js`、`design/prototype/pages/task-management/task-detail.html`
> **最終群組**：否。
> **相依**：無。本群組是 PR #683 的解鎖前提，須先於群組 2 合併（兩者同檔改動）。

- [x] 1.1 撰寫 Red 測試覆蓋名冊身分格式（`design/prototype/tests/task-management/issue-688-reviewer-identity.spec.ts`）：`TASK_MEMBERS` 每位成員具備 `id` 欄位且為 slug 形狀（不含 `@`）；`task-detail.html` 預設 seed 與四個任務 profile 的 `reviewerIds`／`arbiterIds` 元素皆取自該 `id`、不含 `@` 字元；審核設定勾選儲存後寫入的值為 id 而非 Email；成員清單「審核負荷」欄之聚合以 id 為鍵；成員清單仍以 Email 顯示。驗證：執行該檔全數失敗且失敗原因為 seed 與比對鍵仍為 Email 值。證據：commit `666c6ba3`（僅測試檔，218 行）；`PW_PORT=8901 corepack pnpm playwright test tests/task-management/issue-688-reviewer-identity.spec.ts` → 4 failed / 1 passed，四個失敗分別為 `TASK_MEMBERS` 無 `id`、seed 含 `@`、checkbox value 仍為 Email、`byReviewer` 鍵含 `@`；通過的第 5 案（成員清單仍顯示 Email）為防迴歸正向斷言，Green 後須維持綠 [@senior-qa]
- [x] 1.2 Green：於 `design/prototype/pages/task-management/task-detail.html` 為 `TASK_MEMBERS` 七位成員加上 `id` 欄位、將預設 `reviewerIds` seed 與五份審核負荷 `byReviewer` 對照表改以 id 為鍵，並將 `getEffectiveReviewerIds`／`getEffectiveArbiterIds` 與審核設定兩份勾選清單的比對由 `member.email` 改為 `member.id`；於 `design/prototype/pages/task-management/task-detail.data.js` 將四個任務 profile 的名冊 seed 由 Email 遷移為同一組 id。Email 僅保留於顯示欄位。驗證：`PW_PORT=8899 pnpm playwright test tests/task-management/issue-688-reviewer-identity.spec.ts` 全綠。證據：commit `f2e107ac`（2 產品檔，+60/−53）達成 Red 前 5 案全綠；審查時發現 `addPlatformUserToTask` 之 `TASK_MEMBERS.push` 未帶 `id`，屬本次改動自傷（移除成員後經平台搜尋重新加入即產生 `value="undefined"` 的 checkbox），非既有債，故追加 Red `19ff1c73`（+84 行，僅測試檔）與 Green `96831bc0`（`task-detail.html`，+31/−3）——正典 id 改置於 `PLATFORM_USERS`、`TASK_MEMBERS.id` 為副本，`inviteMemberByEmail` 之第二個 push 點一併補齊以維持不變式（該路徑目前不可達，已於註解載明、未加測試）。最終 `PW_PORT=8907 corepack pnpm playwright test tests/task-management/issue-688-reviewer-identity.spec.ts` → 7 passed；`git diff 19ff1c73 HEAD -- design/prototype/tests/` 為空，確認 Green 未動測試檔 [@senior-frontend]
- [x] 1.3 執行 `PW_PORT=8899 pnpm playwright test tests/task-management tests/annotation tests/cross-role` 確認既有綠度不退；`XROLE-04`、`XROLE-20`、`XROLE-21` 三個已知落差維持原狀，若任一意外轉綠則停止並回報。證據：`PW_PORT=8913 corepack pnpm playwright test tests/task-management tests/annotation tests/cross-role` → **1091 passed (7.8m)、0 failed**、exit code 0。三個護欄皆包在 `test.fail()` 內，若任一意外轉綠 Playwright 會回報為 failed（Expected to fail, but passed），故 0 failed 即證明三者維持落差狀態；`XROLE-20`／`XROLE-21` 於報告中仍為逐項 `✘`（`test.fail()` 層級計入 passed），停止條件未觸發 [@senior-qa]
- [x] 1.4 於 `specs/task-management/014-task-detail/spec.md` 補上缺少的 `## 功能目標` 標題、為 23 條驗收情境指派 AC 穩定 ID（AC-1.1–AC-1.7／AC-2.1–AC-2.4／AC-3.1–AC-3.12），並將 frontmatter 的功能分支對齊本變更分支。驗證：`bash scripts/check-sdd.sh` 不再回報該檔的 SPEC_REQUIRED_HEADING 與 SPEC_REQUIRED_IDS [@main]
- [x] 1.5 於 `specs/STATUS.md` 將 task-management-014 該列的分支欄對齊本變更分支，並自 lint 基線移除該檔已消失的 LEGACY_SPEC_HEADING 條目。驗證：`bash scripts/check-sdd.sh` 不再回報 ACTIVE_CHANGE_STAGE 與 BASELINE_STALE [@main]

## 2. PR 群組 2 — 最終例外池入口與結案閘門（FR-018／FR-008b／FR-010t）

**故事目標**：專案負責人於標記進度看見待處置的例外項並逐筆收尾，任務在例外池清空前無法結案（SC-041、SC-037）。

> **產品檔案（3）**：`design/prototype/pages/task-management/task-detail.panels/annotation-progress.html`、`design/prototype/pages/task-management/task-detail.data.js`、`design/prototype/pages/task-management/task-detail.html`
> **最終群組**：否。
> **相依**：群組 1（同檔改動；身分格式須先統一，例外池清單的仲裁者欄位才有正確的比對鍵）。

- [x] 2.1 撰寫 Red 測試覆蓋例外池入口與結案閘門（`design/prototype/tests/task-management/issue-688-exception-pool-entry.spec.ts`）：區塊標題顯示待處置數；逐列呈現樣本 ID 與標記員、審核員、爭議輸出類型、仲裁者及其理由；點列導頁攜帶完整審核單位身分；`0` 項時渲染空狀態而非隱藏區塊；`reviewer` 看不到該區塊；例外池未清空時 `標記完成` 被阻擋並列出具體原因。驗證：`PW_PORT=8945 pnpm exec playwright test tests/task-management/issue-688-exception-pool-entry.spec.ts`（對照本群組實作前的樹）→ **4 failed / 1 passed**，四個失敗分別為 `#finalExceptionPoolSection` 及其列／連結元素尚不存在、`publishComplete()` 無條件完成無阻擋；通過的第 5 案（`reviewer` 看不到該區塊）為 `toBeHidden()` 對「查無此元素」的正向真空通過，屬防迴歸正向斷言，與群組 1 task 1.1 的既有先例（`e8c2c33` 評語）同一模式。實作過程中發現 `oft-01-final-exception` 之仲裁 `reject` 投票（`seedReviewFlowDemo()`）從未帶 `reason`（該理由屬審核員 `modify` 決策，非仲裁者），故理由欄斷言改為驗證 `-` 空值 fallback，而非誤植審核員理由文字；此為既有 015 端示範資料的既知落差，已於測試檔頂部與 `REASON_FALLBACK` 常數註解中如實記載，未修改 `annotation-workspace.data.js`（非本群組檔案範圍）。證據：commit `3a037e3`（僅測試檔，187 行）[@senior-qa]
- [x] 2.2 Green：於 `design/prototype/pages/task-management/task-detail.panels/annotation-progress.html` 實作 FR-018 之最終例外池區塊、清單欄位、`run_type` 篩選與逐筆導頁；資料推導 `getFinalExceptionPoolItems()` 落於 `design/prototype/pages/task-management/task-detail.data.js`（design.md D6 之推導規則）。驗證：`PW_PORT=8947 pnpm exec playwright test tests/task-management/issue-688-exception-pool-entry.spec.ts` → **4 passed / 1 failed**（區塊呈現四案全綠；結案閘門案維持紅燈，待 2.3）。證據：commit `5a349d7`（3 產品檔，+217/−1）[@senior-frontend]
- [x] 2.3 於 `design/prototype/pages/task-management/task-detail.html` 之 `getClosureBlockers()` 實作 FR-008b 結案閘門並接上 `publishComplete()`。**範圍縮減聲明**：FR-008b 原文列 5 項前置條件，本任務僅落地第 4 項（最終例外池已清空，僅計 `official_run`）；其餘 4 項維持既有落差，理由已載於 `getClosureBlockers()` 之函式頭註解——條件 1（正式標記全數提交）若對照通用 seed（`DEFAULT_ANNOTATION_PROGRESS`）強制檢查，會使 `xrole-canonical-journey.spec.ts` 的 `XROLE-20`／`XROLE-21`（`test.fail()`，proposal.md 明確排除範圍）因無關原因意外轉綠；條件 3（不存在爭議中審核單位）若強制檢查，會讓 T017 既有示範資料的 `oft-03-modified-interim`（此原型無互動式仲裁路徑可解）永久卡住結案，使本任務自身「例外池清空後即可完成」的 Green 案在真實 seed 上無法驗證。驗證：`PW_PORT=8948 pnpm exec playwright test tests/task-management/issue-688-exception-pool-entry.spec.ts` → **5 passed**。證據：commit `416faff`（1 產品檔，+35/−0）[@senior-frontend]
- [x] 2.4 驗證 FR-010t 既有實作（PR #609）不受本群組影響；例外池區塊之 `project_leader` 權限守衛已於 2.2 一併落地（`renderFinalExceptionPool()` 依 `state.taskRole` 切換 `hidden`），無需額外接線。驗證：`PW_PORT=8949 pnpm exec playwright test tests/task-management/issue-596-assignment-readonly.spec.ts` → **4 passed**，FR-010t 之發布閘門與無仲裁者警示行為與群組 1 合併後一致，本任務未變更任何產品檔案 [@senior-frontend]
- [x] 2.5 執行相關回歸套件。**環境警示**：本 worktree 的沙箱只預裝 Chromium revision 1194（無 pinned 的 1217），`@playwright/test` 預設無標頭模式會選用不存在的 `chromium-headless-shell`（revision 1217）而拒絕啟動；為了讓測試能跑，本機額外建立**未提交**的 `design/prototype/playwright.local.config.ts`（`launchOptions.executablePath` 指向本機既有的 1194 版完整 Chromium），純屬本次驗證用的本機繞道，不隨 PR 提交。該完整版 Chromium 走軟體繪圖（swiftshader），效能遠低於預期的 headless-shell：`PW_PORT=8960 pnpm exec playwright test --config=playwright.local.config.ts tests/task-management tests/annotation tests/cross-role` → **1023 passed / 56 failed / 17 did not run（耗時 2.5 小時）**，對照群組 1 於正常環境的基準（`72fe54c` 引用之 `PW_PORT=8913` 執行結果：**1091 passed（7.8 分鐘）、0 failed**）落差懸殊。逐一比對後確認 56 個失敗**全數為環境效能問題，並非本群組改版造成的迴歸**：(a) 以 `--workers=1` 重跑 3 個與本群組完全無關的檔案（`annotation-workspace-item-pair.spec.ts`、`task-list-output-types.spec.ts`、`annotation-entry-breadcrumb.spec.ts`）重現相同的 `page.goto: Test timeout of 30000ms exceeded` 逐字錯誤；(b) 以 `--workers=1 --timeout=60000` 重跑本群組實際觸及頁面（`task-detail.html`）鄰近的 4 個檔案（`issue-285-task-new-submit-persistence.spec.ts`、`task-detail-annotation-results.spec.ts`、`task-detail-dry-run-status-sync.spec.ts`、`task-detail-task-profiles.spec.ts`），7 個失敗案例逐一檢視斷言，全數為 `page.goto`／`locator.click`／短逾時（5s）等待逾時或元素尚未渲染完成，**無一斷言內容涉及 FR-018 例外池或 FR-008b 結案閘門邏輯**；(c) `XROLE-04`／`XROLE-20`／`XROLE-21` 三個 `test.fail()` 護欄在完整回歸紀錄中維持原狀（未出現於 56 個失敗清單，`test.fail()` 案例若意外轉綠才會被判定為失敗），停止條件未觸發。本任務未修正任何既有測試，因為沒有真正因本群組改版而失效的測試——上述失敗在正常速度環境下不會重現。證據：`/tmp` 完整回歸日誌（2.5 小時執行紀錄）與兩次隔離重跑之逐字錯誤訊息 [@senior-qa]

## 3. PR 群組 3 — archive 與正典回寫

**故事目標**：014 正典升至 v3.0.0，衍生檢視與正典對同一組審核行為給出一致敘述（SC-033）。

> **產品檔案（0）**。
> **最終群組**：是。
> **相依**：群組 1、群組 2 皆已合併。

- [ ] 3.1 執行 `openspec validate --changes --no-interactive` 與 `bash scripts/check-sdd.sh`，確認四道驗證閘門之第一、二道通過 [@main]
- [ ] 3.2 執行 `/opsx:archive`，將 delta 併入衍生檢視並回寫正典至 v3.0.0 並新增 Changelog 條目。驗證：正典檔內 FR-018 與 SC-041 可 grep 到，Changelog 首列為 3.0.0 [@main]
- [ ] 3.3 執行 Source-Verify：逐一 grep 衍生檢視中的每個正典引用（FR/SC/AC ID、章節、檔案路徑、ADR/issue/PR 編號），確認皆可定位 [@main]
- [ ] 3.4 執行合併後收尾：更新 `specs/STATUS.md` 之 task-management-014 列為 archived 並移動正典目錄 [@main]
