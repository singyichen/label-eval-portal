# 核心資料模型 ER 圖（跨模組）

> 對應 issue #669。本圖整合 11 份 feature spec 的「關鍵實體」段落，是動工寫 migration 前的唯一整合視圖。
> **受眾為工程師與 migration 作者**，因此圖面一律保留 spec 的原始識別字（`sample_id`、`run_type`、`min_reviewers` …），不做中文化——翻譯後就無法用 `grep` 回到正典條文。

- **正典來源**：各 `specs/[module]/NNN-feature/spec.md` 的 `### 關鍵實體` 段落。本圖為**衍生視圖**，不是正典；spec 與本圖衝突時以 spec 為準。
- **不歸屬任何單一 spec**，因此放在 `docs/diagrams/architecture/`，不隨任何 spec 進 `specs/_archive/`。
- **本圖不新增、不修改任何規格**。所有實體名、欄位名、FR ID 皆可在來源 spec 中以 `grep` 逐字定位。

---

## 讀圖規則（先讀這段再看圖）

本專案的資料模型有三種截然不同的實體性質，**混淆它們會直接寫錯 migration**：

| 標記 | 性質 | 落地行為 | 例子 |
|------|------|---------|------|
| `[persisted]` | 持久化實體 | 應建資料表 | `TaskDetail`、`AnnotationRecord` |
| `[derived]` | 推導實體 | **不得建表**，每次讀取時即時算出 | `ReviewUnit.status`、`DisputeItem` |
| `[projection]` | 唯讀投影 / 凍結快照 | 不獨立寫入，讀自上游實體 | `TaskProfile`、`IAACompositeSummary` |

兩個最容易踩雷的點：

1. **`ReviewUnit` 沒有單一主鍵。** 它以 `sample_id × annotator_id × run_type` 三欄複合定址（`REVIEW_UNIT_DIMENSIONS`，annotation-015 FR-051）。同一樣本由 N 位標記員標記，就是 N 個各自獨立、狀態互不影響的審核單位。任何「給 ReviewUnit 一個自增 id」的設計都會讓這條不變式失守。
2. **`DisputeItem` 是推導出來的，不是存下來的。** 它依 `outKey × 合併鍵` 由 FR-052 的差異比對即時推導（`DISPUTE_ITEM_SOURCE = derived-from-review-diffs`，annotation-015 FR-059）。**只有 `votes[]` 與 `finalized_value` / `finalized_by` 是真正的寫入狀態**，其餘欄位一旦落地就會與審核單位狀態機漂移。

---

## 圖 1 — 核心骨幹（整合總覽）

只畫貫穿全系統的主鏈：帳號 → 任務 → run 抽樣 → 標記清單 → 標記 → 審核 → 品質。欄位細節見圖 2～圖 5。

```mermaid
erDiagram
    PlatformUser  ||--o{ TaskMembership : "user_id"
    PlatformUser  ||--o{ AnnotationRecord : "annotator_id"
    PlatformUser  ||--o{ ReviewDecision : "reviewer_id"

    TaskDetail    ||--o{ TaskMembership : "task_id"
    TaskDetail    ||--|| TaskConfig : "凍結設定"
    TaskDetail    ||--|| TaskGuidelineConfig : "任務說明設定"
    TaskDetail    ||--o{ TrialRound : "task_id"
    TaskDetail    ||--o{ SampleSnapshot : "task_id"
    TaskDetail    ||--o{ ReviewAssignment : "task_id"

    TaskConfig    ||--|{ OutputConfig : "outputs 陣列"
    TaskConfig    ||--|| TaskProfile : "發布後凍結為唯讀投影"

    SampleSnapshot ||--o{ AnnotationListMaterialization : "sample_snapshot_id"
    AnnotationListMaterialization ||--|{ AnnotationListItem : "建立標記清單"

    AnnotationListItem ||--o| AnnotationRecord : "sample_id"
    AnnotationListItem ||--o{ AnnotationHistoryItem : "樣本歷程事件"
    AnnotationRecord   ||--|{ OutputAnswer : "answers 陣列"

    AnnotationRecord ||--o| ReviewUnit : "推導：未提交即不成立審核單位"
    ReviewUnit  ||--o| ReviewDecision : "待定 issue 688 至多一筆"
    ReviewUnit  ||--o{ DisputeItem : "推導：outKey x 合併鍵"
    ReviewAssignment }o--|| ReviewUnit : "待定 issue 688 review_unit_id"

    ReviewUnit ||--o{ OutputTypeIAAReport : "逐輸出類型聚合"
    ReviewUnit ||--o{ AnnotatorModificationRateEntry : "modified_units 分子"
```

---

## 圖 2 — 身分與權限（account 001～005、admin 006／007）

```mermaid
erDiagram
    PlatformUser {
        string id PK "admin-006"
        string name
        string email
        string system_role FK "user 或 super_admin"
        string status "UserStatus: active 或 disabled"
        datetime created_at
    }
    User {
        string name "account-005 的同一帳號側寫"
        string contact_info
        string avatar_url
        string hashed_password
        string email "可更新，經 EmailChangeRequest"
    }
    EmailChangeRequest {
        string user_id FK
        string pending_email
        string verification_token
        datetime expires_at
        datetime last_sent_at
        datetime verified_at "每位使用者同時最多一筆 active"
    }
    Session {
        string user_id FK "多裝置登入狀態；密碼更新後其他裝置失效"
    }
    NotificationPreference {
        string user_id FK
        string event_key "僅限 account-005 列出的六項事件"
        boolean in_app_enabled
        boolean email_enabled
    }
    UserManagementAuditLog {
        string actor_user_id FK
        string target_user_id FK
        string action_type
        json before
        json after
        datetime created_at
    }
    SystemRole {
        string role_key PK "user 或 super_admin"
    }
    TaskRole {
        string role_key PK "project_leader 或 reviewer 或 annotator"
    }
    RolePermissionMatrix {
        string role_type PK "system 或 task"
        string role_key PK
        string permission_key PK
        boolean allowed
    }
    RolePermissionVersion {
        string version "或 etag，用於儲存衝突檢測"
    }

    PlatformUser ||--|| User : "同一帳號的兩份規格視角"
    PlatformUser }o--|| SystemRole : "system_role"
    PlatformUser ||--o{ EmailChangeRequest : "user_id"
    PlatformUser ||--o{ Session : "user_id"
    PlatformUser ||--o{ NotificationPreference : "user_id"
    PlatformUser ||--o{ UserManagementAuditLog : "actor_user_id 與 target_user_id"
    SystemRole   ||--o{ RolePermissionMatrix : "role_type = system"
    TaskRole     ||--o{ RolePermissionMatrix : "role_type = task"
    RolePermissionMatrix ||--|| RolePermissionVersion : "樂觀鎖版本欄"
```

---

## 圖 3 — 任務設定與 run 生命週期（task-management 010／013／014）

```mermaid
erDiagram
    TaskDetail {
        string task_id PK
        string task_name
        string task_type
        string status
        string run_stage "dry_run 或 official_run"
        json settings
        number sampling_value "每回合抽樣筆數"
        json trial_round "唯讀 round 狀態資訊"
        json target_agreement_overrides "逐輸出類型目標 IAA 覆寫"
        number min_annotators
        boolean isolation_enabled
        number min_reviewers "待定 issue 688 預設 1，與 015 FR-093 單人接力衝突"
        string review_assignment_mode "待定 issue 688 REVIEW_ASSIGNMENT_MODES = auto 或 manual"
        boolean agreement_auto_finalize "待定 issue 688 預設 true"
        boolean arbitration_enabled
        json arbiter_ids "仲裁者名冊，非新的 task_role"
        string sample_snapshot_id FK
    }
    TaskConfig {
        json categories
        json input_types
        json outputs "OutputConfig 陣列，ADR-029 組合模型"
        json field_role_map "資料集欄位到 FieldRole 的對應"
        string dataset_file_name
    }
    OutputConfig {
        string type "OUTPUT_TYPE_KEYS 八選一"
        json config "欄位由 OUTPUT_TYPE_REGISTRY 驅動"
        boolean allow_bypass "共通欄位，預設 true"
    }
    TaskGuidelineConfig {
        string annotator_guideline_text
        json annotator_guideline_assets
        string reviewer_guideline_text
        json reviewer_guideline_assets
        boolean force_guideline "顯示策略旗標，異動不觸發版本遞增"
        string guideline_version "四個內容欄位異動並儲存時遞增，見 014 FR-017a"
    }
    TaskMembership {
        string task_id PK
        string user_id PK
        string task_role FK
        string membership_status
    }
    TrialRound {
        string task_id PK
        number round PK
        number sampling_value "恆等於對應 materialization 的 item_count"
        string guideline_version FK "建立當下寫入，不隨後續指引異動回填"
        string prior_round_findings "round 大於等於 2 時必填"
        string guideline_change_summary "允許值含 no_change"
        string no_change_reason "guideline_change_summary 為 no_change 時必填"
    }
    SampleSnapshot {
        string sample_snapshot_id PK
        string task_id FK
        number sampling_value
        number trial_round
        json target_agreement_overrides
        number min_annotators
        datetime locked_at
        string locked_by FK
        string selection_manifest_ref "指向分片或外部清單，不內嵌大量 ids"
    }
    AnnotationListMaterialization {
        string task_id FK
        string run_stage "dry_run 或 official_run"
        number trial_round
        string sample_snapshot_id FK
        string source_sample_ids_ref
        number item_count "dry_run 等於 sampling_value"
        string created_by FK
        datetime created_at
    }
    ExcludedAnnotationAssignment {
        string task_id FK
        string run_stage
        number trial_round
        string assignment_id
        string sample_id
        string excluded_by FK
        datetime excluded_at
        string reason "不計入完成率、分布統計與 dry_run 的 IAA"
    }
    ReviewAssignment {
        string task_id FK "待定 issue 688 整個實體落在爭議區"
        string reviewer_id FK
        string review_unit_id FK "待定 issue 688 015 的審核單位無單一 id"
        datetime assigned_at
        string assigned_by FK
        string source "auto_rotation 或 manual 或 dispute_dispatch"
        string review_status "pending 或 done"
    }
    WorkLogEntry {
        string user_id FK
        string task_role FK
        date date
        datetime login_at
        datetime logout_at
        number online_duration
        number duration
        number annotated_count
        number reviewed_count
        number arbitrated_count "角色不適用者為 null"
        number avg_speed
        string run_stage
    }
    RunStateTransition {
        string from_status
        string to_status
        string triggered_by FK
        datetime triggered_at
    }
    IsolationAuditLog {
        string task_id FK
        boolean from_isolation_enabled
        boolean to_isolation_enabled
        string changed_by FK
        datetime changed_at
        string reason
    }

    TaskDetail ||--|| TaskConfig : "schema 驗證後的設定內容"
    TaskDetail ||--|| TaskGuidelineConfig : "任務說明設定"
    TaskDetail ||--o{ TaskMembership : "task_id"
    TaskDetail ||--o{ TrialRound : "task_id"
    TaskDetail ||--o{ SampleSnapshot : "task_id"
    TaskDetail ||--o{ RunStateTransition : "狀態轉換紀錄"
    TaskDetail ||--o{ IsolationAuditLog : "資料隔離設定審計"
    TaskDetail ||--o{ ExcludedAnnotationAssignment : "task_id"
    TaskDetail ||--o{ ReviewAssignment : "待定 issue 688 task_id"
    TaskConfig ||--|{ OutputConfig : "outputs 陣列"
    TaskGuidelineConfig ||--o{ TrialRound : "guideline_version 外鍵"
    TrialRound ||--o| SampleSnapshot : "trial_round"
    SampleSnapshot ||--o{ AnnotationListMaterialization : "sample_snapshot_id"
    TaskMembership ||--o{ WorkLogEntry : "user_id 與 task_role"
```

---

## 圖 4 — 標記與審核（annotation 015，v6.0.0）

全 spec 最複雜的實體群。**`ReviewUnit` 的複合鍵與 `DisputeItem` 的推導性質是本圖的核心。**

```mermaid
erDiagram
    TaskProfile {
        string task_id PK "projection：發布後凍結唯讀"
        string input_type "TASK_INPUT_TYPES"
        json outputs "OutputConfig 陣列"
        json field_role_map
        json item_pair_labels "僅 input_type 為 item_pair 時存在"
        json guidelineFiles "name、type、url"
        json materializedRuns "逐 run_type 的 round 與 total"
        boolean forceShowGuideline "沿用 013 的 force_guideline"
        string guidelineVersion "形狀留待後端接上時定義"
    }
    AnnotationListItem {
        string task_id PK "persisted：由 run 發布事件建立"
        string sample_id PK
        string run_type PK "dry_run 或 official_run"
        number trial_round
        string sample_snapshot_id FK
        string completion_status "任務建立時不得預先產生此資料"
        boolean locked
    }
    AnnotationRecord {
        string sample_id PK "persisted"
        string annotator_id PK
        json answers "OutputAnswer 陣列，依 outputs 順序"
        string note "整筆備註"
        number version
        string status "pending 或 saved 或 submitted"
        datetime submitted_at
    }
    OutputAnswer {
        string type PK "OUTPUT_TYPE_KEYS 八選一"
        boolean bypass "為 true 時其餘 payload 須為空"
        string note "該輸出類型專屬備註"
        number version
        json payload "依 type 分派的 payload 欄位"
    }
    ReviewDecision {
        string annotator_id PK "persisted：決策維度為標記員 x 輸出類型"
        string output_type PK
        string reviewer_id PK
        string decision "REVIEW_DECISIONS = approve 或 modify 或 bypass"
        json correction "八型全支援，含修正後結果與 diff"
        string reason "decision 為 modify 或 bypass 時必填"
        datetime decided_at
    }
    ReviewUnit {
        string sample_id PK "derived 定址：REVIEW_UNIT_DIMENSIONS 複合鍵 1 of 3"
        string annotator_id PK "複合鍵 2 of 3，無單一自增 id"
        string run_type PK "複合鍵 3 of 3，兩種 run_type 定址完全一致"
        string status "derived：REVIEW_UNIT_STATUS = pending 或 disputed 或 finalized"
        json reviewer_decisions "待定 issue 688 FR-093 令至多一筆，陣列形狀為相容保留"
        json diffs_by_output_type "依 FR-052 比對得出"
    }
    DisputeItem {
        string output_type PK "derived：DISPUTE_ITEM_SOURCE，不實體化儲存"
        string item_key PK "合併鍵，取自 FR-052 差異項的 key"
        json annotator_value "derived：僅存在於審核員側者為空值"
        json reviewer_values "待定 issue 688 Record 以 reviewer_id 為鍵，FR-093 令至多一筆"
        json votes "WRITE：仲裁裁定 arbiter_id、choice、voted_at"
        json finalized_value "WRITE：定案值"
        string finalized_by "WRITE：定案者"
    }
    AnnotationHistoryItem {
        string action PK "HISTORY_ACTIONS 九值，見 FR-086"
        string role "TASK_ROLES"
        string actor_id "真實操作者 ID，見 FR-050"
        datetime at
        string summary
        json result_snapshot "見 FR-087"
        datetime started_at "見 FR-088"
        number lead_time "見 FR-088，不得於 annotator 視角呈現"
        string reason "見 FR-089"
    }
    GuidelineAsset {
        string task_id PK "projection：來源為 TaskProfile.guidelineFiles"
        json files "name、type、url"
        string summary_text
        boolean gate_confirmed "指引閘門確認紀錄，見 FR-066"
    }

    TaskProfile ||--|{ AnnotationListItem : "task_id"
    TaskProfile ||--|| GuidelineAsset : "guidelineFiles"
    AnnotationListItem ||--o| AnnotationRecord : "sample_id"
    AnnotationListItem ||--o{ AnnotationHistoryItem : "樣本歷程事件"
    AnnotationRecord ||--|{ OutputAnswer : "answers 陣列，一至多筆"
    AnnotationRecord ||--o| ReviewUnit : "推導：標記員未提交則不成立"
    ReviewUnit ||--o| ReviewDecision : "待定 issue 688 reviewer_decisions 至多一筆"
    ReviewUnit ||--o{ DisputeItem : "推導：outKey x 合併鍵"
    ReviewDecision ||--o{ DisputeItem : "推導：與標記員一致者不得出現"
    ReviewDecision ||--o{ AnnotationHistoryItem : "審核動作寫入歷程"
```

---

## 圖 5 — 品質與統計（dataset 016／017）

```mermaid
erDiagram
    IAAStatusSummary {
        string task_id PK "projection：值為 IAA_BADGE_STATES"
        string iaa_status "含 not_applicable；只供列表徽章顯示"
    }
    OutputTypeIAAReport {
        string output_type PK "persisted 報告"
        string primary_metric_name
        number primary_metric_value
        number threshold
        string pass_state "free_text 以 not_applicable 取代數值欄位"
        json auxiliary_metrics
    }
    IAACompositeSummary {
        number x "projection：達標型別數"
        number y "納入分母型別數"
        json excluded_types
        string summary_state "IAA_SUMMARY_STATES"
    }
    AnnotatorModificationRateEntry {
        string task_id PK "見 017 FR-040"
        string run_type PK
        number trial_round
        string annotator_id PK
        string output_type PK "ANNOTATOR_MODIFICATION_RATE_SCOPE 八型全納"
        number modified_units "分子：經審核員實際更動答案之審核單位數"
    }
    AnnotatorRiskAssessment {
        string annotator_id PK
        string risk_level "normal 或 watch 或 high_risk 或 insufficient_data"
        json cause_types "ANNOTATOR_CAUSE_TYPES 陣列"
        number sample_count
        boolean insufficient_data
    }

    OutputTypeIAAReport ||--|| IAACompositeSummary : "逐型別報告聚合為任務層級摘要"
    IAACompositeSummary ||--|| IAAStatusSummary : "推導列表徽章狀態"
    AnnotatorModificationRateEntry }o--|| AnnotatorRiskAssessment : "同一 annotator_id"
```

跨模組銜接：`AnnotatorModificationRateEntry.modified_units` 的分子取自 annotation-015 FR-052 的差異比對結果，**不是**審核單位狀態欄——017 明載其「非 `REVIEW_UNIT_STATUS.MODIFIED`」。

---

## 圖 6 — 為什麼 `ReviewUnit.status` 與 `DisputeItem` 不能建表

這是本 issue 的核心動機：若把推導結果落地成資料表，狀態機就會與寫入來源漂移。

```mermaid
flowchart LR
    AR["AnnotationRecord<br/>標記員已提交答案<br/>persisted"]
    RD["ReviewDecision<br/>審核員逐 outKey 決策<br/>persisted"]
    DIFF["FR-052 差異比對<br/>CompactAnswer 共通形狀<br/>合併鍵順序無關集合比對"]
    RU["ReviewUnit.status<br/>derived：pending / disputed / finalized"]
    DI["DisputeItem<br/>derived：outKey x 合併鍵"]
    W["votes 與 finalized_value / finalized_by<br/>persisted：以審核單位定址儲存"]

    AR --> DIFF
    RD --> DIFF
    DIFF --> RU
    DIFF --> DI
    DI --> W
    W -.-> DI
```

- 每次讀取時重算，因此**結構上不可能**與審核單位狀態機漂移（FR-059 原文：「推導使爭議池在結構上不可能與審核單位狀態機漂移」）。
- `ReviewUnit.status` 沒有「設定為 disputed」這類操作，狀態隨決策自然推進（FR-051）。
- 唯一該落地的寫入狀態是仲裁票與定案值（虛線回饋箭頭）。
- 同理，014 的「審核負荷統計」與 015 FR-091 的清單彙總三項也都明訂「不儲存」／「不得另存第二份彙總資料」。

---

## 實體索引（來源可 grep 定位）

| 實體 | 性質 | 來源 spec | 版本 |
|------|------|----------|------|
| `PlatformUser`、`SystemRoleAssignment`、`UserStatus`、`UserManagementAuditLog` | persisted | `specs/admin/006-user-management/spec.md` | 1.0.9 |
| `RolePermissionMatrix`、`RolePermissionVersion`、`SystemRole`、`TaskRole` | persisted | `specs/admin/007-role-settings/spec.md` | 1.1.13 |
| `User`、`EmailChangeRequest`、`Session`、`NotificationPreference` | persisted | `specs/account/005-profile-settings/spec.md` | 1.2.10 |
| `TaskSummary`、`TaskMembership`、`TaskListQuery` | persisted／view | `specs/task-management/010-task-list/spec.md` | 2.1.1 |
| `TaskDraftInput`、`OutputConfig`、`TaskConfig`、`TaskGuidelineConfig`、`RunInitConfig` | persisted | `specs/task-management/013-task-new/spec.md` | 7.0.1 |
| `TaskDetail`、`ReviewAssignment`、`TrialRound`、`SampleSnapshot`、`AnnotationListMaterialization`、`ExcludedAnnotationAssignment`、`WorkLogEntry`、`RunStateTransition`、`IsolationAuditLog` | persisted | `specs/task-management/014-task-detail/spec.md` | 2.11.2 |
| `TaskProfile`、`GuidelineAsset` | projection | `specs/annotation/015-annotation-workspace/spec.md` | 6.0.0 |
| `AnnotationListItem`、`AnnotationRecord`、`OutputAnswer`、`ReviewDecision`、`AnnotationHistoryItem` | persisted | `specs/annotation/015-annotation-workspace/spec.md` | 6.0.0 |
| `ReviewUnit`、`DisputeItem` | **derived** | `specs/annotation/015-annotation-workspace/spec.md` | 6.0.0 |
| `IAAStatusSummary`、`TaskSummaryRow` | projection | `specs/dataset/016-dataset-analysis-list/spec.md` | 2.1.2 |
| `OutputTypeIAAReport`、`IAACompositeSummary`、`AnnotatorModificationRateEntry`、`AnnotatorRiskAssessment` | persisted／projection | `specs/dataset/017-dataset-analysis-detail/spec.md` | 2.2.1 |

已廢止、名稱保留不重用（**不得重新啟用**）：`AdjudicationItem`、`GoldRecord`（annotation-015 v4.0.0 廢止，見 FR-053）。

未入圖的來源 spec：`account/001`～`004`、`dashboard/012`、`shared/008` 的「關鍵實體」全為表單狀態、語言偏好或畫面 view model（`LoginFormState`、`LanguageState`、`DashboardViewModel` 等），不構成持久化資料模型，故不入 ER 圖。

---

## 規格待定：與 issue #688 重疊的關聯

issue #688 已複驗 `specs/task-management/014-task-detail/spec.md`（v2.11.2）與 `specs/annotation/015-annotation-workspace/spec.md`（v6.0.0）在審核指派模型上的六處矛盾。**本圖不裁定誰對**，凡涉及審核指派基數的關聯一律標為 `待定 issue 688`：

| 圖上位置 | 標記內容 | 衝突點 |
|---------|---------|-------|
| 圖 1、圖 4 | `ReviewUnit` 到 `ReviewDecision` 的關聯線 | 一對一還是一對多——015 FR-093 令每個指派對象恰一位審核員；014 的 `min_reviewers` 允許多位 |
| 圖 1、圖 3 | `ReviewAssignment` 到 `ReviewUnit` 的關聯線 | `ReviewAssignment.review_unit_id` 假設審核單位有單一 id，但 015 FR-051 的審核單位是三欄複合鍵，無單一 id 可指 |
| 圖 3 | `TaskDetail.min_reviewers` | 015 v5.0.0 已將 `MIN_REVIEWERS_DEFAULT` 廢止（單人接力下門檻恆為 1） |
| 圖 3 | `TaskDetail.review_assignment_mode` | `REVIEW_ASSIGNMENT_MODES = auto \| manual`；015 FR-093 規定審核工作「必須由系統自動指派」，`manual` 無對應 |
| 圖 3 | `TaskDetail.agreement_auto_finalize` | 預設 `true`；015 v5.0.0 已廢止 `DISPUTE_CONVERGENCE_RULE`，單人接力下不存在自動收斂路徑 |
| 圖 3 | `ReviewAssignment` 整個實體 | `source = auto_rotation \| manual \| dispute_dispatch` 三值中的 `manual` 與 `auto_rotation`（輪派至湊滿 `min_reviewers`）皆建立在已廢止的多審核員模型上 |
| 圖 4 | `ReviewUnit.reviewer_decisions`、`DisputeItem.reviewer_values` | 015 自身已註明「陣列／Record 形狀保留以維持既有讀取端相容」，實際基數為至多一筆 |

另有一項不屬 #688、但同樣待釐清：`reviewer_ids` 欄位在**全部 `specs/**/spec.md` 中零命中**（已複驗），卻已被實作端使用——這正是 #688 標題所指的缺漏。本圖不畫該欄位。

---

## 維護方式

Mermaid 原始碼即本檔內容，GitHub 與 VS Code 皆原生算繪，改一行就看得出改了什麼。**不另出 `.png`**（見 `docs/diagrams/README.md`）。

上游 spec 的「關鍵實體」段落異動時，須同步更新本圖與上方實體索引表的版本欄。
