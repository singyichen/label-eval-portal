#!/usr/bin/env bash
# speckit-tests.sh — Run local regression tests for Label Suite speckit helper scripts.
#
# Usage:
#   ./scripts/speckit-tests.sh
#   bash scripts/speckit-tests.sh
#
# IMPORTANT — when to use this script:
#   Use after changing scripts/speckit/*, scripts/check-spec-artifacts.sh, or
#   CI rules that enforce the spec/prototype harness.
#   It builds temporary git repositories under TMPDIR and validates feature
#   branch resolution, spec creation, STATUS.md updates, artifact sync checks,
#   and prototype CI package-manager rules.
#
# How it works:
#   Each test creates an isolated throwaway repo with minimal .specify templates,
#   specs, STATUS.md, and prototype test folders. The script copies the current
#   helper scripts into that repo, runs real git/shell commands, and removes the
#   temporary files on exit.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/label-suite-speckit.XXXXXX")"
TMP_ROOT="$(cd "$TMP_ROOT" && pwd)"

cleanup() {
    rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

assert_file() {
    local path="$1"
    if [[ ! -f "$path" ]]; then
        echo "Expected file to exist: $path" >&2
        exit 1
    fi
}

assert_contains() {
    local path="$1"
    local text="$2"
    if ! grep -Fq "$text" "$path"; then
        echo "Expected $path to contain: $text" >&2
        echo "--- $path ---" >&2
        cat "$path" >&2
        exit 1
    fi
}

make_repo() {
    local repo
    repo="$(mktemp -d "$TMP_ROOT/repo.XXXXXX")"
    mkdir -p "$repo/.specify/templates" "$repo/specs/task-management/013-task-new" "$repo/specs/dataset" "$repo/design/prototype/tests/task-management"
    git -C "$repo" init -q
    git -C "$repo" checkout -q -b feat/task-management/013-task-new

    cat > "$repo/.specify/templates/spec-template.md" <<'SPEC'
# Feature Specification: [FEATURE NAME]
SPEC
    cat > "$repo/.specify/templates/plan-template.md" <<'PLAN'
# Implementation Plan: [FEATURE]
PLAN
    cat > "$repo/specs/task-management/013-task-new/spec.md" <<'SPEC'
# Feature Specification: Existing Task
SPEC
    cat > "$repo/specs/task-management/013-task-new/plan.md" <<'PLAN'
# Implementation Plan: Existing Task
PLAN
    cat > "$repo/specs/task-management/013-task-new/tasks.md" <<'TASKS'
# Tasks: Existing Task
TASKS
    cat > "$repo/design/prototype/tests/task-management/task-new.spec.ts" <<'TEST'
import { test } from '@playwright/test'
test('placeholder', async () => {})
TEST
    cat > "$repo/specs/STATUS.md" <<'STATUS'
# 規格狀態索引

| ID | 功能 | 模組 | 狀態 | 分支 | 備註 |
| --- | --- | --- | --- | --- | --- |
| task-management-013 | Existing Task | task-management | `tasks-ready` | `feat/task-management/013-task-new` | seeded |

## 變更紀錄

| 日期 | 更新內容 |
|------|----------|
STATUS

    mkdir -p "$repo/scripts"
    cp -R "$ROOT/scripts/speckit" "$repo/scripts/speckit"
    cp "$ROOT/scripts/check-spec-artifacts.sh" "$repo/scripts/check-spec-artifacts.sh"
    git -C "$repo" add .
    git -C "$repo" -c user.email="speckit-test@example.com" -c user.name="Speckit Test" commit -q -m "seed test repo"
    echo "$repo"
}

test_prerequisites_resolve_module_feature_paths() {
    local repo
    repo="$(make_repo)"

    local output
    output="$("$repo/scripts/speckit/check-prerequisites.sh" --json --require-tasks --include-tasks)"

    [[ "$output" == *'"FEATURE_MODULE":"task-management"'* ]] || { echo "$output" >&2; exit 1; }
    [[ "$output" == *'"FEATURE_NAME":"013-task-new"'* ]] || { echo "$output" >&2; exit 1; }
    [[ "$output" == *'"FEATURE_DIR":"'"$repo"'/specs/task-management/013-task-new"'* ]] || { echo "$output" >&2; exit 1; }
    [[ "$output" == *'"tasks.md"'* ]] || { echo "$output" >&2; exit 1; }
}

test_create_feature_creates_module_branch_spec_and_status() {
    local repo
    repo="$(make_repo)"

    "$repo/scripts/speckit/create-new-feature.sh" --module dataset --short-name quality-export --json "Dataset quality export" >/tmp/create-feature.json

    assert_file "$repo/specs/dataset/001-quality-export/spec.md"
    assert_contains "$repo/specs/STATUS.md" '| dataset-001 | Dataset quality export | dataset | `spec-ready` | `feat/dataset/001-quality-export` |'
    local branch
    branch="$(git -C "$repo" symbolic-ref --short HEAD)"
    [[ "$branch" == "feat/dataset/001-quality-export" ]] || { echo "Unexpected branch: $branch" >&2; exit 1; }
}

test_setup_plan_and_status_update() {
    local repo
    repo="$(make_repo)"

    "$repo/scripts/speckit/setup-plan.sh" --json >/tmp/setup-plan.json
    assert_file "$repo/specs/task-management/013-task-new/plan.md"
    assert_contains "$repo/specs/STATUS.md" '| task-management-013 | Existing Task | task-management | `plan-ready` | `feat/task-management/013-task-new` |'

    "$repo/scripts/speckit/update-status.sh" --module task-management --feature 013-task-new --status in-progress --branch feat/task-management/013-task-new --note "implementation started"
    assert_contains "$repo/specs/STATUS.md" '| task-management-013 | Existing Task | task-management | `in-progress` | `feat/task-management/013-task-new` | implementation started |'
}

test_check_spec_artifacts_passes_for_synced_repo() {
    local repo
    repo="$(make_repo)"

    "$repo/scripts/check-spec-artifacts.sh" "$repo"
}

test_check_spec_artifacts_fails_for_untracked_spec() {
    local repo
    repo="$(make_repo)"

    mkdir -p "$repo/specs/dataset/001-quality-export"
    cat > "$repo/specs/dataset/001-quality-export/spec.md" <<'SPEC'
# Feature Specification: Dataset quality export
SPEC

    if "$repo/scripts/check-spec-artifacts.sh" "$repo" >/tmp/check-spec-artifacts.out 2>/tmp/check-spec-artifacts.err; then
        echo "Expected check-spec-artifacts.sh to fail for untracked spec" >&2
        exit 1
    fi
    assert_contains /tmp/check-spec-artifacts.err "Missing STATUS.md row for spec: dataset/001-quality-export"
}

test_check_spec_artifacts_accepts_archived_spec_location() {
    # A canonical spec archived per specs/STATUS.md 封存規則 lives at
    # specs/_archive/NNN-feature/ with no module directory in between. The
    # module-layout scan must not read `_archive` as a module name, and the
    # STATUS reverse check must still resolve the archived row.
    local repo
    repo="$(make_repo)"

    mkdir -p "$repo/specs/_archive"
    mv "$repo/specs/task-management/013-task-new" "$repo/specs/_archive/013-task-new"
    rmdir "$repo/specs/task-management"
    sed -i.bak 's/`tasks-ready`/`archived`/' "$repo/specs/STATUS.md"
    rm -f "$repo/specs/STATUS.md.bak"

    if ! "$repo/scripts/check-spec-artifacts.sh" "$repo" >/tmp/check-spec-artifacts-archived.out 2>/tmp/check-spec-artifacts-archived.err; then
        echo "Expected check-spec-artifacts.sh to accept an archived canonical spec" >&2
        cat /tmp/check-spec-artifacts-archived.err >&2
        exit 1
    fi
}

test_check_spec_artifacts_fails_for_archived_row_without_archived_spec() {
    # The archived branch must still be a check, not a free pass: marking a row
    # archived without moving the spec into specs/_archive/ has to fail.
    local repo
    repo="$(make_repo)"

    sed -i.bak 's/`tasks-ready`/`archived`/' "$repo/specs/STATUS.md"
    rm -f "$repo/specs/STATUS.md.bak"

    if "$repo/scripts/check-spec-artifacts.sh" "$repo" >/tmp/check-spec-artifacts-noarchive.out 2>/tmp/check-spec-artifacts-noarchive.err; then
        echo "Expected check-spec-artifacts.sh to fail for an archived row with no archived spec" >&2
        exit 1
    fi
    assert_contains /tmp/check-spec-artifacts-noarchive.err "STATUS.md archived row has no spec under specs/_archive/: task-management-013"
}

test_ci_uses_pnpm_for_prototype_jobs() {
    local ci="$ROOT/.github/workflows/ci.yml"

    assert_contains "$ci" "scripts/check-spec-artifacts.sh"
    assert_contains "$ci" "pnpm/action-setup"
    assert_contains "$ci" "pnpm install --frozen-lockfile"
    assert_contains "$ci" "pnpm test"
    if grep -Eq 'run: npm (ci|test|run)' "$ci"; then
        echo "Prototype CI must use pnpm, not npm" >&2
        exit 1
    fi
}

count_top_level_sdd_lint_jobs() {
    local ci="$1"

    awk '
        /^jobs:[[:space:]]*(#.*)?$/ {
            in_jobs = 1
            next
        }
        in_jobs && /^[^[:space:]#]/ {
            exit
        }
        in_jobs && /^  sdd-lint:[[:space:]]*(#.*)?$/ {
            count++
        }
        END {
            print count + 0
        }
    ' "$ci"
}

insert_independent_sdd_lint_job_after_validate() {
    local ci="$1"
    if ! grep -Eq '^  backend-ruff:[[:space:]]*(#.*)?$' "$ci"; then
        echo "Expected copied CI workflow to contain backend-ruff after validate" >&2
        exit 1
    fi

    sed -i.bak '/^  backend-ruff:$/i\
  sdd-lint:\
    name: Project SDD Lint\
    runs-on: ubuntu-24.04\
    steps:\
      - uses: actions/checkout@v5\
      - name: Check project SDD governance\
        run: scripts/check-sdd.sh
' "$ci"
}

ensure_independent_sdd_lint_job_after_validate() {
    local ci="$1"

    if [[ "$(count_top_level_sdd_lint_jobs "$ci")" -eq 0 ]]; then
        insert_independent_sdd_lint_job_after_validate "$ci"
    fi
}

insert_sdd_lint_text_after_command() {
    local ci="$1"
    local text="$2"
    local fragment

    if [[ "$(grep -Ec '^        run: scripts/check-sdd\.sh$' "$ci")" -ne 1 ]]; then
        echo "Expected copied CI workflow to contain one sdd-lint command step" >&2
        exit 1
    fi

    fragment="$(mktemp "$TMP_ROOT/sdd-lint-fragment.XXXXXX")"
    printf '%s\n' "$text" > "$fragment"
    sed -i.bak "/^        run: scripts\\/check-sdd\\.sh$/r $fragment" "$ci"
}

extract_top_level_sdd_lint_job() {
    local ci="$1"

    awk '
        /^jobs:[[:space:]]*(#.*)?$/ {
            in_jobs = 1
            next
        }
        in_jobs && /^[^[:space:]#]/ {
            exit
        }
        in_jobs && /^  sdd-lint:[[:space:]]*(#.*)?$/ {
            in_sdd_lint = 1
            next
        }
        in_sdd_lint && /^  [^[:space:]#][^:]*:[[:space:]]*(#.*)?$/ {
            exit
        }
        in_sdd_lint {
            print
        }
    ' "$ci"
}

extract_sdd_lint_steps() {
    local job="$1"

    printf '%s\n' "$job" | awk '
        /^    steps:[[:space:]]*(#.*)?$/ {
            in_steps = 1
            next
        }
        in_steps && /^    [^[:space:]#][^:]*:[[:space:]]*(#.*)?$/ {
            exit
        }
        in_steps {
            print
        }
    '
}

summarize_sdd_lint_steps() {
    local steps="$1"

    printf '%s\n' "$steps" | awk '
        function clean_value(value) {
            sub(/[[:space:]]+#.*$/, "", value)
            return value
        }
        function record_uses(value) {
            uses_count++
            step_uses++
            if (value == "actions/checkout@v5") {
                checkout_count++
            }
        }
        function record_run(value) {
            run_count++
            step_runs++
            if (value == "scripts/check-sdd.sh") {
                command_count++
            }
        }
        function finish_step() {
            if (step_count > 0 && step_uses > 0 && step_runs > 0) {
                mixed_step_count++
            }
        }
        /^      - / {
            finish_step()
            step_count++
            step_uses = 0
            step_runs = 0
            if ($0 ~ /^      - uses:[[:space:]]*/) {
                value = $0
                sub(/^      - uses:[[:space:]]*/, "", value)
                record_uses(clean_value(value))
            } else if ($0 ~ /^      - run:[[:space:]]*/) {
                value = $0
                sub(/^      - run:[[:space:]]*/, "", value)
                record_run(clean_value(value))
            }
            next
        }
        step_count > 0 && /^        uses:[[:space:]]*/ {
            value = $0
            sub(/^        uses:[[:space:]]*/, "", value)
            record_uses(clean_value(value))
            next
        }
        step_count > 0 && /^        run:[[:space:]]*/ {
            value = $0
            sub(/^        run:[[:space:]]*/, "", value)
            record_run(clean_value(value))
            next
        }
        END {
            finish_step()
            print step_count + 0 "|" checkout_count + 0 "|" command_count + 0 "|" uses_count + 0 "|" run_count + 0 "|" mixed_step_count + 0
        }
    '
}

workflow_has_path_filtered_push_or_pull_request() {
    local ci="$1"

    awk '
        /^on:[[:space:]]*(#.*)?$/ {
            in_on = 1
            next
        }
        in_on && /^[^[:space:]#]/ {
            exit
        }
        in_on && /^  (push|pull_request):/ {
            in_trigger = 1
            if ($0 ~ /paths(-ignore)?/) {
                found = 1
                exit
            }
            next
        }
        in_on && /^  [^[:space:]#][^:]*:[[:space:]]*(#.*)?$/ {
            in_trigger = 0
            next
        }
        in_on && in_trigger && /^    paths(-ignore)?:/ {
            found = 1
            exit
        }
        END {
            exit(found ? 0 : 1)
        }
    ' "$ci"
}

assert_independent_sdd_lint_job() {
    local ci="$1"
    local command_count checkout_count job job_count mixed_step_count run_count step_count steps summary uses_count

    job_count="$(count_top_level_sdd_lint_jobs "$ci")"
    if [[ "$job_count" -ne 1 ]]; then
        echo "Expected exactly one independent top-level sdd-lint job, found $job_count" >&2
        return 1
    fi

    job="$(extract_top_level_sdd_lint_job "$ci")"
    if workflow_has_path_filtered_push_or_pull_request "$ci"; then
        echo "Project SDD Lint workflow must not filter push or pull_request by paths" >&2
        return 1
    fi
    if ! printf '%s\n' "$job" | grep -Eq '^    name: Project SDD Lint[[:space:]]*(#.*)?$'; then
        echo "Expected independent sdd-lint job to have display name: Project SDD Lint" >&2
        return 1
    fi
    if printf '%s\n' "$job" | grep -Eq '^[[:space:]]+working-directory:'; then
        echo "Independent sdd-lint job must run scripts/check-sdd.sh from the repository root" >&2
        return 1
    fi
    if printf '%s\n' "$job" | grep -Eq '^    needs:'; then
        echo "Independent sdd-lint job must not declare needs" >&2
        return 1
    fi
    if printf '%s\n' "$job" | grep -Eqi '(^|[[:space:]])(npm|pnpm|yarn|bun|uv|pip|poetry)[[:space:]]+(ci|install|sync)([[:space:]]|$)'; then
        echo "Independent sdd-lint job must not install dependencies" >&2
        return 1
    fi
    if printf '%s\n' "$job" | grep -Eqi '(^|[[:space:]])openspec([[:space:]]|$)'; then
        echo "Independent sdd-lint job must not run OpenSpec commands" >&2
        return 1
    fi
    if printf '%s\n' "$job" | grep -Eqi 'dorny/paths-filter|paths-filter|^[[:space:]]+paths(-ignore)?:|^[[:space:]]+if:.*(path|change)'; then
        echo "Independent sdd-lint job must not couple to path filtering" >&2
        return 1
    fi

    steps="$(extract_sdd_lint_steps "$job")"
    summary="$(summarize_sdd_lint_steps "$steps")"
    IFS='|' read -r step_count checkout_count command_count uses_count run_count mixed_step_count <<< "$summary"

    if [[ "$uses_count" -ne 1 || "$checkout_count" -ne 1 ]]; then
        echo "Independent sdd-lint job must use exactly one actions/checkout@v5 step" >&2
        return 1
    fi
    if [[ "$command_count" -ne 1 ]]; then
        echo "Expected independent sdd-lint job to run scripts/check-sdd.sh from the repository root" >&2
        return 1
    fi
    if [[ "$run_count" -ne 1 ]]; then
        echo "Independent sdd-lint job must only run scripts/check-sdd.sh" >&2
        return 1
    fi
    if [[ "$mixed_step_count" -ne 0 ]]; then
        echo "Independent sdd-lint job must keep checkout and lint command in separate steps" >&2
        return 1
    fi
    if [[ "$step_count" -ne 2 ]]; then
        echo "Independent sdd-lint job must have exactly two steps: checkout and lint" >&2
        return 1
    fi
}

sdd_lint_checkout_has_full_history() {
    local job="$1"

    printf '%s\n' "$job" | awk '
        /^      - / {
            in_step = 1
            checkout_step = 0
            in_with = 0
            if ($0 ~ /^      - uses:[[:space:]]*actions\/checkout@v5([[:space:]]*(#.*)?)?$/) {
                checkout_step = 1
            }
            next
        }
        in_step && /^        uses:[[:space:]]*actions\/checkout@v5([[:space:]]*(#.*)?)?$/ {
            checkout_step = 1
            next
        }
        checkout_step && /^        with:[[:space:]]*(#.*)?$/ {
            in_with = 1
            next
        }
        checkout_step && in_with && /^          fetch-depth:[[:space:]]*(0|"0"|'\''0'\'')([[:space:]]*(#.*)?)?$/ {
            full_history++
        }
        END {
            exit !(full_history == 1)
        }
    '
}

assert_sdd_lint_ci_contract_rejected() {
    local ci="$1"
    local expected="$2"
    local output status
    output="$(mktemp "$TMP_ROOT/sdd-lint-ci.XXXXXX")"

    if assert_independent_sdd_lint_job "$ci" >"$output" 2>&1; then
        echo "Expected malformed sdd-lint CI job to be rejected" >&2
        exit 1
    else
        status=$?
    fi
    if [[ "$status" -ne 1 ]]; then
        echo "Expected malformed sdd-lint CI job to exit 1, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "$expected"
}

test_check_sdd_ci_job_is_independent_for_after_validate_job() {
    local ci duplicate_ci existing_ci extra_named_run_ci install_ci needs_ci openspec_ci root_command_ci setup_ci split_ci path_filter_ci workflow_path_filter_ci workflow_path_ignore_ci
    ci="$(mktemp "$TMP_ROOT/ci-sdd-lint.XXXXXX")"
    cp "$ROOT/.github/workflows/ci.yml" "$ci"
    ensure_independent_sdd_lint_job_after_validate "$ci"
    assert_independent_sdd_lint_job "$ci"

    existing_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-existing.XXXXXX")"
    cp "$ci" "$existing_ci"
    ensure_independent_sdd_lint_job_after_validate "$existing_ci"
    if [[ "$(count_top_level_sdd_lint_jobs "$existing_ci")" -ne 1 ]]; then
        echo "Expected existing independent sdd-lint job fixture not to be duplicated" >&2
        exit 1
    fi
    assert_independent_sdd_lint_job "$existing_ci"

    duplicate_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-duplicate.XXXXXX")"
    cp "$ci" "$duplicate_ci"
    printf '\n  sdd-lint:\n    name: Duplicate Project SDD Lint\n' >> "$duplicate_ci"
    assert_sdd_lint_ci_contract_rejected "$duplicate_ci" "Expected exactly one independent top-level sdd-lint job, found 2"

    needs_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-needs.XXXXXX")"
    cp "$ci" "$needs_ci"
    sed -i.bak '/^  sdd-lint:$/a\
    needs: validate
' "$needs_ci"
    assert_sdd_lint_ci_contract_rejected "$needs_ci" "Independent sdd-lint job must not declare needs"

    install_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-install.XXXXXX")"
    cp "$ci" "$install_ci"
    insert_sdd_lint_text_after_command "$install_ci" $'      - name: Install dependencies\n        run: pnpm install --frozen-lockfile'
    assert_sdd_lint_ci_contract_rejected "$install_ci" "Independent sdd-lint job must not install dependencies"

    openspec_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-openspec.XXXXXX")"
    cp "$ci" "$openspec_ci"
    insert_sdd_lint_text_after_command "$openspec_ci" '      - run: openspec validate --changes --no-interactive'
    assert_sdd_lint_ci_contract_rejected "$openspec_ci" "Independent sdd-lint job must not run OpenSpec commands"

    path_filter_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-path-filter.XXXXXX")"
    cp "$ci" "$path_filter_ci"
    insert_sdd_lint_text_after_command "$path_filter_ci" '      - uses: dorny/paths-filter@v3'
    assert_sdd_lint_ci_contract_rejected "$path_filter_ci" "Independent sdd-lint job must not couple to path filtering"

    workflow_path_filter_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-workflow-path-filter.XXXXXX")"
    cp "$ci" "$workflow_path_filter_ci"
    sed -i.bak '/^  pull_request:$/a\
    paths:\
      - scripts/**
' "$workflow_path_filter_ci"
    assert_sdd_lint_ci_contract_rejected "$workflow_path_filter_ci" "Project SDD Lint workflow must not filter push or pull_request by paths"

    workflow_path_ignore_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-workflow-path-ignore.XXXXXX")"
    cp "$ci" "$workflow_path_ignore_ci"
    sed -i.bak '/^  push:$/a\
    paths-ignore:\
      - docs/**
' "$workflow_path_ignore_ci"
    assert_sdd_lint_ci_contract_rejected "$workflow_path_ignore_ci" "Project SDD Lint workflow must not filter push or pull_request by paths"

    root_command_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-root-command.XXXXXX")"
    cp "$ci" "$root_command_ci"
    insert_sdd_lint_text_after_command "$root_command_ci" $'    defaults:\n      run:\n        working-directory: backend'
    assert_sdd_lint_ci_contract_rejected "$root_command_ci" "Independent sdd-lint job must run scripts/check-sdd.sh from the repository root"

    setup_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-setup.XXXXXX")"
    cp "$ci" "$setup_ci"
    insert_sdd_lint_text_after_command "$setup_ci" '      - uses: actions/setup-node@v5'
    assert_sdd_lint_ci_contract_rejected "$setup_ci" "Independent sdd-lint job must use exactly one actions/checkout@v5 step"

    extra_named_run_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-extra-named-run.XXXXXX")"
    cp "$ci" "$extra_named_run_ci"
    insert_sdd_lint_text_after_command "$extra_named_run_ci" $'      - name: Prepare environment\n        run: echo extra setup'
    assert_sdd_lint_ci_contract_rejected "$extra_named_run_ci" "Independent sdd-lint job must only run scripts/check-sdd.sh"

    split_ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-split.XXXXXX")"
    cp "$ci" "$split_ci"
    sed -i.bak '/^        run: scripts\/check-sdd\.sh$/d' "$split_ci"
    cat >> "$split_ci" <<'YAML'
  unrelated:
    runs-on: ubuntu-24.04
    steps:
      - run: scripts/check-sdd.sh
YAML
    assert_sdd_lint_ci_contract_rejected "$split_ci" "Expected independent sdd-lint job to run scripts/check-sdd.sh from the repository root"

}

test_check_sdd_ci_job_is_independent() {
    local ci

    test_check_sdd_ci_job_is_independent_for_after_validate_job

    ci="$(mktemp "$TMP_ROOT/ci-sdd-lint-missing.XXXXXX")"
    cp "$ROOT/.github/workflows/ci.yml" "$ci"
    assert_independent_sdd_lint_job "$ci"
}

INVENTORY_SENTINEL='design/system/screen-inventory.md is stale — run: node scripts/gen-screen-inventory.mjs'

write_inventory_generator_double() {
    local repo="$1"

    cat > "$repo/scripts/gen-screen-inventory.mjs" <<'GENERATOR'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mode = fs.readFileSync(path.join(scriptDir, 'inventory-double-mode.txt'), 'utf8').trim();
const sentinel = 'design/system/screen-inventory.md is stale — run: node scripts/gen-screen-inventory.mjs';

if (process.argv.slice(2).join(' ') !== '--check') {
  process.stderr.write('RAW_WRONG_GENERATOR_ARGUMENTS\n');
  process.exit(9);
}

switch (mode) {
  case 'fresh':
    process.stdout.write('RAW_FRESH_CHILD_OUTPUT\n');
    process.exit(0);
    break;
  case 'stale':
    process.stderr.write(`${sentinel}\n`);
    process.exit(1);
    break;
  case 'prefix':
    process.stdout.write(`RAW_SENTINEL_PREFIX${sentinel}\n`);
    process.exit(1);
    break;
  case 'suffix':
    process.stdout.write(`${sentinel}RAW_SENTINEL_SUFFIX\n`);
    process.exit(1);
    break;
  case 'extra-line':
    process.stdout.write(`${sentinel}\nRAW_EXTRA_NONBLANK_LINE\n`);
    process.exit(1);
    break;
  case 'sentinel-less':
    process.stderr.write('RAW_SENTINEL_LESS_EXIT_ONE\n');
    process.exit(1);
    break;
  case 'exit-two':
    process.stderr.write('RAW_GENERATOR_EXIT_TWO\n');
    process.exit(2);
    break;
  case 'unexpected-exit':
    process.stderr.write('RAW_GENERATOR_UNEXPECTED_EXIT\n');
    process.exit(7);
    break;
  case 'unrunnable':
    process.stderr.write('RAW_GENERATOR_UNRUNNABLE\n');
    process.exit(126);
    break;
  case 'caller-decoy':
    process.stderr.write('RAW_CALLER_GENERATOR_USED\n');
    process.exit(7);
    break;
  default:
    process.stderr.write('RAW_UNKNOWN_GENERATOR_MODE\n');
    process.exit(8);
}
GENERATOR
    printf 'fresh\n' > "$repo/scripts/inventory-double-mode.txt"
}

set_inventory_generator_mode() {
    local repo="$1"
    local mode="$2"

    printf '%s\n' "$mode" > "$repo/scripts/inventory-double-mode.txt"
}

make_sdd_repo() {
    local repo
    repo="$(mktemp -d "$TMP_ROOT/sdd-repo.XXXXXX")"

    mkdir -p \
        "$repo/.claude/agents" \
        "$repo/.github/workflows" \
        "$repo/design/system" \
        "$repo/docs" \
        "$repo/openspec/changes/project-sdd-lint/specs/foundation/001-project-sdd-lint" \
        "$repo/openspec" \
        "$repo/scripts" \
        "$repo/specs/dataset/001-legacy" \
        "$repo/specs/foundation/001-project-sdd-lint"

    cat > "$repo/.claude/agents/senior-qa.md" <<'AGENT'
# Senior QA

## Owns

- `scripts/*-tests.sh`
AGENT
    cat > "$repo/.claude/agents/senior-devops.md" <<'AGENT'
# Senior DevOps

## Must Not Touch

- `scripts/*-tests.sh`

## Owns

- production `scripts/`
AGENT
    cat > "$repo/AGENTS.md" <<'GUIDANCE'
# Fixture guidance

Use pnpm test for prototype checks.
GUIDANCE
    cat > "$repo/CLAUDE.md" <<'GUIDANCE'
# Fixture guidance

Use pnpm run lint for frontend checks.

## Verification Commands

```bash
scripts/check-sdd.sh
```

## Prohibitions

None.
GUIDANCE
    cat > "$repo/docs/sdd-workflow.md" <<'GUIDANCE'
# Fixture SDD workflow
GUIDANCE
    cat > "$repo/openspec/config.yaml" <<'CONFIG'
schema: specification
rules:
  tasks:
    - >-
      Use pnpm test for active task guidance.
CONFIG
    cat > "$repo/specs/foundation/001-project-sdd-lint/spec.md" <<'SPEC'
# Project SDD lint

## 功能目標

Provide an offline governance check.

## 規格相依性

None.

### FR-001
### FR-002
### FR-003
### FR-004
### FR-005
### FR-006
### FR-007
### FR-008
### FR-009
### SC-001
### SC-002
### SC-003
### SC-004
### SC-005
### SC-006
### SC-007
### AC-1.1
### AC-1.2
### AC-1.3
### AC-1.4
### AC-2.1
### AC-2.2
### AC-2.3
### AC-3.1
### AC-3.2
### AC-3.3
### AC-4.1
### AC-4.2
### AC-4.3
SPEC
    cat > "$repo/specs/dataset/001-legacy/spec.md" <<'SPEC'
# Legacy dataset fixture

## 規格相依性

None.
SPEC
    cat > "$repo/specs/STATUS.md" <<'STATUS'
# 規格狀態索引

| ID | 功能 | 模組 | 狀態 | 分支 | 備註 |
| --- | --- | --- | --- | --- | --- |
| foundation-001 | Project SDD lint | foundation | `in-progress` | `feat/project-sdd-lint` | fixture |
| dataset-001 | Legacy dataset | dataset | `done` | `main` | fixture |
STATUS
    cat > "$repo/openspec/changes/project-sdd-lint/proposal.md" <<'PROPOSAL'
# Project SDD lint proposal

對應 Spec: specs/foundation/001-project-sdd-lint/spec.md

FR-001 SC-001 AC-1.1
PROPOSAL
    cat > "$repo/openspec/changes/project-sdd-lint/design.md" <<'DESIGN'
# Project SDD lint design

## 功能目標

Serve SC-001 with a local command.

FR-002 SC-002 AC-3.1
DESIGN
    cat > "$repo/openspec/changes/project-sdd-lint/tasks.md" <<'TASKS'
# Tasks: Project SDD lint

## 1. Red and Green

**故事目標**：SC-001

- [ ] 1.1 Red contract in `scripts/speckit-tests.sh`. [@senior-qa]
- [ ] 1.2 Green command in `scripts/check-sdd.sh`. [@senior-devops]
TASKS
    cat > "$repo/openspec/changes/project-sdd-lint/specs/foundation/001-project-sdd-lint/spec.md" <<'DELTA'
## Purpose

FR-003 SC-003 AC-2.1
DELTA
    cat > "$repo/scripts/sdd-lint-baseline.txt" <<'BASELINE'
LEGACY_SPEC_HEADING	specs/dataset/001-legacy/spec.md	missing:## 功能目標
BASELINE
    cat > "$repo/design/system/screen-inventory.md" <<'INVENTORY'
# Synthetic screen inventory
INVENTORY
    cat > "$repo/.github/workflows/ci.yml" <<'WORKFLOW'
name: Fixture CI
on:
  push:
jobs:
  sdd-lint:
    name: Project SDD Lint
    runs-on: ubuntu-24.04
    steps:
      - run: scripts/check-sdd.sh
WORKFLOW
    printf 'sdd-lint\tscripts/check-sdd.sh\tcheck-sdd.sh\n' > "$repo/scripts/ci-jobs.tsv"
    printf 'sdd-lint\tscripts/check-sdd.sh\tgen-screen-inventory.mjs\n' >> "$repo/scripts/ci-jobs.tsv"
    cp "$ROOT/scripts/check-sdd.sh" "$repo/scripts/check-sdd.sh"
    write_inventory_generator_double "$repo"

    echo "$repo"
}

run_check_sdd_from() {
    local caller="$1"
    local repo="$2"
    shift 2
    local command="$repo/scripts/check-sdd.sh"

    if [[ ! -x "$command" ]]; then
        echo "Expected Project SDD lint command is missing: scripts/check-sdd.sh" >&2
        return 127
    fi

    (
        cd "$caller"
        "$command" "$@" "$repo"
    )
}

run_check_sdd() {
    local repo="$1"
    shift
    local command="$repo/scripts/check-sdd.sh"

    if [[ ! -x "$command" ]]; then
        echo "Expected Project SDD lint command is missing: scripts/check-sdd.sh" >&2
        return 127
    fi

    (
        cd "$TMP_ROOT"
        "$command" "$@"
    )
}

run_check_sdd_explicit() {
    local repo="$1"
    shift

    run_check_sdd_from "$TMP_ROOT" "$repo" "$@"
}

assert_command_fails_with() {
    local repo="$1"
    local expected_status="$2"
    local rule="$3"
    local path="$4"
    shift 4
    local excluded_rule='' output status

    if [[ "${1:-}" == "--not-rule" ]]; then
        excluded_rule="$2"
        shift 2
    fi
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"

    if run_check_sdd "$repo" "$@" >"$output" 2>&1; then
        echo "Expected check-sdd.sh to exit $expected_status" >&2
        exit 1
    else
        status=$?
    fi
    if [[ "$status" -ne "$expected_status" ]]; then
        echo "Expected check-sdd.sh to exit $expected_status, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "ERROR [$rule] $path:"
    if [[ -n "$excluded_rule" ]]; then
        assert_not_contains "$output" "ERROR [$excluded_rule]"
    fi
}

assert_command_succeeds() {
    local repo="$1"
    shift
    local excluded_rule='' output status

    if [[ "${1:-}" == "--not-rule" ]]; then
        excluded_rule="$2"
        shift 2
    fi
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"

    if run_check_sdd "$repo" "$@" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]]; then
        echo "Expected check-sdd.sh to exit 0, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "Project SDD lint: 0 error(s)"
    if [[ -n "$excluded_rule" ]]; then
        assert_not_contains "$output" "ERROR [$excluded_rule]"
    fi
}

assert_not_contains() {
    local path="$1"
    local text="$2"

    if grep -Fq "$text" "$path"; then
        echo "Expected $path not to contain: $text" >&2
        cat "$path" >&2
        exit 1
    fi
}

record_expected_lint_failure() {
    local label="$1"
    local repo="$2"
    local rule="$3"
    local path="$4"
    local output status
    output="$(mktemp "$TMP_ROOT/check-sdd-final-high.XXXXXX")"

    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 1 ]] || ! grep -Fq "ERROR [$rule] $path:" "$output"; then
        echo "RED_MISS [$label] expected $rule on $path with exit 1, got exit $status" >&2
        cat "$output" >&2
        return 1
    fi
}

record_expected_lint_success() {
    local label="$1"
    local repo="$2"
    local excluded_rule="$3"
    local output status
    output="$(mktemp "$TMP_ROOT/check-sdd-final-control.XXXXXX")"

    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]] || ! grep -Fq "Project SDD lint: 0 error(s)" "$output" || grep -Fq "ERROR [$excluded_rule]" "$output"; then
        echo "CONTROL_FAILURE [$label] expected exit 0 without $excluded_rule, got exit $status" >&2
        cat "$output" >&2
        return 1
    fi
}

assert_inventory_success() {
    local repo="$1"
    shift
    local output runner status

    for runner in run_check_sdd run_check_sdd_explicit; do
        output="$(mktemp "$TMP_ROOT/check-sdd-inventory.XXXXXX")"
        if "$runner" "$repo" "$@" >"$output" 2>&1; then
            status=0
        else
            status=$?
        fi
        if [[ "$status" -ne 0 ]]; then
            echo "Expected fresh inventory lint to exit 0, got: $status" >&2
            cat "$output" >&2
            exit 1
        fi
        assert_contains "$output" "Project SDD lint: 0 error(s)"
        assert_not_contains "$output" "INVENTORY_FRESHNESS]"
        assert_not_contains "$output" "INVENTORY_CHECK_CONFIG"
        assert_not_contains "$output" "INVENTORY_FRESHNESS_UNVERIFIED"
        assert_not_contains "$output" "RAW_FRESH_CHILD_OUTPUT"
    done
}

assert_inventory_failure() {
    local repo="$1"
    local expected_status="$2"
    local rule="$3"
    local path="$4"
    local raw_child_text="$5"
    shift 5
    local output runner status

    for runner in run_check_sdd run_check_sdd_explicit; do
        output="$(mktemp "$TMP_ROOT/check-sdd-inventory.XXXXXX")"
        if "$runner" "$repo" "$@" >"$output" 2>&1; then
            status=0
        else
            status=$?
        fi
        if [[ "$status" -ne "$expected_status" ]]; then
            echo "Expected inventory lint to exit $expected_status, got: $status" >&2
            cat "$output" >&2
            exit 1
        fi
        assert_contains "$output" "ERROR [$rule] $path:"
        case "$rule" in
            INVENTORY_FRESHNESS)
                assert_not_contains "$output" "INVENTORY_CHECK_CONFIG"
                ;;
            INVENTORY_CHECK_CONFIG)
                assert_not_contains "$output" "[INVENTORY_FRESHNESS]"
                ;;
        esac
        assert_not_contains "$output" "$raw_child_text"
        assert_not_contains "$output" "$INVENTORY_SENTINEL"
        assert_not_contains "$output" "INVENTORY_FRESHNESS_UNVERIFIED"
    done
}

test_check_sdd_passes_for_valid_repo() {
    local repo output
    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"

    run_check_sdd "$repo" 2>&1 | tee "$output"
    assert_contains "$output" "Project SDD lint: 0 error(s)"
}

test_check_sdd_uses_explicit_repo_root() {
    local caller repo output
    caller="$(make_sdd_repo)"
    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"
    sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/d' "$caller/specs/foundation/001-project-sdd-lint/spec.md"

    run_check_sdd_from "$caller" "$repo" >"$output" 2>&1
    assert_contains "$output" "Project SDD lint: 0 error(s)"
    assert_not_contains "$output" "SPEC_REQUIRED_HEADING"
}

test_check_sdd_rejects_empty_explicit_repo_root() {
    local outside output status
    outside="$(mktemp -d "$TMP_ROOT/check-sdd-outside.XXXXXX")"
    output="$(mktemp "$TMP_ROOT/check-sdd-empty-root.XXXXXX")"

    if (cd "$outside" && "$ROOT/scripts/check-sdd.sh" "") >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 2 ]]; then
        echo "Expected empty explicit repository root to exit 2, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "ERROR [SCANNER_CONFIG] .:"
    assert_not_contains "$output" "Project SDD lint: 0 error(s)"
    assert_not_contains "$output" "WARNING ["
}

test_check_sdd_fails_for_missing_goal_heading() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/d' "$repo/specs/foundation/001-project-sdd-lint/spec.md"

    assert_command_fails_with "$repo" 1 "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md"
}

test_check_sdd_fails_for_active_change_stage_drift() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/`in-progress`/`spec-ready`/' "$repo/specs/STATUS.md"

    assert_command_fails_with "$repo" 1 "ACTIVE_CHANGE_STAGE" "specs/STATUS.md"
}

test_check_sdd_fails_for_missing_source_id() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\nFR-999\n' >> "$repo/openspec/changes/project-sdd-lint/proposal.md"

    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/proposal.md"
}

append_added_requirements_delta() {
    local repo="$1"
    cat >> "$repo/openspec/changes/project-sdd-lint/specs/foundation/001-project-sdd-lint/spec.md" <<'DELTA'

## ADDED Requirements

### Requirement: FR-101 New governance rule

The checker reports the new rule.

#### Scenario: SC-101 AC-9.1 New rule is enforced
- **THEN** the checker reports the new rule
DELTA
}

test_check_sdd_accepts_ids_defined_by_added_requirements() {
    local repo
    repo="$(make_sdd_repo)"
    append_added_requirements_delta "$repo"
    printf '\nFR-101 AC-9.1\n' >> "$repo/openspec/changes/project-sdd-lint/proposal.md"
    cat >> "$repo/openspec/changes/project-sdd-lint/tasks.md" <<'TASKS'

## 2. New rule

**故事目標**：SC-101

- [ ] 2.1 Document the new rule in `docs/sdd-workflow.md`. [@main]
TASKS

    assert_command_succeeds "$repo"
}

test_check_sdd_fails_for_id_only_mentioned_in_added_body() {
    local repo
    repo="$(make_sdd_repo)"
    append_added_requirements_delta "$repo"
    printf '\nFR-102\n' >> "$repo/openspec/changes/project-sdd-lint/specs/foundation/001-project-sdd-lint/spec.md"

    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/specs/foundation/001-project-sdd-lint/spec.md"
}

test_check_sdd_accepts_cross_spec_citation_naming_the_source_spec() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n### FR-201\n' >> "$repo/specs/dataset/001-legacy/spec.md"
    printf '\nCross-spec contract: `dataset/001` FR-201.\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"

    assert_command_succeeds "$repo"
}

test_check_sdd_fails_for_cross_spec_citation_absent_from_the_named_spec() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\n### FR-201\n' >> "$repo/specs/dataset/001-legacy/spec.md"
    printf '\nCross-spec contract: `dataset/001` FR-202.\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"
    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/design.md"

    repo="$(make_sdd_repo)"
    printf '\n### FR-201\n' >> "$repo/specs/dataset/001-legacy/spec.md"
    printf '\nCross-spec contract: FR-201.\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"
    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/design.md"
}

test_check_sdd_fails_for_invalid_assignee() {
    local repo

    repo="$(make_sdd_repo)"
    sed -i.bak '/^\*\*故事目標\*\*/d' "$repo/openspec/changes/project-sdd-lint/tasks.md"
    assert_command_fails_with "$repo" 1 "TASK_STORY_GOAL" "openspec/changes/project-sdd-lint/tasks.md"

    repo="$(make_sdd_repo)"
    sed -i.bak 's/SC-001/SC-999/' "$repo/openspec/changes/project-sdd-lint/tasks.md"
    assert_command_fails_with "$repo" 1 "TASK_STORY_GOAL" "openspec/changes/project-sdd-lint/tasks.md"

    repo="$(make_sdd_repo)"
    sed -i.bak 's/\[@senior-qa\]/[@missing-agent]/' "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_ASSIGNEE" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_fails_for_incomplete_exception() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Scaffold. Exception: scaffold; Files: `scripts/a.sh`, `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_fails_for_wrong_red_owner() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/Red contract in `scripts\/speckit-tests.sh`. \[@senior-qa\]/Red contract in `scripts\/speckit-tests.sh`. [@senior-devops]/' "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_RED_OWNER" "openspec/changes/project-sdd-lint/tasks.md"

    repo="$(make_sdd_repo)"
    sed -i.bak 's/Green command in `scripts\/check-sdd.sh`. \[@senior-devops\]/Green command in `scripts\/check-sdd.sh`. [@senior-qa]/' "$repo/openspec/changes/project-sdd-lint/tasks.md"
    assert_command_fails_with "$repo" 1 "TASK_FILE_OWNER" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_fails_for_retired_command() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\nnpm test\n' >> "$repo/AGENTS.md"
    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"

    repo="$(make_sdd_repo)"
    printf '\nnpm run lint\n' >> "$repo/AGENTS.md"
    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"

    repo="$(make_sdd_repo)"
    printf '\n/ui-ux-pro-max\n' >> "$repo/AGENTS.md"
    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"

    repo="$(make_sdd_repo)"
    printf '\n/speckit.analyze\n' >> "$repo/AGENTS.md"
    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"
}

test_check_sdd_does_not_match_pnpm() {
    local repo output
    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"

    run_check_sdd "$repo" >"$output" 2>&1
    assert_contains "$output" "Project SDD lint: 0 error(s)"
}

test_check_sdd_accepts_exact_legacy_baseline() {
    local repo output
    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd.XXXXXX")"

    run_check_sdd "$repo" >"$output" 2>&1
    assert_contains "$output" "LEGACY_SPEC_HEADING"
}

test_check_sdd_fails_for_new_baseline_violation() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p "$repo/specs/dataset/002-new-debt"
    printf '# New legacy debt\n' > "$repo/specs/dataset/002-new-debt/spec.md"

    assert_command_fails_with "$repo" 1 "LEGACY_SPEC_HEADING" "specs/dataset/002-new-debt/spec.md"
}

test_check_sdd_fails_for_stale_baseline_entry() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak '1a\
## 功能目標\
\
Legacy goal.' "$repo/specs/dataset/001-legacy/spec.md"

    assert_command_fails_with "$repo" 1 "BASELINE_STALE" "scripts/sdd-lint-baseline.txt"
}

test_check_sdd_fails_for_duplicate_or_unsorted_baseline() {
    local repo
    repo="$(make_sdd_repo)"
    printf 'LEGACY_SPEC_HEADING\tspecs/dataset/001-legacy/spec.md\tmissing:## 功能目標\n' >> "$repo/scripts/sdd-lint-baseline.txt"
    assert_command_fails_with "$repo" 2 "BASELINE_FORMAT" "scripts/sdd-lint-baseline.txt"

    repo="$(make_sdd_repo)"
    mkdir -p "$repo/specs/dataset/000-earlier"
    printf '# Earlier legacy debt\n' > "$repo/specs/dataset/000-earlier/spec.md"
    printf 'LEGACY_SPEC_HEADING\tspecs/dataset/000-earlier/spec.md\tmissing:## 功能目標\n' >> "$repo/scripts/sdd-lint-baseline.txt"
    assert_command_fails_with "$repo" 2 "BASELINE_FORMAT" "scripts/sdd-lint-baseline.txt"
}

test_check_sdd_strict_promotes_baseline_debt() {
    local repo
    repo="$(make_sdd_repo)"

    assert_command_fails_with "$repo" 1 "LEGACY_SPEC_HEADING" "specs/dataset/001-legacy/spec.md" --strict
}

test_check_sdd_inventory_fresh_has_no_diagnostic() {
    local repo
    repo="$(make_sdd_repo)"

    assert_inventory_success "$repo"

    repo="$(make_sdd_repo)"
    sed -i.bak '1a\
## 功能目標\
\
Legacy goal.' "$repo/specs/dataset/001-legacy/spec.md"
    : > "$repo/scripts/sdd-lint-baseline.txt"
    assert_inventory_success "$repo" --strict
}

test_check_sdd_inventory_exact_stale_sentinel() {
    local repo

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" stale
    assert_inventory_failure "$repo" 1 "INVENTORY_FRESHNESS" "design/system/screen-inventory.md" "$INVENTORY_SENTINEL"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" stale
    assert_inventory_failure "$repo" 1 "INVENTORY_FRESHNESS" "design/system/screen-inventory.md" "$INVENTORY_SENTINEL" --strict
}

test_check_sdd_inventory_rejects_near_sentinels() {
    local repo

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" prefix
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_SENTINEL_PREFIX"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" suffix
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_SENTINEL_SUFFIX"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" extra-line
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_EXTRA_NONBLANK_LINE"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" sentinel-less
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_SENTINEL_LESS_EXIT_ONE"
}

test_check_sdd_inventory_configuration_failures() {
    local node_bin repo

    repo="$(make_sdd_repo)"
    mv "$repo/scripts/gen-screen-inventory.mjs" "$repo/scripts/gen-screen-inventory.mjs.missing"
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "MODULE_NOT_FOUND"

    repo="$(make_sdd_repo)"
    chmod 000 "$repo/scripts/gen-screen-inventory.mjs"
    if [ "$(id -u)" -eq 0 ]; then
        echo "SKIP: EACCES inventory-checker case cannot be exercised while running as root (root ignores chmod 000 read denial)." >&2
    else
        assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "EACCES"
    fi

    repo="$(make_sdd_repo)"
    cat > "$repo/scripts/gen-screen-inventory.mjs" <<'GENERATOR'
const RAW_UNLOADABLE_GENERATOR = ;
GENERATOR
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_UNLOADABLE_GENERATOR"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" unrunnable
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_GENERATOR_UNRUNNABLE"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" exit-two
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_GENERATOR_EXIT_TWO"

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" unexpected-exit
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_GENERATOR_UNEXPECTED_EXIT"

    repo="$(make_sdd_repo)"
    node_bin="$(mktemp -d "$TMP_ROOT/node-unavailable.XXXXXX")"
    cat > "$node_bin/node" <<'NODE'
#!/bin/sh
echo 'RAW_NODE_UNAVAILABLE' >&2
exit 127
NODE
    chmod +x "$node_bin/node"
    (
        PATH="$node_bin:$PATH"
        export PATH
        assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_NODE_UNAVAILABLE"
    )
}

test_check_sdd_inventory_strict_config_mapping_is_invariant() {
    local repo

    repo="$(make_sdd_repo)"
    set_inventory_generator_mode "$repo" exit-two
    assert_inventory_failure "$repo" 2 "INVENTORY_CHECK_CONFIG" "scripts/gen-screen-inventory.mjs" "RAW_GENERATOR_EXIT_TWO" --strict
}

test_check_sdd_inventory_uses_target_root_generator() {
    local caller output repo status
    caller="$(make_sdd_repo)"
    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd-inventory.XXXXXX")"
    set_inventory_generator_mode "$caller" caller-decoy

    if run_check_sdd_from "$caller" "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]]; then
        echo "Expected explicit target-root inventory lint to exit 0, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "Project SDD lint: 0 error(s)"
    assert_not_contains "$output" "INVENTORY_FRESHNESS]"
    assert_not_contains "$output" "INVENTORY_CHECK_CONFIG"
    assert_not_contains "$output" "INVENTORY_FRESHNESS_UNVERIFIED"
    assert_not_contains "$output" "RAW_CALLER_GENERATOR_USED"
    assert_not_contains "$output" "RAW_FRESH_CHILD_OUTPUT"
}

test_check_sdd_rejects_foreign_root_generator_without_side_effects() {
    local marker output repo status
    repo="$(make_sdd_repo)"
    marker="$TMP_ROOT/foreign-root-generator.marker"
    output="$(mktemp "$TMP_ROOT/check-sdd-foreign-root.XXXXXX")"

    cat > "$repo/scripts/gen-screen-inventory.mjs" <<'GENERATOR'
import fs from 'node:fs';

const marker = process.env.SDD_FOREIGN_ROOT_MARKER;
if (!marker) {
  process.stderr.write('RAW_HOSTILE_FOREIGN_GENERATOR_MISSING_MARKER\n');
  process.exit(9);
}

fs.writeFileSync(marker, 'foreign generator executed\n');
process.stdout.write('RAW_HOSTILE_FOREIGN_GENERATOR_OUTPUT\n');
process.exit(0);
GENERATOR

    if SDD_FOREIGN_ROOT_MARKER="$marker" "$ROOT/scripts/check-sdd.sh" "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ -e "$marker" ]]; then
        echo "Expected foreign-root inventory generator not to create a marker" >&2
        cat "$output" >&2
        exit 1
    fi
    if [[ "$status" -ne 2 ]]; then
        echo "Expected foreign-root inventory lint to exit 2, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "ERROR [INVENTORY_CHECK_CONFIG] scripts/gen-screen-inventory.mjs:"
    assert_not_contains "$output" "RAW_HOSTILE_FOREIGN_GENERATOR_OUTPUT"
    assert_not_contains "$output" "RAW_HOSTILE_FOREIGN_GENERATOR_MISSING_MARKER"
    assert_contains "$output" "Project SDD lint: 1 error(s), 3 warning(s)"
}

record_control_path_mismatch() {
    local mismatches="$1"
    local label="$2"
    local message="$3"

    printf 'RED [%s]: %s\n' "$label" "$message" >> "$mismatches"
}

check_control_path_rejection() {
    local label="$1"
    local repo="$2"
    local marker="$3"
    local unsafe_control="$4"
    local results="$5"
    local mismatches="$6"
    local diagnostic='ERROR [SCANNER_CONFIG] .: repository paths containing control characters are unsupported'
    local control_echo='not-applicable' diagnostic_seen='no' error_count marker_echo='no' output status summary

    output="$(mktemp "$TMP_ROOT/check-sdd-control-path.XXXXXX")"
    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi

    if grep -Fq "$diagnostic" "$output"; then
        diagnostic_seen='yes'
    fi
    if grep -Fq "$marker" "$output"; then
        marker_echo='yes'
    fi
    if [[ -n "$unsafe_control" ]]; then
        control_echo='no'
        if grep -Fq "$unsafe_control" "$output"; then
            control_echo='yes'
        fi
    fi
    error_count="$(grep -Fc 'ERROR [' "$output" || true)"
    summary="$(grep -F 'Project SDD lint:' "$output" | tail -n 1 || true)"
    printf 'Control-path row %s: status=%s diagnostic=%s marker_echo=%s control_echo=%s summary=%s\n' \
        "$label" "$status" "$diagnostic_seen" "$marker_echo" "$control_echo" "${summary:-missing}" >> "$results"

    if [[ "$status" -ne 2 ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            "expected exit 2, observed $status (control-character preflight absent or bypassed)"
    fi
    if [[ "$diagnostic_seen" != 'yes' ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            'missing exact SCANNER_CONFIG diagnostic at safe path .'
    fi
    if [[ "$marker_echo" != 'no' ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            "unsafe pathname marker was rendered: $marker"
    fi
    if [[ "$control_echo" == 'yes' ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            'raw filename control character was rendered'
    fi
    if [[ "$error_count" -ne 1 ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            "expected one scanner-configuration error, observed $error_count error diagnostics"
    fi
    if grep -Fq 'ERROR [RETIRED_COMMAND]' "$output"; then
        record_control_path_mismatch "$mismatches" "$label" \
            'retired-guidance collector consumed the unsafe pathname before rejection'
    fi
    if [[ "$summary" != 'Project SDD lint: 1 error(s), 0 warning(s)' ]]; then
        record_control_path_mismatch "$mismatches" "$label" \
            "summary did not prove rejection before downstream collectors: ${summary:-missing}"
    fi
}

check_normal_space_path_control() {
    local repo="$1"
    local results="$2"
    local mismatches="$3"
    local output status summary

    output="$(mktemp "$TMP_ROOT/check-sdd-space-path.XXXXXX")"
    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    summary="$(grep -F 'Project SDD lint:' "$output" | tail -n 1 || true)"
    printf 'Control-path row ordinary-space: status=%s diagnostic=%s summary=%s\n' \
        "$status" "$(grep -Fq 'SCANNER_CONFIG' "$output" && printf yes || printf no)" "${summary:-missing}" >> "$results"

    if [[ "$status" -ne 0 ]]; then
        record_control_path_mismatch "$mismatches" ordinary-space \
            "expected exit 0 for an ordinary-space pathname, observed $status"
    fi
    if grep -Fq 'SCANNER_CONFIG' "$output"; then
        record_control_path_mismatch "$mismatches" ordinary-space \
            'ordinary-space pathname was rejected as scanner configuration'
    fi
    if [[ "$summary" != 'Project SDD lint: 0 error(s), 3 warning(s)' ]]; then
        record_control_path_mismatch "$mismatches" ordinary-space \
            "ordinary Project SDD lint summary changed: ${summary:-missing}"
    fi
}

test_check_sdd_rejects_control_character_paths_before_scanning() {
    local change_dir mismatches normal_path repo results spec_dir symlink_target unsafe_path
    results="$(mktemp "$TMP_ROOT/control-path-results.XXXXXX")"
    mismatches="$(mktemp "$TMP_ROOT/control-path-mismatches.XXXXXX")"

    repo="$(make_sdd_repo)"
    unsafe_path="$repo/.claude/agents/CONTROL_CONSUMER_NEWLINE_MARKER"$'\n'"guidance.md"
    printf '# Unsafe consumer\n\nRun npm test before review.\n' > "$unsafe_path"
    check_control_path_rejection consumer-newline "$repo" CONTROL_CONSUMER_NEWLINE_MARKER '' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    unsafe_path="$repo/.claude/agents/CONTROL_CONSUMER_TAB_MARKER"$'\t'"guidance.md"
    printf '# Unsafe consumer\n\nRun npm test before review.\n' > "$unsafe_path"
    check_control_path_rejection consumer-tab "$repo" CONTROL_CONSUMER_TAB_MARKER $'\t' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    unsafe_path="$repo/.claude/agents/CONTROL_CONSUMER_CR_MARKER"$'\r'"guidance.md"
    printf '# Unsafe consumer\n\nRun npm test before review.\n' > "$unsafe_path"
    check_control_path_rejection consumer-carriage-return "$repo" CONTROL_CONSUMER_CR_MARKER $'\r' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    spec_dir="002-CONTROL_SPEC_NEWLINE_MARKER"$'\n'"feature"
    mkdir -p "$repo/specs/dataset/$spec_dir"
    cat > "$repo/specs/dataset/$spec_dir/spec.md" <<'SPEC'
# Unsafe canonical spec path fixture

## 功能目標

Exercise canonical spec discovery.

## 規格相依性

None.

### FR-001
### SC-001
### AC-1.1
SPEC
    printf '| dataset-002 | Unsafe path fixture | dataset | `spec-ready` | `feat/dataset/002-path-fixture` | fixture |\n' >> "$repo/specs/STATUS.md"
    check_control_path_rejection canonical-spec-newline "$repo" CONTROL_SPEC_NEWLINE_MARKER '' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    change_dir="CONTROL_CHANGE_NEWLINE_MARKER"$'\n'"change"
    cp -R "$repo/openspec/changes/project-sdd-lint" "$repo/openspec/changes/$change_dir"
    check_control_path_rejection active-change-newline "$repo" CONTROL_CHANGE_NEWLINE_MARKER '' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    symlink_target="$repo/symlink-targets/active-change"
    mkdir -p "$repo/symlink-targets"
    cp -R "$repo/openspec/changes/project-sdd-lint" "$symlink_target"
    spec_dir="CONTROL_SYMLINK_DESCENDANT_MARKER"$'\n'"view"
    mkdir -p "$symlink_target/specs/foundation/$spec_dir"
    printf 'FR-999\n' > "$symlink_target/specs/foundation/$spec_dir/spec.md"
    ln -s ../../symlink-targets/active-change "$repo/openspec/changes/safe-symlink-change"
    check_control_path_rejection active-change-symlink-newline-descendant "$repo" CONTROL_SYMLINK_DESCENDANT_MARKER '' "$results" "$mismatches"

    repo="$(make_sdd_repo)"
    normal_path="$repo/.claude/agents/ordinary space guidance.md"
    printf '# Ordinary consumer\n\nUse pnpm test for checks.\n' > "$normal_path"
    check_normal_space_path_control "$repo" "$results" "$mismatches"

    cat "$results" >&2
    if [[ -s "$mismatches" ]]; then
        cat "$mismatches" >&2
        return 1
    fi
}

test_check_sdd_fails_for_near_match_goal_heading() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/^## 功能目標$/## 功能目標（錯誤）/' "$repo/specs/foundation/001-project-sdd-lint/spec.md"

    assert_command_fails_with "$repo" 1 "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md"
}

test_check_sdd_fails_for_malformed_baseline_rows() {
    local baseline_content repo

    repo="$(make_sdd_repo)"
    baseline_content="$(cat "$repo/scripts/sdd-lint-baseline.txt")"
    printf '\n%s\n' "$baseline_content" > "$repo/scripts/sdd-lint-baseline.txt"
    assert_command_fails_with "$repo" 2 "BASELINE_FORMAT" "scripts/sdd-lint-baseline.txt"

    repo="$(make_sdd_repo)"
    printf 'LEGACY_SPEC_HEADING\tspecs/dataset/001-legacy/spec.md\tmissing:## 功能目標\t\n' > "$repo/scripts/sdd-lint-baseline.txt"
    assert_command_fails_with "$repo" 2 "BASELINE_FORMAT" "scripts/sdd-lint-baseline.txt"
}

test_check_sdd_fails_for_explicit_multi_file_task() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Modify `scripts/a.sh` and `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md"

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Modify `scripts/a.sh`，then modify `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_accepts_english_negative_task_clauses() {
    local output repo status

    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd-negative-task.XXXXXX")"
    printf '\n- [ ] 1.3 Modify `scripts/a.sh`，do not modify `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]]; then
        echo "Expected do-not-modify task lint to exit 0, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "Project SDD lint: 0 error(s), 3 warning(s)"
    assert_not_contains "$output" "TASK_EXCEPTION"

    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd-negative-task.XXXXXX")"
    printf '\n- [ ] 1.3 Modify `scripts/a.sh`；must not modify `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    if run_check_sdd "$repo" >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]]; then
        echo "Expected must-not-modify task lint to exit 0, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "Project SDD lint: 0 error(s), 3 warning(s)"
    assert_not_contains "$output" "TASK_EXCEPTION"
}

test_check_sdd_extracts_chinese_task_clauses_in_byte_locale() {
    local output repo status

    repo="$(make_sdd_repo)"
    output="$(mktemp "$TMP_ROOT/check-sdd-byte-locale.XXXXXX")"
    printf '\n- [ ] 1.3 撰寫 Red 測試覆蓋推導（`scripts/extra-tests.sh`）：三態尚未支援。驗證：預期全數失敗 [@senior-qa]\n- [ ] 1.4 （Green）修改 `scripts/extra-tests.sh` 使測試轉綠 [@senior-qa]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    # LC_ALL=C is the only locale guaranteed on both macOS and Ubuntu, and it is
    # the byte-oriented worst case: clause extraction must not depend on the awk
    # implementation resolving full-width separators as single characters.
    if (export LC_ALL=C; run_check_sdd "$repo") >"$output" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne 0 ]]; then
        echo "Expected Chinese task clause lint under LC_ALL=C to exit 0, got: $status" >&2
        cat "$output" >&2
        exit 1
    fi
    assert_contains "$output" "Project SDD lint: 0 error(s)"
    assert_not_contains "$output" "ERROR [TASK_RED_OWNER]"
    assert_not_contains "$output" "WARNING [TASK_FILE_COUNT_REVIEW]"
}

test_check_sdd_fails_without_exact_spec_declaration() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/^對應 Spec:/Canonical mention:/' "$repo/openspec/changes/project-sdd-lint/proposal.md"

    assert_command_fails_with "$repo" 1 "ACTIVE_CHANGE_SPEC" "openspec/changes/project-sdd-lint/proposal.md"
}

test_check_sdd_fails_for_status_module_mismatch() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/| foundation-001 | Project SDD lint | foundation |/| foundation-001 | Project SDD lint | dataset |/' "$repo/specs/STATUS.md"

    assert_command_fails_with "$repo" 1 "STATUS_ARTIFACT_SYNC" "specs/STATUS.md"
}

test_check_sdd_accepts_archived_canonical_spec_location() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p "$repo/specs/_archive/002-finished"
    cat > "$repo/specs/_archive/002-finished/spec.md" <<'SPEC'
# Archived dataset fixture

## 功能目標

Preserve a completed dataset feature contract.

## 規格相依性

None.

### FR-001
### SC-001
### AC-1.1
SPEC
    printf '| dataset-002 | Finished dataset feature | dataset | `archived` | `main` | fixture |\n' >> "$repo/specs/STATUS.md"

    assert_command_succeeds "$repo" --not-rule STATUS_ARTIFACT_SYNC
}

test_check_sdd_fails_when_archived_status_has_active_canonical_duplicate() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p \
        "$repo/specs/_archive/002-finished" \
        "$repo/specs/dataset/002-active-copy"
    cat > "$repo/specs/_archive/002-finished/spec.md" <<'SPEC'
# Archived dataset fixture

## 功能目標

Preserve the completed dataset feature contract.

## 規格相依性

None.

### FR-001
### SC-001
### AC-1.1
SPEC
    cat > "$repo/specs/dataset/002-active-copy/spec.md" <<'SPEC'
# Stale active dataset copy

## 功能目標

Expose a stale active copy of an archived feature.

## 規格相依性

None.

### FR-001
### SC-001
### AC-1.1
SPEC
    printf '| dataset-002 | Finished dataset feature | dataset | `archived` | `main` | fixture |\n' >> "$repo/specs/STATUS.md"

    assert_command_fails_with "$repo" 1 "STATUS_ARTIFACT_SYNC" "specs/dataset/002-active-copy/spec.md"
}

test_check_sdd_fails_for_spec_ready_spec_without_required_ids() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p "$repo/specs/dataset/002-new-feature"
    cat > "$repo/specs/dataset/002-new-feature/spec.md" <<'SPEC'
# New dataset feature

## 功能目標

Define a new dataset behavior before proposal.

## 規格相依性

None.
SPEC
    printf '| dataset-002 | New dataset feature | dataset | `spec-ready` | `feat/dataset/002-new-feature` | fixture |\n' >> "$repo/specs/STATUS.md"

    assert_command_fails_with "$repo" 1 "SPEC_REQUIRED_IDS" "specs/dataset/002-new-feature/spec.md"
}

test_check_sdd_fails_for_spec_ready_near_match_goal_heading_without_ids() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p "$repo/specs/dataset/002-near-match-heading"
    cat > "$repo/specs/dataset/002-near-match-heading/spec.md" <<'SPEC'
# New dataset feature with a near-match heading

## 功能目標 BAD

Define a new dataset behavior before proposal.

## 規格相依性

None.
SPEC
    printf '| dataset-002 | Near-match dataset feature | dataset | `spec-ready` | `feat/dataset/002-near-match-heading` | fixture |\n' >> "$repo/specs/STATUS.md"

    assert_command_fails_with "$repo" 1 "SPEC_REQUIRED_HEADING" "specs/dataset/002-near-match-heading/spec.md"
}

test_check_sdd_rejects_arbitrary_dependency_heading_suffix() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/^## 規格相依性$/## 規格相依性 BAD/' "$repo/specs/foundation/001-project-sdd-lint/spec.md"

    assert_command_fails_with "$repo" 1 "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md" --not-rule SPEC_REQUIRED_IDS
}

test_check_sdd_accepts_approved_dependency_heading_suffix() {
    local repo
    repo="$(make_sdd_repo)"
    sed -i.bak 's/^## 規格相依性$/## 規格相依性 *(本功能依賴其他規格，或被其他規格依賴時填寫)*/' "$repo/specs/foundation/001-project-sdd-lint/spec.md"

    assert_command_succeeds "$repo"
}

test_check_sdd_rejects_suffixed_source_verify_id() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n### FR-013A\n' >> "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    printf '\nFR-013B\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"

    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/design.md" --not-rule SPEC_REQUIRED_IDS
}

test_check_sdd_requires_exact_multisegment_source_verify_ids() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\n### AC-1.1.9\n' >> "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    printf '\nAC-1.1.9\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"

    assert_command_succeeds "$repo"

    repo="$(make_sdd_repo)"
    printf '\nAC-1.1.9\n' >> "$repo/openspec/changes/project-sdd-lint/design.md"

    assert_command_fails_with "$repo" 1 "SOURCE_VERIFY_ID" "openspec/changes/project-sdd-lint/design.md"
}

test_check_sdd_requires_one_unconsumed_red_per_green() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Red contract in `scripts/second-tests.sh`. [@senior-qa]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"
    printf -- '- [ ] 1.4 Green command in `scripts/second.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo"

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Green command in `scripts/second.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_RED_OWNER" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_rejects_prescriptive_example_retired_command() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\nHistorical retired example，例如 do not run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_succeeds "$repo" --not-rule RETIRED_COMMAND

    repo="$(make_sdd_repo)"
    printf '\nFor active checks，例如 run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"
}

test_check_sdd_scans_symlinked_active_change_consumers() {
    local change_target repo

    repo="$(make_sdd_repo)"
    change_target="$repo/openspec/project-sdd-lint-target"
    mv "$repo/openspec/changes/project-sdd-lint" "$change_target"
    ln -s ../project-sdd-lint-target "$repo/openspec/changes/project-sdd-lint"

    assert_command_succeeds "$repo"

    printf '\nRun npm run lint before applying.\n' >> "$change_target/design.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "openspec/changes/project-sdd-lint/design.md"
}

test_check_sdd_does_not_consume_red_mentioning_paired_green() {
    local repo

    repo="$(make_sdd_repo)"
    sed -i.bak 's/Red contract in `scripts\/speckit-tests.sh`/Red contract before paired Green in `scripts\/speckit-tests.sh`/' "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo" --not-rule TASK_RED_OWNER
}

test_check_sdd_rejects_nonhistorical_active_retired_command() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\nThis is non-historical active guidance: run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"
}

test_check_sdd_requires_explicit_retired_command_context() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\nThis command is retired; do not run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_succeeds "$repo" --not-rule RETIRED_COMMAND

    repo="$(make_sdd_repo)"
    printf '\nThis command is not retired: run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"

    repo="$(make_sdd_repo)"
    printf '\nFor changelog validation, run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"
}

test_check_sdd_classifies_retired_commands_per_clause() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test before review.\n' >> "$repo/AGENTS.md"

    assert_command_succeeds "$repo" --not-rule RETIRED_COMMAND

    repo="$(make_sdd_repo)"
    printf '\n禁止執行 npm test。\n' >> "$repo/AGENTS.md"

    assert_command_succeeds "$repo" --not-rule RETIRED_COMMAND

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test in CI; run npm test locally.\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"

    repo="$(make_sdd_repo)"
    printf '\n這不是歷史範例，請執行 npm test。\n' >> "$repo/AGENTS.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "AGENTS.md"
}

test_check_sdd_scans_symlinked_agents_consumers() {
    local agents_target repo

    repo="$(make_sdd_repo)"
    agents_target="$repo/.claude/agents-target"
    mv "$repo/.claude/agents" "$agents_target"
    ln -s agents-target "$repo/.claude/agents"

    assert_command_succeeds "$repo"

    printf '\nRun npm test before review.\n' >> "$agents_target/senior-qa.md"

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" ".claude/agents/senior-qa.md"
}

test_check_sdd_rejects_control_character_descendant_in_symlinked_agents_root() {
    local agents_target repo unsafe_path

    repo="$(make_sdd_repo)"
    agents_target="$repo/.claude/agents-target"
    mv "$repo/.claude/agents" "$agents_target"
    ln -s agents-target "$repo/.claude/agents"
    unsafe_path="$agents_target/CONTROL_SYMLINKED_AGENTS_NEWLINE_MARKER"$'\n'"guidance.md"
    printf '# Unsafe linked guidance\n\nRun npm test before review.\n' > "$unsafe_path"

    assert_command_fails_with "$repo" 2 "SCANNER_CONFIG" "."
}

test_check_sdd_uses_parsed_action_artifacts_for_task_ownership() {
    local repo

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Modify `scripts/owned.sh`. [@main]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_FILE_OWNER" "openspec/changes/project-sdd-lint/tasks.md"

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Run `bash -n`; modify `scripts/owned.sh`. [@main]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_FILE_OWNER" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_requires_all_red_tasks_paired_before_eof() {
    local repo

    repo="$(make_sdd_repo)"
    assert_command_succeeds "$repo"

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Red contract in `scripts/second-tests.sh`. [@senior-qa]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"
    printf -- '- [ ] 1.4 Green command in `scripts/second.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo"

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Red contract in `scripts/unpaired-tests.sh`. [@senior-qa]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_RED_OWNER" "openspec/changes/project-sdd-lint/tasks.md"
}

test_check_sdd_rejects_retired_command_in_active_openspec_config() {
    local repo
    repo="$(make_sdd_repo)"
    cat >> "$repo/openspec/config.yaml" <<'CONFIG'
    - >-
      Run npm run lint before applying active task guidance.
CONFIG

    assert_command_fails_with "$repo" 1 "RETIRED_COMMAND" "openspec/config.yaml"
}

test_check_sdd_excludes_deprecated_task_template_retired_wording() {
    local repo
    repo="$(make_sdd_repo)"
    mkdir -p "$repo/.specify/templates"
    cat > "$repo/.specify/templates/tasks-template.md" <<'TEMPLATE'
> Deprecated historical, non-normative task template.

Run npm test before verification.
TEMPLATE

    assert_command_succeeds "$repo" --not-rule RETIRED_COMMAND
}

test_check_sdd_rejects_nonpath_exception_files_value() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Scaffold outputs. Exception: scaffold; Files: not-a-path; Reason: Bootstrap requires both files. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md" --not-rule TASK_FILE_OWNER
}

test_check_sdd_rejects_partial_exception_files_list() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Scaffold `scripts/a.sh` and `scripts/b.sh`. Exception: scaffold; Files: `scripts/a.sh`; Reason: Bootstrap requires both files. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md" --not-rule TASK_FILE_OWNER
}

test_check_sdd_accepts_complete_exception_files_list() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Scaffold `scripts/a.sh` and `scripts/b.sh`. Exception: scaffold; Files: `scripts/a.sh`, `scripts/b.sh`; Reason: Bootstrap requires both files. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo"
}

test_check_sdd_accepts_complete_exception_with_root_extensionless_path() {
    local repo
    repo="$(make_sdd_repo)"
    printf 'Synthetic license fixture.\n' > "$repo/LICENSE"
    printf '#!/bin/sh\n' > "$repo/scripts/a.sh"
    printf 'none\tscaffold fixture; not a gate\ta.sh\n' >> "$repo/scripts/ci-jobs.tsv"
    git -C "$repo" init -q
    git -C "$repo" add LICENSE scripts/a.sh
    printf '\n- [ ] 1.3 Scaffold `LICENSE` and `scripts/a.sh`. Exception: scaffold; Files: `LICENSE`, `scripts/a.sh`; Reason: Bootstrap requires both files. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo" --not-rule TASK_EXCEPTION
}

test_check_sdd_ignores_backticked_identifier_in_exception_outputs() {
    local repo
    repo="$(make_sdd_repo)"
    printf 'Synthetic license fixture.\n' > "$repo/LICENSE"
    printf '#!/bin/sh\n' > "$repo/scripts/a.sh"
    printf 'none\tscaffold fixture; not a gate\ta.sh\n' >> "$repo/scripts/ci-jobs.tsv"
    git -C "$repo" init -q
    git -C "$repo" add LICENSE scripts/a.sh
    printf '\n- [ ] 1.4 Scaffold output `LICENSE` with identifier `MIT` and output `scripts/a.sh`. Exception: scaffold; Files: `LICENSE`, `scripts/a.sh`; Reason: Bootstrap requires both artifacts. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo" --not-rule TASK_EXCEPTION
}

test_check_sdd_rejects_non_shell_red_task_with_non_qa_owner() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Red backend regression in `backend/tests/test_sdd_lint.py`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_fails_with "$repo" 1 "TASK_RED_OWNER" "openspec/changes/project-sdd-lint/tasks.md" --not-rule TASK_FILE_OWNER
}

test_check_sdd_accepts_non_shell_red_task_with_qa_owner() {
    local repo
    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Red backend regression in `backend/tests/test_sdd_lint.py`. [@senior-qa]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"
    printf -- '- [ ] 1.4 Green backend implementation in `backend/app/sdd_lint.py`. [@main]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"

    assert_command_succeeds "$repo"
}

test_check_sdd_ci_checkout_fetches_full_history() {
    local ci failures job
    failures=0
    ci="$ROOT/.github/workflows/ci.yml"

    if ! assert_independent_sdd_lint_job "$ci"; then
        echo "CONTROL_FAILURE [ci-full-history] sdd-lint must remain an independent checkout-and-lint job" >&2
        failures=$((failures + 1))
    fi
    job="$(extract_top_level_sdd_lint_job "$ci")"
    if ! sdd_lint_checkout_has_full_history "$job"; then
        echo "RED_MISS [ci-full-history] actions/checkout@v5 must set fetch-depth: 0 on its checkout step" >&2
        failures=$((failures + 1))
    fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_rejects_punctuated_retired_commands() {
    local failures repo
    failures=0

    repo="$(make_sdd_repo)"
    printf '\nRun npm test.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-period" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun `npm test`.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-backtick" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test before review. Run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-mixed-sentence" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-negative-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun pnpm test.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-pnpm-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_ignores_fenced_governance_spoofs() {
    local failures repo
    failures=0

    repo="$(make_sdd_repo)"
    sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/ {
        /^## 規格相依性$/!d
    }' "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    cat >> "$repo/specs/foundation/001-project-sdd-lint/spec.md" <<'SPEC_FENCE'

```markdown
## 功能目標

This fenced example is not a canonical section.
```
SPEC_FENCE
    if ! record_expected_lint_failure "fenced-required-heading" "$repo" "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    sed -i.bak '/^| foundation-001 |/d' "$repo/specs/STATUS.md"
    cat >> "$repo/specs/STATUS.md" <<'STATUS_FENCE'

```markdown
| foundation-001 | Project SDD lint | foundation | `in-progress` | `feat/project-sdd-lint` | fenced spoof |
```
STATUS_FENCE
    if ! record_expected_lint_failure "fenced-status-row" "$repo" "STATUS_ARTIFACT_SYNC" "specs/foundation/001-project-sdd-lint/spec.md"; then failures=$((failures + 1)); fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_rejects_positive_actions_around_negative_clause() {
    local failures repo
    failures=0

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Modify `scripts/a.sh`, do not modify `scripts/b.sh`; modify `scripts/c.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"
    if ! record_expected_lint_failure "mixed-task-action" "$repo" "TASK_EXCEPTION" "openspec/changes/project-sdd-lint/tasks.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\n- [ ] 1.3 Do not modify `scripts/b.sh`. [@senior-devops]\n' >> "$repo/openspec/changes/project-sdd-lint/tasks.md"
    if ! record_expected_lint_success "negative-task-action-control" "$repo" "TASK_EXCEPTION"; then failures=$((failures + 1)); fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_rejects_remaining_retired_punctuation_boundaries() {
    local failures repo
    failures=0

    repo="$(make_sdd_repo)"
    printf '\nRun npm test:\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-colon" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun (npm test) before review.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-parenthesis" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test! Run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-exclamation-clause" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test, run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-comma-clause" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test!\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-exclamation-negative-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test! Do not run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-two-prohibitions-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun pnpm test: before review.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-pnpm-punctuation-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun npm testing: before review.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-token-boundary-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun npm test;echo done.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-semicolon-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun npm test&&echo done.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-shell-and-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun (npm test)before review.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-parenthesis-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test,run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-comma-clause-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun pnpm test;echo done.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-pnpm-no-space-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test,do not run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-two-prohibitions-no-space-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test.Run npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-period-clause-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run npm test.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-period-negative-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun npm test locally.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-standalone-active-control" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun /speckit.analyze now.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-speckit-dotted-control" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run /speckit.analyze.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-speckit-negative-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run /speckit.analyze.Run /speckit.analyze now.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-speckit-mixed-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run /ui-ux-pro-max.Run /ui-ux-pro-max now.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-uiux-mixed-no-space" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nRun /ui-ux-pro-max now.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_failure "retired-uiux-active-control" "$repo" "RETIRED_COMMAND" "AGENTS.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nDo not run /ui-ux-pro-max.\n' >> "$repo/AGENTS.md"
    if ! record_expected_lint_success "retired-uiux-negative-control" "$repo" "RETIRED_COMMAND"; then failures=$((failures + 1)); fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_respects_commonmark_fence_indentation() {
    local closer_indent failures repo
    failures=0

    repo="$(make_sdd_repo)"
    sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/ {
        /^## 規格相依性$/!d
    }' "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    cat >> "$repo/specs/foundation/001-project-sdd-lint/spec.md" <<'BACKTICK_FALSE_CLOSER'

```markdown
    ```
## 功能目標

This heading remains inside the valid CommonMark fence.
```
BACKTICK_FALSE_CLOSER
    if ! record_expected_lint_failure "commonmark-backtick-false-closer" "$repo" "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/ {
        /^## 規格相依性$/!d
    }' "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    cat >> "$repo/specs/foundation/001-project-sdd-lint/spec.md" <<'TILDE_FALSE_CLOSER'

~~~markdown
    ~~~
## 功能目標

This heading remains inside the valid CommonMark fence.
~~~
TILDE_FALSE_CLOSER
    if ! record_expected_lint_failure "commonmark-tilde-false-closer" "$repo" "SPEC_REQUIRED_HEADING" "specs/foundation/001-project-sdd-lint/spec.md"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    sed -i.bak '/^| foundation-001 |/d' "$repo/specs/STATUS.md"
    cat >> "$repo/specs/STATUS.md" <<'STATUS_FALSE_CLOSER'

```markdown
    ```
| foundation-001 | Project SDD lint | foundation | `in-progress` | `feat/project-sdd-lint` | fenced spoof |
```
STATUS_FALSE_CLOSER
    if ! record_expected_lint_failure "commonmark-status-false-closer" "$repo" "STATUS_ARTIFACT_SYNC" "specs/foundation/001-project-sdd-lint/spec.md"; then failures=$((failures + 1)); fi

    for closer_indent in '' ' ' '  ' '   '; do
        repo="$(make_sdd_repo)"
        sed -i.bak '/^## 功能目標$/,/^## 規格相依性$/ {
            /^## 規格相依性$/!d
        }' "$repo/specs/foundation/001-project-sdd-lint/spec.md"
        printf '\n```markdown\nExample content.\n%s```\n## 功能目標\n\nThis is the real canonical goal.\n' "$closer_indent" >> "$repo/specs/foundation/001-project-sdd-lint/spec.md"
        if ! record_expected_lint_success "commonmark-valid-backtick-closer-${#closer_indent}" "$repo" "SPEC_REQUIRED_HEADING"; then failures=$((failures + 1)); fi
    done

    repo="$(make_sdd_repo)"
    sed -i.bak '/^| foundation-001 |/d' "$repo/specs/STATUS.md"
    cat >> "$repo/specs/STATUS.md" <<'STATUS_VALID_CLOSER'

~~~markdown
Example content.
  ~~~
| foundation-001 | Project SDD lint | foundation | `in-progress` | `feat/project-sdd-lint` | real row |
STATUS_VALID_CLOSER
    if ! record_expected_lint_success "commonmark-valid-status-closer" "$repo" "STATUS_ARTIFACT_SYNC"; then failures=$((failures + 1)); fi

    repo="$(make_sdd_repo)"
    printf '\nOrdinary prose may mention ``` without opening a fenced block.\n' >> "$repo/specs/foundation/001-project-sdd-lint/spec.md"
    if ! record_expected_lint_success "commonmark-inline-marker-control" "$repo" "SPEC_REQUIRED_HEADING"; then failures=$((failures + 1)); fi

    [[ "$failures" -eq 0 ]]
}

test_check_sdd_collects_final_review_high_regressions() {
    local failures family output status
    failures=0

    for family in \
        test_check_sdd_ci_checkout_fetches_full_history \
        test_check_sdd_rejects_punctuated_retired_commands \
        test_check_sdd_ignores_fenced_governance_spoofs \
        test_check_sdd_rejects_positive_actions_around_negative_clause \
        test_check_sdd_rejects_remaining_retired_punctuation_boundaries \
        test_check_sdd_respects_commonmark_fence_indentation
    do
        output="$(mktemp "$TMP_ROOT/final-review-high-family.XXXXXX")"
        if "$family" >"$output" 2>&1; then
            status=0
        else
            status=$?
        fi
        if [[ "$status" -ne 0 ]]; then
            echo "FINAL_REVIEW_HIGH_FAMILY_MISS [$family]" >&2
            cat "$output" >&2
            failures=$((failures + 1))
        fi
    done

    if [[ "$failures" -ne 0 ]]; then
        echo "Expected all final-review High regressions to pass; observed $failures family miss(es)" >&2
        return 1
    fi
}

test_prerequisites_resolve_module_feature_paths
test_create_feature_creates_module_branch_spec_and_status
test_setup_plan_and_status_update
# --- issue #648: two-way parity between local verification suites and CI jobs ---
# CLAUDE.md states the contract in prose; scripts/ci-jobs.tsv is the machine-readable
# declaration both directions are checked against. Every script under scripts/ must be
# declared (with a CI job, or as an explicitly reasoned exemption), and every job in
# ci.yml must name a local command that CLAUDE.md actually lists.

test_check_sdd_fails_for_verification_suite_without_ci_job() {
    local repo

    repo="$(make_sdd_repo)"
    printf '#!/usr/bin/env bash\nexit 0\n' > "$repo/scripts/orphan-tests.sh"
    assert_command_fails_with "$repo" 1 "CI_JOB_PARITY" "scripts/orphan-tests.sh"
}

test_check_sdd_fails_for_ci_job_without_local_command() {
    local repo

    repo="$(make_sdd_repo)"
    cat >> "$repo/.github/workflows/ci.yml" <<'JOB'
  orphan-job:
    name: Orphan
    runs-on: ubuntu-24.04
    steps:
      - run: scripts/nowhere.sh
JOB
    assert_command_fails_with "$repo" 1 "CI_JOB_PARITY" ".github/workflows/ci.yml"
}

test_check_sdd_fails_for_registry_job_absent_from_ci() {
    local repo

    repo="$(make_sdd_repo)"
    printf 'ghost-job\tscripts/check-sdd.sh\t-\n' >> "$repo/scripts/ci-jobs.tsv"
    assert_command_fails_with "$repo" 1 "CI_JOB_PARITY" "scripts/ci-jobs.tsv"
}

test_check_sdd_fails_for_local_command_absent_from_claude_md() {
    local repo

    repo="$(make_sdd_repo)"
    printf 'sdd-lint\tscripts/unlisted.sh\tcheck-sdd.sh\n' > "$repo/scripts/ci-jobs.tsv"
    printf 'sdd-lint\tscripts/unlisted.sh\tgen-screen-inventory.mjs\n' >> "$repo/scripts/ci-jobs.tsv"
    assert_command_fails_with "$repo" 1 "CI_JOB_PARITY" "scripts/ci-jobs.tsv"
}

test_check_sdd_fails_for_exempt_row_without_reason() {
    local repo

    repo="$(make_sdd_repo)"
    printf '#!/usr/bin/env bash\nexit 0\n' > "$repo/scripts/oneoff.sh"
    printf 'none\t\toneoff.sh\n' >> "$repo/scripts/ci-jobs.tsv"
    assert_command_fails_with "$repo" 1 "CI_JOB_PARITY" "scripts/ci-jobs.tsv"
}

test_check_sdd_accepts_reasoned_ci_job_exemption() {
    local repo

    repo="$(make_sdd_repo)"
    printf '#!/usr/bin/env bash\nexit 0\n' > "$repo/scripts/oneoff.sh"
    printf 'none\tone-off fixture helper; not a gate\toneoff.sh\n' >> "$repo/scripts/ci-jobs.tsv"
    assert_command_succeeds "$repo" --not-rule "CI_JOB_PARITY"
}


# --- User path map freshness checker (issue #665 Stage 1) -------------------
# Stage 1 fixtures only pin the fail-closed CLI surface. They must never supply
# or guess the authoritative source metadata contract owned by issue #645.

make_path_map_repo() {
    local repo
    repo="$(mktemp -d "$TMP_ROOT/path-map-repo.XXXXXX")"

    mkdir -p "$repo/design/system" "$repo/design/prototype/pages/shared" "$repo/scripts"
    printf '# Screen inventory fixture\n' > "$repo/design/system/screen-inventory.md"
    printf '<!doctype html>\n<title>Prototype page fixture</title>\n' \
        > "$repo/design/prototype/pages/shared/index.html"
    if [[ -f "$ROOT/scripts/check-user-path-map-freshness.mjs" ]]; then
        cp "$ROOT/scripts/check-user-path-map-freshness.mjs" \
            "$repo/scripts/check-user-path-map-freshness.mjs"
    fi

    git -C "$repo" init -q
    git -C "$repo" add .
    git -C "$repo" -c user.email="speckit-test@example.com" -c user.name="Speckit Test" \
        commit -q -m "seed path map fixture repo"
    echo "$repo"
}

write_path_map_artifact() {
    local repo="$1"

    cat > "$repo/design/system/user-path-map.html" <<'HTML'
<!doctype html>
<title>User Path Map</title>
<p>Fixture artifact without any authoritative source metadata header.</p>
HTML
    git -C "$repo" add .
    git -C "$repo" -c user.email="speckit-test@example.com" -c user.name="Speckit Test" \
        commit -q -m "add path map fixture artifact"
}

run_path_map_checker() {
    local repo="$1"
    shift
    local command="$repo/scripts/check-user-path-map-freshness.mjs"

    if [[ ! -f "$command" ]]; then
        echo "Expected user path map freshness checker is missing: scripts/check-user-path-map-freshness.mjs" >&2
        return 127
    fi

    (
        cd "$TMP_ROOT"
        node "$command" "$@"
    )
}

# Sets PATH_MAP_OUTPUT to the captured stdout+stderr file of one invocation.
run_path_map_checker_capture() {
    local repo="$1"
    local expected_status="$2"
    shift 2
    local status

    PATH_MAP_OUTPUT="$(mktemp "$TMP_ROOT/path-map-check.XXXXXX")"
    if run_path_map_checker "$repo" "$@" >"$PATH_MAP_OUTPUT" 2>&1; then
        status=0
    else
        status=$?
    fi
    if [[ "$status" -ne "$expected_status" ]]; then
        echo "Expected scripts/check-user-path-map-freshness.mjs to exit $expected_status, got: $status" >&2
        cat "$PATH_MAP_OUTPUT" >&2
        exit 1
    fi
}

snapshot_path_map_repo() {
    local repo="$1"

    (
        cd "$repo"
        git status --porcelain
        git ls-files -s
        find . -path ./.git -prune -o -type f -exec cksum {} + | LC_ALL=C sort
    )
}

test_path_map_freshness_help_documents_issue_645_dependency() {
    local repo

    repo="$(make_path_map_repo)"
    run_path_map_checker_capture "$repo" 0 --help
    assert_contains "$PATH_MAP_OUTPUT" "usage: node scripts/check-user-path-map-freshness.mjs"
    assert_contains "$PATH_MAP_OUTPUT" "issue #645"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
}

test_path_map_freshness_rejects_unsupported_argument() {
    local repo

    repo="$(make_path_map_repo)"
    run_path_map_checker_capture "$repo" 2 --fix
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_USAGE]"
    assert_contains "$PATH_MAP_OUTPUT" "unsupported argument: --fix"
    assert_contains "$PATH_MAP_OUTPUT" "usage: node scripts/check-user-path-map-freshness.mjs"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
}

test_path_map_freshness_rejects_extra_positional_argument() {
    local repo

    repo="$(make_path_map_repo)"
    run_path_map_checker_capture "$repo" 2 "$repo" "$repo"
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_USAGE]"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
}

test_path_map_freshness_rejects_unresolvable_root() {
    local repo

    repo="$(make_path_map_repo)"
    run_path_map_checker_capture "$repo" 2 ""
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_ROOT]"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"

    run_path_map_checker_capture "$repo" 2 "$TMP_ROOT/path-map-absent-root"
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_ROOT]"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
}

test_path_map_freshness_fails_closed_for_missing_artifact() {
    local repo

    repo="$(make_path_map_repo)"
    run_path_map_checker_capture "$repo" 2
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_ARTIFACT_MISSING] design/system/user-path-map.html:"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: stale"
}

test_path_map_freshness_fails_closed_for_unsettled_authority() {
    local repo

    repo="$(make_path_map_repo)"
    write_path_map_artifact "$repo"
    run_path_map_checker_capture "$repo" 2
    assert_contains "$PATH_MAP_OUTPUT" "ERROR [PATH_MAP_AUTHORITY_UNSETTLED] design/system/user-path-map.html:"
    assert_contains "$PATH_MAP_OUTPUT" "issue #645"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: fresh"
    assert_not_contains "$PATH_MAP_OUTPUT" "freshness: stale"
}

test_path_map_freshness_does_not_write_to_the_repository() {
    local repo before after

    repo="$(make_path_map_repo)"
    write_path_map_artifact "$repo"
    before="$(mktemp "$TMP_ROOT/path-map-before.XXXXXX")"
    after="$(mktemp "$TMP_ROOT/path-map-after.XXXXXX")"

    snapshot_path_map_repo "$repo" > "$before"
    run_path_map_checker_capture "$repo" 0 --help
    run_path_map_checker_capture "$repo" 2 --fix
    run_path_map_checker_capture "$repo" 2 "$TMP_ROOT/path-map-absent-root"
    run_path_map_checker_capture "$repo" 2
    snapshot_path_map_repo "$repo" > "$after"

    if ! diff -u "$before" "$after" >/dev/null; then
        echo "Expected scripts/check-user-path-map-freshness.mjs to leave the repository unchanged" >&2
        diff -u "$before" "$after" >&2 || true
        exit 1
    fi
}

test_check_spec_artifacts_passes_for_synced_repo
test_check_spec_artifacts_fails_for_untracked_spec
test_check_spec_artifacts_accepts_archived_spec_location
test_check_spec_artifacts_fails_for_archived_row_without_archived_spec
test_ci_uses_pnpm_for_prototype_jobs
test_check_sdd_passes_for_valid_repo
test_check_sdd_uses_explicit_repo_root
test_check_sdd_rejects_empty_explicit_repo_root
test_check_sdd_fails_for_missing_goal_heading
test_check_sdd_fails_for_active_change_stage_drift
test_check_sdd_fails_for_missing_source_id
test_check_sdd_accepts_ids_defined_by_added_requirements
test_check_sdd_fails_for_id_only_mentioned_in_added_body
test_check_sdd_accepts_cross_spec_citation_naming_the_source_spec
test_check_sdd_fails_for_cross_spec_citation_absent_from_the_named_spec
test_check_sdd_fails_for_invalid_assignee
test_check_sdd_fails_for_incomplete_exception
test_check_sdd_fails_for_wrong_red_owner
test_check_sdd_fails_for_retired_command
test_check_sdd_does_not_match_pnpm
test_check_sdd_accepts_exact_legacy_baseline
test_check_sdd_fails_for_new_baseline_violation
test_check_sdd_fails_for_stale_baseline_entry
test_check_sdd_fails_for_duplicate_or_unsorted_baseline
test_check_sdd_strict_promotes_baseline_debt
test_check_sdd_inventory_fresh_has_no_diagnostic
test_check_sdd_inventory_exact_stale_sentinel
test_check_sdd_inventory_rejects_near_sentinels
test_check_sdd_inventory_configuration_failures
test_check_sdd_inventory_strict_config_mapping_is_invariant
test_check_sdd_inventory_uses_target_root_generator
test_check_sdd_fails_for_near_match_goal_heading
test_check_sdd_fails_for_malformed_baseline_rows
test_check_sdd_fails_for_explicit_multi_file_task
test_check_sdd_accepts_english_negative_task_clauses
test_check_sdd_extracts_chinese_task_clauses_in_byte_locale
test_check_sdd_fails_without_exact_spec_declaration
test_check_sdd_fails_for_status_module_mismatch
test_check_sdd_accepts_archived_canonical_spec_location
test_check_sdd_fails_for_spec_ready_spec_without_required_ids
test_check_sdd_fails_when_archived_status_has_active_canonical_duplicate
test_check_sdd_fails_for_spec_ready_near_match_goal_heading_without_ids
test_check_sdd_rejects_arbitrary_dependency_heading_suffix
test_check_sdd_accepts_approved_dependency_heading_suffix
test_check_sdd_rejects_suffixed_source_verify_id
test_check_sdd_requires_exact_multisegment_source_verify_ids
test_check_sdd_requires_one_unconsumed_red_per_green
test_check_sdd_rejects_prescriptive_example_retired_command
test_check_sdd_scans_symlinked_active_change_consumers
test_check_sdd_does_not_consume_red_mentioning_paired_green
test_check_sdd_rejects_nonhistorical_active_retired_command
test_check_sdd_requires_explicit_retired_command_context
test_check_sdd_classifies_retired_commands_per_clause
test_check_sdd_scans_symlinked_agents_consumers
test_check_sdd_rejects_control_character_descendant_in_symlinked_agents_root
test_check_sdd_uses_parsed_action_artifacts_for_task_ownership
test_check_sdd_requires_all_red_tasks_paired_before_eof
test_check_sdd_rejects_retired_command_in_active_openspec_config
test_check_sdd_excludes_deprecated_task_template_retired_wording
test_check_sdd_rejects_nonpath_exception_files_value
test_check_sdd_rejects_partial_exception_files_list
test_check_sdd_accepts_complete_exception_files_list
test_check_sdd_accepts_complete_exception_with_root_extensionless_path
test_check_sdd_ignores_backticked_identifier_in_exception_outputs
test_check_sdd_rejects_non_shell_red_task_with_non_qa_owner
test_check_sdd_accepts_non_shell_red_task_with_qa_owner
test_check_sdd_ci_job_is_independent
test_check_sdd_rejects_foreign_root_generator_without_side_effects
test_check_sdd_rejects_control_character_paths_before_scanning
test_check_sdd_collects_final_review_high_regressions
test_check_sdd_fails_for_verification_suite_without_ci_job
test_check_sdd_fails_for_ci_job_without_local_command
test_check_sdd_fails_for_registry_job_absent_from_ci
test_check_sdd_fails_for_local_command_absent_from_claude_md
test_check_sdd_fails_for_exempt_row_without_reason
test_check_sdd_accepts_reasoned_ci_job_exemption
test_path_map_freshness_help_documents_issue_645_dependency
test_path_map_freshness_rejects_unsupported_argument
test_path_map_freshness_rejects_extra_positional_argument
test_path_map_freshness_rejects_unresolvable_root
test_path_map_freshness_fails_closed_for_missing_artifact
test_path_map_freshness_fails_closed_for_unsettled_authority
test_path_map_freshness_does_not_write_to_the_repository

echo "speckit script tests passed"
