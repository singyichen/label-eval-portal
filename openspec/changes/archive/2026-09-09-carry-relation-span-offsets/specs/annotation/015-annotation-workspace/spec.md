# Annotation List + Workspace — 關係識別答案之 span 起訖攜帶（issue #590）

## Purpose

本 delta 補齊 `relation_identification` 在 FR-087「逐實體差異」上的位置維度：讓來源本身即攜帶位置資訊的關係三元組把 `start`／`end` 帶進引擎快照並經 CompactAnswer 往返存活，使歷程差異得以逐實體列出新增、刪除與邊界變更；同時把來源本身不帶位置資訊的兩種形狀誠實收斂為已知落差，並明文禁止以字串比對回原文猜測 offset。

## MODIFIED Requirements

### Requirement: FR-087 結果快照與差異呈現

每筆會改變答案內容的事件（`submitted`、`modified`、`adjudicated`）MUST 保存當下的 `result_snapshot`——該樣本完整的 `outputs[]` 作答結果，且 MUST 排除原始文本與資料集欄位（快照的用途是回答「答案改了什麼」，不是複製受標記資料）。

歷程面板呈現的差異 MUST 由同一操作者維度下相鄰兩筆事件的 `result_snapshot` 於呈現時計算，系統 MUST NOT 另存一份差異結果。差異呈現方式 MUST 由 `OUTPUT_TYPE_REGISTRY` 之輸出類型驅動，不得逐 task 硬編：純值類型（`single_label`、`multi_label`、`single_dim`、`multi_dim`、`free_text`）比對值本身；具位置資訊之類型（`entity_recognition`、`relation_identification`、`sequence_tagging`）MUST 逐實體列出新增、刪除與邊界變更三類差異，僅實體數量相同而邊界不同時亦 MUST 被列出。

**已知落差（範圍收斂，本版修訂）**：`relation_identification` 屬本條所稱「具位置資訊之類型」，其答案結構之起訖攜帶、逐實體差異之索引鍵與逐快照對回退規則改由 FR-098 定義。本條之逐實體差異要求於該型別上 MUST 依來源形狀分流——來源本身帶位置資訊者（工作區互動標記、物件形狀之資料集匯入）MUST 逐實體列出；來源本身不帶位置資訊者（gold 純字串三元組、內建示範資料之字串串接值）MUST 維持以純值比對遞補，見 FR-098 第 6 點與第 7 點。此分流不是本條的例外開口，而是「來源資料本身沒有位置資訊時 MUST NOT 偽造位置」的落實；處置方式沿用 FR-052 之「已知落差」先例。原記載於本條的「整個 `relation_identification` 型別暫以純值比對遞補」自本版起不再成立。

同一操作者維度下無前一筆事件時（首次提交），該事件 MUST 呈現為全新內容而非差異。

#### Scenario: AC-2.17 純值類型呈現前後值差異
- **GIVEN** 標記員先提交 `single_label = neutral`，其後審核員修正為 `positive`
- **WHEN** 檢視 `歷程` 頁籤之 `modified` 事件
- **THEN** 該事件顯示 `single_label` 由 `neutral` 變更為 `positive`
- **AND** 標記員該筆首次 `submitted` 事件呈現為全新內容，不顯示差異箭頭

#### Scenario: AC-2.18 位置型類型逐實體列出差異
- **GIVEN** 某樣本 `entity_recognition` 之前一筆快照有 3 個實體，後一筆有 4 個實體且其中一個實體的 span 邊界由 `[0,4]` 改為 `[0,6]`
- **WHEN** 檢視後一筆事件之差異區塊
- **THEN** 差異逐實體列出，包含 1 筆新增與 1 筆邊界變更（列出變更前後 span）
- **AND** 另一組實體數量相同但有一個 span 邊界不同的前後快照，其差異區塊 MUST NOT 為空

## ADDED Requirements

### Requirement: FR-098 關係識別答案之 span 起訖攜帶與逐實體差異

**FR-098**（本版新增，對應 AC-2.22、AC-2.23、SC-004X，issue #590）：**關係識別答案之 span 起訖攜帶與逐實體差異**。

1. **引擎快照契約**：`relation_identification` 之引擎快照 `previewTriples`，每筆三元組 MUST 於既有 `subj`／`rel`／`obj` 顯示字串之外，另行攜帶機器可讀的主體與客體起訖四欄位 `subjStart`、`subjEnd`、`objStart`、`objEnd`，型別為整數或 `null`，語意為原始文本之半開區間 `[start, end)`，與 `sequence_tagging` 之 `spans[]` 同一座標系（FR-024A-3）。既有顯示字串 MUST 維持原樣，FR-014L 所定義之 `relation-triple-row` 呈現契約不因本條改變。

2. **來源範圍**：起訖之來源僅限**本身已攜帶位置資訊**的兩種輸入形狀——(a) 工作區關係建構器之互動標記，其主體與客體槽位由既有的實體命中查找取得 `start`／`end`；(b) 資料集匯入之物件形狀三元組，其 `entity1`／`entity2` 物件已帶 `start`／`end`。

3. **禁止推測（硬規則）**：來源資料未攜帶位置資訊時，四個欄位 MUST 為 `null`。MUST NOT 以答案字串回原始文本做字串比對推得 offset：同一詞在文本中出現多次時比對會選到錯誤的出現位置，而該錯誤不會產生任何錯誤訊號，等同於把「資料缺失」靜默換成「錯誤資料」；此為本條之硬規則，不得以「多數情況正確」為由放寬。

4. **CompactAnswer 往返對稱**：`relation_identification` 之 CompactAnswer 自 `{ subj, rel, obj }` 擴充為 `{ subj, rel, obj, relType, subjStart, subjEnd, objStart, objEnd }`。序列化端（引擎快照 → CompactAnswer）與回填端（CompactAnswer → 引擎快照）MUST 對稱保留新增的這五個欄位——任一端遺漏，即使上游已產生起訖，位置維度亦到不了差異比對層。`relType` 之所以必須隨往返存活，是因為 §5 之 `relationKey` 於 `relType` 非空時優先取 `relType`：若 CompactAnswer 不攜帶 `relType`，回填後的引擎快照該欄位恆為 `null`，§5 的優先分支在此路徑上永遠走不到，§5 自陳之殘留碰撞率亦無從下降。`relType` 型別為非空字串或 `null`，來源僅限引擎快照既有之同名欄位（互動標記之關係型別選擇器所寫入），MUST NOT 由 `rel` 顯示字串推導或以任何方式猜測。既有僅含三鍵之 CompactAnswer MUST 可讀，缺鍵一律視同 `null`，不得因缺鍵而中斷渲染或往返。

5. **逐實體差異之索引鍵**：`relation_identification` 註冊為具位置資訊之類型後，其 span 抽取 MUST 只產出主體與客體兩個實體——`rel` 為關係型別或觸發詞的顯示欄位，不是原始文本上的可對齊 span，MUST NOT 抽取為實體。每個 span 之 label MUST 為 `role + '@' + relationKey`，其中 `role` 取值為 `subj` 或 `obj`，`relationKey` 於 `relType` 非空時取 `relType`、否則取 `rel` 顯示字串。**殘留碰撞（誠實聲明，非已解決）**：既有索引鍵形狀為 `start + '\u0000' + label`，同起點且同 label 之 span 會互相覆寫；把關係型別編入 label 只降低碰撞率、**不消除碰撞**。仍會碰撞的形狀是「同一實體在同一關係型別下參與多筆三元組」，例如同一主體同時有 `causes → 淤滯` 與 `causes → 血栓` 兩筆。其使用者可見表現為兩項：(a) 該組三元組於歷程差異中只會列出其中一筆；(b) 被覆寫的那一筆若只發生邊界變更，會在差異中呈現為「未變更」而非邊界變更。此外，`relType` 為空而以 `rel` 顯示字串充當 `relationKey` 時，觸發詞本身的邊界變動會使該筆三元組的主體與客體同時被判為「刪除＋新增」而非「邊界變更」。本條 MUST NOT 改以三元組序號或陣列索引為鍵——序號會使「審核員重排三元組順序」被判為全部三元組皆變更，製造不存在的差異，其代價高於上述碰撞。

6. **逐快照對回退**：歷程差異的分派一旦判定某輸出類型屬具位置資訊之類型，即不再有純值遞補路徑。因此 `relation_identification` 之逐實體差異MUST 以**該次比對的兩份快照**為單位判定：當前後兩份快照**皆已載有該輸出鍵之答案**時，僅當兩份皆至少產出一筆帶起訖之三元組，才走逐實體差異；否則該次比對 MUST 回退為純值比對（沿用 FR-087 既有之遞補行為）。**豁免（明文）**：某一側完全沒有該輸出鍵之答案（該快照於該鍵為空）時，屬 FR-087 既有之「全新內容」情形，而非本點所要處理的「有答案但缺位置」情形，MUST NOT 因此回退為純值——此情形沿用既有之逐實體新增呈現，否則帶起訖的全新答案會被壓成單行字串，反而失去本條所要建立的逐實體視圖。該側三元組若本身不帶起訖，其四個位置欄位依第 3 點仍 MUST 為 `null`，不得推測。缺少本點時，第 7 點所列不帶位置資訊的來源形狀會從「今日可用的純值差異」退化為「空差異」，而空差異會被讀成「未變更」——那比現況更差，因此本點是本條落地的前置條件而非優化項。

7. **已知落差（範圍收斂）**：下列兩種來源形狀之三元組於原型階段本身即不攜帶位置資訊，本版**不**為其補齊——(a) gold 形狀，其 `subj`／`rel`／`obj` 為匯入資料中的純字串；(b) 內建示範資料之字串串接形狀，其 `subj`／`obj` 由多個欄位串接而成、並非原始文本之連續子字串，本無對應 span 可言。此兩形狀依第 3 點 MUST 維持 `null`，並依第 6 點回退為純值比對。其位置維度之補齊，待來源資料本身攜帶起訖後另案處理；追蹤出口為 issue #738（承接本點落差，於 issue #590 隨本變更關閉前開立）。處置方式沿用 FR-052 之「已知落差」先例。

#### Scenario: AC-2.22 互動標記之關係三元組於歷程差異逐實體呈現

- **GIVEN** 某樣本之 `relation_identification` 由工作區關係建構器互動標記產生，其前一筆快照有 2 筆三元組、後一筆有 3 筆，且其中一筆的主體 span 邊界由 `[0,3]` 改為 `[0,5]`
- **WHEN** 檢視後一筆事件之差異區塊
- **THEN** 差異逐實體列出，包含新增與邊界變更（列出變更前後 span），而非整段答案字串的替換
- **AND** 未變動的三元組不出現在差異清單中
- **AND** 每筆三元組的顯示字串與標記畫面所見一致，不因本條而改變

#### Scenario: AC-2.23 無位置資訊之來源形狀回退純值比對且不推測 offset

- **GIVEN** 某樣本之 `relation_identification` 來自 gold 純字串形狀或內建示範資料之字串串接形狀，其三元組不攜帶任何起訖
- **WHEN** 檢視該樣本相鄰兩筆事件之差異區塊
- **THEN** 該次比對回退為純值比對，差異照常呈現，不得為空差異
- **AND** 該三元組之 `subjStart`、`subjEnd`、`objStart`、`objEnd` 皆為 `null`
- **AND** 系統不得以答案字串回原始文本做字串比對推得任何 offset

#### Scenario: SC-004X 關係識別位置維度之可用性與誠實邊界

- **GIVEN** 工作區互動標記與物件形狀資料集匯入兩種來源之關係識別樣本
- **WHEN** 逐樣本檢視其歷程差異
- **THEN** 這兩種來源之關係識別樣本 100% 走逐實體差異，其起訖於 CompactAnswer 往返後 100% 與提交當下一致
- **AND** gold 純字串與字串串接兩種來源之樣本 100% 回退為純值比對，且其推測而得的 offset 為 0 筆
- **AND** 同一實體於同一關係型別下參與多筆三元組時之殘留碰撞已於 FR-098 第 5 點明載，不得對外宣稱位置維度已完全防碰撞
