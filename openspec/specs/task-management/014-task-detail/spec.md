## Purpose

任務詳情頁（`task-detail`）是專案負責人設定審核模型、監看審核進度並判定任務可否結案的單一控制面。正典：`specs/task-management/014-task-detail/spec.md`。

> **本檔為 OpenSpec 衍生檢視的基線，不是規格來源。** 014 從未經 OpenSpec 流程異動，衍生檢視中原本沒有這份能力；`openspec archive` 處理 `## MODIFIED Requirements` 時需要一個前值可供取代，故於 `align-014-review-model` 提案時，自正典 v2.11.3 的條文重建本檔。條文內容為**變更前**行為；`#### Scenario:` 標題已與該 change 的 delta 對齊（archive 的覆蓋檢查以標題為鍵），因此部分標題描述的是變更後的意圖，其內文才是變更前的行為——閱讀時一律以 `specs/task-management/014-task-detail/spec.md` 為準。

## Requirements

### Requirement: FR-005j 審核指派區塊

`member-management` MUST 在成員清單之後提供「審核指派」區塊：顯示未指派審核筆數，並為每位啟用中審核員（`ARBITER_CANDIDATE_RULE` 同一母集合）呈現已指派／待審／已完成三欄；被列入生效 `arbiter_ids` 的審核員需顯示「仲裁」標籤。`review_assignment_mode = auto` 時整區唯讀（僅顯示輪派結果，不得出現任何操作按鈕）；`manual` 且操作者為 `project_leader` 時提供「自動補齊」（依審核員輪流分配直到未指派 = 0，清空後停用）與逐列「指派…」（自未指派池撥一筆給該審核員，未指派 = 0 時停用）。移除或停用仍有待審負荷的審核員時，其 `pending` 筆數 MUST 退回未指派池，`done` 保留為歷史統計（比照 FR-005f 對標記員的規則）。

#### Scenario: 審核指派區塊唯讀且標示仲裁者
- **GIVEN** 專案負責人開啟 `member-management` 且 `review_assignment_mode = auto`
- **WHEN** 檢視「審核指派」區塊
- **THEN** 每位啟用中審核員呈現已指派／待審／已完成三欄，列入 `arbiter_ids` 者帶「仲裁」標籤
- **AND** `auto` 模式下區塊唯讀；切換為 `manual` 時出現「自動補齊」與逐列「指派…」按鈕

### Requirement: FR-005k 爭議池與最終例外池的負荷列

審核指派區塊底部 MUST 顯示爭議池列 `{n} 項待仲裁`；`manual` 模式提供「分派給仲裁者」按鈕，將爭議池輪流分派給生效仲裁者並計入其負荷；`arbitration_enabled = false`、無生效仲裁者或爭議池為 0 時該按鈕 MUST 停用，`auto` 模式則不顯示。

#### Scenario: 兩列皆為唯讀且無分派按鈕
- **GIVEN** 某任務有 3 項待仲裁且 `review_assignment_mode = manual`
- **WHEN** 專案負責人檢視審核指派區塊底部
- **THEN** 顯示 `3 項待仲裁` 一列，並提供「分派給仲裁者」按鈕
- **AND** `arbitration_enabled = false`、無生效仲裁者或爭議池為 0 時該按鈕停用

### Requirement: FR-008b 任務結案前置條件

任務狀態由 `official_run_in_progress` 轉為 `completed` 前，系統 MUST 驗證下列全部前置條件（issue #180 完整條件；ADR-022 2026-08-19 修訂版轉換表）：(1) 正式標記作業全數提交（已排除作業不計入）；(2) 依生效審核設定（`min_reviewers`）應完成的 review unit 全數定案；(3) 無未解決爭議（不存在 `爭議中` 條目）；(4) 應仲裁項目全數完成仲裁；(5) 品質指標計算完成可用。任一條件不符時，系統 MUST 阻擋轉換並逐項列出未滿足的具體原因，MUST NOT 僅以「全部標記已提交」作為完成依據。

#### Scenario: 例外池未清空時阻擋結案
- **GIVEN** 某 `official_run_in_progress` 任務尚有未完成定案的 review unit
- **WHEN** 專案負責人點擊 `標記完成`
- **THEN** 轉換被阻擋，並逐項列出未滿足的具體原因
- **AND** 五項前置條件全數滿足後方可轉為 `completed`

### Requirement: FR-010s Overview 審核設定區塊（檢視模式）

Overview MUST 在「抽樣設定」之後提供獨立「審核設定」區塊。檢視模式顯示四個欄位：`每筆資料審核員數`（`min_reviewers`）、`審核指派方式`（`review_assignment_mode`，顯示 `自動輪派`／`手動指派`）、`一致即定案`（`agreement_auto_finalize`，顯示 `啟用`／`停用`）、`第三人仲裁`（`arbitration_enabled` + `arbiter_ids`）。編輯權限與抽樣設定相同（`OVERVIEW_EDITABLE_STATUS` + `OVERVIEW_EDITABLE_ROLE`），編輯／儲存／取消與未儲存離開確認行為與抽樣設定一致。

#### Scenario: 審核設定僅剩兩份名冊
- **GIVEN** 專案負責人開啟 `draft` 任務的 Overview
- **WHEN** 檢視「審核設定」區塊
- **THEN** 顯示 `每筆資料審核員數`、`審核指派方式`、`一致即定案`、`第三人仲裁` 四個欄位
- **AND** 編輯權限與抽樣設定相同

### Requirement: FR-010s-1 審核設定編輯模式

審核設定編輯模式 MUST 提供：`min_reviewers` 可直接鍵入的數字輸入框（不得使用瀏覽器內建 spinner 作為主要互動）、`REVIEW_ASSIGNMENT_MODES` 單選、`agreement_auto_finalize` 與 `arbitration_enabled` 兩個 toggle、仲裁者多選清單（候選 = `ARBITER_CANDIDATE_RULE`）。`arbitration_enabled = false` 時 MUST NOT 顯示仲裁者選擇。驗證：`min_reviewers` 不符 `MIN_REVIEWERS_RULE` 時阻擋儲存並顯示可修正錯誤訊息。

#### Scenario: 仲裁者候選限於已勾選審核員
- **GIVEN** 任務有 4 位啟用中審核員且 `arbitration_enabled = true`
- **WHEN** 專案負責人展開仲裁者多選清單
- **THEN** 候選為符合 `ARBITER_CANDIDATE_RULE` 的全部啟用中審核員
- **AND** `arbitration_enabled = false` 時不顯示仲裁者選擇

#### Scenario: 名冊以不透明 user id 儲存而非 Email
- **GIVEN** 專案負責人於審核設定選取仲裁者並儲存
- **WHEN** 檢視該任務的 `arbiter_ids`
- **THEN** 正典未定義其元素的身分格式
- **AND** `reviewer_ids` 於本版尚不存在為設定欄位

### Requirement: FR-010s-2 仲裁者摘要值規則

`第三人仲裁` 摘要值規則：停用 → `停用`；啟用且 `arbiter_ids` 為空 → `啟用 · 未指定仲裁者`；啟用且已指定 → `啟用 · 仲裁者 N 人`。

#### Scenario: 摘要值不含啟用停用前綴
- **GIVEN** 某任務 `arbitration_enabled = true` 且已指定 2 位仲裁者
- **WHEN** 檢視審核設定區塊
- **THEN** `第三人仲裁` 摘要值為 `啟用 · 仲裁者 2 人`
- **AND** 停用時摘要值為 `停用`

### Requirement: FR-010t 發布前的成員人數檢查

發布 `新增試標回合 R{n}` 或 `開始正式標記` 前，系統 MUST 驗證實際啟用成員人數：`membership_status = active` 且 `task_role = annotator` 的人數 `>= min_annotators`，且 `membership_status = active` 且 `task_role = reviewer` 的人數 `>= min_reviewers`；任一角色人數不足時，系統 MUST 阻擋發布，並逐角色顯示缺口訊息「還差 N 位」（`N = 設定最低人數 - 實際啟用人數`）。發布前檢查 MUST NOT 僅驗證抽樣／審核設定值本身（決策 D3，issue #189）。

#### Scenario: 未勾選審核員時阻擋發布
- **GIVEN** 某 `draft` 任務的 active 審核員人數少於 `min_reviewers`
- **WHEN** 專案負責人點擊 `新增試標回合 R1`
- **THEN** 發布被阻擋並逐角色顯示「還差 N 位」
- **AND** 補足人數後方可發布
