---
對應 Spec: specs/annotation/015-annotation-workspace/spec.md
對應 Issue: #590
基準版本: 015 v6.0.1
目標版本: 015 v6.1.0
---

## Why

正典 015 FR-087 要求「具位置資訊之類型（`entity_recognition`、`relation_identification`、`sequence_tagging`）必須逐實體列出新增、刪除與邊界變更三類差異」，但 `relation_identification` 至今無法滿足：`design/prototype/pages/shared/annotation-history.js:162` 之 `SPAN_EXTRACTORS` 只註冊 `entity_recognition` 與 `sequence_tagging` 兩型別，關係識別因此走純值比對遞補，FR-087 只能以「已知落差」記載此事並追蹤於 issue #590。

落差的根因不在差異比對層，而在答案結構本身。關係識別的引擎快照 `previewTriples` 只有 `subj`／`rel`／`obj` 三個**顯示字串**，位置資訊在產生的當下就被丟掉了：`task-config.engine.js:1895` 的 `fmtRelSpan()` 把 `start`／`end` 串成 `文字 (12,15)` 這種**給人看的字串**，機器無從解析；`task-config.engine.js:1857` 的物件形狀匯入分支同樣以區域 `fmt()` 串接。往返路徑也各自截斷：`annotation-workspace.data.js:1664` 的 `convertSubmissionAnswer()` 與 `annotation-workspace.config.js:2721` 的 `applyCompactAnswerToState()` 兩端都只保留三個鍵，即使上游補上起訖也到不了差異比對層。

因此本變更把落差收斂到**來源資料真的沒有位置資訊**的那一小塊，而不是整個型別：來源本身帶起訖的兩種形狀補齊位置維度，來源本身就是純字串的兩種形狀誠實留為已知落差，並且**明文禁止**以字串比對回原文猜測 offset——同一詞在文本中出現多次時猜測會選錯位置，且猜錯不會產生任何錯誤訊號，等於把「資料缺失」靜默換成「錯誤資料」。

## What Changes

- 新增 FR-098：定義 `relation_identification` 答案結構的位置資訊契約——`previewTriples` 每筆三元組於既有顯示字串之外攜帶 `subjStart`／`subjEnd`／`objStart`／`objEnd` 四個整數或 `null` 欄位，座標系沿用 `sequence_tagging` 的半開區間 `[start, end)`（FR-024A-3）。
- FR-098 明文界定來源範圍：僅**本身已攜帶位置資訊**的兩種形狀補齊——工作區關係建構器的互動標記（實體槽位已有 `start`／`end`）、資料集匯入的物件形狀三元組（`entity1`／`entity2` 已有 `start`／`end`）。
- FR-098 明文禁止推測：來源未帶位置資訊時四個欄位必須為 `null`，不得以答案字串回原始文本做字串比對推得 offset。
- FR-098 定義 CompactAnswer 往返對稱：`relation_identification` 之 CompactAnswer 自 `{ subj, rel, obj }` 擴充為七鍵，序列化與回填兩端必須同時保留，舊有三鍵資料缺鍵視同 `null`。
- FR-098 定義逐實體差異的索引鍵：抽取只產出主體與客體兩個實體（關係型別／觸發詞不是文本 span），label 為 `role + '@' + relationKey`；並**誠實聲明殘留碰撞**——同一實體在同一關係型別下參與多筆三元組時仍會互相覆寫，連同其使用者可見表現一併寫入條文；同時明文禁止改以三元組序號為鍵。
- FR-098 定義逐快照對回退規則：僅當前後兩份快照皆至少產出一筆帶起訖的三元組時才走逐實體差異，否則回退為純值比對——`buildHistoryDiff` 一旦判定某型別為具位置資訊之類型即不再有純值遞補路徑，缺少此規則會使不帶位置資訊的來源形狀從「今日可用的純值差異」退化為「空差異」而被讀成未變更，比現況更差。
- FR-098 記載**維持不變**的已知落差：gold 純字串形狀與內建示範資料的字串串接形狀（其 `subj`／`obj` 並非原始文本的連續子字串）本無對應 span，本版不補齊，並留下追蹤出口。
- 修訂 FR-087：其「已知落差」段自「整個 `relation_identification` 型別無法逐實體比對」收斂為「依來源形狀分流」，並將起訖攜帶、索引鍵與回退規則轉指 FR-098。
- 新增 AC-2.22、AC-2.23 與 SC-004X。
- **不改變**的範圍：FR-052 之 `CONSENSUS_MERGE_KEYS` 關係合併鍵維持 `subj + obj + type` 字串精確比對（起訖只存在於部分來源形狀，改為以起訖為鍵會使 gold 與示範形狀的答案彼此不可比），`relation-triple-row` 之顯示字串（FR-014L）一字不動，不觸及任何 API 契約或 DB schema。

## Capabilities

### New Capabilities

無。本變更不新增能力邊界，只補齊既有能力的位置維度。

### Modified Capabilities

- `annotation/015-annotation-workspace`：`relation_identification` 之答案結構攜帶主體／客體起訖，使 FR-087 之逐實體差異在來源具位置資訊時得以成立。

## Impact

| 原型程式檔案 | 影響 |
| --- | --- |
| `design/prototype/pages/task-management/task-config.engine.js` | 互動標記與物件形狀匯入兩個 `previewTriples` 產生點補上四個起訖欄位；顯示字串維持原樣 |
| `design/prototype/pages/annotation/annotation-workspace.data.js` | `convertSubmissionAnswer()` 之 `relation_identification` 分支保留四個起訖欄位 |
| `design/prototype/pages/annotation/annotation-workspace.config.js` | `applyCompactAnswerToState()` 之 `relation_identification` 分支回填四個起訖欄位；`buildHistoryDiff()` 加入逐快照對回退判定 |
| `design/prototype/pages/shared/annotation-history.js` | `SPAN_EXTRACTORS` 註冊 `relation_identification`，索引鍵 label 改為 `role + '@' + relationKey` |

- 手寫產品檔案共 4 個（未達憲章原則 X 的 5 檔上限），但產生層、往返層與比對層各自為獨立可觀察行為，且合計 diff 具超過 300 行之風險，故拆為 **3 組實作群組 ＋ 1 組最終 archive 群組**。
- 不影響 API 契約、DB schema、後端、前端 `frontend/**` 或任何相依套件。
- 不影響 `entity_recognition` 與 `sequence_tagging` 既有的逐實體差異行為。

## Constitution Check

| 原則 | 符合方式 |
| --- | --- |
| **I. Spec-First** | 行為變更先由本 change 的 delta 定義 FR-098 與 FR-087 修訂，實作任務逐項回溯 FR／AC／SC |
| **II. Generalization-First（NON-NEGOTIABLE）** | 位置維度由 `OUTPUT_TYPE_REGISTRY` 之輸出類型驅動，不依 task_id 分流；抽取器維持既有 registry 形狀，不新增逐任務硬編分支 |
| **III. Data Fairness（NON-NEGOTIABLE）** | 快照沿用 FR-087 既有規定排除原始文本與資料集欄位；本變更只增加整數 offset，不引入任何 gold 答案洩漏路徑；FR-090 之跨標記員遮蔽不受影響 |
| **IV. Test-First** | 每個可觀察行為皆為一組 Red（`[@senior-qa]`）＋ Green 配對，Red 先 commit 並留下預期失敗證據 |
| **X. Change Scope Discipline** | 4 個產品檔案拆為 3 組實作群組；只有最終群組執行 archive 與正典回寫 |
| **XX. Source of Truth & Contract Governance** | `specs/annotation/015-annotation-workspace/spec.md` 為唯一正典；本 change 只對應該一份 spec，不另建新 spec |
