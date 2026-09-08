---
對應 Spec: specs/dataset/017-dataset-analysis-detail/spec.md
對應 Issue: #581
基準版本: 017 v2.2.2
目標版本: 017 v3.0.0
---

> **2026-09-08 範圍定位**：本 change 是 issue #581 三段拆分的**第三段（consumer / 匯出側）**。前兩段已 archive 並完成正典回寫：
>
> | 順序 | change | 對應正典 | 狀態 |
> |------|--------|---------|------|
> | ① | `seq-tagging-span-config` | `specs/task-management/013-task-new/spec.md` | 已 archive（013 v7.0.0） |
> | ② | `seq-tagging-span-workspace` | `specs/annotation/015-annotation-workspace/spec.md` | 已 archive（015 v6.0.0） |
> | ③ **本 change** | `seq-tagging-span-export-metrics` | `specs/dataset/017-dataset-analysis-detail/spec.md` | propose 中 |
>
> 前兩段各自留下一筆明文指名本 change 的待辦：`task-management/013-task-new` 的 FR-003d-1 寫明「BIO 序列改由匯出層自 `spans[]` 決定性推導，其契約由 `dataset/017-dataset-analysis-detail` 定義」；`annotation/015-annotation-workspace` 的 FR-024A-3 寫明「BIO 序列 MUST NOT 出現於 payload，其推導契約由 `dataset/017-dataset-analysis-detail` 定義」。本 change 即為該契約的落地處。

## Why

`sequence_tagging` 的座標系已於 change ①② 由「Token 網格 + 逐 token 完整 tag」改為「拖曳圈選 + 字元 offset `spans[]`」，但 `dataset/017` 仍停留在舊座標系，形成三處**指向已不存在契約的懸空引用**：

1. **統計母體引用已刪除的欄位**：`sequence_tagging` 分析規則寫「以任務 `tokenization` 設定（`character` / `word`，來源 `task-management-013` v6.3.0）切分後的 token 序列為準」與「依任務 `scheme`（`BIO / BIOES / IOB2 / SINGLE`）解析後的 tag 類型聚合」。`tokenization` 與 `tagging_scheme` 兩個設定欄位皆已於 `task-management/013-task-new` v7.0.0 破壞性移除，017 現行條文無法被任何資料滿足。
2. **主指標的計算單位已不存在**：`OUTPUT_TYPE_IAA_REGISTRY` 為 `sequence_tagging` 指定 Token-level Alpha（nominal），單位為 token，並附帶「遮罩全體標記員皆標為 `O` 的 token」規則。span 模型下不存在 token 陣列、不存在 `O` 標籤，此指標連同其遮罩規則皆無計算對象。
3. **BIO 序列失去產出位置**：BIO/BIOES/IOB2 在改版後既不是設定欄位、也不在標記 payload 中。若無人承接，平台將完全喪失產出序列標記資料集的能力——而這正是 `sequence_tagging` 這個輸出類型存在的目的。

維護者已於 issue #581 的 2026-08-31 與 2026-09-01 兩則留言逐項拍板本段的全部待決事項：`tagging_scheme` 移至匯出層並自 span 決定性推導、指標全面 span-level、IAA 改 Krippendorff 單位化 α（unitizing alpha，u-α），以及**廢止 `IAA_THRESHOLD_TOKEN = 0.75` 且不以任何數字取代**——在第一批 `dry_run` 實證資料到齊之前，平台只顯示數值與排序，不做紅綠達標判定。

`sequence_tagging` 之所以能安全地把 BIO 推導延後到匯出層，是因為 change ① 已把它的 `allow_overlapping` 鎖死為 `false`（`task-management/013-task-new` 的 `SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE`）：互不相交的 span 集合與扁平標記序列之間存在雙射，推導因此是無損且決定性的。`entity_recognition` 保留可設定的重疊與巢狀，不具此性質，故不適用本契約。

## What Changes

- **新增匯出層 BIO 序列推導契約（`dataset/017` 承接為跨模組唯一權威來源）**：新增規格常數 `EXPORT_TAGGING_SCHEMES = BIO | BIOES | IOB2`、`EXPORT_DEFAULT_TAGGING_SCHEME = BIO`、`EXPORT_TOKEN_UNITS = character | word`、`EXPORT_DEFAULT_TOKEN_UNIT = character`、`SPAN_TOKEN_ALIGNMENT_MODE = expand`。推導必須是 `spans[]` 與原始文本的**決定性純函式**：同一組輸入在任何時間、任何執行環境重複匯出，必須產生逐字元相同的序列。方案（BIO / BIOES / IOB2）是匯出當下的輸出格式選項，**不是任務設定欄位**，不寫回任務 config、不影響任何既有標記。
- **字元級 BIO 為預設，且不需要任何 tokenizer**：每個字元即一個 token，span 的半開區間 `[start, end)` 直接對應 token 索引，`start` 位置給 `B-`、其餘給 `I-`、未被任何 span 覆蓋者給 `O`。此路徑不存在對齊誤差，因此**不得**產生任何擴張報告，也**不得**於匯出檔寫入 tokenizer metadata。
- **詞級 BIO 為進階選項，選用時必須落實可追溯性**：詞級路徑需指定切詞引擎，且匯出檔 metadata **必須**寫入 `tokenizer.engine` 與 `tokenizer.version`——沒有這兩個欄位，同一份 `spans[]` 在不同引擎下會得到不同序列，資料集即不可重現。span 邊界落在 token 內部時，依 `SPAN_TOKEN_ALIGNMENT_MODE = expand` **擴張至涵蓋該 span 的完整 token**，不得截斷、不得丟棄該筆標記；匯出完成後必須顯示「N 段標記因對齊被擴張」摘要並可展開，逐筆列出原始標記文字、擴張後文字與 offset 差。
- **`sequence_tagging` 的 IAA 主指標由 Token-level Alpha 改為 Krippendorff 單位化 α（u-α）（BREAKING）**：u-α 直接以「標記者在連續文本上劃出的單位（span）」為計算對象，同時處理邊界分歧與類別分歧，不需要先把答案投影到 token 網格。`O` 標籤遮罩規則隨 token 座標系一併退場——u-α 的未標記區段本就以連續體長度加權處理，不存在「`O` 佔多數造成指標虛高」的問題，因此該規則不是被換掉，而是**問題本身消失**。
- **廢止 `IAA_THRESHOLD_TOKEN = 0.75`，且不以任何數字取代（BREAKING）**：新增規格常數 `IAA_UNCALIBRATED_TYPES = sequence_tagging`。屬於此集合的輸出類型，平台**只顯示 u-α 點估計值與跨標記員／跨樣本的排序**，**不顯示門檻值、不做達標判定、不套用達標綠／未達標紅色彩**，並以中性樣式標示「待實證校準」。此為刻意的空白，不是遺漏：u-α 在本平台尚無任何實測分佈，任何門檻數字都是憑空猜測；校準所需的第一批 `dry_run` 資料到齊後，再另開 change 依實證訂定門檻。
- **`IAA_UNCALIBRATED_TYPES` 不計入 `x/y` 達標徽章分母**：未校準型別無達標判定，`y` 只計「不在 `IAA_GATE_EXCLUDED_TYPES` 且不在 `IAA_UNCALIBRATED_TYPES`」的相異輸出類型數。它與 `IAA_GATE_EXCLUDED_TYPES`（現值 `free_text`）在分母上的效果相同，但**呈現語意不同且不得共用文案**：`free_text` 是「不適用—由審核員評估」（永久沒有自動指標），未校準型別是「已算出數值、暫不判定」（有數值、待校準）。
- **`sequence_tagging` 的統計總覽改以 span 為母體（BREAKING）**：`標記類型（tag）分佈` 改為 `標籤類型（label）分佈`——span 模型下的值是 `label` 本身，不帶 `B-`／`I-`／`E-`／`S-` 前綴，一段 n 字實體計為 1 筆而非 n 筆（與 `annotation/015-annotation-workspace` FR-024L 的口徑一致）；`每句平均標記片段數` 直接數 span 筆數，不再需要「將連續同類型 tag 還原為片段」的還原步驟；`標記片段長度分佈` 改以**字元長度**計算（`end - start`），不再以 token 長度計算。
- **一致性最低樣本清單與標記員品質排名的 `sequence_tagging` 計算單位改為 span-level**：分歧度由「該樣本非 `O` token 分歧率」改為「該樣本的 pairwise span F1 strict」（與 `entity_recognition` 同口徑，`divergence_metric_name` 由 `non_o_token_disagreement_rate` 改為 `pairwise_f1`）；品質排名由「與多數決 token 標記一致率」改為「與合併聚合參考值的 F1」（`metric_name` 由 `token_majority_agreement_rate` 改為 `f1_to_merged_reference`）。**逐樣本刻意不使用 u-α**：u-α 是語料層級的連續體單位化指標，在單一樣本上估計不穩定；主指標與逐樣本分歧度用不同統計量是刻意選擇，非疏漏。
- **邊界分歧分析不變**：`BOUNDARY_DISAGREEMENT_SCOPE = entity_recognition | sequence_tagging` 與 `BOUNDARY_ERROR_TYPES = span_too_long | span_too_short | wrong_boundary` 本就以 span 措辭撰寫，在新座標系下語意完全成立，本 change **不修改**這兩條常數與 FR-037。

## Capabilities

### New Capabilities

- `dataset/017-dataset-analysis-detail`：**匯出層序列推導契約**（FR-041、FR-042）。本版以前，BIO 序列是任務建立時凍結的設定，平台從未定義過「如何從標記結果產生序列」；改版後這個轉換第一次成為需要明文規範的行為，且是 `sequence_tagging` 資料集能否被外部工具使用的唯一出口。017 承接它是因為 013 v7.0.0 與 015 v6.0.0 已分別明文把契約指名給本規格。
- `dataset/017-dataset-analysis-detail`：**未校準門檻型別的中性呈現狀態**（FR-043、`IAA_UNCALIBRATED_TYPES`）。本版以前，017 的 IAA 呈現只有兩種形狀——有門檻（判紅綠）與不適用（`free_text`，永久無指標）。「有數值但刻意不判定」是第三種狀態，既有常數與文案都無法表達；若不新增此狀態而沿用 `IAA_GATE_EXCLUDED_TYPES`，畫面會對一個實際算得出數值的型別顯示「不適用—由審核員評估」，那是錯誤陳述。

### Modified Capabilities

- `dataset/017-dataset-analysis-detail`：`OUTPUT_TYPE_IAA_REGISTRY` 的 `sequence_tagging` 列改版（指標、單位、門檻欄位）、`sequence_tagging` 統計規則與 IAA 主指標改版（FR-009L、FR-012L）、IAA 視覺標示新增未校準例外（FR-013）、`x/y` 徽章分母排除未校準型別（FR-024A）、逐型分歧度與品質排名的 `sequence_tagging` 計算單位改 span-level（FR-035、FR-036）、FR-039 第 1 點的「未達門檻警示」補上未校準型別的例外（FR-039）、`LowConsistencySampleEntry` 與 `AnnotatorQualityRankingEntry` 的 `sequence_tagging` metric 名稱、`SequenceTaggingStats` 欄位語意。

## Impact

**規格**

- 正典：`specs/dataset/017-dataset-analysis-detail/spec.md`（v2.2.2 → **v3.0.0**，MAJOR：主指標更換、門檻常數廢止、統計母體與計算單位更換）
- 衍生檢視：`openspec/specs/017-dataset-analysis-detail/spec.md`（archive 時自動合併）。delta 置於 `specs/dataset/017-dataset-analysis-detail/spec.md`（雙層，與 `add-user-path-map-freshness-check` 及全部封存 change 一致）；本機 `~/Library/pnpm/openspec` v1.10.0 可正確探測雙層路徑（change ① 記載的「只認單層」為 v1.4.1 時期的觀察，issue #639 已實證推翻並修正）。
- 上游（本 change 不修改，僅引用）：`specs/task-management/013-task-new/spec.md`（`SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE`、`SPAN_SNAP_UNITS`、FR-003d-1 指名的契約歸屬）、`specs/annotation/015-annotation-workspace/spec.md`（`spans[]` 儲存契約與 FR-052 CompactAnswer 形狀 `{ text, label, start, end }`）
- 下游（本 change 不修改）：匯出對話框與匯出檔 metadata 欄位由 `specs/_archive/014-task-detail/spec.md` 擁有（匯出記錄表、`匯出 JSON` / `匯出 JSON-MIN`、匯出條件快照）。017 只定義推導契約本身，**不定義對話框 UI**；兩者的接縫列為待裁決事項（見 `design.md` 的 D3）
- `specs/_shared/constants.md`：經查證**不含** `IAA_THRESHOLD_TOKEN` 或 `SEQUENCE_TAGGING_SCHEMES` 任一定義（issue #581 表格所列該列為誤記，change ① 已記載同一結論），本 change 不修改該檔
- 流程同步：`specs/STATUS.md` 之 `dataset-017` 列由 `spec-ready` 改為 `change-open`。**附帶校正兩處既有不一致**：該列現寫 `spec v2.2.1`（正典 frontmatter 已是 `2.2.2`，v2.2.2 於 2026-09-07 合併時漏更 STATUS）、branch 欄現寫 `fix/dataset-analysis-risk-action-nav`（正典 frontmatter 為 `feat/dataset/017-dataset-analysis-detail`，兩者不符會使 `scripts/check-sdd.sh` 回報 `ACTIVE_CHANGE_STAGE`）

**ADR**

- `docs/adr/029-output-type-composition.md`：catalog 的 `sequence_tagging` 列（Annotation UI 寫 `Token-level tagging`、Config 寫 `tagging_scheme`、Scoring Metrics 寫 `token_f1` / `token_accuracy`）——change ① 已明文把這一列延後到本 change 一次改到最終狀態，避免同一行被三個 change 反覆改寫。本 change 承接。

**產品文件**

- `docs/product/e2e/issue-180/phase3-drafts/w7-iaa-research-review.md`：第 53 行引用 `IAA_THRESHOLD_TOKEN = 0.75` 並附一則已失效的行號參照（`spec.md:83`）。該檔為 issue #180 的歷史調研草稿，非現行契約；本 change 於文件同步時一併標註其為歷史紀錄，不改寫其結論。
- `docs/product/` 其餘敘述層文件：沿用 change ① 的處置——待本 change 落地後以單一文件同步 PR 一次處理。

**原型程式（Principle X 之產品檔案盤點）**

| 檔案 | 變更 |
|------|------|
| `design/prototype/pages/dataset/dataset-analysis-detail.partials/quality-sequence_tagging.html` | 主指標改 u-α、移除門檻與紅綠判定、加上「待實證校準」中性標示、分歧度與排名指標名稱改 span-level |
| `design/prototype/pages/dataset/dataset-analysis-detail.partials/stats-sequence_tagging.html` | tag 分佈改標籤類型分佈、片段長度分佈改字元長度 |
| `design/prototype/pages/dataset/dataset-analysis-detail.html` | 逐型 registry 與 i18n 文案、`x/y` 徽章分母計算 |
| 匯出推導模組（路徑待裁決，見 `design.md` D3） | 字元級／詞級 BIO 推導與擴張報告 |

共 4 個手寫產品檔案；quality partial 與 detail shell 的改寫 diff 合計會超過 300 行，依 Constitution Principle X 拆為四個 stacked PR（分組見 `tasks.md`）。

**測試**

- `design/prototype/tests/dataset/dataset-analysis-detail-sequence-tagging-i18n.spec.ts`（既有斷言鎖定 Token-level Alpha 與門檻文案，須整體改寫）
- `design/prototype/tests/dataset/dataset-analysis-detail-composite-badge.spec.ts`（`x/y` 分母排除未校準型別）
- `design/prototype/tests/dataset/dataset-analysis-detail-registry-mirror.spec.ts`（registry 鏡像斷言）

## Constitution Check

| 原則 | 檢核 |
|------|------|
| **Generalization-First（NON-NEGOTIABLE）** | ✅ 通過，且**強化**。`IAA_UNCALIBRATED_TYPES` 為 registry 驅動的集合常數，不是對 `sequence_tagging` 的硬編分支；匯出層的方案與單位皆為 `EXPORT_TAGGING_SCHEMES` / `EXPORT_TOKEN_UNITS` 枚舉驅動。改版後 `sequence_tagging` 與 `entity_recognition` 的逐樣本分歧度與品質排名口徑收斂為同一組 span-level 計算，減少一條型別專屬路徑。 |
| **Data Fairness（NON-NEGOTIABLE）** | ✅ 通過。本 change 只改既有已提交標記結果的呈現與匯出轉換，不新增任何資料讀取路徑；匯出沿用 `specs/_archive/014-task-detail/spec.md` 既有的 run stage 與資料隔離規則，不因新增序列欄位而跨階段混用資料。 |
| **Principle X（PR 規模）** | ⚠️ 需拆分。quality partial 與 detail shell 的改寫 diff 必然 > 300 行 → 拆為四個 stacked PR，計畫寫入 `tasks.md`。 |
| **TDD** | ✅ 每個群組皆先由 `[@senior-qa]` 提交 Red 並保存預期失敗證據，Green 才開始；checkbox 僅由主 session／team lead 依證據更新。 |
| **PR Single Purpose** | ✅ 四個 PR 各自單一目的：PR A =「quality tab 的 `sequence_tagging` 主指標改 u-α 並停用門檻判定」；PR B =「stats tab 的 `sequence_tagging` 統計母體改 span」；PR C =「匯出層 BIO 推導契約落地」；PR D =「archive 與正典回寫」。 |
| **Simplicity First** | ✅ 淨移除多於新增：`IAA_THRESHOLD_TOKEN`、`O` 標籤遮罩規則、tag 前綴解析、token 還原片段步驟、token 長度分桶全部消失，換入一組匯出層枚舉與一個未校準狀態。刻意不引入任何預設門檻數字，也刻意不為逐樣本分歧度另造新指標名稱（沿用 `entity_recognition` 既有的 `pairwise_f1` 與 `f1_to_merged_reference`）。 |
