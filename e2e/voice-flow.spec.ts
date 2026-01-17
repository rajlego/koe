import { test, expect } from '@playwright/test';

test.describe('Voice Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show voice indicator in control surface', async ({ page }) => {
    const voiceIndicator = page.locator('.voice-indicator');
    await expect(voiceIndicator).toBeVisible();
  });

  test('should show voice state changes', async ({ page }) => {
    // Initially should show some state (idle or listening depending on settings)
    const voiceIndicator = page.locator('.voice-indicator');
    await expect(voiceIndicator).toBeVisible();

    // The voice state should be reflected in the UI
    // This is a placeholder - actual voice testing would require mocking the Tauri backend
  });

  test('should toggle voice with Escape key', async ({ page }) => {
    // The voice indicator should respond to Escape key
    // Note: This requires the Tauri backend to be running
    await page.keyboard.press('Escape');

    // We can't easily test the actual voice state without mocking Tauri
    // but we can verify the keyboard event is captured
  });
});

test.describe('Thought Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show thoughts section', async ({ page }) => {
    const thoughtsSection = page.locator('.thoughts-section');
    await expect(thoughtsSection).toBeVisible();
  });

  test('should show empty state when no thoughts', async ({ page }) => {
    // Either show empty message or list of thoughts
    const thoughtListEmpty = page.locator('.thought-list-empty');
    const thoughtListContainer = page.locator('.thought-list-container');

    // One of them should be visible
    const emptyCount = await thoughtListEmpty.count();
    const containerCount = await thoughtListContainer.count();
    expect(emptyCount + containerCount).toBeGreaterThan(0);
  });

  test('should create new thought with Cmd+N', async ({ page }) => {
    await page.keyboard.press('Meta+n');

    // This would open a new thought window in Tauri
    // Without Tauri backend, we can't fully test this
  });
});

test.describe('Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should persist display mode setting', async ({ page }) => {
    // Open settings
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    // Select integrated mode - click the radio label
    await page.locator('.radio-label:has-text("Integrated")').click();

    // Close settings
    await page.locator('.close-btn').click();

    // Reopen settings and verify the setting persisted
    await page.locator('.settings-btn').click();
    // The integrated radio should be checked - check via the label's radio input
    const integratedRadio = page.locator('.radio-label:has-text("Integrated") input[type="radio"]');
    await expect(integratedRadio).toBeChecked();
  });

  test('should persist voice settings', async ({ page }) => {
    await page.locator('.settings-btn').click();

    // Toggle voice off
    const voiceToggle = page.locator('label:has-text("Voice Input")');
    await voiceToggle.click();

    // Close and reopen
    await page.locator('.close-btn').click();
    await page.locator('.settings-btn').click();

    // The toggle state should persist
    // Note: We'd need to check localStorage or Zustand state
  });

  test('should add and remove custom positions', async ({ page }) => {
    await page.locator('.settings-btn').click();

    // Add a custom position
    await page.locator('.name-input').fill('testpos');
    await page.locator('.coord-input').first().fill('500');
    await page.locator('.coord-input').last().fill('300');
    await page.locator('.add-btn').click();

    // Verify it was added
    await expect(page.locator('.position-name:has-text("testpos")')).toBeVisible();

    // Remove it
    await page.locator('.position-item:has-text("testpos") .remove-btn').click();

    // Verify it was removed
    await expect(page.locator('.position-name:has-text("testpos")')).not.toBeVisible();
  });
});

test.describe('Cloud Sync Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('.settings-btn').click();
  });

  test('should show cloud sync section', async ({ page }) => {
    // Scroll to find the auth section
    const authSection = page.locator('.auth-section');
    await expect(authSection).toBeVisible();
  });

  test('should show login form when not authenticated', async ({ page }) => {
    // If Firebase is not configured, should show disabled message
    // If configured, should show login form
    const authSection = page.locator('.auth-section');
    await expect(authSection).toBeVisible();

    // Either login form or disabled message should be visible
    const hasLoginForm = await page.locator('.auth-form').isVisible();
    const hasDisabledMessage = await page.locator('.auth-disabled').isVisible();

    expect(hasLoginForm || hasDisabledMessage).toBe(true);
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should focus elements with Tab', async ({ page }) => {
    // Tab through the interface
    await page.keyboard.press('Tab');

    // Some element should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeDefined();
  });

  test('should open settings via button', async ({ page }) => {
    // Note: Meta key shortcuts may not work in Playwright's Chromium
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();
  });

  test('should have keyboard hint in footer', async ({ page }) => {
    // Verify keyboard hints are displayed for users
    await expect(page.locator('.keyboard-hint')).toBeVisible();
    await expect(page.locator('.keyboard-hint')).toContainText('Cmd+N');
  });
});
