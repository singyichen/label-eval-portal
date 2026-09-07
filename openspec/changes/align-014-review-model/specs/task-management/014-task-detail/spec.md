## Purpose

任務詳情頁（`task-detail`）是專案負責人設定審核模型、監看審核進度並判定任務可否結案的單一控制面。本能力涵蓋 Overview 的審核設定、成員管理的審核指派與爭議／例外池入口、標記進度的審核狀態彙總，以及 `official_run_in_progress → completed` 的結案閘門。正典：`specs/task-management/014-task-detail/spec.md`（v2.11.3 → 3.0.0，**MAJOR**）。

本變更（issue #688）承接 issue #596 之單人接力審核模型，將審核設定由「數值門檻＋模式選擇＋兩個行為開關」改寫為「兩份名冊的勾選」，為名冊元素定下單一身分格式，並新增最終例外池作為任務結案的最後一道關卡。

規格常數同步改版（隨對應 FR 落地，不另立條文）：

- `AR_REVIEW_STATUS` 由五態改為 `pending | disputed | finalized`（中文語彙 `待審 / 爭議中 / 已定稿`），沿用 `specs/annotation/015-annotation-workspace/spec.md` 之 `REVIEW_UNIT_STATUS`；
- 移除 `REVIEW_ASSIGNMENT_MODES`（審核指派一律系統自動，見 `annotation/015-annotation-workspace` FR-093）與 `MIN_REVIEWERS_RULE`（審核單位恆為一位審核員，無門檻可設）；
- `ARBITER_CANDIDATE_RULE` 改為 `task_role = reviewer AND membership_status = active AND can_arbitrate = true`，且仲裁時另受 `annotation/015-annotation-workspace` FR-060 之非當事人條件約束；
- 新增 `REVIEWER_ID_FORMAT = 不透明 user id`——`reviewer_ids` 與 `arbiter_ids` 的元素為系統內部識別鍵，取值來源為 `annotation/015-annotation-workspace` 之 `REVIEWER_ROSTER`（形狀如 `reviewer_wang`）；Email 僅為成員清單的顯示屬性，不得作為比對鍵，亦不得於 014 另建第二份審核員名冊（憲法：Generalization-First）；
- 新增 `EXCEPTION_POOL_ACTIONS = adopt_annotator | adopt_reviewer | custom_answer | exclude_from_dataset`（`custom_answer` 僅 `official_run` 提供，見 `annotation/015-annotation-workspace` FR-095）；
- `OVERVIEW_EDITABLE_FIELDS` 移除 `min_reviewers`、`review_assignment_mode`、`agreement_auto_finalize`、`arbitration_enabled`，改列 `reviewer_ids`、`arbiter_ids`。

## MODIFIED Requirements

### Requirement: FR-005j 審核指派區塊

`member-management` MUST 在成員清單之後提供「審核指派」區塊：顯示未指派審核筆數，並為每位啟用中審核員（`membership_status = active AND task_role = reviewer`）呈現已指派／待審／已完成三欄；被勾選為仲裁者（`can_arbitrate = true`）的審核員 MUST 顯示「仲裁」標籤。

自 v3.0.0 起本區塊 MUST 恆為唯讀——審核指派一律由系統自動執行（`annotation/015-annotation-workspace` FR-093：試標以樣本為單位、正式標記平均分派給被勾選的審核員），MUST NOT 出現「自動補齊」「指派…」或任何逐列操作按鈕；`review_assignment_mode` 已移除，MUST NOT 再依模式分流呈現。

移除或停用仍有待審負荷的審核員時，其 `pending` 筆數 MUST 退回未指派池並由系統重新分派，`done` MUST 保留為歷史統計（比照 FR-005f 對標記員的規則）。

#### Scenario: 審核指派區塊唯讀且標示仲裁者
- **GIVEN** 專案負責人開啟 `member-management`
- **WHEN** 檢視「審核指派」區塊
- **THEN** 每位啟用中審核員呈現已指派／待審／已完成三欄，被勾選為仲裁者者帶「仲裁」標籤
- **AND** 區塊內不存在任何指派或補齊按鈕

### Requirement: FR-005k 爭議池與最終例外池的負荷列

審核指派區塊底部 MUST 顯示爭議池列 `{n} 項待仲裁`，其後 MUST 顯示最終例外池列 `{m} 項待處置`（`m` = 仲裁裁定為「兩者皆非」而落入最終例外池、尚未由專案負責人收尾的項目數，見 FR-018）。

兩列皆 MUST 恆為唯讀資訊列：仲裁資格由系統依 `ARBITER_CANDIDATE_RULE` 與 `annotation/015-annotation-workspace` FR-060 之非當事人條件自動判定，具資格者自 `annotation-list` 進入認領；例外池處置由專案負責人自標記進度進入（FR-018）。本區塊 MUST NOT 提供「分派給仲裁者」或任何分派按鈕。`arbitration_enabled` 已移除，MUST NOT 再以該開關停用任何呈現。

#### Scenario: 兩列皆為唯讀且無分派按鈕
- **GIVEN** 某任務有 3 項待仲裁、2 項待處置
- **WHEN** 專案負責人檢視審核指派區塊底部
- **THEN** 依序顯示 `3 項待仲裁` 與 `2 項待處置` 兩列
- **AND** 兩列皆不含任何按鈕

### Requirement: FR-008b 任務結案前置條件

任務狀態由 `official_run_in_progress` 轉為 `completed` 前，系統 MUST 驗證下列全部前置條件（issue #180 完整條件；ADR-022 2026-08-19 修訂版轉換表）：

1. 正式標記作業全數提交（已排除作業不計入）；
2. 全部審核單位（`annotation/015-annotation-workspace` FR-051）皆推導為 `已定稿`，或經最終例外池「自資料集排除」處置；
3. 不存在狀態為 `爭議中` 的審核單位；
4. **最終例外池已清空**——不存在待處置的 `official_run` 例外項目（FR-018）；
5. 品質指標計算完成可用。

任一條件不符時，系統 MUST 阻擋轉換並逐項列出未滿足的具體原因，MUST NOT 僅以「全部標記已提交」作為完成依據。

**v3.0.0 修訂**：原第 (2) 項之「依生效審核設定（`min_reviewers`）應完成的 review unit 全數定案」改為上列第 2 項——`min_reviewers` 已移除，審核單位恆有一位審核員；原第 (4) 項「應仲裁項目全數完成仲裁」由上列第 3、4 項取代——仲裁完成不再等於結案就緒，仲裁裁定為「兩者皆非」者仍須經例外池收尾。

#### Scenario: 例外池未清空時阻擋結案
- **GIVEN** 某 `official_run_in_progress` 任務全部標記已提交、無 `爭議中` 單位，但最終例外池尚有 2 項待處置
- **WHEN** 專案負責人點擊 `標記完成`
- **THEN** 轉換被阻擋，並逐項列出「最終例外池尚有 2 項待處置」作為未滿足原因
- **AND** 例外池清空後再次點擊即可轉為 `completed`

### Requirement: FR-010s Overview 審核設定區塊（檢視模式）

Overview MUST 在「抽樣設定」之後提供獨立「審核設定」區塊。自 v3.0.0 起檢視模式顯示**兩個**欄位：

1. `審核員`（`reviewer_ids`）——摘要值為 `已勾選 N 人`；`N = 0` 時為 `未勾選審核員`；
2. `仲裁者`（`arbiter_ids`）——摘要值規則見 FR-010s-2。

編輯權限與抽樣設定相同（`OVERVIEW_EDITABLE_STATUS` + `OVERVIEW_EDITABLE_ROLE`），編輯／儲存／取消與未儲存離開確認行為與抽樣設定一致。

**v3.0.0 移除**：`每筆資料審核員數`（`min_reviewers`）、`審核指派方式`（`review_assignment_mode`）、`一致即定案`（`agreement_auto_finalize`）、`第三人仲裁`（`arbitration_enabled`）四個欄位 MUST NOT 再渲染——審核單位恆有一位審核員、指派恆為系統自動、一致即定案已成為 `approve` 決策的固有語意（`annotation/015-annotation-workspace` FR-092）、仲裁已成為爭議項的唯一去向而非可關閉的選配。

#### Scenario: 審核設定僅剩兩份名冊
- **GIVEN** 專案負責人開啟 `draft` 任務的 Overview
- **WHEN** 檢視「審核設定」區塊
- **THEN** 恰顯示 `審核員` 與 `仲裁者` 兩個欄位
- **AND** 區塊內不存在審核員數、指派方式、一致即定案、第三人仲裁任一欄位

### Requirement: FR-010s-1 審核設定編輯模式

審核設定編輯模式 MUST 提供**兩份勾選清單**，MUST NOT 提供任何數值輸入框、模式單選或行為 toggle：

1. `審核員` 勾選清單——候選 = `membership_status = active AND task_role = reviewer`；勾選結果寫入 `reviewer_ids`，即系統自動指派的分派對象（`annotation/015-annotation-workspace` FR-093）；
2. `仲裁者` 勾選清單——候選 MUST 為 `reviewer_ids` 的子集合（未被勾選為審核員者 MUST NOT 出現於仲裁者候選）；勾選結果寫入 `arbiter_ids`，即 `can_arbitrate = true` 的來源（`annotation/015-annotation-workspace` FR-060 條件一）。

兩份名冊寫入的元素 MUST 遵守 `REVIEWER_ID_FORMAT`：值為不透明 user id（取值來源為 `annotation/015-annotation-workspace` 之 `REVIEWER_ROSTER`），MUST NOT 寫入 Email 或顯示名稱。消費端比對審核員身分時 MUST 以該 id 為唯一鍵；Email 僅供成員清單顯示，MUST NOT 參與比對。

驗證：儲存時 `reviewer_ids` 至少 1 人，否則 MUST 阻擋儲存並顯示可修正錯誤訊息。`arbiter_ids` 允許為空並於摘要值標示（FR-010s-2），不阻擋儲存。取消勾選某審核員時，若其 `arbiter_ids` 亦被勾選，MUST 同步取消並於儲存前提示。

編輯區塊 MUST 載明：仲裁時另受非當事人限制（對該審核單位已提交審核者不得仲裁該單位，`annotation/015-annotation-workspace` FR-060），且系統 MUST NOT 因某審核員恰為該筆的標記員而排除其審核指派。

#### Scenario: 仲裁者候選限於已勾選審核員
- **GIVEN** 任務有 4 位啟用中審核員，其中 2 位被勾選為 `審核員`
- **WHEN** 專案負責人展開 `仲裁者` 勾選清單
- **THEN** 候選恰為該 2 位被勾選的審核員
- **AND** 取消勾選其中一位審核員時，其仲裁者勾選同步取消並於儲存前提示

#### Scenario: 名冊以不透明 user id 儲存而非 Email
- **GIVEN** 專案負責人於審核設定勾選審核員「王小明」並儲存
- **WHEN** 檢視該任務的 `reviewer_ids`
- **THEN** 其元素為 `REVIEWER_ROSTER` 之 id（形如 `reviewer_wang`），不含任何 Email 字串
- **AND** 審核工作分派與審核員身分比對皆以該 id 為鍵，Email 僅出現於成員清單顯示欄

### Requirement: FR-010s-2 仲裁者摘要值規則

`仲裁者` 欄位之摘要值 MUST 依下列規則產生：`arbiter_ids` 為空 → `未指定仲裁者`；已指定 → `仲裁者 N 人`。

**v3.0.0 修訂**：原規則之 `停用` 與 `啟用 · ...` 前綴隨 `arbitration_enabled` 移除而刪除——仲裁不再是可停用的選配。

#### Scenario: 摘要值不含啟用停用前綴
- **GIVEN** 某任務已勾選 2 位仲裁者
- **WHEN** 檢視審核設定區塊
- **THEN** `仲裁者` 摘要值為 `仲裁者 2 人`，不含 `啟用` 或 `停用` 字樣

### Requirement: FR-010t 發布前的成員人數檢查

發布 `新增試標回合 R{n}` 或 `開始正式標記` 前，系統 MUST 驗證實際啟用成員人數：

1. `membership_status = active` 且 `task_role = annotator` 的人數 `>= min_annotators`；
2. 被勾選為審核員（`reviewer_ids`）且 `membership_status = active` 的人數 `>= 1`。

任一條件不足時，系統 MUST 阻擋發布，並逐角色顯示缺口訊息「還差 N 位」（`N = 應有人數 - 實際人數`）。發布前檢查 MUST NOT 僅驗證抽樣／審核設定值本身（決策 D3，issue #189）。

`arbiter_ids` 為空時 MUST NOT 阻擋發布，但 MUST 於發布確認顯示警示：未指定仲裁者時，爭議項將無人可仲裁而堆積於爭議池，任務將無法結案（FR-008b 第 3 項）。

**v3.0.0 修訂**：原「active reviewer 人數 `>= min_reviewers`」改為上列第 2 項——`min_reviewers` 已移除，審核只需至少一位被勾選的審核員即可運作。

#### Scenario: 未勾選審核員時阻擋發布
- **GIVEN** 某 `draft` 任務有足額標記員但 `reviewer_ids` 為空
- **WHEN** 專案負責人點擊 `新增試標回合 R1`
- **THEN** 發布被阻擋並顯示審核員「還差 1 位」
- **AND** 另一任務已勾選審核員但未勾選仲裁者時發布不被阻擋，僅於確認畫面顯示無仲裁者的警示

## ADDED Requirements

### Requirement: FR-018 最終例外池

`annotation-progress` 頁籤 MUST 提供「最終例外池」區塊，作為專案負責人逐筆收尾爭議的入口。

1. **入口與計數**：區塊標題列 MUST 顯示待處置項目數；`0` 時 MUST 渲染空狀態（`最終例外池已清空`），MUST NOT 隱藏整個區塊——結案閘門（FR-008b）依賴此處為唯一可稽核的呈現點。
2. **清單欄位**：逐筆呈現樣本 ID、標記員帳號、審核員帳號、爭議的輸出類型、仲裁者帳號與其「兩者皆非」理由、落入例外池的時間。
3. **逐筆導頁**：每列 MUST 提供進入處置畫面的動作，導向 `annotation/015-annotation-workspace` FR-095 之收尾介面並攜帶完整審核單位身分（`task_id × run_type × annotator_id × sample_id`）與爭議項識別。
4. **權限**：本區塊 MUST 僅對 `project_leader` 呈現；其他角色 MUST NOT 看到此區塊，直連進入時 MUST 比照 FR-006 導回並提示無權限。
5. **run 分流**：清單 MUST 可依 `run_type` 篩選；`dry_run` 與 `official_run` 的例外項各自獨立計數，FR-008b 第 4 項之結案閘門 MUST 僅計 `official_run` 的待處置項目。

#### Scenario: SC-041 例外池清單與導頁
- **GIVEN** 某任務有 2 項 `official_run` 待處置例外
- **WHEN** 專案負責人開啟 `annotation-progress`
- **THEN** 「最終例外池」區塊標題顯示 2 項待處置，逐列呈現樣本 ID、標記員、審核員、爭議輸出類型、仲裁者與其理由
- **AND** 點擊任一列進入該爭議項的處置畫面，網址攜帶完整審核單位身分

#### Scenario: 非專案負責人看不到例外池
- **GIVEN** 操作者為 `reviewer`
- **WHEN** 其開啟 `annotation-progress`
- **THEN** 畫面上不存在「最終例外池」區塊
