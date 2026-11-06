import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { freshTotp } from '../../src/test/live/liveBackend';
import { expect, live, open, signIn, test, watch } from './fixtures';

/**
 * The create forms and the staged "Bulk add" (v4.4.0), through the browser against the real backend, as the MFA superuser:
 * the project's code in front of a new code (CR-49), a new shot needing a sequence, Bulk add for sequences / assets / tasks /
 * shots (CSV upload, the breakdown, Update Existing Entity, uploading the same rows again) and what the server stored.
 * Screenshots of each step go to test-results/bulk-add-smoke.
 */
const SHOTS = 'test-results/bulk-add-smoke';
const CODE = 'SMKBA';

const api = async (token: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${live.url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const snap = async (page: Page, name: string) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

const csv = (text: string) => ({ name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
const pill = (page: Page, label: RegExp) => page.getByRole('dialog').getByRole('button', { name: label });

/** The dialog has an input holding `value` (Playwright has no display-value query). */
const hasValue = (page: Page, value: string) =>
  expect.poll(() => page.getByRole('dialog').locator('input').evaluateAll((inputs, wanted) => inputs.some((input) => (input as HTMLInputElement).value === wanted), value)).toBe(true);

async function chooseProject(page: Page) {
  const select = page.getByLabel('Filter by project');
  await expect(select.locator('option', { hasText: CODE })).toHaveCount(1);
  await select.selectOption({ label: CODE });
}

// A click that cannot land (a covered button, a renamed control) must fail in seconds, not hold the run for minutes.
test.use({ actionTimeout: 30_000 });

test('create forms and Bulk add: prefix, required sequence, CSV, update, existing, shots', async ({ page }) => {
  test.setTimeout(900_000);
  const seen = watch(page);
  const first = await api(null, 'POST', '/api/v1/auth/login/', { email: live.users.manager.email, password: live.users.manager.password });
  const login = await api(null, 'POST', '/api/v1/auth/mfa/challenge/', { challenge: first.body.challenge, code: await freshTotp(live.manager.secret) });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const admin: string = login.body.tokens.access;
  const project = await api(admin, 'POST', '/api/v1/projects/', { code: CODE, name: 'Smoke Bulk Add', workflow_type: 'standard' });
  expect(project.status, JSON.stringify(project.body)).toBe(201);
  const pid: string = project.body.id;
  const stored = async (entity: string, code: string) => (await api(admin, 'GET', `/api/v1/${entity}/?project=${pid}&project_id=${pid}&search=${code}&page_size=100`)).body.results.find((r: { code: string }) => r.code === code);

  await signIn(page, 'manager');
  // The first-run welcome banner sits bottom-right and covers the submit buttons; a user dismisses it first.
  await page.getByRole('button', { name: 'Maybe later' }).click({ timeout: 10_000 }).catch(() => undefined);

  // ---- 1. New sequence: the project's code is shown in front and sent.
  await open(page, `/sequences/new?project=${pid}`, 'journey');
  await expect(page.getByLabel('Code prefix')).toHaveText(`${CODE}_`);
  await page.getByLabel('Code *', { exact: true }).fill('sq0010');
  await page.getByLabel(/^Name/).fill('Opening');
  await snap(page, '01-new-sequence-form');
  const sequencePost = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/sequences/');
  await page.getByRole('button', { name: 'Create sequence' }).click();
  expect((await sequencePost).postDataJSON().code).toBe(`${CODE}_SQ0010`);
  await expect.poll(async () => (await stored('sequences', `${CODE}_SQ0010`))?.name).toBe('Opening');

  // ---- 2. New shot: a sequence is required, then chosen from the picker.
  await open(page, `/shots/new?project=${pid}`, 'journey');
  await expect(page.getByLabel('Code prefix')).toHaveText(`${CODE}_`);
  await page.getByLabel('Code *', { exact: true }).fill('sh010');
  await page.getByRole('button', { name: 'Create shot' }).click();
  await expect(page.getByText('Choose a sequence.')).toBeVisible();
  await snap(page, '02-new-shot-needs-a-sequence');
  await page.getByRole('button', { name: /^Sequence \*/ }).click();
  await snap(page, '03-new-shot-sequence-picker');
  await page.getByRole('option', { name: new RegExp(`${CODE}_SQ0010`) }).click();
  const shotPost = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/shots/');
  await page.getByRole('button', { name: 'Create shot' }).click();
  const shotBody = (await shotPost).postDataJSON();
  expect(shotBody.code).toBe(`${CODE}_SH010`);
  await expect.poll(async () => (await stored('shots', `${CODE}_SH010`))?.sequence_code).toBe(`${CODE}_SQ0010`);

  // ---- 3. Bulk add sequences: upload a CSV; one exists already, one is new, one is a batch duplicate.
  await open(page, '/sequences', 'journey');
  await chooseProject(page);
  await page.getByRole('button', { name: 'Bulk add sequences' }).click();
  await page.getByLabel('CSV file').setInputFiles(csv('code,name,description\nSQ0010,,Re-cut\nSQ0020,Chase,\nSQ0020,Again,\n'));
  await hasValue(page, 'Chase');
  await snap(page, '04-bulk-sequences-grid');
  await page.getByRole('button', { name: /Validate/ }).click();
  await expect(page.getByText('Batch Validation Breakdown')).toBeVisible();
  await expect(pill(page, /New \(Create\)\s*1/)).toBeVisible();
  await expect(pill(page, /Active Existing\s*1/)).toBeVisible();
  await expect(pill(page, /Batch Duplicates\s*1/)).toBeVisible();
  await expect(pill(page, /Validation Errors\s*0/)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(`${CODE}_SQ0020`).first()).toBeVisible();
  await snap(page, '05-bulk-sequences-breakdown');
  await page.getByRole('dialog').getByRole('combobox').filter({ hasText: 'Skip (Already Active)' }).selectOption('update_existing');
  await page.getByRole('button', { name: /Review Execution Preview/ }).click();
  await expect(page.getByText('Existing to Update')).toBeVisible();
  await snap(page, '06-bulk-sequences-preview');
  await page.getByRole('button', { name: /Execute Bulk Operation \(2\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Bulk Sequence Operation Successful!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 created · 0 recovered · 1 updated · 1 skipped · 0 failed')).toBeVisible();
  await snap(page, '07-bulk-sequences-result');
  await page.getByRole('dialog').getByRole('button', { name: /Done|Close/ }).first().click();
  await expect.poll(async () => (await stored('sequences', `${CODE}_SQ0010`))?.description).toBe('Re-cut');
  expect((await stored('sequences', `${CODE}_SQ0010`)).name).toBe('Opening'); // the empty name cell left it as it was
  expect((await stored('sequences', `${CODE}_SQ0020`)).name).toBe('Chase');

  // ---- 4. The same rows again: everything already exists.
  await page.getByRole('button', { name: 'Bulk add sequences' }).click();
  await page.getByLabel('CSV file').setInputFiles(csv('code,name\nSQ0010,Opening\nSQ0020,Chase\nSQ0020,Again\n'));
  await hasValue(page, 'Again');
  await page.getByRole('button', { name: /Validate/ }).click();
  await expect(pill(page, /Active Existing\s*2/)).toBeVisible();
  await expect(pill(page, /New \(Create\)\s*0/)).toBeVisible();
  await expect(pill(page, /Batch Duplicates\s*1/)).toBeVisible();
  await snap(page, '08-bulk-sequences-again');
  await page.keyboard.press('Escape');

  // ---- 5. Bulk add assets and tasks.
  await open(page, '/assets', 'journey');
  await chooseProject(page);
  await page.getByRole('button', { name: 'Bulk add assets' }).click();
  await page.getByLabel('CSV file').setInputFiles(csv('code,name,category\nHERO,Hero,Character\nROCK,,Prop\n'));
  await hasValue(page, 'Hero');
  await page.getByRole('button', { name: /Validate/ }).click();
  await expect(pill(page, /New \(Create\)\s*1/)).toBeVisible();
  await expect(pill(page, /Validation Errors\s*1/)).toBeVisible(); // ROCK has no name: the backend refuses it
  await snap(page, '09-bulk-assets-breakdown');
  await page.getByRole('button', { name: /Review Execution Preview/ }).click();
  await page.getByRole('button', { name: /Execute Bulk Operation \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Bulk Asset Operation Successful!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 created · 0 recovered · 0 updated · 1 skipped · 0 failed')).toBeVisible();
  await snap(page, '09b-bulk-assets-result');
  await page.getByRole('dialog').getByRole('button', { name: /Done|Close/ }).first().click();
  await expect.poll(async () => (await stored('assets', `${CODE}_HERO`))?.name).toBe('Hero');
  expect(await stored('assets', `${CODE}_ROCK`)).toBeUndefined();

  await open(page, '/tasks', 'journey');
  await chooseProject(page);
  await page.getByRole('button', { name: 'Bulk add tasks' }).click();
  await page.getByLabel('CSV file').setInputFiles(csv(`code,title,entity_type,entity\nT100,Model hero,Asset,${CODE}_HERO\nT200,Nothing,Shot,NOPE\n`));
  await hasValue(page, 'Model hero');
  await page.getByRole('button', { name: /Validate/ }).click();
  await expect(pill(page, /New \(Create\)\s*1/)).toBeVisible();
  await expect(pill(page, /Validation Errors\s*1/)).toBeVisible();
  await snap(page, '10-bulk-tasks-breakdown');
  await page.getByRole('button', { name: /Review Execution Preview/ }).click();
  await page.getByRole('button', { name: /Execute Bulk Operation \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Bulk Task Operation Successful!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 created · 0 recovered · 0 updated · 1 skipped · 0 failed')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Done|Close/ }).first().click();
  await expect.poll(async () => (await stored('tasks', `${CODE}_T100`))?.entity_code).toBe(`${CODE}_HERO`);

  // ---- 6. Bulk add shots: the sequence is required and found as typed or with the prefix.
  await open(page, '/shots', 'journey');
  await chooseProject(page);
  await page.getByRole('button', { name: 'Bulk add shots' }).click();
  await page.getByRole('button', { name: /Clear/i }).first().click();
  await page.getByRole('button', { name: /Paste TSV/ }).click();
  await page.getByLabel('Rows to paste').fill(['Shot Code\tSequence\tName', 'SH0100\tSQ0010\tLinked by the short code', 'SH0200\tNOPE\tNo such sequence'].join('\n'));
  await page.getByRole('button', { name: /Apply|Import|Parse/ }).last().click();
  await snap(page, '11-bulk-shots-grid');
  await page.getByRole('button', { name: /Validate/ }).click();
  await expect(page.getByText('Batch Validation Breakdown')).toBeVisible();
  await expect(pill(page, /Validation Errors\s*1/)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/Sequence NOPE does not exist in this project/)).toBeVisible();
  await snap(page, '12-bulk-shots-breakdown');
  await page.getByRole('button', { name: /Review Execution Preview/ }).click();
  await page.getByRole('button', { name: /Execute Bulk Operation \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Bulk Shot Operation Successful!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 created · 0 recovered · 0 updated · 1 skipped · 0 failed')).toBeVisible();
  await snap(page, '13-bulk-shots-result');
  await expect.poll(async () => (await stored('shots', `${CODE}_SH0100`))?.sequence_code).toBe(`${CODE}_SQ0010`);
  expect(await stored('shots', `${CODE}_SH0200`)).toBeUndefined();

  // Nothing above should have drawn a server error or an uncaught page error.
  expect(seen.serverErrors, seen.serverErrors.join('\n')).toEqual([]);
  expect(seen.pageErrors, seen.pageErrors.join('\n')).toEqual([]);
});
