# 圖表工具鏈分工

`docs/diagrams/` 底下存在三套圖表工具鏈。它們各自解決不同問題，不互相取代。本文說明何時用哪一套、產出放哪裡。

## 分工表

| 工具 | 安裝位置 | 產出格式 | 適用場景 |
|------|---------|---------|---------|
| **`flowchart` skill** | `.claude/skills/flowchart/` | Mermaid（`.mmd`）+ `.png` | 開發者導向的系統流程、狀態機、時序圖 |
| **`diagram-design` skill** | 全域 `~/.claude/skills/diagram-design/`（見下） | 自包含 `.html` + inline SVG | 給非工程受眾看的流程圖，需套用 Label Suite 品牌樣式 |
| **`archify` skill** | `.claude/skills/archify/` | 成對的 `.json`（IR 原始檔）+ 自包含 `.html` | 跨模組的系統架構、資料流、時序、狀態機圖，需與實際程式碼結構對得上 |

## 怎麼選

**先問受眾是誰。**

- **受眾是工程師或 code reviewer** → `flowchart` skill。Mermaid 純文字、diff 友善、GitHub 原生渲染，改一行就看得出改了什麼。缺點是版面與配色不可控。
- **受眾是產品使用者（標記員、審核員）、教授或 Demo Paper 讀者** → `diagram-design`。它是唯一能套用專案 design token 的一套，圖面顏色會跟實際產品畫面一致；且輸出為單一 HTML 檔，直接用瀏覽器開就能看，不需要任何 renderer。
- **受眾是要理解系統結構的工程師，且圖必須反映真實程式碼** → `archify`。它把圖表拆成「JSON 原始檔（IR）＋算繪後 HTML」兩份成對檔案：JSON 是純文字、可逐行 diff、可被 schema 驗證，HTML 是可直接開啟的互動成品。這是三套裡唯一同時滿足「diff 友善」與「不需 renderer 即可閱讀」的一套，代價是 HTML 檔約 700 KB。

**再問要不要進版控做逐行比對。** 需要 → Mermaid（原始碼是純文字）或 `archify`（JSON IR 是純文字）。不需要、重點是視覺成品 → `diagram-design`。

**最後確認目標圖型是否被支援。** `archify` 只有五種圖型 schema：`architecture`、`dataflow`、`lifecycle`、`sequence`、`workflow`（另有 `common.schema.json`，只是共用 `$defs` 片段，不是可選圖型）。**`archify` 沒有 ER／資料模型（data model）圖型**——需要畫資料庫實體關聯時請改用 `diagram-design`（它支援 ER/data model）或 Mermaid `erDiagram`（見下方 ER 圖工具取捨），不要為了遷就工具把 ER 硬塞進 `architecture` schema。

## 產出位置慣例

隸屬單一 spec 的圖放該 spec 的 `diagrams/` 資料夾（例如 `specs/annotation/015-annotation-workspace/diagrams/`、`specs/foundation/000-foundation/diagrams/`），歸檔時隨 spec 一起進 `specs/_archive/`。跨模組、無單一歸屬 spec 的總覽圖例外保留在 `docs/diagrams/workflow/`：

| 檔案 | `diagram_type` | 內容 |
|------|---------------|------|
| [`workflow/sdd-openspec-pipeline.html`](./workflow/sdd-openspec-pipeline.html) | `flowchart` ＋ `swimlane`（`diagram-design`） | SDD／OpenSpec 開發流程、四道驗證閘與微觀交付迴圈（issue #673） |
| `workflow/annotation-pipeline.mmd` / `.png` | Mermaid flowchart | 標記流程總覽，被根目錄 `README.md` 引用 |
| `workflow/system-workflow.png` | —（僅圖檔，無原始檔） | 系統流程總覽，被根目錄 `README.md` 引用 |

`sdd-openspec-pipeline.html` 是本 README「`archify` 圖型不支援時改用 `diagram-design`」的第二個實例：`archify` 的 `workflow` schema 把節點的 `col` 限制在 `0`–`5`（見 `.claude/skills/archify/schemas/workflow.schema.json`），只能容納六個邏輯階層，而 SDD 主流程有十三個階段，且 `CLAUDE.md` 對這條 pipeline 的定義是 `each stage is a hard gate`，壓成六階會把 SSoT 明確區分的階段併掉——那正是這張圖存在的理由。

**跨模組架構圖放 `docs/diagrams/architecture/`。** 這類圖描述的是整個系統的容器邊界、跨模組資料流或跨模組資料模型，不隸屬任何單一 spec，因此不進 `specs/`、也不隨任何 spec 歸檔：

| 檔案 | `diagram_type` | 工具 | 內容 |
|------|---------------|------|------|
| [`architecture/system-container-architecture.html`](./architecture/system-container-architecture.html) | `architecture` | `archify` | 系統／容器架構（issue #667） |
| [`architecture/config-driven-task-engine-data-flow.html`](./architecture/config-driven-task-engine-data-flow.html) | `dataflow` | `archify` | Config-Driven 任務引擎資料流（issue #668） |
| [`architecture/core-data-model-er.md`](./architecture/core-data-model-er.md) | `er` | Mermaid `erDiagram` | 核心資料模型 ER 圖，整合各 spec 的關鍵實體（issue #669） |

`archify` 要**同時提交 `.json` 與 `.html`**：`.json` 是唯一可 diff、可驗證的原始檔，`.html` 是唯一不需工具鏈即可閱讀的成品，缺任一邊都會讓圖變成不可維護的黑盒。改圖時改 `.json` 再重跑 `deliver` 重生 `.html`，不要手改 `.html`。

Mermaid 以**獨立 `.mmd` 檔**提交時要**同時附上算繪後的 `.png`**，否則沒有 renderer 的讀者看不到內容。**例外：Mermaid 直接內嵌在 `.md` 的 ` ```mermaid ` 圍欄裡時不附 PNG**——GitHub 與 VS Code 原生算繪圍欄內容，讀者本來就看得到，此時額外產一份 PNG 只會製造原始碼與圖檔雙份維護。`diagram-design` 的 HTML 本身即成品，不需要另附圖檔；spec.md 內以相對路徑連結 HTML 即可，不另出 PNG（issue #528 決議 Q4）。

ER／資料模型圖另有一項工具取捨：`diagram-design` 雖支援 ER 圖型，但其複雜度預算上限為 **8 個實體**；跨模組整合圖遠超此上限，且它要求手算正交折線座標，故 `docs/diagrams/architecture/core-data-model-er.md` 改用 Mermaid `erDiagram`（原生 ER 語法、版面自動計算、逐行可 diff）。單一模組、8 個實體以內的 ER 圖仍優先用 `diagram-design`。

> 專案先前另有一套 D2 工具鏈（`.d2` 原始檔 + `.png`，用於 thesis 章節架構圖），因無人引用且無建置接線而移除，見 PR #474。若日後需要，可自 git 歷史取回。

## `diagram-design` 的安裝與樣式

這個 skill **裝在全域 `~/.claude/skills/diagram-design/`，不在 repo 內**。原因是它含約 3 MB 第三方資產，納入 repo 會牽動 PR 規模門檻（Constitution Principle X）與 vendored 授權管理。副作用是它與 repo 版控脫鉤，升級需手動重新 clone（詳見 issue #465）。

### 產圖前先確認安裝

**這套工具鏈缺失時不會有任何錯誤訊息。** skill 不在時它不會出現在 Claude Code 的可用清單，也不會報錯——直到你發現圖產不出來為止都不會察覺。issue #484 記錄過一次實例：issue #465 宣稱安裝完成並附了 `du -sh`、`diff -rq` 等驗收證據，但該路徑實際從未建立。

因此產圖或改圖前先跑這行，三個路徑都在才算完整：

```bash
ls ~/.claude/skills/diagram-design/SKILL.md \
   ~/.diagram-design/profiles/label-suite.md \
   ~/.diagram-design/profiles/default.md
```

任一缺失就重裝（含授權檔，issue #465 首次安裝時漏帶）：

```bash
git clone --depth 1 https://github.com/cathrynlavery/diagram-design.git
cp -R diagram-design/skills/diagram-design ~/.claude/skills/
cp diagram-design/LICENSE diagram-design/THIRD_PARTY_LICENSES.md ~/.claude/skills/diagram-design/
```

重裝後是上游原廠配色，載入 `label-suite` profile 才會還原 Label Suite skin。驗證產出可用 `python3 ~/.claude/skills/diagram-design/scripts/self_check.py <檔案>`。

Label Suite 的配色已存成 named client profile，位於 skill 安裝目錄之外，因此升級不會被覆蓋：

- profile 檔：`~/.diagram-design/profiles/label-suite.md`
- 原廠備份：`~/.diagram-design/profiles/default.md`

色票來源為 `design/prototype/assets/tokens.css`（paper `#F5F3FF`／ink `#1E1B4B`／accent `#6366F1`），字體為 Crimson Pro／Inter／JetBrains Mono，並加上 Noto Sans TC fallback 以正確顯示中文。若在新機器上重裝 skill，載入 `label-suite` profile 即可還原，不要手動改 install 目錄的 `style-guide.md`。

## 給非工程受眾的圖：語言規則

`diagram-design` 產出的圖若受眾是產品使用者，圖面文字一律用繁體中文敘述，不要留程式碼識別字。例如 `dry_run` 寫成「試標」、`min_reviewers` 寫成「需幾位審核員才開始計票」。

**例外：資料值與帳號 ID 保留原樣**（如 `positive`／`neutral`／`reviewer_chen`）。產品畫面本來就原樣顯示這些字串，翻譯後圖面會與使用者實際看到的畫面對不上。
