import { test, expect, type Page } from '@playwright/test';

const medicine = { id: 'medicine-demo', name: 'DEMO Synthetic medicine', genericName: null, strength: null, dosageForm: null, source: 'DEMO', description: null };
const treatment = { id: 'treatment-demo', name: 'Synthetic treatment', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-10-01' };
const allOff = { doseReminders: false, expiryReminders: false, lowStockAlerts: false, sharingNotifications: false, systemNotifications: false };
const flagLabels = ['Dose reminders', 'Expiry reminders', 'Low stock alerts', 'Sharing updates', 'System updates'];
type Captured = { path: string; method: string; sessionVersion: string | undefined; body: Record<string, unknown> | null };

async function mockApi(page: Page, authenticated = true) {
  const calls: Captured[] = [];
  const records: Record<string, string> = {};
  const state = { authenticated, stockFail: false, registrationFail: false, preferencesFail: false, eventsFail: false, medicinesFail: false, configured: false, flags: { ...allOff }, read: false };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    calls.push({ path: path + url.search, method, sessionVersion: request.headers()['x-session-version'], body });
    const send = (data: unknown, status = 200, meta = {}) => route.fulfill({ status, json: { data, meta } });
    const fail = (code: string, status = 503) => route.fulfill({ status, json: { error: { code, message: code } } });
    if (path === '/api/session') return send({ authenticated: state.authenticated, sessionVersion: state.authenticated ? 'synthetic-session-one' : undefined });
    if (/\/api\/auth\/(login|register)$/.test(path)) { if (state.registrationFail) return fail('REGISTRATION_UNAVAILABLE', 409); state.authenticated = true; return send({ authenticated: true, sessionVersion: 'synthetic-session-one' }); }
    if (path === '/api/auth/logout') { state.authenticated = false; return send({ authenticated: false }); }
    if (path === '/api/backend/me/profile') return send({ id: 'synthetic-patient', firstName: 'Synthetic', lastName: 'Patient', preferredLanguage: 'EN', timezone: 'Africa/Algiers' });
    if (path === '/api/backend/me/inventory') {
      if (method === 'POST') {
        if (state.stockFail) return fail('SERVICE_UNAVAILABLE');
        return send({ id: 'stock-created', ...body }, 201);
      }
      const low = url.searchParams.get('lowStock') === 'true';
      const expired = url.searchParams.has('expiryBefore');
      return send([{ id: 'stock-demo', quantity: '12.500', unit: 'TABLET', expiryDate: expired ? '2020-01-01' : null, isLowStock: low, medicine: { ...medicine, name: expired ? 'DEMO Expired stock' : low ? 'DEMO Low stock' : 'DEMO Stock medicine' } }], 200, { totalPages: 2, total: low ? 2 : 21 });
    }
    if (path === '/api/backend/medicines') {
      if (state.medicinesFail) return fail('CATALOG_UNAVAILABLE');
      if (url.searchParams.get('q') === 'nothing') return send([], 200, { totalPages: 1, total: 0 });
      return send([{ ...medicine, name: url.searchParams.get('page') === '2' ? 'DEMO Second medicine' : medicine.name }], 200, { totalPages: 2, total: 21 });
    }
    if (path === '/api/backend/medicines/medicine-demo') return send(medicine);
    if (path === '/api/backend/me/treatments') return send([treatment], 200, { totalPages: 2, total: 21 });
    if (path === '/api/backend/me/treatments/treatment-demo') return send({ ...treatment, medications: [{ id: 'medication-demo', medicineId: medicine.id, dose: '1', doseUnit: 'tablet', instructions: 'Synthetic instructions only', schedules: [{ id: 'schedule-demo', occurrences: ['eligible-one', 'eligible-two', 'future', 'recorded'].map((id) => ({ occurrenceId: id, scheduledAt: '2026-09-25T08:00:00Z', timezone: 'Africa/Algiers', eligible: id.startsWith('eligible'), event: records[id] ? { status: records[id] } : id === 'recorded' ? { status: 'TAKEN' } : null })) }] }] });
    if (path === '/api/backend/me/medication-events') {
      if (state.eventsFail) return fail('SERVICE_UNAVAILABLE');
      records[String(body?.occurrenceId)] = String(body?.status);
      return send({ id: 'event-demo', ...body }, 201);
    }
    if (path === '/api/backend/me/notifications') return send([{ id: 'notice-demo', title: 'Synthetic reminder', body: 'Review your synthetic treatment', createdAt: '2026-09-25T08:00:00Z', readAt: state.read ? '2026-09-25T09:00:00Z' : null, data: { treatmentId: treatment.id } }], 200, { totalPages: 2, total: 21 });
    if (/\/me\/notifications\/(read-all|notice-demo\/read)$/.test(path)) { state.read = true; return send({ count: 1 }); }
    if (path === '/api/backend/me/notification-preferences') {
      if (method === 'PATCH') {
        if (state.preferencesFail) return fail('PREFERENCES_UNAVAILABLE');
        state.flags = body as typeof allOff;
        state.configured = true;
      }
      return send({ configured: state.configured, preferences: state.configured ? { ...state.flags, expiryLeadDays: 30 } : null });
    }
    return fail('UNEXPECTED_TEST_ROUTE', 404);
  });
  return { calls, state };
}

async function navigate(page: Page, name: string) {
  await expect(page.locator('nav:visible').first()).toBeVisible();
  const desktop = page.getByRole('navigation', { name: 'Main navigation' });
  if (await desktop.isVisible()) {
    await desktop.getByRole('button', { name, exact: true }).click();
  } else {
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    if (name === 'Medicines') {
      await nav.getByRole('button', { name: 'Open quick actions', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Add a medicine', exact: true }).click();
    } else if (name === 'Inbox' || name === 'Settings') {
      await nav.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByRole('main').getByRole('button', { name, exact: true }).click();
    } else await nav.getByRole('button', { name, exact: true }).click();
  }
}

for (const identifier of ['synthetic@example.test', '+213555010010']) {
  test(`registers ${identifier.startsWith('+') ? 'international phone' : 'email'} without trimming password`, async ({ page }) => {
    const { calls } = await mockApi(page, false);
    await page.goto('/portal');
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByLabel('First name', { exact: true }).fill('Synthetic');
    await page.getByLabel('Last name', { exact: true }).fill('Patient');
    await page.getByLabel(/Email or international phone/).fill(identifier);
    await page.getByLabel(/^Password/).fill('  synthetic password  ');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    expect(calls.find(call => call.path === '/api/auth/register')?.body).toMatchObject({ [identifier.startsWith('+') ? 'phone' : 'email']: identifier, firstName: 'Synthetic', lastName: 'Patient', password: '  synthetic password  ', preferredLanguage: 'EN', timezone: expect.any(String) });
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  });
}

test('login preserves password, logout clears all private content', async ({ page }) => {
  const { calls } = await mockApi(page, false);
  await page.goto('/portal');
  await page.getByLabel(/Email or international phone/).fill('synthetic@example.test');
  await page.getByLabel(/^Password/).fill('  synthetic password  ');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(treatment.name, { exact: true })).toBeVisible();
  expect(calls.find(call => call.path === '/api/auth/login')?.body).toEqual({ identifier: 'synthetic@example.test', password: '  synthetic password  ' });
  await navigate(page, 'Settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText(treatment.name, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.getByLabel(/^Password/)).toHaveValue('');
});

test('medicine search, pagination, null detail, empty and retry states', async ({ page }) => {
  const { calls, state } = await mockApi(page);
  await page.goto('/portal');
  await navigate(page, 'Medicines');
  await expect(page.getByText(medicine.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('DEMO Second medicine', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: `Open ${medicine.name}`, exact: true }).click();
  await expect(page.getByText('No description supplied.')).toBeVisible();
  await expect(page.getByText('DEMO', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByLabel('Search medicine names').fill('nothing');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No medicines found', { exact: true })).toBeVisible();
  expect(calls.some(call => call.path.includes('q=nothing'))).toBe(true);
  state.medicinesFail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('CATALOG_UNAVAILABLE');
  state.medicinesFail = false;
  await page.getByRole('button', { name: 'Refresh and retry loading', exact: true }).click();
  await expect(page.getByText('No medicines found', { exact: true })).toBeVisible();
});

test('stored timezone, medicine lookup and eligibility gate immutable records', async ({ page }) => {
  const { calls } = await mockApi(page);
  await page.goto('/portal');
  await page.getByRole('button', { name: `Open ${treatment.name}`, exact: true }).click();
  await expect(page.getByText(/Africa\/Algiers/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Taken', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'View medicine', exact: true }).click();
  await expect(page.getByText(medicine.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: 'Taken', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText(/cannot be edited|immutable/i);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(calls.filter(call => call.path.endsWith('/medication-events'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Taken', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Taken', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Skipped', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Taken', exact: true })).toHaveCount(0);
  expect(calls.filter(call => call.path.endsWith('/medication-events')).map(call => call.body)).toEqual([{ occurrenceId: 'eligible-one', status: 'TAKEN' }, { occurrenceId: 'eligible-two', status: 'SKIPPED' }]);
});

test('ambiguous medical mutation is sent once and never automatically retried', async ({ page }) => {
  const { calls, state } = await mockApi(page);
  state.eventsFail = true;
  await page.goto('/portal');
  await page.getByRole('button', { name: `Open ${treatment.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Taken', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('SERVICE_UNAVAILABLE');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect(calls.filter(call => call.path.endsWith('/medication-events'))).toHaveLength(1);
});

test('inbox paginates, marks all read and marks individual read before opening treatment', async ({ page }) => {
  const { calls } = await mockApi(page);
  await page.goto('/portal');
  await navigate(page, 'Inbox');
  await expect(page.getByText('Synthetic reminder', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => calls.some(call => call.path.includes('/notifications?page=2'))).toBe(true);
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect.poll(() => calls.some(call => call.path.endsWith('/notifications/read-all') && call.method === 'PATCH')).toBe(true);
  await page.getByRole('button', { name: 'Review treatment', exact: true }).click();
  await expect(page.getByRole('heading', { name: treatment.name })).toBeVisible();
  const readIndex = calls.findIndex(call => call.path.endsWith('/notice-demo/read'));
  const detailIndex = calls.findIndex(call => call.path.endsWith('/me/treatments/treatment-demo'));
  expect(readIndex).toBeGreaterThan(-1);
  expect(detailIndex).toBeGreaterThan(readIndex);
});

test('five notification flags require explicit save and survive a failed save', async ({ page }) => {
  const { calls, state } = await mockApi(page);
  await page.goto('/portal');
  await navigate(page, 'Settings');
  await expect(page.getByText(/Nothing is enabled automatically/)).toBeVisible();
  for (const label of flagLabels) await expect(page.getByLabel(label, { exact: true })).not.toBeChecked();
  for (const label of flagLabels) await page.getByLabel(label, { exact: true }).check();
  expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(0);
  state.preferencesFail = true;
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('PREFERENCES_UNAVAILABLE');
  for (const label of flagLabels) await expect(page.getByLabel(label, { exact: true })).toBeChecked();
  state.preferencesFail = false;
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText(/Preferences saved/)).toBeVisible();
  expect(calls.filter(call => call.method === 'PATCH').at(-1)?.body).toEqual(Object.fromEntries(Object.keys(allOff).map(key => [key, true])));
});

test('desktop and phone layout does not overflow and navigation is keyboard accessible', async ({ page }) => {
  await mockApi(page);
  await page.goto('/portal');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await navigate(page, 'Medicines');
  await page.getByRole('button', { name: 'Search', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Search medicine names')).toBeVisible();
});

test('registration validates names and Unicode password length without sending invalid input', async ({ page }) => {
  const { calls } = await mockApi(page, false);
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel(/Email or international phone/).fill('synthetic@example.test');
  await page.getByLabel(/^Password/).fill('😀'.repeat(14));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Enter your first name.')).toBeVisible();
  await expect(page.getByText('Enter your last name.')).toBeVisible();
  await expect(page.getByText(/Your password is too short/)).toBeVisible();
  expect(calls.filter(call => call.path === '/api/auth/register')).toHaveLength(0);
  await page.getByLabel(/^First name/).fill('x'.repeat(101));
  await page.getByLabel(/^Last name/).fill('x'.repeat(101));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('First name must be 100 characters or fewer.')).toBeVisible();
  await expect(page.getByText('Last name must be 100 characters or fewer.')).toBeVisible();
  await page.getByLabel(/^First name/).fill('Synthetic');
  await page.getByLabel(/^Last name/).fill('Patient');
  await page.getByLabel(/^Password/).fill('😀'.repeat(129));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(calls.filter(call => call.path === '/api/auth/register')).toHaveLength(0);
  await page.getByLabel(/^Password/).fill('😀'.repeat(15));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(calls.find(call => call.path === '/api/auth/register')?.body?.password).toBe('😀'.repeat(15));
});

test('navigation ignores a late catalogue response and focus reloads the active area', async ({ page }) => {
  const { calls } = await mockApi(page);
  let release: (() => void) | undefined;
  await page.route('**/api/backend/medicines?**', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { data: [medicine], meta: { totalPages: 1 } } });
  });
  await page.goto('/portal');
  await navigate(page, 'Medicines');
  await expect.poll(() => Boolean(release)).toBe(true);
  await navigate(page, 'Settings');
  await expect(page.getByRole('heading', { name: 'Reminder preferences' })).toBeVisible();
  release?.();
  await expect(page.getByText(medicine.name, { exact: true })).toHaveCount(0);
  const count = calls.filter(call => call.path.endsWith('/notification-preferences')).length;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => calls.filter(call => call.path.endsWith('/notification-preferences')).length).toBeGreaterThan(count);
});

test('registration failure stays generic and does not expose account existence', async ({ page }) => {
  const { state } = await mockApi(page, false);
  state.registrationFail = true;
  await page.goto('/portal');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Synthetic');
  await page.getByLabel('Last name', { exact: true }).fill('Patient');
  await page.getByLabel(/Email or international phone/).fill('synthetic@example.test');
  await page.getByLabel(/^Password/).fill('synthetic password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).not.toContainText(/already exists|registered email|account exists/i);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
});

test('captures synthetic portal screens for visual review', async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto('/portal');
  await expect(page.getByText(treatment.name, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await navigate(page, 'Treatments');
  await expect(page.getByText(treatment.name, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('treatments.png'), fullPage: true });
  await page.getByRole('button', { name: `Open ${treatment.name}`, exact: true }).click();
  await expect(page.getByText('Synthetic instructions only')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('treatment-detail.png'), fullPage: true });
  await navigate(page, 'Settings');
  await expect(page.getByText(/Nothing is enabled automatically/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await navigate(page, 'My Pharmacy');
  await expect(page.getByText('DEMO Stock medicine', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pharmacy.png'), fullPage: true });
});

test('Home shows actual profile and server counts, Pharmacy filters and paginates', async ({ page }) => {
  const { calls } = await mockApi(page);
  await page.goto('/portal');
  await expect(page.getByText('Hello, Synthetic.')).toBeVisible();
  await expect(page.getByRole('button', { name: /21.*In pharmacy|In pharmacy.*21/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /2.*Low stock|Low stock.*2/ })).toBeVisible();
  await expect(page.getByText('DEMO Stock medicine', { exact: true })).toBeVisible();
  expect(calls.filter(call => call.path.startsWith('/api/backend/')).every(call => call.sessionVersion === 'synthetic-session-one')).toBe(true);
  await navigate(page, 'My Pharmacy');
  await page.getByRole('button', { name: 'Low stock', exact: true }).click();
  await expect(page.getByText('DEMO Low stock', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expired', exact: true }).click();
  await expect(page.getByText('DEMO Expired stock', { exact: true })).toBeVisible();
  expect(calls.some(call => /expiryBefore=\d{4}-\d{2}-\d{2}/.test(call.path))).toBe(true);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => calls.some(call => call.path.includes('/inventory?page=2'))).toBe(true);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByText('DEMO Stock medicine', { exact: true })).toBeVisible();
});

test('Add stock requires an explicit quantity and unit and submits once without inventing expiry', async ({ page }) => {
  const { calls } = await mockApi(page);
  await page.goto('/portal');
  await navigate(page, 'Medicines');
  await page.getByRole('button', { name: `Open ${medicine.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Add to My Pharmacy', exact: true }).click();
  expect(calls.filter(call => call.path === '/api/backend/me/inventory' && call.method === 'POST')).toHaveLength(0);
  await page.getByLabel('Stock quantity', { exact: true }).fill('12.5');
  await page.getByLabel(/^Stock unit/).selectOption('TABLET');
  await page.getByRole('button', { name: 'Add to My Pharmacy', exact: true }).click();
  await expect.poll(() => calls.filter(call => call.path === '/api/backend/me/inventory' && call.method === 'POST').length).toBe(1);
  expect(calls.find(call => call.path === '/api/backend/me/inventory' && call.method === 'POST')?.body).toEqual({ medicineId: medicine.id, quantity: 12.5, unit: 'TABLET', source: 'MANUAL' });
});

test('uncertain stock save keeps explicit inputs and does not replay the POST on refresh', async ({ page }) => {
  const { calls, state } = await mockApi(page);
  state.stockFail = true;
  await page.goto('/portal');
  await navigate(page, 'Medicines');
  await page.getByRole('button', { name: `Open ${medicine.name}`, exact: true }).click();
  await page.getByLabel('Stock quantity', { exact: true }).fill('3');
  await page.getByLabel(/^Stock unit/).selectOption('ML');
  await page.getByLabel('Expiry date YYYY-MM-DD (optional)', { exact: true }).fill('2027-09-25');
  await page.getByRole('button', { name: 'Add to My Pharmacy', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('SERVICE_UNAVAILABLE');
  await expect(page.getByRole('button', { name: 'Add to My Pharmacy', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Stock quantity', { exact: true })).toHaveValue('3');
  expect(calls.find(call => call.path === '/api/backend/me/inventory' && call.method === 'POST')?.body).toEqual({ medicineId: medicine.id, quantity: 3, unit: 'ML', expiryDate: '2027-09-25', source: 'MANUAL' });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect(calls.filter(call => call.path === '/api/backend/me/inventory' && call.method === 'POST')).toHaveLength(1);
});

test('logout in another tab broadcasts and clears private content and unsaved preferences', async ({ page, context }) => {
  const first = await mockApi(page);
  const other = await context.newPage();
  await mockApi(other);
  await page.goto('/portal');
  await navigate(page, 'Settings');
  await page.getByLabel('Dose reminders', { exact: true }).check();
  await other.goto('/portal');
  await navigate(other, 'Settings');
  first.state.authenticated = false;
  await other.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Dose reminders', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(other.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});


test('configured preferences save only the five visible flags, preserving unseen API settings', async ({ page }) => {
  const { calls, state } = await mockApi(page);
  state.configured = true;
  state.flags.doseReminders = true;
  await page.goto('/portal');
  await navigate(page, 'Settings');
  await expect(page.getByText('Your saved choices', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Dose reminders', { exact: true })).toBeChecked();
  await page.getByLabel('Expiry reminders', { exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText(/Preferences saved/)).toBeVisible();
  const submitted = calls.find(call => call.path.endsWith('/notification-preferences') && call.method === 'PATCH')?.body;
  expect(submitted).toEqual({ ...allOff, doseReminders: true, expiryReminders: true });
  expect(submitted).not.toHaveProperty('expiryLeadDays');
});
