# 設計說明：seq-tagging-span-export-metrics

## 是否需要 design.md 的判斷

`docs/sdd-workflow.md` 與 CLAUDE.md 的規則是：**只有在 change 觸及 API contract 或 DB schema 時才需要 design.md**。本 change 的判斷結果是**需要**，理由與界線如下：

- **需要的部分（輸出契約）**：FR-041／FR-042 為匯出檔新增輸出欄位——`tagging_scheme`、`token_unit`、`tokenizer.engine`、`tokenizer.version`，以及對齊擴張報告。匯出檔是被下游研究流程（教授、外部工具、論文重現）直接消費的產物，欄位一旦定型即為對外契約，須在 propose 階段先把欄位語意、必填條件與失敗行為講清楚，不能留到 apply 期臨時決定。
- **不需要的部分（DB schema）**：本 change **不新增、不修改任何持久化 schema**。FR-042 第 4 點明文規定對齊擴張只發生於匯出產物，MUST NOT 回寫 `spans[]`；標記資料仍是 `annotation/015-annotation-workspace` FR-024A-3 定義的 `spans[]`。目前專案處於原型階段，尚無後端資料表，本 change 也不建立。
- **不需要的部分（HTTP API）**：本專案原型層無後端端點，匯出為前端產生檔案，故不涉及 REST 契約。

## 匯出輸出契約

匯出檔在既有 `task-management/014-task-detail` 匯出 metadata 之上，於 `sequence_tagging` 區段新增下列欄位：

| 欄位 | 值域 | 必填條件 | 說明 |
|---|---|---|---|
| `tagging_scheme` | `BIO \| BIOES \| IOB2` | 含 `sequence_tagging` 時必填 | 匯出當下選擇，預設 `BIO`；不寫回任務 config |
| `token_unit` | `character \| word` | 含 `sequence_tagging` 時必填 | 預設 `character` |
| `tokenizer.engine` | 字串 | `token_unit = word` 時必填 | 缺少即阻擋匯出 |
| `tokenizer.version` | 字串 | `token_unit = word` 時必填 | 缺少即阻擋匯出 |
| `alignment_mode` | `expand` | `token_unit = word` 時必填 | 目前唯一模式，保留欄位以便未來擴充時不破壞既有檔案讀取 |
| `expanded_span_count` | 整數 | `token_unit = word` 時必填 | 對齊擴張筆數，`0` 為合法值 |

`token_unit = character` 時，`tokenizer.*`、`alignment_mode`、`expanded_span_count` MUST NOT 出現——字元級不可能發生擴張，出現這些欄位會讓下游誤以為經過切詞。

## 為什麼推導放在匯出層而不是標記層

1. **無損可逆**：`sequence_tagging` 的 `allow_overlapping` 被鎖為 `false`（`task-management/013-task-new` v7.0.0），span 集合與扁平序列互為雙射，任何時間點都能重算，沒有必要提前固化。
2. **一份標記、多種輸出**：BIO／BIOES／IOB2 是同一組 span 的三種書寫方式。放在任務設定會讓「換一種格式」變成「重標一次」。
3. **避免 tokenizer 汙染標記資料**：詞級對齊必然依賴切詞引擎版本；把它留在匯出層，標記資料就永遠是純字元 offset，不因引擎升級而失效。

## 為什麼主指標改 u-α 而不是沿用 nominal α

Token-level nominal α 需要一個所有標記員共用的 token 網格才能逐格比對；span 模型下該網格不存在，且以字元當網格會讓長標記的權重被字數放大。Krippendorff 單位化 α（u-α）本來就是為「標記者自行決定單位邊界」的連續體設計，直接吃 `(start, end, label)`，不需要網格，也不需要 `O` 遮罩——未標記區段以連續體長度自然參與計算。

逐樣本分歧度與標記員排名刻意**不**用 u-α：u-α 是語料層級估計量，單一樣本上不穩定。這兩處改用 pairwise span F1 與對合併聚合參考值的 F1，與 `entity_recognition` 同口徑。

## 為什麼先不訂門檻（決策 3b 的設計後果）

本平台沒有任何 `sequence_tagging` 的 u-α 實測分佈。沿用 `IAA_THRESHOLD_TOKEN = 0.75` 只是把一個為別種指標訂的數字搬到新指標上——兩者值域性質不同，這個搬移沒有任何實證依據。因此本 change 的處置是：**顯示數值與排序、不判紅綠**，並在規格層明文禁止任何硬編回退值（FR-043 第 2 點）。

這在 UI 上產生第三種 IAA 呈現狀態，需要與既有狀態明確區隔：

| 狀態 | 集合 | 有數值嗎 | 文案 | 計入 `x/y` |
|---|---|---|---|---|
| 有門檻 | 其餘 6 型 | 有 | 達標／未達標（綠／紅） | 是 |
| 永久無自動指標 | `IAA_GATE_EXCLUDED_TYPES = free_text` | 無 | 不適用—由審核員評估 | 否 |
| 暫不判定 | `IAA_UNCALIBRATED_TYPES = sequence_tagging` | **有** | 待實證校準（中性） | 否 |

第三種狀態不得沿用第二種的文案：對一個算得出數值的型別說「不適用」是錯誤陳述。

## 裁決紀錄與待決事項

> D1、D2、D3、D5 已於 2026-09-08 由維護者逐項裁定，記錄於下；**D4 仍為待決**，須於 apply 前確認。實作者不得自行變更已裁決項，亦不得自行選擇 D4。

### 已裁決

- **D1 — 未校準型別以新常數表達** ✅ 裁定：**新增 `IAA_UNCALIBRATED_TYPES`**（草案選項）。理由是與 `IAA_GATE_EXCLUDED_TYPES` 語意不同——後者是「不適用—由審核員評估」，前者是「有數值但門檻未校準」；沿用單一集合會讓畫面對一個有 u-α 數值的型別顯示錯誤文案。代價是多一個常數與一條分支，維護者接受此代價。delta 依草案不需修改。
- **D2 — 「指標全面 span-level」的範圍** ✅ 裁定：**只改 `sequence_tagging`**（草案選項）。`entity_recognition` 維持既有 Pairwise Span F1 strict 主指標與其門檻不動——該型別本來就是 span-level，沒有 token 座標系遺留問題，一併換成 u-α 等於廢掉一個已校準的既有指標，屬 issue 未要求的範圍擴張。delta 依草案不需修改。
- **D3 — 匯出對話框 UI 的規格歸屬** ✅ 裁定：**本 change 不做 UI**（草案選項）。017 只定義推導契約與欄位語意；匯出入口、匯出記錄表與匯出 metadata 條文留在 `task-management/014-task-detail`（已封存），依「一 change 一正典」規則須另開以 014 為正典的 companion change 承接。本 change 的 tasks 中 UI 接線維持 blocked，不在本輪解除。
- **D5 — 015 遺留孤兒常數與 `SINGLE` 方案** ✅ 裁定兩項：
  - (a) **併入下一個以 015 為正典的 change 清除**，不另開 lightweight 清理。目前該 change 為 `carry-relation-span-offsets`（issue #590），其正典正是 `specs/annotation/015-annotation-workspace/spec.md`，且已規劃回寫 v6.1.0，可於該次回寫一併刪除第 31 行的孤兒宣告。本 change 的正典鎖定 017，依 lint 規則不得在此順手刪。
  - (b) **`SINGLE` 確定退場**。`EXPORT_TAGGING_SCHEMES` 維持 BIO／BIOES／IOB2 三案，不擴充、delta 不需補 `SINGLE` 的 scenario。

### 待決（apply 前必須裁定）

- **D4 — 推導模組的檔案落點**
  草案建議放在原型的共用模組層（與既有 `dataset-analysis-detail` partial 平行的共用 JS），而非塞進單一頁面檔，因為匯出（014 頁面）與統計（017 頁面）都會用到同一份推導。確切路徑未指定，待 apply 前由維護者確認，以免與正在進行的其他 change 撞檔。
