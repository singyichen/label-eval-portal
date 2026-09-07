---
功能分支: feat/path-map-freshness-check
建立日期: 2026-09-05
版本: 1.0.0
狀態: Draft
---

# 功能規格：User Path Map Freshness Check

## 功能目標

讓維護者能以離線、唯讀且可重複執行的命令，判斷 `design/system/user-path-map.html` 所記錄的 prototype 來源 revision 是否仍涵蓋後續的 prototype 與 screen inventory 變更；當圖已過期時，命令必須以非零狀態阻擋並說明觸發來源，避免使用者到達路徑圖在 UI 演進後靜默漂移。

本功能依賴 GitHub issue #645 先交付該 HTML 與其權威來源檔頭。#645 尚未完成以前，本規格只允許建立 CLI／fixture regression foundation；不得猜測檔頭欄位、commit 長度、解析語法或最終比較演算法，也不得接上一個對缺檔永遠通過或讓目前 `main` 永久失敗的 production CI gate。

## 已釐清事項

- 監看的來源集合固定包含 `design/prototype/pages/**` 與 `design/system/screen-inventory.md`；本功能不重繪、不更新 `design/system/user-path-map.html`。
- #645 是 HTML 檔頭格式與「記錄的 prototype 來源 revision」語意的 authority；#665 不建立相容欄位或臨時 metadata。
- 交付分兩階段：#645 前的安全 foundation，以及 #645 後的權威解析、fresh/stale 判定與 production CI activation。
- regression harness 的 CI coverage 與真實 artifact freshness gate 是兩個不同契約。前者可在 Stage 1 由既有 `speckit-tests` job 覆蓋；後者在 Stage 2 前保持未接線。
- 這是 command-line／CI governance tooling，沒有產品 route、prototype 行為、React component、API 或 DB schema；Frontend Ready Gate 不適用。

## 使用者情境與測試 *(必填)*

### 使用者故事 1 — 安全建立檢查命令基礎（優先級：P1）

維護者可以執行固定的 checker entry point，取得穩定 usage／configuration 結果；在 #645 artifact 或權威檔頭尚未可用時，命令明確 fail closed，而不是把「無法判斷」當成 fresh。

**此優先級原因**：先固定安全的 CLI 與測試邊界，才能與 #645 同步推進而不製造暫時性 CI 漏洞。
**獨立測試方式**：在 synthetic repository fixture 執行 help、無效參數、缺少 artifact 與 no-write assertions；fixture 不提供或猜測 #645 metadata。

**驗收情境**：

1. **AC-1.1**：**Given** checker 可執行，**When** 使用 `--help`，**Then** exit `0` 並說明正式檢查尚依賴 #645 的權威檔頭契約。
2. **AC-1.2**：**Given** 傳入不支援的參數或無法解析 repository root，**When** 執行 checker，**Then** exit `2` 並輸出 usage／configuration diagnostic。
3. **AC-1.3**：**Given** `design/system/user-path-map.html` 不存在，或雖存在但 #645 權威 metadata 契約尚未完成，**When** 執行正式檢查，**Then** exit `2`，明確表示 freshness 無法判斷，且不得回報 fresh。
4. **AC-1.4**：**Given** 任一 Stage 1 fixture，**When** 執行 checker，**Then** repository 內容與 Git working tree 保持不變。

### 使用者故事 2 — 依權威來源判斷 fresh 或 stale（優先級：P1；目前受 #645 阻擋）

在 #645 完成後，維護者能以 HTML 權威檔頭記錄的 prototype 來源 revision 為基準，檢查其後是否有受監看來源變更，並取得可定位的觸發原因。

**此優先級原因**：這是 issue #665 的核心阻擋行為，但在來源 metadata 尚不存在時不能誠實實作。
**獨立測試方式**：待 #645 交付後，以依權威格式建立的 synthetic fixtures 覆蓋 fresh、每個受監看來源的 stale、無效 revision 與不相關路徑 negative control。

**驗收情境**：

1. **AC-2.1（Blocked）**：**Given** HTML 依 #645 權威檔頭記錄可解析的來源 revision，且依核准比較規則沒有較新的受監看來源變更，**When** 執行 checker，**Then** exit `0` 且回報 fresh。
2. **AC-2.2（Blocked）**：**Given** HTML 記錄的來源 revision 之後，`design/prototype/pages/**` 依核准比較規則出現較新的變更，**When** 執行 checker，**Then** exit `1` 並指出該來源集合觸發 stale。
3. **AC-2.3（Blocked）**：**Given** HTML 記錄的來源 revision 之後，`design/system/screen-inventory.md` 依核准比較規則出現較新的變更，**When** 執行 checker，**Then** exit `1` 並指出該檔案觸發 stale。
4. **AC-2.4（Blocked）**：**Given** 權威 metadata 缺漏、重複、格式錯誤、revision 無法解析，或 repository history 不足以套用核准規則，**When** 執行 checker，**Then** exit `2` 並說明 configuration 原因，不得回報 fresh 或 stale。
5. **AC-2.5（Blocked）**：**Given** 只有監看集合之外的檔案發生變更，**When** 執行 checker，**Then** 不得僅因此判為 stale；最終結果仍由核准規則與受監看來源決定。

### 使用者故事 3 — 分離 regression coverage 與 production gate（優先級：P2）

維護者能在 #645 前持續由 CI 執行 checker 的安全 foundation regression；只有 #645 權威契約、核心 Red/Green 與真實 repository fresh evidence 均成立後，才啟用直接 freshness job 與本機對等命令。

**此優先級原因**：既不能留下沒有 CI 覆蓋的 checker，也不能以臨時例外讓 production gate 假綠或永紅。
**獨立測試方式**：先驗證既有 `speckit-tests` job 覆蓋 Stage 1 fixtures；Stage 2 再驗證獨立 job、`CLAUDE.md` 命令與 `scripts/ci-jobs.tsv` 雙向對照。

**驗收情境**：

1. **AC-3.1**：**Given** Stage 1 foundation 已完成但 #645 尚未交付，**When** CI 執行，**Then** 既有 `speckit-tests` job 會執行 checker regression fixtures，但 `.github/workflows/ci.yml` 不會對真實 `design/system/user-path-map.html` 執行 production freshness check。
2. **AC-3.2（Blocked）**：**Given** #645 權威檔頭與 artifact 已合併、Stage 2 Red/Green 全綠，且真實 repository checker exit `0`，**When** 啟用 production gate，**Then** `.github/workflows/ci.yml` 有獨立 job 執行 checker，`CLAUDE.md` 列出相同本機命令，`scripts/ci-jobs.tsv` 將 checker 登錄至該 job。
3. **AC-3.3**：**Given** 任一階段完成其預定接線，**When** 執行 `scripts/check-sdd.sh`，**Then** 不得輸出 `CI_JOB_PARITY` diagnostic。

## 需求規格 *(必填)*

### 功能需求

- **FR-001**：系統必須提供唯讀 entry point `node scripts/check-user-path-map-freshness.mjs`；`--help` 與無效參數的結果必須可重複，且不得修改 repository。
- **FR-002**：命令必須區分成功、stale governance violation 與 usage／configuration failure；exit `0` 只可表示依已核准完整契約證明 fresh，exit `1` 表示已證明 stale，exit `2` 表示無法可信判斷。Stage 1 不得產生 exit `0` 的 production freshness 結果。
- **FR-003**：Stage 1 必須在 artifact 缺漏或權威 metadata 契約尚未完成時 fail closed；不得以預設 revision、當前 `HEAD`、檔案 mtime、固定日期或其他猜測代替 #645 authority。
- **FR-004**：Stage 2 的受監看來源必須且只包含 `design/prototype/pages/**` 與 `design/system/screen-inventory.md`，除非後續 spec 變更明確修訂此集合。
- **FR-005**：Stage 2 必須只依 #645 已合併 artifact 所定義的權威 metadata 取得 recorded prototype source revision；本規格不得預先定義欄位名稱、commit 長度、HTML parsing syntax 或相容 fallback。
- **FR-006**：Stage 2 必須比較 recorded revision 與其後受監看來源的 repository 變更，並區分 fresh、stale 與無法判斷；比較的 revision resolution、history boundary、dirty working tree 與 source ordering 語意必須在 #645 完成後由 design amendment 明確核准，未核准前不得實作。
- **FR-007**：stale diagnostic 必須指出是 `design/prototype/pages/**`、`design/system/screen-inventory.md` 或兩者觸發；configuration diagnostic 必須指出不可判斷的條件，且不得把 captured Git／parser raw output 直接當成唯一訊息。
- **FR-008**：Stage 1 regression 必須加入既有 `scripts/speckit-tests.sh`，並由既有 `speckit-tests` CI job 覆蓋；checker 新增時必須在 `scripts/ci-jobs.tsv` 登錄為由該 regression suite 覆蓋。此接線不得直接檢查真實 path map freshness。
- **FR-009**：production freshness gate 只能在 #645 權威檔頭與 artifact 已合併、Stage 2 Red/Green 全綠、真實 repository checker exit `0` 後啟用；啟用時必須新增獨立 `.github/workflows/ci.yml` job、`CLAUDE.md` 對等本機命令，並將 checker 的 `scripts/ci-jobs.tsv` 登錄改由該 job 覆蓋。不得建立對缺檔永遠通過的臨時 job，也不得在目前 artifact 缺席時建立永久失敗的 blocking job。
- **FR-010**：Stage 1 與 Stage 2 的每個可合併狀態都必須使 `scripts/check-sdd.sh` 對真實 repository 輸出零個 `CI_JOB_PARITY` diagnostic；production gate 不得包裝或取代 OpenSpec schema validation、Project SDD lint 或其他 code/test gates。

## 規格相依性

### 上游（本規格依賴的規格／authority）

| 規格或來源 | 功能 | 本規格需要的內容 |
|---|---|---|
| GitHub issue #645 | 使用者到達路徑圖 | `design/system/user-path-map.html` 與其權威 prototype source metadata 契約；目前未完成，阻擋 FR-005～FR-007 與 AC-2.1～AC-2.5 |
| foundation-001 | Project SDD Lint | `scripts/ci-jobs.tsv` 的雙向 local／CI parity 與 `CI_JOB_PARITY` gate |
| `design/system/screen-inventory.md` | generated screen inventory | Stage 2 受監看來源之一；本功能只讀取其 repository 變更，不重新生成該檔 |

### 下游（依賴本規格的規格）

| 規格編號 | 功能 | 依賴本規格的內容 |
|---|---|---|
| Frontend Ready Gate consumers | 新增／修改 page-scoped feature | 以 current 的 user path map 作為主要目標到達性檢查背景；本 checker 只保證 freshness，不判定 F3／F4 結果正確性 |

## 成功標準 *(必填)*

- **SC-001**：Stage 1 的 committed QA Red 先因 checker entry point 缺失而以預期原因失敗；paired Green 後，help、無效參數、缺少／未定 authority 與 no-write fixtures 全綠。
- **SC-002**：#645 完成前，checker regression 由既有 `speckit-tests` job 覆蓋，但 CI 與 `CLAUDE.md` 均沒有宣稱真實 path map freshness 已受 production gate 驗證。
- **SC-003（Blocked）**：#645 完成後的 design amendment 明確記錄權威 metadata locator、revision resolution、完整 stale comparison semantics、dirty／shallow history handling 與 stable diagnostics；不得由實作 agent 自行補完。
- **SC-004（Blocked）**：Stage 2 committed QA Red 覆蓋 fresh、兩個監看來源各自 stale、雙來源 stale、invalid metadata／revision 與 unmonitored-path negative control；paired Green 後全部通過，且真實 repository checker exit `0`。
- **SC-005（Blocked）**：獨立 production CI job、`CLAUDE.md` 本機命令與 `scripts/ci-jobs.tsv` direct checker mapping 同批完成；`scripts/check-sdd.sh` exit `0` 且無 `CI_JOB_PARITY` diagnostic。
- **SC-006**：整個變更不修改 `design/system/user-path-map.html`、`design/prototype/pages/**`、`design/system/screen-inventory.md`、API、DB schema、產品 runtime 或 dependency。

## 範圍外（Out of Scope）*(必填)*

- 產生、重繪、修復或改寫 `design/system/user-path-map.html`；該 artifact 屬 issue #645。
- 在 #645 前定義 HTML metadata 欄位、commit abbreviation、parser、fallback 或最終 Git comparison algorithm。
- 判斷 path map 內容是否完整、F3／F4 finding 是否正確，或自動開修正 issue。
- 修改 `design/prototype/pages/**` 或重新生成 `design/system/screen-inventory.md`。
- API、DB schema、backend、frontend runtime、package dependency 或 deployment 行為。

## Changelog

| 版本 | 日期 | 變更摘要 |
|---|---|---|
| 1.0.0 | 2026-09-05 | 建立 issue #665 的兩階段 freshness checker 契約：#645 前只交付 fail-closed CLI 與 fixture regression foundation；#645 後才核准 metadata／comparison semantics 並啟用 production CI gate |
