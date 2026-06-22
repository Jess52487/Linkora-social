import { Page, expect } from '@playwright/test';

const MOCK_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export async function injectWalletMock(page: Page): Promise<void> {
  await page.addInitScript((address) => {
    (window as Window & { freighterApi?: unknown }).freighterApi = {
      getPublicKey: () => Promise.resolve({ publicKey: address }),
      isConnected: () => Promise.resolve(true),
      onNetworkChange: () => {},
    };
  }, MOCK_ADDRESS);
}

export async function waitForWalletConnection(page: Page, timeout = 15000): Promise<string> {
  await page.locator('[data-testid="disconnect-wallet"]').waitFor({ timeout });
  return (await page.locator('[data-testid="wallet-address"]').first().textContent()) ?? '';
}

export async function connectWallet(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');

  // On mobile viewports the desktop nav is hidden via CSS and the connect
  // button lives inside the hamburger drawer. Click the hamburger first.
  // We try clicking it regardless of isVisible() since CSS media queries
  // can make the element technically present but not yet reported visible.
  const hamburger = page.locator('[aria-label="Toggle navigation menu"]').first();

  // If the desktop connect button is already visible, skip the hamburger.
  const desktopBtn = page.locator('[data-testid="connect-wallet"]').first();
  const desktopVisible = await desktopBtn.isVisible().catch(() => false);

  if (!desktopVisible) {
    // Mobile: open the drawer
    try {
      await hamburger.click({ timeout: 5000 });
    } catch {
      // hamburger not found or not clickable — desktop layout, proceed anyway
    }
    // Wait for the drawer's connect button to appear
    await page.locator('[data-testid="connect-wallet"]').first().waitFor({ state: 'visible', timeout: 8000 });
  }

  // Now click whichever connect button is visible
  const connectBtn = page.locator('[data-testid="connect-wallet"]').first();
  await expect(connectBtn).toBeVisible({ timeout: 10000 });
  await connectBtn.click();

  await waitForWalletConnection(page);
}

export async function navigateToProfile(page: Page, address: string): Promise<void> {
  await page.goto(`/profile/${address}`);
}

export async function navigateToPostDetail(page: Page, postId: string): Promise<void> {
  await page.goto(`/posts/${postId}`);
}

export async function navigateToFeed(page: Page): Promise<void> {
  await page.goto('/feed');
}

export async function createPost(page: Page, content: string): Promise<void> {
  const composeButton = page.locator('button:has-text("Compose"), button:has-text("New Post")').first();
  await composeButton.click();
  await page.locator('textarea').first().fill(content);
  await page.locator('button:has-text("Post"), button:has-text("Submit")').first().click();
  await page.waitForTimeout(1000);
}

export async function waitForPostInFeed(page: Page, content: string, timeout = 10000): Promise<void> {
  await page.locator(`text="${content}"`).first().waitFor({ timeout });
}

export async function clickPostInFeed(page: Page, content: string): Promise<void> {
  await page.locator(`article:has-text("${content}")`).first().click();
}

export async function tipPost(page: Page, amount = 1): Promise<void> {
  const tipButton = page.locator('button:has-text("Tip"), button:has-text("Support")').first();
  await tipButton.click();
  const amountInput = page.locator('input[type="number"]').first();
  if (await amountInput.isVisible()) await amountInput.fill(amount.toString());
  await page.locator('button:has-text("Confirm"), button:has-text("Send")').first().click();
  await page.waitForTimeout(2000);
}

export { MOCK_ADDRESS };
