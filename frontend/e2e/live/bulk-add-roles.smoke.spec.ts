import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, live, open, signIn, test, watch } from './fixtures';

/**
 * "Bulk add" for each seeded role, through the browser against the real backend. The button must be offered exactly where
 * the server lets that role create: for every role and entity, a dry-run `bulk-create` as that user answers 403 when the
 * button is hidden and is not refused when it is shown. Where it is offered, the manager opens and tells the user which
 * project code goes in front of the new codes. Screenshots go to test-results/bulk-add-smoke.
 */
const SHOTS = 'test-results/bulk-add-smoke';
const ENTITIES = [
  { path: '/sequences', plural: 'sequences', probe: { name: 'p' } },
  { path: '/shots', plural: 'shots', probe: { name: 'p' } },
  { path: '/assets', plural: 'assets', probe: { name: 'p', category: 'Prop' } },
  { path: '/tasks', plural: 'tasks', probe: { title: 'p' } },
] as const;
const ROLES = ['producer', 'supervisor', 'lead', 'artist'] as const;
const PROJECT = 'LIVEDLV';

const api = async (token: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${live.url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

async function chooseProject(page: Page) {
  const select = page.getByLabel('Filter by project');
  await expect(select.locator('option', { hasText: PROJECT })).toHaveCount(1);
  await select.selectOption({ label: PROJECT });
}

test.use({ actionTimeout: 30_000 });

for (const role of ROLES) {
  test(`Bulk add as the ${role}: offered exactly where the server lets them create`, async ({ page }) => {
    test.setTimeout(300_000);
    const seen = watch(page);
    const user = live.users[role];
    const login = await api(null, 'POST', '/api/v1/auth/login/', { email: user.email, password: user.password });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const token: string = login.body.tokens?.access ?? login.body.access;
    expect(token, 'a token for the role').toBeTruthy();
    const project = live.dlv.project;

    // What the server says each role may do: a dry run creates nothing, and a 403 is "may not create".
    const allowed: Record<string, boolean> = {};
    for (const entity of ENTITIES) {
      const probe = await api(token, 'POST', `/api/v1/${entity.plural}/bulk-create/`, {
        project_id: project,
        dry_run: true,
        items: [{ code: `${PROJECT}_PROBE`, action: 'create', data: entity.probe }],
      });
      expect([200, 403], `${role} ${entity.plural}: ${JSON.stringify(probe.body)}`).toContain(probe.status);
      allowed[entity.plural] = probe.status !== 403;
    }
    console.log(`[${role}] may create: ${JSON.stringify(allowed)}`);

    await signIn(page, role);
    await page.getByRole('button', { name: 'Maybe later' }).click({ timeout: 10_000 }).catch(() => undefined);

    for (const entity of ENTITIES) {
      await open(page, entity.path, 'role');
      const button = page.getByRole('button', { name: `Bulk add ${entity.plural}` });
      const filter = page.getByLabel('Filter by project');
      if (await filter.waitFor({ timeout: 15_000 }).then(() => true, () => false)) await chooseProject(page);
      await page.waitForLoadState('networkidle');
      if (allowed[entity.plural]) {
        await expect(button, `${role} may create ${entity.plural}`).toBeVisible({ timeout: 20_000 });
        await button.click();
        await expect(page.getByRole('dialog').getByText(`Project: ${PROJECT}`)).toBeVisible();
        // The staged manager says which code goes in front of new codes; the shot manager's grid shows the shot code column.
        if (entity.plural !== 'shots') await expect(page.getByRole('dialog').getByText(`Each new code gets ${PROJECT}_ in front`)).toBeVisible();
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/role-${role}-${entity.plural}.png` });
        await page.keyboard.press('Escape');
      } else {
        // The page has loaded (the project is chosen, the network is quiet) and the button is not there.
        await page.waitForTimeout(1_500);
        await expect(button, `${role} may not create ${entity.plural}`).toHaveCount(0);
        if (entity.plural === 'sequences') {
          fs.mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: `${SHOTS}/role-${role}-${entity.plural}-no-button.png` });
        }
      }
    }

    expect(seen.serverErrors, seen.serverErrors.join('\n')).toEqual([]);
    expect(seen.pageErrors, seen.pageErrors.join('\n')).toEqual([]);
  });
}
