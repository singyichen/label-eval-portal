# 任務清單：seq-tagging-span-export-metrics

> **Apply 前硬閘**：先執行 `~/Library/pnpm/openspec validate seq-tagging-span-export-metrics --type change`（或等價 non-strict all-changes command）與 `scripts/check-sdd.sh`，分別回報 OpenSpec schema validation 與 Project SDD lint。兩者通過後必須停止，取得使用者明確確認才可進入 Stage 1 `/opsx:apply`。主 session／team lead 是唯一可驗證 Red／Green evidence 與更新 checkbox 的角色；QA 與實作 agent 皆不得自行勾選。

> **裁決前置（NON-CHECKBOX）**：`design.md` 的 D1、D2、D3、D5 已於 2026-09-08 由維護者裁定（見 `design.md` 之「裁決紀錄與待決事項」），D1 取新增 `IAA_UNCALIBRATED_TYPES`、D2 只改 `sequence_tagging`、D3 不在本 change 做匯出對話框 UI、D5 之孤兒常數併入下一個以 015 為正典的 change 清除且 `SINGLE` 退場，四項皆與草案一致故 delta 無需修改。**D4 亦已於同日裁定**：推導模組落在 `design/prototype/pages/shared/`（沿用 `annotation-history.js` 的跨頁共用先例），確切檔名於 apply 時依該目錄命名慣例決定。五項皆已裁定，無任務因裁決而 blocked。

## 1. PR-SEQ-STATS-SPAN — 統計總覽改以 span 為母體

> **相依與平行性**：本群組嚴格序列 1.1 → 1.2 → 1.3；不使用 parallel markers。1.1 的 committed Red 必須先於 1.2。本群組不動 quality tab，也不動匯出流程。

**故事目標**：SC-004 — 讓 `sequence_tagging` 的 stats 區塊在 `tokenization` 與 `tagging_scheme` 兩個設定欄位消失後仍可正確渲染，母體由 token 序列改為已提交的 span 集合。

- [x] 1.1 修改 `design/prototype/tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts`，新增對應 AC-2.7 的 Red 斷言：標籤類型分佈只出現不帶前綴的 label、一段 n 字標記計為 1 筆、片段長度分佈以字元分桶；先提交此單檔再執行，expected failure 必須來自現行 partial 仍以 token 與 tag 前綴渲染，並保存 command、exit 與失敗訊息。證據：commit `89cab2cd`（前置 `80c85699`／`58076cba`／`17272e6f`），單檔 `design/prototype/tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts`；`PW_PORT=8971 corepack pnpm playwright test tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts` 得 8 failed / 3 passed，失敗集合為 `:86` `:100` `:107` `:129` `:153` `:185` `:205` `:242` 八條 AC-2.7 斷言，通過的 `:21` `:45` `:65` 為其他 task type 對照組，證明失敗來自 partial 仍以 token 與 tag 前綴渲染而非測試檔本身損壞；`git diff --stat origin/main 89cab2cd -- design/prototype/pages openspec` 無輸出，確認此 Red 提交點尚未動任何產品檔。 [@senior-qa]
- [x] 1.2 Green：改寫 `design/prototype/pages/dataset/dataset-analysis-detail.partials/stats-sequence_tagging.html`，依 FR-009L 將三項指標改為標籤類型分佈、每句平均標記片段數與字元長度分佈；QA 已提交的斷言為契約，實作端只實作、維持原樣。證據：commit `86003683`（2 產品檔 `stats-sequence_tagging.html` 與 `dataset-analysis-detail.html`，合計 +79/−24）。partial 由單一 section 擴為三個 section：`statsSeqTagDistTitle`（標籤類型分佈，列出 `ORG`／`TITLE` 兩個不帶 `B-`／`I-` 前綴的 label）、新增 `statsSeqTagAvgSpanTitle`（每句平均標記片段數）與 `statsSeqTagSpanLenTitle`（依 `end − start` 字元長度分桶，4 字元以上併為 `4+`）；原 `O`／`B-PER`／`I-PER`／`B-ORG` 四列與 `sequenceTaggingStats.tags.*` 鍵於改版後已不復存在。`dataset-analysis-detail.html` 內嵌之 zh（`:710` 起）與 en（`:1065` 起）兩份 i18n bundle 同步改寫，`sequenceTaggingQuality` 一字未動（屬 FR-012L／群組 2）。`git diff 89cab2cd 86003683 -- design/prototype/tests/` 為空（0 行），確認實作端未改寫既有測試契約。主 session 獨立複跑 `PW_PORT=8995 corepack pnpm playwright test tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts` → **11 passed (3.8s)、exit 0**。因變更落在 `design/prototype/pages`，另依 INVENTORY_FRESHNESS 以 `node scripts/gen-screen-inventory.mjs` 重生 `design/system/screen-inventory.md` 並單獨提交為 `ffddf70e`。 [@senior-frontend]
- [x] 1.2b 同步退役 `design/prototype/tests/dataset/dataset-analysis-detail-sequence-tagging-i18n.spec.ts` 之 `:15` 與 `:25` 兩條 stats 分頁測試中鎖死舊文案的斷言（`#statsSeqTagDistTitle` 的 `標記類型分佈`／`Tag Type Distribution`、`#statsSeqTagDistDesc` 的 token 與 O tag 語句），改寫為 FR-009L `:95` 生效後的 label-type 文案；本檔的 quality 分頁斷言（`:37` 起）屬 FR-012L 範圍，留待群組 2 處理，本任務不得更動。**計畫遺漏補記**：1.1 的契約只涵蓋新測試檔，未涵蓋既有迴歸測試對同一組 i18n key 的精確文案斷言，而 FR-009L `:91` 明文 BREAKING 廢止該文案，故 1.2 完成後此二測試必然失敗；CI 的 `Prototype — Playwright Tests` 執行 `pnpm test`（全量 `playwright test`），不同步退役即無法合併本群組 PR。驗證：`PW_PORT=8993 corepack pnpm playwright test tests/dataset/` 全數通過。證據：commit `93d6047f`（單檔，+3/−3）——`:21`／`:22` 兩行改為 `標籤類型分佈` 與 `各標籤類型在已提交標記片段中的筆數與比例`，`:33` 改為 `Label Type Distribution`，三處皆維持 `toHaveText` 精確比對而未弱化為 `toContainText`。`:34` 的 `not.toContainText(/[標記類型分佈全體]/)` 刻意保留：該字元集自 `b8698f24` 起用於擋 zh 文案洩漏進 en 模式，改版後 `標籤類型分佈` 仍供給「標」「類」「型」「分」「佈」、`distNote` 的「標記片段」仍供給「記」，護欄依然有效，僅「全」「體」成為冗餘。主 session 獨立複跑 `PW_PORT=8994 corepack pnpm playwright test tests/dataset/` → **90 passed (25.1s)、exit 0**，涵蓋本檔 quality 分頁（`:37` 起）未被更動仍全綠。 [@senior-qa]
- [x] 1.3 執行 command-only 群組驗證：`pnpm typecheck`、`pnpm playwright test tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`git diff --check`；全部預期 exit `0`，並保存 1.1 的失敗提交雜湊與 1.2 的 exit-0 evidence。證據（主 session 於 `93d6047f` 上逐條實跑）：`corepack pnpm typecheck` exit 0；`PW_PORT=8995 corepack pnpm playwright test tests/dataset/dataset-analysis-detail-stats-i18n.spec.ts` → 11 passed、exit 0；另因 CI 之 `Prototype — Playwright Tests` 執行全量 `pnpm test`（`design/prototype/package.json:6` 定義為 `playwright test`、無路徑過濾），加跑 `PW_PORT=8994 corepack pnpm playwright test tests/dataset/` → 90 passed / 0 failed、exit 0；`scripts/check-sdd.sh` → `Project SDD lint: 0 error(s), 29 warning(s)`、exit 0；`scripts/check-spec-artifacts.sh` → `Spec artifact check passed`、exit 0；`git diff --check` 無輸出、exit 0。1.1 的失敗提交雜湊為 `89cab2cd`（8 failed / 3 passed），1.2 的 exit-0 提交雜湊為 `86003683`。本群組對 `origin/main` 之最終 diff 為 6 檔：產品檔 2（`stats-sequence_tagging.html`、`dataset-analysis-detail.html`）、測試檔 2、產生檔 1（`screen-inventory.md`）、`openspec/**` 1，符合 Principle X 之 5 檔／300 行門檻。 [@main]

## 2. PR-SEQ-QUALITY-UALPHA — 品質監控改 span-level 指標與未校準中性呈現

> **相依與平行性**：本群組嚴格序列 2.1 → 2.2 → 2.3 → 2.4 → 2.5；前置為群組 1 合併與 D1 已裁定。2.1 的 committed Red 必須先於 2.2，2.3 的 committed Red 必須先於 2.4。本群組不動 stats partial，也不動匯出流程。

**故事目標**：SC-035、SC-036、SC-006、SC-021、SC-026、SC-027 — 主指標改 Krippendorff u-α，逐樣本分歧度與標記員排名改 span F1，並讓未校準型別只顯示數值與排序而不做門檻判定。

- [ ] 2.1 修改 `design/prototype/tests/dataset/dataset-analysis-detail-sequence-tagging-i18n.spec.ts`，新增對應 AC-3.7、AC-3.18、AC-3.13、AC-3.14 的 Red 斷言：主指標顯示 u-α 與中性「待實證校準」標示、頁面同時查無門檻數值與達標色彩、分歧度指標名為 `pairwise_f1`、排名指標名為 `f1_to_merged_reference`；先提交此單檔再執行，expected failure 必須來自現行 partial 仍渲染 Token-level Alpha 與門檻，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 2.1b 修改 `design/prototype/tests/dataset/dataset-analysis-detail-sequence-tagging-i18n.spec.ts`，把任務 2.1 一併移除卻未改寫的兩條 i18n 精確文案斷言補回新契約版本：群體平均列 `#sequenceTaggingGroupAvg` 與一致度說明 `#consistencyNote` 於 zh 與 en 兩語言各自斷言新的 span 級 u-α 文案，並斷言整個品質分頁不得殘留無連字號的 `Token Alpha` 字樣與 O tag 遮罩敘述。此條記錄任務 2.1 之計畫遺漏：AC-3.7 的字面字串為連字號版 `Token-level Alpha`，抓不到群體平均列的無連字號寫法，而一致度說明位於排名區塊、不在 IAA 面板選取範圍內，故實作端可只換方法列而讓頁面上下文案自相矛盾仍全綠。驗證：`PW_PORT=8996 corepack pnpm playwright test tests/dataset/dataset-analysis-detail-sequence-tagging-i18n.spec.ts` 出現失敗，失敗原因為現行 partial 於這兩個元素仍渲染 token 級文案。 [@senior-qa]
- [ ] 2.2 Green：改寫 `design/prototype/pages/dataset/dataset-analysis-detail.partials/quality-sequence_tagging.html`，依 FR-012L、FR-035、FR-036 換指標，並依 FR-043 加上中性未校準標示；此 partial 內查無任何門檻數字與達標色彩，QA 契約維持原樣。 [@senior-frontend]
- [ ] 2.3 修改 `design/prototype/tests/dataset/dataset-analysis-detail-registry-mirror.spec.ts`，新增對應 AC-3.9、AC-3.8 的 Red 斷言：達標徽章分母同時排除未校準與 gate-excluded 型別、排除後綴計數涵蓋兩集合、未校準型別的文案與 `free_text` 文案相異；先提交此單檔再執行，expected failure 必須來自現行分母只排除 `free_text`，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 2.4 Green：修改 `design/prototype/pages/dataset/dataset-analysis-detail.html`，依 FR-013 與 FR-024A 把未校準型別排除於 `x/y` 分母並套用中性樣式，`free_text` 既有文案維持原樣。 [@senior-frontend]
- [ ] 2.5 執行 command-only 群組驗證：`pnpm typecheck`、`pnpm playwright test tests/dataset/`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`git diff --check`；全部預期 exit `0`，另以 `rg -n 'IAA_THRESHOLD_TOKEN|Token-level Alpha' design/prototype` 預期 exit `1` 且無輸出，證明廢止常數無孤兒引用。 [@main]

## 3. PR-SEQ-EXPORT-DERIVATION — 匯出層 BIO 推導與 tokenizer metadata

> **相依與平行性**：本群組嚴格序列 3.1 → 3.2 → 3.3 → 3.4 → 3.5；前置為群組 2 合併、D3 與 D4 已裁定。3.1 的 committed Red 必須先於 3.2，3.3 的 committed Red 必須先於 3.4。D3 若裁定匯出對話框改由以 `specs/_archive/014-task-detail/spec.md` 為正典的 companion change 承載，3.3 與 3.4 整組移出本 change。

**故事目標**：SC-033、SC-034 — 以決定性推導把 `spans[]` 轉為 BIO／BIOES／IOB2 序列，並在詞級模式下強制 tokenizer metadata 與對齊擴張報告。

- [ ] 3.1 新增 `design/prototype/tests/dataset/dataset-analysis-detail-span-to-bio.spec.ts`，依 AC-5.1、AC-5.2 建立 Red 斷言：字元級 BIO 與 BIOES 序列逐格正確、空 span 樣本輸出等長全 `O`、重複匯出結果逐字元相同；先提交此單檔再執行，expected failure 必須來自推導模組尚未存在，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 3.2 Green：依 D4 裁定的落點新增 span 轉序列推導模組，實作 FR-041 的三種方案；此模組為純函式，輸入僅限 `spans[]` 與原始文本，QA 契約維持原樣。 [@senior-frontend]
- [ ] 3.3 修改 `design/prototype/tests/dataset/dataset-analysis-detail-span-to-bio.spec.ts`，依 AC-5.3、AC-5.4 補上詞級 Red 斷言：擴張筆數與逐筆展開內容正確、原始 span 於擴張後維持原值、缺 tokenizer 版本時匯出被阻擋且查無匯出檔；先提交此單檔再執行，expected failure 必須來自詞級路徑尚未實作，並保存 command、exit 與失敗訊息。 [@senior-qa]
- [ ] 3.4 Green：依 FR-042 於推導模組補上詞級對齊擴張、tokenizer metadata 必填檢查與擴張摘要輸出，並依 D3 裁定接線匯出流程的方案與單位選擇器；QA 契約維持原樣。 [@senior-frontend]
- [ ] 3.5 執行 command-only 群組驗證：`pnpm typecheck`、`pnpm playwright test tests/dataset/`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`git diff --check`；全部預期 exit `0`，並保存字元級與詞級各一組實際匯出樣本作為決定性 evidence。 [@main]

## 4. PR-SEQ-EXPORT-FINAL — 完整驗證、正典回寫與 archive readiness

> **相依與平行性**：前置為 3.5 通過與群組 1～3 全數合併；本群組只有 command-only verification 與 archive 寫作，不動原型程式。

**故事目標**：SC-033、SC-035 — 以四個獨立 gate 與 Source-Verify evidence 證明本 change 可回寫正典並封存。

- [ ] 4.1 執行 command-only final verification：`~/Library/pnpm/openspec validate seq-tagging-span-export-metrics --type change`、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh`、`scripts/pre-commit-tests.sh`、`pnpm playwright test`、`git diff --check`；全部預期 exit `0`，並分開記錄 OpenSpec schema、Project SDD lint、code/test 與 scope evidence。 [@main]
- [ ] 4.2 執行正典回寫前的 Source-Verify：逐條 `rg` 驗證 delta 引用的 FR、AC、SC、常數與檔案路徑皆可在正典或 delta 定位，並確認 `IAA_THRESHOLD_TOKEN` 在 `specs/` 與 `design/` 下只剩歷史 Changelog 記述、現行條文查無引用；`SEQUENCE_TAGGING_SCHEMES` 於 015 的孤兒宣告依 D5 裁定處理，其清除不屬本 change 的通過條件。 [@main]

## Pre-merge finalization（在 /opsx:apply 外，NON-CHECKBOX）

所有 apply checkbox 完成、PR-group review 順序與使用者確認均通過後，final PR group 才執行 `/opsx:archive seq-tagging-span-export-metrics`。Archive 必須把版本回寫為 017 v3.0.0 並新增 Changelog 條目，同時處理三件正典層的收尾：退役 SC-024（Token-level Alpha 遮罩）、新增 SC-033～SC-036、更新 `LowConsistencySampleEntry` 與 `AnnotatorQualityRankingEntry` 的指標名稱列舉。依 `docs/sdd-workflow.md` §6.2 逐條 grep 衍生視圖的 canonical citation；final merge 後才更新 `specs/STATUS.md`，並依 issue #578／#596 先例判斷正典 spec 是否留在 `specs/dataset/`。
