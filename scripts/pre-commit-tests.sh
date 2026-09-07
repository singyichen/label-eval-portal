#!/usr/bin/env bash
# pre-commit-tests.sh — Run local regression tests for scripts/git-hooks/pre-commit.
#
# Usage:
#   ./scripts/pre-commit-tests.sh
#   bash scripts/pre-commit-tests.sh
#
# IMPORTANT — when to use this script:
#   Use after changing scripts/git-hooks/pre-commit or the file/line exclusion
#   rules it implements (Constitution Principle X, .claude/rules/git-workflow.md
#   "Size guardrails"). It exercises the batch-commit guard's file-count and
#   line-count thresholds — and the exclusion list both thresholds must apply —
#   directly, without depending on CI.
#
# How it works:
#   Each test builds a throwaway git repo under TMPDIR, stages a synthetic
#   change set that models one guard scenario (ordinary change, oversized
#   batch, merge in progress, excluded file types, etc.), runs the real
#   scripts/git-hooks/pre-commit script against it, and asserts the exit code
#   (0 = allowed, 1 = blocked). All twelve cases run even if earlier ones
#   fail; a per-case pass/fail summary is printed at the end.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/scripts/git-hooks/pre-commit"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/label-suite-precommit.XXXXXX")"
TMP_ROOT="$(cd "$TMP_ROOT" && pwd)"

cleanup() {
    rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

RESULTS=()

# The literal generated-file marker copied from design/system/screen-inventory.md:5
# ("> **本檔為 generated view——請勿手動編輯。** ..."). See report footer if this
# ever drifts from the real file.
GENERATED_MARKER='**本檔為 generated view——請勿手動編輯。**'

make_repo() {
    local repo
    repo="$(mktemp -d "$TMP_ROOT/repo.XXXXXX")"
    git -C "$repo" init -q
    git -C "$repo" -c user.email="precommit-test@example.com" -c user.name="Precommit Test" commit -q --allow-empty -m "seed"
    echo "$repo"
}

# Writes $3 throwaway lines to $repo/$path, creating parent directories as needed.
gen_lines() {
    local repo="$1" path="$2" n="$3"
    mkdir -p "$(dirname "$repo/$path")"
    seq 1 "$n" > "$repo/$path"
}

# Runs the real hook against $repo's staged index with optional leading env
# assignments (e.g. ALLOW_BATCH_COMMIT=1) and echoes its exit code.
hook_exit_code() {
    local repo="$1"
    shift
    local rc=0
    (cd "$repo" && env "$@" bash "$HOOK") >/dev/null 2>&1 && rc=0 || rc=$?
    echo "$rc"
}

record() {
    local name="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then
        RESULTS+=("PASS: $name (expected exit $expected, got $actual)")
    else
        RESULTS+=("FAIL: $name (expected exit $expected, got $actual)")
    fi
}

test_small_ordinary_change_allowed() {
    local repo rc
    repo="$(make_repo)"
    gen_lines "$repo" "backend/app/foo.py" 25
    gen_lines "$repo" "frontend/src/bar.ts" 25
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "small ordinary change (2 files, ~50 lines) allowed" 0 "$rc"
}

test_file_count_guard_still_blocks() {
    local repo rc i
    repo="$(make_repo)"
    for i in $(seq 1 12); do
        gen_lines "$repo" "backend/app/module_${i}.py" 3
    done
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "12 staged hand-written production files still blocked" 1 "$rc"
}

test_line_count_guard_still_blocks() {
    local repo rc
    repo="$(make_repo)"
    gen_lines "$repo" "backend/app/big_one.py" 400
    gen_lines "$repo" "backend/app/big_two.py" 300
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "700 added lines across 2 hand-written production files still blocked" 1 "$rc"
}

test_merge_in_progress_allowed() {
    local repo rc i
    repo="$(make_repo)"
    for i in $(seq 1 12); do
        gen_lines "$repo" "backend/app/module_${i}.py" 3
    done
    git -C "$repo" add .
    touch "$repo/.git/MERGE_HEAD"
    rc="$(hook_exit_code "$repo")"
    record "merge commit in progress (MERGE_HEAD present) allowed" 0 "$rc"
}

test_allow_batch_commit_env_allowed() {
    local repo rc i
    repo="$(make_repo)"
    for i in $(seq 1 12); do
        gen_lines "$repo" "backend/app/module_${i}.py" 3
    done
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo" ALLOW_BATCH_COMMIT=1)"
    record "ALLOW_BATCH_COMMIT=1 bypasses guard" 0 "$rc"
}

# RED: file count must exclude lockfiles, tool/project config files, and
# specs/openspec artifacts (Constitution Principle X). Today the file count
# (pre-commit line 36) excludes nothing, so this is blocked.
test_file_count_excludes_lockfiles_config_and_specs() {
    local repo rc
    repo="$(make_repo)"
    gen_lines "$repo" "backend/app/foo.py" 5
    gen_lines "$repo" "backend/app/bar.py" 5
    gen_lines "$repo" "frontend/src/baz.ts" 5
    gen_lines "$repo" "pnpm-lock.yaml" 5
    gen_lines "$repo" "uv.lock" 5
    gen_lines "$repo" "pyproject.toml" 5
    gen_lines "$repo" "tsconfig.json" 5
    gen_lines "$repo" ".gitignore" 5
    gen_lines "$repo" "specs/task-management/001-feature/spec.md" 5
    gen_lines "$repo" "specs/dataset/002-feature/tasks.md" 5
    gen_lines "$repo" "openspec/changes/001-change/proposal.md" 5
    gen_lines "$repo" "openspec/changes/001-change/design.md" 5
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "file count excludes lockfiles/config/specs (3 real prod files, 9 excluded)" 0 "$rc"
}

# RED: line count must exclude lockfiles and specs/openspec artifacts, not
# just test paths (pre-commit lines 41-47 today only filter test paths).
test_line_count_excludes_lockfiles_and_specs() {
    local repo rc
    repo="$(make_repo)"
    gen_lines "$repo" "backend/app/foo.py" 20
    gen_lines "$repo" "backend/app/bar.py" 20
    gen_lines "$repo" "pnpm-lock.yaml" 500
    gen_lines "$repo" "specs/task-management/001-feature/spec.md" 400
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "line count excludes lockfile + specs (~40 hand-written lines remain)" 0 "$rc"
}

# RED: line count must exclude generated files carrying a machine-detectable
# generated marker, modeled on design/system/screen-inventory.md's real header.
test_line_count_excludes_generated_files() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/design/system"
    {
        echo "# Fake Generated Screen Inventory"
        echo ""
        echo "> ${GENERATED_MARKER} 唯一生成來源是 inventory-manifest.json；請勿手動編輯。"
        echo ""
        seq 1 796
    } >"$repo/design/system/fake-generated.md"
    gen_lines "$repo" "backend/app/small_change.py" 10
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "generated file (marker header, ~800 lines) excluded from line count" 0 "$rc"
}

# RED: the header probe must not hinge on the exit status of the
# `git show | head` pipeline. Once `head` has its ten lines it closes the
# read end, and `git show` dies of SIGPIPE with any blob still unwritten —
# under `set -o pipefail` that reports 141 for a perfectly readable
# generated file. Blob size decides whether git finishes writing first, so
# this case pads well past any pipe buffer instead of depending on a
# platform where the real inventory happens to be large enough: the same
# suite passes on macOS and fails on ubuntu-24.04 (issue #648).
test_large_generated_file_still_excluded() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/design/system"
    {
        echo "# Fake Large Generated Inventory"
        echo ""
        echo "> ${GENERATED_MARKER} 唯一生成來源是 inventory-manifest.json；請勿手動編輯。"
        echo ""
        seq 1 200000
    } >"$repo/design/system/fake-large-generated.md"
    gen_lines "$repo" "backend/app/small_change.py" 10
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "large generated file (marker header, >1MB blob) excluded from line count" 0 "$rc"
}

# RED: empty __init__.py and re-export-only index.ts barrel files must not
# count toward the file threshold.
test_file_count_excludes_empty_and_reexport_barrels() {
    local repo rc i
    repo="$(make_repo)"
    for i in $(seq 1 10); do
        gen_lines "$repo" "backend/app/module_${i}.py" 3
    done
    mkdir -p "$repo/backend/app/sub" "$repo/frontend/src/sub"
    : >"$repo/backend/app/sub/__init__.py"
    echo "export * from './foo';" >"$repo/frontend/src/sub/index.ts"
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "empty __init__.py + re-export-only index.ts excluded from file count" 0 "$rc"
}

# RED (issue #462 adversarial follow-up): the generated-file detector must key
# off a HEADER marker, not a bare substring anywhere in the blob. A
# hand-written ~900-line file that merely mentions "generated view" in
# ordinary prose is not generated and must still be counted — and, at 900
# lines on its own, must trip the line-count guard.
test_loose_generated_view_phrase_in_prose_still_blocked() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/backend/app"
    {
        echo '"""Admin permissions helpers.'
        echo ""
        echo "This module renders a generated view of user permissions for the"
        echo "admin dashboard. It is hand-written and maintained manually here;"
        echo "nothing in this file is produced by a code generator."
        echo '"""'
        echo ""
        seq 1 895
    } >"$repo/backend/app/admin_permissions.py"
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "hand-written ~900-line file with loose 'generated view' prose still blocked" 1 "$rc"
}

# RED (issue #462 adversarial follow-up): the real marker placed deep in the
# file body (around line 400 of an ~800-line file) rather than in the header
# must NOT satisfy "header marker" — the file must still be counted and, at
# 800 lines, must trip the line-count guard.
test_generated_marker_deep_in_body_not_header_still_blocked() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/backend/app"
    {
        seq 1 399
        echo "> ${GENERATED_MARKER} 唯一生成來源是 inventory-manifest.json；請勿手動編輯。"
        seq 400 800
    } >"$repo/backend/app/deep_marker.py"
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "real marker deep in body (not header, ~800 lines) still blocked" 1 "$rc"
}

# Regression guard (issue #462 adversarial follow-up): the real
# design/system/screen-inventory.md, read from this repo at runtime and
# padded past the 600-line threshold, must still be excluded via its real
# header marker — pins that tightening the detector to "header marker" does
# not also break the repo's actual generated-view convention.
test_real_screen_inventory_header_marker_still_excluded() {
    local repo rc real_file
    repo="$(make_repo)"
    real_file="$ROOT/design/system/screen-inventory.md"
    mkdir -p "$repo/design/system"
    cp "$real_file" "$repo/design/system/screen-inventory.md"
    seq 1 500 >>"$repo/design/system/screen-inventory.md"
    gen_lines "$repo" "backend/app/small_change.py" 10
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "real screen-inventory.md (header marker, padded >600 lines) still excluded" 0 "$rc"
}

# RED (issue #697): third-party generators (e.g. archify) mark their HTML
# output with the standard `<meta name="generator" content="...">` tag, not
# this repo's own Chinese marker string. Today's is_generated_blob() only
# recognizes the Chinese marker, so an archify diagram this size is counted
# and trips the line-count guard purely because of where it happened to be
# placed (docs/diagrams/ vs specs/) rather than because it is hand-written.
test_line_count_excludes_generator_meta_tag_files() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/docs/diagrams/architecture"
    {
        echo "<!doctype html>"
        echo "<html>"
        echo "<head>"
        echo '<meta charset="utf-8">'
        echo '<meta name="generator" content="archify 2.17.0-dev.1">'
        echo "</head>"
        echo "<body>"
        seq 1 796
        echo "</body></html>"
    } >"$repo/docs/diagrams/architecture/fake-archify-diagram.html"
    gen_lines "$repo" "backend/app/small_change.py" 10
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "generator meta tag file (header, ~800 lines) excluded from line count" 0 "$rc"
}

# RED (issue #697, mirrors test_generated_marker_deep_in_body_not_header_still_blocked):
# a generator meta tag past the header window must not retroactively excuse
# the file — the detector stays header-scoped for both marker forms.
test_generator_meta_tag_deep_in_body_not_header_still_blocked() {
    local repo rc
    repo="$(make_repo)"
    mkdir -p "$repo/backend/app"
    {
        seq 1 399
        echo '<meta name="generator" content="archify 2.17.0-dev.1">'
        seq 400 800
    } >"$repo/backend/app/deep_meta_tag.py"
    git -C "$repo" add .
    rc="$(hook_exit_code "$repo")"
    record "generator meta tag deep in body (not header, ~800 lines) still blocked" 1 "$rc"
}

test_small_ordinary_change_allowed
test_file_count_guard_still_blocks
test_line_count_guard_still_blocks
test_merge_in_progress_allowed
test_allow_batch_commit_env_allowed
test_file_count_excludes_lockfiles_config_and_specs
test_line_count_excludes_lockfiles_and_specs
test_line_count_excludes_generated_files
test_large_generated_file_still_excluded
test_file_count_excludes_empty_and_reexport_barrels
test_loose_generated_view_phrase_in_prose_still_blocked
test_generated_marker_deep_in_body_not_header_still_blocked
test_real_screen_inventory_header_marker_still_excluded
test_line_count_excludes_generator_meta_tag_files
test_generator_meta_tag_deep_in_body_not_header_still_blocked

echo ""
echo "=== pre-commit guard test summary ==="
fail_count=0
for r in "${RESULTS[@]}"; do
    echo "$r"
    [[ "$r" == FAIL:* ]] && fail_count=$((fail_count + 1))
done
echo "======================================"
echo "${#RESULTS[@]} total, $((${#RESULTS[@]} - fail_count)) passed, $fail_count failed"

if [[ "$fail_count" -gt 0 ]]; then
    exit 1
fi
