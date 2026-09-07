---
對應 Spec: specs/task-management/014-task-detail/spec.md
對應 Issue: #688
基準版本: 014 v2.11.3
目標版本: 014 v3.0.0
---

> **本變更是 [`2026-09-01-single-owner-review-relay`](../archive/2026-09-01-single-owner-review-relay/) 的 companion change。** 該變更因 Project SDD lint「一個 active change 恰對應一個 canonical spec」之限制，將 014 側工作整批移入 `deferred/` 暫存；本 change 承接該暫存內容並補上其未涵蓋的 `reviewer_ids` 身分格式定義（issue #688 第 ⑦ 項）。
>
> **實作先行、容器後補（如實記錄）**：deferred 計畫之原群組 5（5.1–5.6）已於 PR #609（issue #596 波次 1）實作完成且測試全綠——`design/prototype/pages/task-management/task-detail.data.js:1315` 起的常數區塊已寫著「spec v3.0.0」，但該版本從未回寫正典。本 change 的任務清單以「規格追上既有實作」如實記錄該段違序，不得重派工、不得要求重跑 Red。

## Why

2026-09-01 的 `single-owner-review-relay`（issue #596）把審核模型改成「每一份樣本、每一個階段只交給一個人處理」，015 已於 v5.0.0 完成 BREAKING 改版並封存。但 014 的正典停在 v2.11.2，仍以舊模型描述審核設定，導致兩份正典對同一組行為給出互相矛盾的規則：

- 014 `MIN_REVIEWERS_RULE` 說「`N >= 2` = 每筆資料由 N 位審核員並行審核」，`annotation/015-annotation-workspace` 已廢止 `MIN_REVIEWERS_DEFAULT` 並載明「單人接力模型下每個審核單位恰指派一位審核員（FR-093），定稿門檻恆為 1」；
- 014 `REVIEW_ASSIGNMENT_MODES` 提供 `manual` = 專案負責人逐一分派，`annotation/015-annotation-workspace` FR-093 則規定「審核工作必須由系統自動指派……不由審核員自行挑單」；
- 014 FR-010s 的 `agreement_auto_finalize` 在 015 全文零命中，已無任何消費端；
- 014 FR-005k 的「分派給仲裁者」按鈕與 015 FR-060「具資格的非當事人自 `annotation-list` 認領」是兩套互斥的仲裁指派機制。

矛盾已造成實質阻塞：PR #683 把 `getAssignedReviewUnits` 由硬編示範名冊改為讀取 `reviewer_ids` 後，20 個審核流程測試轉紅，根因即是 014 從未定義 `reviewer_ids` 該裝什麼——014 原型 seed 以 Email（`mandy@labelsuite.io`）填充，`annotation/015-annotation-workspace` `REVIEWER_ROSTER` 以 slug（`reviewer_wang`）識別，兩套身分命名空間並存而無正典裁決。

本變更的職責是讓 014 正典追上 015 v5.0.0 與既有實作，並為 `reviewer_ids` 立下單一身分格式，解除 #683 的阻塞。

## What Changes

- **審核設定改名冊勾選（**BREAKING**）**：014 移除 `每筆資料審核員數`（`min_reviewers`）、`審核指派方式`（`review_assignment_mode`）、`一致即定案`（`agreement_auto_finalize`）、`第三人仲裁`（`arbitration_enabled`）四個欄位與 `REVIEW_ASSIGNMENT_MODES`／`MIN_REVIEWERS_RULE` 兩個規格常數，改為 `審核員`（`reviewer_ids`）與 `仲裁者`（`arbiter_ids`）兩份勾選名冊。
- **審核指派區塊恆為唯讀**：FR-005j 不再依 `review_assignment_mode` 分流，「自動補齊」與逐列「指派…」按鈕整組退場——指派一律由系統依 `annotation/015-annotation-workspace` FR-093 自動平均分派。
- **仲裁指派改為系統判定合格非當事人**：FR-005k 的「分派給仲裁者」按鈕移除，爭議池與最終例外池兩列皆為唯讀資訊列，仲裁資格由系統依 `ARBITER_CANDIDATE_RULE` 加 `annotation/015-annotation-workspace` FR-060 之非當事人條件判定（此行為已由 `XROLE-17` 覆蓋，規格為追上既有實作，不需改測試）。
- **`ARBITER_CANDIDATE_RULE` 加上 `can_arbitrate = true`**：候選集合收斂為「被勾選進 `arbiter_ids` 的啟用中審核員」，取代原本的「任一未參與該筆審核的審核員皆可認領」。
- **`AR_REVIEW_STATUS` 五態改三態（**BREAKING**）**：`pending | approved | modified | disputed | finalized` 改為 `pending | disputed | finalized`，與 015 `REVIEW_UNIT_STATUS` 同值同形狀；`approved`／`modified` 兩個「已審但未達門檻」的中繼態在恆一位審核員的模型下結構上不可達。
- **`reviewer_ids` 身分格式定案（issue #688 第 ⑦ 項，本 change 相對 deferred 計畫的增量）**：`reviewer_ids`／`arbiter_ids` 之元素定義為**不透明 user id**，格式沿用 `annotation/015-annotation-workspace` `REVIEWER_ROSTER` 的 slug（`reviewer_wang`），Email 降為成員清單的顯示屬性、不得作為比對鍵。原型 seed 之 Email 值須一併遷移。
- **發布前檢查改單審核員模型**：FR-010t 之「active reviewer 人數 `>= min_reviewers`」改為「被勾選且啟用中的審核員 `>= 1`」；`arbiter_ids` 為空不阻擋發布，但須於確認畫面顯示「爭議項將無人可仲裁而堆積」的警示。
- **結案前置條件納入例外池清空**：FR-008b 移除 `min_reviewers` 語意，並新增「最終例外池已清空」為第 4 項條件。
- **最終例外池入口（新能力）**：新增 FR-018，於 `annotation-progress` 頁籤提供專案負責人逐筆收尾爭議的區塊入口與導頁，收尾畫面本身由 `annotation/015-annotation-workspace` FR-095 承接。
- **新增規格常數 `EXCEPTION_POOL_ACTIONS`**：與 015 同名常數同值（`custom_answer` 僅 `official_run` 提供）。

## Capabilities

### New Capabilities

- `task-management/014-task-detail`：**最終例外池入口**（FR-018）——`annotation-progress` 分頁的區塊入口、待處置清單、`run_type` 篩選與逐筆導頁。此概念在 v3.0.0 以前完全不存在，仲裁無法解決的爭議在舊模型中永遠停留於 `爭議中`，任務無法收斂。

### Modified Capabilities

- `task-management/014-task-detail`：審核設定改兩份名冊勾選（FR-010s／FR-010s-1／FR-010s-2）、審核指派區塊唯讀化與仲裁分派按鈕退場（FR-005j／FR-005k）、發布前成員人數檢查改單審核員模型（FR-010t）、結案前置條件納入例外池清空（FR-008b）；規格常數改版（移除 `REVIEW_ASSIGNMENT_MODES`／`MIN_REVIEWERS_RULE`、`AR_REVIEW_STATUS` 三態化、`ARBITER_CANDIDATE_RULE` 加 `can_arbitrate`、`OVERVIEW_EDITABLE_FIELDS` 改列名冊欄位、新增 `EXCEPTION_POOL_ACTIONS` 與 `REVIEWER_ID_FORMAT`）與 `TaskDetail` 實體欄位改版隨對應 FR 落地。

## Impact

**規格**

- 正典：`specs/task-management/014-task-detail/spec.md`（v2.11.2 → v3.0.0，**MAJOR**：四個設定欄位與兩個規格常數移除、`AR_REVIEW_STATUS` 五態改三態、新增 FR-018）
- 衍生檢視：`openspec/specs/task-management/014-task-detail/spec.md`（archive 時自動合併；本 change 需先建立基線，理由見 design.md D1）
- 上游（本次不修改，僅確認相容）：`specs/annotation/015-annotation-workspace/spec.md` v5.0.0 為本變更的權威來源，014 一律引用不重述；本變更不觸發 015 升版。
- 下游（本次不修改，僅確認相容）：`specs/dataset/017-dataset-analysis-detail` 之 IAA 計算不受影響——試標仍以標記員原始答案計算。

**原型程式（Principle X 之產品檔案盤點）**

已於 PR #609 完成、本 change 僅補容器與規格（不重派工）：

- `design/prototype/pages/task-management/task-detail.data.js`（常數與 `TaskDetail` 欄位改版）
- `design/prototype/pages/task-management/task-detail.panels/overview.html`（兩份名冊勾選）
- `design/prototype/pages/task-management/task-detail.panels/member-management.html`（指派區塊唯讀化、雙列）
- `design/prototype/pages/task-management/task-detail.html`（設定表單接線與 i18n）

本 change 實際待實作：

- `design/prototype/pages/task-management/task-detail.data.js`（`reviewer_ids` 身分遷移；FR-008b 五項結案條件）
- `design/prototype/pages/task-management/task-detail.panels/annotation-progress.html`（FR-018 例外池區塊）
- `design/prototype/pages/task-management/task-detail.html`（例外池權限守衛）

合計 3 個產品檔案，未逾 Principle X 之 5 檔上限，但兩組任務（身分遷移／例外池）目的不同，依 PR 單一目的原則拆為兩個實作 PR 群組加一個 archive 群組（見 `tasks.md`）。

**既有機制交互**

- **PR #683 / issue #617**：`getAssignedReviewUnits` 改讀 `reviewer_ids` 後 20 個審核流程測試轉紅，根因為 014 未定義 `reviewer_ids` 內容。本 change 群組 1 的身分遷移是該 PR 的解鎖前提；#683 須待本 change 群組 1 合併後重做。
- **`XROLE-17`**（`design/prototype/tests/cross-role/xrole-canonical-journey.spec.ts:856`）：已覆蓋「仲裁入口僅提供給合格的非當事人仲裁者」，即 FR-005k 改版後的行為。本 change 對 FR-005k 的修改是規格追上既有實作，MUST NOT 修改該測試。
- **`XROLE-04` / `XROLE-20` / `XROLE-21`**：三個 `test.fail` 形式的已知落差文件（`min_annotators` 未對實際人數強制、結案未被未解爭議阻擋、結案無二次確認）。FR-010t 與 FR-008b 的改版**不解除**這三個落差——它們是 014 既有債，不在本 change 範圍；若實作使其意外轉綠，須於任務驗證時明示並另開 issue。
- **`annotation/015-annotation-workspace` `REVIEWER_ROSTER`**：`reviewer_wang / reviewer_li / reviewer_chen（can_arbitrate = true）/ reviewer_lin` 是 `reviewer_ids` 的唯一合法取值來源；其地位同 `REVIEWER_MOCK_ANNOTATORS`，後端接上後由真實帳號取代。014 MUST NOT 另建第二份名冊。

## Constitution Check

- **Generalization-First（NON-NEGOTIABLE）**：`AR_REVIEW_STATUS`、`ARBITER_CANDIDATE_RULE`、`EXCEPTION_POOL_ACTIONS` 三個常數的值 MUST 與 015 同源常數同值，014 MUST NOT 另建第二份定義；審核狀態 badge 與篩選選項 MUST 由常數推導，不得於選單硬編狀態清單。例外池清單的爭議輸出類型呈現 MUST 由 `OUTPUT_TYPE_REGISTRY` 驅動，不得逐 task 硬編。
- **Data Fairness（NON-NEGOTIABLE）**：最終例外池區塊僅對 `project_leader` 呈現，直連比照 FR-006 導回——例外池逐列揭露標記員答案與審核員答案，若對標記員或審核員可見即構成跨角色答案外洩。
- **可追溯性**：例外池清單 MUST 逐列呈現仲裁者帳號與其「兩者皆非」理由，使每一筆落入例外池的項目可回溯至具名決策者。
- **Simplicity First / YAGNI**：本變更淨效果為刪減——移除兩個規格常數、四個設定欄位、兩個中繼狀態與三組操作按鈕；新增僅 FR-018 一條需求，且為 FR-008b 第 4 項結案條件的必要呈現點。不引入舊模型的相容層或雙軌開關。
- **PR 規模（Principle X）**：3 個待實作產品檔案，拆為兩個實作 PR 群組加一個 archive 群組（見 `tasks.md`），每組獨立通過驗證後合併，OpenSpec change 保持開啟至最後一組執行 archive 回寫。
