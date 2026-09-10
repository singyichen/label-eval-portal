# Annotation List + Workspace — 審核單位送出後的自動前進（issue #719）

## Purpose

本 delta 把既有的「下一個可處理審核單位」推導（FR-073）接上工作區的兩條送出路徑。審核決策送出與爭議仲裁送出成功寫入後，工作區必須自動前進至下一個可處理審核單位；已無可處理項目時，導回保留送出前篩選條件的 `annotation-list` 並顯示既有的無可處理空狀態說明。本 delta 不改變 FR-073 條文本身，只新增其第二個消費端。

## ADDED Requirements

### Requirement: FR-099 審核單位送出後的自動前進

**FR-099**（本版新增，對應 AC-3.55、AC-3.56、SC-004Y，issue #719）：**審核單位送出後必須自動前進至下一個可處理審核單位**。

`role = reviewer` 於 `annotation-workspace` 完成一次**成功寫入**的送出後，系統 MUST 自動前進至下一個可處理審核單位。適用兩條送出路徑：審核決策送出（FR-092 之 `approve | modify | bypass` 三向決策）與爭議仲裁送出（FR-061）。

1. **目標推導之單一來源**：下一個單位 MUST 由 `findNextActionableReviewUnit(task_id, run_type, reviewer_id)` 取得，其 `REVIEW_UNIT_ACTION_PRIORITY` 優先序、資格判定與候選列舉逐字沿用 FR-073 第 1～3 點。系統 MUST NOT 另立第二套「哪些單位可處理」的判定；亦 MUST NOT 沿用標記端之 `findNextPendingUnit()`——後者所稱「待處理」為「該樣本尚未提交」之二元事實，不含優先序，亦不含 FR-060 之仲裁資格與利益迴避，以之為審核端目標會把審核員送進其無權處理的唯讀單位，正是 FR-073 為 dashboard 入口修掉的同一個缺陷。

2. **前進方式為工作區內切換，不得導頁**：取得目標單位後 MUST 於同一頁面切換至該單位，MUST NOT 導向 `annotation-workspace` 之新網址。審核單位維度為 `sample_id × annotator_id × run_type`（FR-051、FR-056），故切換 MUST 同時帶入目標單位之 `annotator_id`；缺少該維度時工作區會依 FR-049 回退為預設標記員身分而顯示另一個單位。切換後之網址同步由 FR-057 既有契約承擔，本條 MUST NOT 新增第二個網址寫入點。

3. **方向性刻意不同於標記端**：目標為全體可處理單位中優先序最高者，同順位取列舉順序最前者（FR-073 第 2 點），而非自目前單位往後繞行。因此送出後 MAY 前進至列舉順序在目前單位之前的單位；此為刻意行為。標記端之待處理無優先序故採繞行（FR-022A），審核端之可處理有優先序故採全域最佳；系統 MUST NOT 為了讓兩者「看起來一致」而在審核端加上繞行限制——那會使一個更該優先處理的 `pending` 單位僅因排序在目前單位之前而被跳過。

4. **剛送出的單位不得成為前進目標，且不得以特例達成**：此結果 MUST 由 FR-073 第 2 點之既有資格判定自然成立——送出後該單位或轉為 `finalized`（不可處理），或轉為 `disputed` 而該審核員已於其上提交過故不具 FR-060 仲裁資格（不可處理）。系統 MUST NOT 另加「排除目前單位」之特例判斷；該特例會在單位狀態推導日後變動時與資格判定各說各話，並掩蓋資格判定本身的缺陷。

5. **無可處理項目時的去向**：推導結果為空時 MUST 導向 `annotation-list`（不帶 `sample_id`），且下列兩項 MUST 同時成立：
   - 網址 MUST 經 `buildListReturnUrl()` 這個既有單一 writer 產生，因而保留 FR-081 之檢視狀態四鍵與 FR-049 之身分參數（AC-4.43）；系統 MUST NOT 於返回路徑上另立第二個 query 建構器（FR-081 第 3 點）。
   - 網址 MUST 附帶 `notice=no_actionable_review`，觸發 FR-073 第 5 點既有之 `list-no-actionable-notice` 空狀態說明（zh／en 同步）。

   兩項缺一不可：只保留篩選條件會讓審核員面對一整頁已定稿列而無任何「此任務已無可處理單位」的訊號；只顯示空狀態則會落在未篩選的第 1 頁。系統 MUST NOT 回退為開啟任何已定稿唯讀單位。

6. **未成功寫入的送出不得產生任何導覽**：被 FR-083（每個 outKey 須有一筆決策）、FR-089（`modified`／`bypassed`／`adjudicated` 之理由必填）或工作區既有之空單位與 `finalized` 守衛擋下而未實際寫入的送出，MUST NOT 前進，亦 MUST NOT 導頁；畫面 MUST 停留於原單位，使阻擋原因得以呈現。

7. **不得硬編任務 ID**（Generalization-First）：前進目標僅得由審核單位狀態與登入審核員身分推導，MUST NOT 對 T014–T017 或任何任務 ID 分流。

本條不改變 FR-073 條文本身，僅新增其第二個消費端；不改變 FR-022A／FR-022C 與標記端之提交後導覽行為；不改變 `REVIEW_UNIT_ACTION_PRIORITY`、`listReviewUnits()` 與 `findNextActionableReviewUnit()` 之簽章或行為。

#### Scenario: AC-3.55 審核送出成功後自動前進至下一個可處理審核單位
- **GIVEN** `role = reviewer` 進入某任務一個 `pending` 審核單位，且該任務尚有其他 `pending` 單位
- **WHEN** 完成每個 `outKey` 的決策並成功送出審核
- **THEN** 工作區 MUST 於同一頁面切換至 `findNextActionableReviewUnit()` 選出的單位，網址之 `sample_id` 與 `annotator_id` MUST 同步為該單位，且 MUST NOT 發生跳離工作區的導頁
- **AND** 剛送出的單位 MUST NOT 成為切換目標
- **AND** 任務同時存在 `pending` 與該審核員可仲裁之 `disputed` 時，MUST 前進至 `pending` 單位，即使該 `disputed` 單位於列舉順序中在前
- **AND** 該審核員於此任務已無可處理單位時，MUST 導向 `annotation-list`：該次導頁所請求之網址 MUST 同時帶有送出前的 FR-081 檢視狀態鍵（如 `status`、`q`）與 `notice=no_actionable_review`，MUST NOT 帶 `sample_id`，且落地頁 MUST 渲染 `list-no-actionable-notice`
- **AND**〔反向守衛〕缺一筆決策而被 FR-083 擋下的送出，MUST 停留於原單位——`sample_id` 不變、未切換至任何其他單位、未發生任何導頁

#### Scenario: AC-3.56 仲裁送出共用同一套前進規則
- **GIVEN** `role = reviewer` 且依 FR-060 具仲裁資格，進入某 `disputed` 單位之仲裁版面，且該任務尚有其他可處理單位
- **WHEN** 逐項裁定並成功送出仲裁
- **THEN** 前進行為 MUST 與 AC-3.55 相同——同一個目標推導函式與同一個返回網址建構器，MUST NOT 另立仲裁專用導覽
- **AND** 該仲裁單位即使因裁定為「兩者皆非」而尚未定稿，仍 MUST NOT 成為前進目標（該審核員已於其上提交，不具 FR-060 仲裁資格）
- **AND** 未逐項裁定或缺必填理由而被擋下的仲裁送出 MUST NOT 產生任何導覽

#### Scenario: SC-004Y 送出後去向的完整性與一致性
- **GIVEN** 一位審核員在同一任務內連續送出，直到該任務已無其可處理單位
- **WHEN** 逐次觀察每次送出後的落點
- **THEN** 每次送出後停留於原單位的次數 MUST 為 0，且被前進到的單位中不可處理者（`finalized`、或該審核員無 FR-060 資格之 `disputed`）MUST 為 0 筆
- **AND** 審核送出與仲裁送出兩條路徑所使用的目標推導函式與返回網址建構器 MUST 完全相同，工作區內「哪些單位可處理」的判定實作 MUST 恰為 1 份
- **AND** 最後一次送出後導回之清單網址，其 FR-081 檢視狀態鍵與 `notice=no_actionable_review` MUST 同時存在，`sample_id` MUST 為 0 次出現
