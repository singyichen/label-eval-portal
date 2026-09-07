# Agent Context Contract

**狀態：** Active

**最後驗證：** 2026-08-19（17-spec inventory）

## Purpose and non-goals

本契約定義 Agent 開啟產品或規格任務時最小、可驗證的閱讀與追溯脈絡，讓產品文件保持可導航。它不取代 `AGENTS.md`、Constitution、feature spec 或 ADR，也不新增工程流程或行為規則。

## Authority order

發生衝突時，依下列正典權威階層回到較高階來源，不得以產品摘要自行裁決：

1. main constitution
2. applicable domain constitutions
3. active feature specs
4. [shared constants](../../specs/_shared/constants.md)
5. [`specs/STATUS.md`](../../specs/STATUS.md)
6. accepted ADRs
7. prototype/design
8. product docs

`STATUS.md` 是交付流程狀態來源；feature spec 是行為來源；shared constants 是跨 spec enum／route／breakpoint 的正名來源；ADR 是已接受決策來源。Product Baseline、PRD、Impact Map、Story Map、IA 與 Milestones 僅提供產品導航。

## Required reading sequence

開啟任務時固定依下列順序閱讀：main constitution → applicable domain constitutions → Product Baseline → `STATUS.md` → target spec → upstream/downstream specs → **涵蓋此模組的跨模組架構圖（若有）** → shared constants → prototype/design → approved plan/tasks。

跨模組架構圖收在 [`docs/diagrams/architecture/`](../diagrams/architecture/)，用來在動工前確認本模組在系統中的位置與上下游資料流；該目錄若沒有涵蓋此模組的圖，這一步直接略過，不需為此補圖。架構圖屬 **Navigation** 層級，與 Product Baseline 同級，不得覆蓋 active spec 或 shared constants；圖與 spec 不一致時以 spec 為準，並把落差記入 [`decision-log.md`](./decision-log.md)。選圖工具與產出位置慣例見 [`docs/diagrams/README.md`](../diagrams/README.md)。

## Required task packet

開始工作前，任務封包至少應包含 issue 或需求、目標 spec，以及已有的 plan/tasks；依影響範圍加入上下游 spec、shared constants、ADR 與對應 prototype/design。`shared/018-help-button` 為 deferred，不得當作目前交付能力。

## Active and historical document labels

- **Active:** `STATUS.md`、active feature specs、shared constants、適用 Constitution 與 ADR。
- **Navigation:** Product Baseline、PRD、IA、Impact Map、Story Map、taxonomy、Milestones；不得覆蓋 active spec。
- **Historical/exploratory:** Functional Map 是探索性視圖；`reviewer-model-redesign.md` 是已完成歷史背景。現行審核、仲裁與完成條件回鏈 014／015／017。

## Traceability output

每次產品或 spec 工作的輸出，應列出：採用的正典來源與版本／日期、受影響產品文件、已驗證連結與 diff、以及未解衝突或 deferred 項目。任務組態以 `input_type + outputs[] + field_role_map` 表述；不要以 legacy `task_type` 取代現行模型。

## Update triggers

每次 spec stage 或 version 變動後，手動執行 drift check：

1. 確認受影響的 product docs 與 active/historical 標籤。
2. 更新 Product Baseline marker（如適用），並核對 `STATUS.md`。
3. 執行 artifact、diff 與相對連結檢查。
4. 將未解衝突記入 [`decision-log.md`](./decision-log.md)，不自行選擇衝突值。

`/speckit.analyze` 的產品文件自動化檢查留作 follow-up；在此之前，以上手動檢查是必要的文件治理步驟。
