# 任務清單：add-user-path-map-freshness-check

> **Apply 前硬閘**：先執行 `openspec validate add-user-path-map-freshness-check --type change`（或等價 non-strict all-changes command）與 `scripts/check-sdd.sh`，分別回報 OpenSpec schema validation 與 Project SDD lint。兩者通過後必須停止，取得使用者明確確認才可進入 Stage 1 `/opsx:apply`。主 session／team lead 是唯一可驗證 Red／Green evidence 與更新 checkbox 的角色。

## 1. PR-PATH-MAP-FRESHNESS-FOUNDATION — #645 前的安全 CLI 與 regression coverage

> **相依與平行性**：本群組嚴格序列 1.1 → 1.2 → 1.3 → 1.4；不使用 parallel markers。1.1 的 committed Red 必須先於 1.2。Stage 1 不修改 `.github/workflows/ci.yml`、`CLAUDE.md` 或真實 `design/system/user-path-map.html`，且不得加入 production freshness invocation。

**故事目標**：SC-001、SC-002、SC-006 — 在不猜測 #645 metadata 的前提下，以 fail-closed CLI、既有 CI regression harness 與零 parity gap 建立安全 foundation。

- [ ] 1.1 修改 `scripts/speckit-tests.sh`，新增 Stage 1 QA Red fixtures，涵蓋 help、無效參數／root、缺少 path map artifact、authority 尚未 activation 與 no-write，對應 AC-1.1～AC-1.4；先提交此單檔 Red，再執行 harness，expected failure 必須只因 checker entry point 不存在，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 1.2 Green：建立唯讀 `scripts/check-user-path-map-freshness.mjs`，只實作 FR-001～FR-003 的 help／usage／root／missing-or-unsettled-authority preflight；不得解析任何假想 metadata、修改 QA contract 或回報 production fresh。 [@senior-devops]
- [ ] 1.3 修改 `scripts/ci-jobs.tsv`，將 checker 宣告由既有 `speckit-tests` job／local regression command 覆蓋；不得新增豁免或 production freshness mapping。 [@senior-devops]
- [ ] 1.4 執行 command-only Stage 1 verification：`node --check scripts/check-user-path-map-freshness.mjs`、`bash scripts/speckit-tests.sh`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`rg -n 'check-user-path-map-freshness' .github/workflows/ci.yml CLAUDE.md`、`git diff --check`；前四與最後一個 command 預期 exit `0`，`rg` 預期 exit `1` 且無輸出，以證明 regression 受既有 job 覆蓋、`CI_JOB_PARITY` 為零，並且 workflow／`CLAUDE.md` 尚無 direct production invocation。 [@main]

## #645 hard checkpoint（NON-CHECKBOX）

Stage 1 可合併後保持本 change open。Stage 2 開始前，主 session 必須：

1. 確認 #645 已合併，且 `design/system/user-path-map.html` 與權威 source metadata 可從本 branch 讀取。
2. 逐項解決 `design.md` 的七個 Stage 2 Open Decisions；不得由 QA 或 implementation agent 自行選擇。
3. 更新 canonical spec、design 與 delta，使 metadata locator、revision resolution、完整 stale semantics、dirty／shallow history handling、stable diagnostics 與 CI fetch contract 都可測試。
4. 重新執行 OpenSpec schema validation 與 `scripts/check-sdd.sh`。
5. 停止並取得使用者第二次明確確認，才可進入下列 Stage 2 tasks。

任一條未完成時，2.1～2.6 全部 blocked。

## 2. PR-PATH-MAP-FRESHNESS-AUTHORITY — #645 後的 authoritative Red／Green

> **相依與平行性**：本群組嚴格序列 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6；前置條件為 #645 hard checkpoint 全數完成。2.1 committed Red 必須先於 2.2；2.3～2.5 只有真實 repository checker exit `0` 後才能開始。不得使用 conditional skip 或 missing-artifact pass。

**故事目標**：SC-003～SC-006 — 依 #645 的已合併 authority 完成可定位的 fresh／stale 判定，再啟用 local／CI production gate。

- [ ] 2.1 修改 `scripts/speckit-tests.sh`，依已核准 design amendment 新增 Stage 2 QA Red fixtures，涵蓋 fresh、兩個來源各自 stale、兩者 stale、invalid authority／history、dirty／shallow boundary 與 unmonitored-path negative control，對應 AC-2.1～AC-2.5；先提交此單檔 Red，再執行 harness，expected failure 必須是 foundation checker 尚未實作核准的解析／比較語意，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 2.2 Green：只修改 `scripts/check-user-path-map-freshness.mjs`，依 approved QA contract 與 amended design 實作 FR-004～FR-007；不得修改 QA contract、HTML、prototype 或 screen inventory。 [@senior-devops]
- [ ] 2.3 修改 `scripts/ci-jobs.tsv`，保留既有 harness mapping，並將 checker row 由 regression coverage 切換至新的 direct production job 與已核准本機命令；不得加入豁免列或重複 script row。 [@senior-devops]
- [ ] 2.4 修改 `.github/workflows/ci.yml`，新增獨立 user path map freshness job，以 Stage 2 amendment 核准的 checkout history 契約執行 direct checker；job 不得在 artifact／metadata 缺少時 skip 或回傳成功，也不得包裝 OpenSpec／Project SDD lint。 [@senior-devops]
- [ ] 2.5 修改 `CLAUDE.md` 的 Verification Commands，加入與 production job 相同的 direct checker command，並清楚區分它與 regression command；此 protected-file 修改只依使用者對 issue #665 的明確實作授權執行。 [@main]
- [ ] 2.6 執行 command-only Stage 2 verification：`node --check scripts/check-user-path-map-freshness.mjs`、`bash scripts/speckit-tests.sh`、`node scripts/check-user-path-map-freshness.mjs`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`rg -n 'check-user-path-map-freshness' scripts/ci-jobs.tsv .github/workflows/ci.yml CLAUDE.md`、`git diff --check`；全部預期 exit `0`，Project SDD lint 不得輸出 `CI_JOB_PARITY`，並逐一保存 true-repository fresh 與 direct local／CI parity evidence。 [@main]

## 3. PR-PATH-MAP-FRESHNESS-FINAL — 完整驗證與 archive readiness

> **相依與平行性**：前置條件為 2.6 與 production CI 成功；本群組只有 command-only verification，不修改檔案、不使用 parallel markers。完成後才可進 final PR group 的 Source-Verify／archive continuation。

**故事目標**：SC-004～SC-006 — 以四個獨立 gate 與真實 repository freshness evidence 證明 change 可進入 final archive。

- [ ] 3.1 執行 command-only final verification：`openspec validate add-user-path-map-freshness-check --type change`、`scripts/check-sdd.sh`、`bash scripts/speckit-tests.sh`、`node scripts/check-user-path-map-freshness.mjs`、`scripts/check-spec-artifacts.sh`、`git diff --check`；全部預期 exit `0`，分開記錄 OpenSpec schema、Project SDD lint、code/test、真實 artifact freshness 與 scope evidence。 [@main]

## Pre-merge finalization（在 /opsx:apply 外，NON-CHECKBOX）

所有 apply checkbox 完成、PR-group review 順序與使用者確認均通過後，final PR group 才執行 Source-Verify 與 `/opsx:archive add-user-path-map-freshness-check`。Archive 必須回寫 `specs/foundation/002-user-path-map-freshness-check/spec.md` 的版本與 Changelog、生成 derived view，並依 `docs/sdd-workflow.md` §6.2 逐條 grep canonical citation；final merge 後才更新 `specs/STATUS.md` 並移動 canonical spec 至 `specs/_archive/`。
