import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the real interactive map; this workflow does not need external map tiles.
  await page.route('**/map/style.json', (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#222622' } },
        ],
      },
    }),
  );
});

async function fillSuggestion(page: Page, name = 'Riverside Test Court') {
  await page.goto('/venues/new');
  await page.getByLabel('Venue name', { exact: true }).fill(name);
  await page.getByLabel('Address', { exact: true }).fill('Riga, Test iela 12');
}

test('venue suggestions prevent repeated submission while saving', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/venue-requests', async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { message: 'Please try again.' } });
  });
  await fillSuggestion(page);
  const submit = page.getByRole('button', { name: 'Send for review' });
  try {
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
  } finally {
    release();
  }
  await expect(submit).toBeEnabled();
});

test('failed suggestions keep the form and explain how to retry', async ({ page }) => {
  await page.route('**/api/venue-requests', (route) =>
    route.fulfill({ status: 503, json: { message: 'Suggestions are temporarily unavailable.' } }),
  );
  await fillSuggestion(page);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText(
    'Suggestions are temporarily unavailable.',
  );
  await expect(page.getByLabel('Venue name', { exact: true })).toHaveValue('Riverside Test Court');
  await expect(page.getByRole('button', { name: 'Send for review' })).toBeEnabled();
});

test('a suggestion resets for another venue and an admin can approve it', async ({ page }) => {
  await fillSuggestion(page, 'Suggested Riverside Court');
  await page.getByRole('button', { name: 'Football', exact: true }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByRole('heading', { name: /suggestion is pending review/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add another venue' }).click();
  await expect(page.getByLabel('Venue name', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Basketball', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Football', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.goto('/login?next=/admin');
  await page.getByLabel('Email', { exact: true }).fill('admin@matchplay.local');
  await page.getByLabel('Password', { exact: true }).fill('MatchPlay2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: /^Requests/ }).click();
  const request = page.locator('.admin-venue').filter({ hasText: 'Suggested Riverside Court' });
  await request.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(request.getByText('APPROVED', { exact: true })).toBeVisible();
  const venues = await (await page.request.get('/api/venues')).json();
  expect(venues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'Suggested Riverside Court',
        address: 'Riga, Test iela 12',
        latitude: 56.957,
        longitude: 24.113,
        sports: ['Basketball', 'Football'],
        active: true,
      }),
    ]),
  );
});

test('a slow address lookup preserves a manual correction', async ({ page }) => {
  let release!: () => void;
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const completed = new Promise<void>((resolve) => (complete = resolve));
  await page.route('https://nominatim.openstreetmap.org/reverse**', async (route) => {
    await pending;
    await route.fulfill({ json: { display_name: 'Automatic address, Riga' } }).catch(() => {});
    complete();
  });
  await fillSuggestion(page);
  await expect(page.locator('.map-loading')).toHaveCount(0, { timeout: 20_000 });
  const lookup = page.waitForRequest((request) => request.url().includes('/reverse?'));
  await page.locator('.place-map-canvas canvas').click({ position: { x: 100, y: 100 } });
  await lookup;
  await page.getByLabel('Address', { exact: true }).fill('My corrected address, Riga');
  release();
  await completed;
  await expect(page.getByText('Finding the nearest address…', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue(
    'My corrected address, Riga',
  );
});

test('an unavailable address lookup asks for an address for the new pin', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/reverse**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await fillSuggestion(page);
  await expect(page.locator('.map-loading')).toHaveCount(0, { timeout: 20_000 });
  await page.locator('.place-map-canvas canvas').click({ position: { x: 100, y: 100 } });
  await expect(page.getByText(/enter the address manually/i)).toBeVisible();
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue('');
});

test('a new suggestion discards lookups started while the previous suggestion was saving', async ({
  page,
}) => {
  let save!: () => void;
  let locate!: () => void;
  let complete!: () => void;
  const saving = new Promise<void>((resolve) => (save = resolve));
  const locating = new Promise<void>((resolve) => (locate = resolve));
  const completed = new Promise<void>((resolve) => (complete = resolve));
  await page.route('**/api/venue-requests', async (route) => {
    await saving;
    await route.fallback();
  });
  await page.route('https://nominatim.openstreetmap.org/reverse**', async (route) => {
    await locating;
    await route.fulfill({ json: { display_name: 'Previous pin address, Riga' } }).catch(() => {});
    complete();
  });
  await fillSuggestion(page, 'Reset Race Test Court');
  await expect(page.locator('.map-loading')).toHaveCount(0);
  try {
    await page.getByRole('button', { name: 'Send for review' }).click();
    const lookup = page.waitForRequest((request) => request.url().includes('/reverse?'));
    await page.locator('.place-map-canvas canvas').click({ position: { x: 100, y: 100 } });
    await lookup;
    save();
    await expect(page.getByRole('heading', { name: /suggestion is pending review/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add another venue' }).click();
    await expect(page.getByRole('button', { name: 'Send for review' })).toBeEnabled();
  } finally {
    save();
    locate();
  }
  await completed;
  await expect(page.getByText('Finding the nearest address…', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue('');
});
