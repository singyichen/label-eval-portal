## ADDED Requirements

### Requirement: FR-041 匯出層 BIO 序列推導契約（SC-033）

本規格為「自 `spans[]` 推導序列標記」的跨模組唯一權威來源（SSoT）。`task-management/013-task-new` v7.0.0 的 FR-003d-1 與 `annotation/015-annotation-workspace` v6.0.0 的 FR-024A-3 皆明文將此契約指名給本規格，其他模組 MUST NOT 另行定義或推導出不同語意。

新增規格常數：

- `EXPORT_TAGGING_SCHEMES = BIO | BIOES | IOB2`
- `EXPORT_DEFAULT_TAGGING_SCHEME = BIO`
- `EXPORT_TOKEN_UNITS = character | word`
- `EXPORT_DEFAULT_TOKEN_UNIT = character`
- `SPAN_TOKEN_ALIGNMENT_MODE = expand`（唯一模式，無其他選項）

契約規則：

1. **適用範圍**：本推導 MUST 僅適用 `sequence_tagging`。其正確性前提是 span 互不相交——該不變式由 `task-management/013-task-new` 的 `SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE` 將 `sequence_tagging` 的 `allow_overlapping` 鎖定為 `false` 所保證，因此扁平序列與 span 集合之間為雙射、壓縮無損。`entity_recognition` 允許重疊與巢狀，不具此性質，MUST NOT 套用本推導。
2. **決定性**：推導 MUST 為 `spans[]` 與原始文本的純函式。相同輸入在任何時間、任何執行環境重複匯出，MUST 產生逐字元相同的序列；MUST NOT 引入時間戳、隨機性、瀏覽器語系或本機設定作為輸入。
3. **方案屬於匯出，不屬於任務**：`EXPORT_TAGGING_SCHEMES` 之選擇 MUST 為匯出當下的輸出格式選項，MUST NOT 寫回任務 config、MUST NOT 影響任何既有標記，且同一份標記結果 MUST 可用不同方案重複匯出而不需要重新標記。
4. **字元級為預設**：`EXPORT_DEFAULT_TOKEN_UNIT = character` 時，每個字元即一個 token，span 的半開區間 `[start, end)` 直接對應 token 索引；`start` 位置給 `B-{label}`、`[start+1, end)` 給 `I-{label}`、未被任何 span 覆蓋的位置給 `O`。此路徑 MUST NOT 需要任何 tokenizer，MUST NOT 產生對齊誤差。
5. **方案轉換為表示層差異**：`BIOES` 於單字元／單 token span 給 `S-{label}`、多 token span 的末位給 `E-{label}`；`IOB2` 與 `BIO` 的標記集合相同，兩者差異僅在歷史命名，MUST 產生相同序列。三種方案 MUST 皆自同一組 span 推導，MUST NOT 各自維護獨立的轉換路徑。
6. **空集合**：某樣本無任何 span 時，MUST 輸出與文本等長的全 `O` 序列，MUST NOT 省略該樣本或輸出空陣列。

#### Scenario: AC-5.1 字元級 BIO 為預設且不需要 tokenizer
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`，某樣本文本為「台積電董事長出席」且已提交一筆 `{ start: 0, end: 3, label: "ORG" }`
- **WHEN** 使用者以預設設定匯出該任務
- **THEN** 匯出的序列為 `B-ORG`、`I-ORG`、`I-ORG`、`O`、`O`、`O`、`O`、`O`，長度等於文本字元數
- **AND** 匯出過程未使用任何切詞引擎，匯出檔 metadata 不含 `tokenizer.engine` 或 `tokenizer.version`
- **AND** 匯出檔記錄 `tagging_scheme` 為 `BIO`、`token_unit` 為 `character`
- **WHEN** 同一份標記結果改以 `BIOES` 匯出
- **THEN** 序列為 `B-ORG`、`I-ORG`、`E-ORG`、`O`、`O`、`O`、`O`、`O`，且任務 config 未被寫入任何標記方案欄位

#### Scenario: AC-5.2 相同輸入重複匯出產出相同序列
- **GIVEN** 某任務的 `sequence_tagging` 標記結果與匯出選項皆未變動
- **WHEN** 於不同時間、不同瀏覽器重複匯出兩次
- **THEN** 兩次匯出的序列逐字元相同
- **WHEN** 某樣本不含任何 span
- **THEN** 該樣本輸出與其文本等長的全 `O` 序列，未被省略、未輸出空陣列

### Requirement: FR-042 詞級 BIO 的 tokenizer metadata 與對齊擴張報告（SC-034）

`EXPORT_TOKEN_UNITS = word` 為進階選項。選用詞級時：

1. **可重現性**：匯出檔 metadata MUST 寫入 `tokenizer.engine` 與 `tokenizer.version`。缺少任一欄位時 MUST 阻擋該次匯出並說明原因——同一份 `spans[]` 在不同切詞引擎或版本下會得到不同序列，缺少此二欄位的資料集不可重現。
2. **對齊採擴張**：span 邊界落在 token 內部時，MUST 依 `SPAN_TOKEN_ALIGNMENT_MODE = expand` 擴張至涵蓋該 span 的**完整 token**。MUST NOT 截斷該 span、MUST NOT 丟棄該筆標記、MUST NOT 以「無法對齊」為由略過該樣本。
3. **擴張必須被看見**：匯出完成後 MUST 顯示「N 段標記因對齊被擴張」摘要（`N = 0` 時 MUST NOT 顯示該摘要），且該摘要 MUST 可展開，逐筆列出原始標記文字、擴張後文字與起訖 offset 差值。
4. **不回寫**：擴張 MUST 只發生於匯出產物中，MUST NOT 修改任何已儲存的 `spans[]`——標記員實際圈選的字元 offset 為權威值，沿用 `annotation/015-annotation-workspace` FR-052 的「`(start, end)` 為權威」語意。
5. **字元級不適用**：`EXPORT_TOKEN_UNITS = character` 時，MUST NOT 寫入 tokenizer metadata、MUST NOT 顯示擴張摘要（字元級不可能發生擴張）。

#### Scenario: AC-5.3 詞級匯出寫入 tokenizer metadata 並回報擴張
- **GIVEN** 某樣本文本為「台積電董事長出席」，已提交一筆涵蓋「董事」的 `{ start: 3, end: 5, label: "TITLE" }`，而所選切詞引擎將「董事長」切為單一 token
- **WHEN** 使用者選擇詞級匯出並指定切詞引擎
- **THEN** 該筆標記被擴張為涵蓋「董事長」的完整 token，未被截斷或丟棄
- **AND** 匯出檔 metadata 含 `tokenizer.engine` 與 `tokenizer.version`
- **AND** 匯出完成後顯示「1 段標記因對齊被擴張」摘要，展開後列出原始標記文字「董事」、擴張後文字「董事長」與 offset 差值
- **AND** 已儲存的 `spans[]` 仍為 `{ start: 3, end: 5, label: "TITLE" }`，未被回寫

#### Scenario: AC-5.4 缺少 tokenizer 版本時阻擋詞級匯出
- **GIVEN** 使用者選擇詞級匯出，但所選引擎未提供版本資訊
- **WHEN** 觸發匯出
- **THEN** 該次匯出被阻擋並顯示可理解的原因，未產生任何匯出檔
- **WHEN** 使用者改回字元級匯出
- **THEN** 匯出正常完成，匯出檔不含 tokenizer metadata，且畫面未顯示任何擴張摘要

### Requirement: FR-043 未校準門檻型別的中性呈現（SC-035、SC-036）

新增規格常數 `IAA_UNCALIBRATED_TYPES = sequence_tagging`：主指標可計算、但平台尚未取得足以訂定門檻之實證資料的輸出類型集合。

1. **顯示數值與排序，不做門檻判定**：屬 `IAA_UNCALIBRATED_TYPES` 的輸出類型，quality tab MUST 顯示其主指標點估計值，並 MUST 支援跨標記員與跨樣本的排序呈現；MUST NOT 顯示任何門檻值、MUST NOT 顯示達標／未達標判定文案、MUST NOT 套用達標綠或未達標紅色彩。該型別 MUST 以中性樣式標示「待實證校準」。
2. **不得偷渡預設門檻**：本規格 MUST NOT 為 `IAA_UNCALIBRATED_TYPES` 中的型別定義任何門檻常數、預設值或建議值；實作 MUST NOT 以任何硬編數字回退。門檻的訂定條件為：取得第一批 `dry_run` 實測分佈後，另開 change 依實證校準。
3. **與 `IAA_GATE_EXCLUDED_TYPES` 語意分離**：兩集合在 `x/y` 分母上的效果相同，但 MUST NOT 共用文案或狀態值。`IAA_GATE_EXCLUDED_TYPES`（現值 `free_text`）的語意是「永久沒有自動指標，由審核員評估」；`IAA_UNCALIBRATED_TYPES` 的語意是「已算出數值、暫不判定」。對未校準型別顯示「不適用—由審核員評估」為錯誤陳述，MUST NOT 發生。
4. **不阻擋流程**：未校準狀態 MUST NOT 阻擋使用者進入正式標記，亦 MUST NOT 使任務層級摘要落入 `fail`。
5. **其餘規則照常適用**：小樣本警示（`IAA_SMALL_SAMPLE_THRESHOLD`）、`De = 0` 的「無法計算」狀態、一致性最低樣本清單、標記員品質排名與邊界分歧分析對未校準型別 MUST 照常適用——未校準的是「門檻」，不是「指標」。

#### Scenario: AC-3.18 sequence_tagging 顯示 u-α 數值與排序但不判紅綠
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`，Dry Run 已完成且 u-α 可計算
- **WHEN** 進入品質監控 tab
- **THEN** 該型別子區塊顯示 u-α 點估計值與中性的「待實證校準」標示
- **AND** 畫面上不存在任何門檻數值、不存在達標或未達標文案、該數值未套用綠色或紅色
- **AND** 該子區塊的標記員品質排名照常依一致率排序顯示
- **AND** 顯示文案不是 `free_text` 使用的「不適用—由審核員評估」
- **WHEN** 完成標記員數 `n < IAA_SMALL_SAMPLE_THRESHOLD`
- **THEN** u-α 旁照常顯示中性「小樣本估計」警示徽章，點估計值照常顯示

## MODIFIED Requirements

### Requirement: FR-009L sequence_tagging 的統計總覽指標

`sequence_tagging` MUST 以已提交的 `spans[]` 為統計母體顯示三項指標：標籤類型（label）分佈、每句平均標記片段數、標記片段長度分佈。

**統計母體由 token 序列改為 span 集合（BREAKING）。** 原條文要求「依任務 `tokenization` 設定切分後的 token 序列」為母體、並「依任務 `scheme`（`BIO / BIOES / IOB2 / SINGLE`）解析後的 tag 類型聚合」；`tokenization` 與 `tagging_scheme` 兩個設定欄位已於 `task-management/013-task-new` v7.0.0 破壞性移除，該母體與該解析步驟皆無對象，MUST NOT 於任何路徑保留。

改版後的三項規則：

- `標籤類型（label）分佈`：直接依 span 的 `label` 聚合，MUST NOT 出現 `B-`／`I-`／`E-`／`S-`／`O` 任一前綴或標籤。一段 n 字的標記計為 **1 筆**，MUST NOT 計為 n 筆（與 `annotation/015-annotation-workspace` FR-024L 的口徑一致）。
- `每句平均標記片段數`：直接以樣本內 span 筆數計算平均值。「將連續同類型 tag 還原為片段」的還原步驟 MUST NOT 保留——span 本身即片段。
- `標記片段長度分佈`：MUST 以字元長度（`end - start`）計算，至少輸出 1、2、3、4+ 字元 buckets；MUST NOT 以 token 長度分桶。

`SequenceTaggingStats` 之 `tag_distribution` 欄位語意隨之改為標籤類型分佈（不含前綴），`span_length_distribution` 之單位改為字元。

#### Scenario: AC-2.7 sequence_tagging 的 stats 區塊以 span 為母體
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`，某樣本含一筆 3 字元的 `ORG` span 與一筆 2 字元的 `TITLE` span
- **WHEN** 進入統計總覽 tab
- **THEN** 顯示標籤類型（label）分佈、每句平均標記片段數、標記片段長度分佈三項
- **AND** 標籤類型分佈顯示 `ORG` 1 筆、`TITLE` 1 筆，未出現任何帶 `B-`／`I-`／`E-`／`S-` 前綴的項目，也未出現 `O`
- **AND** 該樣本的標記片段數為 2，未因字元數被放大為 5
- **AND** 標記片段長度分佈以字元長度分桶，畫面未出現任何以 token 為單位的長度說明

### Requirement: FR-012L sequence_tagging 的 IAA 主指標

`sequence_tagging` MUST 顯示 **Krippendorff 單位化 α（unitizing alpha，u-α）** 為主要指標，並 MUST 於 `OUTPUT_TYPE_IAA_REGISTRY` 中以 `span` 為計算單位登錄；該型別的門檻欄位 MUST 為空，計算前置規則欄位 MUST 記載 u-α 以連續體長度加權處理未標記區段。

**Token-level Alpha（nominal）與 `IAA_THRESHOLD_TOKEN = 0.75` 一併廢止（BREAKING）。** 兩者皆依附已不存在的 token 座標系：span 模型下沒有 token 陣列、沒有 `O` 標籤，「遮罩全體標記員皆標為 `O` 的 token」的遮罩對象不存在。該遮罩規則 MUST NOT 保留，且 MUST NOT 以任何 span 版本的等價規則取代——u-α 本就以連續體長度加權處理未標記區段，「`O` 佔多數造成指標虛高」的問題在新指標下不存在。`IAA_THRESHOLD_TOKEN` 為正式廢止常數，其識別名稱 MUST NOT 於規格、原型或測試中重新使用。

**本型別不設門檻（BREAKING）。** `sequence_tagging` 自本版起屬 `IAA_UNCALIBRATED_TYPES`：quality tab MUST 顯示 u-α 數值與排序，MUST NOT 顯示門檻、MUST NOT 做達標判定（完整語意見 FR-043）。此為刻意留白，MUST NOT 以任何預設數字填補。

u-α 的計算輸入沿用 FR-039 的既有規則不變：僅標記員原始標記、逐 `trial_round`、排除 `task-management-014` FR-005h 排除作業、bypass 視為缺值、`De = 0` 時顯示「無法計算」。

#### Scenario: AC-3.7 sequence_tagging 的主指標為 u-α 且不標示門檻
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`，Dry Run 已完成
- **WHEN** 進入品質監控 tab
- **THEN** 該型別子區塊顯示 Krippendorff u-α 為主要指標，計算單位標示為 span
- **AND** 畫面上不存在 `Token-level Alpha` 字樣、不存在 `IAA_THRESHOLD_TOKEN`、不存在任何門檻數值
- **AND** 畫面上不存在「遮罩全體標記員皆標為 `O` 的 token」或任何等價的遮罩說明
- **WHEN** 有效樣本數 `< 2` 或有效標記員數 `< 2`
- **THEN** 依 FR-039 顯示「無法計算」狀態並說明原因，未顯示 `0.00`

### Requirement: FR-013 IAA 數值與門檻比較結果的視覺標示

系統 MUST 以明確視覺（達標綠色／未達標紅色）標示各輸出類型 IAA 數值與門檻的比較結果，**但僅限實際具有門檻的輸出類型**。下列兩類 MUST 改用中性樣式，且兩者的文案 MUST NOT 互相沿用：

- `IAA_GATE_EXCLUDED_TYPES`（現值 `free_text`）：顯示「不適用—由審核員評估」，不套用達標／未達標色彩。
- `IAA_UNCALIBRATED_TYPES`（現值 `sequence_tagging`，本版新增）：顯示主指標點估計值與中性的「待實證校準」標示，不顯示門檻、不套用達標／未達標色彩，且 MUST NOT 顯示「不適用」語意的文案——該型別的指標是算得出來的。

#### Scenario: AC-3.8 free_text 與未校準型別皆以中性樣式呈現且文案不同
- **GIVEN** 任務 `outputs[]` 同時含 `free_text` 與 `sequence_tagging`
- **WHEN** 進入品質監控 tab
- **THEN** `free_text` 子區塊顯示「不適用—由審核員評估」，不計入自動 IAA，未顯示空白或 0
- **AND** `sequence_tagging` 子區塊顯示 u-α 點估計值與「待實證校準」中性標示
- **AND** 兩個子區塊皆未套用達標綠或未達標紅色彩
- **AND** `sequence_tagging` 子區塊未出現「不適用—由審核員評估」文案

### Requirement: FR-024A 任務層級 x/y 達標徽章

系統 MUST 依 `IAA_COMPOSITE_BADGE_FORMAT` 顯示任務層級 `x/y` 達標徽章；`x` 為主指標達標的輸出類型數，`y` 為 `outputs[]` 中**既不在 `IAA_GATE_EXCLUDED_TYPES`、也不在 `IAA_UNCALIBRATED_TYPES`** 的相異輸出類型數。

未校準型別無門檻可比較，因此 MUST NOT 進入 `x` 或 `y` 任一側；把它算進分母會使一個永遠無法達標的型別把 `IAA_COMPOSITE_GATE_RULE`（`pass ⟺ x == y AND y > 0`）永久鎖在未通過。`IAA_COMPOSITE_BADGE_FORMAT` 的「`· {N} 型排除`」後綴 MUST 同時涵蓋兩類排除型別，`N` 為兩集合於該任務 `outputs[]` 中命中的相異型別總數。

`y = 0`（`outputs[]` 中所有型別皆落入兩集合之一）時，MUST 依 FR-024B 輸出 `IAA_SUMMARY_STATES = not_applicable`，MUST NOT 顯示 `0/0` 或任何 `pass | fail | pending` 判定。

#### Scenario: AC-3.9 x/y 分母排除未校準型別
- **GIVEN** 任務 `outputs[]` 依序為 `single_label`、`sequence_tagging`、`free_text`，Dry Run 已完成且 `single_label` 達標
- **WHEN** 進入品質監控 tab
- **THEN** 依原順序逐型並列顯示三個子區塊
- **AND** 任務層級徽章顯示 `1/1 達標 · 2 型排除`，`sequence_tagging` 與 `free_text` 皆未計入分母
- **WHEN** 任務 `outputs[]` 僅含 `sequence_tagging` 與 `free_text`
- **THEN** 任務層級摘要狀態為 `IAA_SUMMARY_STATES = not_applicable`，未顯示 `0/0`，也未顯示任何 pass 或 fail 判定

### Requirement: FR-035 逐型一致性最低樣本清單

系統 MUST 為 `LOW_CONSISTENCY_SAMPLE_SCOPE`（7 型；`free_text` 除外）逐型提供「一致性最低樣本清單」，依 `DISAGREEMENT_SAMPLE_SORT` 由高到低排序，分歧度計算單位依輸出類型分別採用投票分裂度（`single_label` / `multi_label`）、標記值離散度（`single_dim` / `multi_dim`）或逐樣本 pairwise F1（`entity_recognition` / `relation_identification` / **`sequence_tagging`**）。

**`sequence_tagging` 的分歧度單位由「該樣本非 `O` token 分歧率」改為「該樣本的 pairwise span F1 strict」（BREAKING）**，與 `entity_recognition` 同口徑；`LowConsistencySampleEntry.divergence_metric_name` 之對應值由 `non_o_token_disagreement_rate` 改為 `pairwise_f1`。舊值 MUST NOT 保留，其識別名稱 MUST NOT 重新使用。

**逐樣本刻意不使用 u-α**：u-α 是語料層級的連續體單位化指標，於單一樣本上估計不穩定；主指標與逐樣本分歧度採用不同統計量為刻意選擇，MUST NOT 被視為不一致而「修正」為同一指標。

#### Scenario: AC-3.13 sequence_tagging 的分歧度以逐樣本 span F1 計算
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging` 與 `entity_recognition`，Dry Run 已完成
- **WHEN** 進入品質監控 tab
- **THEN** 兩個型別子區塊皆顯示「一致性最低樣本清單」，依 `DISAGREEMENT_SAMPLE_SORT` 由高到低排序
- **AND** `sequence_tagging` 清單的分歧度指標名稱為 `pairwise_f1`，畫面未出現 `non_o_token_disagreement_rate` 或任何以 token 為單位的分歧率說明
- **WHEN** `outputs[]` 含 `free_text`
- **THEN** 該型別不顯示此清單

### Requirement: FR-036 逐型標記員品質排名

系統 MUST 為 `ANNOTATOR_QUALITY_RANKING_SCOPE`（同 7 型；`free_text` 不參與）逐型提供標記員品質排名：`single_label` / `multi_label` 依與多數決一致率排序、`single_dim` / `multi_dim` 依與平均值的平均絕對偏差（MAD）由低到高排序、`entity_recognition` / `relation_identification` / **`sequence_tagging`** 依與合併聚合參考值（多標記員標記聚合後的參考集合，非任務 ground truth）的 F1 排序；排名 MUST 套用 `IAA_SMALL_SAMPLE_THRESHOLD` 小樣本警示規則，完成樣本數不足者顯示警示但 MUST NOT 自排名中剔除。

**`sequence_tagging` 的一致率單位由「與多數決 token 標記一致率」改為「與合併聚合參考值的 F1」（BREAKING）**；`AnnotatorQualityRankingEntry.metric_name` 之對應值由 `token_majority_agreement_rate` 改為 `f1_to_merged_reference`。舊值 MUST NOT 保留，其識別名稱 MUST NOT 重新使用。多數決在 span 模型下需要先把答案投影回 token 網格才能定義，該網格已不存在。

排名 MUST 對 `IAA_UNCALIBRATED_TYPES` 中的型別照常提供——未校準的是門檻，不是指標與排序。

#### Scenario: AC-3.14 sequence_tagging 的品質排名以 span F1 排序
- **GIVEN** 任務 `outputs[]` 含 `sequence_tagging`，三位標記員已完成 Dry Run
- **WHEN** 進入品質監控 tab
- **THEN** 該型別子區塊顯示標記員品質排名，一致率指標名稱為 `f1_to_merged_reference`
- **AND** 畫面未出現 `token_majority_agreement_rate` 或任何以多數決 token 一致率為名的欄位
- **WHEN** 某標記員完成樣本數 `< IAA_SMALL_SAMPLE_THRESHOLD`
- **THEN** 該標記員顯示小樣本估計警示且仍列於排名中，未被剔除
- **WHEN** `outputs[]` 含 `free_text`
- **THEN** 該型別不參與排名

### Requirement: FR-039 IAA 閘門語意跨模組唯一權威來源

本規格為 IAA（Inter-Annotator Agreement）閘門語意的唯一權威來源（SSoT）；`task-management-014`、`annotation-015` 及其他模組對 IAA 閘門行為的呈現須以本條為準，不得另行定義或推導出不同語意。核心語意如下：

1. **顧問性、非阻擋**：IAA 為顧問性指標，`waiting_iaa_confirmation`（或等義）狀態語意為「軟性警告 + 需人工確認」，非硬性閘門；α 未達 `OUTPUT_TYPE_IAA_REGISTRY` 門檻時系統必須顯示明顯警示，但不得阻擋使用者進入正式標記（承接並升格 FR-034 之既有語意為跨模組正典）。**本點僅適用於 `OUTPUT_TYPE_IAA_REGISTRY` 中實際登錄門檻的輸出類型**；屬 `IAA_UNCALIBRATED_TYPES` 者沒有門檻可比較，MUST NOT 顯示任何「未達門檻」警示，亦 MUST NOT 因此被視為未通過（其呈現規則見 FR-043）。此例外 MUST NOT 被解讀為放寬阻擋語意——未校準型別同樣不阻擋流程。
2. **輸入僅限標記員原始標記**：α 計算的輸入僅為標記員（`annotator`）於 `outputs[]` 各輸出類型的原始作答；審核員（`reviewer`）並非一位 rater，其審核修正值（`annotation/015-annotation-workspace` FR-051／FR-052 定義之審核單位差異）不得併入 α 計算。
3. **逐回合計算**：α 以單一試標回合（`trial_round`）為計算單位，不得跨回合累積計算。
4. **樣本或標記員數不足時必須顯示「無法計算」**：Krippendorff α 於 `De = 0`（有效樣本 `< 2` 或有效標記員 `< 2`）時數學上未定義；此情境系統必須顯示明確的「無法計算」狀態並說明原因，不得回退顯示 `0.00` 等任何數值，亦不得阻擋流程。本點對 nominal α 與單位化 α（u-α）同等適用。
5. **排除與停用成員**：被 `task-management-014` FR-005h 明確排除之標記作業（`ExcludedAnnotationAssignment`）不計入 α；已停用成員之既有標記仍計入 α（沿用 `task-management-014` FR-005l 既有語意）；本規格不重新定義前述兩條排除規則，僅引用其結果。
6. **Bypass 視為缺值**：標記員於某輸出類型 bypass 時，該筆作答於該 outKey 上視為缺值（missing value），不計入 α 之分母，不得視為一個與其他標記員實際答案比對的「空白答案」。

#### Scenario: AC-3.16 De = 0 顯示無法計算且未校準型別不顯示未達門檻警示
- **GIVEN** 任一輸出類型的有效樣本數 `< 2` 或有效標記員數 `< 2`（`De = 0`）
- **WHEN** 檢視該型別的主要 IAA 指標
- **THEN** 顯示明確的「無法計算」狀態並附說明原因，未顯示 `0.00` 或任何回退數值，且未阻擋使用者進入正式標記
- **WHEN** `outputs[]` 含 `sequence_tagging` 且其 u-α 可計算
- **THEN** 該型別未顯示任何「未達門檻」警示，也未被計入未通過
- **AND** 使用者仍可進入正式標記
