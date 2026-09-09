# dataset/017-dataset-analysis-detail Specification

## Purpose
Dataset Analysis Detail（統計總覽 + 品質監控雙 Tab，Project Leader／Reviewer）的 derived view。正典為 `specs/dataset/017-dataset-analysis-detail/spec.md`（v2.2.2）；本文件僅收錄經 OpenSpec change 落地之需求，每條皆引用正典 FR/AC ID，不改動其正典措辭。收錄 change `seq-tagging-span-export-metrics`（issue #581）之 FR-009L／FR-012L／FR-013／FR-024A／FR-035／FR-036／FR-039（修訂）；此七條於該 change archive 前以正典 v2.2.2 原文建立基線，使 MODIFIED 有可比對的前值，archive 後基線內容即被完整取代。基線的 scenario 標題刻意採用 delta 的新標題——`openspec archive` 以標題比對判定 MODIFIED 是否丟失既有 scenario，標題不一致即中止；標題以下的條文仍為 v2.2.2 原文。

## Requirements

### Requirement: FR-009L sequence_tagging 的統計總覽指標

`sequence_tagging` 必須依任務 `tokenization` 設定（來源 `task-management-013`）顯示標記類型（tag）分佈、每句平均標記片段數與標記片段長度分佈。

#### Scenario: AC-2.7 sequence_tagging 的 stats 區塊以 span 為母體
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`
- **WHEN** 進入統計總覽 tab
- **THEN** 顯示標記類型（tag）分佈、每句平均標記片段數、標記片段長度分佈

### Requirement: FR-012L sequence_tagging 的 IAA 主指標

`sequence_tagging` 必須顯示 Token-level Alpha（nominal）為主要指標並標示 `IAA_THRESHOLD_TOKEN`；計算前必須先遮罩全體標記員皆標為 `O` 的 token（或等價僅納入非 `O` 位置），不得將全員一致的 `O` token 計入分子分母。

#### Scenario: AC-3.7 sequence_tagging 的主指標為 u-α 且不標示門檻
- **GIVEN** `outputs[]` 含 `sequence_tagging`
- **WHEN** 進入品質監控
- **THEN** 顯示 Token-level Alpha 為主要指標，計算前遮罩全體標記員皆標為 `O` 的 token，並標示 `IAA_THRESHOLD_TOKEN`

### Requirement: FR-013 IAA 數值與門檻比較結果的視覺標示

系統必須以明確視覺（達標綠色 / 未達標紅色）標示各輸出類型 IAA 數值與門檻比較結果；`free_text` 子區塊改用中性樣式顯示「不適用」狀態，不套用達標 / 未達標判定色彩。

#### Scenario: AC-3.8 free_text 與未校準型別皆以中性樣式呈現且文案不同
- **GIVEN** `outputs[]` 含 `free_text`
- **WHEN** 進入品質監控
- **THEN** 該輸出類型子區塊顯示「不適用—由審核員評估」狀態，不計入自動 IAA，且不得顯示空白或 0

### Requirement: FR-024A 任務層級 x/y 達標徽章

系統必須依 `IAA_COMPOSITE_BADGE_FORMAT` 顯示任務層級 `x/y` 達標徽章；`x` 為主指標達標的輸出類型數，`y` 為 `outputs[]` 中不在 `IAA_GATE_EXCLUDED_TYPES` 排除集的相異輸出類型數。

#### Scenario: AC-3.9 x/y 分母排除未校準型別
- **GIVEN** `outputs[]` 含多個輸出類型
- **WHEN** 進入品質監控
- **THEN** 依原順序逐型並列顯示各自 IAA 報告，並顯示任務層級 `x/y` 達標徽章（依 `IAA_COMPOSITE_BADGE_FORMAT`）

### Requirement: FR-035 逐型一致性最低樣本清單

系統必須為 `LOW_CONSISTENCY_SAMPLE_SCOPE`（`single_label` / `multi_label` / `single_dim` / `multi_dim` / `entity_recognition` / `relation_identification` / `sequence_tagging` 共 7 型；`free_text` 除外）逐型提供「一致性最低樣本清單」，依 `DISAGREEMENT_SAMPLE_SORT` 由高到低排序，且分歧度計算單位須依輸出類型分別採用投票分裂度（`single_label`/`multi_label`）、標記值離散度（`single_dim`/`multi_dim`）、逐樣本 pairwise F1（`entity_recognition`/`relation_identification`）或非 `O` token 分歧率（`sequence_tagging`）。

#### Scenario: AC-3.13 sequence_tagging 的分歧度以逐樣本 span F1 計算
- **GIVEN** `outputs[]` 含 `LOW_CONSISTENCY_SAMPLE_SCOPE` 中任一型別
- **WHEN** 進入品質監控
- **THEN** 該型別子區塊顯示「一致性最低樣本清單」，依 `DISAGREEMENT_SAMPLE_SORT` 由高到低排序，並依型別使用對應分歧度計算單位
- **AND** `outputs[]` 含 `free_text` 時，該型別不顯示此清單

### Requirement: FR-036 逐型標記員品質排名

系統必須為 `ANNOTATOR_QUALITY_RANKING_SCOPE`（同 7 型；`free_text` 不參與）逐型提供標記員品質排名：`single_label`/`multi_label` 依與多數決一致率排序、`single_dim`/`multi_dim` 依與平均值的平均絕對偏差（MAD）由低到高排序、`entity_recognition`/`relation_identification` 依與合併聚合參考值的 F1 排序、`sequence_tagging` 依與多數決 token 標記一致率排序；排名須套用 `IAA_SMALL_SAMPLE_THRESHOLD` 小樣本警示規則，完成樣本數不足者顯示警示但不得從排名中剔除。

#### Scenario: AC-3.14 sequence_tagging 的品質排名以 span F1 排序
- **GIVEN** `outputs[]` 含 `ANNOTATOR_QUALITY_RANKING_SCOPE` 中任一型別
- **WHEN** 進入品質監控
- **THEN** 該型別子區塊顯示「標記員品質排名」，依型別對應一致率計算方式排序
- **AND** 完成樣本數 `< IAA_SMALL_SAMPLE_THRESHOLD` 的標記員顯示小樣本估計警示但不被剔除
- **AND** `outputs[]` 含 `free_text` 時，該型別不參與排名

### Requirement: FR-039 IAA 閘門語意跨模組唯一權威來源

本規格為 IAA（Inter-Annotator Agreement）閘門語意的唯一權威來源（SSoT）；`task-management-014`、`annotation-015` 及其他模組對 IAA 閘門行為的呈現須以本條為準，不得另行定義或推導出不同語意。核心語意如下：

1. **顧問性、非阻擋**：IAA 為顧問性指標，`waiting_iaa_confirmation`（或等義）狀態語意為「軟性警告 + 需人工確認」，非硬性閘門；α 未達 `OUTPUT_TYPE_IAA_REGISTRY` 門檻時系統必須顯示明顯警示，但不得阻擋使用者進入正式標記（承接並升格 FR-034 之既有語意為跨模組正典）。
2. **輸入僅限標記員原始標記**：α 計算的輸入僅為標記員（`annotator`）於 `outputs[]` 各輸出類型的原始作答；審核員（`reviewer`）並非一位 rater，其審核修正值（`annotation-015` FR-051／FR-052 定義之審核單位差異）不得併入 α 計算。
3. **逐回合計算**：α 以單一試標回合（`trial_round`）為計算單位，不得跨回合累積計算。
4. **樣本或標記員數不足時必須顯示「無法計算」**：Krippendorff nominal α 於 `De = 0`（有效樣本 `< 2` 或有效標記員 `< 2`）時數學上未定義；此情境系統必須顯示明確的「無法計算」狀態並說明原因，不得回退顯示 `0.00` 等任何數值，亦不得阻擋流程。
5. **排除與停用成員**：被 `task-management-014` FR-005h 明確排除之標記作業（`ExcludedAnnotationAssignment`）不計入 α；已停用成員之既有標記仍計入 α（沿用 `task-management-014` FR-005l 既有語意）；本規格不重新定義前述兩條排除規則，僅引用其結果。
6. **Bypass 視為缺值**：標記員於某輸出類型 bypass 時，該筆作答於該 outKey 上視為缺值（missing value），不計入 α 之分母，不得視為一個與其他標記員實際答案比對的「空白答案」。

#### Scenario: AC-3.16 De = 0 顯示無法計算且未校準型別不顯示未達門檻警示
- **GIVEN** 任一輸出類型的有效樣本數 `< 2` 或有效標記員數 `< 2`（`De = 0`）
- **WHEN** 檢視該型別的主要 IAA 指標
- **THEN** 顯示明確的「無法計算」狀態並附說明原因，不得顯示 `0.00` 或任何回退數值
- **AND** 不阻擋使用者進入正式標記
