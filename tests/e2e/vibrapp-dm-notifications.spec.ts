import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_vibrapp_dm_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `VibrappDm_${label}_${RUN_ID}`,
  };
  const response = await request.post("/api/auth/register", {
    data: { ...credentials, age: 25, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Register ${label}: ${response.status()} – ${await response.text()}`);
  }
  return credentials;
}

async function loginAs(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { email: credentials.email, password: credentials.password, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Login ${credentials.email}: ${response.status()} – ${await response.text()}`);
  }
  const profileResponse = await request.get("/api/profiles/me");
  if (!profileResponse.ok()) {
    throw new Error(`profiles/me: ${profileResponse.status()} – ${await profileResponse.text()}`);
  }
  return ((await profileResponse.json()) as { id: string }).id;
}

async function allowUnverifiedTestAccount(page: Page) {
  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      await route.fulfill({ response });
      return;
    }
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...body, emailVerified: true }),
    });
  });
}

async function openAuthenticatedPage(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await allowUnverifiedTestAccount(page);
  await page.goto(path, { waitUntil: "load" });
  return page;
}

test("foreground DMs appear once and background push opens the right thread after reopening", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const recipientContext = await browser.newContext();
  const senderContext = await browser.newContext();

  try {
    const recipientRequest = recipientContext.request;
    const senderRequest = senderContext.request;

    const recipient = await registerUser(recipientRequest, "recipient");
    const sender = await registerUser(senderRequest, "sender");
    const recipientProfileId = await loginAs(recipientRequest, recipient);
    const senderProfileId = await loginAs(senderRequest, sender);

    const recipientPage = await openAuthenticatedPage(
      recipientContext,
      `/vibrapp?dm=${encodeURIComponent(senderProfileId)}`,
    );
    const senderPage = await openAuthenticatedPage(
      senderContext,
      `/vibrapp?dm=${encodeURIComponent(recipientProfileId)}`,
    );

    const recipientInput = recipientPage.getByTestId("input-dm-message");
    const senderInput = senderPage.getByTestId("input-dm-message");
    await expect(recipientInput).toBeEnabled();
    await expect(senderInput).toBeEnabled();

    const foregroundText = `foreground ${RUN_ID}`;
    await senderInput.fill(foregroundText);
    await senderPage.getByTestId("button-send-dm").click();

    const foregroundMessage = recipientPage.locator('[data-testid^="dm-msg-"]').filter({
      hasText: foregroundText,
    });
    await expect(foregroundMessage).toHaveCount(1);

    // Simulate the browser's background visibility event. Playwright's isolated
    // headless contexts can report every tab as visible even after bringToFront.
    await recipientPage.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => recipientPage.evaluate(() => document.visibilityState)).toBe("hidden");

    const backgroundText = `background ${RUN_ID}`;
    await senderInput.fill(backgroundText);
    await senderPage.getByTestId("button-send-dm").click();

    const notificationUrl = `/vibrapp?dm=${encodeURIComponent(senderProfileId)}`;

    const serviceWorker = recipientContext.serviceWorkers().find((worker) =>
      new URL(worker.url()).pathname === "/sw.js",
    );
    expect(serviceWorker, "Vibrapp's service worker should be active for notification handling").toBeTruthy();

    const pushPayload = {
      title: sender.name,
      body: backgroundText,
      icon: "/icons/icon-192.png",
      url: notificationUrl,
      type: "vibrapp-dm",
    };
    const capturedNotification = await serviceWorker!.evaluate(async (payload) => {
      Object.defineProperty(self.registration, "showNotification", {
        configurable: true,
        value: async (title: string, options: NotificationOptions) => {
          (self as any).__e2eVibrappNotification = { title, options };
        },
      });
      self.dispatchEvent(new PushEvent("push", { data: JSON.stringify(payload) }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      return (self as any).__e2eVibrappNotification;
    }, pushPayload);
    expect(capturedNotification).toMatchObject({
      title: sender.name,
      options: {
        body: backgroundText,
        data: { url: notificationUrl, type: "vibrapp-dm" },
        tag: "vibrapp-dm-msg",
      },
    });

    await serviceWorker!.evaluate((url) => {
      let clickWork: Promise<unknown> = Promise.resolve();
      const notificationClick = new Event("notificationclick");
      Object.defineProperties(notificationClick, {
        notification: {
          value: { data: { url }, close: () => {} },
        },
        waitUntil: {
          value: (promise: PromiseLike<unknown>) => {
            // Synthetic notification clicks are not trusted browser gestures, so
            // Chromium may reject the final focus() call after navigate() succeeds.
            clickWork = Promise.resolve(promise).catch(() => undefined);
          },
        },
      });
      self.dispatchEvent(notificationClick);
      return clickWork;
    }, notificationUrl);

    await expect(recipientPage).toHaveURL(new RegExp(`/vibrapp\\?dm=${senderProfileId}$`));
    await expect(recipientPage.getByTestId("dm-panel")).toBeVisible();
    await recipientPage.reload({ waitUntil: "load" });
    await expect(recipientPage.getByTestId("dm-panel")).toBeVisible();
    await expect(
      recipientPage.locator('[data-testid^="dm-msg-"]').filter({ hasText: foregroundText }),
    ).toHaveCount(1);
    await expect(
      recipientPage.locator('[data-testid^="dm-msg-"]').filter({ hasText: backgroundText }),
    ).toHaveCount(1);
    await expect(recipientPage.locator('[data-testid^="dm-msg-"]')).toHaveCount(2);
  } finally {
    await senderContext.close();
    await recipientContext.close();
  }
});