---
對應 Spec: specs/annotation/015-annotation-workspace/spec.md
對應 Issue: #719
基準版本: 015 v6.1.0
目標版本: 015 v6.2.0
---

## Why

同一個工作區的兩條送出路徑對「送出之後要去哪裡」給出不同答案。標記員側自 v4.47.0（issue #514）起，`handleSubmit()` 送出成功後會以 `findNextPendingUnit()` 取得下一個未提交單位並原地切換，全數完成才經 `buildListReturnUrl()` 導回清單（FR-022A、FR-022C）。審核員側的 `handleReviewSubmit()`（`design/prototype/pages/annotation/annotation-workspace.config.js:4730`）與仲裁側的 `handleArbitrationSubmit()`（同檔 `:3939`）尾段都只做重繪與 toast，沒有任何後續導覽——審核員必須自行回到 `annotation-list` 再點下一個單位，每審一個單位多兩次點擊。

此落差由 issue #645 的使用者到達路徑圖在目標 G9（審核一單位）實走時發現，判定為 **F3（送出後無明確去向）** 命中。

缺口只在工作區這一端，不在推導層。**FR-073**（v4.28.0，issue #449）早已為審核端定義了完整的「下一個可處理審核單位」推導：`findNextActionableReviewUnit(task_id, run_type, reviewer_id)` 依 `REVIEW_UNIT_ACTION_PRIORITY` 選出目標，候選列舉與 FR-072 摘要計數共用 `listReviewUnits()`。但它至今只有 dashboard `快速審核` 一個消費端（`design/prototype/pages/dashboard/dashboard.js:243`）——審核員從 dashboard 進來時拿得到正確的下一個單位，送出之後卻拿不到。

issue #719 內文提出的疑慮「需確認 `findNextPendingUnit()` 之單位列舉是否已考慮 `unitIdentity()`」在複驗中確認為非問題（`annotation-workspace.config.js:2394` 已傳入 `unitIdentity(unit)`），但**該函式本來就不該被審核端沿用**：標記端的「待處理」是「該樣本尚未提交」這個二元事實，審核端的「可處理」是帶優先序且依登入審核員身分而異的推導（`pending` 優先於本人具 FR-060 仲裁資格之 `disputed`，無資格之 `disputed` 與 `finalized` 皆不可處理）。以標記端函式充當審核端的前進目標，會把審核員送進他無權處理的唯讀單位——正是 FR-073 當初為 dashboard 修掉的同一個缺陷。

## What Changes

- 新增 **FR-099**：定義審核單位送出後的自動前進契約——審核送出（FR-092）與仲裁送出（FR-061）兩條路徑成功寫入後，必須以 `findNextActionableReviewUnit()` 取得下一個可處理審核單位並於工作區內原地切換，不得離開工作區、不得另立第二套可處理判定。
- FR-099 明文界定**前進方式**為同頁切換 `selectSample(sample_id, annotator_id)`：審核單位維度為 `sample_id × annotator_id × run_type`（FR-051、FR-056），`annotator_id` 為必要項，網址同步由 FR-057 既有契約承擔，不新增第二個網址寫入點。
- FR-099 明文界定**方向性**與標記端刻意不同：目標為全域最高優先且列舉順序最前者，而非自目前單位往後繞行；因此送出後可能回到列舉順序在前的單位。標記端無優先序故採繞行，審核端有優先序故採全域最佳——兩者不是同一個問題，不得為了「行為看起來一致」而在審核端加上繞行。
- FR-099 明文界定**無可處理項目時的去向**：經 `buildListReturnUrl()` 這個既有單一 writer 導回 `annotation-list`，因而保留 FR-081 之檢視狀態與 FR-049 之身分參數（AC-4.43），並附帶 `notice=no_actionable_review` 觸發 FR-073 第 5 點既有的 `list-no-actionable-notice` 空狀態說明。兩者必須同時成立：只帶篩選會讓審核員面對一整頁已定稿列卻無任何「你已審完」的訊號（重蹈 issue #645 的 F3），只帶空狀態則會落到未篩選的第 1 頁（issue #719 明文排除）。
- FR-099 明文界定**不觸發**的情形：被 FR-083（每個 outKey 一筆決策）或 FR-089（`modified`／`bypassed`／`adjudicated` 理由必填）阻擋而未實際寫入的送出，以及 `handleReviewSubmit()` 既有的空單位與 `finalized` 兩道守衛擋下的呼叫，一律不得產生任何導覽。
- FR-099 明文**不得硬編任務 ID**：前進目標僅得由審核單位狀態與登入審核員身分推導。
- 新增 **AC-3.55** 與 **SC-004Y**。
- **不改變**的範圍：FR-073 條文一字不動——本變更新增的是它的第二個消費端，其優先序、資格判定、空狀態 testid 與單一列舉來源皆逐字沿用；`REVIEW_UNIT_ACTION_PRIORITY`、`listReviewUnits()`、`findNextActionableReviewUnit()` 之簽章與行為不變；標記端 FR-022A／FR-022C 與 `findNextPendingUnit()` 不變；不觸及任何 API 契約或 DB schema。

## Capabilities

### New Capabilities

無。本變更不新增能力邊界，只把既有的「下一個可處理審核單位」推導接上工作區這個既有消費點。

### Modified Capabilities

- `annotation/015-annotation-workspace`：審核與仲裁送出成功後由停留原地改為自動前進至下一個可處理審核單位，無可處理項目時導回保留篩選的清單並顯示空狀態。

## Impact

| 原型程式檔案 | 影響 |
| --- | --- |
| `design/prototype/pages/annotation/annotation-workspace.config.js` | 新增共用前進函式，`handleReviewSubmit()` 與 `handleArbitrationSubmit()` 兩處尾段各呼叫一次 |

- 手寫產品檔案共 1 個，遠低於憲章原則 X 的 5 檔／300 行上限，故不拆群組，propose、apply 與 archive 於同一 PR 完成（ADR-033 Rule 1 之預設形態）。
- 本變更新增 FR／AC，**不適用 Lightweight Path**（CLAUDE.md：Lightweight Path 要求「不新增或移除任何 FR／AC，只釐清」）。
- 產品原型檔案有變更，`design/system/screen-inventory.md` 須以 `node scripts/gen-screen-inventory.mjs` 重生並獨立 commit。
- 不影響 API 契約、DB schema、後端、前端 `frontend/**` 或任何相依套件。
- 不影響 dashboard `快速審核` 既有行為（FR-073 之第一個消費端逐字不動）。

## Constitution Check

| 原則 | 符合方式 |
| --- | --- |
| **I. Spec-First** | 行為變更先由本 change 的 delta 定義 FR-099，實作任務逐項回溯 FR／AC／SC |
| **II. Generalization-First（NON-NEGOTIABLE）** | 前進目標由審核單位狀態與登入審核員身分推導，不對任務 ID 分流；直接重用 FR-073 既有推導，不新增任何逐任務分支 |
| **III. Data Fairness（NON-NEGOTIABLE）** | 本變更只改變導覽去向，不改變任何答案、快照或遮蔽規則；FR-060 盲審與利益迴避由 `findNextActionableReviewUnit()` 既有資格判定承擔，審核員不會被前進到自己無資格處理的單位 |
| **IV. Test-First** | 可觀察行為為一組 Red（`[@senior-qa]`）＋ Green 配對，Red 先 commit 並留下預期失敗證據 |
| **X. Change Scope Discipline** | 1 個產品檔案、單一群組，propose／apply／archive 同 PR |
| **XX. Source of Truth & Contract Governance** | `specs/annotation/015-annotation-workspace/spec.md` 為唯一正典；本 change 只對應該一份 spec，不另建新 spec |
