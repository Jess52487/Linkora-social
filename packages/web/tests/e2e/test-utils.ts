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

  // Try opening a mobile hamburger drawer using multiple selector fallbacks.
  const hamburgerSelectors = [
    '[aria-label="Toggle navigation menu"]',
    '[aria-label*="Toggle"]',
    '[aria-label*="toggle"]',
    'button[aria-label*="menu"]',
    'button[aria-label*="navigation"]',
  ];

  for (const sel of hamburgerSelectors) {
    try {
      const h = page.locator(sel).first();
      if (await h.isVisible().catch(() => false)) {
        await h.click();
        await page.waitForTimeout(600);
        break;
      }
    } catch {
      // try next selector
    }
  }

  // Robust set of selectors for the Connect Wallet button.
  const connectSelectors = [
    '[data-testid="connect-wallet"]',
    '[data-testid*="connect"]',
    'button:has-text("Connect Wallet")',
    'button:has-text("Connect")',
  ];

  let connectBtn: ReturnType<Page['locator']> | null = null;

  // Fast path: already visible
  for (const sel of connectSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      connectBtn = loc;
      break;
    }
  }

  // Fallback: wait for it to appear (drawer may still be animating)
  if (!connectBtn) {
    for (const sel of connectSelectors) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        connectBtn = loc;
        break;
      } catch {
        // try next
      }
    }
  }

  if (!connectBtn) {
    throw new Error(
      `Connect wallet button not found. Tried: ${connectSelectors.join(', ')}`
    );
  }

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
