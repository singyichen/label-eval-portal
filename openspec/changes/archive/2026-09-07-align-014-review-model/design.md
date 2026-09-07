# 設計決策：014 審核模型對齊 015 v5.0.0

本文件記錄本變更的設計取捨。行為契約以 `specs/task-management/014-task-detail/spec.md` 之 delta 為準，本文件只說明「為何這樣選」。

## D1：衍生視圖缺少 014 基線，MODIFIED delta 需先建基線

`openspec/specs/` 目前只有 `annotation/015-annotation-workspace`、`foundation/000-foundation`、`foundation/001-project-sdd-lint`、`task-management/013-task-new` 四份衍生檢視，**沒有 `task-management/014-task-detail`**——014 從未經 OpenSpec 流程異動過。

`openspec archive` 對 `## MODIFIED Requirements` 的處理是「以 delta 區塊取代衍生檢視中的同名 requirement」，前提是該 requirement 已存在且其 scenario 集合被 delta 完整覆蓋。缺基線時 archive 會以 `target spec does not exist` 或 `current spec contains scenario(s) not present in the modified block` 拒絕。

**決策**：本 change 於實作群組之前，先在 `openspec/specs/task-management/014-task-detail/spec.md` 建立基線，內容取自本變更**動工前**的正典條文（v2.11.2），且其 `#### Scenario:` 標題必須與 delta 的 scenario 標題**逐字相同**——否則覆蓋檢查仍會失敗。基線的 Purpose 段明載「本基線僅為使 MODIFIED 有前值而建，不是獨立的規格來源」，避免日後被誤讀為第二份正典。

**否決方案**：把整份 delta 改寫成 `## ADDED Requirements`。可繞過基線需求，但會讓衍生檢視憑空出現六條「新」需求、丟失「這是既有條文的修改」這個語意，且 archive 後的正典回寫無從對照舊值。

## D2：`reviewer_ids` 的身分格式（issue #688 第 ⑦ 項）

這是本 change 相對 deferred 計畫的**增量**，也是 PR #683 卡住的直接原因。目前兩端各用一套命名空間：

| 位置 | 取值 | 例 |
|---|---|---|
| `design/prototype/pages/task-management/task-detail.data.js:1035` | Email | `mandy@labelsuite.io` |
| `design/prototype/pages/annotation/annotation-workspace.data.js:214`（`REVIEWER_ROSTER`） | slug | `reviewer_wang` |

PR #683 讓 `getAssignedReviewUnits()` 改讀 `reviewer_ids` 後 20 個審核流程測試轉紅，正是因為它拿 014 的 Email 去比對 015 的 slug。

**決策（維護者 2026-09-07 裁定）**：`reviewer_ids` 與 `arbiter_ids` 的元素定義為**不透明 user id**，取值來源為 014 既有實體 `TaskMembership.user_id`，形狀沿用 `annotation/015-annotation-workspace` `REVIEWER_ROSTER` 的 slug（`reviewer_wang`）。Email 降為成員清單的顯示屬性，**不得作為比對鍵**。014 原型 seed 的 Email 值須遷移為 slug，成員名冊人選（Mandy Chen／Kevin Liu／Rachel Wu）不變，僅改配 id。

理由：015 的 `REVIEWER_ROSTER` 已是四個消費端（工作區、清單、歷程、儀表板）共用的識別鍵，其 slug 形狀是本專案審核員身分的既成慣例；讓 014 改邊比讓 015 改邊便宜一個數量級。但**取值來源仍是 014 自身的 `TaskMembership.user_id`**（正典實體既有欄位），而非反向讀取 015 的示範 seed——`design/prototype/pages/annotation/annotation-workspace.data.js:2087` 的既有註解已載明架構方向是「014 的 `reviewer_ids` 成為來源、015 屆時換掉 roster」，若倒過來寫會把示範資料升格成正典。兩份 demo 名冊是不同的人（014 三位、015 四位），那是示範資料層的落差，不是契約層的落差，本 change 不處理。「不透明 id」的措辭同時預留後端接上時換成 UUID 的空間——若把 Email 寫進契約，後端一旦不以 Email 為主鍵就得再破一次。

**否決方案**：在消費端加一層 Email ↔ slug 對照。這會憑空產生第二份名冊（違反 Generalization-First），且對照表本身沒有真實資料來源。

## D3：仲裁者指派改由系統判定合格非當事人

原 FR-005k 提供「分派給仲裁者」按鈕，由專案負責人把爭議池輪流推給仲裁者。`annotation/015-annotation-workspace` FR-060 則規定仲裁由具資格的非當事人自 `annotation-list` 認領——兩套機制互斥。

**決策（維護者 2026-09-07 裁定）**：移除按鈕，改由系統判定。判定條件 = `ARBITER_CANDIDATE_RULE`（`task_role = reviewer AND membership_status = active AND can_arbitrate = true`）再疊上 `annotation/015-annotation-workspace` FR-060 的非當事人條件（對該審核單位已提交審核者不得仲裁該單位）。

**這是規格追上既有實作，不是行為變更**：`design/prototype/tests/cross-role/xrole-canonical-journey.spec.ts:856`（`XROLE-17`）已斷言「仲裁入口僅提供給合格的非當事人仲裁者」且長期為綠。本群組 MUST NOT 修改該測試——若實作改動使其轉紅，代表改壞了既有行為而非規格對齊。

`ARBITER_CANDIDATE_RULE` 同時加上 `can_arbitrate = true`：原規則的「`arbiter_ids` 可留空 = 任一未參與該筆審核的審核員皆可認領」在名冊勾選模型下不成立——留空的語意改為「沒有人可以仲裁」，並由 FR-010t 於發布時警示。

## D4：`min_reviewers` 完全移除，不保留為唯讀欄位

**決策（維護者 2026-09-07 裁定）**：`MIN_REVIEWERS_RULE` 常數、FR-010s 的 `每筆資料審核員數` 檢視欄位、FR-010s-1 的數字輸入框與儲存閘門、FR-010t 的人數比較、`TaskDetail` 的 `min_reviewers` 欄位全數移除。

**否決方案**：保留為恆為 `1` 的唯讀顯示欄位。表面上較保守，實際上更糟——它會讓讀規格的人以為這個值有朝一日可能不是 `1`，而 `annotation/015-annotation-workspace` 已明載「定稿門檻恆為 1」。保留一個永遠不變的數字欄位只是把已經消失的概念留在畫面上。原型 seed 也已無此欄位（`task-detail.data.js:1017` 僅存一行說明其已移除的註解）。

## D5：`review_assignment_mode` 整個概念移除，不在 015 補「手動指派」例外

`annotation/015-annotation-workspace` FR-093 的措辭是「審核工作必須由系統自動指派……不由審核員自行挑單」，與 014 的 `manual` 模式（專案負責人逐一分派）字面衝突。

**決策（維護者 2026-09-07 裁定）**：移除 `REVIEW_ASSIGNMENT_MODES` 與 `review_assignment_mode`，**不**回頭替 015 FR-093 加一條「除非任務設定為手動指派」的例外，015 不因本變更升版。

理由：`manual` 模式的存在價值來自「多位審核員競爭同一批資料時需要人為平衡負荷」，單人接力模型下每個審核單位恰一位審核員，平均分派沒有需要人為介入的自由度。替 015 加例外會讓兩份正典各留半套指派機制，是最差的中間態。

## D6：最終例外池的資料來源與 `run_type` 分流

FR-018 的清單不自建資料，逐列內容由審核單位推導：仲裁裁定為 `reject`（`annotation/015-annotation-workspace` `ARBITRATION_OUTCOMES`）且尚未經 `EXCEPTION_POOL_ACTIONS` 處置者即為待處置項。

`dry_run` 與 `official_run` 的例外項各自獨立計數，但 FR-008b 第 4 項的結案閘門**只計 `official_run`**——試標不產生定案答案（`annotation/015-annotation-workspace` FR-095 明載試標例外池沒有自訂答案出口），若讓試標例外項阻擋正式標記結案，等於要求專案負責人為不產生答案的項目做逐筆收尾。

`0` 項時渲染空狀態而非隱藏整個區塊：FR-008b 第 4 項是結案閘門，需要一個恆定可稽核的呈現點；區塊消失會讓「例外池已清空」與「這個任務沒有例外池」兩種狀態在畫面上無法區分。

## D7：PR 群組拆分（Principle X）

待實作產品檔案 3 個，未逾 5 檔上限，但兩組任務目的不同（PR 單一目的原則）：

| 群組 | 目的 | 產品檔案 | 最終群組 |
|---|---|---|---|
| 1 | `reviewer_ids` 身分遷移（D2），解除 PR #683 阻塞 | `task-detail.data.js` | 否 |
| 2 | 最終例外池入口與結案閘門（FR-018／FR-008b） | `annotation-progress.html`、`task-detail.html`、`task-detail.data.js` | 否 |
| 3 | archive 與正典回寫 | 無 | **是** |

群組 1 先行的理由：它是 PR #683 的解鎖前提，且與群組 2 在 `task-detail.data.js` 同檔改動，以群組序列（1 → 2）保證不衝突。

群組 0（lint 合規）不含產品檔案，併入群組 1 的 PR：canonical 014 缺 `## 功能目標` 標題、`功能分支` frontmatter（`docs/211-disabled-annotator-rule`）與 `specs/STATUS.md` 該列的分支（`feat/task-management/014-work-log-split`）不一致，兩者皆為 active change 的硬性 lint 條件。

## Risks

1. **群組 5 實作先於容器（已發生，不可回溯）**：deferred 計畫之原群組 5 已於 PR #609 完成，`task-detail.data.js:1315` 的註解已寫著「spec v3.0.0」而該版本從未存在。本 change 的容器是**事後補登**。緩解：tasks.md 將該段列為已完成並標註 PR #609 為證據來源，不重派工、不要求重跑 Red；archive 時的 Source-Verify 需逐條確認 delta 條文與既有實作一致，而非確認實作是依 delta 寫的。
2. **PR #683 的 20 個紅測試不由本 change 轉綠**：群組 1 只統一身分格式，#683 的 `getAssignedReviewUnits` 改動本身仍需重做。緩解：群組 1 的驗證只要求 `pnpm playwright test tests/task-management` 與 `tests/annotation` 維持既有綠度，不把 #683 的斷言拉進本 change。
3. **`XROLE-04`／`XROLE-20`／`XROLE-21` 三個已知落差**：分別是 `min_annotators` 未對實際人數強制、結案未被未解爭議阻擋、結案無二次確認，皆以 `test.fail` 形式存在。FR-010t 與 FR-008b 的改版**不以解除這三項為目標**。緩解：若實作使任一項意外轉綠（`test.fail` 轉綠會被 Playwright 判為失敗），須於任務驗證時明示並另開 issue，不得就地改測試。
4. **原型 Playwright 套件的 port 競用**：多 worktree 並行時 `reuseExistingServer` 會接到別的 worktree 的 `serve.mjs`，症狀是整批測試以 `Cannot read properties of undefined` 失敗而非斷言失敗。緩解：每次執行一律指定唯一 `PW_PORT`。
