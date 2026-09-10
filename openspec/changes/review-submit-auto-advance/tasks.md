# 任務清單：review-submit-auto-advance（issue #719）

> **Apply 前硬閘（兩道，互不替代）**：先執行 `openspec validate review-submit-auto-advance --type change`（或等價 non-strict all-changes command）取得 **OpenSpec schema validation** 結果，再執行 `scripts/check-sdd.sh` 取得 **Project SDD lint** 結果。兩者皆通過後必須停止，取得使用者明確確認才可進入 `/opsx:apply`。**主 session／team lead 是唯一可驗證 Red／Green evidence 與更新 checkbox 的角色**。
>
> **TDD 硬規則**：可觀察行為為一組 Red（`[@senior-qa]`）＋ Green（`[@senior-frontend]`）配對。Red 任務必須先 commit 並執行、留下預期失敗證據，Green 任務才能開始；Green 任務不得為了讓測試通過而改寫或弱化 Red 契約。
>
> **拆分總則（憲法原則 X）**：本變更僅觸及 1 個手寫產品檔案（`design/prototype/pages/annotation/annotation-workspace.config.js`），預估 diff 遠低於 300 行，故**不拆實作群組**：propose、apply 與 archive 於同一 PR 完成（ADR-033 Rule 1 之預設形態）。測試檔、`specs/**`、`openspec/**` 與 `design/system/screen-inventory.md` 不計入 5 檔上限。
>
> **群組間相依**：群組 0 → 1 → 2 嚴格序列。群組 2 的正典回寫需群組 1 的行為全部落地後才具備 Source-Verify 依據。群組內一律序列執行。
>
> **範圍界線**：FR-073 條文與 `findNextActionableReviewUnit()`／`listReviewUnits()`／`REVIEW_UNIT_ACTION_PRIORITY` 之簽章與行為一字不動；dashboard `快速審核`（`design/prototype/pages/dashboard/dashboard.js`）不得因本變更改變任何行為；標記端 `handleSubmit()` 與 `findNextPendingUnit()` 不得改動。

## 0. 前置

**故事目標**（SC-004Y）：`specs/STATUS.md` 與正典 frontmatter 如實反映 `annotation-015` 有一個開啟中的 OpenSpec change，使審核送出後導覽的補齊有正確的流程狀態基準。

> **相依與平行性**：0.1 與 0.2 必須同批提交，兩者分開則 `scripts/check-sdd.sh` 的 `ACTIVE_CHANGE_STAGE` 會因分支欄與正典 frontmatter 不一致而報錯。本群組不動任何產品程式。

- [x] 0.1 修改 `specs/STATUS.md`，將 `annotation-015` 之狀態由 in-progress 更新為 change-open、分支欄改為本 change 的分支並填入 change 名稱。驗證：`grep -n 'annotation-015' specs/STATUS.md` 之分支欄為本 change 分支，且 Project SDD lint 之 `ACTIVE_CHANGE_STAGE` 維持 0 筆 [@main]
- [x] 0.2 修改 `specs/annotation/015-annotation-workspace/spec.md` 之 frontmatter 功能分支欄，使其與 `specs/STATUS.md` 分支欄一致；本任務只改 frontmatter，不動任何 FR／AC／SC 條文。驗證：正典 frontmatter 之 `功能分支` 與 `specs/STATUS.md` 分支欄逐字相同，且 Project SDD lint 之 `ACTIVE_CHANGE_STAGE` 維持 0 筆 [@main]

## 1. 送出後自動前進（FR-099 全條）

**故事目標**（SC-004Y）：審核員於工作區完成一次成功寫入的送出後，畫面自動落在下一個他確實可以處理的審核單位；已無可處理單位時回到保留送出前篩選條件的清單，並看見明確的「此任務已無可處理單位」說明。

> **產品檔案（1）**：`design/prototype/pages/annotation/annotation-workspace.config.js`
> **最終群組**：否。本組不執行 archive。
> **相依**：群組 0。1.1 的 committed Red 必須先於 1.2 之修訂，1.2 的 committed Red 修訂必須先於 1.3。
> **為何兩條送出路徑合為一組**：`handleReviewSubmit()` 與 `handleArbitrationSubmit()` 共用同一個前進函式（FR-099 第 1 點之單一推導來源要求），拆組會使第二組的實作任務無事可做；兩者的差異只在呼叫點，故以同一組 Red 契約的不同測試案例覆蓋。
> **範圍界線**：不得新增第二個網址寫入點（FR-099 第 2 點）、不得另立返回網址建構器（FR-099 第 5 點）、不得加入「排除目前單位」之特例判斷（FR-099 第 4 點）、不得改動 `annotation-workspace.data.js` 之 `isArbiterCandidate()`（FR-060 第 2 點與 FR-061 第 4 點為互鎖的既有正典，仲裁票刻意不寫入 reviewer bucket）、不得推翻 AC-3.39／FR-053 之定稿鎖定（FR-099 第 7 點）。

- [x] 1.1 新增 `design/prototype/tests/annotation/issue-719-review-submit-auto-advance.spec.ts` 之 Red 契約，覆蓋 AC-3.55 與 AC-3.56 之全部子句：審核送出成功後切換至 `findNextActionableReviewUnit()` 選出的單位且網址 `sample_id`／`annotator_id` 同步、剛送出的單位不成為目標、`pending` 優先於列舉順序在前的可仲裁 `disputed`、已無可處理單位時導頁網址同時帶 FR-081 檢視狀態鍵與 `notice=no_actionable_review` 且不帶 `sample_id`、落地頁渲染 `list-no-actionable-notice`、被 FR-083 擋下的送出停留原單位、仲裁送出走同一套規則、裁定為「兩者皆非」之單位不成為前進目標、被擋下的仲裁送出不產生導覽。導頁類斷言之對象必須為該次導頁所請求之網址而非落地後之 `page.url()`（沿用 AC-4.43 與 AC-4.33 之驗證方式，清單於 boot 時會依 UXC-11 重寫自身網址）。驗證：`PW_PORT=8971 corepack pnpm playwright test tests/annotation/issue-719-review-submit-auto-advance.spec.ts` 出現失敗，失敗原因為兩個送出函式尾段皆無任何導覽。已於 `69a0e37a`（AC-3.55／AC-3.56 七條行為契約）與 `f6ba8a1f`（SC-004Y 第 2 條原始碼掃描：`findNextActionableReviewUnit(` 出現次數須為 1、現為 0）兩次提交；主 session 以 `PW_PORT=8974` 獨立複驗為 6 failed／5 passed [@senior-qa]
- [ ] 1.2 （Red 修訂）依 delta 之 FR-099 第 4 點與第 7 點及改寫後之 AC-3.55／AC-3.56／SC-004Y，修訂 `design/prototype/tests/annotation/issue-719-review-submit-auto-advance.spec.ts`：三支 AC-3.55 行為案例改以「逐項決策中至少一項為 `修正` 或 `無法判定`（依 FR-089 填妥必填理由）」送出，使該單位推導為 `爭議中` 而非 `已定稿`；AC-3.56 之「兩者皆非」案例反轉為「該單位仍為可處理，無更高優先序單位時推導結果即其本身，畫面停留於仲裁版面、不得導回清單且 `list-no-actionable-notice` 計數為 0」；AC-3.56 之仲裁前進案例改以含「兩者皆非」之非定稿裁定並要求前進至另一 `待審` 單位；另新增兩支定稿豁免案例（審核逐項全數 `通過`、仲裁逐項採 A／採 B 全數落定）斷言停留於原單位、該單位 `ws-review-finalized-card` 恰 1 個且未發生任何導頁。四支 SC-004Y 原始碼掃描案例不得放寬或刪除。驗證：`PW_PORT=8975 corepack pnpm playwright test tests/annotation/issue-719-review-submit-auto-advance.spec.ts` 出現失敗，失敗集中於前進類案例（尚無前進實作），兩支定稿豁免案例與四支原始碼掃描案例中的三支回歸底線案例於現況即通過 [@senior-qa]
- [ ] 1.3 （Green）修改 `design/prototype/pages/annotation/annotation-workspace.config.js`：新增一個共用的送出後前進函式，僅於實際寫入成功**且該次送出未使該審核單位推導為 `已定稿`** 時呼叫——推導為 `已定稿` 時不前進亦不導頁，維持既有就地重渲染唯讀定稿卡之行為（FR-099 第 7 點、AC-3.39、FR-053）；需前進時以 `window.LabelSuiteAnnotationWorkspaceData.findNextActionableReviewUnit()` 取得目標並以 `selectSample(sampleId, annotatorId)` 於同頁切換，推導結果為空時導向 `buildListReturnUrl()` 之網址附加 `notice=no_actionable_review`；`handleReviewSubmit()` 與 `handleArbitrationSubmit()` 兩處尾段各呼叫一次。定稿判定必須沿用既有 `getReviewUnitStatus()` 之推導，不得另建第二份定稿判定；不得複製第二套可處理判定、不得新增第二個 query 建構器、不得加入排除目前單位的特例。驗證：`PW_PORT=8971 corepack pnpm playwright test tests/annotation/issue-719-review-submit-auto-advance.spec.ts` 全綠 [@senior-frontend]
- [ ] 1.4 依 INVENTORY_FRESHNESS 以 `node scripts/gen-screen-inventory.mjs` 重生 `design/system/screen-inventory.md` 並**單獨提交**（產品原型檔已變更）。驗證：`scripts/check-sdd.sh` 之 `INVENTORY_FRESHNESS` 為 0 筆 [@main]
- [ ] 1.5 執行群組 1 回歸並保存證據，須逐一確認定稿後停留於原單位之既有契約全數維持通過（`annotation-review-unit.spec.ts`、`issue-307-empty-review-unit-gate.spec.ts`、`issue-308-finalized-unit-lock.spec.ts`、`issue-400-list-finalized-overwrite.spec.ts`、`issue-401-review-submit-rerender.spec.ts`、`issue-450-reviewer-summary-derived.spec.ts`、`issue-568-arbitration-submit-in-action-bar.spec.ts`）。驗證：`cd design/prototype && corepack pnpm typecheck` 與 `PW_PORT=8972 corepack pnpm playwright test tests/annotation` 皆 exit 0；`PW_PORT=8973 corepack pnpm playwright test tests/dashboard` exit 0（確認 FR-073 第一個消費端未受影響） [@main]

## 2. Archive 與正典回寫（最終群組）

**故事目標**（SC-004Y）：正典 `specs/annotation/015-annotation-workspace/spec.md` 自 v6.1.0 回寫為 v6.2.0，新增 FR-099、AC-3.55、AC-3.56 與 SC-004Y，使審核送出後的去向自本版起成為有條文、有驗收情境、有成功標準的契約。

> **產品檔案（0）**：本組不動任何產品程式。
> **最終群組**：是。本組執行 `/opsx:archive` 與正典回寫，並收集 Source-Verify 證據。
> **相依**：群組 1 全部完成且證據已由主 session 核實。

- [ ] 2.1 執行 `~/Library/pnpm/openspec archive review-submit-auto-advance --yes`，並確認衍生視圖 `openspec/specs/annotation/015-annotation-workspace/spec.md` 已合併本次 delta。驗證：`openspec validate --changes` 通過且 `openspec/changes/review-submit-auto-advance/` 已移入 `openspec/changes/archive/` [@main]
- [ ] 2.2 回寫正典 `specs/annotation/015-annotation-workspace/spec.md`：版本 v6.1.0 → v6.2.0，於需求規格區新增 FR-099 全條、於使用者故事 3 新增 AC-3.55 與 AC-3.56、於成功標準區新增 SC-004Y，並新增 v6.2.0 Changelog 條目。驗證：`scripts/check-sdd.sh` 與 `scripts/check-spec-artifacts.sh` 皆 exit 0 [@main]
- [ ] 2.3 執行 Source-Verify gate（gate 4）：衍生視圖中每一處正典引用（FR／AC／SC ID、章節、檔案路徑、issue／PR 編號、被改寫的條文子句）必須逐一以 `grep` 於正典定位；並逐項比對衍生視圖與正典兩份文件的 FR／AC／SC ID 集合，確認無任何 ID 只存在於其中一份。`#### Scenario:` 標題為 AC ID 的權威來源，掃描時必須同時掃需求標題與情境標題。驗證：全部引用可定位、兩份文件 ID 集合一致 [@main]

## Pre-merge finalization（NON-CHECKBOX）

合併前必須完成、但不列為 checkbox 的收尾項：

1. 本 PR 的 issue 關聯使用 `Closes #719`（本 change 於本 PR 內完整交付，無後續群組需要它存活）。
2. `specs/STATUS.md` 之 `annotation-015` 狀態回寫**排在本 PR merge 之後**，依 #590／PR #741 與 #581③／PR #747 之先例獨立成一個 PR；狀態值為 `in-progress` 而非 `archived`——正典仍留在 `specs/annotation/`，且 `scripts/check-spec-artifacts.sh` 不認 `specs/_archive/`。
3. issue #748（AC-1.23 陳舊條文）**不在本 PR 範圍**，不得順手併入；015 為序列佇列，該單另行排程。
