import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PUSH_DECISION_KEY = "vibra-push-decision-made";

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_notifications_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `Notifications_${label}_${RUN_ID}`,
  };
  const response = await request.post("/api/auth/register", {
    data: { ...credentials, age: 25, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Register ${label}: ${response.status()} – ${await response.text()}`);
  }
  return credentials;
}

async function loginAs(request: APIRequestContext, credentials: Credentials) {
  const response = await request.post("/api/auth/login", {
    data: { ...credentials, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Login ${credentials.email}: ${response.status()} – ${await response.text()}`);
  }
}

async function injectSessionCookies(page: Page, request: APIRequestContext) {
  const state = await request.storageState();
  await page.context().addCookies(
    state.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "localhost",
      path: cookie.path || "/",
      httpOnly: cookie.httpOnly ?? true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function patchEmailVerified(page: Page) {
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

async function prepareAuthenticatedPage(
  page: Page,
  request: APIRequestContext,
  credentials: Credentials,
  options: {
    supported?: boolean;
    permission?: "default" | "denied";
    permissionThrows?: boolean;
    permissionRequestThrows?: boolean;
    storageMode?: "write-fails" | "read-and-write-fail";
    storageAccessThrows?: boolean;
  } = {},
) {
  const {
    supported = true,
    permission = "default",
    permissionThrows = false,
    permissionRequestThrows = false,
    storageMode,
    storageAccessThrows = false,
  } = options;

  await page.addInitScript(
    ({ supported, permission, permissionThrows, permissionRequestThrows, decisionKey, storageAccessThrows }) => {
      window.localStorage.setItem("vibra-splash-seen", "1");

      const storageMode = new URLSearchParams(window.location.search).get("notificationStorage");
      const storagePrototype = Storage.prototype;
      const originalGetItem = storagePrototype.getItem;
      const originalSetItem = storagePrototype.setItem;
      const storageFailures = { reads: 0, writes: 0 };
      (window as typeof window & {
        __notificationStorageFailures?: typeof storageFailures;
      }).__notificationStorageFailures = storageFailures;

      Object.defineProperty(storagePrototype, "getItem", {
        configurable: true,
        value: function (key: string) {
          if (key === decisionKey && storageMode === "read-and-write-fail") {
            storageFailures.reads += 1;
            throw new Error("Notification decision storage read failed");
          }
          return Reflect.apply(originalGetItem, this, [key]);
        },
      });
      Object.defineProperty(storagePrototype, "setItem", {
        configurable: true,
        value: function (key: string, value: string) {
          if (
            key === decisionKey &&
            (storageMode === "write-fails" || storageMode === "read-and-write-fail")
          ) {
            storageFailures.writes += 1;
            throw new Error("Notification decision storage write failed");
          }
          return Reflect.apply(originalSetItem, this, [key, value]);
        },
      });

      const originalNotification = window.Notification;
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: new Proxy(originalNotification, {
          get(target, property, receiver) {
            if (property === "permission") {
              const testWindow = window as typeof window & {
                __notificationPermissionReads?: number;
              };
              testWindow.__notificationPermissionReads =
                (testWindow.__notificationPermissionReads || 0) + 1;
              if (permissionThrows) {
                throw new Error("Notification.permission access failed");
              }
              return permission;
            }
            if (property === "requestPermission") {
              return () => {
                (window as typeof window & { __notificationPermissionCalls?: number })
                  .__notificationPermissionCalls =
                  ((window as typeof window & { __notificationPermissionCalls?: number })
                    .__notificationPermissionCalls || 0) + 1;
                if (permissionRequestThrows) {
                  throw new Error("Notification.requestPermission failed");
                }
                return Promise.resolve("denied");
              };
            }
            return Reflect.get(target, property, receiver);
          },
        }),
      });

      if (!supported) {
        delete (window as typeof window & { PushManager?: unknown }).PushManager;
      }

      if (storageAccessThrows) {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() {
            const testWindow = window as typeof window & {
              __localStorageAccessFailures?: number;
            };
            testWindow.__localStorageAccessFailures =
              (testWindow.__localStorageAccessFailures || 0) + 1;
            throw new Error("Access to window.localStorage is blocked");
          },
        });
      }
    },
    {
      supported,
      permission,
      permissionThrows,
      permissionRequestThrows,
      decisionKey: PUSH_DECISION_KEY,
      storageAccessThrows,
    },
  );
  await loginAs(request, credentials);
  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  const path = storageMode ? `/?notificationStorage=${storageMode}` : "/";
  await page.goto(path, { waitUntil: "load" });
}

test("notification prompt appears only when supported and undecided", async ({ page, request }) => {
  const supportedUser = await registerUser(request, "supported");
  await prepareAuthenticatedPage(page, request, supportedUser);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("button-dismiss-notifications-banner")).toBeVisible();

  const unsupportedUser = await registerUser(request, "unsupported");
  await prepareAuthenticatedPage(page, request, unsupportedUser, { supported: false });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});

test("a denied notification permission hides the prompt without requesting again", async ({ page, request }) => {
  const user = await registerUser(request, "permission-denied");
  await prepareAuthenticatedPage(page, request, user, { permission: "denied" });

  await expect(page.getByTestId("hub-card-dating")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
  await expect(page.evaluate(() => Notification.permission)).resolves.toBe("denied");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionReads?: number })
          .__notificationPermissionReads || 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionCalls?: number })
          .__notificationPermissionCalls || 0,
      ),
    )
    .toBe(0);

  await page.getByTestId("hub-card-dating").click();
  await expect(page).toHaveURL(/\/dating$/);
  await expect(page.getByTestId("vibra-logo-header")).toBeVisible();
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionCalls?: number })
          .__notificationPermissionCalls || 0,
      ),
    )
    .toBe(0);
});

test("permission access errors keep the authenticated app usable without showing or requesting the prompt", async ({
  page,
  request,
}) => {
  const user = await registerUser(request, "permission-error");
  await prepareAuthenticatedPage(page, request, user, { permissionThrows: true });

  await expect(page.getByTestId("vibra-logo-header")).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionReads?: number })
          .__notificationPermissionReads || 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionCalls?: number })
          .__notificationPermissionCalls || 0,
      ),
    )
    .toBe(0);
});

test("dismissing the notification prompt persists after reload", async ({ page, request }) => {
  const user = await registerUser(request, "dismiss");
  await prepareAuthenticatedPage(page, request, user);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-dismiss-notifications-banner").click();

  await expect(banner).not.toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PUSH_DECISION_KEY))
    .toBe("true");

  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});

test("notification choice stays hidden when decision storage throws", async ({ page, request }) => {
  const user = await registerUser(request, "storage-unavailable");
  await prepareAuthenticatedPage(page, request, user, { storageMode: "write-fails" });

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-dismiss-notifications-banner").click();
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & {
        __notificationStorageFailures?: { reads: number; writes: number };
      }).__notificationStorageFailures?.writes || 0),
    )
    .toBe(1);

  await page.evaluate(() => {
    history.replaceState(null, "", "/?notificationStorage=read-and-write-fail");
  });
  await page.reload({ waitUntil: "load" });

  await expect(page.getByTestId("vibra-logo-header")).toBeVisible();
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & {
        __notificationStorageFailures?: { reads: number; writes: number };
      }).__notificationStorageFailures?.reads || 0),
    )
    .toBeGreaterThan(0);
});

test("blocked localStorage access keeps the authenticated app usable without showing the prompt", async ({
  page,
  request,
}) => {
  const user = await registerUser(request, "storage-access-blocked");
  await prepareAuthenticatedPage(page, request, user, { storageAccessThrows: true });

  const banner = page.getByTestId("notification-banner");
  await expect(page.getByTestId("vibra-logo-header")).toBeVisible({ timeout: 10_000 });
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __localStorageAccessFailures?: number })
          .__localStorageAccessFailures || 0,
      ),
    )
    .toBeGreaterThan(0);

  await page.reload({ waitUntil: "load" });

  await expect(page.getByTestId("vibra-logo-header")).toBeVisible();
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __localStorageAccessFailures?: number })
          .__localStorageAccessFailures || 0,
      ),
    )
    .toBeGreaterThan(0);
});

test("requestPermission errors leave the authenticated app usable and settle the prompt", async ({ page, request }) => {
  const user = await registerUser(request, "request-permission-error");
  await prepareAuthenticatedPage(page, request, user, { permissionRequestThrows: true });

  const uncaughtErrors: string[] = [];
  page.on("pageerror", (error) => uncaughtErrors.push(error.message));

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-enable-notifications-banner").click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionCalls?: number })
          .__notificationPermissionCalls || 0,
      ),
    )
    .toBe(1);
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PUSH_DECISION_KEY))
    .toBe("true");
  await expect(page.getByTestId("vibra-logo-header")).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(uncaughtErrors).toEqual([]);
});

test("profile notification settings remain usable when requestPermission throws", async ({ page, request }) => {
  const user = await registerUser(request, "profile-request-permission-error");
  await prepareAuthenticatedPage(page, request, user, { permissionRequestThrows: true });

  const uncaughtErrors: string[] = [];
  page.on("pageerror", (error) => uncaughtErrors.push(error.message));
  await page.goto("/profile", { waitUntil: "load" });

  const notificationButton = page.getByTestId("button-push-notifications");
  await expect(notificationButton).toBeVisible({ timeout: 10_000 });
  await notificationButton.click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __notificationPermissionCalls?: number })
          .__notificationPermissionCalls || 0,
      ),
    )
    .toBe(1);
  await expect(notificationButton).toBeVisible();
  await expect(page.getByTestId("button-edit-full-profile")).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(uncaughtErrors).toEqual([]);
});

test("allow requests permission from the button and stays hidden when declined", async ({ page, request }) => {
  const user = await registerUser(request, "allow-declined");
  await prepareAuthenticatedPage(page, request, user);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-enable-notifications-banner").click();

  await expect
    .poll(() => page.evaluate(() => (window as typeof window & { __notificationPermissionCalls?: number })
      .__notificationPermissionCalls || 0))
    .toBe(1);
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PUSH_DECISION_KEY))
    .toBe("true");

  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});