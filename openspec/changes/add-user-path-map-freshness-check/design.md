# Design: add-user-path-map-freshness-check

## Context（脈絡）

本設計服務 `specs/foundation/002-user-path-map-freshness-check/spec.md` 的功能目標：以離線、唯讀 checker 發現 `design/system/user-path-map.html` 相對於 prototype 與 screen inventory 的漂移。上游 #645 目前刻意暫停，artifact 與權威 metadata 契約都不存在，因此本設計不能定義欄位名稱、commit 長度、HTML parsing syntax 或最終 Git comparison semantics。

現有 `foundation-001` 已要求 `scripts/` 每支 shell／Node script 都透過 `scripts/ci-jobs.tsv` 對應 CI job 或合理豁免。#665 的 checker 是會阻擋變更的 verification suite，最終不能豁免；但直接在缺少 target artifact 時啟用 production job，也會使目前 `main` 永久失敗。解法是分離 regression-harness coverage 與 production artifact activation。

## Goals / Non-Goals

**Goals：**

- 固定唯讀 CLI surface、exit 類別與 Stage 1 可誠實測試的 preflight。
- Stage 1 以 synthetic fixtures 證明 help、usage、missing／unsettled authority fail-closed 與 no-write。
- Stage 1 將 checker 登錄為由既有 `speckit-tests` job 覆蓋，但不在真實 repository 執行 freshness check。
- Stage 2 在 #645 authority 完成後，補齊 recorded revision extraction 與受監看來源比較，並啟用獨立 production job。
- 每個可合併狀態都維持 `scripts/check-sdd.sh` 無 `CI_JOB_PARITY` gap。

**Non-Goals：**

- 不生成、重繪、修改或驗證 path map 內容完整性。
- 不修改 prototype pages 或重新生成 screen inventory。
- 不在 #645 前發明 metadata、parser、commit abbreviation、fallback、revision resolution、dirty working tree 或 shallow history semantics。
- 不新增 API、DB schema、frontend／backend runtime、dependency 或 deployment 行為。

## Decisions

### 1. 使用 Node 標準函式庫提供單一唯讀 entry point

entry point 固定為 `node scripts/check-user-path-map-freshness.mjs`，只使用 Node 標準函式庫與 Git command，不新增 package dependency。Node 與 Git 已是 repository generator／CI 的既有工具。checker 不提供 write／fix mode，也不呼叫 #645 的繪圖流程。

### 2. 三類 outcome，但 Stage 1 不可回報 production fresh

command outcome 分成：

| Outcome | Exit | 意義 |
|---|---:|---|
| fresh | `0` | 只有完整、已核准的 Stage 2 契約能證明 target current |
| stale | `1` | 只有完整、已核准的 Stage 2 契約能證明受監看來源觸發漂移 |
| usage／configuration | `2` | 參數、root、artifact、authority、revision 或 history 不足以可信判斷 |

Stage 1 的 `--help` 可 exit `0`，但正式 freshness invocation 在 artifact 或 authority 未完成時固定 exit `2`，不得輸出 fresh。這不是 production gate 的臨時 pass；production gate 尚未存在。

### 3. 將 regression coverage 與 production activation 分成兩個 CI 契約

Stage 1：

```text
scripts/speckit-tests.sh
  └─ synthetic fixtures 呼叫 checker
       ├─ help / invalid arguments
       ├─ missing artifact
       ├─ authority not activated
       └─ no-write
```

現有 `speckit-tests` job 已執行該 harness。checker 新增時，`scripts/ci-jobs.tsv` 暫時把 checker 宣告為由 `scripts/speckit-tests.sh` 覆蓋；不新增 production job，不在 `CLAUDE.md` 新增 direct checker command，也不對真實 artifact 執行 checker。

Stage 2：

```text
path-map-freshness-tests（既有 speckit-tests job）
  └─ synthetic authoritative fixtures

user-path-map-freshness（新增獨立 job）
  └─ node scripts/check-user-path-map-freshness.mjs（真實 repository）
```

啟用時將 checker 的 registry row 改由獨立 production job 覆蓋，harness 仍由 `speckit-tests` job 覆蓋；`CLAUDE.md` 同批加入 direct local command。這個切換只有在下列條件全數成立後才可執行：

1. #645 artifact 與權威檔頭已合併；
2. 本 design 經 amendment 記錄所有 open decisions；
3. Stage 2 committed Red/Green 全綠；
4. 真實 repository direct checker exit `0`；
5. OpenSpec schema validation 與 Project SDD lint 重新通過；
6. 使用者明確確認 activation。

### 4. 監看集合固定，最終比較語意延後

受監看來源依 issue #665 固定為：

- `design/prototype/pages/**`
- `design/system/screen-inventory.md`

checker 最終必須以 #645 artifact 所記錄的 prototype source revision 為基準，判斷其後的受監看變更，並在 stale diagnostic 區分 prototype、screen inventory 或兩者。但「如何解析 recorded revision」與「如何判斷其後」仍是 blocked design decision，不在 Stage 1 透過 mtime、`HEAD`、日期或任意 Git command 猜測。

### 5. Source authority 與 fail-closed boundary

#645 合併後的 HTML 檔頭是唯一 metadata authority。Stage 2 不接受環境變數 override、第二份 manifest、相容別名或從 current `HEAD` 推導缺失值。metadata 缺漏／重複／格式錯誤、revision 無法解析或 history 不足時均為 configuration failure，而非 fresh。

diagnostic 必須陳述觸發條件；可以捕捉底層 Git／parser 錯誤供穩定分類使用，但不能把 raw child output 當成唯一輸出。exact rule ID、訊息與 parser locator 在 Stage 2 amendment 後才固定。

## Stage 2 Open Decisions（全部受 #645 阻擋）

下列項目未決，實作 agent 不得自行選擇：

1. HTML 內 recorded prototype source revision 的權威 locator 與唯一性規則。
2. 可接受的 revision 表示形式、長度、canonical resolution 與 ancestor 要求。
3. 「revision 之後」的完整 Git comparison semantics，包括 merge history、rename、path existence 與 source ordering。
4. dirty／untracked target 與 monitored sources 的處理方式。
5. shallow clone、缺少 object 或 history 不完整時的 configuration 行為。
6. fresh、各 stale trigger 與各 configuration case 的 stable rule ID／訊息。
7. production CI 是否需要 checkout full history，以及最小 fetch-depth 契約。

任何一項未記錄在 design amendment 時，Stage 2 Red、Green 與 production activation 都保持 blocked。

## TDD 與 file ownership

| 檔案 | Owner | 用途 |
|---|---|---|
| `scripts/speckit-tests.sh` | `senior-qa` | Stage 1／2 committed Red 與 regression harness |
| `scripts/check-user-path-map-freshness.mjs` | `senior-devops` | production checker |
| `scripts/ci-jobs.tsv` | `senior-devops` | CI/local/script parity mapping |
| `.github/workflows/ci.yml` | `senior-devops` | Stage 2 production job；Stage 1 不修改 |
| `CLAUDE.md` | `main` | Stage 2 local command；Stage 1 不修改 |

Stage 1 Red 只修改 harness，先提交並執行，expected failure 必須是 checker entry point 缺失。paired Green 建立 checker；因新增 checker 與 mandatory registry row 必須原子避免 `CI_JOB_PARITY` gap，該 task 使用允許的 `scaffold` exception，且不得修改 Red harness。

Stage 2 在 hard checkpoint 後先修改同一 harness，expected failure 必須是 foundation checker 尚未解析權威 metadata／比較受監看 history；Green 只修改 checker。CI registry、workflow 與 `CLAUDE.md` 各為後續單檔 task。

## Verification gates

### Propose checkpoint

本 change 四件套完成後：

1. 執行 non-strict OpenSpec schema validation；
2. 執行 `scripts/check-sdd.sh`；
3. 兩者分開回報；
4. 停止並取得使用者明確確認，才可進 `/opsx:apply`。

使用者即使確認 apply，也只解除 Stage 1。Stage 2 仍需 #645 hard checkpoint、design amendment、兩個 gate 重跑與第二次明確確認。

### Stage 1 gates

- committed Red evidence：只因 checker 缺失失敗。
- Green：`bash scripts/speckit-tests.sh`。
- parity：`scripts/check-sdd.sh` 無 `CI_JOB_PARITY`。
- syntax／scope：`node --check scripts/check-user-path-map-freshness.mjs`、`git diff --check`。
- negative activation：workflow 與 `CLAUDE.md` 不含 direct checker production invocation。

### Stage 2 gates（Blocked）

- amended OpenSpec schema validation 與 Project SDD lint。
- committed Red/Green authoritative fixture suite。
- 真實 repository direct checker exit `0`。
- direct job／local command／registry parity。
- applicable repository verification suites與 `git diff --check`。

## Migration / Activation Plan

1. 先交付 Stage 1 Red／Green 與 regression mapping，不建立真實 artifact job。
2. 保持 change open，等待 #645 合併。
3. 讀取已合併 HTML 與 #645 acceptance，更新 canonical spec／design／delta 以解決全部 open decisions。
4. 重跑 OpenSpec schema validation 與 Project SDD lint，取得使用者第二次明確確認。
5. 完成 Stage 2 Red／Green，先在真實 repository 手動證明 checker exit `0`。
6. 最後才新增 production job、direct local command 與 registry mapping。
7. final PR group 完成 Source-Verify 與 archive/write-back；合併後更新 STATUS 並移動 canonical spec。

Rollback 時先移除外部 required-check expectation，再回復 production job、direct local command 與 registry mapping；不得把缺少 production job 描述為 freshness success。Stage 1 regression 可獨立保留。

## Risks / Trade-offs

- [Stage 1 checker 被誤當成完整功能] → help 與正式 invocation 明確表示 authority 尚未 activation；CI 只跑 fixtures，不對真實 artifact 宣稱 fresh。
- [新增 script 造成 parity gap] → Green scaffold 原子新增 checker 與既有 regression job mapping，Stage 1 final gate 要求零 `CI_JOB_PARITY`。
- [Stage 2 猜測 #645 header] → open decisions 全列為 hard blocker，需 amendment 與第二次使用者確認。
- [production job 太早加入導致 main 永紅] → workflow／`CLAUDE.md` task 明確位於 Stage 2，且以真實 checker exit `0` 為前置條件。
- [缺檔被 temporary pass 隱藏] → 不建立 conditional skip job；Stage 1 根本不接 production invocation，direct invocation 對缺檔 exit `2`。

## Constitution Check（憲法檢查）

- **I. Spec-First**：design 目標與 canonical `## 功能目標` 一致，並以 FR／AC／SC 為實作與驗證邊界。
- **IV. Test-First**：兩階段皆有獨立 QA Red、main 驗證 expected failure、paired Green 與不可改寫 Red contract。
- **X. Change Scope Discipline**：只修改 checker、harness 與必要 CI parity consumers；path map、prototype、inventory、API 與 DB 排除。
- **XVII. CI/CD Quality Gates**：fixture coverage 與 production gate 分離；不以 always-pass 或 permanent-fail job 取代有效 gate。
- **XIX. Environment & Configuration Integrity**：不完整 authority／history fail closed，CI/local 使用同一 direct command。
- **XX. Source of Truth & Contract Governance**：#645 HTML metadata 與 `scripts/ci-jobs.tsv` 各自維持唯一 authority，不建立第二份 metadata。
- **II. Generalization-First** 與 **III. Data Fairness**：不觸及 task-type runtime、annotator data、ground truth 或 scoring。
