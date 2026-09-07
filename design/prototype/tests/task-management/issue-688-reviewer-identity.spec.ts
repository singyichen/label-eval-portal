/*
 * Traceability: openspec/changes/align-014-review-model/specs/task-management/014-task-detail/spec.md
 *   FR-010s-1 ("兩份名冊寫入的元素 MUST 遵守 REVIEWER_ID_FORMAT ... MUST NOT
 *   寫入 Email 或顯示名稱") and its "名冊以不透明 user id 儲存而非 Email" scenario.
 *
 * TDD Red for tasks.md 1.1. This spec is the Green contract: PR group 1's
 * frontend implementation (task 1.2) MUST make every assertion below pass by
 * adding an `id` field to every `TASK_MEMBERS` entry in
 * design/prototype/pages/task-management/task-detail.html, migrating the
 * `reviewerIds`/`arbiterIds` seeds (task-detail.html's DEFAULT_TASK_DATA and
 * the five `byReviewer` workload tables, plus task-detail.data.js's four
 * T014-T017 profiles) from Email to that id, and re-keying
 * getEffectiveReviewerIds()/getEffectiveArbiterIds() and the review-settings
 * checklist inputs (#reviewerOptionList / #arbiterOptionList) off
 * `member.id` instead of `member.email`. Green MUST NOT edit this file to
 * make it pass -- if a case here conflicts with Green's implementation,
 * Green is wrong, not this test.
 *
 * ---------------------------------------------------------------------
 * Contract decided by this Red:
 *
 *   The seven TASK_MEMBERS people (Mandy Chen / Kevin Liu / Rachel Wu /
 *   Alex Wang / Olivia Lin / Jason Huang / Derek Yeh) are NOT changing --
 *   this is only adding an `id` field alongside the existing `email` field.
 *   The literal id values are Green's choice (the spec only pins the shape:
 *   a slug, cf. annotation/015-annotation-workspace's REVIEWER_ROSTER shape
 *   `reviewer_wang`), so every assertion below checks shape (lowercase
 *   slug, no `@`, no whitespace) and cross-referential consistency (every
 *   seeded reviewer_ids/arbiter_ids/byReviewer-key element must resolve to
 *   a real TASK_MEMBERS id) rather than a hardcoded literal.
 *
 *   All state is read via page.evaluate() against the page's own global
 *   `var`s (TASK_MEMBERS, TASK_DATA, DEFAULT_REVIEW_WORKLOAD,
 *   REVIEW_WORKLOAD_BY_TASK, window.LabelSuiteTaskDetailData.profiles) --
 *   task-detail.html's main <script> block is a classic (non-module,
 *   non-IIFE-wrapped) top-level script, so these `var` declarations are
 *   already `window` properties; no test-only hook needed.
 * ---------------------------------------------------------------------
 */
import { test, expect, type Page } from '@playwright/test';

const TASK_DETAIL_URL = '/pages/task-management/task-detail.html';
const PANEL_LOAD_TIMEOUT = 15000;
const SLUG_RE = /^[a-z][a-z0-9_-]*$/;

const REVIEW_PROFILE_TASK_IDS = ['T014', 'T015', 'T016', 'T017'] as const;

type TaskMember = { id?: string; email: string; name: string };

async function getTaskMembers(page: Page): Promise<TaskMember[]> {
  return page.evaluate(() => (window as unknown as { TASK_MEMBERS: TaskMember[] }).TASK_MEMBERS);
}

async function openReviewEdit(page: Page) {
  await page.goto(TASK_DETAIL_URL);
  await page.locator('#reviewEditBtn').click();
}

async function openMemberTab(page: Page) {
  await page.locator('#workLogPanel').waitFor({ state: 'attached', timeout: PANEL_LOAD_TIMEOUT });
  await page.locator('#tabMemberManagement').click();
  await expect(page.locator('#memberManagementPanel')).not.toHaveClass(/hidden/);
}

test.describe.configure({ retries: 2 });

test.describe('Task detail reviewer identity format — opaque user id, not Email (issue #688)', () => {
  // FR-010s-1 REVIEWER_ID_FORMAT: every TASK_MEMBERS entry carries an `id`
  // shaped as a lowercase slug (no `@`, no whitespace) alongside `email`.
  test('TASK_MEMBERS entries carry a slug-shaped id, not just email', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL);
    const members = await getTaskMembers(page);

    expect(members).toHaveLength(7);
    members.forEach((member) => {
      expect(typeof member.id, `member ${member.name} is missing an id field`).toBe('string');
      expect(member.id).not.toContain('@');
      expect(member.id).not.toMatch(/\s/);
      expect(member.id).toMatch(SLUG_RE);
    });

    const ids = members.map((m) => m.id);
    expect(new Set(ids).size, 'TASK_MEMBERS ids must be unique').toBe(ids.length);
  });

  // FR-010s-1: reviewer_ids/arbiter_ids seeds (the default roster and the
  // four T014-T017 task profiles) hold TASK_MEMBERS ids, not Email strings.
  test('reviewer_ids/arbiter_ids seeds hold member ids, not Email, and resolve into TASK_MEMBERS', async ({
    page,
  }) => {
    await page.goto(TASK_DETAIL_URL);

    const members = await getTaskMembers(page);
    const idSet = new Set(members.map((m) => m.id));

    const defaultSeed = await page.evaluate(() => {
      const data = (window as unknown as { TASK_DATA: { reviewerIds: string[]; arbiterIds: string[] } }).TASK_DATA;
      return { reviewerIds: data.reviewerIds, arbiterIds: data.arbiterIds };
    });

    const profileSeeds = await page.evaluate((taskIds) => {
      const profiles =
        (window as unknown as {
          LabelSuiteTaskDetailData?: { profiles: Record<string, { reviewerIds?: string[]; arbiterIds?: string[] }> };
        }).LabelSuiteTaskDetailData?.profiles || {};
      const result: Record<string, { reviewerIds: string[]; arbiterIds: string[] }> = {};
      taskIds.forEach((taskId) => {
        result[taskId] = {
          reviewerIds: profiles[taskId]?.reviewerIds || [],
          arbiterIds: profiles[taskId]?.arbiterIds || [],
        };
      });
      return result;
    }, REVIEW_PROFILE_TASK_IDS as unknown as string[]);

    const allSeeds = [defaultSeed, ...Object.values(profileSeeds)];
    allSeeds.forEach((seed) => {
      [...seed.reviewerIds, ...seed.arbiterIds].forEach((value) => {
        expect(value, `seed element "${value}" must not be an Email string`).not.toContain('@');
        expect(idSet.has(value), `seed element "${value}" must resolve to a TASK_MEMBERS id`).toBe(true);
      });
    });

    // At least the default roster and one task profile must be non-empty,
    // otherwise the assertions above would vacuously pass.
    expect(defaultSeed.reviewerIds.length).toBeGreaterThan(0);
    expect(profileSeeds.T014.reviewerIds.length).toBeGreaterThan(0);
  });

  // FR-010s-1 scenario "名冊以不透明 user id 儲存而非 Email": checking one
  // reviewer in edit mode and saving writes that member's id into
  // reviewer_ids, never their Email.
  test('saving review settings writes the checked reviewer id, not their Email', async ({ page }) => {
    await openReviewEdit(page);

    const members = await getTaskMembers(page);
    const mandy = members.find((m) => m.name === 'Mandy Chen');
    if (!mandy) throw new Error('fixture regression: Mandy Chen must exist in TASK_MEMBERS');

    const reviewerCheckboxes = page.locator('#reviewerOptionList .reviewer-option input');
    const count = await reviewerCheckboxes.count();
    for (let i = 0; i < count; i += 1) {
      const box = reviewerCheckboxes.nth(i);
      if (await box.isChecked()) await box.uncheck();
    }
    await page
      .locator('#reviewerOptionList .reviewer-option', { hasText: 'Mandy Chen' })
      .locator('input')
      .check();
    await page.locator('#reviewSaveBtn').click();

    // Wait for the save's synchronous re-render to land before reading
    // TASK_DATA back out.
    await expect(page.locator('#reviewSummaryView')).not.toHaveClass(/hidden/);

    const savedReviewerIds = await page.evaluate(
      () => (window as unknown as { TASK_DATA: { reviewerIds: string[] } }).TASK_DATA.reviewerIds
    );

    expect(savedReviewerIds).toHaveLength(1);
    expect(savedReviewerIds[0]).not.toBe(mandy.email);
    expect(savedReviewerIds[0]).not.toContain('@');
    expect(savedReviewerIds[0]).toBe(mandy.id);
  });

  // FR-010s-1: "成員清單「審核負荷」欄之聚合亦 MUST 以該 id 為鍵" -- the
  // byReviewer aggregation tables (the shared default plus the four
  // per-task tables) are keyed by TASK_MEMBERS id, not Email.
  test('review workload aggregation (byReviewer) is keyed by member id, not Email', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL);

    const members = await getTaskMembers(page);
    const idSet = new Set(members.map((m) => m.id));

    const workloadKeySets = await page.evaluate((taskIds) => {
      type Workload = { byReviewer: Record<string, unknown> };
      const w = window as unknown as {
        DEFAULT_REVIEW_WORKLOAD: Workload;
        REVIEW_WORKLOAD_BY_TASK: Record<string, Workload>;
      };
      const result: Record<string, string[]> = {
        DEFAULT: Object.keys(w.DEFAULT_REVIEW_WORKLOAD.byReviewer),
      };
      taskIds.forEach((taskId) => {
        result[taskId] = Object.keys(w.REVIEW_WORKLOAD_BY_TASK[taskId]?.byReviewer || {});
      });
      return result;
    }, REVIEW_PROFILE_TASK_IDS as unknown as string[]);

    Object.entries(workloadKeySets).forEach(([table, keys]) => {
      expect(keys.length, `byReviewer table "${table}" must not be empty`).toBeGreaterThan(0);
      keys.forEach((key) => {
        expect(key, `byReviewer key "${key}" in table "${table}" must not be an Email string`).not.toContain('@');
        expect(idSet.has(key), `byReviewer key "${key}" in table "${table}" must resolve to a TASK_MEMBERS id`).toBe(
          true
        );
      });
    });
  });

  // Positive regression guard: the member list keeps displaying Email for
  // human identification -- Email is a display-only attribute (FR-010s-1),
  // this must stay green through Green.
  test('member list still displays Email for every member', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL);
    await openMemberTab(page);

    const members = await getTaskMembers(page);
    const emailCells = page.locator('#memberTableBody .member-email');
    await expect(emailCells).toHaveCount(members.length);

    const cellTexts = await emailCells.allTextContents();
    cellTexts.forEach((text) => {
      expect(text).toContain('@');
    });
    expect(cellTexts.sort()).toEqual(members.map((m) => m.email).sort());
  });
});
