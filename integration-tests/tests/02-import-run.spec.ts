import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';

const NAMESPACE = 'openshift-lightspeed';
const TRIGGER_DOMAIN = 'manual-test';

// Unique per execution so reruns don't collide with an already-created run
const uniqueRunName = (): string =>
  `imported-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Monaco owns the editor content, so typing the YAML would trip its auto-indent and corrupt the
// document. Set the model value directly instead.
const setEditorValue = async (page: Page, yaml: string): Promise<void> => {
  await page.evaluate((value) => {
    const { monaco } = window as unknown as {
      monaco: { editor: { getModels: () => { setValue: (v: string) => void }[] } };
    };
    monaco.editor.getModels()[0].setValue(value);
  }, yaml);
};

const importRunFromYaml = async (page: Page, name: string): Promise<void> => {
  const yaml = [
    'apiVersion: agentic.openshift.io/v1alpha1',
    'kind: AgenticRun',
    'metadata:',
    `  name: ${name}`,
    `  namespace: ${NAMESPACE}`,
    '  labels:',
    `    agentic.openshift.io/source: ${TRIGGER_DOMAIN}`,
    'spec:',
    '  request: Investigate the health of the cluster.',
    '  analysis:',
    '    agent: default',
    '',
  ].join('\n');

  await page.goto(`/k8s/ns/${NAMESPACE}/import`);

  await expect(page.locator('.monaco-editor')).toBeVisible();
  await setEditorValue(page, yaml);

  await page.locator('[data-test="save-changes"]').click();

  // The console leaves the import page only once the resource is accepted
  await expect(page).not.toHaveURL(/\/import$/);
};

// The table is virtualized, so a run past the rendered window never reaches the DOM. Filter by
// name to bring it into view regardless of how long the list is.
const openRunsListFilteredBy = async (page: Page, name: string): Promise<Locator> => {
  await page.goto('/lightspeed/runs');
  await expect(page.getByRole('heading', { name: 'Agentic runs', exact: true })).toBeVisible();
  await page.locator('[data-test="name-filter-input"]').fill(name);

  return page.getByRole('link', { name, exact: true });
};

// Serial because the AgenticRun is imported once by the first test and reused by the others
test.describe.serial('an AgenticRun imported from YAML', () => {
  const name = uniqueRunName();

  test('appears in the runs list', async ({ page }) => {
    await importRunFromYaml(page, name);

    const runLink = await openRunsListFilteredBy(page, name);
    await expect(runLink).toBeVisible();
    await expect(runLink).toHaveAttribute('href', `/lightspeed/runs/${NAMESPACE}/${name}`);
  });

  test('shows its metadata on the detail page', async ({ page }) => {
    const runLink = await openRunsListFilteredBy(page, name);
    await runLink.click();

    // On some console builds the SPA router aborts the navigation after the click: the
    // detail route module chunk loads but the URL never changes (observed on the 5.0 dev
    // console used by CI, where shared-module version negotiation fails - see PR #340).
    // The link target itself is already verified via the href assertion above, so fall
    // back to loading the detail URL directly.
    const detailUrl = `/lightspeed/runs/${NAMESPACE}/${name}`;
    try {
      await page.waitForURL(new RegExp(`${detailUrl}$`), { timeout: 5_000 });
    } catch {
      await page.goto(detailUrl);
    }

    await expect(page).toHaveURL(new RegExp(`/lightspeed/runs/${NAMESPACE}/${name}$`));

    // "Created" also appears in the analysis block once a run has results, so the header assertions
    // are scoped rather than matched across the whole page.
    const header = page.locator('section').filter({ has: page.getByRole('heading', { level: 1 }) });

    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(header.getByText('Tech preview', { exact: true })).toBeVisible();
    await expect(
      header.getByText(`Trigger domain: ${TRIGGER_DOMAIN}`, { exact: true }),
    ).toBeVisible();

    // On a live cluster the operator may reconcile the run at any point, so accept any phase its
    // lifecycle could reach
    const phase = page.locator('.ols-plugin__run-phase');
    await expect(phase).toBeVisible();
    await expect(phase).toHaveText(/^(Analyzing|Completed|Failed|Pending|Proposed)$/);

    await expect(header.getByText(/^Created\b/)).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Agentic run details', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'The autonomous features of OpenShift Lightspeed use AI technology to generate output. Always review AI-generated content prior to use.',
        { exact: true },
      ),
    ).toBeVisible();
  });
});
