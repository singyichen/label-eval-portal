# 任務清單：carry-relation-span-offsets（issue #590）

> **Apply 前硬閘（兩道，互不替代）**：先執行 `openspec validate carry-relation-span-offsets --type change`（或等價 non-strict all-changes command）取得 **OpenSpec schema validation** 結果，再執行 `scripts/check-sdd.sh` 取得 **Project SDD lint** 結果。兩者皆通過後必須停止，取得使用者明確確認才可進入 `/opsx:apply`。**主 session／team lead 是唯一可驗證 Red／Green evidence 與更新 checkbox 的角色**。
>
> **TDD 硬規則**：每個可觀察行為皆為一組 Red（`[@senior-qa]`）＋ Green（`[@senior-frontend]`）配對。Red 任務必須先 commit 並執行、留下預期失敗證據，Green 任務才能開始；Green 任務不得為了讓測試通過而改寫或弱化 Red 契約。
>
> **拆分總則（憲法原則 X）**：本變更觸及 4 個手寫產品檔案（未達 5 檔上限），但產生層、往返層與比對層為三個各自可獨立驗證的行為，且比對層改動具單 PR 逾 300 行之風險，故拆為 **3 組實作群組 ＋ 1 組最終 archive 群組**。每組宣告其涵蓋的 FR、觸及的產品檔案與 Red／Green 配對。**只有最終群組執行 `/opsx:archive` 與正典回寫**。測試檔、`specs/**`、`openspec/**` 不計入 5 檔上限。
>
> **群組間相依**：群組 0 → 1 → 2 → 3 → 4 嚴格序列。群組 1 的起訖產生是群組 2 往返的輸入；群組 2 的往返存活是群組 3 逐實體差異的輸入；群組 4 的正典回寫需前三組行為全部落地後才具備 Source-Verify 依據。群組內一律序列執行。

## 0. 前置

**故事目標**（SC-004X）：`specs/STATUS.md` 與正典 frontmatter 如實反映 `annotation-015` 有一個開啟中的 OpenSpec change，使 `relation_identification` 位置維度的補齊有正確的流程狀態基準。

> **相依與平行性**：0.1 與 0.2 必須同批提交，兩者分開則 `scripts/check-sdd.sh` 的 `ACTIVE_CHANGE_STAGE` 會因分支欄與正典 frontmatter 不一致而報錯。本群組不動任何產品程式。

- [ ] 0.1 修改 `specs/STATUS.md`，將 `annotation-015` 之狀態由 in-progress 更新為 change-open、分支欄改為本 change 的分支並填入 change 名稱。驗證：Project SDD lint 不再回報 `ACTIVE_CHANGE_STAGE`（propose 期已隨本 change 一併提交，待主 session 核實後勾選） [@main]
- [ ] 0.2 修改 `specs/annotation/015-annotation-workspace/spec.md` 之 frontmatter 功能分支欄，使其與 `specs/STATUS.md` 分支欄一致；本任務只改 frontmatter，不動任何 FR／AC／SC 條文。驗證：Project SDD lint 之 `ACTIVE_CHANGE_STAGE` 為 0 筆（propose 期已隨本 change 一併提交，待主 session 核實後勾選） [@main]

## 1. PR-590-A — 起訖產生於引擎快照（FR-098 第 1、2、3 點）

**故事目標**（SC-004X）：關係識別的引擎快照 `previewTriples` 在來源具位置資訊時攜帶主體與客體起訖，來源不具位置資訊時維持 `null` 且不推測，使位置維度自產生的那一刻起就存在。

> **產品檔案（1）**：`design/prototype/pages/task-management/task-config.engine.js`
> **最終群組**：否。本組不執行 archive。
> **相依**：群組 0。1.1 的 committed Red 必須先於 1.2。
> **範圍界線**：只補欄位，顯示字串（`fmtRelSpan()` 之輸出與物件形狀分支的串接結果）一字不動；FR-014L 之 `relation-triple-row` 呈現不得因本組改變。

- [ ] 1.1 新增 `design/prototype/tests/annotation/issue-590-relation-offsets-engine.spec.ts` 之 Red 契約——工作區關係建構器完成一筆三元組後，該筆同時帶有主體與客體的整數起訖四欄位且與所選實體位置一致；物件形狀資料集匯入的三元組同樣帶四欄位；gold 純字串與內建示範串接兩種來源的三元組四欄位皆為 null 且不等於任何以字串比對推得的位置。驗證：`PW_PORT=8951 corepack pnpm playwright test tests/annotation/issue-590-relation-offsets-engine.spec.ts` 全數失敗，失敗原因為引擎快照尚無這四個欄位 [@senior-qa]
- [ ] 1.2 （Green）修改 `design/prototype/pages/task-management/task-config.engine.js`：於互動標記與物件形狀匯入兩個三元組產生點，除既有顯示字串外一併寫入四個整數起訖欄位，來源槽位缺位置資訊時寫入 null；不得以答案字串回原始文本做比對推得位置。驗證：`PW_PORT=8951 corepack pnpm playwright test tests/annotation/issue-590-relation-offsets-engine.spec.ts` 全綠 [@senior-frontend]
- [ ] 1.3 執行群組 1 回歸並保存證據。驗證：`cd design/prototype && corepack pnpm typecheck` 與 `PW_PORT=8952 corepack pnpm playwright test tests/annotation` 皆 exit 0 [@main]

## 2. PR-590-B — CompactAnswer 往返對稱（FR-098 第 4 點）

**故事目標**（SC-004X、SC-006）：起訖在「引擎快照 → CompactAnswer → 引擎快照」的往返兩端皆存活，且舊有三鍵資料仍可讀，使審核回填與歷程重建拿得到位置維度。

> **產品檔案（2）**：`design/prototype/pages/annotation/annotation-workspace.data.js`、`design/prototype/pages/annotation/annotation-workspace.config.js`
> **最終群組**：否。本組不執行 archive。
> **相依**：群組 1。2.1 的 committed Red 必須先於 2.2；2.3 的 committed Red 必須先於 2.4。
> **為何兩端都要改**：序列化端與回填端任一遺漏，即使群組 1 已產生起訖，位置維度仍到不了群組 3 的比對層——這是兩個獨立可觀察行為，故各配一組 Red／Green。

- [ ] 2.1 新增 `design/prototype/tests/annotation/issue-590-relation-compact-answer.spec.ts` 之 Red 契約——提交一筆帶起訖的關係答案後，其 CompactAnswer 為七鍵形狀並保留四個起訖值。驗證：`PW_PORT=8953 corepack pnpm playwright test tests/annotation/issue-590-relation-compact-answer.spec.ts` 全數失敗，失敗原因為序列化端只保留三鍵 [@senior-qa]
- [ ] 2.2 （Green）修改 `design/prototype/pages/annotation/annotation-workspace.data.js`：關係識別之提交答案轉換分支改為一併保留四個起訖欄位，缺值時輸出 null。驗證：`PW_PORT=8953 corepack pnpm playwright test tests/annotation/issue-590-relation-compact-answer.spec.ts` 全綠 [@senior-frontend]
- [ ] 2.3 修改 `design/prototype/tests/annotation/issue-590-relation-compact-answer.spec.ts`，補上回填端 Red 契約——七鍵 CompactAnswer 套回工作區後引擎快照重新帶有四個起訖值；僅含三鍵的既有 CompactAnswer 套回後四欄位為 null 且渲染不中斷。驗證：`PW_PORT=8953 corepack pnpm playwright test tests/annotation/issue-590-relation-compact-answer.spec.ts` 出現失敗，失敗原因為回填端只寫回三鍵 [@senior-qa]
- [ ] 2.4 （Green）修改 `design/prototype/pages/annotation/annotation-workspace.config.js`：關係識別之 CompactAnswer 套用分支改為一併回填四個起訖欄位，缺鍵視同 null。驗證：`PW_PORT=8953 corepack pnpm playwright test tests/annotation/issue-590-relation-compact-answer.spec.ts` 全綠 [@senior-frontend]
- [ ] 2.5 執行群組 2 回歸並保存證據。驗證：`cd design/prototype && corepack pnpm typecheck` 與 `PW_PORT=8954 corepack pnpm playwright test tests/annotation` 皆 exit 0 [@main]

## 3. PR-590-C — 逐實體差異與逐快照對回退（FR-098 第 5、6 點；FR-087 修訂）

**故事目標**（SC-004X、SC-006）：具起訖的關係答案在歷程差異中逐實體列出新增、刪除與邊界變更；不具起訖的來源形狀回退為純值比對而非空差異，使補齊位置維度不會反而讓既有可用的差異消失。

> **產品檔案（2）**：`design/prototype/pages/shared/annotation-history.js`、`design/prototype/pages/annotation/annotation-workspace.config.js`
> **最終群組**：否。本組不執行 archive。
> **相依**：群組 2。3.1 的 committed Red 必須先於 3.2；3.3 的 committed Red 必須先於 3.4。
> **本組內部順序不可調換**：3.2 完成後關係識別即被判定為具位置資訊之類型，歷程差異的純值遞補路徑隨之消失——在 3.4 落地前，不帶起訖的來源形狀會暫時退化為空差異。3.3 的 Red 正是用來鎖住這個暫時退化，3.2 與 3.4 必須落在同一個 PR，不得只合併其中一半。

- [ ] 3.1 新增 `design/prototype/tests/annotation/issue-590-relation-history-diff.spec.ts` 之 Red 契約——帶起訖的關係答案於相鄰兩筆歷程事件間逐實體列出新增與邊界變更（列出變更前後範圍）；同一起點的主體分屬兩種不同關係型別時兩筆各自列出而不互相覆寫；關係型別或觸發詞本身不得被列為實體。驗證：`PW_PORT=8955 corepack pnpm playwright test tests/annotation/issue-590-relation-history-diff.spec.ts` 全數失敗，失敗原因為關係識別仍走純值比對 [@senior-qa]
- [ ] 3.2 （Green）修改 `design/prototype/pages/shared/annotation-history.js`：於 span 抽取器登錄關係識別，只抽取主體與客體兩個實體，每個實體的 label 為角色與關係鍵的組合（關係型別非空時取關係型別、否則取關係顯示字串），並提供一個「兩份快照是否皆有可比對位置」的判定供呼叫端使用；索引鍵機制維持既有形狀不變。驗證：`PW_PORT=8955 corepack pnpm playwright test tests/annotation/issue-590-relation-history-diff.spec.ts` 全綠 [@senior-frontend]
- [ ] 3.3 修改 `design/prototype/tests/annotation/issue-590-relation-history-diff.spec.ts`，補上回退 Red 契約——gold 純字串與內建示範串接兩種來源的相鄰事件差異必須以純值形式呈現且非空；任一側快照無可比對位置時亦回退。驗證：`PW_PORT=8955 corepack pnpm playwright test tests/annotation/issue-590-relation-history-diff.spec.ts` 出現失敗，失敗原因為差異分派一旦判定為具位置資訊之類型即無純值遞補路徑 [@senior-qa]
- [ ] 3.4 （Green）修改 `design/prototype/pages/annotation/annotation-workspace.config.js`：歷程差異分派改為逐快照對判定，僅當前後兩份快照皆有可比對位置時才走逐實體差異，否則回退純值比對。驗證：`PW_PORT=8955 corepack pnpm playwright test tests/annotation/issue-590-relation-history-diff.spec.ts` 全綠 [@senior-frontend]
- [ ] 3.5 執行群組 3 回歸並保存證據。驗證：`cd design/prototype && corepack pnpm typecheck` 與 `PW_PORT=8956 corepack pnpm playwright test tests/annotation` 皆 exit 0，且無新增跳過標記 [@main]

## 群組 3 完成後檢查點（NON-CHECKBOX）

進入群組 4 前，主 session 必須逐項確認：

1. 群組 1～3 的每一組 Red 皆有先行 commit 與預期失敗證據，Green 未改寫任何 Red 斷言。
2. FR-098 第 5 點所載的殘留碰撞在實作與測試中皆未被宣稱為已解決；若實作採用了條文以外的索引鍵形狀，必須先回頭修訂 delta。
3. FR-098 第 7 點的兩種已知落差仍為 `null` 且回退為純值比對，未出現任何以字串比對推得的 offset。
4. issue #590 的追蹤出口已確認：若該 issue 將隨本變更關閉，必須先開立承接第 7 點落差的後續 issue 並更新 delta 之引用。

任一項未完成時，4.1～4.4 全部 blocked。

## 4. PR-590-D — Source-Verify、archive 與正典回寫

**故事目標**（SC-004X）：正典 015 完成回寫並如實記載本次補齊的範圍與仍存在的落差，使後續讀者不需回溯 change 目錄即可知道位置維度的邊界在哪。

> **產品檔案（0）**：本組只動 `specs/**` 與 `openspec/**`。
> **最終群組**：是。本組執行 `/opsx:archive` 與正典回寫。
> **相依**：群組 3 完成後檢查點四項全數通過。
> **附帶清理（issue #581 D5(a) 裁定）**：本組的正典回寫一併刪除 015 第 31 行的孤兒常數宣告，見 4.5。此為同一份正典檔在同一次版本提升中的殘留宣告清除，不引入第二個目的。

- [ ] 4.1 執行 Source-Verify：逐條 grep 本 change 之 proposal 與 delta 內所有 FR／AC／SC ID、檔案路徑與 issue 編號，確認每一項皆可於正典或其指名來源定位。 [@main]
- [ ] 4.2 執行 `/opsx:archive carry-relation-span-offsets`，產生 derived view 並將 FR-098、AC-2.22、AC-2.23、SC-004X 與 FR-087 修訂回寫至正典，版本自 6.0.1 提升為 6.1.0 並補上 Changelog 條目。 [@main]
- [ ] 4.3 修改 `specs/STATUS.md`，將 `annotation-015` 之 change-open 狀態與摘要更新為本次回寫後的結果。 [@main]
- [ ] 4.4 執行最終四閘驗證：OpenSpec schema validation、`scripts/check-sdd.sh`、`scripts/check-spec-artifacts.sh` 與 `scripts/pre-commit-tests.sh` 皆 exit 0，並分開記錄四道閘的證據。 [@main]
- [ ] 4.5 於正典回寫的同一次編輯中，刪除 `specs/annotation/015-annotation-workspace/spec.md` 第 31 行的孤兒常數宣告 `SEQUENCE_TAGGING_SCHEMES = BIO | BIOES | IOB2 | SINGLE`——該行為 issue #581 change ② 於 v6.0.0 自 payload 移除 `scheme` 時漏清，全檔無任何條文引用；維護者於 2026-09-08 裁定（issue #581 之 D5）由下一個以 015 為正典的 change 一併清除，本 change 即是。本任務只刪這一行宣告，不動任何 FR／AC／SC 條文，亦不觸及產品程式。驗證：`/usr/bin/grep -c SEQUENCE_TAGGING_SCHEMES specs/annotation/015-annotation-workspace/spec.md` 為 0，且 `scripts/check-sdd.sh` 與 `scripts/check-spec-artifacts.sh` 皆 exit 0 [@main]

## Pre-merge finalization（在 /opsx:apply 外，NON-CHECKBOX）

所有 checkbox 完成、逐群組 review 與使用者確認皆通過後，final PR group 才執行 Source-Verify 與 `/opsx:archive`。Archive 必須回寫正典的版本與 Changelog、生成 derived view，並依 `docs/sdd-workflow.md` §6.2 逐條 grep canonical citation；final merge 後才更新 `specs/STATUS.md`。正典 spec 依 issue #578／#596 先例留在 `specs/annotation/`，不移入 `specs/_archive/`。
