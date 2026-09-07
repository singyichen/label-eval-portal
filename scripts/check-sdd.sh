#!/usr/bin/env bash
set -u
readonly inventory_sentinel='design/system/screen-inventory.md is stale — run: node scripts/gen-screen-inventory.mjs'
strict=0; id_pattern='(FR|SC|AC)-[[:alnum:]]+([.-][[:alnum:]]+)*'; retired_command_pattern='(^|[^[:alnum:]_])npm[[:space:]]+(test|run)([^[:alnum:]_-]|$)|/ui-ux-pro-max|/speckit[.]analyze'
root_arg=''; root_provided=0; config_failed=0; governance_failed=0
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/label-suite-sdd.XXXXXX")" || exit 2
trap 'rm -rf "$tmp_dir"' EXIT
diagnostics="$tmp_dir/diagnostics.tsv"; status_rows="$tmp_dir/status.tsv"
active_specs="$tmp_dir/active-specs.txt"; eligible="$tmp_dir/eligible.tsv"
: >"$diagnostics"; : >"$active_specs"; : >"$eligible"
add_record() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" >>"$diagnostics"; }
add_error() { governance_failed=1; add_record ERROR "$1" "$2" "$3"; }
add_config_error() { config_failed=1; add_record ERROR "$1" "$2" "$3"; }
add_warning() { add_record WARNING "$1" "$2" "$3"; }
finish() {
    local sorted="$tmp_dir/diagnostics.sorted" errors warnings
    LC_ALL=C sort "$diagnostics" >"$sorted"
    awk -F '\t' '{ printf "%s [%s] %s: %s\n", $1, $2, $3, $4 }' "$sorted"
    errors="$(awk -F '\t' '$1 == "ERROR" { count++ } END { print count + 0 }' "$sorted")"; warnings="$(awk -F '\t' '$1 == "WARNING" { count++ } END { print count + 0 }' "$sorted")"
    printf 'Project SDD lint: %s error(s), %s warning(s)\n' "$errors" "$warnings"
    [ "$config_failed" -eq 0 ] || exit 2; [ "$governance_failed" -eq 0 ] || exit 1
    exit 0
}
preflight_scanned_paths() {
    local LC_ALL=C scanned_path relative_path scan_root
    export LC_ALL
    # Keep NUL boundaries and loop state so unsafe names never reach text collectors.
    while IFS= read -r -d '' scanned_path; do
        relative_path="${scanned_path#"$repo_root"/}"
        case "$relative_path" in
            *[[:cntrl:]]*) return 1 ;;
        esac
    done < <(
        find "$repo_root/specs" -mindepth 3 -maxdepth 3 -path '*/[0-9][0-9][0-9]-*/spec.md' -print0 2>/dev/null
        find "$repo_root/specs" -mindepth 4 -maxdepth 4 -path '*/[0-9][0-9][0-9]-*/diagrams/*' -print0 2>/dev/null
        for scan_root in "$repo_root"/openspec/changes/*; do
            [ -d "$scan_root" ] || continue
            [ "$scan_root" != "$repo_root/openspec/changes/archive" ] || continue
            find -H "$scan_root" -print0 2>/dev/null
        done
        for scan_root in .claude/agents .claude/commands .claude/skills/sdd-workflow; do
            [ ! -d "$repo_root/$scan_root" ] || find -H "$repo_root/$scan_root" -mindepth 1 -print0 2>/dev/null
        done
    )
    return 0
}
strip_markdown_fences() {
    awk '
    {
        indent = 0
        while (substr($0, indent + 1, 1) == " ") indent++
        if (indent > 3) {
            if (!in_fence) print
            next
        }
        candidate = substr($0, indent + 1)
        marker = substr(candidate, 1, 1)
        marker_length = 0
        if (marker == "`" || marker == "~") {
            while (substr(candidate, marker_length + 1, 1) == marker) marker_length++
        }
        if (marker_length >= 3) {
            remainder = substr(candidate, marker_length + 1)
            if (!in_fence) {
                in_fence = 1; fence_marker = marker; fence_length = marker_length
                next
            }
            if (marker == fence_marker && marker_length >= fence_length && remainder ~ /^[[:space:]]*$/) {
                in_fence = 0; fence_marker = ""; fence_length = 0
                next
            }
        }
        if (!in_fence) print
    }
    ' "$1"
}
for arg in "$@"; do
    case "$arg" in
        --strict)
            [ "$strict" -eq 0 ] || add_config_error CLI_USAGE . 'duplicate --strict flag'
            strict=1
            ;;
        -*) add_config_error CLI_USAGE . "unknown option: $arg" ;;
        *)
            [ "$root_provided" -eq 0 ] || add_config_error CLI_USAGE . 'only one repository root may be provided'
            [ "$root_provided" -ne 0 ] || { root_arg="$arg"; root_provided=1; }
            ;;
    esac
done
[ "$root_provided" -eq 0 ] || [ -n "$root_arg" ] || add_config_error SCANNER_CONFIG . 'repository root is invalid or unreadable'
if [ "$config_failed" -ne 0 ]; then finish; fi
checker_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd -P)"
if [ "$root_provided" -eq 0 ]; then repo_root="$checker_root"; else repo_root="$(cd "$root_arg" 2>/dev/null && pwd -P)"; fi
if [ -z "${repo_root:-}" ] || [ ! -d "$repo_root" ]; then add_config_error SCANNER_CONFIG . 'repository root is invalid or unreadable'; finish; fi
for required in specs/STATUS.md scripts/sdd-lint-baseline.txt scripts/ci-jobs.tsv .github/workflows/ci.yml CLAUDE.md openspec/changes .claude/agents; do [ -r "$repo_root/$required" ] || add_config_error SCANNER_CONFIG "$required" 'required scanner input is missing or unreadable'; done
if [ "$config_failed" -ne 0 ]; then finish; fi
if ! preflight_scanned_paths; then
    add_config_error SCANNER_CONFIG . 'repository paths containing control characters are unsupported'
    finish
fi
strip_markdown_fences "$repo_root/specs/STATUS.md" | awk -F '|' '
function trim(value) {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
    gsub(/`/, "", value)
    return value
}
{
    id = trim($2)
    if (id ~ /^[a-z-]+-[0-9][0-9][0-9]$/) {
        print id "\t" trim($4) "\t" trim($5) "\t" trim($6)
    }
}' >"$status_rows"
while IFS= read -r spec_file; do
    relative="${spec_file#"$repo_root"/}"
    spec_dir="$(basename "$(dirname "$spec_file")")"
    number="${spec_dir%%-*}"
    case "$relative" in
        specs/_archive/*) count="$(awk -F '\t' -v number="$number" '$1 ~ ("-" number "$") && $3 == "archived" { count++ } END { print count + 0 }' "$status_rows")"; identity="archived STATUS row for feature $number" ;;
        *) module="$(basename "$(dirname "$(dirname "$spec_file")")")"; id="$module-$number"; count="$(awk -F '\t' -v id="$id" '$1 == id && $3 != "archived" { count++ } END { print count + 0 }' "$status_rows")"; identity="non-archived STATUS row for $id" ;;
    esac
    [ "$count" -eq 1 ] || add_error STATUS_ARTIFACT_SYNC "$relative" "expected exactly one $identity"
done < <(find "$repo_root/specs" -mindepth 3 -maxdepth 3 -path '*/[0-9][0-9][0-9]-*/spec.md' -print | LC_ALL=C sort)
while IFS="$(printf '\t')" read -r id module status branch; do
    [ -n "$id" ] || continue
    number="${id##*-}"; id_module="${id%-*}"
    [ "$id_module" = "$module" ] || add_error STATUS_ARTIFACT_SYNC specs/STATUS.md "STATUS row $id contradicts module $module"
    canonical_root="$repo_root/specs/$module"; [ "$status" != archived ] || canonical_root="$repo_root/specs/_archive"
    count="$(find "$canonical_root" -mindepth 2 -maxdepth 2 -path "*/$number-*/spec.md" -print 2>/dev/null | wc -l | tr -d ' ')"
    [ "$count" -eq 1 ] || add_error STATUS_ARTIFACT_SYNC specs/STATUS.md "STATUS row $id does not resolve to exactly one canonical spec"
    case "$status" in
        spec-ready|change-open|in-progress|review|done|archived|deferred) ;;
        *) add_error STATUS_ARTIFACT_SYNC specs/STATUS.md "STATUS row $id uses an unsupported state" ;;
    esac
    [ "$status" != review ] || add_warning STATUS_EXTERNAL_STATE specs/STATUS.md "external PR state for $id requires maintainer review"
done <"$status_rows"
section_is_valid() {
    strip_markdown_fences "$1" | awk -v heading="$2" -v mode="$3" '
    (mode == "dependency" ? ($0 == heading || $0 == heading " *(本功能依賴其他規格，或被其他規格依賴時填寫)*") : $0 == heading) { found++; inside = 1; next }
    inside && /^##[[:space:]]/ { inside = 0 }
    inside && $0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]*<!--/ { content = 1 }
    END { exit !(found == 1 && content == 1) }
    '
}
requires_page_traceability() { [ "$1" != foundation ] && strip_markdown_fences "$2" | grep -Eq 'Prototype|design/prototype|產品 UI|頁面'; }
collect_added_ids() {
    local change_dir="$1" target="$2" delta
    : >"$target"
    while IFS= read -r delta; do
        strip_markdown_fences "$delta" | awk '
            /^##[[:space:]]/ { inside = ($0 == "## ADDED Requirements"); next }
            inside && /^#/ { print }
        ' | grep -Eo "$id_pattern" >>"$target" || true
    done < <(find "$change_dir/specs" -type f -name spec.md -print 2>/dev/null | LC_ALL=C sort)
    LC_ALL=C sort -u "$target" -o "$target"
}
spec_defines_id() { [ -r "$1" ] && grep -Eo "$id_pattern" "$1" | grep -Fqx "$2"; }
citation_names_defining_spec() {
    local artifact="$1" citation="$2" line reference module number candidate
    while IFS= read -r line; do
        while IFS= read -r reference; do
            [ -n "$reference" ] || continue
            reference="${reference#specs/}"; module="${reference%%/*}"; number="${reference#*/}"; number="${number:0:3}"
            while IFS= read -r candidate; do
                spec_defines_id "$candidate" "$citation" && return 0
            done < <(find "$repo_root/specs/$module" "$repo_root/specs/_archive" -mindepth 2 -maxdepth 2 -path "*/$number-*/spec.md" -print 2>/dev/null)
        done < <(printf '%s\n' "$line" | grep -Eo '(specs/)?[[:alnum:]_-]+/[0-9][0-9][0-9][[:alnum:]._-]*' || true)
    done < <(grep -F "$citation" "$artifact" 2>/dev/null || true)
    return 1
}
verify_citations() {
    local artifact="$1" allowed="$2" citation
    [ -r "$artifact" ] || return
    grep -Eo "$id_pattern" "$artifact" | LC_ALL=C sort -u >"$tmp_dir/citations" || true
    while IFS= read -r citation; do
        [ -n "$citation" ] || continue
        grep -Fqx "$citation" "$allowed" && continue
        citation_names_defining_spec "$artifact" "$citation" && continue
        add_error SOURCE_VERIFY_ID "${artifact#"$repo_root"/}" "canonical spec does not define $citation; declare it under ## ADDED Requirements or name the source spec on the citing line"
    done <"$tmp_dir/citations"
}
verify_required_ids() {
    local canonical="$1" relative="$2" missing_ids=''
    grep -Eq 'FR-[0-9][0-9][0-9]' "$canonical" || missing_ids="$missing_ids FR"
    grep -Eq 'SC-[0-9][0-9][0-9]' "$canonical" || missing_ids="$missing_ids SC"
    grep -Eq 'AC-[0-9]+[.][0-9]+' "$canonical" || missing_ids="$missing_ids AC"
    [ -z "$missing_ids" ] || add_error SPEC_REQUIRED_IDS "$relative" "canonical spec is missing required identifiers:$missing_ids"
}
for change_dir in "$repo_root"/openspec/changes/*; do
    [ -d "$change_dir" ] || continue
    [ "$(basename "$change_dir")" != archive ] || continue
    proposal="$change_dir/proposal.md"
    relative_proposal="${proposal#"$repo_root"/}"
    if [ ! -r "$proposal" ]; then add_error ACTIVE_CHANGE_SPEC "${change_dir#"$repo_root"/}" 'active change is missing a readable proposal.md'; continue; fi
    refs="$tmp_dir/refs.$(basename "$change_dir")"; grep -E '^對應 Spec:[[:space:]]*specs/[[:alnum:]-]+/[0-9][0-9][0-9]-[[:alnum:]_.-]+/spec\.md[[:space:]]*$' "$proposal" | sed 's/^對應 Spec:[[:space:]]*//; s/[[:space:]]*$//' >"$refs" || true
    declaration_count="$(grep -Ec '^對應 Spec:' "$proposal" || true)"; ref_count="$(wc -l <"$refs" | tr -d ' ')"
    if [ "$declaration_count" -ne 1 ] || [ "$ref_count" -ne 1 ]; then add_error ACTIVE_CHANGE_SPEC "$relative_proposal" 'proposal must reference exactly one canonical spec'; continue; fi
    canonical_relative="$(sed -n '1p' "$refs")"
    canonical="$repo_root/$canonical_relative"
    if [ ! -r "$canonical" ]; then add_error ACTIVE_CHANGE_SPEC "$relative_proposal" "canonical spec is missing: $canonical_relative"; continue; fi
    printf '%s\n' "$canonical_relative" >>"$active_specs"
    module="$(printf '%s\n' "$canonical_relative" | cut -d/ -f2)"
    feature="$(printf '%s\n' "$canonical_relative" | cut -d/ -f3)"
    id="$module-${feature%%-*}"
    status_count="$(awk -F '\t' -v id="$id" '$1 == id { count++ } END { print count + 0 }' "$status_rows")"
    status="$(awk -F '\t' -v id="$id" '$1 == id { print $3; exit }' "$status_rows")"
    status_branch="$(awk -F '\t' -v id="$id" '$1 == id { print $4; exit }' "$status_rows")"
    if [ "$status_count" -ne 1 ]; then
        add_error ACTIVE_CHANGE_SPEC "$relative_proposal" "canonical spec $id has no unique STATUS row"
    else
        case "$status" in
            spec-ready|done|archived|deferred)
                add_error ACTIVE_CHANGE_STAGE specs/STATUS.md "active change $id is incompatible with STATUS $status"
                ;;
        esac
        spec_branch="$(sed -n 's/^功能分支:[[:space:]]*//p' "$canonical" | sed 's/`//g' | sed -n '1p')"
        if [ -n "$spec_branch" ] && [ "$spec_branch" != "$status_branch" ]; then add_error ACTIVE_CHANGE_STAGE specs/STATUS.md "branch for $id contradicts canonical frontmatter"; fi
    fi
    section_is_valid "$canonical" '## 功能目標' exact || add_error SPEC_REQUIRED_HEADING "$canonical_relative" 'required heading is missing, duplicated, or empty: ## 功能目標'
    section_is_valid "$canonical" '## 規格相依性' dependency || add_error SPEC_REQUIRED_HEADING "$canonical_relative" 'required heading is missing, duplicated, or empty: ## 規格相依性'
    verify_required_ids "$canonical" "$canonical_relative"
    if requires_page_traceability "$module" "$canonical" && ! strip_markdown_fences "$canonical" | grep -Eq '^## Prototype Traceability|Frontend Ready Gate.*不適用|prototype.*不適用'; then add_error SPEC_REQUIRED_IDS "$canonical_relative" 'page traceability or an explicit non-page exception is required'; fi
    allowed_ids="$tmp_dir/allowed-ids"
    collect_added_ids "$change_dir" "$tmp_dir/added-ids"
    grep -Eo "$id_pattern" "$canonical" | LC_ALL=C sort -u >"$tmp_dir/canonical-citations" || true
    LC_ALL=C sort -u "$tmp_dir/canonical-citations" "$tmp_dir/added-ids" >"$allowed_ids"
    for artifact in "$proposal" "$change_dir/design.md" "$change_dir/tasks.md"; do
        verify_citations "$artifact" "$allowed_ids"
    done
    while IFS= read -r artifact; do
        verify_citations "$artifact" "$allowed_ids"
    done < <(find "$change_dir/specs" -type f -name spec.md -print 2>/dev/null | LC_ALL=C sort)
    tasks="$change_dir/tasks.md"
    if [ -r "$tasks" ]; then
        task_relative="${tasks#"$repo_root"/}"
        missing_goal="$(awk '
            function close_phase() { if (phase && !goal) print start }
            /^## [0-9]+[.]/ { close_phase(); phase = 1; goal = 0; start = NR; next }
            phase && /^\*\*故事目標\*\*/ { goal = 1 }
            END { close_phase() }
        ' "$tasks")"
        [ -z "$missing_goal" ] || add_error TASK_STORY_GOAL "$task_relative" 'each numbered phase requires a story goal'
        grep '^\*\*故事目標\*\*' "$tasks" >"$tmp_dir/goals" || true
        while IFS= read -r goal; do
            goal_ids="$(printf '%s\n' "$goal" | grep -Eo "$id_pattern" | grep '^SC-' || true)"
            if [ -z "$goal_ids" ]; then
                add_error TASK_STORY_GOAL "$task_relative" 'story goal must cite a canonical SC ID'
            else
                while IFS= read -r goal_id; do
                    grep -Fqx "$goal_id" "$allowed_ids" || add_error TASK_STORY_GOAL "$task_relative" "story goal cites unknown $goal_id"
                done <<EOF
$goal_ids
EOF
            fi
        done <"$tmp_dir/goals"
        grep -E '^- \[[ xX]\]' "$tasks" >"$tmp_dir/task-lines" || true
        pending_red_groups="$tmp_dir/pending-red-groups"
        : >"$pending_red_groups"
        while IFS= read -r task_line; do
            action_clause="$(printf '%s\n' "$task_line" | awk '{ sub(/^- \[[ xX]\] [0-9.]+[[:space:]]*/, ""); gsub(/[.][[:space:]]/, ";"); gsub(/，/, ";"); gsub(/。/, ";"); gsub(/；/, ";"); count = split($0, clauses, /[,;]/); for (i = 1; i <= count; i++) { clause = clauses[i]; lower = tolower(clause); if (clause ~ /(不得|禁止|不可|不應|無需)/ || lower ~ /(^|[^[:alnum:]_])((do|does|did|must|should|shall|will|would|can|could|may|might|is|are|was|were|has|have|had)[[:space:]]+not|(don.t|doesn.t|didn.t|mustn.t|shouldn.t|shan.t|won.t|wouldn.t|can.t|couldn.t|mayn.t|mightn.t|isn.t|aren.t|wasn.t|weren.t|hasn.t|haven.t|hadn.t|cannot))[[:space:]]+(modif|creat|delet|remov|writ|updat|add|edit|touch|chang|generat|implement|replac|renam)[[:alpha:]]*([^[:alnum:]_]|$)/) continue; if (clause ~ /(執行[[:space:]]*`|驗證[：:[:space:]]*`|預期)/ || lower ~ /(exception:|verification[：:[:space:]]*`|verify[[:space:]]*`|run[[:space:]]*`|expect)/) continue; if (i == 1 || clause ~ /(修改|建立|新增|刪除|移除|撰寫|補上|更新|加入[[:space:]]*`)/ || lower ~ /(modif(y|ied)|creat(e|ed)|delet(e|ed)|remov(e|ed)|writ(e|ten)|updat(e|ed)|add[[:space:]]*`)/) print clause } }')"
            explicit_files="$(printf '%s\n' "$action_clause" | grep -Eo '`[^`[:space:]]*(/|[.])[^`[:space:]]*`' | wc -l | tr -d ' ')"; printf '%s\n' "$action_clause" | grep -Eo '`[^`[:space:]]*(/|[.])[^`[:space:]]*`' | sed 's/^`//; s/`$//' | LC_ALL=C sort -u >"$tmp_dir/task-files"
            task_group="$(printf '%s\n' "$task_line" | sed -n 's/^- \[[ xX]\] \([0-9][0-9]*\)[.].*/\1/p')"
            assignee_count="$(printf '%s\n' "$task_line" | grep -o '\[@[^]]*\]' | wc -l | tr -d ' ')"
            terminal="$(printf '%s\n' "$task_line" | sed -n 's/.*\(\[@[^]]*\]\)[[:space:]]*$/\1/p')"
            assignee="$(printf '%s\n' "$terminal" | sed 's/^\[@//; s/\]$//')"
            if [ "$assignee_count" -ne 1 ] || [ -z "$terminal" ]; then
                add_error TASK_ASSIGNEE "$task_relative" 'task must end with exactly one assignee'
                continue
            fi
            if [ "$assignee" != main ] && [ ! -r "$repo_root/.claude/agents/$assignee.md" ]; then add_error TASK_ASSIGNEE "$task_relative" "task references unknown assignee: $assignee"; fi
            exception=''
            if printf '%s\n' "$task_line" | grep -Fq 'Exception:'; then
                exception="$(printf '%s\n' "$task_line" | sed -n 's/.*Exception:[[:space:]]*\([^;[:space:]]*\).*/\1/p')"; files_value="$(printf '%s\n' "$task_line" | sed -n 's/.*;[[:space:]]*Files:[[:space:]]*\([^;]*\);[[:space:]]*Reason:.*/\1/p')"
                case "$exception" in package-manager|scaffold|governance-propagation) ;; *) exception=invalid ;; esac
                exception_fields="$(printf '%s\n' "$task_line" | grep -Eo 'Exception:|Files:|Reason:' | wc -l | tr -d ' ')"; printf '%s\n' "$files_value" | grep -Eo '`[^`[:space:]]+`' | sed 's/^`//; s/`$//' | LC_ALL=C sort -u >"$tmp_dir/exception-files"; exception_file_count="$(printf '%s\n' "$files_value" | grep -Eo '`[^`[:space:]]+`' | wc -l | tr -d ' ')"
                if [ "$exception" = invalid ] || [ "$exception_fields" -ne 3 ] || printf '%s\n' "$task_line" | grep -Eq 'Reason:[[:space:]]*(;|\[@)' || ! printf '%s\n' "$files_value" | grep -Eq '^`[^`[:space:]]+`([[:space:]]*,[[:space:]]*`[^`[:space:]]+`)*$' || grep -Eq '(^/|(^|/)[.][.](/|$)|[*?[])' "$tmp_dir/exception-files" || [ "$exception_file_count" -ne "$(wc -l <"$tmp_dir/exception-files" | tr -d ' ')" ] || [ -n "$(comm -23 "$tmp_dir/task-files" "$tmp_dir/exception-files")" ]; then add_error TASK_EXCEPTION "$task_relative" 'exception record is incomplete or uses a disallowed identifier'; fi
            fi
            if [ -z "$exception" ] && ! printf '%s\n' "$task_line" | grep -Eq '^- \[[ xX]\] [0-9.]+ 執行'; then
                if [ "$explicit_files" -gt 1 ]; then add_error TASK_EXCEPTION "$task_relative" 'task names multiple artifacts without an allowed exception'; elif [ "$explicit_files" -eq 0 ]; then add_warning TASK_FILE_COUNT_REVIEW "$task_relative" 'task file count requires human review'; fi
            fi
            if [ "$exception" != governance-propagation ] && grep -Eq '^(scripts/.*-tests[.]sh|backend/tests/.*[.]py|frontend/.*((__tests__|tests?)/.*|[.](test|spec))[.](js|jsx|ts|tsx)|e2e/.*|design/prototype/tests/.*)$' "$tmp_dir/task-files" && printf '%s\n' "$task_line" | grep -Eq '(^|[^[:alnum:]_])[Rr]ed([^[:alnum:]_]|$)'; then
                [ "$assignee" = senior-qa ] || add_error TASK_RED_OWNER "$task_relative" 'Red task must be owned by senior-qa'
                add_warning TASK_RED_EVIDENCE_REVIEW "$task_relative" 'committed Red failure evidence requires runtime review'
                printf '%s\n' "$task_group" >>"$pending_red_groups"
            elif printf '%s\n' "$task_line" | grep -Eq '(^|[^[:alnum:]_])Green([^[:alnum:]_]|$)'; then
                if grep -Fqx "$task_group" "$pending_red_groups"; then
                    awk -v group="$task_group" '
                        !consumed && $0 == group { consumed = 1; next }
                        { print }
                    ' "$pending_red_groups" >"$pending_red_groups.next"
                    mv "$pending_red_groups.next" "$pending_red_groups"
                else
                    add_error TASK_RED_OWNER "$task_relative" 'paired Green task must follow its Red task'
                fi
            fi
            if [ "$exception" != governance-propagation ] && ! printf '%s\n' "$task_line" | grep -Eq '^- \[[ xX]\] [0-9.]+ 執行'; then
                if grep -Eq '^scripts/.*-tests[.]sh$' "$tmp_dir/task-files" && [ "$assignee" != senior-qa ]; then add_error TASK_FILE_OWNER "$task_relative" 'scripts/*-tests.sh is owned by senior-qa'; fi
                if awk '/^scripts\// && $0 !~ /-tests[.]sh$/ { found = 1 } END { exit !found }' "$tmp_dir/task-files" && [ "$assignee" != senior-devops ]; then add_error TASK_FILE_OWNER "$task_relative" 'production scripts are owned by senior-devops'; fi
            fi
        done <"$tmp_dir/task-lines"
        while IFS= read -r pending_red_group; do
            [ -z "$pending_red_group" ] || add_error TASK_RED_OWNER "$task_relative" 'paired Green task must follow its Red task'
        done < <(LC_ALL=C sort -u "$pending_red_groups")
    fi
    add_warning GOAL_SEMANTIC_REVIEW "$relative_proposal" 'goal semantics require human review'
    if grep -Eq 'ADR-034|frontend/tests/|root `e2e/' "$change_dir/design.md" 2>/dev/null; then add_warning E2E_PATH_DECISION "${change_dir#"$repo_root"/}/design.md" 'ADR-034 E2E path decision remains deferred'; fi
done
LC_ALL=C sort -u "$active_specs" -o "$active_specs"
while IFS= read -r spec_file; do
    relative="${spec_file#"$repo_root"/}"
    grep -Fqx "$relative" "$active_specs" && continue
    unfenced_spec="$tmp_dir/spec-unfenced"
    strip_markdown_fences "$spec_file" >"$unfenced_spec"
    spec_dir="$(basename "$(dirname "$spec_file")")"; number="${spec_dir%%-*}"
    case "$relative" in
        specs/_archive/*) module="$(awk -F '\t' -v number="$number" '$1 ~ ("-" number "$") && $3 == "archived" { print $2; exit }' "$status_rows")"; status=archived ;;
        *) module="$(basename "$(dirname "$(dirname "$spec_file")")")"; id="$module-$number"; status="$(awk -F '\t' -v id="$id" '$1 == id { print $3; exit }' "$status_rows")" ;;
    esac
    if [ "$status" = spec-ready ]; then
        goal_valid=1; section_is_valid "$spec_file" '## 功能目標' exact || goal_valid=0
        dependency_valid=1; section_is_valid "$spec_file" '## 規格相依性' dependency || dependency_valid=0
        [ "$goal_valid" -eq 1 ] || grep -Fqx "$(printf 'LEGACY_SPEC_HEADING\t%s\tmissing:## 功能目標' "$relative")" "$repo_root/scripts/sdd-lint-baseline.txt" || add_error SPEC_REQUIRED_HEADING "$relative" 'required heading is missing, duplicated, or empty: ## 功能目標'
        [ "$dependency_valid" -eq 1 ] || grep -Fqx "$(printf 'LEGACY_SPEC_HEADING\t%s\tmissing:## 規格相依性' "$relative")" "$repo_root/scripts/sdd-lint-baseline.txt" || add_error SPEC_REQUIRED_HEADING "$relative" 'required heading is missing, duplicated, or empty: ## 規格相依性'
        if [ "$goal_valid" -eq 1 ] && [ "$dependency_valid" -eq 1 ]; then verify_required_ids "$spec_file" "$relative"; fi
    fi
    grep -Fqx '## 功能目標' "$unfenced_spec" || printf 'LEGACY_SPEC_HEADING\t%s\tmissing:## 功能目標\n' "$relative" >>"$eligible"
    grep -Eq '^## 規格相依性( \*\(本功能依賴其他規格，或被其他規格依賴時填寫\)\*)?$' "$unfenced_spec" || printf 'LEGACY_SPEC_HEADING\t%s\tmissing:## 規格相依性\n' "$relative" >>"$eligible"
    if requires_page_traceability "$module" "$spec_file" && ! grep -Fqx '## Prototype Traceability' "$unfenced_spec"; then printf 'LEGACY_SPEC_HEADING\t%s\tmissing:## Prototype Traceability\n' "$relative" >>"$eligible"; fi
done < <(find "$repo_root/specs" -mindepth 3 -maxdepth 3 -path '*/[0-9][0-9][0-9]-*/spec.md' -print | LC_ALL=C sort)
LC_ALL=C sort -u "$eligible" -o "$eligible"
baseline="$repo_root/scripts/sdd-lint-baseline.txt"
baseline_sorted="$tmp_dir/baseline.sorted"
baseline_valid=1
LC_ALL=C sort "$baseline" >"$baseline_sorted"
cmp -s "$baseline" "$baseline_sorted" || baseline_valid=0
if [ -n "$(LC_ALL=C sort "$baseline" | uniq -d)" ]; then baseline_valid=0; fi
awk -F '\t' 'NF != 3 || $1 == "" || $2 == "" || $3 == "" { invalid = 1 } END { exit invalid }' "$baseline" || baseline_valid=0
while IFS="$(printf '\t')" read -r rule path detail extra; do
    [ -n "$rule$path$detail$extra" ] || continue
    case "$rule" in LEGACY_SPEC_HEADING|LEGACY_STATUS_DRIFT) ;; *) baseline_valid=0 ;; esac
    if [ -z "$path" ] || [ -z "$detail" ] || [ -n "${extra:-}" ] || printf '%s' "$path" | grep -Eq '(^/|(^|/)\.\.(/|$)|[*?[])' || [ ! -e "$repo_root/$path" ]; then baseline_valid=0; fi
done <"$baseline"
if [ "$baseline_valid" -ne 1 ]; then
    add_config_error BASELINE_FORMAT scripts/sdd-lint-baseline.txt 'baseline must be sorted, unique, valid three-column TSV'
else
    comm -23 "$eligible" "$baseline" >"$tmp_dir/new"
    comm -13 "$eligible" "$baseline" >"$tmp_dir/stale"
    comm -12 "$eligible" "$baseline" >"$tmp_dir/known"
    while IFS="$(printf '\t')" read -r rule path detail; do
        [ -n "$rule" ] || continue
        add_error "$rule" "$path" "new legacy debt: $detail"
    done <"$tmp_dir/new"
    while IFS="$(printf '\t')" read -r rule path detail; do
        [ -n "$rule" ] || continue
        add_error BASELINE_STALE scripts/sdd-lint-baseline.txt "stale entry: $rule $path $detail"
    done <"$tmp_dir/stale"
    while IFS="$(printf '\t')" read -r rule path detail; do
        [ -n "$rule" ] || continue
        if [ "$strict" -eq 1 ]; then add_error "$rule" "$path" "known legacy debt: $detail"
        else add_warning "$rule" "$path" "known legacy debt: $detail"
        fi
    done <"$tmp_dir/known"
fi
consumer_files="$tmp_dir/consumers"
: >"$consumer_files"
for relative in AGENTS.md CLAUDE.md docs/sdd-workflow.md openspec/config.yaml; do
    [ -f "$repo_root/$relative" ] && printf '%s\n' "$repo_root/$relative" >>"$consumer_files"
done
for dir in .claude/skills/sdd-workflow .claude/commands .claude/agents; do
    [ -d "$repo_root/$dir" ] || continue
    find -H "$repo_root/$dir" -type f -not -path '*/archive/*' -print >>"$consumer_files"
done
for change_dir in "$repo_root"/openspec/changes/*; do
    [ -d "$change_dir" ] || continue
    [ "$change_dir" != "$repo_root/openspec/changes/archive" ] || continue
    find -H "$change_dir" -type f -not -path '*/archive/*' -print >>"$consumer_files"
done
LC_ALL=C sort -u "$consumer_files" -o "$consumer_files"
while IFS= read -r consumer; do
    case "$consumer" in */.claude/commands/speckit.analyze.md) continue ;; esac
    relative="${consumer#"$repo_root"/}"
    grep -En "$retired_command_pattern" "$consumer" 2>/dev/null >"$tmp_dir/retired" || true
    while IFS= read -r match; do
        text="${match#*:}"
        retired_clauses="${text//;/$'\n'}"
        retired_clauses="${retired_clauses//；/$'\n'}"
        retired_clauses="${retired_clauses//，/$'\n'}"
        retired_clauses="${retired_clauses//。/$'\n'}"
        retired_clauses="${retired_clauses//. /$'\n'}"
        retired_clauses="${retired_clauses//!/$'\n'}"
        retired_clauses="${retired_clauses//\?/$'\n'}"
        retired_clauses="${retired_clauses//,/$'\n'}"
        retired_clauses="${retired_clauses//&&/$'\n'}"
        retired_clauses="${retired_clauses//||/$'\n'}"
        retired_clauses="$(printf '%s\n' "$retired_clauses" | awk '{ gsub(/npm[[:space:]]+test[.]/, "npm test\n"); gsub(/npm[[:space:]]+run[.]/, "npm run\n"); gsub(/\/speckit[.]analyze[.]/, "/speckit.analyze\n"); gsub(/\/ui-ux-pro-max[.]/, "/ui-ux-pro-max\n"); print }')"
        retired_command_active=0
        while IFS= read -r clause; do
            printf '%s\n' "$clause" | grep -Eq "$retired_command_pattern" || continue
            if printf '%s\n' "$clause" | grep -Eq '不得|禁止|不可|不應|無需|請勿' || printf '%s\n' "$clause" | grep -Eqi '(^|[^[:alnum:]_])((do|does|did|must|should|shall|will|would|can|could|may|might|is|are|was|were|has|have|had)[[:space:]]+not|(don.t|doesn.t|didn.t|mustn.t|shouldn.t|shan.t|won.t|wouldn.t|can.t|couldn.t|mayn.t|mightn.t|isn.t|aren.t|wasn.t|weren.t|hasn.t|haven.t|hadn.t|cannot|never|avoid))[[:space:]]+(run|use|execut|invok|call)[[:alpha:]]*([^[:alnum:]_]|$)'; then
                continue
            fi
            retired_command_active=1
        done < <(printf '%s\n' "$retired_clauses")
        [ "$retired_command_active" -eq 0 ] || add_error RETIRED_COMMAND "$relative" 'active guidance contains a retired repository command or pipeline stage'
    done <"$tmp_dir/retired"
done <"$consumer_files"
generator="$repo_root/scripts/gen-screen-inventory.mjs"
if [ "$repo_root" != "$checker_root" ]; then
    add_config_error INVENTORY_CHECK_CONFIG scripts/gen-screen-inventory.mjs 'inventory checker must run from the checker trust root'
elif [ ! -f "$generator" ] || [ ! -r "$generator" ] || ! command -v node >/dev/null 2>&1; then
    add_config_error INVENTORY_CHECK_CONFIG scripts/gen-screen-inventory.mjs 'inventory checker is missing, unreadable, or unavailable'
else
    inventory_output=''
    if inventory_output="$(node "$generator" --check 2>&1)"; then inventory_status=0; else inventory_status=$?; fi
    if [ "$inventory_status" -eq 0 ]; then
        :
    elif [ "$inventory_status" -eq 1 ] && [ "$inventory_output" = "$inventory_sentinel" ]; then
        add_error INVENTORY_FRESHNESS design/system/screen-inventory.md 'generated screen inventory is stale; run the inventory generator'
    else
        add_config_error INVENTORY_CHECK_CONFIG scripts/gen-screen-inventory.mjs 'inventory checker returned an unexpected result'
    fi
fi
# issue #674: an architecture/sequence/state-machine diagram that lives in a
# spec's own diagrams/ folder is only "must-read" if that spec actually links
# to it -- otherwise it is a file nobody's reading sequence ever surfaces,
# same failure mode as screen-inventory.md before INVENTORY_FRESHNESS existed.
# Checked by existence rather than a maintained path list (issue #666's own
# tracking issue drifted out of date against the diagrams it named), so a
# newly added diagram is covered without a second registry to keep in sync.
# Scope is deliberately narrow: only *.html under specs/*/*/diagrams/, linked
# from that same feature's spec.md by relative path containing
# "diagrams/<basename>". Cross-module diagrams under docs/diagrams/ are
# out of scope -- those are surfaced via agent-context-contract.md's Required
# reading sequence instead, which this rule does not police.
while IFS= read -r -d '' diagram_file; do
    relative_diagram="${diagram_file#"$repo_root"/}"
    owner_spec="$(dirname "$(dirname "$diagram_file")")/spec.md"
    base="$(basename "$diagram_file")"
    if [ ! -r "$owner_spec" ]; then
        add_error DIAGRAM_LINK "$relative_diagram" 'diagram has no sibling spec.md to own it'
        continue
    fi
    grep -Fq "diagrams/$base" "$owner_spec" || add_error DIAGRAM_LINK "${owner_spec#"$repo_root"/}" "must link its own diagrams/$base by relative path"
done < <(find "$repo_root/specs" -mindepth 4 -maxdepth 4 -path '*/[0-9][0-9][0-9]-*/diagrams/*.html' -print0 2>/dev/null)
# Local verification suites and CI jobs are a two-way contract (CLAUDE.md
# §Verification Commands). scripts/ci-jobs.tsv is the single declaration both
# directions are checked against: one row per script under scripts/, plus one
# row per CI job that no script implements. A row whose job column reads
# "none" is an explicit exemption and must carry a reason in the command
# column, so a one-off helper is declared rather than silently skipped —
# an undeclared script is exactly how issue #613 went unnoticed for months.
ci_workflow='.github/workflows/ci.yml'
ci_registry='scripts/ci-jobs.tsv'
ci_rows="$tmp_dir/ci-rows"; ci_jobs="$tmp_dir/ci-jobs"; ci_declared="$tmp_dir/ci-declared"; ci_covered="$tmp_dir/ci-covered"
grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$repo_root/$ci_registry" >"$ci_rows" || :
# Job keys sit at exactly two spaces under the top-level "jobs:" mapping; every
# key nested deeper (steps:, strategy:, ...) or carrying a value is not a job.
awk '/^jobs:[[:space:]]*$/ { inside = 1; next } inside && /^[^[:space:]#]/ { inside = 0 } inside && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { sub(/:[[:space:]]*$/, ""); gsub(/^[[:space:]]+/, ""); print }' "$repo_root/$ci_workflow" | LC_ALL=C sort -u >"$ci_jobs"
: >"$ci_declared"; : >"$ci_covered"
if ! awk -F '\t' 'NF != 3 || $1 == "" || $2 == "" || $3 == "" { invalid = 1 } END { exit invalid }' "$ci_rows"; then
    add_error CI_JOB_PARITY "$ci_registry" 'every row must be three non-empty tab-separated columns: CI job (or none), local command (or exemption reason), script (or -)'
else
    ci_section="$tmp_dir/ci-claude-commands"
    awk '/^## Verification Commands[[:space:]]*$/ { inside = 1; next } inside && /^## / { inside = 0 } inside { print }' "$repo_root/CLAUDE.md" >"$ci_section"
    while IFS="$(printf '\t')" read -r job command script; do
        if [ "$job" != none ]; then
            grep -Fxq "$job" "$ci_jobs" || add_error CI_JOB_PARITY "$ci_registry" "declared job $job does not exist in $ci_workflow"
            grep -Fq "$command" "$ci_section" || add_error CI_JOB_PARITY "$ci_registry" "local command for job $job is absent from the CLAUDE.md Verification Commands block"
            printf '%s\n' "$job" >>"$ci_declared"
        fi
        [ "$script" = - ] && continue
        ! grep -Fxq "$script" "$ci_covered" || add_error CI_JOB_PARITY "$ci_registry" "script $script is declared more than once"
        printf '%s\n' "$script" >>"$ci_covered"
    done <"$ci_rows"
    while IFS= read -r job; do
        [ -n "$job" ] || continue
        grep -Fxq "$job" "$ci_declared" || add_error CI_JOB_PARITY "$ci_workflow" "CI job $job has no local command declared in $ci_registry"
    done <"$ci_jobs"
    while IFS= read -r suite; do
        [ -n "$suite" ] || continue
        grep -Fxq "$suite" "$ci_covered" || add_error CI_JOB_PARITY "scripts/$suite" "script is not declared in $ci_registry; add its CI job, or an exemption row stating why it is not a gate"
    done < <(ls -1 "$repo_root/scripts" 2>/dev/null | grep -E '[.](sh|mjs)$' | LC_ALL=C sort)
fi
finish
