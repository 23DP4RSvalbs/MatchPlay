import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('MatchPlay2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`http://localhost:5174${next}`);
}

test('two players join by code, chat, score live and save the final result', async ({
  browser,
}) => {
  const organiser = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const teammate = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await organiser.newPage();
  const blue = await teammate.newPage();
  const errors: string[] = [];
  for (const page of [host, blue]) page.on('pageerror', (e) => errors.push(e.message));
  try {
    await login(host, 'janis@matchplay.local', '/games/new?venue=riga-arena');
    await host.getByLabel('Game name').fill('Browser test hoops');
    await host.getByRole('button', { name: 'CREATE GAME', exact: true }).click();
    await expect(host.getByRole('heading', { name: 'MATCH LOBBY' })).toBeVisible();
    const matchUrl = host.url();
    const code = (await host.locator('.game-code strong').innerText()).trim();
    await login(blue, 'captain@matchplay.local', '/games');
    await blue.getByRole('button', { name: 'Join with code' }).click();
    await blue.getByLabel('Game code').fill(code);
    await blue.getByRole('button', { name: 'Find game' }).click();
    await expect(blue).toHaveURL(matchUrl);
    await blue.getByRole('button', { name: 'JOIN BLUE', exact: true }).click();
    await expect(host.getByText('Roberts Z.', { exact: true })).toBeVisible();
    await expect(blue.getByText('Live updates', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Manage Roberts Z.' }).click();
    await host.getByRole('button', { name: 'Make captain' }).click();
    await blue.getByLabel('Chat message').fill('Ready to play!');
    await blue.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByText('Ready to play!', { exact: false })).toBeVisible();
    await host.getByRole('button', { name: 'START GAME' }).click();
    await expect(blue.getByRole('heading', { name: 'LIVE MATCH' })).toBeVisible();
    await expect(
      blue.getByRole('button', { name: 'Add 1 point to orange', exact: true }),
    ).toHaveCount(0);
    await expect(blue.getByRole('button', { name: 'Finish game' })).toHaveCount(0);
    await host.getByRole('button', { name: 'Add 3 points to orange', exact: true }).click();
    await expect(blue.getByTestId('orange-score')).toHaveText('3');
    await blue.getByRole('button', { name: 'Add 2 points to blue', exact: true }).click();
    await expect(host.getByTestId('blue-score')).toHaveText('2');
    await host.getByRole('button', { name: 'Pause clock' }).click();
    await expect(blue.getByText('PAUSED', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Next period' }).click();
    await expect(blue.getByText('2ND QUARTER', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Finish game' }).click();
    await host.getByRole('button', { name: 'Save final score' }).click();
    await expect(blue.getByRole('heading', { name: 'FINAL SCORE' })).toBeVisible();
    await blue.reload();
    await expect(blue.getByTestId('orange-score')).toHaveText('3');
    await expect(blue.getByTestId('blue-score')).toHaveText('2');
    await expect(
      blue.getByRole('button', { name: 'Add 2 points to blue', exact: true }),
    ).toHaveCount(0);
    await host.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(host.getByText('Browser test hoops', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await organiser.close();
    await teammate.close();
  }
});

test('map, search and venue navigation work at desktop and phone sizes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const size of [
    { width: 1440, height: 900 },
    { width: 485, height: 1025 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'NEARBY VENUES' })).toBeVisible();
    await expect(page.locator('.map-loading')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
    await expect(page.locator('.venue-card')).toHaveCount(3);
    const heights = await page
      .locator('.venue-card')
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Search venues or sports', { exact: true }).fill('Hanzas');
    await expect(page.locator('.venue-card')).toHaveCount(1);
    await page.getByRole('link', { name: 'Hanzas Vidusskolas Laukums', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Hanzas Vidusskolas Laukums' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CREATE GAME', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});

test('admin can add, edit and retire a venue without deleting its record', async ({ page }) => {
  await login(page, 'admin@matchplay.local', '/admin');
  await page.getByRole('button', { name: 'Add venue', exact: true }).click();
  await page.getByLabel('Venue name').fill('Browser Test Arena');
  await page.getByLabel('Address', { exact: true }).fill('Test iela 10, Riga');
  await page.getByRole('button', { name: 'Save venue', exact: true }).click();
  const card = page.locator('.admin-venue').filter({ hasText: 'Browser Test Arena' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Edit venue' }).click();
  await page.getByLabel('Venue name').fill('Browser Test Arena Updated');
  await page.getByRole('button', { name: 'Save venue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser Test Arena Updated' })).toBeVisible();
  await page.getByRole('button', { name: 'Retire Browser Test Arena Updated' }).click();
  await page.getByRole('button', { name: 'Retire venue', exact: true }).click();
  await expect(
    page
      .locator('.admin-venue')
      .filter({ hasText: 'Browser Test Arena Updated' })
      .getByText('RETIRED', { exact: true }),
  ).toBeVisible();
});

test('Explore receives score changes from another session', async ({ page, browser }) => {
  await page.goto('/');
  const preview = page.getByRole('link', { name: 'View live game Skanste Court Run', exact: true });
  await expect(preview.locator('strong').first()).toHaveText('78');
  const context = await browser.newContext();
  const host = await context.newPage();
  try {
    await login(host, 'janis@matchplay.local', '/games/live-hoops');
    await host.getByRole('button', { name: 'Add 1 point to orange', exact: true }).click();
    await expect(preview.locator('strong').first()).toHaveText('79');
  } finally {
    await context.close();
  }
});

test('a new account can edit its profile, sign out and sign back in', async ({ page }) => {
  await page.goto('/register?next=/profile');
  await page.getByLabel('Your name').fill('Browser New Player');
  await page.getByLabel('Email', { exact: true }).fill('browser-new@test.local');
  await page.getByLabel('Password', { exact: true }).fill('MatchPlay2026!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser New Player' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('Your name').fill('Browser Edited Player');
  await page.getByLabel('City', { exact: true }).fill('Jurmala');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Edited Player' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'browser-new@test.local', '/profile');
  await expect(page.getByRole('heading', { name: 'Browser Edited Player' })).toBeVisible();
});

test('all sports can be selected and created with a compatible venue', async ({ page }) => {
  await login(page, 'janis@matchplay.local', '/games/new?venue=hanzas');
  await expect(page.getByRole('button', { name: 'Football', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const [sport, capacity] of [
    ['Basketball', 5],
    ['Football', 5],
    ['Volleyball', 6],
    ['Tennis', 1],
  ] as const) {
    await page.setViewportSize({ width: sport === 'Tennis' ? 390 : 1440, height: 900 });
    await page.getByRole('button', { name: sport, exact: true }).click();
    await expect(page.getByRole('button', { name: sport, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Players per team')).toHaveValue(String(capacity));
    await expect(page.getByText(`${sport} scoring`, { exact: true })).toBeVisible();
    const fields = await page.locator('.form-row input').evaluateAll((inputs) =>
      inputs.map((input) => {
        const { top, height } = input.getBoundingClientRect();
        return { top, height };
      }),
    );
    expect(Math.abs(fields[0].top - fields[1].top)).toBeLessThan(1);
    expect(Math.abs(fields[0].height - fields[1].height)).toBeLessThan(1);
    const venueId = await page.getByRole('combobox', { name: 'Venue', exact: true }).inputValue();
    const venue = await (await page.request.get(`/api/venues/${venueId}`)).json();
    expect(venue.sports).toContain(sport);
    await page.getByLabel('Game name').fill(`Selectable ${sport} game`);
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/matches') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'CREATE GAME', exact: true }).click();
    const saved = await (await response).json();
    expect(saved.sport).toBe(sport);
    expect(saved.venueId).toBe(venueId);
    expect(saved.capacity).toBe(capacity);
    await expect(page.getByRole('heading', { name: 'MATCH LOBBY' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/games/new?venue=hanzas');
  }
});

test('reduced motion keeps navigation, sport selection and profile usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'roberts@matchplay.local', '/games/new?venue=hanzas');
  await page.getByRole('button', { name: 'Tennis', exact: true }).click();
  await expect(page.getByText('Tennis scoring', { exact: true })).toBeVisible();
  expect(
    await page.locator('main').evaluate((main) => main.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Roberts H.' })).toBeVisible();
  const sizes = await page.locator('.stats-grid > div').evaluateAll((cards) =>
    cards.map((card) => ({
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    })),
  );
  expect(
    Math.max(...sizes.map((s) => s.height)) - Math.min(...sizes.map((s) => s.height)),
  ).toBeLessThan(1);
  expect(
    Math.max(...sizes.map((s) => s.width)) - Math.min(...sizes.map((s) => s.width)),
  ).toBeLessThan(1);
  expect(
    await page.locator('main').evaluate((main) => main.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
