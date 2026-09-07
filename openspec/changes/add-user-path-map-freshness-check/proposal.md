---
對應 Spec: specs/foundation/002-user-path-map-freshness-check/spec.md
---

## Why

GitHub issue #665 要求自動偵測 `design/system/user-path-map.html` 是否落後於 prototype 與 generated screen inventory。現況尚無 checker，且上游 issue #645 尚未交付 path map 與權威來源檔頭；若現在直接猜測 metadata 或接上真實 artifact gate，只會形成「缺檔也通過」的 CI 漏洞，或讓目前 `main` 永久失敗。

本變更以兩階段交付：先建立不假裝 fresh 的 fail-closed CLI 與 regression foundation；待 #645 完成後，再以其 authority 補齊 parser、比較語意與 production CI activation。

## What Changes

- 新增唯讀 entry point `node scripts/check-user-path-map-freshness.mjs` 的兩階段契約。
- Stage 1 只實作 help、usage／root preflight、缺少 artifact／未定 metadata authority 的 configuration failure 與 no-write 保證；fixture 放入既有 `scripts/speckit-tests.sh`，由現有 `speckit-tests` job 覆蓋。
- Stage 1 新增 checker 時，同步於 `scripts/ci-jobs.tsv` 將它登錄為由 regression suite 覆蓋，保持 `CI_JOB_PARITY` 為零；不修改 `.github/workflows/ci.yml` 或 `CLAUDE.md` 以執行真實 path map check。
- Stage 2 明確阻擋於 #645：只有權威檔頭與 artifact 已合併、design amendment 核准 metadata／Git comparison semantics、committed Red/Green 全綠且真實 repository checker exit `0` 後，才能新增獨立 production job、對等本機命令與 direct checker registry mapping。
- Stage 2 最終依 HTML recorded revision 檢查其後 `design/prototype/pages/**` 與 `design/system/screen-inventory.md` 的變更；stale 必須 exit `1` 並指出觸發來源，無法可信判斷則 exit `2`。
- 不重繪或修改 `design/system/user-path-map.html`，不修改 prototype、screen inventory、API、DB schema、產品 runtime 或 dependency。

## Capabilities

### New Capabilities

- `foundation/002-user-path-map-freshness-check`：提供 user path map 的兩階段 freshness checker 與 local／CI gate 契約。

### Modified Capabilities

無。

## Impact

- Stage 1 預計影響 `scripts/speckit-tests.sh`、新增 `scripts/check-user-path-map-freshness.mjs`，並更新 `scripts/ci-jobs.tsv`。
- Stage 2 預計再影響同一 checker／harness、`.github/workflows/ci.yml`、`CLAUDE.md` 與 `scripts/ci-jobs.tsv`；此階段目前 blocked。
- production gate 啟用後，prototype pages 或 screen inventory 在 path map recorded revision 之後變更會阻擋合併，並要求重新完成 #645 所屬的 path map 更新流程。
- 不影響 API、DB schema、產品 UI runtime 或 dependency。

## Constitution Check

- **I. Spec-First**：新 CLI／CI 行為先建立 `foundation-002` 正典與本 OpenSpec change；每個需求與 task 皆以 FR／AC／SC 追溯。
- **IV. Test-First**：Stage 1 與 Stage 2 各自先由 `[@senior-qa]` 提交並執行 Red contract，主 session 驗證 expected failure 後才派 paired Green；Green 不得改寫 Red。
- **X. Change Scope Discipline**：本變更只處理 freshness checker。#645 artifact、重繪、prototype、screen inventory regeneration、API 與 DB 均排除；implementation task 遵守 one-file rule，只有 checker 與 parity registry 必須原子建立時使用 `scaffold` exception。
- **XVII. CI/CD Quality Gates**：Stage 1 使用既有 regression job，不宣稱 production freshness；Stage 2 僅在真實 checker 已證明 fresh 後啟用獨立 blocking job，且 local command 與 registry 同步。
- **XIX. Environment & Configuration Integrity**：無法解析 artifact、authority、revision 或 repository history 時 fail closed，不使用 `HEAD`、mtime 或日期猜測。
- **XX. Source of Truth & Contract Governance**：#645 是 HTML metadata authority；本變更只消費其已合併契約，不另建別名或 fallback。`scripts/ci-jobs.tsv` 維持 local／CI parity authority。
- **II. Generalization-First（NON-NEGOTIABLE）**：不觸及 NLP task type、registry 或 task runtime。
- **III. Data Fairness（NON-NEGOTIABLE）**：不讀取、輸出或新增 dataset、annotation、gold answer 或 scoring metadata。
